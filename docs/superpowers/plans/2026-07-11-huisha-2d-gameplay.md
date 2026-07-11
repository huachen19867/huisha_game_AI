# 《回煞》2D 地图、谜题与结局重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 18 张地图各自产生明确价值，以地下禁闭室、两段记忆谜题、全家福反制和统一四结局路由组成一条目标清楚且有变化的 2D 流程。

**Architecture:** `StoryState` 保存唯一剧情真值并提供纯判定；`Maps` 与 `Puzzles` 只保存数据；`ObjectiveManager` 只展示当前目标；`ChaseManager` 管理短追逐生命周期；`InteractionManager` 把玩家动作路由到这些系统。单文件构建继续按依赖顺序内嵌全部模块。

**Tech Stack:** JavaScript ES modules、Phaser 3.60、Node.js `assert`、HTML/CSS DOM 浮层

---

### Task 1: 扩展剧情状态并统一结局判定

**Files:**
- Modify: `src/systems/StoryState.js`
- Create: `tools/verify_progression.mjs`
- Modify: `tools/verify_story_state.mjs`

- [ ] **Step 1: 写入完整进度与结局失败测试**

```js
import assert from 'node:assert/strict';
import {
    canChooseCrashEnding,
    createDefaultGameState,
    ensureStoryFlags,
    getExitRoute,
    getTruthLevel,
    reconcileFamilyPhoto
} from '../src/systems/StoryState.js';

const state = createDefaultGameState();
const flags = ensureStoryFlags(state);
assert.deepEqual(flags.puzzles, { school: false, hospital: false });
assert.equal(flags.photoSetCollected, false);
assert.equal(flags.familyPhotoCornerFound, false);
assert.equal(flags.familyPhotoAssembled, false);
assert.equal(flags.chasePhase, 'idle');
assert.deepEqual(flags.crashEvidence, { car: false, guardrail: false });
assert.equal(flags.coffinOpened, false);
assert.equal(getTruthLevel(state), 'surface');
assert.equal(getExitRoute(state), 'ending_pojian');

flags.puzzles.school = true;
flags.puzzles.hospital = true;
assert.equal(getTruthLevel(state), 'family');
assert.equal(getExitRoute(state), 'ending_huisha');

flags.photoSetCollected = true;
assert.equal(reconcileFamilyPhoto(state), false);
flags.familyPhotoCornerFound = true;
assert.equal(reconcileFamilyPhoto(state), true);
flags.clues.death = 2;
flags.coffinOpened = true;
assert.equal(getTruthLevel(state), 'complete');
assert.equal(getExitRoute(state), 'memory_crash');
assert.equal(canChooseCrashEnding(state), false);
flags.crashEvidence.car = true;
flags.crashEvidence.guardrail = true;
assert.equal(canChooseCrashEnding(state), true);

console.log('Progression verification passed');
```

- [ ] **Step 2: 运行测试并确认新字段缺失**

Run: `node tools/verify_progression.mjs`

Expected: FAIL，首个失败指向 `flags.puzzles` 或缺少导出函数。

- [ ] **Step 3: 在默认状态和归一化中加入新字段**

`createDefaultStoryFlags()` 返回值加入：

```js
puzzles: { school: false, hospital: false },
photoSetCollected: false,
familyPhotoCornerFound: false,
familyPhotoAssembled: false,
chasePhase: 'idle',
crashEvidence: { car: false, guardrail: false },
coffinOpened: false
```

`ensureStoryFlags()` 对旧状态逐项补默认值，并把布尔字段强制转换为布尔值。`chasePhase` 只接受 `idle`、`active`、`escaped`，其他值回退到 `idle`。

- [ ] **Step 4: 实现全家福和结局纯函数**

```js
export function reconcileFamilyPhoto(gameState) {
    const flags = ensureStoryFlags(gameState);
    flags.familyPhotoAssembled = flags.photoSetCollected && flags.familyPhotoCornerFound;
    return flags.familyPhotoAssembled;
}

export function getTruthLevel(gameState) {
    const flags = ensureStoryFlags(gameState);
    const complete = flags.puzzles.school &&
        flags.puzzles.hospital &&
        flags.familyPhotoAssembled &&
        flags.clues.death >= 2 &&
        flags.coffinOpened;
    if (complete) return 'complete';
    if (flags.puzzles.school && flags.puzzles.hospital) return 'family';
    return 'surface';
}

export function getExitRoute(gameState) {
    const truthLevel = getTruthLevel(gameState);
    if (truthLevel === 'complete') return 'memory_crash';
    if (truthLevel === 'family') return 'ending_huisha';
    return 'ending_pojian';
}

export function canChooseCrashEnding(gameState) {
    const flags = ensureStoryFlags(gameState);
    return getTruthLevel(gameState) === 'complete' && flags.crashEvidence.car && flags.crashEvidence.guardrail;
}
```

