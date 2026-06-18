// 功法库（docs/02 §6）：主修一部，决定修炼速度与战力主成分
import type { Element, Rarity, Realm } from '@/shared/types'

export interface GongFaDef {
  id: string
  name: string
  rarity: Rarity
  elements: Element[] // 空数组 = 无属性（人人可修，无匹配加成）
  speedBase: number // 修炼速度乘数
  realmCap: Realm // 功法支撑的境界上限
  combatMod: number // 战力乘数增量
  tags?: ('demonic' | 'sword' | 'defense' | 'heal')[]
}

const G = (
  id: string, name: string, rarity: Rarity, elements: Element[], speedBase: number,
  realmCap: Realm, combatMod: number, tags?: GongFaDef['tags'],
): GongFaDef => ({ id, name, rarity, elements, speedBase, realmCap, combatMod, tags })

// speedBase 基准：凡阶 0.8 → 仙阶 3.2；realmCap：凡阶金丹 → 仙阶渡劫
export const GONGFA: GongFaDef[] = [
  // 凡阶（6）
  G('tunaqi', '《吐纳气诀》', 0, [], 0.8, 2, 0),
  G('yangshen', '《养身功》', 0, [], 0.78, 2, 0.05, ['defense']),
  G('qingfeng', '《清风诀》', 0, ['wood'], 0.85, 2, 0),
  G('zhuoyan', '《灼岩功》', 0, ['fire'], 0.85, 2, 0.05),
  G('hanquan', '《寒泉心法》', 0, ['water'], 0.85, 2, 0),
  G('tiebi', '《铁壁功》', 0, ['earth', 'metal'], 0.8, 2, 0.1, ['defense']),
  // 黄阶（8）
  G('qingmu', '《青木长生诀》', 1, ['wood'], 1.05, 3, 0.05, ['heal']),
  G('liehuo', '《烈火燎原功》', 1, ['fire'], 1.1, 3, 0.15),
  G('liushui', '《流水无意诀》', 1, ['water'], 1.05, 3, 0.1),
  G('jinrui', '《金锐诀》', 1, ['metal'], 1.05, 3, 0.2, ['sword']),
  G('houtu', '《厚土无疆功》', 1, ['earth'], 1.0, 3, 0.15, ['defense']),
  G('yinfeng', '《阴风噬骨功》', 1, ['wood', 'water'], 1.15, 3, 0.15, ['demonic']),
  G('chunyang', '《纯阳童子功》', 1, ['fire', 'metal'], 1.1, 3, 0.1),
  G('wuxing1', '《五行归元诀》', 1, [], 1.0, 3, 0.1),
  // 玄阶（8）
  G('qingping', '《青萍剑诀》', 2, ['metal', 'wood'], 1.35, 4, 0.35, ['sword']),
  G('zixia', '《紫霞神功》', 2, [], 1.3, 4, 0.2),
  G('kanli', '《坎离既济功》', 2, ['water', 'fire'], 1.4, 4, 0.2),
  G('fenglei', '《风雷激荡诀》', 2, ['wood', 'metal'], 1.35, 4, 0.3),
  G('xuangui', '《玄龟镇海功》', 2, ['water', 'earth'], 1.25, 4, 0.25, ['defense']),
  G('chiyan', '《赤炎焚天功》', 2, ['fire'], 1.45, 4, 0.3),
  G('xueying', '《血影魔功》', 2, ['fire', 'water'], 1.55, 4, 0.35, ['demonic']),
  G('wanmu', '《万木回春诀》', 2, ['wood'], 1.3, 4, 0.15, ['heal']),
  // 地阶（8）
  G('taiyi', '《太乙真解》', 3, [], 1.7, 5, 0.35),
  G('jinwu', '《金乌曜日经》', 3, ['fire'], 1.85, 5, 0.45),
  G('xuanming', '《玄冥真水诀》', 3, ['water'], 1.8, 5, 0.4),
  G('gengjin', '《庚金剑典》', 3, ['metal'], 1.75, 5, 0.55, ['sword']),
  G('buzhou', '《不周山岳经》', 3, ['earth'], 1.7, 5, 0.5, ['defense']),
  G('qingdi', '《青帝长生经》', 3, ['wood'], 1.8, 5, 0.35, ['heal']),
  G('jiuyou', '《九幽噬魂录》', 3, ['water', 'earth'], 2.0, 5, 0.5, ['demonic']),
  G('liuhe', '《六合周天功》', 3, ['metal', 'wood', 'earth'], 1.75, 5, 0.4),
  // 天阶（6）
  G('haotian', '《昊天罡气诀》', 4, [], 2.2, 7, 0.6),
  G('zhuque', '《朱雀涅槃经》', 4, ['fire', 'wood'], 2.35, 7, 0.7),
  G('beiming', '《北冥玄天功》', 4, ['water'], 2.3, 7, 0.65),
  G('jianxin', '《剑心通明篇》', 4, ['metal'], 2.25, 7, 0.85, ['sword']),
  G('xingchen', '《星辰变》', 4, ['metal', 'water'], 2.4, 7, 0.7),
  G('mohe', '《摩诃无量魔典》', 4, ['fire', 'earth'], 2.6, 7, 0.8, ['demonic']),
  // 圣阶（4）
  G('hundun', '《混沌开天诀》', 5, [], 2.8, 8, 0.95),
  G('taishang', '《太上忘情录》', 5, ['water', 'metal'], 2.9, 8, 0.9),
  G('yanluo', '《阎罗噬天功》', 5, ['fire', 'water'], 3.1, 8, 1.1, ['demonic']),
  G('cangsheng', '《苍生证道经》', 5, ['wood', 'earth'], 2.85, 8, 0.85, ['heal']),
  // 仙阶（2）
  G('dadao', '《大道朝天章》', 6, [], 3.4, 9, 1.3),
  G('hongmeng', '《鸿蒙紫气诀》', 6, [], 3.6, 9, 1.5),
]

export const GONGFA_MAP = new Map(GONGFA.map((g) => [g.id, g]))
export function gongfa(id: string): GongFaDef {
  const g = GONGFA_MAP.get(id)
  if (!g) throw new Error('unknown gongfa: ' + id)
  return g
}

/** 五行匹配度：弟子灵根与功法属性的交集比例 → 0.7(不合) ~ 1.3(全合) */
export function elementFit(rootElements: Element[], gf: GongFaDef): number {
  if (gf.elements.length === 0) return 1
  const overlap = gf.elements.filter((e) => rootElements.includes(e)).length
  const ratio = overlap / gf.elements.length
  return 0.7 + ratio * 0.6
}

/** 境界需求：境界 N 期望功法品阶 ≥ realmCap 覆盖；用于突破契合加成判定 */
export function gongfaFitsRealm(gf: GongFaDef, targetRealm: Realm): boolean {
  return gf.realmCap >= targetRealm
}
