# 《回煞》交互、引导与跨图追逐重构实施计划

> **执行要求：** 在 `codex/2d-rework` 隔离分支内按 TDD 小步实施；每个任务先运行新增验证确认失败，再补最小实现并回归现有验证。

**目标：** 让可交互物一眼可辨、触发目标稳定、关键区域无透明空气墙、低理智画面可读，并把怪物改成“玩家换图后 4 秒从对应门进入、能绕开家具追逐”的公平规则，同时为自由探索补足因果指引。

**架构：** 新增纯函数交互规则和 32 像素网格寻路模块，由 `MapManager` 统一生成交互契约与碰撞信息，`InteractionManager` 只负责候选排序和分发。`ChaseManager` 成为唯一追逐实现，用阶段状态机完成跨图预警、门口生成、现身保护和 BFS 路径跟随。`ObjectiveManager` 输出主目标与当前地图价值两层视图。

**技术栈：** Phaser 3、原生 ES Modules、Node.js `.mjs` 验证脚本、单文件离线构建 `index.html`。

---

## 任务一：建立可测试的交互契约和目标排序

**文件：**
- 新增：`src/systems/InteractionRules.js`
- 新增：`tools/verify_interaction_rules.mjs`
- 修改：`src/entities/Player.js`
- 修改：`src/systems/MapManager.js`
- 修改：`src/systems/InteractionManager.js`
- 修改：`tools/build_standalone_entry.mjs`

先在验证脚本中覆盖：旧对象元数据能补齐 `label/verb/priority/radius/marker/blocksMovement`；玩家面前稍远的剧情物优先于身后更近的普通物；提示格式为“动作：名称  [空格/E]”。运行 `node tools/verify_interaction_rules.mjs` 确认红灯。

实现 `normalizeInteractionMeta()`、`scoreInteractionCandidate()`、`formatInteractionPrompt()`；Player 保存最后有效移动方向；MapManager 为进入交互组的对象挂载标准元数据和可控标记；InteractionManager 按可用性、优先级、朝向和边缘距离稳定选中目标。补齐卧室柜子等缺失契约。运行新验证及 `node tools/verify_maps.mjs`、`node tools/verify_progression.mjs`，确认绿灯后提交。

## 任务二：清理地面噪声、空气墙和持续视觉干扰

**文件：**
- 新增：`tools/verify_scene_readability.mjs`
- 修改：`src/systems/MapManager.js`
- 修改：`src/scenes/GameScene.js`
- 修改：`index.html`（由构建脚本生成）

先验证源码不再按可走格随机生成 `trash_paper`，树木碰撞体缩到树干，小物件不进入阻挡层，低理智不调用 `blur()` 或逐帧随机 `camera.shake`。运行脚本确认红灯。

删除随机纸屑分支；为树干设置 14×28 左右的静态碰撞体并同步；保留明确事件的短促震动，移除低理智持续随机震动；低理智仅使用稳定暗角、饱和度和声音反馈。运行新验证和物理/地图验证，确认绿灯后提交。

## 任务三：把自由探索目标改成“主因果 + 本地价值”

**文件：**
- 修改：`src/systems/ObjectiveManager.js`
- 修改：`src/data/Maps.js`
- 修改：`src/scenes/GameScene.js`
- 修改：`tools/verify_objectives.mjs`

先为目标视图模型补测试：供品阶段列出缺失物及地点；谜题阶段说明入口和前置；每张地图显示 `purpose`，完成独特产出后显示“本区域关键内容已完成”。运行目标验证确认红灯。

实现 `getObjectiveView()`，保留 `getCurrentObjective()` 兼容接口；ObjectiveManager 以两行 DOM 内容呈现主目标和当前区域。审计 18 张地图的 `purpose/rewards` 与真实交互来源一致。运行目标、地图用途和流程验证，确认绿灯后提交。

## 任务四：实现门口安全点和室内 BFS 绕障

**文件：**
- 新增：`src/systems/GridNavigation.js`
- 新增：`tools/verify_grid_navigation.mjs`
- 修改：`src/systems/MapManager.js`
- 修改：`tools/build_standalone_entry.mjs`

先覆盖：墙体不可走、家具投影格不可走、玩家和怪物当前格强制开放；BFS 能绕过桌子；门口生成点距玩家至少 5 格且优先靠近对应门；无安全点时返回空而不是玩家出生点。运行验证确认红灯。

实现 `createNavigationGrid()`、`findGridPath()`、`findSafeDoorSpawn()`、世界坐标/格坐标转换。MapManager 暴露当前家具阻挡矩形给追逐系统。运行新验证及地图/物理验证，确认绿灯后提交。

## 任务五：把跨图追逐改成 4 秒门口到达状态机

**文件：**
- 修改：`src/systems/ChaseManager.js`
- 修改：`src/scenes/GameScene.js`
- 修改：`tools/verify_chase_contract.mjs`
- 新增：`tools/verify_chase_timing.mjs`

先验证时间常量和阶段：0–2 秒等待、2 秒第一次撞门、3 秒脚步/HUD 警告、4 秒生成、0.6 秒现身保护、350ms 重算路径、500ms 无安全点重试；验证 GameScene 不再保留 `spawnChaser/updateChaser`。运行脚本确认红灯。

让 ChaseManager 统一管理场景计时器、门口红光/声音、唯一 pending arrival、怪物实例、抓捕保护和 BFS 路径。换图或 shutdown 自动清理旧计时；新图以 `previousMapId` 锁定对应门。4 秒时若门内没有离玩家 5 格的安全格则每 500ms 重试，绝不刷脸。被抓后在当前地图重开并重新获得 4 秒窗口。删除 GameScene 遗留追逐方法。运行追逐、场景契约、结局与流程验证，确认绿灯后提交。

## 任务六：构建、浏览器验收和技术日志

**文件：**
- 修改：`index.html`
- 修改：`DEV_LOG.md`

运行 `node tools/build_standalone_entry.mjs`，再顺序执行全部 `tools/verify_*.mjs` 与 `node --check`。启动本地服务器做桌面和 390×844 视口验收：走廊没有随机纸屑；相邻交互物提示名称稳定；卧室柜子可用；后院能走到香旁；低理智文字不模糊且镜头不持续抖；追逐换图后有 2/3/4 秒预告并从对应门生成；怪物能绕桌；失败重试不循环抓捕；关键结局入口仍可达。控制台错误必须为 0。

把实际命令、通过数量、浏览器观察、遗留风险和可复用判断写入 `DEV_LOG.md` 的 2026-07-11 条目。最后检查 `git diff --check` 和工作树状态，按验证结果提交。
