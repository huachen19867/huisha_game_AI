import { Maps } from '../data/Maps.js';
import { ensureStoryFlags } from './StoryState.js';

export const HIDE_ESCAPE_MS = 6000;

export class ChaseManager {
    constructor(scene) { this.scene = scene; this.chaser = null; this.hideTimer = null; this.caught = false; }

    resolveSpawn() {
        const map = Maps[this.scene.currentMapId];
        const player = this.scene.player.sprite;
        const candidates = [];
        if (this.scene.previousMapId) {
            const door = map.objects.doors?.find(item => item.targetMap === this.scene.previousMapId);
            if (door) candidates.push({ x: door.x * 32 + (door.w || 1) * 16, y: door.y * 32 + (door.h || 1) * 16 });
        }
        candidates.push(
            { x: player.x + 160, y: player.y }, { x: player.x - 160, y: player.y },
            { x: player.x, y: player.y + 160 }, { x: player.x, y: player.y - 160 }
        );
        return candidates.find(point => {
            const tx = Math.floor(point.x / 32);
            const ty = Math.floor(point.y / 32);
            return map.data[ty]?.[tx] === 0 && Phaser.Math.Distance.Between(point.x, point.y, player.x, player.y) >= 96;
        }) || map.objects.playerStart;
    }

    start() {
        if (this.chaser?.active) return;
        const flags = ensureStoryFlags(this.scene.gameState);
        flags.chasePhase = 'active';
        this.scene.gameState.isChasing = true;
        const spawn = this.resolveSpawn();
        this.chaser = this.scene.physics.add.sprite(spawn.x, spawn.y, 'npc_paper').setTint(0xff0000).setAlpha(0.8);
        if (!this.scene.isMobile) this.chaser.setPipeline('Light2D');
        this.scene.chaser = this.chaser;
        this.scene.physics.add.collider(this.chaser, this.scene.walls);
        this.scene.physics.add.collider(this.chaser, this.scene.furniture);
        if (this.scene.trees) this.scene.physics.add.collider(this.chaser, this.scene.trees);
        this.scene.physics.add.overlap(this.scene.player.sprite, this.chaser, () => this.handleCaught());
        this.scene.refreshObjective();
    }

    update() {
        if (!this.chaser?.active || this.scene.gameState.isHidden || this.caught) return;
        this.scene.physics.moveToObject(this.chaser, this.scene.player.sprite, 100);
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
        flags.chasePhase = 'escaped';
        this.scene.gameState.isChasing = false;
        this.chaser?.destroy();
        this.chaser = null;
        this.scene.chaser = null;
        const text = reason === 'photo'
            ? '全家福里的三个人同时看向黑影。它停下了，像终于认出了你。'
            : '脚步声在柜门外停了六秒，随后慢慢远去。';
        window.showDialog('主角', text);
        this.scene.refreshObjective();
    }

    handleCaught() {
        if (this.caught) return;
        this.caught = true;
        this.scene.physics.pause();
        window.showDialog('暴怒的黑影', '抓到你了……但这次记忆没有把你送回最初。', () => {
            this.scene.physics.resume();
            this.scene.gameState.isHidden = false;
            const map = Maps[this.scene.currentMapId];
            this.scene.scene.restart({ mapId: this.scene.currentMapId, x: map.objects.playerStart.x, y: map.objects.playerStart.y, previousMapId: this.scene.previousMapId });
        });
    }

    destroy() { this.cancelHideEscape(); this.chaser?.destroy(); this.chaser = null; this.scene.chaser = null; }
}
