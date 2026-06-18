// 战斗系统（docs/05）：自动结算 + 节拍战报 + 关系写回。战斗是故事生成器。
import type { CombatSpec, Disciple, WorldState, BattleReport, BattleBeatLine } from '@/shared/types'
import { realmPower, POWER_COMBAT_EXP, SYNERGY_PER_REL_TIER, DEFENSE_ARRAY_MUL_PER_LEVEL } from '../content/constants'
import { GONGFA_MAP } from '../content/gongfa'
import { ARTIFACT_MAP } from '../content/artifacts'
import { BEATS, SPECIAL_BEATS, type BeatCtx } from '../content/beats'
import type { RNG } from '../core/rng'
import { addMood, chronicle, deathRipple, getRel, hasTag, hasTrait, log, moodTier, removeDisciple, setRel, traitsOf } from './helpers'
import { DAYS_PER_YEAR } from '../core/clock'

export function disciplePower(d: Disciple): number {
  const gf = d.gongfa ? GONGFA_MAP.get(d.gongfa) : undefined
  const art = d.artifact ? ARTIFACT_MAP.get(d.artifact) : undefined
  let traitMod = 0
  for (const t of traitsOf(d)) traitMod += t.combatMul ?? 0
  const statusMul = d.status === 'injured' ? 0.5 : d.status === 'crippled' ? 0.4 : 1
  const moodMul = moodTier(d) <= -1 ? 0.85 : 1
  return (
    realmPower(d.realm, d.sub) *
    (1 + (gf?.combatMod ?? 0) + (art?.combatMod ?? 0) + d.combatExp * POWER_COMBAT_EXP + traitMod) *
    statusMul * moodMul
  )
}

export function teamPower(w: WorldState, team: Disciple[], defense = false): number {
  if (team.length === 0) return 0
  let sum = 0
  for (const d of team) sum += disciplePower(d)
  // 协同：队伍平均正向关系档（docs/05 §1）
  let relSum = 0
  let pairs = 0
  for (let i = 0; i < team.length; i++)
    for (let j = i + 1; j < team.length; j++) {
      const r = getRel(w, team[i].id, team[j].id)
      relSum += r ? r.value : 0
      pairs++
    }
  const avgTier = pairs > 0 ? Math.max(-2, Math.min(4, Math.floor(relSum / pairs / 25))) : 0
  let mul = 1 + avgTier * SYNERGY_PER_REL_TIER
  if (defense) mul *= 1 + (w.sect.facilities['wall'] ?? 0) * DEFENSE_ARRAY_MUL_PER_LEVEL
  return sum * mul
}

export interface CombatOutcome {
  win: boolean
  report: BattleReport
  deadIds: string[]
}

/** S 曲线胜率：P = R² / (R² + 1) */
export function winProb(ratio: number): number {
  return (ratio * ratio) / (ratio * ratio + 1)
}

