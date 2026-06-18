<script setup lang="ts">
// 丹房丹库：库存一览（炼制由丹房按月自动进行，docs/03）
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { PILLS, PILL_MAP } from '@/engine/content/pills'
import { RARITY_NAMES, rarityColor } from '@/shared/rarity'

const game = useGameStore()
const w = computed(() => game.snap!)
const alchemyLv = computed(() => w.value.sect.facilities['alchemy'] ?? 0)

const stock = computed(() =>
  Object.entries(w.value.sect.pills)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ def: PILL_MAP.get(id)!, n }))
    .sort((a, b) => b.def.rarity - a.def.rarity),
)
const KIND_NAMES: Record<string, string> = {
  breakthrough: '突破', healing: '疗伤', mood: '静心', cultivation: '修炼',
}
const craftable = computed(() => PILLS.filter((p) => p.minFacility <= alchemyLv.value))
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <p class="text-sm mb-3" style="color: var(--ink-dim)">
      炼丹房 {{ alchemyLv }} 级{{ alchemyLv > 0 ? '：丹师每月自行炼制（需有弟子执勤），灵草是原料' : '：尚未建造' }}。
      现存灵草 {{ Math.floor(w.sect.herbs) }}。
    </p>

    <h3 class="text-sm mb-2" style="color: var(--ink-gold)">丹库存量</h3>
    <div v-if="stock.length > 0" class="space-y-1.5 mb-6">
      <div v-for="p in stock" :key="p.def.id" class="panel px-4 py-2 flex items-center gap-4 text-sm">
        <span class="font-bold w-32" :style="{ color: rarityColor(p.def.rarity) }">{{ p.def.name }}</span>
        <span class="text-xs w-12">{{ RARITY_NAMES.pill[p.def.rarity] }}</span>
        <span class="text-xs w-12" style="color: var(--ink-dim)">{{ KIND_NAMES[p.def.kind] }}</span>
        <span class="ml-auto">×{{ p.n }}</span>
      </div>
    </div>
    <p v-else class="text-sm mb-6" style="color: var(--ink-dim)">丹库空空。</p>

    <h3 class="text-sm mb-2" style="color: var(--ink-gold)">本级丹房可炼丹方</h3>
    <div class="flex flex-wrap gap-1.5">
      <span v-for="p in craftable" :key="p.id" class="px-2 py-1 rounded text-xs border"
        :style="{ borderColor: 'var(--ink-border)', color: rarityColor(p.rarity) }">
        {{ p.name }}（灵草 {{ p.herbs }}）
      </span>
      <span v-if="craftable.length === 0" class="text-xs" style="color: var(--ink-dim)">无</span>
    </div>
  </div>
</template>
