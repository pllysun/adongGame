// 系统层共享查询与小工具
import type { Disciple, LogCat, RelEdge, RelType, WorldState } from '@/shared/types'
import { LOG_CAP, MOOD_DEMONIC, MOOD_HIGH } from '../content/constants'
import { TRAIT_MAP, type TraitDef } from '../content/traits'
import { remember } from './biography'
import { addBelief } from './psyche'

export function log(w: WorldState, cat: LogCat, text: string, rarity?: number): void {
  w.log.push({ day: w.day, cat, text, rarity: rarity as never })
  if (w.log.length > LOG_CAP) w.log.splice(0, w.log.length - LOG_CAP)
}

export function chronicle(w: WorldState, kind: string, text: string): void {
  w.chronicle.push({ day: w.day, kind, text })
}

export function getD(w: WorldState, id: string): Disciple | undefined {
  return w.disciples.find((d) => d.id === id)
}

export function traitsOf(d: Disciple): TraitDef[] {
  return d.traits.map((t) => TRAIT_MAP.get(t)).filter((t): t is TraitDef => !!t)
}
export function hasTrait(d: Disciple, id: string): boolean {
  return d.traits.includes(id)
}
export function hasTag(d: Disciple, tag: string): boolean {
  return traitsOf(d).some((t) => t.tags?.includes(tag))
}

export function effectiveLuck(d: Disciple): number {
  let l = d.luck
  for (const t of traitsOf(d)) l += t.luckShift ?? 0
  return Math.max(1, Math.min(13, l))
}

/** 心境五档：-2 心魔 / -1 郁结 / 0 烦躁 / 1 平静 / 2 圆满 */
export function moodTier(d: Disciple): -2 | -1 | 0 | 1 | 2 {
  if (d.mood <= MOOD_DEMONIC) return -2
  if (d.mood <= -20) return -1
  if (d.mood < 20) return 0
  if (d.mood < MOOD_HIGH) return 1
  return 2
}

export function addMood(d: Disciple, delta: number): void {
  let mul = 1
  for (const t of traitsOf(d)) {
    if (delta < 0 && t.moodLossMul) mul *= t.moodLossMul
    if (delta > 0 && t.moodGainMul) mul *= t.moodGainMul
  }
  d.mood = Math.max(-100, Math.min(100, d.mood + delta * mul))
}

// ── 关系 ────────────────────────────────────────────────────────────
const relKey = (a: string, b: string) => (a < b ? a + '|' + b : b + '|' + a)

export function getRel(w: WorldState, a: string, b: string, type?: RelType): RelEdge | undefined {
  const k = relKey(a, b)
  return w.relations.find((r) => relKey(r.a, r.b) === k && (!type || r.type === type))
}

export function relsOf(w: WorldState, id: string): RelEdge[] {
  return w.relations.filter((r) => r.a === id || r.b === id)
}

export function setRel(w: WorldState, a: string, b: string, type: RelType, delta: number): RelEdge {
  let edge = getRel(w, a, b)
  if (!edge) {
    edge = { a, b, type, value: 0, since: w.day }
    w.relations.push(edge)
    // 每人关系边上限：挤掉最弱的弱边
    for (const id of [a, b]) {
      const mine = relsOf(w, id)
      if (mine.length > 12) {
        mine.sort((x, y) => Math.abs(x.value) - Math.abs(y.value))
        const weakest = mine[0]
        if (weakest !== edge) w.relations.splice(w.relations.indexOf(weakest), 1)
      }
    }
  }
  edge.value = Math.max(-100, Math.min(100, edge.value + delta))
  // 关系类型升级/恶化
  if (edge.value <= -40 && edge.type !== 'rival') edge.type = 'rival'
  else if (edge.value >= 60 && edge.type === 'peer') edge.type = 'friend'
  else if (type === 'couple' || type === 'master' || type === 'crush') edge.type = type
  return edge
}

export function removeDisciple(w: WorldState, d: Disciple, cause: string): void {
  w.disciples.splice(w.disciples.indexOf(d), 1)
  w.departed.push({ id: d.id, name: d.name, cause, day: w.day, realm: d.realm, aptitude: d.aptitude })
  w.relations = w.relations.filter((r) => r.a !== d.id && r.b !== d.id)
  // 法宝遗物回收
  if (d.artifact) w.sect.artifacts.push(d.artifact)
}

/** 亡故涟漪：关系网中的人按关系强度损失心境，并永久写入心魔 + 记一条经历（docs/01 §8 / docs/09）。 */
export function deathRipple(w: WorldState, dead: Disciple): void {
  for (const r of relsOf(w, dead.id)) {
    const otherId = r.a === dead.id ? r.b : r.a
    const other = getD(w, otherId)
    if (!other) continue
    if (r.value > 0) {
      const loss = -Math.round(r.value * 0.4) - (r.type === 'couple' ? 25 : r.type === 'master' ? 10 : 0)
      addMood(other, loss)
      // 创伤永久写入心魔：关系越深、伤越重（命途黑化的源头）
      const trauma = Math.round((r.value / 100) * (r.type === 'couple' ? 45 : r.type === 'master' ? 25 : r.type === 'friend' ? 20 : 8))
      if (trauma >= 6) {
        const tag = r.type === 'couple' ? '丧侣' : r.type === 'master' ? '丧师' : '丧友'
        remember(other, w.day, {
          eventId: 'death_ripple',
          text: `${dead.name}的离世，在${other.name}心上留下一道难愈的伤。`,
          kind: trauma >= 25 ? 'turning' : 'minor',
          tags: [tag],
          impact: { xinmo: trauma, daoxin: -Math.round(trauma / 3) },
        })
      }
      if (r.type === 'couple' && hasTag(other, 'griefDemon')) {
        other.mood = Math.min(other.mood, -65)
        addBelief(other, 'xinmo', 30)
      }
    } else if (r.value < -30) {
      addMood(other, 10) // 仇人死了，快意
    }
  }
}

export function alive(w: WorldState): Disciple[] {
  return w.disciples
}

export function powerSort(ds: Disciple[]): Disciple[] {
  return [...ds].sort((x, y) => y.realm * 10 + y.sub - (x.realm * 10 + x.sub))
}
