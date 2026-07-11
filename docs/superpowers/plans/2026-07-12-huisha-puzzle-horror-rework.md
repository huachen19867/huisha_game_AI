# 《回煞》解谜、沉浸与恐怖机制重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复厨房关键道具死交互，把供品、学校、医院和供桌重做成需要观察与推理的玩法，并增加不会造成循环坐牢的行为型恐怖机制。

**Architecture:** 交互焦点、谜题判定和恐怖资格均抽成可测试纯函数；`InteractionManager` 只负责把地图对象分发到谜题/道具逻辑，`GameScene` 只装配生命周期。谜题配置保存在 `Puzzles.js`，运行状态统一进入 `StoryState`，DOM 浮层只渲染配置和回调结果。

**Tech Stack:** Phaser 3、原生 ES modules、原生 DOM/CSS、Node.js 契约测试、Playwright 浏览器回归、单文件构建脚本。

---

### Task 1: 交互焦点与厨房死区

**Files:**
- Modify: `src/systems/InteractionRules.js`
- Modify: `src/systems/InteractionManager.js`
- Modify: `src/data/Maps.js`
- Create: `tools/verify_interaction_focus.mjs`
- Test: `tools/verify_interaction_rules.mjs`

- [ ] **Step 1: 写入失败契约**

`verify_interaction_focus.mjs` 导入以下期望 API，并验证三个行为：

```js
import { selectInteractionCandidate } from '../src/systems/InteractionRules.js';

const cabinet = { id: 'kitchen_cabinet', distance: 18, priority: 30, facingDot: 1 };
const ghost = { id: 'kitchen_ghost', distance: 43, priority: 30, facingDot: 0.8 };
assert.equal(selectInteractionCandidate([cabinet, ghost]).id, 'kitchen_cabinet');

const nearGeneric = { id: 'generic', distance: 40, priority: 10, facingDot: 0.9 };
const closeStory = { id: 'story', distance: 52, priority: 30, facingDot: 1 };
assert.equal(selectInteractionCandidate([nearGeneric, closeStory]).id, 'story');

const distantStory = { id: 'story', distance: 75, priority: 30, facingDot: 1 };
assert.equal(selectInteractionCandidate([cabinet, distantStory]).id, 'kitchen_cabinet');
```

地图契约同时要求 `room_kitchen.objects.cabinet.interaction` 为 `{ label: '封死的饭柜', verb: '检查', priority: 30, radius: 80, marker: true }`，并要求厨房拥有灶台灰痕调查点。

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/verify_interaction_focus.mjs`

Expected: FAIL，原因是 `selectInteractionCandidate` 尚未导出，饭柜也没有显式交互元数据。

- [ ] **Step 3: 实现焦点带选择**

在 `InteractionRules.js` 增加：

```js
export const INTERACTION_FOCUS_BAND = 28;

export function selectInteractionCandidate(candidates, focusBand = INTERACTION_FOCUS_BAND) {
    if (!candidates.length) return null;
    const nearest = Math.min(...candidates.map(candidate => candidate.distance));
    return candidates
        .filter(candidate => candidate.distance <= nearest + focusBand)
        .sort((a, b) => {
            const scoreA = a.priority * 10 + a.facingDot * 40 - a.distance;
            const scoreB = b.priority * 10 + b.facingDot * 40 - b.distance;
            return scoreB - scoreA;
        })[0] || null;
}
```

`InteractionManager.checkInteraction()` 先收集 `{ obj, distance, priority, facingDot }`，再调用该函数。`Maps.js` 为饭柜写入显式元数据，并新增 `kitchen_stove_marks` 调查点。

- [ ] **Step 4: 运行 GREEN 与回归**

Run: `node tools/verify_interaction_focus.mjs; node tools/verify_interaction_rules.mjs; node tools/verify_scene_readability.mjs`

Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```powershell
git add src/systems/InteractionRules.js src/systems/InteractionManager.js src/data/Maps.js tools/verify_interaction_focus.mjs
git commit -m "fix: make nearby kitchen props reliably interactable"
```

### Task 2: 谜题状态与案件结论

**Files:**
- Create: `src/systems/PuzzleState.js`
- Modify: `src/systems/StoryState.js`
- Modify: `src/data/Puzzles.js`
- Modify: `tools/build_standalone_entry.mjs`
- Create: `tools/verify_puzzle_state.mjs`
- Modify: `tools/verify_story_state.mjs`

- [ ] **Step 1: 写入失败的槽位谜题契约**

测试期望以下 API：

```js
import { assignPuzzleToken, createPuzzleProgress, evaluatePuzzle } from '../src/systems/PuzzleState.js';

