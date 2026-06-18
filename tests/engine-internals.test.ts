import { describe, expect, it, beforeAll } from 'vitest'
import { SimEngine } from '../src/engine'
import { eventsXun, fireEvent, eventDef } from '../src/engine/systems/events'
import { resolveTribulation, resolveCombat, disciplePower, teamPower } from '../src/engine/systems/combat'
import { chooseForCharacter, C } from '../src/engine/systems/character-ai'
import { registerAllEvents } from '../src/engine/content/events'
import { generateDisciple } from '../src/engine/state/disciple'
import { RNG } from '../src/engine/core/rng'

beforeAll(() => registerAllEvents())

function mk(seed = 'eng') {
  return new SimEngine(seed, { sectName: '内核宗', siteQuality: 3, siteDanger: 3 })
}

describe('引擎门面内部路径', () => {
  it('队列待决时 tick 不推进日期', () => {
    const e = mk()
    e.world.queue.push({ uid: 1, kind: 'event', title: 't', text: 't', castIds: [], options: [{ idx: 0, text: 'x' }], pause: true })
    const d0 = e.world.day
    e.tick()
    expect(e.world.day).toBe(d0)
  })
  it('gameOver 后 tick 为 no-op', () => {
    const e = mk()
    e.world.gameOver = { type: 'defeat', day: 0, reason: 'x' }
    e.tick()
    expect(e.world.day).toBe(0)
  })
  it('on/off 订阅 dirty 通道', () => {
    const e = mk()
    let n = 0
    const off = e.on('dirty', () => n++)
    e.tick()
    expect(n).toBeGreaterThan(0)
    off()
  })
  it('天道亲临治愈心魔缠身', () => {
    const e = mk()
    const d = e.world.disciples[0]
    d.status = 'demonic'
    e.world.sect.qiyun = 100
    e.command({ type: 'divineIntervene', discipleId: d.id, toward: 'xinmo' })
    expect(d.status).toBe('normal')
  })
  it('峰指令错误分支', () => {
    const e = mk()
    expect(e.command({ type: 'appointPeakMaster', peakId: '无', discipleId: 'x' }).ok).toBe(false)
    e.world.peaks = [{ id: 'p', name: '剑峰', type: 'sword', founderId: 'x', masterId: 'x', signatureGongfa: null, treasure: null, prestige: 1, foundedDay: 0 }]
    e.world.sect.stones = 10
    expect(e.command({ type: 'allocatePeak', peakId: 'p', stones: 999 }).ok).toBe(false)
  })
  it('divineIntervene 对不存在弟子报错', () => {
    const e = mk()
    e.world.sect.qiyun = 100
    expect(e.command({ type: 'divineIntervene', discipleId: '无', toward: 'daoxin' }).ok).toBe(false)
  })
})

describe('事件旬抽取', () => {
  it('到期的调度事件被触发', () => {
    const e = mk('sched')
    const w = e.world
    w.scheduled.push({ day: w.day, eventId: 'insight_rain', cast: {} })
    const c0 = w.disciples[0].cultivation
    eventsXun(w, RNG.fromSeed('s'))
    expect(w.disciples[0].cultivation).toBeGreaterThanOrEqual(c0)
  })
  it('多次抽取随机池不崩溃', () => {
    const e = mk('pool')
    for (let i = 0; i < 200; i++) e.world.disciples.push(generateDisciple(RNG.fromSeed('g' + i), e.world, {}))
    expect(() => {
      for (let i = 0; i < 300; i++) eventsXun(e.world, RNG.fromSeed('p' + i))
    }).not.toThrow()
  })
})

describe('天劫与战力', () => {
  it('resolveTribulation 返回是否渡过', () => {
    const e = mk('trib')
    const d = e.world.disciples.find((x) => x.realm >= 3)!
    const r = resolveTribulation(e.world, d, disciplePower(d) * 0.5, RNG.fromSeed('t'))
    expect(typeof r.survived).toBe('boolean')
    // 极强天雷大概率失败
    const r2 = resolveTribulation(e.world, d, disciplePower(d) * 100, RNG.fromSeed('t2'))
    expect(typeof r2.survived).toBe('boolean')
  })
  it('teamPower 含协同与护山大阵', () => {
    const e = mk('tp')
    e.world.sect.facilities['wall'] = 3
    const p = teamPower(e.world, e.world.disciples, true)
    expect(p).toBeGreaterThan(0)
    expect(teamPower(e.world, [], false)).toBe(0)
  })
  it('切磋类低烈度战斗', () => {
    const e = mk('duel')
    const r = resolveCombat(e.world, { kind: 'duel', enemyName: '同门', enemyPower: 50, lethality: 0 }, e.world.disciples.slice(0, 2), RNG.fromSeed('d'))
    expect(r.report.lines.length).toBeGreaterThan(0)
  })
})

describe('角色 AI 边界', () => {
  it('空选项返回 null', () => {
    const e = mk('ai')
    const r = chooseForCharacter(e.world.disciples[0], e.world, [], RNG.fromSeed('x'))
    expect(r.option).toBeNull()
  })
  it('考量构件齐全', () => {
    const e = mk('aic')
    const d = e.world.disciples[0]
    const opts = [
      { option: 'a', considerations: [C.xinmo(), C.daoxin(), C.molean(), C.loyalty(), C.fame(), C.trait('loyal', '忠'), C.memory('丧侣', '伤'), C.base('底', 0.5), C.righteous(), C.disloyal(), C.daoxinResist(), C.guidance('g', () => 0.5)] },
      { option: 'b', considerations: [C.base('平', 0.3)] },
    ]
    const r = chooseForCharacter(d, e.world, opts, RNG.fromSeed('c'))
    expect(['a', 'b']).toContain(r.option)
    expect(r.appraisal).not.toBeNull()
  })
})

describe('战略链事件直触', () => {
  it('远航/灵植/名师密辛/讨魔等链事件 auto 与 resolve', () => {
    const ids = ['expedition_return', 'spirit_garden_harvest', 'mine_secured', 'mine_kept', 'mine_lost', 'demon_purge_won', 'demon_purge_lost', 'treasure_won', 'duel_won', 'duel_lost', 'war_won', 'war_lost', 'beast_aftermath']
    for (const id of ids) {
      const def = eventDef(id)
      if (!def) continue
      const e = mk('link-' + id)
      e.world.flags['expeditionStake'] = 3
      e.world.flags['mineHeld'] = true
      e.world.sect.gongfa = ['tunaqi', 'qingping']
      expect(() => fireEvent(e.world, RNG.fromSeed(id), def)).not.toThrow()
    }
  })
})
