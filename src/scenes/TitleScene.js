import { SoundManager } from '../systems/SoundManager.js';
import { createDefaultGameState } from '../systems/StoryState.js';
import { resolveStartRoute } from '../systems/StartRoute.js';
import { readCheckpoint, SAVE_KEY } from '../systems/Investigation.js';
import { Maps } from '../data/Maps.js';

export class TitleScene extends Phaser.Scene {
    constructor() { super('TitleScene'); }

    create() {
        this.restartDialog = null;
        window.globalGameState = createDefaultGameState();
        window.dismissDialog?.();
        window.dialogActive = false;
        document.body.style.filter = 'none';
        document.getElementById('inv-slots').replaceChildren();
        document.getElementById('dialog-box').classList.add('hidden');
        ['inventory', 'joystick-zone', 'action-btn'].forEach(id => document.getElementById(id).style.display = 'none');
        this.cameras.main.setBackgroundColor('#10191c');
        this.drawManor();
        const shade = this.add.graphics();
        shade.fillGradientStyle(0x071416, 0x071416, 0x071416, 0x071416, 0.55, 0, 0.55, 0);
        shade.fillRect(0, 0, 440, 600);
        const font = { fontFamily: '"SimSun", "Songti SC", serif' };
        this.add.text(65, 72, '中 式 民 俗 · 叙 事 解 谜', { ...font, fontSize: '14px', color: '#a69778' });
        this.add.text(60, 130, '回 煞', { ...font, fontSize: '88px', color: '#c3ac82' });
        this.add.rectangle(79, 257, 29, 30, 0x853d31);
        this.add.text(68, 247, '归', { ...font, fontSize: '21px', color: '#e0c39d' });
        this.add.text(65, 304, '门一直开着。\n你却走了十年，才走到门口。', { ...font, fontSize: '19px', color: '#a8afa1', lineSpacing: 13 });
        const save = readCheckpoint();
        const validSave = save && Maps[save.mapId];
        if (validSave) this.add.text(65, 377, `上次停在：${Maps[save.mapId].name}`, { ...font, fontSize: '13px', color: '#bbc1ac' });
        const makeButton = (y, label, action, primary = false) => {
            const button = this.add.text(65, y, label, { ...font, fontSize: primary ? '23px' : '18px', color: primary ? '#e4c69a' : '#a4afa7', backgroundColor: primary ? '#34382e' : '#182121', padding: { x: 16, y: 10 } }).setInteractive({ useHandCursor: true });
            button.on('pointerover', () => button.setColor('#fff1cf'));
            button.on('pointerout', () => button.setColor(primary ? '#e4c69a' : '#a4afa7'));
            button.on('pointerdown', action);
            return button;
        };
        this.starting = false;
        const start = continuing => {
            if (this.starting || this.restartDialog) return;
            this.starting = true;
            if (!this.game.soundManager) this.game.soundManager = new SoundManager(this);
            else this.game.soundManager.init();
            if (continuing && validSave) {
                window.globalGameState = save.state;
                this.scene.start('GameScene', { mapId: save.mapId, x: save.x, y: save.y });
            } else {
                window.globalGameState = createDefaultGameState();
                try { localStorage.removeItem(SAVE_KEY); } catch {}
                const route = resolveStartRoute(window.location.search);
                this.scene.start(route.scene, route.data);
            }
        };
        makeButton(405, validSave ? '继续雨夜  [Enter]' : '推门归家  [Enter]', () => start(!!validSave), true);
        if (validSave) makeButton(462, '重新开始', () => this.confirmRestart(() => start(false)));
        this.add.text(65, 524, 'WASD 移动   E 调查   J 手记   M 路线', { ...font, fontSize: '12px', color: '#a8b5a9' });
        this.add.text(65, 560, 'baidai_baidai  /  2D 调查篇', { ...font, fontSize: '12px', color: '#697b75' });
        this.add.particles(0, 0, 'rain', { x: { min: 340, max: 800 }, y: 0, lifespan: 1600, speedY: 370, speedX: -70, alpha: 0.25, frequency: 75, quantity: 1 });
        const onStartKey = event => { if (!event?.repeat) start(!!validSave); };
        this.input.keyboard.on('keydown-ENTER', onStartKey);
        this.input.keyboard.on('keydown-SPACE', onStartKey);
        this.events.once('shutdown', () => {
            this.input.keyboard.off('keydown-ENTER', onStartKey);
            this.input.keyboard.off('keydown-SPACE', onStartKey);
            const dialog = this.restartDialog;
            this.restartDialog = null;
            if (dialog) { dialog.close(); dialog.remove(); }
        });
        // The archived prototype remains available at prototype3d.html; no 3D development in this revision.
    }

