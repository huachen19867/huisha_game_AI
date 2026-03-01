import { Player } from '../entities/Player.js';
import { Maps } from '../data/Maps.js';
import { InteractionManager } from '../systems/InteractionManager.js';
import { EventManager } from '../systems/EventManager.js';
import { MapManager } from '../systems/MapManager.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.currentMapId = data.mapId || 'room_prologue';
        this.playerStartX = data.x || null;
        this.playerStartY = data.y || null;
        this.previousMapId = data.previousMapId || null;
        
        // If restarting from Title (no data provided), ensure we start fresh
        if (!data.mapId) {
             this.currentMapId = 'room_prologue';
             // Force reset if not already handled (though TitleScene handles it now)
        }
    }

    create() {
        // Force cleanup UI from previous scenes (e.g. IntroScene text)
        const dialogBox = document.getElementById('dialog-box');
        if (dialogBox) dialogBox.classList.add('hidden');
        window.dialogActive = false;

        // Reset scene switch flag
        this.isSwitching = false;

        // Reset level specific objects to prevent ghost interactions
        this.coffin = null;
        this.altar = null;
        this.stove = null;
        this.dirtPile = null;
        this.npc = null;
        this.well = null;
        this.trees = null; // Reset trees group
        this.car = null;
        this.cabinet = null;
        this.bed = null;
        this.sink = null;
        this.toilet = null;
        this.mirror = null;
        this.desk = null;
        this.diary = null;
        this.medical_record = null;
        this.family_rules = null;
        this.toy_plane = null;
        this.locked_window = null;
        this.exit_door = null;
        this.chest = null; // New Cheat Chest
        this.walls = null;
        this.doors = null;
        this.photos = null; // Reset photos group
        this.floorLayer = [];
        this.currentTarget = null;
        this.leftCandle = null;
        this.rightCandle = null;
        this.shownCorridorHint = false;
        this.chaser = null; // Reset chaser ref

        this.safe = null; // New Safe Object
        this.wet_paper = null; // New Clue Object
        this.red_key = null; // New Item Object
        this.toy_plane = null; // Reset plane ref
        this.npc = null; // Reset npc ref
        
        this.soundManager = this.game.soundManager;
        
        // Lazy initialize sound manager if missing (e.g. direct load)
        if (!this.soundManager) {
            import('../systems/SoundManager.js').then(module => {
                this.game.soundManager = new module.SoundManager(this);
                this.soundManager = this.game.soundManager;
            }).catch(e => console.error("Failed to load SoundManager", e));
        }

        // Global Game State
        if (!window.globalGameState) {
            window.globalGameState = {
                storyStep: 0,
                hasMatches: false,
                hasRice: false,
                candlesLit: 0,
                inventory: [],
                viewedPhotos: [],
                clues: [], // New: Track collected story clues
                corridorSolved: false,
                viewedIntro: false,
                viewedEntrance: false,
                doorSlammed: false
            };
        }
        this.gameState = window.globalGameState;

        // Reset UI Visibility (in case it was hidden)
        document.getElementById('inventory').style.display = '';
        document.getElementById('joystick-zone').style.display = '';
        document.getElementById('action-btn').style.display = '';

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Joystick Logic
        this.joystick = { x: 0, y: 0, active: false };
        this.initJoystick();

        // Initialize Map Manager
        this.mapManager = new MapManager(this);
        this.mapManager.createMap(this.currentMapId);

        // Create Player
        const mapData = Maps[this.currentMapId];
        const startX = this.playerStartX || mapData.objects.playerStart.x;
        const startY = this.playerStartY || mapData.objects.playerStart.y;
        this.player = new Player(this, startX, startY);
        
        // Colliders
        this.physics.add.collider(this.player.sprite, this.walls);
        this.physics.add.collider(this.player.sprite, this.furniture);
        if (this.trees) this.physics.add.collider(this.player.sprite, this.trees);
        
        // Show Room Name Notification
        if (mapData.name) {
            this.showRoomTitle(mapData.name);
        }
        
        // Spawn Chaser if active (Persist chase across scenes)
        if (this.gameState.isChasing) {
            this.spawnChaser();
        }
        
        // Camera
        this.cameras.main.startFollow(this.player.sprite, true, 0.09, 0.09);
        this.cameras.main.setZoom(1.2);
        this.cameras.main.fadeIn(500, 0, 0, 0);

        // Lights & Atmosphere
        this.lights.enable();
        this.lights.setAmbientColor(0x888888); // Brighter as per user request

        this.rainParticles = this.add.particles(0, 0, 'rain', {
            x: { min: 0, max: 800 },
            y: -10,
            quantity: 2,
            lifespan: 1000,
            speedY: { min: 400, max: 600 },
            speedX: { min: -20, max: 20 },
            scale: { start: 1, end: 1 },
            alpha: { start: 0.5, end: 0 },
            blendMode: 'ADD'
        });
        this.rainParticles.setDepth(200);
        this.rainParticles.setScrollFactor(0);

        this.vignette = this.add.image(400, 300, 'vignette');
        this.vignette.setScrollFactor(0);
        this.vignette.setDepth(300);
        this.vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);

        // Fog / Darkness Overlay
        this.fog = this.add.graphics();
        this.fog.fillStyle(0x000000, 0.1); // Less dense fog
        this.fog.fillRect(0, 0, 800, 600);
        this.fog.setScrollFactor(0);
        this.fog.setDepth(250);

        // Danger Overlay (Red Vignette)
        this.dangerOverlay = this.add.graphics();
        this.dangerOverlay.fillStyle(0xff0000, 0.2); // Red tint
        this.dangerOverlay.fillRect(0, 0, 800, 600);
        this.dangerOverlay.setScrollFactor(0);
        this.dangerOverlay.setDepth(260);
        this.dangerOverlay.setAlpha(0);
        this.dangerOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);

        // Flashback Overlay
        this.flashbackOverlay = this.add.rectangle(400, 300, 800, 600, 0x704214).setScrollFactor(0).setDepth(900).setAlpha(0);
        this.flashbackOverlay.setBlendMode(Phaser.BlendModes.OVERLAY);

        // Mic Indicator
        // Moved down to 120 to avoid browser address bar blocking
        this.micIndicator = this.add.text(400, 120, '🤫 保持安静...', {
            fontSize: '24px',
            color: '#ff0000',
            backgroundColor: '#000',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setVisible(false);

        // Memory Room Special Settings (Override standard horror settings)
        if (this.currentMapId === 'room_memory') {
            this.lights.setAmbientColor(0xffffff); // Full bright
            this.rainParticles.stop(); // No rain
            this.rainParticles.setVisible(false);
            this.vignette.setVisible(false); // No vignette
            this.fog.setVisible(false); // No fog
        }

        // Ambience (Rain/Static)
        this.time.addEvent({
            delay: 200, // Slower check
            callback: () => {
                 // Reduced chance to 20% to be less annoying
                 if (Math.random() < 0.2 && this.soundManager) this.soundManager.playNoise(0.05);
            },
            loop: true
        });

        // Initialize Systems
        this.eventManager = new EventManager(this);
        this.interactionManager = new InteractionManager(this);

        // Random Horror Events (Poltergeist)
        this.time.addEvent({
            delay: 5000, // Check every 5 seconds
            callback: () => {
                // 10% chance every 5s -> roughly once a minute
                if (Math.random() < 0.1 && !this.gameState.isChasing && this.currentMapId !== 'room_memory') {
                    this.eventManager.triggerRandomEvent();
                }
            },
            loop: true
        });

        // UI Text
        this.interactText = this.add.text(0, 0, '按 [空格] / [A] 调查', {
            fontSize: '16px',
            color: '#fff',
            backgroundColor: '#000'
        }).setOrigin(0.5).setVisible(false).setDepth(400);

        // Intro Dialog (Prologue)
        if (this.currentMapId === 'room_prologue' && !this.gameState.viewedIntro) {
            this.time.delayedCall(1000, () => {
                if (!this.gameState.viewedIntro) {
                    this.gameState.viewedIntro = true;
                    window.showDialog('主角', '（头痛欲裂）咳咳...雨下得太大了...刹车失灵...然后是一声巨响...', () => {
                        window.showDialog('主角', '车彻底报废了。偏偏是今天，七月十四...手机也没信号。');
                    });
                }
            });
        }
        
        // Entrance Dialog (When arriving from Prologue)
        if (this.currentMapId === 'room_entrance' && !this.gameState.viewedEntrance) {
             this.gameState.viewedEntrance = true;
             this.time.delayedCall(1000, () => {
                 window.showDialog('主角', '前面有座宅子...那是...我的老家？自从十年前那场变故后，我就再也没回来过。', () => {
                     window.showDialog('主角', '虽然不想进去，但这鬼天气...只能去避一避了。');
                 });
             });
        }
        
        if (this.gameState.isChasing) {
             this.chaseTimer = this.time.addEvent({
                 delay: 2000,
                 callback: () => {
                     this.cameras.main.shake(200, 0.01);
                     if (this.soundManager && this.chaser && this.chaser.active) {
                        this.soundManager.playSpatialNoise(0.5, this.chaser.x, this.chaser.y);
                     }
                 },
                 loop: true
             });
        }
    }

    update() {
        if (window.dialogActive) {
            this.player.sprite.setVelocity(0);
            return;
        }
        
        // Update Chaser AI per frame for smoother movement
        this.updateChaser();

        // Hiding Logic
        if (this.gameState.isHidden) {
            // Prevent exiting hide mode immediately after closing a dialog
            if (window.dialogActive) return;

            // Mic Check Logic
            if (this.soundManager && this.soundManager.micStream) {
                const vol = this.soundManager.getMicVolume();
                // Threshold logic: 
                // Quiet room is usually ~10-20. Speaking is ~50+.
                // Let's set threshold to 40.
                if (vol > 40) {
                    this.micIndicator.setText('⚠️ 声音太大了！');
                    this.micIndicator.setColor('#ff0000');
                    
                    if (!this.micTooLoudTimer) {
                         this.micTooLoudTimer = this.time.delayedCall(1000, () => {
                             // If still loud after 1s (or just cumulative trigger)
                             // Actually let's just trigger immediately if it spikes high
                             this.triggerFoundByMic();
                         });
                    }
                } else {
                    this.micIndicator.setText('🤫 保持安静...');
                    this.micIndicator.setColor('#ffffff');
                    if (this.micTooLoudTimer) {
                        this.micTooLoudTimer.remove();
                        this.micTooLoudTimer = null;
                    }
                }
            }

            if (Phaser.Input.Keyboard.JustDown(this.keySpace) || Phaser.Input.Keyboard.JustDown(this.keyE)) {
                this.toggleHide();
            }
            return;
        }

        // Wait for sound manager to be ready
        if (this.soundManager) {
            this.player.update(this.cursors, this.wasd, this.joystick, this.soundManager);
        }
        
        if (this.interactionManager) this.interactionManager.update();
        
        this.physics.overlap(this.player.sprite, this.doors, (player, door) => {
            if (door.locked) {
                // Check for key
                let hasKey = false;
                if (door.key === 'silver_key' && this.gameState.inventory.includes('地下室钥匙')) hasKey = true;
                
                if (hasKey) {
                    // Unlock
                    door.locked = false; // Permanently unlock in this session (though map reload resets it, we should check inventory on create map actually. But for now, simple is fine)
                    this.switchScene(door.targetMap, door.targetX, door.targetY);
                } else {
                    if (!this.gameState.lastLockedMsg || this.time.now - this.gameState.lastLockedMsg > 2000) {
                        this.gameState.lastLockedMsg = this.time.now;
                        window.showDialog('（内心独白）', '门锁住了。需要一把银色的钥匙。');
                    }
                }
                return;
            }

            if (door.isLoop && !this.gameState.corridorSolved) {
                // Loop back to start of corridor
                this.switchScene(door.targetMap, door.targetX, door.targetY);
                // Play a loop sound or effect?
                this.cameras.main.flash(200, 0, 0, 0);
            } else if (door.isLoop && this.gameState.corridorSolved) {
                // Break the loop -> go to backyard
                this.switchScene('room_backyard', 320, 100);
            } else {
                this.switchScene(door.targetMap, door.targetX, door.targetY);
            }
        });

        // Hint System for Room Corridor (if user is stuck)
        if (this.currentMapId === 'room_corridor') {
            const y = this.player.sprite.y;
            // ...
        }

        // Sanity System Logic
        this.updateSanity();
    }

    updateSanity() {
        if (!window.updateSanityUI) return;

        let drainRate = 0;
        
        // 1. Darkness Drain (if flashlight is off or flickering)
        // Check ambient light + flashlight
        // Simplified: If not in memory room and not near light source?
        // Let's just say: If chaser is active OR in specific scary rooms
        
        if (this.currentMapId === 'room_basement' || this.currentMapId === 'room_attic' || this.currentMapId === 'room_secret') {
            drainRate += 0.05;
        }

        // 2. Chaser Proximity
        if (this.chaser && this.chaser.active && this.gameState.isChasing) {
            const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, this.chaser.x, this.chaser.y);
            if (dist < 300) {
                drainRate += 0.2;
            }
        }

        // 3. Recharge in safe areas
        if (this.currentMapId === 'room_bedroom_me' || this.currentMapId === 'room_memory') {
            drainRate = -0.1;
        }

        this.gameState.sanity -= drainRate;
        this.gameState.sanity = Phaser.Math.Clamp(this.gameState.sanity, 0, 100);
        
        window.updateSanityUI(this.gameState.sanity, 100);

        // Sanity Effects
        if (this.gameState.sanity < 30) {
            // Audio Hallucinations
            if (Math.random() < 0.01 && this.soundManager) {
                this.soundManager.playSpatialNoise(0.5, this.player.sprite.x + Phaser.Math.Between(-100, 100), this.player.sprite.y + Phaser.Math.Between(-100, 100));
            }
            // Visual Shake
            if (Math.random() < 0.05) {
                this.cameras.main.shake(100, 0.005);
            }
        }
    }

    spawnChaser() {
        if (this.chaser) return; // Already spawned
        
        let spawnX, spawnY;
        let fromDoor = false;

        // Try to find the door leading back to previous map
        if (this.previousMapId) {
             const mapData = Maps[this.currentMapId];
             if (mapData && mapData.objects.doors) {
                 const door = mapData.objects.doors.find(d => d.targetMap === this.previousMapId);
                 if (door) {
                     // Found the door we came from
                     const w = (door.w || 1) * 32;
                     const h = (door.h || 1) * 32;
                     spawnX = (door.x * 32) + (w / 2);
                     spawnY = (door.y * 32) + (h / 2);
                     fromDoor = true;
                 }
             }
        }

        if (!fromDoor) {
             // Fallback: Random distance
             spawnX = this.player.sprite.x + (Math.random() > 0.5 ? 200 : -200);
             spawnY = this.player.sprite.y + (Math.random() > 0.5 ? 200 : -200);
        }
        
        this.chaser = this.physics.add.sprite(spawnX, spawnY, 'npc_paper').setPipeline('Light2D');
        this.chaser.setTint(0xff0000); // Red tint for danger
        
        // Dark Aura Particles (Evil Spirit Effect)
        this.chaserAura = this.add.particles(0, 0, 'rain', {
            speed: { min: 10, max: 30 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.6, end: 0 },
            tint: 0x000000,
            quantity: 2,
            lifespan: 800,
            follow: this.chaser
        });
        this.chaserAura.setDepth(this.chaser.depth - 1);
        
        // Add collision with walls and static objects
        this.physics.add.collider(this.chaser, this.walls);
        this.physics.add.collider(this.chaser, this.furniture);
        if (this.trees) this.physics.add.collider(this.chaser, this.trees);
        
        if (fromDoor) {
             // If from door, start invisible and disabled, then fade in
             this.chaser.setAlpha(0);
             this.chaser.body.enable = false;
             
             // Give player 2 seconds to run before ghost enters
             this.time.delayedCall(2000, () => {
                 if (this.soundManager) this.soundManager.playNoise(1.0); // Door bang sound
                 
                 this.tweens.add({
                    targets: this.chaser,
                    alpha: 0.8,
                    duration: 500,
                    onComplete: () => {
                        if (this.chaser) this.chaser.body.enable = true;
                    }
                 });
             });
        } else {
             this.chaser.setAlpha(0.8);
        }

        this.physics.add.overlap(this.player.sprite, this.chaser, () => {
            if (!this.gameState.isHidden) {
                // Game Over Logic
                this.physics.pause();
                this.chaser.body.setVelocity(0);
                window.showDialog('暴怒的黑影', '抓到你了...乖儿子，哪也不许去。我们要永远在一起...永远不分开。', () => {
                     this.scene.restart();
                });
            }
        });
    }

    updateChaser() {
        // No chaser in memory room
        if (this.currentMapId === 'room_memory') return;

        // Reset danger effect if no chaser
        if (!this.chaser || !this.chaser.active || !this.gameState.isChasing) {
            if (this.dangerOverlay) this.dangerOverlay.setAlpha(0);
            return;
        }
        
        // Calculate distance for effects
        const dist = Phaser.Math.Distance.Between(this.chaser.x, this.chaser.y, this.player.sprite.x, this.player.sprite.y);
        
        // Dynamic Horror Effects
        if (dist < 500) { // Increased range
            // Visual: Red pulse scaling with distance
            const intensity = 1 - (dist / 500);
            this.dangerOverlay.setAlpha(intensity * 0.8 + Math.sin(this.time.now / 100) * 0.2); // Stronger effect
            
            // Audio: Heartbeat
            // Frequency increases with proximity (1000ms down to 400ms)
            const beatInterval = 300 + (dist / 500) * 500;
            if (this.time.now > (this.nextHeartbeat || 0)) {
                if (this.soundManager) this.soundManager.playHeartbeat(intensity);
                this.nextHeartbeat = this.time.now + beatInterval;
                // Camera bump
                this.cameras.main.shake(100, 0.01 * intensity);
            }
        } else {
            this.dangerOverlay.setAlpha(0);
        }

        // Use a timer to prevent rapid direction changes
        const now = this.time.now;
        if (!this.chaser.nextDecisionTime) this.chaser.nextDecisionTime = 0;
        
        // Check if stuck (velocity is low OR hitting a wall)
        // Note: checking body.blocked requires that physics world has updated.
        // If we just spawned, velocity is 0, so give it a kickstart if needed.
        const isStuck = this.chaser.body.velocity.length() < 10 || !this.chaser.body.blocked.none;

        if (this.gameState.isHidden) {
             // Pure wander logic (Blind to player position)
             
             // If stuck and decision timer allows, pick a new direction
             if (isStuck && now > this.chaser.nextDecisionTime) {
                 // Pick a random direction and move
                 const angle = Math.random() * Math.PI * 2;
                 this.chaser.body.setVelocity(Math.cos(angle) * 80, Math.sin(angle) * 80);
                 // Don't change again for 1 second to give it time to move out of corner
                 this.chaser.nextDecisionTime = now + 1000;
             } 
             
             // Small chance to change direction spontaneously (if not stuck)
             if (!isStuck && Math.random() < 0.01 && now > this.chaser.nextDecisionTime) {
                 const angle = Math.random() * Math.PI * 2;
                 this.chaser.body.setVelocity(Math.cos(angle) * 80, Math.sin(angle) * 80);
                 this.chaser.nextDecisionTime = now + 1000;
             }
        } else {
            // Chase logic
            const speed = 100;
            const dist = Phaser.Math.Distance.Between(this.chaser.x, this.chaser.y, this.player.sprite.x, this.player.sprite.y);
            
            // Stuck detection during chase
            if (isStuck && dist > 50 && now > this.chaser.nextDecisionTime) {
                // Stuck! Try to move perpendicular or away for a moment
                const angleToPlayer = Phaser.Math.Angle.Between(this.chaser.x, this.chaser.y, this.player.sprite.x, this.player.sprite.y);
                const avoidAngle = angleToPlayer + (Math.random() > 0.5 ? 1.5 : -1.5); // Turn 90 degrees
                
                this.chaser.body.setVelocity(Math.cos(avoidAngle) * speed, Math.sin(avoidAngle) * speed);
                this.chaser.nextDecisionTime = now + 500; 
                return; // SKIP moveToObject this frame to allow velocity to apply
            }
            
            // 1. Move towards player (Only if not in "avoidance mode" from previous stuck)
            if (now > this.chaser.nextDecisionTime) {
                this.physics.moveToObject(this.chaser, this.player.sprite, speed);
            }
        }
    }

    switchScene(mapId, targetX, targetY) {
        if (this.isSwitching) return;
        this.isSwitching = true;
        
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            // Stop chasing if switching scene
            if (this.gameState.isChasing) {
                // Keep chasing state
            }
            
            this.scene.restart({ mapId: mapId, x: targetX, y: targetY, previousMapId: this.currentMapId });
            this.isSwitching = false;
        });
    }

    triggerRealEnding() {
         // Stop chase timer if any
         if (this.chaseTimer) this.chaseTimer.remove();
         this.gameState.isChasing = false;
         
         document.getElementById('inventory').style.display = 'none';
         document.getElementById('joystick-zone').style.display = 'none';
         document.getElementById('action-btn').style.display = 'none';
         
         this.cameras.main.fadeOut(2000, 255, 255, 255);
         
         this.time.delayedCall(2000, () => {
             // Use the global horror ending effect from index.html
             window.triggerHorrorEnding(() => {
                 // Transition to Memory Room instead of Title
                 this.scene.restart({ mapId: 'room_memory', x: 320, y: 400 });
                 
                 // Reset UI for memory room (clean state)
                 // We don't reset globalGameState fully yet, as we might want to check flags
             });
         });
    }

    // Safe play wrapper
    playSound(tone, type, duration) {
        if (this.soundManager) {
            this.soundManager.playTone(tone, type, duration);
        }
    }

    // Show Room Title Notification
    showRoomTitle(text) {
        // Moved down to 120 to avoid browser address bar blocking
        const title = this.add.text(400, 120, text, {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 2, stroke: true, fill: true }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setAlpha(0);

        this.tweens.add({
            targets: title,
            alpha: 1,
            duration: 1000,
            hold: 2000,
            yoyo: true, // Fade out after hold
            onComplete: () => {
                if (title) title.destroy();
            }
        });
    }

    // Add a simple hint system
    showHint(text) {
        const hint = this.add.text(400, 100, text, {
            fontSize: '18px',
            color: '#aaaaaa',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(500);
        
        this.tweens.add({
            targets: hint,
            alpha: 0,
            y: 80,
            duration: 2000,
            delay: 2000,
            onComplete: () => hint.destroy()
        });
    }

    triggerFlashback(type) {
        // Sepia fade in
        this.tweens.add({
            targets: this.flashbackOverlay,
            alpha: 0.6,
            duration: 1000,
            yoyo: true,
            hold: 3000
        });

        // Play flashback sound
        if (this.soundManager) {
            this.soundManager.playNoise(2); // Static noise
            this.soundManager.playTone(100, 'sawtooth', 2); // Eerie tone
        }

        // Camera effect
        this.cameras.main.shake(3000, 0.01);

        // Logic for specific flashbacks (spawn ghosts)
        // Since we don't have many assets, we use particles or temp sprites
        if (type === 'car_crash') {
             // Simulate crash chaos
             this.cameras.main.flash(500, 255, 0, 0);
        }
    }

    triggerFoundByMic() {
        if (!this.gameState.isHidden) return;
        
        this.toggleHide(); // Force exit
        
        window.showDialog('（内心独白）', '糟糕！声音引来了它！', () => {
            if (!this.chaser) {
                this.gameState.isChasing = true;
                this.spawnChaser();
            }
            
            // Teleport chaser nearby
            if (this.chaser) {
                const angle = Math.random() * Math.PI * 2;
                this.chaser.setPosition(this.player.sprite.x + Math.cos(angle) * 100, this.player.sprite.y + Math.sin(angle) * 100);
            }
        });
    }

    toggleHide() {
        if (this.gameState.isHidden) {
            // Exit hiding
            this.gameState.isHidden = false;
            this.player.sprite.setVisible(true);
            this.player.sprite.body.enable = true;
            this.interactText.setText('按 [空格] / [A] 调查');
            this.cameras.main.zoomTo(1.2, 500);
            
            // Re-enable Flashlight
            if (this.player.flashlight) this.player.flashlight.setAlpha(0.6);
            if (this.player.lightSource) this.player.lightSource.setIntensity(1.2);

            // Re-enable UI
            document.getElementById('inventory').style.display = '';
            document.getElementById('joystick-zone').style.display = '';
            document.getElementById('action-btn').style.display = '';

            // Hide Mic Indicator
            this.micIndicator.setVisible(false);

        } else {
            // Enter hiding
            this.gameState.isHidden = true;
            this.player.sprite.setVisible(false);
            this.player.sprite.body.enable = false; // Disable physics immediately
            this.interactText.setVisible(true).setText('按 [空格] / [A] 离开');
            this.interactText.setPosition(this.player.sprite.x, this.player.sprite.y - 60);
            this.cameras.main.zoomTo(1.5, 500);

            // Disable Flashlight
            if (this.player.flashlight) this.player.flashlight.setAlpha(0);
            if (this.player.lightSource) this.player.lightSource.setIntensity(0);

            // Force Chaser to start wandering AWAY immediately
            if (this.chaser && this.chaser.active && this.gameState.isChasing) {
                 const angle = Phaser.Math.Angle.Between(this.player.sprite.x, this.player.sprite.y, this.chaser.x, this.chaser.y);
                 // Add some randomness but generally away
                 const randomAngle = angle + Phaser.Math.FloatBetween(-1.0, 1.0);
                 this.chaser.body.setVelocity(Math.cos(randomAngle) * 80, Math.sin(randomAngle) * 80);
            }

            // Hide UI
            document.getElementById('inventory').style.display = 'none';
            document.getElementById('joystick-zone').style.display = 'none';
            document.getElementById('action-btn').style.display = 'none';
            
            window.showDialog('（内心独白）', '（你屏住了呼吸...）', () => {
                // Try init mic
                if (this.soundManager) {
                    this.soundManager.initMic().then(success => {
                        if (success) {
                            this.micIndicator.setVisible(true);
                        }
                    });
                }
            });
        }
    }

    initJoystick() {
        const zone = document.getElementById('joystick-zone');
        const knob = document.getElementById('joystick-knob');
        const actionBtn = document.getElementById('action-btn');
        
        let startX, startY;
        const maxDist = 35;
        let uiTimer = null;

        const showUI = () => {
            zone.classList.remove('ui-faded');
            actionBtn.classList.remove('ui-faded');
            if (uiTimer) clearTimeout(uiTimer);
        };

        const scheduleHideUI = () => {
            if (uiTimer) clearTimeout(uiTimer);
            uiTimer = setTimeout(() => {
                zone.classList.add('ui-faded');
                actionBtn.classList.add('ui-faded');
            }, 2000);
        };

        scheduleHideUI();

        zone.addEventListener('touchstart', (e) => {
            showUI();
            e.preventDefault();
            const touch = e.touches[0];
            const rect = zone.getBoundingClientRect();
            startX = rect.left + rect.width / 2;
            startY = rect.top + rect.height / 2;
            this.joystick.active = true;
            this.updateJoystick(touch.clientX, touch.clientY, startX, startY, knob, maxDist);
        }, { passive: false });

        zone.addEventListener('touchmove', (e) => {
            showUI(); 
            e.preventDefault();
            if (!this.joystick.active) return;
            const touch = e.touches[0];
            this.updateJoystick(touch.clientX, touch.clientY, startX, startY, knob, maxDist);
        }, { passive: false });

        const endHandler = (e) => {
            scheduleHideUI(); 
            this.joystick.active = false;
            this.joystick.x = 0;
            this.joystick.y = 0;
            knob.style.transform = `translate(-50%, -50%)`;
        };

        zone.addEventListener('touchend', endHandler);
        zone.addEventListener('touchcancel', endHandler);

        actionBtn.addEventListener('touchstart', (e) => {
            showUI();
            scheduleHideUI(); 
            e.preventDefault();
            if (window.dialogActive) {
                if (window.currentDialogNextHandler) window.currentDialogNextHandler();
                return;
            }
            if (this.interactText.visible) this.handleInteraction();
        }, { passive: false });

        actionBtn.addEventListener('mousedown', (e) => {
            showUI();
            scheduleHideUI();
            e.preventDefault();
            if (window.dialogActive) {
                if (window.currentDialogNextHandler) window.currentDialogNextHandler();
                return;
            }
            if (this.interactText.visible) this.handleInteraction();
        });
    }

    updateJoystick(clientX, clientY, centerX, centerY, knob, maxDist) {
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) {
            const ratio = maxDist / dist;
            dx *= ratio;
            dy *= ratio;
        }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.joystick.x = dx / maxDist;
        this.joystick.y = dy / maxDist;
    }
}