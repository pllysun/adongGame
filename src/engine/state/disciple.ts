// 弟子生成（docs/01 §1）：招收候选、种子弟子、开局祖师
import type { Disciple, Element, Gender, Rarity, WorldState } from '@/shared/types'
import { DAYS_PER_YEAR } from '../core/clock'
import { APTITUDE_WEIGHTS, REP_SHIFT_MAX } from '../content/constants'
import { TRAITS } from '../content/traits'
import { genName } from '../content/names'
import { deriveBeliefs, emptyBeliefs } from '../systems/psyche'
import type { RNG } from '../core/rng'

const ELEMENTS: Element[] = ['metal', 'wood', 'water', 'fire', 'earth']

export function takenNames(w: WorldState): Set<string> {
  const s = new Set<string>()
  for (const d of w.disciples) s.add(d.name)
  for (const d of w.departed) s.add(d.name)
  return s
}

/** 资质抽取：声望把凡品权重向灵/玄/地再分配，天品以上几乎不受影响（docs/01 §2） */
export function rollAptitude(rng: RNG, reputation: number): Rarity {
  const w = [...APTITUDE_WEIGHTS]
  const shift = Math.min(REP_SHIFT_MAX, reputation / 1000) * w[0]
  w[0] -= shift
  w[1] += shift * 0.55
  w[2] += shift * 0.33
  w[3] += shift * 0.12
  const idx = rng.weighted(
    w.map((weight, i) => ({ weight, i })),
    (x) => x.weight,
  )
  return (idx?.i ?? 0) as Rarity
}

function rollRoots(rng: RNG, aptitude: Rarity): { elements: Element[]; purity: number } {
  // 资质越高，属性数越少、纯度越高（弱正相关）
  const countRoll = rng.next() + aptitude * 0.09
  const count = countRoll > 1.05 ? 1 : countRoll > 0.78 ? 2 : countRoll > 0.5 ? 3 : countRoll > 0.25 ? 4 : 5
  const elements = rng.shuffle([...ELEMENTS]).slice(0, count)
  const purityCap = count === 1 ? 10 : count === 2 ? 8 : count === 3 ? 6 : 4
  const purity = Math.max(1, Math.min(purityCap, rng.normalInt(1, purityCap) + Math.floor(aptitude / 2)))
  return { elements, purity: Math.min(10, purity) }
}

function rollStat(rng: RNG, aptitude: Rarity): number {
  // 1-10，与资质弱正相关
  return Math.max(1, Math.min(10, rng.normalInt(1, 8) + Math.floor(aptitude / 2)))
}

function rollTraits(rng: RNG): string[] {
  const n = rng.int(2, 4)
  const picked: string[] = []
  const banned = new Set<string>()
  const pool = rng.shuffle([...TRAITS])
  for (const t of pool) {
    if (picked.length >= n) break
    if (banned.has(t.id)) continue
    // 大器晚成/伤仲永/福星/灾星 这类强隐藏特质压低出率
    const rare = ['lateBloomer', 'earlyFade', 'blessed', 'cursed'].includes(t.id)
    if (rare && !rng.chance(0.3)) continue
    picked.push(t.id)
    banned.add(t.id)
    if (t.opposite) banned.add(t.opposite)
  }
  return picked
}

export interface GenOptions {
  ageYears?: [number, number]
  realm?: number
  sub?: 0 | 1 | 2
  rank?: Disciple['rank']
  minAptitude?: Rarity
  gongfa?: string | null
}

export function generateDisciple(rng: RNG, w: WorldState, opts: GenOptions = {}): Disciple {
  const gender: Gender = rng.chance(0.5) ? 'm' : 'f'
  const name = genName(rng, gender, takenNames(w))
  let aptitude = rollAptitude(rng, w.sect.reputation)
  if (opts.minAptitude !== undefined && aptitude < opts.minAptitude) aptitude = opts.minAptitude
  const traits = rollTraits(rng)
  // 表显资质：大器晚成 -1~-2 品，伤仲永按真实显示（恶果在曲线上）
  let shown = aptitude
  if (traits.includes('lateBloomer')) shown = Math.max(0, aptitude - rng.int(1, 2)) as Rarity
  const [ageMin, ageMax] = opts.ageYears ?? [8, 16]
  const age = rng.int(ageMin, ageMax)
  const luck = rollStat(rng, 0) + (traits.includes('blessed') ? 3 : 0) - (traits.includes('cursed') ? 3 : 0)

  const d: Disciple = {
    id: 'd' + ++w.idCounter,
    name,
    gender,
    birthDay: w.day - age * DAYS_PER_YEAR,
    joinDay: w.day,
    aptitude,
    shownAptitude: shown,
    roots: rollRoots(rng, aptitude),
    comprehension: rollStat(rng, aptitude),
    mindstate: rollStat(rng, aptitude),
    luck: Math.max(1, Math.min(10, luck)),
    traits,
    realm: opts.realm ?? 1,
    sub: opts.sub ?? 0,
    cultivation: 0,
    bottleneck: false,
    breakthroughFails: 0,
    mood: rng.int(0, 30),
    status: 'normal',
    statusUntil: 0,
    rank: opts.rank ?? 'outer',
    action: 'cultivate',
    gongfa: opts.gongfa !== undefined ? opts.gongfa : null,
    artifact: null,
    combatExp: 0,
    portraitSeed: rng.int(0, 2 ** 31),
    deathProtected: false,
    buffs: {},
    beliefs: emptyBeliefs(),
    memories: [],
    masterId: null,
    peakId: null,
    lineageTier: null,
  }
  d.beliefs = deriveBeliefs(d)
  return d
}

/** 开局祖师：金丹初期长者，资质地品保底 */
export function generateFounder(rng: RNG, w: WorldState): Disciple {
  const d = generateDisciple(rng, w, {
    ageYears: [120, 200],
    realm: 3,
    sub: 0,
    rank: 'master',
    minAptitude: rng.chance(0.25) ? 4 : 3,
    gongfa: 'taiyi',
  })
  d.combatExp = rng.int(5, 12)
  d.mood = 40
  return d
}
