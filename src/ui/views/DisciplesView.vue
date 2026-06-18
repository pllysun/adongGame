<script setup lang="ts">
// 弟子名册（docs/06 §2）：表格 + 排序筛选，点击进详情
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { ACTION_NAMES, RANK_NAMES, RARITY_NAMES, realmLabel, rarityColor } from '@/shared/rarity'
import { ageYears } from '@/engine/core/clock'
import { LIFESPAN, cultNeed } from '@/engine/content/constants'
import Portrait from '../components/Portrait.vue'
import type { Disciple } from '@/shared/types'

const game = useGameStore()
const w = computed(() => game.snap!)

type SortKey = 'aptitude' | 'realm' | 'age' | 'mood'
const sortKey = ref<SortKey>('realm')
const filterRank = ref<string>('')

const list = computed(() => {
  let ds = [...w.value.disciples]
  if (filterRank.value) ds = ds.filter((d) => d.rank === filterRank.value)
  switch (sortKey.value) {
    case 'aptitude': ds.sort((a, b) => b.shownAptitude - a.shownAptitude); break
    case 'age': ds.sort((a, b) => a.birthDay - b.birthDay); break
    case 'mood': ds.sort((a, b) => a.mood - b.mood); break
    default: ds.sort((a, b) => b.realm * 10 + b.sub - (a.realm * 10 + a.sub))
  }
  return ds
})

function lifeRatio(d: Disciple): number {
  const age = ageYears(d.birthDay, w.value.day)
  return Math.min(1, age / LIFESPAN[Math.min(d.realm, 9)])
}
function cultRatio(d: Disciple): number {
  return Math.min(1, d.cultivation / cultNeed(d.realm, d.sub))
}
function moodIcon(d: Disciple): string {
  if (d.status === 'demonic') return '🌀'
  if (d.mood >= 60) return '😊'
  if (d.mood >= 20) return '🙂'
  if (d.mood > -20) return '😐'
  if (d.mood > -60) return '😟'
  return '😡'
}
function statusLabel(d: Disciple): string {
  switch (d.status) {
    case 'injured': return '负伤'
    case 'crippled': return '暗伤'
    case 'seclusion': return '闭关'
    case 'demonic': return '心魔'
    case 'dying': return '灯枯'
    default: return ''
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <div class="flex items-center gap-2 mb-3 text-sm">
      <span style="color: var(--ink-dim)">排序</span>
      <button v-for="k in ['realm', 'aptitude', 'age', 'mood'] as const" :key="k" class="btn text-xs"
        :style="sortKey === k ? 'color: var(--ink-gold); border-color: var(--ink-gold)' : ''"
        @click="sortKey = k">
        {{ { realm: '境界', aptitude: '资质', age: '年龄', mood: '心境' }[k] }}
      </button>
      <span class="ml-4" style="color: var(--ink-dim)">身份</span>
      <button class="btn text-xs" :style="!filterRank ? 'color: var(--ink-gold)' : ''" @click="filterRank = ''">全部</button>
      <button v-for="(label, rank) in RANK_NAMES" :key="rank" class="btn text-xs"
        :style="filterRank === rank ? 'color: var(--ink-gold)' : ''" @click="filterRank = String(rank)">
        {{ label }}
      </button>
    </div>

    <div class="grid grid-cols-1 gap-1.5">
      <div
        v-for="d in list"
        :key="d.id"
        class="panel px-3 py-2 flex items-center gap-3 cursor-pointer hover:brightness-110"
        @click="game.selectedId = d.id"
      >
        <Portrait :seed="d.portraitSeed" :gender="d.gender" :realm="d.realm" :rank="d.rank"
          :aptitude="d.shownAptitude" :mood="d.mood" :status="d.status" :size="40" />
        <div class="w-24">
          <div class="font-bold" :class="d.shownAptitude >= 6 ? 'rainbow-text' : ''"
            :style="d.shownAptitude < 6 ? { color: rarityColor(d.shownAptitude) } : {}">
            {{ d.name }}
          </div>
          <div class="text-xs" style="color: var(--ink-dim)">{{ RANK_NAMES[d.rank] }}</div>
        </div>
        <div class="w-24 text-sm">
          {{ realmLabel(d.realm, d.sub) }}
          <div class="h-1 mt-1 rounded overflow-hidden" style="background: var(--ink-panel2)">
            <div class="h-full" :style="{ width: cultRatio(d) * 100 + '%', background: 'var(--ink-gold)' }" />
          </div>
        </div>
        <div class="w-20 text-xs" :style="{ color: rarityColor(d.shownAptitude) }">
          {{ RARITY_NAMES.aptitude[d.shownAptitude] }}
        </div>
        <div class="w-20 text-xs">
          {{ ageYears(d.birthDay, w.day) }} 岁
          <div class="h-1 mt-1 rounded overflow-hidden" style="background: var(--ink-panel2)">
            <div class="h-full" :style="{
              width: lifeRatio(d) * 100 + '%',
              background: lifeRatio(d) > 0.85 ? '#ef4444' : '#22c55e',
            }" />
          </div>
        </div>
        <div class="w-10 text-center" :title="`心境 ${Math.round(d.mood)}`">{{ moodIcon(d) }}</div>
        <div class="w-14 text-xs" style="color: var(--ink-dim)">{{ ACTION_NAMES[d.action] }}</div>
        <div class="w-12 text-xs" style="color: #ef4444">{{ statusLabel(d) }}</div>
        <div v-if="d.bottleneck && d.sub === 2" class="text-xs" style="color: var(--ink-gold)">⚡瓶颈</div>
      </div>
    </div>
    <p v-if="list.length === 0" class="text-center py-12" style="color: var(--ink-dim)">空无一人。</p>
  </div>
</template>
