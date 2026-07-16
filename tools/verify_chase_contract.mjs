import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultGameState, reconcileFamilyPhoto } from '../src/systems/StoryState.js';
import { SliceMaps } from '../src/data/SliceMaps.js';
import {
    ChaseManager,
    SLICE_CHASE_DURATION_MS,
    getSliceArrivalStage
} from '../src/systems/ChaseManager.js';

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

assert.equal(SLICE_CHASE_DURATION_MS, 10000);
assert.equal(getSliceArrivalStage(1999), 'approaching');
assert.equal(getSliceArrivalStage(2000), 'door_bang');
assert.equal(getSliceArrivalStage(3000), 'warning');
assert.equal(getSliceArrivalStage(4000), 'arriving');

const timers = [];
const scene = {
    currentMapId: 'room_kitchen',
    gameState: { isChasing: false, storyFlags: {} },
    navigationBlockedRects: [{ x: 280, y: 208, width: 80, height: 64 }],
    time: {
        delayedCall(delay, callback) {
            const timer = { delay, callback, remove() { this.removed = true; } };
            timers.push(timer);
            return timer;
        }
    }
};
const manager = new ChaseManager(scene);
assert.equal(manager.startSlice({
    mapDef: SliceMaps.room_kitchen,
    arrivalDoorId: 'kitchen_main_door',
    durationMs: SLICE_CHASE_DURATION_MS
}), true);
assert.equal(scene.gameState.isChasing, false, 'slice chase must not activate the legacy flag');
assert.equal(scene.gameState.sliceChasing, true, 'slice chase needs an isolated active flag');
assert.deepEqual(timers.map(timer => timer.delay), [2000, 3000, 4000]);
const grid = manager.createSliceGrid(SliceMaps.room_kitchen, [{ x: 1, y: 8 }]);
assert.equal(grid.length, 16, 'slice grid must use the authored 20×16 kitchen definition');
assert.equal(grid[0].length, 20, 'slice grid must use the authored 20×16 kitchen definition');
assert.equal(grid[7][9], false, 'slice grid must respect authored table collision blockers');
manager.cancelSliceArrival();

const invalidTimers = [];
const invalidScene = { ...scene, gameState: { isChasing: false, storyFlags: {} }, time: {
    delayedCall(delay, callback) {
        const timer = { delay, callback, remove() { this.removed = true; } };
        invalidTimers.push(timer);
        return timer;
    }
} };
const invalidManager = new ChaseManager(invalidScene);
assert.equal(invalidManager.startSlice({ mapDef: SliceMaps.room_kitchen, arrivalDoorId: 'missing_door' }), false);
assert.equal(invalidScene.gameState.isChasing, false);
assert.equal(invalidScene.gameState.sliceChasing, undefined);
assert.equal(invalidTimers.length, 0, 'unknown slice door must fail closed before scheduling arrival');
const malformedScene = { ...scene, gameState: { isChasing: false, storyFlags: {} } };
const malformedManager = new ChaseManager(malformedScene);
assert.equal(malformedManager.startSlice({
    mapDef: { data: [], objects: { doors: [{ id: 'kitchen_main_door' }] } },
    arrivalDoorId: 'kitchen_main_door'
}), false);
assert.equal(malformedScene.gameState.sliceChasing, undefined, 'malformed slice data must fail closed');
assert.doesNotMatch(chaseSource.match(/startSlice\([\s\S]*?(?=\n    [a-zA-Z]+\(|\n}\n?$)/)?.[0] || '', /add\.text/);

const runtimeTimers = [];
const runtimeTweens = [];
let overlapHandler = null;
let caughtCalls = 0;
function makeRuntimeObject(x, y) {
    return {
        x, y, active: true, alpha: 1, body: { enable: true },
        setTint() { return this; },
        setAlpha(alpha) { this.alpha = alpha; return this; },
        setPipeline() { return this; },
        setDepth() { return this; },
        destroy() { this.active = false; this.destroyed = true; }
    };
}
const runtimeScene = {
    currentMapId: 'room_kitchen',
    gameState: { isChasing: false, storyFlags: {} },
    navigationBlockedRects: [{ x: 280, y: 208, width: 80, height: 64 }],
    player: { sprite: makeRuntimeObject(400, 256) },
    walls: {}, furniture: {},
    time: {
        now: 0,
        delayedCall(delay, callback) {
            const timer = { delay, callback, remove() { this.removed = true; } };
            runtimeTimers.push(timer);
            return timer;
        }
    },
    add: {
        circle(x, y) { return makeRuntimeObject(x, y); },
        rectangle(x, y) { return makeRuntimeObject(x, y); },
        text() { throw new Error('slice arrival must not create legacy warning text'); }
    },
    tweens: { add(config) { runtimeTweens.push(config); return { stop() {}, remove() {} }; } },
    soundManager: { playSpatialNoise() {} },
    physics: {
        add: {
            sprite(x, y) { return makeRuntimeObject(x, y); },
            collider() {},
            overlap(_player, _chaser, handler) { overlapHandler = handler; }
        },
        moveTo() {}
    }
};
const runtimeManager = new ChaseManager(runtimeScene);
assert.equal(runtimeManager.startSlice({
    mapDef: SliceMaps.room_kitchen,
    arrivalDoorId: 'kitchen_main_door',
    durationMs: 10000,
    onCaught: () => { caughtCalls += 1; }
}), true);
for (const timer of [...runtimeTimers]) timer.callback();
assert.ok(runtimeManager.chaser?.active, 'slice chaser must materialize only after the four-second arrival callbacks');
assert.equal(runtimeScene.gameState.isChasing, false);
assert.equal(runtimeScene.gameState.storyFlags.chasePhase, undefined);
runtimeTweens.find(config => typeof config.onComplete === 'function')?.onComplete();
overlapHandler();
assert.equal(caughtCalls, 1, 'slice caught must call its supplied checkpoint callback');
assert.equal(runtimeScene.gameState.sliceChasing, false);
assert.equal(runtimeManager.chaser, null);

console.log('Chase contract verification passed');
