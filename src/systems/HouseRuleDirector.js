import {
    advanceAttention,
    evaluateDinnerBell,
    isFatherSafeZone,
    recoverAttention,
    shouldPauseHouseRule
} from './HouseRuleState.js';

export const EXIT_BELL_RADIUS = 96;
export const HOUSE_RULE_CHASE_DURATION_MS = 10000;
export const HOUSE_RULE_CHECKPOINT_MS = 30000;
export const FATHER_CHECK_HOLD_MS = 850;

const HOUSE_RULE_SHUTDOWN_EVENT = globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || 'shutdown';
const HOUSE_RULE_CUES = Object.freeze([
    { id: 'bell', at: 0 },
    { id: 'knock', at: 550 },
    { id: 'footsteps', at: 1150 },
    { id: 'door_shadow', at: 2000 },
    { id: 'door_check', at: 3200 }
]);

function distanceBetween(first, second) {
    if (!first || !second) return Infinity;
    return Math.hypot(first.x - second.x, first.y - second.y);
}

function pointInRect(point, rect) {
    return Boolean(
        point && rect &&
        point.x >= rect.x && point.x <= rect.x + rect.width &&
        point.y >= rect.y && point.y <= rect.y + rect.height
    );
}

function setDepth(object, depth) {
    object?.setDepth?.(depth);
    return object;
}

export class HouseRuleDirector {
    constructor(scene, state = scene?.sliceState || scene?.gameState?.slice) {
        if (!scene || !state || typeof state !== 'object') {
            throw new Error('House rule director requires a scene and slice state');
        }
        this.scene = scene;
        this.state = state;
        this.activeBell = null;
        this.warningEffects = [];
        this.fatherChecker = null;
        this.fatherCheckTimer = null;
        this.checkpoint = null;
        this.playerElapsedMs = 0;
        this.exitBellResolved = false;
        this.requiresExitReentry = false;
        this.destroyed = false;
        this.shutdownHandler = () => this.destroy();
        this.scene.events?.once?.(HOUSE_RULE_SHUTDOWN_EVENT, this.shutdownHandler);
    }

    update(_time, delta = 0) {
        if (this.destroyed) return;
        if (this.isPaused()) {
            this.syncPausedPlayerPosition();
            return;
        }
        const safeDelta = Number.isFinite(delta) && delta > 0 ? delta : 0;
        this.playerElapsedMs += safeDelta;
        this.expireCheckpoint();

        if (!this.activeBell) {
            this.tryStartNextBell();
            return;
        }

        this.activeBell.elapsedMs += safeDelta;
        this.recordPlayerMotion();
        for (const cue of HOUSE_RULE_CUES) {
            if (!this.activeBell.fired.has(cue.id) && this.activeBell.elapsedMs >= cue.at) {
                this.activeBell.fired.add(cue.id);
                this.runCue(cue.id);
                if (!this.activeBell) return;
            }
        }
    }

    isPaused() {
        return shouldPauseHouseRule({
            dialog: globalThis.window?.dialogActive === true,
            replay: this.scene.memoryReplayDirector?.active === true,
            switching: this.scene.isSwitching === true,
            carryingAnimation: this.scene.kitchenTableController?.isCarryingAnimation === true
        });
    }

    syncPausedPlayerPosition() {
        const bell = this.activeBell;
        const player = this.scene.player?.sprite;
        if (!bell || !player) return;
        bell.lastPlayerPosition = { x: player.x, y: player.y };
        bell.frameMovedDistance = 0;
    }

    tryStartNextBell() {
        if (this.scene.chaseManager?.isSliceChasing?.() || this.scene.gameState?.sliceChasing === true) return false;
        if (this.state.tableSolved !== true) return false;
        if (this.state.houseRuleDemonstrated !== true) {
            return this.startBell('demonstration', this.getExitDoor() || this.getCheckDoor());
        }
        if (this.exitBellResolved || !this.isExitDoorOpen()) return false;
        if (this.requiresExitReentry) {
            if (this.distanceToExitDoor() > EXIT_BELL_RADIUS) this.requiresExitReentry = false;
            return false;
        }
        if (this.distanceToExitDoor() > EXIT_BELL_RADIUS) return false;
        return this.startBell('exit', this.getExitDoor());
    }

