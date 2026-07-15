import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SliceMaps } from '../src/data/SliceMaps.js';
import { createDefaultSliceState } from '../src/systems/SliceState.js';
import { InteractionManager } from '../src/systems/InteractionManager.js';
import {
    KitchenTableController
} from '../src/systems/KitchenTableController.js';
import {
    SliceInteractionManager,
    getSlicePrompt,
    routeSliceAction
} from '../src/systems/SliceInteractionManager.js';

assert.equal(getSlicePrompt({ label: '酒味缺口碗', verb: '端起' }), '端起：酒味缺口碗  [空格/E]');
assert.equal(routeSliceAction('bowl'), 'table');
assert.equal(routeSliceAction('seat'), 'table');
assert.equal(routeSliceAction('observe'), 'observe');
assert.equal(routeSliceAction('plane'), 'plane');
assert.equal(routeSliceAction('plane_choice'), 'plane');
assert.equal(routeSliceAction('mirror'), 'plane');
assert.equal(routeSliceAction('missing'), 'ignore');

function makeText() {
    return {
        visible: false,
        setText(value) { this.text = value; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        setVisible(value) { this.visible = value; return this; }
    };
}

function makeGroup() {
    const children = [];
    return {
        add(object) {
            if (!children.includes(object)) children.push(object);
            return this;
        },
        remove(object) {
            const index = children.indexOf(object);
            if (index >= 0) children.splice(index, 1);
            return this;
        },
        getChildren() { return children; }
    };
}

function makeDisplayObject(x, y, textureKey = undefined) {
    return {
        x,
        y,
        active: true,
        visible: true,
        alpha: 1,
        texture: textureKey ? { key: textureKey } : undefined,
        positionHistory: [],
        setPosition(nextX, nextY) {
            this.x = nextX;
            this.y = nextY;
            this.positionHistory.push([nextX, nextY]);
            return this;
        },
        setAlpha(value) { this.alpha = value; return this; },
        setVisible(value) { this.visible = value; return this; },
        setDepth(value) { this.depth = value; return this; },
        setStrokeStyle(...value) { this.strokeStyle = value; return this; },
        destroy() { this.active = false; this.destroyed = true; }
    };
}

function attachBody(object, width = 20, height = 20) {
    object.body = {
        enable: true,
        width,
        height,
        x: object.x - width / 2,
        y: object.y - height / 2,
        updateCalls: 0,
        updateFromGameObject() {
            this.x = object.x - this.width / 2;
            this.y = object.y - this.height / 2;
            this.updateCalls += 1;
        },
        setSize(nextWidth, nextHeight) {
            this.width = nextWidth;
            this.height = nextHeight;
            return this;
        }
    };
    return object;
}

globalThis.Phaser = {
    Scene: class {},
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'fadeoutcomplete' } } },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    BlendModes: { MULTIPLY: 'multiply', OVERLAY: 'overlay', ADD: 'add' },
    Input: {
        Keyboard: {
            KeyCodes: {},
            JustDown(key) {
                if (key) key.justDownChecks = (key.justDownChecks || 0) + 1;
                const result = key?.justDown === true;
                if (key) key.justDown = false;
                return result;
            }
        }
    },
    Math: {
        Angle: { RotateTo: current => current },
        Between: () => 0,
        Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) }
    }
};

globalThis.window = {
    dialogActive: false,
    showDialog(...args) { this.dialogCalls.push(args); },
    dialogCalls: []
};

function interactionObject({
    id,
    action = 'observe',
    x,
    y,
    bodyX = x - 5,
    bodyY = y - 5,
    width = 10,
    height = 10,
    radius = 72,
    priority = 30,
    active = true,
    visible = true,
    interactionEnabled = true,
    text = `${id} 的事实`
}) {
    return {
        objId: id,
        sliceAction: action,
        sliceData: { id, kind: action, label: id, verb: action === 'observe' ? '观察' : '操作', text },
        interaction: { label: id, verb: action === 'observe' ? '观察' : '操作', radius, priority },
        x,
        y,
        active,
        visible,
        interactionEnabled,
        body: { x: bodyX, y: bodyY, width, height }
    };
}

