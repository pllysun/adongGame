// 峰系统（docs/09 §8）：宗门的组织演化——草创→立宗→分峰。半涌现：7 类固定职能峰，可生灭分争。
import type { Disciple, Peak, PeakType, WorldState } from '@/shared/types'
import { GONGFA_MAP } from '../content/gongfa'
import { disciplePower } from './combat'
import { chronicle, getD, log, powerSort, relsOf } from './helpers'
import { bind } from './lineage'
import type { RNG } from '../core/rng'

const PEAK_TYPE_INFO: Record<PeakType, { label: string; suffix: string }> = {
  sword: { label: '剑', suffix: '剑峰' },
  alchemy: { label: '丹', suffix: '丹峰' },
  forge: { label: '器', suffix: '器峰' },
  array: { label: '阵', suffix: '阵峰' },
  beast: { label: '兽', suffix: '御兽峰' },
  teach: { label: '传功', suffix: '传功峰' },
  outer: { label: '执事', suffix: '执事峰' },
}
const PEAK_PREFIXES = ['青阳', '紫极', '凌霄', '太微', '落英', '听涛', '万象', '九天', '碧落', '寒山']

/** 宗门发展度 = f(顶级境界, 人口, 峰数)，驱动阶段推进与入内门门槛（docs/09 §8.2） */
export function devLevel(w: WorldState): number {
  const topRealm = w.disciples.reduce((m, d) => Math.max(m, d.realm), 0)
  return topRealm * 3 + Math.min(20, w.disciples.length) + w.peaks.length * 2
}

/** 推进宗门阶段 + 更新动态入内门门槛 */
export function peakStageMonthly(w: WorldState, rng: RNG): void {
  const top = w.disciples.reduce((m, d) => Math.max(m, d.realm), 0)
  const pop = w.disciples.length

  // 阶段推进
  if (w.sectStage === 'founding' && pop >= 8 && top >= 3) {
    w.sectStage = 'sect'
    log(w, 'system', '宗门初具规模，自此立内门、外门之别。', 3)
    chronicle(w, 'institution', `${w.sect.name}立内外门之制，门规渐明。`)
  }
  if (w.sectStage === 'sect' && top >= 5 && pop >= 16 && masters(w).length >= 2) {
    w.sectStage = 'peaks'
    log(w, 'system', '群英荟萃，宗门开始分峰立派。', 4)
    chronicle(w, 'institution', `${w.sect.name}强者并起，分峰之制初成。`)
  }

  // 动态入内门门槛：发展越盛，庸才越要熬资历，天才直入
  if (w.sectStage === 'founding') {
    w.innerThreshold = { realm: 1, aptitude: 0 }
  } else {
    const dev = devLevel(w)
    const realmGate = dev > 40 ? 2 : 1 // 后期要筑基才入内门
    w.innerThreshold = { realm: realmGate, aptitude: dev > 30 ? 2 : 1 }
  }

  if (w.sectStage === 'peaks') {
    tryFoundPeaks(w, rng)
    assignToPeaks(w)
    updatePeakState(w, rng)
  }
}

export function masters(w: WorldState): Disciple[] {
  return w.disciples.filter((d) => d.realm >= 4)
}

/** 根据弟子专长推断其最适合开的峰 */
function peakTypeFor(w: WorldState, d: Disciple): PeakType {
  const gf = d.gongfa ? GONGFA_MAP.get(d.gongfa) : null
  if (gf?.tags?.includes('sword')) return 'sword'
  if (d.traits.includes('alchemist')) return 'alchemy'
  if (d.traits.includes('healer')) return 'teach'
  if (gf?.tags?.includes('defense')) return 'array'
  // 否则按已有峰缺口补
  const have = new Set(w.peaks.map((p) => p.type))
  for (const t of ['sword', 'alchemy', 'array', 'forge', 'beast', 'teach'] as PeakType[]) if (!have.has(t)) return t
  return 'sword'
}

