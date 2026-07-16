import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    advanceAttention,
    evaluateDinnerBell,
    isFatherSafeZone,
    recoverAttention,
    shouldPauseHouseRule
} from '../src/systems/HouseRuleState.js';
import {
    HouseRuleDirector,
    EXIT_BELL_RADIUS,
    HOUSE_RULE_CHASE_DURATION_MS,
    HOUSE_RULE_CHECKPOINT_MS
} from '../src/systems/HouseRuleDirector.js';

assert.equal(evaluateDinnerBell({ demonstrated: false, elapsedMs: 9999, movedDistance: 9999 }), 'demonstration');
assert.equal(evaluateDinnerBell({ demonstrated: true, elapsedMs: 2499, movedDistance: 0 }), 'listening');
assert.equal(evaluateDinnerBell({ demonstrated: true, elapsedMs: 2500, movedDistance: 0 }), 'obeyed');
assert.equal(evaluateDinnerBell({ demonstrated: true, elapsedMs: 0, movedDistance: 16 }), 'violated');

assert.equal(advanceAttention('quiet'), 'suspicious');
assert.equal(advanceAttention('suspicious'), 'checking');
assert.equal(advanceAttention('checking'), 'chasing');
assert.equal(advanceAttention('chasing'), 'chasing');
assert.equal(advanceAttention('unknown'), 'quiet');
assert.equal(recoverAttention('chasing'), 'checking');
assert.equal(recoverAttention('checking'), 'suspicious');
assert.equal(recoverAttention('suspicious'), 'quiet');
assert.equal(recoverAttention('quiet'), 'quiet');
assert.equal(recoverAttention('unknown'), 'quiet');

assert.equal(shouldPauseHouseRule({ dialog: false, replay: false, switching: false, carryingAnimation: false }), false);
for (const key of ['dialog', 'replay', 'switching', 'carryingAnimation']) {
    assert.equal(shouldPauseHouseRule({ [key]: true }), true, `${key} must freeze the house rule`);
}

assert.equal(isFatherSafeZone({ zone: 'under_table', moving: false }), true);
assert.equal(isFatherSafeZone({ zone: 'under_table', moving: true }), false);
assert.equal(isFatherSafeZone({ zone: 'near_table', moving: false }), false);

assert.equal(EXIT_BELL_RADIUS, 96);
assert.equal(HOUSE_RULE_CHASE_DURATION_MS, 10000);

function makeDisplayObject(x = 0, y = 0) {
    return {
        x, y, alpha: 1, active: true,
        setDepth() { return this; },
        setAlpha(alpha) { this.alpha = alpha; return this; },
        setTint() { return this; },
        setScale() { return this; },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
        destroy() { this.destroyed = true; this.active = false; }
    };
}

function makeKitchenScene({ attention = 'quiet', sideDoorLocked = false } = {}) {
    const objects = [];
    const timers = [];
    const sideDoor = { ...makeDisplayObject(624, 272), doorId: 'kitchen_side_door', locked: sideDoorLocked };
    const mainDoor = { ...makeDisplayObject(16, 272), doorId: 'kitchen_main_door', locked: false, targetMap: 'room_main' };
    const sliceState = {
        tableSolved: true,
        houseRuleDemonstrated: false,
        fatherAttention: attention,
        lastTraversedDoor: 'main_kitchen_door'
    };
    const scene = {
        currentMapId: 'room_kitchen',
        previousMapId: 'room_main',
        sliceState,
        gameState: { slice: sliceState },
        player: { sprite: { x: 540, y: 256 } },
        doors: { getChildren: () => [mainDoor, sideDoor] },
        sliceSafeZones: { under_table: { x: 296, y: 272, width: 48, height: 24 } },
        add: {
            circle(x, y) { const object = makeDisplayObject(x, y); objects.push(object); return object; },
            rectangle(x, y) { const object = makeDisplayObject(x, y); objects.push(object); return object; },
            image(x, y) { const object = makeDisplayObject(x, y); objects.push(object); return object; }
        },
        tweens: { add: () => ({ stop() {}, remove() {} }) },
        soundManager: { playSpatialNoise() {} },
        time: {
            delayedCall(delay, callback) {
                const timer = { delay, callback, remove() { this.removed = true; } };
                timers.push(timer);
                return timer;
            }
        },
        events: { once() {}, off() {} },
        scene: { restart(data) { scene.restartData = data; } },
        chaseManager: {
            sliceActive: false,
            startSlice(options) {
                this.sliceActive = true;
                scene.sliceChaseOptions = options;
                return true;
            },
            isSliceChasing() { return this.sliceActive; }
        }
    };
    return { scene, sideDoor, mainDoor, objects, timers };
}

