// 全局共享类型：engine 与 ui 都依赖，本文件不依赖任何一方

export type Rarity = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth'
export type Gender = 'm' | 'f'
/** 0凡人 1炼气 2筑基 3金丹 4元婴 5化神 6炼虚 7合体 8大乘 9渡劫 */
export type Realm = number
export type SubRealm = 0 | 1 | 2

export type DiscipleStatus = 'normal' | 'injured' | 'crippled' | 'seclusion' | 'demonic' | 'dying'
export type Rank = 'outer' | 'inner' | 'core' | 'elder' | 'master'
export type ActionId = 'cultivate' | 'train' | 'work' | 'social' | 'seclude' | 'travel' | 'recover'

export interface SpiritRoots {
  elements: Element[]
  purity: number // 1-10
}

export interface Disciple {
  id: string
  name: string
  gender: Gender
  birthDay: number
  joinDay: number
  aptitude: Rarity
  shownAptitude: Rarity
  roots: SpiritRoots
  comprehension: number // 悟性 1-10
  mindstate: number // 心性 1-10
  luck: number // 气运 1-10（隐藏）
  traits: string[]
  realm: Realm
  sub: SubRealm
  cultivation: number
  bottleneck: boolean
  breakthroughFails: number
  mood: number // -100..100
  status: DiscipleStatus
  statusUntil: number
  rank: Rank
  action: ActionId
  gongfa: string | null
  artifact: string | null
  combatExp: number
  portraitSeed: number
  deathProtected: boolean
  buffs: { breakthroughPill?: number; scar?: number }
  // ── 命途系统（docs/09）──
  beliefs: Beliefs // 五轴心相：长期自我，永久写入、慢漂移
  memories: Memory[] // 阅历记忆 = 经历树数据
  masterId: string | null // 师尊（外门为 null）
  peakId: string | null // 所属峰（未分峰为 null）
  lineageTier: 'zhuan' | 'jiming' | null // 嫡传/记名/无
}

/** 五轴心相（docs/09 §3.2），各 0~100 */
export interface Beliefs {
  daoxin: number // 道心：信念定力
  xinmo: number // 心魔/执念：创伤累积，只升难降
  molean: number // 魔倾：个人正魔倾向
  loyalty: number // 忠诚：对宗门
  fame: number // 声名：个人名望
}
export type BeliefKey = keyof Beliefs

export interface Memory {
  day: number
  eventId: string
  kind: 'turning' | 'minor' // 转折点 / 琐事
  text: string
  choice?: string
  impact: Partial<Beliefs> & { traitGained?: string; traitLost?: string }
  tags: string[]
  causedBy?: number // 指向更早一条记忆的 day（因果链）
}

/** 峰 = 小宗门（docs/09 §8） */
export type PeakType = 'sword' | 'alchemy' | 'forge' | 'array' | 'beast' | 'teach' | 'outer'
export interface Peak {
  id: string
  name: string
  type: PeakType
  founderId: string
  masterId: string // 当代峰主
  signatureGongfa: string | null // 镇峰道统
  treasure: string | null // 镇峰之宝
  prestige: number
  foundedDay: number
}
export type SectStage = 'founding' | 'sect' | 'peaks'

export type RelType = 'master' | 'peer' | 'friend' | 'couple' | 'crush' | 'rival'
export interface RelEdge {
  a: string
  b: string
  type: RelType
  value: number // -100..100
  since: number
  dir?: 'ab' | 'ba' // 仅 crush 用
}

export interface SectRules {
  recruitYears: number
  innerRealm: Realm
  coreAptitude: Rarity
  stipend: 0 | 1 | 2
  pillPriority: 'aptitude' | 'realm' | 'none'
  allowCouple: boolean
  allowTravel: boolean
  autoBreakthrough: boolean
  libraryOpenRarity: Rarity
  /** 事件拦截级别（1-7）：≥此级别的事件弹窗打断，低于的进收件箱异步处理（docs/04 §事件分流） */
  interceptLevel: EventLevel
}

/** 事件等级 1-7，对应七阶颜色；越高越罕见、风险越高、收获越大 */
export type EventLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type EventScope = 'personal' | 'sect'

export interface SectState {
  name: string
  siteQuality: number // 灵脉品质 1-5
  siteDanger: number // 危险度 1-5
  reputation: number
  qiyun: number
  stones: number
  rice: number
  herbs: number
  materials: number
  facilities: Record<string, number>
  gongfa: string[]
  pills: Record<string, number>
  artifacts: string[]
  rules: SectRules
}

