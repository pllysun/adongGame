// 全部数值常量集中于此：改平衡 = 改这个文件 + 跑 npm run sim 回归（docs/08 工作流约定）
import type { Rarity } from '@/shared/types'

// ── 境界 ────────────────────────────────────────────────────────────
/** 各境界寿元上限（年），下标 = realm */
export const LIFESPAN = [80, 120, 250, 500, 1000, 2000, 3500, 5000, 8000, 12000]

/** 大境界基础修为需求（炼气初期），逐大境界 ×8，小层 ×[1, 1.6, 2.5] */
export const CULT_NEED_BASE = 1000
export const CULT_NEED_REALM_MUL = 7.4
export const CULT_NEED_SUB_MUL = [1, 1.6, 2.2]

/** 修为日增长基数：逐大境界 ×4.9（与需求 ×7.4 配比 → 每大境界耗时约 ×1.5） */
export const CULT_GAIN_BASE = 0.62
export const CULT_GAIN_REALM_MUL = 4.9
/** 宗门底蕴：镇宗最高境界每级为全宗修炼 +4%（强宗出强徒的正反馈） */
export const HERITAGE_PER_REALM = 0.04

export function cultNeed(realm: number, sub: number): number {
  return CULT_NEED_BASE * Math.pow(CULT_NEED_REALM_MUL, realm - 1) * CULT_NEED_SUB_MUL[sub]
}
export function cultGainBase(realm: number): number {
  return CULT_GAIN_BASE * Math.pow(CULT_GAIN_REALM_MUL, realm - 1)
}

// ── 突破 ────────────────────────────────────────────────────────────
/** 基础成功率矩阵 [资质0-6][目标大境界2-9]，单位 %（docs/02 §3） */
export const BREAKTHROUGH_MATRIX: number[][] = [
  [30, 8, 1, 0.2, 0.1, 0.05, 0.05, 0.05],
  [55, 22, 6, 1, 0.3, 0.1, 0.05, 0.05],
  [80, 45, 18, 6, 2, 0.5, 0.2, 0.1],
  [92, 68, 38, 18, 8, 3, 1, 0.5],
  [95, 85, 60, 40, 25, 15, 10, 6],
  [95, 95, 80, 65, 50, 38, 28, 15],
  [95, 95, 95, 88, 78, 68, 55, 40],
]
export function baseBreakRate(aptitude: Rarity, targetRealm: number): number {
  const col = targetRealm - 2
  if (col < 0) return 95
  return BREAKTHROUGH_MATRIX[aptitude][Math.min(col, 7)] / 100
}

export const BREAK_RATE_FLOOR = 0.01
export const BREAK_RATE_CEIL = 0.95
/** 小层突破成功率 = MINOR_BREAK_BASE - realm × MINOR_BREAK_REALM_PENALTY */
export const MINOR_BREAK_BASE = 0.95
export const MINOR_BREAK_REALM_PENALTY = 0.03

/** 突破加成（docs/02 §3） */
export const BONUS_MOOD_HIGH = 0.15 // 道心圆满
export const BONUS_MOOD_LOW = -0.1 // 郁结
export const BONUS_INSIGHT = 0.25 // 顿悟触发
export const INSIGHT_CHANCE_PER_COMP = 0.02 // 悟性×2%
export const BONUS_CAVE = 0.05 // 灵穴洞府（洞府≥4级的真传+）
export const BONUS_GUARD = 0.08 // 长老护道
export const BONUS_GONGFA_FIT = 0.05
export const PENALTY_GONGFA_UNFIT = -0.15 // 功法品阶低于境界需求

/** 失败结果表 [权重, ...]（docs/02 §3）：受挫/重伤/走火入魔/跌境/身死 */
export const FAIL_TABLE = { setback: 55, injury: 25, demonic: 12, drop: 5, death: 3 }
export const FAIL_DEMONIC_MINDSTATE_RELIEF = 1 // 心性每点减走火入魔权重