const priorWindow = globalThis.window;
globalThis.window = { dialogActive: false };

const tutorial = makeKitchenScene();
const tutorialDirector = new HouseRuleDirector(tutorial.scene);
tutorialDirector.update(0, 0);
assert.equal(tutorialDirector.activeBell.kind, 'demonstration');
assert.equal(tutorialDirector.activeBell.fired.has('bell'), true, 'the opening bell must not replay on the next frame');
tutorialDirector.update(3200, 3200);
assert.equal(tutorial.scene.sliceState.houseRuleDemonstrated, true, 'the first bell teaches without failing');
assert.equal(tutorialDirector.activeBell, null);
assert.ok(tutorial.objects.length >= 3, 'the bell sequence must show physical warning layers');

tutorialDirector.update(3300, 0);
assert.equal(tutorialDirector.activeBell.kind, 'exit');
assert.equal(tutorialDirector.activeBell.arrivalDoor.doorId, 'kitchen_main_door', 'the warning must come from the crossed-map door, not appear at the exit');
assert.equal(tutorialDirector.blocksDoorTransition(tutorial.sideDoor), true);
const frozenElapsed = tutorialDirector.activeBell.elapsedMs;
globalThis.window.dialogActive = true;
tutorial.scene.player.sprite.x += 40;
tutorialDirector.update(4300, 1000);
assert.equal(tutorialDirector.activeBell.elapsedMs, frozenElapsed, 'dialog time and movement must not count');
globalThis.window.dialogActive = false;
tutorial.scene.player.sprite.x += 16;
tutorialDirector.update(5900, 1600);
tutorialDirector.update(7500, 1600);
assert.equal(tutorial.scene.sliceState.fatherAttention, 'suspicious', 'a taught rule advances attention only after the full warning sequence');
assert.equal(tutorialDirector.activeBell, null);
assert.equal(tutorialDirector.checkpoint.mapId, 'room_kitchen');

const checking = makeKitchenScene({ attention: 'checking' });
checking.scene.sliceState.houseRuleDemonstrated = true;
const checkingDirector = new HouseRuleDirector(checking.scene);
checkingDirector.update(0, 0);
checkingDirector.update(3200, 3200);
assert.equal(checkingDirector.fatherChecker.x, checking.mainDoor.x, 'a checking father uses the corresponding entered door');
checkingDirector.destroy();
assert.equal(checkingDirector.fatherChecker, null);

const escalated = makeKitchenScene({ attention: 'suspicious' });
escalated.scene.sliceState.houseRuleDemonstrated = true;
const escalatedDirector = new HouseRuleDirector(escalated.scene);
escalatedDirector.update(0, 0);
escalated.scene.player.sprite.x += 20;
escalatedDirector.update(1600, 1600);
escalatedDirector.update(3200, 1600);
assert.equal(escalated.scene.sliceState.fatherAttention, 'checking', 'a suspicious violation must advance into checking');
assert.ok(escalatedDirector.fatherChecker, 'the first real checking escalation must create a father checker immediately');
assert.equal(escalatedDirector.fatherChecker?.x, escalated.mainDoor.x);
assert.equal(escalatedDirector.fatherChecker?.y, escalated.mainDoor.y);
const escalationEffectIndex = (id) => escalated.objects.findIndex(object => object.sliceHouseRuleEffect === id);
const fatherCheckIndex = escalationEffectIndex('father_check');
assert.ok(escalationEffectIndex('knock') >= 0);
assert.ok(escalationEffectIndex('footsteps') >= 0);
assert.ok(escalationEffectIndex('door_shadow') >= 0);
assert.ok(fatherCheckIndex > escalationEffectIndex('knock'));
assert.ok(fatherCheckIndex > escalationEffectIndex('footsteps'));
assert.ok(fatherCheckIndex > escalationEffectIndex('door_shadow'));
assert.equal(escalatedDirector.blocksDoorTransition(escalated.sideDoor), false, 'checking must not permanently occupy the open exit');
assert.ok(escalated.timers.some(timer => timer.delay === 850), 'the checker must have a bounded visible hold');
escalated.timers.find(timer => timer.delay === 850)?.callback();
assert.equal(escalatedDirector.fatherChecker, null, 'the check silhouette must clean up after its brief hold');

