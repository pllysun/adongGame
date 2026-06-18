// 危机类事件（docs/04 §6）：妖兽潮、敌宗、心魔、天灾
import type { EventDef } from '../../systems/events'
import { addMood, chronicle, getD, log, relsOf, removeDisciple, deathRipple } from '../../systems/helpers'
import { sectMenace } from './menace'
import { vary, allies } from './util'

/** 妖兽潮强度：锚定宗门战力 + 威胁值放大 */
function beastPower(w: import('@/shared/types').WorldState): number {
  return sectMenace(w, 0.9 + w.beastThreat / 120)
}

export const CRISIS_EVENTS: EventDef[] = [
  {
    id: 'beast_omen',
    category: 'crisis',
    title: '妖兽异动',
    weight: (w) => 6 + w.beastThreat / 8 + w.sect.siteDanger * 2,
    cooldownYears: 3,
    text: (c) =>
      vary(c.rng, [
        '猎户来报：北山兽吼连月不绝，群鸟南迁，林间妖气隐隐——怕是要起兽潮。',
        '后山的妖兽近来异常躁动，夜里红芒成片，巡山弟子已不敢深入。',
        '一头通灵的老猿窜下山来示警便仓皇北去，山中怕是要变天了。',
      ]),
    options: undefined,
    auto: (c) => {
      c.w.beastThreat = Math.min(100, c.w.beastThreat + 15)
      c.api.sched('beast_tide', 30, 90)
    },
  },
  {
    id: 'beast_tide',
    category: 'chain',
    title: '妖兽潮压境',
    pause: true,
    text: (c) => `兽潮如黑云压向山门！领头妖兽双目猩红（敌方战力约 ${Math.round(beastPower(c.w))}）。护山大阵嗡鸣不止。`,
    options: [
      {
        text: '全宗迎战（护山大阵加持）',
        ai: 10,
        effects: (c) => {
          c.api.combat({
            kind: 'beast', enemyName: '妖兽潮', enemyPower: beastPower(c.w), defense: true,
            lootStones: 100, lootMaterials: 150, onLoseEvent: 'beast_aftermath', lethality: 0.6,
          })
          c.w.beastThreat = Math.max(5, c.w.beastThreat - 40)
        },
      },
      {
        text: '精锐出山截击（点将）',
        ai: 5,
        effects: (c) => {
          c.api.combat({
            kind: 'beast', enemyName: '妖兽潮先锋', enemyPower: beastPower(c.w) * 0.8,
            playerSelect: true, maxTeam: 5, lootMaterials: 120, onLoseEvent: 'beast_aftermath', lethality: 0.7,
          })
          c.w.beastThreat = Math.max(5, c.w.beastThreat - 30)
        },
      },
      {
        text: '闭门死守，任其肆虐山野',
        ai: 1,
        effects: (c) => {
          c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 15)
          c.w.sect.rice = Math.max(0, c.w.sect.rice - 60)
          const fieldLv = c.w.sect.facilities['field'] ?? 0
          if (fieldLv > 1) c.w.sect.facilities['field'] = fieldLv - 1
          log(c.w, 'event', '兽潮过境，山下灵田尽毁，宗门声望受损。')
          c.w.beastThreat = Math.max(5, c.w.beastThreat - 25)
        },
      },
    ],
  },
  {
    id: 'beast_aftermath',
    category: 'chain',
    title: '兽潮过后',
    text: () => '兽潮退去，山门一片狼藉。断壁残垣间，幸存的弟子们沉默地收殓着同门遗体。',
    options: undefined,
    auto: (c) => {
      for (const key of ['array', 'field', 'arena']) {
        const lv = c.w.sect.facilities[key] ?? 0
        if (lv > 1 && c.rng.chance(0.5)) c.w.sect.facilities[key] = lv - 1
      }
      for (const d of c.w.disciples) addMood(d, -10)
      log(c.w, 'event', '部分设施在兽潮中损毁降级。')
    },
  },
  {
    id: 'enemy_provoke',
    category: 'crisis',
    title: '敌宗寻衅',
    weight: (w) => Math.max(...Object.values(w.enemies)) / 6,
    cooldownYears: 4,
    trigger: (w) => Math.max(...Object.values(w.enemies)) >= 30 && w.disciples.some((d) => d.realm >= 2),
    text: (c) => {
      const top = Object.entries(c.w.enemies).sort((a, b) => b[1] - a[1])[0][0]
      const name = top === 'xuanming' ? '玄冥教' : top === 'wanshou' ? '万兽山' : '烈火门'
      return `${name}使者登门，言语倨傲，索要灵脉三成出产作"平安钱"，否则三月后兵戎相见。`
    },
    options: [
      {
        text: '斗法定胜负（三对三）',
        ai: 8,
        effects: (c) => {
          const hostility = Math.max(...Object.values(c.w.enemies))
          c.api.combat({
            kind: 'duel', enemyName: '敌宗斗法使团', enemyPower: sectMenace(c.w, 0.75 * (1 + hostility / 150)),
            playerSelect: true, maxTeam: 3, lethality: 0.25,
            onWinEvent: 'duel_won', onLoseEvent: 'duel_lost',
          })
        },
      },
      {
        text: '破财消灾（灵石 600）',
        ai: 3,
        enabled: (c) => (c.w.sect.stones >= 600 ? true : '灵石不足 600'),
        effects: (c) => {
          c.w.sect.stones -= 600
          c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 12)
          for (const [k, v] of Object.entries(c.w.enemies)) c.w.enemies[k] = Math.max(0, v - 15)
          for (const d of c.w.disciples) if (d.traits.includes('arrogant') || d.traits.includes('battlemad')) addMood(d, -10)
          log(c.w, 'event', '宗门忍辱纳贡，血气方刚的弟子们攥紧了拳头。')
        },
      },
      {
        text: '逐客！要战便战',
        ai: 4,
        effects: (c) => {
          for (const k of Object.keys(c.w.enemies)) c.w.enemies[k] = Math.min(100, c.w.enemies[k] + 20)
          c.api.sched('sect_war', 60, 120)
          log(c.w, 'event', '使者拂袖而去，山雨欲来。')
        },
      },
    ],
  },
  {
    id: 'duel_won',
    category: 'chain',
    title: '斗法大胜',
    text: () => '三战三捷！敌宗使团灰头土脸地走了，本宗之名一时传遍周遭百里。',
    options: undefined,
    auto: (c) => {
      c.w.sect.reputation += 25
      c.w.sect.stones += 300
      for (const k of Object.keys(c.w.enemies)) c.w.enemies[k] = Math.max(0, c.w.enemies[k] - 20)
      chronicle(c.w, 'war', '斗法退敌，宗门扬眉吐气。')
    },
  },
  {
    id: 'duel_lost',
    category: 'chain',
    title: '斗法落败',
    text: () => '技不如人，当众折辱。敌宗使者带走了三成灵脉出产的契书。',
    options: undefined,
    auto: (c) => {
      c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 18)
      c.w.sect.stones = Math.max(0, c.w.sect.stones - 400)
      for (const d of c.w.disciples) addMood(d, -8)
    },
  },
  {
    id: 'sect_war',
    category: 'chain',
    title: '宗门战！',
    pause: true,
    text: () => '敌宗大军压境，旌旗蔽日！此战关乎宗门存亡，山门上下皆披甲执剑。',
    options: [
      {
        text: '决死一战（全宗动员 + 护山大阵）',
        ai: 10,
        effects: (c) => {
          const hostility = Math.max(...Object.values(c.w.enemies))
          // 盟友援军：平日经营的外交在此兑现，削弱来犯之敌
          const help = allies(c.w).reduce((s, a) => s + a.goodwill, 0)
          const relief = help >= 120 ? 0.65 : help >= 40 ? 0.8 : 1
          if (help > 0) log(c.w, 'event', '危难之际，盟友闻讯遣来援军助阵！')
          c.api.combat({
            kind: 'sectwar', enemyName: '敌宗征伐大军',
            enemyPower: sectMenace(c.w, (1.3 + hostility / 200) * relief), defense: true,
            lootStones: 800, lootMaterials: 300, lootGongfaRarity: 3,
            onWinEvent: 'war_won', onLoseEvent: 'war_lost', lethality: 0.8,
          })
        },
      },
      {
        text: '献宝求和（灵石 1500 + 声望大损）',
        ai: 2,
        enabled: (c) => (c.w.sect.stones >= 1500 ? true : '灵石不足 1500'),
        effects: (c) => {
          c.w.sect.stones -= 1500
          c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 35)
          for (const k of Object.keys(c.w.enemies)) c.w.enemies[k] = Math.max(0, c.w.enemies[k] - 30)
          for (const d of c.w.disciples) addMood(d, -15)
          log(c.w, 'event', '城下之盟，奇耻大辱。')
        },
      },
    ],
  },
  {
    id: 'war_won',
    category: 'chain',
    title: '大胜之后',
    text: () => '敌军溃退！缴获的辎重堆满了前殿，俘虏跪了一地。此役之后，再无人敢小觑本宗。',
    options: undefined,
    auto: (c) => {
      c.w.sect.reputation += 50
      for (const k of Object.keys(c.w.enemies)) c.w.enemies[k] = Math.max(0, c.w.enemies[k] - 40)
      chronicle(c.w, 'war', `${c.w.sect.name}于宗门大战中获胜，威震一方。`)
    },
  },
  {
    id: 'war_lost',
    category: 'chain',
    title: '战败之耻',
    text: () => '山门半毁，藏经阁被掳走数部功法。幸存者在废墟上重新立起了宗门的旗。',
    options: undefined,
    auto: (c) => {
      for (const key of Object.keys(c.w.sect.facilities)) {
        const lv = c.w.sect.facilities[key]
        if (lv > 1 && c.rng.chance(0.6)) c.w.sect.facilities[key] = lv - 1
      }
      if (c.w.sect.gongfa.length > 3) c.w.sect.gongfa.splice(c.rng.int(0, c.w.sect.gongfa.length - 1), 1)
      c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 30)
      for (const d of c.w.disciples) addMood(d, -20)
      chronicle(c.w, 'war', `${c.w.sect.name}战败，元气大伤。`)
    },
  },
  {
    id: 'disciple_kidnapped',
    category: 'crisis',
    title: '弟子被掳',
    weight: (w) => (w.enemies['xuanming'] ?? 0) / 8,
    cooldownYears: 5,
    cast: [{ slot: 'victim', filter: (d) => d.action === 'travel' || d.rank === 'outer' }],
    trigger: (w) => (w.enemies['xuanming'] ?? 0) >= 25,
    text: (c) => `${c.cast['victim'].name}外出未归，只在山道上找到一只染血的鞋——玄冥教的摄魂幡印记赫然在侧。`,
    options: [
      {
        text: '点将营救',
        ai: 8,
        effects: (c) => {
          const victim = c.cast['victim']
          c.api.combat({
            kind: 'rogue', enemyName: '玄冥教掳人小队', enemyPower: sectMenace(c.w, 0.45) * (0.8 + c.rng.next() * 0.6),
            playerSelect: true, maxTeam: 3, lethality: 0.5,
            onWinEvent: 'rescue_won', onLoseEvent: 'rescue_lost',
          })
          c.w.flags['kidnapVictim'] = victim.id
        },
      },
      {
        text: '交赎金（灵石 400）',
        ai: 4,
        enabled: (c) => (c.w.sect.stones >= 400 ? true : '灵石不足 400'),
        effects: (c) => {
          c.w.sect.stones -= 400
          const victim = c.cast['victim']
          victim.status = 'injured'
          victim.statusUntil = c.w.day + 180
          addMood(victim, -20)
          log(c.w, 'event', `${victim.name}被赎了回来，遍体鳞伤，沉默寡言。`)
        },
      },
      {
        text: '宗门大局为重，放弃营救',
        ai: 1,
        effects: (c) => {
          const victim = c.cast['victim']
          for (const d of c.w.disciples) addMood(d, -10)
          for (const r of relsOf(c.w, victim.id)) {
            const other = getD(c.w, r.a === victim.id ? r.b : r.a)
            if (other && r.value > 40) addMood(other, -25)
          }
          deathRipple(c.w, victim)
          removeDisciple(c.w, victim, '被掳遇害')
          log(c.w, 'death', `${victim.name}自此再无音讯。宗门上下心寒者众。`)
          c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 10)
        },
      },
    ],
  },
  {
    id: 'rescue_won',
    category: 'chain',
    title: '虎口脱险',
    text: () => '魔修授首，被掳的弟子平安归山。鬼门关前走过一遭，眼神却比从前更坚定了。',
    options: undefined,
    auto: (c) => {
      const victim = getD(c.w, String(c.w.flags['kidnapVictim'] ?? ''))
      if (victim) {
        addMood(victim, 20)
        victim.combatExp += 1
        // 大器晚成觉醒钩子：生死历练
        if (victim.traits.includes('lateBloomer') && victim.shownAptitude < victim.aptitude) {
          victim.shownAptitude = victim.aptitude
          log(c.w, 'event', `生死之间，${victim.name}潜藏的资质轰然觉醒！`, victim.aptitude)
          chronicle(c.w, 'awaken', `${victim.name}历生死而悟道，资质觉醒。`)
        }
      }
      c.w.enemies['xuanming'] = Math.min(100, (c.w.enemies['xuanming'] ?? 0) + 10)
    },
  },
  {
    id: 'rescue_lost',
    category: 'chain',
    title: '营救失利',
    text: () => '救援队败退而归，被掳弟子生死未卜。玄冥教的狂笑声仿佛还在山谷间回荡。',
    options: undefined,
    auto: (c) => {
      const victim = getD(c.w, String(c.w.flags['kidnapVictim'] ?? ''))
      if (victim) {
        deathRipple(c.w, victim)
        removeDisciple(c.w, victim, '被掳遇害')
      }
      for (const d of c.w.disciples) addMood(d, -8)
    },
  },
  {
    id: 'vein_quake',
    category: 'crisis',
    title: '灵脉震荡',
    weight: 4,
    cooldownYears: 6,
    trigger: (w) => (w.sect.facilities['array'] ?? 0) >= 2,
    text: () => '地底灵脉无故震荡，聚灵阵的阵纹明灭不定，修炼效率大打折扣。',
    options: [
      {
        text: '耗材料抢修（材料 150）',
        ai: 8,
        enabled: (c) => (c.w.sect.materials >= 150 ? true : '材料不足 150'),
        effects: (c) => {
          c.w.sect.materials -= 150
          log(c.w, 'event', '阵法师连夜抢修，灵脉重归平稳。')
        },
      },
      {
        text: '任其自然平息',
        ai: 3,
        effects: (c) => {
          const lv = c.w.sect.facilities['array'] ?? 0
          if (lv > 1) c.w.sect.facilities['array'] = lv - 1
          log(c.w, 'event', '震荡月余方歇，聚灵阵阵基受损降级。')
        },
      },
    ],
  },
  {
    id: 'plague',
    category: 'crisis',
    title: '疫病横行',
    weight: 3,
    cooldownYears: 10,
    trigger: (w) => w.disciples.length >= 10,
    text: () => '山下疫病蔓延，连低阶弟子也有染恙者。医修进言：需灵草入药，遍施汤剂。',
    options: [
      {
        text: '开仓施药（灵草 60）',
        ai: 8,
        enabled: (c) => (c.w.sect.herbs >= 60 ? true : '灵草不足 60'),
        effects: (c) => {
          c.w.sect.herbs -= 60
          c.w.sect.reputation += 20
          c.w.sect.qiyun += 2
          log(c.w, 'event', '宗门施药救民，山下百姓焚香叩拜，侠名远扬。')
        },
      },
      {
        text: '闭山避疫',
        ai: 3,
        effects: (c) => {
          for (const d of c.w.disciples) if (d.realm <= 1 && c.rng.chance(0.15)) {
            d.status = 'injured'
            d.statusUntil = c.w.day + c.rng.int(60, 180)
          }
          log(c.w, 'event', '疫气还是渗进了外门，数名弟子病倒。')
        },
      },
    ],
  },
]
