import { Player } from '../entities/Player.js';
import { Maps } from '../data/Maps.js';
import { InteractionManager } from '../systems/InteractionManager.js';
import { EventManager } from '../systems/EventManager.js';
import { MapManager } from '../systems/MapManager.js';
import { SoundManager } from '../systems/SoundManager.js';
import { createDefaultGameState, getTruthLevel, normalizeGameState } from '../systems/StoryState.js';
import { InvestigationUI } from '../systems/InvestigationUI.js';
import { ensureInvestigation, saveCheckpoint, recoverFromCapture } from '../systems/Investigation.js';
import { ManorPresentation } from '../systems/ManorPresentation.js';
import { visitRoom } from '../systems/Exploration.js';
import { isPursuitSpace, choosePursuerSpawn, advanceWarning, sanityRate } from '../systems/HorrorPacing.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data = {}) {
        this.currentMapId = data.mapId || 'room_prologue';
        this.playerStartX = data.x || null;
        this.playerStartY = data.y || null;
        this.previousMapId = data.previousMapId || null;
        this.returnedAfterCapture = !!data.returnedAfterCapture;

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
        this.isManipulating = false;

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
        this.pursuitWarningMs = 0;
        this.pursuitRetryMs = 0;
        this.pursuitStepMs = 0;
        this.micLoudMs = 0;

        this.safe = null; // New Safe Object
        this.wet_paper = null; // New Clue Object
        this.red_key = null; // New Item Object
        this.incense = null;
        this.spirit_money = null;
        this.toy_plane = null; // Reset plane ref
        this.npc = null; // Reset npc ref

        this.soundManager = this.game.soundManager;

        // Lazy initialize sound manager if missing (e.g. direct load)
        if (!this.soundManager) {
            this.game.soundManager = new SoundManager(this);
            this.soundManager = this.game.soundManager;
        }
        this.soundManager.scene = this;

        const ua = navigator.userAgent || '';
        this.isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

        // Global Game State
        if (!window.globalGameState) {
            window.globalGameState = createDefaultGameState();
        }
        this.gameState = normalizeGameState(window.globalGameState);
        ensureInvestigation(this.gameState);
        visitRoom(this.gameState, this.currentMapId, this.previousMapId);
        this.gameState.isHidden = false;
        this.captureTriggered = false;
        this.lastHideToggleTime = 0;
        this.hiddenAt = 0;
        this.checkpointState = JSON.parse(JSON.stringify(this.gameState));
        document.getElementById('inv-slots').replaceChildren();
        const ownedItems = new Set(this.gameState.inventory);
        [['hasRice', '倒头饭'], ['hasMatches', '火柴'], ['hasIncense', '香'], ['hasSpiritMoney', '纸钱'], ['hasRedKey', '血红钥匙']].forEach(([flag, name]) => {
            if (this.gameState[flag]) ownedItems.add(name);
        });
        ownedItems.forEach(item => window.updateInventory(item));

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
        this.mapManager.restorePlayerStart(this.player.sprite);
        this.safeStart = { x: this.player.sprite.x, y: this.player.sprite.y };
        this.presentation = new ManorPresentation(this, mapData);

        // Colliders
        this.physics.add.collider(this.player.sprite, this.walls);
        this.physics.add.collider(this.player.sprite, this.furniture);
        if (this.trees) this.physics.add.collider(this.player.sprite, this.trees);

        // Show Room Name Notification
        if (mapData.name) {
            this.showRoomTitle(mapData.name);
        }

        // Spawn Chaser if active (Persist chase across scenes)
        if (this.gameState.isChasing && isPursuitSpace(this.currentMapId)) {
            this.spawnChaser();
        }

        // Camera
        this.cameras.main.startFollow(this.player.sprite, true, 0.09, 0.09);
        this.cameras.main.setZoom(1.2);
        this.cameras.main.fadeIn(500, 0, 0, 0);

        // Lights & Atmosphere
        if (!this.isMobile) {
            this.lights.enable();
            this.lights.setAmbientColor(mapData.visual?.ambient ?? 0x9a9b92);
        }

        this.rainParticles = this.add.particles(0, 0, 'rain', {
            x: { min: 0, max: 800 },
            y: -10,
            quantity: this.isMobile ? 0 : 2,
            lifespan: 1000,
            speedY: { min: 400, max: 600 },
            speedX: { min: -20, max: 20 },
            scale: { start: 1, end: 1 },
            alpha: { start: 0.5, end: 0 },
            blendMode: 'ADD'
        });
        this.rainParticles.setDepth(200);
        this.rainParticles.setScrollFactor(0);
        if (!['room_prologue', 'room_backyard', 'room_entrance', 'memory_crash'].includes(this.currentMapId)) {
            this.rainParticles.stop();
            this.rainParticles.setVisible(false);
        }

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
        this.micIndicator = this.add.text(400, 150, '屏息 · 保持安静', {
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

        // Initialize Systems
        this.eventManager = new EventManager(this);
        this.interactionManager = new InteractionManager(this);

        // UI Text
        this.interactText = this.add.text(0, 0, '按 [空格] / [A] 调查', {
            fontSize: '16px',
            color: '#fff',
            backgroundColor: '#000'
        }).setOrigin(0.5).setVisible(false).setDepth(400);
        this.investigationUI = new InvestigationUI(this);
        this.events.once('shutdown', () => {
            if (this.exitHideListener) document.removeEventListener('touchstart', this.exitHideListener);
            this.soundManager?.stopMic();
        });
        saveCheckpoint(this.gameState, this.currentMapId, startX, startY);
        if (this.returnedAfterCapture) this.showHint('手记和判断保留，物品与现场按入房时恢复。脚步已经远去。');

        // Opening observations live on the letter, car and doorpost. Arriving
        // never schedules a dialogue that could interrupt an investigation.

    }

    update(time, delta = 16.67) {
        if (window.dialogActive || this.isSwitching || this.isManipulating) {
            this.interactionManager?.clearTarget();
            this.player.sprite.setVelocity(0);
            this.physics.pause();
            return;
        }
        this.physics.resume();
        this.eventManager.update(delta);

        // Update Chaser AI per frame for smoother movement
        this.updateChaser(delta);

        // Hiding Logic
        if (this.gameState.isHidden) {
            this.interactionManager?.clearTarget();
            this.interactText.setVisible(true).setText('[E / 空格] 离开躲藏');
            this.interactText.setPosition(this.player.sprite.x, this.player.sprite.y - 60);
            this.hiddenElapsed = (this.hiddenElapsed || 0) + Math.min(delta, 50);
            if (this.gameState.isChasing && this.hiddenElapsed >= 6000) {
                this.gameState.isChasing = false;
                this.chaser?.destroy();
                this.chaser = null;
                this.chaserAura?.destroy();
                this.chaserAura = null;
                this.showHint('脚步停了。现在可以按 E 离开。');
            }
            // Prevent exiting hide mode immediately after closing a dialog
            if (window.dialogActive) return;

            // Mic Check Logic
            if (this.gameState.isChasing && this.soundManager && this.soundManager.micStream) {
                const vol = this.soundManager.getMicVolume();
                // Threshold logic:
                // Quiet room is usually ~10-20. Speaking is ~50+.
                // Let's set threshold to 40.
                if (vol > 40) {
                    this.micIndicator.setText('声音太大 · 它听见了');
                    this.micIndicator.setColor('#ff0000');

                    this.micLoudMs += Math.min(delta, 50);
                    if (this.micLoudMs >= 1000) { this.micLoudMs = 0; this.triggerFoundByMic(); return; }
                } else {
                    this.micIndicator.setText('屏息 · 保持安静');
                    this.micIndicator.setColor('#ffffff');
                    this.micLoudMs = 0;
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
        if (window.dialogActive || this.isSwitching) return;

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
                        window.showDialog('李明', door.targetMap === 'room_entrance' ? '门闩从里面卡死了。供桌旁的纸条说：灯亮以后，生人可以离门。' : '门锁住了。钥匙应该在父母卧室的保险箱里。');
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
    }

    updateSanity(delta = 16.67) {
        const distance = this.chaser?.active ? Math.hypot(this.chaser.x - this.player.sprite.x, this.chaser.y - this.player.sprite.y) : Infinity;
        const drainRate = sanityRate(this.currentMapId, this.gameState.isChasing, distance);
        this.gameState.sanity -= drainRate * Math.min(delta, 50) / 1000;
        this.gameState.sanity = Phaser.Math.Clamp(this.gameState.sanity, 0, 100);
        window.updateSanityUI?.(this.gameState.sanity, 100);
    }

    spawnChaser() {
        if (this.chaser || !this.gameState.isChasing || !isPursuitSpace(this.currentMapId)) return;
        const map = Maps[this.currentMapId];
        const door = map.objects.doors?.find(door => door.targetMap === this.previousMapId);
        const preferred = door ? { x: (door.x + (door.w || 1) / 2) * 32, y: (door.y + (door.h || 1) / 2) * 32 } : null;
        const point = choosePursuerSpawn(map, this.player.sprite, (x, y) => this.isChaseCellOpen(x, y), preferred);
        if (!point) { this.pursuitRetryMs = 500; return; }
        this.chaser = this.physics.add.sprite(point.x, point.y, 'pursuer_shadow');
        if (!this.isMobile) this.chaser.setPipeline('Light2D');
        this.chaser.body.setSize(18, 18).setOffset(7, 27);
        this.chaser.setDepth(20 + this.chaser.y / 1000);
        this.chaser.setAlpha(0.35);
        this.chaser.body.enable = false;
        this.pursuitWarningMs = 1800;
        this.pursuitStepMs = 0;
        this.soundManager?.playFootstep(point.x, point.y, 0.65);

        // Dark Aura Particles (Evil Spirit Effect)
        if (!this.isMobile) {
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
        }

        // Add collision with walls and static objects
        this.physics.add.collider(this.chaser, this.walls);
        this.physics.add.collider(this.chaser, this.furniture);
        if (this.trees) this.physics.add.collider(this.chaser, this.trees);
        // Explicitly add collision with coffin if it exists (it's in furniture group, but double check)
        if (this.coffin) this.physics.add.collider(this.chaser, this.coffin);

        this.physics.add.overlap(this.player.sprite, this.chaser, () => {
            if (!this.gameState.isHidden && !window.dialogActive && !this.isSwitching && !this.captureTriggered && this.pursuitWarningMs <= 0) {
                this.captureTriggered = true;
                // Game Over Logic
                this.physics.pause();
                this.chaser.body.setVelocity(0);
                window.showDialog('暴怒的黑影', '抓到你了...乖儿子，哪也不许去。我们要永远在一起...永远不分开。', () => {
                     window.globalGameState = recoverFromCapture(this.checkpointState, this.gameState);
                     saveCheckpoint(window.globalGameState, this.currentMapId, this.safeStart.x, this.safeStart.y);
                     this.scene.restart({ mapId: this.currentMapId, x: this.safeStart.x, y: this.safeStart.y, returnedAfterCapture: true });
                });
            }
        });
    }

    updateChaser(delta = 16.67) {
        if (window.dialogActive || this.isSwitching || !isPursuitSpace(this.currentMapId)) return;
        if (this.gameState.isChasing && !this.chaser) {
            this.pursuitRetryMs = advanceWarning(this.pursuitRetryMs || 0, delta);
            if (this.pursuitRetryMs <= 0) this.spawnChaser();
        }

        // Reset danger effect if no chaser
        if (!this.chaser || !this.chaser.active || !this.gameState.isChasing) {
            if (this.dangerOverlay) this.dangerOverlay.setAlpha(0);
            return;
        }
        this.pursuitStepMs += Math.min(delta, 50);
        if (this.pursuitWarningMs > 0) {
            this.pursuitWarningMs = advanceWarning(this.pursuitWarningMs, delta);
            this.chaser.body.setVelocity(0);
            if (this.pursuitStepMs >= 650) { this.soundManager?.playFootstep(this.chaser.x, this.chaser.y, 0.65); this.pursuitStepMs = 0; }
            if (this.pursuitWarningMs > 0) return;
            this.chaser.body.enable = true;
            this.chaser.setAlpha(0.85);
        }
        if (!this.chaser.body.enable) return;
        this.chaser.setDepth(20 + this.chaser.y / 1000);
        if (this.pursuitStepMs >= (this.gameState.isHidden ? 850 : 600)) {
            this.soundManager?.playFootstep(this.chaser.x, this.chaser.y, 0.65);
            this.pursuitStepMs = 0;
        }

        // Calculate distance for effects
        const dist = Phaser.Math.Distance.Between(this.chaser.x, this.chaser.y, this.player.sprite.x, this.player.sprite.y);

        // Dynamic Horror Effects
        if (dist < 500) { // Increased range
            // Visual: Red pulse scaling with distance
            const intensity = 1 - (dist / 500);
            this.dangerOverlay.setAlpha(Math.max(0, intensity * 0.18 + Math.sin(this.time.now / 220) * 0.03));

            // Audio: Heartbeat
            // Frequency increases with proximity (1000ms down to 400ms)
            const beatInterval = 300 + (dist / 500) * 500;
            if (this.time.now > (this.nextHeartbeat || 0)) {
                if (this.soundManager) this.soundManager.playHeartbeat(intensity * 0.35);
                this.nextHeartbeat = this.time.now + beatInterval;
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
                const waypoint = this.getChaseWaypoint();
                this.physics.moveTo(this.chaser, waypoint.x, waypoint.y, speed);
                this.chaser.nextDecisionTime = now + 200;
            }
        }
    }

    isChaseCellOpen(x, y) {
        const map = Maps[this.currentMapId];
        if (map.data[y]?.[x] !== 0) return false;
        const cx = x * 32 + 16, cy = y * 32 + 16;
        return ![...this.furniture.getChildren(), ...(this.trees?.getChildren() || [])].some(item => {
            const body = item.body;
            return body?.enable && cx > body.x - 8 && cx < body.x + body.width + 8 && cy > body.y - 8 && cy < body.y + body.height + 8;
        });
    }

    getChaseWaypoint() {
        const start = [Math.floor(this.chaser.x / 32), Math.floor(this.chaser.y / 32)];
        const goal = [Math.floor(this.player.sprite.x / 32), Math.floor(this.player.sprite.y / 32)];
        const key = (x, y) => `${x},${y}`;
        const queue = [{ x: start[0], y: start[1], first: null }];
        const visited = new Set([key(...start)]);
        for (let i = 0; i < queue.length; i++) {
            const current = queue[i];
            if (current.x === goal[0] && current.y === goal[1]) {
                const next = current.first;
                return next ? { x: next.x * 32 + 16, y: next.y * 32 + 16 } : this.player.sprite;
            }
            for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
                const x = current.x + dx, y = current.y + dy;
                if (visited.has(key(x, y)) || !this.isChaseCellOpen(x, y)) continue;
                visited.add(key(x, y));
                queue.push({ x, y, first: current.first || { x, y } });
            }
        }
        return this.player.sprite;
    }

    switchScene(mapId, targetX, targetY) {
        if (this.isSwitching || this.isManipulating) return;
        this.isSwitching = true;
        saveCheckpoint(this.gameState, mapId, targetX, targetY);

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
         this.gameState.isChasing = false;

         window.showDialog('李明', '棺材里没有父亲，只有一件旧校服。领口缝着我的名字。雨声从木板下面传来——我得回到事故发生的地方。', () => {
             this.switchScene('memory_crash', 120, 200);
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
        if (type === 'diary') { this.playSound(260, 'sine', 0.12); return; }
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
                this.gameState.isChasing = true;
                this.spawnChaser();
            }

            // Teleport chaser nearby
            if (this.chaser) {
                this.chaser.nextDecisionTime = 0;
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
            this.player.sprite.setVisible(true);
            this.player.sprite.body.enable = true;
            this.interactText.setText('[E / 空格] 调查');
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
            if (this.micTooLoudTimer) { this.micTooLoudTimer.remove(); this.micTooLoudTimer = null; }

            // Remove global touch listener if exists
            if (this.exitHideListener) {
                document.removeEventListener('touchstart', this.exitHideListener);
                this.exitHideListener = null;
            }

        } else {
            // Enter hiding
            this.gameState.isHidden = true;
            this.hiddenAt = this.time.now;
            this.hiddenElapsed = 0;
            this.micLoudMs = 0;
            this.player.sprite.setVisible(false);
            this.player.sprite.body.enable = false; // Disable physics immediately
            this.interactText.setVisible(true).setText('[E / 空格] 离开躲藏');
            this.interactText.setPosition(this.player.sprite.x, this.player.sprite.y - 60);
            this.cameras.main.zoomTo(1.5, 500);

            // Disable Flashlight
            if (this.player.flashlight) this.player.flashlight.setAlpha(0);
            if (this.player.lightSource) this.player.lightSource.setIntensity(0);
            this.micIndicator.setVisible(!!this.soundManager.micStream);

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
            // On mobile, we MUST keep action button visible to allow exiting hide mode
            // Or we could rely on tapping screen? But button is safer.
            if (!this.isMobile) {
                document.getElementById('action-btn').style.display = 'none';
            }

            window.showDialog('李明', '藏好了。等脚步远去，再按 E 或右侧调查按钮离开。');
        }
    }

    initJoystick() {
        // DOM controls survive scene restarts: replace the controls to release old listeners.
        ['joystick-zone', 'action-btn'].forEach(id => {
            const old = document.getElementById(id);
            old.replaceWith(old.cloneNode(true));
        });
        const zone = document.getElementById('joystick-zone');
        const knob = document.getElementById('joystick-knob');
        const actionBtn = document.getElementById('action-btn');

        let startX, startY;
        const maxDist = 35;
        let uiTimer = null;
        this.events.once('shutdown', () => { if (uiTimer) clearTimeout(uiTimer); });

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
            if (this.gameState.isHidden) {
                this.toggleHide();
                return;
            }
            if (this.interactText.visible && this.interactionManager) this.interactionManager.handleInteraction();
        }, { passive: false });

        actionBtn.addEventListener('mousedown', (e) => {
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
