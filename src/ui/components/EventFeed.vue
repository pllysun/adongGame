<script setup lang="ts">
// 右侧事件流（docs/06 §1）：小事件常驻滚动，按类别着色
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { formatDate } from '@/engine/core/clock'

const game = useGameStore()
const entries = computed(() => (game.snap ? [...game.snap.log].reverse().slice(0, 80) : []))

const CAT_COLOR: Record<string, string> = {
  event: '#c9a227',
  breakthrough: '#a855f7',
  combat: '#ef4444',
  economy: '#8a8170',
  social: '#5eead4',
  death: '#9ca3af',
  system: '#60a5fa',
}
</script>

<template>
  <aside
    class="w-72 shrink-0 border-l flex flex-col min-h-0"
    style="border-color: var(--ink-border); background: var(--ink-panel)"
  >
    <div class="px-3 py-2 text-sm border-b" style="border-color: var(--ink-border); color: var(--ink-dim)">
      事 件 流
    </div>
    <div class="flex-1 overflow-y-auto px-3 py-2 space-y-2">
      <div v-for="(e, i) in entries" :key="i" class="text-xs leading-relaxed">
        <span class="opacity-50">{{ formatDate(e.day).replace('天玄历', '') }}</span>
        <span class="mx-1" :style="{ color: CAT_COLOR[e.cat] ?? 'var(--ink-text)' }">·</span>
        <span :style="e.rarity !== undefined && e.rarity >= 4 ? { color: CAT_COLOR[e.cat] } : {}">{{ e.text }}</span>
      </div>
    </div>
  </aside>
</template>
