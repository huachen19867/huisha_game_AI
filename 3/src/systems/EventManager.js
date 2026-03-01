export class EventManager {
    constructor(scene) {
        this.scene = scene;
    }

    triggerRandomEvent() {
        const eventType = Phaser.Math.Between(0, 3);
        const scene = this.scene;
        
        switch(eventType) {
            case 0: // Thunder / Flash
                if (scene.currentMapId === 'room_backyard' || scene.currentMapId === 'room_entrance') {
                    scene.cameras.main.flash(100, 255, 255, 255);
                    scene.time.delayedCall(200, () => {
                         if (scene.soundManager) scene.soundManager.playTone(50, 'sawtooth', 0.5); // Low rumble
                    });
                }
                break;
            case 1: // Camera Bump (Poltergeist)
                scene.cameras.main.shake(100, 0.002);
                if (scene.soundManager) scene.soundManager.playTone(100, 'square', 0.1); // Wood creak sound
                break;
            case 2: // Distant whisper/whistle
                if (scene.soundManager && scene.player && scene.player.sprite) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = 150 + Math.random() * 200;
                    const wx = scene.player.sprite.x + Math.cos(angle) * r;
                    const wy = scene.player.sprite.y + Math.sin(angle) * r;
                    scene.soundManager.playSpatialTone(800, 'sine', 0.3, wx, wy);
                }
                break;
            case 3: // Lights flicker
                if (scene.lights.active) {
                    const originalR = scene.lights.ambientColor.r;
                    const originalG = scene.lights.ambientColor.g;
                    const originalB = scene.lights.ambientColor.b;
                    
                    let flickerCount = 0;
                    scene.time.addEvent({
                        delay: 50,
                        repeat: 7,
                        callback: () => {
                            flickerCount++;
                            if (flickerCount % 2 === 0) {
                                scene.lights.setAmbientColor(0x333333); // Not too dark
                            } else {
                                scene.lights.setAmbientColor(0x222222); // Not too dark
                            }
                            
                            if (flickerCount >= 6) {
                                scene.lights.setAmbientColor(0x888888); // Restore to bright ambient
                            }
                        }
                    });
                }
                break;
        }
    }

    triggerPaperDollEvent() {
        const scene = this.scene;
        if (!scene.npc) return;

        if ((scene.gameState.hasRice && !scene.gameState.hasMatches) || (!scene.gameState.hasRice && scene.gameState.hasMatches)) {
            scene.cameras.main.flash(200, 255, 255, 255);
            scene.playSound(50, 'sawtooth', 1.5);
            scene.npc.x = 320; 
            scene.npc.y = 400;
            scene.time.delayedCall(1000, () => {
                window.showDialog('主角', '刚才...是不是打雷了？那个纸人好像动了一下...');
            });
        } else if (scene.gameState.hasRice && scene.gameState.hasMatches) {
             scene.cameras.main.flash(200, 255, 255, 255);
             scene.playSound(50, 'sawtooth', 1.5);
             scene.npc.setVisible(false);
             scene.npc.body.enable = false;
             scene.time.delayedCall(1000, () => {
                window.showDialog('主角', '那个纸人不见了！');
             });
        }
    }
}