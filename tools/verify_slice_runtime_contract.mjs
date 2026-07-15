import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SliceMaps } from '../src/data/SliceMaps.js';
import { createDefaultSliceState } from '../src/systems/SliceState.js';
import { normalizeInteractionMeta } from '../src/systems/InteractionRules.js';

globalThis.Phaser = {
    Scene: class {},
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'fadeoutcomplete' } } },
    Input: { Keyboard: { KeyCodes: {} } },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    BlendModes: { MULTIPLY: 'multiply', OVERLAY: 'overlay', ADD: 'add' },
    Math: {
        Angle: { RotateTo: (current) => current },
        Between: () => 0,
        Distance: { Between: () => 0 }
    }
};

const [{ SliceMapManager }, { TextureGenerator }, { GameScene }] = await Promise.all([
    import('../src/systems/SliceMapManager.js'),
    import('../src/systems/TextureGenerator.js'),
    import('../src/scenes/GameScene.js')
]);

function createDisplayObject(type, x, y, textureKey, width = 32, height = 32) {
    return {
        type,
        x,
        y,
        width,
        height,
        displayWidth: width,
        displayHeight: height,
        texture: textureKey ? { key: textureKey } : undefined,
        active: true,
        visible: true,
        alpha: 1,
        destroyed: false,
        setTint(value) { this.tint = value; return this; },
        setPipeline(value) { this.pipeline = value; return this; },
        setDepth(value) { this.depth = value; return this; },
        setAlpha(value) { this.alpha = value; return this; },
        setVisible(value) { this.visible = value; return this; },
        setOrigin(...value) { this.origin = value; return this; },
        setScrollFactor(value) { this.scrollFactor = value; return this; },
        setStrokeStyle(...value) { this.strokeStyle = value; return this; },
        setDisplaySize(nextWidth, nextHeight) {
            this.displayWidth = nextWidth;
            this.displayHeight = nextHeight;
            return this;
        },
        once() { return this; },
        destroy() { this.destroyed = true; this.active = false; }
    };
}

function createGroup(scene, physicsBacked) {
    const children = [];
    return {
        add(object) {
            if (!children.includes(object)) children.push(object);
            return this;
        },
        create(x, y, textureKey) {
            const object = createDisplayObject('sprite', x, y, textureKey);
            if (physicsBacked) scene.physics.add.existing(object, true);
            children.push(object);
            return object;
        },
        getChildren() { return children; },
        clear() { children.length = 0; }
    };
}

function createScene(sliceState = createDefaultSliceState()) {
    const scene = {
        isMobile: false,
        sliceState,
        gameState: { slice: sliceState },
        effectCreations: [],
        lights: {
            active: true,
            enable() { this.active = true; return this; },
            setAmbientColor(value) { this.ambient = value; return this; }
        },
        cameras: { main: { setBounds(...args) { scene.cameraBounds = args; } } },
        tweens: { add(config) { return { ...config, remove() {} }; } },
        soundManager: { playSpatialNoise(...args) { scene.spatialNoises ??= []; scene.spatialNoises.push(args); } },
        time: {
            addEvent(config) {
                const effect = { type: 'timer', config, removed: false, remove() { this.removed = true; } };
                scene.effectCreations.push(effect);
                return effect;
            }
        }
    };
    scene.physics = {
        world: { setBounds(...args) { scene.worldBounds = args; } },
        add: {
            existing(object) {
                const width = object.displayWidth ?? object.width ?? 32;
                const height = object.displayHeight ?? object.height ?? 32;
                object.body = {
                    enable: true,
                    immovable: true,
                    x: object.x - width / 2,
                    y: object.y - height / 2,
                    width,
                    height
                };
                return object;
            },
            staticGroup() { return createGroup(scene, true); }
        }
    };
    scene.add = {
        group() { return createGroup(scene, false); },
        image(x, y, textureKey) { return createDisplayObject('image', x, y, textureKey); },
        rectangle(x, y, width, height, color, alpha) {
            return createDisplayObject('rectangle', x, y, undefined, width, height).setAlpha(alpha ?? 1);
        },
        particles(x, y, textureKey, config) {
            const effect = createDisplayObject('particles', x, y, textureKey);
            effect.config = config;
            effect.stop = function stop() { this.stopped = true; return this; };
            scene.effectCreations.push(effect);
            return effect;
        }
    };
    return scene;
}

