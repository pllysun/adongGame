import { describe, expect, it } from 'vitest'
import {
  band, constant, inverse, linear, logistic, pipe, power, step, clamp01,
  aggregate, appraise, explain, type Consideration,
  decide, temperatureFromMindstate,
} from '../src/engine/ai'
import { RNG } from '../src/engine/core/rng'

describe('响应曲线', () => {
  it('clamp01 夹取', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.3)).toBe(0.3)
  })
  it('band 把区间线性归一并可反向', () => {
    const c = band(0, 100)
    expect(c(0)).toBe(0)
    expect(c(50)).toBe(0.5)
    expect(c(100)).toBe(1)
    expect(c(150)).toBe(1) // 夹顶
    expect(band(0, 100, true)(25)).toBeCloseTo(0.75)
  })
  it('power 凸/凹', () => {
    expect(power(2)(0.5)).toBeCloseTo(0.25) // 凸：高位才显著
    expect(power(0.5)(0.25)).toBeCloseTo(0.5) // 凹：低位即敏感
  })
  it('logistic 单调递增过拐点', () => {
    const c = logistic(8, 0.5)
    expect(c(0.5)).toBeCloseTo(0.5)
    expect(c(0.2)).toBeLessThan(0.2)
    expect(c(0.8)).toBeGreaterThan(0.8)
  })
  it('step 门控', () => {
    const c = step(3, 1, 0)
    expect(c(2)).toBe(0)
    expect(c(3)).toBe(1)
  })
  it('inverse 翻转、pipe 复合', () => {
    expect(inverse(linear(1, 0))(0.3)).toBeCloseTo(0.7)
    const c = pipe(band(0, 100), power(2))
    expect(c(50)).toBeCloseTo(0.25)
  })
  it('constant 恒值', () => {
    expect(constant(0.4)(999)).toBe(0.4)
  })
})

interface Ctx {
  xinmo: number
  daoxin: number
}
const consXinmo: Consideration<Ctx> = { name: '心魔', input: (c) => c.xinmo, curve: band(0, 100), weight: 1 }
const consDaoxin: Consideration<Ctx> = { name: '道心', input: (c) => c.daoxin, curve: band(0, 100, true), weight: 1 }

describe('效用聚合', () => {
  it('结果恒在 [0,1]', () => {
    for (const mode of ['dampedProduct', 'product', 'avg', 'min'] as const) {
      const a = appraise({ xinmo: 70, daoxin: 30 }, [consXinmo, consDaoxin], mode)
      expect(a.score).toBeGreaterThanOrEqual(0)
      expect(a.score).toBeLessThanOrEqual(1)
    }
  })
  it('product 硬否决：任一考量为 0 则总分 0', () => {
    expect(aggregate([{ name: 'a', raw: 0, curved: 0, weight: 1 }, { name: 'b', raw: 1, curved: 1, weight: 1 }], 'product')).toBe(0)
  })
  it('dampedProduct 比 product 更宽容（补偿不塌缩）', () => {
    const terms = [
      { name: 'a', raw: 0, curved: 0.2, weight: 1 },
      { name: 'b', raw: 0, curved: 0.2, weight: 1 },
      { name: 'c', raw: 0, curved: 0.2, weight: 1 },
    ]
    expect(aggregate(terms, 'dampedProduct')).toBeGreaterThan(aggregate(terms, 'product'))
  })
  it('avg 为加权平均、可相互弥补', () => {
    expect(aggregate([{ name: 'a', raw: 0, curved: 0.2, weight: 1 }, { name: 'b', raw: 0, curved: 0.8, weight: 1 }], 'avg')).toBeCloseTo(0.5)
  })
  it('terms 明细按贡献降序、explain 可读', () => {
    const a = appraise({ xinmo: 80, daoxin: 20 }, [consXinmo, consDaoxin])
    expect(a.terms[0].name).toBe('心魔') // 心魔80→0.8 道心20→反向0.8，权重相同时心魔在前因 input 顺序稳定？用贡献
    expect(explain(a)).toMatch(/心魔|道心/)
  })
})

