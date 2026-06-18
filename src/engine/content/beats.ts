// 战斗节拍模板库（docs/05 §2）：战报的叙事原子。特殊节拍（舍身相救/见死不救/顿悟）由战斗系统逻辑触发。
export type BeatSituation = 'dominant' | 'even' | 'losing' | 'any'

export interface BeatCtx {
  a: string // 我方随机成员名
  b: string // 我方另一成员名（可能与 a 相同时由系统避免）
  enemy: string
  gongfa: string // a 的功法名
  artifact: string // a 的法宝名（无则"长剑"）
}

export interface BeatDef {
  situation: BeatSituation
  weight: number
  tone: 'good' | 'bad' | 'neutral' | 'highlight'
  text: (c: BeatCtx) => string
}

const B = (situation: BeatSituation, weight: number, tone: BeatDef['tone'], text: (c: BeatCtx) => string): BeatDef => ({
  situation, weight, tone, text,
})

export const BEATS: BeatDef[] = [
  // 占优
  B('dominant', 10, 'good', (c) => `${c.a}祭出${c.artifact}，宝光大盛，${c.enemy}被压得节节败退。`),
  B('dominant', 10, 'good', (c) => `${c.a}运转${c.gongfa}，一击得手，${c.enemy}发出凄厉的嘶吼。`),
  B('dominant', 8, 'good', (c) => `${c.b}与${c.a}左右合围，攻势如潮，${c.enemy}的退路被一寸寸封死。`),
  B('dominant', 8, 'good', (c) => `${c.a}剑光纵横，所过之处${c.enemy}的爪牙纷纷溃散。`),
  B('dominant', 6, 'good', (c) => `${c.enemy}垂死反扑，却被${c.a}看破来路，反手就是一记重创。`),
  B('dominant', 6, 'neutral', (c) => `${c.enemy}且战且退，${c.a}稳扎稳打，不给其喘息之机。`),
  // 胶着
  B('even', 10, 'neutral', (c) => `${c.a}与${c.enemy}斗得难解难分，法光与煞气在半空轰然相撞。`),
  B('even', 10, 'neutral', (c) => `${c.enemy}凶性大发，${c.a}咬牙催动${c.gongfa}，堪堪稳住阵脚。`),
  B('even', 8, 'neutral', (c) => `${c.b}见势不妙，急忙补位，与${c.a}背靠背结成攻守同盟。`),
  B('even', 8, 'bad', (c) => `${c.a}稍有不慎被${c.enemy}扫中肩头，闷哼一声踉跄后退。`),
  B('even', 6, 'good', (c) => `电光石火之间，${c.a}觅得破绽，${c.artifact}破空而出！`),
  B('even', 6, 'neutral', () => `双方僵持不下，灵力激荡得山石碎裂、草木齐折。`),
  // 逆风
  B('losing', 10, 'bad', (c) => `${c.enemy}势大力沉，${c.a}的护体灵光寸寸碎裂。`),
  B('losing', 10, 'bad', (c) => `${c.b}被逼到绝地，全凭一口真气死撑。`),
  B('losing', 8, 'bad', (c) => `${c.a}口吐鲜血，${c.artifact}光芒黯淡，眼看支撑不住。`),
  B('losing', 8, 'bad', (c) => `阵型被${c.enemy}冲得七零八落，众人各自为战。`),
  B('losing', 6, 'highlight', (c) => `危急关头，${c.a}爆发出超越境界的气势，硬生生撕开一道生路！`),
  B('losing', 6, 'bad', (c) => `${c.enemy}的咆哮震得人心神摇曳，士气一落千丈。`),
  // 通用
  B('any', 5, 'neutral', (c) => `${c.a}低喝一声，${c.gongfa}运转到极致，周身灵光暴涨。`),
  B('any', 5, 'neutral', (c) => `${c.enemy}与众人战作一团，烟尘蔽日，难分敌我。`),
  B('any', 4, 'neutral', (c) => `${c.b}且战且观，寻找着${c.enemy}的命门所在。`),
  B('any', 4, 'highlight', (c) => `${c.a}一声清啸，剑随心动，这一刻仿佛天地都为之一静。`),
]

// 特殊节拍文案（由战斗系统逻辑触发，此处只提供文案）
export const SPECIAL_BEATS = {
  save: (savior: string, saved: string) =>
    `千钧一发之际，${savior}舍身扑出，将${saved}推开，自己硬受了这致命一击！`,
  ignore: (watcher: string, victim: string) =>
    `${victim}陷入死地，距其最近的${watcher}却脚步一顿，竟袖手旁观……`,
  insight: (who: string) => `生死一线间，${who}心头豁然开朗，竟于战阵之中触机顿悟，出手再无滞涩！`,
  kill: (who: string, enemy: string) => `${who}眼中杀意凛冽，追亡逐北，亲手枭下${enemy}的首级。`,
  lastStand: (who: string) => `${who}横剑当前，独自断后："都走！今日有我无敌！"`,
  guardBreak: (who: string, item: string) => `${who}命悬一线，怀中${item}骤然碎裂，一道宝光替其挡下了夺命一击！`,
  fall: (who: string) => `${who}力竭倒下，再也没能站起来。`,
  injured: (who: string) => `${who}负伤退出战圈，以灵力护住心脉。`,
}
