# 《回煞》实体解谜 Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 15–20 minute, three-space vertical slice in which players solve a physical kitchen seating puzzle, learn a diegetic dinner-bell horror rule, make a costly paper-plane choice, and finish with suspicion rather than an early death reveal.

**Architecture:** Keep the legacy game intact behind `?legacy=1`, and make the redesign branch start in an isolated slice route. Add focused slice modules for state, map data, physical interactions, kitchen rules, authored memory replays, house-rule horror, and narrative leakage guards; `GameScene` only selects legacy or slice systems and owns lifecycle wiring.

**Tech Stack:** Phaser 3, native ES modules bundled into the existing standalone `index.html`, Web Audio through `SoundManager`, Node.js `assert` verification scripts, PowerShell verification commands.

**Spec:** `docs/superpowers/specs/2026-07-15-huisha-vertical-slice-redesign-design.md`

---

## File and responsibility map

### New production files

- `src/data/SliceMaps.js` — the three slice maps, direct topology, object anchors, and authored room-state metadata.
- `src/systems/SliceState.js` — normalized persistent slice state and guarded phase/choice transitions.
- `src/systems/KitchenTableRules.js` — pure bowl placement, contradiction selection, and solved-state logic.
- `src/systems/KitchenTableController.js` — Phaser bowl/seat entities, held-bowl state, and replay requests.
- `src/systems/MemoryReplayDirector.js` — authored contradictory meal replays and the one correct replay.
- `src/systems/HouseRuleState.js` — pure dinner-bell attention and recovery transitions.
- `src/systems/HouseRuleDirector.js` — dinner-bell demonstration, warnings, door entry, and short pursuit runtime.
- `src/systems/SliceNarrativeDirector.js` — phase-bounded reactions and forbidden-reveal checks.
- `src/systems/SliceInteractionManager.js` — near/facing interaction focus and slice action routing without evidence-board UI.
- `src/systems/SliceMapManager.js` — slice-only room rendering, doors, props, collision, and persistent room revisions.

### Existing files modified at integration boundaries

- `src/systems/StoryState.js` — reserve and normalize `gameState.slice` without changing legacy story flags.
- `src/systems/StartRoute.js` — default to slice; preserve legacy via explicit query.
- `src/systems/TextureGenerator.js` — readable bowl, chair, table-slot, mirror, and plane-choice textures.
- `src/scenes/TitleScene.js` — start the slice by default and label the build as a redesign preview.
- `src/scenes/GameScene.js` — choose slice or legacy systems, carry `sliceMode` across rooms, and skip legacy random horror/UI in slice mode.
- `tools/build_standalone_entry.mjs` — bundle every new slice module in dependency order.
- `index.html` — generated only; never hand-edit bundled module copies.
- `README.md`, `DEV_LOG.md`, `docs/GAME_FLOW.md` — describe the preview route, archive boundary, and verification evidence.

### New verification and playtest files

- `tools/verify_slice_state.mjs`
- `tools/verify_slice_start_route.mjs`
- `tools/verify_slice_maps.mjs`
- `tools/verify_kitchen_table_rules.mjs`
- `tools/verify_slice_interactions.mjs`
- `tools/verify_memory_replays.mjs`
- `tools/verify_house_rule_state.mjs`
- `tools/verify_slice_narrative.mjs`
- `tools/verify_slice_runtime_contract.mjs`
- `tools/verify_slice_route.mjs`
- `docs/playtests/2026-07-15-vertical-slice-protocol.md`
- `docs/playtests/2026-07-15-vertical-slice-results.md`

## Implementation rules

- Every task begins with a failing verification and ends with its own commit.
- Do not delete legacy maps, puzzles, endings, or story flags during the slice.
- Do not hand-edit bundled code inside `index.html`; regenerate it.
- Do not add a generic clue board, “answer wrong” message, random core scare, or sanity penalty to the slice.
- Do not claim the slice is fun or complete from automation. Developer browser smoke and five-player blind testing are separate evidence.
- If a task requires changing more than the files listed for that task, stop and update this plan before broadening scope.

### Task 1: Persistent slice state foundation

**Files:**
- Create: `src/systems/SliceState.js`
- Create: `tools/verify_slice_state.mjs`
- Modify: `src/systems/StoryState.js:26-48`
- Modify: `tools/build_standalone_entry.mjs:5-31`

- [ ] **Step 1: Write the failing slice-state verification**

```js
// tools/verify_slice_state.mjs
import assert from 'node:assert/strict';
import {
    SLICE_PHASES,
    choosePlane,
    createDefaultSliceState,
    ensureSliceState,
    transitionSlicePhase
} from '../src/systems/SliceState.js';

const initial = createDefaultSliceState();
assert.deepEqual(initial.bowlPlacements, { nail: null, stove: null, side: null });
assert.equal(initial.slicePhase, 'arrival');
assert.equal(initial.fatherAttention, 'quiet');
assert.equal(initial.planeChoice, null);
assert.deepEqual(SLICE_PHASES, ['arrival', 'investigation', 'table', 'rule', 'bedroom', 'return', 'complete']);

const gameState = {};
assert.equal(ensureSliceState(gameState), gameState.slice);
assert.deepEqual(gameState.slice, initial);
const investigated = transitionSlicePhase(gameState.slice, 'investigation');
assert.equal(investigated.slicePhase, 'investigation');
assert.equal(transitionSlicePhase(investigated, 'table').slicePhase, 'table');
assert.throws(() => transitionSlicePhase(gameState.slice, 'complete'), /cannot skip/i);
assert.equal(choosePlane(gameState.slice, 'take').planeChoice, 'take');
assert.throws(() => choosePlane(choosePlane(gameState.slice, 'leave'), 'take'), /locked/i);

console.log('Slice state verification passed');
```

- [ ] **Step 2: Run the verification and confirm the missing-module failure**

Run: `node tools\verify_slice_state.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/systems/SliceState.js`.

- [ ] **Step 3: Implement the complete pure state module**

```js
// src/systems/SliceState.js
export const SLICE_PHASES = ['arrival', 'investigation', 'table', 'rule', 'bedroom', 'return', 'complete'];

export function createDefaultSliceState() {
    return {
        enabled: true,
        slicePhase: 'arrival',
        bowlPlacements: { nail: null, stove: null, side: null },
        heldBowl: null,
        mealReplaySeen: [],
        tableSolved: false,
        houseRuleDemonstrated: false,
        fatherAttention: 'quiet',
        lastTraversedDoor: 'main_to_kitchen',
        planeChoice: null,
        paperDollIndex: 0,
        sliceCompleted: false
    };
}

export function ensureSliceState(gameState) {
    if (!gameState.slice || typeof gameState.slice !== 'object' || Array.isArray(gameState.slice)) {
        gameState.slice = createDefaultSliceState();
    }
    const defaults = createDefaultSliceState();
    gameState.slice = {
        ...defaults,
        ...gameState.slice,
        bowlPlacements: { ...defaults.bowlPlacements, ...(gameState.slice.bowlPlacements || {}) },
        mealReplaySeen: Array.isArray(gameState.slice.mealReplaySeen) ? [...new Set(gameState.slice.mealReplaySeen)] : []
    };
    return gameState.slice;
}

export function transitionSlicePhase(state, nextPhase) {
    const current = SLICE_PHASES.indexOf(state.slicePhase);
    const next = SLICE_PHASES.indexOf(nextPhase);
    if (next < 0) throw new Error(`Unknown slice phase: ${nextPhase}`);
    if (next > current + 1) throw new Error(`Slice phase cannot skip from ${state.slicePhase} to ${nextPhase}`);
    if (next < current) return state;
    return { ...state, slicePhase: nextPhase, sliceCompleted: nextPhase === 'complete' };
}

export function choosePlane(state, choice) {
    if (!['take', 'leave'].includes(choice)) throw new Error(`Unknown plane choice: ${choice}`);
    if (state.planeChoice && state.planeChoice !== choice) throw new Error('Plane choice is locked');
    return { ...state, planeChoice: choice };
}
```

Add `slice: null` to `createDefaultGameState()` and call `ensureSliceState(gameState)` only when `gameState.slice?.enabled` is true or the scene explicitly starts slice mode. Add `src/systems/SliceState.js` after `StoryState.js` in the standalone build list.

- [ ] **Step 4: Run focused and legacy state checks**

Run: `node tools\verify_slice_state.mjs; node tools\verify_story_state.mjs; node tools\verify_progression.mjs`

Expected: all three print their `passed` messages; legacy default story flags remain unchanged.

