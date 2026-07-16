import { Maps } from '../data/Maps.js';
import { ensureStoryFlags } from './StoryState.js';
import {
    createNavigationGrid,
    findGridPath,
    findSafeDoorSpawn,
    gridToWorld,
    worldToGrid
} from './GridNavigation.js';

export const HIDE_ESCAPE_MS = 6000;
export const DOOR_BANG_MS = 2000;
export const WARNING_MS = 3000;
export const ARRIVAL_DELAY_MS = 4000;
export const MATERIALIZE_MS = 600;
export const REPATH_MS = 350;
export const SPAWN_RETRY_MS = 500;
export const SLICE_CHASE_DURATION_MS = 10000;

export function getArrivalStage(elapsedMs) {
    if (elapsedMs >= ARRIVAL_DELAY_MS) return 'arriving';
    if (elapsedMs >= WARNING_MS) return 'warning';
    if (elapsedMs >= DOOR_BANG_MS) return 'door_bang';
    return 'approaching';
}

export function getSliceArrivalStage(elapsedMs) {
    return getArrivalStage(elapsedMs);
}

function hasNavigationData(mapDef) {
    return Array.isArray(mapDef?.data) &&
        mapDef.data.length > 0 &&
        mapDef.data.every(row => Array.isArray(row) && row.length > 0) &&
        new Set(mapDef.data.map(row => row.length)).size === 1;
}

export class ChaseManager {
    constructor(scene) {
        this.scene = scene;
        this.chaser = null;
        this.hideTimer = null;
        this.arrivalTimers = [];
        this.spawnRetryTimer = null;
        this.arrivalWarning = null;
        this.doorGlow = null;
        this.caught = false;
        this.materializing = false;
        this.path = [];
        this.nextRepathAt = 0;
        this.lastTargetKey = '';
        this.sliceConfig = null;
        this.pendingSliceDoor = null;
        this.sliceArrivalTimers = [];
        this.sliceSpawnRetryTimer = null;
        this.sliceSetupTimer = null;
        this.sliceEndTimer = null;
        this.sliceDoorGlow = null;
        this.sliceFootsteps = null;
        this.sliceDoorGlowTween = null;
        this.sliceFootstepsTween = null;
    }

    getArrivalDoor() {
        const doors = Maps[this.scene.currentMapId]?.objects?.doors || [];
        return doors.find(door => door.targetMap === this.scene.previousMapId) || doors[0] || null;
    }

    getDoorWorldPosition(door) {
        return {
            x: door.x * 32 + (door.w || 1) * 16,
            y: door.y * 32 + (door.h || 1) * 16
        };
    }

    start() {
        const flags = ensureStoryFlags(this.scene.gameState);
        flags.chasePhase = 'active';
        this.scene.gameState.isChasing = true;
        if (this.chaser?.active || this.arrivalTimers.length || this.spawnRetryTimer) return;

        const door = this.getArrivalDoor();
        if (!door) return;
        this.pendingDoor = door;
        this.arrivalTimers.push(
            this.scene.time.delayedCall(DOOR_BANG_MS, () => this.telegraphDoor(false)),
            this.scene.time.delayedCall(WARNING_MS, () => this.telegraphDoor(true)),
            this.scene.time.delayedCall(ARRIVAL_DELAY_MS, () => this.attemptSpawn())
        );
        this.scene.refreshObjective();
    }

    startSlice({ mapDef, arrivalDoorId, durationMs = SLICE_CHASE_DURATION_MS, onCaught } = {}) {
        const door = mapDef?.objects?.doors?.find(candidate => candidate.id === arrivalDoorId);
        if (!hasNavigationData(mapDef) || !door || this.sliceConfig || this.chaser?.active) return false;

        this.sliceConfig = {
            mapDef,
            arrivalDoorId,
            durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : SLICE_CHASE_DURATION_MS,
            onCaught: typeof onCaught === 'function' ? onCaught : null
        };
        this.pendingSliceDoor = door;
        this.scene.gameState.sliceChasing = true;
        this.sliceArrivalTimers.push(
            this.scene.time.delayedCall(DOOR_BANG_MS, () => this.telegraphSliceDoor('bang')),
            this.scene.time.delayedCall(WARNING_MS, () => this.telegraphSliceDoor('footsteps')),
            this.scene.time.delayedCall(ARRIVAL_DELAY_MS, () => this.attemptSliceSpawn())
        );
        this.sliceSetupTimer = this.scene.time.delayedCall(
            ARRIVAL_DELAY_MS + this.sliceConfig.durationMs,
            () => this.endSliceChase('setup_timeout')
        );
        return true;
    }

