import assert from 'node:assert/strict';
import {
    CODA_TEXT,
    REACTIONS,
    SliceNarrativeDirector,
    findForbiddenReveal,
    getPlaneChoiceEffects,
    getReaction,
    listReactions,
    shouldPaperDollMove
} from '../src/systems/SliceNarrativeDirector.js';
import { SliceInteractionManager } from '../src/systems/SliceInteractionManager.js';
import { SliceMaps } from '../src/data/SliceMaps.js';
import { createDefaultSliceState } from '../src/systems/SliceState.js';

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
assert.throws(() => getPlaneChoiceEffects('fold'), /unknown plane choice/i);

assert.equal(getReaction('arrival', 'cold_bowl'), '三只碗留着新擦痕。第四只没有。');
assert.equal(getReaction('table', 'wrong_meal'), '影子坐下了，但没有一个人碰筷子。');
assert.equal(getReaction('bedroom', 'mirror'), '镜子挂得很低。我得弯腰才能照见脸。');
assert.equal(getReaction('return', 'plane_take'), '书包沉了一下。侧门的插销自己弹开了。');
assert.equal(getReaction('return', 'plane_leave'), '抽屉合上后，门外多了一道很轻的纸响。');
assert.equal(getReaction('missing', 'line'), '');
assert.deepEqual(Object.keys(REACTIONS).sort(), ['arrival', 'bedroom', 'return', 'table']);
assert.deepEqual(listReactions(), [
    REACTIONS.arrival.cold_bowl,
    REACTIONS.table.wrong_meal,
    REACTIONS.bedroom.mirror,
    REACTIONS.return.plane_take,
    REACTIONS.return.plane_leave
]);

for (const input of [
    { planeChoice: null, facingDot: -0.25, movedDistance: 24, blocked: false },
    { planeChoice: 'leave', facingDot: -0.9, movedDistance: 48, blocked: false }
]) assert.equal(shouldPaperDollMove(input), true);
for (const input of [
    { planeChoice: 'take', facingDot: -1, movedDistance: 24, blocked: false },
    { planeChoice: null, facingDot: -0.24, movedDistance: 24, blocked: false },
    { planeChoice: null, facingDot: -0.25, movedDistance: 23, blocked: false },
    { planeChoice: null, facingDot: -0.25, movedDistance: 24, blocked: true }
]) assert.equal(shouldPaperDollMove(input), false);

assert.deepEqual(SliceMaps.room_kitchen.objects.paperDollAnchors, [
    { x: 512, y: 336 },
    { x: 448, y: 384 },
    { x: 400, y: 320, facing: 'left', pointsTo: 'under_table' }
]);
for (const anchor of SliceMaps.room_kitchen.objects.paperDollAnchors) {
    const table = SliceMaps.room_kitchen.objects.table;
    const distanceTo = point => Math.hypot(anchor.x - point.x, anchor.y - point.y);
    const inTable = anchor.x >= table.collisionBounds.x && anchor.x <= table.collisionBounds.x + table.collisionBounds.width &&
        anchor.y >= table.collisionBounds.y && anchor.y <= table.collisionBounds.y + table.collisionBounds.height;
    assert.equal(inTable, false, 'paper doll anchors cannot become table collision blockers');
    assert.equal(
        Object.values(table.bowlOrigins).some(origin => distanceTo(origin) <= 64),
        false,
        'paper doll anchors cannot cover required bowl origins or their interaction approach'
    );
    assert.equal(
        Object.values(table.seats).some(seat => distanceTo(seat) <= 64),
        false,
        'paper doll anchors cannot cover required table seats or their interaction approach'
    );
    assert.equal(
        SliceMaps.room_kitchen.objects.props
            .filter(prop => prop.kind === 'observe')
            .some(prop => distanceTo(prop) <= 64),
        false,
        'paper doll anchors cannot cover required observation approaches'
    );
    assert.equal(
        SliceMaps.room_kitchen.objects.doors
            .some(door => distanceTo({ x: door.x * 32 + 16, y: door.y * 32 + 16 }) <= 64),
        false,
        'paper doll anchors cannot cover a door approach'
    );
}
assert.equal(SliceMaps.room_kitchen.objects.paperDollAnchors.at(-1).pointsTo, 'under_table');

