(function defineThreePrototypeScene(global) {
    const Huisha3D = global.Huisha3D || (global.Huisha3D = {});
    const THREE = global.THREE;
    const ART_TEXTURES = {
        wall: '美术/木墙.png',
        floor: '美术/木地板.png',
        beam: '美术/木梁.png',
        altarBackdrop: '美术/供桌区域.png',
        corridorDetail: '美术/走廊墙面.png',
        floorDebris: '美术/纸钱与香灰.png'
    };

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
            this.scene.background = new THREE.Color(0x0f0a07);
            this.scene.fog = new THREE.FogExp2(0x0f0a07, 0.045);

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
            if (THREE.SRGBColorSpace) {
                this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            }
            if (THREE.ACESFilmicToneMapping) {
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            }
            this.renderer.toneMappingExposure = 1.68;
            this.root.appendChild(this.renderer.domElement);
            this.textures = this.loadArtTextures();
            this.materials = this.createMaterials();

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

        loadArtTextures() {
            const loader = new THREE.TextureLoader();
            const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
            const load = (path, options = {}) => {
                const texture = loader.load(path);
                if (THREE.SRGBColorSpace) {
                    texture.colorSpace = THREE.SRGBColorSpace;
                }
                if (options.repeat) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(options.repeat[0], options.repeat[1]);
                }
                texture.anisotropy = Math.min(maxAnisotropy, 8);
                return texture;
            };

            return {
                wall: load(ART_TEXTURES.wall, { repeat: [2.2, 1.05] }),
                floor: load(ART_TEXTURES.floor, { repeat: [2.8, 2.25] }),
                beam: load(ART_TEXTURES.beam, { repeat: [1.2, 1.2] }),
                altarBackdrop: load(ART_TEXTURES.altarBackdrop),
                corridorDetail: load(ART_TEXTURES.corridorDetail),
                floorDebris: load(ART_TEXTURES.floorDebris)
            };
        }

        createMaterials() {
            return {
                floor: new THREE.MeshStandardMaterial({
                    color: 0xc8aa82,
                    map: this.textures.floor,
                    roughness: 0.82,
                    metalness: 0.02
                }),
                wall: new THREE.MeshStandardMaterial({
                    color: 0x9a8061,
                    map: this.textures.wall,
                    roughness: 0.96,
                    metalness: 0.01
                }),
                ceiling: new THREE.MeshStandardMaterial({
                    color: 0x4a3326,
                    map: this.textures.wall,
                    roughness: 0.98
                }),
                beam: new THREE.MeshStandardMaterial({
                    color: 0x7a4c30,
                    map: this.textures.beam,
                    roughness: 0.9
                }),
                altarBackdrop: new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    map: this.textures.altarBackdrop
                }),
                corridorDetail: new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    map: this.textures.corridorDetail
                }),
                floorDebris: new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    map: this.textures.floorDebris,
                    transparent: true,
                    opacity: 0.22,
                    depthWrite: false
                })
            };
        }

        createLights() {
            const ambient = new THREE.HemisphereLight(0xc6aa82, 0x25160e, 1.82);
            this.scene.add(ambient);

            const candleLight = new THREE.PointLight(0xffa657, 4.1, 10.5, 1.45);
            candleLight.position.set(0, 1.45, -2.65);
            candleLight.castShadow = true;
            this.scene.add(candleLight);

            const pathLight = new THREE.PointLight(0xffc47a, 2.8, 9, 1.6);
            pathLight.position.set(0, 1.75, 1.65);
            this.scene.add(pathLight);

            const sideFill = new THREE.PointLight(0x9b7350, 1.4, 7.5, 1.8);
            sideFill.position.set(-2.8, 1.85, 0.2);
            this.scene.add(sideFill);

            this.flashlight = new THREE.SpotLight(0xfff0c8, 7.0, 13.5, Math.PI / 5.7, 0.62, 1.05);
            this.flashlight.castShadow = true;
            this.flashlightTarget = new THREE.Object3D();
            this.scene.add(this.flashlight);
            this.scene.add(this.flashlightTarget);
            this.flashlight.target = this.flashlightTarget;
        }

        createArchitecture() {
            const floorMat = this.materials.floor;
            const wallMat = this.materials.wall;
            const ceilingMat = this.materials.ceiling;
            const woodMat = this.materials.beam;

            this.addBox('main-floor', [10.4, 0.14, 8.6], [0, -0.08, 0], floorMat, true);
            this.addBox('corridor-floor', [2.65, 0.12, 8.4], [0, -0.07, -7.45], floorMat, true);
            this.addBox('main-ceiling', [10.4, 0.16, 8.6], [0, 3.2, 0], ceilingMat, false);
            this.addBox('corridor-ceiling', [2.65, 0.14, 8.4], [0, 3.05, -7.45], ceilingMat, false);

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

            this.addPillar(-3.98, 2.2, woodMat);
            this.addPillar(3.98, 2.2, woodMat);
            this.addPillar(-3.98, -2.48, woodMat);
            this.addPillar(3.98, -2.48, woodMat);
            this.addBox('front-crossbeam', [8.8, 0.22, 0.22], [0, 2.75, 2.2], woodMat, true);
            this.addBox('back-crossbeam', [8.8, 0.22, 0.22], [0, 2.75, -2.48], woodMat, true);
            this.addBox('left-crossbeam', [0.22, 0.22, 5.2], [-3.98, 2.78, -0.1], woodMat, true);
            this.addBox('right-crossbeam', [0.22, 0.22, 5.2], [3.98, 2.78, -0.1], woodMat, true);

            this.addPlane('altar-art-backdrop', 3.95, 2.96, [0, 1.7, -4.01], [0, 0, 0], this.materials.altarBackdrop);
            this.addPlane('corridor-detail-left', 6.2, 2.42, [-1.305, 1.54, -7.48], [0, Math.PI / 2, 0], this.materials.corridorDetail);
            this.addPlane('corridor-detail-right', 6.2, 2.42, [1.305, 1.54, -7.48], [0, -Math.PI / 2, 0], this.materials.corridorDetail);
            this.addPlane('floor-debris', 3.6, 2.7, [0, 0.035, -0.35], [-Math.PI / 2, 0, 0], this.materials.floorDebris);
        }

        createProps() {
            const altarMat = new THREE.MeshStandardMaterial({
                color: 0x8a4f31,
                map: this.textures.beam,
                roughness: 0.82
            });
            const coffinMat = new THREE.MeshStandardMaterial({
                color: 0x2b1b13,
                map: this.textures.beam,
                roughness: 0.76
            });
            const redMat = new THREE.MeshStandardMaterial({ color: 0xa5241d, roughness: 0.72 });
            const paperMat = new THREE.MeshStandardMaterial({ color: 0xd8c17e, roughness: 0.95 });
            const clothMat = new THREE.MeshStandardMaterial({ color: 0x080706, roughness: 1 });

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

            const chairMat = new THREE.MeshStandardMaterial({
                color: 0x6d4029,
                map: this.textures.beam,
                roughness: 0.88
            });
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

        addPillar(x, z, mat) {
            this.addBox(`pillar-${x}-${z}`, [0.52, 3.1, 0.52], [x, 1.48, z], mat, true);
        }

        addPlane(name, width, height, position, rotation, material) {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
            mesh.name = name;
            mesh.position.set(position[0], position[1], position[2]);
            mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
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