const stationaryUnderTable = makeKitchenScene({ attention: 'checking' });
stationaryUnderTable.scene.sliceState.houseRuleDemonstrated = true;
stationaryUnderTable.scene.player.sprite.x = 320;
stationaryUnderTable.scene.player.sprite.y = 280;
const stationaryDirector = new HouseRuleDirector(stationaryUnderTable.scene);
assert.equal(stationaryDirector.startBell('exit', stationaryUnderTable.sideDoor), true);
stationaryDirector.update(3200, 3200);
assert.equal(stationaryUnderTable.scene.sliceChaseOptions, undefined, 'a stationary player under the table must avoid the check');
assert.equal(stationaryDirector.fatherChecker, null);
assert.equal(stationaryUnderTable.scene.sliceState.fatherAttention, 'suspicious');

const movingUnderTable = makeKitchenScene({ attention: 'checking' });
movingUnderTable.scene.sliceState.houseRuleDemonstrated = true;
movingUnderTable.scene.sliceMapDef = {
    id: 'room_kitchen',
    data: Array.from({ length: 16 }, () => Array(20).fill(0)),
    objects: { doors: [{ id: 'kitchen_main_door' }] }
};
movingUnderTable.scene.player.sprite.x = 320;
movingUnderTable.scene.player.sprite.y = 280;
const movingDirector = new HouseRuleDirector(movingUnderTable.scene);
assert.equal(movingDirector.startBell('exit', movingUnderTable.sideDoor), true);
movingUnderTable.scene.player.sprite.x = 340;
movingDirector.update(3200, 3200);
assert.ok(movingUnderTable.scene.sliceChaseOptions, 'moving under the table must expose the player to the checking father');
assert.equal(movingUnderTable.scene.sliceState.fatherAttention, 'chasing');

for (const pauseKind of ['dialog', 'replay', 'switching', 'carryingAnimation']) {
    const paused = makeKitchenScene();
    paused.scene.sliceState.houseRuleDemonstrated = true;
    const pausedDirector = new HouseRuleDirector(paused.scene);
    pausedDirector.update(0, 0);
    pausedDirector.update(550, 550);
    const elapsedBeforePause = pausedDirector.activeBell.elapsedMs;
    const movedBeforePause = pausedDirector.activeBell.movedDistance;
    if (pauseKind === 'dialog') globalThis.window.dialogActive = true;
    if (pauseKind === 'replay') paused.scene.memoryReplayDirector = { active: true };
    if (pauseKind === 'switching') paused.scene.isSwitching = true;
    if (pauseKind === 'carryingAnimation') paused.scene.kitchenTableController = { isCarryingAnimation: true };
    paused.scene.player.sprite.x += 40;
    pausedDirector.update(1550, 1000);
    assert.equal(pausedDirector.activeBell.elapsedMs, elapsedBeforePause, `${pauseKind} must freeze bell time`);
    if (pauseKind === 'dialog') globalThis.window.dialogActive = false;
    if (pauseKind === 'replay') paused.scene.memoryReplayDirector.active = false;
    if (pauseKind === 'switching') paused.scene.isSwitching = false;
    if (pauseKind === 'carryingAnimation') paused.scene.kitchenTableController.isCarryingAnimation = false;
    pausedDirector.update(1551, 1);
    assert.equal(pausedDirector.activeBell.movedDistance, movedBeforePause, `${pauseKind} movement must be discarded on resume`);
    assert.equal(paused.scene.sliceState.fatherAttention, 'quiet', `${pauseKind} must not advance attention`);
    paused.scene.player.sprite.x += 16;
    pausedDirector.update(4200, 2649);
    assert.equal(paused.scene.sliceState.fatherAttention, 'suspicious', `${pauseKind} must still count movement after the pause ends`);
}

const locked = makeKitchenScene({ sideDoorLocked: true });
locked.scene.sliceState.houseRuleDemonstrated = true;
const lockedDirector = new HouseRuleDirector(locked.scene);
lockedDirector.update(0, 0);
assert.equal(lockedDirector.activeBell, null, 'a locked authored side door cannot trigger an exit bell');