const fallbackAnchorSlice = createDefaultSliceState();
const fallbackAnchorRuntime = makeNarrativeScene('room_kitchen', fallbackAnchorSlice);
fallbackAnchorRuntime.scene.sliceMapDef = { objects: {} };
const fallbackAnchorDirector = new SliceNarrativeDirector(fallbackAnchorRuntime.scene);
assert.deepEqual(
    { x: fallbackAnchorDirector.paperDoll.x, y: fallbackAnchorDirector.paperDoll.y },
    { x: 512, y: 336 },
    'the no-map fallback must preserve the same safe paper-doll staging area'
);
fallbackAnchorDirector.destroy();

assert.equal(findForbiddenReveal([SliceMaps, REACTIONS, CODA_TEXT]), null);
for (const hazard of ['主角就是明儿', '今天是忌日', '她已经死了', '死在雨夜的孩子', '棺材里躺着我']) {
    assert.equal(findForbiddenReveal({ nested: [hazard] }), hazard);
}
for (const hazard of ['明儿就是主角', '我就是明儿', '明儿的身份已经确认']) {
    assert.equal(findForbiddenReveal({ nested: [hazard] }), hazard, 'the leakage scanner must block any direct 明儿 identity confirmation');
}

function makeObject(x = 0, y = 0, texture = 'npc_paper') {
    return {
        x, y, texture: { key: texture }, active: true, visible: true, alpha: 1,
        setDepth(value) { this.depth = value; return this; },
        setAlpha(value) { this.alpha = value; return this; },
        setTint(value) { this.tint = value; return this; },
        setScale(value) { this.scale = value; return this; },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
        setVisible(value) { this.visible = value; return this; },
        destroy() { this.destroyed = true; this.active = false; }
    };
}

function makeNarrativeScene(mapId, state) {
    const created = [];
    const timers = [];
    const tweens = [];
    const props = new Map();
    for (const prop of SliceMaps[mapId].objects.props || []) {
        const object = makeObject(prop.x, prop.y, prop.texture);
        object.objId = prop.id;
        object.sliceAction = prop.kind;
        object.sliceData = structuredClone(prop);
        props.set(prop.id, object);
    }
    const scene = {
        currentMapId: mapId,
        clockMs: 0,
        sliceState: state,
        gameState: { slice: state },
        isSwitching: false,
        player: { facingX: 1, facingY: 0, sprite: { x: 240, y: 220 } },
        sliceMapDef: SliceMaps[mapId],
        sliceSafeZones: mapId === 'room_kitchen' ? SliceMaps.room_kitchen.objects.table.safeZones : {},
        add: {
            image(x, y, texture) { const object = makeObject(x, y, texture); created.push(object); return object; },
            rectangle(x, y) { const object = makeObject(x, y, 'rectangle'); created.push(object); return object; },
            text(x, y, text) { const object = makeObject(x, y, 'text'); object.text = text; created.push(object); return object; }
        },
        tweens: {
            add(config) {
                const tween = {
                    config,
                    stop() { this.stopped = true; },
                    remove() { this.removed = true; },
                    complete() {
                        if (this.completed) return;
                        this.completed = true;
                        const targets = Array.isArray(config.targets) ? config.targets : [config.targets];
                        for (const target of targets) {
                            if (!target) continue;
                            if (Number.isFinite(config.x)) target.x = config.x;
                            if (Number.isFinite(config.y)) target.y = config.y;
                            if (Number.isFinite(config.alpha)) target.setAlpha?.(config.alpha);
                            if (Number.isFinite(config.scale)) target.setScale?.(config.scale);
                        }
                        config.onComplete?.();
                    }
                };
                tweens.push(tween);
                return tween;
            }
        },
        time: {
            delayedCall(delay, callback) {
                const timer = {
                    delay,
                    dueAt: scene.clockMs + delay,
                    callback,
                    remove() { this.removed = true; },
                    destroy() { this.destroyed = true; }
                };
                timers.push(timer);
                return timer;
            }
        },
        events: { once() {}, off() {} },
        sliceMapManager: {
            findProp(id) { return props.get(id) || null; },
            applyRoomRevision(nextState) { scene.revisions.push(structuredClone(nextState)); return true; },
            refreshDoorAccess() {}
        },
        revisions: [],
        reactions: [],
        showSliceReaction(line) { this.reactions.push(line); }
    };
    return { scene, props, created, timers, tweens };
}

