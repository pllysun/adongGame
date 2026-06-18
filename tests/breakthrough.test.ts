import { describe, expect, it } from 'vitest'
import { baseBreakRate, BREAKTHROUGH_MATRIX, cultNeed, realmPower, LIFESPAN } from '../src/engine/content/constants'

describe('突破矩阵（docs/02 §3）', () => {
  it('矩阵 7 资质 × 8 目标境界', () => {
    expect(BREAKTHROUGH_MATRIX).toHaveLength(7)
    for (const row of BREAKTHROUGH_MATRIX) expect(row).toHaveLength(8)
  })

  it('资质越高基础率单调不减（同目标境界）', () => {
    for (let col = 0; col < 8; col++) {
      for (let apt = 1; apt < 7; apt++) {
        expect(BREAKTHROUGH_MATRIX[apt][col]).toBeGreaterThanOrEqual(BREAKTHROUGH_MATRIX[apt - 1][col])
      }
    }
  })

  it('境界越高基础率单调不增（同资质）', () => {
    for (let apt = 0; apt < 7; apt++) {
      for (let col = 1; col < 8; col++) {
        expect(BREAKTHROUGH_MATRIX[apt][col]).toBeLessThanOrEqual(BREAKTHROUGH_MATRIX[apt][col - 1])
      }
    }
  })

  it('baseBreakRate 边界：炼气为 95%，超出列取末列', () => {
    expect(baseBreakRate(0, 1)).toBe(95)
    expect(baseBreakRate(6, 9)).toBeCloseTo(BREAKTHROUGH_MATRIX[6][7] / 100)
    expect(baseBreakRate(3, 2)).toBeCloseTo(BREAKTHROUGH_MATRIX[3][0] / 100)
  })

  it('凡品高境界保留地板值（不绝对封死，docs 设计意图）', () => {
    expect(baseBreakRate(0, 7)).toBeGreaterThan(0)
  })
})

describe('修为/寿元/战力曲线', () => {
  it('修为需求逐大境界递增', () => {
    for (let r = 2; r <= 9; r++) {
      expect(cultNeed(r, 0)).toBeGreaterThan(cultNeed(r - 1, 2))
    }
  })
  it('寿元覆盖 10 个境界且递增', () => {
    expect(LIFESPAN).toHaveLength(10)
    for (let i = 1; i < 10; i++) expect(LIFESPAN[i]).toBeGreaterThan(LIFESPAN[i - 1])
  })
  it('境界差是战力的压倒性因素（金丹 > 一群炼气）', () => {
    expect(realmPower(3, 0)).toBeGreaterThan(realmPower(1, 2) * 5)
  })
})
