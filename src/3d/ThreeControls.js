(function defineThreeControls(global) {
    const Huisha3D = global.Huisha3D || (global.Huisha3D = {});
    const THREE = global.THREE;

    class ThreeControls {
        constructor({ camera, domElement, map }) {
            this.camera = camera;
            this.domElement = domElement;
            this.map = map;
            this.keys = new Set();
            this.pointerDown = false;
            this.yaw = map.playerStart.yaw || Math.PI;
            this.pitch = 0;
            this.speed = 2.8;
            this.lookSpeed = 0.0024;
            this.playerRadius = map.playerRadius || 0.28;
            this.boundHandlers = [];
            this.camera.position.set(map.playerStart.x, map.playerStart.y, map.playerStart.z);
            this.applyLook();
            this.bind();
        }

        bind() {
            const onKeyDown = (event) => this.keys.add(event.code);
            const onKeyUp = (event) => this.keys.delete(event.code);
            const onPointerDown = () => {
                this.pointerDown = true;
                if (this.domElement.requestPointerLock) {
                    this.domElement.requestPointerLock();
                }
            };
            const onPointerUp = () => {
                this.pointerDown = false;
            };
            const onMouseMove = (event) => {
                if (!this.pointerDown && document.pointerLockElement !== this.domElement) return;
                this.yaw -= event.movementX * this.lookSpeed;
                this.pitch -= event.movementY * this.lookSpeed;
                this.pitch = Math.max(-0.82, Math.min(0.82, this.pitch));
                this.applyLook();
            };
            let lastTouch = null;
            const onTouchStart = (event) => {
                const touch = event.touches[0];
                lastTouch = touch ? { x: touch.clientX, y: touch.clientY } : null;
            };
            const onTouchMove = (event) => {
                if (!lastTouch) return;
                const touch = event.touches[0];
                if (!touch) return;
                this.yaw -= (touch.clientX - lastTouch.x) * this.lookSpeed;
                this.pitch -= (touch.clientY - lastTouch.y) * this.lookSpeed;
                this.pitch = Math.max(-0.82, Math.min(0.82, this.pitch));
                lastTouch = { x: touch.clientX, y: touch.clientY };
                this.applyLook();
            };

            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('keyup', onKeyUp);
            this.domElement.addEventListener('pointerdown', onPointerDown);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('mousemove', onMouseMove);
            this.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
            this.domElement.addEventListener('touchmove', onTouchMove, { passive: true });

            this.boundHandlers.push(
                [window, 'keydown', onKeyDown],
                [window, 'keyup', onKeyUp],
                [this.domElement, 'pointerdown', onPointerDown],
                [window, 'pointerup', onPointerUp],
                [window, 'mousemove', onMouseMove],
                [this.domElement, 'touchstart', onTouchStart],
                [this.domElement, 'touchmove', onTouchMove]
            );
        }

        applyLook() {
            const direction = new THREE.Vector3(
                Math.sin(this.yaw) * Math.cos(this.pitch),
                Math.sin(this.pitch),
                Math.cos(this.yaw) * Math.cos(this.pitch)
            );
            this.camera.lookAt(this.camera.position.clone().add(direction));
        }

        update(deltaSeconds) {
            const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
            const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
            const move = new THREE.Vector3();
            if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(forward);
            if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(forward);
            if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
            if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);

            if (move.lengthSq() > 0) {
                move.normalize().multiplyScalar(this.speed * deltaSeconds);
                this.tryMove(move);
            }
            this.camera.position.y = this.map.playerStart.y;
            this.applyLook();
        }

        tryMove(move) {
            const current = this.camera.position;
            const nextX = current.x + move.x;
            const nextZ = current.z + move.z;

            if (this.canOccupy(nextX, nextZ)) {
                current.x = nextX;
                current.z = nextZ;
                return;
            }
            if (this.canOccupy(nextX, current.z)) {
                current.x = nextX;
            }
            if (this.canOccupy(current.x, nextZ)) {
                current.z = nextZ;
            }
        }

        canOccupy(x, z) {
            return this.isWalkable(x, z) && !this.collidesWithObstacle(x, z);
        }

        isWalkable(x, z) {
            const radius = this.playerRadius;
            return this.map.walkable.some((rect) => (
                x >= rect.xMin + radius
                && x <= rect.xMax - radius
                && z >= rect.zMin + radius
                && z <= rect.zMax - radius
            ));
        }

        collidesWithObstacle(x, z) {
            const radius = this.playerRadius;
            return (this.map.obstacles || []).some((rect) => {
                const nearestX = Math.max(rect.xMin, Math.min(x, rect.xMax));
                const nearestZ = Math.max(rect.zMin, Math.min(z, rect.zMax));
                const dx = x - nearestX;
                const dz = z - nearestZ;
                return dx * dx + dz * dz < radius * radius;
            });
        }

        dispose() {
            this.boundHandlers.forEach(([target, event, handler]) => {
                target.removeEventListener(event, handler);
            });
            this.boundHandlers = [];
        }
    }

    Huisha3D.ThreeControls = ThreeControls;
})(window);
