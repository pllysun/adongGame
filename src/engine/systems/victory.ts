// 胜负判定（docs/00 §胜利与失败）
import type { WorldState } from '@/shared/types'
import { VICTORY_DUJIE_COUNT } from '../content/constants'
import type { RNG } from '../core/rng'
import { chronicle, log } from './helpers'

export function victoryMonthly(w: WorldState, rng: RNG): void {
  if (w.gameOver) return
  // 灭门
  if (w.disciples.length === 0) {
    w.gameOver = { type: 'defeat', day: w.day, reason: '门下再无一人，山门就此倾颓。' }
    chronicle(w, 'end', `${w.sect.name}传承断绝，灭门于天玄历${Math.floor(w.day / 360) + 1}年。`)
    return
  }
  // 飞升条件：渡劫期 ≥ 3 → 触发飞升大典事件链
  const dujie = w.disciples.filter((d) => d.realm >= 9)
  if (dujie.length >= VICTORY_DUJIE_COUNT && !w.flags['ascensionStarted']) {
    w.flags['ascensionStarted'] = true
    w.scheduled.push({ day: w.day + rng.int(30, 90), eventId: 'ascension_1', cast: {} })
    log(w, 'system', `宗内已有${dujie.length}位渡劫大能，飞升大典的筹备悄然开始……`, 6)
  }
}

export function declareVictory(w: WorldState): void {
  w.gameOver = { type: 'victory', day: w.day, reason: '举宗飞升，仙界已开。' }
  chronicle(w, 'end', `${w.sect.name}举宗飞升，立派${Math.floor(w.day / 360)}载，自此仙凡两隔，传说不灭。`)
}
