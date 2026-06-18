// 无头模拟运行器（docs/07 §6）：npm run sim -- --years 300 --runs 10 --seed base
import { SimEngine } from '../engine'
import { AutoPlayer } from './autoPlayer'
import { RARITY_NAMES, REALM_NAMES } from '../shared/rarity'

interface RunStats {
  years: number
  extinct: boolean
  victory: boolean
  finalPop: number
  stones: number
  reputation: number
  firstRealmYear: Record<number, number>
  maxRealmByAptitude: Record<number, number>
  realmCounts: Record<number, number>
  totalRecruits: number
  totalDeparted: number
  // 命途/师承/峰指标
  causes: Record<string, number>
  avgBeliefs: { daoxin: number; xinmo: number; molean: number; loyalty: number; fame: number }
  demonicNow: number
  peakCount: number
  withMaster: number
  avgMemories: number
  maxMemories: number
  // 分布尾部：人格分化是否真的发生
  highMolean: number // 在世魔修（molean>30）
  highXinmo: number // 在世心魔深重（xinmo>40）
  highDaoxin: number // 在世道心通明（daoxin>75）
  tagHist: Record<string, number> // 经历标签直方图
}

function arg(name: string, def: string): string {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

function runOne(seed: string, years: number): RunStats {
  const engine = new SimEngine(seed, { sectName: '青云宗', siteQuality: 3, siteDanger: 3 })
  const player = new AutoPlayer(engine, seed + '-player')
  const days = years * 360
  for (let i = 0; i < days; i++) {
    engine.tick()
    player.step()
    if (engine.world.gameOver) break
  }
  const w = engine.world
  const maxRealmByAptitude: Record<number, number> = {}
  const realmCounts: Record<number, number> = {}
  for (const d of w.disciples) {
    maxRealmByAptitude[d.aptitude] = Math.max(maxRealmByAptitude[d.aptitude] ?? 0, d.realm)
    realmCounts[d.realm] = (realmCounts[d.realm] ?? 0) + 1
  }
  for (const d of w.departed) {
    maxRealmByAptitude[d.aptitude] = Math.max(maxRealmByAptitude[d.aptitude] ?? 0, d.realm)
  }
  const firstRealmYear: Record<number, number> = {}
  for (const [realm, day] of Object.entries(w.stats.firstRealm)) firstRealmYear[+realm] = Math.round(+day / 360)
  // 离场原因统计（含命途结局：叛逃/弑师/堕魔等）
  const causes: Record<string, number> = {}
  for (const d of w.departed) causes[d.cause] = (causes[d.cause] ?? 0) + 1
  // 心相均值（含离场前的最后状态无法取，仅取在世）
  const bel = { daoxin: 0, xinmo: 0, molean: 0, loyalty: 0, fame: 0 }
  let memSum = 0
  let memMax = 0
  let highMolean = 0
  let highXinmo = 0
  let highDaoxin = 0
  const tagHist: Record<string, number> = {}
  for (const d of w.disciples) {
    bel.daoxin += d.beliefs.daoxin
    bel.xinmo += d.beliefs.xinmo
    bel.molean += d.beliefs.molean
    bel.loyalty += d.beliefs.loyalty
    bel.fame += d.beliefs.fame
    memSum += d.memories.length
    memMax = Math.max(memMax, d.memories.length)
    if (d.beliefs.molean > 30) highMolean++
    if (d.beliefs.xinmo > 40) highXinmo++
    if (d.beliefs.daoxin > 75) highDaoxin++
    for (const m of d.memories) for (const t of m.tags) if (!t.startsWith('因:')) tagHist[t] = (tagHist[t] ?? 0) + 1
  }
  const n = Math.max(1, w.disciples.length)
  return {
    years: Math.round(w.day / 360),
    extinct: w.gameOver?.type === 'defeat',
    victory: w.gameOver?.type === 'victory',
    finalPop: w.disciples.length,
    stones: w.sect.stones,
    reputation: w.sect.reputation,
    firstRealmYear,
    maxRealmByAptitude,
    realmCounts,
    totalRecruits: w.stats.recruitsTotal,
    totalDeparted: w.departed.length,
    causes,
    avgBeliefs: { daoxin: bel.daoxin / n, xinmo: bel.xinmo / n, molean: bel.molean / n, loyalty: bel.loyalty / n, fame: bel.fame / n },
    demonicNow: w.disciples.filter((d) => d.status === 'demonic').length,
    peakCount: w.peaks.length,
    withMaster: w.disciples.filter((d) => d.masterId).length,
    avgMemories: memSum / n,
    maxMemories: memMax,
    highMolean,
    highXinmo,
    highDaoxin,
    tagHist,
  }
}

function main(): void {
  const years = +arg('years', '300')
  const runs = +arg('runs', '5')
  const seedBase = arg('seed', 'sim')
  const t0 = performance.now()
  const all: RunStats[] = []
  for (let i = 0; i < runs; i++) {
    const s = runOne(`${seedBase}-${i}`, years)
    all.push(s)
    console.log(
      `run ${i}: ${s.years}y pop=${s.finalPop} stones=${s.stones} rep=${s.reputation}` +
        ` recruits=${s.totalRecruits} departed=${s.totalDeparted}` +
        (s.extinct ? ' [灭门]' : s.victory ? ' [飞升]' : ''),
    )
  }
  const ms = performance.now() - t0
  console.log(`\n=== 汇总（${runs} 局 × ${years} 年，耗时 ${(ms / 1000).toFixed(1)}s）===`)
  console.log(`灭门率: ${((all.filter((s) => s.extinct).length / runs) * 100).toFixed(0)}%`)
  console.log(`飞升率: ${((all.filter((s) => s.victory).length / runs) * 100).toFixed(0)}%`)
  console.log(`平均存续人口: ${(all.reduce((a, s) => a + s.finalPop, 0) / runs).toFixed(1)}`)

  // 首个境界达成年代
  for (const realm of [3, 4, 5, 6, 7, 8, 9]) {
    const ys = all.map((s) => s.firstRealmYear[realm]).filter((y): y is number => y !== undefined)
    if (ys.length > 0)
      console.log(
        `首个${REALM_NAMES[realm]}: ${ys.length}/${runs} 局达成，平均第 ${(ys.reduce((a, b) => a + b, 0) / ys.length).toFixed(0)} 年`,
      )
  }
  // 资质 → 最高境界
  console.log('\n资质 → 最高境界（跨局最大值）:')
  for (let a = 0; a <= 6; a++) {
    const m = Math.max(...all.map((s) => s.maxRealmByAptitude[a] ?? 0))
    if (m > 0) console.log(`  ${RARITY_NAMES.aptitude[a as never]}: ${REALM_NAMES[m]}`)
  }

  // ── 命途 / 师承 / 峰 ──
  console.log('\n=== 命途·师承·峰 ===')
  const avg = (f: (s: RunStats) => number) => all.reduce((a, s) => a + f(s), 0) / runs
  const b = (k: keyof RunStats['avgBeliefs']) => avg((s) => s.avgBeliefs[k]).toFixed(0)
  console.log(`在世心相均值: 道心${b('daoxin')} 心魔${b('xinmo')} 魔倾${b('molean')} 忠诚${b('loyalty')} 声名${b('fame')}`)
  console.log(`当前心魔缠身: ${avg((s) => s.demonicNow).toFixed(1)} 人/局`)
  console.log(`峰数: ${avg((s) => s.peakCount).toFixed(1)} / 有师承弟子: ${avg((s) => s.withMaster).toFixed(1)}`)
  console.log(`记忆: 人均 ${avg((s) => s.avgMemories).toFixed(1)} 条，最长 ${Math.max(...all.map((s) => s.maxMemories))} 条`)
  console.log(`人格分化(在世): 魔修 ${avg((s) => s.highMolean).toFixed(1)} / 心魔深 ${avg((s) => s.highXinmo).toFixed(1)} / 道心通明 ${avg((s) => s.highDaoxin).toFixed(1)}`)
  const tagTotal: Record<string, number> = {}
  for (const s of all) for (const [t, c] of Object.entries(s.tagHist)) tagTotal[t] = (tagTotal[t] ?? 0) + c
  console.log('经历标签(在世)Top:', Object.entries(tagTotal).sort((a, c) => c[1] - a[1]).slice(0, 12).map(([t, c]) => `${t}:${c}`).join(' '))
  // 离场原因汇总（命途结局占比）
  const causeTotal: Record<string, number> = {}
  for (const s of all) for (const [c, n] of Object.entries(s.causes)) causeTotal[c] = (causeTotal[c] ?? 0) + n
  const sorted = Object.entries(causeTotal).sort((a, c) => c[1] - a[1])
  console.log('离场原因 Top:')
  for (const [c, n] of sorted.slice(0, 10)) console.log(`  ${c}: ${n}`)
}

main()
