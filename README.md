# 🏮 回煞 (Return of the Soul)

> **“头七回魂夜，生人勿近。”**

暴雨如注的七月十四，你误入了一座荒废已久的古宅。
灵堂之上，遗像被黑布遮盖；棺材之中，似有指甲抓挠之声。
你以为这只是避雨之地，却不知早已踏入了一个名为“家”的囚笼。

寻找供品，点燃尸油蜡烛，揭开那段尘封的血色往事。
但要小心……它，回来了。

**🤫 嘘！别出声！它在听……**

---

## ✨ 游戏特色

- 🕯️ **中式民俗恐怖**：纸人、棺材、冥币、牌位……还原最真实的童年阴影。
- 🔦 **沉浸式光影探索**：在伸手不见五指的黑暗中，你唯一能依靠的只有手中那束微弱的手电筒光。
- 🎙️ **创新“声控”躲藏**：屏住呼吸！游戏将调用你的麦克风，现实中的任何声响都可能引来怪物的追杀。
- 🧩 **碎片化叙事**：通过日记、遗书和奇怪的道具，拼凑出一个关于“爱与控制”的悲剧真相。

---

## 🎮 游戏操作

### 💻 电脑端
- **移动**: `W`, `A`, `S`, `D` 或 `方向键`
- **交互/调查**: `空格键 (Space)` 或 `E` 键
- **鼠标**: 点击屏幕上的按钮也可进行交互

### 📱 移动端
- **移动**: 左下角虚拟摇杆
- **交互**: 右下角“查”字按钮
- **横屏体验**: 建议在手机浏览器中开启“自动旋转”并横屏游玩，获得最佳沉浸感。

## 🕹️ 游戏目标
你需要扮演一名迷路的人，在雨夜中误入一间诡异的灵堂。
通过探索环境、收集物品（火柴、贡品），解开灵堂的秘密，并最终揭开故事的真相。

## 🚀 快速开始 (推荐)
直接双击运行目录下的 `StartGame.bat` 即可自动启动服务器并打开游戏。

## 🧪 3D 原型
标题页新增了“进入 3D 原型”入口，也可以直接访问 `prototype3d.html`。当前 3D 版本是第一阶段原型：保留 2D 主线不变，只提供正厅与走廊小段的 Three.js 低模探索、基础移动、目标提示、物件调查和返回标题。

标题页同时提供“进入次世代视觉线”入口，也可直接访问 `aaa3d.html`。这条线独立保留原型作为可回归基线，已加入物理材质、电影化色调映射、软阴影、动态烛光、手电筒、灰尘、体积氛围、细化木构与重新三维化的供桌/棺材。Build 03 进一步完成实体封门、横木卡座、合页/门环、暗腔门缝、定向漏光和近门曝光控制，并通过匿名 A/B 与三机位核验；它仍是持续迭代的视觉纵切片，不代表整个游戏已经达到商业 3A 内容规模。

当前可试玩预览为 **Dynamic VFX Build 04**。启动本地服务后访问 `http://localhost:8000/aaa3d.html`，可用 WASD 在正厅和走廊移动、鼠标观察、靠近物件后按 E 调查，并按左上角目标依次检查供桌、棺材、黑布相框和走廊封门。该版本已完成移动、碰撞、交互提示、调查对白和目标 HUD 的自动试玩烟测；试玩纵切片可用，不等同于完整剧情版或商业 3A 发布候选。

3D 美术不建议直接在代码里硬搓。后续生成老宅场景、贴图和道具参考时，优先使用 `docs/3D_ART_PROMPTS.md` 里的完整提示词包。

`美术/` 是 3D 源素材库。当前原型已直接引用 `木墙.png`、`木地板.png`、`木梁.png`、`供桌区域.png`、`走廊墙面.png` 和 `纸钱与香灰.png`；其他素材先作为后续抠图、低模贴片或道具参考保留。

## 🛠️ 本地运行 (手动)
如果你想手动运行：
1. 右键点击 `server.ps1`，选择“使用 PowerShell 运行”。
2. 浏览器访问 `http://localhost:8000`。

## 🧰 维护说明
`index.html` 是可直接打开的单文件入口，源码仍以 `src` 目录为准。修改 `src` 后运行 `node tools\build_standalone_entry.mjs` 同步入口页，再运行 `node tools\verify_standalone_entry.mjs` 检查是否仍然适合本地双击启动。修改 3D 原型后，至少运行 `node tools\verify_3d_prototype.mjs` 和 `node tools\verify_3d_interaction_flow.mjs`；修改次世代视觉线后运行 `node tools\verify_aaa_line.mjs`。匿名 A/B 包可用 `node tools\build_visual_blind_test.mjs --seed=20260809` 重新生成。

次世代线的可玩链路可用 `tools/smoke_aaa_playable.cjs` 回归：它会验证 W 移动、棺材交互提示、E 调查对白，并把证据截图写到 `artifacts/visual-qa/v4-playable-smoke.png`。脚本依赖工作区自带的 Playwright 运行时；普通系统 Node 找不到该依赖时，应改用 Codex 工作区依赖中的 Node 和 `NODE_PATH`，不要在项目里临时安装一套重复依赖。

次世代线固定视觉核验机位可通过 `aaa3d.html?capture=hero|altar|angle|corridor|doorLock|doorCrack` 调用。正式截图应从本地 HTTP 地址打开；直接用 `file://` 启动无头浏览器时，纹理可能因本地资源策略未加载，生成的平涂画面不能进入盲测样本。

## 📦 部署与分享
本项目为纯静态网页，推荐使用以下方式分享给朋友：

### 1. Netlify Drop (最快，无需注册)
- 访问 [Netlify Drop](https://app.netlify.com/drop)。
- 将项目根目录中的静态文件拖入网页，核心文件包括 `index.html`、`src/` 和 `phaser.min.js`。
- **注意**：如果不登录账号，生成的链接有效期仅为 **24小时**。
- **永久保存**：在该页面注册/登录 Netlify 账号并“认领”该站点，链接即可永久有效。

### 2. GitHub Pages (永久，适合开发者)
- 将项目上传至 GitHub 仓库。
- 在仓库 Settings -> Pages 中开启服务。
- 链接永久有效。

### 3. Vercel (永久，速度快)
- 注册 Vercel 账号并关联 GitHub 仓库即可自动部署。

## 📁 项目结构

```txt
.
├── index.html
├── phaser.min.js
├── prototype3d.html
├── aaa3d.html
├── vendor
├── StartGame.bat
├── server.ps1
├── src
│   ├── data
│   ├── 3d
│   ├── aaa
│   ├── entities
│   ├── scenes
│   └── systems
├── tools
├── docs
├── STORY.md
├── ROADMAP.md
└── DEV_LOG.md
```

## 📚 文档

- [剧情草案](STORY.md)
- [路线图](ROADMAP.md)
- [开发日志](DEV_LOG.md)
- [游戏流程梳理](docs/GAME_FLOW.md)
- [3D 美术生成提示词包](docs/3D_ART_PROMPTS.md)
- [3A 视觉盲测核验量表](docs/AAA_VISUAL_QA.md)
- [3A 视觉线生产路线图](docs/AAA_PRODUCTION_ROADMAP.md)
- [扩展设计文档](docs/superpowers/specs/2026-04-29-huisha-multi-ending-expansion-design.md)

## 📄 许可证

本项目使用 MIT License，详见 [LICENSE](LICENSE)。