const authoredSnapshot = structuredClone(SliceMaps);
for (const mapId of Object.keys(SliceMaps)) {
    const state = createDefaultSliceState();
    const scene = createScene(state);
    const manager = new SliceMapManager(scene);
    assert.equal(manager.createMap(mapId), true, `${mapId} should render`);

    for (const surface of ['walls', 'doors', 'furniture', 'interactables', 'floorLayer', 'navigationBlockedRects']) {
        assert.ok(scene[surface], `${mapId} must expose scene.${surface}`);
    }
    assert.notEqual(manager.mapDef, SliceMaps[mapId], `${mapId} runtime map must not alias authored data`);
    assert.notEqual(manager.mapDef.data, SliceMaps[mapId].data, `${mapId} runtime rows must be cloned`);
    assert.equal(scene.floorLayer.length, SliceMaps[mapId].width * SliceMaps[mapId].height);
    assert.equal(scene.doors.getChildren().length, SliceMaps[mapId].objects.doors.length);
    for (const door of scene.doors.getChildren()) {
        assert.ok(door.doorId && door.texture?.key, `${mapId} door ${door.doorId} must be a sprite`);
    }

    const ambientIds = new Set(
        SliceMaps[mapId].objects.props.filter(prop => prop.kind === 'ambient_anchor').map(prop => prop.id)
    );
    const interactables = scene.interactables.getChildren();
    assert.equal(interactables.some(object => ambientIds.has(object.objId)), false);
    for (const prop of SliceMaps[mapId].objects.props.filter(prop => prop.kind !== 'ambient_anchor')) {
        const object = interactables.find(candidate => candidate.objId === prop.id);
        assert.ok(object, `${prop.id} should be an interactable runtime prop`);
        assert.equal(object.sliceAction, prop.kind);
        assert.notEqual(object.sliceData, prop);
        assert.deepEqual(object.interaction, normalizeInteractionMeta({
            id: prop.id,
            dialog: prop.text,
            interaction: {
                label: prop.label || prop.id,
                verb: prop.verb || (prop.kind === 'observe' ? '观察' : '操作'),
                priority: prop.priority || 30,
                radius: prop.radius || 72,
                marker: false,
                blocksMovement: prop.blocksMovement ?? false
            }
        }, { textureKey: prop.texture }));
        object.sliceData.label = 'runtime-only mutation';
    }

    const effectsBeforeRevision = scene.effectCreations.length;
    const revisionState = {
        ...state,
        tableSolved: true,
        bowlPlacements: { nail: 'wine', stove: 'medicine', side: 'child' },
        mealReplaySeen: ['correct_meal'],
        planeChoice: 'take',
        slicePhase: 'return'
    };
    assert.equal(manager.applyRoomRevision(revisionState), true);
    const firstRevision = structuredClone(scene.sliceRoomRevision);
    assert.equal(manager.applyRoomRevision(structuredClone(revisionState)), false, 'same revision must be idempotent');
    assert.deepEqual(scene.sliceRoomRevision, firstRevision);
    assert.equal(scene.effectCreations.length, effectsBeforeRevision, 'revision must not replay room initialization');
    if (mapId === 'room_main') {
        assert.ok(manager.roomEffects.length > 0, 'main-room ambience must survive room revision application');
        assert.ok(
            manager.roomEffects.every(effect => effect.removed !== true && effect.destroyed !== true),
            'applying a revision must not clear ambient room effects'
        );
    }
    const roomEffects = [...manager.roomEffects];
    manager.destroy();
    assert.doesNotThrow(() => manager.destroy(), `${mapId} repeated destroy must be safe`);
    assert.ok(
        roomEffects.every(effect => effect.removed === true || effect.destroyed === true),
        `${mapId} must clean up authored room effects`
    );
}
assert.deepEqual(SliceMaps, authoredSnapshot, 'rendering all rooms must not mutate frozen map definitions');

