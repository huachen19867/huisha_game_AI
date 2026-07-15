import assert from 'node:assert/strict';
import {
    MEAL_CONTRADICTION_IDS,
    MEAL_REPLAYS,
    MemoryReplayDirector,
    getReplayDefinition,
    markReplaySeen,
    normalizeMealReplaySeen,
    shouldUseShortReplay
} from '../src/systems/MemoryReplayDirector.js';
import { KitchenTableController } from '../src/systems/KitchenTableController.js';
import { SliceMaps } from '../src/data/SliceMaps.js';
import { createDefaultSliceState } from '../src/systems/SliceState.js';

const EXPECTED_REPLAYS = {
    father_lock: { id: 'father_lock', durationMs: 4400, actor: 'father', consequence: 'lock_side_door' },
    mother_break: { id: 'mother_break', durationMs: 4200, actor: 'mother', consequence: 'return_stain_to_stove' },
    child_shard: { id: 'child_shard', durationMs: 3800, actor: 'child', consequence: 'reject_shard_match' },
    correct_meal: { id: 'correct_meal', durationMs: 5200, actor: 'family', consequence: 'open_side_door' }
};

assert.deepEqual(MEAL_REPLAYS, EXPECTED_REPLAYS);
assert.deepEqual(MEAL_CONTRADICTION_IDS, ['father_lock', 'mother_break', 'child_shard']);
assert.equal(Object.isFrozen(MEAL_REPLAYS), true);
assert.equal(Object.isFrozen(MEAL_REPLAYS.father_lock), true);
assert.equal(Object.isFrozen(MEAL_CONTRADICTION_IDS), true);

for (const [id, expected] of Object.entries(EXPECTED_REPLAYS)) {
    const first = getReplayDefinition(id);
    const second = getReplayDefinition(id);
    assert.deepEqual(first, expected);
    assert.notEqual(first, MEAL_REPLAYS[id]);
    assert.notEqual(first, second);
    first.actor = 'mutated';
    assert.equal(getReplayDefinition(id).actor, expected.actor);
}
for (const invalidId of [undefined, null, '', 'unknown', 'toString', 'constructor', '__proto__', 7]) {
    assert.throws(() => getReplayDefinition(invalidId), /unknown meal replay/i);
}

const dirtySeen = ['father_lock', 'father_lock', 'correct_meal', '', 7, 'mother_break', null, 'unknown'];
const dirtySeenSnapshot = [...dirtySeen];
const normalizedSeen = normalizeMealReplaySeen(dirtySeen);
assert.deepEqual(normalizedSeen, ['father_lock', 'mother_break']);
assert.notEqual(normalizedSeen, dirtySeen);
assert.deepEqual(dirtySeen, dirtySeenSnapshot);
for (const invalidSeen of [undefined, null, 'father_lock', {}, 7]) {
    assert.deepEqual(normalizeMealReplaySeen(invalidSeen), []);
    assert.throws(() => markReplaySeen(invalidSeen, 'father_lock'), /array/i);
    assert.throws(() => shouldUseShortReplay(invalidSeen, 'father_lock'), /array/i);
}
for (const invalidId of [undefined, null, '', 'correct_meal', 'unknown', 7]) {
    assert.throws(() => markReplaySeen([], invalidId), /contradiction/i);
    assert.throws(() => shouldUseShortReplay([], invalidId), /contradiction/i);
}
const seenInput = ['father_lock', 'father_lock', 'unknown'];
const marked = markReplaySeen(seenInput, 'mother_break');
assert.deepEqual(marked, ['father_lock', 'mother_break']);
assert.notEqual(marked, seenInput);
assert.deepEqual(seenInput, ['father_lock', 'father_lock', 'unknown']);
assert.deepEqual(markReplaySeen(['father_lock'], 'father_lock'), ['father_lock']);
assert.equal(shouldUseShortReplay(['father_lock'], 'father_lock'), true);
assert.equal(shouldUseShortReplay(['correct_meal', 'unknown'], 'father_lock'), false);

