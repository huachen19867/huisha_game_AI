const SHORT_REPLAY_DURATION_MS = 720;
const MEMORY_REPLAY_SHUTDOWN_EVENT = globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || 'shutdown';

function freezeMealReplayRegistry(value) {
    for (const definition of Object.values(value)) Object.freeze(definition);
    return Object.freeze(value);
}

export const MEAL_REPLAYS = freezeMealReplayRegistry({
    father_lock: { id: 'father_lock', durationMs: 4400, actor: 'father', consequence: 'lock_side_door' },
    mother_break: { id: 'mother_break', durationMs: 4200, actor: 'mother', consequence: 'return_stain_to_stove' },
    child_shard: { id: 'child_shard', durationMs: 3800, actor: 'child', consequence: 'reject_shard_match' },
    correct_meal: { id: 'correct_meal', durationMs: 5200, actor: 'family', consequence: 'open_side_door' }
});

export const MEAL_CONTRADICTION_IDS = Object.freeze(['father_lock', 'mother_break', 'child_shard']);

function assertMealContradictionId(id) {
    if (!MEAL_CONTRADICTION_IDS.includes(id)) {
        throw new Error(`Unknown meal contradiction: ${String(id)}`);
    }
}

function assertMealReplaySeenContainer(seen) {
    if (!Array.isArray(seen)) throw new Error('Seen meal replays must be an array');
}

export function getReplayDefinition(id) {
    const definition = typeof id === 'string' && Object.hasOwn(MEAL_REPLAYS, id)
        ? MEAL_REPLAYS[id]
        : null;
    if (!definition) throw new Error(`Unknown meal replay: ${String(id)}`);
    return { ...definition };
}

export function normalizeMealReplaySeen(seen) {
    if (!Array.isArray(seen)) return [];
    return [...new Set(seen.filter(id => MEAL_CONTRADICTION_IDS.includes(id)))];
}

export function markReplaySeen(seen, id) {
    assertMealReplaySeenContainer(seen);
    assertMealContradictionId(id);
    const normalized = normalizeMealReplaySeen(seen);
    return normalized.includes(id) ? normalized : [...normalized, id];
}

export function shouldUseShortReplay(seen, id) {
    assertMealReplaySeenContainer(seen);
    assertMealContradictionId(id);
    return normalizeMealReplaySeen(seen).includes(id);
}

function setReplayObjectDepth(object, depth) {
    object?.setDepth?.(depth);
    return object;
}

export class MemoryReplayDirector {
    constructor(scene, state = scene.sliceState || scene.gameState?.slice) {
        if (!scene || !state || typeof state !== 'object') {
            throw new Error('Memory replay director requires a scene and slice state');
        }
        this.scene = scene;
        this.state = state;
        this.active = false;
        this.destroyed = false;
        this.session = null;
        this.shutdownHandler = () => this.destroy();
        this.scene.events?.once?.(MEMORY_REPLAY_SHUTDOWN_EVENT, this.shutdownHandler);
    }

    play(id, options = {}) {
        if (this.destroyed) return { status: 'destroyed' };
        if (this.active) return { status: 'replay_active' };
        const definition = getReplayDefinition(id);
        const short = options?.short === true && id !== 'correct_meal';
        const durationMs = short ? SHORT_REPLAY_DURATION_MS : definition.durationMs;
        const result = { status: 'playing', replayId: id, short, durationMs };

        if (typeof this.scene.time?.delayedCall !== 'function') {
            return { ...result, status: 'unavailable' };
        }

        const session = {
            id,
            short,
            definition,
            onComplete: typeof options?.onComplete === 'function' ? options.onComplete : null,
            callbackCalled: false,
            objects: [],
            tweens: [],
            worldSnapshots: [],
            timer: null
        };
        this.session = session;
        this.active = true;
        this.createReplayAction(session);
        session.timer = this.scene.time.delayedCall(durationMs, () => this.finishSession(session));
        return result;
    }

    createReplayAction(session) {
        if (session.short) {
            this.createLocalizedEcho(session);
            return;
        }
        if (session.id === 'father_lock') this.createFatherLock(session);
        else if (session.id === 'mother_break') this.createMotherBreak(session);
        else if (session.id === 'child_shard') this.createChildShard(session);
        else this.createCorrectMeal(session);
    }

    tableData() {
        return this.scene.sliceMapDef?.objects?.table || {
            seats: {
                nail: { x: 320, y: 176 },
                stove: { x: 384, y: 240 },
                side: { x: 320, y: 304 }
            },
            offering: { x: 256, y: 240 }
        };
    }

    findProp(id) {
        return this.scene.sliceMapManager?.findProp?.(id)
            || (this.scene.interactables?.getChildren?.() || []).find(object => object.objId === id)
            || null;
    }

    findDoor(id) {
        return (this.scene.doors?.getChildren?.() || []).find(door => door.doorId === id) || null;
    }

    ownObject(session, object, marker = null) {
        if (!object) return null;
        if (marker) object.sliceReplayEffectId = marker;
        session.objects.push(object);
        return object;
    }

