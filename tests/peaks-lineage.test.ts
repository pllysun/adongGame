import { describe, expect, it } from 'vitest'
import { SimEngine } from '../src/engine'
import { peakStageMonthly, devLevel, masters, PEAK_TYPE_LABEL } from '../src/engine/systems/peaks'
import { bind, lineageMonthly, masterOf, disciplesOf, avgMolean } from '../src/engine/systems/lineage'
import { omensMonthly, clearOmen } from '../src/engine/systems/omens'
import { generateDisciple } from '../src/engine/state/disciple'
import { RNG } from '../src/engine/core/rng'

function bigSect(seed = 'peak', n = 24) {
  const e = new SimEngine(seed, { sectName: '巨宗', siteQuality: 4, siteDanger: 2 })
  const rng = RNG.fromSeed(seed + '-gen')
  for (let i = 0; i < n; i++) {
    const d = generateDisciple(rng, e.world, { realm: rng.int(1, 6) as never })
    e.world.disciples.push(d)
  }
  return { e, rng }
}

describe('峰系统', () => {
  it('devLevel 随顶级境界/人口/峰数增长', () => {
    const { e } = bigSect('dev')
    const before = devLevel(e.world)
    e.world.disciples[0].realm = 9
    expect(devLevel(e.world)).toBeGreaterThan(before)
  })
  it('阶段推进：草创→立宗→分峰，并涌现峰', () => {
    const { e, rng } = bigSect('stage', 30)
    // 拉高顶级境界，确保满足分峰条件
    e.world.disciples.slice(0, 4).forEach((d) => (d.realm = 6))
    for (let m = 0; m < 60; m++) peakStageMonthly(e.world, rng)
    expect(['sect', 'peaks']).toContain(e.world.sectStage)
    expect(masters(e.world).length).toBeGreaterThan(0)
    // 多跑出峰
    e.world.day += 360
    let founded = e.world.peaks.length
    for (let m = 0; m < 120 && founded === 0; m++) {
      peakStageMonthly(e.world, rng)
      founded = e.world.peaks.length
    }
    expect(e.world.peaks.length).toBeGreaterThan(0)
    // 弟子被分配进峰
    expect(e.world.disciples.some((d) => d.peakId)).toBe(true)
  })
  it('动态门槛：草创为 0，壮大后抬升', () => {
    const { e, rng } = bigSect('thr', 30)
    e.world.disciples.slice(0, 5).forEach((d) => (d.realm = 6))
    peakStageMonthly(e.world, rng)
    expect(e.world.innerThreshold.realm).toBeGreaterThanOrEqual(1)
  })
  it('PEAK_TYPE_LABEL 七类齐全', () => {
    expect(Object.keys(PEAK_TYPE_LABEL)).toHaveLength(7)
  })
})

describe('师徒传承', () => {
  it('bind 建立师承 + 记拜师经历；masterOf/disciplesOf', () => {
    const { e } = bigSect('bind')
    const [m, s] = e.world.disciples
    bind(e.world, m, s, 'zhuan')
    expect(s.masterId).toBe(m.id)
    expect(s.lineageTier).toBe('zhuan')
    expect(masterOf(e.world, s)!.id).toBe(m.id)
    expect(disciplesOf(e.world, m.id)).toContain(s)
    expect(s.memories.some((mm) => mm.tags.includes('拜师'))).toBe(true)
  })
  it('lineageMonthly：徒弟心相趋近师尊', () => {
    const { e, rng } = bigSect('prop')
    const [m, s] = e.world.disciples
    m.beliefs.molean = 80
    s.beliefs.molean = 0
    bind(e.world, m, s)
    for (let i = 0; i < 24; i++) lineageMonthly(e.world, rng)
    expect(s.beliefs.molean).toBeGreaterThan(0)
  })
  it('avgMolean', () => {
    const { e } = bigSect('avg')
    e.world.disciples.forEach((d) => (d.beliefs.molean = 50))
    expect(avgMolean(e.world.disciples)).toBeCloseTo(50)
    expect(avgMolean([])).toBe(0)
  })
})

describe('征兆与干预窗口', () => {
  it('高心魔者触发心魔征兆并调度抉择事件', () => {
    const { e } = bigSect('omen')
    const rng = RNG.fromSeed('omen-fire')
    const d = e.world.disciples[0]
    d.beliefs.xinmo = 95
    d.beliefs.daoxin = 10
    d.status = 'normal'
    let fired = false
    for (let m = 0; m < 24 && !fired; m++) {
      omensMonthly(e.world, rng)
      fired = e.world.scheduled.some((s) => s.eventId === 'inner_demon_choice')
    }
    expect(fired).toBe(true)
  })
  it('clearOmen 清旗 + 上冷却', () => {
    const { e } = bigSect('clr')
    const d = e.world.disciples[0]
    e.world.flags['omen:demon:' + d.id] = true
    clearOmen(e.world, 'demon', d.id)
    expect(e.world.flags['omen:demon:' + d.id]).toBeUndefined()
    expect(e.world.cooldowns['omendone:demon:' + d.id]).toBeGreaterThan(e.world.day)
  })
})