class FakeClock {
    constructor() {
        this.now = 0;
        this.jobs = [];
    }

    delayedCall(delay, callback) {
        const job = {
            delay,
            due: this.now + delay,
            callback,
            removed: false,
            remove() { this.removed = true; },
            destroy() { this.removed = true; }
        };
        this.jobs.push(job);
        return job;
    }

    advance(milliseconds) {
        const target = this.now + milliseconds;
        while (true) {
            const next = this.jobs
                .filter(job => !job.removed && job.due <= target)
                .sort((left, right) => left.due - right.due)[0];
            if (!next) break;
            this.now = next.due;
            next.removed = true;
            next.callback();
        }
        this.now = target;
    }
}

function makeDisplayObject(kind, x, y, textureKey = null) {
    return {
        kind,
        x,
        y,
        texture: textureKey ? { key: textureKey } : null,
        alpha: 1,
        visible: true,
        active: true,
        destroyed: false,
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
        setAlpha(alpha) { this.alpha = alpha; return this; },
        setDepth(depth) { this.depth = depth; return this; },
        setTint(tint) { this.tint = tint; return this; },
        setScale(scale) { this.scale = scale; return this; },
        setOrigin(originX, originY) { this.origin = [originX, originY]; return this; },
        setStrokeStyle(width, color, alpha) { this.stroke = [width, color, alpha]; return this; },
        setVisible(visible) { this.visible = visible; return this; },
        destroy() { this.destroyed = true; this.active = false; }
    };
}

function makeGroup(initial = []) {
    const children = [...initial];
    return {
        add(object) { if (!children.includes(object)) children.push(object); return object; },
        remove(object) { const index = children.indexOf(object); if (index >= 0) children.splice(index, 1); },
        getChildren() { return children; }
    };
}

function makeEvents() {
    const handlers = new Map();
    return {
        once(eventName, callback) { handlers.set(eventName, callback); },
        off(eventName, callback) { if (handlers.get(eventName) === callback) handlers.delete(eventName); },
        emit(eventName) {
            const callback = handlers.get(eventName);
            if (!callback) return;
            handlers.delete(eventName);
            callback();
        }
    };
}

