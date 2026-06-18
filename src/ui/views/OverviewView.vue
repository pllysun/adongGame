<script setup lang="ts">
// 宗门总览（docs/06 §2）：人口结构、收支、威胁、警示
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { REALM_NAMES, RARITY_NAMES } from '@/shared/rarity'
import { sectCapacity } from '@/engine/content/facilities'
import { ageYears } from '@/engine/core/clock'
import { LIFESPAN } from '@/engine/content/constants'

const game = useGameStore()
const w = computed(() => game.snap!)

const realmDist = computed(() => {
  const dist: { realm: number; count: number }[] = []
  for (let r = 9; r >= 1; r--) {
    const count = w.value.disciples.filter((d) => d.realm === r).length
    if (count > 0) dist.push({ realm: r, count })
  }
  return dist
})

const capacity = computed(() => sectCapacity(w.value))

const warnings = computed(() => {
  const out: string[] = []
  const ww = w.value
  if (ww.sect.stones < 100) out.push('灵石告急')
  if (ww.sect.rice < ww.disciples.length * 3) out.push('灵米不足一月之需')
  if (ww.disciples.length >= capacity.value) out.push('洞府已满，无法再收弟子')
  const demonic = ww.disciples.filter((d) => d.status === 'demonic').length
  if (demonic > 0) out.push(`${demonic} 名弟子心魔缠身`)
  const dying = ww.disciples.filter((d) => {
    const age = ageYears(d.birthDay, ww.day)
    return age >= LIFESPAN[Math.min(d.realm, 9)] - 10
  }).length
  if (dying > 0) out.push(`${dying} 名弟子寿元将尽`)
  const bottleneck = ww.disciples.filter((d) => d.bottleneck && d.sub === 2).length
  if (bottleneck > 0) out.push(`${bottleneck} 名弟子面临大境界瓶颈`)
  return out
})

const enemies = computed(() => {
  const names: Record<string, string> = { xuanming: '玄冥教', wanshou: '万兽山', liehuo: '烈火门' }
  return Object.entries(w.value.enemies).map(([k, v]) => ({ name: names[k] ?? k, hostility: Math.round(v) }))
})

const dujie = computed(() => w.value.disciples.filter((d) => d.realm >= 9).length)

// 宗门态势：把藏在 flags 里的战略轴展示出来，玩家才能据此决策
const ALLY_NAMES: Record<string, string> = { danxia: '丹霞谷', biyou: '碧游宫', taiyi: '太一门', kunwu: '昆吾剑派' }
const flagNum = (k: string) => (typeof w.value.flags[k] === 'number' ? (w.value.flags[k] as number) : 0)
const demonLean = computed(() => flagNum('demonLean'))
const alignLabel = computed(() => {
  const v = demonLean.value
  if (v >= 60) return { text: '魔道昭彰', color: '#ef4444' }
  if (v >= 30) return { text: '亦正亦邪', color: '#f59e0b' }
  if (v >= 10) return { text: '微沾魔气', color: '#a855f7' }
  return { text: '正道清誉', color: '#22c55e' }
})
const allyList = computed(() =>
  Object.keys(ALLY_NAMES)
    .map((id) => ({ name: ALLY_NAMES[id], goodwill: flagNum('ally:' + id) }))
    .filter((a) => a.goodwill > 0)
    .sort((a, b) => b.goodwill - a.goodwill),
)
const assets = computed(() => {
  const out: string[] = []
  if (w.value.flags['mineHeld']) out.push('坐拥灵矿')
  if (w.value.flags['beastPact']) out.push('妖族盟约')
  if (w.value.flags['gardenPlanted']) out.push('灵植培育中')
  if (w.value.flags['expeditionOut']) out.push('船队远航中')
  return out
})

const STAGE_LABEL: Record<string, string> = { founding: '草创', sect: '立宗', peaks: '分峰' }
const peaks = computed(() =>
  w.value.peaks.map((p) => ({
    ...p,
    masterName: w.value.disciples.find((d) => d.id === p.masterId)?.name ?? '（虚位）',
    members: w.value.disciples.filter((d) => d.peakId === p.id).length,
  })),
)
</script>

