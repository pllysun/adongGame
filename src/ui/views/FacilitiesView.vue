<script setup lang="ts">
// 设施建设（docs/03 §2）
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { FACILITIES } from '@/engine/content/facilities'
import { rarityColor } from '@/shared/rarity'

const game = useGameStore()
const w = computed(() => game.snap!)

const list = computed(() =>
  FACILITIES.map((f) => {
    const level = w.value.sect.facilities[f.id] ?? 0
    const next = level < f.maxLevel ? f.cost(level + 1) : null
    const affordable = next ? w.value.sect.stones >= next.stones && w.value.sect.materials >= next.materials : false
    return { def: f, level, next, affordable }
  }),
)

function build(id: string): void {
  const r = game.command({ type: 'build', facility: id })
  if (!r.ok && r.error) errorMsg.value = r.error
  else errorMsg.value = ''
}
import { ref } from 'vue'
const errorMsg = ref('')
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <p v-if="errorMsg" class="text-sm mb-2" style="color: #ef4444">{{ errorMsg }}</p>
    <div class="grid grid-cols-2 gap-3">
      <div v-for="f in list" :key="f.def.id" class="panel p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="font-bold" :style="{ color: f.level > 0 ? rarityColor(Math.min(6, f.level - 1) as never) : 'var(--ink-dim)' }">
            {{ f.def.name }}
          </span>
          <span class="text-sm" style="color: var(--ink-dim)">{{ f.level }} / {{ f.def.maxLevel }} 级</span>
        </div>
        <p class="text-xs mb-2" style="color: var(--ink-dim)">{{ f.def.desc }}</p>
        <p class="text-sm mb-3">{{ f.level > 0 ? f.def.effectDesc(f.level) : '（未建造）' }}</p>
        <div v-if="f.next" class="flex items-center justify-between">
          <span class="text-xs" :style="{ color: f.affordable ? 'var(--ink-text)' : '#ef4444' }">
            💰{{ f.next.stones }} ⛏{{ f.next.materials }}
          </span>
          <button class="btn text-xs" :data-disabled="!f.affordable" @click="build(f.def.id)">
            {{ f.level === 0 ? '建造' : '升级' }}
          </button>
        </div>
        <p v-else class="text-xs" style="color: var(--ink-gold)">已臻化境</p>
      </div>
    </div>
  </div>
</template>
