// 心相系统（docs/09 §3.2）：五轴的派生初值、漂移、写入。区别于会回弹的 mood——心相是长期自我。
// 注意：本模块不 import helpers，以免 helpers→biography→psyche 形成循环。
import type { Beliefs, BeliefKey, Disciple, WorldState } from '@/shared/types'
import { GONGFA_MAP } from '../content/gongfa'

const hasTrait = (d: Disciple, id: string): boolean => d.traits.includes(id)

export const BELIEF_KEYS: BeliefKey[] = ['daoxin', 'xinmo', 'molean', 'loyalty', 'fame']
export const BELIEF_NAMES: Record<BeliefKey, string> = {
  daoxin: '道心',
  xinmo: '心魔',
  molean: '魔倾',
  loyalty: '忠诚',
  fame: '声名',
}

export function emptyBeliefs(): Beliefs {
  return { daoxin: 40, xinmo: 0, molean: 0, loyalty: 50, fame: 0 }
}

/** 由资质/心性/特质派生初值（docs/09 §3.2） */
export function deriveBeliefs(d: Disciple): Beliefs {
  const b = emptyBeliefs()
  // 心性高→道心底子厚；资质高→声名起点略高
  b.daoxin = clampB(30 + d.mindstate * 4 + d.aptitude * 2)
  b.fame = clampB(d.aptitude * 3)
  b.loyalty = clampB(45 + d.mindstate * 2)
  if (hasTrait(d, 'ruthless') || hasTrait(d, 'sinister')) b.molean = clampB(b.molean + 15)
  if (hasTrait(d, 'merciful') || hasTrait(d, 'chivalrous')) b.daoxin = clampB(b.daoxin + 10)
  if (hasTrait(d, 'ambitious')) b.loyalty = clampB(b.loyalty - 15)
  if (hasTrait(d, 'loyal')) b.loyalty = clampB(b.loyalty + 25)
  if (hasTrait(d, 'cursed')) b.xinmo = clampB(b.xinmo + 10)
  return b
}

export function clampB(v: number): number {
  return v < 0 ? 0 : v > 100 ? 100 : v
}

/** 写入一条心相轴（带特质调制；心魔只升难降的特性在此体现） */
export function addBelief(d: Disciple, key: BeliefKey, delta: number): void {
  let dd = delta
  // 道心高→心魔增长被抑制；魔倾高→心魔增长被放大
  if (key === 'xinmo' && dd > 0) {
    dd *= 1 - d.beliefs.daoxin / 300 + d.beliefs.molean / 300
    if (hasTrait(d, 'resolute')) dd *= 0.6
  }
  // 心魔自然消减很慢（只升难降）：负向 delta 打折
  if (key === 'xinmo' && dd < 0) dd *= 0.7
  d.beliefs[key] = clampB(d.beliefs[key] + dd)
}

export function setBeliefsToward(d: Disciple, key: BeliefKey, target: number, strength = 1): void {
  d.beliefs[key] = clampB(d.beliefs[key] + (target - d.beliefs[key]) * strength)
}

/** 月度漂移：向"性格基线"缓慢回归，受设施（静室/戒律堂）与心性调制（docs/09 §3.2） */
export function psycheMonthly(w: WorldState): void {
  const quietLv = w.sect.facilities['quiet'] ?? 0
  const lawLv = w.sect.facilities['law'] ?? 0
  for (const d of w.disciples) {
    const b = d.beliefs
    // 道心向 (心性×6+30) 回归
    const daoxinBase = 30 + d.mindstate * 6
    b.daoxin = clampB(b.daoxin + (daoxinBase - b.daoxin) * 0.02 * (1 + d.mindstate / 20))
    // 心魔"只升难降"：基础消退极慢，静室能加速；高心性者更能自渡
    if (b.xinmo > 0) b.xinmo = clampB(b.xinmo - (0.08 + quietLv * 0.18 + (d.mindstate >= 8 ? 0.1 : 0)))
    // 忠诚向 50 回归，戒律堂加速回稳
    b.loyalty = clampB(b.loyalty + (50 - b.loyalty) * (0.01 + lawLv * 0.01))
    // 功法即心性：修魔功者魔倾日深（自我强化的堕落路径），否则魔倾极缓回归
    const gf = d.gongfa ? GONGFA_MAP.get(d.gongfa) : null
    if (gf?.tags?.includes('demonic')) b.molean = clampB(b.molean + 0.15)
    else if (gf?.tags?.includes('heal')) b.daoxin = clampB(b.daoxin + 0.05)
    if (!gf?.tags?.includes('demonic') && b.molean > 0) b.molean = clampB(b.molean - 0.06)
    // 声名随境界缓慢自然增长、随时间缓退
    b.fame = clampB(b.fame + d.realm * 0.05 - 0.1)
  }
}

// ── 模糊档位（docs/09 §5）：玩家只见档位，不见数字 ──
export function daoxinTier(v: number): string {
  if (v >= 75) return '道心通明'
  if (v >= 55) return '道心坚定'
  if (v >= 35) return '道心平稳'
  if (v >= 18) return '道心动摇'
  return '道心蒙尘'
}
export function xinmoTier(v: number): string {
  if (v >= 75) return '心魔缠身'
  if (v >= 50) return '心结深重'
  if (v >= 25) return '似有心结'
  if (v >= 8) return '微有郁结'
  return '心境澄澈'
}
export function moleanTier(v: number): string {
  if (v >= 60) return '魔气森然'
  if (v >= 35) return '暗藏戾气'
  if (v >= 15) return '微沾邪念'
  return '心术端正'
}
export function loyaltyTier(v: number): string {
  if (v >= 70) return '忠心耿耿'
  if (v >= 45) return '安守本分'
  if (v >= 25) return '心思浮动'
  return '离心离德'
}
export function fameTier(v: number): string {
  if (v >= 70) return '名动一方'
  if (v >= 45) return '小有名气'
  if (v >= 20) return '初露头角'
  return '默默无闻'
}
export function beliefTier(key: BeliefKey, v: number): string {
  switch (key) {
    case 'daoxin': return daoxinTier(v)
    case 'xinmo': return xinmoTier(v)
    case 'molean': return moleanTier(v)
    case 'loyalty': return loyaltyTier(v)
    case 'fame': return fameTier(v)
  }
}
