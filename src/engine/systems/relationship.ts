// 关系网（docs/01 §6）：社交池内形成边，旬衰减，性格驱动涌现
import type { Disciple, WorldState } from '@/shared/types'
import { REL_DECAY_PER_XUN } from '../content/constants'
import type { RNG } from '../core/rng'
import { addMood, getRel, hasTrait, log, relsOf, setRel, traitsOf } from './helpers'

function relGainMul(d: Disciple): number {
  let m = 1
  for (const t of traitsOf(d)) m *= t.relGainMul ?? 1
  return m
}

/** 社交池：同行为（执勤/演武/交游）的人互相接触；同期入门天然弱连接 */
export function relationshipXun(w: WorldState, rng: RNG): void {
  const pools: Record<string, Disciple[]> = { work: [], train: [], social: [] }
  for (const d of w.disciples) if (pools[d.action]) pools[d.action].push(d)

  for (const pool of Object.values(pools)) {
    if (pool.length < 2) continue
    // 每池随机抽 1~2 对发生互动
    const rounds = Math.min(2, Math.floor(pool.length / 2))
    for (let i = 0; i < rounds; i++) {
      const a = rng.pick(pool)
      const b = rng.pick(pool.filter((x) => x !== a))
      if (!b) continue
      const mul = (relGainMul(a) + relGainMul(b)) / 2
      const existing = getRel(w, a.id, b.id)
      // 既有仇怨：互动可能加深矛盾
      if (existing && existing.value < -20) {
        if (rng.chance(0.3)) {
          setRel(w, a.id, b.id, 'rival', -5)
          if (rng.chance(0.15)) log(w, 'social', `${a.name}与${b.name}又起争执，同门侧目。`)
        }
        continue
      }
      // 傲慢挑衅 → 结仇苗头
      if ((hasTrait(a, 'arrogant') || hasTrait(b, 'arrogant')) && rng.chance(0.18)) {
        setRel(w, a.id, b.id, 'peer', -12)
        if (rng.chance(0.4)) log(w, 'social', `${a.name}与${b.name}言语相讥，不欢而散。`)
        continue
      }
      // 正常增进
      setRel(w, a.id, b.id, existing?.type ?? 'peer', Math.round(4 * mul))
      // 异性深交 → 倾慕检定（道侣的前置）
      const edge = getRel(w, a.id, b.id)!
      if (
        a.gender !== b.gender && edge.value >= 40 && edge.type !== 'couple' &&
        !relsOf(w, a.id).some((r) => r.type === 'couple') && !relsOf(w, b.id).some((r) => r.type === 'couple') &&
        rng.chance(0.12 * mul)
      ) {
        edge.type = 'crush'
        edge.dir = rng.chance(0.5) ? 'ab' : 'ba'
      }
      // 双向倾慕成熟 → 结为道侣（人事事件在 events 内容里出，但状态这里落地）
      if (edge.type === 'crush' && edge.value >= 70) {
        if (w.sect.rules.allowCouple) {
          edge.type = 'couple'
          addMood(a, 25)
          addMood(b, 25)
          log(w, 'social', `${a.name}与${b.name}情投意合，结为道侣，同门皆来道贺。`)
        } else if (rng.chance(0.2)) {
          // 门规禁止 → 私情压抑
          addMood(a, -10)
          addMood(b, -10)
        }
      }
    }
  }

  // 旬衰减：弱边自然消散，仇怨不衰减（记仇者的所有负边都不衰减）
  for (const r of [...w.relations]) {
    if (r.type === 'couple' || r.type === 'master') continue
    if (r.value < 0) continue
    r.value -= REL_DECAY_PER_XUN
    if (r.value <= 2 && r.type === 'peer') w.relations.splice(w.relations.indexOf(r), 1)
  }
}

/** 师徒：长老/掌门自动收资质好的新人为徒（每年检查） */
export function mentorshipYearly(w: WorldState, rng: RNG): void {
  const masters = w.disciples.filter((d) => d.realm >= 3)
  const students = w.disciples.filter(
    (d) => d.realm <= 1 && d.shownAptitude >= 2 && !relsOf(w, d.id).some((r) => r.type === 'master'),
  )
  for (const s of students) {
    const m = masters.filter((x) => relsOf(w, x.id).filter((r) => r.type === 'master').length < 3)
    if (m.length === 0) break
    const master = rng.pick(m)
    setRel(w, master.id, s.id, 'master', 30)
    log(w, 'social', `${master.name}收${s.name}为亲传弟子，倾囊相授。`)
  }
}
