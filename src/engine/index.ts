// SimEngine 门面（docs/07 §2）：指令模式 + 快照模式。引擎是纯 TS，零 UI 依赖。
import type { Command, Disciple, Interactive, SaveBlob, ScenarioConfig, WorldState, CombatSpec } from '@/shared/types'
import { Bus, type Channel } from './core/bus'
import { RNG } from './core/rng'
import { isMonthStart, isXunStart } from './core/clock'
import { createWorld } from './state/world'
import { cultivationDaily } from './systems/cultivation'
import { attemptMajorBreakthrough, autoGrantPill, breakthroughXun } from './systems/breakthrough'
import { behaviorXun } from './systems/behavior'
import { moodXun, demonicMonthly } from './systems/mood'
import { relationshipXun, mentorshipYearly } from './systems/relationship'
import { economyMonthly } from './systems/economy'
import { lifecycleMonthly } from './systems/lifecycle'
import { eventsXun, resolveEventChoice, finishCombat, expireInbox } from './systems/events'
import { recruitmentMonthly, admitCandidates } from './systems/recruitment'
import { victoryMonthly } from './systems/victory'
import { registerAllEvents } from './content/events'
import { FACILITY_MAP } from './content/facilities'
import { PILL_MAP } from './content/pills'
import { getD, log, chronicle } from './systems/helpers'
import { isYearStart } from './core/clock'
import { psycheMonthly, addBelief, deriveBeliefs, emptyBeliefs, BELIEF_NAMES } from './systems/psyche'
import { lineageMonthly } from './systems/lineage'
import { peakStageMonthly } from './systems/peaks'
import { omensMonthly } from './systems/omens'
import { remember } from './systems/biography'

export const SAVE_VERSION = 3

export class SimEngine {
  world: WorldState
  private rng: RNG
  private bus = new Bus()
  readonly seed: string

  constructor(seed: string, scenario: ScenarioConfig, world?: WorldState, rngState?: [number, number, number, number]) {
    registerAllEvents()
    this.seed = seed
    this.rng = rngState ? new RNG(rngState) : RNG.fromSeed(seed)
    this.world = world ?? createWorld(this.rng, scenario)
  }

  static load(blob: SaveBlob): SimEngine {
    if (blob.version !== SAVE_VERSION) blob = migrate(blob)
    return new SimEngine(blob.seed, { sectName: '', siteQuality: 3, siteDanger: 3 }, blob.world, blob.rngState)
  }

  save(): SaveBlob {
    return {
      version: SAVE_VERSION,
      seed: this.seed,
      rngState: this.rng.getState(),
      world: JSON.parse(JSON.stringify(this.world)) as WorldState,
    }
  }

  on(channel: Channel, fn: (payload: unknown) => void): () => void {
    return this.bus.on(channel, fn)
  }

  /** 是否有待玩家处理的交互（UI 据此暂停） */
  get hasPending(): boolean {
    return this.world.queue.length > 0
  }

  /** 推进 1 游戏日 */
  tick(): void {
    const w = this.world
    if (w.gameOver) return
    if (w.queue.length > 0) {
      // 有未处理交互时引擎拒绝推进（防止事件过期），由 UI/自动玩家先 resolve
      this.bus.emit('interactive', w.queue[0])
      return
    }
    w.day++
    cultivationDaily(w)
    if (isXunStart(w.day)) {
      behaviorXun(w, this.rng)
      moodXun(w)
      relationshipXun(w, this.rng)
      breakthroughXun(w, this.rng)
      eventsXun(w, this.rng)
      expireInbox(w, this.rng) // 收件箱过期项默认处理（不阻塞时间）
    }
    if (isMonthStart(w.day)) {
      economyMonthly(w, this.rng)
      lifecycleMonthly(w, this.rng)
      demonicMonthly(w, this.rng)
      psycheMonthly(w) // 心相漂移
      lineageMonthly(w, this.rng) // 师承门风传递
      peakStageMonthly(w, this.rng) // 组织演化（阶段/门槛/峰）
      omensMonthly(w, this.rng) // 征兆扫描
      recruitmentMonthly(w, this.rng)
      victoryMonthly(w, this.rng)
    }
    if (isYearStart(w.day)) {
      mentorshipYearly(w, this.rng)
    }
    if (w.queue.length > 0) this.bus.emit('interactive', w.queue[0])
    if (w.gameOver) this.bus.emit('gameover', w.gameOver)
    this.bus.emit('dirty')
  }

