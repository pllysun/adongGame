<script setup lang="ts">
// 程序化纸娃娃立绘（docs/06 §3）：分层 SVG —— 底身/服饰/发型/眉眼/表情/境界特效/资质边框
import { computed } from 'vue'
import { rarityColor } from '@/shared/rarity'

const props = withDefaults(
  defineProps<{
    seed: number
    gender: 'm' | 'f'
    realm?: number
    rank?: string
    aptitude?: number
    mood?: number
    status?: string
    size?: number
    expression?: 'normal' | 'happy' | 'angry' | 'hurt' | ''
  }>(),
  { realm: 1, rank: 'outer', aptitude: 0, mood: 0, status: 'normal', size: 96, expression: '' },
)

// mulberry32：与引擎 RNG 无关的纯展示用确定性随机
function mul32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const P = computed(() => {
  const r = mul32(props.seed)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)]
  const skin = pick(['#e8c39e', '#f0d0ab', '#dcb188', '#e5c7a8'])
  const hairColors = ['#1a1a22', '#2d2026', '#26222e', '#3a2a1c']
  const hair = props.realm >= 3 && r() < 0.2 ? '#cfcfd6' : pick(hairColors)
  const faceW = 30 + Math.floor(r() * 6) // 30-35
  const eyeStyle = Math.floor(r() * 4)
  const browStyle = Math.floor(r() * 3)
  const hairStyle = Math.floor(r() * 4)
  const accessory = Math.floor(r() * 3)
  return { skin, hair, faceW, eyeStyle, browStyle, hairStyle, accessory }
})

// 服饰按身份（docs/06）：外门灰袍/内门青袍/真传纹袍/长老法袍
const robeColor = computed(() => {
  switch (props.rank) {
    case 'inner': return { a: '#2c4a45', b: '#1d332f' }
    case 'core': return { a: '#3d2c52', b: '#2a1e3a' }
    case 'elder': return { a: '#52432c', b: '#3a2f1e' }
    case 'master': return { a: '#5c4118', b: '#403012' }
    default: return { a: '#46413a', b: '#322e28' }
  }
})

const expr = computed(() => {
  if (props.expression) return props.expression
  if (props.status === 'injured' || props.status === 'crippled') return 'hurt'
  if (props.status === 'demonic') return 'angry'
  if (props.mood >= 50) return 'happy'
  if (props.mood <= -40) return 'angry'
  return 'normal'
})

// 境界气场：金丹起身周微光，颜色随境界推进
const aura = computed(() => {
  const realm = props.realm ?? 1
  if (realm < 3) return null
  const colors = ['', '', '', '#c9a22744', '#9b6ee866', '#5ec8e877', '#e85e8e77', '#ffd70088', '#ff8c0099', '#ffffffaa']
  return colors[Math.min(realm, 9)]
})

const border = computed(() => rarityColor((props.aptitude ?? 0) as never))
const isImmortal = computed(() => (props.aptitude ?? 0) >= 6)
const mouth = computed(() => {
  switch (expr.value) {
    case 'happy': return 'M42,72 Q50,78 58,72'
    case 'angry': return 'M42,75 Q50,70 58,75'
    case 'hurt': return 'M44,74 Q50,72 56,75'
    default: return 'M44,73 L56,73'
  }
})
</script>