export type LogCat = 'event' | 'breakthrough' | 'combat' | 'economy' | 'social' | 'death' | 'system'
export interface LogEntry {
  day: number
  cat: LogCat
  text: string
  rarity?: Rarity
}
export interface ChronicleEntry {
  day: number
  kind: string
  text: string
}

export interface InteractiveOption {
  idx: number
  text: string
  disabled?: string
  hint?: string
  ai?: number // 无头自动玩家的选择权重（UI 不展示）
}
export type InteractiveKind = 'event' | 'recruit' | 'combat-setup' | 'breakthrough-ask'
export interface Interactive {
  uid: number
  kind: InteractiveKind
  title: string
  text: string
  castIds: string[]
  options: InteractiveOption[]
  eventId?: string
  cast?: Record<string, string>
  payload?: unknown
  pause: boolean
  // ── 事件分流（docs/04 §事件分流）──
  level?: EventLevel // 事件等级 1-7
  scope?: EventScope // 个人 / 宗门
  expiryDay?: number // 仅收件箱项：到期后按 defaultOption 默认处理
  defaultOption?: number // 过期默认选项（缺省 = 最后一项，最保守）
  createdDay?: number
}

export interface CombatSpec {
  kind: 'beast' | 'rogue' | 'duel' | 'sectwar' | 'tribulation'
  enemyName: string
  enemyPower: number
  defenderIds?: string[]
  playerSelect?: boolean
  maxTeam?: number
  defense?: boolean // 护山大阵参战
  lootStones?: number
  lootMaterials?: number
  lootGongfaRarity?: Rarity
  onWinEvent?: string
  onLoseEvent?: string
  lethality?: number // 0-1 伤亡烈度
}

export interface BattleBeatLine {
  text: string
  tone: 'good' | 'bad' | 'neutral' | 'highlight'
}
export interface BattleReport {
  uid: number
  day: number
  title: string
  win: boolean
  lines: BattleBeatLine[]
  casualties: string[]
}

export interface DepartedRecord {
  id: string
  name: string
  cause: string
  day: number
  realm: Realm
  aptitude: Rarity
}

export interface WorldState {
  day: number
  sect: SectState
  disciples: Disciple[]
  departed: DepartedRecord[]
  relations: RelEdge[]
  flags: Record<string, number | string | boolean>
  cooldowns: Record<string, number>
  scheduled: { day: number; eventId: string; cast: Record<string, string> }[]
  log: LogEntry[]
  chronicle: ChronicleEntry[]
  queue: Interactive[] // 拦截队列：弹窗打断、阻塞时间推进
  inbox: Interactive[] // 收件箱：异步待处理的低级事件，不阻塞时间，过期默认处理
  reports: BattleReport[]
  enemies: Record<string, number> // 敌宗 id -> 敌意 0-100
  beastThreat: number // 妖兽活跃度 0-100
  nextRecruitDay: number
  stats: { firstRealm: Record<number, number>; recruitsTotal: number }
  uidCounter: number
  idCounter: number
  gameOver: null | { type: 'victory' | 'defeat'; day: number; reason: string }
  // ── 师承与峰（docs/09 §8）──
  peaks: Peak[]
  sectStage: SectStage
  innerThreshold: { realm: Realm; aptitude: Rarity } // 动态入内门门槛
  divineFavor: number // 天道亲临已用次数（配合气运冷却）
}

export type Command =
  | { type: 'resolve'; uid: number; option: number; selection?: string[] }
  | { type: 'build'; facility: string }
  | { type: 'setRule'; key: keyof SectRules; value: SectRules[keyof SectRules] }
  | { type: 'grantPill'; discipleId: string; pillId: string }
  | { type: 'grantArtifact'; discipleId: string; artifactId: string }
  | { type: 'setGongfa'; discipleId: string; gongfaId: string }
  | { type: 'setRank'; discipleId: string; rank: Rank }
  | { type: 'expel'; discipleId: string }
  | { type: 'divineIntervene'; discipleId: string; toward: BeliefKey } // 天道亲临：强行扭转一次心相
  | { type: 'appointPeakMaster'; peakId: string; discipleId: string } // 钦点峰主
  | { type: 'allocatePeak'; peakId: string; stones: number } // 给峰拨资源
  | { type: 'dismissInbox'; uid: number } // 收件箱：立即按默认（最保守）选项放弃处理

export interface ScenarioConfig {
  sectName: string
  siteQuality: number
  siteDanger: number
}

export interface SaveBlob {
  version: number
  seed: string
  rngState: [number, number, number, number]
  world: WorldState
}
