<script setup lang="ts">
// 全分辨率统一：整个 UI 按固定设计分辨率 1920×1080 等比缩放铺满视口（letterbox 居中）。
// 1080p/2K/4K 均为 16:9 → 布局像素级一致，只是整体放大缩小（1080p×1.0、2K×1.333、4K×2.0）。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from './stores/game'
import SetupView from './views/SetupView.vue'
import MainLayout from './views/MainLayout.vue'

const game = useGameStore()

const DESIGN_W = 1920
const DESIGN_H = 1080
const scale = ref(1)

function recalc(): void {
  scale.value = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H)
}
onMounted(() => {
  recalc()
  window.addEventListener('resize', recalc)
})
onUnmounted(() => window.removeEventListener('resize', recalc))

const stageStyle = computed(() => ({
  width: DESIGN_W + 'px',
  height: DESIGN_H + 'px',
  transform: `scale(${scale.value})`,
}))
</script>

<template>
  <div class="fit-root">
    <div class="fit-stage" :style="stageStyle">
      <SetupView v-if="!game.started" />
      <MainLayout v-else />
    </div>
  </div>
</template>

<style>
.fit-root {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--ink-bg);
}
.fit-stage {
  flex: none;
  transform-origin: center center;
}
</style>
