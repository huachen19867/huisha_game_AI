import assert from 'node:assert/strict';
import { resolveStartRoute } from '../src/systems/StartRoute.js';
import { createDefaultGameState } from '../src/systems/StoryState.js';
import { SAVE_KEY } from '../src/systems/Investigation.js';

assert.deepEqual(resolveStartRoute(''), { scene: 'IntroScene', data: undefined });
assert.deepEqual(resolveStartRoute('?map=memory_school'), { scene: 'GameScene', data: { mapId: 'memory_school' } });
assert.deepEqual(resolveStartRoute('?map=room_study&x=320&y=160'), { scene: 'GameScene', data: { mapId: 'room_study', x: 320, y: 160 } });
assert.deepEqual(resolveStartRoute('?map=missing_map'), { scene: 'IntroScene', data: undefined });

// Drive the real title callbacks. The native dialog surface is intentionally
// small; browser focus containment and backdrop rendering still need play checks.
globalThis.Phaser = { Scene: class {} };
const { TitleScene } = await import('../src/scenes/TitleScene.js');
const records = new Map();
let removals = 0, nativeDialog = true, fallbackAnswer = false, fallbackCalls = 0;
globalThis.localStorage = {
    getItem: key => records.get(key) ?? null,
    removeItem: key => { removals++; records.delete(key); }
};
globalThis.window = { location: { search: '' }, confirm() { fallbackCalls++; return fallbackAnswer; } };
globalThis.document = {
    activeElement: null,
    body: { style: {}, appendChild(node) { node.isConnected = true; } },
    getElementById: () => ({ style: {}, classList: { add() {} }, replaceChildren() {} }),
    createElement() {
        const controls = Object.fromEntries(['#title-restart-description', '[data-restart-cancel]', '[data-restart-confirm]'].map(key => [key, { focus() { document.activeElement = this; } }]));
        const dialog = { controls, listeners: {}, open: false, isConnected: false,
            setAttribute() {}, querySelector: selector => controls[selector], addEventListener(name, callback) { this.listeners[name] = callback; },
            close() { this.open = false; }, remove() { this.isConnected = false; } };
        if (nativeDialog) dialog.showModal = () => { dialog.open = true; };
        return dialog;
    }
};
function titleHarness(saved = true) {
    records.clear(); removals = 0;
    const state = createDefaultGameState();
    state.hasRice = true;
    state.investigation = { notes: [{ title: '已读来信', content: '保留这次调查。' }] };
    const checkpoint = { version: 1, mapId: 'room_study', x: 448, y: 208, state };
    const savedBytes = JSON.stringify(checkpoint);
    if (saved) records.set(SAVE_KEY, savedBytes);
    const scene = Object.create(TitleScene.prototype), texts = [], starts = [], keys = new Map();
    let shutdown;
    Object.assign(scene, {
        game: { soundManager: { initCalls: 0, init() { this.initCalls++; } } }, drawManor() {}, cameras: { main: { setBackgroundColor() {} } },
        add: {
            text(_x, _y, label) { const text = { label, listeners: {}, setInteractive() { return this; }, setColor() { return this; }, on(name, callback) { this.listeners[name] = callback; return this; } }; texts.push(text); return text; },
            graphics: () => ({ fillGradientStyle() {}, fillRect() {} }), rectangle() {}, particles() {}
        },
        input: { keyboard: { on(name, callback) { keys.set(name, callback); }, off(name, callback) { if (keys.get(name) === callback) keys.delete(name); } } },
        events: { once(_event, callback) { shutdown = callback; } },
        scene: { start(name, data) { starts.push({ name, data }); shutdown(); } }
    });
    scene.create();
    return { scene, texts, starts, keys, checkpoint, savedBytes, shutdown: () => shutdown(), restart: () => texts.find(text => text.label === '重新开始').listeners.pointerdown() };
}
const restart = titleHarness();
restart.restart();
const firstDialog = restart.scene.restartDialog;
const cancelledConfirmation = firstDialog.controls['[data-restart-confirm]'].onclick;
assert.equal(firstDialog.open, true);
assert.equal(document.activeElement, firstDialog.controls['[data-restart-cancel]'], 'The default focus must preserve the existing progress');
assert.match(firstDialog.controls['#title-restart-description'].textContent, /调查进度和手记/);
restart.keys.get('keydown-ENTER')({ repeat: false });
restart.keys.get('keydown-SPACE')({ repeat: false });
restart.texts.find(text => text.label.startsWith('继续雨夜')).listeners.pointerdown();
restart.restart();
assert.equal(restart.scene.restartDialog, firstDialog, 'Repeated input cannot open multiple confirmations');
assert.deepEqual(restart.starts, []);
assert.equal(restart.scene.game.soundManager.initCalls, 0, 'A pending restart cannot resume sound or start the game');
assert.equal(records.get(SAVE_KEY), restart.savedBytes);
firstDialog.controls['[data-restart-cancel]'].onclick();
cancelledConfirmation();
assert.equal(restart.scene.restartDialog, null);
assert.equal(removals, 0, 'A detached confirmation cannot delete cancelled progress');
restart.keys.get('keydown-ENTER')({ repeat: true });
assert.deepEqual(restart.starts, [], 'Holding the cancel key cannot start the underlying title');
restart.restart();
let escapePrevented = false;
restart.scene.restartDialog.listeners.cancel({ preventDefault() { escapePrevented = true; } });
assert.equal(escapePrevented, true);
assert.equal(records.get(SAVE_KEY), restart.savedBytes);
restart.restart();
const confirmedRestart = restart.scene.restartDialog.controls['[data-restart-confirm]'].onclick;
confirmedRestart(); confirmedRestart();
assert.equal(records.has(SAVE_KEY), false);
assert.equal(removals, 1);
assert.equal(restart.scene.game.soundManager.initCalls, 1, 'Explicit start retries the existing audio context once');
assert.deepEqual(restart.starts, [{ name: 'IntroScene', data: undefined }]);
assert.equal(window.globalGameState.hasRice, false);
assert.equal(restart.keys.size, 0, 'Leaving the title removes its keyboard listeners');