const chased = makeKitchenScene({ attention: 'checking' });
chased.scene.sliceState.houseRuleDemonstrated = true;
chased.scene.sliceState.bowlPlacements = { nail: 'wine', stove: 'medicine', side: 'child' };
chased.scene.sliceState.mealReplaySeen = ['father_lock'];
chased.scene.sliceMapDef = {
    id: 'room_kitchen',
    data: Array.from({ length: 16 }, () => Array(20).fill(0)),
    objects: { doors: [{ id: 'kitchen_main_door' }] }
};
const chasedDirector = new HouseRuleDirector(chased.scene);
chasedDirector.update(0, 0);
chased.scene.player.sprite.x += 20;
chasedDirector.update(1600, 1600);
chasedDirector.update(3200, 1600);
assert.equal(chased.scene.sliceChaseOptions.durationMs, HOUSE_RULE_CHASE_DURATION_MS);
assert.equal(chased.scene.sliceChaseOptions.arrivalDoorId, 'kitchen_main_door');
assert.deepEqual(chased.scene.sliceState.bowlPlacements, { nail: 'wine', stove: 'medicine', side: 'child' });
assert.deepEqual(chased.scene.sliceState.mealReplaySeen, ['father_lock']);
assert.equal(chased.scene.sliceState.fatherAttention, 'chasing');
const warningCountDuringChase = chased.objects.length;
chasedDirector.update(3201, 1);
chasedDirector.update(6401, 3200);
assert.equal(chasedDirector.activeBell, null, 'a running slice chase must not re-arm the exit bell');
assert.equal(chased.objects.length, warningCountDuringChase, 'a running slice chase must not add a second warning stack');
assert.equal(chasedDirector.blocksDoorTransition(chased.sideDoor), false, 'a running slice chase must not occupy the exit door again');
assert.equal(chased.scene.sliceState.fatherAttention, 'chasing', 'a running slice chase must not recover attention');
assert.equal(chased.scene.sliceChaseOptions.onCaught(), true);
assert.deepEqual(chased.scene.restartData, {
    mapId: 'room_kitchen', x: 540, y: 256, previousMapId: 'room_main', sliceMode: true
});
chasedDirector.playerElapsedMs = HOUSE_RULE_CHECKPOINT_MS + 1;
assert.equal(chasedDirector.restoreCheckpoint(), false, 'checkpoint recovery must expire after 30 seconds of player time');

globalThis.window = priorWindow;

const gameSceneSource = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
assert.match(gameSceneSource, /import \{ HouseRuleDirector \} from '\.\.\/systems\/HouseRuleDirector\.js';/);
assert.match(gameSceneSource, /this\.houseRuleDirector = this\.sliceMode && this\.currentMapId === 'room_kitchen'/);
assert.match(gameSceneSource, /this\.houseRuleDirector\?\.update\(time, delta\);/);
assert.ok(
    gameSceneSource.indexOf('this.houseRuleDirector?.update(time, delta);') < gameSceneSource.indexOf('if (window.dialogActive)'),
    'the director must see dialog frames itself so it can freeze without accumulating time'
);
assert.match(gameSceneSource, /if \(!this\.sliceMode && \(this\.gameState\.isChasing \|\| this\.gameState\.storyFlags\.chasePhase === 'active'\)\)/);
assert.match(gameSceneSource, /this\.houseRuleDirector\?\.destroy\?\.\(\);/);
assert.match(gameSceneSource, /houseRuleDirector\?\.blocksDoorTransition\?\.\(door\)/);

const builderSource = readFileSync(new URL('./build_standalone_entry.mjs', import.meta.url), 'utf8');
const houseRuleStateEntry = "    'src/systems/HouseRuleState.js',";
const houseRuleDirectorEntry = "    'src/systems/HouseRuleDirector.js',";
const gameSceneEntry = "    'src/scenes/GameScene.js'";
assert.ok(builderSource.indexOf(houseRuleStateEntry) >= 0, 'standalone builder must include HouseRuleState');
assert.ok(builderSource.indexOf(houseRuleDirectorEntry) >= 0, 'standalone builder must include HouseRuleDirector');
assert.ok(builderSource.indexOf(houseRuleStateEntry) < builderSource.indexOf(houseRuleDirectorEntry));
assert.ok(builderSource.indexOf(houseRuleDirectorEntry) < builderSource.indexOf(gameSceneEntry));

console.log('House rule state verification passed');
