// 机遇类事件（docs/04 §6）
import type { EventDef } from '../../systems/events'
import { addMood, log, chronicle, setRel, deathRipple, removeDisciple } from '../../systems/helpers'
import { GONGFA } from '../gongfa'
import { ARTIFACTS } from '../artifacts'
import { generateDisciple } from '../../state/disciple'
import { sectCapacity } from '../facilities'
import { sectMenace } from './menace'
import { vary } from './util'
import type { Rarity } from '@/shared/types'

/** 按品阶范围随机给一部宗门没有的功法 */
function lootGongfa(rarityMin: Rarity, rarityMax: Rarity) {
  return (c: { w: import('@/shared/types').WorldState; rng: import('../../core/rng').RNG }) => {
    const libLv = c.w.sect.facilities['library'] ?? 0
    const cap = Math.min(rarityMax, Math.max(0, libLv - 1)) as Rarity
    const pool = GONGFA.filter((g) => g.rarity >= rarityMin && g.rarity <= cap && !c.w.sect.gongfa.includes(g.id))
    if (pool.length === 0) {
      c.w.sect.stones += 200
      log(c.w, 'event', '所获功法已有藏本（或藏经阁品阶不足），折灵石 200。')
      return
    }
    const g = c.rng.pick(pool)
    c.w.sect.gongfa.push(g.id)
    log(c.w, 'event', `宗门获得功法${g.name}，已收入藏经阁。`, g.rarity)
    if (g.rarity >= 3) chronicle(c.w, 'gongfa', `${g.name}入藏${c.w.sect.name}藏经阁。`)
  }
}

