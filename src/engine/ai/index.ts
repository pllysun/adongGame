// AI 决策内核（docs/09 §2）——领域无关的"做决定"统一入口。
//
// 设计目标：命途抉择、事件加权、功法选择、入峰、师承、战斗目标……所有需要决策的核心都复用这一套，
// 不去硬编 N×M 的系统耦合，而是让每个系统往同一个效用函数里"注册一条考量"。
//
// 用法骨架：
//   const { chosen, ranked } = decide({
//     candidates,                         // 候选项
//     context: (o) => ctxFor(o),          // 每个候选的上下文
//     considerations: (o) => [            // 该候选要权衡的考量（可来自任意系统）
//       { name: '心魔', input: (c) => c.disciple.beliefs.xinmo, curve: pipe(band(0,100), power(2)), weight: 1.5 },
//       { name: '道心', input: (c) => c.disciple.beliefs.daoxin, curve: band(0,100, true) },
//     ],
//     temperature: temperatureFromMindstate(d.mindstate), // 性格决定理性/冲动
//     rng,
//   })
//   // ranked[i].appraisal.terms 即"为什么这么选"，可写进经历树
export * from './curves'
export * from './utility'
export * from './decision'
