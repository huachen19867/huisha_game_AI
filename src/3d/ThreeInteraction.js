(function defineThreeInteraction(global) {
    const Huisha3D = global.Huisha3D || (global.Huisha3D = {});

    class ThreeInteraction {
        constructor({ camera, map, prompt, onDialog }) {
            this.camera = camera;
            this.map = map;
            this.prompt = prompt;
            this.onDialog = onDialog;
            this.current = null;
            this.onKeyDown = (event) => {
                if (event.code === 'KeyE' && this.current) {
                    this.onDialog(this.current.title, this.current.text);
                }
            };
            window.addEventListener('keydown', this.onKeyDown);
        }

        update() {
            let nearest = null;
            let nearestDistance = Infinity;
            const cameraPosition = this.camera.position;
            this.map.interactables.forEach((item) => {
                const dx = item.position.x - cameraPosition.x;
                const dz = item.position.z - cameraPosition.z;
                const distance = Math.hypot(dx, dz);
                if (distance < item.radius && distance < nearestDistance) {
                    nearest = item;
                    nearestDistance = distance;
                }
            });

            this.current = nearest;
            if (nearest) {
                this.prompt.textContent = nearest.label;
                this.prompt.classList.add('is-visible');
            } else {
                this.prompt.classList.remove('is-visible');
            }
        }

        dispose() {
            window.removeEventListener('keydown', this.onKeyDown);
        }
    }

    Huisha3D.ThreeInteraction = ThreeInteraction;
})(window);