function createReplayScene(state = createDefaultSliceState(), { preservePhase = false } = {}) {
    if (!preservePhase) state.slicePhase = 'table';
    const clock = new FakeClock();
    const created = [];
    const tweens = [];
    const sounds = [];
    const props = {
        nailed_chair: makeDisplayObject('prop', 320, 160, 'chair_nailed'),
        stove_stain: makeDisplayObject('prop', 480, 112, 'stove'),
        door_shard: makeDisplayObject('prop', 560, 272, 'blue_shard')
    };
    props.stove_stain.alpha = 0.63;
    props.door_shard.alpha = 0.71;
    const sideDoor = makeDisplayObject('door', 624, 272, 'tile_wall');
    sideDoor.doorId = 'kitchen_side_door';
    sideDoor.locked = true;
    sideDoor.alpha = 0.82;
    sideDoor.tint = 0x4a2727;
    const events = makeEvents();
    const scene = {
        sliceState: state,
        gameState: { slice: state },
        sliceMapDef: structuredClone(SliceMaps.room_kitchen),
        time: clock,
        events,
        player: { sprite: { x: 410, y: 330, body: { velocity: { x: 13, y: -7 } } } },
        add: {
            image(x, y, textureKey) {
                const object = makeDisplayObject('image', x, y, textureKey);
                created.push(object);
                return object;
            },
            rectangle(x, y, width, height, color, alpha) {
                const object = makeDisplayObject('rectangle', x, y);
                Object.assign(object, { width, height, color, alpha });
                created.push(object);
                return object;
            },
            circle(x, y, radius, color, alpha) {
                const object = makeDisplayObject('circle', x, y);
                Object.assign(object, { radius, color, alpha });
                created.push(object);
                return object;
            },
            particles(x, y, textureKey, config) {
                const object = makeDisplayObject('particles', x, y, textureKey);
                object.particleConfig = config;
                created.push(object);
                return object;
            }
        },
        tweens: {
            add(config) {
                const tween = {
                    config,
                    stopped: false,
                    destroyed: false,
                    applyEnd() {
                        const targets = Array.isArray(config.targets) ? config.targets : [config.targets];
                        for (const target of targets) {
                            for (const property of ['x', 'y', 'alpha', 'angle', 'scale']) {
                                if (Object.hasOwn(config, property)) target[property] = config[property];
                            }
                        }
                    },
                    stop() { this.stopped = true; },
                    remove() { this.destroyed = true; },
                    destroy() { this.destroyed = true; }
                };
                tweens.push(tween);
                return tween;
            }
        },
        playSound(...args) { sounds.push(args); },
        showDialog() { throw new Error('memory replay must not show dialog'); },
        showDocument() { throw new Error('memory replay must not show document'); },
        showPuzzle() { throw new Error('memory replay must not show puzzle'); },
        cameras: { main: { shake() { throw new Error('memory replay must not shake camera'); } } },
        interactables: makeGroup(Object.values(props)),
        doors: makeGroup([sideDoor])
    };
    scene.sliceMapManager = {
        refreshCalls: 0,
        revisionCalls: 0,
        findProp(id) { return props[id] || null; },
        refreshDoorAccess(nextState) {
            this.refreshCalls += 1;
            sideDoor.locked = nextState.tableSolved !== true;
            sideDoor.setTint(sideDoor.locked ? 0x4a2727 : 0x796754);
            sideDoor.setAlpha(sideDoor.locked ? 0.82 : 0.32);
        },
        applyRoomRevision() { this.revisionCalls += 1; return true; }
    };
    scene.kitchenTableController = { syncCalls: 0, syncSprites() { this.syncCalls += 1; } };
    return { scene, state, clock, created, tweens, sounds, props, sideDoor, events };
}

const ACTION_EXPECTATIONS = {
    child_shard: {
        actors: ['child'],
        effects: ['child_plane_shadow', 'child_shard_answer', 'child_shard_mismatch'],
        prop: 'door_shard'
    },
    father_lock: {
        actors: ['father'],
        effects: ['father_chair_pull', 'father_door_latch'],
        prop: 'nailed_chair'
    },
    mother_break: {
        actors: ['mother'],
        effects: ['mother_bowl_break', 'mother_stain_return'],
        prop: 'stove_stain'
    },
    correct_meal: {
        actors: ['father', 'mother', 'child'],
        effects: ['offering_ripple'],
        prop: null
    }
};