- [ ] **Step 5: 运行进度与旧状态验证**

先更新 `verify_story_state.mjs`：控制、病情、死亡线索计数仍分别验证，但只收集线索时 `getTruthLevel` 期望为 `surface`；设置 `flags.puzzles.school = true` 和 `flags.puzzles.hospital = true` 后期望 `family`；再设置全家福、2 条死亡线索和 `coffinOpened = true` 后期望 `complete`。

Run: `node tools/verify_progression.mjs; node tools/verify_story_state.mjs`

Expected: 两项都输出 `passed`。

- [ ] **Step 6: 提交剧情状态重构**

```powershell
git add -- src/systems/StoryState.js tools/verify_progression.mjs tools/verify_story_state.mjs
git commit -m "feat: unify 2d progression and ending routes"
```

### Task 2: 为 18 张地图建立用途契约并重做地下室

**Files:**
- Modify: `src/data/Maps.js`
- Modify: `tools/verify_maps.mjs`
- Create: `tools/verify_map_purpose.mjs`

- [ ] **Step 1: 写入地图用途和地下室失败测试**

```js
import assert from 'node:assert/strict';
import { Maps } from '../src/data/Maps.js';

assert.equal(Object.keys(Maps).length, 18);
for (const [mapId, map] of Object.entries(Maps)) {
    assert.equal(typeof map.purpose, 'string', `${mapId} purpose must be a string`);
    assert.ok(map.purpose.trim().length > 0, `${mapId} purpose is empty`);
    assert.ok(Array.isArray(map.rewards) && map.rewards.length > 0, `${mapId} rewards are empty`);
}

const basement = Maps.room_basement;
assert.equal(basement.width, 18);
assert.equal(basement.height, 14);
assert.ok(basement.objects.interactables.some(item => item.id === 'basement_photo_corner'));
assert.ok(basement.objects.interactables.some(item => item.id === 'basement_chain'));
assert.ok(basement.objects.doors.some(door => door.targetMap === 'room_main'));

const startCell = [Math.floor(basement.objects.playerStart.x / 32), Math.floor(basement.objects.playerStart.y / 32)];
const corner = basement.objects.interactables.find(item => item.id === 'basement_photo_corner');
const targetCell = [Math.floor(corner.x / 32), Math.floor(corner.y / 32)];
const exitCell = [8, 13];

function reachable(data, start, target) {
    const queue = [start];
    const seen = new Set([start.join(',')]);
    while (queue.length) {
        const [x, y] = queue.shift();
        if (x === target[0] && y === target[1]) return true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            const key = `${nx},${ny}`;
            if (data[ny]?.[nx] === 0 && !seen.has(key)) {
                seen.add(key);
                queue.push([nx, ny]);
            }
        }
    }
    return false;
}

assert.equal(reachable(basement.data, startCell, targetCell), true, 'Basement photo corner is unreachable');
assert.equal(reachable(basement.data, targetCell, exitCell), true, 'Basement exit is unreachable after collecting the photo corner');
console.log('Map purpose verification passed');
```

- [ ] **Step 2: 运行测试并确认 purpose 缺失**

Run: `node tools/verify_map_purpose.mjs`

Expected: FAIL，错误包含 `room_prologue purpose must be a string`。

- [ ] **Step 3: 给全部地图加入 purpose 与 rewards**

将以下对象中的字符串和数组写入对应地图的 `purpose` 与 `rewards`：

```js
const mapPurpose = {
    room_prologue: ['教会移动与调查并建立车祸循环', ['movement_tutorial', 'old_house_direction']],
    room_entrance: ['承载老宅入口与阶段性离开选择', ['exit_choice']],
    room_main: ['承载供品仪式、棺材和全家福反制', ['ritual', 'coffin_truth', 'photo_counter']],
    room_kitchen: ['取得倒头饭并触发纸人变化', ['rice', 'paper_doll_event']],
    room_corridor: ['连接房间并收集四张照片', ['photo_set']],
    room_bathroom: ['提供密码替代提示与母亲病情线索', ['safe_code_hint', 'illness_clue']],
    room_bedroom_parents: ['取得家规、地下室钥匙并打开密室', ['control_clue', 'basement_key', 'secret_room']],
    room_secret: ['取得火柴并发现封宅证据', ['matches', 'seal_note']],
    room_study: ['收集控制线索并进入学校记忆', ['control_clues', 'school_memory']],
    room_medicine: ['收集治疗线索并进入医院记忆', ['illness_clues', 'hospital_memory']],
    room_bedroom_me: ['取得日记、纸飞机并提供躲藏点', ['diary_clue', 'death_clue', 'hide_spot']],
    room_backyard: ['取得香和血红钥匙并启动追逐', ['incense', 'red_key', 'chase_start']],
    room_basement: ['取得全家福缺角与锁门证据', ['family_photo_corner', 'locked_chain_clue']],
    room_attic: ['取得纸钱并提供方向提示', ['spirit_money', 'house_overview_hint']],
    memory_school: ['完成试卷顺序谜题', ['school_puzzle']],
    memory_hospital: ['完成治疗证据链谜题', ['hospital_puzzle']],
    memory_crash: ['调查死亡现场并作最终选择', ['crash_evidence', 'final_choice']],
    room_memory: ['确认回家选择并触发团聚结局', ['return_confirmation', 'ending_together']]
};
```

