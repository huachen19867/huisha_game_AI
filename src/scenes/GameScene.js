import { Player } from '../entities/Player.js';
import { Maps } from '../data/Maps.js';
import { InteractionManager } from '../systems/InteractionManager.js';
import { EventManager } from '../systems/EventManager.js';
import { MapManager } from '../systems/MapManager.js';
import { SoundManager } from '../systems/SoundManager.js';
import { createDefaultGameState, getTruthLevel, normalizeGameState } from '../systems/StoryState.js';
import { resolveSpawnCoordinate, updateBoundedResource } from '../systems/RuntimeState.js';
import { DomListenerRegistry } from '../systems/DomListenerRegistry.js';
import { ObjectiveManager } from '../systems/ObjectiveManager.js';
import { ChaseManager } from '../systems/ChaseManager.js';
import { getPendingNarrativeBeat, markNarrativeBeatSeen } from '../systems/NarrativeDirector.js';
import { HauntingDirector } from '../systems/HauntingDirector.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.currentMapId = data.mapId || 'room_prologue';
        this.playerStartX = data.x ?? null;
        this.playerStartY = data.y ?? null;
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
        this.narrativeBeatPlaying = false;
        this.narrativeBeatTimer = null;
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
            this.game.soundManager = new SoundManager(this);
            this.soundManager = this.game.soundManager;
        }
        this.soundManager.setScene(this);

        const ua = navigator.userAgent || '';
        this.isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

        // Global Game State
        if (!window.globalGameState) {
            window.globalGameState = createDefaultGameState();
        }
        this.gameState = normalizeGameState(window.globalGameState);
        this.objectiveManager = new ObjectiveManager(this.gameState, document.getElementById('objective-panel'));
        this.refreshObjective();

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
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.destroyJoystick();
            this.chaseManager?.destroy();
            this.hauntingDirector?.destroy();
            window.closePuzzle?.();
            this.narrativeBeatTimer?.remove();
            this.narrativeBeatTimer = null;
        });

        // Initialize Map Manager
        this.mapManager = new MapManager(this);
        this.mapManager.createMap(this.currentMapId);

        // Create Player
        const mapData = Maps[this.currentMapId];
        const startX = resolveSpawnCoordinate(this.playerStartX, mapData.objects.playerStart.x);
        const startY = resolveSpawnCoordinate(this.playerStartY, mapData.objects.playerStart.y);
        this.player = new Player(this, startX, startY);
        this.chaseManager = new ChaseManager(this);
        this.hauntingDirector = new HauntingDirector(this);

        // Colliders
        this.physics.add.collider(this.player.sprite, this.walls);
        this.physics.add.collider(this.player.sprite, this.furniture);
        if (this.trees) this.physics.add.collider(this.player.sprite, this.trees);

        // Show Room Name Notification
        if (mapData.name) {
            this.showRoomTitle(mapData.name);
        }

        // Spawn Chaser if active (Persist chase across scenes)
        if (this.gameState.isChasing || this.gameState.storyFlags.chasePhase === 'active') {
            this.chaseManager.start();
        }

        // Camera
        this.cameras.main.startFollow(this.player.sprite, true, 0.09, 0.09);
        this.cameras.main.setZoom(1.2);
        this.cameras.main.fadeIn(500, 0, 0, 0);

        // Lights & Atmosphere
        const shouldRain = mapData.visual?.rain === true && !this.isMobile;
        this.rainParticles = this.add.particles(0, 0, 'rain', {
            x: { min: 0, max: 800 },
            y: -10,
            quantity: shouldRain ? 2 : 0,
            lifespan: 1000,
            speedY: { min: 400, max: 600 },
            speedX: { min: -20, max: 20 },
            scale: { start: 1, end: 1 },
            alpha: { start: 0.5, end: 0 },
            blendMode: 'ADD'
        });
        this.rainParticles.setDepth(200);
        this.rainParticles.setScrollFactor(0);
        if (!shouldRain) this.rainParticles.stop();

        this.vignette = this.add.image(400, 300, 'vignette');
        this.vignette.setScrollFactor(0);
        this.vignette.setDepth(300);
        this.vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);
        if (this.isMobile) {
            this.vignette.setVisible(false);
        }

        // Fog / Darkness Overlay
        this.fog = this.add.graphics();
        this.fog.fillStyle(0x000000, 0.1);
        this.fog.fillRect(0, 0, 800, 600);
        this.fog.setScrollFactor(0);
        this.fog.setDepth(250);
        if (this.isMobile) {
            this.fog.setVisible(false);
        }

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
            if (!this.isMobile) this.lights.setAmbientColor(0xffffff);
            this.rainParticles.stop();
            this.rainParticles.setVisible(false);
            this.vignette.setVisible(false);
            this.fog.setVisible(false);
        }

        // Ambience (Rain/Static)
        this.time.addEvent({
            delay: 200,
            callback: () => {
                 if (this.isMobile) return;
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

        this.showPostMemoryDialog();
    }

    update(time, delta) {
        this.hauntingDirector?.update(time, delta);
        if (window.dialogActive) {
            this.player.sprite.setVelocity(0);
            return;
        }

        // Update Chaser AI per frame for smoother movement
        this.chaseManager.update();

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
            this.player.update(this.cursors, this.wasd, this.joystick, this.soundManager, delta);
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
                    this.playSound(400, 'sine', 1);
                } else {
                    if (!this.gameState.lastLockedMsg || this.time.now - this.gameState.lastLockedMsg > 2000) {
                        this.gameState.lastLockedMsg = this.time.now;
                        window.showDialog('主角', '门锁住了。需要一把银色的钥匙。');
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
        this.updateSanity(delta);
        this.refreshObjective();
    }

    refreshObjective() {
        this.objectiveManager?.refresh(this.currentMapId);
    }

    queueNarrativeBeat() {
        if (this.narrativeBeatPlaying || this.narrativeBeatTimer) return;
        this.narrativeBeatTimer = this.time.delayedCall(250, () => this.flushNarrativeBeat());
    }

    flushNarrativeBeat() {
        this.narrativeBeatTimer = null;
        if (window.dialogActive || this.isSwitching) {
            this.queueNarrativeBeat();
            return;
        }
        const beat = getPendingNarrativeBeat(this.gameState);
        if (!beat) return;
        this.narrativeBeatPlaying = true;
        const showLine = index => {
            if (index >= beat.lines.length) {
                markNarrativeBeatSeen(this.gameState, beat.id);
                this.narrativeBeatPlaying = false;
                this.refreshObjective();
                return;
            }
            const line = beat.lines[index];
            window.showDialog(line.speaker, line.text, () => showLine(index + 1));
        };
        showLine(0);
    }

    updateSanity(delta) {
        let ratePerSecond = 0;
        if (['room_basement', 'room_attic', 'room_secret'].includes(this.currentMapId)) ratePerSecond -= 3;
        if (this.chaser?.active && this.gameState.isChasing) {
            const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, this.chaser.x, this.chaser.y);
            if (dist < 300) ratePerSecond -= 12;
        }
        if (['room_bedroom_me', 'room_memory'].includes(this.currentMapId)) ratePerSecond = 6;
        this.gameState.sanity = updateBoundedResource(this.gameState.sanity, ratePerSecond, delta, 0, 100);
        window.updateSanityUI?.(this.gameState.sanity, 100);

        // Sanity Effects
        if (this.gameState.sanity < 30) {
            // Audio Hallucinations
            if (Math.random() < 0.01 && this.soundManager) {
                this.soundManager.playSpatialNoise(0.5, this.player.sprite.x + Phaser.Math.Between(-100, 100), this.player.sprite.y + Phaser.Math.Between(-100, 100));
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
         this.gameState.isChasing = false;

         document.getElementById('inventory').style.display = 'none';
         document.getElementById('joystick-zone').style.display = 'none';
         document.getElementById('action-btn').style.display = 'none';

         this.cameras.main.fadeOut(2000, 255, 255, 255);

         this.time.delayedCall(2000, () => {
             // Use the global horror ending effect from index.html
             window.triggerHorrorEnding(() => {
                 const targetMap = getTruthLevel(this.gameState) === 'complete' ? 'memory_crash' : 'room_memory';
                 const targetX = targetMap === 'memory_crash' ? 120 : 320;
                 const targetY = targetMap === 'memory_crash' ? 200 : 400;
                 this.scene.restart({ mapId: targetMap, x: targetX, y: targetY });

                 // Reset UI for memory room (clean state)
                 // We don't reset globalGameState fully yet, as we might want to check flags
             });
         });
    }

    showPostMemoryDialog() {
        if (this.currentMapId !== 'room_corridor') return;
        const flags = this.gameState.storyFlags;
        if (!flags || !flags.memories || !flags.postMemoryDialogShown) return;

        if (flags.memories.school && !flags.postMemoryDialogShown.school) {
            flags.postMemoryDialogShown.school = true;
            this.time.delayedCall(700, () => {
                window.showDialog('主角', '走廊里的照片变了。每一张里的我都低着头，像还站在那块黑板前。');
            });
            return;
        }

        if (flags.memories.hospital && !flags.postMemoryDialogShown.hospital) {
            flags.postMemoryDialogShown.hospital = true;
            this.time.delayedCall(700, () => {
                window.showDialog('主角', '空气里多了一股消毒水味。母亲不是疯了，她只是一直没人救。');
            });
        }
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

        window.showDialog('主角', '糟糕！声音引来了它！', () => {
            if (!this.chaser) {
                this.gameState.storyFlags.chasePhase = 'active';
                this.chaseManager.start();
            }
        });
    }

    toggleHide() {
        // Debounce to prevent accidental double-toggle
        const now = this.time.now;
        if (this.lastHideToggleTime && now - this.lastHideToggleTime < 500) return;
        this.lastHideToggleTime = now;

        if (this.gameState.isHidden) {
            // Exit hiding
            this.gameState.isHidden = false;
            this.chaseManager?.cancelHideEscape();
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

            // Remove global touch listener if exists
            if (this.exitHideListener) {
                document.removeEventListener('touchstart', this.exitHideListener);
                this.exitHideListener = null;
            }

        } else {
            // Enter hiding
            this.gameState.isHidden = true;
            this.chaseManager?.startHideEscape();
            this.player.sprite.setVisible(false);
            this.player.sprite.body.enable = false; // Disable physics immediately
            this.interactText.setVisible(true).setText('按 [空格] / [A] 离开');
            this.interactText.setPosition(this.player.sprite.x, this.player.sprite.y - 60);
            this.cameras.main.zoomTo(1.5, 500);

            // Disable Flashlight
            if (this.player.flashlight) this.player.flashlight.setAlpha(0);
            if (this.player.lightSource) this.player.lightSource.setIntensity(0);

            // Hide UI
            document.getElementById('inventory').style.display = 'none';
            document.getElementById('joystick-zone').style.display = 'none';
            // On mobile, we MUST keep action button visible to allow exiting hide mode
            // Or we could rely on tapping screen? But button is safer.
            if (!this.isMobile) {
                document.getElementById('action-btn').style.display = 'none';
            }

            window.showDialog('主角', '（你屏住了呼吸...）', () => {
                if (this.isMobile) {
                    window.showDialog('系统', '（点击任意位置离开躲藏）', () => {
                        // Dialog closed. Now attach the listener.
                        if (this.gameState.isHidden && !this.exitHideListener) {
                             this.exitHideListener = (e) => {
                                 // Check dialogActive just in case
                                 if (!window.dialogActive) {
                                     this.toggleHide();
                                 }
                             };
                             // Use standard listener (not once: true) so it persists until we toggleHide
                             document.addEventListener('touchstart', this.exitHideListener);
                        }
                    });
                } else if (this.soundManager) {
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
        this.destroyJoystick();
        this.domListeners = new DomListenerRegistry();

        const zone = document.getElementById('joystick-zone');
        const knob = document.getElementById('joystick-knob');
        const actionBtn = document.getElementById('action-btn');

        let startX, startY;
        const maxDist = 35;

        const showUI = () => {
            zone.classList.remove('ui-faded');
            actionBtn.classList.remove('ui-faded');
            if (this.mobileUiTimer) clearTimeout(this.mobileUiTimer);
            this.mobileUiTimer = null;
        };

        const scheduleHideUI = () => {
            if (this.mobileUiTimer) clearTimeout(this.mobileUiTimer);
            this.mobileUiTimer = setTimeout(() => {
                zone.classList.add('ui-faded');
                actionBtn.classList.add('ui-faded');
            }, 2000);
        };

        scheduleHideUI();

        function onTouchStart(e) {
            showUI();
            e.preventDefault();
            const touch = e.touches[0];
            const rect = zone.getBoundingClientRect();
            startX = rect.left + rect.width / 2;
            startY = rect.top + rect.height / 2;
            this.joystick.active = true;
            this.updateJoystick(touch.clientX, touch.clientY, startX, startY, knob, maxDist);
        }

        function onTouchMove(e) {
            showUI();
            e.preventDefault();
            if (!this.joystick.active) return;
            const touch = e.touches[0];
            this.updateJoystick(touch.clientX, touch.clientY, startX, startY, knob, maxDist);
        }

        function onTouchEnd() {
            scheduleHideUI();
            this.joystick.active = false;
            this.joystick.x = 0;
            this.joystick.y = 0;
            knob.style.transform = `translate(-50%, -50%)`;
        }

        const handleAction = (e) => {
            showUI();
            scheduleHideUI();
            e.preventDefault();
            if (window.dialogActive) {
                if (window.currentDialogNextHandler) window.currentDialogNextHandler();
                return;
            }
            if (this.gameState.isHidden) {
                this.toggleHide();
                return;
            }
            if (this.interactText.visible && this.interactionManager) this.interactionManager.handleInteraction();
        };

        function onActionTouchStart(e) {
            handleAction(e);
        }

        function onActionMouseDown(e) {
            handleAction(e);
        }

        const passiveFalse = { passive: false };
        this.domListeners.add(zone, 'touchstart', onTouchStart.bind(this), passiveFalse);
        this.domListeners.add(zone, 'touchmove', onTouchMove.bind(this), passiveFalse);
        this.domListeners.add(zone, 'touchend', onTouchEnd.bind(this));
        this.domListeners.add(zone, 'touchcancel', onTouchEnd.bind(this));
        this.domListeners.add(actionBtn, 'touchstart', onActionTouchStart, passiveFalse);
        this.domListeners.add(actionBtn, 'mousedown', onActionMouseDown);
    }

    destroyJoystick() {
        this.domListeners?.clear();
        this.domListeners = null;
        if (this.mobileUiTimer) clearTimeout(this.mobileUiTimer);
        this.mobileUiTimer = null;
        if (this.exitHideListener) document.removeEventListener('touchstart', this.exitHideListener);
        this.exitHideListener = null;
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
