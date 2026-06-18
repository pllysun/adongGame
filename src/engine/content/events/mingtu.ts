// 命途事件（docs/09 §3.4, §7）：个人抉择（角色 AI 自主）、师徒、心结。
// 这些事件的 options 带 appeal()（角色 AI 据此抉择）与 memory（留下持久痕迹）。
import type { EventDef } from '../../systems/events'
import { C } from '../../systems/character-ai'
import { addMood, chronicle, deathRipple, getD, log, relsOf, removeDisciple } from '../../systems/helpers'
import { clearOmen } from '../../systems/omens'
import { GONGFA } from '../gongfa'

export const MINGTU_EVENTS: EventDef[] = [
  // ── 心魔劫：堕落 or 守心，由角色 AI 自主（征兆 demon 调度而来）──
  {
    id: 'inner_demon_choice',
    category: 'chain',
    personal: 'self',
    cast: [{ slot: 'self', filter: () => true }],
    title: '心魔劫',
    text: (c) => `${c.cast['self'].name}静室枯坐，心魔翻涌如潮，一念天堂，一念地狱……`,
    options: [
      {
        text: '以道心镇压心魔',
        appeal: () => [C.daoxin(1.6), C.righteous(1.0), C.trait('resolute', '坚毅', 1.3), C.base('求安', 0.4)],
        effects: (c) => {
          clearOmen(c.w, 'demon', c.cast['self'].id)
          addMood(c.cast['self'], 10)
        },
        memory: {
          text: (c) => `${c.cast['self'].name}于心魔劫中坚守本心，道心更胜往昔。`,
          tags: ['了结心结', '守心'],
          impact: { daoxin: 12, xinmo: -30 },
        },
      },
      {
        text: '放任心魔、求一时之力',
        appeal: () => [C.xinmo(1.8), C.molean(1.2), C.daoxinResist(1.0), C.trait('ruthless', '杀伐', 1.2)],
        effects: (c) => {
          clearOmen(c.w, 'demon', c.cast['self'].id)
          const d = c.cast['self']
          d.cultivation += d.cultivation * 0.12 + 60
          if (d.status === 'normal') d.status = 'demonic'
        },
        memory: {
          text: (c) => `${c.cast['self'].name}向心魔低头，气息一时暴涨，眼底却多了抹猩红。`,
          tags: ['堕魔', '心魔反噬'],
          impact: { molean: 18, daoxin: -15, xinmo: 10, traitGained: 'ruthless' },
          causedByTag: '丧侣',
        },
      },
    ],
  },

  // ── 叛逃抉择（征兆 defect 调度）──
  {
    id: 'defection_choice',
    category: 'chain',
    personal: 'self',
    cast: [{ slot: 'self', filter: () => true }],
    title: '去意',
    text: (c) => `夜色深沉，${c.cast['self'].name}收拾起行囊，又放下，山门内外，何处是归途？`,
    options: [
      {
        text: '留下，宗门待我不薄',
        appeal: () => [C.loyalty(1.8), C.trait('loyal', '忠义', 2), C.base('念旧', 0.5)],
        effects: (c) => {
          clearOmen(c.w, 'defect', c.cast['self'].id)
          c.cast['self'].beliefs.loyalty = Math.min(100, c.cast['self'].beliefs.loyalty + 10)
        },
        memory: {
          text: (c) => `${c.cast['self'].name}几番挣扎，终究放不下这一山一门。`,
          tags: ['留宗'], impact: { loyalty: 12 }, kind: 'minor',
        },
      },
      {
        text: '走，从此江湖路远',
        appeal: () => [C.disloyal(1.8), C.molean(0.8), C.trait('ambitious', '野心', 1.5), C.memory('结仇', '宿怨', 1.0)],
        effects: (c) => {
          clearOmen(c.w, 'defect', c.cast['self'].id)
          const d = c.cast['self']
          log(c.w, 'death', `${d.name}不告而别，叛出宗门。`, 3)
          chronicle(c.w, 'defect', `${d.name}叛宗而去，恩义两断。`)
          c.w.sect.stones = Math.max(0, c.w.sect.stones - 80)
          c.w.enemies['xuanming'] = Math.min(100, (c.w.enemies['xuanming'] ?? 0) + 6)
          deathRipple(c.w, d)
          removeDisciple(c.w, d, '叛逃')
        },
        memory: {
          text: (c) => `${c.cast['self'].name}终是走了。`, tags: ['叛逃'],
        },
      },
    ],
  },

  // ── 魔道抉择（征兆 corrupt 调度）：是否一条道走到黑 ──
  {
    id: 'demon_path_choice',
    category: 'chain',
    personal: 'self',
    cast: [{ slot: 'self', filter: () => true }],
    title: '岔路',
    text: (c) => `${c.cast['self'].name}的魔功已小有所成，是悬崖勒马，还是更进一步？`,
    options: [
      {
        text: '悬崖勒马，改修正道',
        appeal: () => [C.daoxin(1.4), C.righteous(1.4), C.trait('chivalrous', '侠义', 1.2)],
        effects: (c) => {
          clearOmen(c.w, 'corrupt', c.cast['self'].id)
          const d = c.cast['self']
          // 换一部正道功法（若有）
          const pure = c.w.sect.gongfa.map((id) => GONGFA.find((g) => g.id === id)!).find((g) => g && !g.tags?.includes('demonic'))
          if (pure) d.gongfa = pure.id
        },
        memory: {
          text: (c) => `${c.cast['self'].name}幡然醒悟，弃魔功而改修正道。`,
          tags: ['迷途知返'], impact: { molean: -25, daoxin: 12 },
        },
      },
      {
        text: '一条道走到黑',
        appeal: () => [C.molean(1.8), C.trait('ruthless', '杀伐', 1.3), C.daoxinResist(1.0)],
        effects: (c) => {
          clearOmen(c.w, 'corrupt', c.cast['self'].id)
          const d = c.cast['self']
          d.cultivation += d.cultivation * 0.1 + 50
        },
        memory: {
          text: (c) => `${c.cast['self'].name}于魔道愈陷愈深，再难回头。`,
          tags: ['入魔', '魔功大成'], impact: { molean: 20, daoxin: -12 },
        },
      },
    ],
  },

  // ── 师恩：师尊向徒弟传功，巩固师承与忠诚 ──
  {
    id: 'master_teaching',
    category: 'personnel',
    weight: 5,
    cooldownYears: 2,
    cast: [{ slot: 'master', filter: (d, w) => relsOf(w, d.id).some((r) => r.type === 'master' && r.a === d.id) }],
    title: '倾囊相授',
    text: (c) => `${c.cast['master'].name}见门下弟子勤勉，召入静室细细点拨。`,
    options: undefined,
    auto: (c) => {
      const m = c.cast['master']
      const r = relsOf(c.w, m.id).find((x) => x.type === 'master' && x.a === m.id)
      const student = r ? getD(c.w, r.b) : undefined
      if (!student) return
      student.cultivation += student.cultivation * 0.08 + 30
      student.beliefs.loyalty = Math.min(100, student.beliefs.loyalty + 6)
      addMood(student, 8)
      log(c.w, 'social', `${student.name}得师尊${m.name}指点，受益匪浅。`)
    },
  },

  // ── 弑师：仇怨极深 + 魔倾高的徒弟，对师尊起杀心（角色 AI 自主）──
  {
    id: 'kill_master_choice',
    category: 'personnel',
    personal: 'self',
    weight: (w) => {
      let p = 0
      for (const d of w.disciples) {
        if (!d.masterId) continue
        const rel = w.relations.find((r) => r.type === 'master' && (r.a === d.masterId && r.b === d.id))
        if (rel && rel.value <= -50 && d.beliefs.molean >= 50) p += 4
      }
      return p
    },
    cooldownYears: 4,
    cast: [
      {
        slot: 'self',
        filter: (d, w) => {
          if (!d.masterId) return false
          const rel = w.relations.find((r) => r.type === 'master' && r.a === d.masterId && r.b === d.id)
          return !!rel && rel.value <= -50 && d.beliefs.molean >= 50
        },
      },
    ],
    title: '逆徒',
    text: (c) => `${c.cast['self'].name}与师尊积怨已深，魔念翻涌间，竟动了弑师的心思。`,
    options: [
      {
        text: '忍下杀心',
        appeal: () => [C.daoxin(1.5), C.righteous(1.2), C.base('天良', 0.5)],
        effects: (c) => addMood(c.cast['self'], -8),
        memory: { text: (c) => `${c.cast['self'].name}终究没能下得了手。`, tags: ['隐忍'], impact: { xinmo: 8 } },
      },
      {
        text: '欺师灭祖',
        appeal: () => [C.molean(1.8), C.xinmo(1.2), C.trait('ruthless', '杀伐', 1.4), C.daoxinResist(1)],
        effects: (c) => {
          const d = c.cast['self']
          const master = d.masterId ? getD(c.w, d.masterId) : undefined
          if (master && master.realm <= d.realm + 1) {
            log(c.w, 'death', `${d.name}暗算师尊${master.name}，欺师灭祖，震动全宗！`, 5)
            chronicle(c.w, 'demonic', `${d.name}弑师${master.name}，叛出宗门。`)
            deathRipple(c.w, master)
            removeDisciple(c.w, master, `被逆徒${d.name}所害`)
            d.masterId = null
            log(c.w, 'death', `${d.name}事败潜逃，下落不明。`)
            deathRipple(c.w, d)
            removeDisciple(c.w, d, '弑师叛逃')
            c.w.enemies['xuanming'] = Math.min(100, (c.w.enemies['xuanming'] ?? 0) + 10)
          } else {
            log(c.w, 'social', `${d.name}行刺师尊不成，反被重创关押。`)
            d.status = 'seclusion'
            d.statusUntil = c.w.day + 1080
          }
        },
        memory: { text: (c) => `${c.cast['self'].name}对师尊痛下杀手。`, tags: ['弑师'], impact: { molean: 15, daoxin: -20 } },
      },
    ],
  },

  // ── 顿悟：高道心 + 经历过心结者，可能升华为战力/突破助力 ──
  {
    id: 'enlightenment',
    category: 'opportunity',
    weight: (w) => w.disciples.filter((d) => d.beliefs.daoxin >= 70 && d.comprehension >= 7).length * 2,
    cooldownYears: 3,
    cast: [{ slot: 'self', filter: (d) => d.beliefs.daoxin >= 70 && d.comprehension >= 7 && d.status === 'normal' }],
    title: '红尘悟道',
    text: (c) => `${c.cast['self'].name}于一花一叶间窥见大道，心境澄明，气息节节攀升。`,
    options: undefined,
    auto: (c) => {
      const d = c.cast['self']
      d.cultivation += d.cultivation * 0.15 + 120
      d.beliefs.daoxin = Math.min(100, d.beliefs.daoxin + 8)
      addMood(d, 15)
      log(c.w, 'breakthrough', `${d.name}红尘悟道，修为大进。`, 3)
      chronicle(c.w, 'awaken', `${d.name}悟道有成，道心通明。`)
    },
  },
]
