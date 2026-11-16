import assert from 'node:assert/strict';
import { createDefaultGameState } from '../src/systems/StoryState.js';
import { Maps } from '../src/data/Maps.js';
import { choosePursuerSpawn, pursuitCue } from '../src/systems/HorrorPacing.js';
import { getObjective, getMemoryReturn, rememberDocument, saveCheckpoint, readCheckpoint } from '../src/systems/Investigation.js';
import { InvestigationUI } from '../src/systems/InvestigationUI.js';
import { EventManager } from '../src/systems/EventManager.js';
import { SoundManager } from '../src/systems/SoundManager.js';

globalThis.window = { dialogActive: false, showDialog() {} };
const saves = new Map();
globalThis.localStorage = { getItem: key => saves.get(key) ?? null, setItem: (key, value) => saves.set(key, value) };
globalThis.Phaser = {
    Scene: class {},
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'fadeoutcomplete' } } },
    Math: {
        Clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
        Distance: { Between: (x, y, x2, y2) => Math.hypot(x - x2, y - y2) },
        Angle: { Between: (x, y, x2, y2) => Math.atan2(y2 - y, x2 - x) }
    },
    Input: { Keyboard: { JustDown: () => false } }
};
const { GameScene } = await import('../src/scenes/GameScene.js');

// A nearby preferred entrance cannot override distance or put a monster on the
// far side of a wall that has no traversable connection to the player.
const disconnected = { width: 14, height: 5, data: Array.from({ length: 5 }, () => Array.from({ length: 14 }, (_, x) => x === 10 ? 1 : 0)) };
const point = choosePursuerSpawn(disconnected, { x: 48, y: 80 }, (x, y) => disconnected.data[y]?.[x] === 0, { x: 400, y: 80 });
assert.ok(point && point.x < 320 && point.distance >= 192);
assert.equal(choosePursuerSpawn({ width: 2, height: 2 }, { x: 16, y: 16 }, () => true), null, 'A cramped room waits instead of spawning on the player');

function pursuitScene() {
    const scene = Object.create(GameScene.prototype);
    scene.currentMapId = 'room_corridor';
    scene.previousMapId = 'room_main';
    scene.gameState = createDefaultGameState();
    scene.gameState.isChasing = true;
    scene.isMobile = true;
    scene.pursuitStepMs = scene.pursuitWarningMs = scene.pursuitRetryMs = scene.micLoudMs = 0;
    scene.player = { sprite: { x: 176, y: 580, setVelocity() {} } };
    scene.furniture = { getChildren: () => [] };
    scene.walls = {};
    scene.steps = scene.moves = scene.pauses = 0;
    scene.soundManager = { playFootstep: () => scene.steps++, playHeartbeat() {} };
    scene.time = { now: 0 };
    scene.dangerOverlay = { setAlpha() {} };
    scene.interactionManager = { clearTarget() {} };
    scene.eventManager = { update() {} };
    const text = { setVisible() { return this; }, setText() { return this; }, setPosition() { return this; }, setColor() { return this; } };
    scene.interactText = text;
    scene.micIndicator = text;
    scene.physics = {
        pause: () => scene.pauses++, resume() {}, moveTo: () => scene.moves++,
        add: {
            collider() {}, overlap(_player, _chaser, callback) { scene.onCapture = callback; },
            sprite(x, y) {
                return {
                    x, y, active: true,
                    setDepth() { return this; }, setAlpha() { return this; },
                    body: { enable: true, velocity: { length: () => 20 }, blocked: { none: true }, setSize() { return this; }, setOffset() { return this; }, setVelocity() {} }
                };
            }
        }
    };
    return scene;
}

