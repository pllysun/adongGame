<script setup lang="ts">
// 藏经阁：功法收藏 + 修习者一览
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { GONGFA_MAP } from '@/engine/content/gongfa'
import { ELEMENT_NAMES, RARITY_NAMES, realmLabel, rarityColor } from '@/shared/rarity'

const game = useGameStore()
const w = computed(() => game.snap!)

const list = computed(() =>
  w.value.sect.gongfa
    .map((id) => GONGFA_MAP.get(id)!)
    .sort((a, b) => b.rarity - a.rarity)
    .map((g) => ({
      def: g,
      learners: w.value.disciples.filter((d) => d.gongfa === g.id).length,
    })),
)
const libLevel = computed(() => w.value.sect.facilities['library'] ?? 0)
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <p class="text-sm mb-3" style="color: var(--ink-dim)">
      藏经阁 {{ libLevel }} 级：可收藏 {{ RARITY_NAMES.gongfa[Math.max(0, Math.min(6, libLevel - 1))] }}（含）以下功法。
      在弟子详情页中为弟子传功。
    </p>
    <div class="space-y-2">
      <div v-for="g in list" :key="g.def.id" class="panel px-4 py-3 flex items-center gap-4">
        <span class="font-bold w-44" :style="{ color: rarityColor(g.def.rarity) }">{{ g.def.name }}</span>
        <span class="text-xs w-12" :style="{ color: rarityColor(g.def.rarity) }">{{ RARITY_NAMES.gongfa[g.def.rarity] }}</span>
        <span class="text-xs w-16">{{ g.def.elements.map((e) => ELEMENT_NAMES[e]).join('') || '无属性' }}</span>
        <span class="text-xs w-24" style="color: var(--ink-dim)">上限 {{ realmLabel(g.def.realmCap) }}</span>
        <span class="text-xs w-20" style="color: var(--ink-dim)">速度 ×{{ g.def.speedBase.toFixed(2) }}</span>
        <span class="text-xs w-16" style="color: var(--ink-dim)">战力 +{{ Math.round(g.def.combatMod * 100) }}%</span>
        <span class="text-xs ml-auto">{{ g.learners }} 人修习</span>
      </div>
    </div>
  </div>
</template>
