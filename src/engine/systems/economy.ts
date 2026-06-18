// 经济月结算（docs/03 §1）：产出 − 月俸 − 维护；赤字通过人事系统表达压力
import type { WorldState } from '@/shared/types'
import {
  FIELD_HERB_PER_LEVEL, FIELD_RICE_PER_LEVEL, FIELD_WORKERS_PER_LEVEL, MAINT_PER_FACILITY_LEVEL,
  MINE_STONES_PER_QUALITY, REP_INCOME_RATE, RICE_PER_DISCIPLE, RICE_TO_STONE, STIPEND_BY_RANK, STIPEND_LEVEL_MUL,
} from '../content/constants'
import type { RNG } from '../core/rng'
import { addMood, hasTag, log } from './helpers'

export function economyMonthly(w: WorldState, rng: RNG): void {
  const s = w.sect
  // ── 产出 ──
  const fieldLv = s.facilities['field'] ?? 0
  const workersNeeded = fieldLv * FIELD_WORKERS_PER_LEVEL
  const workers = w.disciples.filter((d) => d.action === 'work').length
  const workRatio = workersNeeded > 0 ? Math.min(1, workers / workersNeeded) : 0
  const rice = Math.round(fieldLv * FIELD_RICE_PER_LEVEL * (0.5 + 0.5 * workRatio))
  const herbs = Math.round(fieldLv * FIELD_HERB_PER_LEVEL * (0.5 + 0.5 * workRatio))
  // 聚灵阵带动灵脉产出：后期经济飞轮（每级 +25%）
  const arrayLv = s.facilities['array'] ?? 0
  const mineStones = Math.round(s.siteQuality * MINE_STONES_PER_QUALITY * (1 + arrayLv * 0.25))
  s.rice += rice
  s.herbs += herbs
  s.stones += mineStones
  // 声望供奉：山下州府与商路的香火钱
  s.stones += Math.round(s.reputation * REP_INCOME_RATE)
  // 灵矿月收（战略资产 contested_mine，需持续防守 mine_raid）
  if (w.flags['mineHeld']) s.stones += 70

  // ── 消耗 ──
  const riceNeed = w.disciples.length * RICE_PER_DISCIPLE
  s.rice -= riceNeed
  if (s.rice > 200) {
    // 余粮折灵石
    const sell = Math.floor((s.rice - 200) * RICE_TO_STONE)
    s.stones += sell
    s.rice = 200
  }
  let stipend = 0
  for (const d of w.disciples) stipend += (STIPEND_BY_RANK[d.rank] ?? 2) * STIPEND_LEVEL_MUL[s.rules.stipend]
  stipend = Math.round(stipend)
  let maint = 0
  for (const lv of Object.values(s.facilities)) maint += lv * MAINT_PER_FACILITY_LEVEL
  s.stones -= stipend + maint

  // ── 赤字压力 ──
  if (s.stones < 0) {
    s.stones = 0
    for (const d of w.disciples) {
      addMood(d, -6)
      if (hasTag(d, 'steal') && rng.chance(0.1)) w.flags['stealPending'] = d.id // 偷窃事件钩子
    }
    log(w, 'economy', `宗门入不敷出，月俸停发，门内人心浮动。`)
  }
  if (s.rice < 0) {
    s.rice = 0
    for (const d of w.disciples) addMood(d, -10)
    log(w, 'economy', `灵米告罄，弟子们饥肠辘辘，怨声渐起。`)
  }

  // 炼丹房自动产丹（有丹师执勤时）
  const alchemyLv = s.facilities['alchemy'] ?? 0
  if (alchemyLv > 0) {
    const alchemists = w.disciples.filter((d) => d.action === 'work' && (hasTag(d, 'alchemy') || d.comprehension >= 7))
    if (alchemists.length > 0 && rng.chance(0.6)) {
      autoCraftPill(w, alchemyLv, rng)
    }
  }
}

import { PILLS } from '../content/pills'

function autoCraftPill(w: WorldState, facilityLv: number, rng: RNG): void {
  // 优先炼当前最需要的突破丹，其次疗伤/静心
  const craftable = PILLS.filter((p) => p.minFacility <= facilityLv && p.herbs <= w.sect.herbs)
  if (craftable.length === 0) return
  const need = craftable.filter((p) => p.kind === 'breakthrough')
  const pickPool = need.length > 0 && rng.chance(0.6) ? need : craftable
  const p = rng.pick(pickPool)
  w.sect.herbs -= p.herbs
  w.sect.pills[p.id] = (w.sect.pills[p.id] ?? 0) + 1
  log(w, 'economy', `丹房炼成${p.name}一枚。`, p.rarity)
}