const kitchenState = {
    ...createDefaultSliceState(),
    slicePhase: 'rule',
    tableSolved: true,
    houseRuleDemonstrated: true,
    bowlPlacements: { nail: 'wine', stove: 'medicine', side: 'child' }
};
const kitchenScene = createScene(kitchenState);
const kitchenManager = new SliceMapManager(kitchenScene);
kitchenManager.createMap('room_kitchen');
assert.deepEqual(kitchenScene.navigationBlockedRects, [
    { x: 280, y: 208, width: 80, height: 64 }
]);
assert.deepEqual(kitchenScene.sliceSafeZones, {
    under_table: { x: 296, y: 272, width: 48, height: 24 }
});
assert.equal(kitchenScene.navigationBlockedRects.includes(kitchenScene.sliceSafeZones.under_table), false);
assert.notEqual(kitchenScene.navigationBlockedRects[0], SliceMaps.room_kitchen.objects.table.collisionBounds);
assert.notEqual(kitchenScene.sliceSafeZones.under_table, SliceMaps.room_kitchen.objects.table.safeZones.under_table);

const sideDoor = kitchenScene.doors.getChildren().find(door => door.doorId === 'kitchen_side_door');
assert.ok(sideDoor && sideDoor.texture?.key, 'every authored door must be a sprite');
assert.equal(sideDoor.locked, false, 'solving the table must open the route to the bedroom');

function activeRevisionEffects(manager) {
    return manager.revisionEffects.filter(effect => effect.active !== false && !effect.destroyed && !effect.removed);
}

function assertKitchenProtection(manager, scene, expected) {
    assert.equal(scene.sliceSafeZones, manager.safeZones, 'scene must point at the current runtime safe-zone registry');
    assert.notEqual(scene.sliceSafeZones, SliceMaps.room_kitchen.objects.table.safeZones);
    assert.equal(Object.hasOwn(scene.sliceSafeZones, 'under_table'), expected);
    const effects = activeRevisionEffects(manager);
    assert.equal(effects.length, expected ? 2 : 0);
    assert.deepEqual(
        effects.map(effect => effect.sliceEffectId).sort(),
        expected ? ['kitchen_offering_steam', 'kitchen_table_warmth'] : []
    );
    assert.ok(effects.every(effect => effect.visible !== false), 'revision protection effects must be visible');
}

assertKitchenProtection(kitchenManager, kitchenScene, true);
const preBedroomEffects = [...kitchenManager.revisionEffects];

const takeState = { ...kitchenState, slicePhase: 'return', planeChoice: 'take' };
assert.equal(kitchenManager.applyRoomRevision(takeState), true);
assert.equal(sideDoor.locked, false, 'taking the plane keeps the short side-door return open');
assertKitchenProtection(kitchenManager, kitchenScene, false);
assert.ok(preBedroomEffects.every(effect => effect.destroyed === true || effect.removed === true));
assert.equal(kitchenManager.applyRoomRevision(structuredClone(takeState)), false);
kitchenManager.refreshDoorAccess(takeState);
assert.equal(sideDoor.locked, false);

const leaveState = { ...kitchenState, slicePhase: 'return', planeChoice: 'leave' };
assert.equal(kitchenManager.applyRoomRevision(leaveState), true);
assert.equal(sideDoor.locked, true, 'leaving the plane must lock the short side-door return');
assertKitchenProtection(kitchenManager, kitchenScene, true);
const leaveEffects = [...kitchenManager.revisionEffects];
assert.equal(kitchenManager.applyRoomRevision(structuredClone(leaveState)), false);
assert.deepEqual(kitchenManager.revisionEffects, leaveEffects, 'idempotent revision must not duplicate effects');
kitchenManager.refreshDoorAccess(leaveState);
assert.equal(sideDoor.locked, true, 'door refresh must retain the leave-choice overlay');

