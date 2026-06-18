// 丹药库（docs/03 炼丹房）：四类用途，品阶决定效力
import type { Rarity } from '@/shared/types'

export type PillKind = 'breakthrough' | 'healing' | 'mood' | 'cultivation'

export interface PillDef {
  id: string
  name: string
  rarity: Rarity
  kind: PillKind
  power: number // breakthrough: 突破加成；healing: 恢复天数除数；mood: 心境+；cultivation: 月修为% 加成
  herbs: number // 炼制消耗灵草
  minFacility: number // 炼丹房等级需求
  targetRealmMax?: number // 突破丹适用的目标境界上限
}

const P = (
  id: string, name: string, rarity: Rarity, kind: PillKind, power: number,
  herbs: number, minFacility: number, targetRealmMax?: number,
): PillDef => ({ id, name, rarity, kind, power, herbs, minFacility, targetRealmMax })

export const PILLS: PillDef[] = [
  // 突破丹：+10%~+40%（docs/02），每境界首次有效
  P('juqi', '聚气丹', 0, 'breakthrough', 0.1, 4, 1, 2),
  P('zhuji', '筑基丹', 1, 'breakthrough', 0.15, 10, 2, 2),
  P('ningjin', '凝金丹', 2, 'breakthrough', 0.2, 24, 3, 3),
  P('yuying', '育婴丹', 3, 'breakthrough', 0.25, 60, 4, 4),
  P('huashen', '化神丹', 4, 'breakthrough', 0.3, 150, 5, 5),
  P('duxu', '渡虚丹', 5, 'breakthrough', 0.35, 360, 6, 7),
  P('feixian', '飞仙丹', 6, 'breakthrough', 0.4, 800, 7, 9),
  // 疗伤丹：恢复时间 ÷ power
  P('jinchuang', '金疮丹', 0, 'healing', 1.5, 3, 1),
  P('huxin', '护心丹', 1, 'healing', 2, 8, 2),
  P('shengji', '生肌玉露丹', 2, 'healing', 3, 20, 3),
  P('niepan', '涅槃丹', 4, 'healing', 5, 120, 5),
  P('jiuzhuanhuanhun', '九转还魂丹', 5, 'healing', 8, 300, 6),
  // 静心丹：心境 +power
  P('qingxin', '清心丹', 0, 'mood', 10, 3, 1),
  P('jingxin', '静心丹', 1, 'mood', 20, 8, 2),
  P('mingxin', '明心见性丹', 3, 'mood', 40, 50, 4),
  P('wangyou', '忘忧丹', 4, 'mood', 60, 130, 5),
  // 修炼丹：月修为 +power%（持续一月，本实现：服用即一次性加月增量）
  P('juling', '聚灵丹', 1, 'cultivation', 0.3, 6, 2),
  P('peiyuan', '培元丹', 2, 'cultivation', 0.5, 15, 3),
  P('xianyuan', '小还丹', 3, 'cultivation', 0.8, 40, 4),
  P('taiqing', '太清神丹', 5, 'cultivation', 1.5, 280, 6),
  // 特殊
  P('xisui', '洗髓丹', 4, 'cultivation', 1.0, 200, 5), // 也作为灵根淬炼事件素材
  P('zaohua', '造化玉髓丹', 6, 'cultivation', 2.0, 999, 7), // 资质提升事件链素材
]

export const PILL_MAP = new Map(PILLS.map((p) => [p.id, p]))
export function pill(id: string): PillDef {
  const p = PILL_MAP.get(id)
  if (!p) throw new Error('unknown pill: ' + id)
  return p
}
/** 给定目标境界，返回最合适的突破丹 id 列表（高→低） */
export function breakthroughPillsFor(targetRealm: number): PillDef[] {
  return PILLS.filter((p) => p.kind === 'breakthrough' && (p.targetRealmMax ?? 9) >= targetRealm).sort(
    (a, b) => b.power - a.power,
  )
}
