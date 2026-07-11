# 开发日志

## 2026-07-11

确认项目停止 3D 产品路线，回到 Phaser 2D 主线继续迭代。只删除本地 Git 分支并不能下线 3D，因为 `codex/3d-prototype-entry` 已经合入 `main`，后续五个提交也继续扩展了 3D。已确定采用“产品清退、资产归档、不重写历史”的边界：实现阶段将移除 3D 页面、Three.js、`src/3d/`、相关验证和标题入口，把 `美术/` 与 3D 历史设计资料迁移到 `archive/3d/`，保留提交历史和本日志中的历史记录。

本轮只读审计确认，现有六项验证虽然全部通过，但没有覆盖玩家实际反馈集中的行为。已证实的问题包括：`Player.update()` 在判断冲刺前先清零速度，导致 Shift 冲刺永远不能成立；`GameScene.initJoystick()` 每次换房都向持久 DOM 累积匿名监听器；父母衣柜移动及状态恢复后没有同步静态碰撞体；理智消耗按帧而非按时间计算；正常标题入口创建的 `SoundManager` 长期持有 `TitleScene`，空间音效会失去玩家引用。浏览器烟测还确认室内记忆地图持续生成雨粒子，现有测试对此没有约束。

流程审计确认“坐牢”和“无新意”不是单一文案问题：学校、医院记忆可以直接摸终点返回，车祸记忆可以跳过调查直达选择，四张走廊照片设置的 `corridorSolved` 没有实际后果，追逐一旦开始会长期跨房间持续，低线索开棺还可能自动进入“永远在一起”。这些问题共同造成目标不清、跑图冗长、失败惩罚过重和结局缺少解释。

已完成并由老板确认新的设计文档 `docs/superpowers/specs/2026-07-11-huisha-2d-rework-design.md`。方向是保留现有地图和美术底座，新增轻量目标提示、学校试卷排序、医院证据链、走廊全家福与短追逐反制，并把四结局收束为统一纯函数路由。剧情正史统一为“十年前车祸，十周年忌夜被老宅执念拉回记忆循环”；母亲先有自伤未遂、后来投井，避免现有对白和母稿互相矛盾。实现必须采用测试先行，并补足玩家路径、碰撞同步、帧率独立、移动端生命周期和结局可达性的验证。

老板复核设计时补充了新的硬标准：每张地图都必须有用，尤其要解决地下室让玩家迷惑的问题。设计稿因此新增地图用途契约，要求 `Maps.js` 的 18 张地图都声明 `purpose` 与 `rewards`，并至少提供一种独特推进或叙事产出。地下室保留原 ID 但改为 18×14 的“地下禁闭室”，删除假岔路和空地，用连续光源标出返程；走廊四张照片先组成残缺全家福，地下室提供缺角与锁门证据，两者合并后才开放完整真相路线。以后新增地图也必须通过用途与可达性检查，不能再用纯跑图空间稀释流程。

## 2026-07-05

继续推进 3D 原型从“能看能走”走向“有短流程可验收”。本轮新增 `prototype3d.html` 里的目标 HUD，并把目标配置沉到 `src/3d/ThreeHouseMap.js`：初始目标要求调查供桌、棺材和黑布相框；三件正厅物品都调查后，目标会切到沿走廊调查尽头封门；封门调查完成后，目标标记为完成并提示返回正厅。这样后续扩 3D 章节时，可以继续把阶段目标放在地图数据里，而不是散落在页面文案和交互代码中。

`src/3d/ThreeInteraction.js` 现在会记录 `visited` 调查集合，按 E 调查时写入状态、弹出对白、刷新目标提示；靠近已调查物时，底部交互提示会追加“已调查”，避免玩家不知道刚才有没有触发成功。`src/3d/ThreePrototypeScene.js` 只负责把目标面板节点传给交互层，保持场景搭建和流程状态分离。

验证侧新增并增强了两层保障：`tools/verify_3d_prototype.mjs` 现在会检查 3D 页面存在目标面板、地图存在 objective 流程配置、场景把 objective 传入交互层、交互层有已调查集合和完成态；新增 `tools/verify_3d_interaction_flow.mjs` 用假窗口和假 DOM 直接执行 `ThreeInteraction.js`，覆盖“供桌 -> 棺材 -> 黑布相框 -> 尽头封门”的完整目标推进。浏览器验证使用本地静态服务 `http://127.0.0.1:8125/prototype3d.html`，确认页面能打开、canvas 存在、目标 HUD 初始化正常，控制台只有 Three.js 全局脚本弃用警告；移动端 390x844 断言目标面板不溢出，也不与返回按钮、底部提示或操作说明重叠。