    createSliceGrid(mapDef, forceOpen = []) {
        if (!hasNavigationData(mapDef)) return [];
        return createNavigationGrid(mapDef.data, this.scene.navigationBlockedRects || [], forceOpen);
    }

    isSliceChasing() {
        return this.sliceConfig !== null;
    }

    telegraphSliceDoor(stage) {
        if (!this.pendingSliceDoor || !this.sliceConfig) return;
        const point = this.getDoorWorldPosition(this.pendingSliceDoor);
        this.scene.soundManager?.playSpatialNoise(stage === 'bang' ? 0.24 : 0.16, point.x, point.y);
        if (!this.sliceDoorGlow) {
            this.sliceDoorGlow = this.scene.add.circle(point.x, point.y, 24, 0x8b0000, 0.22).setDepth(340);
            this.sliceDoorGlowTween = this.scene.tweens.add({
                targets: this.sliceDoorGlow, alpha: 0.56, duration: 360, yoyo: true, repeat: -1
            });
        }
        if (stage === 'footsteps' && !this.sliceFootsteps) {
            this.sliceFootsteps = this.scene.add.rectangle(point.x, point.y + 30, 18, 4, 0x6b4b3b, 0.34).setDepth(341);
            this.sliceFootstepsTween = this.scene.tweens.add({
                targets: this.sliceFootsteps, alpha: 0.08, scaleX: 2.2, duration: 420, yoyo: true, repeat: -1
            });
        }
    }

    attemptSliceSpawn() {
        this.sliceArrivalTimers = [];
        if (!this.pendingSliceDoor || !this.sliceConfig || this.chaser?.active) return;
        const playerSprite = this.scene.player?.sprite;
        if (!playerSprite) return;
        const playerCell = worldToGrid(playerSprite.x, playerSprite.y);
        const grid = this.createSliceGrid(this.sliceConfig.mapDef, [playerCell]);
        const spawnCell = findSafeDoorSpawn(grid, this.pendingSliceDoor, playerCell, 5);
        if (!spawnCell) {
            this.sliceSpawnRetryTimer = this.scene.time.delayedCall(SPAWN_RETRY_MS, () => {
                this.sliceSpawnRetryTimer = null;
                this.attemptSliceSpawn();
            });
            return;
        }
        this.spawnSliceAt(gridToWorld(spawnCell));
    }

    spawnSliceAt(spawn) {
        if (!this.sliceConfig) return false;
        this.cancelSliceSetupDeadline();
        this.clearSliceArrivalVisuals();
        this.chaser = this.scene.physics.add.sprite(spawn.x, spawn.y, 'npc_paper').setTint(0xff0000).setAlpha(0);
        if (!this.scene.isMobile) this.chaser.setPipeline('Light2D');
        this.scene.chaser = this.chaser;
        this.materializing = true;
        this.chaser.body.enable = false;
        this.scene.physics.add.collider(this.chaser, this.scene.walls);
        this.scene.physics.add.collider(this.chaser, this.scene.furniture);
        if (this.scene.trees) this.scene.physics.add.collider(this.chaser, this.scene.trees);
        this.scene.physics.add.overlap(this.scene.player.sprite, this.chaser, () => this.handleCaught());
        this.scene.tweens.add({
            targets: this.chaser,
            alpha: 0.78,
            duration: MATERIALIZE_MS,
            onComplete: () => {
                if (!this.chaser?.active || !this.sliceConfig) return;
                this.chaser.body.enable = true;
                this.materializing = false;
                this.nextRepathAt = 0;
            }
        });
        if (!this.sliceEndTimer) {
            this.sliceEndTimer = this.scene.time.delayedCall(this.sliceConfig.durationMs, () => this.endSliceChase('timeout'));
        }
        return true;
    }

