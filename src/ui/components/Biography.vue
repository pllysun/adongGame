<script setup lang="ts">
// 生平：心相模糊档 + 师承/峰 + 经历树（因果链）+ 天道亲临（docs/09 §5,§6,§4）
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { formatDate } from '@/engine/core/clock'
import { beliefTier, BELIEF_NAMES } from '@/engine/systems/psyche'
import type { BeliefKey, Disciple } from '@/shared/types'

const props = defineProps<{ disciple: Disciple }>()
const game = useGameStore()

const AXES: BeliefKey[] = ['daoxin', 'xinmo', 'molean', 'loyalty', 'fame']
const AXIS_COLOR: Record<BeliefKey, string> = {
  daoxin: '#60a5fa', xinmo: '#a855f7', molean: '#ef4444', loyalty: '#22c55e', fame: '#c9a227',
}
const beliefs = computed(() => AXES.map((k) => ({ key: k, name: BELIEF_NAMES[k], tier: beliefTier(k, props.disciple.beliefs[k]) })))

const master = computed(() =>
  props.disciple.masterId ? game.snap!.disciples.find((d) => d.id === props.disciple.masterId) : null,
)
const peak = computed(() =>
  props.disciple.peakId ? game.snap!.peaks.find((p) => p.id === props.disciple.peakId) : null,
)

// 经历树：时间正序，转折点高亮，标注因果
const KIND_ICON: Record<string, string> = { turning: '◆', minor: '·' }
const memories = computed(() => [...props.disciple.memories])
function causedText(mem: { causedBy?: number }): string | null {
  if (mem.causedBy === undefined) return null
  const parent = props.disciple.memories.find((m) => m.day === mem.causedBy)
  return parent ? parent.text.slice(0, 14) + '…' : null
}

// 天道亲临
const qiyun = computed(() => game.snap!.sect.qiyun)
const cost = computed(() => 8 + game.snap!.divineFavor * 4)
const interveneAxes: { key: BeliefKey; label: string }[] = [
  { key: 'daoxin', label: '正其道心' },
  { key: 'xinmo', label: '消其心魔' },
  { key: 'molean', label: '涤其魔念' },
  { key: 'loyalty', label: '固其忠忱' },
]
function intervene(key: BeliefKey): void {
  game.command({ type: 'divineIntervene', discipleId: props.disciple.id, toward: key })
}
</script>

<template>
  <div class="space-y-4">
    <!-- 心相（模糊档位） -->
    <div>
      <div class="text-xs mb-1.5" style="color: var(--ink-dim)">心相（观其行而知）</div>
      <div class="flex flex-wrap gap-1.5">
        <span v-for="b in beliefs" :key="b.key" class="px-2 py-0.5 rounded text-xs border"
          :style="{ borderColor: 'var(--ink-border)', color: AXIS_COLOR[b.key] }">
          {{ b.name }}·{{ b.tier }}
        </span>
      </div>
    </div>

    <!-- 师承 / 峰 -->
    <div class="text-sm flex flex-wrap gap-x-6 gap-y-1">
      <span>师承：<span style="color: var(--ink-text)">{{ master ? master.name : '未拜师（外门）' }}</span>
        <span v-if="disciple.lineageTier" class="text-xs" style="color: var(--ink-dim)">（{{ disciple.lineageTier === 'zhuan' ? '嫡传' : '记名' }}）</span>
      </span>
      <span>所属：<span :style="{ color: peak ? 'var(--ink-gold)' : 'var(--ink-dim)' }">{{ peak ? peak.name : '宗门本部' }}</span></span>
    </div>

    <!-- 天道亲临 -->
    <div class="border-t pt-3" style="border-color: var(--ink-border)">
      <div class="text-xs mb-1.5" style="color: var(--ink-dim)">天道亲临（耗气运 {{ cost }}，现存 {{ Math.round(qiyun) }}）</div>
      <div class="flex flex-wrap gap-1.5">
        <button v-for="a in interveneAxes" :key="a.key" class="btn text-xs"
          :data-disabled="qiyun < cost" :disabled="qiyun < cost" @click="intervene(a.key)">
          {{ a.label }}
        </button>
      </div>
    </div>

    <!-- 经历树 -->
    <div class="border-t pt-3" style="border-color: var(--ink-border)">
      <div class="text-xs mb-2" style="color: var(--ink-dim)">命途 · 经历树</div>
      <div v-if="memories.length === 0" class="text-xs" style="color: var(--ink-dim)">履历尚浅，未着痕迹。</div>
      <div v-else class="border-l-2 pl-3 space-y-2" style="border-color: var(--ink-border)">
        <div v-for="(m, i) in memories" :key="i" class="relative">
          <span class="absolute -left-[1.05rem] text-xs" :style="{ color: m.kind === 'turning' ? 'var(--ink-gold)' : 'var(--ink-dim)' }">
            {{ KIND_ICON[m.kind] }}
          </span>
          <div class="text-xs" style="color: var(--ink-dim)">{{ formatDate(m.day) }}</div>
          <div class="text-sm leading-snug" :style="{ color: m.kind === 'turning' ? 'var(--ink-text)' : 'var(--ink-dim)' }">
            {{ m.text }}
            <span v-if="m.choice" class="text-xs" style="color: var(--ink-gold)">（{{ m.choice }}）</span>
          </div>
          <div v-if="causedText(m)" class="text-xs mt-0.5" style="color: #8a8170">↳ 因：{{ causedText(m) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
