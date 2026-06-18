// 种子化随机数（sfc32）。引擎内一切随机必须经由本模块，保证同种子同结果。

export type RngState = [number, number, number, number]

export class RNG {
  private s: RngState

  constructor(state: RngState) {
    this.s = [...state] as RngState
  }

  static fromSeed(seed: string): RNG {
    // xmur3 字符串散列产生初始状态
    let h = 1779033703 ^ seed.length
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
      h = (h << 13) | (h >>> 19)
    }
    const next = () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507)
      h = Math.imul(h ^ (h >>> 13), 3266489909)
      return (h ^= h >>> 16) >>> 0
    }
    const rng = new RNG([next(), next(), next(), next()])
    for (let i = 0; i < 12; i++) rng.next() // warm up
    return rng
  }

  getState(): RngState {
    return [...this.s] as RngState
  }

  next(): number {
    const s = this.s
    s[0] >>>= 0; s[1] >>>= 0; s[2] >>>= 0; s[3] >>>= 0
    let t = (s[0] + s[1]) | 0
    s[0] = s[1] ^ (s[1] >>> 9)
    s[1] = (s[2] + (s[2] << 3)) | 0
    s[2] = (s[2] << 21) | (s[2] >>> 11)
    s[3] = (s[3] + 1) | 0
    t = (t + s[3]) | 0
    s[2] = (s[2] + t) | 0
    return (t >>> 0) / 4294967296
  }

  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  /** 按 weight 字段加权抽取 */
  weighted<T>(items: readonly T[], weightOf: (t: T) => number): T | null {
    let total = 0
    for (const it of items) total += Math.max(0, weightOf(it))
    if (total <= 0) return null
    let roll = this.next() * total
    for (const it of items) {
      roll -= Math.max(0, weightOf(it))
      if (roll <= 0) return it
    }
    return items[items.length - 1]
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  /** 近似正态（3 次均匀平均），返回 [min,max] */
  normalInt(min: number, max: number): number {
    const u = (this.next() + this.next() + this.next()) / 3
    return min + Math.floor(u * (max - min + 1))
  }

  fork(label: string): RNG {
    const mix = RNG.fromSeed(label + ':' + this.next().toString(36))
    return mix
  }
}