const scene = pursuitScene();
scene.trees = { getChildren: () => [{ body: { enable: true, x: 128, y: 320, width: 32, height: 32 } }] };
assert.equal(scene.isChaseCellOpen(4, 10), false, 'Trees block spawn and path cells just like furniture');
scene.spawnChaser();
assert.ok(Math.hypot(scene.chaser.x - scene.player.sprite.x, scene.chaser.y - scene.player.sprite.y) >= 192);
assert.equal(scene.chaser.body.enable, false, 'The warning silhouette cannot capture the player');
scene.onCapture();
assert.equal(scene.captureTriggered, undefined);
for (let i = 0; i < 12; i++) { scene.time.now += 50; scene.updateChaser(50); }
const warning = scene.pursuitWarningMs, steps = scene.steps;
scene.isManipulating = true;
scene.update(10000, 50);
assert.equal(scene.pursuitWarningMs, warning, 'Furniture movement freezes pursuit');
assert.doesNotThrow(() => scene.switchScene('room_main', 368, 64), 'Furniture movement cannot start a scene switch');
assert.equal(scene.isSwitching, undefined);
scene.isManipulating = false;
window.dialogActive = true;
for (let i = 0; i < 100; i++) { scene.time.now += 50; scene.updateChaser(50); }
scene.micLoudMs = 400;
scene.update(10000, 50);
assert.equal(scene.pursuitWarningMs, warning, 'Reading freezes the real chase warning');
assert.equal(scene.steps, steps, 'Pursuer footsteps stop while reading');
assert.equal(scene.micLoudMs, 400, 'A paused microphone reading does not advance exposure');
assert.ok(scene.pauses > 0);
window.dialogActive = false;
for (let i = 0; i < 24; i++) { scene.time.now += 50; scene.updateChaser(50); }
assert.equal(scene.pursuitWarningMs, 0);
assert.equal(scene.chaser.body.enable, true);
assert.ok(scene.moves > 0, 'Pursuit resumes after the active warning interval');

// Follow the actual overlap and dialogue completion into capture recovery.
const captured = pursuitScene();
captured.safeStart = { x: 176, y: 580 };
captured.checkpointState = JSON.parse(JSON.stringify(captured.gameState));
captured.gameState.hasRedKey = true;
rememberDocument(captured.gameState, 'room_corridor', '追逐前记下的纸片', '阅读不会被一次失误抹掉。');
let captureReturn;
captured.scene = { restart(data) { captureReturn = data; } };
const captureResponses = [], priorDialog = window.showDialog, priorGlobalState = window.globalGameState;
window.showDialog = (_name, _text, callback) => captureResponses.push(callback);
captured.spawnChaser();
for (let i = 0; i < 36; i++) captured.updateChaser(50);
captured.onCapture(); captured.onCapture();
assert.equal(captureResponses.length, 1, 'Overlapping repeatedly can only capture once');
assert.equal(captureReturn, undefined, 'The capture response is read before recovery');
captureResponses[0]();
assert.deepEqual(captureReturn, { mapId: 'room_corridor', x: 176, y: 580, returnedAfterCapture: true });
assert.equal(window.globalGameState.hasRedKey, false, 'Capture still restores physical items to entry state');
assert.equal(window.globalGameState.investigation.notes[0].title, '追逐前记下的纸片');
assert.equal(window.globalGameState.isChasing, false);
assert.equal(readCheckpoint().state.investigation.notes[0].title, '追逐前记下的纸片', 'Recovered knowledge is saved before restart');
const recoveredScene = pursuitScene();
recoveredScene.gameState = window.globalGameState;
recoveredScene.spawnChaser();
assert.equal(recoveredScene.chaser, undefined, 'Recovery cannot immediately restart the same pursuit');
GameScene.prototype.init.call(recoveredScene, captureReturn);
assert.equal(recoveredScene.returnedAfterCapture, true);
GameScene.prototype.init.call(recoveredScene, { mapId: 'room_main' });
assert.equal(recoveredScene.returnedAfterCapture, false, 'The recovery notice cannot follow normal room changes');
window.showDialog = priorDialog; window.globalGameState = priorGlobalState;

