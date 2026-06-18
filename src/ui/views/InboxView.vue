<script setup lang="ts">
// 事件处理系统（收件箱，docs/04 §事件分流）：异步待处理的低级事件，按等级色标，显示过期倒计时
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { rarityColor, RARITY_NAMES } from '@/shared/rarity'

const game = useGameStore()
const items = computed(() => [...(game.snap?.inbox ?? [])].sort((a, b) => (b.level ?? 0) - (a.level ?? 0)))

function expiryText(expiryDay?: number): string {
  if (expiryDay === undefined || !game.snap) return ''
  const left = Math.max(0, Math.round((expiryDay - game.snap.day) / 30))
  return left <= 0 ? '即将过期' : `余 ${left} 月`
}
const SCOPE_LABEL: Record<string, string> = { personal: '个人', sect: '宗门' }
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-base" style="color: var(--ink-gold)">事件处理 · 收件箱</h2>
      <span class="text-xs" style="color: var(--ink-dim)">
        低于拦截级别（{{ RARITY_NAMES.aptitude[(game.snap?.sect.rules.interceptLevel ?? 4) - 1] }}）的事件在此异步处理，过期自动按最保守选项放弃
      </span>
    </div>

    <div v-if="items.length === 0" class="panel p-8 text-center text-sm" style="color: var(--ink-dim)">
      收件箱空空，诸事顺遂。
    </div>

    <div v-else class="space-y-2">
      <div v-for="it in items" :key="it.uid" class="panel px-4 py-3 flex items-center gap-3">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: rarityColor(((it.level ?? 1) - 1) as never) }"
          :title="`${it.level} 级`" />
        <div class="flex-1 min-w-0">
          <div class="text-sm font-bold truncate">{{ it.title }}</div>
          <div class="text-xs truncate" style="color: var(--ink-dim)">{{ it.text }}</div>
        </div>
        <span class="text-xs px-1.5 py-0.5 rounded border shrink-0" style="border-color: var(--ink-border); color: var(--ink-dim)">
          {{ SCOPE_LABEL[it.scope ?? 'sect'] }}
        </span>
        <span class="text-xs w-16 text-right shrink-0"
          :style="{ color: expiryText(it.expiryDay) === '即将过期' ? '#ef4444' : 'var(--ink-dim)' }">
          {{ expiryText(it.expiryDay) }}
        </span>
        <button class="btn text-xs shrink-0" @click="game.openInbox(it.uid)">处理</button>
        <button class="btn text-xs shrink-0" @click="game.dismissInbox(it.uid)">放弃</button>
      </div>
    </div>
  </div>
</template>
