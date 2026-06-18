// 游戏主 store（docs/07 §2 快照模式）：引擎对象 markRaw 持有，UI 只消费浅响应式快照
import { defineStore } from 'pinia'
import { markRaw, ref, shallowRef } from 'vue'
import type { Command, Interactive, ScenarioConfig, WorldState, BattleReport, SaveBlob } from '@/shared/types'
import { SimEngine } from '@/engine'
import { sound } from '@/ui/sound'

export type Speed = 0 | 1 | 3 | 10
export type NavView =
  | 'overview' | 'disciples' | 'facilities' | 'library' | 'alchemy' | 'rules' | 'chronicle' | 'inbox'

const DAYS_PER_SEC = 3 // 1x 速度（docs/07 §3）
const SAVE_KEY = 'wending-save-v1'

export const useGameStore = defineStore('game', () => {
  const engine = shallowRef<SimEngine | null>(null)
  const snap = shallowRef<WorldState | null>(null)
  const speed = ref<Speed>(1)
  const speedBeforePause = ref<Speed>(1)
  const view = ref<NavView>('overview')
  const selectedId = ref<string | null>(null)
  const pending = shallowRef<Interactive | null>(null)
  const inboxOpen = shallowRef<Interactive | null>(null) // 从收件箱手动打开查看的事件
  const activeReport = shallowRef<BattleReport | null>(null)
  const seenReports = new Set<number>()
  const started = ref(false)

  let raf = 0
  let lastT = 0
  let acc = 0
  let lastSnapAt = 0

  function refreshSnap(force = false): void {
    const e = engine.value
    if (!e) return
    const now = performance.now()
    if (!force && now - lastSnapAt < 120) return
    lastSnapAt = now
    snap.value = structuredClone(e.world)
    // 新战报弹出
    const reports = e.world.reports
    const fresh = reports.filter((r) => !seenReports.has(r.uid))
    if (fresh.length > 0) {
      for (const r of fresh) seenReports.add(r.uid)
      activeReport.value = fresh[fresh.length - 1]
      sound.combat()
      pause()
    }
    // 待决交互 → 自动暂停（docs/07 §3）
    const head = e.world.queue[0] ?? null
    if (head && head.uid !== pending.value?.uid) {
      pending.value = head
      if (head.pause) pause()
      sound.event()
    } else if (!head) {
      pending.value = null
    }
    if (e.world.gameOver && speed.value !== 0) pause()
  }

  function loop(t: number): void {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(200, t - lastT)
    lastT = t
    const e = engine.value
    if (!e || speed.value === 0 || e.world.gameOver) return
    acc += (dt / 1000) * DAYS_PER_SEC * speed.value
    let steps = Math.floor(acc)
    acc -= steps
    if (steps > 60) steps = 60
    for (let i = 0; i < steps; i++) {
      e.tick()
      if (e.hasPending || e.world.gameOver) break
    }
    if (steps > 0) refreshSnap()
    // 每游戏年自动存档
    if (e.world.day % 360 === 0 && steps > 0) autosave()
  }

  function startLoop(): void {
    cancelAnimationFrame(raf)
    lastT = performance.now()
    raf = requestAnimationFrame(loop)
  }

  function newGame(seed: string, scenario: ScenarioConfig): void {
    const e = new SimEngine(seed, scenario)
    engine.value = markRaw(e)
    started.value = true
    speed.value = 1
    seenReports.clear()
    for (const r of e.world.reports) seenReports.add(r.uid)
    refreshSnap(true)
    startLoop()
    sound.startBgm()
  }

  function command(cmd: Command): { ok: boolean; error?: string } {
    const e = engine.value
    if (!e) return { ok: false, error: 'no engine' }
    const r = e.command(cmd)
    refreshSnap(true)
    return r
  }

  function resolve(uid: number, option: number, selection?: string[]): void {
    command({ type: 'resolve', uid, option, selection })
    if (inboxOpen.value?.uid === uid) inboxOpen.value = null
    pending.value = engine.value?.world.queue[0] ?? null
    if (!pending.value && !engine.value?.world.gameOver) resume()
  }

  /** 从收件箱打开一条事件查看处理（不影响时间流速） */
  function openInbox(uid: number): void {
    const it = engine.value?.world.inbox.find((q) => q.uid === uid) ?? null
    inboxOpen.value = it
  }
  function closeInbox(): void {
    inboxOpen.value = null
  }
  function dismissInbox(uid: number): void {
    command({ type: 'dismissInbox', uid })
    if (inboxOpen.value?.uid === uid) inboxOpen.value = null
  }

  function pause(): void {
    if (speed.value !== 0) speedBeforePause.value = speed.value
    speed.value = 0
  }
  function resume(): void {
    speed.value = speedBeforePause.value || 1
  }
  function setSpeed(s: Speed): void {
    speed.value = s
    if (s !== 0) speedBeforePause.value = s
  }
  function togglePause(): void {
    if (speed.value === 0) resume()
    else pause()
  }

  // ── 存档（docs/07 §5）：autosave + 手动档 ──
  function autosave(): void {
    const e = engine.value
    if (!e) return
    try {
      localStorage.setItem(SAVE_KEY + '-auto', JSON.stringify(e.save()))
    } catch {
      /* 存档失败不阻塞游戏 */
    }
  }
  function saveTo(slot: string): boolean {
    const e = engine.value
    if (!e) return false
    try {
      localStorage.setItem(SAVE_KEY + '-' + slot, JSON.stringify(e.save()))
      return true
    } catch {
      return false
    }
  }
  function loadFrom(slot: string): boolean {
    const raw = localStorage.getItem(SAVE_KEY + '-' + slot)
    if (!raw) return false
    try {
      const blob = JSON.parse(raw) as SaveBlob
      const e = SimEngine.load(blob)
      engine.value = markRaw(e)
      started.value = true
      seenReports.clear()
      for (const r of e.world.reports) seenReports.add(r.uid)
      pending.value = e.world.queue[0] ?? null
      refreshSnap(true)
      pause()
      startLoop()
      sound.startBgm()
      return true
    } catch {
      return false
    }
  }
  function hasSave(slot: string): boolean {
    return localStorage.getItem(SAVE_KEY + '-' + slot) !== null
  }

  return {
    engine, snap, speed, view, selectedId, pending, inboxOpen, activeReport, started,
    newGame, command, resolve, openInbox, closeInbox, dismissInbox,
    pause, resume, setSpeed, togglePause,
    saveTo, loadFrom, hasSave, autosave, refreshSnap,
  }
})
