// 事件层共享工具：文本变体 + 战略轴状态（全部存 w.flags，避免改 WorldState 结构与存档迁移）
import type { WorldState } from '@/shared/types'
import type { RNG } from '../../core/rng'

/** 从若干文案变体中随机取一句（在 text() 内调用，fire 时消耗一次引擎 RNG，确定性安全） */
export function vary(rng: RNG, arr: readonly string[]): string {
  return rng.pick(arr)
}

export function flagNum(w: WorldState, key: string): number {
  const v = w.flags[key]
  return typeof v === 'number' ? v : 0
}
/** 累加并夹取数值型 flag（战略轴默认 0~100） */
export function addFlag(w: WorldState, key: string, delta: number, min = 0, max = 100): void {
  w.flags[key] = Math.max(min, Math.min(max, flagNum(w, key) + delta))
}

// ── 外交：友宗（与 w.enemies 对称，goodwill 0~100，存 flags['ally:<id>']）──
export const ALLY_NAMES: Record<string, string> = {
  danxia: '丹霞谷',
  biyou: '碧游宫',
  taiyi: '太一门',
  kunwu: '昆吾剑派',
}
export const ALLY_IDS = Object.keys(ALLY_NAMES)

export function allies(w: WorldState): { id: string; name: string; goodwill: number }[] {
  return ALLY_IDS.map((id) => ({ id, name: ALLY_NAMES[id], goodwill: flagNum(w, 'ally:' + id) })).filter(
    (a) => a.goodwill > 0,
  )
}

/** 正魔倾向：0 纯正道 ~ 100 纯魔道。决定讨魔/魔教两条互斥事件线与内部稳定度 */
export function demonLean(w: WorldState): number {
  return flagNum(w, 'demonLean')
}
