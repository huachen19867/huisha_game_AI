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
    const roomEffects = [...manager.roomEffects];
    manager.destroy();
    assert.ok(
        roomEffects.every(effect => effect.removed === true || effect.destroyed === true),
        `${mapId} must clean up authored room effects`
    );
}
assert.deepEqual(SliceMaps, authoredSnapshot, 'rendering all rooms must not mutate frozen map definitions');

const kitchenState = createDefaultSliceState();
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
assert.equal(sideDoor.locked, true);
kitchenState.tableSolved = true;
kitchenManager.refreshDoorAccess(kitchenState);
assert.equal(sideDoor.locked, false, 'door locks must refresh without restarting the room');

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

const builder = readFileSync(new URL('./build_standalone_entry.mjs', import.meta.url), 'utf8');
const sliceMapsIndex = builder.indexOf("'src/data/SliceMaps.js'");
const interactionRulesIndex = builder.indexOf("'src/systems/InteractionRules.js'");
const sliceManagerIndex = builder.indexOf("'src/systems/SliceMapManager.js'");
const gameSceneIndex = builder.indexOf("'src/scenes/GameScene.js'");
assert.ok(sliceManagerIndex > sliceMapsIndex);
assert.ok(sliceManagerIndex > interactionRulesIndex);
assert.ok(sliceManagerIndex < gameSceneIndex);

console.log('Slice runtime contract verification passed');
