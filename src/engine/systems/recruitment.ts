// 招收体系（docs/03 §3）：开山大会主渠道（事件渠道在 content/events 中）
import type { Disciple, WorldState } from '@/shared/types'
import { RECRUIT_BASE_CANDIDATES, RECRUIT_REP_BONUS } from '../content/constants'
import { sectCapacity } from '../content/facilities'
import { DAYS_PER_YEAR } from '../core/clock'
import type { RNG } from '../core/rng'
import { generateDisciple } from '../state/disciple'
import { chronicle, log } from './helpers'

export function recruitmentMonthly(w: WorldState, rng: RNG): void {
  if (w.day < w.nextRecruitDay) return
  if (w.queue.some((q) => q.kind === 'recruit')) return
  w.nextRecruitDay = w.day + w.sect.rules.recruitYears * DAYS_PER_YEAR

  const n = Math.min(
    36,
    RECRUIT_BASE_CANDIDATES + Math.floor(w.sect.reputation * RECRUIT_REP_BONUS) + rng.int(-2, 2),
  )
  const candidates: Disciple[] = []
  for (let i = 0; i < n; i++) candidates.push(generateDisciple(rng, w, {}))

  const capacity = sectCapacity(w) - w.disciples.length
  w.queue.push({
    uid: ++w.uidCounter,
    kind: 'recruit',
    title: '开山收徒大会',
    text: `山门大开，${n} 名少年慕名而来。测灵台前人头攒动——洞府尚余 ${Math.max(0, capacity)} 个名额。`,
    castIds: [],
    options: [
      { idx: 0, text: '录取所选之人' },
      { idx: 1, text: '本届一个不收' },
    ],
    payload: { candidates },
    pause: true,
  })
}

export function admitCandidates(w: WorldState, candidates: Disciple[], selectedIds: string[]): void {
  const capacity = sectCapacity(w) - w.disciples.length
  const picked = candidates.filter((c) => selectedIds.includes(c.id)).slice(0, Math.max(0, capacity))
  for (const c of picked) {
    c.joinDay = w.day
    c.gongfa = c.gongfa ?? 'tunaqi'
    w.disciples.push(c)
    w.stats.recruitsTotal++
  }
  if (picked.length > 0) {
    log(w, 'system', `开山大会收徒 ${picked.length} 人入外门。`)
    const best = [...picked].sort((a, b) => b.shownAptitude - a.shownAptitude)[0]
    if (best.shownAptitude >= 4) {
      chronicle(w, 'recruit', `开山大会上，${best.name}测出天品之资，宗门上下视若珍宝。`)
      w.sect.reputation += 10
    }
  } else {
    log(w, 'system', '本届开山大会未录一人。')
  }
}
