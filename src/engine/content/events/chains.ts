// 大型事件链：转世重修者（仙品入口）、飞升大典（胜利收口）、心魔劫、自创功法等
import type { EventDef } from '../../systems/events'
import { addMood, chronicle, log, setRel } from '../../systems/helpers'
import { generateDisciple } from '../../state/disciple'
import { declareVictory } from '../../systems/victory'
import { GONGFA } from '../gongfa'
import { sectMenace } from './menace'

export const CHAIN_EVENTS: EventDef[] = [
  // ── 转世重修者（once，仙品资质的主要来源，docs/01 §2） ──
  {
    id: 'reincarnator_omen',
    category: 'opportunity',
    title: '异象临世',
    once: true,
    weight: (w) => Math.min(8, w.sect.qiyun / 6),
    trigger: (w) => w.sect.qiyun >= 25 && w.day > 360 * 30,
    text: () => '是夜，紫气东来三万里，山门上空星辰倒悬。掌门夜观天象，掐指良久，面色数变。',
    options: undefined,
    auto: (c) => c.api.sched('reincarnator_arrival', 180, 540),
  },
  {
    id: 'reincarnator_arrival',
    category: 'chain',
    title: '转世之人',
    pause: true,
    text: () => '一个三岁稚童独自走上山门，开口便是上古雅言："吾观此地灵秀，可为道场。"——竟是夺舍重修的上古大能转世！',
    options: [
      {
        text: '焚香接引，待若上宾',
        ai: 8,
        effects: (c) => {
          const d = generateDisciple(c.rng, c.w, { ageYears: [3, 6], minAptitude: 6 })
          d.comprehension = 10
          d.luck = 10
          d.gongfa = 'zixia'
          c.w.disciples.push(d)
          chronicle(c.w, 'legend', `转世大能${d.name}入门，仙品之资震动天下。`)
          log(c.w, 'event', `${d.name}入门。此子仙品之资，宗门气运自此改写。`, 6)
          c.api.sched('reincarnator_hunted', 1800, 3600, { kid: d.id })
        },
      },
      {
        text: '来历不明，请回吧',
        ai: 1,
        effects: (c) => {
          c.w.sect.qiyun = Math.max(0, c.w.sect.qiyun - 10)
          log(c.w, 'event', '稚童叹了口气，转身下山。多年后，邻郡有大宗崛起。')
        },
      },
    ],
  },
  {
    id: 'reincarnator_hunted',
    category: 'chain',
    title: '觊觎者至',
    pause: true,
    cast: [{ slot: 'kid', filter: (d) => d.aptitude >= 6 }],
    text: (c) => `${c.cast['kid']?.name ?? '那位转世弟子'}的根脚终究瞒不住。这一日，三道遮天蔽日的神识压向山门——有人要夺舍这具仙品道体！`,
    options: [
      {
        text: '倾宗死战，护我弟子',
        ai: 9,
        effects: (c) => {
          c.api.combat({
            kind: 'sectwar', enemyName: '夺舍邪修', enemyPower: sectMenace(c.w, 1.2), defense: true,
            lootStones: 1000, lootGongfaRarity: 4, lethality: 0.7,
            onWinEvent: 'reincarnator_saved',
          })
        },
      },
    ],
  },
  {
    id: 'reincarnator_saved',
    category: 'chain',
    title: '道体得全',
    text: () => '邪修授首。经此一役，那孩子在灵前长跪不起，誓以此生回报宗门。',
    options: undefined,
    auto: (c) => {
      const kid = c.w.disciples.find((d) => d.aptitude >= 6)
      if (kid) {
        addMood(kid, 40)
        kid.traits = kid.traits.filter((t) => t !== 'ambitious')
        if (!kid.traits.includes('loyal')) kid.traits.push('loyal')
        const master = c.w.disciples.find((d) => d.rank === 'master')
        if (master) setRel(c.w, master.id, kid.id, 'master', 60)
      }
      c.w.sect.reputation += 40
    },
  },

  // ── 自创功法（悟性 10 天才的事件链，docs/02 §6） ──
  {
    id: 'create_gongfa',
    category: 'opportunity',
    title: '闭关著书',
    weight: 3,
    cooldownYears: 20,
    cast: [{ slot: 'genius', filter: (d) => d.comprehension >= 10 && d.realm >= 4 }],
    text: (c) => `${c.cast['genius'].name}闭关三载，出关之日紫气盈室——他将毕生所学熔于一炉，自创出一部功法！`,
    options: undefined,
    auto: (c) => {
      const pool = GONGFA.filter((g) => g.rarity >= 4 && !c.w.sect.gongfa.includes(g.id))
      if (pool.length > 0) {
        const g = c.rng.pick(pool)
        c.w.sect.gongfa.push(g.id)
        chronicle(c.w, 'gongfa', `${c.cast['genius'].name}自创${g.name}，列入镇宗典藏。`)
        log(c.w, 'event', `${g.name}问世！宗门底蕴更上层楼。`, g.rarity)
      }
      c.w.sect.reputation += 30
      addMood(c.cast['genius'], 30)
    },
  },

  // ── 飞升大典（胜利事件链，docs/00） ──
  {
    id: 'ascension_1',
    category: 'chain',
    title: '飞升大典 · 卜期',
    pause: true,
    text: (c) => `${c.w.sect.name}已有三位渡劫大能，天门之兆隐现。掌门召集全宗：当筑飞升台，卜吉日，举宗共赴仙缘！`,
    options: [
      {
        text: '倾尽宗门之力筑台（灵石 5000、材料 2000）',
        ai: 10,
        enabled: (c) =>
          c.w.sect.stones >= 5000 && c.w.sect.materials >= 2000 ? true : '需灵石 5000、材料 2000',
        effects: (c) => {
          c.w.sect.stones -= 5000
          c.w.sect.materials -= 2000
          c.api.sched('ascension_2', 360, 720)
          chronicle(c.w, 'ascension', '飞升台动工，全宗弟子昼夜不歇。')
          log(c.w, 'event', '飞升台动工了。所有人都知道，一个时代将要落幕，另一个时代将要开始。', 6)
        },
      },
      {
        text: '时机未至，再积累几年',
        ai: 1,
        effects: (c) => {
          c.w.flags['ascensionStarted'] = false
          log(c.w, 'event', '飞升之议暂且搁置。')
        },
      },
    ],
  },
  {
    id: 'ascension_2',
    category: 'chain',
    title: '飞升大典 · 天门开',
    pause: true,
    text: () =>
      '飞升台落成之日，九霄云开，天门垂落万丈金光。渡劫大能们立于台上，最后看了一眼这座生养他们的山门——风起，雷动，仙乐自天外而来。',
    options: [
      {
        text: '举宗飞升！',
        ai: 10,
        effects: (c) => {
          declareVictory(c.w)
        },
      },
    ],
  },

  // ── 造化玉髓（docs/01 §3"资质改命作为终极消耗品"）──
  {
    id: 'zaohua_rumor',
    category: 'opportunity',
    title: '造化玉髓现世',
    weight: 5,
    cooldownYears: 50,
    trigger: (w) => w.disciples.some((d) => d.realm >= 6),
    text: () => '上古遗府现世，传闻府中藏有一枚"造化玉髓"——服之可改资质、夺天命。各方大能闻风而动！',
    options: [
      {
        text: '派最强者夺宝（点将）',
        ai: 9,
        effects: (c) => {
          c.api.combat({
            kind: 'rogue', enemyName: '夺宝大能联军', enemyPower: sectMenace(c.w, 1.05),
            playerSelect: true, maxTeam: 3, lethality: 0.7, onWinEvent: 'zaohua_won',
          })
        },
      },
      { text: '天命不可强求', ai: 1, effects: () => {} },
    ],
  },
  {
    id: 'zaohua_won',
    category: 'chain',
    title: '造化玉髓到手',
    pause: true,
    cast: [{ slot: 'lucky', filter: (d) => d.aptitude < 6 && d.realm >= 3, sortBy: 'aptitude' }],
    text: (c) => `造化玉髓莹白如月，托在掌心微微发烫。门中以${c.cast['lucky'].name}资质最佳又正当壮年，由其服用收益最大。`,
    options: [
      {
        text: (c) => `赐予${c.cast['lucky'].name}，改命换天`,
        ai: 9,
        effects: (c) => {
          const d = c.cast['lucky']
          d.aptitude = Math.min(6, d.aptitude + 1) as never
          d.shownAptitude = d.aptitude
          addMood(d, 40)
          log(c.w, 'event', `${d.name}服下造化玉髓，资质脱胎换骨！`, d.aptitude)
          chronicle(c.w, 'treasure', `${d.name}得造化玉髓改命，资质更上一品。`)
        },
      },
    ],
  },

  // ── 灾星浩劫（cursed 特质钩子） ──
  {
    id: 'cursed_trouble',
    category: 'personnel',
    title: '祸事缠身',
    weight: (w) => w.disciples.filter((d) => d.traits.includes('cursed')).length * 4,
    cooldownYears: 3,
    cast: [{ slot: 'jinx', filter: (d) => d.traits.includes('cursed') }],
    text: (c) => `${c.cast['jinx'].name}炼丹炸炉、走路崴脚、抄经打翻墨缸——这个月宗门的霉运全聚在他一人身上。`,
    options: undefined,
    auto: (c) => {
      c.w.sect.stones = Math.max(0, c.w.sect.stones - 80)
      addMood(c.cast['jinx'], -10)
      log(c.w, 'event', '修缮损毁器物花了 80 灵石。')
    },
  },
]