const frontEvidence = interactionObject({ id: 'front_evidence', x: 50, y: 0 });
const closerBehind = interactionObject({ id: 'closer_behind', x: -30, y: 0 });
const floorClutter = interactionObject({ id: 'floor_clutter', x: 25, y: 5, priority: 10 });
const distantStory = interactionObject({ id: 'distant_story', x: 96, y: 0, radius: 72, priority: 99 });
const hidden = interactionObject({ id: 'hidden', x: 5, y: 0, visible: false });
const inactive = interactionObject({ id: 'inactive', x: 5, y: 0, active: false });
const disabled = interactionObject({ id: 'disabled', x: 5, y: 0, interactionEnabled: false });
const ambient = interactionObject({ id: 'ambient', action: 'ambient_anchor', x: 5, y: 0 });
const focusScene = {
    player: { sprite: { x: 0, y: 0 }, facingX: 1, facingY: 0 },
    interactables: makeGroup(),
    interactText: makeText(),
    keyE: { justDown: false },
    keySpace: { justDown: false }
};
for (const object of [frontEvidence, closerBehind, floorClutter, distantStory, hidden, inactive, disabled, ambient]) {
    focusScene.interactables.add(object);
}
const focusManager = new SliceInteractionManager(focusScene);
assert.equal(focusManager.findInteractionTarget().obj, frontEvidence, 'facing must disambiguate near clutter inside the 28px focus band');
focusManager.update();
assert.equal(focusScene.currentTarget.obj, frontEvidence);
assert.equal(focusScene.interactText.text, '观察：front_evidence  [空格/E]');
assert.equal(focusScene.interactText.visible, true);

focusScene.interactables = makeGroup();
focusScene.interactables.add(closerBehind);
assert.equal(focusManager.findInteractionTarget(), null, 'a sole object strictly behind the player must not be targetable');
focusManager.update();
assert.equal(focusScene.interactText.visible, false, 'a behind-only object must not leak a prompt');
assert.equal(focusScene.currentTarget, null);
assert.deepEqual(focusManager.handleInteraction(), { status: 'ignored' }, 'a hidden behind-only target must not trigger');

focusScene.interactables = makeGroup();
focusScene.interactables.add(frontEvidence);
assert.equal(focusManager.findInteractionTarget().obj, frontEvidence, 'a directly forward object remains targetable');
const diagonalFront = interactionObject({ id: 'diagonal_front', x: 40, y: 20 });
focusScene.interactables = makeGroup();
focusScene.interactables.add(diagonalFront);
assert.equal(focusManager.findInteractionTarget().obj, diagonalFront, 'an object in the diagonal forward half-plane remains targetable');

const overlapping = interactionObject({ id: 'overlapping', x: 0, y: 0, bodyX: -5, bodyY: -5 });
focusScene.interactables = makeGroup();
focusScene.interactables.add(overlapping);
assert.equal(focusManager.findInteractionTarget().obj, overlapping, 'overlapping centers must remain targetable regardless of facing');

focusScene.player.facingX = 0;
focusScene.player.facingY = 0;
focusScene.interactables = makeGroup();
focusScene.interactables.add(closerBehind);
assert.equal(focusManager.findInteractionTarget().obj, closerBehind, 'zero facing must fall back to near-field selection');
delete focusScene.player.facingX;
delete focusScene.player.facingY;
assert.equal(focusManager.findInteractionTarget().obj, closerBehind, 'missing facing must fall back to near-field selection');
focusScene.player.facingX = 1;
focusScene.player.facingY = 0;

const boundary = interactionObject({
    id: 'boundary',
    x: 82,
    y: 0,
    bodyX: 72,
    bodyY: -5,
    width: 10,
    height: 10,
    radius: 72
});
focusScene.interactables = makeGroup();
focusScene.interactables.add(boundary);
assert.equal(focusManager.findInteractionTarget().obj, boundary, 'an object exactly on its authored radius remains reachable');
boundary.body.x = 72.01;
assert.equal(focusManager.findInteractionTarget(), null, 'an object beyond its authored radius must not leak a prompt');