- [ ] **Step 5: Commit the state foundation**

```powershell
git add -- src/systems/SliceState.js src/systems/StoryState.js tools/verify_slice_state.mjs tools/build_standalone_entry.mjs
git commit -m "feat: add isolated vertical slice state"
```

### Task 2: Default slice route with explicit legacy escape hatch

**Files:**
- Create: `tools/verify_slice_start_route.mjs`
- Modify: `src/systems/StartRoute.js:1-23`
- Modify: `src/scenes/TitleScene.js:31-75`
- Modify: `tools/verify_start_route.mjs:1-7`

- [ ] **Step 1: Write the failing route contract**

```js
// tools/verify_slice_start_route.mjs
import assert from 'node:assert/strict';
import { resolveStartRoute } from '../src/systems/StartRoute.js';

assert.deepEqual(resolveStartRoute(''), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?map=room_kitchen'), {
    scene: 'GameScene',
    data: { mapId: 'room_kitchen', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?legacy=1'), { scene: 'IntroScene', data: undefined });
assert.deepEqual(resolveStartRoute('?legacy=1&map=memory_school'), {
    scene: 'GameScene',
    data: { mapId: 'memory_school', sliceMode: false }
});
assert.deepEqual(resolveStartRoute('?map=missing_map'), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true }
});

console.log('Slice start route verification passed');
```

- [ ] **Step 2: Run and observe the old IntroScene default**

Run: `node tools\verify_slice_start_route.mjs`

Expected: FAIL because the current empty search resolves to `IntroScene`.

- [ ] **Step 3: Implement route selection without deleting debug access**

Update `resolveStartRoute()` so it:

```js
const params = new URLSearchParams(search);
const legacy = params.get('legacy') === '1';
const requestedMap = params.get('map');

if (!legacy) {
    const mapId = ['room_main', 'room_kitchen', 'room_bedroom_me'].includes(requestedMap)
        ? requestedMap
        : 'room_main';
    return { scene: 'GameScene', data: { mapId, sliceMode: true } };
}

if (!requestedMap || !Maps[requestedMap]) return { scene: 'IntroScene', data: undefined };
const data = { mapId: requestedMap, sliceMode: false };
```

Retain the existing explicit `x`/`y` parsing for both branches. Change the title subtitle to `实体解谜重做预览` and keep `开始游戏 [空格]`; move the author contact out of the primary title hierarchy by using 14px, low-contrast text at the bottom.

- [ ] **Step 4: Update the legacy route test and run both contracts**

Run: `node tools\verify_start_route.mjs; node tools\verify_slice_start_route.mjs`

Expected: both pass; legacy direct maps require `?legacy=1&map=...`.

- [ ] **Step 5: Commit the route split**

```powershell
git add -- src/systems/StartRoute.js src/scenes/TitleScene.js tools/verify_start_route.mjs tools/verify_slice_start_route.mjs
git commit -m "feat: make the diegetic slice the default route"
```

### Task 3: Three-space slice topology and data contract

**Files:**
- Create: `src/data/SliceMaps.js`
- Create: `tools/verify_slice_maps.mjs`
- Modify: `tools/build_standalone_entry.mjs:5-32`

- [ ] **Step 1: Write the failing topology verification**

```js
// tools/verify_slice_maps.mjs
import assert from 'node:assert/strict';
import { SliceMaps, getSliceDoorAccess } from '../src/data/SliceMaps.js';
import { createDefaultSliceState } from '../src/systems/SliceState.js';

assert.deepEqual(Object.keys(SliceMaps), ['room_main', 'room_kitchen', 'room_bedroom_me']);
for (const map of Object.values(SliceMaps)) {
    assert.ok(map.name && map.purpose);
    assert.ok(map.width >= 18 && map.height >= 14);
    assert.equal(map.data.length, map.height);
    assert.ok(map.data.every(row => row.length === map.width));
}

const kitchenDoors = SliceMaps.room_kitchen.objects.doors;
assert.ok(kitchenDoors.some(door => door.id === 'kitchen_side_door' && door.targetMap === 'room_bedroom_me'));
assert.equal(getSliceDoorAccess('kitchen_side_door', createDefaultSliceState()), false);
assert.equal(getSliceDoorAccess('kitchen_side_door', { ...createDefaultSliceState(), tableSolved: true }), true);
assert.equal(getSliceDoorAccess('bedroom_side_door', { ...createDefaultSliceState(), planeChoice: 'take' }), true);
assert.equal(getSliceDoorAccess('bedroom_side_door', { ...createDefaultSliceState(), planeChoice: 'leave' }), false);
assert.equal(getSliceDoorAccess('bedroom_main_door', { ...createDefaultSliceState(), planeChoice: 'leave' }), true);

console.log('Slice map verification passed');
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `node tools\verify_slice_maps.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `SliceMaps.js`.

- [ ] **Step 3: Implement boxed-room data and exact door gates**

Create `boxedRoom(width, height, openings)` that fills boundary cells with `1`, interior cells with `0`, and replaces declared boundary openings with `0`. Define:

```js
export const SliceMaps = {
    room_main: {
        id: 'room_main', name: '正厅', purpose: '听见第四副碗筷并进入厨房',
        width: 24, height: 18,
        data: boxedRoom(24, 18, [[23, 8]]),
        visual: { ambient: 0x5a4638, floorTint: 0x8c745d, wallTint: 0x5d4535, rain: false },
        objects: {
            playerStart: { x: 384, y: 496 },
            doors: [{ id: 'main_kitchen_door', x: 23, y: 8, targetMap: 'room_kitchen', targetX: 64, targetY: 256 }],
            props: [
                { id: 'main_cold_bowl', kind: 'observe', texture: 'bowl_offering', x: 384, y: 220, label: '积灰冷碗', text: '三只碗有擦拭痕迹，只有这只积着灰。' },
                { id: 'main_kitchen_sound', kind: 'ambient_anchor', effect: 'four_place_settings', x: 700, y: 256 },
                { id: 'main_kitchen_light', kind: 'ambient_anchor', effect: 'warm_door_seam', x: 730, y: 256 },
                { id: 'main_food_smell', kind: 'ambient_anchor', effect: 'faint_rice_steam', x: 640, y: 256 }
            ]
        }
    },
    room_kitchen: {
        id: 'room_kitchen', name: '厨房', purpose: '用碗、桌位和残影还原饭桌',
        width: 20, height: 16,
        data: boxedRoom(20, 16, [[0, 8], [19, 8]]),
        visual: { ambient: 0x594638, floorTint: 0x846b52, wallTint: 0x553d2d, rain: false },
        objects: {
            playerStart: { x: 64, y: 256 },
            doors: [
                { id: 'kitchen_main_door', x: 0, y: 8, targetMap: 'room_main', targetX: 704, targetY: 272 },
                { id: 'kitchen_side_door', x: 19, y: 8, targetMap: 'room_bedroom_me', targetX: 64, targetY: 256, gate: 'tableSolved' }
            ],
            table: {
                x: 320, y: 240,
                seats: { nail: { x: 320, y: 176 }, stove: { x: 384, y: 240 }, side: { x: 320, y: 304 } },
                offering: { x: 256, y: 240 },
                bowlOrigins: { wine: { x: 176, y: 120 }, medicine: { x: 224, y: 120 }, child: { x: 272, y: 120 } }
            },
            props: [
                { id: 'nailed_chair', kind: 'observe', texture: 'chair_nailed', x: 320, y: 160, label: '钉死的椅子', text: '椅脚钉进地板，坐在这里能看住两扇门。' },
                { id: 'stove_stain', kind: 'observe', texture: 'stove', x: 480, y: 112, label: '药渍和烫痕', text: '药汁从灶边一路滴到靠灶桌位。' },
                { id: 'door_shard', kind: 'observe', texture: 'blue_shard', x: 560, y: 272, label: '蓝边碎瓷', text: '碎瓷卡在侧门门槛下，像从碗口崩下来的。' }
            ]
        }
    },
    room_bedroom_me: {
        id: 'room_bedroom_me', name: '孩子卧室', purpose: '决定带走还是留下纸飞机',
        width: 20, height: 16,
        data: boxedRoom(20, 16, [[0, 8], [10, 15]]),
        visual: { ambient: 0x4b5063, floorTint: 0x677083, wallTint: 0x3d4353, rain: false },
        objects: {
            playerStart: { x: 64, y: 256 },
            doors: [
                { id: 'bedroom_side_door', x: 0, y: 8, targetMap: 'room_kitchen', targetX: 576, targetY: 256, gate: 'planeTake' },
                { id: 'bedroom_main_door', x: 10, y: 15, targetMap: 'room_main', targetX: 384, targetY: 128, gate: 'planeChosen' }
            ],
            props: [
                { id: 'bedroom_plane', kind: 'plane', texture: 'toy_plane', x: 300, y: 220, label: '折断的纸飞机' },
                { id: 'plane_bag', kind: 'plane_choice', choice: 'take', texture: 'cabinet', x: 420, y: 250, label: '旧书包' },
                { id: 'plane_drawer', kind: 'plane_choice', choice: 'leave', texture: 'desk', x: 180, y: 250, label: '抽屉' },
                { id: 'child_mirror', kind: 'mirror', texture: 'slice_mirror', x: 320, y: 96, label: '过低的镜子' },
                { id: 'school_uniform', kind: 'observe', texture: 'slice_uniform', x: 470, y: 120, label: '叠好的旧校服', text: '袖口内侧缝着一小块蓝布，像是留给谁辨认。' },
                { id: 'unused_ticket', kind: 'observe', texture: 'train_ticket', x: 222, y: 190, label: '未寄出的车票', text: '车票只写了离开日期，背面没有回程。' },
                { id: 'comic_stack', kind: 'observe', texture: 'comic_stack', x: 500, y: 290, label: '压在床脚的漫画', text: '最后一册夹着一张画：孩子从侧门跑出去。' }
            ]
        }
    }
};

export function getSliceDoorAccess(doorId, state) {
    if (doorId === 'kitchen_side_door') return state.tableSolved;
    if (doorId === 'bedroom_side_door') return state.planeChoice === 'take';
    if (doorId === 'bedroom_main_door') return state.planeChoice !== null;
    return true;
}
```

