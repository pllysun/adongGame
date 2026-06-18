// 法宝库：战力加成 + 个别特效（死亡保护阀的道具表达）
import type { Rarity } from '@/shared/types'

export interface ArtifactDef {
  id: string
  name: string
  rarity: Rarity
  combatMod: number
  guard?: boolean // 护身法宝：抵挡一次致命伤（消耗品式碎裂）
}

const A = (id: string, name: string, rarity: Rarity, combatMod: number, guard?: boolean): ArtifactDef => ({
  id, name, rarity, combatMod, guard,
})

export const ARTIFACTS: ArtifactDef[] = [
  A('tiejian', '精铁剑', 0, 0.08),
  A('taomu', '桃木符剑', 0, 0.06),
  A('qingfengjian', '青锋剑', 1, 0.15),
  A('hushen', '护身玉符', 1, 0.08, true),
  A('liuyun', '流云梭', 2, 0.22),
  A('xuanwu', '玄武盾', 2, 0.18, true),
  A('zilei', '紫雷锤', 3, 0.35),
  A('jiulong', '九龙佩', 3, 0.25, true),
  A('qingping_sword', '青萍剑', 4, 0.5),
  A('liuli', '琉璃宝塔', 4, 0.4, true),
  A('zhanxian', '斩仙飞刀', 5, 0.7),
  A('hunyuan', '混元金斗', 5, 0.55, true),
  A('kongtong', '崆峒印', 6, 0.9),
  A('xianjian', '诛仙剑', 6, 1.1),
  A('fuchen', '太乙拂尘', 2, 0.2),
  A('zhenhai', '镇海珠', 3, 0.3),
]

export const ARTIFACT_MAP = new Map(ARTIFACTS.map((a) => [a.id, a]))
export function artifact(id: string): ArtifactDef {
  const a = ARTIFACT_MAP.get(id)
  if (!a) throw new Error('unknown artifact: ' + id)
  return a
}
