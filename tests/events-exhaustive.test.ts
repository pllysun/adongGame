import { describe, expect, it, beforeAll } from 'vitest'
import { SimEngine } from '../src/engine'
import { allEvents, fireEvent, resolveEventChoice, type EventDef } from '../src/engine/systems/events'
import { registerAllEvents } from '../src/engine/content/events'
import { generateDisciple } from '../src/engine/state/disciple'
import { setRel } from '../src/engine/systems/helpers'
import { RNG } from '../src/engine/core/rng'
import type { WorldState } from '@/shared/types'

beforeAll(() => registerAllEvents())

/** 构造一个"应有尽有"的宗门，让尽可能多事件的选角与条件都能命中。 */
function richWorld(seed: string): { e: SimEngine; rng: RNG } {
  const e = new SimEngine(seed, { sectName: '富宗', siteQuality: 4, siteDanger: 4 })
  const rng = RNG.fromSeed(seed + '-rich')
  const w = e.world
  // 充足资源
  w.sect.stones = 50000
  w.sect.materials = 20000
  w.sect.herbs = 5000
  w.sect.rice = 5000
  w.sect.reputation = 800
  w.sect.qiyun = 60
  w.sect.gongfa = ['tunaqi', 'qingping', 'xueying', 'jiuyou', 'qingmu', 'haotian', 'jinrui']
  w.sect.pills = { jingxin: 5, mingxin: 5, qingxin: 5, juqi: 5, zhuji: 5, xisui: 3, peiyuan: 5, jinchuang: 5 }
  w.sect.artifacts = ['qingfengjian', 'hushen', 'liuyun']
  w.sect.facilities = { array: 4, caves: 5, field: 4, library: 5, alchemy: 4, arena: 3, wall: 3, quiet: 3, law: 3, forge: 3 }
  // 设战略 flag，让相关事件可触发
  Object.assign(w.flags, {
    mineHeld: true, beastPact: true, gardenPlanted: true, expeditionOut: true, expeditionStake: 3,
    stealPending: '', successionDispute: true, kidnapVictim: '', ascensionStarted: false, demonLean: 55,
    'ally:danxia': 80, 'ally:taiyi': 60, hiredElders: 1,
  })
  Object.assign(w.enemies, { xuanming: 60, wanshou: 50, liehuo: 45 })
  w.beastThreat = 70

  // 一批刻意多样的弟子
  const make = (opts: Partial<ReturnType<typeof generateDisciple>> & Record<string, unknown>) => {
    const d = generateDisciple(rng, w, { realm: (opts.realm as number) ?? 3, sub: 1 })
    Object.assign(d, opts)
    w.disciples.push(d)
    return d
  }
  const elder = make({ realm: 5, rank: 'elder', gongfa: 'haotian', comprehension: 10, traits: ['ambitious'] })
  const elder2 = make({ realm: 4, rank: 'elder', traits: ['battlemad'], action: 'train' })
  const master = w.disciples.find((d) => d.rank === 'master') ?? make({ realm: 4, rank: 'master' })
  const swordsman = make({ realm: 4, gongfa: 'qingping', action: 'train', traits: ['swordfanatic'] })
  const alch = make({ realm: 3, traits: ['alchemist'], action: 'work', comprehension: 8 })
  const healer = make({ realm: 3, traits: ['healer'], action: 'work' })
  const demon = make({ realm: 3, gongfa: 'xueying', traits: ['ruthless'] })
  demon.beliefs.molean = 70
  demon.beliefs.xinmo = 60
  demon.beliefs.daoxin = 15
  const grief = make({ realm: 2, traits: ['devoted'] })
  grief.beliefs.xinmo = 80
  const traitor = make({ realm: 3, traits: ['greedy'] })
  traitor.beliefs.loyalty = 10
  traitor.beliefs.molean = 40
  const arrogant1 = make({ realm: 2, traits: ['arrogant', 'grudging'], action: 'train' })
  const arrogant2 = make({ realm: 2, traits: ['sinister'], action: 'train' })
  const lover1 = make({ realm: 2, gender: 'm' })
  const lover2 = make({ realm: 2, gender: 'f' })
  const young = make({ realm: 1, rank: 'outer', shownAptitude: 4 })
  // 心魔缠身者（覆盖 demon_intervention）与大境界瓶颈者（覆盖 death_seclusion）
  const possessed = make({ realm: 3, status: 'demonic' })
  possessed.beliefs.xinmo = 85
  const bottlenecked = make({ realm: 4, sub: 2, bottleneck: true, status: 'normal' })
  void possessed
  void bottlenecked
  const traveler = make({ realm: 3, action: 'travel' })
  const worker = make({ realm: 1, action: 'work' })
  const social = make({ realm: 2, action: 'social', traits: ['sociable'] })
  for (let i = 0; i < 8; i++) make({ realm: rng.int(1, 6) as number })

  // 关系：师徒、道侣倾慕、仇怨
  setRel(w, master.id, young.id, 'master', 40)
  setRel(w, elder.id, swordsman.id, 'master', 40)
  const crush = setRel(w, lover1.id, lover2.id, 'crush', 60)
  crush.dir = 'ab'
  setRel(w, arrogant1.id, arrogant2.id, 'rival', -70)
  setRel(w, demon.id, master.id, 'master', -60) // 弑师候选
  demon.masterId = master.id
  setRel(w, alch.id, healer.id, 'friend', 60)
  void elder2
  void traveler
  void worker
  void social
  return { e, rng }
}

