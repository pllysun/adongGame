// 自动玩家（docs/07 §6）：无头模拟用的默认策略，也是数值回归的"标准玩家"
import type { Disciple, Interactive, CombatSpec } from '@/shared/types'
import type { SimEngine } from '../engine'
import { disciplePower } from '../engine/systems/combat'
import { sectCapacity } from '../engine/content/facilities'
import { FACILITY_MAP } from '../engine/content/facilities'
import { RNG } from '../engine/core/rng'

const BUILD_PRIORITY = ['caves', 'array', 'field', 'library', 'alchemy', 'wall', 'arena', 'quiet', 'law', 'forge']

export class AutoPlayer {
  private rng: RNG
  constructor(private engine: SimEngine, seed = 'auto') {
    this.rng = RNG.fromSeed(seed)
  }

  /** 每个 tick 后调用：处理全部待决交互 + 偶尔搞建设 */
  step(): void {
    const w = this.engine.world
    while (w.queue.length > 0) {
      this.resolve(w.queue[0])
    }
    // 收件箱：勤勉玩家会定期处理（每旬清一批），而非全靠过期默认
    if (w.day % 10 === 0) {
      for (const it of [...w.inbox]) this.resolve(it)
    }
    // 每月初考虑建设与功法分配
    if (w.day % 30 === 0) {
      this.build()
      this.assignGongfa()
    }
  }

  private resolve(item: Interactive): void {
    const w = this.engine.world
    switch (item.kind) {
      case 'recruit': {
        const { candidates } = item.payload as { candidates: Disciple[] }
        const capacity = Math.max(0, sectCapacity(w) - w.disciples.length)
        const picked = [...candidates]
          .sort((a, b) => b.shownAptitude - a.shownAptitude || b.roots.purity - a.roots.purity)
          .slice(0, Math.min(capacity, Math.ceil(candidates.length * 0.7)))
          .map((c) => c.id)
        this.engine.command({ type: 'resolve', uid: item.uid, option: 0, selection: picked })
        break
      }
      case 'combat-setup': {
        const spec = item.payload as CombatSpec
        const healthy = [...w.disciples]
          .filter((d) => d.status === 'normal' || d.status === 'dying')
          .sort((a, b) => disciplePower(b) - disciplePower(a))
        const max = spec.maxTeam ?? 4
        // 保护王牌：若 B 队（剔除最强者）已有 2.5 倍优势就不出动顶尖战力
        const bTeam = healthy.slice(1, max + 1)
        const bPower = bTeam.reduce((s, d) => s + disciplePower(d), 0)
        const team = (bPower > spec.enemyPower * 2.5 ? bTeam : healthy.slice(0, max)).map((d) => d.id)
        this.engine.command({ type: 'resolve', uid: item.uid, option: 0, selection: team })
        break
      }
      case 'breakthrough-ask':
        this.engine.command({ type: 'resolve', uid: item.uid, option: 0 })
        break
      case 'event': {
        // 按 ai 权重在可用选项里抽取
        const enabled = item.options.filter((o) => !o.disabled)
        const pick =
          enabled.length > 0
            ? (this.rng.weighted(enabled, (o) => o.ai ?? 1) ?? enabled[0])
            : item.options[0]
        this.engine.command({ type: 'resolve', uid: item.uid, option: pick.idx })
        break
      }
    }
  }

  private build(): void {
    const w = this.engine.world
    // 保留一个月的运转资金
    const reserve = 200 + w.disciples.length * 10
    for (const fid of BUILD_PRIORITY) {
      const def = FACILITY_MAP.get(fid)!
      const cur = w.sect.facilities[fid] ?? 0
      if (cur >= def.maxLevel) continue
      // 洞府快满时优先扩容
      if (fid === 'caves' && w.disciples.length < sectCapacity(w) * 0.8 && cur >= 1) continue
      const cost = def.cost(cur + 1)
      if (w.sect.stones - cost.stones < reserve || w.sect.materials < cost.materials) continue
      const r = this.engine.command({ type: 'build', facility: fid })
      if (r.ok) return // 每月最多建一座
    }
  }

  private assignGongfa(): void {
    const w = this.engine.world
    const { GONGFA_MAP } = require_gongfa()
    for (const d of w.disciples) {
      const cur = d.gongfa ? GONGFA_MAP.get(d.gongfa) : undefined
      // 已修魔功者不强行换走（尊重其命途）；正道宗门默认不主动分配魔功
      if (cur?.tags?.includes('demonic')) continue
      // 功法撑不住当前境界，或品阶低于可得的更好功法 → 换
      const candidates = w.sect.gongfa
        .map((id) => GONGFA_MAP.get(id)!)
        .filter((g) => g.realmCap >= Math.min(9, d.realm + 1) && !g.tags?.includes('demonic'))
        .sort((a, b) => b.rarity - a.rarity || b.speedBase - a.speedBase)
      if (candidates.length === 0) continue
      const best = candidates[0]
      if (!cur || cur.realmCap < d.realm + 1 || best.rarity > cur.rarity + 1) {
        this.engine.command({ type: 'setGongfa', discipleId: d.id, gongfaId: best.id })
      }
    }
  }
}

import * as gongfaModule from '../engine/content/gongfa'
function require_gongfa(): typeof gongfaModule {
  return gongfaModule
}
