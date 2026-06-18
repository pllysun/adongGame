import { describe, expect, it } from 'vitest'
import { SimEngine } from '../src/engine'
import {
  emptyBeliefs, deriveBeliefs, clampB, addBelief, setBeliefsToward, psycheMonthly,
  beliefTier, daoxinTier, xinmoTier, moleanTier, loyaltyTier, fameTier, BELIEF_NAMES, BELIEF_KEYS,
} from '../src/engine/systems/psyche'
import { generateDisciple } from '../src/engine/state/disciple'
import { RNG } from '../src/engine/core/rng'

function mk() {
  const e = new SimEngine('psyche', { sectName: '测试', siteQuality: 3, siteDanger: 3 })
  return e
}

describe('心相派生与写入', () => {
  it('emptyBeliefs 默认值', () => {
    const b = emptyBeliefs()
    expect(b.daoxin).toBe(40)
    expect(b.loyalty).toBe(50)
  })
  it('clampB 夹取 0~100', () => {
    expect(clampB(-5)).toBe(0)
    expect(clampB(150)).toBe(100)
    expect(clampB(50)).toBe(50)
  })
  it('deriveBeliefs 受心性/资质/特质影响', () => {
    const e = mk()
    const rng = RNG.fromSeed('d')
    for (let i = 0; i < 100; i++) {
      const d = generateDisciple(rng, e.world, {})
      const b = deriveBeliefs(d)
      for (const k of BELIEF_KEYS) {
        expect(b[k]).toBeGreaterThanOrEqual(0)
        expect(b[k]).toBeLessThanOrEqual(100)
      }
    }
  })
  it('特质影响初值：杀伐→魔倾+，忠义→忠诚+', () => {
    const e = mk()
    const d = e.world.disciples[0]
    d.traits = ['ruthless']
    expect(deriveBeliefs(d).molean).toBeGreaterThan(0)
    d.traits = ['loyal']
    expect(deriveBeliefs(d).loyalty).toBeGreaterThan(deriveBeliefs({ ...d, traits: [] } as never).loyalty)
  })
  it('addBelief：道心抑制心魔增长，心魔只升难降', () => {
    const e = mk()
    const d = e.world.disciples[0]
    d.beliefs.daoxin = 90
    d.beliefs.xinmo = 0
    addBelief(d, 'xinmo', 30)
    const highDao = d.beliefs.xinmo
    d.beliefs.daoxin = 10
    d.beliefs.xinmo = 0
    addBelief(d, 'xinmo', 30)
    expect(d.beliefs.xinmo).toBeGreaterThan(highDao) // 道心低时心魔涨得更多
    // 负向打折
    d.beliefs.xinmo = 50
    addBelief(d, 'xinmo', -20)
    expect(d.beliefs.xinmo).toBeGreaterThan(30) // 没有跌满 20
  })
  it('setBeliefsToward 按强度趋近', () => {
    const e = mk()
    const d = e.world.disciples[0]
    d.beliefs.loyalty = 0
    setBeliefsToward(d, 'loyalty', 100, 0.5)
    expect(d.beliefs.loyalty).toBeCloseTo(50)
  })
  it('psycheMonthly：修魔功者魔倾涨，否则回落；心魔缓退', () => {
    const e = mk()
    const d = e.world.disciples[0]
    d.gongfa = 'xueying' // 魔功
    d.beliefs.molean = 30
    psycheMonthly(e.world)
    expect(d.beliefs.molean).toBeGreaterThan(30)
    d.gongfa = 'tunaqi'
    d.beliefs.molean = 30
    d.beliefs.xinmo = 30
    psycheMonthly(e.world)
    expect(d.beliefs.molean).toBeLessThan(30)
    expect(d.beliefs.xinmo).toBeLessThan(30)
  })
})

describe('心相模糊档位', () => {
  it('各轴档位单调覆盖', () => {
    expect(daoxinTier(80)).toBe('道心通明')
    expect(daoxinTier(5)).toBe('道心蒙尘')
    expect(xinmoTier(80)).toBe('心魔缠身')
    expect(xinmoTier(0)).toBe('心境澄澈')
    expect(moleanTier(65)).toBe('魔气森然')
    expect(moleanTier(0)).toBe('心术端正')
    expect(loyaltyTier(80)).toBe('忠心耿耿')
    expect(loyaltyTier(10)).toBe('离心离德')
    expect(fameTier(80)).toBe('名动一方')
    expect(fameTier(0)).toBe('默默无闻')
  })
  it('beliefTier 分派到对应轴 + 名称表完整', () => {
    for (const k of BELIEF_KEYS) {
      expect(typeof beliefTier(k, 50)).toBe('string')
      expect(BELIEF_NAMES[k]).toBeTruthy()
    }
  })
})
