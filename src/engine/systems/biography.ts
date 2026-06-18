// 经历树（docs/09 §3.1, §6）：记忆记录、因果链、凝练。记忆既是 UI 数据，也是未来逻辑的可查询底座。
import type { Beliefs, Disciple, Memory } from '@/shared/types'
import { addBelief } from './psyche'
import { TRAIT_MAP } from '../content/traits'

const MEMORY_SOFT_CAP = 40 // 超过则凝练（docs/09 §13）

export interface RecordOpts {
  eventId: string
  text: string
  kind?: 'turning' | 'minor'
  choice?: string
  tags?: string[]
  impact?: Partial<Beliefs> & { traitGained?: string; traitLost?: string }
  causedByTag?: string // 因果：链到此弟子最近一条带该标签的记忆
}

/** 记一条记忆，并把 impact 真正写入心相轴 / 增删特质。这是"事件留下持久痕迹"的统一入口。 */
export function remember(d: Disciple, day: number, opts: RecordOpts): Memory {
  const impact: Memory['impact'] = { ...(opts.impact ?? {}) }
  // 写心相轴
  for (const k of ['daoxin', 'xinmo', 'molean', 'loyalty', 'fame'] as (keyof Beliefs)[]) {
    const v = impact[k]
    if (typeof v === 'number' && v !== 0) addBelief(d, k, v)
  }
  // 增删特质（动态特质 = 经历树质变节点）
  if (impact.traitGained && TRAIT_MAP.has(impact.traitGained) && !d.traits.includes(impact.traitGained)) {
    // 互斥处理：若已有对立特质则替换
    const opp = TRAIT_MAP.get(impact.traitGained)!.opposite
    if (opp) d.traits = d.traits.filter((t) => t !== opp)
    d.traits.push(impact.traitGained)
  }
  if (impact.traitLost) d.traits = d.traits.filter((t) => t !== impact.traitLost)

  const mem: Memory = {
    day,
    eventId: opts.eventId,
    kind: opts.kind ?? 'minor',
    text: opts.text,
    choice: opts.choice,
    impact,
    tags: opts.tags ?? [],
    causedBy: opts.causedByTag ? findRecentByTag(d, opts.causedByTag)?.day : undefined,
  }
  d.memories.push(mem)
  if (d.memories.length > MEMORY_SOFT_CAP) condense(d)
  return mem
}

export function findRecentByTag(d: Disciple, tag: string): Memory | undefined {
  for (let i = d.memories.length - 1; i >= 0; i--) if (d.memories[i].tags.includes(tag)) return d.memories[i]
  return undefined
}
export function hasMemoryTag(d: Disciple, tag: string): boolean {
  return d.memories.some((m) => m.tags.includes(tag))
}
export function countMemoryTag(d: Disciple, tag: string): number {
  return d.memories.reduce((n, m) => n + (m.tags.includes(tag) ? 1 : 0), 0)
}

/** 凝练（docs/09 §13）：保留全部转折点，把最老的一批琐事合并成一条摘要，控制规模。 */
export function condense(d: Disciple): void {
  const minors = d.memories.filter((m) => m.kind === 'minor')
  if (minors.length <= 12) return
  const drop = minors.slice(0, minors.length - 12) // 留最近 12 条琐事
  const dropSet = new Set(drop)
  const fromDay = drop[0].day
  const toDay = drop[drop.length - 1].day
  d.memories = d.memories.filter((m) => !dropSet.has(m))
  // 插一条摘要（不再带 impact，纯叙事）
  const summary: Memory = {
    day: fromDay,
    eventId: 'condensed',
    kind: 'minor',
    text: `（${Math.round(fromDay / 360) + 1}—${Math.round(toDay / 360) + 1}年间的${drop.length}桩寻常往事）`,
    impact: {},
    tags: ['condensed'],
  }
  d.memories.push(summary)
  d.memories.sort((a, b) => a.day - b.day)
}

/** 回溯一条记忆的因果链（经历树"为什么"）。 */
export function traceCause(d: Disciple, mem: Memory): Memory[] {
  const chain: Memory[] = [mem]
  let cur = mem
  let guard = 0
  while (cur.causedBy !== undefined && guard++ < 20) {
    const parent = d.memories.find((m) => m.day === cur.causedBy && m !== cur)
    if (!parent) break
    chain.unshift(parent)
    cur = parent
  }
  return chain
}
