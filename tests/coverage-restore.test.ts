// 覆盖恢复：千条事件改变了模拟 RNG 轨迹，致使原先靠"长程模拟恰好抽中"覆盖的分支失覆盖。
// 本测试改为【不依赖事件抽签】的确定性驱动：直接调用各系统函数 + 在极端状态密集世界里长跑。
import { describe, expect, it, beforeAll } from 'vitest'
import { SimEngine } from '../src/engine'
import { registerAllEvents } from '../src/engine/content/events'
import { generateDisciple } from '../src/engine/state/disciple'
import { RNG } from '../src/engine/core/rng'
import { makeFlavor } from '../src/engine/content/events/flavor'
import type { EventCtx } from '../src/engine/systems/events'
import { lineageMonthly, bind, masterOf, disciplesOf, avgMolean } from '../src/engine/systems/lineage'
import { omensMonthly } from '../src/engine/systems/omens'
import {
  psycheMonthly, daoxinTier, xinmoTier, moleanTier, loyaltyTier, fameTier, beliefTier,
  BELIEF_KEYS, deriveBeliefs, setBeliefsToward, addBelief,
} from '../src/engine/systems/psyche'
import { decide } from '../src/engine/ai/decision'
import { effectiveLuck, deathRipple, setRel } from '../src/engine/systems/helpers'
import { breakthroughXun } from '../src/engine/systems/breakthrough'
import { victoryMonthly } from '../src/engine/systems/victory'
import { recruitmentMonthly } from '../src/engine/systems/recruitment'
import { finishCombat, fireEvent, eventDef } from '../src/engine/systems/events'
import type { Disciple, WorldState } from '@/shared/types'

beforeAll(() => registerAllEvents())

function ctx(w: WorldState, rng: RNG, cast: Record<string, Disciple>): EventCtx {
  return { w, rng, cast, api: {} as never } as unknown as EventCtx
}

describe('flavor 工厂边界分支', () => {
  it('怪异效果码 / amb / pair / 空选角回退 全覆盖', () => {
    const e = new SimEngine('flv', { sectName: '味宗', siteQuality: 3, siteDanger: 3 })
    const rng = RNG.fromSeed('flv2')
    const w = e.world
    // 怪异码：未知键 zz、NaN 数字 mZZ、关系 ~6、全资源、全心相、留痕 R —— parseEff 在构造期即执行
    const evs = makeFlavor('cov', [
      { t: '全码', v: ['{a}与{b}及{d}'], e: 'zz mZZ ~6 q2 s10 h5 c5 t5 r5 d2 x2 o2 l2 f2 R', m: 'pair' },
      { t: '独修', v: ['{d}独修'], e: 'd3 m4 R', m: 'solo' },
      { t: '环境', v: ['四下无人'], e: 's-100 h-100 q', m: 'amb' },
      { t: '空码', v: ['{d}'], m: 'solo' },
    ])
    expect(evs).toHaveLength(4)
    const full = ctx(w, rng, { a: w.disciples[0], b: w.disciples[1], d: w.disciples[0] })
    const empty = ctx(w, rng, {})
    for (const ev of evs) {
      expect(typeof ev.text(full)).toBe('string')
      expect(typeof ev.text(empty)).toBe('string') // 空选角 → 占位回退
      ev.auto!(full)
      ev.auto!(empty) // 空选角 → main 为空，提前返回
    }
    expect(w.sect.herbs).toBeGreaterThanOrEqual(0) // Math.max(0,..) 夹底分支
  })
})

describe('心相档位（模糊显示）全档', () => {
  it('五轴每档与 beliefTier 分发', () => {
    for (const v of [80, 60, 40, 20, 5]) {
      expect(daoxinTier(v)).toBeTypeOf('string')
      expect(xinmoTier(v)).toBeTypeOf('string')
      expect(moleanTier(v)).toBeTypeOf('string')
      expect(loyaltyTier(v)).toBeTypeOf('string')
      expect(fameTier(v)).toBeTypeOf('string')
    }
    for (const k of BELIEF_KEYS) expect(beliefTier(k, 50)).toBeTypeOf('string')
  })
})

describe('决策内核三策略 + 过滤回退', () => {
  it('argmax/weighted/softmax/floor全过滤/空候选', () => {
    const rng = RNG.fromSeed('dec')
    const cons = (o: number) => [{ name: 'x', input: () => o / 10, curve: (x: number) => x, weight: 1 }]
    for (const selection of ['argmax', 'weighted', 'softmax'] as const) {
      const r = decide({ candidates: [1, 5, 9], context: (o) => o, considerations: cons, selection, rng, temperature: 0.3 })
      expect(r.chosen).not.toBeNull()
    }
    // floor 过滤掉全部 → 回退最高分
    const r2 = decide({ candidates: [1, 2], context: (o) => o, considerations: cons, floor: 999, rng })
    expect(r2.chosen).not.toBeNull()
    // 空候选 → null
    const r3 = decide({ candidates: [] as number[], context: (o) => o, considerations: cons, rng })
    expect(r3.chosen).toBeNull()
  })
})