    startBell(kind, door) {
        if (!door || this.activeBell || this.destroyed) return false;
        this.clearFatherChecker();
        if (kind === 'exit') this.captureCheckpoint();
        const player = this.scene.player?.sprite;
        this.activeBell = {
            kind,
            door,
            arrivalDoor: this.getCheckDoor() || door,
            elapsedMs: 0,
            movedDistance: 0,
            frameMovedDistance: 0,
            lastPlayerPosition: player ? { x: player.x, y: player.y } : null,
            fired: new Set()
        };
        this.activeBell.fired.add('bell');
        this.runCue('bell');
        return true;
    }

    runCue(id) {
        const bell = this.activeBell;
        if (!bell || this.destroyed) return;
        const point = this.getDoorPoint(bell.arrivalDoor);
        if (id === 'bell') {
            this.scene.soundManager?.playSpatialNoise?.(0.14, point.x, point.y);
            this.createWarningCircle(point.x, point.y, 20, 0x89745d, 0.18, 'bell');
            if (bell.kind === 'demonstration') this.createFrozenFamily();
            return;
        }
        if (id === 'knock') {
            this.scene.soundManager?.playSpatialNoise?.(0.22, point.x, point.y);
            this.createWarningCircle(point.x, point.y, 28, 0x8b0000, 0.25, 'knock');
            return;
        }
        if (id === 'footsteps') {
            this.scene.soundManager?.playSpatialNoise?.(0.11, point.x, point.y + 24);
            const footsteps = setDepth(this.scene.add?.rectangle?.(point.x, point.y + 28, 22, 5, 0x6b4b3b, 0.36), 342);
            if (footsteps) footsteps.sliceHouseRuleEffect = 'footsteps';
            if (footsteps) this.warningEffects.push(footsteps);
            return;
        }
        if (id === 'door_shadow') {
            const shadow = setDepth(this.scene.add?.image?.(point.x, point.y, 'npc_paper'), 343);
            shadow?.setAlpha?.(0.22);
            shadow?.setTint?.(0x381818);
            if (shadow) shadow.sliceHouseRuleEffect = 'door_shadow';
            if (shadow) this.warningEffects.push(shadow);
            return;
        }
        if (id === 'door_check') this.resolveDoorCheck();
    }

    createWarningCircle(x, y, radius, color, alpha, marker) {
        const circle = setDepth(this.scene.add?.circle?.(x, y, radius, color, alpha), 341);
        if (!circle) return null;
        circle.sliceHouseRuleEffect = marker;
        this.warningEffects.push(circle);
        return circle;
    }

    createFrozenFamily() {
        const seats = this.scene.sliceMapDef?.objects?.table?.seats || {
            nail: { x: 320, y: 176 },
            stove: { x: 384, y: 240 },
            side: { x: 320, y: 304 }
        };
        for (const [actor, position] of Object.entries(seats)) {
            const ghost = setDepth(this.scene.add?.image?.(position.x, position.y, 'npc_paper'), 344);
            ghost?.setAlpha?.(0.28);
            ghost?.setTint?.(0xb7c9d0);
            if (ghost) {
                ghost.sliceHouseRuleEffect = `frozen_${actor}`;
                this.warningEffects.push(ghost);
            }
        }
    }

    recordPlayerMotion() {
        const bell = this.activeBell;
        const player = this.scene.player?.sprite;
        if (!bell || !player) return;
        const current = { x: player.x, y: player.y };
        const distance = distanceBetween(current, bell.lastPlayerPosition);
        bell.frameMovedDistance = Number.isFinite(distance) ? distance : 0;
        bell.movedDistance += bell.frameMovedDistance;
        bell.lastPlayerPosition = current;
    }

    resolveDoorCheck() {
        const bell = this.activeBell;
        if (!bell) return;
        if (bell.kind === 'demonstration') {
            this.state.houseRuleDemonstrated = true;
            this.finishBell('demonstration');
            return;
        }

        const result = evaluateDinnerBell({
            demonstrated: this.state.houseRuleDemonstrated === true,
            elapsedMs: bell.elapsedMs,
            movedDistance: bell.movedDistance
        });
        if (result === 'violated') {
            this.state.fatherAttention = advanceAttention(this.state.fatherAttention);
            if (this.state.fatherAttention === 'chasing') {
                if (this.startSliceChase()) {
                    this.finishBell('chasing');
                } else {
                    this.state.fatherAttention = 'checking';
                    this.createFatherChecker();
                    this.requiresExitReentry = true;
                    this.finishBell('chase_unavailable');
                }
            } else {
                if (this.state.fatherAttention === 'checking' && !this.isPlayerSafe()) {
                    this.createFatherChecker();
                }
                this.requiresExitReentry = true;
                this.finishBell('violated');
            }
            return;
        }

        const safe = this.isPlayerSafe();
        if (this.state.fatherAttention === 'checking' && !safe) this.createFatherChecker();
        this.state.fatherAttention = recoverAttention(this.state.fatherAttention);
        this.exitBellResolved = true;
        this.finishBell(safe ? 'safe' : 'obeyed');
    }