/** 开峰：高境界 + 威望 + 够门徒的强者立峰（docs/09 §8.4） */
function tryFoundPeaks(w: WorldState, rng: RNG): void {
  const maxPeaks = Math.min(7, 2 + Math.floor(w.disciples.length / 8))
  if (w.peaks.length >= maxPeaks) return
  // 候选：化神+，尚未是峰主，有一定门徒或威望
  const candidates = masters(w).filter(
    (d) => d.realm >= 5 && !w.peaks.some((p) => p.masterId === d.id) && relsOf(w, d.id).filter((r) => r.type === 'master' && r.a === d.id).length >= 0,
  )
  if (candidates.length === 0) return
  if (!rng.chance(0.25)) return // 不必每月开
  const founder = powerSort(candidates)[0]
  const type = peakTypeFor(w, founder)
  const peak: Peak = {
    id: 'peak' + ++w.idCounter,
    name: rng.pick(PEAK_PREFIXES) + PEAK_TYPE_INFO[type].suffix,
    type,
    founderId: founder.id,
    masterId: founder.id,
    signatureGongfa: founder.gongfa,
    treasure: founder.artifact,
    prestige: Math.round(disciplePower(founder) / 10),
    foundedDay: w.day,
  }
  w.peaks.push(peak)
  founder.peakId = peak.id
  log(w, 'system', `${founder.name}开辟${peak.name}，自成一脉。`, 4)
  chronicle(w, 'peak', `${founder.name}开${peak.name}，立一方道统。`)
}

/** 聚类（并查集/标签传播的简化版，docs/09 §8.4）：未归属的内门弟子并入最契合的峰 */
function assignToPeaks(w: WorldState): void {
  if (w.peaks.length === 0) return
  for (const d of w.disciples) {
    if (d.peakId || d.rank === 'outer') continue
    // 优先随师尊；否则按"最强师承/灵根契合/交情"挑峰
    const m = d.masterId ? getD(w, d.masterId) : undefined
    if (m?.peakId) {
      d.peakId = m.peakId
      continue
    }
    let best: Peak | null = null
    let bestScore = -1
    for (const p of w.peaks) {
      const pm = getD(w, p.masterId)
      if (!pm) continue
      const rel = relsOf(w, d.id).find((r) => (r.a === pm.id || r.b === pm.id))
      const affinity = (rel?.value ?? 0) + (peakTypeFor(w, d) === p.type ? 30 : 0) + p.prestige * 0.05
      if (affinity > bestScore) {
        bestScore = affinity
        best = p
      }
    }
    if (best) {
      d.peakId = best.id
      const pm = getD(w, best.masterId)
      if (pm && !d.masterId) bind(w, pm, d, d.shownAptitude >= 3 ? 'zhuan' : 'jiming')
    }
  }
}

/** 峰的威望聚合 + 衰亡 + 峰主继承（docs/09 §8.4） */
function updatePeakState(w: WorldState, rng: RNG): void {
  for (const p of [...w.peaks]) {
    const members = w.disciples.filter((d) => d.peakId === p.id)
    // 威望 = 成员战力之和 / 10
    p.prestige = Math.round(members.reduce((s, d) => s + disciplePower(d), 0) / 10)
    const master = getD(w, p.masterId)
    // 峰主陨落 → 由峰内最强继承；无人则衰亡
    if (!master || master.peakId !== p.id) {
      const heir = powerSort(members)[0]
      if (heir) {
        p.masterId = heir.id
        log(w, 'social', `${heir.name}接掌${p.name}，成新一代峰主。`)
        chronicle(w, 'peak', `${heir.name}继任${p.name}峰主。`)
      } else {
        w.peaks.splice(w.peaks.indexOf(p), 1)
        log(w, 'system', `${p.name}后继无人，就此凋零。`)
        chronicle(w, 'peak', `${p.name}传承断绝，并入宗门。`)
        for (const d of w.disciples) if (d.peakId === p.id) d.peakId = null
        continue
      }
    }
    // 极小概率峰争（威望相近的两峰争夺资源/真传）
    if (w.peaks.length >= 2 && rng.chance(0.01)) schedulePeakRivalry(w, rng)
  }
}

function schedulePeakRivalry(w: WorldState, rng: RNG): void {
  const sorted = [...w.peaks].sort((a, b) => b.prestige - a.prestige)
  const a = sorted[0]
  const b = sorted[1]
  if (!a || !b) return
  // 两峰摩擦：峰主关系恶化、各自门人忠诚微降
  const am = getD(w, a.masterId)
  const bm = getD(w, b.masterId)
  if (am && bm) {
    log(w, 'social', `${a.name}与${b.name}因真传名额起了龃龉。`)
    for (const d of w.disciples) {
      if (d.peakId === a.id || d.peakId === b.id) d.beliefs.loyalty = Math.max(0, d.beliefs.loyalty - 2)
    }
  }
  void rng
}

export const PEAK_TYPE_LABEL: Record<PeakType, string> = {
  sword: '剑峰', alchemy: '丹峰', forge: '器峰', array: '阵峰', beast: '御兽峰', teach: '传功峰', outer: '执事峰',
}