describe('helpers：气运修正与亡故涟漪各关系', () => {
  it('effectiveLuck 受特质修正', () => {
    const e = new SimEngine('luck', { sectName: '运宗', siteQuality: 3, siteDanger: 3 })
    const d = e.world.disciples[0]
    d.traits = ['blessed']
    const a = effectiveLuck(d)
    d.traits = ['cursed']
    const b = effectiveLuck(d)
    expect(a).toBeGreaterThan(b)
  })
  it('deathRipple 覆盖道侣/师徒/挚友/仇怨四类边', () => {
    const e = new SimEngine('ripple', { sectName: '殇宗', siteQuality: 3, siteDanger: 3 })
    const rng = RNG.fromSeed('rp')
    const w = e.world
    const center = generateDisciple(rng, w, {})
    w.disciples.push(center)
    const couple = generateDisciple(rng, w, {}); w.disciples.push(couple); couple.traits = ['devoted']
    const master = generateDisciple(rng, w, {}); w.disciples.push(master)
    const friend = generateDisciple(rng, w, {}); w.disciples.push(friend)
    const foe = generateDisciple(rng, w, {}); w.disciples.push(foe)
    setRel(w, center.id, couple.id, 'couple', 90)
    setRel(w, master.id, center.id, 'master', 80)
    setRel(w, center.id, friend.id, 'friend', 70)
    setRel(w, center.id, foe.id, 'rival', -80)
    expect(() => deathRipple(w, center)).not.toThrow()
    expect(couple.beliefs.xinmo).toBeGreaterThan(0) // 丧侣创伤写入心魔
  })
})

describe('师承传承：心相趋近 + 特质门风传递', () => {
  it('长跑 lineageMonthly 触发徒承师风', () => {
    const e = new SimEngine('lin', { sectName: '承宗', siteQuality: 3, siteDanger: 3 })
    const rng = RNG.fromSeed('lin2')
    const w = e.world
    const master = generateDisciple(rng, w, { realm: 5 }); w.disciples.push(master)
    master.traits = ['battlemad', 'diligent'] // 可见特质，供传递
    master.beliefs.molean = 80
    master.beliefs.daoxin = 90
    const students: Disciple[] = []
    for (let i = 0; i < 8; i++) {
      const s = generateDisciple(rng, w, { realm: 2 })
      s.traits = ['humble']
      w.disciples.push(s)
      bind(w, master, s, i % 2 === 0 ? 'zhuan' : 'jiming')
      students.push(s)
    }
    expect(masterOf(w, students[0])?.id).toBe(master.id)
    expect(disciplesOf(w, master.id).length).toBe(8)
    let inherited = false
    for (let m = 0; m < 1200 && !inherited; m++) {
      w.day += 30
      lineageMonthly(w, rng)
      inherited = students.some((s) => s.traits.includes('battlemad') || s.traits.includes('diligent'))
    }
    expect(inherited).toBe(true) // 门风传递分支命中
    expect(students[0].beliefs.molean).toBeGreaterThan(0) // 心相已趋近师尊
    expect(avgMolean(students)).toBeGreaterThan(0)
  })
})

describe('征兆扫描：心魔/叛逃/堕魔三类', () => {
  it('极端心相世界长跑触发各类征兆', () => {
    const e = new SimEngine('omen', { sectName: '兆宗', siteQuality: 3, siteDanger: 3 })
    const rng = RNG.fromSeed('omen2')
    const w = e.world
    const mk = (b: Partial<typeof w.disciples[0]['beliefs']>) => {
      const d = generateDisciple(rng, w, { realm: 4 })
      Object.assign(d.beliefs, b)
      w.disciples.push(d)
      return d
    }
    mk({ xinmo: 90, daoxin: 10 }) // demon 征兆
    mk({ loyalty: 5, molean: 60 }) // defect 征兆
    mk({ molean: 55, daoxin: 10 }) // corrupt 征兆
    let omenFlags = 0
    for (let m = 0; m < 400; m++) {
      w.day += 30
      omensMonthly(w, rng)
      omenFlags = Object.keys(w.flags).filter((k) => k.startsWith('omen:')).length
      if (omenFlags >= 3) break
    }
    expect(omenFlags).toBeGreaterThanOrEqual(2) // 至少两类征兆被触发
  })
})

describe('psyche 月度漂移 + 派生 + 定向', () => {
  it('psycheMonthly/deriveBeliefs/setBeliefsToward 不崩', () => {
    const e = new SimEngine('psy', { sectName: '相宗', siteQuality: 3, siteDanger: 3 })
    const w = e.world
    const d = w.disciples[0]
    d.beliefs.xinmo = 60
    d.mood = -50
    setBeliefsToward(d, 'daoxin', 90, 0.5)
    addBelief(d, 'xinmo', -10)
    const derived = deriveBeliefs(d)
    expect(derived).toHaveProperty('daoxin')
    for (let m = 0; m < 24; m++) psycheMonthly(w)
    expect(d.beliefs.daoxin).toBeGreaterThanOrEqual(0)
  })
})

