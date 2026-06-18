// 事件引擎（docs/04）：条件 → 选角 → 权重抽取 → 选项 → 效果。内容定义在 content/events/。
import type { Beliefs, CombatSpec, Disciple, EventLevel, EventScope, Interactive, WorldState } from '@/shared/types'
import { EVENT_DENSITY_PER_YEAR, FLAVOR_DENSITY_PER_YEAR } from '../content/constants'
import { DAYS_PER_YEAR } from '../core/clock'
import type { RNG } from '../core/rng'
import { getD, log } from './helpers'
import { resolveCombat } from './combat'
import { powerSort } from './helpers'
import { chooseForCharacter, type AiCtx } from './character-ai'
import { remember } from './biography'
import type { Consideration } from '../ai'

export interface EventCtx {
  w: WorldState
  rng: RNG
  cast: Record<string, Disciple>
  api: EventApi
}

export interface EventApi {
  /** 延迟调度另一事件（事件链连接器） */
  sched: (eventId: string, minDays: number, maxDays: number, cast?: Record<string, string>) => void
  /** 发起战斗：playerSelect 则弹点将界面，否则用 defenderIds/全员防御 */
  combat: (spec: CombatSpec) => void
}

export interface CastSpecDef {
  slot: string
  filter: (d: Disciple, w: WorldState, cast: Record<string, Disciple>) => boolean
  sortBy?: 'luck' | 'power' | 'random' | 'aptitude'
}

export interface EventOptionDef {
  text: string | ((c: EventCtx) => string)
  enabled?: (c: EventCtx) => true | string
  effects: (c: EventCtx) => void
  ai?: number // 无头自动玩家选择权重
  // ── 个人抉择事件（docs/09 §3.4）：由角色 AI 而非玩家选择时使用 ──
  appeal?: () => Consideration<AiCtx>[] // 该选项对决策者的吸引力考量
  memory?: {
    text: (c: EventCtx) => string
    kind?: 'turning' | 'minor'
    tags?: string[]
    impact?: Partial<Beliefs> & { traitGained?: string; traitLost?: string }
    causedByTag?: string
  }
}

export interface EventDef {
  id: string
  category: 'opportunity' | 'crisis' | 'personnel' | 'chain'
  weight?: number | ((w: WorldState) => number)
  cooldownYears?: number
  once?: boolean
  pause?: boolean
  trigger?: (w: WorldState) => boolean
  cast?: CastSpecDef[]
  title: string
  text: (c: EventCtx) => string
  options?: EventOptionDef[]
  auto?: (c: EventCtx) => void // 纯通告事件的直接效果
  /** 个人抉择事件：值为决策者的角色槽名。设置后由角色 AI 自主抉择（不入玩家队列） */
  personal?: string
  // ── 事件分流（docs/04）：均为可选，内容不写也能工作（启发式默认）──
  level?: EventLevel // 1-7，越高越罕见、风险与收获越大
  scope?: EventScope // 个人 / 宗门
  defaultOption?: number // 过期默认选项（缺省 = 最后一项）
  flavor?: boolean // 风味事件：走独立抽签预算，不挤占命途/经营事件的密度，且不写心相轴
}

/** 事件等级：显式 level 优先，否则按"是否强制 pause / 分类"启发式推断 */
export function eventLevel(def: EventDef): EventLevel {
  if (def.level) return def.level
  if (def.pause === true) return 4 // 内容标了 pause 的是高潮事件
  if (def.category === 'crisis') return 3
  return 2 // 机遇/人事/日常默认 2 级
}
export function eventScope(def: EventDef): EventScope {
  return def.scope ?? (def.personal || def.category === 'personnel' ? 'personal' : 'sect')
}
/** 等级稀有度系数：折入抽取权重，等级越高越难遇到（下标 = level，1~7 全覆盖） */
export function levelRarity(level: EventLevel): number {
  return [1, 1, 0.7, 0.45, 0.25, 0.12, 0.06, 0.03][level] ?? 0.03
}
/** 收件箱停留时长（天）：低级事件给足思考时间，不致堆积过久 */
export const INBOX_WINDOW_DAYS = 600

// ── 注册表 ──
const REGISTRY = new Map<string, EventDef>()
export function registerEvents(defs: EventDef[]): void {
  for (const d of defs) {
    if (REGISTRY.has(d.id)) throw new Error('duplicate event id: ' + d.id)
    REGISTRY.set(d.id, d)
  }
}
export function eventDef(id: string): EventDef | undefined {
  return REGISTRY.get(id)
}
export function allEvents(): EventDef[] {
  return [...REGISTRY.values()]
}