Add the file immediately after `Maps.js` in the standalone bundle list.

- [ ] **Step 4: Run topology and legacy map checks**

Run: `node tools\verify_slice_maps.mjs; node tools\verify_maps.mjs; node tools\verify_map_purpose.mjs`

Expected: all pass; legacy `Maps` still contains 18 maps.

- [ ] **Step 5: Commit the slice topology**

```powershell
git add -- src/data/SliceMaps.js tools/verify_slice_maps.mjs tools/build_standalone_entry.mjs
git commit -m "feat: define the three-space horror slice"
```

### Task 4: Physical kitchen puzzle rules

**Files:**
- Create: `src/systems/KitchenTableRules.js`
- Create: `tools/verify_kitchen_table_rules.mjs`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: Write exhaustive failing rules tests**

```js
// tools/verify_kitchen_table_rules.mjs
import assert from 'node:assert/strict';
import { CORRECT_SEATING, evaluateSeating, placeBowl, selectContradiction } from '../src/systems/KitchenTableRules.js';

const empty = { nail: null, stove: null, side: null };
assert.deepEqual(placeBowl(empty, 'nail', 'wine'), { nail: 'wine', stove: null, side: null });
assert.deepEqual(placeBowl({ nail: 'wine', stove: null, side: null }, 'stove', 'wine'), { nail: null, stove: 'wine', side: null });
assert.equal(evaluateSeating(empty).status, 'incomplete');
assert.deepEqual(evaluateSeating(CORRECT_SEATING), { status: 'correct', contradictions: [] });

const fatherWrong = { nail: 'medicine', stove: 'wine', side: 'child' };
assert.deepEqual(evaluateSeating(fatherWrong).contradictions, ['father_lock', 'mother_break']);
assert.equal(selectContradiction(fatherWrong, []), 'father_lock');
assert.equal(selectContradiction(fatherWrong, ['father_lock']), 'mother_break');
assert.equal(selectContradiction(fatherWrong, ['father_lock', 'mother_break']), 'father_lock');
assert.throws(() => placeBowl(empty, 'missing', 'wine'), /unknown seat/i);
assert.throws(() => placeBowl(empty, 'nail', 'missing'), /unknown bowl/i);

console.log('Kitchen table rules verification passed');
```

- [ ] **Step 2: Run and confirm the missing rules module**

Run: `node tools\verify_kitchen_table_rules.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement placement and contradiction selection**

```js
// src/systems/KitchenTableRules.js
export const KITCHEN_SEATS = ['nail', 'stove', 'side'];
export const KITCHEN_BOWLS = ['wine', 'medicine', 'child'];
export const CORRECT_SEATING = { nail: 'wine', stove: 'medicine', side: 'child' };
const CONTRADICTIONS = [
    ['nail', 'wine', 'father_lock'],
    ['stove', 'medicine', 'mother_break'],
    ['side', 'child', 'child_shard']
];

export function placeBowl(placements, seatId, bowlId) {
    if (!KITCHEN_SEATS.includes(seatId)) throw new Error(`Unknown seat: ${seatId}`);
    if (!KITCHEN_BOWLS.includes(bowlId)) throw new Error(`Unknown bowl: ${bowlId}`);
    const next = { ...placements };
    for (const seat of KITCHEN_SEATS) if (next[seat] === bowlId) next[seat] = null;
    next[seatId] = bowlId;
    return next;
}

export function evaluateSeating(placements) {
    if (KITCHEN_SEATS.some(seat => !placements[seat])) return { status: 'incomplete', contradictions: [] };
    const contradictions = CONTRADICTIONS
        .filter(([seat, bowl]) => placements[seat] !== bowl)
        .map(([, , replay]) => replay);
    return contradictions.length ? { status: 'incorrect', contradictions } : { status: 'correct', contradictions: [] };
}

export function selectContradiction(placements, seen = []) {
    const { contradictions } = evaluateSeating(placements);
    return contradictions.find(id => !seen.includes(id)) || contradictions[0] || null;
}
```

Add this module after `SliceState.js` in the bundle order.

- [ ] **Step 4: Run the focused rule test**

Run: `node tools\verify_kitchen_table_rules.mjs`

Expected: `Kitchen table rules verification passed`.

- [ ] **Step 5: Commit the puzzle model**

```powershell
git add -- src/systems/KitchenTableRules.js tools/verify_kitchen_table_rules.mjs tools/build_standalone_entry.mjs
git commit -m "feat: model the physical kitchen seating puzzle"
```

### Task 5: Slice rendering, readable props, and persistent doors

**Files:**
- Create: `src/systems/SliceMapManager.js`
- Create: `tools/verify_slice_runtime_contract.mjs`
- Modify: `src/systems/TextureGenerator.js:240-510`
- Modify: `src/scenes/GameScene.js:1-150`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: Write the failing render contract**

```js
// tools/verify_slice_runtime_contract.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
const manager = readFileSync(new URL('../src/systems/SliceMapManager.js', import.meta.url), 'utf8');
const textures = readFileSync(new URL('../src/systems/TextureGenerator.js', import.meta.url), 'utf8');
const builder = readFileSync(new URL('./build_standalone_entry.mjs', import.meta.url), 'utf8');

assert.match(scene, /this\.sliceMode\s*=\s*data\.sliceMode/);
assert.match(scene, /this\.sliceMode\s*\?\s*new SliceMapManager/);
assert.match(manager, /SliceMaps\[mapId\]/);
assert.match(manager, /getSliceDoorAccess/);
assert.match(manager, /obj\.sliceAction/);
for (const texture of ['bowl_wine', 'bowl_medicine', 'bowl_child', 'bowl_offering', 'chair_nailed', 'blue_shard', 'slice_mirror', 'slice_uniform', 'train_ticket', 'comic_stack']) {
    assert.match(textures, new RegExp(`generateTexture\\(['\"]${texture}`), `missing ${texture}`);
}
assert.match(builder, /src\/systems\/SliceMapManager\.js/);