## 2026-07-04

确认下一步 3D 化方向采用第一阶段 A 方案：在现有项目里新增可玩的 3D 原型入口，先覆盖正厅与走廊小段，并保留当前 Phaser 2D 主流程不受影响。已新增设计文档 `docs/superpowers/specs/2026-07-04-huisha-3d-prototype-design.md`，明确本阶段不做完整 3D 资产、不迁移全地图、不重写剧情状态机，而是先用 Three.js 或等价 WebGL 方案验证 3D 手感、灯光、基础交互和返回标题链路。

本次特别把老板的“自动 git / 推 GitHub”列入完成标准：实现完成后必须跑现有验证脚本、必要时重建单文件入口，再提交并推送到 `origin/main`。此前 GitHub 已提示旧远端 `huihun_game_AI` 迁移到 `huisha_game_AI`，本地 `origin` 已更新为 `https://github.com/huachen19867/huisha_game_AI.git`，后续推送应直接走新地址。

完成了第一版 3D 原型入口实现。新增 `prototype3d.html`、`vendor/three.min.js`、`src/3d/ThreeHouseMap.js`、`src/3d/ThreeControls.js`、`src/3d/ThreeInteraction.js` 和 `src/3d/ThreePrototypeScene.js`，标题页 `TitleScene` 增加“进入 3D 原型”选项，默认 2D 主线仍由空格或“开始 2D 主线”进入。3D 原型采用本地 Three.js 普通脚本而不是模块导入，原因是当前项目需要保留 `index.html` 的单文件直开能力；3D 页面独立加载本地脚本，不干扰 Phaser 主包。

新增 `tools/verify_3d_prototype.mjs`，先验证过缺少 `prototype3d.html` 时会失败，再补齐实现使其通过；同时增强 `tools/verify_standalone_entry.mjs`，要求生成后的 `index.html` 包含 `prototype3d.html` 入口。实现后已运行 `node tools\build_standalone_entry.mjs` 同步单文件入口，后续任何改动 `TitleScene` 的操作都要记得同步构建，否则双击入口看不到最新按钮。

3D 渲染器开启了 `preserveDrawingBuffer`，主要服务于后续自动化 smoke test：可以直接从 canvas 读取像素，判断 WebGL 画面不是空白。当前原型场景很小，这个配置的性能代价可接受；等 3D 版本进入正式内容量级时再重新评估。

收到老板对第一版 3D 原型的反馈：画面过暗、碰撞不稳、环境装饰一般。进一步确认美术生产方式不能靠代码里硬搓几何体，而应先提供稳定的一键复制提示词，让老板生成统一风格的场景概念图、贴图素材和道具参考，再由代码侧负责空间、碰撞、光照承载和素材接入。已新增 `docs/3D_ART_PROMPTS.md`，每条提示词都包含统一风格、场景变量、材质要求、构图和负面限制，不需要二次手动拼接前缀。

推进了 3D 原型第二版的第一轮实装。老板把生成素材放入 `美术/` 后，本轮没有改动源素材原件，而是直接从 3D 页面引用 `木墙.png`、`木地板.png`、`木梁.png`、`供桌区域.png`、`走廊墙面.png` 和 `纸钱与香灰.png`：墙、地板和梁作为真实 Three.js 材质，供桌区域和走廊墙面作为局部环境板，纸钱香灰作为低透明度地面脏迹。黄符、香炉、烛、红绳等素材暂时只入库为源素材，原因是部分图带背景或需要抠图，直接贴进 3D 会穿帮。

碰撞系统从“只判断可走矩形”升级为“玩家半径 + 障碍矩形 + 轴向滑动”。`ThreeHouseMap.js` 新增 `playerRadius` 和供桌、棺材、椅子、柱子的 obstacle 数据；`ThreeControls.js` 新增 `canOccupy()` 和 `collidesWithObstacle()`，正面撞到棺材或供桌会停住，斜向移动仍能沿可走轴滑动。画面可读性方面，降低了雾和暗角强度，把 HUD 提到 vignette 之上，并提高 Three.js 曝光、环境光和路径补光；后续继续调美术时要优先保持“看得清主要路径和交互物”，再压恐怖氛围。

