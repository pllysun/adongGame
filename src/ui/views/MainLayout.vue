<script setup lang="ts">
// 主界面三栏布局（docs/06 §1）：顶栏 + 左导航 + 主视图 + 右事件流 + 各模态
import { computed, onMounted, onUnmounted } from 'vue'
import { useGameStore, type NavView } from '../stores/game'
import { formatDate } from '@/engine/core/clock'
import TopBar from '../components/TopBar.vue'
import EventFeed from '../components/EventFeed.vue'
import OverviewView from './OverviewView.vue'
import DisciplesView from './DisciplesView.vue'
import FacilitiesView from './FacilitiesView.vue'
import LibraryView from './LibraryView.vue'
import AlchemyView from './AlchemyView.vue'
import RulesView from './RulesView.vue'
import ChronicleView from './ChronicleView.vue'
import InboxView from './InboxView.vue'
import EventModal from '../components/modals/EventModal.vue'
import RecruitModal from '../components/modals/RecruitModal.vue'
import CombatSetupModal from '../components/modals/CombatSetupModal.vue'
import ReportModal from '../components/modals/ReportModal.vue'
import GameOverModal from '../components/modals/GameOverModal.vue'
import DiscipleDetail from './DiscipleDetail.vue'

const game = useGameStore()

const NAV: { key: NavView; label: string }[] = [
  { key: 'overview', label: '宗门总览' },
  { key: 'disciples', label: '弟子名册' },
  { key: 'inbox', label: '事件处理' },
  { key: 'facilities', label: '设施建设' },
  { key: 'library', label: '藏经阁' },
  { key: 'alchemy', label: '丹房丹库' },
  { key: 'rules', label: '宗门规则' },
  { key: 'chronicle', label: '编年史' },
]

const inboxCount = computed(() => game.snap?.inbox.length ?? 0)

const viewComp = computed(() => {
  switch (game.view) {
    case 'disciples': return DisciplesView
    case 'inbox': return InboxView
    case 'facilities': return FacilitiesView
    case 'library': return LibraryView
    case 'alchemy': return AlchemyView
    case 'rules': return RulesView
    case 'chronicle': return ChronicleView
    default: return OverviewView
  }
})

function onKey(e: KeyboardEvent): void {
  if (e.target instanceof HTMLInputElement) return
  if (e.code === 'Space') {
    e.preventDefault()
    game.togglePause()
  } else if (e.key === '1') game.setSpeed(1)
  else if (e.key === '2') game.setSpeed(3)
  else if (e.key === '3') game.setSpeed(10)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

const dateStr = computed(() => (game.snap ? formatDate(game.snap.day) : ''))
</script>

<template>
  <div v-if="game.snap" class="h-full flex flex-col">
    <TopBar :date-str="dateStr" />
    <div class="flex-1 flex min-h-0">
      <!-- 左导航 -->
      <nav class="w-28 shrink-0 border-r flex flex-col py-2" style="border-color: var(--ink-border)">
        <button
          v-for="n in NAV"
          :key="n.key"
          class="px-3 py-2.5 text-sm text-left transition-colors cursor-pointer"
          :style="{
            color: game.view === n.key ? 'var(--ink-gold)' : 'var(--ink-text)',
            background: game.view === n.key ? 'var(--ink-panel2)' : 'transparent',
            borderRight: game.view === n.key ? '2px solid var(--ink-gold)' : '2px solid transparent',
          }"
          @click="game.view = n.key"
        >
          {{ n.label }}
          <span v-if="n.key === 'inbox' && inboxCount > 0"
            class="ml-1 inline-block min-w-4 px-1 rounded-full text-center"
            style="background: var(--ink-gold); color: #15130f; font-size: 10px">{{ inboxCount }}</span>
        </button>
        <div class="mt-auto px-2 pb-2 flex flex-col gap-1">
          <button class="btn text-xs" @click="game.saveTo('1')">存档</button>
          <button v-if="game.hasSave('1')" class="btn text-xs" @click="game.loadFrom('1')">读档</button>
        </div>
      </nav>

      <!-- 主视图 -->
      <main class="flex-1 min-w-0 overflow-y-auto p-4">
        <component :is="viewComp" />
      </main>

      <!-- 右事件流 -->
      <EventFeed />
    </div>

    <!-- 模态层 -->
    <DiscipleDetail v-if="game.selectedId" />
    <template v-if="game.pending">
      <RecruitModal v-if="game.pending.kind === 'recruit'" />
      <CombatSetupModal v-else-if="game.pending.kind === 'combat-setup'" />
      <EventModal v-else />
    </template>
    <!-- 从收件箱手动打开的事件（仅在无拦截弹窗时显示） -->
    <EventModal v-else-if="game.inboxOpen" :from-inbox="true" />
    <ReportModal v-if="game.activeReport" />
    <GameOverModal v-if="game.snap.gameOver" />
  </div>
</template>
