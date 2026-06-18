// 征兆与干预窗口（docs/09 §4）：角色做出激烈自主抉择前先放征兆，给玩家窗口去改其心相。
// 征兆清晰度受性格影响——孤僻/阴鸷者征兆隐晦，玩家更容易看走眼。
import type { Disciple, WorldState } from '@/shared/types'
import { hasTrait, log } from './helpers'
import { hasMemoryTag } from './biography'
import type { RNG } from '../core/rng'

interface OmenSpec {
  key: string // 危机类型
  risk: (d: Disciple, w: WorldState) => number // 0~1 漂向激烈抉择的风险
  windowDays: [number, number]
  event: string // 到期触发的个人抉择事件
  clear: (d: Disciple) => string // 清晰征兆文案
  vague: (d: Disciple) => string // 隐晦征兆文案
}

const OMENS: OmenSpec[] = [
  {
    key: 'demon',
    risk: (d) => Math.max(0, (d.beliefs.xinmo - 55) / 45) * (1 - d.beliefs.daoxin / 200),
    windowDays: [60, 150],
    event: 'inner_demon_choice',
    clear: (d) => `${d.name}近来形单影只，眼底渐有戾气，长老们看在眼里。`,
    vague: (d) => `${d.name}这些时日有些沉默。`,
  },
  {
    key: 'defect',
    risk: (d) => Math.max(0, (40 - d.beliefs.loyalty) / 40) * (0.4 + d.beliefs.molean / 150),
    windowDays: [90, 240],
    event: 'defection_choice',
    clear: (d) => `${d.name}时常独坐山门远眺，对宗门事务也淡了几分。`,
    vague: (d) => `${d.name}近来心思似乎不在山上。`,
  },
  {
    key: 'corrupt',
    // 仅在"摇摆区间"(魔倾 35~72)纠结；彻底入魔者已无戏可唱
    risk: (d) => (d.beliefs.molean >= 35 && d.beliefs.molean <= 72 ? (d.beliefs.molean - 35) / 50 : 0) * (1 - d.beliefs.daoxin / 200),
    windowDays: [60, 180],
    event: 'demon_path_choice',
    clear: (d) => `${d.name}的功法路数愈发偏激，隐隐透出几分魔气。`,
    vague: (d) => `${d.name}修炼时气息有些古怪。`,
  },
]

/** 月度征兆扫描：风险高且无待决征兆者，发征兆 + 调度真正的抉择事件 */
export function omensMonthly(w: WorldState, rng: RNG): void {
  for (const d of w.disciples) {
    if (d.status === 'demonic') continue
    for (const om of OMENS) {
      const flag = 'omen:' + om.key + ':' + d.id
      if (w.flags[flag]) continue // 已有待决征兆
      if ((w.cooldowns['omendone:' + om.key + ':' + d.id] ?? 0) > w.day) continue // 抉择后冷却，防刷
      const r = om.risk(d, w)
      if (r < 0.4) continue
      if (!rng.chance(r * 0.5)) continue
      // 阴鸷/孤僻者征兆隐晦
      const vague = hasTrait(d, 'sinister') || hasTrait(d, 'loner') || hasMemoryTag(d, '隐忍')
      log(w, 'social', vague ? om.vague(d) : om.clear(d))
      w.flags[flag] = true
      w.scheduled.push({ day: w.day + rng.int(om.windowDays[0], om.windowDays[1]), eventId: om.event, cast: { self: d.id } })
    }
  }
}

/** 抉择事件触发时清掉征兆 flag 并上多年冷却（防同一危机反复刷屏）。在事件 effects 里调用。 */
export function clearOmen(w: WorldState, key: string, discipleId: string): void {
  delete w.flags['omen:' + key + ':' + discipleId]
  w.cooldowns['omendone:' + key + ':' + discipleId] = w.day + 8 * 360
}
