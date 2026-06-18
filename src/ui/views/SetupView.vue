<script setup lang="ts">
// 开局流程（docs/06）：选址 → 命名 → 建宗；亦可读档
import { ref } from 'vue'
import { generateSites, type SiteOption } from '@/engine'
import { RNG } from '@/engine/core/rng'
import { useGameStore } from '../stores/game'

const game = useGameStore()
const sectName = ref('青云宗')
const seed = ref('')
const sites = ref<SiteOption[]>([])
const selected = ref(0)

function roll(): void {
  const s = seed.value || String(Math.floor(Math.random() * 1e9))
  seed.value = s
  sites.value = generateSites(RNG.fromSeed(s + ':sites'))
}
roll()

function start(): void {
  const site = sites.value[selected.value]
  game.newGame(seed.value, {
    sectName: sectName.value || '青云宗',
    siteQuality: site.quality,
    siteDanger: site.danger,
  })
}
</script>

<template>
  <div class="h-full flex items-center justify-center">
    <div class="panel p-8 w-[640px]">
      <h1 class="text-3xl text-center mb-1 tracking-[0.5em]" style="color: var(--ink-gold)">问鼎仙途</h1>
      <p class="text-center text-sm mb-6" style="color: var(--ink-dim)">执天道之手，育一宗仙苗，看百年兴衰</p>

      <div class="mb-4">
        <label class="text-sm block mb-1" style="color: var(--ink-dim)">宗门名号</label>
        <input
          v-model="sectName"
          maxlength="8"
          class="w-full px-3 py-2 rounded border bg-transparent outline-none"
          style="border-color: var(--ink-border)"
        />
      </div>

      <div class="mb-2 flex items-center justify-between">
        <label class="text-sm" style="color: var(--ink-dim)">开宗选址（品质与凶险并存）</label>
        <button class="btn text-xs" @click="roll">换一批灵脉</button>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-6">
        <div
          v-for="(s, i) in sites"
          :key="s.name"
          class="p-3 rounded border cursor-pointer transition-colors"
          :style="{
            borderColor: selected === i ? 'var(--ink-gold)' : 'var(--ink-border)',
            background: selected === i ? 'var(--ink-panel2)' : 'transparent',
          }"
          @click="selected = i"
        >
          <div class="font-bold mb-1">{{ s.name }}</div>
          <div class="text-xs mb-1" style="color: var(--ink-dim)">{{ s.desc }}</div>
          <div class="text-xs">
            灵脉 <span style="color: var(--ink-gold)">{{ '★'.repeat(s.quality) }}{{ '☆'.repeat(5 - s.quality) }}</span>
            凶险 <span style="color: #ef4444">{{ '★'.repeat(s.danger) }}{{ '☆'.repeat(5 - s.danger) }}</span>
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-primary flex-1 py-2 text-lg" @click="start">开宗立派</button>
        <button v-if="game.hasSave('auto')" class="btn flex-1 py-2" @click="game.loadFrom('auto')">读取自动存档</button>
        <button v-if="game.hasSave('1')" class="btn flex-1 py-2" @click="game.loadFrom('1')">读取存档一</button>
      </div>
    </div>
  </div>
</template>