每个地图对象增加 `purpose: mapPurpose[id][0]` 与 `rewards: mapPurpose[id][1]`；最终源码可直接写字面量，测试只依赖导出的 `Maps`。

- [ ] **Step 4: 将 room_basement 替换为 18×14 地下禁闭室**

```js
room_basement: {
    id: 'room_basement',
    name: '地下禁闭室',
    purpose: '取得全家福缺角与锁门证据',
    rewards: ['family_photo_corner', 'locked_chain_clue'],
    width: 18,
    height: 14,
    visual: { ambient: 0x554433, floorTint: 0x776655, wallTint: 0x554433, rain: false },
    data: [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
        [1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
        [1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1],
        [1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
        [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1]
    ],
    objects: {
        playerStart: { x: 304, y: 400 },
        interactables: [
            {
                id: 'basement_photo_corner', x: 304, y: 80, texture: 'photo_frame',
                dialog: '照片缺角上是小时候的我。它正好能补上走廊里的全家福。',
                itemGrant: 'family_photo_corner'
            },
            {
                id: 'basement_chain', x: 112, y: 176, texture: 'trash_paper',
                clueId: 'basement_lock_chain', clueType: 'control',
                documentTitle: '锁门铁链', documentText: '铁链内侧有孩子指甲留下的抓痕。父亲不是在防外人，他是在防我逃走。'
            },
            {
                id: 'basement_scratches', x: 464, y: 176, texture: 'scratch',
                clueId: 'basement_last_night', clueType: 'death',
                dialog: '墙上反复刻着：雨停之前，我一定要出去。'
            }
        ],
        doors: [
            { x: 8, y: 13, w: 2, h: 1, targetMap: 'room_main', targetX: 432, targetY: 100 }
        ]
    }
}
```

- [ ] **Step 5: 给地下室加入连续灯光引导数据**

在 `visual` 增加 `guideLights`：

```js
guideLights: [
    { x: 304, y: 400, radius: 110, color: 0xffcc88 },
    { x: 304, y: 240, radius: 100, color: 0xffcc88 },
    { x: 304, y: 80, radius: 110, color: 0xff8866 }
]
```

`MapManager.createMap()` 遍历 `visual.guideLights || []`，调用 `scene.lights.addLight(x, y, radius).setColor(color).setIntensity(1.1)`。

同时把 `room_main` 中通往 `room_basement` 的门目标坐标改为 `targetX: 304, targetY: 400`，确保进入后落在新地图的主通道。

- [ ] **Step 6: 落实厨房、浴室与阁楼的实际产出**

`room_kitchen.objects` 增加 `npc: { x: 360, y: 160 }`，让倒头饭取得后的纸人位置变化可触发。`wet_paper` 交互收集 `bathroom_self_harm` 病情线索，文档明确给出“1988”密码替代提示和母亲自伤未遂记录。`room_attic.objects.interactables` 增加 `attic_overview`，位置 `{ x: 480, y: 160 }`，调查文本为“从破窗能看见后院枯井、正厅烟气和走廊尽头，三条路最终都指向供桌。”

- [ ] **Step 7: 运行地图验证**

Run: `node tools/verify_map_purpose.mjs; node tools/verify_maps.mjs`

Expected: 两项都输出 `passed`。

- [ ] **Step 8: 提交地图用途和地下室**

```powershell
git add -- src/data/Maps.js src/systems/MapManager.js tools/verify_map_purpose.mjs tools/verify_maps.mjs
git commit -m "feat: give every map a distinct purpose"
```

### Task 3: 加入纯状态驱动的目标提示

**Files:**
- Create: `src/systems/ObjectiveManager.js`
- Create: `tools/verify_objectives.mjs`
- Modify: `index.html`
- Modify: `src/scenes/GameScene.js`
- Modify: `src/scenes/TitleScene.js`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: 写入目标推导失败测试**

