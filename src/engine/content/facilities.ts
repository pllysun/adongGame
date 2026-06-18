// 设施库（docs/03 §2）：每座设施明确回答"它改哪个数字"。等级 1-7 对应七阶颜色。
import type { WorldState } from '@/shared/types'

export interface FacilityDef {
  id: string
  name: string
  desc: string
  maxLevel: number
  /** 升到 level 的造价 */
  cost: (level: number) => { stones: number; materials: number }
  /** 等级需求：宗门需有该境界弟子坐镇 */
  realmReq?: (level: number) => number
  effectDesc: (level: number) => string
}

const exp = (base: number, level: number, mul = 2.2) => Math.round(base * Math.pow(mul, level - 1))

export const FACILITIES: FacilityDef[] = [
  {
    id: 'array', name: '聚灵阵', desc: '全宗修炼速度的核心升级轴',
    maxLevel: 7,
    cost: (l) => ({ stones: exp(120, l), materials: exp(20, l) }),
    realmReq: (l) => Math.max(1, l - 2),
    effectDesc: (l) => `全宗修炼速度 +${l * 15}%（受灵脉品质上限约束）`,
  },
  {
    id: 'caves', name: '洞府群', desc: '弟子容量硬上限',
    maxLevel: 7,
    cost: (l) => ({ stones: exp(80, l), materials: exp(30, l) }),
    effectDesc: (l) => `弟子容量 ${cavesCapacityAt(l)} 人；4 级起真传享灵穴洞府（突破 +5%）`,
  },
  {
    id: 'library', name: '藏经阁', desc: '功法收藏品阶上限',
    maxLevel: 7,
    cost: (l) => ({ stones: exp(100, l), materials: exp(15, l) }),
    effectDesc: (l) => `可收藏 ${l - 1} 阶（含）以下功法`,
  },
  {
    id: 'field', name: '灵田', desc: '灵米与灵草的经济基本盘',
    maxLevel: 7,
    cost: (l) => ({ stones: exp(60, l), materials: exp(10, l) }),
    effectDesc: (l) => `月产灵米 ${l * 30}、灵草 ${l * 4}（需 ${l * 2} 人执勤）`,
  },
  {
    id: 'alchemy', name: '炼丹房', desc: '丹药产线',
    maxLevel: 7,
    cost: (l) => ({ stones: exp(150, l), materials: exp(25, l) }),
    realmReq: (l) => Math.max(1, l - 1),
    effectDesc: (l) => `可炼制 ${l - 1} 阶（含）以下丹药`,
  },
  {
    id: 'arena', name: '演武场', desc: '战斗经验与切磋之地',
    maxLevel: 5,
    cost: (l) => ({ stones: exp(70, l), materials: exp(20, l) }),
    effectDesc: (l) => `演武战斗经验 +${l * 20}%`,
  },
  {
    id: 'wall', name: '护山大阵', desc: '危机时刻的保险',
    maxLevel: 7,
    cost: (l) => ({ stones: exp(200, l), materials: exp(40, l) }),
    effectDesc: (l) => `防御战全队战力 +${Math.round(l * 18)}%`,
  },
  {
    id: 'quiet', name: '静室', desc: '心境疗养之所',
    maxLevel: 5,
    cost: (l) => ({ stones: exp(90, l), materials: exp(15, l) }),
    effectDesc: (l) => `全宗心境回复速度 +${l * 25}%`,
  },
  {
    id: 'law', name: '戒律堂', desc: '门规与秩序',
    maxLevel: 5,
    cost: (l) => ({ stones: exp(110, l), materials: exp(20, l) }),
    effectDesc: (l) => `叛逃/偷窃检定难度 +${l * 20}%`,
  },
  {
    id: 'forge', name: '炼器坊', desc: '法宝锻造（后期）',
    maxLevel: 7,
    cost: (l) => ({ stones: exp(180, l), materials: exp(60, l) }),
    realmReq: (l) => Math.max(2, l - 1),
    effectDesc: (l) => `可锻造 ${l - 1} 阶（含）以下法宝`,
  },
]

export const FACILITY_MAP = new Map(FACILITIES.map((f) => [f.id, f]))

export function cavesCapacityAt(level: number): number {
  return 6 + level * 8
}
export function sectCapacity(w: WorldState): number {
  return cavesCapacityAt(w.sect.facilities['caves'] ?? 0)
}
/** 聚灵阵全局倍率：等级×15%，受灵脉品质封顶（品质×2 级有效） */
export function arrayMultiplier(w: WorldState): number {
  const lv = Math.min(w.sect.facilities['array'] ?? 0, w.sect.siteQuality * 2)
  return 1 + lv * 0.15
}