const progress = createPuzzleProgress({ slots: [{ id: 'north' }, { id: 'south' }] });
const one = assignPuzzleToken(progress, 'north', 'mother');
const moved = assignPuzzleToken(one, 'south', 'mother');
assert.deepEqual(moved.assignments, { south: 'mother' });

assert.deepEqual(
  evaluatePuzzle({ prerequisites: ['sink'], answer: { north: 'mother', south: 'child' }, conflicts: { north: 'seat_near_stove' } }, { north: 'father' }, []),
  { status: 'blocked', missing: ['sink'] }
);
assert.equal(evaluatePuzzle(config, wrongAssignments, ['sink']).status, 'incorrect');
assert.equal(evaluatePuzzle(config, correctAssignments, ['sink']).status, 'correct');
```

`StoryState` 契约要求默认值包含：

```js
puzzleProgress: {},
caseConclusions: [],
ritualSolved: false,
hauntingSeen: []
```

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/verify_puzzle_state.mjs`

Expected: FAIL with module not found。

- [ ] **Step 3: 实现纯状态模块与配置**

`PuzzleState.js` 实现不可变赋值、同一 token 自动从旧槽移除、前置证据、未完成、错误冲突和正确完成。`Puzzles.js` 把 `kitchen_table`、`school`、`hospital`、`secret_seals`、`well_knots`、`attic_debt`、`altar_ritual` 定义为 `kind: 'board'`，每项包含 `clues`、`slots`、`tokens`、`answer`、`conflicts`、`conclusion` 和 `successText`。

学校槽位为 `leave_time`、`earliest_home`、`father_claim`；医院槽位为 `stop_day`、`cause_evidence`；厨房槽位为 `near_stove`、`back_to_door`、`side_door`、`offering`。标签只描述原始证据，不在标签中写结论。

- [ ] **Step 4: 运行 GREEN 与旧谜题回归**

Run: `node tools/verify_puzzle_state.mjs; node tools/verify_story_state.mjs; node tools/verify_puzzles.mjs`

Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```powershell
git add src/systems/PuzzleState.js src/systems/StoryState.js src/data/Puzzles.js tools/build_standalone_entry.mjs tools/verify_puzzle_state.mjs tools/verify_story_state.mjs tools/verify_puzzles.mjs
git commit -m "feat: model evidence-board puzzles and conclusions"
```

### Task 3: 证据板 UI 与统一谜题分发

**Files:**
- Modify: `index.html`
- Modify: `src/systems/InteractionManager.js`
- Modify: `src/scenes/GameScene.js`
- Create: `tools/verify_puzzle_runtime_contract.mjs`

- [ ] **Step 1: 写入失败运行时契约**

静态契约要求 `window.showPuzzle(config, initialProgress, callbacks)` 支持：

```js
callbacks.onChange(nextProgress);
callbacks.onMistake(result);
callbacks.onSuccess(result);
callbacks.onClose();
```

