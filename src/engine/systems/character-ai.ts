// 角色 AI（docs/09 §3.4）：用 AI 内核让角色自主做个人抉择。考量全部建在五轴心相 + 特质 + 记忆上。
import type { Disciple, WorldState } from '@/shared/types'
import { band, decide, linear, pipe, power, temperatureFromMindstate, type Consideration } from '../ai'
import type { RNG } from '../core/rng'
import { hasMemoryTag } from './biography'

/** 决策上下文：deciding disciple + world（考量可读世界局势/玩家影响） */
export interface AiCtx {
  self: Disciple
  w: WorldState
}

/** 可复用的考量构件——事件作者用它们拼出"这个选项对这个角色有多大吸引力" */
export const C = {
  xinmo: (w = 1): Consideration<AiCtx> => ({ name: '心魔', input: (c) => c.self.beliefs.xinmo, curve: pipe(band(0, 100), power(1.4)), weight: w }),
  daoxin: (w = 1): Consideration<AiCtx> => ({ name: '道心', input: (c) => c.self.beliefs.daoxin, curve: band(0, 100), weight: w }),
  daoxinResist: (w = 1): Consideration<AiCtx> => ({ name: '道心阻力', input: (c) => c.self.beliefs.daoxin, curve: band(0, 100, true), weight: w }),
  molean: (w = 1): Consideration<AiCtx> => ({ name: '魔倾', input: (c) => c.self.beliefs.molean, curve: band(0, 100), weight: w }),
  righteous: (w = 1): Consideration<AiCtx> => ({ name: '正念', input: (c) => c.self.beliefs.molean, curve: band(0, 100, true), weight: w }),
  loyalty: (w = 1): Consideration<AiCtx> => ({ name: '忠诚', input: (c) => c.self.beliefs.loyalty, curve: band(0, 100), weight: w }),
  disloyal: (w = 1): Consideration<AiCtx> => ({ name: '离心', input: (c) => c.self.beliefs.loyalty, curve: band(0, 100, true), weight: w }),
  fame: (w = 1): Consideration<AiCtx> => ({ name: '声名', input: (c) => c.self.beliefs.fame, curve: band(0, 100), weight: w }),
  trait: (id: string, name: string, w = 1): Consideration<AiCtx> => ({ name, input: (c) => (c.self.traits.includes(id) ? 1 : 0), curve: linear(1, 0), weight: w }),
  memory: (tag: string, name: string, w = 1): Consideration<AiCtx> => ({ name, input: (c) => (hasMemoryTag(c.self, tag) ? 1 : 0), curve: linear(1, 0), weight: w }),
  base: (name: string, v: number, w = 1): Consideration<AiCtx> => ({ name, input: () => v, curve: linear(1, 0), weight: w }),
  /** 玩家影响修正：从 self.buffs / flags 读"赐丹/护道/规则"留下的临时倾向 */
  guidance: (name: string, fn: (c: AiCtx) => number, w = 1): Consideration<AiCtx> => ({ name, input: fn, curve: band(0, 1), weight: w }),
}

export interface AiOption<O> {
  option: O
  considerations: Consideration<AiCtx>[]
}

/** 角色在若干选项中自主抉择（softmax，温度由心性决定）。返回选中项与解释明细。 */
export function chooseForCharacter<O>(self: Disciple, w: WorldState, opts: AiOption<O>[], rng: RNG) {
  const ctx: AiCtx = { self, w }
  const res = decide<AiCtx, { option: O; considerations: Consideration<AiCtx>[] }>({
    candidates: opts,
    context: () => ctx,
    considerations: (o) => o.considerations,
    selection: 'softmax',
    temperature: temperatureFromMindstate(self.mindstate),
    rng,
  })
  const chosen = res.chosen
  return {
    option: chosen ? chosen.option : opts[0]?.option ?? null,
    appraisal: chosen ? res.ranked.find((r) => r.option === chosen)!.appraisal : null,
  }
}
