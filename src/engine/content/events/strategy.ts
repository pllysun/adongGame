// 战略事件层（提升策略性）：长线投资 / 外交 / 正魔路线 / 备战回报。
// 设计纪律：每个选项都不应是"无脑最优"——最佳解随宗门财力、战力、阵容、路线而变。
import type { EventDef } from '../../systems/events'
import { addMood, chronicle, log, powerSort, removeDisciple } from '../../systems/helpers'
import { remember } from '../../systems/biography'
import { generateDisciple } from '../../state/disciple'
import { sectCapacity } from '../facilities'
import { sectMenace } from './menace'
import { GONGFA, gongfa } from '../gongfa'
import { ARTIFACTS } from '../artifacts'
import { disciplePower } from '../../systems/combat'
import { attemptMajorBreakthrough } from '../../systems/breakthrough'
import { breakthroughPillsFor } from '../pills'
import { vary, flagNum, addFlag, allies, ALLY_NAMES, ALLY_IDS, demonLean } from './util'

export const STRATEGY_EVENTS: EventDef[] = [
  // ══════════════ 长线投资：前期投入，数年后变量回报 ══════════════
  {
    id: 'spirit_garden',
    category: 'opportunity',
    title: '灵植培育',
    weight: 6,
    cooldownYears: 8,
    trigger: (w) => (w.sect.facilities['field'] ?? 0) >= 2 && !w.flags['gardenPlanted'],
    text: (c) =>
      vary(c.rng, [
        '药圃执事寻得几株罕见灵植幼苗，悉心培育数载或有大用——只是要先押上不少灵石灵草打底，收成却难料。',
        '一位游方药农兜售稀有灵植种子，称三五年后可成气候。前期投入不菲，是赌还是不赌？',
      ]),
    options: [
      {
        text: '重金培育（灵石 400、灵草 60）',
        ai: 6,
        enabled: (c) => (c.w.sect.stones >= 400 && c.w.sect.herbs >= 60 ? true : '灵石或灵草不足'),
        effects: (c) => {
          c.w.sect.stones -= 400
          c.w.sect.herbs -= 60
          c.w.flags['gardenPlanted'] = true
          c.api.sched('spirit_garden_harvest', 360 * 3, 360 * 5)
          log(c.w, 'event', '灵植入土，只待来年。')
        },
      },
      { text: '不做这亏本买卖', ai: 3, effects: () => {} },
    ],
  },
  {
    id: 'spirit_garden_harvest',
    category: 'chain',
    title: '灵植收成',
    text: () => '当年栽下的灵植到了采收之期，药圃里灵香扑鼻——成色几何，全看天意与这几年的光景。',
    auto: (c) => {
      c.w.flags['gardenPlanted'] = false
      // 若收成期妖兽活跃，灵植遭啃食减产（埋下"投资也有外部风险"的张力）
      const blight = c.w.beastThreat > 60 ? 0.5 : 1
      const roll = c.rng.next()
      if (roll > 0.5) {
        const herbs = Math.round(c.rng.int(180, 320) * blight)
        c.w.sect.herbs += herbs
        let extra = ''
        if (roll > 0.85) {
          c.w.sect.pills['xianyuan'] = (c.w.sect.pills['xianyuan'] ?? 0) + 2
          extra = '，并以之炼得小还丹两枚'
        }
        log(c.w, 'event', `灵植丰收，得灵草 ${herbs}${extra}。`, 2)
      } else {
        const herbs = Math.round(c.rng.int(40, 90) * blight)
        c.w.sect.herbs += herbs
        log(c.w, 'event', `灵植长势平平，仅得灵草 ${herbs}。`)
      }
    },
  },
  {
    id: 'expedition',
    category: 'opportunity',
    title: '远洋寻宝',
    weight: 6,
    cooldownYears: 6,
    trigger: (w) => w.disciples.some((d) => d.realm >= 3) && !w.flags['expeditionOut'],
    text: (c) =>
      vary(c.rng, [
        '一支跨海寻宝的修士船队招募合伙人：投入越多分得越丰，葬身鱼腹的也越是血本无归。',
        '海外仙岛的传闻又起，有船队愿带本宗一程，盈亏自负。',
      ]),
    options: [
      {
        text: '大手笔入股（灵石 1000）',
        ai: 4,
        enabled: (c) => (c.w.sect.stones >= 1000 ? true : '灵石不足 1000'),
        effects: (c) => {
          c.w.sect.stones -= 1000
          c.w.flags['expeditionStake'] = 3
          c.w.flags['expeditionOut'] = true
          c.api.sched('expedition_return', 360 * 2, 360 * 4)
        },
      },
      {
        text: '稳健入股（灵石 400）',
        ai: 5,
        enabled: (c) => (c.w.sect.stones >= 400 ? true : '灵石不足 400'),
        effects: (c) => {
          c.w.sect.stones -= 400
          c.w.flags['expeditionStake'] = 1
          c.w.flags['expeditionOut'] = true
          c.api.sched('expedition_return', 360 * 2, 360 * 4)
        },
      },
      { text: '不冒这风险', ai: 3, effects: () => {} },
    ],
  },
  {
    id: 'expedition_return',
    category: 'chain',
    title: '船队归来',
    text: () => '寻宝船队的帆影终于出现在海平线上——是满载而归，还是十不存一？',
    auto: (c) => {
      c.w.flags['expeditionOut'] = false
      const stake = flagNum(c.w, 'expeditionStake')
      const roll = c.rng.next()
      if (roll < 0.2) {
        log(c.w, 'event', '噩耗传来：船队遭遇深海妖兽，本钱尽数葬于海底。', 0)
        return
      }
      const mult = roll < 0.6 ? 1.5 : roll < 0.9 ? 3 : 5
      const stones = Math.round(stake * 300 * mult)
      c.w.sect.stones += stones
      c.w.sect.materials += stake * 40
      let extra = ''
      if (roll > 0.9) {
        const pool = GONGFA.filter((g) => g.rarity >= 2 && g.rarity <= 4 && !c.w.sect.gongfa.includes(g.id))
        if (pool.length) {
          const g = c.rng.pick(pool)
          c.w.sect.gongfa.push(g.id)
          extra = `，更带回失传功法${g.name}`
        }
      }
      log(c.w, 'event', `寻宝船队归来，分得灵石 ${stones}、材料 ${stake * 40}${extra}。`, mult >= 3 ? 3 : 1)
    },
  },
  {
    id: 'contested_mine',
    category: 'opportunity',
    title: '灵矿争夺',
    weight: 5,
    cooldownYears: 7,
    trigger: (w) => !w.flags['mineHeld'] && w.disciples.some((d) => d.realm >= 3),
    text: () => '一座中品灵矿无主，引来诸方觊觎。占下它便月月有灵石进项，却也树大招风，需常备人手应对来犯。',
    options: [
      {
        text: '发兵抢占（点将）',
        ai: 6,
        effects: (c) => {
          c.api.combat({
            kind: 'rogue', enemyName: '争矿散修', enemyPower: sectMenace(c.w, 0.6),
            playerSelect: true, maxTeam: 4, onWinEvent: 'mine_secured', lethality: 0.5,
          })
        },
      },
      { text: '不蹚这浑水', ai: 3, effects: () => {} },
    ],
  },
  {
    id: 'mine_secured',
    category: 'chain',
    title: '灵矿到手',
    text: () => '灵矿易主，矿脉中灵气氤氲、灵石源源——只是邻宗的眼睛，怕是也盯上了。',
    auto: (c) => {
      c.w.flags['mineHeld'] = true
      log(c.w, 'event', '灵矿入手，此后月月增产灵石。')
      c.api.sched('mine_raid', 360 * 2, 360 * 4)
    },
  },
  {
    id: 'mine_raid',
    category: 'chain',
    title: '邻宗夺矿',
    pause: true,
    trigger: (w) => !!w.flags['mineHeld'],
    text: () => '邻宗果然觊觎灵矿，遣人来夺！是发兵死守，还是弃矿息事？',
    options: [
      {
        text: '出兵死守（点将）',
        ai: 7,
        effects: (c) => {
          c.api.combat({
            kind: 'rogue', enemyName: '夺矿之敌', enemyPower: sectMenace(c.w, 0.85),
            playerSelect: true, maxTeam: 4, onWinEvent: 'mine_kept', onLoseEvent: 'mine_lost', lethality: 0.6,
          })
        },
      },
      {
        text: '放弃灵矿，免动干戈',
        ai: 3,
        effects: (c) => {
          c.w.flags['mineHeld'] = false
          log(c.w, 'event', '本宗主动撤离灵矿，邻宗扬长而去。')
        },
      },
    ],
  },
  {
    id: 'mine_kept',
    category: 'chain',
    title: '矿权稳固',
    text: () => '来犯之敌被击退，灵矿牢牢握在手中。一战立威，短期内当无人再敢窥伺。',
    auto: (c) => {
      c.w.sect.reputation += 15
      c.api.sched('mine_raid', 360 * 3, 360 * 5)
    },
  },
  {
    id: 'mine_lost',
    category: 'chain',
    title: '痛失灵矿',
    text: () => '寡不敌众，灵矿终究易主。煮熟的鸭子飞了，弟子们闷闷不乐。',
    auto: (c) => {
      c.w.flags['mineHeld'] = false
      c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 10)
    },
  },

  // ══════════════ 备战回报：阵容/财力/设施投入的兑现口 ══════════════
  {
    id: 'hire_elder',
    category: 'opportunity',
    title: '名师投帖',
    weight: 5,
    cooldownYears: 10,
    trigger: (w) => w.sect.reputation >= 200 && w.disciples.length < sectCapacity(w),
    text: (c) => {
      const cost = 1500 + flagNum(c.w, 'hiredElders') * 1200
      return (
        vary(c.rng, [
          '一位元婴修为的散修长老递来拜帖，愿受聘坐镇本宗——开价不菲，但即战力与教化之功立竿见影。',
          '云游多年的一位前辈高人有意挂单本宗，只是要奉上一份丰厚的供奉。',
        ]) + `（声名愈隆，请来的人物胃口也愈大：本次需灵石 ${cost}）`
      )
    },
    options: [
      {
        text: '厚礼相聘',
        ai: 6,
        enabled: (c) => {
          const cost = 1500 + flagNum(c.w, 'hiredElders') * 1200
          return c.w.sect.stones >= cost ? true : `灵石不足 ${cost}`
        },
        effects: (c) => {
          const cost = 1500 + flagNum(c.w, 'hiredElders') * 1200
          c.w.sect.stones -= cost
          addFlag(c.w, 'hiredElders', 1, 0, 99)
          const d = generateDisciple(c.rng, c.w, {
            ageYears: [200, 400], realm: 4, sub: c.rng.int(0, 2) as never, rank: 'elder', minAptitude: 3, gongfa: 'taiyi',
          })
          d.combatExp = c.rng.int(8, 16)
          c.w.disciples.push(d)
          log(c.w, 'event', `元婴长老${d.name}受聘入宗，即刻坐镇山门。`, 3)
          chronicle(c.w, 'recruit', `元婴修士${d.name}受聘加入${c.w.sect.name}。`)
          if (c.rng.chance(0.25)) c.api.sched('hired_elder_secret', 360, 360 * 3, { elder: d.id })
        },
      },
      { text: '本宗自有传承，不必外求', ai: 3, effects: () => {} },
    ],
  },
  {
    id: 'hired_elder_secret',
    category: 'chain',
    title: '名师的来历',
    cast: [{ slot: 'elder', filter: () => true }],
    text: (c) => `江湖传闻渐起：受聘的${c.cast['elder']?.name ?? '那位长老'}早年曾是魔道中人，仇家不少。`,
    options: [
      {
        text: '用人不疑，既往不咎',
        ai: 6,
        effects: (c) => {
          const e = c.cast['elder']
          if (e) addMood(e, 18)
          addFlag(c.w, 'demonLean', 5)
        },
      },
      {
        text: '请其退去，以绝后患',
        ai: 3,
        effects: (c) => {
          const e = c.cast['elder']
          if (e) {
            log(c.w, 'event', `${e.name}默然行礼，飘然离去。`)
            removeDisciple(c.w, e, '退聘')
          }
        },
      },
    ],
  },
  {
    id: 'debate_tournament',
    category: 'opportunity',
    title: '万宗论道大会',
    weight: 6,
    cooldownYears: 5,
    trigger: (w) => w.disciples.some((d) => d.realm >= 2) && w.sect.reputation >= 100,
    text: (c) =>
      vary(c.rng, [
        '十年一度的论道大会广邀群雄。派谁赴会颇费思量——老成者稳妥求名，少年人搏一份惊艳。',
        '论道大会的请柬到了。这是扬名良机，也是当众献丑的险地。',
      ]),
    options: [
      {
        text: '遣德高望重的长辈（稳）',
        ai: 6,
        effects: (c) => {
          const v = powerSort(c.w.disciples.filter((d) => d.status === 'normal'))[0]
          if (!v) return
          if (c.rng.chance(0.75)) {
            c.w.sect.reputation += 25
            v.combatExp += 1
            log(c.w, 'social', `${v.name}于论道大会舌战群儒，本宗声望大涨。`)
          } else {
            c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 8)
            log(c.w, 'social', `${v.name}论道落于下风，无功而返。`)
          }
        },
      },
      {
        text: '遣天资卓绝的后辈（搏）',
        ai: 5,
        effects: (c) => {
          const young =
            c.w.disciples
              .filter((d) => d.status === 'normal' && d.realm <= 3 && d.shownAptitude >= 3)
              .sort((a, b) => b.comprehension + b.shownAptitude - (a.comprehension + a.shownAptitude))[0] ??
            powerSort(c.w.disciples.filter((d) => d.status === 'normal'))[0]
          if (!young) return
          if (c.rng.chance(0.4 + young.comprehension * 0.04)) {
            c.w.sect.reputation += 40
            young.cultivation += young.cultivation * 0.1 + 100
            addMood(young, 20)
            log(c.w, 'social', `${young.name}于论道大会一鸣惊人，技惊四座，自身亦有所悟！`, 3)
            chronicle(c.w, 'fame', `${young.name}论道夺魁，声名鹊起。`)
          } else {
            c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 12)
            addMood(young, -18)
            log(c.w, 'social', `${young.name}年少怯场，当众失利，备受打击。`)
          }
        },
      },
      { text: '不去献丑', ai: 2, effects: () => {} },
    ],
  },
  {
    id: 'alchemy_fair',
    category: 'opportunity',
    title: '斗丹大会',
    weight: (w) => ((w.sect.facilities['alchemy'] ?? 0) >= 3 ? 6 : 0),
    cooldownYears: 5,
    text: () => '丹道盛会召开，各宗丹师同台竞技。本宗丹房底蕴深厚，正可一展身手、扬名立万。',
    options: [
      {
        text: '遣丹师赴会（灵草 40）',
        ai: 7,
        enabled: (c) => (c.w.sect.herbs >= 40 ? true : '灵草不足 40'),
        effects: (c) => {
          c.w.sect.herbs -= 40
          const lv = c.w.sect.facilities['alchemy'] ?? 0
          if (c.rng.chance(0.4 + lv * 0.08)) {
            c.w.sect.reputation += 30
            const bonus = ['xianyuan', 'shengji', 'mingxin'][c.rng.int(0, 2)]
            c.w.sect.pills[bonus] = (c.w.sect.pills[bonus] ?? 0) + 2
            log(c.w, 'event', '本宗丹师技压群雄，扬名之余更习得新丹方！', 3)
          } else {
            c.w.sect.reputation += 8
            log(c.w, 'event', '丹师赴会，小有斩获。')
          }
        },
      },
      { text: '不去班门弄斧', ai: 2, effects: () => {} },
    ],
  },
  {
    id: 'sword_meet',
    category: 'opportunity',
    title: '论剑大会',
    weight: (w) =>
      w.disciples.some((d) => {
        const g = d.gongfa ? gongfa(d.gongfa) : null
        return !!g?.tags?.includes('sword') && d.realm >= 3
      })
        ? 6
        : 0,
    cooldownYears: 5,
    text: () => '天下剑修齐聚论剑峰。本宗剑修若能跻身前列，可得剑冢传承的赏赐。',
    options: [
      {
        text: '遣剑修赴会',
        ai: 7,
        effects: (c) => {
          const s = c.w.disciples
            .filter((d) => {
              const g = d.gongfa ? gongfa(d.gongfa) : null
              return !!g?.tags?.includes('sword') && d.status === 'normal'
            })
            .sort((a, b) => disciplePower(b) - disciplePower(a))[0]
          if (!s) return
          if (c.rng.chance(0.5)) {
            const pool = ARTIFACTS.filter((a) => a.combatMod >= 0.3 && !c.w.sect.artifacts.includes(a.id))
            if (pool.length) {
              const a = c.rng.pick(pool)
              c.w.sect.artifacts.push(a.id)
              log(c.w, 'event', `${s.name}论剑夺魁，得剑冢所赠${a.name}！`, a.rarity)
            }
            c.w.sect.reputation += 25
            s.combatExp += 3
          } else {
            c.w.sect.reputation += 6
            s.combatExp += 1
            log(c.w, 'event', `${s.name}论剑未能夺魁，亦长了见识。`)
          }
        },
      },
      { text: '剑道寂寞，不慕虚名', ai: 2, effects: () => {} },
    ],
  },
  {
    id: 'death_seclusion',
    category: 'personnel',
    title: '闭生死关',
    weight: 6,
    cooldownYears: 3,
    cast: [{ slot: 'd', filter: (d) => d.bottleneck && d.sub === 2 && d.realm >= 3 && d.status === 'normal' }],
    text: (c) =>
      `${c.cast['d'].name}于大境界瓶颈前徘徊已久，求闭一场生死关——成则一步登天，败则万劫不复。是倾尽资源助其一搏，还是再等良机？`,
    options: [
      {
        text: '倾力护关（耗一枚最佳突破丹，立刻冲关）',
        ai: 6,
        effects: (c) => {
          const d = c.cast['d']
          for (const p of breakthroughPillsFor(d.realm + 1)) {
            if ((c.w.sect.pills[p.id] ?? 0) > 0) {
              c.w.sect.pills[p.id]--
              d.buffs.breakthroughPill = p.power
              break
            }
          }
          addMood(d, 25)
          log(c.w, 'social', `${d.name}闭生死关，全宗屏息以待……`)
          attemptMajorBreakthrough(c.w, d, c.rng)
        },
      },
      {
        text: '时机未到，再缓些时日',
        ai: 3,
        effects: (c) => {
          c.w.cooldowns['ask:' + c.cast['d'].id] = c.w.day + 360
        },
      },
    ],
  },

  // ══════════════ 外交：盟友是一种需要经营、也会回报的投资 ══════════════
  {
    id: 'arbitrate',
    category: 'opportunity',
    title: '受邀仲裁',
    weight: 5,
    cooldownYears: 6,
    trigger: (w) => w.sect.reputation >= 150,
    text: (c) =>
      vary(c.rng, [
        '两个邻近宗门为一处灵矿争执不下，慕本宗清名请掌门评理。偏帮一方，便结一友一仇。',
        '一桩江湖公案闹到山门前，双方都请掌门主持公道。这碗水，难端平。',
      ]),
    options: [
      {
        text: '秉公直断，谁有理帮谁',
        ai: 6,
        effects: (c) => {
          c.w.sect.reputation += 15
          const allyId = c.rng.pick(ALLY_IDS)
          addFlag(c.w, 'ally:' + allyId, 30)
          const enemyId = c.rng.pick(['xuanming', 'wanshou', 'liehuo'])
          c.w.enemies[enemyId] = Math.min(100, (c.w.enemies[enemyId] ?? 0) + 12)
          log(c.w, 'event', `掌门铁面无私，结一友（${ALLY_NAMES[allyId]}），亦添一怨。`)
        },
      },
      {
        text: '和稀泥，两边都不得罪',
        ai: 4,
        effects: (c) => {
          c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 5)
          log(c.w, 'event', '一番和稀泥，两边皆不甚满意。')
        },
      },
      {
        text: '收下厚礼，偏帮出价高者（灵石 +300）',
        ai: 2,
        effects: (c) => {
          c.w.sect.stones += 300
          c.w.sect.qiyun = Math.max(0, c.w.sect.qiyun - 3)
          c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 10)
          const e = c.rng.pick(['xuanming', 'wanshou', 'liehuo'])
          c.w.enemies[e] = Math.min(100, (c.w.enemies[e] ?? 0) + 8)
          log(c.w, 'event', '收了钱财枉断是非，落人口实。')
        },
      },
    ],
  },
  {
    id: 'ally_gift',
    category: 'opportunity',
    title: '盟友馈赠',
    weight: (w) => allies(w).length * 4,
    cooldownYears: 3,
    trigger: (w) => allies(w).length > 0,
    text: (c) => {
      const a = allies(c.w)[0]
      return `${a?.name ?? '盟友'}遣使送来贺礼，以续两宗情谊。`
    },
    auto: (c) => {
      const a = allies(c.w).sort((x, y) => y.goodwill - x.goodwill)[0]
      if (!a) return
      const roll = c.rng.next()
      if (roll > 0.6) {
        c.w.sect.herbs += 50
        c.w.sect.materials += 40
      } else if (roll > 0.3) {
        c.w.sect.stones += 200
      } else {
        c.w.sect.pills['jingxin'] = (c.w.sect.pills['jingxin'] ?? 0) + 1
      }
      addFlag(c.w, 'ally:' + a.id, 5)
      log(c.w, 'event', `${a.name}赠来礼物，两宗交谊更笃。`)
    },
  },
  {
    id: 'beast_pact',
    category: 'opportunity',
    title: '妖族结盟',
    weight: (w) => (w.sect.qiyun >= 15 && w.beastThreat >= 40 && !w.flags['beastPact'] ? 5 : 0),
    cooldownYears: 10,
    text: () => '深山妖王遣使来访，愿与本宗订立互不侵犯之盟，从此妖兽不再为患——代价是年年供奉些灵米灵草。',
    options: [
      {
        text: '订立妖盟',
        ai: 6,
        effects: (c) => {
          c.w.flags['beastPact'] = true
          c.w.beastThreat = Math.max(0, c.w.beastThreat - 40)
          log(c.w, 'event', '妖盟既定，山林重归宁静。')
          c.api.sched('beast_tribute', 360, 360)
        },
      },
      {
        text: '人妖殊途，断然拒绝',
        ai: 4,
        effects: (c) => {
          c.w.beastThreat = Math.min(100, c.w.beastThreat + 10)
          c.w.sect.reputation += 5
        },
      },
    ],
  },
  {
    id: 'beast_tribute',
    category: 'chain',
    title: '妖盟供奉',
    trigger: (w) => !!w.flags['beastPact'],
    text: () => '依妖盟之约，又到了奉上供奉的时节。给，还是不给？',
    options: [
      {
        text: '如约供奉（灵米 60、灵草 20）',
        ai: 7,
        enabled: (c) => (c.w.sect.rice >= 60 && c.w.sect.herbs >= 20 ? true : '钱粮不足'),
        effects: (c) => {
          c.w.sect.rice -= 60
          c.w.sect.herbs -= 20
          c.api.sched('beast_tribute', 360, 360)
        },
      },
      {
        text: '撕毁盟约',
        ai: 3,
        effects: (c) => {
          c.w.flags['beastPact'] = false
          c.w.beastThreat = Math.min(100, c.w.beastThreat + 50)
          log(c.w, 'event', '妖盟告破，妖王震怒，山林复又不宁。')
        },
      },
    ],
  },

  // ══════════════ 正魔路线：一条贯穿全局、两端互斥的战略抉择 ══════════════
  {
    id: 'demonic_manual',
    category: 'personnel',
    title: '魔功现世',
    weight: 5,
    cooldownYears: 6,
    cast: [{ slot: 'd', filter: (d) => d.realm >= 2 && d.status === 'normal' }],
    text: (c) =>
      vary(c.rng, [
        `${c.cast['d'].name}于残卷中觅得一部魔功，威力骇人却戾气缠身。准不准他修习？`,
        `一部来历不明的魔道功法落入${c.cast['d'].name}手中。修之可速成，亦可堕魔。`,
      ]),
    options: [
      {
        text: '焚毁魔功，以正道心',
        ai: 6,
        effects: (c) => {
          const d = c.cast['d']
          addMood(d, 10)
          d.mindstate = Math.min(10, d.mindstate + 1)
          c.w.sect.reputation += 8
          addFlag(c.w, 'demonLean', -3)
          log(c.w, 'social', `魔功付之一炬，${d.name}道心愈坚。`)
        },
      },
      {
        text: '准其修习，剑走偏锋',
        ai: 4,
        effects: (c) => {
          const d = c.cast['d']
          const pool = GONGFA.filter(
            (g) => g.tags?.includes('demonic') && !c.w.sect.gongfa.includes(g.id) && g.realmCap >= d.realm,
          )
          if (pool.length) {
            const g = c.rng.pick(pool)
            c.w.sect.gongfa.push(g.id)
            d.gongfa = g.id
            log(c.w, 'event', `${d.name}改修魔功${g.name}，气息为之一变。`, g.rarity)
          }
          d.cultivation += d.cultivation * 0.15 + 80
          addFlag(c.w, 'demonLean', 8)
          if (!d.traits.includes('ruthless') && c.rng.chance(0.4)) d.traits.push('ruthless')
          addMood(d, -8)
          c.w.enemies['xuanming'] = Math.max(0, (c.w.enemies['xuanming'] ?? 0) - 5)
          // 个人魔倾轴：修魔功是堕入魔道的起点，留下持久印记并记入经历树
          remember(d, c.w.day, {
            eventId: 'demonic_manual', text: `${d.name}改修魔功，自此踏上一条剑走偏锋的路。`,
            kind: 'turning', tags: ['修魔功'], impact: { molean: 28, daoxin: -8 },
          })
        },
      },
    ],
  },
  {
    id: 'righteous_alliance',
    category: 'crisis',
    title: '正道讨魔',
    weight: (w) => (demonLean(w) < 30 && (w.enemies['xuanming'] ?? 0) >= 40 ? 6 : 0),
    cooldownYears: 8,
    trigger: (w) => w.disciples.some((d) => d.realm >= 4),
    text: () => '正道群雄会盟，欲共讨玄冥魔教，邀本宗一同举事。此战凶险，然功成则名动天下、广结善缘。',
    options: [
      {
        text: '仗义出兵（点将主力）',
        ai: 7,
        effects: (c) => {
          c.api.combat({
            kind: 'sectwar', enemyName: '玄冥魔教', enemyPower: sectMenace(c.w, 1.0),
            playerSelect: true, maxTeam: 5, lootStones: 600, lootGongfaRarity: 4,
            onWinEvent: 'demon_purge_won', onLoseEvent: 'demon_purge_lost', lethality: 0.7,
          })
        },
      },
      {
        text: '出灵石助饷，不出兵（灵石 500）',
        ai: 4,
        enabled: (c) => (c.w.sect.stones >= 500 ? true : '灵石不足 500'),
        effects: (c) => {
          c.w.sect.stones -= 500
          c.w.sect.reputation += 10
          c.w.enemies['xuanming'] = Math.max(0, (c.w.enemies['xuanming'] ?? 0) - 10)
          for (const id of ['danxia', 'taiyi']) addFlag(c.w, 'ally:' + id, 15)
        },
      },
      {
        text: '坐山观虎斗',
        ai: 2,
        effects: (c) => {
          c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 8)
          log(c.w, 'event', '本宗作壁上观，正道诸宗颇有微词。')
        },
      },
    ],
  },
  {
    id: 'demon_purge_won',
    category: 'chain',
    title: '魔教覆灭',
    text: () => '玄冥魔教的总坛在烈焰中崩塌！讨魔诸宗共分缴获，本宗居功至伟。',
    auto: (c) => {
      c.w.sect.reputation += 60
      c.w.enemies['xuanming'] = 0
      for (const id of ALLY_IDS) addFlag(c.w, 'ally:' + id, 20)
      addFlag(c.w, 'demonLean', -10)
      chronicle(c.w, 'war', `${c.w.sect.name}参与讨灭玄冥魔教，威名远播天下。`)
    },
  },
  {
    id: 'demon_purge_lost',
    category: 'chain',
    title: '讨魔失利',
    text: () => '讨魔联军被魔教反噬，损兵折将。玄冥教记下了本宗这一笔账。',
    auto: (c) => {
      c.w.enemies['xuanming'] = Math.min(100, (c.w.enemies['xuanming'] ?? 0) + 20)
      for (const d of c.w.disciples) addMood(d, -8)
    },
  },
  {
    id: 'demon_courtship',
    category: 'opportunity',
    title: '魔教结好',
    weight: (w) => (demonLean(w) >= 40 ? 6 : 0),
    cooldownYears: 6,
    text: () => '玄冥魔教遣密使造访，见本宗"颇通玄理"，愿赠魔功秘宝以结善缘。接是不接？',
    options: [
      {
        text: '笑纳厚礼（魔功 + 灵石）',
        ai: 5,
        effects: (c) => {
          c.w.sect.stones += 500
          const pool = GONGFA.filter((g) => g.tags?.includes('demonic') && g.rarity >= 3 && !c.w.sect.gongfa.includes(g.id))
          if (pool.length) {
            const g = c.rng.pick(pool)
            c.w.sect.gongfa.push(g.id)
            log(c.w, 'event', `魔教赠下${g.name}。`, g.rarity)
          }
          c.w.enemies['xuanming'] = Math.max(0, (c.w.enemies['xuanming'] ?? 0) - 20)
          addFlag(c.w, 'demonLean', 6)
          for (const id of ['danxia', 'taiyi', 'kunwu']) addFlag(c.w, 'ally:' + id, -15)
          c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 10)
        },
      },
      {
        text: '断然拒绝，划清界限',
        ai: 5,
        effects: (c) => {
          addFlag(c.w, 'demonLean', -8)
          c.w.enemies['xuanming'] = Math.min(100, (c.w.enemies['xuanming'] ?? 0) + 10)
          c.w.sect.reputation += 5
          log(c.w, 'event', '本宗严词拒之，魔教使者悻悻而去。')
        },
      },
    ],
  },

  // ══════════════ 善缘：以财换气运/声望，机会成本型抉择 ══════════════
  {
    id: 'charity',
    category: 'opportunity',
    title: '开仓济民',
    weight: 5,
    cooldownYears: 3,
    trigger: (w) => w.sect.stones >= 200,
    text: (c) =>
      vary(c.rng, [
        '山下遭了灾，流民载道。开仓放粮虽耗钱粮，却能积下宗门气运与万家香火。',
        '一位老者代乡邻叩山门，求宗门援手度过荒年。',
      ]),
    options: [
      {
        text: '慷慨解囊（灵石 300、灵米 100）',
        ai: 6,
        enabled: (c) => (c.w.sect.stones >= 300 && c.w.sect.rice >= 100 ? true : '钱粮不足'),
        effects: (c) => {
          c.w.sect.stones -= 300
          c.w.sect.rice -= 100
          c.w.sect.reputation += 20
          c.w.sect.qiyun += 4
          addFlag(c.w, 'demonLean', -2)
          log(c.w, 'event', '宗门开仓济民，香火鼎盛，气运渐隆。')
        },
      },
      {
        text: '量力而为（灵石 100）',
        ai: 4,
        enabled: (c) => (c.w.sect.stones >= 100 ? true : '灵石不足'),
        effects: (c) => {
          c.w.sect.stones -= 100
          c.w.sect.reputation += 6
          c.w.sect.qiyun += 1
        },
      },
      {
        text: '宗门自顾不暇',
        ai: 2,
        effects: (c) => {
          c.w.sect.qiyun = Math.max(0, c.w.sect.qiyun - 1)
        },
      },
    ],
  },
]