```js
import assert from 'node:assert/strict';
import { createDefaultGameState } from '../src/systems/StoryState.js';
import { getCurrentObjective } from '../src/systems/ObjectiveManager.js';

const state = createDefaultGameState();
assert.equal(getCurrentObjective(state, 'room_prologue'), '沿公路寻找避雨处');
state.doorSlammed = true;
assert.equal(getCurrentObjective(state, 'room_main'), '找齐供品：倒头饭、火柴、香、纸钱');
state.hasRice = state.hasMatches = state.hasIncense = state.hasSpiritMoney = true;
assert.equal(getCurrentObjective(state, 'room_main'), '调查旧书房与药柜小间');
state.storyFlags.puzzles.school = true;
state.storyFlags.puzzles.hospital = true;
assert.equal(getCurrentObjective(state, 'room_corridor'), '调查走廊里的四张旧照片');
state.storyFlags.photoSetCollected = true;
assert.equal(getCurrentObjective(state, 'room_corridor'), '用地下室钥匙进入地下禁闭室寻找照片缺角');
state.storyFlags.familyPhotoCornerFound = true;
state.storyFlags.familyPhotoAssembled = true;
state.storyFlags.chasePhase = 'active';
assert.equal(getCurrentObjective(state, 'room_backyard'), '躲藏 6 秒，或把完整全家福带回正厅');

console.log('Objective verification passed');
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run: `node tools/verify_objectives.mjs`

Expected: FAIL，错误包含 `Cannot find module 'src/systems/ObjectiveManager.js'`。

- [ ] **Step 3: 实现目标推导与显示类**

```js
import { ensureStoryFlags } from './StoryState.js';

export function getCurrentObjective(gameState, mapId) {
    const flags = ensureStoryFlags(gameState);
    if (mapId === 'room_prologue') return '沿公路寻找避雨处';
    if (!gameState.doorSlammed) return '进入老宅，调查正厅里的黑布遗像';
    const missing = [
        ['hasRice', '倒头饭'], ['hasMatches', '火柴'],
        ['hasIncense', '香'], ['hasSpiritMoney', '纸钱']
    ].filter(([key]) => !gameState[key]).map(([, label]) => label);
    if (missing.length) return `找齐供品：${missing.join('、')}`;
    if (!flags.puzzles.school || !flags.puzzles.hospital) return '调查旧书房与药柜小间';
    if (!flags.photoSetCollected) return '调查走廊里的四张旧照片';
    if (!flags.familyPhotoCornerFound) return '用地下室钥匙进入地下禁闭室寻找照片缺角';
    if (flags.chasePhase === 'active') return '躲藏 6 秒，或把完整全家福带回正厅';
    if (!gameState.candlesLit) return '回到正厅完成供品仪式';
    if (!flags.coffinOpened) return '用血红钥匙打开棺材';
    if (flags.crashEvidence && (!flags.crashEvidence.car || !flags.crashEvidence.guardrail)) return '调查变形车门和护栏缺口';
    return '根据已经查明的真相作出选择';
}

export class ObjectiveManager {
    constructor(gameState, element) {
        this.gameState = gameState;
        this.element = element;
    }
    refresh(mapId) {
        if (!this.element) return;
        this.element.textContent = `目标：${getCurrentObjective(this.gameState, mapId)}`;
        this.element.style.display = 'block';
    }
    hide() {
        if (this.element) this.element.style.display = 'none';
    }
}
```

- [ ] **Step 4: 在 HTML 加入目标 DOM 与样式**

在 `#ui-layer` 中加入 `<div id="objective-panel"></div>`。样式固定为左上角、最大宽度 70vw、半透明黑底、16px 字号、`pointer-events:none`；竖屏时字号 14px、顶部 52px，避开物品栏。

- [ ] **Step 5: 场景装配目标管理器**

`GameScene.create()` 建立 `this.objectiveManager = new ObjectiveManager(this.gameState, document.getElementById('objective-panel'))` 并调用 `refresh(this.currentMapId)`；新增 `refreshObjective()` 方法。`TitleScene.create()` 隐藏面板。`InteractionManager` 每次物品、线索、谜题、追逐或仪式状态变化后调用 `scene.refreshObjective()`。

- [ ] **Step 6: 登记构建顺序并运行验证**

把 `ObjectiveManager.js` 放在 `GameScene.js` 之前。运行：

Run: `node tools/verify_objectives.mjs; node tools/build_standalone_entry.mjs; node tools/verify_standalone_entry.mjs`

Expected: 三项命令成功，入口验证输出 `passed`。

- [ ] **Step 7: 提交目标系统**

```powershell
git add -- src/systems/ObjectiveManager.js src/scenes/GameScene.js src/scenes/TitleScene.js src/systems/InteractionManager.js tools/verify_objectives.mjs tools/build_standalone_entry.mjs index.html
git commit -m "feat: add state-driven 2d objectives"
```

### Task 4: 实现学校与医院轻谜题

**Files:**
- Create: `src/data/Puzzles.js`
- Create: `tools/verify_puzzles.mjs`
- Modify: `src/data/Maps.js`
- Modify: `src/systems/MapManager.js`
- Modify: `src/systems/InteractionManager.js`
- Modify: `index.html`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: 写入谜题失败测试**

