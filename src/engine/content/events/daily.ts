// 日常风味事件（堆量抗重复）：全部 auto（只进事件流、不打断），效果极小，靠 vary 文本变体织出宗门日常的纹理。
// 这些事件不改变战略局面，但让"十倍速看宗门自己活着"时屏幕右侧不再翻来覆去那几句话。
import type { EventDef } from '../../systems/events'
import { addMood, setRel } from '../../systems/helpers'
import { vary } from './util'

export const DAILY_EVENTS: EventDef[] = [
  {
    id: 'daily_dawn',
    category: 'opportunity',
    title: '晨钟暮鼓',
    weight: 4,
    cooldownYears: 1,
    text: (c) =>
      vary(c.rng, [
        '晨雾未散，钟声漫过山门，弟子们陆续走向各自的洞府与田垄，又是寻常的一日。',
        '暮鼓声里，演武场收了势，丹房熄了火，山门在霞光中沉静下来。',
        '春去秋来，灵气随节气流转，老树又添一圈年轮。',
      ]),
    auto: (c) => {
      if (c.rng.chance(0.12)) c.w.sect.qiyun += 1
    },
  },
  {
    id: 'daily_spar',
    category: 'personnel',
    title: '同门切磋',
    weight: 5,
    cooldownYears: 1,
    cast: [
      { slot: 'a', filter: (d) => d.status === 'normal' },
      { slot: 'b', filter: (d, _w, cast) => d !== cast['a'] && d.status === 'normal' },
    ],
    text: (c) =>
      vary(c.rng, [
        `${c.cast['a'].name}与${c.cast['b'].name}在演武场拆了百余招，难分高下，相视一笑。`,
        `${c.cast['a'].name}向${c.cast['b'].name}讨教剑法，一来一往，皆有所得。`,
        `晨练时${c.cast['a'].name}与${c.cast['b'].name}比试吐纳之术，引来一众师弟围观。`,
      ]),
    auto: (c) => {
      setRel(c.w, c.cast['a'].id, c.cast['b'].id, 'peer', 5)
      c.cast['a'].combatExp += 1
      c.cast['b'].combatExp += 1
    },
  },
  {
    id: 'daily_herb',
    category: 'opportunity',
    title: '采药归来',
    weight: 5,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.action === 'work' || d.action === 'travel' }],
    text: (c) =>
      vary(c.rng, [
        `${c.cast['d'].name}背着满筐灵草从后山回来，鞋上还沾着晨露。`,
        `${c.cast['d'].name}在崖壁缝里寻到几株野生灵芝，喜不自胜。`,
      ]),
    auto: (c) => {
      c.w.sect.herbs += c.rng.int(4, 12)
    },
  },
  {
    id: 'daily_music',
    category: 'personnel',
    title: '月下抚琴',
    weight: 4,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.status === 'normal' }],
    text: (c) =>
      vary(c.rng, [
        `夜深人静，${c.cast['d'].name}于崖边抚一曲，琴音清越，闻者俱觉心神舒畅。`,
        `${c.cast['d'].name}吹箫自遣，山风和鸣，连巡夜的弟子都驻足听了许久。`,
      ]),
    auto: (c) => {
      const listeners = c.w.disciples.filter(() => c.rng.chance(0.3))
      for (const d of listeners) addMood(d, 4)
      addMood(c.cast['d'], 6)
    },
  },
  {
    id: 'daily_chess',
    category: 'personnel',
    title: '手谈一局',
    weight: 4,
    cooldownYears: 1,
    cast: [
      { slot: 'a', filter: (d) => d.status === 'normal' },
      { slot: 'b', filter: (d, _w, cast) => d !== cast['a'] && d.status === 'normal' },
    ],
    text: (c) =>
      vary(c.rng, [
        `${c.cast['a'].name}与${c.cast['b'].name}对弈一局，从黑白纵横里竟也悟出些修行的道理。`,
        `一盘棋下到日落，${c.cast['a'].name}与${c.cast['b'].name}谁也不肯认输。`,
      ]),
    auto: (c) => {
      setRel(c.w, c.cast['a'].id, c.cast['b'].id, 'peer', 6)
    },
  },
  {
    id: 'daily_insight',
    category: 'opportunity',
    title: '雨夜参悟',
    weight: 4,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.comprehension >= 6 && d.status === 'normal' }],
    text: (c) =>
      vary(c.rng, [
        `一场夜雨，${c.cast['d'].name}观檐水滴石，若有所思。`,
        `${c.cast['d'].name}于风雨中静坐一宿，晨起时眉间多了几分通透。`,
      ]),
    auto: (c) => {
      c.cast['d'].cultivation += 20 + c.cast['d'].comprehension * 5
    },
  },
  {
    id: 'daily_kitchen',
    category: 'opportunity',
    title: '灶房琐事',
    weight: 3,
    cooldownYears: 1,
    text: (c) =>
      vary(c.rng, [
        '灶房失了火，烧糊了半锅灵米粥，惹得管事一阵叨念。',
        '后厨的灵泉水管冻裂，修缮花了些工夫。',
      ]),
    auto: (c) => {
      c.w.sect.rice = Math.max(0, c.w.sect.rice - c.rng.int(3, 10))
    },
  },
  {
    id: 'daily_prank',
    category: 'personnel',
    title: '顽童闯祸',
    weight: 3,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.realm <= 1 }],
    text: (c) =>
      vary(c.rng, [
        `年纪最小的${c.cast['d'].name}偷溜进藏经阁玩耍，被执事逮个正着，罚抄经书三卷。`,
        `${c.cast['d'].name}把师兄的飞剑当烧火棍，闯了祸，红着眼圈认错。`,
      ]),
    auto: (c) => {
      addMood(c.cast['d'], -3)
    },
  },
  {
    id: 'daily_drunk',
    category: 'personnel',
    title: '把酒当歌',
    weight: 4,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.status === 'normal' }],
    text: (c) =>
      vary(c.rng, [
        `${c.cast['d'].name}沽了一壶灵酿，独酌至微醺，对月长啸，倒也快活。`,
        `${c.cast['d'].name}醉后吐出几句真言，引得同门哄堂大笑。`,
      ]),
    auto: (c) => {
      addMood(c.cast['d'], 8)
    },
  },
  {
    id: 'daily_sword_polish',
    category: 'personnel',
    title: '砥砺锋芒',
    weight: 4,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.action === 'train' || d.combatExp >= 3 }],
    text: (c) =>
      vary(c.rng, [
        `${c.cast['d'].name}独守演武场至深夜，一剑一式皆不肯苟且。`,
        `${c.cast['d'].name}对着木桩练了整日，掌心磨出血泡也浑然不觉。`,
      ]),
    auto: (c) => {
      c.cast['d'].combatExp += 1
    },
  },
  {
    id: 'daily_stargaze',
    category: 'opportunity',
    title: '夜观星象',
    weight: 3,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.realm >= 3 }],
    text: (c) =>
      vary(c.rng, [
        `${c.cast['d'].name}登高夜观星象，言天象有变，宗门气运似有微澜。`,
        `${c.cast['d'].name}夜读星图，掐指推演良久，神色莫测。`,
      ]),
    auto: (c) => {
      if (c.rng.chance(0.5)) c.w.sect.qiyun += 1
      else c.w.sect.qiyun = Math.max(0, c.w.sect.qiyun - 1)
    },
  },
  {
    id: 'daily_market',
    category: 'opportunity',
    title: '坊市小利',
    weight: 4,
    cooldownYears: 1,
    text: (c) =>
      vary(c.rng, [
        '执事下山打理坊市铺面，归来时账上多了些进项。',
        '山门外的灵茶铺今岁生意兴隆，添了几枚灵石入库。',
      ]),
    auto: (c) => {
      c.w.sect.stones += c.rng.int(10, 40)
    },
  },
  {
    id: 'daily_pet',
    category: 'opportunity',
    title: '灵兽嬉戏',
    weight: 3,
    cooldownYears: 1,
    trigger: (w) => !!w.flags['beastPact'] || w.sect.qiyun >= 12,
    text: (c) =>
      vary(c.rng, [
        '山门里养的灵兽在灵田边打盹，弟子们路过都要逗弄两下，倒成了一景。',
        '一只通灵的白鹿衔来一枝灵草，放在丹房门口便扬长而去。',
      ]),
    auto: (c) => {
      const lucky = c.w.disciples.filter(() => c.rng.chance(0.2))
      for (const d of lucky) addMood(d, 3)
    },
  },
  {
    id: 'daily_letter',
    category: 'personnel',
    title: '飞剑传书',
    weight: 3,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.status === 'normal' }],
    text: (c) =>
      vary(c.rng, [
        `一道飞剑自远方而来，给${c.cast['d'].name}捎来了故人的近况，看罢久久不语。`,
        `${c.cast['d'].name}收到一封旧友的书信，提笔回了三页，封进剑匣里送了出去。`,
      ]),
    auto: (c) => {
      addMood(c.cast['d'], c.rng.chance(0.6) ? 4 : -4)
    },
  },
]
