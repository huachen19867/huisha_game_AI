(function defineThreePrototypeScene(global) {
    const Huisha3D = global.Huisha3D || (global.Huisha3D = {});
    const THREE = global.THREE;

    class ThreePrototypeScene {
        constructor({ root, prompt, onDialog }) {
            this.root = root;
            this.prompt = prompt;
            this.onDialog = onDialog;
            this.map = Huisha3D.MAIN_HALL_MAP;
            this.clock = new THREE.Clock();
            this.animationId = null;
        }

        start() {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x050403);
            this.scene.fog = new THREE.FogExp2(0x050403, 0.075);

            this.camera = new THREE.PerspectiveCamera(68, this.root.clientWidth / this.root.clientHeight, 0.1, 80);
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: 'high-performance',
                preserveDrawingBuffer: true
            });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
            this.renderer.setSize(this.root.clientWidth, this.root.clientHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.root.appendChild(this.renderer.domElement);

            this.createLights();
            this.createArchitecture();
            this.createProps();

            this.controls = new Huisha3D.ThreeControls({
                camera: this.camera,
                domElement: this.renderer.domElement,
                map: this.map
            });
            this.interaction = new Huisha3D.ThreeInteraction({
                camera: this.camera,
                map: this.map,
                prompt: this.prompt,
                onDialog: this.onDialog
            });

            this.onResize = () => this.resize();
            window.addEventListener('resize', this.onResize);
            this.animate();
        }

        createLights() {
            const ambient = new THREE.HemisphereLight(0x5d5544, 0x100806, 0.9);
            this.scene.add(ambient);

            const candleLight = new THREE.PointLight(0xff8a3d, 2.2, 8, 1.7);
            candleLight.position.set(0, 1.45, -2.65);
            candleLight.castShadow = true;
            this.scene.add(candleLight);

            this.flashlight = new THREE.SpotLight(0xf2dfb2, 4.4, 10, Math.PI / 7.5, 0.52, 1.3);
            this.flashlight.castShadow = true;
            this.flashlightTarget = new THREE.Object3D();
            this.scene.add(this.flashlight);
            this.scene.add(this.flashlightTarget);
            this.flashlight.target = this.flashlightTarget;
        }

        createArchitecture() {
            const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.92, metalness: 0.02 });
            const wallMat = new THREE.MeshStandardMaterial({ color: 0x17110d, roughness: 0.98 });
            const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a1f14, roughness: 0.9 });

            this.addBox('main-floor', [10.4, 0.14, 8.6], [0, -0.08, 0], floorMat, true);
            this.addBox('corridor-floor', [2.65, 0.12, 8.4], [0, -0.07, -7.45], floorMat, true);
            this.addBox('main-ceiling', [10.4, 0.16, 8.6], [0, 3.2, 0], wallMat, false);
            this.addBox('corridor-ceiling', [2.65, 0.14, 8.4], [0, 3.05, -7.45], wallMat, false);

            this.addBox('back-wall-left', [4.05, 3.2, 0.3], [-3.17, 1.55, -4.18], wallMat, true);
            this.addBox('back-wall-right', [4.05, 3.2, 0.3], [3.17, 1.55, -4.18], wallMat, true);
            this.addBox('front-wall', [10.2, 3.2, 0.3], [0, 1.55, 4.35], wallMat, true);
            this.addBox('left-wall', [0.3, 3.2, 8.6], [-5.15, 1.55, 0], wallMat, true);
            this.addBox('right-wall', [0.3, 3.2, 8.6], [5.15, 1.55, 0], wallMat, true);
            this.addBox('corridor-left-wall', [0.28, 3.05, 8.4], [-1.45, 1.5, -7.45], wallMat, true);
            this.addBox('corridor-right-wall', [0.28, 3.05, 8.4], [1.45, 1.5, -7.45], wallMat, true);
            this.addBox('corridor-end', [2.65, 3.05, 0.32], [0, 1.5, -11.75], wallMat, true);

            for (let i = 0; i < 9; i += 1) {
                const z = 3.4 - i * 0.86;
                this.addBox(`floor-plank-${i}`, [10.2, 0.025, 0.035], [0, 0.01, z], woodMat, false);
            }
        }

        createProps() {
            const altarMat = new THREE.MeshStandardMaterial({ color: 0x4b2517, roughness: 0.86 });
            const coffinMat = new THREE.MeshStandardMaterial({ color: 0x090706, roughness: 0.78 });
            const redMat = new THREE.MeshStandardMaterial({ color: 0x8b1717, roughness: 0.7 });
            const paperMat = new THREE.MeshStandardMaterial({ color: 0xd8c17e, roughness: 0.95 });
            const clothMat = new THREE.MeshStandardMaterial({ color: 0x010101, roughness: 1 });

            this.addBox('altar', [2.4, 0.9, 0.74], [0, 0.46, -3.12], altarMat, true);
            this.addBox('altar-top', [2.7, 0.12, 0.94], [0, 0.98, -3.12], altarMat, true);
            this.addBox('black-frame', [1.25, 0.84, 0.08], [0, 1.93, -4.0], clothMat, false);
            this.addBox('incense-burner', [0.42, 0.16, 0.28], [0, 1.12, -2.78], redMat, false);

            const coffin = this.addBox('coffin', [2.4, 0.62, 1.18], [0, 0.36, 0.78], coffinMat, true);
            coffin.rotation.y = 0.02;
            this.addBox('coffin-lid', [2.55, 0.14, 1.28], [0, 0.76, 0.78], coffinMat, true);
            for (let i = -1; i <= 1; i += 1) {
                this.addBox(`coffin-red-thread-${i + 2}`, [2.7, 0.035, 0.035], [0, 0.86, 0.78 + i * 0.34], redMat, false);
            }

            for (let i = 0; i < 10; i += 1) {
                const x = i % 2 === 0 ? -4.95 : 4.95;
                const z = -3.2 + Math.floor(i / 2) * 1.5;
                const talisman = this.addBox(`talisman-${i}`, [0.04, 0.48, 0.22], [x, 1.75, z], paperMat, false);
                talisman.rotation.z = (i % 3 - 1) * 0.12;
            }

            const chairMat = new THREE.MeshStandardMaterial({ color: 0x2b1710, roughness: 0.92 });
            this.addChair(-3.2, 1.0, chairMat);
            this.addChair(3.2, 1.0, chairMat);
            this.addChair(-3.2, -1.1, chairMat);
            this.addChair(3.2, -1.1, chairMat);
        }

        addChair(x, z, mat) {
            this.addBox(`chair-seat-${x}-${z}`, [0.65, 0.12, 0.62], [x, 0.45, z], mat, true);
            this.addBox(`chair-back-${x}-${z}`, [0.65, 0.82, 0.1], [x, 0.86, z - 0.31], mat, true);
            this.addBox(`chair-leg-a-${x}-${z}`, [0.08, 0.45, 0.08], [x - 0.24, 0.22, z - 0.2], mat, true);
            this.addBox(`chair-leg-b-${x}-${z}`, [0.08, 0.45, 0.08], [x + 0.24, 0.22, z + 0.2], mat, true);
        }

        addBox(name, size, position, material, castShadow) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
            mesh.name = name;
            mesh.position.set(position[0], position[1], position[2]);
            mesh.castShadow = !!castShadow;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        }

        updateFlashlight() {
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            this.flashlight.position.copy(this.camera.position);
            this.flashlightTarget.position.copy(this.camera.position).add(direction.multiplyScalar(5));
        }

        animate() {
            this.animationId = requestAnimationFrame(() => this.animate());
            const delta = Math.min(this.clock.getDelta(), 0.05);
            this.controls.update(delta);
            this.interaction.update();
            this.updateFlashlight();
            this.renderer.render(this.scene, this.camera);
        }

        resize() {
            if (!this.renderer || !this.camera) return;
            this.camera.aspect = this.root.clientWidth / this.root.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.root.clientWidth, this.root.clientHeight);
        }

        dispose() {
            if (this.animationId) cancelAnimationFrame(this.animationId);
            if (this.controls) this.controls.dispose();
            if (this.interaction) this.interaction.dispose();
            window.removeEventListener('resize', this.onResize);
            if (this.renderer) {
                this.renderer.dispose();
                this.renderer.domElement.remove();
            }
        }
    }

    Huisha3D.ThreePrototypeScene = ThreePrototypeScene;
})(window);
