import { describe, expect, it, beforeAll } from 'vitest'
import { SimEngine } from '../src/engine'
import { fireEvent, type EventDef } from '../src/engine/systems/events'
import { peakStageMonthly } from '../src/engine/systems/peaks'
import { registerAllEvents } from '../src/engine/content/events'
import { generateDisciple } from '../src/engine/state/disciple'
import { RNG } from '../src/engine/core/rng'
import type { Peak } from '@/shared/types'

beforeAll(() => registerAllEvents())

function mk(seed = 'fill') {
  return new SimEngine(seed, { sectName: '补宗', siteQuality: 4, siteDanger: 2 })
}

describe('个人抉择事件回退路径', () => {
  it('无 appeal 的选项走 ai 回退，无 memory 不记录', () => {
    const e = mk()
    const self = e.world.disciples[0]
    const before = self.memories.length
    const def: EventDef = {
      id: 'synthetic_personal_x',
      category: 'chain',
      personal: 'self',
      cast: [{ slot: 'self', filter: () => true }],
      title: '合成',
      text: () => '合成抉择',
      options: [
        { text: '甲', effects: () => {}, ai: 8 }, // 无 appeal → 走"随性"回退
        { text: '乙', effects: () => {}, enabled: () => '不可选' }, // 被过滤
      ],
    }
    expect(() => fireEvent(e.world, RNG.fromSeed('sp'), def, { self: self.id })).not.toThrow()
    expect(self.memories.length).toBe(before) // 无 memory 配置则不记录
  })

  it('带 memory + causedByTag 的个人抉择记入因果', () => {
    const e = mk('mem')
    const self = e.world.disciples[0]
    self.memories.push({ day: 1, eventId: 'seed', kind: 'turning', text: '旧伤', impact: {}, tags: ['旧伤'] })
    const def: EventDef = {
      id: 'synthetic_personal_y',
      category: 'chain',
      personal: 'self',
      cast: [{ slot: 'self', filter: () => true }],
      title: '合成2',
      text: () => 'x',
      options: [
        {
          text: '抉择',
          effects: () => {},
          appeal: () => [{ name: '必选', input: () => 1, curve: (x) => x, weight: 1 }],
          memory: { text: () => '新的转折', tags: ['转折'], impact: { daoxin: 5 }, causedByTag: '旧伤' },
        },
      ],
    }
    fireEvent(e.world, RNG.fromSeed('my'), def, { self: self.id })
    const last = self.memories.at(-1)!
    expect(last.text).toBe('新的转折')
    expect(last.causedBy).toBe(1)
  })
})

describe('突破申请交互', () => {
  it('准许冲关 / 再缓时日 两种处理', () => {
    const e = mk('bt')
    const d = e.world.disciples.find((x) => x.realm >= 3) ?? e.world.disciples[0]
    d.realm = 3
    d.bottleneck = true
    d.sub = 2
    e.world.queue.push({ uid: 77, kind: 'breakthrough-ask', title: 'x', text: 'x', castIds: [d.id], options: [{ idx: 0, text: '准' }, { idx: 1, text: '缓' }], pause: true })
    expect(e.command({ type: 'resolve', uid: 77, option: 0 }).ok).toBe(true)

    const d2 = e.world.disciples[1]
    e.world.queue.push({ uid: 78, kind: 'breakthrough-ask', title: 'x', text: 'x', castIds: [d2.id], options: [{ idx: 0, text: '准' }, { idx: 1, text: '缓' }], pause: true })
    e.command({ type: 'resolve', uid: 78, option: 1 })
    expect(e.world.cooldowns['ask:' + d2.id]).toBeGreaterThan(e.world.day)
  })
})

describe('峰：继承、衰亡、峰争', () => {
  function bigPeakSect() {
    const e = mk('peak2')
    const rng = RNG.fromSeed('pk-gen')
    for (let i = 0; i < 30; i++) e.world.disciples.push(generateDisciple(rng, e.world, { realm: rng.int(3, 6) as never }))
    e.world.sectStage = 'peaks'
    return { e, rng }
  }
  it('峰主失踪：有门人则继承，无门人则衰亡', () => {
    const { e, rng } = bigPeakSect()
    const members = e.world.disciples.slice(0, 4)
    const survivingPeak: Peak = { id: 'pA', name: '甲峰', type: 'sword', founderId: 'ghost', masterId: 'ghost', signatureGongfa: null, treasure: null, prestige: 50, foundedDay: 0 }
    const dyingPeak: Peak = { id: 'pB', name: '乙峰', type: 'alchemy', founderId: 'ghost2', masterId: 'ghost2', signatureGongfa: null, treasure: null, prestige: 5, foundedDay: 0 }
    e.world.peaks = [survivingPeak, dyingPeak]
    members.forEach((d) => (d.peakId = 'pA')) // 甲峰有门人
    peakStageMonthly(e.world, rng)
    expect(e.world.peaks.find((p) => p.id === 'pA')?.masterId).not.toBe('ghost') // 甲峰已继承
    expect(e.world.peaks.find((p) => p.id === 'pB')).toBeUndefined() // 乙峰衰亡
  })
  it('长程演化：分峰、峰争、聚类不崩溃', () => {
    const { e, rng } = bigPeakSect()
    e.world.disciples.slice(0, 6).forEach((d) => (d.realm = 6))
    expect(() => {
      for (let m = 0; m < 400; m++) {
        e.world.day += 30
        peakStageMonthly(e.world, rng)
      }
    }).not.toThrow()
    expect(e.world.peaks.length).toBeGreaterThan(0)
  })
})
