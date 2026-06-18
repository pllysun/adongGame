<script setup lang="ts">
// 战前点将（docs/05 §6）：模糊胜算 + 协同提示，不显示精确百分比
import { computed, ref } from 'vue'
import { useGameStore } from '../../stores/game'
import { realmLabel, rarityColor } from '@/shared/rarity'
import { disciplePower, teamPower, winProb } from '@/engine/systems/combat'
import { getRel } from '@/engine/systems/helpers'
import Portrait from '../Portrait.vue'
import type { CombatSpec, Disciple } from '@/shared/types'

const game = useGameStore()
const item = computed(() => game.pending!)
const spec = computed(() => item.value.payload as CombatSpec)
const selected = ref(new Set<string>())

const available = computed(() =>
  game.snap!.disciples
    .filter((d) => d.status === 'normal' || d.status === 'dying')
    .sort((a, b) => disciplePower(b) - disciplePower(a)),
)

const maxTeam = computed(() => spec.value.maxTeam ?? 6)

function toggle(id: string): void {
  if (selected.value.has(id)) selected.value.delete(id)
  else if (selected.value.size < maxTeam.value) selected.value.add(id)
  selected.value = new Set(selected.value)
}

const estimate = computed(() => {
  if (selected.value.size === 0 || !game.engine) return null
  const team = [...selected.value]
    .map((id) => game.engine!.world.disciples.find((d) => d.id === id))
    .filter((d): d is Disciple => !!d)
  const p = winProb(teamPower(game.engine.world, team, spec.value.defense) / Math.max(1, spec.value.enemyPower))
  const label = p >= 0.85 ? '十拿九稳' : p >= 0.65 ? '胜算颇大' : p >= 0.45 ? '五五之数' : p >= 0.25 ? '凶多吉少' : '九死一生'
  // 协同提示
  const hints: string[] = []
  for (let i = 0; i < team.length; i++)
    for (let j = i + 1; j < team.length; j++) {
      const r = getRel(game.engine.world, team[i].id, team[j].id)
      if (!r) continue
      if (r.type === 'couple') hints.push(`${team[i].name}与${team[j].name}是道侣：协同+`)
      else if (r.value >= 50) hints.push(`${team[i].name}与${team[j].name}交情深厚：协同+`)
      else if (r.value <= -30) hints.push(`${team[i].name}与${team[j].name}素有嫌隙：协同−`)
    }
  return { label, hints: hints.slice(0, 4) }
})

function go(): void {
  game.resolve(item.value.uid, 0, [...selected.value])
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: #000b">
    <div class="panel w-[820px] max-h-[950px] flex flex-col">
      <div class="px-5 py-3 border-b" style="border-color: var(--ink-border)">
        <span class="text-lg tracking-widest" style="color: #ef4444">{{ item.title }}</span>
        <p class="text-sm mt-1" style="color: var(--ink-dim)">{{ item.text }}（最多出战 {{ maxTeam }} 人）</p>
      </div>
      <div class="p-4 overflow-y-auto grid grid-cols-5 gap-2">
        <div
          v-for="d in available"
          :key="d.id"
          class="p-2 rounded border cursor-pointer text-center"
          :style="{
            borderColor: selected.has(d.id) ? '#ef4444' : 'var(--ink-border)',
            background: selected.has(d.id) ? 'var(--ink-panel2)' : 'transparent',
          }"
          @click="toggle(d.id)"
        >
          <Portrait :seed="d.portraitSeed" :gender="d.gender" :realm="d.realm" :rank="d.rank"
            :aptitude="d.shownAptitude" :mood="d.mood" :status="d.status" :size="56" />
          <div class="text-sm font-bold mt-1" :style="{ color: rarityColor(d.shownAptitude) }">{{ d.name }}</div>
          <div class="text-xs" style="color: var(--ink-dim)">{{ realmLabel(d.realm, d.sub) }}</div>
          <div class="text-xs" style="color: var(--ink-dim)">战力 ~{{ Math.round(disciplePower(d)) }}</div>
        </div>
      </div>
      <div class="px-5 py-3 border-t" style="border-color: var(--ink-border)">
        <div v-if="estimate" class="mb-2 text-sm">
          胜算：<span style="color: var(--ink-gold)">{{ estimate.label }}</span>
          <div v-for="h in estimate.hints" :key="h" class="text-xs mt-0.5" style="color: var(--ink-dim)">{{ h }}</div>
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn btn-primary" :data-disabled="selected.size === 0" :disabled="selected.size === 0" @click="go">
            出战（{{ selected.size }} 人）
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