console.log('Slice runtime contract verification passed');
```

- [ ] **Step 2: Run and confirm the missing manager failure**

Run: `node tools\verify_slice_runtime_contract.mjs`

Expected: FAIL because `SliceMapManager.js` does not exist.

- [ ] **Step 3: Generate readable slice textures**

Add a local `makeBowlTexture(key, baseColor, accentColor, mark)` helper inside `TextureGenerator.generate()` that draws a 28×20 ellipse, inner rim, and distinct mark. Generate:

```js
makeBowlTexture('bowl_wine', 0xb7a27e, 0x5b2e1f, 'chip');
makeBowlTexture('bowl_medicine', 0xe8e3d7, 0x7b8e52, 'stain');
makeBowlTexture('bowl_child', 0xd9e6ef, 0x3f6f9d, 'plane');
makeBowlTexture('bowl_offering', 0x8a8175, 0x4b4038, 'rice');
```

Also generate `chair_nailed` (48×56 with two bright nail heads), `blue_shard` (18×12 blue-edged triangle), `slice_mirror` (48×72 frame with dark reflective center), `slice_uniform` (folded dark uniform with one blue cuff patch), `train_ticket` (creased narrow paper with a punched corner), and `comic_stack` (three offset book silhouettes). The four bowls must remain distinguishable when rendered in grayscale by giving them different silhouettes or marks, not color alone.

- [ ] **Step 4: Implement `SliceMapManager` with the legacy-compatible scene surface**

The class must expose `createMap(mapId)` and assign `scene.walls`, `scene.doors`, `scene.furniture`, `scene.interactables`, `scene.floorLayer`, and `scene.navigationBlockedRects`, matching the surface used by `GameScene`, `Player`, and `ChaseManager`.

Use this exact interaction attachment shape:

```js
attachInteraction(obj, data) {
    obj.objId = data.id;
    obj.sliceAction = data.kind;
    obj.sliceData = { ...data };
    obj.interaction = normalizeInteractionMeta({
        id: data.id,
        dialog: data.text,
        interaction: {
            label: data.label || data.id,
            verb: data.verb || (data.kind === 'observe' ? '观察' : '操作'),
            priority: data.priority || 30,
            radius: data.radius || 72,
            marker: false,
            blocksMovement: data.blocksMovement ?? false
        }
    }, { textureKey: obj.texture?.key });
    this.scene.interactables.add(obj);
}
```

Door creation must keep every door sprite present but set `door.locked = !getSliceDoorAccess(door.id, sliceState)`. Expose `refreshDoorAccess()` so solving the table or choosing the plane updates doors without restarting the room. Create ordinary prop sprites from `SliceMaps[mapId].objects.props`; leave table bowls and seats for `KitchenTableController`. `ambient_anchor` entries are not sprites or interaction targets: route them to authored positional sound, door-seam light, and restrained steam particles, then destroy those effects with the room.

Add `applyRoomRevision(sliceState)` so re-entering a room reconstructs its persistent authored state instead of replaying initialization: the main table changes after `tableSolved` and again during `return`; the kitchen preserves bowl positions, solved replay, door lock, paper doll, light, and safe-zone changes; the bedroom preserves the selected plane action, mirror state, and door locks.

- [ ] **Step 5: Wire only the map-selection shell in `GameScene`**

In `init(data)`, set:

```js
this.sliceMode = data.sliceMode === true;
this.currentMapId = data.mapId || (this.sliceMode ? 'room_main' : 'room_prologue');
```

In `create()`, normalize slice state when enabled, select `SliceMapManager` vs `MapManager`, and select map data from `SliceMaps` vs `Maps`. Do not yet disable legacy systems; Task 10 handles the complete lifecycle split.

- [ ] **Step 6: Run render, map, texture, and syntax checks**

Run: `node tools\verify_slice_runtime_contract.mjs; node tools\verify_slice_maps.mjs; node tools\verify_maps.mjs; node --check src\systems\SliceMapManager.js; node --check src\scenes\GameScene.js`

Expected: all pass and no legacy map count changes.

- [ ] **Step 7: Commit the slice renderer**

```powershell
git add -- src/systems/SliceMapManager.js src/systems/TextureGenerator.js src/scenes/GameScene.js tools/verify_slice_runtime_contract.mjs tools/build_standalone_entry.mjs
git commit -m "feat: render the isolated slice spaces"
```

### Task 6: Near-field slice interactions and physical bowl handling

**Files:**
- Create: `src/systems/SliceInteractionManager.js`
- Create: `src/systems/KitchenTableController.js`
- Create: `tools/verify_slice_interactions.mjs`
- Modify: `src/scenes/GameScene.js:228-383`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: Write the failing interaction contract**

```js
// tools/verify_slice_interactions.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getSlicePrompt, routeSliceAction } from '../src/systems/SliceInteractionManager.js';

assert.equal(getSlicePrompt({ label: '酒味缺口碗', verb: '端起' }), '端起：酒味缺口碗  [空格/E]');
assert.equal(routeSliceAction('bowl'), 'table');
assert.equal(routeSliceAction('seat'), 'table');
assert.equal(routeSliceAction('observe'), 'observe');
assert.equal(routeSliceAction('plane_choice'), 'plane');
assert.equal(routeSliceAction('missing'), 'ignore');

const source = readFileSync(new URL('../src/systems/SliceInteractionManager.js', import.meta.url), 'utf8');
assert.match(source, /selectInteractionCandidate/);
assert.match(source, /focusBand/);
assert.doesNotMatch(source, /showPuzzle|caseConclusions|puzzleProgress/);

console.log('Slice interaction verification passed');
```

- [ ] **Step 2: Run and confirm the missing manager failure**

Run: `node tools\verify_slice_interactions.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the focused action router**

Export these pure helpers from `SliceInteractionManager.js`:

```js
export function getSlicePrompt(meta) {
    return `${meta.verb}：${meta.label}  [空格/E]`;
}

export function routeSliceAction(action) {
    if (['bowl', 'seat'].includes(action)) return 'table';
    if (['plane', 'plane_choice', 'mirror'].includes(action)) return 'plane';
    if (action === 'observe') return 'observe';
    return 'ignore';
}
```

The runtime manager must reuse `selectInteractionCandidate()` and the 28px focus band. It may show a prompt only while the object is inside its radius and in the near/facing candidate set. `observe` shows one short factual line; it must not collect clue IDs, open documents, or call `showPuzzle()`.

- [ ] **Step 4: Implement `KitchenTableController` entity ownership**

Create bowl sprites at `bowlOrigins`, seat hotspots at `seats`, and the fixed offering bowl at `offering`. Attach `sliceAction='bowl'` or `sliceAction='seat'` and readable labels. Provide:

```js
pickBowl(bowlId) {
    if (this.state.tableSolved) return { status: 'locked' };
    this.state.heldBowl = bowlId;
    return { status: 'holding', bowlId };
}

placeHeldBowl(seatId) {
    if (!this.state.heldBowl) return { status: 'empty_hands' };
    this.state.bowlPlacements = placeBowl(this.state.bowlPlacements, seatId, this.state.heldBowl);
    this.state.heldBowl = null;
    this.syncSprites();
    return evaluateSeating(this.state.bowlPlacements);
}
```

`syncSprites()` must position every bowl at its current seat or origin and call `body.updateFromGameObject()` when a static physics body exists. The held bowl follows the player with a fixed offset but has collision disabled until placed.

- [ ] **Step 5: Connect action routing in `GameScene`**

When `sliceMode` is true, instantiate `KitchenTableController` only in `room_kitchen`, instantiate `SliceInteractionManager`, and have `handleInteraction()` call the table controller for bowl/seat actions. Keep legacy `InteractionManager` untouched for `?legacy=1`.

- [ ] **Step 6: Run focused, interaction-focus, and physics checks**

Run: `node tools\verify_slice_interactions.mjs; node tools\verify_kitchen_table_rules.mjs; node tools\verify_interaction_focus.mjs; node tools\verify_physics_sync.mjs`

Expected: all pass; no slice source references `showPuzzle`.

- [ ] **Step 7: Commit physical interaction handling**

```powershell
git add -- src/systems/SliceInteractionManager.js src/systems/KitchenTableController.js src/scenes/GameScene.js tools/verify_slice_interactions.mjs tools/build_standalone_entry.mjs
git commit -m "feat: let players handle bowls in the room"
```

### Task 7: Authored contradiction replays instead of error messages

**Files:**
- Create: `src/systems/MemoryReplayDirector.js`
- Create: `tools/verify_memory_replays.mjs`
- Modify: `src/systems/KitchenTableController.js`
- Modify: `src/systems/SliceState.js`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: Write the failing replay selection test**

```js
// tools/verify_memory_replays.mjs
import assert from 'node:assert/strict';
import { getReplayDefinition, markReplaySeen, shouldUseShortReplay } from '../src/systems/MemoryReplayDirector.js';

assert.deepEqual(getReplayDefinition('father_lock'), {
    id: 'father_lock', durationMs: 4400, actor: 'father', consequence: 'lock_side_door'
});
assert.equal(getReplayDefinition('mother_break').consequence, 'return_stain_to_stove');
assert.equal(getReplayDefinition('child_shard').consequence, 'reject_shard_match');
assert.equal(getReplayDefinition('correct_meal').consequence, 'open_side_door');
assert.deepEqual(markReplaySeen([], 'father_lock'), ['father_lock']);
assert.deepEqual(markReplaySeen(['father_lock'], 'father_lock'), ['father_lock']);
assert.equal(shouldUseShortReplay(['father_lock'], 'father_lock'), true);
assert.equal(shouldUseShortReplay([], 'father_lock'), false);

console.log('Memory replay verification passed');
```