继续接入第二批 3D 源素材。`ThreePrototypeScene.js` 现在会加载 `相框.png`、`香炉.png`、`烛.png`、`红绳.png`、`椅子.png` 和 `棺材区域.png`，分别作为遗像相框、供桌香炉、左右烛光、棺材红绳/棺材细节、椅子近景的 art plane 使用。这个阶段仍然是“源素材贴片增强”，不是最终美术：带深色背景的素材适合直接混入暗场景，带棋盘底或强透视的素材后续若要更自然，应单独做透明抠图、billboard 版本或低模重建。

把走廊从单纯可走小段推进成第二段可调查空间。`ThreeHouseMap.js` 新增 `corridor_midpoint` 和 `corridor_end_door` 两个交互点，分别承接“墙里的脚步”和“尽头封门”；`ThreePrototypeScene.js` 新增 `走廊全景.png` 作为 `corridor-end-art-plane`，并增加 `corridorGuideLight` 和门缝红光，让玩家从正厅穿过棺材后有明确的冷色引导和尽头目标。浏览器烟测中直接把玩家放到 `z=-10.95`，确认提示文案为“按 E 调查尽头封门”，按 E 能打开“尽头封门”对白。

## 2026-07-04

梳理了一次《回煞》当前版本的完整游戏流程，并沉淀到 `docs/GAME_FLOW.md`。这次没有改玩法代码，重点是把源码里的实际路由、地图拓扑、供品链、记忆链和多结局判定统一成一份可维护说明，避免后续只凭 `STORY.md` 的剧情稿或旧设计文档判断实现状态。

本次读取的关键文件包括 `src/scenes/TitleScene.js`、`src/scenes/IntroScene.js`、`src/scenes/GameScene.js`、`src/systems/InteractionManager.js`、`src/systems/MapManager.js`、`src/systems/StoryState.js`、`src/data/Maps.js` 和 `docs/superpowers/specs/2026-04-29-huisha-multi-ending-expansion-design.md`。以后再查游戏流程，可以优先看 `docs/GAME_FLOW.md`：入口链路是 `BootScene -> TitleScene -> IntroScene -> GameScene`，调试直达由 `StartRoute.js` 支持；真相层级由 `StoryState.getTruthLevel()` 判定，`surface / family / complete` 分别对应低线索、中线索和完整真相。

这次复盘出的关键判断是：当前结局不是单一路径。`room_entrance` 的 `exit_door` 会按真相层级直接触发“破茧 / 回煞 / 进入车祸记忆”，但黑布遗像触发 `doorSlammed` 后，正厅回大门的普通门会锁住，因此它更像一个早退或特殊路由入口；另一套主线高潮是供品仪式加血红钥匙开棺，线索完整时进 `memory_crash`，否则进 `room_memory`。后续如果要精修流程，需先确认“出口分支”是保留为早退结局，还是要让玩家在锁门后也能明确回到该离开选择。

为了维护索引，已在 `README.md` 的文档列表里增加 `docs/GAME_FLOW.md` 链接。验证方式采用现有轻量脚本即可：`node tools\verify_story_state.mjs`、`node tools\verify_maps.mjs`、`node tools\verify_start_route.mjs`；如果后续同步单文件入口，还需要先跑 `node tools\build_standalone_entry.mjs`，再跑 `node tools\verify_standalone_entry.mjs`。

## 2026-06-21

核查了一次“最新版本是否已经自动推到 GitHub”。当前工作区 `C:\AI\游戏开发\回煞` 不是 Git 仓库，`git status --short --branch`、`git remote -v`、`git log --oneline --decorate --graph -n 10` 和 `git branch -vv` 都返回 `fatal: not a git repository`；递归查找 `.git` 目录也为空，因此本地没有可用于判断或执行推送的 Git 历史和远端配置。

同时查了部署相关说明与自动化痕迹：项目里没有 `.github` 目录，未发现 GitHub Actions 工作流；README 里的“GitHub Pages”和“Vercel”只是部署建议，其中 Vercel 的自动部署前提是先有关联的 GitHub 仓库。结论是：以当前这份工作区来看，最新版本没有自动推到 GitHub。后续如果要接入版本历史与自动部署，需要先初始化或关联 Git 仓库，再设置 GitHub remote、提交当前版本，并按需配置 GitHub Pages / Vercel / Actions。

