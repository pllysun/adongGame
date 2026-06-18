// 姓名生成池：姓 × 双字名（按性别分库），组合空间数千，引擎保证同宗不重名
import type { RNG } from '../core/rng'
import type { Gender } from '@/shared/types'

const SURNAMES = [
  '李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
  '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
  '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎',
  '欧阳', '司徒', '上官', '慕容', '东方', '独孤', '南宫', '司马', '夏侯', '诸葛',
]

const MALE_A = ['青', '云', '玄', '风', '惊', '凌', '天', '元', '浩', '子', '长', '北', '问', '御', '怀', '清', '寒', '逐', '万', '一']
const MALE_B = ['山', '河', '尘', '霄', '鸿', '渊', '阳', '岳', '川', '行', '诀', '鹤', '剑', '澜', '舟', '风', '松', '昭', '衡', '白']
const FEMALE_A = ['芷', '青', '凝', '疏', '玉', '素', '婉', '雪', '语', '清', '画', '月', '霜', '灵', '若', '采', '云', '初', '晚', '听']
const FEMALE_B = ['若', '璇', '霜', '影', '蝉', '心', '宁', '衣', '嫣', '梦', '裳', '华', '容', '犀', '微', '薇', '岚', '晴', '棠', '雨']

export function genName(rng: RNG, gender: Gender, taken: Set<string>): string {
  for (let i = 0; i < 60; i++) {
    const surname = rng.pick(SURNAMES)
    const a = gender === 'm' ? rng.pick(MALE_A) : rng.pick(FEMALE_A)
    const b = gender === 'm' ? rng.pick(MALE_B) : rng.pick(FEMALE_B)
    // 偶尔单字名
    const given = rng.chance(0.18) ? a : a + b
    const name = surname + given
    if (!taken.has(name)) {
      taken.add(name)
      return name
    }
  }
  // 兜底：加序号
  const fallback = rng.pick(SURNAMES) + '无名' + Math.floor(rng.next() * 999)
  taken.add(fallback)
  return fallback
}

// 宗门名与敌对势力名
export const SECT_NAME_PARTS_A = ['青云', '紫霄', '太一', '玄天', '万剑', '丹霞', '碧游', '昆吾', '落霞', '广寒']
export const SECT_NAME_PARTS_B = ['宗', '门', '派', '谷', '阁']

export const ENEMY_SECTS = [
  { id: 'xuanming', name: '玄冥教', flavor: '魔道巨擘，行事狠辣' },
  { id: 'wanshou', name: '万兽山', flavor: '驭兽宗门，与妖共生' },
  { id: 'liehuo', name: '烈火门', flavor: '火修聚集，睚眦必报' },
] as const
