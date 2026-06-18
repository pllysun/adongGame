import { describe, expect, it } from 'vitest'
import { SimEngine } from '../src/engine'
import { generateDisciple, rollAptitude } from '../src/engine/state/disciple'
import { RNG } from '../src/engine/core/rng'
import { breakChance } from '../src/engine/systems/breakthrough'

function makeEngine(seed = 'd-test'): SimEngine {
  return new SimEngine(seed, { sectName: '测试宗', siteQuality: 3, siteDanger: 3 })
}

describe('弟子生成（docs/01）', () => {
  it('字段在合法范围', () => {
    const e = makeEngine()
    const rng = RNG.fromSeed('gen')
    for (let i = 0; i < 200; i++) {
      const d = generateDisciple(rng, e.world, {})
      expect(d.aptitude).toBeGreaterThanOrEqual(0)
      expect(d.aptitude).toBeLessThanOrEqual(6)
      expect(d.shownAptitude).toBeLessThanOrEqual(d.aptitude) // 表显 ≤ 真实（大器晚成藏拙）
      expect(d.roots.elements.length).toBeGreaterThanOrEqual(1)
      expect(d.roots.elements.length).toBeLessThanOrEqual(5)
      expect(d.roots.purity).toBeGreaterThanOrEqual(1)
      expect(d.roots.purity).toBeLessThanOrEqual(10)
      expect(d.comprehension).toBeGreaterThanOrEqual(1)
      expect(d.comprehension).toBeLessThanOrEqual(10)
      expect(d.traits.length).toBeGreaterThanOrEqual(2)
      expect(d.traits.length).toBeLessThanOrEqual(4)
    }
  })

  it('互斥特质不共存', () => {
    const e = makeEngine('mutex')
    const rng = RNG.fromSeed('mutex')
    const pairs: [string, string][] = [['diligent', 'lazy'], ['devoted', 'cold'], ['loyal', 'ambitious']]
    for (let i = 0; i < 300; i++) {
      const d = generateDisciple(rng, e.world, {})
      for (const [a, b] of pairs) {
        expect(d.traits.includes(a) && d.traits.includes(b)).toBe(false)
      }
    }
  })

  it('姓名不重复', () => {
    const e = makeEngine('names')
    const rng = RNG.fromSeed('names')
    const names = new Set(e.world.disciples.map((d) => d.name))
    for (let i = 0; i < 150; i++) {
      const d = generateDisciple(rng, e.world, {})
      e.world.disciples.push(d) // 入册后名字进占用池
      expect(names.has(d.name)).toBe(false)
      names.add(d.name)
    }
  })

  it('资质分布大致符合权重（凡品约半数，天品以上稀有）', () => {
    const rng = RNG.fromSeed('apt-dist')
    const counts = new Array(7).fill(0)
    const N = 20000
    for (let i = 0; i < N; i++) counts[rollAptitude(rng, 0)]++
    expect(counts[0] / N).toBeGreaterThan(0.42)
    expect(counts[0] / N).toBeLessThan(0.58)
    expect((counts[4] + counts[5] + counts[6]) / N).toBeLessThan(0.04)
  })

  it('声望提升中段资质出率但不动天品以上（docs/01 §2）', () => {
    const rngLow = RNG.fromSeed('rep-low')
    const rngHigh = RNG.fromSeed('rep-high')
    const N = 20000
    const low = new Array(7).fill(0)
    const high = new Array(7).fill(0)
    for (let i = 0; i < N; i++) low[rollAptitude(rngLow, 0)]++
    for (let i = 0; i < N; i++) high[rollAptitude(rngHigh, 2000)]++
    expect(high[0] / N).toBeLessThan(low[0] / N) // 凡品减少
    expect(high[2] / N).toBeGreaterThan(low[2] / N) // 玄品增多
    // 天品+总量变化很小
    const topLow = (low[4] + low[5] + low[6]) / N
    const topHigh = (high[4] + high[5] + high[6]) / N
    expect(Math.abs(topHigh - topLow)).toBeLessThan(0.01)
  })
})

describe('突破概率计算', () => {
  it('丹药/心境提高成功率', () => {
    const e = makeEngine('chance')
    const d = e.world.disciples.find((x) => x.rank === 'master')!
    const base = breakChance(e.world, d).rate
    d.buffs.breakthroughPill = 0.25
    const withPill = breakChance(e.world, d).rate
    expect(withPill).toBeGreaterThan(base)
    d.mood = 80
    const withMood = breakChance(e.world, d).rate
    expect(withMood).toBeGreaterThan(withPill)
  })

  it('成功率被夹在 [1%, 95%]', () => {
    const e = makeEngine('clamp')
    for (const d of e.world.disciples) {
      const { rate } = breakChance(e.world, d)
      expect(rate).toBeGreaterThanOrEqual(0.01)
      expect(rate).toBeLessThanOrEqual(0.95)
    }
  })
})
