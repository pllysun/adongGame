// 弟子自主行为（docs/01 §7）：旬选择，权重 = 基础 × 性格 × 需求 × 宗门规则
import type { ActionId, Disciple, WorldState } from '@/shared/types'
import type { RNG } from '../core/rng'
import { hasTag, moodTier, traitsOf } from './helpers'

const BASE_WEIGHTS: Record<ActionId, number> = {
  cultivate: 10,
  train: 3,
  work: 4,
  social: 3,
  seclude: 0,
  travel: 1,
  recover: 0,
}

export function chooseAction(w: WorldState, d: Disciple, rng: RNG): ActionId {
  if (d.status === 'injured' || d.status === 'crippled') return 'recover'
  if (d.status === 'seclusion') return 'seclude'
  if (d.status === 'demonic') return 'seclude'

  const weights: Record<ActionId, number> = { ...BASE_WEIGHTS }
  // 性格
  for (const t of traitsOf(d)) {
    if (t.actions) for (const [k, v] of Object.entries(t.actions)) weights[k as ActionId] *= v
  }
  // 需求：瓶颈 → 闭关倾向；心境差 → 交游/游历倾向
  if (d.bottleneck && d.sub === 2) weights.seclude = 20
  if (moodTier(d) <= -1) {
    weights.social *= 1.6
    weights.travel *= 1.5
    weights.cultivate *= 0.7
  }
  // 宗门规则
  if (!w.sect.rules.allowTravel) weights.travel = 0
  if (d.rank === 'core' || d.rank === 'elder' || d.rank === 'master') weights.work *= 0.2 // 高层免执勤倾向
  // 灵田劳动力需求拉动执勤
  const fieldLv = w.sect.facilities['field'] ?? 0
  const workersNeeded = fieldLv * 2
  const workersNow = w.disciples.filter((x) => x.action === 'work').length
  if (workersNow < workersNeeded) weights.work *= 2.5
  // 演武场存在才有演武价值
  if (!(w.sect.facilities['arena'] ?? 0)) weights.train *= 0.5
  // 戒律堂减少摸鱼
  if (hasTag(d, 'slack')) weights.work *= 0.5

  const entries = Object.entries(weights) as [ActionId, number][]
  const picked = rng.weighted(entries, (e) => e[1])
  return picked ? picked[0] : 'cultivate'
}

export function behaviorXun(w: WorldState, rng: RNG): void {
  for (const d of w.disciples) {
    d.action = chooseAction(w, d, rng)
    // 演武涨战斗经验
    if (d.action === 'train') {
      const arenaLv = w.sect.facilities['arena'] ?? 0
      if (rng.chance(0.3 + arenaLv * 0.06)) d.combatExp += 1
    }
  }
}
