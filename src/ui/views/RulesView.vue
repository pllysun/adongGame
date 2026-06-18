<script setup lang="ts">
// 宗门规则（docs/03 §5）：间接管理的控制面板
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { RARITY_NAMES, rarityColor } from '@/shared/rarity'
import type { EventLevel, SectRules } from '@/shared/types'

const game = useGameStore()
const rules = computed(() => game.snap!.sect.rules)

function set<K extends keyof SectRules>(key: K, value: SectRules[K]): void {
  game.command({ type: 'setRule', key, value })
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-4">
    <div class="panel p-4">
      <h3 class="text-sm mb-3" style="color: var(--ink-gold)">事件拦截</h3>
      <div class="flex items-center gap-2 text-sm mb-2 flex-wrap">
        <span>弹窗打断级别：≥</span>
        <button v-for="lv in ([1, 2, 3, 4, 5, 6, 7] as EventLevel[])" :key="lv" class="btn text-xs"
          :style="rules.interceptLevel === lv ? { color: rarityColor((lv - 1) as never), borderColor: rarityColor((lv - 1) as never) } : {}"
          @click="set('interceptLevel', lv)">
          {{ RARITY_NAMES.aptitude[(lv - 1) as never] }}
        </button>
      </div>
      <p class="text-xs" style="color: var(--ink-dim)">
        ≥此级别的事件弹窗打断并暂停；低于的事件进「事件处理」收件箱异步处理，过期自动按最保守选项放弃。
        调高 = 更少打扰，调到「凡品」= 所有事件都弹窗（旧行为）。
      </p>
    </div>

    <div class="panel p-4">
      <h3 class="text-sm mb-3" style="color: var(--ink-gold)">招收</h3>
      <div class="flex items-center gap-3 text-sm">
        <span>开山大会间隔</span>
        <button v-for="y in [1, 3, 5, 10]" :key="y" class="btn text-xs"
          :style="rules.recruitYears === y ? 'color: var(--ink-gold); border-color: var(--ink-gold)' : ''"
          @click="set('recruitYears', y)">
          {{ y }} 年
        </button>
      </div>
    </div>

    <div class="panel p-4">
      <h3 class="text-sm mb-3" style="color: var(--ink-gold)">待遇与丹药</h3>
      <div class="flex items-center gap-3 text-sm mb-3">
        <span>月俸档位</span>
        <button v-for="(label, i) in ['薄俸', '常例', '厚养']" :key="i" class="btn text-xs"
          :style="rules.stipend === i ? 'color: var(--ink-gold); border-color: var(--ink-gold)' : ''"
          @click="set('stipend', i as never)">
          {{ label }}
        </button>
        <span class="text-xs" style="color: var(--ink-dim)">厚养利于心境，但灵石压力大</span>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <span>突破丹配给</span>
        <button v-for="p in [{ k: 'aptitude', l: '资质优先' }, { k: 'realm', l: '境界优先' }, { k: 'none', l: '不自动配给' }]"
          :key="p.k" class="btn text-xs"
          :style="rules.pillPriority === p.k ? 'color: var(--ink-gold); border-color: var(--ink-gold)' : ''"
          @click="set('pillPriority', p.k as never)">
          {{ p.l }}
        </button>
      </div>
    </div>

    <div class="panel p-4">
      <h3 class="text-sm mb-3" style="color: var(--ink-gold)">门规</h3>
      <div class="space-y-2 text-sm">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" :checked="rules.allowCouple" @change="set('allowCouple', !rules.allowCouple)" />
          准许弟子结为道侣（道侣双修加成，但生死相系）
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" :checked="rules.allowTravel" @change="set('allowTravel', !rules.allowTravel)" />
          准许弟子下山游历（奇遇与凶险并存）
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" :checked="rules.autoBreakthrough" @change="set('autoBreakthrough', !rules.autoBreakthrough)" />
          大境界突破自动放行（关闭后每次冲关需掌门亲批）
        </label>
      </div>
    </div>

    <div class="panel p-4">
      <h3 class="text-sm mb-3" style="color: var(--ink-gold)">晋升门槛</h3>
      <div class="flex items-center gap-3 text-sm mb-3">
        <span>真传资质门槛</span>
        <button v-for="(label, i) in ['玄品', '地品', '天品']" :key="i" class="btn text-xs"
          :style="rules.coreAptitude === i + 2 ? 'color: var(--ink-gold); border-color: var(--ink-gold)' : ''"
          @click="set('coreAptitude', (i + 2) as never)">
          {{ label }}
        </button>
      </div>
    </div>
  </div>
</template>
