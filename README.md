# 问鼎仙途

上帝视角 · 修真宗门模拟器（文字 + 立绘）。

你扮演冥冥中的"天道之手"：创立宗门、招收凡人弟子，看着他们修炼、相爱、争斗、黑化、陨落，一代代传承数百年，最终培养出三位渡劫大能、举宗飞升仙界。玩家不微操每个弟子，而是定规则、分资源、在关键时刻落子——弟子各有自己的"心相"与 AI，会自主做出影响一生的抉择。

- **技术栈**：Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS；桌面端用 Tauri 2 打包。
- **架构核心**：一个**纯 TypeScript 的无头模拟引擎**与 UI 完全分离，引擎可脱离浏览器在 Node 里批量跑仿真。
- **规模**：1008 条事件、九大境界、五轴心相经历树、师徒传承、半涌现"峰"势力系统；196 个单测，引擎逻辑覆盖率 >95%。

完整设计文档在 [`docs/`](docs/)（共 10 篇，从游戏总览到命途系统）。

---

## 快速开始

需要 Node 18+（开发用的是 Node 22）。

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器 → http://localhost:5173
```

浏览器打开后即可游玩：**空格**暂停/继续，**1 / 2 / 3** 切换一倍 / 三倍 / 十倍速；重大事件自动暂停弹窗，次要事件进右侧「事件处理」收件箱异步处理。

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发服务器（热更新） |
| `npm run build` | 生产构建，产物在 `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `npm run typecheck` | 全量 TypeScript 类型检查（`vue-tsc`） |
| `npm run lint` | ESLint（含"引擎纪律"规则，见下） |
| `npm test` | 跑 vitest 单测 |
| `npm test -- --coverage` | 跑测试并出覆盖率（门槛：行/语句 >95%、分支 >85%） |
| `npm run sim -- --years 800 --runs 6` | **无头仿真**：跳过 UI 批量跑模拟，输出平衡报告 |

---

## 目录结构

```
src/
├── engine/                 纯 TS 无头引擎（⛔ 禁止 import vue/pinia，ESLint 强制）
│   ├── core/               时钟 clock / 种子随机 rng / 事件总线 bus
│   ├── state/              世界与弟子的数据构造（world / disciple）
│   ├── content/            ★ 全部游戏内容数据（设计师工作区）
│   │   ├── constants.ts    所有数值常量（改平衡只动这里）
│   │   ├── gongfa / pills / artifacts / facilities / traits / beats / names
│   │   └── events/         事件库（见下文「如何加事件」）
│   ├── systems/            各子系统纯函数（修炼/突破/战斗/经济/心相/师承/峰…）
│   ├── ai/                 角色决策内核（响应曲线 + 效用聚合 + 选择策略）
│   └── index.ts            SimEngine 门面：tick() / command() / save() / on()
├── ui/                     Vue 层（只消费引擎快照，指令统一走 command()）
│   ├── stores/             Pinia：只存"视图快照"，不存世界状态本体
│   ├── views/              屏幕级组件（总览/名册/详情/设施/藏经阁/规则/编年史…）
│   ├── components/         立绘合成、事件流、经历树、各类弹窗
│   └── theme/              颜色 token、字体
├── headless/               无头运行器 + 自动玩家（仿真与回归用）
└── shared/                 跨层类型与稀有度常量
tests/                      vitest 单测（24 个文件）
docs/                       设计文档 00~09
src-tauri/                  Tauri 桌面打包配置
```

---

## 架构必须遵守的三条纪律

继续开发前请务必理解，否则容易踩坑：

1. **引擎与 UI 单向分离**：`src/engine/` 内禁止 `import vue / pinia / @/ui`（ESLint 会报错）。引擎只产出数据；UI 只读快照、发指令。
2. **一切随机走种子 RNG**：引擎内禁止 `Math.random()` 和 `Date.now()`（ESLint 强制）。用 `core/rng.ts`。这样「同存档 + 同操作 = 同结果」，仿真可复现、回归可测。
3. **指令 + 快照模式**：UI 永不直接改世界状态——所有修改经 `engine.command(...)`；UI 通过 `engine.getSnapshot()` 拿浅拷贝切片渲染。

---

## 如何继续开发

绝大多数"加内容"的工作都在 `src/engine/content/` 改数据文件，**不碰引擎逻辑**。

### 1. 加事件（最常见）

事件分两层（详见 [`docs/04-事件系统.md`](docs/04-事件系统.md) 与项目记忆约定）：

- **有后果的事件**（命途 / 危机 / 经营 / 战略 / 人事）：手写在 `events/` 下的 `opportunity.ts`、`crisis.ts`、`personnel.ts`、`strategy.ts`、`mingtu.ts`、`chains.ts`、`misc.ts`。这类**可以写心相轴**（道心/心魔/魔倾/忠诚/声名），用固定密度抽签。一个事件 = 一个 `EventDef` 对象（`trigger` 触发条件、`cast` 角色槽选角、`options` 选项与 `effects`）。
- **风味事件**（只织事件流纹理、不改命运）：用 `flavor.ts` 的 `makeFlavor(前缀, 种子[])` 工厂，从极简 DSL 批量生成，分八个 `pack_*.ts`（日常/江湖/情感/灵异/灾厄/心境/庶务/外事）。**风味事件不写心相轴**，走独立抽签预算，不挤占有后果事件的密度。
  加一条风味只需在对应 pack 数组里加一行种子，例如：
  ```ts
  { t: '夜半抚琴', v: ['{d}于月下抚琴一曲，心境通明。', '{d}的琴声引来山鸟驻足。'], e: 'm5 R' }
  // t=标题  v=文案变体（{d}/{a}/{b} 自动替换弟子名）  e=效果码(m心境 s灵石 R留传记…)
  ```