scene.gameState.isHidden = true;
scene.hiddenElapsed = scene.micLoudMs = 0;
scene.soundManager.micStream = {};
scene.soundManager.getMicVolume = () => 60;
let exposures = 0;
scene.triggerFoundByMic = () => exposures++;
for (let i = 0; i < 10; i++) scene.update(i * 50, 50);
window.dialogActive = true;
for (let i = 0; i < 100; i++) scene.update(i * 50, 50);
assert.equal(exposures, 0);
assert.equal(scene.micLoudMs, 500);
window.dialogActive = false;
for (let i = 0; i < 10; i++) scene.update(i * 50, 50);
assert.equal(exposures, 1, 'Microphone exposure requires a second of active loud play');

scene.gameState.isHidden = false;
scene.chaser = null;
scene.currentMapId = 'memory_school';
scene.spawnChaser();
assert.equal(scene.chaser, null, 'External pursuit cannot spawn in a memory');
assert.equal(scene.gameState.isChasing, true, 'The pending pursuit is preserved for the return');
assert.match(getObjective(scene.gameState, scene.currentMapId)[0], /记忆/);
assert.equal(pursuitCue(scene), '');
saveCheckpoint(scene.gameState, 'memory_school', 240, 320);
assert.equal(readCheckpoint().state.isChasing, true, 'Safe memory checkpoints preserve the pending pursuit');
scene.currentMapId = 'room_corridor';
scene.spawnChaser();
assert.ok(scene.chaser && scene.pursuitWarningMs > 0, 'Returning to the manor gives a fresh arrival warning');

// The voluntary return action uses the real scene-switch method, keeps the
// pending pursuit, and reaches a room where the arrival warning can resume.
for (const memoryId of ['memory_school', 'memory_hospital']) {
    const memory = pursuitScene();
    memory.currentMapId = memoryId;
    let restart;
    memory.cameras = { main: { fadeOut() {}, once(_event, callback) { callback(); } } };
    memory.scene = { restart: data => { restart = data; } };
    const memoryUI = Object.assign(Object.create(InvestigationUI.prototype), {
        state: memory.gameState, scene: memory, close() {}
    });
    memoryUI.memoryReturnAction().run();
    const target = getMemoryReturn(memoryId);
    assert.deepEqual(restart, { mapId: target.mapId, x: target.x, y: target.y, previousMapId: memoryId });
    assert.equal(memory.gameState.isChasing, true);
    const resumed = pursuitScene();
    resumed.gameState = memory.gameState;
    resumed.currentMapId = restart.mapId;
    resumed.previousMapId = restart.previousMapId;
    Object.assign(resumed.player.sprite, { x: restart.x, y: restart.y });
    resumed.spawnChaser();
    assert.ok(resumed.chaser && resumed.pursuitWarningMs > 0);
    assert.equal(resumed.chaser.body.enable, false, 'Voluntary return does not skip the safe arrival warning');
}

const sanity30 = pursuitScene(), sanity60 = pursuitScene();
for (const sample of [sanity30, sanity60]) { sample.gameState.isChasing = false; sample.currentMapId = 'room_attic'; }
for (let i = 0; i < 240; i++) sanity30.updateSanity(1000 / 30);
for (let i = 0; i < 480; i++) sanity60.updateSanity(1000 / 60);
assert.ok(Math.abs(sanity30.gameState.sanity - sanity60.gameState.sanity) < 0.001);
assert.ok(sanity30.gameState.sanity > 96, 'Exploration no longer drains most sanity in half a minute');