- [ ] **Step 2: Run and confirm the missing director failure**

Run: `node tools\verify_memory_replays.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement replay definitions and persistence helpers**

```js
export const MEAL_REPLAYS = {
    father_lock: { id: 'father_lock', durationMs: 4400, actor: 'father', consequence: 'lock_side_door' },
    mother_break: { id: 'mother_break', durationMs: 4200, actor: 'mother', consequence: 'return_stain_to_stove' },
    child_shard: { id: 'child_shard', durationMs: 3800, actor: 'child', consequence: 'reject_shard_match' },
    correct_meal: { id: 'correct_meal', durationMs: 5200, actor: 'family', consequence: 'open_side_door' }
};

export function getReplayDefinition(id) {
    if (!MEAL_REPLAYS[id]) throw new Error(`Unknown meal replay: ${id}`);
    return { ...MEAL_REPLAYS[id] };
}

export function markReplaySeen(seen, id) {
    return seen.includes(id) ? [...seen] : [...seen, id];
}

export function shouldUseShortReplay(seen, id) {
    return seen.includes(id);
}
```

- [ ] **Step 4: Add Phaser replay runtime with guaranteed cleanup**

`MemoryReplayDirector.play(id, { short, onComplete })` must:

- set `active=true` and prevent another replay from starting;
- create translucent `npc_paper` actors at the relevant seat;
- use a specific movement/sound/prop response for each replay;
- use 600–900ms localized feedback when `short=true`;
- destroy actors and timers on completion or scene shutdown;
- never call `showDialog`, `showDocument`, `showPuzzle`, or shake the camera longer than 120ms.

The correct replay must set `slice.tableSolved=true`, advance to `rule`, start rainwater ripples above the fixed offering bowl, and call `SliceMapManager.refreshDoorAccess()`.

- [ ] **Step 5: Request replays from complete table configurations**

After `placeHeldBowl()` returns `incorrect`, select an unseen contradiction and call the director. After `correct`, call `correct_meal`. While a replay is active, bowl interaction returns `{ status: 'replay_active' }`; player movement remains available.

- [ ] **Step 6: Run replay, table, and lifecycle checks**

Run: `node tools\verify_memory_replays.mjs; node tools\verify_kitchen_table_rules.mjs; node tools\verify_dom_listener_registry.mjs; node --check src\systems\MemoryReplayDirector.js`

Expected: all pass.

- [ ] **Step 7: Commit authored world feedback**

```powershell
git add -- src/systems/MemoryReplayDirector.js src/systems/KitchenTableController.js src/systems/SliceState.js tools/verify_memory_replays.mjs tools/build_standalone_entry.mjs
git commit -m "feat: replay contradictory family memories"
```

### Task 8: Learnable dinner-bell rule and fair father attention

**Files:**
- Create: `src/systems/HouseRuleState.js`
- Create: `src/systems/HouseRuleDirector.js`
- Create: `tools/verify_house_rule_state.mjs`
- Modify: `src/scenes/GameScene.js`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: Write the failing pure transition test**

```js
// tools/verify_house_rule_state.mjs
import assert from 'node:assert/strict';
import {
    advanceAttention,
    evaluateDinnerBell,
    isFatherSafeZone,
    recoverAttention,
    shouldPauseHouseRule
} from '../src/systems/HouseRuleState.js';

assert.equal(evaluateDinnerBell({ demonstrated: false, elapsedMs: 500, movedDistance: 40 }), 'demonstration');
assert.equal(evaluateDinnerBell({ demonstrated: true, elapsedMs: 2499, movedDistance: 0 }), 'listening');
assert.equal(evaluateDinnerBell({ demonstrated: true, elapsedMs: 2500, movedDistance: 0 }), 'obeyed');
assert.equal(evaluateDinnerBell({ demonstrated: true, elapsedMs: 600, movedDistance: 17 }), 'violated');
assert.equal(advanceAttention('quiet'), 'suspicious');
assert.equal(advanceAttention('suspicious'), 'checking');
assert.equal(advanceAttention('checking'), 'chasing');
assert.equal(advanceAttention('chasing'), 'chasing');
assert.equal(recoverAttention('chasing'), 'checking');
assert.equal(recoverAttention('quiet'), 'quiet');
assert.equal(shouldPauseHouseRule({ dialog: true }), true);
assert.equal(shouldPauseHouseRule({ replay: true }), true);
assert.equal(shouldPauseHouseRule({ switching: true }), true);
assert.equal(shouldPauseHouseRule({ carryingAnimation: true }), true);
assert.equal(shouldPauseHouseRule({}), false);
assert.equal(isFatherSafeZone({ zone: 'under_table', moving: false }), true);
assert.equal(isFatherSafeZone({ zone: 'under_table', moving: true }), false);
assert.equal(isFatherSafeZone({ zone: 'doorway', moving: false }), false);

console.log('House rule state verification passed');
```

- [ ] **Step 2: Run and confirm the missing state module**

Run: `node tools\verify_house_rule_state.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement deterministic rule transitions**

```js
const ATTENTION = ['quiet', 'suspicious', 'checking', 'chasing'];

export function evaluateDinnerBell({ demonstrated, elapsedMs, movedDistance }) {
    if (!demonstrated) return 'demonstration';
    if (movedDistance >= 16) return 'violated';
    if (elapsedMs >= 2500) return 'obeyed';
    return 'listening';
}

export function advanceAttention(level) {
    return ATTENTION[Math.min(ATTENTION.indexOf(level) + 1, ATTENTION.length - 1)];
}

export function recoverAttention(level) {
    return ATTENTION[Math.max(ATTENTION.indexOf(level) - 1, 0)];
}

export function shouldPauseHouseRule(state) {
    return Boolean(state.dialog || state.replay || state.switching || state.carryingAnimation);
}

export function isFatherSafeZone({ zone, moving }) {
    return zone === 'under_table' && !moving;
}
```

- [ ] **Step 4: Implement the authored director stages**

`HouseRuleDirector` must use these explicit stages, without random selection:

```js
const WARNING_STAGES = [
    { atMs: 0, id: 'bell' },
    { atMs: 550, id: 'knock' },
    { atMs: 1150, id: 'footsteps' },
    { atMs: 2000, id: 'door_shadow' },
    { atMs: 3200, id: 'door_check' }
];
```

First bell after `correct_meal` is a no-fail demonstration: family ghosts freeze, footsteps pass, and `houseRuleDemonstrated` becomes true. The second bell begins when the player approaches the kitchen exit. Obedience lowers attention and retreats the shadow. Violation advances attention; `checking` spawns the father silhouette at `lastTraversedDoor`, and `chasing` delegates an 8–12 second pursuit to the existing `ChaseManager` using its safe-door spawn and BFS pathing. A stationary player inside the authored `under_table` zone remains hidden during inspection; moving there exposes them. The side door is a second valid escape only while its current authored state is open.

The director must pause during dialogue, memory replay, scene switching, and bowl carrying placement animation. It must destroy timers, warning sprites, and door shadows on shutdown. No slice-facing text may contain `别动`, `它在听`, or a countdown.

- [ ] **Step 5: Preserve the last traversed door across room switches**

Before each slice door transition, write `slice.lastTraversedDoor = door.id`. Pass `sliceMode: true` through `switchScene()` data. On failure, restore the player to the current room’s pre-bell checkpoint in under 30 seconds of player time and retain `tableSolved`, bowl placements, replay history, house-rule demonstration, and plane choice. Never place the father or the restored player inside the other entity’s collision bounds.

- [ ] **Step 6: Run house-rule, chase, and grid checks**

Run: `node tools\verify_house_rule_state.mjs; node tools\verify_chase_timing.mjs; node tools\verify_grid_navigation.mjs; node tools\verify_chase_contract.mjs`

Expected: all pass; the old four-second cross-map chase contract remains available to legacy mode.

- [ ] **Step 7: Commit the unified horror rule**

```powershell
git add -- src/systems/HouseRuleState.js src/systems/HouseRuleDirector.js src/scenes/GameScene.js tools/verify_house_rule_state.mjs tools/build_standalone_entry.mjs
git commit -m "feat: teach horror through the dinner bell"
```