describe('突破申请：审批关闭时挂询问 + 冷却防重复', () => {
  it('autoBreakthrough 关闭 → 入队 + 二次冷却跳过', () => {
    const e = new SimEngine('bt2', { sectName: '关宗', siteQuality: 3, siteDanger: 3 })
    const rng = RNG.fromSeed('bt3')
    const w = e.world
    w.sect.rules.autoBreakthrough = false
    const d = w.disciples[0]
    d.realm = 3
    d.sub = 2
    d.bottleneck = true
    d.status = 'normal'
    breakthroughXun(w, rng)
    const asked = w.queue.some((q) => q.kind === 'breakthrough-ask')
    expect(asked).toBe(true)
    // 驳回后置冷却，再跑不重复入队
    w.queue.length = 0
    w.cooldowns['ask:' + d.id] = w.day + 360
    breakthroughXun(w, rng)
    expect(w.queue.some((q) => q.kind === 'breakthrough-ask')).toBe(false)
  })
})

describe('边界路径：灭门/招收早返/无人应战/坏选角', () => {
  it('弟子归零 → 灭门判定', () => {
    const e = new SimEngine('def', { sectName: '亡宗', siteQuality: 3, siteDanger: 3 })
    const rng = RNG.fromSeed('def2')
    e.world.disciples.length = 0
    victoryMonthly(e.world, rng)
    expect(e.world.gameOver?.type).toBe('defeat')
  })
  it('已有招收在队 → 提前返回', () => {
    const e = new SimEngine('rec', { sectName: '收宗', siteQuality: 3, siteDanger: 3 })
    const rng = RNG.fromSeed('rec2')
    const w = e.world
    w.nextRecruitDay = 0
    w.queue.push({ uid: 999, kind: 'recruit', title: 'x', text: 'x', castIds: [], options: [], pause: true } as never)
    const before = w.queue.length
    recruitmentMonthly(w, rng)
    expect(w.queue.length).toBe(before) // 未再次入队
  })
  it('无人应战 → 直接败北并调度败方链', () => {
    const e = new SimEngine('cmb', { sectName: '战宗', siteQuality: 3, siteDanger: 3 })
    const rng = RNG.fromSeed('cmb2')
    const w = e.world
    const sched0 = w.scheduled.length
    finishCombat(w, rng, { kind: 'beast', enemyName: '兽潮', enemyPower: 100, onLoseEvent: 'beast_aftermath' }, [])
    expect(w.scheduled.length).toBe(sched0 + 1)
  })
  it('预置选角指向不存在弟子 → 事件流产', () => {
    const e = new SimEngine('bad', { sectName: '角宗', siteQuality: 3, siteDanger: 3 })
    const rng = RNG.fromSeed('bad2')
    const def = eventDef('arena_feud')
    if (def) {
      const ok = fireEvent(e.world, rng, def, { a: 'NO_SUCH_ID' })
      expect(ok).toBe(false)
    }
  })
})

describe('密集极端世界长跑：经济赤字/世代/心魔/峰演化', () => {
  it('full tick 1500 日不崩，覆盖各月度系统', () => {
    const e = new SimEngine('dense', { sectName: '密宗', siteQuality: 4, siteDanger: 3 })
    const rng = RNG.fromSeed('dense-gen')
    const w = e.world
    // 30 名极端状态弟子 + 师承 + 峰
    let prev: Disciple | null = null
    for (let i = 0; i < 30; i++) {
      const d = generateDisciple(rng, w, { realm: rng.int(2, 6) as never })
      if (i % 5 === 0) d.beliefs.xinmo = 85
      if (i % 7 === 0) { d.beliefs.loyalty = 8; d.beliefs.molean = 55 }
      if (i % 3 === 0) d.status = 'demonic'
      w.disciples.push(d)
      if (prev && rng.chance(0.6)) bind(w, prev, d)
      prev = d
    }
    w.sectStage = 'peaks'
    // 制造经济赤字：清空灵石灵米，留一批 greedy 弟子触发偷窃钩子
    w.sect.stones = 0
    w.sect.rice = 0
    w.disciples.slice(0, 3).forEach((d) => (d.traits = ['greedy']))
    expect(() => {
      for (let day = 0; day < 1500 && !w.gameOver; day++) {
        e.tick()
        let guard = 0
        while ((w.queue.length > 0 || w.inbox.length > 0) && guard++ < 40) {
          const item = w.queue[0] ?? w.inbox[0]
          const sel = item.kind === 'recruit'
            ? ((item.payload as { candidates?: { id: string }[] })?.candidates ?? []).slice(0, 3).map((c) => c.id)
            : item.kind === 'combat-setup'
              ? w.disciples.slice(0, 3).map((d) => d.id)
              : undefined
          e.command({ type: 'resolve', uid: item.uid, option: 0, selection: sel })
        }
      }
    }).not.toThrow()
    expect(w.day).toBeGreaterThan(0)
  }, 60_000)
})
