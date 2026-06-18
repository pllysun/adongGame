import { describe, expect, it, beforeAll } from 'vitest'
import { SimEngine } from '../src/engine'
import { allEvents, eventDef, fireEvent } from '../src/engine/systems/events'
import { registerAllEvents } from '../src/engine/content/events'
import { flagNum, addFlag, allies, demonLean } from '../src/engine/content/events/util'
import { RNG } from '../src/engine/core/rng'

beforeAll(() => registerAllEvents())

describe('事件堆量（抗重复）', () => {
  it('事件总数 ≥ 100', () => {
    expect(allEvents().length).toBeGreaterThanOrEqual(100)
  })
  it('新增战略与日常事件均已注册', () => {
    const ids = new Set(allEvents().map((e) => e.id))
    for (const id of ['spirit_garden', 'expedition', 'contested_mine', 'hire_elder', 'debate_tournament',
      'arbitrate', 'beast_pact', 'demonic_manual', 'righteous_alliance', 'demon_courtship', 'charity',
      'daily_dawn', 'daily_spar', 'daily_insight'])
      expect(ids.has(id), `事件 ${id} 未注册`).toBe(true)
  })
  it('战略事件链的调度目标都存在', () => {
    const known = new Set(allEvents().map((e) => e.id))
    for (const id of ['spirit_garden_harvest', 'expedition_return', 'mine_secured', 'mine_raid', 'mine_kept',
      'mine_lost', 'hired_elder_secret', 'beast_tribute', 'demon_purge_won', 'demon_purge_lost'])
      expect(known.has(id), `链事件 ${id} 缺失`).toBe(true)
  })
})

describe('战略轴工具（flags 存储，无需迁移）', () => {
  it('flagNum/addFlag 读写并夹取 0~100', () => {
    const e = new SimEngine('flag-test', { sectName: '测试宗', siteQuality: 3, siteDanger: 3 })
    expect(flagNum(e.world, 'demonLean')).toBe(0)
    addFlag(e.world, 'demonLean', 40)
    expect(demonLean(e.world)).toBe(40)
    addFlag(e.world, 'demonLean', 999)
    expect(demonLean(e.world)).toBe(100) // 夹顶
    addFlag(e.world, 'demonLean', -999)
    expect(demonLean(e.world)).toBe(0) // 夹底
  })
  it('allies 仅返回 goodwill>0 的友宗', () => {
    const e = new SimEngine('ally-test', { sectName: '测试宗', siteQuality: 3, siteDanger: 3 })
    expect(allies(e.world)).toHaveLength(0)
    addFlag(e.world, 'ally:danxia', 30)
    const a = allies(e.world)
    expect(a).toHaveLength(1)
    expect(a[0].name).toBe('丹霞谷')
    expect(a[0].goodwill).toBe(30)
  })
})

describe('战略事件效果', () => {
  it('开仓济民：以钱粮换声望与气运', () => {
    const e = new SimEngine('charity-test', { sectName: '善宗', siteQuality: 3, siteDanger: 3 })
    e.world.sect.stones = 1000
    e.world.sect.rice = 300
    e.world.sect.rules.interceptLevel = 1 // 全部拦截入队
    const rep0 = e.world.sect.reputation
    const qiyun0 = e.world.sect.qiyun
    fireEvent(e.world, RNG.fromSeed('c'), eventDef('charity')!)
    const item = e.world.queue.find((q) => q.eventId === 'charity')!
    e.command({ type: 'resolve', uid: item.uid, option: 0 }) // 慷慨解囊
    expect(e.world.sect.reputation).toBeGreaterThan(rep0)
    expect(e.world.sect.qiyun).toBeGreaterThan(qiyun0)
    expect(e.world.sect.stones).toBe(700)
  })

  it('仲裁结义：秉公直断结一友添一怨', () => {
    const e = new SimEngine('arb-test', { sectName: '裁宗', siteQuality: 3, siteDanger: 3 })
    e.world.sect.rules.interceptLevel = 1
    e.world.sect.reputation = 200
    fireEvent(e.world, RNG.fromSeed('a'), eventDef('arbitrate')!)
    const item = e.world.queue.find((q) => q.eventId === 'arbitrate')!
    e.command({ type: 'resolve', uid: item.uid, option: 0 })
    expect(allies(e.world).length).toBe(1) // 结一友
    expect(allies(e.world)[0].goodwill).toBe(30)
  })

  it('魔功现世：修习魔功推高正魔倾向', () => {
    const e = new SimEngine('demon-test', { sectName: '魔宗', siteQuality: 3, siteDanger: 3 })
    e.world.sect.rules.interceptLevel = 1
    fireEvent(e.world, RNG.fromSeed('d'), eventDef('demonic_manual')!)
    const item = e.world.queue.find((q) => q.eventId === 'demonic_manual')
    expect(item).toBeDefined()
    const lean0 = demonLean(e.world)
    e.command({ type: 'resolve', uid: item!.uid, option: 1 }) // 准其修习
    expect(demonLean(e.world)).toBeGreaterThan(lean0)
  })

  it('灵矿月收：持有灵矿时经济注入', () => {
    const e = new SimEngine('mine-test', { sectName: '矿宗', siteQuality: 1, siteDanger: 1 })
    e.world.flags['mineHeld'] = true
    const stones0 = e.world.sect.stones
    // 推进一个月触发 economyMonthly
    for (let i = 0; i < 30; i++) e.tick()
    // 持矿应带来净正向（粗略：不至于比无矿更穷）
    expect(e.world.sect.stones).toBeGreaterThan(stones0 - 100)
  })
})
