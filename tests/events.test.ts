import { describe, expect, it, beforeAll } from 'vitest'
import { SimEngine } from '../src/engine'
import { allEvents, resolveCast, fireEvent, eventDef } from '../src/engine/systems/events'
import { registerAllEvents } from '../src/engine/content/events'
import { RNG } from '../src/engine/core/rng'

beforeAll(() => registerAllEvents())

describe('事件内容库完整性（docs/04）', () => {
  it('事件总数 ≥ 60（M6 内容目标）', () => {
    expect(allEvents().length).toBeGreaterThanOrEqual(60)
  })

  it('事件 id 唯一且选项结构合法', () => {
    const ids = new Set<string>()
    for (const e of allEvents()) {
      expect(ids.has(e.id)).toBe(false)
      ids.add(e.id)
      if (e.options) {
        expect(e.options.length).toBeGreaterThan(0)
        for (const o of e.options) expect(typeof o.effects).toBe('function')
      } else {
        expect(e.auto).toBeTypeOf('function')
      }
    }
  })

  it('链事件的调度目标都存在', () => {
    // 静态扫描：onWinEvent/onLoseEvent/sched 中引用的 id 必须已注册
    const known = new Set(allEvents().map((e) => e.id))
    const referenced = ['secret_realm_loot', 'beast_tide', 'beast_aftermath', 'duel_won', 'duel_lost',
      'sect_war', 'war_won', 'war_lost', 'rescue_won', 'rescue_lost', 'rogue_trouble', 'treasure_won',
      'reincarnator_arrival', 'reincarnator_hunted', 'reincarnator_saved', 'ascension_1', 'ascension_2']
    for (const id of referenced) expect(known.has(id), `事件 ${id} 未注册`).toBe(true)
  })
})

describe('选角系统', () => {
  it('条件无人满足时选角失败而非崩溃', () => {
    const e = new SimEngine('cast-test', { sectName: '测试宗', siteQuality: 3, siteDanger: 3 })
    const def = eventDef('grief_revenge')! // 需要仇怨边，开局必然无
    const cast = resolveCast(e.world, RNG.fromSeed('x'), def)
    expect(cast).toBeNull()
  })

  it('fireEvent 纯通告事件直接生效', () => {
    const e = new SimEngine('fire-test', { sectName: '测试宗', siteQuality: 3, siteDanger: 3 })
    const before = e.world.disciples.map((d) => d.cultivation)
    const ok = fireEvent(e.world, RNG.fromSeed('y'), eventDef('insight_rain')!)
    expect(ok).toBe(true)
    const after = e.world.disciples.map((d) => d.cultivation)
    for (let i = 0; i < before.length; i++) expect(after[i]).toBeGreaterThan(before[i] - 1e-9)
  })

  it('交互事件入队并可被 resolve', () => {
    const e = new SimEngine('queue-test', { sectName: '测试宗', siteQuality: 3, siteDanger: 3 })
    e.world.sect.rules.interceptLevel = 1 // 全部拦截入队（测试拦截路径）
    e.world.sect.stones = 5000
    const ok = fireEvent(e.world, RNG.fromSeed('z'), eventDef('merchant')!)
    expect(ok).toBe(true)
    expect(e.world.queue.length).toBe(1)
    const item = e.world.queue[0]
    const stonesBefore = e.world.sect.stones
    const r = e.command({ type: 'resolve', uid: item.uid, option: 0 }) // 买材料
    expect(r.ok).toBe(true)
    expect(e.world.sect.stones).toBe(stonesBefore - 200)
    expect(e.world.sect.materials).toBeGreaterThan(0)
    expect(e.world.queue.length).toBe(0)
  })
})
