// 生命周期月结算（docs/01 §8 / docs/02 §5）：寿元、灯枯、传功、状态恢复、晋升、继任
import type { Disciple, WorldState } from '@/shared/types'
import { REALM_NAMES, RANK_NAMES } from '@/shared/rarity'
import { DYING_YEARS } from '../content/constants'
import { ageYears } from '../core/clock'
import type { RNG } from '../core/rng'
import { lifespanOf } from './breakthrough'
import { addMood, chronicle, deathRipple, log, relsOf, removeDisciple, getD } from './helpers'

export function lifecycleMonthly(w: WorldState, rng: RNG): void {
  for (const d of [...w.disciples]) {
    const age = ageYears(d.birthDay, w.day)
    const lifespan = lifespanOf(d)

    // 状态自然恢复
    if ((d.status === 'injured' || d.status === 'seclusion') && w.day >= d.statusUntil) {
      d.status = 'normal'
    }

    // 灯枯期
    if (age >= lifespan - DYING_YEARS && d.status !== 'dying' && d.realm < 9) {
      d.status = 'dying'
      log(w, 'death', `${d.name}寿元将尽，进入灯枯之年。`)
    }

    // 寿终
    if (age >= lifespan) {
      // 传功（docs/02 §5）：将毕生修为一部分灌给关系最深的后辈
      const heirs = relsOf(w, d.id)
        .filter((r) => r.value > 30)
        .map((r) => getD(w, r.a === d.id ? r.b : r.a))
        .filter((x): x is Disciple => !!x && x.realm < d.realm)
      if (heirs.length > 0 && d.realm >= 2) {
        const heir = heirs.sort((a, b) => b.shownAptitude - a.shownAptitude)[0]
        heir.cultivation += d.cultivation * 0.3 + d.realm * 100
        addMood(heir, -15) // 悲伤但有传承
        log(w, 'death', `${d.name}油尽灯枯，坐化前将毕生修为传予${heir.name}。`)
      } else {
        log(w, 'death', `${d.name}寿元耗尽，坐化于洞府之中，享年${age}岁。`)
      }
      if (d.realm >= 3) chronicle(w, 'death', `${REALM_NAMES[d.realm]}修士${d.name}坐化，享年${age}岁。`)
      deathRipple(w, d)
      removeDisciple(w, d, '寿终坐化')
      continue
    }
  }

  promotions(w)
  succession(w, rng)
}

/** 晋升规则（docs/03 §5）：按宗门规则自动晋升 */
function promotions(w: WorldState): void {
  const rules = w.sect.rules
  for (const d of w.disciples) {
    if (d.rank === 'outer' && (d.realm > rules.innerRealm || (d.realm === rules.innerRealm && d.sub === 2))) {
      d.rank = 'inner'
      addMood(d, 10)
    } else if (d.rank === 'inner' && d.realm >= 2 && d.shownAptitude >= rules.coreAptitude) {
      d.rank = 'core'
      addMood(d, 15)
      log(w, 'social', `${d.name}晋为真传弟子，赐灵穴洞府。`)
    } else if (d.rank === 'core' && d.realm >= 3) {
      // 长老名额：每 10 名弟子 1 个
      const elderCap = Math.max(1, Math.floor(w.disciples.length / 10))
      const elders = w.disciples.filter((x) => x.rank === 'elder').length
      if (elders < elderCap) {
        d.rank = 'elder'
        log(w, 'social', `${d.name}升任长老，执掌一方事务。`)
      }
    }
  }
}

/** 掌门继任：掌门亡故后由最高境界长老接任（野心者可能争位 → 事件钩子） */
function succession(w: WorldState, rng: RNG): void {
  if (w.disciples.some((d) => d.rank === 'master')) return
  if (w.disciples.length === 0) return
  const candidates = [...w.disciples].sort(
    (a, b) => b.realm * 100 + b.sub * 10 + b.shownAptitude - (a.realm * 100 + a.sub * 10 + a.shownAptitude),
  )
  const ambitious = candidates.filter((d) => d.traits.includes('ambitious') && d.realm >= 2)
  if (ambitious.length >= 2 && rng.chance(0.5)) {
    w.flags['successionDispute'] = true // 夺位事件链钩子
  }
  const heir = candidates[0]
  heir.rank = 'master'
  log(w, 'system', `${heir.name}继任掌门之位。`)
  chronicle(w, 'succession', `${heir.name}继任${w.sect.name}掌门（${RANK_NAMES['master']}）。`)
}