// ── 选角 ──
export function resolveCast(w: WorldState, rng: RNG, def: EventDef): Record<string, Disciple> | null {
  const cast: Record<string, Disciple> = {}
  for (const spec of def.cast ?? []) {
    let pool = w.disciples.filter((d) => !Object.values(cast).includes(d) && spec.filter(d, w, cast))
    if (pool.length === 0) return null
    if (spec.sortBy === 'luck') {
      const picked = rng.weighted(pool, (d) => d.luck * d.luck)
      pool = picked ? [picked] : pool
    } else if (spec.sortBy === 'power') {
      pool = powerSort(pool)
    } else if (spec.sortBy === 'aptitude') {
      pool = [...pool].sort((a, b) => b.aptitude - a.aptitude)
    } else {
      pool = [rng.pick(pool)]
    }
    cast[spec.slot] = pool[0]
  }
  return cast
}

function makeApi(w: WorldState, rng: RNG): EventApi {
  return {
    sched: (eventId, minDays, maxDays, cast) => {
      w.scheduled.push({ day: w.day + rng.int(minDays, maxDays), eventId, cast: cast ?? {} })
    },
    combat: (spec) => {
      if (spec.playerSelect) {
        w.queue.push({
          uid: ++w.uidCounter,
          kind: 'combat-setup',
          title: `迎战：${spec.enemyName}`,
          text: `${spec.enemyName}来势汹汹（敌方战力约 ${Math.round(spec.enemyPower)}）。点将出战！`,
          castIds: [],
          options: [{ idx: 0, text: '出战' }],
          payload: spec,
          pause: true,
        })
      } else {
        const team = spec.defenderIds
          ? spec.defenderIds.map((id) => getD(w, id)).filter((d): d is Disciple => !!d)
          : w.disciples.filter((d) => d.status === 'normal' || d.status === 'dying')
        finishCombat(w, rng, spec, team)
      }
    },
  }
}

export function finishCombat(w: WorldState, rng: RNG, spec: CombatSpec, team: Disciple[]): void {
  if (team.length === 0) {
    // 无人应战 = 直接败北
    log(w, 'combat', `无人可战，${spec.enemyName}长驱直入！`)
    if (spec.onLoseEvent) makeApi(w, rng).sched(spec.onLoseEvent, 1, 3)
    return
  }
  const outcome = resolveCombat(w, spec, team, rng)
  const api = makeApi(w, rng)
  if (outcome.win && spec.onWinEvent) api.sched(spec.onWinEvent, 1, 5)
  if (!outcome.win && spec.onLoseEvent) api.sched(spec.onLoseEvent, 1, 5)
}

// ── 触发与执行 ──
function eligible(w: WorldState, def: EventDef): boolean {
  if (def.category === 'chain') return false // 链事件只能被调度
  if (def.once && w.flags['done:' + def.id]) return false
  if ((w.cooldowns[def.id] ?? 0) > w.day) return false
  if (def.trigger && !def.trigger(w)) return false
  return true
}

export function fireEvent(w: WorldState, rng: RNG, def: EventDef, presetCast?: Record<string, string>): boolean {
  // 选角：优先用预置（事件链传递的演员），失效则重新选角
  let cast: Record<string, Disciple> | null = {}
  if (presetCast && Object.keys(presetCast).length > 0) {
    for (const [slot, id] of Object.entries(presetCast)) {
      const d = getD(w, id)
      if (!d) {
        cast = null
        break
      }
      cast[slot] = d
    }
  }
  if (cast && def.cast && Object.keys(cast).length < def.cast.length) {
    cast = resolveCast(w, rng, def)
  }
  if (!cast) return false

  if (def.once) w.flags['done:' + def.id] = true
  if (def.cooldownYears) w.cooldowns[def.id] = w.day + def.cooldownYears * DAYS_PER_YEAR

  const api = makeApi(w, rng)
  const ctx: EventCtx = { w, rng, cast, api }

  if (!def.options || def.options.length === 0) {
    // 纯通告
    log(w, 'event', def.text(ctx))
    def.auto?.(ctx)
    return true
  }
  // 个人抉择事件：角色 AI 自主抉择，不入玩家队列（docs/09 §3.4）
  if (def.personal) {
    resolvePersonalDecision(w, rng, def, ctx)
    return true
  }
  // 交互事件：按等级分流——≥拦截级别 → 弹窗打断队列；低于 → 收件箱异步处理（docs/04 §事件分流）
  const level = eventLevel(def)
  const scope = eventScope(def)
  const intercept = def.pause === true || level >= w.sect.rules.interceptLevel
  const item: Interactive = {
    uid: ++w.uidCounter,
    kind: 'event',
    title: def.title,
    text: def.text(ctx),
    castIds: Object.values(cast).map((d) => d.id),
    options: def.options.map((o, idx) => {
      const en = o.enabled?.(ctx)
      return {
        idx,
        text: typeof o.text === 'function' ? o.text(ctx) : o.text,
        disabled: en === undefined || en === true ? undefined : en,
        ai: o.ai,
      }
    }),
    eventId: def.id,
    cast: Object.fromEntries(Object.entries(cast).map(([k, v]) => [k, v.id])),
    pause: intercept,
    level,
    scope,
    defaultOption: def.defaultOption ?? def.options.length - 1,
    createdDay: w.day,
  }
  if (intercept) {
    w.queue.push(item)
  } else {
    item.expiryDay = w.day + INBOX_WINDOW_DAYS
    w.inbox.push(item)
  }
  return true
}