要求 DOM 存在 `#puzzle-clues`、`#puzzle-slots`、`#puzzle-tokens`，打开谜题时设置 `window.dialogActive = true`，关闭和成功时恢复；`InteractionManager` 从 `storyFlags.puzzleProgress[puzzle.id]` 读取并保存进度。

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/verify_puzzle_runtime_contract.mjs`

Expected: FAIL，旧 UI 只有顺序数组和单一成功回调。

- [ ] **Step 3: 实现证据板**

为浮层增加三块区域。点击 token 选中，再点击 slot 分配；已分配 token 可点击取回。提交按钮调用 `evaluatePuzzle()`：`blocked` 显示缺失证据，`incomplete` 显示空槽，`incorrect` 显示冲突文本并触发 `onMistake`，`correct` 触发 `onSuccess`。重置只清当前谜题，关闭保留进度。

每次错误把 `attempts` 写回当前谜题进度；第 2 次显示配置中的一级提示，只重述一条已收集证据；第 4 次显示二级提示，指出两个冲突槽位但不自动填答案。按钮使用原生 `button` 和可见焦点样式，证据、token、槽位与提交均可用 Tab/Enter 操作，移动端区域允许纵向滚动且关闭按钮保持可见。

`InteractionManager.openConfiguredPuzzle(obj)` 统一执行前置、保存、错误反馈、结论写入、兼容 `flags.puzzles.school/hospital`、刷新目标和记忆返回。GameScene shutdown 时确保浮层被关闭且输入锁清理。

若 puzzleId、证据或配置不存在，显示可关闭的错误信息并保持原状态；不允许因配置错误销毁物品、锁门或残留 `dialogActive`。

- [ ] **Step 4: 构建并验证 GREEN**

Run: `node tools/build_standalone_entry.mjs; node tools/verify_puzzle_runtime_contract.mjs; node tools/verify_standalone_entry.mjs`

Expected: 全部 PASS，生成入口无残留 import。

- [ ] **Step 5: 提交**

```powershell
git add index.html src/systems/InteractionManager.js src/scenes/GameScene.js tools/verify_puzzle_runtime_contract.mjs
git commit -m "feat: add persistent evidence-board puzzle UI"
```

### Task 4: 四件供品与供桌仪式

**Files:**
- Modify: `src/data/Maps.js`
- Modify: `src/systems/MapManager.js`
- Modify: `src/systems/InteractionManager.js`
- Modify: `src/systems/ObjectiveManager.js`
- Create: `tools/verify_ritual_progression.mjs`
- Modify: `tools/verify_progression.mjs`
- Modify: `tools/verify_objectives.mjs`

- [ ] **Step 1: 写入失败的产出门槛契约**

验证地图对象分别绑定 `kitchen_table`、`secret_seals`、`well_knots`、`attic_debt`，并断言以下纯流程：谜题未完成时对应物品 flag 不变化；完成后只授予一次；四样物品齐全但 `altar_ritual` 未完成时 `ritualSolved` 仍为 false；仪式完成才开放棺材/出口门槛。

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/verify_ritual_progression.mjs`

Expected: FAIL，因为当前饭、香、纸钱直接拾取，供桌自动点燃。

- [ ] **Step 3: 改造地图和交互**

饭柜打开 `kitchen_table`，成功授予倒头饭和 `empty_seat`；密室封条成功授予火柴和 `sealed_house`；井绳成功授予香；阁楼纸束成功授予纸钱和 `unpaid_debt`。原直接拾取分支改成未解谜提示或已完成复查文本，不再绕过配置。

供桌在四物品齐全后打开 `altar_ritual`；完成后写 `ritualSolved = true`、同步 `candlesLit = 2`、改变蜡烛和遗像、刷新目标。错误只触发局部反馈，不删除物品。

- [ ] **Step 4: 运行 GREEN 与地图回归**

