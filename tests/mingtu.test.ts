import { describe, expect, it, beforeAll } from 'vitest'
import { SimEngine } from '../src/engine'
import { fireEvent, eventDef } from '../src/engine/systems/events'
import { registerAllEvents } from '../src/engine/content/events'
import { generateDisciple } from '../src/engine/state/disciple'
import { setRel } from '../src/engine/systems/helpers'
import { RNG } from '../src/engine/core/rng'
import type { Disciple, WorldState } from '@/shared/types'

beforeAll(() => registerAllEvents())

function world(seed = 'mt') {
  const e = new SimEngine(seed, { sectName: '命途宗', siteQuality: 3, siteDanger: 3 })
  return e.world
}
function add(w: WorldState, rng: RNG, patch: Partial<Disciple>): Disciple {
  const d = generateDisciple(rng, w, { realm: 3 })
  Object.assign(d, patch)
  w.disciples.push(d)
  return d
}

describe('命途个人抉择（角色 AI 自主，多次采样覆盖两端）', () => {
  it('心魔劫：道心坚定者多镇压，堕落者多放任', () => {
    let suppressed = 0
    let indulged = 0
    for (let i = 0; i < 30; i++) {
      const w = world('demon-' + i)
      const rng = RNG.fromSeed('r-' + i)
      const saint = add(w, rng, { mindstate: 9 })
      saint.beliefs = { daoxin: 95, xinmo: 60, molean: 0, loyalty: 60, fame: 10 }
      fireEvent(w, rng, eventDef('inner_demon_choice')!, { self: saint.id })
      if (saint.memories.some((m) => m.tags.includes('守心'))) suppressed++

      const w2 = world('demon2-' + i)
      const fallen = add(w2, rng, { mindstate: 3, gongfa: 'xueying' })
      fallen.beliefs = { daoxin: 8, xinmo: 90, molean: 75, loyalty: 30, fame: 5 }
      fireEvent(w2, rng, eventDef('inner_demon_choice')!, { self: fallen.id })
      if (fallen.memories.some((m) => m.tags.includes('堕魔'))) indulged++
    }
    expect(suppressed).toBeGreaterThan(15) // 道心高者主要镇压
    expect(indulged).toBeGreaterThan(8) // 堕落者相当比例放任
  })

  it('叛逃抉择：忠义者留、离心者走（两端都被覆盖）', () => {
    let stayed = 0
    let left = 0
    for (let i = 0; i < 30; i++) {
      const w = world('def-' + i)
      const rng = RNG.fromSeed('d-' + i)
      const loyal = add(w, rng, { mindstate: 8, traits: ['loyal'] })
      loyal.beliefs = { daoxin: 60, xinmo: 0, molean: 0, loyalty: 95, fame: 10 }
      fireEvent(w, rng, eventDef('defection_choice')!, { self: loyal.id })
      if (w.disciples.includes(loyal)) stayed++

      const w2 = world('def2-' + i)
      const rebel = add(w2, rng, { mindstate: 3, traits: ['ambitious'] })
      rebel.beliefs = { daoxin: 20, xinmo: 30, molean: 50, loyalty: 5, fame: 5 }
      fireEvent(w2, rng, eventDef('defection_choice')!, { self: rebel.id })
      if (!w2.disciples.includes(rebel)) left++
    }
    expect(stayed).toBeGreaterThan(15)
    expect(left).toBeGreaterThan(5)
  })

  it('魔道抉择：勒马 / 一条道走到黑', () => {
    let back = 0
    let deeper = 0
    for (let i = 0; i < 30; i++) {
      const w = world('dp-' + i)
      const rng = RNG.fromSeed('dp-' + i)
      const waver = add(w, rng, { traits: ['chivalrous'] })
      waver.beliefs = { daoxin: 80, xinmo: 10, molean: 50, loyalty: 50, fame: 10 }
      fireEvent(w, rng, eventDef('demon_path_choice')!, { self: waver.id })
      if (waver.memories.some((m) => m.tags.includes('迷途知返'))) back++

      const w2 = world('dp2-' + i)
      const sink = add(w2, rng, { traits: ['ruthless'] })
      sink.beliefs = { daoxin: 10, xinmo: 40, molean: 70, loyalty: 30, fame: 5 }
      fireEvent(w2, rng, eventDef('demon_path_choice')!, { self: sink.id })
      if (sink.memories.some((m) => m.tags.includes('入魔'))) deeper++
    }
    expect(back).toBeGreaterThan(8)
    expect(deeper).toBeGreaterThan(8)
  })

  it('弑师抉择：忍 / 欺师灭祖', () => {
    let endured = 0
    let killed = 0
    for (let i = 0; i < 30; i++) {
      const w = world('km-' + i)
      const rng = RNG.fromSeed('km-' + i)
      const master = add(w, rng, { realm: 3 })
      const evil = add(w, rng, { realm: 3, traits: ['ruthless'] })
      evil.beliefs = { daoxin: 8, xinmo: 70, molean: 80, loyalty: 5, fame: 5 }
      evil.masterId = master.id
      setRel(w, master.id, evil.id, 'master', -70)
      fireEvent(w, rng, eventDef('kill_master_choice')!, { self: evil.id })
      if (evil.memories.some((m) => m.tags.includes('弑师'))) killed++
      else if (evil.memories.some((m) => m.tags.includes('隐忍'))) endured++

      const w2 = world('km2-' + i)
      const m2 = add(w2, rng, { realm: 3 })
      const good = add(w2, rng, { mindstate: 9 })
      good.beliefs = { daoxin: 90, xinmo: 40, molean: 30, loyalty: 60, fame: 10 }
      good.masterId = m2.id
      setRel(w2, m2.id, good.id, 'master', -60)
      fireEvent(w2, rng, eventDef('kill_master_choice')!, { self: good.id })
      if (good.memories.some((m) => m.tags.includes('隐忍'))) endured++
    }
    expect(killed).toBeGreaterThan(3)
    expect(endured).toBeGreaterThan(3)
  })

  it('师恩 / 红尘悟道 auto 事件生效', () => {
    const w = world('teach')
    const rng = RNG.fromSeed('teach')
    const m = add(w, rng, { realm: 4 })
    const s = add(w, rng, { realm: 2 })
    s.cultivation = 100
    setRel(w, m.id, s.id, 'master', 50)
    fireEvent(w, rng, eventDef('master_teaching')!, { master: m.id })
    expect(s.cultivation).toBeGreaterThan(100)

    const w2 = world('enl')
    const sage = add(w2, RNG.fromSeed('e'), { comprehension: 9 })
    sage.beliefs.daoxin = 80
    sage.cultivation = 100
    fireEvent(w2, RNG.fromSeed('e2'), eventDef('enlightenment')!, { self: sage.id })
    expect(sage.cultivation).toBeGreaterThan(100)
  })
})
