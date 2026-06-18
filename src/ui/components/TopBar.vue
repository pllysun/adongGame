<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore, type Speed } from '../stores/game'
import { sound } from '../sound'
import { ref } from 'vue'

defineProps<{ dateStr: string }>()
const game = useGameStore()
const s = computed(() => game.snap?.sect)
const muted = ref(false)
function toggleMute(): void {
  muted.value = sound.toggleMute()
}
const SPEEDS: { v: Speed; label: string }[] = [
  { v: 0, label: '⏸' },
  { v: 1, label: '▶' },
  { v: 3, label: '▶▶' },
  { v: 10, label: '▶▶▶' },
]
</script>

<template>
  <header
    v-if="s"
    class="h-12 shrink-0 flex items-center gap-4 px-4 border-b"
    style="border-color: var(--ink-border); background: var(--ink-panel)"
  >
    <span class="text-lg font-bold tracking-widest" style="color: var(--ink-gold)">{{ s.name }}</span>
    <span class="text-sm" style="color: var(--ink-dim)">{{ dateStr }}</span>

    <div class="flex items-center gap-3 text-sm ml-4">
      <span title="灵石">💰 {{ Math.floor(s.stones) }}</span>
      <span title="灵米">🌾 {{ Math.floor(s.rice) }}</span>
      <span title="灵草">🌿 {{ Math.floor(s.herbs) }}</span>
      <span title="材料">⛏ {{ Math.floor(s.materials) }}</span>
      <span title="声望">📜 {{ Math.floor(s.reputation) }}</span>
      <span title="弟子数">👥 {{ game.snap!.disciples.length }}</span>
    </div>

    <div class="ml-auto flex items-center gap-1">
      <button
        v-for="sp in SPEEDS"
        :key="sp.v"
        class="btn text-xs px-2.5"
        :style="game.speed === sp.v ? 'border-color: var(--ink-gold); color: var(--ink-gold)' : ''"
        @click="sp.v === 0 ? game.togglePause() : game.setSpeed(sp.v)"
      >
        {{ sp.label }}
      </button>
      <button class="btn text-xs ml-2" @click="toggleMute">{{ muted ? '🔇' : '🔊' }}</button>
    </div>
  </header>
</template>
