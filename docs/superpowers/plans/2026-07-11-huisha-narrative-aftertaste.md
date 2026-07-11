# 《回煞》剧情后劲重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把自由探索中的散点线索组织成“调查父母死亡 → 怀疑自己的忌日 → 承认自己才是亡魂”的四幕认知反转，并让“饭凉了”在追逐、开棺和四结局中得到回收。

**Architecture:** 新增纯函数 `NarrativeDirector`，只读取现有 `gameState/storyFlags`，输出当前认知阶段、一个待播放回响、HUD 记忆摘要和关键物件阶段反应。`StoryState` 只持久化已播放回响 ID，`InteractionManager.collectClue()` 在成功收集后通知 GameScene；GameScene 串行播放一个回响，避免自由顺序导致连环弹窗。

**Tech Stack:** Phaser 3、原生 ES Modules、Node.js `.mjs` 断言脚本、现有 DOM 对话与单文件构建器。

---

### Task 1: 建立纯函数叙事导演

**Files:**
- Create: `src/systems/NarrativeDirector.js`
- Create: `tools/verify_narrative_director.mjs`
- Modify: `src/systems/StoryState.js`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: Write the failing test**

验证默认阶段为 `denial`；治疗线索达到两条后返回 `mother_echo`；`locked_window/basement_lock_chain` 任一与 `toy_plane` 返回 `escape_echo`；日记与残缺全家福返回 `memorial_echo`；已播放 ID 不重复；优先级为 memorial > escape > mother；完整开棺后为 `acceptance`。

```js
const state = createDefaultGameState();
assert.equal(getNarrativePhase(state), 'denial');
state.storyFlags.collectedClues.push('medical_record', 'prescription_note');
assert.equal(getPendingNarrativeBeat(state).id, 'mother_echo');
state.storyFlags.narrativeBeatsSeen.push('mother_echo');
assert.equal(getPendingNarrativeBeat(state), null);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/verify_narrative_director.mjs`
Expected: FAIL because `NarrativeDirector.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

导出 `NARRATIVE_BEATS`、`getNarrativePhase(gameState)`、`getPendingNarrativeBeat(gameState)`、`markNarrativeBeatSeen(gameState,id)`、`getNarrativeSummary(gameState)` 与 `getObjectReflection(gameState, objectId)`。三个 beat 使用明确的 clue ID 语义前置，不按线索总数猜测。

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/verify_narrative_director.mjs; node tools/verify_story_state.mjs`
Expected: both PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/systems/NarrativeDirector.js src/systems/StoryState.js tools/verify_narrative_director.mjs tools/build_standalone_entry.mjs
git commit -m "feat: add state-driven narrative beats"
```

### Task 2: 把线索收集接入串行回响

**Files:**
- Modify: `src/systems/InteractionManager.js`
- Modify: `src/scenes/GameScene.js`
- Create: `tools/verify_narrative_runtime_contract.mjs`

- [ ] **Step 1: Write the failing contract**

检查 `InteractionManager.collectClue()` 仅在 `collectClue()` 返回 true 时调用 `scene.queueNarrativeBeat()`；GameScene 存在 `queueNarrativeBeat()`、`flushNarrativeBeat()` 和 `narrativeBeatPlaying` 防重入；当前对话活跃时延迟刷新；一次只标记一个 beat。

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/verify_narrative_runtime_contract.mjs`
Expected: FAIL on missing queue methods.

- [ ] **Step 3: Implement runtime queue**

`InteractionManager.collectClue()` 保存 collected 结果并通知 scene。GameScene 通过 250ms delayedCall 等待文档/对话关闭，播放 `beat.lines` 的递归对话序列，结束时 `markNarrativeBeatSeen()`、刷新 HUD，并再次检查是否还有下一个 beat；对话未关闭时继续 250ms 重试，不覆盖现有文档。

- [ ] **Step 4: Run focused regression**

