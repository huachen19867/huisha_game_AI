(function defineThreeInteraction(global) {
    const Huisha3D = global.Huisha3D || (global.Huisha3D = {});

    class ThreeInteraction {
        constructor({ camera, map, prompt, objective, onDialog }) {
            this.camera = camera;
            this.map = map;
            this.prompt = prompt;
            this.objective = objective;
            this.onDialog = onDialog;
            this.current = null;
            this.visited = new Set();
            this.onKeyDown = (event) => {
                if (event.code === 'KeyE' && this.current) {
                    this.investigate(this.current);
                }
            };
            window.addEventListener('keydown', this.onKeyDown);
            this.updateObjective();
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
                const suffix = this.visited.has(nearest.id) ? '（已调查）' : '';
                this.prompt.textContent = `${nearest.label}${suffix}`;
                this.prompt.classList.add('is-visible');
            } else {
                this.prompt.classList.remove('is-visible');
            }
        }

        investigate(item) {
            this.visited.add(item.id);
            this.onDialog(item.title, item.text);
            this.updateObjective();
        }

        updateObjective() {
            if (!this.objective || !this.map.objective) return;

            const flow = this.map.objective;
            const hallComplete = this.hasVisitedAll(flow.hallRequired || []);
            const allComplete = this.hasVisitedAll(flow.completeRequired || []);

            if (allComplete) {
                this.objective.textContent = flow.complete;
                this.objective.classList.add('is-complete');
                return;
            }

            if (hallComplete) {
                this.objective.textContent = flow.hallComplete;
            } else {
                this.objective.textContent = flow.initial;
            }
            this.objective.classList.remove('is-complete');
        }

        hasVisitedAll(ids) {
            return ids.length > 0 && ids.every((id) => this.visited.has(id));
        }

        dispose() {
            window.removeEventListener('keydown', this.onKeyDown);
        }
    }

    Huisha3D.ThreeInteraction = ThreeInteraction;
})(window);
