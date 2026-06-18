// 性格特质库（docs/01 §4）：特质 = 修正器集合 + 事件标签。加新特质零代码。
import type { ActionId } from '@/shared/types'

export interface TraitDef {
  id: string
  name: string
  desc: string
  hidden?: boolean
  opposite?: string
  /** 行为权重乘数 */
  actions?: Partial<Record<ActionId, number>>
  cultSpeed?: number // 修炼速度乘数增量
  moodLossMul?: number // 负面心境乘数
  moodGainMul?: number
  demonShift?: number // 走火入魔权重增减
  relGainMul?: number // 关系形成速度
  combatMul?: number // 战力乘数增量
  killer?: boolean // 战报击杀倾向
  betrayProne?: number // 叛逃倾向权重
  loyal?: boolean
  luckShift?: number // 隐性气运修正
  tags?: string[]
}

export const TRAITS: TraitDef[] = [
  { id: 'diligent', name: '勤勉', desc: '修炼时间更长', opposite: 'lazy', actions: { cultivate: 1.4 }, cultSpeed: 0.05 },
  { id: 'lazy', name: '懒散', desc: '能躺着绝不坐着', opposite: 'diligent', actions: { cultivate: 0.6, social: 1.3 }, cultSpeed: -0.15, tags: ['slack'] },
  { id: 'resolute', name: '坚毅', desc: '挫折难撼其道心', opposite: 'timid', moodLossMul: 0.5, combatMul: 0.05 },
  { id: 'timid', name: '怯懦', desc: '遇险先退', opposite: 'resolute', combatMul: -0.15, moodLossMul: 1.3, tags: ['flee'] },
  { id: 'devoted', name: '痴情', desc: '情之所钟，生死相随', hidden: true, opposite: 'cold', relGainMul: 2, tags: ['couple2x', 'griefDemon'] },
  { id: 'cold', name: '凉薄', desc: '万事不萦于怀', hidden: true, opposite: 'devoted', relGainMul: 0.3, demonShift: -4, moodLossMul: 0.7 },
  { id: 'chivalrous', name: '侠义', desc: '路见不平拔剑相助', opposite: 'sinister', tags: ['rescue', 'fame'], combatMul: 0.05 },
  { id: 'sinister', name: '阴鸷', desc: '睚眦之怨必报', opposite: 'chivalrous', tags: ['vengeful', 'demonPath'], demonShift: 3 },
  { id: 'magnanimous', name: '豁达', desc: '恩怨随风', opposite: 'grudging', moodLossMul: 0.7, tags: ['forgive'] },
  { id: 'grudging', name: '记仇', desc: '仇怨刻骨永不相忘', opposite: 'magnanimous', tags: ['vengeful'], relGainMul: 0.8 },
  { id: 'humble', name: '谦逊', desc: '尊师重道虚怀若谷', opposite: 'arrogant', relGainMul: 1.2 },
  { id: 'arrogant', name: '傲慢', desc: '眼高于顶', opposite: 'humble', tags: ['provoke'], moodLossMul: 1.2, actions: { train: 1.3 } },
  { id: 'detached', name: '淡泊', desc: '富贵于我如浮云', hidden: true, opposite: 'greedy', moodLossMul: 0.8, tags: ['noSalaryMood'] },
  { id: 'greedy', name: '贪婪', desc: '见利忘义', hidden: true, opposite: 'detached', betrayProne: 3, tags: ['steal'] },
  { id: 'merciful', name: '慈悲', desc: '得饶人处且饶人', opposite: 'ruthless', tags: ['spare'] },
  { id: 'ruthless', name: '杀伐', desc: '出手无情', opposite: 'merciful', killer: true, combatMul: 0.1, demonShift: 2, tags: ['demonPath'] },
  { id: 'sociable', name: '八面玲珑', desc: '人缘极佳', opposite: 'loner', relGainMul: 2, actions: { social: 1.6 } },
  { id: 'loner', name: '孤僻', desc: '独来独往', opposite: 'sociable', relGainMul: 0.3, cultSpeed: 0.1, actions: { social: 0.3, cultivate: 1.2 } },
  { id: 'loyal', name: '忠义', desc: '此生不叛宗门', hidden: true, opposite: 'ambitious', loyal: true },
  { id: 'ambitious', name: '野心', desc: '权位之心炽烈', hidden: true, opposite: 'loyal', betrayProne: 2, tags: ['powerHungry'] },
  { id: 'battlemad', name: '武痴', desc: '一生只为问剑', actions: { train: 2, social: 0.5 }, combatMul: 0.15, tags: ['duel'] },
  { id: 'lateBloomer', name: '大器晚成', desc: '璞玉藏辉，逢机而显', hidden: true, opposite: 'earlyFade', tags: ['awaken'] },
  { id: 'earlyFade', name: '伤仲永', desc: '少时了了，大未必佳', hidden: true, opposite: 'lateBloomer', tags: ['fade'] },
  { id: 'blessed', name: '福星', desc: '冥冥中自有天佑', hidden: true, opposite: 'cursed', luckShift: 3 },
  { id: 'cursed', name: '灾星', desc: '祸事总寻上门来', hidden: true, opposite: 'blessed', luckShift: -3, tags: ['troubleMagnet'] },
  { id: 'healer', name: '医者仁心', desc: '悬壶济世', tags: ['medic'], actions: { work: 1.4 } },
  { id: 'alchemist', name: '丹道奇才', desc: '于丹道一途天赋异禀', tags: ['alchemy'], actions: { work: 1.5 } },
  { id: 'swordfanatic', name: '剑痴', desc: '剑即是道', combatMul: 0.2, cultSpeed: -0.05, tags: ['duel'] },
  { id: 'winelover', name: '酒中仙', desc: '无酒不欢，醉后吐真', actions: { social: 1.5 }, tags: ['banquet'], cultSpeed: -0.05 },
  { id: 'warmheart', name: '古道热肠', desc: '与人为善有求必应', relGainMul: 1.5, tags: ['rescue'] },
  { id: 'paranoid', name: '疑心重', desc: '步步设防难以交心', relGainMul: 0.5, moodLossMul: 1.2, tags: ['suspect'] },
  { id: 'tsundere', name: '面冷心热', desc: '嘴上无情，危难见真心', relGainMul: 0.7, tags: ['rescue'] },
]

export const TRAIT_MAP = new Map(TRAITS.map((t) => [t.id, t]))
export function trait(id: string): TraitDef {
  const t = TRAIT_MAP.get(id)
  if (!t) throw new Error('unknown trait: ' + id)
  return t
}