Run: `node tools/verify_narrative_runtime_contract.mjs; node tools/verify_dom_listener_registry.mjs; node tools/verify_progression.mjs`
Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/systems/InteractionManager.js src/scenes/GameScene.js tools/verify_narrative_runtime_contract.mjs
git commit -m "feat: play narrative echoes after meaningful clues"
```

### Task 3: 让 HUD 与关键物件体现认知变化

**Files:**
- Modify: `src/systems/ObjectiveManager.js`
- Modify: `src/systems/InteractionManager.js`
- Modify: `tools/verify_objectives.mjs`
- Modify: `tools/verify_narrative_director.mjs`

- [ ] **Step 1: Extend failing tests**

断言目标视图包含 `memory` 字段；默认摘要是“父亲死了，我只是回来避雨”；忌日回响后摘要变为“所有日期都停在十年前的七月十四”；开棺后摘要为“棺材里等的人是我”。断言倒头饭在 denial/recognition 阶段分别返回“给死人的饭”和“这碗饭等的人是我”。

- [ ] **Step 2: Run tests and confirm red**

Run: `node tools/verify_objectives.mjs; node tools/verify_narrative_director.mjs`
Expected: FAIL on missing memory summary/reflections.

- [ ] **Step 3: Implement HUD and reflections**

`getObjectiveView()` 增加 `memory:getNarrativeSummary(gameState)`；ObjectiveManager 第三行显示 `记忆：...`。厨房柜、日记、锁窗、纸飞机、供桌与棺材重复调查时优先调用 `getObjectReflection()`，只替换主角反应，不改变物品获得、谜题和结局逻辑。

- [ ] **Step 4: Run objective and interaction regressions**

Run: `node tools/verify_objectives.mjs; node tools/verify_narrative_director.mjs; node tools/verify_interaction_rules.mjs`
Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/systems/ObjectiveManager.js src/systems/InteractionManager.js tools/verify_objectives.mjs tools/verify_narrative_director.mjs
git commit -m "feat: make the protagonist remember in stages"
```

### Task 4: 重写关键证据与四结局回收

**Files:**
- Modify: `src/data/Maps.js`
- Modify: `src/systems/InteractionManager.js`
- Create: `tools/verify_narrative_text.mjs`
- Modify: `tools/verify_progression.mjs`

- [ ] **Step 1: Write text-contract failures**

读取源码并验证：母亲日记含“明儿的忌日/饭在锅里”；地下室含“雨停前/回来吃饭”；追逐起点含“明儿，别跑，外面下雨”；棺材揭示纸飞机、纽扣、饭碗与“等的人是我”；四结局分别含事故播报、黑影学会主角站姿、“饭别再热了”、母亲重复与父亲锁门。验证关键 `documentText` 均不超过 120 个汉字，避免再次变成长记事本。

- [ ] **Step 2: Run and verify red**

Run: `node tools/verify_narrative_text.mjs`
Expected: FAIL on missing motif/reworked endings.

- [ ] **Step 3: Rewrite only high-leverage text**

修改黑布遗像、厨房倒头饭、四张照片、母亲日记、锁窗、纸飞机、地下室缺角/铁链/刻痕、井边追逐提示、供桌、棺材、雨夜两个选择及四结局。每段证据只保留一个事实、一个动作、一个意象；不新增地图或状态门槛。

- [ ] **Step 4: Run story/progression regressions**

Run: `node tools/verify_narrative_text.mjs; node tools/verify_progression.mjs; node tools/verify_story_state.mjs; node tools/verify_maps.mjs`
Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/data/Maps.js src/systems/InteractionManager.js tools/verify_narrative_text.mjs tools/verify_progression.mjs
git commit -m "feat: make every ending repay the same memory"
```

### Task 5: 构建、浏览器剧情烟测与日志

**Files:**
- Modify: `index.html`
- Modify: `DEV_LOG.md`

- [ ] **Step 1: Build standalone entry**

Run: `node tools/build_standalone_entry.mjs`
Expected: `Standalone index.html generated`.

- [ ] **Step 2: Run all automated verification**

Run every `tools/verify_*.mjs`, every `src/**/*.js` through `node --check`, then `git diff --check`.
Expected: zero failures.

- [ ] **Step 3: Browser smoke test**

用 `?map=room_bedroom_me` 注入日记和纸飞机收集，确认只出现一个回响且 HUD 记忆摘要推进；用地下室补齐照片触发忌日质疑；用后院确认追逐仍在 4.1 秒从对应门至少 5 格处 materialize；用正厅完整状态确认开棺进入 `memory_crash`；分别触发 `leave/return` 与低/中出口，检查四个结局核心句。桌面与 390×844 控制台错误必须为 0。

- [ ] **Step 4: Update technical log**

在 `DEV_LOG.md` 的 2026-07-11 条目记录叙事节拍接口、母题回收、浏览器证据、完整测试数量与仍需非开发者完整通关的风险。

- [ ] **Step 5: Commit**

```powershell
git add index.html DEV_LOG.md
git commit -m "docs: record narrative aftertaste verification"
```