无论哪种，新事件都要在 [`events/index.ts`](src/engine/content/events/index.ts) 里注册。

### 2. 改数值平衡

所有可调数值集中在 [`content/constants.ts`](src/engine/content/constants.ts)（突破概率矩阵、修为增速、寿元、经济、事件密度…）。**改完必须跑仿真回归**：

```bash
npm run sim -- --years 800 --runs 6
```

它会用"自动玩家"跑多局数百年，输出灭门率、各境界首达年代、资质→最高境界分布、心相/师承/峰的统计——据此判断平衡是否破坏。

### 3. 加功法 / 丹药 / 法宝 / 特质 / 设施

各是一个数据文件：`gongfa.ts`、`pills.ts`、`artifacts.ts`、`traits.ts`、`facilities.ts`。照已有条目的结构加一项即可，引擎自动识别。稀有度统一七阶（白绿蓝紫金红彩），颜色与等级名一一对应，见 `shared/rarity.ts`。

### 4. 加 / 改子系统逻辑

`src/engine/systems/` 一个文件一系统，都是纯函数 `(world, rng) => void`，挂在不同结算周期（日/旬/月/年），由 `engine/index.ts` 的 `tick()` 统一调度。命途相关：`psyche.ts`（五轴心相）、`biography.ts`（经历树/记忆）、`character-ai.ts`（角色自主抉择）、`omens.ts`（征兆窗口）、`lineage.ts`（师徒传承）、`peaks.ts`（峰系统）。决策都走 `ai/decision.ts` 的统一效用接口。

### 5. UI 开发

`src/ui/views/` 一个屏幕一个 `.vue`，从 `stores/game.ts` 读快照。新增屏幕：建 view → 在 `MainLayout.vue` 挂上导航。立绘是程序化纸娃娃（`components/Portrait.vue`，按弟子种子分层组合 SVG），无需美术资源也能跑。

### 6. 测试要求（提交前请保证绿）

```bash
npm run typecheck && npm run lint && npm test
```

引擎逻辑覆盖率门槛写在 `vite.config.ts`（行/语句 >95%、分支 >85%）。新增系统函数请直接写单测驱动（见 `tests/coverage-restore.test.ts` 的写法——**不要依赖仿真恰好抽中**来覆盖，因为加事件会改 RNG 轨迹）；新增事件由 `tests/events-exhaustive.test.ts` 自动遍历点火覆盖。

---

## 打包桌面版（Tauri 2，可选）

需要 Rust 工具链（macOS：`brew install rust`；Windows：rustup + VS Build Tools）。

```bash
cargo install tauri-cli --version "^2"
npm run build
cargo tauri build      # 产出 .dmg（macOS）/ .exe 安装包（Windows）
```

`src-tauri/` 配置已就绪（窗口 1440×900）。打包前需在 `src-tauri/icons/` 放置应用图标。

---

## 设计文档导航

| 文档 | 内容 |
|------|------|
| [00 游戏总览](docs/00-游戏总览.md) | 定位、三支柱、核心循环、胜负条件 |
| [01 弟子系统](docs/01-弟子系统.md) | 资质/灵根/悟性/心性/气运、性格特质、关系网 |
| [02 修炼与境界](docs/02-修炼与境界.md) | 九境、修为模型、突破公式、天劫、寿元 |
| [03 宗门经营](docs/03-宗门经营.md) | 资源、设施、招收、职位、规则 |
| [04 事件系统](docs/04-事件系统.md) | 数据结构、条件/效果 DSL、事件链、两层事件约定 |
| [05 战斗系统](docs/05-战斗系统.md) | 战力模型、自动结算、节拍战报、天劫战 |
| [06 界面与立绘](docs/06-界面与立绘.md) | 界面布局、屏幕清单、纸娃娃规格、编年史 |
| [07 技术架构](docs/07-技术架构.md) | 引擎/UI 分离、tick 模型、存档、无头验证 |
| [08 开发路线图](docs/08-开发路线图.md) | 里程碑 M0~M7、风险清单 |
| [09 命途与师承](docs/09-命途与师承.md) | 心相轴、经历树、角色 AI、师徒、峰系统 |

---

## 给后续开发者的一句话

> 内容（事件/功法/丹药/数值）改 `engine/content/` 的数据文件；玩法逻辑改 `engine/systems/`；界面改 `ui/`。改完跑 `typecheck + lint + test`，动了数值再跑 `npm run sim` 看平衡。引擎不许碰 Vue、不许用真随机——守住这两条，就不会把模拟器写崩。
