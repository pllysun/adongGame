import { describe, expect, it } from 'vitest'
import { GONGFA } from '../src/engine/content/gongfa'
import { PILLS } from '../src/engine/content/pills'
import { ARTIFACTS } from '../src/engine/content/artifacts'
import { TRAITS } from '../src/engine/content/traits'
import { BEATS, SPECIAL_BEATS } from '../src/engine/content/beats'
import { FACILITIES } from '../src/engine/content/facilities'
import { RARITY_NAMES, RARITY_COLORS } from '../src/shared/rarity'

describe('内容库规模（docs/08 M6 验收）', () => {
  it('功法 40+', () => expect(GONGFA.length).toBeGreaterThanOrEqual(40))
  it('丹药 20+', () => expect(PILLS.length).toBeGreaterThanOrEqual(20))
  it('特质 30+', () => expect(TRAITS.length).toBeGreaterThanOrEqual(30))
  it('战斗节拍 30+（含特殊节拍）', () =>
    expect(BEATS.length + Object.keys(SPECIAL_BEATS).length).toBeGreaterThanOrEqual(30))
  it('设施 10 座', () => expect(FACILITIES.length).toBeGreaterThanOrEqual(10))
  it('法宝 15+', () => expect(ARTIFACTS.length).toBeGreaterThanOrEqual(15))
})

describe('内容引用完整性（zod 替代：结构校验）', () => {
  it('id 全局唯一（功法/丹药/法宝/特质）', () => {
    for (const list of [GONGFA, PILLS, ARTIFACTS, TRAITS] as { id: string }[][]) {
      const ids = new Set(list.map((x) => x.id))
      expect(ids.size).toBe(list.length)
    }
  })

  it('特质互斥对双向一致', () => {
    const map = new Map(TRAITS.map((t) => [t.id, t]))
    for (const t of TRAITS) {
      if (t.opposite) {
        const o = map.get(t.opposite)
        expect(o, `${t.id} 的对立特质 ${t.opposite} 不存在`).toBeDefined()
        expect(o!.opposite).toBe(t.id)
      }
    }
  })

  it('七阶稀有度：四域名称表与颜色表齐全', () => {
    expect(RARITY_COLORS).toHaveLength(7)
    for (const domain of ['aptitude', 'gongfa', 'pill', 'artifact'] as const) {
      expect(RARITY_NAMES[domain]).toHaveLength(7)
    }
  })

  it('功法品阶越高速度与境界上限越高（趋势）', () => {
    const byRarity = (r: number) => GONGFA.filter((g) => g.rarity === r)
    for (let r = 1; r <= 6; r++) {
      const cur = byRarity(r)
      const prev = byRarity(r - 1)
      if (cur.length === 0 || prev.length === 0) continue
      const avgSpeed = (l: typeof cur) => l.reduce((s, g) => s + g.speedBase, 0) / l.length
      expect(avgSpeed(cur)).toBeGreaterThan(avgSpeed(prev))
      expect(Math.max(...cur.map((g) => g.realmCap))).toBeGreaterThanOrEqual(Math.max(...prev.map((g) => g.realmCap)))
    }
  })

  it('设施造价随等级递增', () => {
    for (const f of FACILITIES) {
      for (let l = 2; l <= f.maxLevel; l++) {
        expect(f.cost(l).stones).toBeGreaterThan(f.cost(l - 1).stones)
      }
    }
  })
})
