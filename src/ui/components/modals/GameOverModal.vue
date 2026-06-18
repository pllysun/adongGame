<script setup lang="ts">
// 终局（docs/00）：胜败皆生成编年史回顾
import { computed } from 'vue'
import { useGameStore } from '../../stores/game'
import { formatDate } from '@/engine/core/clock'

const game = useGameStore()
const over = computed(() => game.snap!.gameOver!)
const highlights = computed(() => {
  const c = game.snap!.chronicle
  return c.length <= 14 ? c : [...c.slice(0, 4), ...c.slice(-10)]
})

function restart(): void {
  location.reload()
}
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center" style="background: #000d">
    <div class="panel w-[640px] max-h-[918px] flex flex-col" :class="over.type === 'victory' ? 'rainbow-border' : ''">
      <div class="px-6 py-4 text-center border-b" style="border-color: var(--ink-border)">
        <div class="text-3xl tracking-[0.4em] mb-2" :style="{ color: over.type === 'victory' ? 'var(--ink-gold)' : '#9ca3af' }">
          {{ over.type === 'victory' ? '举宗飞升' : '宗门倾覆' }}
        </div>
        <div class="text-sm" style="color: var(--ink-dim)">{{ formatDate(over.day) }} · {{ over.reason }}</div>
      </div>
      <div class="p-6 overflow-y-auto">
        <h3 class="text-sm mb-3" style="color: var(--ink-gold)">宗门史诗回顾</h3>
        <div class="border-l-2 pl-4 space-y-2.5" style="border-color: var(--ink-border)">
          <div v-for="(e, i) in highlights" :key="i">
            <span class="text-xs mr-2" style="color: var(--ink-dim)">{{ formatDate(e.day) }}</span>
            <span class="text-sm">{{ e.text }}</span>
          </div>
        </div>
      </div>
      <div class="px-6 py-4 border-t text-center" style="border-color: var(--ink-border)">
        <button class="btn btn-primary px-8" @click="restart">再开一宗</button>
      </div>
    </div>
  </div>
</template>