    confirmRestart(onConfirm) {
        if (this.starting || this.restartDialog) return;
        const message = '重新开始会清除已保存的调查进度和手记，从开场重来。原来的继续记录将无法恢复。';
        const dialog = document.createElement('dialog');
        if (typeof dialog.showModal !== 'function') {
            if (window.confirm(message)) onConfirm();
            return;
        }
        dialog.className = 'title-restart';
        dialog.setAttribute('aria-labelledby', 'title-restart-title');
        dialog.setAttribute('aria-describedby', 'title-restart-description');
        dialog.innerHTML = `<style>
            .title-restart{width:min(460px,calc(100vw - 36px));box-sizing:border-box;padding:26px;background:#191e20;color:#dfd3ba;border:1px solid #8d7d5b;font:14px "Microsoft YaHei",sans-serif;box-shadow:0 20px 80px #000}
            .title-restart::backdrop{background:#050809d9}.title-restart h2{font:25px "SimSun",serif;color:#e1c191;margin:0 0 16px}.title-restart p{line-height:1.9;margin:0 0 22px}
            .title-restart-actions{display:flex;gap:12px;flex-wrap:wrap}.title-restart button{flex:1;min-width:160px;min-height:44px;padding:10px 14px;font:inherit;color:#dbc9a6;background:#242e2d;border:1px solid #807059;cursor:pointer}
            .title-restart button:focus-visible{outline:2px solid #d6b778;outline-offset:3px}.title-restart [data-restart-confirm]{color:#d4aaa0;background:#352b28}
        </style><h2 id="title-restart-title">重新开始这一夜？</h2><p id="title-restart-description"></p><div class="title-restart-actions"><button type="button" data-restart-cancel autofocus>保留进度，返回标题</button><button type="button" data-restart-confirm>清除记录，重新开始</button></div>`;
        dialog.querySelector('#title-restart-description').textContent = message;
        this.restartDialog = dialog;
        const dismiss = () => {
            if (this.restartDialog !== dialog) return false;
            this.restartDialog = null;
            dialog.close(); dialog.remove();
            return true;
        };
        const cancel = dialog.querySelector('[data-restart-cancel]');
        cancel.onclick = dismiss;
        dialog.querySelector('[data-restart-confirm]').onclick = () => { if (dismiss()) onConfirm(); };
        dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
        dialog.onkeydown = event => event.stopPropagation();
        document.body.appendChild(dialog);
        dialog.showModal();
        cancel.focus();
    }

    drawManor() {
        if (this.textures.exists('title_manor')) {
            const art = this.add.image(400, 300, 'title_manor');
            art.setScale(Math.max(800 / art.width, 600 / art.height));
            return;
        }
        // Preserve a playable title if an image cannot be decoded.
        const g = this.add.graphics();
        g.fillStyle(0x283735); g.fillRect(340, 0, 460, 600);
        g.fillStyle(0x161e20); g.fillTriangle(300, 150, 570, 25, 840, 150);
        g.fillStyle(0x080f14); g.fillRect(386, 150, 368, 390);
        g.fillStyle(0x574c3c); g.fillRect(402, 158, 12, 380); g.fillRect(730, 158, 12, 380);
        g.fillStyle(0x9c8053); g.fillRect(400, 150, 346, 7);
        g.fillStyle(0x292a25); g.fillRect(430, 510, 286, 16); g.fillRect(414, 530, 317, 16);
        this.add.image(570, 290, 'altar').setScale(2.4).setAlpha(0.85);
        this.add.image(570, 420, 'coffin').setScale(1.2).setAlpha(0.8);
        for (const x of [415, 735]) {
            this.add.circle(x, 187, 11, 0xc48b4d, 0.15);
            this.add.rectangle(x, 187, 8, 18, 0xb05d3c, 0.9);
            this.add.rectangle(x, 187, 2, 14, 0xe0ab64, 0.85);
        }
    }
}
