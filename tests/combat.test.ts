import { describe, expect, it } from 'vitest'
import { winProb, resolveCombat, disciplePower } from '../src/engine/systems/combat'
import { SimEngine } from '../src/engine'
import { RNG } from '../src/engine/core/rng'

describe('胜负 S 曲线（docs/05 §2）', () => {
  it('R=1 时五五开', () => {
    expect(winProb(1)).toBeCloseTo(0.5)
  })
  it('R 越大胜率越高且渐近 1', () => {
    expect(winProb(2)).toBeCloseTo(0.8)
    expect(winProb(0.5)).toBeCloseTo(0.2)
    expect(winProb(10)).toBeGreaterThan(0.98)
  })
})

describe('战斗结算', () => {
  function makeEngine(seed = 'combat-test'): SimEngine {
    return new SimEngine(seed, { sectName: '测试宗', siteQuality: 3, siteDanger: 3 })
  }

  it('强队大概率胜过弱敌（蒙特卡洛 200 次）', () => {
    let wins = 0
    for (let i = 0; i < 200; i++) {
      const e = makeEngine('mc-' + i)
      const team = e.world.disciples // 含金丹祖师
      const power = team.reduce((s, d) => s + disciplePower(d), 0)
      const rng = RNG.fromSeed('battle-' + i)
      const { win } = resolveCombat(e.world, { kind: 'beast', enemyName: '弱小妖兽', enemyPower: power * 0.3 }, team, rng)
      if (win) wins++
    }
    expect(wins / 200).toBeGreaterThan(0.85)
  })

  it('战报包含节拍文本与收尾行', () => {
    const e = makeEngine()
    const rng = RNG.fromSeed('report')
    const { report } = resolveCombat(
      e.world,
      { kind: 'beast', enemyName: '试炼傀儡', enemyPower: 50 },
      e.world.disciples,
      rng,
    )
    expect(report.lines.length).toBeGreaterThanOrEqual(3)
    expect(report.lines[report.lines.length - 1].text).toMatch(/此役/)
    expect(report.title).toContain('试炼傀儡')
  })

  it('全灭风险：极强敌人会造成伤亡', () => {
    let casualties = 0
    for (let i = 0; i < 50; i++) {
      const e = makeEngine('lethal-' + i)
      const rng = RNG.fromSeed('lethal-battle-' + i)
      const r = resolveCombat(
        e.world,
        { kind: 'sectwar', enemyName: '灭世魔军', enemyPower: 1e7, lethality: 1 },
        e.world.disciples,
        rng,
      )
      casualties += r.report.casualties.length
      expect(r.win).toBe(false)
    }
    expect(casualties).toBeGreaterThan(10)
  })

  it('外门弟子无死亡保护阀，真传有一次', () => {
    const e = makeEngine('protect')
    const d = e.world.disciples.find((x) => x.rank === 'outer')!
    expect(d.deathProtected).toBe(false)
    // master 祖师享有保护
    const m = e.world.disciples.find((x) => x.rank === 'master')!
    expect(m.deathProtected).toBe(false) // 尚未消耗
  })
})
