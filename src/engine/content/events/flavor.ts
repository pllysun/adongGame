// 风味事件工厂：用极简种子（标题 + 文案变体 + 紧凑效果码）批量生成 EventDef。
// 目的：抗重复地"堆量"——几百条风味事件让事件流不再翻来覆去那几句，且每条都是真正独立的 EventDef。
// 效果码语法（空格分隔）：
//   m5 / m-8         心境 ±
//   d2 x3 o2 l2 f2   心相轴：道心/心魔/魔倾/忠诚/声名 ±
//   s30 h10 c10 t20 r5   宗门：灵石/灵草/灵米/材料/声望 ±（减时自动夹 0）
//   q  / q2          气运 +1 / +n
//   ~6 / ~-8         （pair）两人关系 ±
//   R                在角色经历里留痕（remember，自动把心相 impact 写入）
import type { EventDef, EventCtx } from '../../systems/events'
import type { Disciple, WorldState } from '@/shared/types'
import { addMood, setRel } from '../../systems/helpers'
import { remember } from '../../systems/biography'

export type FlavorMode = 'amb' | 'solo' | 'pair'
export interface FlavorSeed {
  t: string // 标题
  v: string[] // 文案变体，占位 {d}/{a}/{b} 在 fire 时替换成弟子名
  e?: string // 效果码
  m?: FlavorMode // 选角模式，默认 solo
  cat?: 'opportunity' | 'personnel' | 'crisis' // 默认 opportunity
  w?: number // 权重，默认 3
  cd?: number // 冷却年，默认 2
  trig?: (w: WorldState) => boolean
}

type BKey = 'daoxin' | 'xinmo' | 'molean' | 'loyalty' | 'fame'
const SKEYS = ['stones', 'herbs', 'rice', 'materials', 'reputation', 'qiyun'] as const
type SKey = (typeof SKEYS)[number]
const BCHAR: Record<string, BKey> = { d: 'daoxin', x: 'xinmo', o: 'molean', l: 'loyalty', f: 'fame' }
const SCHAR: Record<string, SKey> = { s: 'stones', h: 'herbs', c: 'rice', t: 'materials', r: 'reputation', q: 'qiyun' }

interface ParsedEff {
  mood: number
  beliefs: Partial<Record<BKey, number>>
  sect: Partial<Record<SKey, number>>
  rel: number
  remember: boolean
}

function parseEff(code?: string): ParsedEff {
  const out: ParsedEff = { mood: 0, beliefs: {}, sect: {}, rel: 0, remember: false }
  if (!code) return out
  for (const tok of code.split(/\s+/)) {
    if (!tok) continue
    if (tok === 'R') {
      out.remember = true
      continue
    }
    const key = tok[0]
    const rest = tok.slice(1)
    const val = rest === '' ? 1 : parseInt(rest, 10)
    if (Number.isNaN(val)) continue
    if (key === 'm') out.mood += val
    else if (key === '~') out.rel += val
    else if (BCHAR[key]) out.beliefs[BCHAR[key]] = (out.beliefs[BCHAR[key]] ?? 0) + val
    else if (SCHAR[key]) out.sect[SCHAR[key]] = (out.sect[SCHAR[key]] ?? 0) + val
  }
  return out
}

function fillText(s: string, c: EventCtx): string {
  return s
    .replace(/\{d\}/g, c.cast['d']?.name ?? '一名弟子')
    .replace(/\{a\}/g, c.cast['a']?.name ?? '一名弟子')
    .replace(/\{b\}/g, c.cast['b']?.name ?? '另一名弟子')
}

function applyEff(c: EventCtx, p: ParsedEff, mode: FlavorMode, title: string, id: string, prefix: string): void {
  for (const k of SKEYS) {
    const v = p.sect[k]
    if (v) c.w.sect[k] = Math.max(0, c.w.sect[k] + v)
  }
  if (mode === 'amb') return
  const main = mode === 'pair' ? c.cast['a'] : c.cast['d']
  if (!main) return
  if (p.mood) addMood(main, p.mood)
  // 风味事件【不写心相轴】——心相由有后果的命途/危机事件决定，风味只留传记文字 + 短期心境。
  // 这避免千条风味把道心/声名冲刷饱和、抹平角色明暗分化（仿真发现的问题）。
  if (p.remember) {
    remember(main, c.w.day, { eventId: id, text: title, kind: 'minor', tags: [prefix] })
  }
  if (mode === 'pair' && c.cast['b']) {
    if (p.mood) addMood(c.cast['b'], p.mood)
    if (p.rel) setRel(c.w, c.cast['a'].id, c.cast['b'].id, p.rel >= 0 ? 'peer' : 'rival', p.rel)
  }
}

const soloCast = [{ slot: 'd', filter: (d: Disciple) => d.status === 'normal', sortBy: 'random' as const }]
const pairCast = [
  { slot: 'a', filter: (d: Disciple) => d.status === 'normal' },
  { slot: 'b', filter: (d: Disciple, _w: WorldState, ct: Record<string, Disciple>) => d !== ct['a'] && d.status === 'normal' },
]

export function makeFlavor(prefix: string, seeds: FlavorSeed[]): EventDef[] {
  return seeds.map((s, i) => {
    const id = `${prefix}_${String(i + 1).padStart(3, '0')}`
    const mode = s.m ?? 'solo'
    const p = parseEff(s.e)
    const def: EventDef = {
      id,
      category: s.cat ?? 'opportunity',
      weight: s.w ?? 3,
      cooldownYears: s.cd ?? 2,
      flavor: true, // 走独立抽签预算，不挤占命途/经营事件
      title: s.t,
      text: (c) => fillText(c.rng.pick(s.v), c),
      auto: (c) => applyEff(c, p, mode, s.t, id, prefix),
    }
    if (mode === 'solo') def.cast = soloCast
    else if (mode === 'pair') def.cast = pairCast
    if (s.trig) def.trigger = s.trig
    return def
  })
}
