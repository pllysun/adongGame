import { describe, expect, it } from 'vitest'
import { Bus } from '../src/engine/core/bus'
import { toDate, formatDate, yearsBetween, ageYears, isXunStart, isMonthStart, isYearStart, DAYS_PER_YEAR } from '../src/engine/core/clock'
import { RNG } from '../src/engine/core/rng'
import { rarityName, realmLabel, rarityColor, RARITY_NAMES } from '../src/shared/rarity'

describe('事件总线', () => {
  it('on/emit 传递并可退订', () => {
    const bus = new Bus()
    let got = 0
    const off = bus.on('dirty', () => got++)
    bus.emit('dirty')
    bus.emit('dirty')
    expect(got).toBe(2)
    off()
    bus.emit('dirty')
    expect(got).toBe(2)
  })
  it('emit 无监听者不抛错', () => {
    expect(() => new Bus().emit('log', {})).not.toThrow()
  })
})

describe('历法', () => {
  it('toDate 正确换算年月旬', () => {
    expect(toDate(0)).toEqual({ year: 1, month: 1, day: 1, xun: 0 })
    const d = toDate(DAYS_PER_YEAR + 35)
    expect(d.year).toBe(2)
    expect(d.month).toBe(2)
    expect(d.xun).toBe(0)
  })
  it('formatDate 含纪元与旬', () => {
    expect(formatDate(0)).toContain('天玄历1年')
    expect(formatDate(20)).toContain('下旬')
  })
  it('yearsBetween / ageYears', () => {
    expect(yearsBetween(0, DAYS_PER_YEAR * 3)).toBe(3)
    expect(ageYears(0, DAYS_PER_YEAR * 5 + 100)).toBe(5)
  })
  it('周期判定', () => {
    expect(isXunStart(10)).toBe(true)
    expect(isXunStart(11)).toBe(false)
    expect(isMonthStart(30)).toBe(true)
    expect(isYearStart(360)).toBe(true)
    expect(isYearStart(361)).toBe(false)
  })
})

describe('RNG 其余接口', () => {
  it('normalInt 在区间内', () => {
    const rng = RNG.fromSeed('n')
    for (let i = 0; i < 200; i++) {
      const v = rng.normalInt(2, 8)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThanOrEqual(8)
    }
  })
  it('shuffle 不丢元素、fork 确定', () => {
    const rng = RNG.fromSeed('s')
    const arr = [1, 2, 3, 4, 5]
    const sh = rng.shuffle([...arr])
    expect([...sh].sort()).toEqual(arr)
    const a = RNG.fromSeed('z').fork('x').next()
    const b = RNG.fromSeed('z').fork('x').next()
    expect(a).toBe(b)
  })
  it('weighted 全零权重返回 null', () => {
    expect(RNG.fromSeed('w').weighted([{ w: 0 }], (x) => x.w)).toBeNull()
  })
})

describe('稀有度命名', () => {
  it('四域名称表', () => {
    expect(rarityName('aptitude', 6)).toBe('仙品')
    expect(rarityName('gongfa', 0)).toBe('凡阶')
    expect(rarityColor(4)).toBeTruthy()
    expect(RARITY_NAMES.pill[3]).toBe('宝丹')
  })
  it('realmLabel 含大小境界', () => {
    expect(realmLabel(0)).toBe('凡人')
    expect(realmLabel(3, 1)).toBe('金丹中期')
    expect(realmLabel(3)).toBe('金丹')
  })
})