Run: `node tools/verify_ritual_progression.mjs; node tools/verify_progression.mjs; node tools/verify_maps.mjs; node tools/verify_objectives.mjs`

Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```powershell
git add src/data/Maps.js src/systems/MapManager.js src/systems/InteractionManager.js src/systems/ObjectiveManager.js tools/verify_ritual_progression.mjs tools/verify_progression.mjs tools/verify_objectives.mjs
git commit -m "feat: turn ritual supplies into evidence-driven challenges"
```

### Task 5: 学校、医院与叙事结论

**Files:**
- Modify: `src/data/Maps.js`
- Modify: `src/data/Puzzles.js`
- Modify: `src/systems/NarrativeDirector.js`
- Modify: `src/systems/ObjectiveManager.js`
- Create: `tools/verify_case_conclusions.mjs`
- Modify: `tools/verify_narrative_director.mjs`
- Modify: `tools/verify_narrative_text.mjs`

- [ ] **Step 1: 写入失败的因果契约**

测试要求学校证据包含留堂钟、末班车票、涂改成绩单和父亲说明，完成后得到 `rewritten_night`；医院证据包含七日处方、药柜余量、病房记录和缴费单，完成后得到 `treatment_blocked`。NarrativeDirector 的阶段和摘要优先读取结论组合，而非只看线索计数。

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/verify_case_conclusions.mjs`

Expected: FAIL，地图仍只有两条前置证据和答案外露的排序题。

- [ ] **Step 3: 重写证据和回响**

每条证据控制在 120 汉字内，只提供一个可计算事实。学校成功文本明确“父亲改写了最后争吵时间”，医院成功文本明确“剩余药量证明治疗在第四天被人为中断”。NarrativeDirector 在 `empty_seat + rewritten_night`、`treatment_blocked + sealed_house` 等组合上播放因果回响，避免重复复述单条文档。

- [ ] **Step 4: 运行 GREEN**

Run: `node tools/verify_case_conclusions.mjs; node tools/verify_narrative_director.mjs; node tools/verify_narrative_text.mjs; node tools/verify_objectives.mjs`

Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```powershell
git add src/data/Maps.js src/data/Puzzles.js src/systems/NarrativeDirector.js src/systems/ObjectiveManager.js tools/verify_case_conclusions.mjs tools/verify_narrative_director.mjs tools/verify_narrative_text.mjs
git commit -m "feat: make memory puzzles prove story conclusions"
```

### Task 6: 行为型恐怖机制

**Files:**
- Create: `src/systems/HauntingDirector.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `src/systems/MapManager.js`
- Modify: `src/systems/InteractionManager.js`
- Modify: `tools/build_standalone_entry.mjs`
- Create: `tools/verify_haunting_director.mjs`
- Create: `tools/verify_haunting_runtime_contract.mjs`

- [ ] **Step 1: 写入失败的纯函数契约**

测试期望：

```js
import { canAdvanceWatcher, evaluateListeningWindow } from '../src/systems/HauntingDirector.js';

assert.equal(canAdvanceWatcher({ dialogActive: true, puzzleActive: false, facingDot: -1, moved: 40 }), false);
assert.equal(canAdvanceWatcher({ dialogActive: false, puzzleActive: false, facingDot: 0.8, moved: 40 }), false);
assert.equal(canAdvanceWatcher({ dialogActive: false, puzzleActive: false, facingDot: -0.4, moved: 40 }), true);
assert.equal(evaluateListeningWindow({ elapsedMs: 2500, movedDistance: 0 }), 'survived');
assert.equal(evaluateListeningWindow({ elapsedMs: 900, movedDistance: 18 }), 'noticed');
```

运行时契约要求 scene shutdown 调用 `hauntingDirector.destroy()`，谜题/对话时不更新，监听节点写入 `hauntingSeen` 后不得重复。

- [ ] **Step 2: 运行并确认 RED**

Run: `node tools/verify_haunting_director.mjs; node tools/verify_haunting_runtime_contract.mjs`

Expected: FAIL with module not found。

- [ ] **Step 3: 实现 Director 与三个作者节点**