export const OPPORTUNITY_EVENTS: EventDef[] = [
  {
    id: 'secret_realm',
    category: 'opportunity',
    title: '秘境开启',
    weight: 12,
    cooldownYears: 4,
    trigger: (w) => w.disciples.length >= 3,
    text: (c) =>
      vary(c.rng, [
        '北域灵潮翻涌，一座上古秘境裂开了入口。各方修士闻风而动——机缘与凶险并存，去是不去？',
        '云海深处浮现一座倒悬仙山，山门洞开，吞吐着上古的气息。多少人为之命丧，多少人因之飞黄。',
        '一道地脉裂隙在西岭张开了口子，里头隐约有法宝灵光流转，也隐约有森森煞气。',
      ]),
    options: [
      {
        text: '点将探秘',
        ai: 10,
        effects: (c) => {
          const era = Math.min(5, Math.floor(c.w.day / 360 / 60)) // 秘境收获随年代提升
          c.api.combat({
            kind: 'rogue',
            enemyName: '秘境守护傀儡',
            enemyPower: sectMenace(c.w, 0.7) * (0.8 + c.rng.next() * 0.6),
            playerSelect: true,
            maxTeam: 4,
            lootStones: 300 * (era + 1),
            lootMaterials: 60 * (era + 1),
            onWinEvent: 'secret_realm_loot',
            lethality: 0.5,
          })
        },
      },
      { text: '机缘虽好，性命要紧', ai: 2, effects: (c) => log(c.w, 'event', '宗门按兵不动，听闻别派在秘境中收获颇丰。') },
    ],
  },
  {
    id: 'secret_realm_loot',
    category: 'chain',
    title: '秘境探宝',
    text: () => '傀儡既破，秘境深处的石室缓缓洞开——蒙尘的玉简与宝光流转的法器静候来人。',
    options: [
      { text: '取功法玉简', ai: 8, effects: lootGongfa(1, 4) },
      {
        text: '取法器',
        ai: 5,
        effects: (c) => {
          const pool = ARTIFACTS.filter((a) => a.rarity <= 3 && !c.w.sect.artifacts.includes(a.id))
          if (pool.length > 0) {
            const a = c.rng.pick(pool)
            c.w.sect.artifacts.push(a.id)
            log(c.w, 'event', `宗门获得${a.name}。`, a.rarity)
          } else {
            c.w.sect.stones += 400
          }
        },
      },
      { text: '搜刮灵石矿砂', ai: 3, effects: (c) => { c.w.sect.stones += 500; c.w.sect.materials += 100; log(c.w, 'event', '满载而归：灵石 +500，材料 +100。') } },
    ],
  },
  {
    id: 'auction',
    category: 'opportunity',
    title: '坊市拍卖会',
    weight: 10,
    cooldownYears: 3,
    trigger: (w) => w.sect.stones >= 300,
    text: (c) => `万宝楼拍卖会的请柬送到了山门。压轴拍品据说是一部品阶不俗的功法。（现有灵石 ${c.w.sect.stones}）`,
    options: [
      {
        text: '豪掷千金（灵石 800）',
        ai: 6,
        enabled: (c) => (c.w.sect.stones >= 800 ? true : '灵石不足 800'),
        effects: (c) => {
          c.w.sect.stones -= 800
          if (c.rng.chance(0.75)) lootGongfa(2, 4)(c)
          else {
            log(c.w, 'event', '高价拍下的玉简竟是残本！万宝楼赔了三百灵石了事。')
            c.w.sect.stones += 300
          }
        },
      },
      {
        text: '小额竞买（灵石 300）',
        ai: 6,
        enabled: (c) => (c.w.sect.stones >= 300 ? true : '灵石不足 300'),
        effects: (c) => {
          c.w.sect.stones -= 300
          if (c.rng.chance(0.6)) lootGongfa(1, 2)(c)
          else {
            const herbs = c.rng.int(20, 50)
            c.w.sect.herbs += herbs
            log(c.w, 'event', `竞得一批灵草（+${herbs}）。`)
          }
        },
      },
      { text: '不去凑热闹', ai: 1, effects: () => {} },
    ],
  },
  {
    id: 'rogue_cultivator',
    category: 'opportunity',
    title: '散修来投',
    weight: 8,
    cooldownYears: 2,
    trigger: (w) => w.sect.reputation >= 80 && w.disciples.length < sectCapacity(w),
    text: () => '一名风尘仆仆的散修叩响山门，自称仰慕本宗清名，愿献身门墙。其修为不俗，来历却语焉不详。',
    options: [
      {
        text: '收入门墙',
        ai: 6,
        effects: (c) => {
          const d = generateDisciple(c.rng, c.w, { ageYears: [25, 60], realm: c.rng.int(1, 2), sub: c.rng.int(0, 2) as never, gongfa: 'wuxing1' })
          d.rank = d.realm >= 2 ? 'inner' : 'outer'
          c.w.disciples.push(d)
          log(c.w, 'event', `散修${d.name}入门，直入${d.rank === 'inner' ? '内门' : '外门'}。`)
          if (c.rng.chance(0.15)) c.api.sched('rogue_trouble', 360, 1080, { rogue: d.id })
        },
      },
      { text: '婉言谢绝', ai: 3, effects: () => {} },
    ],
  },
  {
    id: 'rogue_trouble',
    category: 'chain',
    title: '仇家寻上门来',
    cast: [{ slot: 'rogue', filter: () => true }],
    text: (c) => `数名黑衣修士夜叩山门，指名要${c.cast['rogue']?.name ?? '那名散修'}出来受死——原来他在外结过血仇。`,
    options: [
      {
        text: '护短！我宗弟子岂容外人拿捏',
        ai: 8,
        effects: (c) => {
          const rogue = c.cast['rogue']
          c.api.combat({
            kind: 'rogue', enemyName: '寻仇黑衣修士', enemyPower: sectMenace(c.w, 0.5) * (0.8 + c.rng.next() * 0.5),
            playerSelect: true, maxTeam: 3, lootStones: 100, lethality: 0.6,
          })
          if (rogue) setRel(c.w, rogue.id, rogue.id, 'peer', 0) // no-op 保占位
          c.w.sect.reputation += 5
        },
      },
      {
        text: '交人平事',
        ai: 2,
        effects: (c) => {
          const rogue = c.cast['rogue']
          if (rogue) {
            log(c.w, 'event', `${rogue.name}被交了出去，生死不知。门内弟子人人自危。`)
            deathRipple(c.w, rogue)
            removeDisciple(c.w, rogue, '被交予仇家')
          }
          for (const d of c.w.disciples) addMood(d, -12)
          c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 20)
        },
      },
    ],
  },
  {
    id: 'orphan',
    category: 'opportunity',
    title: '山下拾遗',
    weight: 6,
    cooldownYears: 5,
    cast: [{ slot: 'finder', filter: (d) => d.action === 'travel' || d.action === 'work', sortBy: 'luck' }],
    text: (c) => `${c.cast['finder'].name}在山道旁拾得一个襁褓中的婴孩，怀中玉佩刻着古怪的符文。`,
    options: [
      {
        text: '抱回宗门抚养',
        ai: 8,
        effects: (c) => {
          const d = generateDisciple(c.rng, c.w, { ageYears: [6, 9], minAptitude: c.rng.chance(0.3) ? 3 : 1 })
          d.luck = Math.min(10, d.luck + 3) // 弃婴气运偏高（docs/03 §3）
          d.gongfa = 'tunaqi'
          c.w.disciples.push(d)
          const finder = c.cast['finder']
          setRel(c.w, finder.id, d.id, 'master', 40)
          log(c.w, 'event', `婴孩取名${d.name}，由${finder.name}代为照看。`)
        },
      },
      { text: '送去山下人家', ai: 2, effects: (c) => { c.w.sect.qiyun += 1; log(c.w, 'event', '善有善报，宗门气运似有微澜。') } },
    ],
  },
  {
    id: 'treasure_birth',
    category: 'opportunity',
    title: '天材地宝出世',
    weight: 4,
    cooldownYears: 8,
    trigger: (w) => w.disciples.some((d) => d.realm >= 3),
    text: () => '南岭夜放豪光，传言有千年灵乳出世。各方势力的飞舟已遮蔽了半边天。',
    options: [
      {
        text: '派高手抢夺',
        ai: 7,
        effects: (c) => {
          c.api.combat({
            kind: 'rogue', enemyName: '夺宝修士联军', enemyPower: sectMenace(c.w, 0.95) * (0.7 + c.rng.next() * 0.8),
            playerSelect: true, maxTeam: 3, onWinEvent: 'treasure_won', lethality: 0.7,
          })
        },
      },
      {
        text: '坐视各方相争',
        ai: 3,
        effects: (c) => {
          c.w.enemies['liehuo'] = Math.min(100, (c.w.enemies['liehuo'] ?? 0) + 5)
          log(c.w, 'event', '烈火门夺得灵乳，声势更盛。')
        },
      },
    ],
  },
  {
    id: 'treasure_won',
    category: 'chain',
    title: '灵乳到手',
    text: () => '千年灵乳已入宗门宝库，乳白灵液中道韵流转。',
    options: [
      {
        text: '赐予资质最佳的弟子',
        ai: 8,
        effects: (c) => {
          const best = [...c.w.disciples].sort((a, b) => b.shownAptitude - a.shownAptitude)[0]
          if (!best) return
          best.cultivation += best.cultivation * 0.5 + 500
          best.roots.purity = Math.min(10, best.roots.purity + 2)
          addMood(best, 30)
          log(c.w, 'event', `${best.name}服下灵乳，灵根纯度大增！`, 4)
          chronicle(c.w, 'treasure', `${best.name}得千年灵乳之助，根基愈发深厚。`)
        },
      },
      { text: '入库炼丹（灵草 +120）', ai: 4, effects: (c) => { c.w.sect.herbs += 120 } },
    ],
  },
  {
    id: 'merchant',
    category: 'opportunity',
    title: '行脚商队',
    weight: 8,
    cooldownYears: 2,
    text: (c) => `一支修士商队借道山门，愿以材料换灵石。（现有灵石 ${c.w.sect.stones}）`,
    options: [
      {
        text: '买入材料（灵石 200 → 材料 80）',
        ai: 5,
        enabled: (c) => (c.w.sect.stones >= 200 ? true : '灵石不足'),
        effects: (c) => { c.w.sect.stones -= 200; c.w.sect.materials += 80 },
      },
      {
        text: '卖出材料（材料 80 → 灵石 260）',
        ai: 4,
        enabled: (c) => (c.w.sect.materials >= 80 ? true : '材料不足'),
        effects: (c) => { c.w.sect.materials -= 80; c.w.sect.stones += 260 },
      },
      { text: '互不相扰', ai: 1, effects: () => {} },
    ],
  },
  {
    id: 'insight_rain',
    category: 'opportunity',
    title: '灵雨润山',
    weight: 6,
    cooldownYears: 3,
    text: () => '一夜灵雨毫无征兆地落满山头，草木皆发新芽，弟子们吐纳间灵气盈满。',
    options: undefined,
    auto: (c) => {
      for (const d of c.w.disciples) {
        d.cultivation += d.cultivation * 0.05 + 20
        addMood(d, 8)
      }
      c.w.sect.herbs += 30
    },
  },
  {
    id: 'fame_deed',
    category: 'opportunity',
    title: '仗义之名',
    weight: 6,
    cooldownYears: 2,
    cast: [{ slot: 'hero', filter: (d) => d.action === 'travel' && d.realm >= 2 }],
    text: (c) => `${c.cast['hero'].name}游历途中斩杀害人妖物，救下整座县城，本宗侠名远播。`,
    options: undefined,
    auto: (c) => {
      c.w.sect.reputation += 15
      addMood(c.cast['hero'], 12)
      c.cast['hero'].combatExp += 2
    },
  },
]