```js
import assert from 'node:assert/strict';
import { Puzzles, canStartPuzzle, isPuzzleAnswerCorrect } from '../src/data/Puzzles.js';

assert.deepEqual(Puzzles.school.answer, ['exam_1986', 'exam_1987', 'exam_1988']);
assert.deepEqual(Puzzles.hospital.answer, ['diagnosis', 'prescription', 'unpaid_bill']);
assert.equal(canStartPuzzle(Puzzles.school, ['school_blackboard']), false);
assert.equal(canStartPuzzle(Puzzles.school, ['school_blackboard', 'school_report']), true);
assert.equal(isPuzzleAnswerCorrect(Puzzles.school, ['exam_1986', 'exam_1987', 'exam_1988']), true);
assert.equal(isPuzzleAnswerCorrect(Puzzles.school, ['exam_1988', 'exam_1987', 'exam_1986']), false);

console.log('Puzzle verification passed');
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run: `node tools/verify_puzzles.mjs`

Expected: FAIL，错误包含 `Cannot find module 'src/data/Puzzles.js'`。

- [ ] **Step 3: 实现谜题数据和纯判定**

```js
export const Puzzles = {
    school: {
        id: 'school', title: '把试卷按年份排好',
        prerequisites: ['school_blackboard', 'school_report'],
        options: [
            { id: 'exam_1988', label: '1988：离家前最后一次考试' },
            { id: 'exam_1986', label: '1986：第一次被罚站' },
            { id: 'exam_1987', label: '1987：奖状背面的红字' }
        ],
        answer: ['exam_1986', 'exam_1987', 'exam_1988'],
        successText: '三张试卷连成了父亲控制逐年加深的轨迹。'
    },
    hospital: {
        id: 'hospital', title: '拼出治疗被阻断的过程',
        prerequisites: ['hospital_window', 'hospital_ward'],
        options: [
            { id: 'unpaid_bill', label: '未缴费单：家丑不可外扬' },
            { id: 'diagnosis', label: '诊断：需要规律服药与住院观察' },
            { id: 'prescription', label: '处方：医生开出的治疗方案' }
        ],
        answer: ['diagnosis', 'prescription', 'unpaid_bill'],
        successText: '母亲不是不肯治疗，而是治疗被父亲亲手中断。'
    }
};

export function canStartPuzzle(puzzle, collectedClues) {
    return puzzle.prerequisites.every(id => collectedClues.includes(id));
}

export function isPuzzleAnswerCorrect(puzzle, answer) {
    return answer.length === puzzle.answer.length && answer.every((id, index) => id === puzzle.answer[index]);
}
```

- [ ] **Step 4: 给学校和医院终点配置 puzzleId**

`school_final_stack` 增加 `puzzleId: 'school'`，保留 `clueId: 'school_last_argument'`、`clueType: 'control'` 与 `memoryReturn`，删除 `memoryComplete`。`hospital_return` 增加 `puzzleId: 'hospital'`，保留 `clueId: 'hospital_mother_voice'`、`clueType: 'illness'` 与 `memoryReturn`，删除 `memoryComplete`。`MapManager` 把 `data.puzzleId` 复制到物件。

- [ ] **Step 5: 在 index.html 实现通用谜题浮层**

新增 `#puzzle-overlay`，内部包含标题、已选顺序、选项区、重置和关闭按钮。`window.showPuzzle(config, onSuccess)` 每次清空选择；点击选项按顺序加入，达到答案长度时调用 `isPuzzleAnswerCorrect`：正确则关闭、清除 `dialogActive` 并调用 `onSuccess`；错误则显示“顺序不对，再看一眼证据”，清空选择。关闭按钮不写完成状态。

- [ ] **Step 6: InteractionManager 按前置条件启动谜题**

把剧情物件识别条件扩展为 `obj.puzzleId || obj.itemGrant || obj.memoryTrigger || obj.memoryReturn || obj.clueType || obj.documentText || obj.endingChoice`。当 `obj.puzzleId` 存在时，必须先处理谜题，再执行通用线索收集。读取 `Puzzles[obj.puzzleId]`；前置线索不足时显示“先调查这段记忆中的另外两件证据”。满足时调用 `showPuzzle`，成功回调才收集终点物件的 `clueId/clueType`，写入 `flags.puzzles[id] = true` 和 `flags.memories[id] = true`，刷新目标，再执行 `memoryReturn`。

- [ ] **Step 7: 运行谜题、地图与单文件验证**

把 `src/data/Puzzles.js` 放在 `tools/build_standalone_entry.mjs` 的 `Maps.js` 之后、`InteractionManager.js` 之前。

