import { describe, expect, it } from 'vitest'
import { SimEngine } from '../src/engine'
import { AutoPlayer } from '../src/headless/autoPlayer'
import { LIFESPAN } from '../src/engine/content/constants'
import { ageYears } from '../src/engine/core/clock'

describe('长程模拟不变量（docs/07 §6 无头验证）', () => {
  it('100 年模拟：资源非负、心境在界、寿元不超限、关系边引用有效', () => {
    const e = new SimEngine('invariant-run', { sectName: '验宗', siteQuality: 3, siteDanger: 3 })
    const p = new AutoPlayer(e, 'inv')
    for (let day = 0; day < 360 * 100; day++) {
      e.tick()
      p.step()
      if (day % 360 !== 0) continue
      const w = e.world
      // 资源
      expect(w.sect.stones).toBeGreaterThanOrEqual(0)
      expect(w.sect.rice).toBeGreaterThanOrEqual(0)
      expect(w.sect.herbs).toBeGreaterThanOrEqual(0)
      // 弟子
      const ids = new Set(w.disciples.map((d) => d.id))
      expect(ids.size).toBe(w.disciples.length) // id 唯一
      for (const d of w.disciples) {
        expect(d.mood).toBeGreaterThanOrEqual(-100)
        expect(d.mood).toBeLessThanOrEqual(100)
        expect(d.realm).toBeGreaterThanOrEqual(1)
        expect(d.realm).toBeLessThanOrEqual(9)
        expect(ageYears(d.birthDay, w.day)).toBeLessThanOrEqual(LIFESPAN[Math.min(d.realm, 9)] + 1)
        expect(d.cultivation).toBeGreaterThanOrEqual(0)
      }
      // 关系边引用有效
      for (const r of w.relations) {
        expect(ids.has(r.a)).toBe(true)
        expect(ids.has(r.b)).toBe(true)
      }
      if (w.gameOver) break
    }
  }, 60_000)

  it('世代更替发生：百年后有死亡记录且宗门仍在（或合理灭门）', () => {
    const e = new SimEngine('generations', { sectName: '世宗', siteQuality: 3, siteDanger: 2 })
    const p = new AutoPlayer(e, 'gen')
    for (let day = 0; day < 360 * 130 && !e.world.gameOver; day++) {
      e.tick()
      p.step()
    }
    expect(e.world.departed.length).toBeGreaterThan(0) // 凡人寿元 ~120，必有坐化
    expect(e.world.chronicle.length).toBeGreaterThan(1)
  }, 60_000)

  it('性能预算（docs/07 §7）：模拟 50 年 < 3 秒', () => {
    const t0 = performance.now()
    const e = new SimEngine('perf', { sectName: '速宗', siteQuality: 3, siteDanger: 3 })
    const p = new AutoPlayer(e, 'perf')
    for (let day = 0; day < 360 * 50 && !e.world.gameOver; day++) {
      e.tick()
      p.step()
    }
    expect(performance.now() - t0).toBeLessThan(3000)
  }, 10_000)
})

describe('经济系统', () => {
  it('开局十年经济可运转（不破产螺旋）', () => {
    const e = new SimEngine('economy-check', { sectName: '钱宗', siteQuality: 3, siteDanger: 1 })
    const p = new AutoPlayer(e, 'eco')
    let zeroMonths = 0
    for (let day = 0; day < 360 * 10; day++) {
      e.tick()
      p.step()
      if (day % 30 === 0 && e.world.sect.stones === 0) zeroMonths++
    }
    expect(zeroMonths).toBeLessThan(60) // 120 个月里赤字月数过半则经济模型有问题
  }, 20_000)
})
