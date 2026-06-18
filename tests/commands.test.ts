import { describe, expect, it } from 'vitest'
import { SimEngine } from '../src/engine'

function mk(seed = 'cmd') {
  return new SimEngine(seed, { sectName: '令宗', siteQuality: 3, siteDanger: 3 })
}

describe('玩家指令（index.ts 门面）', () => {
  it('build：成功扣资源、不足报错、满级报错', () => {
    const e = mk()
    e.world.sect.stones = 100000
    e.world.sect.materials = 100000
    const r = e.command({ type: 'build', facility: 'field' })
    expect(r.ok).toBe(true)
    const bad = e.command({ type: 'build', facility: '不存在' })
    expect(bad.ok).toBe(false)
    e.world.sect.stones = 0
    const poor = e.command({ type: 'build', facility: 'array' })
    expect(poor.ok).toBe(false)
  })
  it('build：需高境界坐镇的设施在无人时报错', () => {
    const e = mk()
    e.world.sect.stones = 100000
    e.world.sect.materials = 100000
    e.world.disciples.forEach((d) => (d.realm = 1))
    const r = e.command({ type: 'build', facility: 'forge' })
    expect(r.ok).toBe(false)
  })
  it('setRule 改门规', () => {
    const e = mk()
    expect(e.command({ type: 'setRule', key: 'allowCouple', value: false }).ok).toBe(true)
    expect(e.world.sect.rules.allowCouple).toBe(false)
  })
  it('grantPill 各类丹药生效；丹库不足报错', () => {
    const e = mk()
    const d = e.world.disciples[0]
    e.world.sect.pills = { qingxin: 1, jinchuang: 1, juqi: 1, juling: 1 }
    d.status = 'injured'
    d.statusUntil = e.world.day + 1000
    expect(e.command({ type: 'grantPill', discipleId: d.id, pillId: 'jinchuang' }).ok).toBe(true)
    expect(e.command({ type: 'grantPill', discipleId: d.id, pillId: 'qingxin' }).ok).toBe(true)
    expect(e.command({ type: 'grantPill', discipleId: d.id, pillId: 'juqi' }).ok).toBe(true)
    expect(e.command({ type: 'grantPill', discipleId: d.id, pillId: 'juling' }).ok).toBe(true)
    expect(e.command({ type: 'grantPill', discipleId: d.id, pillId: 'qingxin' }).ok).toBe(false)
  })
  it('grantArtifact 装备并回收旧法宝', () => {
    const e = mk()
    const d = e.world.disciples[0]
    e.world.sect.artifacts = ['qingfengjian', 'tiejian']
    expect(e.command({ type: 'grantArtifact', discipleId: d.id, artifactId: 'qingfengjian' }).ok).toBe(true)
    expect(d.artifact).toBe('qingfengjian')
    e.command({ type: 'grantArtifact', discipleId: d.id, artifactId: 'tiejian' })
    expect(e.world.sect.artifacts).toContain('qingfengjian') // 旧的回库
    expect(e.command({ type: 'grantArtifact', discipleId: d.id, artifactId: '无' }).ok).toBe(false)
  })
  it('setGongfa 换功法折损；藏经阁无则报错', () => {
    const e = mk()
    const d = e.world.disciples[0]
    d.cultivation = 1000
    e.world.sect.gongfa = ['zixia']
    expect(e.command({ type: 'setGongfa', discipleId: d.id, gongfaId: 'zixia' }).ok).toBe(true)
    expect(d.cultivation).toBeLessThan(1000)
    expect(e.command({ type: 'setGongfa', discipleId: d.id, gongfaId: '无' }).ok).toBe(false)
  })
  it('setRank / expel', () => {
    const e = mk()
    const d = e.world.disciples[0]
    expect(e.command({ type: 'setRank', discipleId: d.id, rank: 'elder' }).ok).toBe(true)
    expect(d.rank).toBe('elder')
    const id = d.id
    expect(e.command({ type: 'expel', discipleId: id }).ok).toBe(true)
    expect(e.world.disciples.find((x) => x.id === id)).toBeUndefined()
    expect(e.command({ type: 'expel', discipleId: id }).ok).toBe(false)
  })
  it('divineIntervene：气运足则扭转心相、记经历、递增成本', () => {
    const e = mk()
    const d = e.world.disciples[0]
    e.world.sect.qiyun = 100
    d.beliefs.xinmo = 80
    const r = e.command({ type: 'divineIntervene', discipleId: d.id, toward: 'xinmo' })
    expect(r.ok).toBe(true)
    expect(d.beliefs.xinmo).toBeLessThan(80)
    expect(e.world.divineFavor).toBe(1)
    expect(d.memories.some((m) => m.tags.includes('天道亲临'))).toBe(true)
    e.world.sect.qiyun = 0
    expect(e.command({ type: 'divineIntervene', discipleId: d.id, toward: 'daoxin' }).ok).toBe(false)
  })
  it('appointPeakMaster / allocatePeak', () => {
    const e = mk()
    const d = e.world.disciples[0]
    e.world.peaks = [{ id: 'p1', name: '剑峰', type: 'sword', founderId: d.id, masterId: 'x', signatureGongfa: null, treasure: null, prestige: 10, foundedDay: 0 }]
    expect(e.command({ type: 'appointPeakMaster', peakId: 'p1', discipleId: d.id }).ok).toBe(true)
    expect(e.world.peaks[0].masterId).toBe(d.id)
    e.world.sect.stones = 1000
    expect(e.command({ type: 'allocatePeak', peakId: 'p1', stones: 200 }).ok).toBe(true)
    expect(e.world.sect.stones).toBe(800)
    expect(e.command({ type: 'allocatePeak', peakId: '无', stones: 1 }).ok).toBe(false)
  })
  it('resolve：无效 uid 报错', () => {
    const e = mk()
    expect(e.command({ type: 'resolve', uid: 99999, option: 0 }).ok).toBe(false)
  })
  it('save/load 往返一致、load 后可继续', () => {
    const e = mk('roundtrip')
    const drain = (eng: SimEngine) => {
      let g = 0
      while (eng.world.queue.length && g++ < 50) {
        const it = eng.world.queue[0]
        const sel = it.kind === 'recruit' ? [] : it.kind === 'combat-setup' ? eng.world.disciples.slice(0, 3).map((d) => d.id) : undefined
        eng.command({ type: 'resolve', uid: it.uid, option: 1, selection: sel })
      }
    }
    for (let i = 0; i < 720; i++) {
      drain(e)
      e.tick()
    }
    drain(e)
    const day0 = e.world.day
    const blob = e.save()
    const e2 = SimEngine.load(blob)
    expect(e2.world.day).toBe(day0)
    expect(e2.world.disciples.length).toBe(e.world.disciples.length)
    for (let i = 0; i < 100; i++) {
      drain(e2)
      e2.tick()
    }
    expect(e2.world.day).toBeGreaterThan(day0)
  })
})