focusScene.interactables = makeGroup();
focusScene.interactables.add(frontEvidence);
let keyboardEntryCalls = 0;
const originalHandleInteraction = focusManager.handleInteraction.bind(focusManager);
focusManager.handleInteraction = () => {
    keyboardEntryCalls += 1;
    return originalHandleInteraction();
};
focusScene.keyE.justDown = true;
focusManager.update();
assert.equal(keyboardEntryCalls, 1, 'keyboard E must use the public interaction entry point');
assert.deepEqual(window.dialogCalls, [['主角', 'front_evidence 的事实']]);
window.dialogCalls.length = 0;
focusScene.keySpace.justDown = true;
focusManager.update();
assert.equal(keyboardEntryCalls, 2, 'keyboard Space must use the same interaction entry point');
assert.equal(window.dialogCalls.length, 1, 'observe must show exactly one authored factual line');

const originalDateNow = Date.now;
let fakeNow = 5000;
Date.now = () => fakeNow;
window.lastDialogCloseTime = fakeNow;
window.dialogCalls.length = 0;
focusScene.keySpace.justDown = true;
focusManager.update();
assert.equal(focusScene.keySpace.justDown, false, 'dialog-close cooldown must still consume pending Space');
assert.equal(focusScene.interactText.visible, false, 'cooldown must hide a prompt that cannot be used');
assert.equal(focusScene.currentTarget, null);
assert.equal(window.dialogCalls.length, 0, 'closing observe with Space must not immediately reopen it');
focusManager.update();
assert.equal(window.dialogCalls.length, 0, 'repeated updates inside cooldown must remain inert');
fakeNow += 501;
focusManager.update();
assert.equal(window.dialogCalls.length, 0, 'cooldown expiry must not replay an already-consumed key');
focusScene.keySpace.justDown = true;
focusManager.update();
assert.equal(window.dialogCalls.length, 1, 'a new press after cooldown may interact');

window.lastDialogCloseTime = 0;
window.dialogCalls.length = 0;
const tableInputObject = interactionObject({ id: 'input_bowl', action: 'bowl', x: 24, y: 0 });
const tableActions = [];
const tableInputScene = {
    player: { sprite: { x: 0, y: 0 }, facingX: 1, facingY: 0 },
    interactables: makeGroup(),
    interactText: makeText(),
    keyE: { justDown: true, justDownChecks: 0 },
    keySpace: { justDown: true, justDownChecks: 0 },
    kitchenTableController: {
        handleAction(object) {
            tableActions.push(object.sliceAction);
            object.sliceAction = 'seat';
            object.sliceData.kind = 'seat';
            return { status: tableActions.length === 1 ? 'holding' : 'placed' };
        }
    }
};
tableInputScene.interactables.add(tableInputObject);
const tableInputManager = new SliceInteractionManager(tableInputScene);
tableInputManager.update();
assert.equal(tableInputScene.keyE.justDownChecks, 1);
assert.equal(tableInputScene.keySpace.justDownChecks, 1, 'E must not short-circuit Space consumption in the same frame');
assert.deepEqual(tableActions, ['bowl'], 'the first frame may pick exactly once');
tableInputManager.update();
assert.deepEqual(tableActions, ['bowl'], 'the second frame must not auto-place from a stale Space edge');
Date.now = originalDateNow;

const plane = interactionObject({ id: 'plane', action: 'plane_choice', x: 20, y: 0 });
focusScene.currentTarget = { obj: plane, route: 'plane', type: 'plane' };
window.dialogCalls.length = 0;
assert.deepEqual(focusManager.handleInteraction(), { status: 'deferred', route: 'plane', targetId: 'plane' });
assert.equal(window.dialogCalls.length, 0, 'Task 6 must defer the paper-plane choice without opening UI');
focusManager.destroy();
assert.equal(focusScene.interactText.visible, false);
assert.equal(focusScene.currentTarget, null);