const beforeChoiceAgain = { ...kitchenState, planeChoice: null };
assert.equal(kitchenManager.applyRoomRevision(beforeChoiceAgain), true);
assert.equal(sideDoor.locked, false);
assertKitchenProtection(kitchenManager, kitchenScene, true);
assert.ok(leaveEffects.every(effect => effect.destroyed === true || effect.removed === true));
assert.notEqual(kitchenScene.sliceSafeZones.under_table, SliceMaps.room_kitchen.objects.table.safeZones.under_table);
const beforeChoiceEffects = [...kitchenManager.revisionEffects];
assert.equal(kitchenManager.applyRoomRevision(structuredClone(beforeChoiceAgain)), false);
assert.deepEqual(kitchenManager.revisionEffects, beforeChoiceEffects);
assert.deepEqual(SliceMaps, authoredSnapshot, 'kitchen return overlays must not mutate authored maps');

const finalRevisionEffects = [...kitchenManager.revisionEffects];
assert.doesNotThrow(() => kitchenManager.destroy());
assert.doesNotThrow(() => kitchenManager.destroy(), 'map-manager destroy must be idempotent');
assert.ok(finalRevisionEffects.every(effect => effect.destroyed === true || effect.removed === true));

const bedroomState = createDefaultSliceState();
const bedroomScene = createScene(bedroomState);
const bedroomManager = new SliceMapManager(bedroomScene);
bedroomManager.createMap('room_bedroom_me');
const [sideBedroomDoor, mainBedroomDoor] = bedroomScene.doors.getChildren();
assert.equal(sideBedroomDoor.locked, true);
assert.equal(mainBedroomDoor.locked, true);
bedroomState.planeChoice = 'leave';
bedroomManager.refreshDoorAccess(bedroomState);
assert.equal(sideBedroomDoor.locked, true);
assert.equal(mainBedroomDoor.locked, false);
bedroomState.planeChoice = 'take';
bedroomManager.refreshDoorAccess(bedroomState);
assert.equal(sideBedroomDoor.locked, false);
assert.equal(mainBedroomDoor.locked, false);

function createGraphicsRecorder(textureRecords) {
    const operations = [];
    const graphics = new Proxy({}, {
        get(target, property) {
            if (property === 'generateTexture') {
                return (key, width, height) => textureRecords.set(key, { width, height, operations: [...operations] });
            }
            return (...args) => {
                operations.push([String(property), ...args]);
                return graphics;
            };
        }
    });
    return graphics;
}

const textureRecords = new Map();
const textureScene = {
    make: { graphics: () => createGraphicsRecorder(textureRecords) },
    textures: {
        createCanvas() {
            const gradient = { addColorStop() {} };
            const context = {
                createRadialGradient: () => gradient,
                beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, fill() {}, fillRect() {}
            };
            return { getContext: () => context, refresh() {} };
        }
    }
};
TextureGenerator.generate(textureScene);
const textureKeys = [
    'bowl_wine', 'bowl_medicine', 'bowl_child', 'bowl_offering',
    'chair_nailed', 'blue_shard', 'slice_mirror', 'slice_uniform', 'train_ticket', 'comic_stack'
];
for (const key of textureKeys) assert.ok(textureRecords.has(key), `missing generated texture ${key}`);
const grayscaleShapeSignatures = ['bowl_wine', 'bowl_medicine', 'bowl_child', 'bowl_offering'].map(key => (
    JSON.stringify(textureRecords.get(key).operations.filter(([operation]) => !['fillStyle', 'lineStyle'].includes(operation)))
));
assert.equal(new Set(grayscaleShapeSignatures).size, 4, 'bowls must remain distinct without color');