describe('选择策略（确定性 + 温度行为）', () => {
  type Opt = { id: string; appeal: number }
  function run(temp: number, selection: 'softmax' | 'argmax' | 'weighted', samples: number) {
    const counts: Record<string, number> = { hi: 0, lo: 0 }
    for (let i = 0; i < samples; i++) {
      const rng = RNG.fromSeed('sel-' + i)
      const { chosen } = decide<{ v: number }, Opt>({
        candidates: [{ id: 'hi', appeal: 0.8 }, { id: 'lo', appeal: 0.2 }],
        context: (o) => ({ v: o.appeal }),
        considerations: () => [{ name: 'appeal', input: (c) => c.v, curve: linear(1, 0) }],
        selection,
        temperature: temp,
        rng,
      })
      counts[chosen!.id]++
    }
    return counts
  }

  it('确定性：同种子同上下文必同选择', () => {
    const mk = () => {
      const rng = RNG.fromSeed('det')
      return decide<{ v: number }, Opt>({
        candidates: [{ id: 'hi', appeal: 0.8 }, { id: 'lo', appeal: 0.2 }],
        context: (o) => ({ v: o.appeal }),
        considerations: () => [{ name: 'a', input: (c) => c.v, curve: linear(1, 0) }],
        rng,
      }).chosen!.id
    }
    expect(mk()).toBe(mk())
  })

  it('低温接近理性（高分项压倒）', () => {
    const c = run(0.05, 'softmax', 600)
    expect(c.hi / 600).toBeGreaterThan(0.9)
  })
  it('高温更随性（差距收窄但仍偏高分）', () => {
    const c = run(1.0, 'softmax', 600)
    expect(c.hi / 600).toBeGreaterThan(0.55)
    expect(c.hi / 600).toBeLessThan(0.8)
  })
  it('argmax 永远选最高', () => {
    const c = run(0.05, 'argmax', 50)
    expect(c.hi).toBe(50)
  })
  it('温度由心性映射：心性高→温度低（更理性）', () => {
    expect(temperatureFromMindstate(10)).toBeLessThan(temperatureFromMindstate(2))
  })

  it('候选为空时安全返回 null', () => {
    const r = decide<{ v: number }, Opt>({
      candidates: [], context: () => ({ v: 0 }), considerations: () => [], rng: RNG.fromSeed('x'),
    })
    expect(r.chosen).toBeNull()
  })
})

// ── 跨域复用演示：同一内核，两个完全不同的决策域 ──
describe('跨域复用：一套内核服务命途与事件', () => {
  it('域一·角色抉择：高心魔低道心者倾向修魔功', () => {
    // 一个堕落者 vs 一个道心坚定者，面对"修魔功 / 焚毁"同一抉择
    type DCtx = { xinmo: number; daoxin: number; molean: number }
    const considerationsFor = (option: string): Consideration<DCtx>[] =>
      option === '修魔功'
        ? [
            { name: '心魔', input: (c) => c.xinmo, curve: pipe(band(0, 100), power(1.5)), weight: 1.5 },
            { name: '魔倾', input: (c) => c.molean, curve: band(0, 100), weight: 1.2 },
            { name: '道心阻力', input: (c) => c.daoxin, curve: band(0, 100, true), weight: 1 },
          ]
        : [
            { name: '道心', input: (c) => c.daoxin, curve: band(0, 100), weight: 1.5 },
            { name: '心魔诱惑', input: (c) => c.xinmo, curve: band(0, 100, true), weight: 1 },
          ]
    const pick = (ctx: DCtx) =>
      decide<DCtx, string>({
        candidates: ['修魔功', '焚毁'],
        context: () => ctx,
        considerations: considerationsFor,
        selection: 'argmax',
        rng: RNG.fromSeed('domain1'),
      })
    const fallen = pick({ xinmo: 85, daoxin: 20, molean: 60 })
    const steadfast = pick({ xinmo: 20, daoxin: 85, molean: 5 })
    expect(fallen.chosen).toBe('修魔功')
    expect(steadfast.chosen).toBe('焚毁')
    // 解释明细可回溯（喂经历树）
    const why = fallen.ranked.find((r) => r.option === '修魔功')!.appraisal
    expect(why.terms.length).toBe(3)
  })

  it('域二·事件加权：同一内核给世界事件打分，紧张局势抬高危机权重', () => {
    type World = { beastThreat: number; reputation: number }
    type Ev = { id: string; kind: 'crisis' | 'boon' }
    const candidates: Ev[] = [{ id: '妖兽潮', kind: 'crisis' }, { id: '坊市拍卖', kind: 'boon' }]
    const scoreFor = (e: Ev): Consideration<World>[] =>
      e.kind === 'crisis'
        ? [{ name: '兽患', input: (c) => c.beastThreat, curve: band(0, 100), weight: 1 }]
        : [{ name: '太平', input: (c) => c.beastThreat, curve: band(0, 100, true), weight: 1 }]
    const choose = (w: World) =>
      decide<World, Ev>({
        candidates, context: () => w, considerations: scoreFor,
        selection: 'argmax', rng: RNG.fromSeed('domain2'),
      }).chosen!.id
    expect(choose({ beastThreat: 90, reputation: 100 })).toBe('妖兽潮')
    expect(choose({ beastThreat: 5, reputation: 100 })).toBe('坊市拍卖')
  })
})