function makeControllerScene(state, onFirstEntity = null) {
    const interactables = makeGroup();
    let creations = 0;
    const scene = {
        sliceState: state,
        gameState: { slice: state },
        sliceMapDef: structuredClone(SliceMaps.room_kitchen),
        interactables,
        player: { sprite: { x: 410, y: 330 } },
        add: {
            image(x, y, textureKey) {
                creations += 1;
                if (creations === 1) onFirstEntity?.();
                return makeDisplayObject(x, y, textureKey);
            },
            rectangle(x, y, width, height) {
                creations += 1;
                if (creations === 1) onFirstEntity?.();
                const object = makeDisplayObject(x, y);
                object.width = width;
                object.height = height;
                return object;
            }
        },
        physics: {
            add: {
                existing(object) { return attachBody(object, object.width || 20, object.height || 20); }
            }
        }
    };
    return scene;
}

const corruptPlacements = { nail: 'wine', stove: 'wine', side: 'not_a_bowl', injected: 'child' };
const corruptState = {
    ...createDefaultSliceState(),
    bowlPlacements: corruptPlacements,
    heldBowl: 'wine'
};
let normalizedBeforeEntityCreation = false;
const controllerScene = makeControllerScene(corruptState, () => {
    assert.deepEqual(corruptState.bowlPlacements, { nail: null, stove: null, side: null });
    assert.equal(corruptState.heldBowl, 'wine');
    normalizedBeforeEntityCreation = true;
});
const tableSnapshot = structuredClone(SliceMaps.room_kitchen.objects.table);
const controller = new KitchenTableController(controllerScene);
assert.equal(normalizedBeforeEntityCreation, true, 'bad persisted state must be normalized before any entity or first-frame sync');
assert.notEqual(corruptState.bowlPlacements, corruptPlacements, 'runtime placements must not alias the save object');
assert.deepEqual(corruptPlacements, { nail: 'wine', stove: 'wine', side: 'not_a_bowl', injected: 'child' });
assert.deepEqual(SliceMaps.room_kitchen.objects.table, tableSnapshot, 'controller construction must not mutate frozen authored data');
assert.equal(controller.bowlSprites.size, 3);
assert.equal(controller.seatHotspots.size, 3);
assert.equal(controllerScene.interactables.getChildren().length, 6, 'only daily bowls and seats enter ordinary table interaction');
assert.equal(controller.offeringBowl.sliceAction, 'offering');
assert.equal(controller.offeringBowl.interactionEnabled, false);
assert.equal(controllerScene.interactables.getChildren().includes(controller.offeringBowl), false);
for (const object of controllerScene.interactables.getChildren()) {
    assert.ok(object.interaction?.label && object.interaction?.verb && object.sliceAction && object.sliceData);
}

const wineSprite = controller.bowlSprites.get('wine');
const medicineSprite = controller.bowlSprites.get('medicine');
const childSprite = controller.bowlSprites.get('child');
assert.deepEqual([wineSprite.x, wineSprite.y], [428, 302], 'held bowl must follow the player at the fixed offset on the first frame');
assert.equal(wineSprite.body.enable, false);
assert.equal(wineSprite.interactionEnabled, false);
assert.deepEqual(controller.pickBowl('medicine'), { status: 'hands_full', heldBowl: 'wine' });
assert.equal(corruptState.heldBowl, 'wine');

function assertNoDuplicateBowls(state) {
    const locations = [...Object.values(state.bowlPlacements), state.heldBowl].filter(Boolean);
    assert.equal(new Set(locations).size, locations.length, 'a bowl may occupy only one persisted location');
}

const wineUpdatesBeforePlace = wineSprite.body.updateCalls;
assert.deepEqual(controller.placeHeldBowl('nail'), { status: 'incomplete', contradictions: [] });
assert.equal(corruptState.heldBowl, null);
assert.equal(corruptState.bowlPlacements.nail, 'wine');
assert.deepEqual([wineSprite.x, wineSprite.y], [320, 176]);
assert.equal(wineSprite.body.enable, true);
assert.ok(wineSprite.body.updateCalls > wineUpdatesBeforePlace, 'placing must restore and synchronize the physics body');
assertNoDuplicateBowls(corruptState);