function runTransitions(sliceMode) {
    const payloads = [];
    let scene = new GameScene();
    scene.init({ mapId: sliceMode ? 'room_main' : 'room_prologue', sliceMode });
    for (const transition of [
        { mapId: 'room_kitchen', x: 64, y: 256, doorId: 'main_kitchen_door' },
        { mapId: 'room_main', x: 704, y: 272, doorId: 'kitchen_main_door' }
    ]) {
        scene.isSwitching = false;
        scene.gameState = { isChasing: false };
        scene.sliceState = sliceMode ? createDefaultSliceState() : null;
        scene.cameras = {
            main: {
                fadeOut() {},
                once(eventName, callback) {
                    assert.equal(eventName, Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE);
                    callback();
                }
            }
        };
        scene.scene = { restart(payload) { payloads.push(payload); } };
        scene.switchScene(transition.mapId, transition.x, transition.y, transition.doorId);
        if (sliceMode) assert.equal(scene.sliceState.lastTraversedDoor, transition.doorId);
        const payload = payloads.at(-1);
        scene = new GameScene();
        scene.init(payload);
    }
    return payloads;
}

assert.deepEqual(runTransitions(true).map(payload => payload.sliceMode), [true, true]);
assert.deepEqual(runTransitions(false).map(payload => payload.sliceMode), [false, false]);

globalThis.window ??= {};
const dialogCalls = [];
window.showDialog = (...args) => dialogCalls.push(args);

let sliceKeyChecks = 0;
let sliceSwitchCalls = 0;
let sliceCameraShakes = 0;
const sliceDoorSounds = [];
const sliceDoorTweens = [];
const sliceLockedScene = new GameScene();
sliceLockedScene.init({ mapId: 'room_kitchen', sliceMode: true });
sliceLockedScene.gameState = {
    inventory: { includes() { sliceKeyChecks += 1; return true; } },
    lastLockedMsg: null
};
sliceLockedScene.time = { now: 1000 };
sliceLockedScene.playSound = (...args) => sliceDoorSounds.push(args);
sliceLockedScene.switchScene = () => { sliceSwitchCalls += 1; };
sliceLockedScene.tweens = { add(config) { sliceDoorTweens.push(config); return config; } };
sliceLockedScene.cameras = { main: { shake() { sliceCameraShakes += 1; } } };
const lockedSliceDoor = {
    locked: true,
    key: 'silver_key',
    x: 100,
    targetMap: 'room_bedroom_me',
    targetX: 64,
    targetY: 256
};
assert.equal(sliceLockedScene.handleLockedDoor(lockedSliceDoor), false);
assert.equal(sliceLockedScene.handleLockedDoor(lockedSliceDoor), false, 'slice feedback must be throttled');
assert.equal(sliceKeyChecks, 0, 'slice locks must never inspect legacy silver-key inventory');
assert.equal(sliceSwitchCalls, 0);
assert.equal(dialogCalls.length, 0, 'slice lock feedback must remain diegetic');
assert.equal(lockedSliceDoor.locked, true);
assert.equal(sliceCameraShakes, 0, 'slice lock feedback must not shake or blur the camera');
assert.equal(sliceDoorSounds.length, 1);
assert.equal(sliceDoorTweens.length, 1);
assert.equal(sliceDoorTweens[0].targets, lockedSliceDoor);
assert.equal(sliceDoorTweens[0].yoyo, true);
assert.ok(sliceDoorTweens[0].duration <= 100);
assert.ok(Math.abs(sliceDoorTweens[0].x - lockedSliceDoor.x) <= 4);
sliceLockedScene.time.now += 901;
assert.equal(sliceLockedScene.handleLockedDoor(lockedSliceDoor), false);
assert.equal(sliceDoorSounds.length, 2);
assert.equal(sliceDoorTweens.length, 2);