实现厨房纸人背视锚点、学校/医院返回走廊后的数脚步监听、首次供桌摆放后的门口监听。事件在 `window.dialogActive`、谜题层可见、切图和追逐期间暂停。被发现只短暂熄灯、显示门口黑影并降低有限理智；静止成功播放一句与当前结论相关的耳语。所有计时器、sprite、light 和 tween 在 `destroy()` 清理。

谜题错误通过 `InteractionManager` 调用 `hauntingDirector.onPuzzleMistake(puzzleId, attempts)`，厨房第三错让纸人到饭柜锚点，其余谜题触发各自一次房间反馈。

- [ ] **Step 4: 运行 GREEN 与追逐回归**

Run: `node tools/verify_haunting_director.mjs; node tools/verify_haunting_runtime_contract.mjs; node tools/verify_chase_contract.mjs; node tools/verify_chase_timing.mjs; node tools/verify_scene_runtime_contracts.mjs`

Expected: 全部 PASS，4 秒追逐契约不变。

- [ ] **Step 5: 提交**

```powershell
git add src/systems/HauntingDirector.js src/scenes/GameScene.js src/systems/MapManager.js src/systems/InteractionManager.js tools/build_standalone_entry.mjs tools/verify_haunting_director.mjs tools/verify_haunting_runtime_contract.mjs
git commit -m "feat: add rule-driven hauntings without chase loops"
```

### Task 7: 构建、完整试玩与复盘

**Files:**
- Modify: `index.html`
- Modify: `docs/GAME_FLOW.md`
- Modify: `DEV_LOG.md`
- Create: `docs/playtests/2026-07-12-full-route.md`
- Modify: affected source/tests when playtest finds defects

- [ ] **Step 1: 重建单文件并运行全量自动化**

```powershell
node tools/build_standalone_entry.mjs
$tests=Get-ChildItem tools\verify_*.mjs
foreach($t in $tests){ node $t.FullName; if($LASTEXITCODE -ne 0){ throw $t.Name } }
$js=Get-ChildItem src -Recurse -Filter *.js
foreach($f in $js){ node --check $f.FullName; if($LASTEXITCODE -ne 0){ throw $f.FullName } }
git diff --check
```

Expected: 0 failures，单文件构建成功，diff 无空白错误。

- [ ] **Step 2: 浏览器验证桌面和移动布局**

桌面 1280×720 从正常标题入口开始；390×844 验证证据、槽位、token、提交、关闭按钮均可达。检查控制台 error 为 0，谜题期间玩家不移动、纸人不推进，关闭后输入恢复。

- [ ] **Step 3: 从新档完整游玩高真相路线**

不使用 `?map=`、状态注入或开发者宝箱。记录开局到结局用时、每个谜题首次理解时间、错误次数、超过 20 秒无目标徘徊点、交互抢占、恐怖打断阅读和剧情矛盾。再以状态直达只回归低、中出口标题和返回标题链路。

- [ ] **Step 4: 修复试玩发现的问题并复验相关段落**

每个确证问题先在 `docs/playtests/2026-07-12-full-route.md` 记录复现、根因和严重度；代码问题先补失败契约再修复。重新走受影响段落，更新结果为已解决或保留风险。

- [ ] **Step 5: 更新流程和技术日志**

`docs/GAME_FLOW.md` 写明新版供品、证据板、结论和恐怖规则；`DEV_LOG.md` 在 2026-07-12 下记录可复用的焦点带算法、槽位谜题接口、恐怖生命周期清理和完整试玩结论。

- [ ] **Step 6: 最终全量验证并提交**

重复 Step 1 的完整命令，确认工作区只包含预期改动，然后：

```powershell
git add index.html docs/GAME_FLOW.md DEV_LOG.md docs/playtests/2026-07-12-full-route.md
git commit -m "docs: archive puzzle and horror playtest"
```