    ownTween(session, config) {
        const targets = Array.isArray(config.targets) ? config.targets : [config.targets];
        for (const target of targets) {
            if (!target || session.objects.includes(target)) continue;
            this.snapshotWorldTarget(session, target, config);
        }
        const tween = this.scene.tweens?.add?.(config);
        if (tween) session.tweens.push(tween);
        return tween;
    }

    snapshotWorldTarget(session, target, config) {
        let snapshot = session.worldSnapshots.find(entry => entry.target === target);
        if (!snapshot) {
            snapshot = { target, properties: {} };
            session.worldSnapshots.push(snapshot);
        }
        for (const property of ['x', 'y', 'alpha', 'angle', 'scale']) {
            if (Object.hasOwn(config, property) && !Object.hasOwn(snapshot.properties, property)) {
                snapshot.properties[property] = target[property];
            }
        }
    }

    createActor(session, actorId, position) {
        const actor = this.ownObject(
            session,
            setReplayObjectDepth(this.scene.add?.image?.(position.x, position.y, 'npc_paper'), 30)
        );
        if (!actor) return null;
        actor.sliceReplayActor = actorId;
        actor.setAlpha?.(0.48);
        return actor;
    }

    createEchoRectangle(session, id, x, y, width, height, color = 0xc7d0d3) {
        const echo = this.ownObject(
            session,
            setReplayObjectDepth(this.scene.add?.rectangle?.(x, y, width, height, color, 0.18), 29),
            id
        );
        echo?.setStrokeStyle?.(1, color, 0.45);
        if (echo) this.ownTween(session, { targets: echo, alpha: 0.55, duration: 180, yoyo: true });
        return echo;
    }

    createFatherLock(session) {
        const table = this.tableData();
        const actor = this.createActor(session, 'father', table.seats.nail);
        const chair = this.findProp('nailed_chair');
        const door = this.findDoor('kitchen_side_door');
        this.createEchoRectangle(session, 'father_chair_pull', chair?.x ?? 320, chair?.y ?? 160, 30, 12, 0x9b8067);
        this.createEchoRectangle(session, 'father_door_latch', door?.x ?? 624, door?.y ?? 272, 8, 42, 0xb4a184);
        if (actor) this.ownTween(session, { targets: actor, x: door?.x ?? 600, y: door?.y ?? 272, duration: 2200, ease: 'Sine.easeInOut' });
        if (chair) this.ownTween(session, { targets: chair, x: chair.x + 4, duration: 120, yoyo: true, repeat: 2 });
        if (door) this.ownTween(session, { targets: door, alpha: 1, duration: 100, yoyo: true, repeat: 2 });
        this.scene.playSound?.(94, 'square', 0.12);
        this.scene.playSound?.(61, 'sine', 0.18);
    }

    createMotherBreak(session) {
        const table = this.tableData();
        const actor = this.createActor(session, 'mother', table.seats.stove);
        const stain = this.findProp('stove_stain');
        const bowl = this.ownObject(
            session,
            setReplayObjectDepth(this.scene.add?.image?.(table.seats.stove.x, table.seats.stove.y - 12, 'bowl_medicine'), 31),
            'mother_bowl_break'
        );
        this.createEchoRectangle(session, 'mother_stain_return', stain?.x ?? 480, stain?.y ?? 112, 42, 18, 0x6c4b36);
        if (actor) this.ownTween(session, { targets: actor, x: stain?.x ?? 480, y: stain?.y ?? 112, duration: 1600, ease: 'Sine.easeInOut' });
        if (bowl) this.ownTween(session, { targets: bowl, y: (stain?.y ?? 112) + 10, angle: 36, duration: 1550 });
        if (stain) this.ownTween(session, { targets: stain, alpha: 0.35, duration: 180, yoyo: true, repeat: 2 });
        this.scene.playSound?.(132, 'triangle', 0.1);
        this.scene.playSound?.(740, 'square', 0.08);
    }

    createChildShard(session) {
        const table = this.tableData();
        const actor = this.createActor(session, 'child', table.seats.side);
        const shard = this.findProp('door_shard');
        const door = this.findDoor('kitchen_side_door');
        const shadow = this.ownObject(
            session,
            setReplayObjectDepth(this.scene.add?.image?.(table.seats.side.x, table.seats.side.y - 14, 'toy_plane'), 31),
            'child_plane_shadow'
        );
        shadow?.setAlpha?.(0.34);
        const shardAnswer = this.ownObject(
            session,
            setReplayObjectDepth(this.scene.add?.circle?.(shard?.x ?? 560, shard?.y ?? 272, 12, 0x7e9eb4, 0.2), 29),
            'child_shard_answer'
        );
        shardAnswer?.setStrokeStyle?.(1, 0xa6c2d4, 0.6);
        const mismatch = this.ownObject(
            session,
            setReplayObjectDepth(
                this.scene.add?.image?.((shard?.x ?? 560) + 16, (shard?.y ?? 272) - 10, 'blue_shard'),
                31
            ),
            'child_shard_mismatch'
        );
        mismatch?.setAlpha?.(0.38);
        if (actor) this.ownTween(session, { targets: actor, x: door?.x ?? 624, y: door?.y ?? 272, duration: 1800, ease: 'Sine.easeIn' });
        if (shadow) this.ownTween(session, {
            targets: shadow,
            x: door?.x ?? 624,
            y: door?.y ?? 272,
            angle: 28,
            duration: 920,
            ease: 'Sine.easeIn',
            yoyo: true
        });
        if (mismatch) this.ownTween(session, { targets: mismatch, alpha: 0.68, duration: 140, yoyo: true, repeat: 2 });
        if (shard) this.ownTween(session, { targets: shard, alpha: 1, duration: 90, yoyo: true, repeat: 3 });
        this.scene.playSound?.(180, 'triangle', 0.12);
        this.scene.playSound?.(84, 'square', 0.08);
    }

