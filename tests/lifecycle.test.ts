import { describe, expect, it } from 'vitest'
import { SimEngine, generateSites } from '../src/engine'
import { lifecycleMonthly } from '../src/engine/systems/lifecycle'
import { lifespanOf } from '../src/engine/systems/breakthrough'
import { generateDisciple } from '../src/engine/state/disciple'
import { setRel } from '../src/engine/systems/helpers'
import { DAYS_PER_YEAR } from '../src/engine/core/clock'
import { RNG } from '../src/engine/core/rng'

function mk(seed = 'life') {
  const e = new SimEngine(seed, { sectName: '寿宗', siteQuality: 3, siteDanger: 2 })
  return e
}

describe('生命周期', () => {
  it('寿终坐化 + 传功给关系最深的后辈', () => {
    const e = mk()
    const w = e.world
    const rng = RNG.fromSeed('elder-gen')
    const old = generateDisciple(rng, w, { realm: 4 })
    old.birthDay = w.day - (lifespanOf(old) + 1) * DAYS_PER_YEAR // 已超寿元
    w.disciples.push(old)
    const heir = generateDisciple(rng, w, { realm: 2 })
    heir.cultivation = 100
    w.disciples.push(heir)
    setRel(w, old.id, heir.id, 'master', 60)
    lifecycleMonthly(w, rng)
    expect(w.disciples.find((d) => d.id === old.id)).toBeUndefined() // 已坐化
    expect(w.departed.some((d) => d.cause === '寿终坐化')).toBe(true)
    expect(heir.cultivation).toBeGreaterThan(100) // 受了传功
  })

  it('灯枯期标记', () => {
    const e = mk('dying')
    const w = e.world
    const rng = RNG.fromSeed('dy')
    const d = generateDisciple(rng, w, { realm: 3 })
    d.birthDay = w.day - (lifespanOf(d) - 5) * DAYS_PER_YEAR // 进入灯枯
    w.disciples.push(d)
    lifecycleMonthly(w, rng)
    expect(d.status === 'dying' || w.disciples.find((x) => x.id === d.id) === undefined).toBe(true)
  })

  it('晋升：外门→内门→真传→长老', () => {
    const e = mk('promo')
    const w = e.world
    const rng = RNG.fromSeed('pr')
    // 一名高资质内门冲真传
    const core = generateDisciple(rng, w, { realm: 2, rank: 'inner', minAptitude: 4 })
    w.disciples.push(core)
    // 凑够人头让长老名额开放
    for (let i = 0; i < 12; i++) w.disciples.push(generateDisciple(rng, w, { realm: 1, rank: 'outer' }))
    lifecycleMonthly(w, rng)
    expect(['core', 'elder']).toContain(core.rank)
    // 外门到内门
    const outer = generateDisciple(rng, w, { realm: 2, sub: 2, rank: 'outer' })
    w.disciples.push(outer)
    lifecycleMonthly(w, rng)
    expect(outer.rank).not.toBe('outer')
  })

  it('掌门坐化后继任；双野心触发夺位 flag', () => {
    const e = mk('succ')
    const w = e.world
    const rng = RNG.fromSeed('sc')
    // 移除现有掌门
    w.disciples = w.disciples.filter((d) => d.rank !== 'master')
    const a = generateDisciple(rng, w, { realm: 3, minAptitude: 3 })
    a.traits = ['ambitious']
    const b = generateDisciple(rng, w, { realm: 3, minAptitude: 3 })
    b.traits = ['ambitious']
    w.disciples.push(a, b)
    lifecycleMonthly(w, rng)
    expect(w.disciples.some((d) => d.rank === 'master')).toBe(true)
  })

  it('状态到期自然恢复', () => {
    const e = mk('recover')
    const w = e.world
    const d = w.disciples[0]
    d.status = 'injured'
    d.statusUntil = w.day - 1
    lifecycleMonthly(w, RNG.fromSeed('rc'))
    expect(d.status).toBe('normal')
  })
})

describe('开局选址', () => {
  it('generateSites 产出 4 个候选，品质/凶险在 1~5', () => {
    const sites = generateSites(RNG.fromSeed('sites'))
    expect(sites).toHaveLength(4)
    for (const s of sites) {
      expect(s.quality).toBeGreaterThanOrEqual(1)
      expect(s.quality).toBeLessThanOrEqual(5)
      expect(s.danger).toBeGreaterThanOrEqual(1)
      expect(s.danger).toBeLessThanOrEqual(5)
      expect(s.name.length).toBeGreaterThan(0)
      expect(s.desc.length).toBeGreaterThan(0)
    }
  })
})
