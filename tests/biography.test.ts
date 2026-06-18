import { describe, expect, it } from 'vitest'
import { SimEngine } from '../src/engine'
import { remember, condense, traceCause, findRecentByTag, hasMemoryTag, countMemoryTag } from '../src/engine/systems/biography'

function disciple() {
  const e = new SimEngine('bio', { sectName: '测试', siteQuality: 3, siteDanger: 3 })
  return { w: e.world, d: e.world.disciples[0] }
}

describe('记忆与经历树', () => {
  it('remember 写心相 + 增删特质 + 记录', () => {
    const { w, d } = disciple()
    d.beliefs.xinmo = 0
    remember(d, 100, { eventId: 'e1', text: '丧侣之痛', tags: ['丧侣'], impact: { xinmo: 20, traitGained: 'ruthless' } })
    expect(d.beliefs.xinmo).toBeGreaterThan(0)
    expect(d.traits).toContain('ruthless')
    expect(d.memories.at(-1)!.text).toBe('丧侣之痛')
    void w
  })
  it('traitGained 互斥替换；traitLost 移除', () => {
    const { d } = disciple()
    d.traits = ['merciful']
    remember(d, 1, { eventId: 'e', text: 'x', impact: { traitGained: 'ruthless' } }) // ruthless 与 merciful 互斥
    expect(d.traits).toContain('ruthless')
    expect(d.traits).not.toContain('merciful')
    remember(d, 2, { eventId: 'e', text: 'y', impact: { traitLost: 'ruthless' } })
    expect(d.traits).not.toContain('ruthless')
  })
  it('标签查询：findRecentByTag / hasMemoryTag / countMemoryTag', () => {
    const { d } = disciple()
    remember(d, 10, { eventId: 'a', text: '1', tags: ['丧侣'] })
    remember(d, 20, { eventId: 'b', text: '2', tags: ['丧侣'] })
    expect(hasMemoryTag(d, '丧侣')).toBe(true)
    expect(hasMemoryTag(d, '无此')).toBe(false)
    expect(countMemoryTag(d, '丧侣')).toBe(2)
    expect(findRecentByTag(d, '丧侣')!.day).toBe(20)
    expect(findRecentByTag(d, '无此')).toBeUndefined()
  })
  it('causedByTag 连成因果链，traceCause 可回溯', () => {
    const { d } = disciple()
    remember(d, 10, { eventId: 'root', text: '丧侣', tags: ['丧侣'] })
    const child = remember(d, 50, { eventId: 'fall', text: '堕魔', tags: ['堕魔'], causedByTag: '丧侣' })
    expect(child.causedBy).toBe(10)
    const chain = traceCause(d, child)
    expect(chain).toHaveLength(2)
    expect(chain[0].text).toBe('丧侣')
    expect(chain[1].text).toBe('堕魔')
  })
  it('condense：超量琐事被凝练成摘要，转折点保留', () => {
    const { d } = disciple()
    for (let i = 0; i < 30; i++) remember(d, i * 10, { eventId: 'm', text: '琐事' + i, kind: 'minor' })
    remember(d, 999, { eventId: 't', text: '大事', kind: 'turning' })
    condense(d)
    expect(d.memories.some((m) => m.tags.includes('condensed'))).toBe(true)
    expect(d.memories.some((m) => m.kind === 'turning' && m.text === '大事')).toBe(true)
    expect(d.memories.length).toBeLessThan(31)
  })
  it('记忆软上限自动触发凝练（不会无限膨胀）', () => {
    const { d } = disciple()
    for (let i = 0; i < 80; i++) remember(d, i, { eventId: 'm', text: 'x' + i, kind: 'minor' })
    expect(d.memories.length).toBeLessThanOrEqual(45)
  })
})
