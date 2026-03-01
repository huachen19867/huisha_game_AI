import { TextureGenerator } from '../systems/TextureGenerator.js';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Generate all procedural textures
        TextureGenerator.generate(this);
    }

    create() {
        // Manually slice player sheet
        if (this.textures.exists('player_sheet')) {
            const texture = this.textures.get('player_sheet');
            const frameWidth = 32;
            const frameHeight = 48;
            if (texture.frameTotal === 1) {
                let frameIndex = 0;
                for (let row = 0; row < 4; row++) {
                    for (let col = 0; col < 3; col++) {
                        texture.add(frameIndex, 0, col * frameWidth, row * frameHeight, frameWidth, frameHeight);
                        frameIndex++;
                    }
                }
            }
        }
        this.scene.start('TitleScene');
    }
}