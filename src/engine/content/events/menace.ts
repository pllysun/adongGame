// 威胁缩放：敌人强度锚定宗门自身战力（而非随年代指数膨胀），保证各时代的战斗都有意义
import type { WorldState } from '@/shared/types'
import { disciplePower } from '../../systems/combat'

/**
 * 宗门威胁基准 = 最强三名弟子战力之和。
 * mul < 1 = 小股敌人；≈1 = 势均力敌；> 1 = 灭顶之灾（需要护山大阵/全员死战）
 */
export function sectMenace(w: WorldState, mul: number): number {
  const powers = w.disciples
    .map((d) => disciplePower(d))
    .sort((a, b) => b - a)
    .slice(0, 3)
  const base = powers.reduce((s, p) => s + p, 0)
  return Math.max(30, base * mul)
}
