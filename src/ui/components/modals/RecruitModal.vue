<script setup lang="ts">
// 招收大会（docs/03 §3）：候选人卡片墙，勾选录取
import { computed, ref } from 'vue'
import { useGameStore } from '../../stores/game'
import { ELEMENT_NAMES, RARITY_NAMES, rarityColor } from '@/shared/rarity'
import { sectCapacity } from '@/engine/content/facilities'
import { ageYears } from '@/engine/core/clock'
import Portrait from '../Portrait.vue'
import type { Disciple } from '@/shared/types'

const game = useGameStore()
const item = computed(() => game.pending!)
const candidates = computed(() => (item.value.payload as { candidates: Disciple[] }).candidates)
const selected = ref(new Set<string>())

const capacity = computed(() => Math.max(0, sectCapacity(game.snap!) - game.snap!.disciples.length))

function toggle(id: string): void {
  if (selected.value.has(id)) selected.value.delete(id)
  else if (selected.value.size < capacity.value) selected.value.add(id)
  selected.value = new Set(selected.value)
}
function confirm(): void {
  game.resolve(item.value.uid, 0, [...selected.value])
}
function skip(): void {
  game.resolve(item.value.uid, 1)
}
function pickBest(): void {
  const sorted = [...candidates.value].sort(
    (a, b) => b.shownAptitude - a.shownAptitude || b.roots.purity - a.roots.purity,
  )
  selected.value = new Set(sorted.slice(0, capacity.value).map((c) => c.id))
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: #000b">
    <div class="panel w-[860px] max-h-[950px] flex flex-col">
      <div class="px-5 py-3 border-b flex items-center" style="border-color: var(--ink-border)">
        <span class="text-lg tracking-widest" style="color: var(--ink-gold)">开山收徒大会</span>
        <span class="ml-4 text-sm" style="color: var(--ink-dim)">
          已选 {{ selected.size }} / 名额 {{ capacity }}
        </span>
        <button class="btn text-xs ml-auto" @click="pickBest">按资质优选</button>
      </div>
      <div class="p-4 overflow-y-auto grid grid-cols-4 gap-2">
        <div
          v-for="c in candidates"
          :key="c.id"
          class="p-2 rounded border cursor-pointer text-center transition-colors"
          :style="{
            borderColor: selected.has(c.id) ? 'var(--ink-gold)' : 'var(--ink-border)',
            background: selected.has(c.id) ? 'var(--ink-panel2)' : 'transparent',
          }"
          @click="toggle(c.id)"
        >
          <Portrait :seed="c.portraitSeed" :gender="c.gender" :realm="1" rank="outer"
            :aptitude="c.shownAptitude" :size="64" />
          <div class="mt-1 text-sm font-bold" :style="{ color: rarityColor(c.shownAptitude) }">{{ c.name }}</div>
          <div class="text-xs" :style="{ color: rarityColor(c.shownAptitude) }">
            {{ RARITY_NAMES.aptitude[c.shownAptitude] }}
          </div>
          <div class="text-xs mt-0.5" style="color: var(--ink-dim)">
            {{ c.roots.elements.map((e) => ELEMENT_NAMES[e]).join('') }}根·纯{{ c.roots.purity }} 悟{{ c.comprehension }}
          </div>
          <div class="text-xs" style="color: var(--ink-dim)">{{ ageYears(c.birthDay, game.snap!.day) }} 岁</div>
        </div>
      </div>
      <div class="px-5 py-3 border-t flex gap-2 justify-end" style="border-color: var(--ink-border)">
        <button class="btn" @click="skip">一个不收</button>
        <button class="btn btn-primary" @click="confirm">录取所选（{{ selected.size }} 人）</button>
      </div>
    </div>
  </div>
</template>