老板随后提供了旧仓库 `https://github.com/huachen19867/huihun_game_AI`。只读核查显示该仓库存在，默认分支为 `main`，当前远端 HEAD 是 `8b1efde4f799fc19be9c93cbb523c669cf0f7f7e`，提交信息为 `Polish repository for open-source maintenance`，提交时间是 2026-05-31 19:18 +0800。把远端临时浅克隆后与当前本地目录按相对路径和 SHA256 哈希比对，结论是远端保留的是旧版本：本地共有 36 个文件，远端共有 22 个文件；本地独有 17 个文件，包括 `src\systems\StartRoute.js`、`src\systems\StoryState.js`、`tools\build_standalone_entry.mjs` 和多份 `tools\verify_*.mjs`；远端独有 `.gitignore`、`.nojekyll`、`LICENSE`；共有但内容不同的核心文件包括 `index.html`、`README.md`、`ROADMAP.md`、`server.ps1`、`src\data\Maps.js`、`src\scenes\GameScene.js`、`src\systems\InteractionManager.js`、`src\systems\MapManager.js`、`src\systems\TextureGenerator.js` 等。因此准确判断是：以前传过 GitHub，但当前 6 月更新后的最新本地版本尚未同步到该仓库。

执行同步时保留远端历史而不是强推覆盖：先在当前目录 `git init -b main`，添加 `origin`，`git fetch origin main`，再用 `git reset --mixed origin/main` 让本地分支接到远端旧 HEAD，同时保留当前工作区文件；随后补回远端原有 `.gitignore`、`.nojekyll` 和 `LICENSE`。提交前发现 `.superpowers/` 是本地过程文件、`Huisha_Game.zip` 是 2026-02 的旧包，不能代表当前版本，所以加入 `.gitignore` 保留在本地但不入库；README 的 Netlify Drop 说明也改为上传项目静态文件，避免公开仓库指向旧压缩包。

提交前验证命令为：`node tools\build_standalone_entry.mjs`、`node tools\verify_standalone_entry.mjs`、`node tools\verify_story_state.mjs`、`node tools\verify_maps.mjs`、`node tools\verify_start_route.mjs`、18 个源码和工具文件的 `node --check`，以及 `git diff --cached --check`。其中 `git diff --cached --check` 最初抓到大量行尾空白和 `index.html` 的 CRLF/LF 混合换行，已通过机械清理行尾空白、统一本次提交文本文件为 LF、重新生成入口页后解决。主同步提交为 `1d3955cb2ee7f1b69ce8f6443039ca6430e7f9dc`，提交信息 `Sync latest multi-ending game build`，已成功推送到 GitHub `main`，远端从 `8b1efde` 快进到 `1d3955c`。

## 2026-06-09

修复了一次“点开后黑屏，只显示 `Resource Load Error / Failed to load: undefined`”的启动问题。定位时先用本地 Node 静态服务打开 `http://127.0.0.1:8000/`，标题页和点击进入序章都正常，说明资源本身没有缺；再结合截图和入口代码判断，根因是直接双击 `index.html` 时，浏览器会阻止本地 `file://` 页面里的 ES module 继续 `import ./src/...`，原来的通用资源错误兜底又没有拿到具体 `src`，所以只显示 `undefined`。

本次处理方式是保留 `src` 源码作为维护入口，新增 `tools/build_standalone_entry.mjs` 把场景、系统和地图数据按依赖顺序内嵌到 `index.html` 的唯一 `type="module"` 脚本里，并新增 `tools/verify_standalone_entry.mjs` 防止入口页再次出现运行时静态导入或动态导入。`GameScene.js` 里原先懒加载 `SoundManager` 的 `import('../systems/SoundManager.js')` 也改成静态依赖，否则单文件入口仍然可能在直达场景时踩同一类坑。以后改完 `src` 后如果需要同步可双击入口，运行 `node tools\build_standalone_entry.mjs`，再跑 `node tools\verify_standalone_entry.mjs`。

