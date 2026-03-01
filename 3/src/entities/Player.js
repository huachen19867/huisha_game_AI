export class Player {
    constructor(scene, x, y) {
        this.scene = scene;
        this.sprite = scene.physics.add.sprite(x, y, 'player_sheet', 0);
        this.sprite.setCollideWorldBounds(true);
        this.sprite.setPipeline('Light2D');
        
        // Make collision body smaller for easier movement through doors
        this.sprite.body.setSize(20, 20);
        this.sprite.body.setOffset(6, 12);
        
        this.initAnims();
        this.initFlashlight();
        
        this.speed = 150;
        this.runSpeed = 250;
        this.lastStepTime = 0;
        
        // Stamina System
        this.maxStamina = 100;
        this.stamina = 100;
        this.isRunning = false;
        this.staminaRechargeRate = 0.5;
        this.staminaDrainRate = 1;
        this.exhausted = false; // If true, cannot run until stamina > 20

        // Input
        this.keyShift = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }

    initAnims() {
        const anims = this.scene.anims;
        if (!anims.exists('walk-down')) {
            anims.create({
                key: 'walk-down',
                frames: [
                    { key: 'player_sheet', frame: 0 },
                    { key: 'player_sheet', frame: 1 },
                    { key: 'player_sheet', frame: 2 }
                ],
                frameRate: 10,
                repeat: -1
            });
            anims.create({
                key: 'walk-left',
                frames: [
                    { key: 'player_sheet', frame: 3 },
                    { key: 'player_sheet', frame: 4 },
                    { key: 'player_sheet', frame: 5 }
                ],
                frameRate: 10,
                repeat: -1
            });
            anims.create({
                key: 'walk-right',
                frames: [
                    { key: 'player_sheet', frame: 6 },
                    { key: 'player_sheet', frame: 7 },
                    { key: 'player_sheet', frame: 8 }
                ],
                frameRate: 10,
                repeat: -1
            });
            anims.create({
                key: 'walk-up',
                frames: [
                    { key: 'player_sheet', frame: 9 },
                    { key: 'player_sheet', frame: 10 },
                    { key: 'player_sheet', frame: 11 }
                ],
                frameRate: 10,
                repeat: -1
            });
        }
    }

    initFlashlight() {
        this.flashlight = this.scene.add.image(this.sprite.x, this.sprite.y, 'flashlight_cone');
        this.flashlight.setOrigin(0.5, 0);
        this.flashlight.setAlpha(0.6);
        this.flashlight.setBlendMode(Phaser.BlendModes.ADD);
        this.flashlight.setDepth(99);
        
        this.lightSource = this.scene.lights.addLight(this.sprite.x, this.sprite.y, 140).setIntensity(1.2);
        this.flickerTimer = 0;
    }

    update(cursors, wasd, joystick, soundManager) {
        this.sprite.setVelocity(0);

        // Stamina Logic
        if (this.keyShift.isDown && !this.exhausted && (this.sprite.body.velocity.x !== 0 || this.sprite.body.velocity.y !== 0)) {
            this.isRunning = true;
            this.stamina -= this.staminaDrainRate;
            if (this.stamina <= 0) {
                this.stamina = 0;
                this.exhausted = true;
                this.isRunning = false;
            }
        } else {
            this.isRunning = false;
            if (this.stamina < this.maxStamina) {
                this.stamina += this.staminaRechargeRate;
                if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
            }
            if (this.exhausted && this.stamina > 30) {
                this.exhausted = false;
            }
        }

        // Update UI
        if (window.updateStaminaUI) {
            window.updateStaminaUI(this.stamina, this.maxStamina);
        }

        // Flashlight Flicker Logic
        // DISABLED as per user request ("不要突然把环境变黑")
        /*
        this.flickerTimer++;
        // Use a threshold that doesn't change every frame to avoid weird probability distributions
        if (!this.nextFlickerTime) this.nextFlickerTime = 300 + Math.random() * 300;
        
        if (this.flickerTimer > this.nextFlickerTime) {
            this.flickerTimer = 0;
            this.nextFlickerTime = 300 + Math.random() * 300;
            
            // Flicker Image
            this.scene.tweens.add({
                targets: this.flashlight,
                alpha: { from: 0.2, to: 0.6 },
                duration: 50,
                yoyo: true,
                repeat: 3
            });
            // Flicker Light
            this.scene.tweens.add({
                targets: this.lightSource,
                intensity: { from: 0.5, to: 1.2 },
                duration: 50,
                yoyo: true,
                repeat: 3
            });
        }
        */

        let moveX = 0;
        let moveY = 0;

        // Keyboard Input
        if (cursors.left.isDown || wasd.left.isDown) moveX = -1;
        else if (cursors.right.isDown || wasd.right.isDown) moveX = 1;

        if (cursors.up.isDown || wasd.up.isDown) moveY = -1;
        else if (cursors.down.isDown || wasd.down.isDown) moveY = 1;

        // Joystick Input
        if (joystick.active) {
            if (Math.abs(joystick.x) > 0.1) moveX = joystick.x;
            if (Math.abs(joystick.y) > 0.1) moveY = joystick.y;
        }

        if (moveX !== 0 || moveY !== 0) {
            // Normalize
            if (!joystick.active && moveX !== 0 && moveY !== 0) {
                const len = Math.sqrt(moveX * moveX + moveY * moveY);
                moveX /= len;
                moveY /= len;
            }
            
            const currentSpeed = this.isRunning ? this.runSpeed : this.speed;
            this.sprite.setVelocityX(moveX * currentSpeed);
            this.sprite.setVelocityY(moveY * currentSpeed);
            
            // Sound
            const now = this.scene.time.now;
            // Faster steps when running
            const stepInterval = this.isRunning ? 250 : 400;
            
            if (now - this.lastStepTime > stepInterval && soundManager) {
                if (soundManager.playFootstep) {
                    soundManager.playFootstep();
                } else {
                    soundManager.playNoise(0.08); // Fallback
                }
                this.lastStepTime = now;
            }
            
            // Anims
            const animSpeed = this.isRunning ? 20 : 10; // Faster anims
            // Update anim speed if already playing? 
            // Phaser anims speed is set at creation. We might need to adjust timeScale or just accept it.
            // Simple way: check current anim and set timeScale
            if (this.sprite.anims.currentAnim) {
                this.sprite.anims.msPerFrame = this.isRunning ? 50 : 100;
            }

            if (Math.abs(moveX) > Math.abs(moveY)) {
                if (moveX > 0) this.sprite.anims.play('walk-right', true);
                else this.sprite.anims.play('walk-left', true);
            } else {
                if (moveY > 0) this.sprite.anims.play('walk-down', true);
                else this.sprite.anims.play('walk-up', true);
            }

            // Flashlight Rotation with Inertia (Lerp)
            const targetAngle = Math.atan2(moveY, moveX) - Math.PI / 2;
            // Interpolate current rotation to target rotation
            // 0.15 was old direct speed. Let's make it smoother/laggy.
            // Using Phaser.Math.Angle.RotateTo is good, but let's make it slower for inertia effect
            const lerpFactor = 0.08; // Lower = more lag/weight
            this.flashlight.rotation = Phaser.Math.Angle.RotateTo(this.flashlight.rotation, targetAngle, lerpFactor);
            
            // Walking Sway Effect (Tween)
            if (!this.swayTween) {
                this.swayTween = this.scene.tweens.add({
                    targets: this.sprite,
                    angle: { from: -5, to: 5 },
                    duration: this.isRunning ? 100 : 200, // Faster sway when running
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            } else if (!this.swayTween.isPlaying()) {
                this.swayTween.restart();
            }
            // Update sway duration if running state changed
            if (this.swayTween.isPlaying()) {
                this.swayTween.updateTo('duration', this.isRunning ? 100 : 200);
            }

        } else {
            this.sprite.anims.stop();
            
            // Stop Sway
            if (this.swayTween && this.swayTween.isPlaying()) {
                this.swayTween.stop();
                this.sprite.setAngle(0);
            } else {
                // Ensure angle is reset even if tween wasn't running (e.g. just stopped)
                this.sprite.setAngle(0);
            }
        }

        // Sync Light Position
        this.flashlight.x = this.sprite.x;
        this.flashlight.y = this.sprite.y;
        this.lightSource.x = this.sprite.x;
        this.lightSource.y = this.sprite.y;
    }
}