for (const [id, expected] of Object.entries(ACTION_EXPECTATIONS)) {
    const context = createReplayScene();
    const { scene, state, clock, created, tweens, sounds, props, sideDoor } = context;
    const initialVelocity = { ...scene.player.sprite.body.velocity };
    let completions = 0;
    const director = new MemoryReplayDirector(scene, state);
    const started = director.play(id, { onComplete: () => { completions += 1; } });
    assert.deepEqual(started, { status: 'playing', replayId: id, short: false, durationMs: EXPECTED_REPLAYS[id].durationMs });
    assert.equal(director.active, true);
    assert.deepEqual(scene.player.sprite.body.velocity, initialVelocity, `${id} must not alter player velocity`);
    assert.equal(globalThis.window?.dialogActive ?? false, false);
    assert.deepEqual(
        created.filter(object => object.sliceReplayActor).map(object => object.sliceReplayActor),
        expected.actors,
        `${id} must author the expected paper actors`
    );
    assert.ok(created.filter(object => object.sliceReplayActor).every(object => object.texture.key === 'npc_paper'));
    for (const effectId of expected.effects) {
        assert.ok(created.some(object => object.sliceReplayEffectId === effectId), `${id} missing effect ${effectId}`);
    }
    if (id === 'child_shard') {
        const plane = created.find(object => object.sliceReplayEffectId === 'child_plane_shadow');
        const planeTween = tweens.find(tween => tween.config.targets === plane);
        const mismatch = created.find(object => object.sliceReplayEffectId === 'child_shard_mismatch');
        assert.equal(plane.texture.key, 'toy_plane', 'the door impact must visibly use the authored paper plane');
        assert.equal(planeTween.config.x, sideDoor.x);
        assert.equal(planeTween.config.y, sideDoor.y);
        assert.equal(planeTween.config.yoyo, true, 'paper plane impact needs a visible rebound');
        assert.ok(planeTween.config.duration <= 1200, 'paper plane impact must stay short and percussive');
        assert.equal(mismatch.texture.key, 'blue_shard');
        assert.notDeepEqual(
            [mismatch.x, mismatch.y],
            [props.door_shard.x, props.door_shard.y],
            'the mismatch outline must be visibly offset from the real threshold shard'
        );
    }
    if (expected.prop) {
        assert.ok(
            tweens.some(tween => tween.config.targets === props[expected.prop]),
            `${id} must make ${expected.prop} visibly respond`
        );
    }
    assert.ok(sounds.length > 0, `${id} must have an authored sound response`);
    const createdBeforeGuard = created.length;
    assert.deepEqual(director.play('father_lock'), { status: 'replay_active' });
    assert.equal(created.length, createdBeforeGuard, 'active guard must not add effects');
    assert.equal(state.tableSolved, false, 'state must not commit before the replay completes');
    assert.equal(sideDoor.locked, true, 'door must remain closed during the replay');
    clock.advance(EXPECTED_REPLAYS[id].durationMs - 1);
    assert.equal(director.active, true);
    assert.equal(completions, 0);
    clock.advance(1);
    assert.equal(director.active, false);
    assert.equal(completions, 1);
    clock.advance(10000);
    assert.equal(completions, 1, 'completion callback must run at most once');
    assert.ok(created.every(object => object.destroyed), `${id} must clean all replay objects`);
    assert.ok(tweens.every(tween => tween.stopped || tween.destroyed), `${id} must clean all tweens`);
    if (id === 'correct_meal') {
        assert.equal(state.tableSolved, true);
        assert.equal(state.slicePhase, 'rule');
        assert.equal(state.houseRuleDemonstrated, false);
        assert.equal(sideDoor.locked, false);
        assert.equal(scene.kitchenTableController.syncCalls, 1);
        assert.equal(scene.sliceMapManager.refreshCalls, 2, 'cleanup restores the door before the solved commit opens it');
        assert.equal(scene.sliceMapManager.revisionCalls, 1);
    } else {
        assert.equal(state.tableSolved, false);
        assert.equal(state.slicePhase, 'table');
        assert.equal(sideDoor.locked, true);
        assert.equal(scene.sliceMapManager.refreshCalls, 1, 'cleanup must restore authored door visuals after every replay');
    }
}

for (const [id, worldProperties] of Object.entries({
    father_lock: [['nailed_chair', 'x'], ['sideDoor', 'alpha']],
    mother_break: [['stove_stain', 'alpha']],
    child_shard: [['door_shard', 'alpha']]
})) {
    const context = createReplayScene();
    const { scene, state, clock, tweens, props, sideDoor } = context;
    const worldTargets = { ...props, sideDoor };
    const originals = worldProperties.map(([targetId, property]) => [targetId, property, worldTargets[targetId][property]]);
    const director = new MemoryReplayDirector(scene, state);
    director.play(id);
    for (const tween of tweens) tween.applyEnd();
    for (const [targetId, property, original] of originals) {
        assert.notEqual(worldTargets[targetId][property], original, `${id} test must actually advance ${targetId}.${property}`);
    }
    director.destroy();
    clock.advance(10000);
    for (const [targetId, property, original] of originals) {
        const expected = targetId === 'sideDoor' && property === 'alpha' ? 0.82 : original;
        assert.equal(worldTargets[targetId][property], expected, `${id} must restore ${targetId}.${property}`);
    }
    assert.equal(sideDoor.locked, true);
    assert.equal(sideDoor.tint, 0x4a2727);
    assert.equal(scene.sliceMapManager.refreshCalls, 1);
    assert.equal(state.tableSolved, false);
}