验证结果：`node tools\verify_standalone_entry.mjs`、`node tools\verify_story_state.mjs`、`node tools\verify_maps.mjs`、`node tools\verify_start_route.mjs` 均通过，`node --check src\scenes\GameScene.js`、`node --check tools\build_standalone_entry.mjs`、`node --check tools\verify_standalone_entry.mjs` 均通过。浏览器用本地服务重新加载生成后的入口页，确认 `index.html` 不再含运行时导入，标题页能显示，点击后能进入序章对白，控制台错误和警告为空。

## 2026-05-01

继续做了一轮一小时冲刺，目标是把新增多结局内容从“能静态通过”推进到“能更快验收、视觉上能区分、直达地图不会炸”。先把新记忆地图的视觉调性写进契约：`memory_school`、`memory_hospital`、`memory_crash` 现在都带有 `visual` 配置，`MapManager.js` 会按地图设置环境光、地面 tint、墙体 tint 和纸屑 tint。学校记忆偏昏黄压抑，医院记忆偏惨白冷色，车祸记忆偏蓝黑雨夜，至少不再像同一间房换了个名字。

为了减少后续验收成本，新增了 `src/systems/StartRoute.js` 和 `tools/verify_start_route.mjs`。现在可以用 `http://127.0.0.1:8000/?map=memory_school`、`?map=memory_hospital`、`?map=memory_crash` 这类地址从标题页直接跳到指定地图；如果带 `x`、`y` 参数，也会使用指定出生点。测试时先发现 `URLSearchParams.get()` 返回 `null` 被 `Number(null)` 变成 0，导致没写坐标也会从 (0,0) 出生，已经改成只有显式提供 `x`、`y` 时才覆盖默认出生点。

浏览器直达测试抓到一个真实运行时 BUG：通用剧情物件是 `scene.add.image()` 创建后再挂静态物理体，普通 Image 没有 `refreshBody()` 方法，直接调用会让新记忆地图进入时崩溃。根因是我把 static group 创建出来的对象方法套到了普通 Image 上。现在改成先判断 `refreshBody` 是否存在，若不存在但 body 支持 `updateFromGameObject()`，就调用 body 自己的同步方法。这个修复仍然遵守之前日志里的经验：需要同步物理体时同步，但不能假设所有对象都有同一个 API。

`tools/verify_maps.mjs` 也增强了。它现在会检查新增记忆地图必须有视觉配置、所有 `interactables` 引用的贴图必须在 `TextureGenerator.js` 里真实生成、旧书房必须能触发学校记忆、药柜小间必须能触发医院记忆、学校和医院记忆必须有完成后返回点、车祸记忆必须同时提供“离开”和“回去”两个最终选择。最新验证结果：`node tools\verify_story_state.mjs; node tools\verify_maps.mjs; node tools\verify_start_route.mjs` 均通过，所有核心 JS 文件和三个验证脚本的 `node --check` 均通过，本地服务返回 200。浏览器按当前测试开始时间过滤后的 `memory_school`、`memory_hospital`、`memory_crash` 新错误和警告均为空。

## 2026-05-01

今天正式开始把《回煞》从剧情框架扩成小完整多结局作品。开工前先复读了既有技术日志，继续沿用上一轮经验：新增静态交互物只要挂物理体就要 `refreshBody()`，交互判定继续尊重碰撞箱边缘，移动端躲藏退出入口不能被 UI 隐藏。实际实现中也按这个原则处理了通用剧情物件，避免新增地图时又出现“看得见摸不着”的老问题。

本次新增了 `src/systems/StoryState.js`，统一管理 `storyFlags`、三类线索计数、记忆完成状态、最终选择和理智值初始化，修掉了之前 `gameState.sanity` 可能变成 `NaN` 的隐患。标题场景和游戏场景都改为使用同一套默认状态，避免重开游戏时遗漏字段。为了先有测试再写实现，新增了 `tools/verify_story_state.mjs`，一开始它会因为状态模块不存在而失败，补完模块后已经通过。

地图和剧情方面，新增了旧书房、药柜小间、学校记忆、医院记忆和雨夜车祸记忆五张地图。旧书房承接父亲控制与学校记忆，药柜小间承接母亲病情与医院记忆，车祸现场承接最终真相和“归路 / 永远在一起”的选择。`MapManager.js` 新增了通用 `interactables` 数据入口，可以用 `clueType`、`clueId`、`memoryTrigger`、`memoryReturn`、`memoryComplete` 和 `endingChoice` 驱动线索、记忆切换和结局选择。这里特别修了一个优先级坑：带有剧情字段的物件必须先判定为 `story_object`，否则使用 `desk`、`cabinet`、`car` 等贴图时会被旧分支抢走。

