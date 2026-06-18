// 师徒传承（docs/09 §7）：师尊的心相与特质沿师承树向下漂移徒弟，几代传下长出"门风"。
import type { Disciple, WorldState } from '@/shared/types'
import { BELIEF_KEYS, clampB } from './psyche'
import { getD, log, setRel } from './helpers'
import { remember } from './biography'
import { TRAIT_MAP } from '../content/traits'
import type { RNG } from '../core/rng'

export function masterOf(w: WorldState, d: Disciple): Disciple | undefined {
  return d.masterId ? getD(w, d.masterId) : undefined
}
export function disciplesOf(w: WorldState, masterId: string): Disciple[] {
  return w.disciples.filter((d) => d.masterId === masterId)
}

/** 拜师：建立师承边 + 关系边（docs/09 §7） */
export function bind(w: WorldState, master: Disciple, student: Disciple, tier: 'zhuan' | 'jiming' = 'jiming'): void {
  student.masterId = master.id
  student.lineageTier = tier
  if (master.peakId) student.peakId = master.peakId // 入师尊的峰
  setRel(w, master.id, student.id, 'master', 35)
  remember(student, w.day, {
    eventId: 'bind', text: `${student.name}拜${master.name}为师，列${tier === 'zhuan' ? '嫡传' : '记名'}弟子。`,
    kind: 'minor', tags: ['拜师'], impact: { loyalty: 8 },
  })
}

/** 月度传承漂移：徒弟心相缓慢趋近师尊（耳濡目染），并有小概率习得师尊特质 */
export function lineageMonthly(w: WorldState, rng: RNG): void {
  for (const d of w.disciples) {
    const m = masterOf(w, d)
    if (!m) continue
    // 心相趋近（强度受师徒关系正向程度调制）
    const strength = 0.012
    for (const k of BELIEF_KEYS) {
      d.beliefs[k] = clampB(d.beliefs[k] + (m.beliefs[k] - d.beliefs[k]) * strength)
    }
    // 小概率习得师尊的一个可见特质（门风传递）
    if (rng.chance(0.004)) {
      const candidates = m.traits.filter((t) => !d.traits.includes(t) && TRAIT_MAP.get(t) && !TRAIT_MAP.get(t)!.hidden)
      if (candidates.length) {
        const t = rng.pick(candidates)
        const opp = TRAIT_MAP.get(t)!.opposite
        if (!opp || !d.traits.includes(opp)) {
          if (opp) d.traits = d.traits.filter((x) => x !== opp)
          d.traits.push(t)
          log(w, 'social', `${d.name}承师尊${m.name}衣钵，渐显${TRAIT_MAP.get(t)!.name}之风。`)
        }
      }
    }
  }
}

/** 门风：一个群体的平均魔倾，用于描述峰/师门的气质 */
export function avgMolean(ds: Disciple[]): number {
  if (ds.length === 0) return 0
  return ds.reduce((s, d) => s + d.beliefs.molean, 0) / ds.length
}
