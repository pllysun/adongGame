// 修为日结算（docs/02 §2）：日增修为 = 基数 × 灵根 × 功法 × 设施 × 行为 × 状态
import type { Disciple, WorldState } from '@/shared/types'
import { COUPLE_CULT_BONUS, cultGainBase, cultNeed, HERITAGE_PER_REALM } from '../content/constants'
import { GONGFA_MAP, elementFit } from '../content/gongfa'
import { arrayMultiplier } from '../content/facilities'
import { moodTier, relsOf, traitsOf } from './helpers'

const ACTION_FACTOR: Record<string, number> = {
  cultivate: 1.0,
  seclude: 1.6,
  train: 0.3,
  work: 0.2,
  social: 0.3,
  travel: 0.6,
  recover: 0.1,
}

export function dailyGain(w: WorldState, d: Disciple): number {
  if (d.realm <= 0 || d.status === 'demonic') return 0
  const gf = d.gongfa ? GONGFA_MAP.get(d.gongfa) : undefined
  const gongfaFactor = gf ? gf.speedBase * elementFit(d.roots.elements, gf) : 0.5
  // 功法境界上限：超限后修炼效率骤降（逼玩家换功法）
  const capPenalty = gf && d.realm > gf.realmCap ? 0.15 : 1
  const rootFactor = 0.5 + d.roots.purity * 0.1
  const facility = arrayMultiplier(w) * (d.rank === 'core' || d.rank === 'elder' || d.rank === 'master' ? 1.1 : 1)
  const action = ACTION_FACTOR[d.action] ?? 1
  const tier = moodTier(d)
  const statusFactor =
    d.status === 'injured' ? 0.5 : d.status === 'crippled' ? 0.3 : tier === -1 ? 0.75 : tier === 0 ? 0.9 : 1
  let traitFactor = 1
  for (const t of traitsOf(d)) traitFactor += t.cultSpeed ?? 0
  // 道侣双修
  const hasCouple = relsOf(w, d.id).some((r) => r.type === 'couple')
  const coupleFactor = hasCouple ? 1 + COUPLE_CULT_BONUS : 1

  return cultGainBase(d.realm) * rootFactor * gongfaFactor * capPenalty * facility * action * statusFactor * traitFactor * coupleFactor
}

/** 日 tick：涨修为，满则进入瓶颈（小层自动尝试在 breakthrough 系统处理） */
export function cultivationDaily(w: WorldState): void {
  // 宗门底蕴：镇宗最高境界惠及全宗（本人除外不必特判，对自己同样是激励）
  let maxRealm = 0
  for (const d of w.disciples) if (d.realm > maxRealm) maxRealm = d.realm
  const heritage = 1 + maxRealm * HERITAGE_PER_REALM
  for (const d of w.disciples) {
    if (d.bottleneck) continue
    const need = cultNeed(d.realm, d.sub)
    d.cultivation += dailyGain(w, d) * heritage
    if (d.cultivation >= need) {
      d.cultivation = need
      d.bottleneck = true
    }
  }
}