for (const id of MEAL_CONTRADICTION_IDS) {
    const { scene, state, clock, created } = createReplayScene();
    const director = new MemoryReplayDirector(scene, state);
    const started = director.play(id, { short: true });
    assert.equal(started.status, 'playing');
    assert.equal(started.short, true);
    assert.ok(started.durationMs >= 600 && started.durationMs <= 900);
    assert.equal(started.durationMs, 720);
    assert.equal(created.some(object => object.sliceReplayActor), false, 'short echoes must not replay actors');
    assert.ok(created.some(object => object.sliceReplayEffectId), 'short echoes need localized world feedback');
    clock.advance(719);
    assert.equal(director.active, true);
    clock.advance(1);
    assert.equal(director.active, false);
    assert.equal(state.tableSolved, false);
}

{
    const { scene, state, clock, created, sideDoor } = createReplayScene();
    let completions = 0;
    const director = new MemoryReplayDirector(scene, state);
    director.play('correct_meal', { onComplete: () => { completions += 1; } });
    director.destroy();
    director.destroy();
    clock.advance(10000);
    assert.equal(completions, 0, 'destroy interruption must not report completion');
    assert.equal(state.tableSolved, false, 'destroy interruption must not solve the table');
    assert.equal(state.slicePhase, 'table');
    assert.equal(sideDoor.locked, true);
    assert.equal(director.active, false);
    assert.ok(created.every(object => object.destroyed));
    assert.deepEqual(director.play('father_lock'), { status: 'destroyed' });
}

{
    const { scene, state, clock, events } = createReplayScene();
    const director = new MemoryReplayDirector(scene, state);
    director.play('correct_meal');
    events.emit('shutdown');
    clock.advance(10000);
    assert.equal(state.tableSolved, false, 'scene shutdown must interrupt without solving');
    assert.equal(director.active, false);
}

function attachPhysicsBody(object) {
    object.body = {
        enable: true,
        updateCalls: 0,
        updateFromGameObject() { this.updateCalls += 1; }
    };
    return object;
}

function createControllerContext(overrides = {}) {
    const state = Object.assign(createDefaultSliceState(), overrides);
    const context = createReplayScene(state, { preservePhase: true });
    const { scene } = context;
    scene.physics = { add: { existing(object) { return attachPhysicsBody(object); } } };
    scene.add.rectangle = (x, y, width, height) => {
        const object = makeDisplayObject('rectangle', x, y);
        Object.assign(object, { width, height });
        context.created.push(object);
        return object;
    };
    scene.interactables = makeGroup(Object.values(context.props));
    scene.memoryReplayDirector = null;
    scene.kitchenTableController = null;
    const controller = new KitchenTableController(scene);
    scene.kitchenTableController = controller;
    return { ...context, controller };
}

{
    const { state, controller } = createControllerContext({ slicePhase: 'arrival' });
    assert.equal(state.slicePhase, 'investigation', 'entering the kitchen must advance arrival to investigation');
    assert.deepEqual(controller.pickBowl('wine'), { status: 'holding', bowlId: 'wine' });
    assert.equal(state.slicePhase, 'table', 'the first actual bowl pickup starts the table phase');
    assert.deepEqual(controller.placeHeldBowl('nail'), { status: 'incomplete', contradictions: [] });
    assert.equal(controller.memoryReplayDirector.active, false, 'incomplete arrangements must not replay');
    controller.destroy();
}

