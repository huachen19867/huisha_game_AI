
export class IntroScene extends Phaser.Scene {
    constructor() {
        super('IntroScene');
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');
        this.crashed = false;

        // --- Visual Setup ---

        // 1. Road (Perspective)
        this.roadGraphics = this.add.graphics();
        
        // 2. Rain Particles
        // Create rain texture if missing
        if (!this.textures.exists('rain_drop')) {
            const g = this.make.graphics({x:0, y:0, add:false});
            g.fillStyle(0xaaaaaa);
            g.fillRect(0,0, 2, 10);
            g.generateTexture('rain_drop', 2, 10);
        }

        this.rainEmitter = this.add.particles(0, 0, 'rain_drop', {
            x: { min: 0, max: 800 },
            y: -50,
            speedY: { min: 800, max: 1200 },
            speedX: { min: -200, max: 200 }, // Wind effect
            lifespan: 1000,
            quantity: 5,
            frequency: 20,
            alpha: { start: 0.8, end: 0 },
            scale: { start: 1, end: 0.5 },
            blendMode: 'ADD'
        });

        // 3. Car Dashboard (Interior Mask)
        this.dashboard = this.add.graphics();
        this.dashboard.fillStyle(0x111111);
        // Dashboard base
        this.dashboard.fillRect(0, 450, 800, 150); 
        // Pillars
        this.dashboard.fillRect(0, 0, 50, 600); 
        this.dashboard.fillRect(750, 0, 50, 600); 
        // Top shade
        this.dashboard.fillTriangle(0, 0, 800, 0, 400, 80); 
        
        // Steering wheel
        this.dashboard.fillStyle(0x000000);
        this.dashboard.fillCircle(200, 550, 80); 
        this.dashboard.lineStyle(10, 0x333333);
        this.dashboard.strokeCircle(200, 550, 80);

        // 4. Wipers
        // Left Wiper
        this.leftWiper = this.add.rectangle(200, 550, 350, 8, 0x222222).setOrigin(0, 0.5);
        // Right Wiper
        this.rightWiper = this.add.rectangle(500, 550, 350, 8, 0x222222).setOrigin(0, 0.5);

        // Wiper Animation
        this.tweens.add({
            targets: [this.leftWiper, this.rightWiper],
            angle: { from: 0, to: -100 },
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 5. Headlights effect (Cones)
        this.lightsGraphics = this.add.graphics();
        
        // --- Audio Setup ---
        // Simple engine loop using noise
        this.engineTimer = this.time.addEvent({
            delay: 150,
            callback: () => {
                if (this.game.soundManager && !this.crashed) {
                    // Low rumbling
                    this.game.soundManager.playTone(60 + Math.random()*5, 'sawtooth', 0.2);
                }
            },
            loop: true
        });

        // --- Sequence Logic ---
        
        // Initial Dialog
        this.time.delayedCall(1500, () => {
            window.showDialog('主角', '七月十四...雨下得好大...看来今晚赶不回去了。');
        });

        this.time.delayedCall(5000, () => {
            window.showDialog('主角', '前面的路...怎么感觉有点熟悉？那封信上说的老宅...就在这附近吗？');
        });

        this.time.delayedCall(9000, () => {
            window.showDialog('主角', '那是...什么东西？！');
        });

        // The Crash Event
        this.time.delayedCall(10000, () => {
            this.triggerCrash();
        });
    }

    update(time, delta) {
        if (this.crashed) return;

        this.roadGraphics.clear();
        this.lightsGraphics.clear();
        
        // 1. Draw Ground (Dark)
        this.roadGraphics.fillStyle(0x050505);
        this.roadGraphics.fillRect(0, 300, 800, 300); // Horizon at 300

        // 2. Draw Road (Trapezoid)
        // Vanishing point: (400, 300)
        // Bottom width: 600px (100 to 700)
        this.roadGraphics.fillStyle(0x222222);
        this.roadGraphics.beginPath();
        this.roadGraphics.moveTo(380, 300); // Top Left
        this.roadGraphics.lineTo(420, 300); // Top Right
        this.roadGraphics.lineTo(750, 600); // Bottom Right
        this.roadGraphics.lineTo(50, 600);  // Bottom Left
        this.roadGraphics.closePath();
        this.roadGraphics.fillPath();

        // 3. Moving Dashed Lines
        const speed = 0.002;
        const offset = (time * speed) % 1; // 0 to 1 loop
        
        this.roadGraphics.fillStyle(0xffffff);
        
        // Draw multiple segments to simulate infinity
        // We use an exponential scale for Y to simulate perspective distance
        for(let i=0; i<6; i++) {
            // Calculate progress (0 is far, 1 is near)
            // Offset shifts them "towards" camera (increasing Y)
            let progress = (offset + i/6) % 1;
            
            // Apply perspective power (cubic feels right for road)
            let perspective = Math.pow(progress, 3); 
            
            let y = 300 + perspective * 300; // Map 0-1 to 300-600
            let w = 2 + perspective * 20;    // Width grows
            let h = 2 + perspective * 40;    // Height grows (dash length)
            
            if (y > 300 && y < 600) {
                this.roadGraphics.fillRect(400 - w/2, y, w, h);
            }
        }
        
        // 4. Headlights Flicker
        const flicker = 0.1 + Math.random() * 0.05;
        this.lightsGraphics.fillStyle(0xffffcc, flicker);
        // Left Beam
        this.lightsGraphics.beginPath();
        this.lightsGraphics.moveTo(150, 600);
        this.lightsGraphics.lineTo(350, 300);
        this.lightsGraphics.lineTo(450, 300);
        this.lightsGraphics.lineTo(650, 600);
        this.lightsGraphics.fillPath();
    }

    triggerCrash() {
        this.crashed = true;
        
        if (this.engineTimer) this.engineTimer.remove();

        // 1. Ghost Flash (Jumpscare)
        // Use 'npc_paper' or create a scary shape
        let ghost;
        if (this.textures.exists('npc_paper')) {
            ghost = this.add.image(400, 350, 'npc_paper');
            ghost.setTint(0xff0000);
        } else {
            // Fallback shape
            ghost = this.add.rectangle(400, 350, 50, 100, 0xff0000);
        }
        
        ghost.setOrigin(0.5);
        ghost.setScale(0.1);
        ghost.setDepth(100); // Above dashboard? No, behind windshield (dashboard is graphics, depth 0 default)
        // Dashboard needs depth
        this.dashboard.setDepth(200);
        this.leftWiper.setDepth(201);
        this.rightWiper.setDepth(201);
        ghost.setDepth(100);

        // Zoom ghost towards screen
        this.tweens.add({
            targets: ghost,
            scale: 8,
            alpha: { from: 0.5, to: 1 },
            duration: 300,
            ease: 'Expo.in',
            onComplete: () => {
                // 2. Impact
                this.cameras.main.shake(1000, 0.05);
                this.cameras.main.flash(500, 255, 255, 255);
                
                // Sounds
                if (this.game.soundManager) {
                    this.game.soundManager.playTone(50, 'sawtooth', 1.0); // Boom
                    this.game.soundManager.playTone(100, 'square', 0.5);  // Crunch
                    this.game.soundManager.playTone(800, 'sawtooth', 0.3); // Screech
                }

                // Stop rain visuals
                this.rainEmitter.stop();
                
                // 3. Fade Out
                this.time.delayedCall(1000, () => {
                    this.cameras.main.fadeOut(2000, 0, 0, 0);
                    
                    // Blackout Text
                    this.time.delayedCall(2500, () => {
                        const txt = this.add.text(400, 300, '头...好痛...\n\n我这是...在哪？', {
                            fontFamily: '"SimSun", serif',
                            fontSize: '24px',
                            color: '#ffffff',
                            align: 'center'
                        }).setOrigin(0.5).setDepth(1000);
                        txt.setAlpha(0);
                        
                        this.tweens.add({
                            targets: txt,
                            alpha: 1,
                            duration: 1500,
                            yoyo: true,
                            hold: 2000,
                            onComplete: () => {
                                // 4. Start Game
                                // Pass mapId to start in prologue
                                this.scene.start('GameScene', { mapId: 'room_prologue' });
                            }
                        });
                    });
                });
            }
        });
    }
}