Run: `node tools/verify_puzzles.mjs; node tools/verify_maps.mjs; node tools/build_standalone_entry.mjs; node tools/verify_standalone_entry.mjs`

Expected: 四项命令成功，三个 verify 脚本输出 `passed`。

- [ ] **Step 8: 提交谜题系统**

```powershell
git add -- src/data/Puzzles.js src/data/Maps.js src/systems/MapManager.js src/systems/InteractionManager.js tools/verify_puzzles.mjs tools/build_standalone_entry.mjs index.html
git commit -m "feat: turn memory rooms into short puzzles"
```

### Task 5: 完成全家福、地下室产出与短追逐

**Files:**
- Create: `src/systems/ChaseManager.js`
- Create: `tools/verify_chase_contract.mjs`
- Modify: `src/systems/InteractionManager.js`
- Modify: `src/systems/MapManager.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `index.html`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: 写入追逐与全家福契约失败测试**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultGameState, reconcileFamilyPhoto } from '../src/systems/StoryState.js';

const state = createDefaultGameState();
state.storyFlags.photoSetCollected = true;
assert.equal(reconcileFamilyPhoto(state), false);
state.storyFlags.familyPhotoCornerFound = true;
assert.equal(reconcileFamilyPhoto(state), true);

const chaseSource = readFileSync(new URL('../src/systems/ChaseManager.js', import.meta.url), 'utf8');
const interactionSource = readFileSync(new URL('../src/systems/InteractionManager.js', import.meta.url), 'utf8');
assert.match(chaseSource, /HIDE_ESCAPE_MS = 6000/);
assert.match(chaseSource, /escape\('hide'\)/);
assert.match(interactionSource, /chaseManager\.escape\('photo'\)/);
assert.match(chaseSource, /scene\.physics\.resume\(\)/);

console.log('Chase contract verification passed');
```

- [ ] **Step 2: 运行测试并确认 ChaseManager 缺失**

Run: `node tools/verify_chase_contract.mjs`

Expected: FAIL，错误包含 `ENOENT` 或 `ChaseManager.js`。

- [ ] **Step 3: 让地下室缺角写入状态并合成全家福**

`MapManager` 复制 `itemGrant`。`InteractionManager` 的 story object 分支识别 `family_photo_corner`：首次取得时设置 `flags.familyPhotoCornerFound = true`，把【全家福缺角】加入物品栏，调用 `reconcileFamilyPhoto`；若返回 true，则把【残缺全家福】在 UI 中替换为【完整全家福】。

照片分支在第四张照片首次看完时设置 `flags.photoSetCollected = true`，只添加一次【残缺全家福】，然后调用 `reconcileFamilyPhoto`。

`updateInventory(item)` 创建格子时写入 `slot.dataset.item = item`，并新增：

```js
window.replaceInventoryItem = function replaceInventoryItem(oldItem, newItem) {
    const slot = Array.from(invSlots.children).find(node => node.dataset.item === oldItem);
    if (slot) slot.remove();
    window.updateInventory(newItem);
};
```

- [ ] **Step 4: 实现短追逐管理器**

