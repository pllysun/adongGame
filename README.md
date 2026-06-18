# 问鼎仙途

上帝视角修真宗门模拟器（文字 + 立绘）。创立宗门、招收弟子、看着他们修炼、相爱、争斗、陨落，
一代代传承数百年，培养出三位渡劫大能后举宗飞升。

完整设计文档见 [docs/](docs/00-游戏总览.md)。

## 开发

```bash
npm install
npm run dev        # 浏览器开发（http://localhost:5173）
npm test           # vitest 引擎单测
npm run typecheck  # vue-tsc 全量类型检查
npm run lint       # ESLint（引擎纪律：禁 UI 依赖 / Math.random / Date.now）
```

## 无头数值验证（docs/07 §6）

```bash
npm run sim -- --years 800 --runs 6 --seed mybase
```

跳过 UI 批量跑模拟，输出灭门率、各境界首达年代、资质→最高境界分布。
**改 `src/engine/content/constants.ts` 里的数值后必须跑回归。**

## 桌面打包（Tauri 2）

需要 Rust 工具链（macOS: `brew install rust`；Windows: rustup + VS Build Tools）：

```bash
cargo install tauri-cli --version "^2"
npm run build
cargo tauri build        # 产出 .dmg（macOS）/ .exe 安装包（Windows）
```

`src-tauri/` 配置已就绪（窗口 1440×900，bundle 目标 dmg+nsis）。
打包前需在 `src-tauri/icons/` 放置应用图标（icon.icns / icon.ico / icon.png）。
Windows 机器上克隆本仓库执行同样命令即可出 Windows 安装包。

## 架构速览（docs/07）

```
src/engine/    纯 TS 无头模拟引擎（禁 import vue/pinia，ESLint 强制）
  content/     全部游戏内容数据：功法/丹药/特质/事件/节拍/常量 —— 设计师工作区
  systems/     修炼/突破/行为/关系/心境/经济/生命周期/事件/战斗
  index.ts     SimEngine 门面：tick() / command() / save() / on()
src/ui/        Vue 3 层：只消费引擎快照（structuredClone 节流），指令走 command()
src/headless/  无头运行器 + 自动玩家（数值回归的"标准玩家"）
tests/         vitest：确定性/突破矩阵/战斗曲线/事件完整性/百年不变量
```

## 操作

- 空格 = 暂停/继续；1/2/3 = 一倍/三倍/十倍速
- 重大事件自动暂停弹窗；右侧事件流点击查看小事件
- 弟子名册点击任意弟子 → 详情页可赐丹药/法宝/传功法/任免
