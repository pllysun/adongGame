// 选择策略（docs/09 §2）：给一组候选各算心动值，再按策略选一个。确定性走 RNG。
// 这是所有"做决定"的统一入口——角色抉择、事件加权、功法选择、入峰、战斗目标，皆调此。
import type { RNG } from '../core/rng'
import type { Aggregation, Appraisal, Consideration } from './utility'
import { appraise } from './utility'

export type Selection =
  | 'argmax' // 选最高（理性）
  | 'softmax' // 玻尔兹曼按 exp(score/温度) 抽取；温度=性格，低温→理性、高温→冲动
  | 'weighted' // 线性按 score 抽取

export interface Ranked<O> {
  option: O
  appraisal: Appraisal
}

export interface DecideOptions<C, O> {
  candidates: O[]
  /** 每个候选的上下文（可与全局共享，也可逐候选不同） */
  context: (option: O) => C
  /** 每个候选要考量些什么（考量可依候选而异） */
  considerations: (option: O) => Consideration<C>[]
  aggregation?: Aggregation
  selection?: Selection
  /** softmax 温度，建议 0.05（冷静）~ 1.0（冲动），由心性映射 */
  temperature?: number
  /** 低于此分的候选不予考虑（全被过滤则回退到最高分者） */
  floor?: number
  rng: RNG
}

export interface DecideResult<O> {
  chosen: O | null
  ranked: Ranked<O>[] // 按 score 降序
}

const MIN_TEMP = 0.02

export function decide<C, O>(opts: DecideOptions<C, O>): DecideResult<O> {
  const { candidates, context, considerations, rng } = opts
  const aggregation = opts.aggregation ?? 'dampedProduct'
  const selection = opts.selection ?? 'softmax'

  if (candidates.length === 0) return { chosen: null, ranked: [] }

  const ranked: Ranked<O>[] = candidates.map((option) => ({
    option,
    appraisal: appraise(context(option), considerations(option), aggregation),
  }))
  ranked.sort((a, b) => b.appraisal.score - a.appraisal.score)

  // 候选过滤：低于地板的剔除；若全剔除则保留最高分者
  const floor = opts.floor ?? 0
  let pool = ranked.filter((r) => r.appraisal.score >= floor)
  if (pool.length === 0) pool = [ranked[0]]

  let chosen: O
  switch (selection) {
    case 'argmax': {
      const best = pool[0].appraisal.score
      const tied = pool.filter((r) => r.appraisal.score >= best - 1e-9)
      chosen = rng.pick(tied).option
      break
    }
    case 'weighted': {
      const picked = rng.weighted(pool, (r) => r.appraisal.score)
      chosen = (picked ?? pool[0]).option
      break
    }
    case 'softmax':
    default: {
      const t = Math.max(MIN_TEMP, opts.temperature ?? 0.25)
      const picked = rng.weighted(pool, (r) => Math.exp(r.appraisal.score / t))
      chosen = (picked ?? pool[0]).option
      break
    }
  }

  return { chosen, ranked }
}

/** 性格 → softmax 温度：心性高（理性沉稳）温度低，心性低（冲动）温度高。 */
export function temperatureFromMindstate(mindstate: number): number {
  // mindstate 1~10 → 温度 0.5(冲动) ~ 0.06(冷静)
  const t = 0.56 - mindstate * 0.05
  return Math.max(MIN_TEMP, t)
}