结局路由也接进了现有剧情。家规、病历、日记、玩具飞机、锁死的窗、血红钥匙和棺材真相都会写入三类线索。出口不再只看旧的 `clues.length`，而是按真相层级进入“破茧”“回煞”或车祸现场；棺材真相在高线索状态下会转入雨夜车祸记忆，否则仍保留原先的记忆空间收束。学校和医院记忆返回后，走廊会触发一次新的心理回声对白，强化“老宅被记忆改写”的感觉。

验证结果：`node tools\verify_story_state.mjs` 和 `node tools\verify_maps.mjs` 均已通过；`node --check` 已覆盖 `StoryState.js`、`Maps.js`、`GameScene.js`、`TitleScene.js`、`MapManager.js` 和 `InteractionManager.js`；本地 Node 静态服务器启动后，浏览器可进入标题画面、车祸序章和可操作的荒野公路开局，控制台没有错误。今天暂未调用图片生成素材，因为当前优先级是让多结局玩法链路先稳定成型，后续再补课堂、医院和车祸现场的关键视觉图会更稳。

## 2026-04-29

在确认老板希望优先做成“二十到三十分钟的小完整多结局作品”后，完成了《回煞》扩展方向的设计文档，路径为 `docs/superpowers/specs/2026-04-29-huisha-multi-ending-expansion-design.md`。设计方向确定为“现实与记忆交错”：老宅保留为主体，新开学校、医院、车祸现场三类记忆地图，分别承载控制线索、病情线索和死亡线索。结局规划为“破茧”“回煞”“归路”“永远在一起”四个方向，由玩家收集到的真相层次和最终选择决定。

自查设计文档时发现早稿里同时写了 `memoryClues` 和 `storyFlags` 两种状态命名，容易造成后续实现摇摆，于是统一收束为 `gameState.storyFlags`。其中 `storyFlags.clues` 负责三类线索计数，`storyFlags.memories` 负责记录学校、医院和车祸现场是否完成，`storyFlags.endingChoice` 负责记录最终选择。这样后续新增地图和结局判定时可以少堆硬编码分支，也方便保持现有 `window.globalGameState` 不被大拆。

## 2026-04-29

今天接手《回煞》半成品工程，先按既有日志复盘了上一轮经验，再对项目结构、运行方式和核心代码做了摸底。上一轮最值得继续遵守的经验是：静态物体只要调整碰撞尺寸，就必须同步 `refreshBody()`，否则贴图和物理体会错位；交互距离不能只按中心点算，要以碰撞箱边缘为准；移动端进入躲藏状态后必须保留可靠的退出入口，不能把操作 UI 全部隐藏掉。

当前项目不是 git 仓库，`rg` 在本机环境里被拒绝执行，所以这次改用 PowerShell 原生命令读取文件。项目主体是 Phaser 3 纯静态网页，入口在 `index.html`，剧情和运行逻辑集中在 `GameScene.js`、`InteractionManager.js`、`MapManager.js` 和 `Maps.js`。地图已经覆盖荒野公路、老宅大门、正厅、厨房、走廊、卫生间、父母卧室、密室、我的卧室、后院、地下室、阁楼和记忆空间，剧情流程也已经具备供品收集、保险箱密码、地下室钥匙、血红钥匙、追逐、躲藏、麦克风暴露、破茧结局和记忆空间结局等骨架。

实际运行方面，项目自带的 `server.ps1` 这次没有成功监听 `localhost:8000`，疑似和 `HttpListener` 权限或隐藏启动后直接退出有关；随后用 Node REPL 临时起了一个静态服务器，并在浏览器里确认标题画面、车祸序章和荒野公路开局可以正常显示，控制台没有出现错误。后续如果要稳定交付，建议优先把启动方式做成更可靠的 Node 脚本或免权限服务器。

