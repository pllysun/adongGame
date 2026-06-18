// 人事类事件（docs/04 §6）：性格与关系网驱动的涌现故事
import type { EventDef } from '../../systems/events'
import { addMood, chronicle, deathRipple, getRel, hasTag, hasTrait, log, relsOf, removeDisciple, setRel } from '../../systems/helpers'
import { demonLean } from './util'

export const PERSONNEL_EVENTS: EventDef[] = [
  {
    id: 'arena_feud',
    category: 'personnel',
    title: '演武结怨',
    weight: 8,
    cooldownYears: 1,
    cast: [
      { slot: 'a', filter: (d) => d.action === 'train' && (hasTrait(d, 'arrogant') || hasTrait(d, 'battlemad')) },
      { slot: 'b', filter: (d, _w, cast) => d.action === 'train' && d !== cast['a'] },
    ],
    text: (c) => `${c.cast['a'].name}与${c.cast['b'].name}在演武场切磋，拳脚渐重，言语渐恶，竟有了真火。`,
    options: [
      {
        text: '执法长老及时喝止',
        ai: 6,
        effects: (c) => {
          setRel(c.w, c.cast['a'].id, c.cast['b'].id, 'rival', -15)
          log(c.w, 'social', `两人被分开，但梁子算是结下了。`)
        },
      },
      {
        text: '任他们打个痛快',
        ai: 4,
        effects: (c) => {
          const [a, b] = [c.cast['a'], c.cast['b']]
          const winner = c.rng.chance(0.5) ? a : b
          const loser = winner === a ? b : a
          winner.combatExp += 2
          loser.status = 'injured'
          loser.statusUntil = c.w.day + c.rng.int(30, 90)
          if (c.rng.chance(0.4)) {
            setRel(c.w, a.id, b.id, 'friend', 25)
            log(c.w, 'social', `${winner.name}胜了半招。不打不相识，两人反倒惺惺相惜。`)
          } else {
            setRel(c.w, a.id, b.id, 'rival', -30)
            addMood(loser, -15)
            log(c.w, 'social', `${loser.name}当众落败，怀恨在心。`)
          }
        },
      },
    ],
  },
  {
    id: 'steal_stones',
    category: 'personnel',
    title: '库房失窃',
    weight: (w) => (w.flags['stealPending'] ? 30 : 2),
    cooldownYears: 2,
    cast: [{ slot: 'thief', filter: (d, w) => (w.flags['stealPending'] ? d.id === w.flags['stealPending'] : hasTag(d, 'steal')) }],
    text: (c) => `库房灵石短了一截。执法堂顺藤摸瓜，竟查到${c.cast['thief'].name}头上——人赃并获。`,
    options: [
      {
        text: '逐出山门',
        ai: 4,
        effects: (c) => {
          const t = c.cast['thief']
          c.w.flags['stealPending'] = false
          log(c.w, 'social', `${t.name}被革除名籍，逐出山门。`)
          deathRipple(c.w, t)
          removeDisciple(c.w, t, '窃盗被逐')
        },
      },
      {
        text: '杖责思过（留人）',
        ai: 6,
        effects: (c) => {
          const t = c.cast['thief']
          c.w.flags['stealPending'] = false
          t.status = 'seclusion'
          t.statusUntil = c.w.day + 180
          addMood(t, -20)
          c.w.sect.stones = Math.max(0, c.w.sect.stones - 50)
          log(c.w, 'social', `${t.name}受杖三十，面壁半年。门规既明，众心稍安。`)
        },
      },
      {
        text: '宽恕不究',
        ai: 2,
        effects: (c) => {
          const t = c.cast['thief']
          c.w.flags['stealPending'] = false
          addMood(t, 15)
          setRel(c.w, t.id, c.w.disciples.find((d) => d.rank === 'master')?.id ?? t.id, 'friend', 20)
          for (const d of c.w.disciples) if (d !== t && c.rng.chance(0.3)) addMood(d, -5)
          log(c.w, 'social', `掌门法外开恩。${t.name}感激涕零，旁人却有微词。`)
        },
      },
    ],
  },
  {
    id: 'defection',
    category: 'personnel',
    title: '弟子叛逃',
    weight: (w) => {
      let p = 0
      for (const d of w.disciples) {
        if (d.traits.includes('loyal')) continue
        const angry = d.mood < -30
        const prone = hasTag(d, 'vengeful') || d.traits.includes('greedy') || d.traits.includes('ambitious')
        if (angry && prone) p += 6
      }
      const lawLv = w.sect.facilities['law'] ?? 0
      // 魔道倾向越深，门风越乱，叛逃越频（正魔路线的代价之一）
      return Math.max(0, p * (1 - lawLv * 0.2) * (1 + demonLean(w) / 80))
    },
    cooldownYears: 3,
    cast: [
      {
        slot: 'traitor',
        filter: (d) =>
          d.mood < -30 && !d.traits.includes('loyal') &&
          (hasTag(d, 'vengeful') || d.traits.includes('greedy') || d.traits.includes('ambitious')),
      },
    ],
    text: (c) => `${c.cast['traitor'].name}趁夜出走，临走前还潜入藏经阁——巡山弟子发现时，山门外只余一串远去的遁光。`,
    options: [
      {
        text: '派人追截',
        ai: 6,
        effects: (c) => {
          const t = c.cast['traitor']
          if (c.rng.chance(0.55)) {
            t.status = 'seclusion'
            t.statusUntil = c.w.day + 360
            t.mood = -20
            log(c.w, 'social', `${t.name}被追回，废去戒律堂面壁一年。心结未解，去意难消。`)
          } else {
            defect(c, t)
          }
        },
      },
      { text: '由他去吧', ai: 4, effects: (c) => defect(c, c.cast['traitor']) },
    ],
  },
  {
    id: 'secret_couple',
    category: 'personnel',
    title: '私定终身',
    weight: (w) => (w.sect.rules.allowCouple ? 0 : 8),
    cooldownYears: 2,
    cast: [
      { slot: 'a', filter: (d, w) => relsOf(w, d.id).some((r) => r.type === 'crush' && r.value >= 50) },
      {
        slot: 'b',
        filter: (d, w, cast) => {
          const a = cast['a']
          if (!a) return false
          const r = getRel(w, a.id, d.id)
          return !!r && r.type === 'crush'
        },
      },
    ],
    text: (c) => `门规禁止弟子结侣，但${c.cast['a'].name}与${c.cast['b'].name}还是在后山立了誓。此事被执法堂撞破。`,
    options: [
      {
        text: '成人之美，特许结侣',
        ai: 6,
        effects: (c) => {
          const e = getRel(c.w, c.cast['a'].id, c.cast['b'].id)
          if (e) e.type = 'couple'
          addMood(c.cast['a'], 30)
          addMood(c.cast['b'], 30)
          log(c.w, 'social', '掌门网开一面，一时传为佳话。')
        },
      },
      {
        text: '棒打鸳鸯，分隔两峰',
        ai: 4,
        effects: (c) => {
          const [a, b] = [c.cast['a'], c.cast['b']]
          addMood(a, -30)
          addMood(b, -30)
          const e = getRel(c.w, a.id, b.id)
          if (e) e.value = Math.max(e.value - 30, 10)
          if (hasTag(a, 'griefDemon') || hasTag(b, 'griefDemon')) {
            const sad = hasTag(a, 'griefDemon') ? a : b
            sad.mood = Math.min(sad.mood, -50)
            log(c.w, 'social', `${sad.name}痴情入骨，自此郁郁寡欢。`)
          }
        },
      },
    ],
  },
  {
    id: 'succession_dispute',
    category: 'personnel',
    title: '夺位之争',
    weight: (w) => (w.flags['successionDispute'] ? 40 : 0),
    cast: [
      { slot: 'a', filter: (d) => d.traits.includes('ambitious') && d.realm >= 2 },
      { slot: 'b', filter: (d, _w, cast) => d !== cast['a'] && d.realm >= 2 },
    ],
    text: (c) => `老掌门尸骨未寒，${c.cast['a'].name}便联络党羽，对新任掌门之位虎视眈眈，与${c.cast['b'].name}一系势同水火。`,
    options: [
      {
        text: '当众比斗定名分',
        ai: 6,
        effects: (c) => {
          c.w.flags['successionDispute'] = false
          const [a, b] = [c.cast['a'], c.cast['b']]
          const winner = c.rng.chance(0.5) ? a : b
          const loser = winner === a ? b : a
          setRel(c.w, a.id, b.id, 'rival', -20)
          addMood(winner, 20)
          addMood(loser, -20)
          log(c.w, 'social', `${winner.name}技高一筹。名分已定，暗流仍存。`)
        },
      },
      {
        text: '各打五十大板，重申门规',
        ai: 4,
        effects: (c) => {
          c.w.flags['successionDispute'] = false
          addMood(c.cast['a'], -15)
          addMood(c.cast['b'], -15)
          log(c.w, 'social', '两派俱受申饬，争端暂息。')
        },
      },
    ],
  },
  {
    id: 'banquet',
    category: 'personnel',
    title: '把酒言欢',
    weight: 5,
    cooldownYears: 1,
    cast: [
      { slot: 'a', filter: (d) => hasTag(d, 'banquet') || d.traits.includes('sociable') },
      { slot: 'b', filter: (d, _w, cast) => d !== cast['a'] },
    ],
    text: (c) => `${c.cast['a'].name}弄来一坛百年灵酿，拉着${c.cast['b'].name}在月下对酌，谈天说地直到东方既白。`,
    options: undefined,
    auto: (c) => {
      setRel(c.w, c.cast['a'].id, c.cast['b'].id, 'friend', 18)
      addMood(c.cast['a'], 10)
      addMood(c.cast['b'], 10)
    },
  },
  {
    id: 'mentor_gift',
    category: 'personnel',
    title: '师恩深重',
    weight: 5,
    cooldownYears: 2,
    cast: [
      { slot: 'master', filter: (d, w) => relsOf(w, d.id).some((r) => r.type === 'master' && r.a === d.id) },
    ],
    text: (c) => `${c.cast['master'].name}见弟子修行勤勉，将自己早年游历所得倾囊相授。`,
    options: undefined,
    auto: (c) => {
      const m = c.cast['master']
      const r = relsOf(c.w, m.id).find((x) => x.type === 'master' && x.a === m.id)
      if (!r) return
      const student = c.w.disciples.find((d) => d.id === r.b)
      if (!student) return
      student.cultivation += student.cultivation * 0.1 + 30
      setRel(c.w, m.id, student.id, 'master', 15)
      addMood(student, 12)
      log(c.w, 'social', `${student.name}得师尊指点，修为精进。`)
    },
  },
  {
    id: 'grief_revenge',
    category: 'personnel',
    title: '仇人见面',
    weight: (w) => {
      const feuds = w.relations.filter((r) => r.type === 'rival' && r.value <= -60)
      return feuds.length * 6
    },
    cooldownYears: 2,
    cast: [
      { slot: 'a', filter: (d, w) => relsOf(w, d.id).some((r) => r.type === 'rival' && r.value <= -60) && hasTag(d, 'vengeful') },
      {
        slot: 'b',
        filter: (d, w, cast) => {
          const a = cast['a']
          if (!a) return false
          const r = getRel(w, a.id, d.id)
          return !!r && r.type === 'rival' && r.value <= -60
        },
      },
    ],
    text: (c) => `深夜的丹房外，${c.cast['a'].name}拦住了${c.cast['b'].name}的去路。新仇旧怨，今夜做个了断。`,
    options: [
      {
        text: '速派长老阻止',
        ai: 7,
        effects: (c) => {
          setRel(c.w, c.cast['a'].id, c.cast['b'].id, 'rival', -10)
          addMood(c.cast['a'], -10)
          log(c.w, 'social', '一场私斗被强行按下，仇怨却又深了一分。')
        },
      },
      {
        text: '生死有命，门规事后再算',
        ai: 3,
        effects: (c) => {
          const [a, b] = [c.cast['a'], c.cast['b']]
          const winner = c.rng.chance(0.55) ? a : b
          const loser = winner === a ? b : a
          if (c.rng.chance(0.3)) {
            log(c.w, 'death', `私斗酿成大祸——${loser.name}伤重不治！`, 4)
            chronicle(c.w, 'death', `${loser.name}死于同门私斗，${winner.name}被废去修为关入死牢。`)
            deathRipple(c.w, loser)
            removeDisciple(c.w, loser, '私斗身亡')
            winner.realm = Math.max(1, winner.realm - 2)
            winner.cultivation = 0
            winner.status = 'seclusion'
            winner.statusUntil = c.w.day + 3600
          } else {
            loser.status = 'injured'
            loser.statusUntil = c.w.day + c.rng.int(180, 540)
            const e = getRel(c.w, a.id, b.id)
            if (e) e.value = Math.min(0, e.value + 40) // 打完反而消了点气
            log(c.w, 'social', `${loser.name}重伤败北。一番恶斗，恩怨倒清了几分。`)
          }
        },
      },
    ],
  },
  {
    id: 'comprehension_blocked',
    category: 'personnel',
    title: '道心蒙尘',
    weight: 4,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.mood < -20 && d.status === 'normal' }],
    text: (c) => `${c.cast['d'].name}近来眉宇间郁气不散，修炼时频频岔气，长老们看在眼里。`,
    options: [
      {
        text: '掌门亲自开解',
        ai: 6,
        effects: (c) => {
          addMood(c.cast['d'], 25)
          log(c.w, 'social', `一席长谈后，${c.cast['d'].name}眼中重新有了光。`)
        },
      },
      {
        text: '赐静心丹一枚',
        ai: 5,
        enabled: (c) => ((c.w.sect.pills['jingxin'] ?? 0) > 0 || (c.w.sect.pills['qingxin'] ?? 0) > 0 ? true : '无静心类丹药'),
        effects: (c) => {
          const pid = (c.w.sect.pills['jingxin'] ?? 0) > 0 ? 'jingxin' : 'qingxin'
          c.w.sect.pills[pid]--
          addMood(c.cast['d'], pid === 'jingxin' ? 20 : 10)
        },
      },
      { text: '修行之路本就要自己闯', ai: 2, effects: (c) => addMood(c.cast['d'], -5) },
    ],
  },
]

function defect(c: { w: import('@/shared/types').WorldState }, t: import('@/shared/types').Disciple): void {
  log(c.w, 'death', `${t.name}叛出宗门，临行卷走了若干灵石。`, 3)
  chronicle(c.w, 'defect', `${t.name}叛宗而去，恩义两断。`)
  c.w.sect.stones = Math.max(0, c.w.sect.stones - 100)
  c.w.enemies['xuanming'] = Math.min(100, (c.w.enemies['xuanming'] ?? 0) + 6)
  deathRipple(c.w, t)
  removeDisciple(c.w, t, '叛逃')
}
