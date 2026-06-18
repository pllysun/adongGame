// 杂项事件扩充（M6 内容冲刺）：日常、奇遇、人情、灾异
import type { EventDef } from '../../systems/events'
import { addMood, hasTrait, log, relsOf, setRel, getD } from '../../systems/helpers'
import { ARTIFACTS } from '../artifacts'
import { sectMenace } from './menace'

export const MISC_EVENTS: EventDef[] = [
  {
    id: 'grand_tournament',
    category: 'opportunity',
    title: '演武大比',
    weight: 7,
    cooldownYears: 5,
    trigger: (w) => (w.sect.facilities['arena'] ?? 0) >= 1 && w.disciples.length >= 8,
    text: () => '三年一度的宗内大比开锣，弟子们摩拳擦掌——头名可得掌门亲赐的彩头。',
    options: [
      {
        text: '丰厚彩头（灵石 200，全员士气大振）',
        ai: 6,
        enabled: (c) => (c.w.sect.stones >= 200 ? true : '灵石不足 200'),
        effects: (c) => {
          c.w.sect.stones -= 200
          const fighters = c.w.disciples.filter((d) => d.status === 'normal')
          for (const d of fighters) {
            d.combatExp += 1
            addMood(d, 8)
          }
          const champ = [...fighters].sort((a, b) => b.realm * 10 + b.combatExp - (a.realm * 10 + a.combatExp))[0]
          if (champ) {
            champ.combatExp += 2
            addMood(champ, 15)
            log(c.w, 'social', `大比落幕，${champ.name}技压群雄夺得头名！`)
          }
        },
      },
      {
        text: '简办（仅切磋）',
        ai: 4,
        effects: (c) => {
          for (const d of c.w.disciples) if (d.status === 'normal') d.combatExp += 1
          log(c.w, 'social', '大比简办，弟子们以武会友。')
        },
      },
    ],
  },
  {
    id: 'harvest_bumper',
    category: 'opportunity',
    title: '灵谷丰登',
    weight: 6,
    cooldownYears: 4,
    trigger: (w) => (w.sect.facilities['field'] ?? 0) >= 2,
    text: () => '今岁风调雨顺，灵田里的灵谷压弯了穗，药圃灵草也长势喜人。',
    options: undefined,
    auto: (c) => {
      c.w.sect.rice += 80
      c.w.sect.herbs += 40
      for (const d of c.w.disciples) if (d.action === 'work') addMood(d, 6)
    },
  },
  {
    id: 'harvest_blight',
    category: 'crisis',
    title: '灵田虫害',
    weight: 4,
    cooldownYears: 5,
    trigger: (w) => (w.sect.facilities['field'] ?? 0) >= 1,
    text: () => '一种啃食灵气的妖虫在灵田里泛滥，绿油油的田垄一夜枯黄了大半。',
    options: [
      {
        text: '以灵草制药除虫（灵草 30）',
        ai: 7,
        enabled: (c) => (c.w.sect.herbs >= 30 ? true : '灵草不足 30'),
        effects: (c) => {
          c.w.sect.herbs -= 30
          log(c.w, 'event', '虫患平息，灵田无恙。')
        },
      },
      {
        text: '人力捉虫',
        ai: 4,
        effects: (c) => {
          c.w.sect.rice = Math.max(0, c.w.sect.rice - 60)
          for (const d of c.w.disciples) if (d.action === 'work') addMood(d, -6)
          log(c.w, 'event', '虫患月余方平，今岁歉收已成定局。')
        },
      },
    ],
  },
  {
    id: 'elder_lecture',
    category: 'opportunity',
    title: '长老开坛讲道',
    weight: 6,
    cooldownYears: 2,
    cast: [{ slot: 'elder', filter: (d) => d.realm >= 3 && (d.rank === 'elder' || d.rank === 'master') }],
    text: (c) => `${c.cast['elder'].name}于讲道峰开坛三日，阐发大道至理，全宗弟子云集听讲。`,
    options: undefined,
    auto: (c) => {
      for (const d of c.w.disciples) {
        if (d === c.cast['elder']) continue
        d.cultivation += d.cultivation * 0.03 + 10 * d.comprehension
        if (d.comprehension >= 8 && c.rng.chance(0.1)) {
          d.cultivation += 100
          log(c.w, 'social', `${d.name}听讲入神，隐有所悟。`)
        }
      }
      addMood(c.cast['elder'], 10)
    },
  },
  {
    id: 'couple_grief',
    category: 'personnel',
    title: '未亡人',
    weight: (w) => {
      // 有道侣新丧的痴情人
      return w.disciples.filter((d) => d.mood <= -50 && relsOf(w, d.id).every((r) => r.type !== 'couple')).length > 0 ? 5 : 0
    },
    cooldownYears: 3,
    cast: [{ slot: 'grief', filter: (d, w) => d.mood <= -50 && relsOf(w, d.id).every((r) => r.type !== 'couple') }],
    text: (c) => `${c.cast['grief'].name}近来常独坐崖边，一坐就是一整夜。同门远远看着，无人敢上前。`,
    options: [
      {
        text: '请其挚友相伴开解',
        ai: 7,
        effects: (c) => {
          const g = c.cast['grief']
          const friend = relsOf(c.w, g.id)
            .filter((r) => r.value > 30)
            .map((r) => getD(c.w, r.a === g.id ? r.b : r.a))
            .find((x) => !!x)
          if (friend) {
            addMood(g, 30)
            setRel(c.w, g.id, friend.id, 'friend', 15)
            log(c.w, 'social', `${friend.name}陪${g.name}饮了一夜的酒。天亮时，崖边传来了久违的笑声。`)
          } else {
            addMood(g, 10)
            log(c.w, 'social', `无人能走进${g.name}的心里，只能任时间慢慢磨。`)
          }
        },
      },
      {
        text: '由他去吧，伤痛需要时间',
        ai: 3,
        effects: (c) => {
          if (c.rng.chance(0.3)) {
            c.cast['grief'].mood = Math.min(c.cast['grief'].mood, -65)
            log(c.w, 'social', `${c.cast['grief'].name}的心结越缠越深……`)
          }
        },
      },
    ],
  },
  {
    id: 'beast_cub',
    category: 'opportunity',
    title: '妖兽幼崽',
    weight: 5,
    cooldownYears: 6,
    cast: [{ slot: 'finder', filter: (d) => d.action === 'travel' || d.action === 'work', sortBy: 'luck' }],
    text: (c) => `${c.cast['finder'].name}在后山捡到一只通体雪白的妖兽幼崽，奶声奶气，灵性十足。`,
    options: [
      {
        text: '养在山门镇守灵田',
        ai: 7,
        effects: (c) => {
          c.w.beastThreat = Math.max(0, c.w.beastThreat - 10)
          c.w.sect.qiyun += 2
          addMood(c.cast['finder'], 12)
          log(c.w, 'event', '小妖兽成了全宗团宠，连妖兽潮的气息都温顺了几分。')
        },
      },
      {
        text: '卖给万兽山（灵石 300）',
        ai: 3,
        effects: (c) => {
          c.w.sect.stones += 300
          c.w.sect.qiyun = Math.max(0, c.w.sect.qiyun - 2)
          addMood(c.cast['finder'], -10)
        },
      },
    ],
  },
  {
    id: 'mine_discovery',
    category: 'opportunity',
    title: '矿脉现世',
    weight: 4,
    cooldownYears: 10,
    text: () => '后山塌方，露出一截泛着灵光的矿脉！矿质几何尚不可知。',
    options: [
      {
        text: '组织开采（灵石 300 置办器具）',
        ai: 8,
        enabled: (c) => (c.w.sect.stones >= 300 ? true : '灵石不足 300'),
        effects: (c) => {
          c.w.sect.stones -= 300
          if (c.rng.chance(0.6)) {
            const gain = c.rng.int(600, 1200)
            c.w.sect.stones += gain
            c.w.sect.materials += 200
            log(c.w, 'event', `矿脉品质上佳！采得灵石 ${gain}、材料 200。`)
          } else {
            c.w.sect.materials += 80
            log(c.w, 'event', '可惜是贫矿，仅得材料 80。')
          }
        },
      },
      { text: '封存不动', ai: 2, effects: () => {} },
    ],
  },
  {
    id: 'bandits',
    category: 'crisis',
    title: '修士匪帮',
    weight: 5,
    cooldownYears: 4,
    trigger: (w) => w.sect.stones >= 400,
    text: () => '一伙流窜的散修匪帮盯上了本宗的商路，扬言"留下买路财"。',
    options: [
      {
        text: '剿匪（点将）',
        ai: 8,
        effects: (c) => {
          c.api.combat({
            kind: 'rogue', enemyName: '散修匪帮', enemyPower: sectMenace(c.w, 0.55) * (0.8 + c.rng.next() * 0.5),
            playerSelect: true, maxTeam: 4, lootStones: 350, lethality: 0.45,
          })
        },
      },
      {
        text: '交保护费（灵石 250）',
        ai: 2,
        enabled: (c) => (c.w.sect.stones >= 250 ? true : '灵石不足'),
        effects: (c) => {
          c.w.sect.stones -= 250
          c.w.sect.reputation = Math.max(0, c.w.sect.reputation - 8)
        },
      },
    ],
  },
  {
    id: 'alchemy_explosion',
    category: 'crisis',
    title: '丹房炸炉',
    weight: (w) => ((w.sect.facilities['alchemy'] ?? 0) >= 1 ? 4 : 0),
    cooldownYears: 3,
    cast: [{ slot: 'alchemist', filter: (d) => d.action === 'work' }],
    text: (c) => `轰——丹房方向腾起一团彩烟！${c.cast['alchemist'].name}灰头土脸地从瓦砾里爬出来，手里还攥着半枚焦黑的丹丸。`,
    options: undefined,
    auto: (c) => {
      const a = c.cast['alchemist']
      c.w.sect.herbs = Math.max(0, c.w.sect.herbs - 20)
      if (c.rng.chance(0.25)) {
        a.status = 'injured'
        a.statusUntil = c.w.day + c.rng.int(30, 120)
        addMood(a, -12)
      } else if (c.rng.chance(0.1)) {
        // 因祸得福：炸出灵丹
        c.w.sect.pills['peiyuan'] = (c.w.sect.pills['peiyuan'] ?? 0) + 1
        log(c.w, 'event', '焦黑丹丸竟是误打误撞炼成的培元丹！')
      }
    },
  },
  {
    id: 'snow_disaster',
    category: 'crisis',
    title: '百年寒灾',
    weight: 3,
    cooldownYears: 15,
    text: () => '罕见的灵寒侵山，大雪封门三月，滴水成冰。低阶弟子在寒气中苦苦支撑。',
    options: [
      {
        text: '燃灵石供暖（灵石 300）',
        ai: 8,
        enabled: (c) => (c.w.sect.stones >= 300 ? true : '灵石不足 300'),
        effects: (c) => {
          c.w.sect.stones -= 300
          for (const d of c.w.disciples) if (d.roots.elements.includes('fire')) d.cultivation += 50
          log(c.w, 'event', '灵石阵驱散寒气，火灵根弟子反借寒气淬炼出几分火候。')
        },
      },
      {
        text: '硬扛',
        ai: 2,
        effects: (c) => {
          for (const d of c.w.disciples) {
            if (d.realm <= 1) {
              addMood(d, -12)
              if (c.rng.chance(0.08)) {
                d.status = 'injured'
                d.statusUntil = c.w.day + 90
              }
            }
          }
          log(c.w, 'event', '寒灾过后，外门弟子病倒一片。')
        },
      },
    ],
  },
  {
    id: 'library_moths',
    category: 'crisis',
    title: '书蠹蛀典',
    weight: (w) => ((w.sect.facilities['library'] ?? 0) >= 2 && w.sect.gongfa.length > 4 ? 3 : 0),
    cooldownYears: 10,
    text: () => '藏经阁的看守发现一种以墨香为食的灵蠹，几部典籍的边角已被啃噬。',
    options: [
      {
        text: '请丹师配药熏杀（灵草 25）',
        ai: 8,
        enabled: (c) => (c.w.sect.herbs >= 25 ? true : '灵草不足'),
        effects: (c) => {
          c.w.sect.herbs -= 25
          log(c.w, 'event', '灵蠹除尽，典籍无恙。')
        },
      },
      {
        text: '人工翻晒驱虫',
        ai: 3,
        effects: (c) => {
          if (c.rng.chance(0.4) && c.w.sect.gongfa.length > 4) {
            const idx = c.rng.int(0, c.w.sect.gongfa.length - 1)
            const lost = c.w.sect.gongfa.splice(idx, 1)[0]
            void lost
            log(c.w, 'event', '一部功法终究被蛀得无法辨认，只能除名。')
          } else {
            log(c.w, 'event', '弟子们翻晒月余，总算保住了典籍。')
          }
        },
      },
    ],
  },
  {
    id: 'sect_visit',
    category: 'opportunity',
    title: '友宗来访',
    weight: 5,
    cooldownYears: 4,
    trigger: (w) => w.sect.reputation >= 150,
    text: () => '邻郡丹霞谷遣使来访，愿与本宗缔结盟好，互通有无。',
    options: [
      {
        text: '设宴结盟',
        ai: 8,
        effects: (c) => {
          c.w.sect.stones -= Math.min(100, c.w.sect.stones)
          for (const k of Object.keys(c.w.enemies)) c.w.enemies[k] = Math.max(0, c.w.enemies[k] - 8)
          c.w.sect.reputation += 10
          c.w.sect.herbs += 30
          log(c.w, 'event', '两宗把酒言欢，丹霞谷赠灵草为礼。外敌闻讯皆有所收敛。')
        },
      },
      { text: '婉拒（不结外援）', ai: 2, effects: (c) => log(c.w, 'event', '使者悻悻而归。') },
    ],
  },
  {
    id: 'homesick',
    category: 'personnel',
    title: '尘缘未了',
    weight: 4,
    cooldownYears: 2,
    cast: [{ slot: 'd', filter: (d, w) => d.realm <= 1 && w.day - d.joinDay < 360 * 5 }],
    text: (c) => `${c.cast['d'].name}入门未久，夜里常对着山下的方向出神——家中老母，不知安否。`,
    options: [
      {
        text: '准其归家省亲一月',
        ai: 7,
        effects: (c) => {
          const d = c.cast['d']
          addMood(d, 25)
          d.status = 'seclusion'
          d.statusUntil = c.w.day + 30
          log(c.w, 'social', `${d.name}省亲归来，再无挂碍，道心通透了许多。`)
        },
      },
      {
        text: '修行之人当斩断尘缘',
        ai: 3,
        effects: (c) => {
          addMood(c.cast['d'], -15)
          if (hasTrait(c.cast['d'], 'devoted') && c.rng.chance(0.3)) {
            log(c.w, 'social', `${c.cast['d'].name}夜半私自下山，三日后才回，被罚跪山门。`)
            addMood(c.cast['d'], -10)
          }
        },
      },
    ],
  },
  {
    id: 'retire_wish',
    category: 'personnel',
    title: '倦鸟思还',
    weight: 3,
    cooldownYears: 5,
    cast: [{ slot: 'old', filter: (d, w) => d.realm <= 2 && w.day - d.birthDay > 360 * 90 && d.mood < 0 }],
    text: (c) => `${c.cast['old'].name}求见掌门："弟子修行无望，愿退居灵田做个管事，了此残生。"`,
    options: [
      {
        text: '准（转为执事，安心劳作）',
        ai: 6,
        effects: (c) => {
          const d = c.cast['old']
          d.action = 'work'
          addMood(d, 20)
          log(c.w, 'social', `${d.name}卸下道袍，从此专心打理灵田，脸上反多了笑容。`)
        },
      },
      {
        text: '勉励再修（赐聚气丹）',
        ai: 4,
        enabled: (c) => ((c.w.sect.pills['juqi'] ?? 0) > 0 ? true : '无聚气丹'),
        effects: (c) => {
          c.w.sect.pills['juqi']--
          const d = c.cast['old']
          d.buffs.breakthroughPill = 0.1
          addMood(d, 10)
        },
      },
    ],
  },
  {
    id: 'wildfire',
    category: 'crisis',
    title: '山火燎原',
    weight: 3,
    cooldownYears: 12,
    text: () => '雷击引燃了南坡的松林，火借风势直扑山门而来！',
    options: [
      {
        text: '水行弟子布雨阵扑救',
        ai: 8,
        effects: (c) => {
          const waterDs = c.w.disciples.filter((d) => d.roots.elements.includes('water') && d.status === 'normal')
          if (waterDs.length >= 2) {
            for (const d of waterDs) {
              d.combatExp += 1
              addMood(d, 8)
            }
            log(c.w, 'event', `${waterDs[0].name}等人布下雨阵，大火即灭。水行弟子经此一役配合愈发默契。`)
          } else {
            c.w.sect.rice = Math.max(0, c.w.sect.rice - 50)
            log(c.w, 'event', '水行弟子太少，山火烧掉了半坡灵田才熄。')
          }
        },
      },
      {
        text: '弃外围保山门',
        ai: 3,
        effects: (c) => {
          const lv = c.w.sect.facilities['field'] ?? 0
          if (lv > 1) c.w.sect.facilities['field'] = lv - 1
          log(c.w, 'event', '火势三日方退，外围灵田损毁。')
        },
      },
    ],
  },
  {
    id: 'gift_giving',
    category: 'personnel',
    title: '同门赠礼',
    weight: 4,
    cooldownYears: 1,
    cast: [
      { slot: 'giver', filter: (d, w) => relsOf(w, d.id).some((r) => r.value >= 30) && (hasTrait(d, 'warmheart') || hasTrait(d, 'sociable') || d.mood > 40) },
    ],
    text: (c) => `${c.cast['giver'].name}游历归来，给交好的同门都捎了些小玩意儿。`,
    options: undefined,
    auto: (c) => {
      const g = c.cast['giver']
      for (const r of relsOf(c.w, g.id).filter((r) => r.value >= 30).slice(0, 3)) {
        const other = getD(c.w, r.a === g.id ? r.b : r.a)
        if (other) {
          setRel(c.w, g.id, other.id, r.type, 8)
          addMood(other, 6)
        }
      }
    },
  },
  {
    id: 'seclusion_insight',
    category: 'personnel',
    title: '闭关有悟',
    weight: 5,
    cooldownYears: 2,
    cast: [{ slot: 'd', filter: (d) => d.action === 'seclude' && d.comprehension >= 7 }],
    text: (c) => `${c.cast['d'].name}闭关洞府中隐有清光透出，气息节节攀升——这是要悟了！`,
    options: undefined,
    auto: (c) => {
      const d = c.cast['d']
      d.cultivation += d.cultivation * 0.15 + 80
      addMood(d, 15)
      log(c.w, 'breakthrough', `${d.name}闭关有得，修为大进。`)
    },
  },
  {
    id: 'marrow_chance',
    category: 'opportunity',
    title: '洗髓之机',
    weight: (w) => ((w.sect.pills['xisui'] ?? 0) > 0 ? 8 : 0),
    cooldownYears: 5,
    cast: [{ slot: 'd', filter: (d) => d.roots.purity <= 5 && d.shownAptitude >= 2 }],
    text: (c) => `丹房中那枚洗髓丹药力正盛。${c.cast['d'].name}资质尚可惜灵根驳杂，正是洗髓的好人选。`,
    options: [
      {
        text: '为其洗髓（消耗洗髓丹）',
        ai: 8,
        effects: (c) => {
          c.w.sect.pills['xisui'] = Math.max(0, (c.w.sect.pills['xisui'] ?? 0) - 1)
          const d = c.cast['d']
          d.roots.purity = Math.min(10, d.roots.purity + 3)
          if (d.roots.elements.length > 2 && c.rng.chance(0.5)) d.roots.elements.pop()
          addMood(d, 25)
          log(c.w, 'event', `${d.name}洗髓伐毛，灵根焕然一新！`, 4)
        },
      },
      { text: '留着以后用', ai: 2, effects: () => {} },
    ],
  },
  {
    id: 'travel_encounter',
    category: 'opportunity',
    title: '游历奇遇',
    weight: 6,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.action === 'travel', sortBy: 'luck' }],
    text: (c) => `${c.cast['d'].name}游历途中，在一处荒废道观里发现了前人留下的痕迹。`,
    options: undefined,
    auto: (c) => {
      const d = c.cast['d']
      const roll = c.rng.next() * (1 + d.luck / 10)
      if (roll > 1.3) {
        const pool = ARTIFACTS.filter((a) => a.rarity <= 2 && !c.w.sect.artifacts.includes(a.id))
        if (pool.length > 0) {
          const a = c.rng.pick(pool)
          c.w.sect.artifacts.push(a.id)
          log(c.w, 'event', `${d.name}于道观蒲团下寻得${a.name}！`, a.rarity)
          return
        }
      }
      if (roll > 0.9) {
        d.cultivation += 100 + d.luck * 30
        log(c.w, 'event', `${d.name}在道观壁上读到一篇残缺心得，颇有所获。`)
      } else if (roll < 0.25) {
        d.status = 'injured'
        d.statusUntil = c.w.day + c.rng.int(60, 180)
        addMood(d, -10)
        log(c.w, 'event', `${d.name}误触道观中的残破阵法，受了点伤，狼狈而归。`)
      } else {
        log(c.w, 'event', `${d.name}在道观中歇了一夜，一无所获。`)
      }
    },
  },
  {
    id: 'demon_intervention',
    category: 'crisis',
    title: '心魔劫·救赎',
    weight: (w) => w.disciples.filter((d) => d.status === 'demonic').length * 12,
    cooldownYears: 1,
    cast: [{ slot: 'd', filter: (d) => d.status === 'demonic' }],
    text: (c) => `${c.cast['d'].name}的心魔日渐深重，洞府周围的草木都透着枯意。再不施救，恐有性命之忧。`,
    options: [
      {
        text: '长老护持渡劫（占用一位长老一季）',
        ai: 8,
        enabled: (c) => (c.w.disciples.some((x) => x.realm >= 3 && x.status === 'normal' && x !== c.cast['d']) ? true : '无可用长老'),
        effects: (c) => {
          const d = c.cast['d']
          const elder = c.w.disciples.find((x) => x.realm >= 3 && x.status === 'normal' && x !== d)!
          elder.status = 'seclusion'
          elder.statusUntil = c.w.day + 90
          if (c.rng.chance(0.7 + d.mindstate * 0.02)) {
            d.status = 'normal'
            d.mood = 0
            setRel(c.w, d.id, elder.id, 'master', 30)
            log(c.w, 'social', `${elder.name}以自身道音护持百日，${d.name}终于挣脱心魔，恩同再造。`)
          } else {
            addMood(d, 10)
            log(c.w, 'social', '心魔暂退三分，仍未根除。')
          }
        },
      },
      {
        text: '赐明心见性丹',
        ai: 6,
        enabled: (c) => ((c.w.sect.pills['mingxin'] ?? 0) > 0 ? true : '无明心见性丹'),
        effects: (c) => {
          c.w.sect.pills['mingxin']--
          const d = c.cast['d']
          d.mood = Math.min(100, d.mood + 40)
          if (d.mood > -40) d.status = 'normal'
          log(c.w, 'social', `${d.name}服丹之后，眼中的赤红渐渐褪去。`)
        },
      },
      { text: '听天由命', ai: 1, effects: () => {} },
    ],
  },
  {
    id: 'old_friend_visit',
    category: 'opportunity',
    title: '故人来访',
    weight: 4,
    cooldownYears: 6,
    cast: [{ slot: 'master', filter: (d) => d.rank === 'master' }],
    text: (c) => `一位云游老道叩门，竟是${c.cast['master'].name}早年的故交。两人对坐手谈三日，临别时老道留下一份谢礼。`,
    options: undefined,
    auto: (c) => {
      const roll = c.rng.next()
      if (roll > 0.6) {
        c.w.sect.pills['mingxin'] = (c.w.sect.pills['mingxin'] ?? 0) + 1
        log(c.w, 'event', '老道留下明心见性丹一枚。')
      } else {
        c.w.sect.stones += 200
        log(c.w, 'event', '老道留下灵石二百。')
      }
      addMood(c.cast['master'], 15)
    },
  },
]
