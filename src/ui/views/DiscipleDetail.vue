<script setup lang="ts">
// 弟子详情（docs/06 §2）：立绘主位 + 五维 + 特质 + 关系 + 玩家干预（赐丹/法宝/功法/身份）
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { ELEMENT_NAMES, RANK_NAMES, RARITY_NAMES, realmLabel, rarityColor } from '@/shared/rarity'
import { TRAIT_MAP } from '@/engine/content/traits'
import { GONGFA_MAP } from '@/engine/content/gongfa'
import { ARTIFACT_MAP } from '@/engine/content/artifacts'
import { PILL_MAP } from '@/engine/content/pills'
import { ageYears } from '@/engine/core/clock'
import { LIFESPAN, cultNeed } from '@/engine/content/constants'
import { breakChance } from '@/engine/systems/breakthrough'
import Portrait from '../components/Portrait.vue'
import Biography from '../components/Biography.vue'

const game = useGameStore()
const w = computed(() => game.snap!)
const d = computed(() => w.value.disciples.find((x) => x.id === game.selectedId))
const tab = ref<'bio' | 'grant' | 'gongfa' | 'rank'>('bio')

const visibleTraits = computed(() =>
  (d.value?.traits ?? [])
    .map((t) => TRAIT_MAP.get(t))
    .filter((t) => t && !t.hidden),
)

const relations = computed(() => {
  if (!d.value) return []
  const TYPE_NAMES: Record<string, string> = {
    master: '师徒', peer: '同门', friend: '挚友', couple: '道侣', crush: '倾慕', rival: '仇怨',
  }
  return w.value.relations
    .filter((r) => r.a === d.value!.id || r.b === d.value!.id)
    .map((r) => {
      const otherId = r.a === d.value!.id ? r.b : r.a
      const other = w.value.disciples.find((x) => x.id === otherId)
      return other ? { name: other.name, type: TYPE_NAMES[r.type], value: Math.round(r.value), id: otherId } : null
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
})

const breakInfo = computed(() => {
  if (!d.value || !game.engine) return null
  const live = game.engine.world.disciples.find((x) => x.id === d.value!.id)
  if (!live || live.realm >= 9) return null
  const { rate } = breakChance(game.engine.world, live)
  const label = rate >= 0.7 ? '胜算颇大' : rate >= 0.4 ? '五五之数' : rate >= 0.15 ? '凶多吉少' : '九死一生'
  return { label }
})

const pillsAvail = computed(() =>
  Object.entries(w.value.sect.pills)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ def: PILL_MAP.get(id)!, n })),
)
const artifactsAvail = computed(() => w.value.sect.artifacts.map((id) => ARTIFACT_MAP.get(id)!))
const gongfaAvail = computed(() => w.value.sect.gongfa.map((id) => GONGFA_MAP.get(id)!).sort((a, b) => b.rarity - a.rarity))

function close(): void {
  game.selectedId = null
}
</script>