// ── 天劫（元婴+ 大境界突破后附带，docs/02 §4） ─────────────────────
export const TRIBULATION_FROM_REALM = 4 // 目标境界 ≥ 元婴
export const TRIBULATION_POWER_MUL = 1.35 // 天雷 = 目标境界标准战力 × 此系数
export const TRIBULATION_DEATH_RATE = 0.5 // 渡劫失败后身死比例（其余重伤跌境）

// ── 战力 ────────────────────────────────────────────────────────────
export const POWER_BASE = 8
export const POWER_REALM_MUL = 6
export const POWER_SUB_MUL = 0.18
export const POWER_COMBAT_EXP = 0.05
export function realmPower(realm: number, sub = 0): number {
  if (realm <= 0) return 1
  return POWER_BASE * Math.pow(POWER_REALM_MUL, realm - 1) * (1 + POWER_SUB_MUL * sub)
}

export const SYNERGY_PER_REL_TIER = 0.05 // 队伍平均关系档每档 +5%
export const DEFENSE_ARRAY_MUL_PER_LEVEL = 0.18 // 护山大阵每级防御倍率

// ── 心境（docs/01 §5） ──────────────────────────────────────────────
export const MOOD_MIN = -100
export const MOOD_MAX = 100
export const MOOD_HIGH = 60 // 道心圆满
export const MOOD_DEMONIC = -60 // 心魔缠身
export const MOOD_REGRESS_PER_XUN = 1.2 // 向基线回归速率（×心性/5）
export const DEMONIC_CHECK_MONTHLY = 0.06 // 心魔缠身每月走火入魔检定

// ── 经济（docs/03 §1） ──────────────────────────────────────────────
export const STIPEND_BY_RANK: Record<string, number> = { outer: 2, inner: 6, core: 20, elder: 40, master: 50 }
export const STIPEND_LEVEL_MUL = [0.6, 1, 1.8] // 待遇档
export const RICE_PER_DISCIPLE = 3 // 每月口粮
export const FIELD_RICE_PER_LEVEL = 45 // 灵田每级月产灵米（需执勤）
export const FIELD_HERB_PER_LEVEL = 5 // 灵田每级月产灵草
export const FIELD_WORKERS_PER_LEVEL = 2 // 每级灵田需要的执勤人数（不足按比例减产）
export const RICE_TO_STONE = 0.5 // 余粮折灵石
export const MINE_STONES_PER_QUALITY = 40 // 灵脉品质每点月产灵石
export const MAINT_PER_FACILITY_LEVEL = 2 // 设施每级月维护灵石
export const REP_INCOME_RATE = 0.06 // 声望供奉：每点声望月入灵石（声望飞轮的经济端）

// ── 招收（docs/03 §3） ──────────────────────────────────────────────
export const RECRUIT_BASE_CANDIDATES = 12
export const RECRUIT_REP_BONUS = 0.02 // 每点声望 +0.02 候选人（上限 +24）
/** 资质分布权重（凡→仙），声望对前四档轻微再分配 */
export const APTITUDE_WEIGHTS = [50, 30, 13, 5, 1.5, 0.45, 0.05]
export const REP_SHIFT_MAX = 0.35 // 声望最多把 35% 的凡品权重移到灵/玄/地

// ── 事件 ────────────────────────────────────────────────────────────
export const EVENT_DENSITY_PER_YEAR = 6 // 命途/经营事件年均触发数（旬抽取节流）
export const FLAVOR_DENSITY_PER_YEAR = 14 // 风味事件独立预算：年均触发数（只织事件流纹理）
export const LOG_CAP = 300

// ── 关系（docs/01 §6） ──────────────────────────────────────────────
export const REL_CAP_PER_DISCIPLE = 12
export const REL_DECAY_PER_XUN = 0.3
export const COUPLE_CULT_BONUS = 0.12 // 道侣双修修炼加成

// ── 立绘/杂项 ───────────────────────────────────────────────────────
export const DYING_YEARS = 10 // 灯枯期
export const VICTORY_DUJIE_COUNT = 3
export const SECT_NAME_DEFAULT = '青云宗'