<template>
  <div
    class="relative inline-block overflow-hidden rounded"
    :class="isImmortal ? 'rainbow-border' : ''"
    :style="{
      width: size + 'px',
      height: size * 1.25 + 'px',
      border: isImmortal ? undefined : `2px solid ${border}`,
      background: '#13110d',
    }"
  >
    <svg :viewBox="`0 0 100 125`" :width="size - (isImmortal ? 0 : 0)" :height="size * 1.25" class="block">
      <!-- 境界气场 -->
      <circle v-if="aura" cx="50" cy="58" r="44" :fill="aura" opacity="0.55">
        <animate attributeName="r" values="42;46;42" dur="3s" repeatCount="indefinite" />
      </circle>

      <!-- 身体/法袍 -->
      <path
        :d="`M50,78 C30,80 22,96 20,125 L80,125 C78,96 70,80 50,78 Z`"
        :fill="robeColor.a"
        stroke="#00000055"
      />
      <path :d="`M50,80 C44,90 44,108 46,125 L54,125 C56,108 56,90 50,80 Z`" :fill="robeColor.b" />
      <!-- 衣领 -->
      <path d="M40,84 L50,96 L60,84" fill="none" :stroke="robeColor.b" stroke-width="3" />

      <!-- 头颈 -->
      <rect x="44" y="68" width="12" height="12" :fill="P.skin" />
      <ellipse cx="50" cy="52" :rx="P.faceW / 2" ry="22" :fill="P.skin" />

      <!-- 发型 -->
      <g :fill="P.hair">
        <path v-if="P.hairStyle === 0" d="M30,52 C28,28 40,22 50,22 C60,22 72,28 70,52 C70,38 62,32 50,32 C38,32 30,38 30,52 Z" />
        <path v-else-if="P.hairStyle === 1" d="M30,54 C26,26 42,20 50,20 C58,20 74,26 70,54 C72,36 60,30 50,30 C40,30 28,36 30,54 Z" />
        <path v-else-if="P.hairStyle === 2" d="M31,50 C30,27 41,21 50,21 C59,21 70,27 69,50 C68,36 60,31 50,31 C40,31 32,36 31,50 Z" />
        <path v-else d="M30,56 C27,26 43,19 50,19 C57,19 73,26 70,56 C70,36 61,29 50,29 C39,29 30,36 30,56 Z" />
        <!-- 发髻 -->
        <ellipse cx="50" cy="20" rx="8" ry="6" />
        <rect x="46" y="14" width="8" height="4" rx="2" :fill="rank === 'master' || rank === 'elder' ? '#c9a227' : P.hair" />
        <!-- 女性长发 -->
        <g v-if="gender === 'f'">
          <path d="M32,46 C28,62 28,76 30,88 L36,86 C34,72 34,58 36,48 Z" />
          <path d="M68,46 C72,62 72,76 70,88 L64,86 C66,72 66,58 64,48 Z" />
        </g>
      </g>

      <!-- 眉 -->
      <g stroke="#222" stroke-width="1.6" fill="none">
        <path v-if="P.browStyle === 0" :d="expr === 'angry' ? 'M38,42 L46,45' : 'M38,44 Q42,42 46,44'" />
        <path v-if="P.browStyle === 0" :d="expr === 'angry' ? 'M62,42 L54,45' : 'M54,44 Q58,42 62,44'" />
        <path v-if="P.browStyle === 1" :d="expr === 'angry' ? 'M37,43 L46,46' : 'M37,45 L46,44'" />
        <path v-if="P.browStyle === 1" :d="expr === 'angry' ? 'M63,43 L54,46' : 'M54,44 L63,45'" />
        <path v-if="P.browStyle === 2" :d="expr === 'angry' ? 'M38,41 L46,44' : 'M38,43 Q42,40 46,43'" />
        <path v-if="P.browStyle === 2" :d="expr === 'angry' ? 'M62,41 L54,44' : 'M54,43 Q58,40 62,43'" />
      </g>

      <!-- 眼 -->
      <g v-if="expr === 'hurt'">
        <path d="M39,52 L45,52" stroke="#222" stroke-width="1.8" />
        <path d="M55,52 L61,52" stroke="#222" stroke-width="1.8" />
      </g>
      <g v-else-if="expr === 'happy'">
        <path d="M39,52 Q42,49 45,52" stroke="#222" stroke-width="1.8" fill="none" />
        <path d="M55,52 Q58,49 61,52" stroke="#222" stroke-width="1.8" fill="none" />
      </g>
      <g v-else>
        <ellipse cx="42" cy="52" :rx="P.eyeStyle % 2 === 0 ? 2.6 : 3.2" :ry="P.eyeStyle < 2 ? 2.2 : 1.6" fill="#1c1c24" />
        <ellipse cx="58" cy="52" :rx="P.eyeStyle % 2 === 0 ? 2.6 : 3.2" :ry="P.eyeStyle < 2 ? 2.2 : 1.6" fill="#1c1c24" />
        <circle cx="42.8" cy="51.2" r="0.7" fill="#fff" opacity="0.8" />
        <circle cx="58.8" cy="51.2" r="0.7" fill="#fff" opacity="0.8" />
      </g>

      <!-- 鼻口 -->
      <path d="M50,58 L49,63 L51,63" fill="none" stroke="#b08868" stroke-width="1" />
      <path :d="mouth" fill="none" stroke="#a05f4f" stroke-width="1.6" />

      <!-- 配饰 -->
      <g v-if="P.accessory === 1">
        <rect x="24" y="92" width="3" height="30" rx="1.5" fill="#777f8c" transform="rotate(8 25 92)" />
        <rect x="22" y="88" width="7" height="6" rx="1" fill="#c9a227" transform="rotate(8 25 92)" />
      </g>
      <circle v-if="P.accessory === 2" cx="50" cy="100" r="4" fill="#7fb89a" opacity="0.9" />

      <!-- 心魔黑气 -->
      <g v-if="status === 'demonic'" opacity="0.5">
        <path d="M30,110 C26,95 30,85 28,75" stroke="#4a1d5e" stroke-width="4" fill="none">
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
        </path>
        <path d="M70,110 C74,95 70,85 72,75" stroke="#4a1d5e" stroke-width="4" fill="none">
          <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite" />
        </path>
      </g>
    </svg>
  </div>
</template>