{
    const context = createControllerContext({
        slicePhase: 'table',
        bowlPlacements: { nail: 'medicine', stove: 'wine', side: null },
        heldBowl: 'child',
        mealReplaySeen: []
    });
    const { state, controller, clock, scene } = context;
    const velocity = { ...scene.player.sprite.body.velocity };
    const result = controller.placeHeldBowl('side');
    assert.equal(result.status, 'incorrect');
    assert.equal(result.replayId, 'father_lock');
    assert.equal(result.short, false);
    assert.deepEqual(state.mealReplaySeen, [], 'contradiction is marked only after a complete replay');
    assert.deepEqual(scene.player.sprite.body.velocity, velocity);
    assert.deepEqual(controller.pickBowl('wine'), { status: 'replay_active' });
    assert.deepEqual(controller.placeHeldBowl('nail'), { status: 'replay_active' });
    assert.deepEqual(controller.handleAction(controller.offeringBowl), { status: 'replay_active' });
    clock.advance(4400);
    assert.deepEqual(state.mealReplaySeen, ['father_lock']);
    controller.destroy();
}

{
    const { controller } = createControllerContext({
        slicePhase: 'table',
        bowlPlacements: { nail: 'medicine', stove: 'wine', side: null },
        heldBowl: 'child',
        mealReplaySeen: ['father_lock']
    });
    const result = controller.placeHeldBowl('side');
    assert.equal(result.replayId, 'mother_break', 'an unseen active contradiction must win over a seen one');
    assert.equal(result.short, false);
    controller.destroy();
}

{
    const { controller } = createControllerContext({
        slicePhase: 'table',
        bowlPlacements: { nail: 'medicine', stove: 'wine', side: null },
        heldBowl: 'child',
        mealReplaySeen: ['father_lock', 'mother_break', 'child_shard']
    });
    const result = controller.placeHeldBowl('side');
    assert.equal(result.replayId, 'father_lock', 'all-seen fallback must be deterministic');
    assert.equal(result.short, true, 'a repeated contradiction must use the short echo');
    controller.destroy();
}

{
    const context = createControllerContext({
        slicePhase: 'table',
        bowlPlacements: { nail: 'wine', stove: 'medicine', side: null },
        heldBowl: 'child',
        tableSolved: false,
        houseRuleDemonstrated: false
    });
    const { state, controller, clock, sideDoor, scene } = context;
    const result = controller.placeHeldBowl('side');
    assert.equal(result.status, 'correct');
    assert.equal(result.replayId, 'correct_meal');
    assert.equal(result.short, false);
    assert.equal(state.tableSolved, false);
    assert.equal(state.slicePhase, 'table');
    assert.equal(sideDoor.locked, true);
    clock.advance(5199);
    assert.equal(state.tableSolved, false);
    clock.advance(1);
    assert.equal(state.tableSolved, true);
    assert.equal(state.slicePhase, 'rule');
    assert.equal(state.houseRuleDemonstrated, false);
    assert.equal(sideDoor.locked, false);
    assert.ok(scene.sliceMapManager.refreshCalls > 0);
    assert.ok(scene.sliceMapManager.revisionCalls > 0);
    assert.ok([...controller.bowlSprites.values()].every(sprite => sprite.interactionEnabled === false));
    assert.ok([...controller.seatHotspots.values()].every(hotspot => hotspot.interactionEnabled === false));
    controller.destroy();
}

{
    const sharedState = createDefaultSliceState();
    sharedState.slicePhase = 'rule';
    sharedState.tableSolved = true;
    sharedState.bowlPlacements = { nail: 'wine', stove: 'medicine', side: 'child' };
    const { state, controller } = createControllerContext(sharedState);
    assert.equal(state.slicePhase, 'rule', 're-entering kitchen must never regress progress');
    controller.destroy();
}

console.log('Memory replay verification passed');