/** 收件箱过期处理：到期项按默认（最保守）选项自动放弃（docs/04 §事件分流） */
export function expireInbox(w: WorldState, rng: RNG): void {
  const due = w.inbox.filter((it) => (it.expiryDay ?? Infinity) <= w.day)
  if (due.length === 0) return
  w.inbox = w.inbox.filter((it) => (it.expiryDay ?? Infinity) > w.day)
  for (const it of due) {
    if (it.eventId && it.cast) {
      const opt = it.defaultOption ?? it.options.length - 1
      resolveEventChoice(w, rng, it.eventId, it.cast, opt)
    }
  }
}

/** 个人抉择：角色 AI 在可用选项中自主选择，应用效果并记一条经历（docs/09 §3.4, §6） */
export function resolvePersonalDecision(w: WorldState, rng: RNG, def: EventDef, ctx: EventCtx): void {
  const self = ctx.cast[def.personal!]
  if (!self || !def.options) return
  const usable = def.options
    .map((o, idx) => ({ o, idx }))
    .filter(({ o }) => {
      const en = o.enabled?.(ctx)
      return en === undefined || en === true
    })
  if (usable.length === 0) return
  const aiOptions = usable.map(({ o, idx }) => ({
    option: idx,
    considerations: o.appeal ? o.appeal() : [{ name: '随性', input: () => o.ai ?? 1, curve: (x: number) => Math.min(1, x / 10), weight: 1 }],
  }))
  const { option: chosenIdx, appraisal } = chooseForCharacter(self, w, aiOptions, rng)
  if (chosenIdx === null) return
  const choice = def.options[chosenIdx]
  choice.effects(ctx)
  if (choice.memory) {
    const why = appraisal ? appraisal.terms.slice(0, 2).map((t) => t.name).join('·') : undefined
    remember(self, w.day, {
      eventId: def.id,
      text: choice.memory.text(ctx),
      kind: choice.memory.kind ?? 'turning',
      choice: typeof choice.text === 'function' ? choice.text(ctx) : choice.text,
      tags: [...(choice.memory.tags ?? []), ...(why ? ['因:' + why] : [])],
      impact: choice.memory.impact,
      causedByTag: choice.memory.causedByTag,
    })
  }
}

/** 玩家（或自动玩家）对交互事件做出选择 */
export function resolveEventChoice(w: WorldState, rng: RNG, eventId: string, castIds: Record<string, string>, optionIdx: number): void {
  const def = REGISTRY.get(eventId)
  if (!def || !def.options) return
  const cast: Record<string, Disciple> = {}
  for (const [slot, id] of Object.entries(castIds)) {
    const d = getD(w, id)
    if (d) cast[slot] = d
  }
  // 中央防护：声明了角色槽但演员已不在世（入队后阵亡/离开）→ 事件流产
  if (def.cast && def.cast.some((spec) => !cast[spec.slot])) return
  const ctx: EventCtx = { w, rng, cast, api: makeApi(w, rng) }
  const opt = def.options[optionIdx]
  if (!opt) return
  const en = opt.enabled?.(ctx)
  if (en !== undefined && en !== true) return // 不满足条件的选项静默忽略
  opt.effects(ctx)
}

/** 旬抽取（docs/04 §4）：泊松节流 + 权重 */
export function eventsXun(w: WorldState, rng: RNG): void {
  // 1) 到期的调度事件
  const due = w.scheduled.filter((s) => s.day <= w.day)
  w.scheduled = w.scheduled.filter((s) => s.day > w.day)
  for (const s of due) {
    const def = REGISTRY.get(s.eventId)
    if (def) fireEvent(w, rng, def, s.cast)
  }
  // 2) 命途/经营事件：固定密度抽取（不含风味，避免被千条风味挤占而稀释戏剧性）
  if (rng.chance(EVENT_DENSITY_PER_YEAR / 36)) {
    const pool = allEvents().filter((d) => eligible(w, d) && !d.flavor)
    if (pool.length > 0) {
      const def = rng.weighted(pool, (d) => {
        const base = typeof d.weight === 'function' ? d.weight(w) : (d.weight ?? 10)
        return base * levelRarity(eventLevel(d))
      })
      if (def) fireEvent(w, rng, def)
    }
  }
  // 3) 风味事件：独立预算，只织事件流纹理、不动心相轴
  if (rng.chance(FLAVOR_DENSITY_PER_YEAR / 36)) {
    const fpool = allEvents().filter((d) => eligible(w, d) && d.flavor)
    if (fpool.length > 0) {
      const def = rng.weighted(fpool, (d) => (typeof d.weight === 'function' ? d.weight(w) : (d.weight ?? 3)))
      if (def) fireEvent(w, rng, def)
    }
  }
}
