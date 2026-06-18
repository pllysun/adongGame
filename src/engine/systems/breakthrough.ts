// 突破判定（docs/02 §3-4）：游戏最核心的一次掷骰 + 元婴以上的天劫
import type { Disciple, WorldState } from '@/shared/types'
import { REALM_NAMES } from '@/shared/rarity'
import {
  baseBreakRate, BONUS_CAVE, BONUS_GONGFA_FIT, BONUS_GUARD, BONUS_INSIGHT, BONUS_MOOD_HIGH, BONUS_MOOD_LOW,
  BREAK_RATE_CEIL, BREAK_RATE_FLOOR, FAIL_DEMONIC_MINDSTATE_RELIEF, FAIL_TABLE, INSIGHT_CHANCE_PER_COMP,
  LIFESPAN, MINOR_BREAK_BASE, MINOR_BREAK_REALM_PENALTY, PENALTY_GONGFA_UNFIT, realmPower,
  TRIBULATION_DEATH_RATE, TRIBULATION_FROM_REALM, TRIBULATION_POWER_MUL,
} from '../content/constants'
import { GONGFA_MAP, gongfaFitsRealm } from '../content/gongfa'
import { DAYS_PER_YEAR } from '../core/clock'
import type { RNG } from '../core/rng'
import { addMood, chronicle, deathRipple, hasTrait, log, moodTier, removeDisciple } from './helpers'
import { addBelief } from './psyche'
import { remember } from './biography'
import { resolveTribulation } from './combat'

/** 实际资质：伤仲永长期受挫按低一品走（docs/01 §2） */
export function effectiveAptitude(d: Disciple): number {
  if (hasTrait(d, 'earlyFade') && d.breakthroughFails >= 2) return Math.max(0, d.aptitude - 1)
  return d.aptitude
}

export function breakChance(w: WorldState, d: Disciple): { rate: number; insightChance: number } {
  const target = d.realm + 1
  const base = baseBreakRate(effectiveAptitude(d) as never, target)
  let bonus = 0
  if (d.buffs.breakthroughPill) bonus += d.buffs.breakthroughPill
  const tier = moodTier(d)
  if (tier === 2) bonus += BONUS_MOOD_HIGH
  else if (tier <= -1) bonus += BONUS_MOOD_LOW
  // 灵穴洞府：洞府≥4级的真传以上
  if ((w.sect.facilities['caves'] ?? 0) >= 4 && (d.rank === 'core' || d.rank === 'elder' || d.rank === 'master'))
    bonus += BONUS_CAVE
  // 护道：存在境界更高的同门
  if (w.disciples.some((o) => o !== d && o.realm > d.realm && o.status === 'normal')) bonus += BONUS_GUARD
  const gf = d.gongfa ? GONGFA_MAP.get(d.gongfa) : undefined
  bonus += gf && gongfaFitsRealm(gf, target) ? BONUS_GONGFA_FIT : PENALTY_GONGFA_UNFIT
  return {
    rate: Math.max(BREAK_RATE_FLOOR, Math.min(BREAK_RATE_CEIL, base * (1 + bonus))),
    insightChance: d.comprehension * INSIGHT_CHANCE_PER_COMP,
  }
}

function succeed(w: WorldState, d: Disciple, rng: RNG): void {
  const target = d.realm + 1
  d.realm = target
  d.sub = 0
  d.cultivation = 0
  d.bottleneck = false
  d.breakthroughFails = 0
  d.buffs.breakthroughPill = undefined
  addMood(d, 30)
  // 大器晚成：突破时机缘觉醒（docs/01 §2）
  if (hasTrait(d, 'lateBloomer') && d.shownAptitude < d.aptitude) {
    d.shownAptitude = d.aptitude
    log(w, 'breakthrough', `${d.name}突破之际气象大变——竟是大器晚成之姿，真实资质显露！`, d.aptitude)
    chronicle(w, 'awaken', `${d.name}资质觉醒，举宗震动。`)
  }
  log(w, 'breakthrough', `${d.name}突破成功，晋入${REALM_NAMES[target]}期！`, d.aptitude)
  // 晋入大境界是人生里程碑，记入经历树并稳固道心
  remember(d, w.day, {
    eventId: 'breakthrough', text: `${d.name}晋入${REALM_NAMES[target]}，道行更进一层。`,
    kind: target >= 4 ? 'turning' : 'minor', tags: ['突破', REALM_NAMES[target]], impact: { daoxin: 3, fame: target },
  })
  if (target >= 3) chronicle(w, 'breakthrough', `${d.name}晋入${REALM_NAMES[target]}，宗门气象为之一新。`)
  if (!w.stats.firstRealm[target]) {
    w.stats.firstRealm[target] = w.day
    if (target >= 3) w.sect.reputation += target * 15
  } else if (target >= 3) {
    w.sect.reputation += target * 5
  }
  if (rng.chance(0.3)) w.sect.qiyun += 1
}

