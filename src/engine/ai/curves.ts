// 响应曲线（docs/09 §2）：把任意原始数值（心魔 0~100、关系 -100~100、战力比……）映射到 [0,1] 的"考量值"。
// 调一条曲线就能调一个考量的手感，是效用 AI 可作者化的关键（参《Behavioral Mathematics for Game AI》）。
// 纯函数、确定性，禁用随机与真实时间。

export type Curve = (x: number) => number

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x)

/** 恒定值 */
export function constant(v: number): Curve {
  const c = clamp01(v)
  return () => c
}

/** 线性：clamp01(slope·x + intercept) */
export function linear(slope = 1, intercept = 0): Curve {
  return (x) => clamp01(slope * x + intercept)
}

/**
 * 区间归一化：把原始值从 [min,max] 线性映射到 [0,1]。
 * 把"心魔 0~100""战力比 0~3"这类原始量纲拉直成考量值，最常用。
 */
export function band(min: number, max: number, invert = false): Curve {
  const span = max - min || 1
  return (x) => {
    const t = clamp01((x - min) / span)
    return invert ? 1 - t : t
  }
}

/**
 * 幂曲线（输入须已在 [0,1]）：exp>1 凸（高位才显著）、exp<1 凹（低位即敏感）。
 * 常与 band 复合：pipe(band(0,100), power(2)) —— 心魔越高、考量加速上扬。
 */
export function power(exp = 2): Curve {
  return (x) => clamp01(Math.pow(clamp01(x), exp))
}

/** 逻辑斯蒂 S 曲线：mid 为拐点，k 控陡峭。适合"过了某阈值才急剧在意"。 */
export function logistic(k = 8, mid = 0.5): Curve {
  return (x) => clamp01(1 / (1 + Math.exp(-k * (x - mid))))
}

/** 阶跃：x≥threshold 取 above，否则 below。门控型考量（如"必须 ≥金丹"）。 */
export function step(threshold: number, above = 1, below = 0): Curve {
  return (x) => (x >= threshold ? clamp01(above) : clamp01(below))
}

/** 取反：1 - curve(x)。把"越高越好"翻成"越高越避"。 */
export function inverse(curve: Curve): Curve {
  return (x) => clamp01(1 - curve(x))
}

/** 复合：从左到右依次应用，前一条的输出作下一条的输入。 */
export function pipe(...curves: Curve[]): Curve {
  return (x) => curves.reduce((v, c) => c(v), x)
}

export const Curves = { constant, linear, band, power, logistic, step, inverse, pipe, clamp01, clamp }