  /** 玩家指令唯一入口 */
  command(cmd: Command): { ok: boolean; error?: string } {
    const w = this.world
    switch (cmd.type) {
      case 'resolve': {
        // 拦截队列与收件箱都可被 resolve
        let idx = w.queue.findIndex((q) => q.uid === cmd.uid)
        let item: typeof w.queue[number] | undefined
        if (idx !== -1) {
          item = w.queue.splice(idx, 1)[0]
        } else {
          idx = w.inbox.findIndex((q) => q.uid === cmd.uid)
          if (idx === -1) return { ok: false, error: 'no such interactive' }
          item = w.inbox.splice(idx, 1)[0]
        }
        this.resolveInteractive(item, cmd.option, cmd.selection ?? [])
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'dismissInbox': {
        // 立即按默认（最保守）选项放弃处理一条收件箱事件
        const idx = w.inbox.findIndex((q) => q.uid === cmd.uid)
        if (idx === -1) return { ok: false, error: 'no such inbox item' }
        const item = w.inbox.splice(idx, 1)[0]
        this.resolveInteractive(item, item.defaultOption ?? item.options.length - 1, [])
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'build': {
        const def = FACILITY_MAP.get(cmd.facility)
        if (!def) return { ok: false, error: 'unknown facility' }
        const cur = w.sect.facilities[cmd.facility] ?? 0
        if (cur >= def.maxLevel) return { ok: false, error: '已达最高等级' }
        const cost = def.cost(cur + 1)
        if (w.sect.stones < cost.stones || w.sect.materials < cost.materials)
          return { ok: false, error: `需灵石 ${cost.stones}、材料 ${cost.materials}` }
        if (def.realmReq) {
          const need = def.realmReq(cur + 1)
          if (!w.disciples.some((d) => d.realm >= need)) return { ok: false, error: `需有更高境界弟子坐镇` }
        }
        w.sect.stones -= cost.stones
        w.sect.materials -= cost.materials
        w.sect.facilities[cmd.facility] = cur + 1
        log(w, 'system', `${def.name}升至 ${cur + 1} 级。`)
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'setRule': {
        ;(w.sect.rules as unknown as Record<string, unknown>)[cmd.key] = cmd.value
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'grantPill': {
        const d = getD(w, cmd.discipleId)
        const p = PILL_MAP.get(cmd.pillId)
        if (!d || !p || (w.sect.pills[cmd.pillId] ?? 0) <= 0) return { ok: false, error: '丹药不足' }
        w.sect.pills[cmd.pillId]--
        applyPill(w, d, cmd.pillId)
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'grantArtifact': {
        const d = getD(w, cmd.discipleId)
        const i = w.sect.artifacts.indexOf(cmd.artifactId)
        if (!d || i === -1) return { ok: false, error: '法宝不在库中' }
        w.sect.artifacts.splice(i, 1)
        if (d.artifact) w.sect.artifacts.push(d.artifact)
        d.artifact = cmd.artifactId
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'setGongfa': {
        const d = getD(w, cmd.discipleId)
        if (!d || !w.sect.gongfa.includes(cmd.gongfaId)) return { ok: false, error: '藏经阁无此功法' }
        if (d.gongfa !== cmd.gongfaId) {
          d.gongfa = cmd.gongfaId
          d.cultivation *= 0.9 // 换功法折损（docs/02 §6）
        }
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'setRank': {
        const d = getD(w, cmd.discipleId)
        if (!d) return { ok: false, error: 'no disciple' }
        d.rank = cmd.rank
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'expel': {
        const d = getD(w, cmd.discipleId)
        if (!d) return { ok: false, error: 'no disciple' }
        log(w, 'system', `${d.name}被逐出山门。`)
        const { removeDisciple, deathRipple } = require_helpers()
        deathRipple(w, d)
        removeDisciple(w, d, '被逐出')
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'divineIntervene': {
        // 天道亲临（docs/09 §4）：耗气运强行扭转一次心相，有递增冷却
        const d = getD(w, cmd.discipleId)
        if (!d) return { ok: false, error: 'no disciple' }
        const cost = 8 + w.divineFavor * 4
        if (w.sect.qiyun < cost) return { ok: false, error: `气运不足（需 ${cost}）` }
        w.sect.qiyun -= cost
        w.divineFavor++
        // 道心/忠诚向上，心魔/魔倾向下，强力但一次性
        if (cmd.toward === 'xinmo' || cmd.toward === 'molean') addBelief(d, cmd.toward, -40)
        else addBelief(d, cmd.toward, 40)
        d.mood = Math.max(d.mood, 20)
        if (d.status === 'demonic') d.status = 'normal'
        remember(d, w.day, {
          eventId: 'divine', text: `冥冥中似有伟力垂顾，${d.name}的${BELIEF_NAMES[cmd.toward]}为之一正。`,
          kind: 'turning', tags: ['天道亲临'], impact: {},
        })
        log(w, 'system', `天道亲临，点化${d.name}（耗气运 ${cost}）。`, 5)
        chronicle(w, 'divine', `天道垂顾，点化${d.name}于一念之间。`)
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'appointPeakMaster': {
        const p = w.peaks.find((x) => x.id === cmd.peakId)
        const d = getD(w, cmd.discipleId)
        if (!p || !d) return { ok: false, error: 'no peak/disciple' }
        p.masterId = d.id
        d.peakId = p.id
        log(w, 'system', `掌门钦点${d.name}执掌${p.name}。`)
        this.bus.emit('dirty')
        return { ok: true }
      }
      case 'allocatePeak': {
        const p = w.peaks.find((x) => x.id === cmd.peakId)
        if (!p) return { ok: false, error: 'no peak' }
        if (w.sect.stones < cmd.stones) return { ok: false, error: '灵石不足' }
        w.sect.stones -= cmd.stones
        p.prestige += Math.round(cmd.stones / 20)
        // 资源惠及峰内弟子忠诚
        for (const d of w.disciples) if (d.peakId === p.id) addBelief(d, 'loyalty', 3)
        log(w, 'system', `宗门拨${cmd.stones}灵石予${p.name}。`)
        this.bus.emit('dirty')
        return { ok: true }
      }
    }
  }

  private resolveInteractive(item: Interactive, option: number, selection: string[]): void {
    const w = this.world
    switch (item.kind) {
      case 'event':
        if (item.eventId) resolveEventChoice(w, this.rng, item.eventId, item.cast ?? {}, option)
        break
      case 'recruit': {
        const payload = item.payload as { candidates: Disciple[] }
        if (option === 0) admitCandidates(w, payload.candidates, selection)
        else log(w, 'system', '本届开山大会未录一人。')
        break
      }
      case 'combat-setup': {
        const spec = item.payload as CombatSpec
        const team = selection
          .map((id) => getD(w, id))
          .filter((d): d is Disciple => !!d)
          .slice(0, spec.maxTeam ?? 6)
        finishCombat(w, this.rng, spec, team)
        break
      }
      case 'breakthrough-ask': {
        const d = getD(w, item.castIds[0])
        if (!d) break
        if (option === 0) {
          autoGrantPill(w, d)
          attemptMajorBreakthrough(w, d, this.rng)
        } else {
          w.cooldowns['ask:' + d.id] = w.day + 360
        }
        break
      }
    }
  }
}

// 存档迁移框架（docs/07 §5）：版本不符时逐级升级
function migrate(blob: SaveBlob): SaveBlob {
  let b = blob
  if (b.version < 2) b = migrateV1toV2(b)
  if (b.version < 3) b = migrateV2toV3(b)
  return { ...b, version: SAVE_VERSION }
}

/** v2→v3：事件分流字段回填（docs/04 §事件分流） */
function migrateV2toV3(blob: SaveBlob): SaveBlob {
  const w = blob.world as WorldState & { inbox?: unknown }
  if (!w.inbox) w.inbox = []
  if (w.sect.rules.interceptLevel === undefined) w.sect.rules.interceptLevel = 5
  return { ...blob, version: 3 }
}

/** v1→v2：命途系统字段回填（docs/09 §11） */
function migrateV1toV2(blob: SaveBlob): SaveBlob {
  const w = blob.world as WorldState & { peaks?: unknown }
  for (const d of w.disciples) {
    if (!d.beliefs) {
      d.beliefs = emptyBeliefs()
      d.memories = []
      d.masterId = null
      d.peakId = null
      d.lineageTier = null
      d.beliefs = deriveBeliefs(d)
    }
  }
  if (!w.peaks) w.peaks = []
  if (!w.sectStage) w.sectStage = 'founding'
  if (!w.innerThreshold) w.innerThreshold = { realm: 1, aptitude: 0 }
  if (w.divineFavor === undefined) w.divineFavor = 0
  return { ...blob, version: 2 }
}

function applyPill(w: WorldState, d: Disciple, pillId: string): void {
  const p = PILL_MAP.get(pillId)!
  switch (p.kind) {
    case 'breakthrough':
      d.buffs.breakthroughPill = Math.max(d.buffs.breakthroughPill ?? 0, p.power)
      break
    case 'healing':
      if (d.status === 'injured') {
        const remain = d.statusUntil - w.day
        d.statusUntil = w.day + Math.max(10, Math.floor(remain / p.power))
      }
      break
    case 'mood':
      d.mood = Math.min(100, d.mood + p.power)
      if (d.status === 'demonic' && d.mood > -40) d.status = 'normal'
      break
    case 'cultivation':
      d.cultivation += d.cultivation * (p.power * 0.1) + p.power * 100
      break
  }
  log(w, 'system', `${d.name}服下${p.name}。`, p.rarity)
}

// 避免顶部循环依赖（helpers ↔ index 不存在，此处仅为 expel 用例的延迟取用）
import * as helpersModule from './systems/helpers'
function require_helpers(): typeof helpersModule {
  return helpersModule
}

export { generateSites } from './state/world'
export type { SiteOption } from './state/world'
