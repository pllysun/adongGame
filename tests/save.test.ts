import { describe, expect, it } from 'vitest'
import { SimEngine } from '../src/engine'
import { AutoPlayer } from '../src/headless/autoPlayer'

function runDays(engine: SimEngine, player: AutoPlayer, days: number): void {
  for (let i = 0; i < days; i++) {
    engine.tick()
    player.step()
  }
}

describe('存档系统（docs/07 §5）', () => {
  it('存读档后继续推进，世界状态与原线完全一致（确定性）', () => {
    const a = new SimEngine('determinism', { sectName: '甲宗', siteQuality: 3, siteDanger: 2 })
    const pa = new AutoPlayer(a, 'p')
    runDays(a, pa, 360 * 3)

    // 存档 → 读档
    const blob = JSON.parse(JSON.stringify(a.save()))
    const b = SimEngine.load(blob)
    const pb = new AutoPlayer(b, 'p2') // 注意：自动玩家有独立 RNG

    // 双线各自推进（不经过自动玩家随机决策的纯引擎日，保证可比）
    for (let i = 0; i < 360; i++) {
      // 若出现交互，双方用相同的固定策略（选 0 + 全选）
      drain(a)
      drain(b)
      a.tick()
      b.tick()
    }
    drain(a)
    drain(b)
    expect(JSON.stringify(a.world)).toBe(JSON.stringify(b.world))
    void pa
    void pb
  })

  it('存档为纯 JSON 且包含版本号', () => {
    const e = new SimEngine('json-test', { sectName: '乙宗', siteQuality: 2, siteDanger: 2 })
    const blob = e.save()
    expect(blob.version).toBe(3)
    expect(() => JSON.stringify(blob)).not.toThrow()
    const parsed = JSON.parse(JSON.stringify(blob))
    expect(parsed.world.sect.name).toBe('乙宗')
  })

  it('v1→v2 迁移：回填命途字段，旧档可读', () => {
    const e = new SimEngine('mig', { sectName: '迁宗', siteQuality: 3, siteDanger: 3 })
    const blob = JSON.parse(JSON.stringify(e.save())) as ReturnType<SimEngine['save']>
    // 伪造一个 v1 档：删掉命途字段、降版本
    blob.version = 1
    for (const d of blob.world.disciples) {
      delete (d as Partial<typeof d>).beliefs
      delete (d as Partial<typeof d>).memories
      delete (d as Partial<typeof d>).masterId
    }
    delete (blob.world as Partial<typeof blob.world>).peaks
    delete (blob.world as Partial<typeof blob.world>).sectStage
    const loaded = SimEngine.load(blob)
    expect(loaded.world.disciples.every((d) => !!d.beliefs && Array.isArray(d.memories))).toBe(true)
    expect(Array.isArray(loaded.world.peaks)).toBe(true)
    expect(loaded.world.sectStage).toBe('founding')
    // 迁移后能继续推进不崩
    for (let i = 0; i < 360; i++) loaded.tick()
    expect(loaded.world.day).toBeGreaterThan(0)
  })
})

function drain(e: SimEngine): void {
  let guard = 0
  while (e.world.queue.length > 0 && guard++ < 50) {
    const item = e.world.queue[0]
    const selection =
      item.kind === 'recruit'
        ? ((item.payload as { candidates: { id: string }[] }).candidates ?? []).slice(0, 5).map((c) => c.id)
        : item.kind === 'combat-setup'
          ? e.world.disciples.slice(0, 4).map((d) => d.id)
          : undefined
    e.command({ type: 'resolve', uid: item.uid, option: 0, selection })
  }
}
