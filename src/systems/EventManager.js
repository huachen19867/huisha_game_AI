import { Maps } from '../data/Maps.js';
import { isPursuitSpace } from './HorrorPacing.js';

const AMBIENT_SOURCES = {
    room_main: ['altar', '香炉里落下一点灰。', 230],
    room_kitchen: ['sink', '水滴落进了搪瓷盆。', 1100],
    room_corridor: ['locked_window', '窗框被风压响了一下。', 180],
    room_bedroom_parents: ['cabinet', '柜子的木板轻轻响了一声。', 150],
    room_bedroom_me: ['bed', '床边的旧木板轻响了一下。', 180],
    room_secret: ['desk', '工作台上的纸角被风掀起。', 300],
    room_backyard: ['well', '井口的风穿过了石缝。', 110],
    room_attic: ['spirit_money', '梁上的纸钱轻轻擦过木头。', 350],
    room_bathroom: ['wet_paper', '纸边又滴下了一滴水。', 900]
};

export class EventManager {
    constructor(scene) {
        this.scene = scene;
        this.elapsed = 0;
        this.nextCueAt = 20000 + Math.random() * 10000;
        this.recoveryMs = 0;
        this.captionMs = 0;
        this.caption = '';
    }

    update(delta = 16.67) {
        const scene = this.scene;
        if (window.dialogActive || scene.isSwitching) return;
        const step = Math.min(delta, 50);
        this.captionMs = Math.max(0, this.captionMs - step);
        if (!this.captionMs) this.caption = '';
        if (scene.gameState.isChasing) { this.recoveryMs = 10000; this.caption = ''; return; }
        if (scene.gameState.isHidden || !isPursuitSpace(scene.currentMapId)) return;
        if (this.recoveryMs > 0) { this.recoveryMs = Math.max(0, this.recoveryMs - step); return; }
        this.elapsed += step;
        if (this.elapsed < this.nextCueAt) return;
        this.elapsed = 0;
        this.nextCueAt = 24000 + Math.random() * 12000;
        this.triggerRandomEvent();
    }

    triggerRandomEvent() {
        const scene = this.scene;
        if (window.dialogActive || scene.isSwitching || scene.gameState.isChasing || scene.gameState.isHidden || !isPursuitSpace(scene.currentMapId)) return;
        const cue = AMBIENT_SOURCES[scene.currentMapId];
        if (!cue) return;
        if (cue[0] === 'spirit_money' && scene.gameState.hasSpiritMoney) return;
        const source = Maps[scene.currentMapId].objects[cue[0]];
        if (!source) return;
        // These cues come from real objects. They never fake an enemy's step,
        // change room brightness, or interrupt reading with a forced dialogue.
        scene.soundManager?.playSpatialTone(cue[2], 'sine', 0.18, source.x, source.y);
        this.caption = cue[1];
        this.captionMs = 3500;
    }

    triggerPaperDollEvent() {
        const scene = this.scene;
        if (!scene.npc || window.dialogActive) return;

        if ((scene.gameState.hasRice && !scene.gameState.hasMatches) || (!scene.gameState.hasRice && scene.gameState.hasMatches)) {
            scene.npc.x = 320; 
            scene.npc.y = 400;
            scene.npc.refreshBody?.();
            this.caption = '纸人的影子换了一个位置。';
            this.captionMs = 3500;
        } else if (scene.gameState.hasRice && scene.gameState.hasMatches) {
             scene.npc.setVisible(false);
             scene.npc.body.enable = false;
             this.caption = '纸人原来站着的地方空了。';
             this.captionMs = 3500;
        }
    }
}
