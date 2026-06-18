// 游戏历法：1 年 = 12 月 × 30 日 = 360 日；1 旬 = 10 日。纪元名"天玄历"，第 1 年起算。

export const DAYS_PER_YEAR = 360
export const DAYS_PER_MONTH = 30
export const DAYS_PER_XUN = 10

export interface GameDate {
  year: number
  month: number // 1-12
  day: number // 1-30
  xun: 0 | 1 | 2 // 上中下旬
}

export function toDate(day: number): GameDate {
  const year = Math.floor(day / DAYS_PER_YEAR) + 1
  const dayOfYear = day % DAYS_PER_YEAR
  const month = Math.floor(dayOfYear / DAYS_PER_MONTH) + 1
  const dom = (dayOfYear % DAYS_PER_MONTH) + 1
  const xun = Math.min(2, Math.floor((dom - 1) / DAYS_PER_XUN)) as 0 | 1 | 2
  return { year, month, day: dom, xun }
}

const XUN_NAMES = ['上旬', '中旬', '下旬']

export function formatDate(day: number): string {
  const d = toDate(day)
  return `天玄历${d.year}年${d.month}月${XUN_NAMES[d.xun]}`
}

export function yearsBetween(fromDay: number, toDay: number): number {
  return (toDay - fromDay) / DAYS_PER_YEAR
}

export function ageYears(birthDay: number, now: number): number {
  return Math.floor((now - birthDay) / DAYS_PER_YEAR)
}

export function isXunStart(day: number): boolean {
  return day % DAYS_PER_XUN === 0
}
export function isMonthStart(day: number): boolean {
  return day % DAYS_PER_MONTH === 0
}
export function isYearStart(day: number): boolean {
  return day % DAYS_PER_YEAR === 0
}