function fail(w: WorldState, d: Disciple, rng: RNG): void {
  d.breakthroughFails++
  d.buffs.breakthroughPill = undefined
  // 失败结果表（心性减走火入魔权重）
  const demonW = Math.max(1, FAIL_TABLE.demonic - d.mindstate * FAIL_DEMONIC_MINDSTATE_RELIEF)
  const deathW = FAIL_TABLE.death * (d.realm >= 5 ? 2 : 1)
  const entries = [
    { k: 'setback', w: FAIL_TABLE.setback },
    { k: 'injury', w: FAIL_TABLE.injury },
    { k: 'demonic', w: demonW },
    { k: 'drop', w: FAIL_TABLE.drop },
    { k: 'death', w: deathW },
  ]
  const picked = rng.weighted(entries, (e) => e.w)!.k
  switch (picked) {
    case 'setback':
      d.cultivation *= 0.9
      d.bottleneck = false
      addMood(d, -15)
      d.status = 'seclusion'
      d.statusUntil = w.day + rng.int(1, 3) * DAYS_PER_YEAR
      log(w, 'breakthrough', `${d.name}冲击${REALM_NAMES[d.realm + 1]}失败，闭关疗养。`)
      break
    case 'injury':
      d.status = 'injured'
      d.statusUntil = w.day + rng.int(3, 10) * DAYS_PER_YEAR
      d.bottleneck = false
      d.cultivation *= 0.85
      addMood(d, -25)
      log(w, 'breakthrough', `${d.name}突破失败身受重创，灵台震荡，需长期疗伤。`)
      break
    case 'demonic':
      d.status = 'demonic'
      d.mood = Math.min(d.mood, -70)
      addBelief(d, 'xinmo', 45) // 走火入魔 = 心魔暴涨，驱动后续噬主/自渡
      d.bottleneck = false
      remember(d, w.day, {
        eventId: 'breakthrough_demon', text: `${d.name}冲关走火入魔，险些万劫不复。`,
        kind: 'turning', tags: ['走火入魔'], impact: {},
      })
      log(w, 'breakthrough', `${d.name}突破失败，走火入魔，心魔缠身！`, 4)
      chronicle(w, 'demonic', `${d.name}冲关失败走火入魔，生死悬于一线。`)
      break
    case 'drop':
      d.realm = Math.max(1, d.realm - 1)
      d.sub = 0
      d.cultivation = 0
      d.bottleneck = false
      addMood(d, -40)
      log(w, 'breakthrough', `${d.name}突破失败，境界跌落至${REALM_NAMES[d.realm]}！`, 4)
      break
    case 'death':
      log(w, 'death', `${d.name}强行冲关，经脉俱断，身死道消。`, 5)
      chronicle(w, 'death', `${d.name}冲击${REALM_NAMES[d.realm + 1]}陨落，享年${Math.floor((w.day - d.birthDay) / DAYS_PER_YEAR)}岁。`)
      deathRipple(w, d)
      removeDisciple(w, d, '冲关陨落')
      break
  }
}

