// 极简事件总线：引擎向外（UI/无头运行器）单向通知

export type Channel = 'log' | 'interactive' | 'report' | 'chronicle' | 'gameover' | 'dirty'

type Handler = (payload: unknown) => void

export class Bus {
  private handlers: Map<Channel, Handler[]> = new Map()

  on(channel: Channel, fn: Handler): () => void {
    const list = this.handlers.get(channel) ?? []
    list.push(fn)
    this.handlers.set(channel, list)
    return () => {
      const cur = this.handlers.get(channel) ?? []
      this.handlers.set(channel, cur.filter((h) => h !== fn))
    }
  }

  emit(channel: Channel, payload?: unknown): void {
    for (const fn of this.handlers.get(channel) ?? []) fn(payload)
  }
}