export function resolveCombat(w: WorldState, spec: CombatSpec, team: Disciple[], rng: RNG): CombatOutcome {
  const power = teamPower(w, team, spec.defense)
  const ratio = power / Math.max(1, spec.enemyPower)
  const win = rng.chance(winProb(ratio))
  const lines: BattleBeatLine[] = []
  const casualties: string[] = []
  const deadIds: string[] = []
  const situation = ratio > 1.6 ? 'dominant' : ratio < 0.65 ? 'losing' : 'even'

  const name = (d: Disciple) => d.name
  const beatCtx = (): BeatCtx => {
    const a = rng.pick(team)
    const b = team.length > 1 ? rng.pick(team.filter((x) => x !== a)) : a
    return {
      a: name(a),
      b: name(b),
      enemy: spec.enemyName,
      gongfa: a.gongfa ? GONGFA_MAP.get(a.gongfa)!.name : '本门心法',
      artifact: a.artifact ? ARTIFACT_MAP.get(a.artifact)!.name : '长剑',
    }
  }

  // 1) 常规节拍 2~4 拍
  const nBeats = rng.int(2, 4)
  const pool = BEATS.filter((b) => b.situation === situation || b.situation === 'any')
  for (let i = 0; i < nBeats; i++) {
    const beat = rng.weighted(pool, (b) => b.weight)!
    lines.push({ text: beat.text(beatCtx()), tone: beat.tone })
  }

  // 2) 特殊节拍：顿悟（悟性高，小概率，真实加成战后修为）
  for (const d of team) {
    if (d.comprehension >= 8 && rng.chance(0.06)) {
      lines.push({ text: SPECIAL_BEATS.insight(d.name), tone: 'highlight' })
      d.cultivation += d.cultivation * 0.1 + 50
      addMood(d, 15)
      break
    }
  }

  // 3) 伤亡结算（docs/05 §3）：败方重掷，胜方惨胜也可能掷
  const lethality = spec.lethality ?? 0.5
  const lossSeverity = win ? Math.max(0, 0.35 - ratio * 0.15) : Math.min(0.85, 0.45 / Math.max(0.2, ratio))
  for (const d of [...team]) {
    if (!rng.chance(lossSeverity * lethality)) continue
    // 舍身相救：队中挚友/道侣承伤（docs/05 节拍真实参与结算）
    let victim = d
    const saviors = team.filter((o) => {
      if (o === d || casualties.includes(o.name)) return false
      const r = getRel(w, o.id, d.id)
      return !!r && r.value >= 50 && (hasTag(o, 'rescue') || r.type === 'couple' || rng.chance(0.4))
    })
    if (saviors.length > 0 && rng.chance(0.5)) {
      const savior = rng.pick(saviors)
      lines.push({ text: SPECIAL_BEATS.save(savior.name, d.name), tone: 'highlight' })
      setRel(w, d.id, savior.id, 'friend', 30)
      addMood(d, 10)
      victim = savior
    } else {
      // 见死不救：在场仇人 + 凉薄
      const hater = team.find((o) => {
        if (o === d) return false
        const r = getRel(w, o.id, d.id)
        return !!r && r.value <= -30
      })
      if (hater && rng.chance(0.4)) {
        lines.push({ text: SPECIAL_BEATS.ignore(hater.name, d.name), tone: 'bad' })
        setRel(w, d.id, hater.id, 'rival', -25)
      }
    }
    // victim 受创程度（境界越高自愈越快）
    const healMul = 1 / (1 + victim.realm * 0.12)
    const roll = rng.next()
    if (roll < 0.45) {
      victim.status = 'injured'
      victim.statusUntil = w.day + Math.round(rng.int(60, 360) * healMul)
      casualties.push(victim.name + '（轻伤）')
      lines.push({ text: SPECIAL_BEATS.injured(victim.name), tone: 'bad' })
    } else if (roll < 0.8) {
      victim.status = 'injured'
      victim.statusUntil = w.day + Math.round(rng.int(1, 3) * DAYS_PER_YEAR * healMul)
      victim.buffs.scar = (victim.buffs.scar ?? 0) + 1
      casualties.push(victim.name + '（重伤）')
      lines.push({ text: SPECIAL_BEATS.injured(victim.name), tone: 'bad' })
    } else {
      // 致命：护身法宝 → 死亡保护阀 → 阵亡
      const art = victim.artifact ? ARTIFACT_MAP.get(victim.artifact) : undefined
      if (art?.guard) {
        lines.push({ text: SPECIAL_BEATS.guardBreak(victim.name, art.name), tone: 'highlight' })
        victim.artifact = null
        victim.status = 'injured'
        victim.statusUntil = w.day + rng.int(180, 540)
        casualties.push(victim.name + '（法宝碎裂）')
      } else if ((victim.rank === 'core' || victim.rank === 'elder' || victim.rank === 'master') && !victim.deathProtected) {
        victim.deathProtected = true
        lines.push({ text: SPECIAL_BEATS.guardBreak(victim.name, '护道印记'), tone: 'highlight' })
        victim.status = 'injured'
        victim.statusUntil = w.day + rng.int(1, 3) * DAYS_PER_YEAR
        casualties.push(victim.name + '（濒死获救）')
      } else {
        lines.push({ text: SPECIAL_BEATS.fall(victim.name), tone: 'bad' })
        casualties.push(victim.name + '（阵亡）')
        deadIds.push(victim.id)
      }
    }
  }

  // 4) 击杀节拍（杀伐特质 + 胜利）
  if (win) {
    const killer = team.find((d) => hasTrait(d, 'ruthless') && !deadIds.includes(d.id))
    if (killer && rng.chance(0.5)) lines.push({ text: SPECIAL_BEATS.kill(killer.name, spec.enemyName), tone: 'good' })
  } else {
    const hero = team.find((d) => (hasTrait(d, 'resolute') || hasTag(d, 'rescue')) && !deadIds.includes(d.id))
    if (hero && rng.chance(0.4)) lines.push({ text: SPECIAL_BEATS.lastStand(hero.name), tone: 'highlight' })
  }

  // 5) 收尾与战利品
  for (const d of team) {
    if (deadIds.includes(d.id)) continue
    d.combatExp += win ? 2 : 1
    addMood(d, win ? 8 : -12)
  }
  if (win) {
    w.sect.stones += spec.lootStones ?? 0
    w.sect.materials += spec.lootMaterials ?? 0
    w.sect.reputation += spec.kind === 'sectwar' ? 30 : spec.kind === 'beast' ? 8 : 5
  } else {
    w.sect.reputation = Math.max(0, w.sect.reputation - (spec.kind === 'sectwar' ? 25 : 8))
  }
  // 阵亡处理
  for (const id of deadIds) {
    const d = team.find((x) => x.id === id)!
    chronicle(w, 'death', `${d.name}战殁于${spec.enemyName}之役。`)
    deathRipple(w, d)
    removeDisciple(w, d, `战死（${spec.enemyName}）`)
  }

  lines.push({
    text: win
      ? `此役得胜${casualties.length ? '，然' + casualties.join('、') : '，全员凯旋'}。`
      : `此役失利，${casualties.length ? casualties.join('、') + '。' : ''}残部退守山门。`,
    tone: win ? 'good' : 'bad',
  })

  const report: BattleReport = {
    uid: ++w.uidCounter,
    day: w.day,
    title: `${spec.enemyName}之战`,
    win,
    lines,
    casualties,
  }
  w.reports.push(report)
  if (w.reports.length > 20) w.reports.splice(0, w.reports.length - 20)
  log(w, 'combat', `【${report.title}】${win ? '胜' : '败'}${casualties.length ? '（' + casualties.join('、') + '）' : ''}`)
  return { win, report, deadIds }
}

/** 天劫：单人 + 宗门支援 vs 天雷（docs/02 §4） */
export function resolveTribulation(w: WorldState, d: Disciple, thunderPower: number, rng: RNG): { survived: boolean } {
  const supporters = w.disciples.filter((o) => o !== d && o.realm >= Math.min(d.realm, 7) && o.status === 'normal').length
  const wallLv = w.sect.facilities['wall'] ?? 0
  const personal = disciplePower(d) * (1 + supporters * 0.08 + wallLv * 0.04)
  const p = winProb(personal / thunderPower)
  const survived = rng.chance(Math.max(0.32, p)) // 天劫本质是成功突破的附加考验，给保底
  log(w, 'combat', `${d.name}于山巅渡劫，${supporters > 0 ? `${supporters}位同门护法，` : ''}雷云压顶……${survived ? '雷霆散尽，劫渡过了！' : '天威难测！'}`, 4)
  return { survived }
}
