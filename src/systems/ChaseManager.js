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

export function getArrivalStage(elapsedMs) {
    if (elapsedMs >= ARRIVAL_DELAY_MS) return 'arriving';
    if (elapsedMs >= WARNING_MS) return 'warning';
    if (elapsedMs >= DOOR_BANG_MS) return 'door_bang';
    return 'approaching';
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
            const grid = this.createGrid([chaserCell, playerCell]);
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

    destroy() {
        this.cancelHideEscape();
        this.cancelArrival();
        this.chaser?.destroy();
        this.chaser = null;
        this.scene.chaser = null;
    }
}
