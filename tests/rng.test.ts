import { describe, expect, it } from 'vitest'
import { RNG } from '../src/engine/core/rng'

describe('种子化 RNG', () => {
  it('同种子产生完全相同的序列', () => {
    const a = RNG.fromSeed('hello')
    const b = RNG.fromSeed('hello')
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })

  it('不同种子序列不同', () => {
    const a = RNG.fromSeed('hello')
    const b = RNG.fromSeed('world')
    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })

  it('状态可序列化恢复', () => {
    const a = RNG.fromSeed('save')
    for (let i = 0; i < 50; i++) a.next()
    const state = a.getState()
    const b = new RNG(state)
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next())
  })

  it('int 在闭区间内且分布大致均匀', () => {
    const rng = RNG.fromSeed('int')
    const counts = new Array(6).fill(0)
    for (let i = 0; i < 6000; i++) {
      const v = rng.int(0, 5)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(5)
      counts[v]++
    }
    for (const c of counts) expect(c).toBeGreaterThan(800) // 期望 1000 ± 容差
  })

  it('weighted 按权重抽取', () => {
    const rng = RNG.fromSeed('w')
    let heavy = 0
    for (let i = 0; i < 2000; i++) {
      const picked = rng.weighted([{ w: 9 }, { w: 1 }], (x) => x.w)!
      if (picked.w === 9) heavy++
    }
    expect(heavy / 2000).toBeGreaterThan(0.85)
    expect(heavy / 2000).toBeLessThan(0.95)
  })

  it('chance(0)=false chance(1)=true', () => {
    const rng = RNG.fromSeed('c')
    expect(rng.chance(0)).toBe(false)
    expect(rng.chance(1)).toBe(true)
  })
})