    startSliceChase() {
        const checkDoor = this.getCheckDoor();
        const mapDef = this.scene.sliceMapDef;
        if (!checkDoor || !mapDef) return false;
        return this.scene.chaseManager?.startSlice?.({
            mapDef,
            arrivalDoorId: checkDoor.doorId,
            durationMs: HOUSE_RULE_CHASE_DURATION_MS,
            onCaught: () => this.restoreCheckpoint()
        }) === true;
    }

    finishBell(_reason) {
        this.clearWarningEffects();
        this.activeBell = null;
    }

    getDoorPoint(door) {
        return { x: door?.x ?? 0, y: door?.y ?? 0 };
    }

    getExitDoor() {
        return (this.scene.doors?.getChildren?.() || []).find(door => door.doorId === 'kitchen_side_door') || null;
    }

    getCheckDoor() {
        const doors = this.scene.doors?.getChildren?.() || [];
        const exact = doors.find(door => door.doorId === this.state.lastTraversedDoor);
        if (exact) return exact;
        const previousMap = this.scene.previousMapId;
        return doors.find(door => door.targetMap === previousMap) || null;
    }

    isExitDoorOpen() {
        const door = this.getExitDoor();
        return this.state.tableSolved === true && door?.locked !== true;
    }

    distanceToExitDoor() {
        return distanceBetween(this.scene.player?.sprite, this.getExitDoor());
    }

    isPlayerSafe() {
        const player = this.scene.player?.sprite;
        const zone = pointInRect(player, this.scene.sliceSafeZones?.under_table) ? 'under_table' : null;
        return isFatherSafeZone({ zone, moving: (this.activeBell?.frameMovedDistance || 0) > 0.5 });
    }

    captureCheckpoint() {
        const player = this.scene.player?.sprite;
        if (!player) return;
        this.checkpoint = {
            mapId: this.scene.currentMapId,
            x: player.x,
            y: player.y,
            createdAtMs: this.playerElapsedMs
        };
    }

    expireCheckpoint() {
        if (this.checkpoint && this.playerElapsedMs - this.checkpoint.createdAtMs > HOUSE_RULE_CHECKPOINT_MS) {
            this.checkpoint = null;
        }
    }

    restoreCheckpoint() {
        this.expireCheckpoint();
        const checkpoint = this.checkpoint;
        if (!checkpoint || this.destroyed) return false;
        this.scene.scene?.restart?.({
            mapId: checkpoint.mapId,
            x: checkpoint.x,
            y: checkpoint.y,
            previousMapId: this.scene.previousMapId,
            sliceMode: true
        });
        return true;
    }

    blocksDoorTransition(door) {
        return door?.doorId === 'kitchen_side_door' && this.activeBell?.kind === 'exit';
    }

    clearWarningEffects() {
        for (const effect of this.warningEffects) effect?.destroy?.();
        this.warningEffects = [];
    }

    createFatherChecker() {
        const door = this.getCheckDoor();
        if (!door) return null;
        this.clearFatherChecker();
        const father = setDepth(this.scene.add?.image?.(door.x, door.y, 'npc_paper'), 345);
        father?.setAlpha?.(0.62);
        father?.setTint?.(0x6a3030);
        if (father) {
            father.sliceHouseRuleEffect = 'father_check';
            this.fatherChecker = father;
            let timer = null;
            timer = this.scene.time?.delayedCall?.(FATHER_CHECK_HOLD_MS, () => {
                if (this.fatherCheckTimer !== timer) return;
                this.fatherCheckTimer = null;
                this.fatherChecker?.destroy?.();
                this.fatherChecker = null;
            }) || null;
            this.fatherCheckTimer = timer;
        }
        return father;
    }

    clearFatherChecker() {
        this.fatherCheckTimer?.remove?.();
        this.fatherCheckTimer = null;
        this.fatherChecker?.destroy?.();
        this.fatherChecker = null;
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events?.off?.(HOUSE_RULE_SHUTDOWN_EVENT, this.shutdownHandler);
        this.activeBell = null;
        this.clearWarningEffects();
        this.clearFatherChecker();
        this.checkpoint = null;
    }
}
