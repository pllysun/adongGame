// 极简 WebAudio 音效与生成式古风 BGM（M7）：无外部音频文件，全部程序合成
class SoundManager {
  private ctx: AudioContext | null = null
  private bgmTimer: number | null = null
  muted = false
  bgmOn = true

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        return null
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** 拨弦音（五声音阶），模拟古琴泛音 */
  private pluck(freq: number, when = 0, dur = 1.2, gain = 0.08): void {
    const ctx = this.ensure()
    if (!ctx || this.muted) return
    const t = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur)
    // 一点泛音
    const o2 = ctx.createOscillator()
    const g2 = ctx.createGain()
    o2.type = 'sine'
    o2.frequency.value = freq * 2
    g2.gain.setValueAtTime(gain * 0.3, t)
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6)
    o2.connect(g2).connect(ctx.destination)
    o2.start(t)
    o2.stop(t + dur)
  }

  event(): void {
    this.pluck(523.25, 0, 0.8, 0.06) // C5
  }
  breakthrough(): void {
    this.pluck(392, 0, 1.0)
    this.pluck(523.25, 0.12, 1.0)
    this.pluck(659.25, 0.24, 1.4)
  }
  combat(): void {
    const ctx = this.ensure()
    if (!ctx || this.muted) return
    // 战鼓：低频噪声脉冲
    const t = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(110, t + i * 0.18)
      osc.frequency.exponentialRampToValueAtTime(50, t + i * 0.18 + 0.15)
      g.gain.setValueAtTime(0.12, t + i * 0.18)
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.2)
      osc.connect(g).connect(ctx.destination)
      osc.start(t + i * 0.18)
      osc.stop(t + i * 0.18 + 0.25)
    }
  }
  click(): void {
    this.pluck(880, 0, 0.15, 0.03)
  }

  /** 生成式 BGM：宫调五声音阶随机漫步，每 4~7 秒一记泛音 */
  startBgm(): void {
    if (this.bgmTimer !== null || !this.bgmOn) return
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25] // C D E G A C
    let idx = 2
    const step = (): void => {
      if (!this.bgmOn || this.muted) {
        this.bgmTimer = window.setTimeout(step, 3000)
        return
      }
      idx = Math.max(0, Math.min(scale.length - 1, idx + Math.floor(Math.random() * 3) - 1))
      this.pluck(scale[idx] / 2, 0, 3.2, 0.035)
      if (Math.random() < 0.3) this.pluck(scale[(idx + 2) % scale.length] / 2, 0.4, 2.4, 0.02)
      this.bgmTimer = window.setTimeout(step, 3500 + Math.random() * 3000)
    }
    this.bgmTimer = window.setTimeout(step, 1200)
  }
  stopBgm(): void {
    if (this.bgmTimer !== null) {
      clearTimeout(this.bgmTimer)
      this.bgmTimer = null
    }
  }
  toggleMute(): boolean {
    this.muted = !this.muted
    return this.muted
  }
}

export const sound = new SoundManager()