assert.deepEqual(controller.pickBowl('medicine'), { status: 'holding', bowlId: 'medicine' });
assert.equal(wineSprite.interactionEnabled, false, 'while carrying, occupied bowls must not steal focus from seat hotspots');
assert.ok([...controller.seatHotspots.values()].every(hotspot => hotspot.interactionEnabled === true));
controllerScene.player.sprite.x = 500;
controllerScene.player.sprite.y = 400;
controller.update();
assert.deepEqual([medicineSprite.x, medicineSprite.y], [518, 372]);
assert.equal(medicineSprite.body.enable, false);
assert.deepEqual(controller.placeHeldBowl('stove'), { status: 'incomplete', contradictions: [] });
assertNoDuplicateBowls(corruptState);

assert.deepEqual(controller.pickBowl('child'), { status: 'holding', bowlId: 'child' });
assert.deepEqual(controller.placeHeldBowl('nail'), { status: 'incomplete', contradictions: [] });
assert.equal(corruptState.bowlPlacements.nail, 'child');
assert.deepEqual([wineSprite.x, wineSprite.y], [176, 120], 'a displaced bowl must return to its own origin');
assertNoDuplicateBowls(corruptState);

assert.deepEqual(controller.pickBowl('child'), { status: 'holding', bowlId: 'child' });
assert.equal(corruptState.bowlPlacements.nail, null, 're-picking a placed bowl must clear its old seat');
assert.deepEqual(controller.placeHeldBowl('side'), { status: 'incomplete', contradictions: [] });
assertNoDuplicateBowls(corruptState);

assert.deepEqual(controller.pickBowl('wine'), { status: 'holding', bowlId: 'wine' });
assert.deepEqual(controller.placeHeldBowl('nail'), { status: 'correct', contradictions: [] });
assert.equal(corruptState.tableSolved, false, 'Task 6 reports correctness but Task 7 owns the solved transition');
assertNoDuplicateBowls(corruptState);

assert.deepEqual(controller.pickBowl('wine'), { status: 'holding', bowlId: 'wine' });
assert.deepEqual(controller.placeHeldBowl('stove'), { status: 'incomplete', contradictions: [] });
assert.deepEqual([medicineSprite.x, medicineSprite.y], [224, 120], 'replacing an occupied seat must return that bowl to origin');
assert.deepEqual(controller.pickBowl('medicine'), { status: 'holding', bowlId: 'medicine' });
const incorrect = controller.placeHeldBowl('nail');
assert.equal(incorrect.status, 'incorrect');
assert.ok(incorrect.contradictions.length > 0);
assertNoDuplicateBowls(corruptState);

assert.deepEqual(controller.handleAction(controller.offeringBowl), { status: 'fixed_offering' });
corruptState.tableSolved = true;
const lockedSnapshot = structuredClone(corruptState.bowlPlacements);
assert.deepEqual(controller.pickBowl('child'), { status: 'locked' });
assert.deepEqual(controller.placeHeldBowl('side'), { status: 'locked' });
assert.deepEqual(corruptState.bowlPlacements, lockedSnapshot);

const ownedObjects = [...controller.bowlSprites.values(), ...controller.seatHotspots.values(), controller.offeringBowl];
controller.destroy();
controller.destroy();
assert.ok(ownedObjects.every(object => object.destroyed === true));
assert.deepEqual(SliceMaps.room_kitchen.objects.table, tableSnapshot, 'destroy/rebuild work must not contaminate frozen map data');

const { GameScene } = await import('../src/scenes/GameScene.js');
const { SliceMapManager } = await import('../src/systems/SliceMapManager.js');

function prepareSystemScene(mapId, sliceMode) {
    const state = createDefaultSliceState();
    const support = makeControllerScene(state);
    const scene = new GameScene();
    Object.assign(scene, support);
    scene.currentMapId = mapId;
    scene.sliceMode = sliceMode;
    scene.sliceState = sliceMode ? state : null;
    scene.sliceMapDef = sliceMode ? structuredClone(SliceMaps[mapId]) : null;
    scene.interactText = makeText();
    scene.currentTarget = null;
    return scene;
}