<template>
  <div class="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
    <!-- 飞升进度 -->
    <div class="panel p-4 col-span-2">
      <div class="flex items-center justify-between">
        <span class="text-sm" style="color: var(--ink-dim)">飞升大业：渡劫大能 {{ dujie }} / 3</span>
        <span class="text-xs" style="color: var(--ink-dim)">集齐三位渡劫期，便可筹备飞升大典</span>
      </div>
      <div class="mt-2 h-2 rounded overflow-hidden" style="background: var(--ink-panel2)">
        <div
          class="h-full transition-all"
          :style="{ width: Math.min(100, (dujie / 3) * 100) + '%', background: 'var(--rarity-6)' }"
        />
      </div>
    </div>

    <!-- 宗门态势：战略轴一览 -->
    <div class="panel p-4 col-span-2">
      <h3 class="text-sm mb-3" style="color: var(--ink-dim)">宗门态势</h3>
      <div class="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div class="text-xs mb-1" style="color: var(--ink-dim)">正魔倾向</div>
          <div class="flex items-center gap-2">
            <div class="flex-1 h-2 rounded overflow-hidden" style="background: var(--ink-panel2)">
              <div class="h-full transition-all" :style="{ width: Math.max(4, demonLean) + '%', background: alignLabel.color }" />
            </div>
            <span :style="{ color: alignLabel.color }">{{ alignLabel.text }}</span>
          </div>
          <div class="text-xs mt-1" style="color: var(--ink-dim)">气运 {{ Math.round(w.sect.qiyun) }}</div>
        </div>
        <div>
          <div class="text-xs mb-1" style="color: var(--ink-dim)">友盟</div>
          <div v-if="allyList.length" class="flex flex-wrap gap-1">
            <span v-for="a in allyList" :key="a.name" class="px-1.5 py-0.5 rounded text-xs border"
              :style="{ borderColor: 'var(--ink-border)', color: '#22c55e' }">
              {{ a.name }} {{ a.goodwill }}
            </span>
          </div>
          <span v-else class="text-xs" style="color: var(--ink-dim)">尚无盟友（仲裁结义可结交）</span>
        </div>
        <div>
          <div class="text-xs mb-1" style="color: var(--ink-dim)">战略资产 / 营生</div>
          <div v-if="assets.length" class="flex flex-wrap gap-1">
            <span v-for="a in assets" :key="a" class="px-1.5 py-0.5 rounded text-xs border"
              style="border-color: var(--ink-border); color: var(--ink-gold)">{{ a }}</span>
          </div>
          <span v-else class="text-xs" style="color: var(--ink-dim)">暂无</span>
        </div>
      </div>
    </div>

    <!-- 分峰 / 师承 -->
    <div class="panel p-4 col-span-2">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm" style="color: var(--ink-dim)">门庭 · {{ STAGE_LABEL[w.sectStage] }}</h3>
        <span class="text-xs" style="color: var(--ink-dim)">
          入内门门槛：{{ REALM_NAMES[w.innerThreshold.realm] }}{{ w.innerThreshold.aptitude > 0 ? ' / 资质≥' + RARITY_NAMES.aptitude[w.innerThreshold.aptitude] : '' }}
        </span>
      </div>
      <div v-if="peaks.length" class="grid grid-cols-3 gap-2">
        <div v-for="p in peaks" :key="p.id" class="rounded border px-2.5 py-1.5" style="border-color: var(--ink-border)">
          <div class="text-sm" style="color: var(--ink-gold)">{{ p.name }}</div>
          <div class="text-xs" style="color: var(--ink-dim)">峰主 {{ p.masterName }} · {{ p.members }} 人 · 威望 {{ p.prestige }}</div>
        </div>
      </div>
      <p v-else class="text-xs" style="color: var(--ink-dim)">
        {{ w.sectStage === 'founding' ? '草创之期，尚无内外门之分。' : '内门初立，强者尚未分峰。' }}
      </p>
    </div>

    <!-- 人口结构 -->
    <div class="panel p-4">
      <h3 class="text-sm mb-3" style="color: var(--ink-dim)">人口结构（{{ w.disciples.length }} / {{ capacity }}）</h3>
      <div v-for="r in realmDist" :key="r.realm" class="flex items-center gap-2 mb-1.5 text-sm">
        <span class="w-10">{{ REALM_NAMES[r.realm] }}</span>
        <div class="flex-1 h-3 rounded overflow-hidden" style="background: var(--ink-panel2)">
          <div
            class="h-full"
            :style="{
              width: Math.min(100, (r.count / w.disciples.length) * 100) + '%',
              background: `var(--rarity-${Math.min(6, r.realm - 1)})`,
            }"
          />
        </div>
        <span class="w-8 text-right">{{ r.count }}</span>
      </div>
      <p v-if="realmDist.length === 0" class="text-sm" style="color: var(--ink-dim)">门下无人……</p>
    </div>

    <!-- 警示牌 -->
    <div class="panel p-4">
      <h3 class="text-sm mb-3" style="color: var(--ink-dim)">警示牌</h3>
      <ul v-if="warnings.length > 0" class="space-y-1.5">
        <li v-for="warn in warnings" :key="warn" class="text-sm" style="color: #ef4444">⚠ {{ warn }}</li>
      </ul>
      <p v-else class="text-sm" style="color: #22c55e">宗门诸事顺遂。</p>
    </div>

    <!-- 外患 -->
    <div class="panel p-4">
      <h3 class="text-sm mb-3" style="color: var(--ink-dim)">外患</h3>
      <div v-for="e in enemies" :key="e.name" class="flex items-center gap-2 mb-1.5 text-sm">
        <span class="w-14">{{ e.name }}</span>
        <div class="flex-1 h-3 rounded overflow-hidden" style="background: var(--ink-panel2)">
          <div
            class="h-full"
            :style="{ width: e.hostility + '%', background: e.hostility > 60 ? '#ef4444' : e.hostility > 30 ? '#f59e0b' : '#22c55e' }"
          />
        </div>
        <span class="w-8 text-right text-xs">{{ e.hostility }}</span>
      </div>
      <div class="flex items-center gap-2 mt-2 text-sm">
        <span class="w-14">妖兽潮</span>
        <div class="flex-1 h-3 rounded overflow-hidden" style="background: var(--ink-panel2)">
          <div
            class="h-full"
            :style="{ width: Math.round(w.beastThreat) + '%', background: w.beastThreat > 60 ? '#ef4444' : '#f59e0b' }"
          />
        </div>
        <span class="w-8 text-right text-xs">{{ Math.round(w.beastThreat) }}</span>
      </div>
    </div>

    <!-- 灵脉 -->
    <div class="panel p-4">
      <h3 class="text-sm mb-3" style="color: var(--ink-dim)">山门灵脉</h3>
      <p class="text-sm leading-relaxed">
        灵脉品质 <span style="color: var(--ink-gold)">{{ '★'.repeat(w.sect.siteQuality) }}</span><br />
        地域凶险 <span style="color: #ef4444">{{ '★'.repeat(w.sect.siteDanger) }}</span><br />
        <span class="text-xs" style="color: var(--ink-dim)">灵脉品质决定矿产与聚灵阵上限，凶险决定灾祸频率。</span>
      </p>
    </div>
  </div>
</template>