### Task 9: Costly paper-plane choice, paper-doll helper, and narrative leakage guard

**Files:**
- Create: `src/systems/SliceNarrativeDirector.js`
- Create: `tools/verify_slice_narrative.mjs`
- Modify: `src/systems/SliceState.js`
- Modify: `src/systems/SliceInteractionManager.js`
- Modify: `src/systems/SliceMapManager.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: Write the failing choice, paper-doll, and text-boundary verification**

```js
// tools/verify_slice_narrative.mjs
import assert from 'node:assert/strict';
import { SliceMaps } from '../src/data/SliceMaps.js';
import { choosePlane, createDefaultSliceState } from '../src/systems/SliceState.js';
import {
    findForbiddenReveal,
    getPlaneChoiceEffects,
    getSliceReaction,
    listSliceReactions,
    shouldPaperDollMove
} from '../src/systems/SliceNarrativeDirector.js';

assert.deepEqual(getPlaneChoiceEffects('take'), {
    sideDoorOpen: true,
    paperDollPresent: false,
    kitchenSafe: false
});
assert.deepEqual(getPlaneChoiceEffects('leave'), {
    sideDoorOpen: false,
    paperDollPresent: true,
    kitchenSafe: true
});
assert.throws(() => getPlaneChoiceEffects('burn'), /unknown plane choice/i);

assert.equal(shouldPaperDollMove({
    planeChoice: 'leave', facingDot: -0.8, movedDistance: 32, blocked: false
}), true);
assert.equal(shouldPaperDollMove({
    planeChoice: null, facingDot: -0.8, movedDistance: 32, blocked: false
}), true);
assert.equal(shouldPaperDollMove({
    planeChoice: 'leave', facingDot: 0.3, movedDistance: 32, blocked: false
}), false);
assert.equal(shouldPaperDollMove({
    planeChoice: 'take', facingDot: -0.8, movedDistance: 32, blocked: false
}), false);

const earlyLines = [
    getSliceReaction('arrival', 'cold_bowl'),
    getSliceReaction('table', 'wrong_meal'),
    getSliceReaction('bedroom', 'mirror'),
    getSliceReaction('return', 'plane_take'),
    getSliceReaction('return', 'plane_leave')
];
assert.equal(findForbiddenReveal(earlyLines), null);
function collectStrings(value) {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(collectStrings);
    if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
    return [];
}
assert.equal(findForbiddenReveal([
    ...collectStrings(SliceMaps),
    ...listSliceReactions()
]), null);
assert.match(findForbiddenReveal(['主角就是明儿。']), /主角就是明儿/);
assert.match(findForbiddenReveal(['这是我的忌日。']), /忌日/);
assert.match(findForbiddenReveal(['我已经死在雨夜。']), /已经死|死在雨夜/);
assert.match(findForbiddenReveal(['棺材里等的是我。']), /棺材/);

const chosen = choosePlane(createDefaultSliceState(), 'leave');
assert.equal(chosen.planeChoice, 'leave');
assert.equal(chosen.slicePhase, 'arrival');

console.log('Slice narrative verification passed');
```

- [ ] **Step 2: Run and confirm the missing narrative module**

Run: `node tools\verify_slice_narrative.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `SliceNarrativeDirector.js`.

- [ ] **Step 3: Implement bounded reactions and explicit choice consequences**

```js
// src/systems/SliceNarrativeDirector.js
const FORBIDDEN_REVEALS = [
    /主角(就)?是明儿/,
    /忌日/,
    /已经死/,
    /死在雨夜/,
    /棺材.{0,8}(等|装|躺).{0,4}(我|主角)/
];

const REACTIONS = {
    arrival: {
        cold_bowl: '三只碗留着新擦痕。第四只没有。'
    },
    table: {
        wrong_meal: '影子坐下了，但没有一个人碰筷子。'
    },
    bedroom: {
        mirror: '镜子挂得很低。我得弯腰才能照见脸。'
    },
    return: {
        plane_take: '书包沉了一下。侧门的插销自己弹开了。',
        plane_leave: '抽屉合上后，门外多了一道很轻的纸响。'
    }
};

const PLANE_EFFECTS = {
    take: { sideDoorOpen: true, paperDollPresent: false, kitchenSafe: false },
    leave: { sideDoorOpen: false, paperDollPresent: true, kitchenSafe: true }
};

export function getSliceReaction(phase, event) {
    return REACTIONS[phase]?.[event] || '';
}

export function listSliceReactions() {
    return Object.values(REACTIONS).flatMap(events => Object.values(events));
}

export function getPlaneChoiceEffects(choice) {
    const effects = PLANE_EFFECTS[choice];
    if (!effects) throw new Error(`Unknown plane choice: ${choice}`);
    return { ...effects };
}

export function shouldPaperDollMove({ planeChoice, facingDot, movedDistance, blocked }) {
    return planeChoice !== 'take' && facingDot <= -0.25 && movedDistance >= 24 && !blocked;
}

export function findForbiddenReveal(lines) {
    for (const line of lines.flat()) {
        const text = String(line || '');
        if (FORBIDDEN_REVEALS.some(pattern => pattern.test(text))) return text;
    }
    return null;
}
```

Keep all slice dialogue in `REACTIONS` or `MemoryReplayDirector.REPLAYS`; do not scatter story prose through interaction branches. `findForbiddenReveal()` is a development guard, not a runtime censor.

- [ ] **Step 4: Make the choice physical and irreversible**

After the player investigates the low mirror and folded plane, enable both authored action targets already declared in `SliceMaps`: `旧书包` means take the plane; `抽屉` means leave it. The first selected action calls `choosePlane()`, advances `bedroom -> return`, disables both choice targets, and revises the room:

- `take`: remove the plane, add it to the bag sprite, unlatch `bedroom_side_door`, remove the paper doll, and raise father attention by one level when the player returns through the kitchen.
- `leave`: slide the plane into the drawer, keep `bedroom_side_door` barred, open `bedroom_main_door`, and spawn the paper doll only after the player has turned away.

Both choices must reach `complete`. Never label either choice “good”, “bad”, or “true”. Re-entering the bedroom reconstructs the locked-in result from `slice.planeChoice`; it must not recreate both action targets. The final mirror interaction briefly lowers the reflected shoulders to child height and shows the same blue cuff patch as the old uniform, then restores the normal reflection as soon as the player moves. The protagonist does not comment on it.

- [ ] **Step 5: Add the paper doll as a bounded helper, not a quest marker**

The mother paper doll exists in the kitchen before the bedroom choice and may make its first non-hostile anchor move while `planeChoice` is still `null`. It may move at most twice across the whole slice and only when `shouldPaperDollMove()` returns true. It moves between authored anchors, never teleports into the player collision body, door, bowl origin, seat, or required observation path. Looking directly at it freezes it. Leaving the plane preserves the doll and lets its final pose point toward the under-table safe zone before the return bell; taking the plane removes it and the kitchen’s warm-light/rice-steam protection but opens the shorter side-door return route.

On slice completion at the main-hall table, play a six-second coda: rainwater in the cold fourth bowl reflects a child-height outline, then one drop breaks the image while the mother’s off-screen line says `饭凉了。`. Fade to a preview card that says `实体解谜重做预览结束`; do not expose the crash, coffin, death, or full ending truth. The preview card may be advanced immediately after it appears, so no unskippable sequence exceeds six seconds.

- [ ] **Step 6: Run narrative, state, and map contracts**

Run: `node tools\verify_slice_narrative.mjs; node tools\verify_slice_state.mjs; node tools\verify_slice_maps.mjs; node tools\verify_narrative_text.mjs`

Expected: all pass; the legacy narrative-text test remains unchanged.

- [ ] **Step 7: Commit choice consequences and spoiler control**

```powershell
git add -- src/systems/SliceNarrativeDirector.js src/systems/SliceState.js src/systems/SliceInteractionManager.js src/systems/SliceMapManager.js src/scenes/GameScene.js tools/verify_slice_narrative.mjs tools/build_standalone_entry.mjs
git commit -m "feat: make the paper plane choice reshape the house"
```

### Task 10: Complete slice lifecycle isolation and accessible physical controls

**Files:**
- Modify: `src/scenes/GameScene.js`
- Modify: `src/scenes/TitleScene.js`
- Modify: `src/systems/SliceInteractionManager.js`
- Modify: `tools/verify_slice_runtime_contract.mjs`
- Modify: `tools/verify_dom_listener_registry.mjs`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: Extend the failing runtime contract before wiring the scene**