let ambientCalls = [];
const ambientScene = { currentMapId: 'room_kitchen', gameState: createDefaultGameState(), soundManager: { playSpatialTone: (...args) => ambientCalls.push(args) } };
const ambience = new EventManager(ambientScene);
ambience.nextCueAt = 1000;
window.dialogActive = true;
for (let i = 0; i < 30; i++) ambience.update(50);
assert.equal(ambientCalls.length, 0);
assert.equal(ambience.elapsed, 0);
window.dialogActive = false;
for (let i = 0; i < 20; i++) ambience.update(50);
assert.equal(ambientCalls.length, 1);
assert.deepEqual(ambientCalls[0].slice(-2), [Maps.room_kitchen.objects.sink.x, Maps.room_kitchen.objects.sink.y], 'Environmental sound comes from its actual room object');
ambientScene.gameState.isChasing = true;
ambience.update(50);
assert.equal(ambience.caption, '');
ambientScene.gameState.isChasing = false;
for (let i = 0; i < 100; i++) ambience.update(50);
assert.equal(ambientCalls.length, 1, 'Ambient scares allow a recovery interval after pursuit');
ambientScene.currentMapId = 'memory_hospital';
ambience.triggerRandomEvent();
assert.equal(ambientCalls.length, 1, 'Memories remain quiet for investigation');
ambientScene.currentMapId = 'room_attic';
ambientScene.gameState.hasSpiritMoney = true;
ambience.triggerRandomEvent();
assert.equal(ambientCalls.length, 1, 'Collected paper money cannot produce another rustling cue');
// Audio nodes are a small behavioral surface, not an actual browser/audio check.
class AudioContextMock {
    constructor() { this.state = 'running'; this.currentTime = 1; this.sampleRate = 100; this.nodes = []; this.destination = {}; }
    node(kind) {
        const param = () => ({ values: [], setValueAtTime(value) { assert.ok(Number.isFinite(value)); this.values.push(value); }, exponentialRampToValueAtTime(value) { assert.ok(Number.isFinite(value) && value > 0); this.values.push(value); } });
        const node = { kind, links: [], disconnected: false, gain: param(), frequency: param(), pan: param(), frequencyBinCount: 16,
            connect(target) { this.links.push(target); }, disconnect() { this.disconnected = true; }, start() {}, stop() {} };
        this.nodes.push(node);
        return node;
    }
    createOscillator() { return this.node('oscillator'); }
    createGain() { return this.node('gain'); }
    createStereoPanner() { return this.node('panner'); }
    createBufferSource() { return this.node('noise'); }
    createBuffer(_channels, size) { return { getChannelData: () => new Float32Array(size) }; }
    createMediaStreamSource() { return this.node('mic'); }
    createAnalyser() { return this.node('analyser'); }
}
const originalAudio = window.AudioContext;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
try {
    const silent = new SoundManager({});
    assert.equal(silent.init(), false, 'Missing Web Audio keeps the game playable silently');
    silent.playTone(100, 'sine', 0.1);
    window.AudioContext = class { constructor() { throw new Error('Unavailable audio device'); } };
    assert.doesNotThrow(() => new SoundManager({}));
    window.AudioContext = AudioContextMock;
    const audio = new SoundManager({ player: { sprite: { x: 0, y: 0 } } });
    const ctx = audio.audioCtx;
    for (const [x, y] of [[600, 0], [601, 0], [NaN, 0], [0, Infinity]]) {
        audio.playSpatialTone(100, 'sine', 0.1, x, y);
        audio.playSpatialNoise(0.1, x, y);
    }
    assert.equal(ctx.nodes.length, 0, 'Inaudible and invalid sources allocate no nodes');
    audio.playSpatialTone(100, 'sine', 0.1, 300, 0);
    assert.deepEqual(ctx.nodes.find(node => node.kind === 'gain').gain.values, [0.05, 0.005]);
    assert.deepEqual(ctx.nodes.find(node => node.kind === 'panner').pan.values, [0.75]);
    ctx.nodes = [];
    ctx.createStereoPanner = undefined;
    audio.playSpatialTone(100, 'sine', 0.1, -300, 0);
    audio.playSpatialNoise(0.1, -300, 0);
    assert.equal(ctx.nodes.length, 4);
    for (const node of ctx.nodes.filter(node => ['noise', 'oscillator'].includes(node.kind))) assert.equal(node.links[0].kind, 'gain');
    ctx.state = 'suspended';
    let resumes = 0;
    ctx.resume = () => { resumes++; return Promise.reject(new Error('Gesture needed')); };
    assert.equal(audio.init(), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(audio.init(), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(resumes, 2, 'Denied resume is handled and can be retried');
    ctx.state = 'running';

    const pending = [];
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia() { return new Promise(resolve => pending.push(resolve)); } } } });
    const stream = () => ({ stops: 0, getTracks() { return [{ stop: () => this.stops++ }]; } });
    const first = audio.initMic(), duplicate = audio.initMic();
    assert.equal(pending.length, 1, 'Rapid enable requests share a single permission request');
    const live = stream(); pending.shift()(live);
    assert.equal(await first, true); assert.equal(await duplicate, true);
    const source = audio.micSource, analyser = audio.micAnalyser;
    audio.stopMic();
    assert.equal(live.stops, 1);
    assert.ok(source.disconnected && analyser.disconnected);
    for (const key of ['micStream', 'micSource', 'micAnalyser', 'micDataArray', 'micRequest']) assert.equal(audio[key], null);

    const stale = audio.initMic();
    audio.stopMic();
    const fresh = audio.initMic(), freshRequest = audio.micRequest;
    const oldStream = stream(); pending.shift()(oldStream);
    assert.equal(await stale, false);
    assert.equal(oldStream.stops, 1, 'Permission accepted after leaving releases only the obsolete stream');
    assert.equal(audio.micRequest, freshRequest, 'An old finally cannot erase a newer request');
    const newStream = stream(); pending.shift()(newStream);
    assert.equal(await fresh, true);
    assert.equal(audio.micStream, newStream);
    audio.stopMic();

    ctx.createAnalyser = () => { throw new Error('Graph creation failed'); };
    const failed = audio.initMic(), failedStream = stream(); pending.shift()(failedStream);
    assert.equal(await failed, false);
    assert.equal(failedStream.stops, 1);
    assert.equal(ctx.nodes.at(-1).disconnected, true);
    assert.equal(audio.micRequest, null);
    ctx.createAnalyser = () => ctx.node('analyser');
    const retry = audio.initMic(), retryStream = stream(); pending.shift()(retryStream);
    assert.equal(await retry, true, 'Graph failure permits a fresh attempt');
    audio.stopMic();

    // Run the real pause callback. An old permission result must not change a
    // newer journal page or stop the microphone owned by a newer scene.
    function micPage() {
        const nodes = { 'case-body': { firstChild: {} }, 'case-feedback': { textContent: '' } };
        const ui = Object.assign(Object.create(InvestigationUI.prototype), {
            state: createDefaultGameState(), scene: { currentMapId: 'room_main', soundManager: audio }, root: { isConnected: true }, open: true,
            el: id => nodes[id], close() { this.open = false; },
            modal(_title, _text, actions) { nodes['case-body'].firstChild = {}; this.actions = actions; this.renders = (this.renders || 0) + 1; }
        });
        ui.pause();
        return { ui, nodes, enable: () => ui.actions.find(action => action.label.startsWith('开启声控')).run() };
    }
    const oldPage = micPage(), oldCallback = oldPage.enable();
    oldPage.nodes['case-body'].firstChild = {};
    const pageStream = stream(); pending.shift()(pageStream);
    await oldCallback;
    assert.equal(oldPage.ui.renders, 1, 'Returning permission cannot replace a later reading page');
    audio.stopMic();
    const disposed = micPage(), disposedCallback = disposed.enable();
    disposed.ui.root.isConnected = false;
    audio.stopMic(); // Real GameScene shutdown cancels the outgoing request.
    const nextScene = audio.initMic();
    const disposedStream = stream(), nextStream = stream();
    pending[1](nextStream); await nextScene;
    pending[0](disposedStream); pending.length = 0;
    await disposedCallback;
    assert.equal(disposedStream.stops, 1);
    assert.equal(audio.micStream, nextStream);
    assert.equal(nextStream.stops, 0, 'Detached UI must not shut down a newer scene stream');
    audio.stopMic();
    const current = micPage(), currentCallback = current.enable();
    const currentStream = stream(); pending.shift()(currentStream); await currentCallback;
    assert.equal(current.ui.renders, 2, 'The current pause page refreshes its enabled state');
    audio.stopMic();
} finally {
    if (originalAudio === undefined) delete window.AudioContext; else window.AudioContext = originalAudio;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator;
}
console.log('Horror pacing verification passed: pursuit, memory refuge, sourced ambience, audio fallbacks and microphone lifecycle');