function advanceNarrativeClock(runtime, milliseconds) {
    const targetTime = runtime.scene.clockMs + milliseconds;
    const pending = () => runtime.timers
        .filter(timer => !timer.removed && !timer.fired && timer.dueAt <= targetTime)
        .sort((first, second) => first.dueAt - second.dueAt)[0];
    let timer = pending();
    while (timer) {
        runtime.scene.clockMs = timer.dueAt;
        timer.fired = true;
        timer.callback();
        timer = pending();
    }
    runtime.scene.clockMs = targetTime;
}

function completeNarrativeTweens(runtime) {
    for (const tween of runtime.tweens) tween.complete();
}

const bedroomSlice = { ...createDefaultSliceState(), slicePhase: 'bedroom' };
const bedroomRuntime = makeNarrativeScene('room_bedroom_me', bedroomSlice);
const bedroomDirector = new SliceNarrativeDirector(bedroomRuntime.scene);
const mirror = bedroomRuntime.props.get('child_mirror');
const plane = bedroomRuntime.props.get('bedroom_plane');
assert.equal(bedroomDirector.handleInteraction(mirror).status, 'investigated');
assert.equal(bedroomDirector.handleInteraction(plane).status, 'investigated');
assert.equal(bedroomDirector.isPlaneChoiceReady(), true, 'mirror and folded plane must both be investigated before a choice exists');
assert.equal(bedroomDirector.handleInteraction(bedroomRuntime.props.get('plane_bag')).status, 'chosen');
assert.equal(bedroomSlice.planeChoice, 'take');
assert.equal(bedroomSlice.slicePhase, 'return');
assert.equal(bedroomDirector.bagPlane?.active, true, 'taking the plane must leave a bounded bag visual');
assert.equal(bedroomDirector.handleInteraction(bedroomRuntime.props.get('plane_drawer')).status, 'locked');
assert.ok(bedroomRuntime.scene.revisions.length >= 1, 'choice must persist through a room revision');
assert.equal(bedroomDirector.handleInteraction(mirror).status, 'mirror_after_choice');
assert.equal(bedroomDirector.mirrorReflection?.active, true, 'the final mirror must create a child-height reflection');
bedroomDirector.update(0, 0);
bedroomRuntime.scene.player.sprite.x += 24;
bedroomDirector.update(16, 16);
assert.equal(bedroomDirector.mirrorReflection, null, 'normal reflection must return as soon as the player moves');
bedroomDirector.destroy();
assert.equal(bedroomDirector.bagPlane, null);

const leaveBedroomSlice = { ...createDefaultSliceState(), slicePhase: 'bedroom' };
const leaveBedroomRuntime = makeNarrativeScene('room_bedroom_me', leaveBedroomSlice);
const leaveBedroomDirector = new SliceNarrativeDirector(leaveBedroomRuntime.scene);
assert.equal(leaveBedroomDirector.handleInteraction(leaveBedroomRuntime.props.get('child_mirror')).status, 'investigated');
assert.equal(leaveBedroomDirector.handleInteraction(leaveBedroomRuntime.props.get('bedroom_plane')).status, 'investigated');
assert.equal(leaveBedroomDirector.handleInteraction(leaveBedroomRuntime.props.get('plane_drawer')).status, 'chosen');
assert.equal(leaveBedroomSlice.planeChoice, 'leave');
assert.equal(
    leaveBedroomSlice.paperDollIndex,
    2,
    'leaving the plane must persist the paper doll at the under-table helper anchor before the return bell'
);
leaveBedroomDirector.destroy();