```js
import { Maps } from '../data/Maps.js';
import { ensureStoryFlags } from './StoryState.js';

export const HIDE_ESCAPE_MS = 6000;

export class ChaseManager {
    constructor(scene) {
        this.scene = scene;
        this.chaser = null;
        this.hideTimer = null;
        this.caught = false;
    }

    resolveSpawn() {
        const map = Maps[this.scene.currentMapId];
        const player = this.scene.player.sprite;
        const candidates = [];
        if (this.scene.previousMapId) {
            const door = map.objects.doors?.find(item => item.targetMap === this.scene.previousMapId);
            if (door) {
                candidates.push({
                    x: door.x * 32 + (door.w || 1) * 16,
                    y: door.y * 32 + (door.h || 1) * 16
                });
            }
        }
        candidates.push(
            { x: player.x + 160, y: player.y },
            { x: player.x - 160, y: player.y },
            { x: player.x, y: player.y + 160 },
            { x: player.x, y: player.y - 160 }
        );
        const valid = candidates.find(point => {
            const tx = Math.floor(point.x / 32);
            const ty = Math.floor(point.y / 32);
            return map.data[ty]?.[tx] === 0 && Phaser.Math.Distance.Between(point.x, point.y, player.x, player.y) >= 96;
        });
        return valid || map.objects.playerStart;
    }

    start() {
        if (this.chaser?.active) return;
        const flags = ensureStoryFlags(this.scene.gameState);
        flags.chasePhase = 'active';
        this.scene.gameState.isChasing = true;
        const spawn = this.resolveSpawn();
        this.chaser = this.scene.physics.add.sprite(spawn.x, spawn.y, 'npc_paper').setTint(0xff0000).setAlpha(0.8);
        if (!this.scene.isMobile) this.chaser.setPipeline('Light2D');
        this.scene.chaser = this.chaser;
        this.scene.physics.add.collider(this.chaser, this.scene.walls);
        this.scene.physics.add.collider(this.chaser, this.scene.furniture);
        if (this.scene.trees) this.scene.physics.add.collider(this.chaser, this.scene.trees);
        this.scene.physics.add.overlap(this.scene.player.sprite, this.chaser, () => this.handleCaught());
        this.scene.refreshObjective();
    }

    update() {
        if (!this.chaser?.active || this.scene.gameState.isHidden || this.caught) return;
        this.scene.physics.moveToObject(this.chaser, this.scene.player.sprite, 100);
    }

    startHideEscape() {
        if (!this.chaser?.active || this.hideTimer) return;
        this.hideTimer = this.scene.time.delayedCall(HIDE_ESCAPE_MS, () => {
            this.hideTimer = null;
            if (this.scene.gameState.isHidden) this.escape('hide');
        });
    }

    cancelHideEscape() {
        this.hideTimer?.remove();
        this.hideTimer = null;
    }

    escape(reason) {
        const flags = ensureStoryFlags(this.scene.gameState);
        if (flags.chasePhase !== 'active') return;
        this.cancelHideEscape();
        flags.chasePhase = 'escaped';
        this.scene.gameState.isChasing = false;
        this.chaser?.destroy();
        this.chaser = null;
        this.scene.chaser = null;
        const text = reason === 'photo'
            ? '全家福里的三个人同时看向黑影。它停下了，像终于认出了你。'
            : '脚步声在柜门外停了六秒，随后慢慢远去。';
        window.showDialog('主角', text);
        this.scene.refreshObjective();
    }

    handleCaught() {
        if (this.caught) return;
        this.caught = true;
        this.scene.physics.pause();
        window.showDialog('暴怒的黑影', '抓到你了……但这次记忆没有把你送回最初。', () => {
            this.scene.physics.resume();
            this.scene.gameState.isHidden = false;
            const map = Maps[this.scene.currentMapId];
            this.scene.scene.restart({
                mapId: this.scene.currentMapId,
                x: map.objects.playerStart.x,
                y: map.objects.playerStart.y,
                previousMapId: this.scene.previousMapId
            });
        });
    }

    destroy() {
        this.cancelHideEscape();
        this.chaser?.destroy();
        this.chaser = null;
        this.scene.chaser = null;
    }
}
```

- [ ] **Step 5: GameScene 使用 ChaseManager**

删除 `spawnChaser()`、`updateChaser()` 的场景内实现。`create()` 建立 `this.chaseManager = new ChaseManager(this)`，若 `chasePhase === 'active'` 则调用 `start()`；`update()` 调用 manager.update；进入躲藏调用 `startHideEscape()`，离开躲藏调用 `cancelHideEscape()`；shutdown 调用 `destroy()`。

- [ ] **Step 6: 接入井边启动和全家福反制**

井事件取得血红钥匙后设置 `flags.chasePhase = 'active'` 并调用 `scene.chaseManager.start()`。追逐活跃且玩家在正厅调查供桌、同时 `familyPhotoAssembled` 为 true 时，优先调用 `scene.chaseManager.escape('photo')`，不执行供品仪式分支。

- [ ] **Step 7: 登记构建依赖并运行验证**

把 `ChaseManager.js` 放在 `GameScene.js` 之前，并重建单文件入口。运行：

Run: `node tools/verify_chase_contract.mjs; node tools/verify_progression.mjs; node --check src/systems/ChaseManager.js; node --check src/scenes/GameScene.js; node tools/build_standalone_entry.mjs; node tools/verify_standalone_entry.mjs`

Expected: 两项验证输出 `passed`，两项语法检查退出码为 0。

- [ ] **Step 8: 提交全家福与追逐**

```powershell
git add -- src/systems/ChaseManager.js src/systems/StoryState.js src/systems/InteractionManager.js src/systems/MapManager.js src/scenes/GameScene.js tools/verify_chase_contract.mjs tools/build_standalone_entry.mjs index.html
git commit -m "feat: make the family photo counter a short chase"
```

### Task 6: 接通四个清晰可达的结局

**Files:**
- Modify: `src/systems/InteractionManager.js`
- Modify: `src/systems/MapManager.js`
- Modify: `src/data/Maps.js`
- Modify: `tools/verify_progression.mjs`

- [ ] **Step 1: 扩充失败测试覆盖棺材和车祸证据门槛**

在 `verify_progression.mjs` 加入：低状态出口为 `ending_pojian`；双谜题出口为 `ending_huisha`；全家福、死亡 2 条、棺材打开后为 `memory_crash`；只有 `crashEvidence.car` 与 `guardrail` 同时为 true 时才能调用最终选择。

- [ ] **Step 2: 仪式完成后重新开放大门**