    telegraphDoor(showWarning) {
        if (!this.pendingDoor) return;
        const point = this.getDoorWorldPosition(this.pendingDoor);
        this.scene.soundManager?.playSpatialNoise(0.35, point.x, point.y);
        this.scene.cameras.main.shake(showWarning ? 140 : 100, showWarning ? 0.006 : 0.004);
        if (!this.doorGlow) {
            this.doorGlow = this.scene.add.circle(point.x, point.y, 26, 0x8b0000, 0.25).setDepth(340);
            this.scene.tweens.add({ targets: this.doorGlow, alpha: 0.65, duration: 450, yoyo: true, repeat: -1 });
        }
        if (showWarning && !this.arrivalWarning) {
            this.arrivalWarning = this.scene.add.text(this.scene.scale.width / 2, 78, '明儿，别跑，外面下雨', {
                fontSize: '18px', color: '#ffb0a0', backgroundColor: '#300000', padding: { x: 10, y: 6 }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);
        }
    }

    createGrid(forceOpen = []) {
        const map = Maps[this.scene.currentMapId];
        return createNavigationGrid(map.data, this.scene.navigationBlockedRects || [], forceOpen);
    }

    attemptSpawn() {
        this.arrivalTimers = [];
        if (!this.pendingDoor || this.chaser?.active) return;
        const playerCell = worldToGrid(this.scene.player.sprite.x, this.scene.player.sprite.y);
        const grid = this.createGrid([playerCell]);
        const spawnCell = findSafeDoorSpawn(grid, this.pendingDoor, playerCell, 5);
        if (!spawnCell) {
            this.spawnRetryTimer = this.scene.time.delayedCall(SPAWN_RETRY_MS, () => {
                this.spawnRetryTimer = null;
                this.attemptSpawn();
            });
            return;
        }
        this.spawnAt(gridToWorld(spawnCell));
    }

    spawnAt(spawn) {
        this.clearArrivalVisuals();
        this.materializing = true;
        this.chaser = this.scene.physics.add.sprite(spawn.x, spawn.y, 'npc_paper').setTint(0xff0000).setAlpha(0);
        if (!this.scene.isMobile) this.chaser.setPipeline('Light2D');
        this.scene.chaser = this.chaser;
        this.chaser.body.enable = false;
        this.scene.physics.add.collider(this.chaser, this.scene.walls);
        this.scene.physics.add.collider(this.chaser, this.scene.furniture);
        if (this.scene.trees) this.scene.physics.add.collider(this.chaser, this.scene.trees);
        this.scene.physics.add.overlap(this.scene.player.sprite, this.chaser, () => this.handleCaught());
        this.scene.cameras.main.shake(180, 0.008);
        this.scene.tweens.add({
            targets: this.chaser,
            alpha: 0.82,
            duration: MATERIALIZE_MS,
            onComplete: () => {
                if (!this.chaser?.active) return;
                this.chaser.body.enable = true;
                this.materializing = false;
                this.nextRepathAt = 0;
                if (this.scene.gameState.isHidden) this.startHideEscape();
            }
        });
    }

    update() {
        if (!this.chaser?.active || this.materializing || this.caught) return;
        if (this.scene.gameState.isHidden) {
            this.chaser.setVelocity(0);
            return;
        }

        const now = this.scene.time.now;
        const chaserCell = worldToGrid(this.chaser.x, this.chaser.y);
        const playerCell = worldToGrid(this.scene.player.sprite.x, this.scene.player.sprite.y);
        const targetKey = `${playerCell.x},${playerCell.y}`;
        if (now >= this.nextRepathAt || targetKey !== this.lastTargetKey || this.path.length < 2) {
            const grid = this.sliceConfig
                ? this.createSliceGrid(this.sliceConfig.mapDef, [chaserCell, playerCell])
                : this.createGrid([chaserCell, playerCell]);
            this.path = findGridPath(grid, chaserCell, playerCell);
            this.nextRepathAt = now + REPATH_MS;
            this.lastTargetKey = targetKey;
        }

        const nextCell = this.path[1];
        if (!nextCell) {
            this.chaser.setVelocity(0);
            return;
        }
        const target = gridToWorld(nextCell);
        if (Phaser.Math.Distance.Between(this.chaser.x, this.chaser.y, target.x, target.y) < 8) {
            this.path.shift();
        }
        this.scene.physics.moveTo(this.chaser, target.x, target.y, 100);

        const distance = Phaser.Math.Distance.Between(this.chaser.x, this.chaser.y, this.scene.player.sprite.x, this.scene.player.sprite.y);
        const intensity = Math.max(0, 1 - distance / 500);
        this.scene.dangerOverlay?.setAlpha(intensity * 0.55);
        if (intensity > 0 && now >= (this.nextHeartbeatAt || 0)) {
            this.scene.soundManager?.playHeartbeat(intensity);
            this.nextHeartbeatAt = now + 350 + distance;
        }
    }

    startHideEscape() {
        if (!this.chaser?.active || this.hideTimer) return;
        this.hideTimer = this.scene.time.delayedCall(HIDE_ESCAPE_MS, () => {
            this.hideTimer = null;
            if (this.scene.gameState.isHidden) this.escape('hide');
        });
    }

    cancelHideEscape() { this.hideTimer?.remove(); this.hideTimer = null; }

    escape(reason) {
        const flags = ensureStoryFlags(this.scene.gameState);
        if (flags.chasePhase !== 'active') return;
        this.cancelHideEscape();
        this.cancelArrival();
        flags.chasePhase = 'escaped';
        this.scene.gameState.isChasing = false;
        this.chaser?.destroy();
        this.chaser = null;
        this.scene.chaser = null;
        this.scene.dangerOverlay?.setAlpha(0);
        const text = reason === 'photo'
            ? '全家福里的三个人同时看向黑影。它停下了，像终于认出了你。'
            : '脚步声在柜门外停了六秒，随后慢慢远去。';
        window.showDialog('主角', text);
        this.scene.refreshObjective();
    }

    handleCaught() {
        if (this.sliceConfig) {
            if (this.caught || this.materializing) return;
            this.caught = true;
            const onCaught = this.sliceConfig.onCaught;
            this.endSliceChase('caught');
            onCaught?.();
            return;
        }
        if (this.caught || this.materializing || this.scene.gameState.isHidden) return;
        this.caught = true;
        this.scene.physics.pause();
        window.showDialog('暴怒的黑影', '抓到你了……但这次记忆没有把你送回最初。', () => {
            this.scene.physics.resume();
            this.scene.gameState.isHidden = false;
            const map = Maps[this.scene.currentMapId];
            this.scene.scene.restart({
                mapId: this.scene.currentMapId,
                x: map.objects.playerStart.x,
                y: map.objects.playerStart.y,
                previousMapId: this.scene.previousMapId
            });
        });
    }

    clearArrivalVisuals() {
        this.doorGlow?.destroy();
        this.arrivalWarning?.destroy();
        this.doorGlow = null;
        this.arrivalWarning = null;
    }

    cancelArrival() {
        this.arrivalTimers.forEach(timer => timer?.remove());
        this.arrivalTimers = [];
        this.spawnRetryTimer?.remove();
        this.spawnRetryTimer = null;
        this.clearArrivalVisuals();
        this.pendingDoor = null;
    }

    clearSliceArrivalVisuals() {
        for (const tween of [this.sliceDoorGlowTween, this.sliceFootstepsTween]) {
            tween?.stop?.();
            tween?.remove?.();
        }
        this.sliceDoorGlow?.destroy();
        this.sliceFootsteps?.destroy();
        this.sliceDoorGlow = null;
        this.sliceFootsteps = null;
        this.sliceDoorGlowTween = null;
        this.sliceFootstepsTween = null;
    }

    cancelSliceArrival() {
        this.sliceArrivalTimers.forEach(timer => timer?.remove?.());
        this.sliceArrivalTimers = [];
        this.sliceSpawnRetryTimer?.remove?.();
        this.sliceSpawnRetryTimer = null;
        this.clearSliceArrivalVisuals();
        this.pendingSliceDoor = null;
    }

    cancelSliceSetupDeadline() {
        this.sliceSetupTimer?.remove?.();
        this.sliceSetupTimer = null;
    }

    endSliceChase(reason = 'timeout') {
        if (!this.sliceConfig) return false;
        this.sliceEndTimer?.remove?.();
        this.sliceEndTimer = null;
        this.cancelSliceSetupDeadline();
        this.cancelSliceArrival();
        this.chaser?.destroy?.();
        this.chaser = null;
        this.scene.chaser = null;
        this.scene.dangerOverlay?.setAlpha?.(0);
        this.scene.gameState.sliceChasing = false;
        this.sliceConfig = null;
        this.materializing = false;
        this.path = [];
        this.lastTargetKey = '';
        this.caught = false;
        return reason;
    }

    destroy() {
        this.cancelHideEscape();
        this.cancelArrival();
        this.endSliceChase('destroy');
        this.chaser?.destroy();
        this.chaser = null;
        this.scene.chaser = null;
    }
}
