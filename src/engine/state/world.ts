// 世界状态构造：开局剧本 → 初始 WorldState（docs/00 §游戏开局）
import type { ScenarioConfig, SectRules, WorldState } from '@/shared/types'
import { DAYS_PER_YEAR } from '../core/clock'
import { ENEMY_SECTS } from '../content/names'
import type { RNG } from '../core/rng'
import { generateDisciple, generateFounder } from './disciple'

export const DEFAULT_RULES: SectRules = {
  recruitYears: 3,
  innerRealm: 1, // 炼气后期晋内门由 sub 判定，这里存大境界门槛
  coreAptitude: 3,
  stipend: 1,
  pillPriority: 'aptitude',
  allowCouple: true,
  allowTravel: true,
  autoBreakthrough: true,
  libraryOpenRarity: 1,
  interceptLevel: 5, // 默认：5 级（金/天品）及以上弹窗打断，低于的进收件箱（pause:true 事件始终打断）
}

export function createWorld(rng: RNG, scenario: ScenarioConfig): WorldState {
  const w: WorldState = {
    day: 0,
    sect: {
      name: scenario.sectName,
      siteQuality: scenario.siteQuality,
      siteDanger: scenario.siteDanger,
      reputation: 30,
      qiyun: 10,
      stones: 600,
      rice: 120,
      herbs: 30,
      materials: 80,
      facilities: { array: 1, caves: 1, field: 1 },
      gongfa: ['tunaqi', 'qingmu', 'liehuo', 'zixia'],
      pills: { juqi: 3, qingxin: 2, jinchuang: 2 },
      artifacts: ['qingfengjian', 'hushen'],
      rules: { ...DEFAULT_RULES },
    },
    disciples: [],
    departed: [],
    relations: [],
    flags: {},
    cooldowns: {},
    scheduled: [],
    log: [],
    chronicle: [],
    queue: [],
    inbox: [],
    reports: [],
    enemies: Object.fromEntries(ENEMY_SECTS.map((e) => [e.id, 10 + scenario.siteDanger * 4])),
    beastThreat: 10 + scenario.siteDanger * 5,
    nextRecruitDay: DAYS_PER_YEAR, // 第一年末首届招收
    stats: { firstRealm: {}, recruitsTotal: 0 },
    uidCounter: 0,
    idCounter: 0,
    gameOver: null,
    peaks: [],
    sectStage: 'founding',
    innerThreshold: { realm: 1, aptitude: 0 },
    divineFavor: 0,
  }

  // 祖师 + 三名种子弟子
  const founder = generateFounder(rng, w)
  w.disciples.push(founder)
  for (let i = 0; i < 3; i++) {
    const d = generateDisciple(rng, w, { ageYears: [12, 18], gongfa: 'tunaqi' })
    w.disciples.push(d)
  }

  w.chronicle.push({
    day: 0,
    kind: 'founding',
    text: `${founder.name}于灵脉之上开宗立派，${scenario.sectName}自此立世。座下弟子三人，灵田一亩，前路漫漫。`,
  })
  w.log.push({ day: 0, cat: 'system', text: `${scenario.sectName}建宗，祖师${founder.name}（金丹初期）。` })
  return w
}

/** 开局选址：生成 4 个候选灵脉（品质与危险度正相关 + 扰动） */
export interface SiteOption {
  name: string
  quality: number
  danger: number
  desc: string
}
export function generateSites(rng: RNG): SiteOption[] {
  const names = ['青云峰', '落霞谷', '黑风岭', '太华绝顶', '碧水寒潭', '赤炎火山']
  const picked = rng.shuffle([...names]).slice(0, 4)
  return picked.map((name) => {
    const quality = rng.int(1, 5)
    const danger = Math.max(1, Math.min(5, quality + rng.int(-1, 1)))
    const descQ = ['灵气稀薄', '灵气尚可', '灵气充沛', '灵气浓郁', '灵气如雾'][quality - 1]
    const descD = ['人迹罕至', '偶有野兽', '妖兽出没', '凶兽盘踞', '魔气侵蚀'][danger - 1]
    return { name, quality, danger, desc: `${descQ}，${descD}。` }
  })
}
