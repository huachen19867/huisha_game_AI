# 《回煞》游戏流程梳理

更新日期：2026-07-04

本文按当前源码梳理实际可玩的流程，主要依据 `src/scenes/TitleScene.js`、`src/scenes/IntroScene.js`、`src/scenes/GameScene.js`、`src/systems/InteractionManager.js`、`src/systems/StoryState.js` 和 `src/data/Maps.js`。整体上，《回煞》现在是一套“老宅探索 + 记忆回返 + 多结局”的 Phaser 单页游戏。

## 一句话总览

玩家从雨夜车祸进入序章，醒来后走向老宅；在老宅里调查房间、收集供品和钥匙，同时通过旧书房、药柜小间进入学校与医院记忆，逐步补全父亲控制、母亲病情和主角死亡三类真相。最终，玩家通过出口或棺材进入结局路由：线索不足会走向“破茧”或“回煞”，真相完整后会进入雨夜车祸记忆，并在“归路”和“永远在一起”之间选择。

## 入口与状态

启动链路是 `BootScene -> TitleScene -> IntroScene -> GameScene`。`TitleScene` 每次创建时会重置 `window.globalGameState`，清空背包 UI，然后等待空格或点击开始。正常开始会进入 `IntroScene` 播放车祸演出，演出结束后进入 `GameScene` 的 `room_prologue`。调试时也可以通过 `?map=memory_school`、`?map=room_study&x=320&y=160` 这类参数，从标题页直接进入指定地图，路由由 `StartRoute.js` 解析。

游戏状态集中在 `StoryState.js`。基础状态包括供品、钥匙、背包、是否看过序章、是否锁门、是否被追逐、是否躲藏等；多结局状态放在 `storyFlags` 里，核心是三类线索计数：`control`、`illness`、`death`。真相层级的判定是当前结局路由的关键：默认是 `surface`；当控制线索和病情线索都至少 1 条时进入 `family`；当三类线索都至少 2 条时进入 `complete`。

## 地图拓扑

当前地图的实际结构以 `Maps.js` 为准。主路径从 `room_prologue` 开始，经过 `room_entrance` 进入 `room_main`。`room_main` 是灵堂和棺材所在的核心房间，连接厨房、走廊、地下室和老宅大门。`room_corridor` 是中段枢纽，连接后院、阁楼、卫生间、父母卧室、我的卧室、旧书房和药柜小间。学校、医院、车祸现场是记忆地图，不靠普通门连接，而是由特定调查物触发。

主要地图职责如下。

| 地图 | 作用 | 关键产出 |
| --- | --- | --- |
| `room_prologue` | 雨夜公路开场，可调查事故车和雨夜触发点 | 引导进入老宅 |
| `room_entrance` | 老宅大门，也放着当前代码里的出口交互 | 可按真相层级触发出口结局 |
| `room_main` | 正厅、供桌、棺材、黑布遗像 | 锁门事件、供品仪式、棺材真相 |
| `room_kitchen` | 厨房 | 倒头饭 |
| `room_corridor` | 老宅枢纽 | 老照片、锁死窗户线索、通往多数房间 |
| `room_bedroom_parents` | 父母卧室 | 家规、保险箱、暗门 |
| `room_secret` | 暗门后的密室 | 火柴、木偶制作暗示 |
| `room_backyard` | 后院与枯井 | 香、血红钥匙、追逐启动 |
| `room_attic` | 阁楼 | 纸钱 |
| `room_basement` | 地下室 | 童年压迫文本和死亡线索补充 |
| `room_bedroom_me` | 我的卧室 | 母亲日记、纸飞机死亡线索 |
| `room_study` | 旧书房 | 父亲控制线索、学校记忆入口 |
| `room_medicine` | 药柜小间 | 母亲病情线索、医院记忆入口 |
| `memory_school` | 学校记忆 | 控制线索，完成后回旧书房 |
| `memory_hospital` | 医院记忆 | 病情线索，完成后回药柜小间 |
| `memory_crash` | 雨夜车祸记忆 | 死亡线索，高真相最终选择 |
| `room_memory` | 记忆空间 | “永远在一起”收束 |

## 玩家主流程

