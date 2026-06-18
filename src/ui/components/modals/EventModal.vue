<script setup lang="ts">
// 事件弹窗（docs/06 §1）：立绘 + 文本 + 选项，galgame 式呈现。可显示拦截队列或收件箱事件。
import { computed } from 'vue'
import { useGameStore } from '../../stores/game'
import { rarityColor, RARITY_NAMES } from '@/shared/rarity'
import Portrait from '../Portrait.vue'

const props = defineProps<{ fromInbox?: boolean }>()
const game = useGameStore()
const item = computed(() => (props.fromInbox ? game.inboxOpen! : game.pending!))

const castDisciples = computed(() =>
  item.value.castIds
    .map((id) => game.snap?.disciples.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => !!d)
    .slice(0, 3),
)

function choose(idx: number): void {
  game.resolve(item.value.uid, idx)
}
function back(): void {
  game.closeInbox()
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" style="background: #000b">
    <div class="panel w-[620px] overflow-hidden">
      <div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--ink-border)">
        <span v-if="item.level" class="w-2.5 h-2.5 rounded-full shrink-0"
          :style="{ background: rarityColor((item.level - 1) as never) }"
          :title="`${item.level} 级`" />
        <span class="text-lg tracking-widest" style="color: var(--ink-gold)">{{ item.title }}</span>
        <span v-if="item.level" class="text-xs" style="color: var(--ink-dim)">
          {{ RARITY_NAMES.aptitude[(item.level - 1) as never] }}事</span>
        <button v-if="fromInbox" class="btn text-xs ml-auto" @click="back">返回收件箱</button>
      </div>
      <div class="p-5">
        <div v-if="castDisciples.length > 0" class="flex gap-3 mb-4 justify-center">
          <Portrait
            v-for="d in castDisciples"
            :key="d.id"
            :seed="d.portraitSeed" :gender="d.gender" :realm="d.realm" :rank="d.rank"
            :aptitude="d.shownAptitude" :mood="d.mood" :status="d.status" :size="88"
          />
        </div>
        <p class="leading-loose text-[15px] mb-5">{{ item.text }}</p>
        <div class="space-y-2">
          <button
            v-for="o in item.options"
            :key="o.idx"
            class="btn w-full text-left py-2.5 px-4"
            :data-disabled="!!o.disabled"
            :disabled="!!o.disabled"
            @click="choose(o.idx)"
          >
            {{ o.text }}
            <span v-if="o.disabled" class="text-xs ml-2" style="color: #ef4444">（{{ o.disabled }}）</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
