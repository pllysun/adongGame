<script setup lang="ts">
// 战报播放器（docs/05 §4）：逐段淡入的战报文学
import { computed, ref, watch } from 'vue'
import { useGameStore } from '../../stores/game'

const game = useGameStore()
const report = computed(() => game.activeReport!)
const shown = ref(0)

let timer: number | null = null
watch(
  () => report.value?.uid,
  () => {
    shown.value = 0
    if (timer) clearInterval(timer)
    timer = window.setInterval(() => {
      shown.value++
      if (shown.value >= (report.value?.lines.length ?? 0)) {
        if (timer) clearInterval(timer)
      }
    }, 650)
  },
  { immediate: true },
)

function skipAll(): void {
  shown.value = report.value.lines.length
  if (timer) clearInterval(timer)
}
function close(): void {
  if (timer) clearInterval(timer)
  game.activeReport = null
  if (!game.pending && !game.snap?.gameOver) game.resume()
}

const TONE_COLOR: Record<string, string> = {
  good: '#22c55e',
  bad: '#ef4444',
  highlight: '#c9a227',
  neutral: 'var(--ink-text)',
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: #000c" @click="skipAll">
    <div class="panel w-[640px] max-h-[864px] flex flex-col" @click.stop="skipAll">
      <div class="px-5 py-3 border-b flex items-center" style="border-color: var(--ink-border)">
        <span class="text-lg tracking-widest" :style="{ color: report.win ? '#22c55e' : '#ef4444' }">
          ⚔ {{ report.title }} · {{ report.win ? '胜' : '败' }}
        </span>
      </div>
      <div class="p-5 overflow-y-auto space-y-3 min-h-[200px]">
        <p
          v-for="(line, i) in report.lines.slice(0, shown)"
          :key="i"
          class="beat-line leading-loose text-[15px]"
          :style="{ color: TONE_COLOR[line.tone] }"
        >
          {{ line.text }}
        </p>
      </div>
      <div class="px-5 py-3 border-t flex justify-end gap-2" style="border-color: var(--ink-border)">
        <button v-if="shown < report.lines.length" class="btn" @click.stop="skipAll">跳过演出</button>
        <button v-else class="btn btn-primary" @click.stop="close">收兵</button>
      </div>
    </div>
  </div>
</template>