const leaveReentrySlice = {
    ...createDefaultSliceState(),
    slicePhase: 'return',
    planeChoice: 'leave',
    paperDollIndex: 2
};
const leaveReentryRuntime = makeNarrativeScene('room_kitchen', leaveReentrySlice);
leaveReentryRuntime.scene.player.sprite = { x: 400, y: 400 };
leaveReentryRuntime.scene.player.facingX = 0;
leaveReentryRuntime.scene.player.facingY = -1;
const leaveReentryDirector = new SliceNarrativeDirector(leaveReentryRuntime.scene);
assert.equal(
    leaveReentryDirector.paperDoll,
    null,
    'returning to the kitchen while still facing the intended paper-doll anchor must not spawn it into view'
);
leaveReentryDirector.update(0, 16);
assert.equal(leaveReentryDirector.paperDoll, null, 'the paper doll must keep waiting while the player remains close and looking at its anchor');
leaveReentryRuntime.scene.player.facingY = 1;
leaveReentryDirector.update(16, 16);
assert.ok(leaveReentryDirector.paperDoll?.active, 'turning away from the final anchor must let the leave-route paper doll appear');
assert.equal(leaveReentryDirector.paperDoll.slicePointsTo, 'under_table');
leaveReentryDirector.destroy();

const takeReentrySlice = {
    ...createDefaultSliceState(),
    slicePhase: 'return',
    planeChoice: 'take',
    paperDollIndex: 2
};
const takeReentryRuntime = makeNarrativeScene('room_kitchen', takeReentrySlice);
takeReentryRuntime.scene.player.sprite = { x: 400, y: 400 };
takeReentryRuntime.scene.player.facingX = 0;
takeReentryRuntime.scene.player.facingY = 1;
const takeReentryDirector = new SliceNarrativeDirector(takeReentryRuntime.scene);
takeReentryDirector.update(0, 16);
assert.equal(takeReentryDirector.paperDoll, null, 'the take route must never restore the paper doll after a kitchen re-entry');
takeReentryDirector.destroy();

const kitchenSlice = createDefaultSliceState();
const kitchenRuntime = makeNarrativeScene('room_kitchen', kitchenSlice);
const kitchenDirector = new SliceNarrativeDirector(kitchenRuntime.scene);
assert.ok(kitchenDirector.paperDoll?.active, 'the paper doll starts in the kitchen before a choice');
assert.equal(kitchenDirector.tryMovePaperDoll({ facingDot: -0.6, movedDistance: 24, blocked: false }), true);
assert.equal(kitchenSlice.paperDollIndex, 1);
assert.equal(kitchenDirector.tryMovePaperDoll({ facingDot: -0.6, movedDistance: 24, blocked: false }), true);
assert.equal(kitchenSlice.paperDollIndex, 2);
assert.equal(kitchenDirector.tryMovePaperDoll({ facingDot: -0.6, movedDistance: 24, blocked: false }), false, 'paper doll can only move twice in the slice');
kitchenSlice.planeChoice = 'take';
kitchenDirector.update(0, 16);
assert.equal(kitchenDirector.paperDoll, null, 'taking the plane removes the paper doll rather than turning it into a marker');
kitchenDirector.destroy();