Append to `tools/verify_slice_runtime_contract.mjs`:

```js
assert.match(scene, /if \(this\.sliceMode\) \{[\s\S]*ensureSliceState/);
assert.match(scene, /this\.sliceMode\s*\?\s*new SliceInteractionManager/);
assert.match(scene, /sliceMode:\s*this\.sliceMode/);
assert.match(scene, /this\.sliceMapManager\?\.destroy\(\)/);
assert.match(scene, /this\.sliceInteractionManager\?\.destroy\(\)/);
assert.match(scene, /this\.kitchenTableController\?\.destroy\(\)/);
assert.match(scene, /this\.memoryReplayDirector\?\.destroy\(\)/);
assert.match(scene, /this\.houseRuleDirector\?\.destroy\(\)/);

const sliceBranch = scene.match(/if \(this\.sliceMode\) \{([\s\S]*?)\n\s*\} else \{/i)?.[1] || '';
for (const forbidden of [
    'new ObjectiveManager',
    'new EventManager',
    'new HauntingDirector',
    'updateBoundedResource',
    'initMic',
    'showPuzzle'
]) {
    assert.doesNotMatch(sliceBranch, new RegExp(forbidden), `slice branch leaked ${forbidden}`);
}
```

- [ ] **Step 2: Run and confirm lifecycle assertions fail**

Run: `node tools\verify_slice_runtime_contract.mjs`

Expected: FAIL on the first missing slice lifecycle assertion.

- [ ] **Step 3: Split `GameScene` at construction, update, and shutdown boundaries**

In `init(data)`, set `this.sliceMode = Boolean(data.sliceMode)` before choosing the default map. In `create()`, share only sound, input, player, camera, and DOM listener setup. Then use one explicit branch:

```js
if (this.sliceMode) {
    this.sliceState = ensureSliceState(this.gameState);
    this.mapManager = new SliceMapManager(this);
    this.objectiveManager = null;
    this.eventManager = null;
    this.hauntingDirector = null;
    this.sliceMapManager = this.mapManager;
    // Create slice interaction, table, replay, and house-rule directors here.
} else {
    this.mapManager = new MapManager(this);
    this.objectiveManager = new ObjectiveManager(this.gameState, objectivePanel);
    this.eventManager = new EventManager(this);
    this.hauntingDirector = new HauntingDirector(this);
}
```

`ChaseManager` may exist in both branches because `HouseRuleDirector` delegates its short pursuit to the fixed BFS implementation. In slice mode it may start only from a dinner-bell violation; legacy `isChasing`, `chasePhase`, and cross-map persistence checks must not auto-start it.

In `update()`, return into `updateSlice(time, delta)` before legacy sanity, microphone, random event, objective, narrative-beat, and map-specific special cases. `updateSlice()` updates only player movement, physical interaction focus, table carrying, authored replay, house rule, paper doll, and allowed doors. Carry `sliceMode: this.sliceMode` in every `scene.restart()` call.

The shutdown handler must destroy all five slice managers, the shared chase manager, joystick listeners, timers, overlays, held-bowl sprites, door shadows, replay ghosts, and paper doll. Destruction must be idempotent.

- [ ] **Step 4: Remove legacy HUD semantics from the slice**

In slice mode:

- hide `#objective-panel`, `#inventory`, `#sanity-container`, and microphone indicators;
- keep the joystick and one action button on mobile;
- never call `window.showPuzzle`, `window.updateSanityUI`, or `SoundManager.initMic()`;
- use only the near-field world prompt `动作：物件 [空格/E]`, with no global destination arrow or checklist;
- let room titles identify the current place once, then fade without a persistent HUD.

Desktop bowl handling is `Space/E` to pick up and the same action on a seat to place. Mobile uses the same single action button: tap near a bowl to carry it, walk near a seat, tap again to place. A held bowl follows behind the player with no collision body; door use and plane choice are disabled while a bowl is held.

- [ ] **Step 5: Verify repeated mobile lifecycle cleanup**

Extend `tools/verify_dom_listener_registry.mjs` with two create/destroy cycles for the slice action handler and assert that one touch produces one interaction after the second cycle. Do not add a second DOM registry or anonymous untracked listener for slice controls.

Run: `node tools\verify_slice_runtime_contract.mjs; node tools\verify_dom_listener_registry.mjs; node tools\verify_scene_runtime_contracts.mjs; node tools\verify_haunting_runtime_contract.mjs`

Expected: all pass; the slice excludes legacy systems while legacy mode still satisfies its contracts.

- [ ] **Step 6: Rebuild the standalone entry and syntax-check integration files**

Run: `node tools\build_standalone_entry.mjs; node --check src\scenes\GameScene.js; node --check src\systems\SliceInteractionManager.js; node tools\verify_standalone_entry.mjs`

Expected: build succeeds, both JavaScript source checks pass, and the standalone-entry verification confirms the generated inline module. Do not pass `index.html` to `node --check`; Node rejects the HTML extension before inspecting its inline script.

- [ ] **Step 7: Commit the isolated runtime**

```powershell
git add -- src/scenes/GameScene.js src/scenes/TitleScene.js src/systems/SliceInteractionManager.js tools/verify_slice_runtime_contract.mjs tools/verify_dom_listener_registry.mjs tools/build_standalone_entry.mjs index.html
git commit -m "refactor: isolate the vertical slice runtime"
```

### Task 11: Full-route state proof and two-viewport developer smoke

**Files:**
- Create: `tools/verify_slice_route.mjs`
- Modify: `src/systems/SliceState.js`
- Modify: `src/systems/KitchenTableRules.js`
- Modify: `src/systems/SliceNarrativeDirector.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `tools/verify_slice_runtime_contract.mjs`

- [ ] **Step 1: Write the failing two-branch route verification**

```js
// tools/verify_slice_route.mjs
import assert from 'node:assert/strict';
import {
    choosePlane,
    createDefaultSliceState,
    transitionSlicePhase
} from '../src/systems/SliceState.js';
import { CORRECT_SEATING, evaluateSeating } from '../src/systems/KitchenTableRules.js';
import { getPlaneChoiceEffects } from '../src/systems/SliceNarrativeDirector.js';

function completeRoute(choice) {
    let state = createDefaultSliceState();
    for (const phase of ['investigation', 'table']) state = transitionSlicePhase(state, phase);
    assert.equal(evaluateSeating(CORRECT_SEATING).status, 'correct');
    state = { ...state, bowlPlacements: { ...CORRECT_SEATING }, tableSolved: true };
    for (const phase of ['rule', 'bedroom']) state = transitionSlicePhase(state, phase);
    state = choosePlane(state, choice);
    state = transitionSlicePhase(state, 'return');
    state = transitionSlicePhase(state, 'complete');
    return { state, effects: getPlaneChoiceEffects(choice) };
}

const take = completeRoute('take');
const leave = completeRoute('leave');
for (const route of [take, leave]) {
    assert.equal(route.state.tableSolved, true);
    assert.equal(route.state.slicePhase, 'complete');
    assert.equal(route.state.sliceCompleted, true);
}
assert.equal(take.effects.sideDoorOpen, true);
assert.equal(take.effects.kitchenSafe, false);
assert.equal(leave.effects.sideDoorOpen, false);
assert.equal(leave.effects.kitchenSafe, true);
assert.notDeepEqual(take.effects, leave.effects);

