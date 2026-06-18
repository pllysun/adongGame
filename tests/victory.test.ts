import { describe, expect, it } from 'vitest'
import { SimEngine } from '../src/engine'

/** 按 ai 权重最高的可用选项处理交互（模拟理性玩家） */
function drainSmart(e: SimEngine): void {
  let guard = 0
  while (e.world.queue.length > 0 && guard++ < 100) {
    const item = e.world.queue[0]
    const enabled = item.options.filter((o) => !o.disabled)
    const best = enabled.sort((a, b) => (b.ai ?? 1) - (a.ai ?? 1))[0] ?? item.options[0]
    const selection =
      item.kind === 'recruit'
        ? ((item.payload as { candidates: { id: string }[] }).candidates ?? []).slice(0, 4).map((c) => c.id)
        : item.kind === 'combat-setup'
          ? e.world.disciples.slice(0, 4).map((d) => d.id)
          : undefined
    e.command({ type: 'resolve', uid: item.uid, option: best.idx, selection })
  }
}

describe('胜负判定（docs/00）', () => {
  it('三位渡劫大能 → 飞升大典事件链 → 举宗飞升胜利', () => {
    const e = new SimEngine('victory-test', { sectName: '飞升宗', siteQuality: 5, siteDanger: 1 })
    // 直构终局态：三位渡劫期 + 筑台资源
    for (const d of e.world.disciples.slice(0, 3)) {
      d.realm = 9
      d.sub = 1
      d.rank = 'elder'
    }
    e.world.sect.stones = 20000
    e.world.sect.materials = 8000

    for (let day = 0; day < 360 * 6 && !e.world.gameOver; day++) {
      e.tick()
      drainSmart(e)
    }
    expect(e.world.gameOver?.type).toBe('victory')
    // 编年史收口：飞升记入史册
    expect(e.world.chronicle.some((c) => c.kind === 'end' && c.text.includes('飞升'))).toBe(true)
  }, 30_000)

  it('弟子归零 → 灭门失败', () => {
    const e = new SimEngine('defeat-test', { sectName: '灭门宗', siteQuality: 1, siteDanger: 5 })
    e.world.disciples.length = 0
    for (let day = 0; day < 40 && !e.world.gameOver; day++) e.tick()
    expect(e.world.gameOver?.type).toBe('defeat')
  })
})