const codaSlice = { ...createDefaultSliceState(), slicePhase: 'return', planeChoice: 'leave' };
const codaRuntime = makeNarrativeScene('room_main', codaSlice);
const codaDirector = new SliceNarrativeDirector(codaRuntime.scene);
assert.equal(codaDirector.handleInteraction(codaRuntime.props.get('main_cold_bowl')).status, 'coda_playing');
assert.equal(codaSlice.slicePhase, 'complete');
assert.ok(codaRuntime.timers.every(timer => timer.delay <= 6000), 'the completion coda must remain bounded');
assert.ok(codaDirector.coda.outline?.active, 'the child-height reflection begins in the fourth bowl');
assert.equal(codaDirector.coda.drop, null, 'the rain drop cannot appear in the same frame as the reflection');
assert.equal(codaDirector.coda.card, null, 'the preview card cannot appear in the opening frame');
const initialOutline = {
    x: codaDirector.coda.outline.x,
    y: codaDirector.coda.outline.y,
    alpha: codaDirector.coda.outline.alpha,
    scale: codaDirector.coda.outline.scale
};
advanceNarrativeClock(codaRuntime, 1400);
assert.ok(codaDirector.coda.drop?.active, 'a delayed rain drop must appear to break the reflection');
assert.ok(
    codaDirector.coda.outline.alpha < initialOutline.alpha ||
        codaDirector.coda.outline.scale !== initialOutline.scale ||
        codaDirector.coda.outline.x !== initialOutline.x ||
        codaDirector.coda.outline.y !== initialOutline.y,
    'the drop must visibly disturb the child-height reflection'
);
completeNarrativeTweens(codaRuntime);
assert.equal(codaDirector.coda.outline.alpha, 0, 'the drop tween must finish by actually fading the reflection out');
assert.equal(codaDirector.coda.outline.scale, 0.66, 'the drop tween must finish by shrinking the reflection');
assert.equal(codaDirector.coda.drop.alpha, 0, 'the drop tween must finish by dissipating the rain drop');
advanceNarrativeClock(codaRuntime, 1600);
assert.ok(codaDirector.coda.card?.active, 'the preview card must arrive only after the broken reflection');
assert.equal(codaDirector.coda.card.alpha, 0, 'the preview card must appear through a fade rather than a same-frame opaque pop');
assert.ok(
    codaRuntime.tweens.some(tween => tween.config.targets === codaDirector.coda.card && tween.config.alpha === 1),
    'the preview card must own its fade-in tween'
);
assert.ok(codaRuntime.created.some(object => object.text === '饭凉了。'), 'the mother coda line must contain no speaker label or added explanation');
assert.equal(codaDirector.skipCoda(), true, 'the preview card must be immediately advanceable');
assert.equal(codaDirector.skipCoda(), false);
assert.ok(codaRuntime.created.every(object => object.destroyed === true), 'skipping the preview must clean up every coda actor');
assert.equal(codaDirector.ownedTweens.length, 0, 'skipping the preview must release every coda tween');
assert.ok(codaRuntime.tweens.every(tween => tween.stopped === true && tween.removed === true), 'skipping the preview must stop and remove coda tweens');
codaDirector.destroy();

const naturalCodaSlice = { ...createDefaultSliceState(), slicePhase: 'return', planeChoice: 'leave' };
const naturalCodaRuntime = makeNarrativeScene('room_main', naturalCodaSlice);
const naturalCodaDirector = new SliceNarrativeDirector(naturalCodaRuntime.scene);
assert.equal(naturalCodaDirector.handleInteraction(naturalCodaRuntime.props.get('main_cold_bowl')).status, 'coda_playing');
advanceNarrativeClock(naturalCodaRuntime, 5200);
assert.equal(naturalCodaDirector.coda, null, 'the unskipped coda must naturally finish on its bounded completion timer');
assert.ok(naturalCodaRuntime.timers.every(timer => timer.removed === true), 'natural completion must remove every coda timer');
assert.ok(naturalCodaRuntime.tweens.every(tween => tween.stopped === true && tween.removed === true), 'natural completion must stop and remove every coda tween');
assert.ok(naturalCodaRuntime.created.every(object => object.destroyed === true), 'natural completion must destroy every coda actor');
const naturallyFinishedActorCount = naturalCodaRuntime.created.length;
advanceNarrativeClock(naturalCodaRuntime, 1000);
assert.equal(naturalCodaRuntime.created.length, naturallyFinishedActorCount, 'a finished coda must not run a second delayed callback');
naturalCodaDirector.destroy();