`MapManager` 创建通往 `room_entrance` 的门时使用：

```js
if (door.targetMap === 'room_entrance' && scene.gameState.doorSlammed && !scene.gameState.candlesLit) {
    door.locked = true;
}
```

供品仪式首次成功后设置 `candlesLit = true`，刷新目标，并把当前场景通往入口的门 `locked = false`。

- [ ] **Step 3: 改写开棺逻辑**

有血红钥匙且仪式完成时，首次开棺设置 `flags.coffinOpened = true` 并收集 `coffin_truth`。随后若 `getTruthLevel(state) === 'complete'`，显示真相对白并切到 `memory_crash`；否则显示“我知道家里发生了什么，但还没拼出自己死亡的全部过程”，留在正厅并引导玩家从大门选择低或中结局。

- [ ] **Step 4: 出口只使用 getExitRoute**

`exit_door` 分支读取 `getExitRoute(gameState)`：`memory_crash` 切地图；`ending_huisha` 显示“回煞”；`ending_pojian` 显示“破茧”。删除出口内重复的线索计数判断。

- [ ] **Step 5: 车祸调查写入 evidence，最终选择受门槛保护**

调查 `crash_car_memory` 后设置 `flags.crashEvidence.car = true`；调查 `crash_guardrail` 后设置 `guardrail = true`。两项都为 true 时设置 `flags.memories.crash = true`。`final_leave` 和 `final_return` 交互前调用 `canChooseCrashEnding`，不足时显示“车门和护栏之间还缺一段记忆”，不执行选择。

- [ ] **Step 6: 运行结局验证**

Run: `node tools/verify_progression.mjs; node tools/verify_maps.mjs; node --check src/systems/InteractionManager.js`

Expected: 两项验证输出 `passed`，语法检查退出码为 0。

- [ ] **Step 7: 提交结局路由**

```powershell
git add -- src/systems/InteractionManager.js src/systems/MapManager.js src/data/Maps.js tools/verify_progression.mjs
git commit -m "feat: make all four endings intentional"
```

### Task 7: 统一剧情文本、文档和完整验收

**Files:**
- Modify: `STORY.md`
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `docs/GAME_FLOW.md`
- Modify: `DEV_LOG.md`
- Modify: `index.html`

- [ ] **Step 1: 统一正史文本**

把 README、STORY 和游戏关键对白统一为：十年前李明因父亲控制离家并死于车祸；母亲先有自伤未遂、后来投井；父亲死于宅中并以黑影执念追逐；当前雨夜是十周年忌夜的记忆循环。“回煞”解释为执念回返，不写成刚死七天。

- [ ] **Step 2: 更新 GAME_FLOW 与 ROADMAP**

`GAME_FLOW.md` 写清 18 张地图用途、地下室缺角、双谜题、短追逐和四结局条件；`ROADMAP.md` 标记数据地图、追逐、躲藏与多结局已完成，把后续方向改成音效、美术和试玩反馈，不再声称 `localStorage` 已实现。

- [ ] **Step 3: 重建单文件入口并运行全部自动化**

```powershell
node tools/build_standalone_entry.mjs
$scripts = rg --files tools | Where-Object { $_ -match '^tools\\verify_.*\.mjs$' }
foreach ($script in $scripts) { node $script; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
$files = rg --files src tools | Where-Object { $_ -match '\.(js|mjs)$' }
foreach ($file in $files) { node --check $file; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
git diff --check
```

Expected: 所有验证输出 `passed`，语法检查全部退出 0，差异检查无输出。

- [ ] **Step 4: 浏览器完成桌面与移动烟测**

桌面流程覆盖：开局、供品收集、学校谜题、医院谜题、走廊照片、地下禁闭室缺角、井边追逐、全家福反制、供桌开棺，以及“破茧”“回煞”和一条完整真相结局。390×844 与横屏尺寸覆盖：目标 HUD、谜题浮层、文档关闭、躲藏退出和地图连续切换。控制台错误必须为 0。

- [ ] **Step 5: 更新 2026-07-11 技术日志**

记录最终文件、验证命令、各地图用途、地下室可达性、谜题与结局门槛、浏览器验收结果、未完成风险和后续适用边界。日志不得写未实际执行的验证。

- [ ] **Step 6: 提交文档和构建产物**

```powershell
git add -- STORY.md README.md ROADMAP.md docs/GAME_FLOW.md DEV_LOG.md index.html
git commit -m "docs: synchronize the finished 2d game flow"
```

- [ ] **Step 7: 删除已合并旧分支并做最终状态检查**

只有在 `git merge-base --is-ancestor codex/3d-prototype-entry HEAD` 返回 0 时执行 `git branch -d codex/3d-prototype-entry`。随后运行 `git status --short --branch`，要求工作树干净且当前分支仍为 `codex/2d-rework`。