describe('事件遍历：每个事件都能被触发与各选项被解析（不崩溃）', () => {
  it('逐事件 fire + 逐选项 resolve，全程无异常', () => {
    const defs = allEvents()
    let fired = 0
    let resolved = 0
    for (const def of defs) {
      const optCount = def.options?.length ?? 1
      for (let opt = 0; opt < optCount; opt++) {
        const { e, rng } = richWorld('ev-' + def.id + '-' + opt)
        const w = e.world
        // 先把 weight/trigger 跑一遍（覆盖这些闭包）
        if (typeof def.weight === 'function') expect(typeof def.weight(w)).toBe('number')
        if (def.trigger) def.trigger(w)
        expect(() => {
          const ok = fireEvent(w, rng, def)
          if (ok) fired++
          // 交互事件：可能在拦截队列或收件箱，解析该选项
          const item = [...w.queue, ...w.inbox].find((q) => q.kind === 'event' && q.eventId === def.id)
          if (item && item.cast) {
            resolveEventChoice(w, rng, def.id, item.cast, opt)
            resolved++
          }
        }, `event ${def.id} opt ${opt}`).not.toThrow()
      }
    }
    expect(fired).toBeGreaterThan(defs.length * 0.7) // 绝大多数事件成功触发
    expect(resolved).toBeGreaterThan(20)
  })

  it('事件文本/选项文本渲染不抛错', () => {
    for (const def of allEvents()) {
      const { e, rng } = richWorld('txt-' + def.id)
      // 通过 fire 间接渲染（fireEvent 内部会调用 text）
      expect(() => fireEvent(e.world, rng, def)).not.toThrow()
    }
  })

  // 贫困世界：资源清零、flag 关闭，触发各事件 enabled() 的"不足/禁止"分支与 effects 的资源不足岔路
  it('资源匮乏世界下逐事件逐选项无异常（覆盖 disabled/不足分支）', () => {
    for (const def of allEvents()) {
      const optCount = def.options?.length ?? 1
      for (let opt = 0; opt < optCount; opt++) {
        const { e, rng } = richWorld('poor-' + def.id + '-' + opt)
        const w = e.world
        w.sect.stones = 0
        w.sect.materials = 0
        w.sect.herbs = 0
        w.sect.rice = 0
        w.sect.qiyun = 0
        w.sect.pills = {}
        w.sect.artifacts = []
        for (const k of Object.keys(w.flags)) if (typeof w.flags[k] === 'boolean') w.flags[k] = false
        if (typeof def.weight === 'function') def.weight(w)
        expect(() => {
          fireEvent(w, rng, def)
          const item = [...w.queue, ...w.inbox].find((q) => q.kind === 'event' && q.eventId === def.id)
          if (item && item.cast) resolveEventChoice(w, rng, def.id, item.cast, opt)
        }, `poor ${def.id} opt ${opt}`).not.toThrow()
      }
    }
  })
})

/** 链事件由上面的"逐事件 fire"已直接触发覆盖；此处补一条：链事件经 auto 路径再跑一遍以覆盖 auto 分支 */
describe('调度链事件覆盖', () => {
  it('链事件 auto 分支不崩溃', () => {
    const chains = allEvents().filter((d: EventDef) => d.category === 'chain' && !d.options && d.auto)
    let ran = 0
    for (const def of chains) {
      const { e, rng } = richWorld('chain-' + def.id)
      const w: WorldState = e.world
      w.flags['kidnapVictim'] = w.disciples[0].id
      expect(() => {
        if (fireEvent(w, rng, def)) ran++
      }, `chain ${def.id}`).not.toThrow()
    }
    expect(ran).toBeGreaterThan(0)
  })
})
