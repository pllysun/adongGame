import type { Rarity } from './types'

// 颜色是视觉层，等级名称是世界观层，一一对应（docs/00 §七阶稀有度总表）
export const RARITY_COLORS = [
  '#9ca3af', // 凡 白(灰)
  '#22c55e', // 灵 绿
  '#3b82f6', // 玄 蓝
  '#a855f7', // 地 紫
  '#f59e0b', // 天 金
  '#ef4444', // 圣 红
  '#e879f9', // 仙 彩（基色，UI 另用渐变）
] as const

export const RARITY_NAMES = {
  aptitude: ['凡品', '灵品', '玄品', '地品', '天品', '圣品', '仙品'],
  gongfa: ['凡阶', '黄阶', '玄阶', '地阶', '天阶', '圣阶', '仙阶'],
  pill: ['凡丹', '灵丹', '玄丹', '宝丹', '天丹', '圣丹', '仙丹'],
  artifact: ['凡器', '法器', '灵器', '宝器', '灵宝', '圣器', '仙器'],
} as const

export type RarityDomain = keyof typeof RARITY_NAMES

export function rarityName(domain: RarityDomain, r: Rarity): string {
  return RARITY_NAMES[domain][r]
}
export function rarityColor(r: Rarity): string {
  return RARITY_COLORS[r]
}

export const REALM_NAMES = ['凡人', '炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫'] as const
export const SUB_NAMES = ['初期', '中期', '后期'] as const
export const RANK_NAMES: Record<string, string> = {
  outer: '外门',
  inner: '内门',
  core: '真传',
  elder: '长老',
  master: '掌门',
}
export const ELEMENT_NAMES: Record<string, string> = {
  metal: '金',
  wood: '木',
  water: '水',
  fire: '火',
  earth: '土',
}
export const ACTION_NAMES: Record<string, string> = {
  cultivate: '修炼',
  train: '演武',
  work: '执勤',
  social: '交游',
  seclude: '闭关',
  travel: '游历',
  recover: '疗伤',
}

export function realmLabel(realm: number, sub?: number): string {
  if (realm <= 0) return '凡人'
  return REALM_NAMES[realm] + (sub === undefined ? '' : SUB_NAMES[sub])
}