工程风险也已经初步确认：`GameScene.js` 超过 800 行，`InteractionManager.js` 超过 600 行，`MapManager.js` 和 `Maps.js` 也接近 500 行，剧情、状态、UI 回调和触发逻辑互相交织，继续硬堆内容会越来越难维护。另外，体力和理智 UI 目前被隐藏，但 `gameState.sanity` 没有在初始状态中赋值，`updateSanity()` 会把它算成不可控的 `NaN`；这个问题短期未必显眼，却会影响后续理智惩罚、幻听和追逐压迫感的扩展。接下来如果扩剧情体验，应该先围绕“保留现有可玩链路、整理状态和触发、补强章节节奏”来做，而不是一上来大拆重构。

## 2026-03-01

今天的工作主要集中在物理系统、交互体验以及移动端的适配优化上。

首先，我发现在 `MapManager.js` 中生成的静态对象（如保险箱和NPC）有时会出现物理碰撞体与贴图位置不一致的情况。为了解决这个问题，我给这些对象加上了 `refreshBody()` 调用，确保它们时刻保持同步。同时，我还顺手修复了玩家可以直接穿过保险箱的 BUG，原因也是因为修改尺寸后没有及时刷新物理体。

交互判定方面，我调整了 `InteractionManager.js` 里的距离计算逻辑 `getDistanceToObj`。现在的算法会计算玩家与物体碰撞箱边缘的最短距离，而不是仅仅看中心点距离。这一改动有效解决了当玩家贴得太近甚至稍微“嵌入”物体碰撞箱时反而无法交互的尴尬情况。顺便也验证了一下纸人的交互逻辑，现在一切正常。

为了增强地图的辨识度，我在 `Maps.js` 里为所有地图配置了中文名称，并实装了切换场景时的房间名提示功能，让玩家能清楚知道自己到了哪里。

针对移动端玩家反馈的卡顿和报错问题，我进行了专项修复。首先彻底解决了“handleInteraction is not a function”的报错，统一了触摸和鼠标的事件入口。其次，为了保证手机上的流畅度，我加入了一套性能分级策略：在移动设备上自动关闭动态光照、降级粒子特效和后期处理。现在手机游玩的帧率应该稳多了。

此外，我修复了移动端躲藏后无法退出的严重 BUG。由于移动端在躲藏模式下会自动隐藏操作 UI，导致玩家没有按钮可以点击退出。现在的逻辑是：移动端进入躲藏模式时保留操作按钮，并且点击该按钮可以直接触发“离开躲藏”的动作。

按照老板的吩咐，我在标题画面的“回煞”旁边加上了作者署名“baidai_baidai”，并在父母卧室的相框背面埋下了保险箱密码“1988”的彩蛋。

最后，应要求微调了移动端的 UI 布局，将虚拟摇杆和交互按钮整体下移，以适应更好的握持手感。同时，为了清理场景，我删除了正厅中那个无法交互的纸人及其碰撞体积。

修复了怪物（追击者）可以直接穿过棺材的 BUG。虽然棺材已经被加入到了 `furniture` 碰撞组中，但为了保险起见，我在 `MapManager.js` 中显式地为棺材对象设置了 `immovable = true` 并调用了 `refreshBody()`，同时在 `GameScene.js` 中额外增加了一道针对棺材对象的碰撞检测。

修复了父母卧室相框（家规）无法交互的问题。原因是该对象在配置表中没有对话文本，导致初始化时未被自动加入交互组。我已强制将其加入交互列表，并考虑到相框挂在墙上位置较高（Y=50），特意增大了其交互判定范围，确保玩家在地面也能轻松够到。

针对老板反馈的相框交互范围过大以及剧情单薄的问题，我进行了二次优化。首先，我给相框添加了独立的物理碰撞体积，将其归类为家具，并精细调整了碰撞箱尺寸（32x10），使其贴合墙面。这样一来，玩家必须走到相框跟前才能触发交互，不会再出现“隔空取物”的灵异现象。其次，我重写了相框的交互逻辑，现在点击相框会先弹出一份“家规”内容（吃饭不许说话、晚上十点前回家等），再次点击才会翻转相框看到背后的密码“1988”，叙事节奏更自然了。

此外，为了提升阅读沉浸感，我将所有剧情对话中出现的“（内心独白）”和“内心独白”统一替换为了“主角”。这一改动覆盖了 `InteractionManager.js` 和 `GameScene.js` 中的多处文本，确保了全篇叙事风格的一致性，消除了原先那种跳戏的感觉。
