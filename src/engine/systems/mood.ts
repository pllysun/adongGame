// 心境系统（docs/01 §5）：旬回归 + 心魔检定
import type { WorldState } from '@/shared/types'
import { DEMONIC_CHECK_MONTHLY, MOOD_REGRESS_PER_XUN } from '../content/constants'
import type { RNG } from '../core/rng'
import { addMood, chronicle, deathRipple, log, removeDisciple } from './helpers'

export function moodXun(w: WorldState): void {
  const quietLv = w.sect.facilities['quiet'] ?? 0
  const recover = MOOD_REGRESS_PER_XUN * (1 + quietLv * 0.25)
  for (const d of w.disciples) {
    // 向基线（+10）回归，心性越高回得越快
    const baseline = 10
    const rate = recover * (d.mindstate / 5)
    if (d.mood < baseline) d.mood = Math.min(baseline, d.mood + rate)
    else if (d.mood > baseline) d.mood = Math.max(baseline, d.mood - rate * 0.4) // 高心境消退慢
  }
}

/** 月度心魔检定：心魔缠身者可能走火入魔（疯癫/入魔出走/自愈），由 xinmo 驱动（docs/09） */
export function demonicMonthly(w: WorldState, rng: RNG): void {
  for (const d of [...w.disciples]) {
    if (d.status !== 'demonic') continue
    // 心魔已平复（xinmo 低）+ 心性，自渡出魔
    if (d.beliefs.xinmo < 40 && rng.chance(0.1 + d.mindstate * 0.04)) {
      d.status = 'normal'
      d.beliefs.xinmo = Math.max(0, d.beliefs.xinmo - 10)
      addMood(d, 20)
      log(w, 'social', `${d.name}心魔渐消，重归清明。`)
      continue
    }
    // xinmo 仍高者才有噬主/叛走之险
    if (d.beliefs.xinmo >= 50 && rng.chance(DEMONIC_CHECK_MONTHLY)) {
      if (rng.chance(0.5)) {
        log(w, 'death', `${d.name}心魔噬主，经脉逆行而亡。`, 4)
        chronicle(w, 'death', `${d.name}为心魔所噬，含恨而终。`)
        deathRipple(w, d)
        removeDisciple(w, d, '心魔噬主')
      } else {
        log(w, 'death', `${d.name}入魔出走，不知所踪。`, 4)
        chronicle(w, 'defect', `${d.name}入魔叛走，自此与宗门为敌。`)
        deathRipple(w, d)
        removeDisciple(w, d, '入魔叛走')
        w.enemies['xuanming'] = Math.min(100, (w.enemies['xuanming'] ?? 0) + 8)
      }
    }
  }
}
