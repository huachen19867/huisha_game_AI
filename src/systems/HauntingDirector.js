import { ensureStoryFlags } from './StoryState.js';

export function canAdvanceWatcher({ dialogActive, puzzleActive, facingDot, movedDistance }) {
    return !dialogActive && !puzzleActive && facingDot < 0.25 && movedDistance >= 32;
}

export function evaluateListeningWindow({ elapsedMs, movedDistance }) {
    if (movedDistance >= 16) return 'noticed';
    if (elapsedMs >= 2500) return 'survived';
    return 'listening';
}

export class HauntingDirector {
    constructor(scene) {
        this.scene = scene;
        this.listening = null;
        this.effects = [];
        this.watcherIndex = 0;
        this.watcherOrigin = scene.player?.sprite ? { x: scene.player.sprite.x, y: scene.player.sprite.y } : null;
        this.nextWatcherAt = 0;
        this.readyAt = (scene.time?.now || 0) + 1200;
    }

    isPuzzleActive() {
        const overlay = document.getElementById('puzzle-overlay');
        return overlay ? getComputedStyle(overlay).display !== 'none' : false;
    }

    getEncounterId() {
        const flags = ensureStoryFlags(this.scene.gameState);
        if (this.scene.currentMapId === 'room_corridor') {
            if (flags.puzzles.school && !flags.hauntingSeen.includes('school_listening')) return 'school_listening';
            if (flags.puzzles.hospital && !flags.hauntingSeen.includes('hospital_listening')) return 'hospital_listening';
        }
        if (this.scene.currentMapId === 'room_main' && flags.ritualSolved && !flags.hauntingSeen.includes('altar_listening')) return 'altar_listening';
        return null;
    }

    startListening(id, time) {
        const player = this.scene.player.sprite;
        this.listening = { id, startedAt: time, origin: { x: player.x, y: player.y } };
        this.listeningText = this.scene.add.text(this.scene.scale.width / 2, 112, '门外有人在数你的脚步……别动', {
            fontSize: '17px', color: '#f2d0bd', backgroundColor: '#24100d', padding: { x: 10, y: 6 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1100);
        this.scene.soundManager?.playNoise(0.25);
    }

    resolveListening(result) {
        const flags = ensureStoryFlags(this.scene.gameState);
        const id = this.listening.id;
        if (!flags.hauntingSeen.includes(id)) flags.hauntingSeen.push(id);
        this.listeningText?.destroy();
        this.listeningText = null;
        if (result === 'noticed') {
            this.scene.gameState.sanity = Math.max(0, this.scene.gameState.sanity - 10);
            this.scene.cameras.main.shake(140, 0.006);
            const player = this.scene.player.sprite;
            const shadow = this.scene.add.sprite(player.x + 72, player.y, 'npc_paper').setTint(0x090909).setAlpha(0.85).setDepth(500);
            this.effects.push(shadow);
            const timer = this.scene.time.delayedCall(850, () => {
                shadow.destroy();
                this.effects = this.effects.filter(effect => effect !== shadow);
            });
            this.effects.push(timer);
            this.scene.showRoomTitle?.('它听见你了。门口的影子少了一步。');
        } else {
            this.scene.showRoomTitle?.(id === 'altar_listening' ? '脚步停住了。门外有人轻声说：饭已经凉了。' : '脚步从门外慢慢退远。');
        }
        this.listening = null;
        this.readyAt = (this.scene.time?.now || 0) + 1600;
    }

    updateWatcher(time) {
        if (this.scene.currentMapId !== 'room_kitchen' || !this.scene.npc?.active || !this.watcherOrigin) return;
        const player = this.scene.player.sprite;
        const dx = this.scene.npc.x - player.x;
        const dy = this.scene.npc.y - player.y;
        const length = Math.hypot(dx, dy) || 1;
        const facingDot = (dx / length) * (this.scene.player.facingX || 0) + (dy / length) * (this.scene.player.facingY || 1);
        const movedDistance = Math.hypot(player.x - this.watcherOrigin.x, player.y - this.watcherOrigin.y);
        if (time < this.nextWatcherAt || !canAdvanceWatcher({
            dialogActive: !!window.dialogActive,
            puzzleActive: this.isPuzzleActive(),
            facingDot,
            movedDistance
        })) return;

        const anchors = [{ x: 360, y: 160 }, { x: 348, y: 225 }, { x: 395, y: 248 }];
        this.watcherIndex = Math.min(this.watcherIndex + 1, anchors.length - 1);
        const anchor = anchors[this.watcherIndex];
        this.scene.npc.setPosition(anchor.x, anchor.y);
        this.scene.npc.body?.updateFromGameObject?.();
        this.scene.cameras.main.flash(80, 40, 0, 0);
        this.watcherOrigin = { x: player.x, y: player.y };
        this.nextWatcherAt = time + 900;
    }

    update(time) {
        if (!this.scene.player?.sprite || this.scene.isSwitching || this.scene.gameState.isChasing) return;
        if (window.dialogActive || this.isPuzzleActive()) return;
        this.updateWatcher(time);
        if (this.listening) {
            const player = this.scene.player.sprite;
            const movedDistance = Math.hypot(player.x - this.listening.origin.x, player.y - this.listening.origin.y);
            const result = evaluateListeningWindow({ elapsedMs: time - this.listening.startedAt, movedDistance });
            if (result !== 'listening') this.resolveListening(result);
            return;
        }
        if (time >= this.readyAt) {
            const id = this.getEncounterId();
            if (id) this.startListening(id, time);
        }
    }

    onPuzzleMistake(puzzleId, attempts) {
        if (puzzleId === 'kitchen_table' && attempts >= 3 && this.scene.npc?.active) {
            this.watcherIndex = 2;
            this.scene.npc.setPosition(395, 248);
            this.scene.npc.body?.updateFromGameObject?.();
            this.scene.cameras.main.flash(120, 20, 0, 0);
            return;
        }
        this.scene.cameras.main.shake(90, 0.003);
        this.scene.soundManager?.playNoise(0.18);
    }

    destroy() {
        this.listeningText?.destroy();
        this.listeningText = null;
        this.effects.forEach(effect => effect?.remove ? effect.remove() : effect?.destroy?.());
        this.effects = [];
        this.listening = null;
    }
}