const continuing = titleHarness();
continuing.restart(); continuing.scene.restartDialog.controls['[data-restart-cancel]'].onclick();
continuing.keys.get('keydown-ENTER')({ repeat: false });
assert.deepEqual(continuing.starts, [{ name: 'GameScene', data: { mapId: 'room_study', x: 448, y: 208 } }]);
assert.deepEqual(window.globalGameState, continuing.checkpoint.state);
assert.equal(continuing.scene.game.soundManager.initCalls, 1, 'Continue retries audio during the user gesture');
assert.equal(records.get(SAVE_KEY), continuing.savedBytes);
assert.equal(removals, 0);

const abandonedTitle = titleHarness();
abandonedTitle.restart();
const abandonedDialog = abandonedTitle.scene.restartDialog, abandonedAction = abandonedDialog.controls['[data-restart-confirm]'].onclick;
abandonedTitle.shutdown(); abandonedAction();
assert.equal(abandonedDialog.isConnected, false);
assert.equal(records.get(SAVE_KEY), abandonedTitle.savedBytes);
assert.deepEqual(abandonedTitle.starts, []);

const firstVisit = titleHarness(false);
assert.equal(firstVisit.texts.some(text => text.label === '重新开始'), false);
firstVisit.keys.get('keydown-SPACE')({ repeat: false });
assert.deepEqual(firstVisit.starts, [{ name: 'IntroScene', data: undefined }]);

nativeDialog = false;
const legacyTitle = titleHarness();
legacyTitle.restart();
assert.equal(records.get(SAVE_KEY), legacyTitle.savedBytes);
assert.equal(removals, 0);
fallbackAnswer = true; legacyTitle.restart();
assert.equal(fallbackCalls, 2);
assert.equal(removals, 1);
assert.deepEqual(legacyTitle.starts, [{ name: 'IntroScene', data: undefined }]);

console.log('Start route verification passed: routes, continue, explicit restart, cancellation, keyboard guard and cleanup');
