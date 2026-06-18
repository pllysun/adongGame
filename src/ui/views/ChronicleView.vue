<script setup lang="ts">
// 编年史（docs/06 §4）：宗门大事记，按甲子分卷
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { formatDate } from '@/engine/core/clock'

const game = useGameStore()

const volumes = computed(() => {
  const entries = game.snap!.chronicle
  const map = new Map<number, typeof entries>()
  for (const e of entries) {
    const vol = Math.floor(e.day / (360 * 60))
    if (!map.has(vol)) map.set(vol, [])
    map.get(vol)!.push(e)
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([vol, list]) => ({
      vol,
      title: `第${'一二三四五六七八九十'[vol] ?? vol + 1}卷 · ${vol * 60 + 1}—${(vol + 1) * 60} 年`,
      list: [...list].reverse(),
    }))
})

const KIND_ICON: Record<string, string> = {
  founding: '🏔', breakthrough: '⚡', death: '🕯', war: '⚔', recruit: '🌱',
  defect: '🌫', demonic: '🌀', awaken: '✨', gongfa: '📜', treasure: '💎',
  legend: '🌈', succession: '👑', ascension: '🌅', end: '📕',
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div v-for="v in volumes" :key="v.vol" class="mb-6">
      <h3 class="text-base mb-3 tracking-widest" style="color: var(--ink-gold)">{{ v.title }}</h3>
      <div class="border-l-2 pl-4 space-y-3" style="border-color: var(--ink-border)">
        <div v-for="(e, i) in v.list" :key="i" class="relative">
          <span class="absolute -left-[1.42rem] text-xs">{{ KIND_ICON[e.kind] ?? '·' }}</span>
          <div class="text-xs mb-0.5" style="color: var(--ink-dim)">{{ formatDate(e.day) }}</div>
          <div class="text-sm leading-relaxed">{{ e.text }}</div>
        </div>
      </div>
    </div>
    <p v-if="volumes.length === 0" class="text-center py-12" style="color: var(--ink-dim)">史册尚白。</p>
  </div>
</template>