for (const mapId of ['room_main', 'room_kitchen', 'room_bedroom_me']) {
    const scene = prepareSystemScene(mapId, true);
    scene.initializeInteractionSystems();
    assert.ok(scene.interactionManager instanceof SliceInteractionManager, `${mapId} must use slice interaction focus`);
    assert.equal(scene.kitchenTableController instanceof KitchenTableController, mapId === 'room_kitchen');
}
const legacyScene = prepareSystemScene('room_main', false);
legacyScene.initializeInteractionSystems();
assert.ok(legacyScene.interactionManager instanceof InteractionManager);
assert.equal(legacyScene.kitchenTableController, null);
assert.equal(legacyScene.interactionManager.interactText, legacyScene.interactText, 'legacy manager must receive already-created prompt UI');

class FakeElement {
    constructor() {
        this.listeners = new Map();
        this.classList = { add() {}, remove() {} };
        this.style = {};
    }
    addEventListener(type, handler) { this.listeners.set(type, handler); }
    removeEventListener(type, handler) {
        if (this.listeners.get(type) === handler) this.listeners.delete(type);
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}

const elements = {
    'joystick-zone': new FakeElement(),
    'joystick-knob': new FakeElement(),
    'action-btn': new FakeElement()
};
globalThis.document = {
    getElementById(id) { return elements[id] || null; },
    addEventListener() {},
    removeEventListener() {}
};
let mobileEntryCalls = 0;
const mobileScene = new GameScene();
mobileScene.joystick = { x: 0, y: 0, active: false };
mobileScene.gameState = { isHidden: false };
mobileScene.interactText = { visible: true };
mobileScene.interactionManager = { handleInteraction() { mobileEntryCalls += 1; } };
mobileScene.initJoystick();
elements['action-btn'].listeners.get('mousedown')({ preventDefault() {} });
assert.equal(mobileEntryCalls, 1, 'mobile action button must use the same polymorphic handleInteraction entry');
mobileScene.destroyJoystick();

let shutdownHandler = null;
let interactionDestroyCalls = 0;
let tableDestroyCalls = 0;
const shutdownScene = new GameScene();
shutdownScene.events = { once(eventName, handler) { assert.equal(eventName, Phaser.Scenes.Events.SHUTDOWN); shutdownHandler = handler; } };
shutdownScene.destroyJoystick = () => {};
shutdownScene.sliceMapManager = new SliceMapManager({});
shutdownScene.sliceMapManager.destroy = () => {};
shutdownScene.chaseManager = { destroy() {} };
shutdownScene.hauntingDirector = { destroy() {} };
shutdownScene.interactionManager = { destroy() { interactionDestroyCalls += 1; } };
shutdownScene.kitchenTableController = { destroy() { tableDestroyCalls += 1; } };
shutdownScene.registerShutdownCleanup();
shutdownHandler();
assert.equal(interactionDestroyCalls, 1);
assert.equal(tableDestroyCalls, 1);

const interactionSource = readFileSync(new URL('../src/systems/SliceInteractionManager.js', import.meta.url), 'utf8');
assert.doesNotMatch(interactionSource, /showPuzzle|caseConclusions|puzzleProgress/);

const builder = readFileSync(new URL('./build_standalone_entry.mjs', import.meta.url), 'utf8');
for (const dependency of [
    ["'src/systems/InteractionRules.js'", "'src/systems/SliceInteractionManager.js'"],
    ["'src/systems/KitchenTableRules.js'", "'src/systems/KitchenTableController.js'"],
    ["'src/systems/SliceInteractionManager.js'", "'src/scenes/GameScene.js'"],
    ["'src/systems/KitchenTableController.js'", "'src/scenes/GameScene.js'"]
]) {
    assert.ok(builder.indexOf(dependency[0]) >= 0, `builder missing ${dependency[0]}`);
    assert.ok(builder.indexOf(dependency[1]) > builder.indexOf(dependency[0]), `${dependency[0]} must precede ${dependency[1]}`);
}

console.log('Slice interaction verification passed');