/** 大境界突破全流程（含天劫） */
export function attemptMajorBreakthrough(w: WorldState, d: Disciple, rng: RNG): void {
  const target = d.realm + 1
  if (target > 9) return
  const { rate, insightChance } = breakChance(w, d)
  const insight = rng.chance(insightChance)
  const final = Math.min(BREAK_RATE_CEIL, insight ? rate * (1 + BONUS_INSIGHT) : rate)
  if (insight) log(w, 'breakthrough', `${d.name}冲关之际触机顿悟，胜算大增！`)

  if (!rng.chance(final)) {
    fail(w, d, rng)
    return
  }
  // 元婴及以上：突破成功后渡天劫（docs/02 §4）
  if (target >= TRIBULATION_FROM_REALM) {
    const thunder = realmPower(target, 0) * TRIBULATION_POWER_MUL * (target >= 9 ? 1.5 : 1)
    const result = resolveTribulation(w, d, thunder, rng)
    if (!result.survived) {
      if (rng.chance(TRIBULATION_DEATH_RATE) && !consumeProtection(w, d)) {
        log(w, 'death', `天劫之下，${d.name}形神俱灭。`, 5)
        chronicle(w, 'death', `${d.name}渡${REALM_NAMES[target]}天劫失败，魂归天地。`)
        deathRipple(w, d)
        removeDisciple(w, d, '天劫陨落')
      } else {
        d.status = 'injured'
        d.statusUntil = w.day + rng.int(5, 15) * DAYS_PER_YEAR
        d.cultivation *= 0.7
        d.bottleneck = false
        addMood(d, -35)
        log(w, 'breakthrough', `${d.name}渡劫失败重伤垂死，侥幸保住性命。`, 4)
      }
      return
    }
  }
  succeed(w, d, rng)
}

/** 死亡保护阀（docs/05 §3）：真传以上首次致命必有一次挽救 */
export function consumeProtection(w: WorldState, d: Disciple): boolean {
  if (d.deathProtected) return false
  if (d.rank === 'outer' || d.rank === 'inner') return false
  d.deathProtected = true
  log(w, 'combat', `千钧一发之际，护道宝光骤现，${d.name}从鬼门关被拉了回来！`, 4)
  return true
}

/** 小层突破：修为满自动尝试 */
export function attemptMinorBreakthrough(_w: WorldState, d: Disciple, rng: RNG): void {
  const p = MINOR_BREAK_BASE - d.realm * MINOR_BREAK_REALM_PENALTY
  if (rng.chance(p)) {
    d.sub = (d.sub + 1) as never
    d.cultivation = 0
    d.bottleneck = false
    addMood(d, 8)
  } else {
    d.cultivation *= 0.85
    d.bottleneck = false
    addMood(d, -8)
  }
}

/** 旬 tick：处理瓶颈弟子 */
export function breakthroughXun(w: WorldState, rng: RNG): void {
  for (const d of [...w.disciples]) {
    if (!d.bottleneck || d.status === 'demonic' || d.status === 'injured') continue
    if (d.sub < 2) {
      attemptMinorBreakthrough(w, d, rng)
      continue
    }
    // 大境界瓶颈
    if (d.realm >= 9) continue // 渡劫期已是顶点
    if (w.sect.rules.autoBreakthrough) {
      // 给丹药（按规则优先级自动配给）
      autoGrantPill(w, d)
      attemptMajorBreakthrough(w, d, rng)
    } else {
      // 等待玩家批准：挂一个询问（每人只挂一次，被驳回后一年内不再问）
      if ((w.cooldowns['ask:' + d.id] ?? 0) > w.day) continue
      if (!w.queue.some((q) => q.kind === 'breakthrough-ask' && q.castIds[0] === d.id)) {
        w.queue.push({
          uid: ++w.uidCounter,
          kind: 'breakthrough-ask',
          title: `${d.name}请求闭关冲击${REALM_NAMES[d.realm + 1]}`,
          text: `${d.name}修为已至${REALM_NAMES[d.realm]}后期圆满，请求闭关冲击${REALM_NAMES[d.realm + 1]}。是否准许？`,
          castIds: [d.id],
          options: [
            { idx: 0, text: '准许冲关' },
            { idx: 1, text: '再积淀些时日' },
          ],
          pause: true,
        })
      }
    }
  }
}

import { breakthroughPillsFor } from '../content/pills'
import { PILL_MAP } from '../content/pills'

export function autoGrantPill(w: WorldState, d: Disciple): void {
  if (d.buffs.breakthroughPill) return
  const rules = w.sect.rules
  if (rules.pillPriority === 'none') return
  // 资质优先：地品以下不自动给丹
  if (rules.pillPriority === 'aptitude' && d.shownAptitude < 2) return
  for (const p of breakthroughPillsFor(d.realm + 1)) {
    if ((w.sect.pills[p.id] ?? 0) > 0) {
      w.sect.pills[p.id]--
      d.buffs.breakthroughPill = PILL_MAP.get(p.id)!.power
      return
    }
  }
}

/** 寿元（年），供 lifecycle 使用 */
export function lifespanOf(d: Disciple): number {
  return LIFESPAN[Math.min(d.realm, LIFESPAN.length - 1)]
}