console.log('Slice route verification passed');
```

- [ ] **Step 2: Run and confirm the route exposes unfinished transitions**

Run: `node tools\verify_slice_route.mjs`

Expected: FAIL until Tasks 1–10 expose all named transitions and effects exactly.

- [ ] **Step 3: Close only the integration gaps found by the route proof**

Make phase advancement idempotent, preserve `bowlPlacements`, `tableSolved`, `mealReplaySeen`, and `planeChoice` through room restarts, and ensure both choices call the same completion entry after their different return routes. Do not weaken transition guards or add a debug-only state jump to make the test pass.

Add a runtime assertion that slice maps are only entered with `sliceMode: true`; `?legacy=1&map=room_main` remains a deliberate legacy debug route and must use legacy data. Add a clear console error and return to the title if a slice map is missing required authored metadata instead of silently substituting a legacy map.

- [ ] **Step 4: Run focused and complete automated regression**

Run:

```powershell
node tools\verify_slice_route.mjs
node tools\verify_slice_state.mjs
node tools\verify_slice_maps.mjs
node tools\verify_kitchen_table_rules.mjs
node tools\verify_memory_replays.mjs
node tools\verify_house_rule_state.mjs
node tools\verify_slice_narrative.mjs
node tools\verify_slice_runtime_contract.mjs
node tools\build_standalone_entry.mjs
Get-ChildItem tools\verify_*.mjs | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Failed: $($_.Name)" } }
Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Syntax failed: $($_.FullName)" } }
git diff --check
```

Expected: every verification and syntax check exits 0; `git diff --check` is silent.

- [ ] **Step 5: Perform a primary-route developer smoke at 1280×720**

Start from the ordinary title screen with no query parameters. Do not use direct-map URLs or mutate state in the console for this pass. Verify in order:

1. The title enters `room_main`; the cold fourth bowl and kitchen sound provide the first pull without an objective panel.
2. All three kitchen facts can be found through proximity/facing; bowls are picked up and placed physically.
3. At least one wrong full arrangement produces a specific contradictory replay and leaves the table available for immediate revision.
4. The correct arrangement produces `correct_meal`; the first dinner bell demonstrates the freeze rule without failure.
5. A deliberate second-bell violation produces readable warning stages and a short BFS pursuit; a retry preserves puzzle progress and cannot spawn the father on the player.
6. Taking the plane opens the short side door, removes paper-doll help, changes the return danger, and still reaches the coda.

Record elapsed time, console errors, and every moment requiring developer knowledge.

- [ ] **Step 6: Reset and smoke the alternate choice at 390×844**

Return through the title to create fresh state. Use touch controls only. Verify bowl pick/place, all dialogue advances, and no prompt overlaps the joystick/action button. Leave the paper plane, confirm the side door remains barred, the paper doll moves only off-camera and points toward safety, then complete through the main-door route. Both passes must end on the preview card with zero uncaught console errors.

Direct-map queries may be used only after these two primary passes for targeted regressions such as repeated room switching, wrong arrangements, and scene shutdown.

- [ ] **Step 7: Commit the integrated candidate**

```powershell
git add -- src/systems/SliceState.js src/systems/KitchenTableRules.js src/systems/SliceNarrativeDirector.js src/scenes/GameScene.js tools/verify_slice_route.mjs tools/verify_slice_runtime_contract.mjs index.html
git commit -m "test: prove both vertical slice routes"
```

### Task 12: Playtest package, project documentation, and candidate verification

**Files:**
- Create: `docs/playtests/2026-07-15-vertical-slice-protocol.md`
- Create: `docs/playtests/2026-07-15-vertical-slice-results.md`
- Modify: `docs/GAME_FLOW.md`
- Modify: `README.md`
- Modify: `DEV_LOG.md`

- [ ] **Step 1: Write the blind-playtest protocol before recruiting players**

The protocol must forbid coaching and developer commentary. Give each of five players a fresh build and this single instruction: `请正常玩到它明确结束；卡住时可以说出你在想什么。` Record screen, input, and spoken reasoning with consent.

For every player, capture these exact fields:

```md
| Metric | Value |
|---|---|
| First meaningful interaction time | |
| First kitchen inference in own words | |
| Wrong arrangements before solve | |
| Table solve time | |
| Two spatial facts recalled after solve | |
| Exhausted combinations instead of reasoning? | yes / no |
| Predicted or obeyed the second bell unaided? | yes / partial / no |
| Paper-plane choice and stated reason | |
| Completion time | |
| Unprompted remembered image/line after 10 minutes | |
| Explained father / mother / child relationship | |
| Certain the protagonist is dead at slice end? | yes / no |
| Longest aimless wandering interval | |
| Wants to continue to the next chapter? | yes / no |
| Bug / collision / interaction failure | |
```

After play, ask only neutral questions: `你觉得刚才发生了什么？`, `哪一刻最紧张？`, `哪个决定最难？`, `你记得哪三个具体画面或声音？`. Do not ask whether they noticed a named clue.

- [ ] **Step 2: Define release gates without fabricating results**

Put blank per-player tables in `docs/playtests/2026-07-15-vertical-slice-results.md`, followed by formulas for every gate from the approved design:

- at least 4/5 begin a purposeful investigation within 45 seconds of entering;
- at least 4/5 solve the table within eight minutes without external explanation;
- the median number of complete wrong configurations before solving is at most two;
- at least 4/5 can state two concrete spatial facts that support the seating;
- zero players solve by traversing all arrangements without reasoning;
- at least 4/5 predict or voluntarily obey stillness on the second dinner bell;
- zero players encounter a soft lock, unrecoverable state, spawn-on-face pursuit, infinite chase, or permanent input loss;
- at least 4/5 explain that the father controls the child, the mother and child care for each other, and the child intended to leave;
- at most 2/5 finish certain that the protagonist is already dead;
- at least 4/5 recall one concrete image or sound without merely paraphrasing text;
- the paper-plane choice is not 5/5 unanimous in either direction;
- zero locations produce more than 60 seconds of aimless wandering;
- at least 4/5 voluntarily say they would continue to the next chapter.

Also report completion-time median, delayed ten-minute recall, stated choice reasons, and any collision/interaction bug as diagnostics, but do not silently substitute those diagnostics for a failed approved gate.

The document must state `STATUS: AWAITING FIVE BLIND PLAYTESTS`. Automated tests and developer smoke cannot change that status.

- [ ] **Step 3: Update the product and archive documentation**

Update `docs/GAME_FLOW.md` with the new three-space flow and both paper-plane return routes. Update `README.md` with:

- the slice as the default preview route;
- `?legacy=1` and `?legacy=1&map=<id>` as archived full-game access;
- desktop and mobile controls;
- links to the approved spec, this plan, blind-test protocol, and results file;
- an honest note that the slice is a developer candidate until five blind tests pass.

Update the 2026-07-15 `DEV_LOG.md` entry with reusable boundaries: physical action over evidence-board UI, authored contradiction over generic error text, deterministic horror teaching over random scares, explicit slice/legacy lifecycle isolation, and the distinction between automated correctness and player-experience evidence.

- [ ] **Step 4: Run release-candidate verification from a clean generated entry**

```powershell
node tools\build_standalone_entry.mjs
Get-ChildItem tools\verify_*.mjs | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Failed: $($_.Name)" } }
Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Syntax failed: $($_.FullName)" } }
git diff --check
git status --short
```

Expected: all tests and syntax checks pass; `git diff --check` is silent; status lists only the intended documentation/result-template changes and regenerated `index.html` if the prior commit did not include the final bundle.

- [ ] **Step 5: Commit the candidate documentation**

```powershell
git add -- docs/playtests/2026-07-15-vertical-slice-protocol.md docs/playtests/2026-07-15-vertical-slice-results.md docs/GAME_FLOW.md README.md DEV_LOG.md index.html
git commit -m "docs: prepare the vertical slice blind playtest"
```

- [ ] **Step 6: Push and verify the remote branch**

```powershell
git push -u origin codex/vertical-slice-redesign
$local = git rev-parse HEAD
$remote = git ls-remote origin refs/heads/codex/vertical-slice-redesign | ForEach-Object { ($_ -split "`t")[0] }
if ($local -ne $remote) { throw "Remote branch does not match local HEAD" }
```

Expected: the push succeeds and both hashes match. If the network fails, preserve the local commits, record the exact error, and retry without rewriting history.

## Execution checkpoints

### Checkpoint A — Pure foundation after Task 4

State, route selection, three-map topology, and exhaustive table rules exist as independent modules. All legacy tests still pass. Review the APIs before any Phaser rendering work; renaming them later would churn every runtime task.

### Checkpoint B — Playable kitchen and taught horror rule after Task 8

The player can physically carry bowls, receive specific contradictory replays, solve the table, and learn the dinner-bell rule through a no-fail demonstration. Run one developer kitchen loop here before adding the bedroom choice.

### Checkpoint C — Integrated candidate after Task 12

Both plane choices complete from the normal title route on desktop and mobile, legacy access remains available, all automated checks pass, documentation is current, and the blind-test package is ready.

## Definition of done

Implementation is a **developer candidate** when Tasks 1–12 are committed, the generated standalone entry is current, every verification and syntax check passes, both developer smoke routes finish with zero uncaught console errors, and the remote branch matches local `HEAD`.

The slice is **player-validated** only after five fresh blind playtests meet every release gate. Until then, do not describe it as “好玩”, “完成”, “Steam 好评如潮水准”, or ready to replace the archived full game. Failed player metrics reopen the smallest responsible task: interaction failures return to Tasks 5/6/10, puzzle comprehension to Tasks 4/7, horror fairness to Task 8, and weak narrative memory or choice motivation to Task 9.