const legacyKeyScene = new GameScene();
legacyKeyScene.init({ mapId: 'room_main', sliceMode: false });
legacyKeyScene.gameState = { inventory: ['地下室钥匙'], lastLockedMsg: null };
legacyKeyScene.time = { now: 2000 };
const legacyKeySwitches = [];
const legacyKeySounds = [];
legacyKeyScene.switchScene = (...args) => legacyKeySwitches.push(args);
legacyKeyScene.playSound = (...args) => legacyKeySounds.push(args);
const keyedDoor = {
    locked: true,
    key: 'silver_key',
    targetMap: 'room_basement',
    targetX: 320,
    targetY: 128
};
assert.equal(legacyKeyScene.handleLockedDoor(keyedDoor), true);
assert.equal(keyedDoor.locked, false);
assert.deepEqual(legacyKeySwitches, [['room_basement', 320, 128, undefined]]);
assert.deepEqual(legacyKeySounds, [[400, 'sine', 1]]);
assert.equal(dialogCalls.length, 0);

const legacyNoKeyScene = new GameScene();
legacyNoKeyScene.init({ mapId: 'room_main', sliceMode: false });
legacyNoKeyScene.gameState = { inventory: [], lastLockedMsg: null };
legacyNoKeyScene.time = { now: 3000 };
let legacyNoKeySwitches = 0;
legacyNoKeyScene.switchScene = () => { legacyNoKeySwitches += 1; };
assert.equal(legacyNoKeyScene.handleLockedDoor({ ...keyedDoor, locked: true }), false);
assert.equal(legacyNoKeyScene.handleLockedDoor({ ...keyedDoor, locked: true }), false);
assert.equal(legacyNoKeySwitches, 0);
assert.deepEqual(dialogCalls, [['主角', '门锁住了。需要一把银色的钥匙。']]);
legacyNoKeyScene.time.now += 2001;
assert.equal(legacyNoKeyScene.handleLockedDoor({ ...keyedDoor, locked: true }), false);
assert.equal(dialogCalls.length, 2, 'legacy no-key dialog must keep its existing cooldown');

let shutdownHandler = null;
let sliceMapDestroyCalls = 0;
const shutdownScene = new GameScene();
shutdownScene.events = {
    once(eventName, callback) {
        assert.equal(eventName, Phaser.Scenes.Events.SHUTDOWN);
        shutdownHandler = callback;
    },
    emit(eventName) {
        if (eventName !== Phaser.Scenes.Events.SHUTDOWN || !shutdownHandler) return;
        const callback = shutdownHandler;
        shutdownHandler = null;
        callback();
    }
};
shutdownScene.destroyJoystick = () => {};
shutdownScene.sliceMapManager = { destroy() { sliceMapDestroyCalls += 1; } };
shutdownScene.chaseManager = { destroy() {} };
shutdownScene.hauntingDirector = { destroy() {} };
shutdownScene.registerShutdownCleanup();
shutdownScene.events.emit(Phaser.Scenes.Events.SHUTDOWN);
shutdownScene.events.emit(Phaser.Scenes.Events.SHUTDOWN);
assert.equal(sliceMapDestroyCalls, 1, 'registered shutdown cleanup must destroy the slice map once');

const builder = readFileSync(new URL('./build_standalone_entry.mjs', import.meta.url), 'utf8');
const sliceMapsIndex = builder.indexOf("'src/data/SliceMaps.js'");
const interactionRulesIndex = builder.indexOf("'src/systems/InteractionRules.js'");
const sliceManagerIndex = builder.indexOf("'src/systems/SliceMapManager.js'");
const gameSceneIndex = builder.indexOf("'src/scenes/GameScene.js'");
assert.ok(sliceManagerIndex > sliceMapsIndex);
assert.ok(sliceManagerIndex > interactionRulesIndex);
assert.ok(sliceManagerIndex < gameSceneIndex);

console.log('Slice runtime contract verification passed');
