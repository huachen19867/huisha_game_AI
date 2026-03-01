import { SoundManager } from '../systems/SoundManager.js';

export class TitleScene extends Phaser.Scene {
    constructor() {
        super('TitleScene');
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');

        // Reset Global Game State COMPLETELY
        window.globalGameState = {
            storyStep: 0,
            hasMatches: false,
            hasRice: false,
            hasRedKey: false, // Ensure this is reset
            candlesLit: 0,
            inventory: [],
            viewedPhotos: [],
            clues: [],
            corridorSolved: false,
            viewedIntro: false,
            isHidden: false,
            isChasing: false
        };

        // Clear Inventory UI
        const invSlots = document.getElementById('inv-slots');
        if (invSlots) invSlots.innerHTML = '';

        // Cleanup UI from previous game
        const dialogBox = document.getElementById('dialog-box');
        if (dialogBox) dialogBox.classList.add('hidden');
        document.getElementById('inventory').style.display = 'none';
        document.getElementById('joystick-zone').style.display = 'none';
        document.getElementById('action-btn').style.display = 'none';
        window.dialogActive = false;
        
        // Init Sound
        this.input.keyboard.once('keydown', () => {
            if (!this.game.soundManager) {
                this.game.soundManager = new SoundManager(this);
            }
        });

        const titleText = this.add.text(400, 200, '回 煞', {
            fontFamily: '"SimSun", serif',
            fontSize: '80px',
            color: '#8b0000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: titleText,
            alpha: 0.5,
            duration: 2000,
            yoyo: true,
            repeat: -1
        });

        const startText = this.add.text(400, 400, '按 [空格] 或 [点击屏幕] 开始', {
            fontFamily: '"SimSun", serif',
            fontSize: '24px',
            color: '#aaaaaa'
        }).setOrigin(0.5);
        startText.setAlpha(0);

        // Fade in start text after delay to prevent accidental clicks
        this.tweens.add({
            targets: startText,
            alpha: 1,
            duration: 1000,
            delay: 200 // Reduced delay for better UX
        });

        const startGame = () => {
            if (startText.alpha < 0.1) return; // Lower threshold

            // Remove listeners to prevent multiple calls
            this.input.keyboard.off('keydown-SPACE', startGame);
            this.input.off('pointerdown', startGame);

            if (!this.game.soundManager) {
                this.game.soundManager = new SoundManager(this);
            }
            this.game.soundManager.playTone(100, 'sawtooth', 2);
            this.cameras.main.fadeOut(1000, 0, 0, 0);
            this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                this.scene.start('IntroScene');
            });
        };

        this.input.keyboard.on('keydown-SPACE', startGame);
        this.input.on('pointerdown', startGame);
    }
}