    createCorrectMeal(session) {
        const table = this.tableData();
        for (const [actorId, seatId] of [['father', 'nail'], ['mother', 'stove'], ['child', 'side']]) {
            const actor = this.createActor(session, actorId, table.seats[seatId]);
            if (actor) this.ownTween(session, { targets: actor, alpha: 0.68, duration: 520, yoyo: true, repeat: 2 });
        }
        const ripple = this.ownObject(
            session,
            setReplayObjectDepth(this.scene.add?.circle?.(table.offering.x, table.offering.y - 6, 8, 0xa9c4cb, 0.12), 32),
            'offering_ripple'
        );
        ripple?.setStrokeStyle?.(2, 0xb8d3d7, 0.65);
        if (ripple) this.ownTween(session, { targets: ripple, scale: 2.8, alpha: 0, duration: 880, repeat: 3 });
        this.scene.playSound?.(196, 'sine', 0.18);
        this.scene.playSound?.(122, 'triangle', 0.15);
    }

    createLocalizedEcho(session) {
        if (session.id === 'father_lock') {
            const chair = this.findProp('nailed_chair');
            this.createEchoRectangle(session, 'father_chair_pull', chair?.x ?? 320, chair?.y ?? 160, 30, 12, 0x9b8067);
            if (chair) this.ownTween(session, { targets: chair, x: chair.x + 3, duration: 80, yoyo: true, repeat: 1 });
            this.scene.playSound?.(94, 'square', 0.08);
        } else if (session.id === 'mother_break') {
            const stain = this.findProp('stove_stain');
            this.createEchoRectangle(session, 'mother_stain_return', stain?.x ?? 480, stain?.y ?? 112, 42, 18, 0x6c4b36);
            if (stain) this.ownTween(session, { targets: stain, alpha: 0.4, duration: 110, yoyo: true, repeat: 1 });
            this.scene.playSound?.(740, 'square', 0.06);
        } else {
            const shard = this.findProp('door_shard');
            const echo = this.ownObject(
                session,
                setReplayObjectDepth(this.scene.add?.circle?.(shard?.x ?? 560, shard?.y ?? 272, 10, 0x7e9eb4, 0.2), 29),
                'child_shard_answer'
            );
            echo?.setStrokeStyle?.(1, 0xa6c2d4, 0.6);
            if (shard) this.ownTween(session, { targets: shard, alpha: 1, duration: 80, yoyo: true, repeat: 2 });
            this.scene.playSound?.(84, 'triangle', 0.07);
        }
    }

    finishSession(session) {
        if (this.destroyed || this.session !== session) return;
        const shouldCommitCorrect = session.id === 'correct_meal' && session.short === false;
        this.cleanupSession(session);
        if (shouldCommitCorrect) this.commitCorrectMeal();
        if (session.onComplete && !session.callbackCalled) {
            session.callbackCalled = true;
            session.onComplete({ replayId: session.id, short: session.short });
        }
    }

    commitCorrectMeal() {
        this.state.tableSolved = true;
        this.state.heldBowl = null;
        this.state.houseRuleDemonstrated = false;
        if (this.state.slicePhase === 'table') {
            this.state.slicePhase = 'rule';
            this.state.sliceCompleted = false;
        }
        this.scene.kitchenTableController?.syncSprites?.();
        this.scene.sliceMapManager?.refreshDoorAccess?.(this.state);
        this.scene.sliceMapManager?.applyRoomRevision?.(this.state);
    }

    cleanupSession(session) {
        session.timer?.remove?.();
        session.timer?.destroy?.();
        session.timer = null;
        for (const tween of session.tweens) {
            tween?.stop?.();
            if (typeof tween?.remove === 'function') tween.remove();
            else tween?.destroy?.();
        }
        for (const snapshot of session.worldSnapshots) {
            for (const [property, value] of Object.entries(snapshot.properties)) {
                snapshot.target[property] = value;
            }
        }
        for (const object of session.objects) object?.destroy?.();
        this.scene.sliceMapManager?.refreshDoorAccess?.(this.state);
        session.tweens = [];
        session.worldSnapshots = [];
        session.objects = [];
        if (this.session === session) this.session = null;
        this.active = false;
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events?.off?.(MEMORY_REPLAY_SHUTDOWN_EVENT, this.shutdownHandler);
        if (this.session) this.cleanupSession(this.session);
        this.active = false;
    }
}
