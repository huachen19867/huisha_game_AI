import { TextureGenerator } from '../systems/TextureGenerator.js';
import { ART_ASSETS } from '../data/ArtAssets.js';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        this.cameras.main.setBackgroundColor('#101b1d');
        this.add.text(400, 278, '雨夜将至', { fontFamily: 'SimSun,serif', fontSize: '24px', color: '#c9b38b' }).setOrigin(0.5);
        const progress = this.add.rectangle(400, 324, 0, 2, 0xb59565);
        this.artProgress = value => { progress.width = value * 200; };
        this.load.on('progress', this.artProgress);
        // Generate all procedural textures
        TextureGenerator.generate(this);
        for (const [key, asset] of Object.entries(ART_ASSETS)) {
            if (!window.huishaEmbeddedArt?.[key]) this.load.image(key, asset.file);
        }
    }

    async create() {
        this.load.off('progress', this.artProgress);
        await this.loadEmbeddedArt();
        delete window.huishaEmbeddedArt;
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

    async loadEmbeddedArt() {
        const entries = Object.keys(ART_ASSETS).filter(key => window.huishaEmbeddedArt?.[key] && !this.textures.exists(key));
        if (!entries.length) return;
        let finished = 0;
        this.artProgress(0);
        await Promise.all(entries.map(key => new Promise(resolve => {
            // Decode directly: Phaser's HTMLImageElement loader rejects data URIs.
            const image = new Image();
            const finish = () => {
                image.onload = null;
                image.onerror = null;
                this.artProgress(++finished / entries.length);
                resolve();
            };
            image.onload = () => {
                try {
                    this.textures.addImage(key, image);
                } catch (error) {
                    console.warn(`Artwork unavailable: ${key}`, error);
                } finally {
                    finish();
                }
            };
            image.onerror = finish;
            image.src = window.huishaEmbeddedArt[key];
        })));
    }
}
