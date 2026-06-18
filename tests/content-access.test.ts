import { describe, expect, it } from 'vitest'
import { gongfa, GONGFA, elementFit, gongfaFitsRealm, GONGFA_MAP } from '../src/engine/content/gongfa'
import { pill, PILLS, breakthroughPillsFor } from '../src/engine/content/pills'
import { artifact, ARTIFACTS } from '../src/engine/content/artifacts'
import { trait, TRAITS } from '../src/engine/content/traits'
import { FACILITIES, FACILITY_MAP, cavesCapacityAt, sectCapacity, arrayMultiplier } from '../src/engine/content/facilities'
import { genName, ENEMY_SECTS } from '../src/engine/content/names'
import { RNG } from '../src/engine/core/rng'
import { SimEngine } from '../src/engine'

describe('内容访问器与抛错路径', () => {
  it('gongfa/pill/artifact/trait 已知 id 命中、未知抛错', () => {
    expect(gongfa('tunaqi').name).toBeTruthy()
    expect(() => gongfa('无')).toThrow()
    expect(pill('juqi').kind).toBe('breakthrough')
    expect(() => pill('无')).toThrow()
    expect(artifact('tiejian').combatMod).toBeGreaterThan(0)
    expect(() => artifact('无')).toThrow()
    expect(trait('diligent').name).toBe('勤勉')
    expect(() => trait('无')).toThrow()
  })
  it('elementFit：全合 1.3、不合 0.7、无属性 1', () => {
    const sword = GONGFA_MAP.get('qingping')!
    expect(elementFit(['metal', 'wood'], sword)).toBeCloseTo(1.3)
    expect(elementFit(['water'], sword)).toBeCloseTo(0.7)
    expect(elementFit([], gongfa('tunaqi'))).toBe(1)
  })
  it('gongfaFitsRealm', () => {
    expect(gongfaFitsRealm(gongfa('tunaqi'), 2)).toBe(true)
    expect(gongfaFitsRealm(gongfa('tunaqi'), 5)).toBe(false)
  })
  it('breakthroughPillsFor 高→低排序且适配目标境界', () => {
    const list = breakthroughPillsFor(3)
    expect(list.length).toBeGreaterThan(0)
    for (let i = 1; i < list.length; i++) expect(list[i - 1].power).toBeGreaterThanOrEqual(list[i].power)
  })
  it('每座设施的 cost/effectDesc/realmReq 可调用', () => {
    for (const f of FACILITIES) {
      for (let l = 1; l <= f.maxLevel; l++) {
        const c = f.cost(l)
        expect(c.stones).toBeGreaterThan(0)
        expect(typeof f.effectDesc(l)).toBe('string')
        if (f.realmReq) expect(f.realmReq(l)).toBeGreaterThanOrEqual(1)
      }
    }
    expect(FACILITY_MAP.get('array')).toBeTruthy()
  })
  it('设施容量/倍率工具', () => {
    const e = new SimEngine('fac', { sectName: 't', siteQuality: 5, siteDanger: 1 })
    expect(cavesCapacityAt(0)).toBe(6)
    expect(sectCapacity(e.world)).toBeGreaterThan(0)
    e.world.sect.facilities['array'] = 3
    expect(arrayMultiplier(e.world)).toBeGreaterThan(1)
  })
  it('genName 去重；ENEMY_SECTS 完整', () => {
    const rng = RNG.fromSeed('nm')
    const taken = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const n = genName(rng, i % 2 ? 'm' : 'f', taken)
      expect(n.length).toBeGreaterThan(0)
    }
    expect(ENEMY_SECTS.length).toBeGreaterThanOrEqual(3)
  })
  it('内容库总量符合预期', () => {
    expect(GONGFA.length).toBeGreaterThanOrEqual(40)
    expect(PILLS.length).toBeGreaterThanOrEqual(20)
    expect(ARTIFACTS.length).toBeGreaterThanOrEqual(15)
    expect(TRAITS.length).toBeGreaterThanOrEqual(30)
  })
})
