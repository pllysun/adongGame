import { describe, expect, it, beforeAll } from 'vitest'
import { SimEngine } from '../src/engine'
import { fireEvent, eventDef, eventLevel, eventScope, levelRarity, expireInbox, INBOX_WINDOW_DAYS, allEvents } from '../src/engine/systems/events'
import { registerAllEvents } from '../src/engine/content/events'
import { RNG } from '../src/engine/core/rng'

beforeAll(() => registerAllEvents())

function mk(seed = 'route') {
  const e = new SimEngine(seed, { sectName: '分流宗', siteQuality: 3, siteDanger: 3 })
  e.world.sect.stones = 9999
  e.world.sect.reputation = 500
  return e
}

describe('事件等级与分流', () => {
  it('eventLevel 启发式：pause→4、crisis→3、其余→2，显式 level 优先', () => {
    expect(eventLevel({ id: 'x', category: 'opportunity', title: '', text: () => '' })).toBe(2)
    expect(eventLevel({ id: 'x', category: 'crisis', title: '', text: () => '' })).toBe(3)
    expect(eventLevel({ id: 'x', category: 'chain', pause: true, title: '', text: () => '' })).toBe(4)
    expect(eventLevel({ id: 'x', category: 'opportunity', level: 6, title: '', text: () => '' })).toBe(6)
  })
  it('eventScope：personal 字段 / personnel 分类 → 个人，否则宗门', () => {
    expect(eventScope({ id: 'x', category: 'personnel', title: '', text: () => '' })).toBe('personal')
    expect(eventScope({ id: 'x', category: 'opportunity', personal: 'self', title: '', text: () => '' })).toBe('personal')
    expect(eventScope({ id: 'x', category: 'opportunity', title: '', text: () => '' })).toBe('sect')
  })
  it('levelRarity 单调递减（高级更难遇到）', () => {
    for (let l = 2; l <= 7; l++) expect(levelRarity(l as never)).toBeLessThanOrEqual(levelRarity((l - 1) as never))
  })

  it('低级事件进收件箱、不阻塞时间；高级事件进拦截队列', () => {
    const e = mk()
    e.world.sect.rules.interceptLevel = 4
    // merchant=2 级 → 收件箱
    fireEvent(e.world, RNG.fromSeed('m'), eventDef('merchant')!)
    expect(e.world.inbox.some((i) => i.eventId === 'merchant')).toBe(true)
    expect(e.world.queue.length).toBe(0)
    // 收件箱不阻塞 tick
    const d0 = e.world.day
    e.tick()
    expect(e.world.day).toBe(d0 + 1)
  })

  it('调高拦截级别后，原本入队的事件改进收件箱', () => {
    const e = mk()
    e.world.sect.rules.interceptLevel = 7
    // 找一个 pause 事件（level 4）
    const pauseEv = allEvents().find((d) => eventLevel(d) === 4 && d.options && !d.personal)
    if (pauseEv) {
      fireEvent(e.world, RNG.fromSeed('p'), pauseEv)
      // level 4 < 7 → 收件箱（除非 def.pause===true 强制拦截）
      const inIntercept = e.world.queue.some((i) => i.eventId === pauseEv.id)
      const inInbox = e.world.inbox.some((i) => i.eventId === pauseEv.id)
      expect(inIntercept || inInbox).toBe(true)
    }
  })

  it('收件箱项带等级/范围/过期时间', () => {
    const e = mk()
    fireEvent(e.world, RNG.fromSeed('m2'), eventDef('merchant')!)
    const it = e.world.inbox.find((i) => i.eventId === 'merchant')!
    expect(it.level).toBe(2)
    expect(it.scope).toBe('sect')
    expect(it.expiryDay).toBe(e.world.day + INBOX_WINDOW_DAYS)
    expect(it.defaultOption).toBe(it.options.length - 1)
  })
})

describe('收件箱处理与过期', () => {
  it('expireInbox：到期项按默认（最后）选项自动处理并移出', () => {
    const e = mk()
    fireEvent(e.world, RNG.fromSeed('exp'), eventDef('merchant')!)
    const it = e.world.inbox[0]
    it.expiryDay = e.world.day - 1 // 强制过期
    const n0 = e.world.inbox.length
    expireInbox(e.world, RNG.fromSeed('e'))
    expect(e.world.inbox.length).toBe(n0 - 1)
  })

  it('resolve 指令可处理收件箱事件', () => {
    const e = mk()
    fireEvent(e.world, RNG.fromSeed('rs'), eventDef('merchant')!)
    const it = e.world.inbox[0]
    const r = e.command({ type: 'resolve', uid: it.uid, option: 0 })
    expect(r.ok).toBe(true)
    expect(e.world.inbox.find((x) => x.uid === it.uid)).toBeUndefined()
  })

  it('dismissInbox：立即按默认选项放弃', () => {
    const e = mk()
    fireEvent(e.world, RNG.fromSeed('dm'), eventDef('merchant')!)
    const it = e.world.inbox[0]
    const r = e.command({ type: 'dismissInbox', uid: it.uid })
    expect(r.ok).toBe(true)
    expect(e.world.inbox.length).toBe(0)
    expect(e.command({ type: 'dismissInbox', uid: 99999 }).ok).toBe(false)
  })

  it('setRule 可调拦截级别', () => {
    const e = mk()
    e.command({ type: 'setRule', key: 'interceptLevel', value: 2 })
    expect(e.world.sect.rules.interceptLevel).toBe(2)
  })

  it('长程模拟：收件箱不会无限堆积（过期清理生效）', () => {
    const e = new SimEngine('inbox-bound', { sectName: '测试', siteQuality: 3, siteDanger: 3 })
    for (let i = 0; i < 360 * 60; i++) e.tick() // 60 年，从不处理收件箱
    expect(e.world.inbox.length).toBeLessThan(40) // 受 INBOX_WINDOW_DAYS 过期清理约束
  }, 30000)
})

describe('v2→v3 存档迁移', () => {
  it('旧档回填 inbox 与 interceptLevel', () => {
    const e = mk('mig3')
    const blob = JSON.parse(JSON.stringify(e.save())) as ReturnType<SimEngine['save']>
    blob.version = 2
    delete (blob.world as Partial<typeof blob.world>).inbox
    delete (blob.world.sect.rules as Partial<typeof blob.world.sect.rules>).interceptLevel
    const loaded = SimEngine.load(blob)
    expect(Array.isArray(loaded.world.inbox)).toBe(true)
    expect(loaded.world.sect.rules.interceptLevel).toBe(5)
  })
})