const codaInputSlice = { ...createDefaultSliceState(), slicePhase: 'return', planeChoice: 'take' };
const codaInputRuntime = makeNarrativeScene('room_main', codaInputSlice);
const codaInputDirector = new SliceNarrativeDirector(codaInputRuntime.scene);
codaInputRuntime.scene.sliceNarrativeDirector = codaInputDirector;
codaInputRuntime.scene.currentTarget = {
    obj: codaInputRuntime.props.get('main_cold_bowl'),
    route: 'observe',
    type: 'observe'
};
const codaInputManager = new SliceInteractionManager(codaInputRuntime.scene);
assert.deepEqual(
    codaInputManager.handleInteraction(),
    { status: 'coda_playing' },
    'the main-hall cold bowl must invoke the coda through the real interaction route'
);
advanceNarrativeClock(codaInputRuntime, 3000);
const priorPhaser = globalThis.Phaser;
globalThis.Phaser = { Input: { Keyboard: { JustDown: key => key?.justDown === true } } };
codaInputRuntime.scene.keyE = { justDown: true };
codaInputRuntime.scene.keySpace = { justDown: false };
codaInputRuntime.scene.interactText = { setVisible() { return this; } };
assert.deepEqual(codaInputManager.checkInteraction(), { status: 'coda_skipped' });
globalThis.Phaser = priorPhaser;
assert.equal(codaInputDirector.coda, null, 'skipping through the normal input path must clean up the active coda');
assert.equal(
    codaInputRuntime.timers.find(timer => timer.delay === 5200)?.removed,
    true,
    'skipping the coda must cancel its remaining completion timer rather than leave a delayed callback behind'
);
codaInputDirector.destroy();

const arrivalSlice = createDefaultSliceState();
const arrivalRuntime = makeNarrativeScene('room_main', arrivalSlice);
const arrivalDirector = new SliceNarrativeDirector(arrivalRuntime.scene);
assert.deepEqual(arrivalDirector.handleInteraction(arrivalRuntime.props.get('main_cold_bowl')), {
    status: 'observed', targetId: 'main_cold_bowl'
});
assert.deepEqual(arrivalRuntime.scene.reactions, [REACTIONS.arrival.cold_bowl]);
assert.deepEqual(
    arrivalDirector.handleInteraction(arrivalRuntime.props.get('main_cold_bowl')),
    { status: 'observed', targetId: 'main_cold_bowl' },
    'the already-observed arrival bowl remains inspectable without replaying its protagonist line'
);
assert.deepEqual(arrivalRuntime.scene.reactions, [REACTIONS.arrival.cold_bowl], 'each slice phase may emit its authored protagonist reaction only once');
arrivalDirector.destroy();

const crossPhaseSlice = { ...createDefaultSliceState(), slicePhase: 'table' };
const crossPhaseRuntime = makeNarrativeScene('room_main', crossPhaseSlice);
const crossPhaseDirector = new SliceNarrativeDirector(crossPhaseRuntime.scene);
assert.deepEqual(crossPhaseDirector.handleInteraction(crossPhaseRuntime.props.get('main_cold_bowl')), {
    status: 'observed', targetId: 'main_cold_bowl'
});
assert.deepEqual(crossPhaseRuntime.scene.reactions, [], 'the arrival cold-bowl line must not leak into later slice phases after a room return');
crossPhaseDirector.destroy();

const repeatMirrorSlice = { ...createDefaultSliceState(), slicePhase: 'bedroom' };
const repeatMirrorRuntime = makeNarrativeScene('room_bedroom_me', repeatMirrorSlice);
const repeatMirrorDirector = new SliceNarrativeDirector(repeatMirrorRuntime.scene);
const repeatMirror = repeatMirrorRuntime.props.get('child_mirror');
assert.deepEqual(repeatMirrorDirector.handleInteraction(repeatMirror), {
    status: 'investigated', targetId: 'child_mirror'
});
assert.deepEqual(repeatMirrorDirector.handleInteraction(repeatMirror), {
    status: 'observed', targetId: 'child_mirror'
});
assert.deepEqual(repeatMirrorRuntime.scene.reactions, [REACTIONS.bedroom.mirror], 'the low mirror may be reinspected without repeating its line');
assert.equal(repeatMirrorDirector.handleInteraction(repeatMirrorRuntime.props.get('bedroom_plane')).status, 'investigated');
assert.equal(repeatMirrorDirector.isPlaneChoiceReady(), true, 'a repeated mirror inspection must retain the choice prerequisite');
repeatMirrorDirector.destroy();

console.log('Slice narrative verification passed');