<template>
  <div v-if="d" class="fixed inset-0 z-40 flex items-center justify-center" style="background: #000a" @click.self="close">
    <div class="panel p-5 w-[760px] max-h-[918px] overflow-y-auto" @click.stop>
      <div class="flex gap-5">
        <!-- 立绘列 -->
        <div class="shrink-0 text-center">
          <Portrait :seed="d.portraitSeed" :gender="d.gender" :realm="d.realm" :rank="d.rank"
            :aptitude="d.shownAptitude" :mood="d.mood" :status="d.status" :size="160" />
          <div class="mt-2 text-lg font-bold" :class="d.shownAptitude >= 6 ? 'rainbow-text' : ''"
            :style="d.shownAptitude < 6 ? { color: rarityColor(d.shownAptitude) } : {}">
            {{ d.name }}
          </div>
          <div class="text-sm" style="color: var(--ink-dim)">
            {{ RANK_NAMES[d.rank] }} · {{ realmLabel(d.realm, d.sub) }}
          </div>
        </div>

        <!-- 信息列 -->
        <div class="flex-1 min-w-0">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-3">
            <div>资质：<span :style="{ color: rarityColor(d.shownAptitude) }">{{ RARITY_NAMES.aptitude[d.shownAptitude] }}</span></div>
            <div>年龄：{{ ageYears(d.birthDay, w.day) }} / {{ LIFESPAN[Math.min(d.realm, 9)] }} 岁</div>
            <div>
              灵根：{{ d.roots.elements.map((e) => ELEMENT_NAMES[e]).join('') }}（纯度 {{ d.roots.purity }}）
            </div>
            <div>悟性：{{ d.comprehension }} / 10</div>
            <div>心境：{{ Math.round(d.mood) }}</div>
            <div>心性：{{ '？' }}<span class="text-xs" style="color: var(--ink-dim)">（需观其行）</span></div>
            <div>主修：{{ d.gongfa ? GONGFA_MAP.get(d.gongfa)?.name : '无' }}</div>
            <div>法宝：{{ d.artifact ? ARTIFACT_MAP.get(d.artifact)?.name : '无' }}</div>
            <div>战斗历练：{{ d.combatExp }} 阵</div>
            <div v-if="breakInfo">突破胜算：<span style="color: var(--ink-gold)">{{ breakInfo.label }}</span></div>
          </div>

          <!-- 修为条 -->
          <div class="mb-3">
            <div class="text-xs mb-1" style="color: var(--ink-dim)">
              修为 {{ Math.floor(d.cultivation) }} / {{ Math.floor(cultNeed(d.realm, d.sub)) }}
              <span v-if="d.bottleneck" style="color: var(--ink-gold)">（瓶颈）</span>
            </div>
            <div class="h-2 rounded overflow-hidden" style="background: var(--ink-panel2)">
              <div class="h-full" :style="{ width: Math.min(100, (d.cultivation / cultNeed(d.realm, d.sub)) * 100) + '%', background: 'var(--ink-gold)' }" />
            </div>
          </div>

          <!-- 特质 -->
          <div class="mb-3 flex flex-wrap gap-1.5">
            <span v-for="t in visibleTraits" :key="t!.id" class="px-2 py-0.5 rounded text-xs border"
              style="border-color: var(--ink-border)" :title="t!.desc">
              {{ t!.name }}
            </span>
          </div>

          <!-- 关系网 -->
          <div class="mb-3">
            <div class="text-xs mb-1" style="color: var(--ink-dim)">人际</div>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="r in relations.slice(0, 8)" :key="r.id" class="px-2 py-0.5 rounded text-xs border cursor-pointer"
                :style="{ borderColor: r.value < 0 ? '#ef4444' : 'var(--ink-border)', color: r.value < 0 ? '#ef4444' : 'var(--ink-text)' }"
                @click="game.selectedId = r.id">
                {{ r.type }}·{{ r.name }} {{ r.value > 0 ? '+' : '' }}{{ r.value }}
              </button>
              <span v-if="relations.length === 0" class="text-xs" style="color: var(--ink-dim)">尚无深交之人</span>
            </div>
          </div>

          <!-- 干预面板 -->
          <div class="border-t pt-3" style="border-color: var(--ink-border)">
            <div class="flex gap-2 mb-2 text-xs">
              <button class="btn text-xs" :style="tab === 'bio' ? 'color: var(--ink-gold)' : ''" @click="tab = 'bio'">生平</button>
              <button class="btn text-xs" :style="tab === 'grant' ? 'color: var(--ink-gold)' : ''" @click="tab = 'grant'">赐丹药/法宝</button>
              <button class="btn text-xs" :style="tab === 'gongfa' ? 'color: var(--ink-gold)' : ''" @click="tab = 'gongfa'">传功法</button>
              <button class="btn text-xs" :style="tab === 'rank' ? 'color: var(--ink-gold)' : ''" @click="tab = 'rank'">身份任免</button>
            </div>
            <Biography v-if="tab === 'bio'" :disciple="d" />
            <div v-else-if="tab === 'grant'" class="flex flex-wrap gap-1.5">
              <button v-for="p in pillsAvail" :key="p.def.id" class="btn text-xs"
                :style="{ color: rarityColor(p.def.rarity) }"
                @click="game.command({ type: 'grantPill', discipleId: d.id, pillId: p.def.id })">
                {{ p.def.name }} ×{{ p.n }}
              </button>
              <button v-for="a in artifactsAvail" :key="a.id" class="btn text-xs"
                :style="{ color: rarityColor(a.rarity) }"
                @click="game.command({ type: 'grantArtifact', discipleId: d.id, artifactId: a.id })">
                {{ a.name }}{{ a.guard ? '（护身）' : '' }}
              </button>
              <span v-if="pillsAvail.length === 0 && artifactsAvail.length === 0" class="text-xs" style="color: var(--ink-dim)">库房空空如也</span>
            </div>
            <div v-else-if="tab === 'gongfa'" class="flex flex-wrap gap-1.5">
              <button v-for="g in gongfaAvail" :key="g.id" class="btn text-xs"
                :style="{ color: rarityColor(g.rarity), opacity: d.gongfa === g.id ? 0.5 : 1 }"
                :disabled="d.gongfa === g.id"
                @click="game.command({ type: 'setGongfa', discipleId: d.id, gongfaId: g.id })">
                {{ g.name }}（上限{{ realmLabel(g.realmCap) }}）
              </button>
            </div>
            <div v-else class="flex flex-wrap gap-1.5">
              <button v-for="(label, rank) in RANK_NAMES" :key="rank" class="btn text-xs"
                :disabled="d.rank === rank"
                @click="game.command({ type: 'setRank', discipleId: d.id, rank: rank as never })">
                任为{{ label }}
              </button>
              <button class="btn text-xs" style="color: #ef4444"
                @click="game.command({ type: 'expel', discipleId: d.id }); close()">
                逐出山门
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="text-right mt-3">
        <button class="btn" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>
