// 效用聚合（docs/09 §2）：把若干"考量"合成一个 [0,1] 的心动值，并保留明细以供解释。
// 明细（terms）是经历树"为什么他这么选"的数据来源，也是调参与 debug 的窗口。
import type { Curve } from './curves'
import { clamp01 } from './curves'

/** 一条考量：从上下文取原始值 → 经响应曲线 → [0,1]，带权重。任意系统都可往决策里注册自己的考量。 */
export interface Consideration<C> {
  name: string
  input: (ctx: C) => number
  curve: Curve
  weight?: number // 默认 1
}

export interface Term {
  name: string
  raw: number
  curved: number
  weight: number
}

export interface Appraisal {
  score: number // [0,1]
  terms: Term[] // 按贡献降序，供解释
}

/**
 * 聚合模式：
 * - dampedProduct（默认）：乘积式否决 + Dave Mark 补偿——任一考量低会显著压低总分，
 *   但补偿因子防止"考量越多分越趋零"。最稳健，适合大多数抉择。
 * - product：硬否决，任一考量为 0 则总分 0（用于"绝对前置条件"）。
 * - avg：加权平均，温和、各考量可相互弥补（用于"综合评分"）。
 * - min：取最弱一环（短板决定）。
 */
export type Aggregation = 'dampedProduct' | 'product' | 'avg' | 'min'

function evalTerms<C>(ctx: C, cons: Consideration<C>[]): Term[] {
  return cons.map((c) => {
    const raw = c.input(ctx)
    return { name: c.name, raw, curved: clamp01(c.curve(raw)), weight: c.weight ?? 1 }
  })
}

export function aggregate(terms: Term[], mode: Aggregation = 'dampedProduct'): number {
  if (terms.length === 0) return 0
  switch (mode) {
    case 'avg': {
      let wsum = 0
      let acc = 0
      for (const t of terms) {
        wsum += t.weight
        acc += t.curved * t.weight
      }
      return wsum > 0 ? clamp01(acc / wsum) : 0
    }
    case 'min':
      return clamp01(Math.min(...terms.map((t) => t.curved)))
    case 'product': {
      let p = 1
      for (const t of terms) p *= Math.pow(t.curved, t.weight)
      return clamp01(p)
    }
    case 'dampedProduct':
    default: {
      // 补偿因子：考量越多，对单个低值的惩罚越被"扶"回一点，避免趋零塌缩
      const modFactor = 1 - 1 / terms.length
      let p = 1
      for (const t of terms) {
        const f = t.curved
        const makeup = (1 - f) * modFactor
        const adjusted = f + makeup * f // = f·(1 + (1-f)·modFactor) ∈ [0,1]
        p *= Math.pow(adjusted, t.weight)
      }
      return clamp01(p)
    }
  }
}

export function appraise<C>(ctx: C, cons: Consideration<C>[], mode: Aggregation = 'dampedProduct'): Appraisal {
  const terms = evalTerms(ctx, cons)
  const score = aggregate(terms, mode)
  terms.sort((a, b) => b.curved * b.weight - a.curved * a.weight)
  return { score, terms }
}

/** 把一条 Appraisal 压成给经历树/日志用的简短理由，如 "心魔(0.82)·魔倾(0.61)" */
export function explain(a: Appraisal, top = 2): string {
  return a.terms
    .slice(0, top)
    .map((t) => `${t.name}(${t.curved.toFixed(2)})`)
    .join('·')
}