开局阶段是车祸和入宅。玩家从标题页进入序章后，会看到车祸演出；进入 `room_prologue` 后，调查车和雨夜环境，沿右侧出口到 `room_entrance`，再进入 `room_main`。在正厅调查黑布遗像会触发“砰”的锁门事件，`doorSlammed` 置为 true，回老宅大门的普通门会被锁住。

中段是老宅探索。玩家需要从厨房拿到倒头饭，从父母卧室调查家规得到保险箱密码提示“1988”，打开保险箱得到地下室钥匙；推动父母卧室衣柜可以打开暗门，进入密室后从工作台拿火柴。后院可拿香，阁楼可拿纸钱，井的事件会给血红钥匙并启动追逐。床和柜子可作为躲藏点，追逐中如果进入躲藏状态，麦克风音量过高会暴露玩家。

真相收集是并行推进的。控制线索来自家规、锁死的窗户、父亲笔记、奖状、学校黑板、成绩单和学校最终试卷；病情线索来自诊断书、母亲日记、处方单、缴费单、医院窗口、病房门牌和医院最终回声；死亡线索来自血红钥匙、纸飞机、棺材真相、车祸车门和护栏缺口。旧书房的旧书包会把玩家送进学校记忆，学校最终调查物会标记 `memories.school = true` 并返回旧书房；药柜小间同理进入医院记忆，完成后返回药柜小间。回到走廊后，`GameScene.showPostMemoryDialog()` 会根据已完成的学校或医院记忆补一段心理回声。

高潮阶段围绕供桌和棺材。供桌要求倒头饭、火柴、香、纸钱四样都齐，成功后会点亮蜡烛并设置 `candlesLit = true`。棺材要求玩家已经拿到血红钥匙，并且完成供品仪式；满足条件后会收集 `coffin_truth` 死亡线索并调用 `triggerRealEnding()`。如果此时真相层级已经是 `complete`，会进入 `memory_crash`；否则会进入 `room_memory`，走向家庭团聚式的收束。

## 结局判定

当前实现里有两套结局入口。第一套是老宅大门的 `exit_door` 交互，它会直接读取 `getTruthLevel()`：`surface` 触发“破茧”，`family` 触发“回煞”，`complete` 则把玩家送入 `memory_crash`。需要注意的是，黑布遗像触发锁门后，从正厅回大门的普通门会被锁住，因此这个出口分支更像是代码里保留的提前或特定路由入口。

第二套是棺材真相入口。玩家完成供品仪式并用血红钥匙开棺后，如果三类线索都足够，会进入雨夜车祸记忆；在 `memory_crash` 中调查死亡线索后，两个最终交互物分别对应 `endingChoice = leave` 和 `endingChoice = return`。选择 `leave` 达成“归路”；选择 `return` 会进入 `room_memory`，再通过父母幻影或桌子触发“永远在一起”。

四个结局的含义可以这样理解。

| 结局 | 触发条件 | 叙事含义 |
| --- | --- | --- |
| 破茧 | 出口交互时真相层级为 `surface` | 玩家离开老宅，但没有真正理解家与死亡 |
| 回煞 | 出口交互时真相层级为 `family` | 玩家理解家庭悲剧，但没有完全承认自己的死亡 |
| 归路 | 完整真相后在车祸记忆选择离开 | 承认死亡和创伤，不再回到旧家 |
| 永远在一起 | 进入 `room_memory` 后触发家庭收束 | 回到父母身边，以团聚完成执念 |

## 实现注意点

`index.html` 是可双击运行的单文件入口，但维护入口仍是 `src`。改完源码后要运行 `node tools\build_standalone_entry.mjs` 同步入口页，再运行 `node tools\verify_standalone_entry.mjs` 检查单文件入口没有重新出现运行时 import。地图和剧情契约的轻量验证脚本是 `node tools\verify_story_state.mjs`、`node tools\verify_maps.mjs` 和 `node tools\verify_start_route.mjs`。

目前 `room_basement` 更像补充叙事空间，而不是主线硬性门槛；真正控制结局深度的是 `storyFlags.clues` 的三类计数。后续如果继续扩流程，优先要确认“出口分支”到底是设计上的早退结局，还是希望在锁门后也能作为后期离开选择；否则玩家主流程会主要依赖棺材进入高真相结局。
