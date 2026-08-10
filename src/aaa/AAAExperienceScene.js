(function defineAAAExperienceScene(global) {
    const Huisha3D = global.Huisha3D || (global.Huisha3D = {});
    const THREE = global.THREE;

    const ART = {
        wall: '美术/木墙.png',
        floor: '美术/木地板.png',
        beam: '美术/木梁.png',
        altar: '美术/供桌区域.png',
        portrait: '美术/相框.png',
        corridor: '美术/走廊墙面.png',
        corridorVista: '美术/走廊全景.png',
        coffin: '美术/棺材区域.png',
        redCord: '美术/红绳.png'
    };

    class AAAExperienceScene {
        constructor({ root, prompt, objective, onDialog, qaSeed, qaDpr }) {
            this.root = root;
            this.prompt = prompt;
            this.objective = objective;
            this.onDialog = onDialog;
            this.map = Huisha3D.MAIN_HALL_MAP;
            this.clock = new THREE.Clock();
            this.elapsed = 0;
            this.fixedQATime = null;
            const hasSeed = qaSeed !== null && qaSeed !== undefined && qaSeed !== '';
            const hasDpr = qaDpr !== null && qaDpr !== undefined && qaDpr !== '';
            const parsedSeed = Number(qaSeed);
            const parsedDpr = Number(qaDpr);
            this.qaSeed = hasSeed && Number.isFinite(parsedSeed) ? parsedSeed >>> 0 : 0x4a17b39d;
            this.qaDpr = hasDpr && Number.isFinite(parsedDpr) ? THREE.MathUtils.clamp(parsedDpr, 0.5, 2) : null;
            this.qaCaptureMode = false;
            this.vfxSeed = this.qaSeed;
            this.flickerLights = [];
            this.flames = [];
            this.smokeWisps = [];
            this.waterLeaks = [];
            this.movementWeight = 0;
            this.stepPhase = 0;
            this.lastCameraXZ = null;
        }

        start() {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x050608);
            this.scene.fog = new THREE.FogExp2(0x090a0d, 0.032);

            this.camera = new THREE.PerspectiveCamera(61, this.root.clientWidth / this.root.clientHeight, 0.07, 90);
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: 'high-performance',
                preserveDrawingBuffer: true
            });
            this.renderer.setPixelRatio(this.qaDpr || Math.min(global.devicePixelRatio || 1, 2));
            this.renderer.setSize(this.root.clientWidth, this.root.clientHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.42;
            this.renderer.useLegacyLights = false;
            this.root.appendChild(this.renderer.domElement);

            this.loadingManager = new THREE.LoadingManager();
            this.assetsReady = new Promise((resolve) => { this.loadingManager.onLoad = resolve; });
            this.textures = this.loadTextures();
            this.detailMap = this.createDetailMap();
            this.materials = this.createMaterials();
            this.createArchitecture();
            this.createSetDressing();
            this.createLighting();
            this.createAtmosphere();

            this.controls = new Huisha3D.ThreeControls({
                camera: this.camera,
                domElement: this.renderer.domElement,
                map: this.map
            });
            this.controls.speed = 2.35;
            this.controls.lookSpeed = 0.00175;
            this.lastCameraXZ = new THREE.Vector2(this.camera.position.x, this.camera.position.z);
            this.interaction = new Huisha3D.ThreeInteraction({
                camera: this.camera,
                map: this.map,
                prompt: this.prompt,
                objective: this.objective,
                onDialog: this.onDialog
            });

            this.onResize = () => this.resize();
            global.addEventListener('resize', this.onResize);
            this.animate();
        }

        loadTextures() {
            const loader = new THREE.TextureLoader(this.loadingManager);
            const anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 12);
            const load = (path, repeat) => {
                const texture = loader.load(path);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = anisotropy;
                if (repeat) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(repeat[0], repeat[1]);
                }
                return texture;
            };
            return {
                wall: load(ART.wall, [3.2, 1.5]),
                floor: load(ART.floor, [3.6, 3.0]),
                beam: load(ART.beam, [1.35, 1.35]),
                altar: load(ART.altar),
                portrait: load(ART.portrait),
                corridor: load(ART.corridor),
                corridorVista: load(ART.corridorVista),
                coffin: load(ART.coffin),
                redCord: load(ART.redCord)
            };
        }

        createDetailMap() {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const context = canvas.getContext('2d');
            const image = context.createImageData(256, 256);
            let seed = 1789;
            for (let i = 0; i < image.data.length; i += 4) {
                seed = (seed * 1664525 + 1013904223) >>> 0;
                const grain = 96 + ((seed >>> 24) % 72);
                image.data[i] = grain;
                image.data[i + 1] = grain;
                image.data[i + 2] = grain;
                image.data[i + 3] = 255;
            }
            context.putImageData(image, 0, 0);
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(6, 6);
            return texture;
        }

        createMaterials() {
            const wood = new THREE.MeshPhysicalMaterial({
                color: 0x72503a,
                map: this.textures.beam,
                bumpMap: this.detailMap,
                bumpScale: 0.055,
                roughness: 0.72,
                metalness: 0.02,
                clearcoat: 0.08,
                clearcoatRoughness: 0.76
            });
            const stainTexture = this.createStainTexture();
            const blackWood = new THREE.MeshPhysicalMaterial({
                color: 0x17110f,
                map: this.textures.beam,
                bumpMap: this.detailMap,
                bumpScale: 0.05,
                roughness: 0.66,
                clearcoat: 0.12,
                clearcoatRoughness: 0.72
            });
            const cloneBeam = (offsetX = 0, offsetY = 0) => {
                const texture = this.textures.beam.clone();
                texture.offset.set(offsetX, offsetY);
                texture.needsUpdate = true;
                return texture;
            };
            const makeDoorWood = (color, offsetX) => new THREE.MeshPhysicalMaterial({
                color,
                map: cloneBeam(offsetX, 0),
                bumpMap: this.detailMap,
                bumpScale: 0.042,
                roughness: 0.9,
                metalness: 0,
                clearcoat: 0.01,
                clearcoatRoughness: 0.95
            });
            const doorWoodA = makeDoorWood(0x5b4031, 0);
            const doorWoodB = makeDoorWood(0x624435, 0.08);
            const doorWoodC = makeDoorWood(0x53382c, 0.16);
            const doorBarWood = new THREE.MeshPhysicalMaterial({
                color: 0x704a34,
                map: cloneBeam(0.21, 0.12),
                bumpMap: this.detailMap,
                bumpScale: 0.04,
                roughness: 0.9,
                metalness: 0,
                clearcoat: 0.01,
                clearcoatRoughness: 0.96
            });
            return {
                floor: new THREE.MeshPhysicalMaterial({
                    color: 0x715541,
                    map: this.textures.floor,
                    bumpMap: this.detailMap,
                    bumpScale: 0.038,
                    roughness: 0.56,
                    metalness: 0.03,
                    clearcoat: 0.16,
                    clearcoatRoughness: 0.64
                }),
                wall: new THREE.MeshStandardMaterial({
                    color: 0x5a4638,
                    map: this.textures.wall,
                    bumpMap: this.detailMap,
                    bumpScale: 0.07,
                    roughness: 0.94
                }),
                darkWall: new THREE.MeshStandardMaterial({ color: 0x1b1918, roughness: 0.98 }),
                wood,
                agedWood: wood.clone(),
                blackWood,
                doorWoodA,
                doorWoodB,
                doorWoodC,
                doorBarWood,
                iron: new THREE.MeshStandardMaterial({ color: 0x292929, roughness: 0.38, metalness: 0.82 }),
                doorIron: new THREE.MeshStandardMaterial({ color: 0x211b18, roughness: 0.7, metalness: 0.62 }),
                brass: new THREE.MeshStandardMaterial({ color: 0x6b4121, roughness: 0.3, metalness: 0.86 }),
                paper: new THREE.MeshStandardMaterial({ color: 0xc8a64d, roughness: 0.92, side: THREE.DoubleSide }),
                doorPaper: new THREE.MeshStandardMaterial({ color: 0x806126, roughness: 1, side: THREE.DoubleSide }),
                sealInk: new THREE.MeshStandardMaterial({ color: 0x671811, roughness: 1, side: THREE.DoubleSide }),
                ash: new THREE.MeshStandardMaterial({ color: 0x3a3936, roughness: 1 }),
                stain: new THREE.MeshBasicMaterial({ color: 0x2b1510, map: stainTexture, transparent: true, opacity: 0.46, depthWrite: false }),
                cord: new THREE.MeshStandardMaterial({ color: 0x090101, roughness: 1 }),
                cloth: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, side: THREE.DoubleSide }),
                glass: new THREE.MeshPhysicalMaterial({ color: 0x6f8290, roughness: 0.16, transmission: 0.2, transparent: true, opacity: 0.42 }),
                plaster: new THREE.MeshStandardMaterial({ color: 0x49423b, roughness: 1 })
            };
        }

        createStainTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, 128, 128);
            context.save();
            context.scale(1, 0.62);
            const gradient = context.createRadialGradient(62, 101, 8, 64, 101, 58);
            gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
            gradient.addColorStop(0.48, 'rgba(255,255,255,0.5)');
            gradient.addColorStop(0.78, 'rgba(255,255,255,0.16)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            context.fillStyle = gradient;
            context.beginPath();
            context.ellipse(64, 101, 60, 54, -0.08, 0, Math.PI * 2);
            context.fill();
            context.restore();
            context.globalCompositeOperation = 'destination-out';
            for (let i = 0; i < 18; i += 1) {
                const x = 16 + ((i * 47) % 96);
                const y = 30 + ((i * 31) % 70);
                context.globalAlpha = 0.12 + (i % 4) * 0.04;
                context.beginPath();
                context.arc(x, y, 2 + (i % 5), 0, Math.PI * 2);
                context.fill();
            }
            context.globalCompositeOperation = 'source-over';
            context.globalAlpha = 1;
            return new THREE.CanvasTexture(canvas);
        }

        createArchitecture() {
            const M = this.materials;
            this.addBox('aaa-main-floor', [10.4, 0.18, 8.6], [0, -0.1, 0], M.floor, true);
            this.addBox('aaa-corridor-floor', [2.65, 0.16, 8.4], [0, -0.09, -7.45], M.floor, true);
            this.addBox('aaa-main-ceiling', [10.4, 0.18, 8.6], [0, 3.2, 0], M.darkWall, false);
            this.addBox('aaa-corridor-ceiling', [2.65, 0.16, 8.4], [0, 3.05, -7.45], M.darkWall, false);

            this.addBox('aaa-front-wall', [10.25, 3.2, 0.34], [0, 1.55, 4.35], M.wall, true);
            this.addBox('aaa-left-wall', [0.34, 3.2, 8.6], [-5.15, 1.55, 0], M.wall, true);
            this.addBox('aaa-right-wall', [0.34, 3.2, 8.6], [5.15, 1.55, 0], M.wall, true);
            this.addBox('aaa-back-left', [4.1, 3.2, 0.34], [-3.18, 1.55, -4.18], M.wall, true);
            this.addBox('aaa-back-right', [4.1, 3.2, 0.34], [3.18, 1.55, -4.18], M.wall, true);
            this.addBox('aaa-corridor-left', [0.3, 3.05, 8.4], [-1.45, 1.5, -7.45], M.wall, true);
            this.addBox('aaa-corridor-right', [0.3, 3.05, 8.4], [1.45, 1.5, -7.45], M.wall, true);
            this.addBox('aaa-corridor-end', [2.65, 3.05, 0.34], [0, 1.5, -11.75], M.darkWall, true);

            [-3.98, 3.98].forEach((x) => {
                [2.2, -2.48].forEach((z) => this.createPillar(x, z));
            });
            [-2.5, 2.55].forEach((z, index) => {
                this.addBox(`aaa-crossbeam-${index}`, [9.0, 0.32, 0.3], [0, 2.78, z], M.wood, true);
            });
            for (let z = 3.25, index = 0; z > -4; z -= 0.72, index += 1) {
                this.addBox(`aaa-ceiling-rib-${index}`, [9.65, 0.12, 0.18], [0, 3.04, z], M.agedWood, true);
            }
            for (let z = -4.25, index = 0; z > -11.6; z -= 0.78, index += 1) {
                const rib = this.addBox(`aaa-corridor-rib-${index}`, [2.58, 0.15, 0.16], [0, 2.91 + Math.sin(index * 1.7) * 0.022, z], M.agedWood, true);
                rib.scale.x = 0.96 + (index % 4) * 0.012;
                rib.rotation.y = (index % 3 - 1) * 0.007;
            }

            this.createWallFrames();
            this.createDoorway(0, -4.02);
            this.createDoorway(0, -11.55, true);
            this.createCorridorCord(-1);
            this.createCorridorCord(1);
        }

        createPillar(x, z) {
            this.addBox(`aaa-pillar-core-${x}-${z}`, [0.56, 3.02, 0.56], [x, 1.49, z], this.materials.wood, true);
            this.addBox(`aaa-pillar-foot-${x}-${z}`, [0.7, 0.18, 0.7], [x, 0.1, z], this.materials.blackWood, true);
            this.addBox(`aaa-pillar-cap-${x}-${z}`, [0.76, 0.2, 0.76], [x, 2.88, z], this.materials.blackWood, true);
        }

        createWallFrames() {
            const M = this.materials;
            for (let i = 0; i < 7; i += 1) {
                const z = 3.25 - i * 1.18;
                [-5.0, 5.0].forEach((x, side) => {
                    this.addBox(`aaa-wainscot-${side}-${i}`, [0.08, 0.08, 1.02], [x, 0.82, z], M.blackWood, true);
                    this.addBox(`aaa-wall-stile-${side}-${i}`, [0.08, 1.52, 0.07], [x, 0.88, z - 0.51], M.wood, true);
                });
            }
            for (let i = 0; i < 8; i += 1) {
                const z = -4.45 - i * 0.92;
                [-1.30, 1.30].forEach((x, side) => {
                    this.addBox(`aaa-corridor-stile-${side}-${i}`, [0.08, 2.48, 0.07], [x, 1.28, z], M.wood, true);
                });
            }
        }

        createDoorway(x, z, sealed = false) {
            const M = this.materials;
            this.addBox(`aaa-door-left-${z}`, [0.24, 2.9, 0.3], [x - 1.27, 1.44, z], M.blackWood, true);
            this.addBox(`aaa-door-right-${z}`, [0.24, 2.9, 0.3], [x + 1.27, 1.44, z], M.blackWood, true);
            this.addBox(`aaa-door-lintel-${z}`, [2.78, 0.28, 0.34], [x, 2.82, z], M.blackWood, true);
            if (sealed) {
                this.createSealedDoor(x, z);
            }
        }

        createSealedDoor(x, z) {
            const M = this.materials;
            const plankCenters = [-0.93, -0.56, -0.19, 0.19, 0.56, 0.93];
            const plankWidths = [0.36, 0.37, 0.352, 0.352, 0.366, 0.36];
            const plankMaterials = [M.doorWoodA, M.doorWoodB, M.doorWoodC, M.doorWoodB, M.doorWoodC, M.doorWoodA];
            const plankAngles = [-0.004, 0.002, -0.001, 0.002, -0.003, 0.003];
            for (let i = 0; i < 6; i += 1) {
                const offset = i - 2.5;
                const plank = this.addBeveledBox(
                    `aaa-sealed-door-plank-${i}`,
                    [plankWidths[i], 2.51 - Math.abs(offset) * 0.014, 0.16],
                    [x + plankCenters[i], 1.32 + (i % 2) * 0.009, z - 0.035],
                    plankMaterials[i],
                    0.008,
                    true
                );
                plank.rotation.z = plankAngles[i];
            }
            this.addBeveledBox('aaa-sealed-door-threshold', [2.32, 0.16, 0.34], [x, 0.08, z + 0.13], M.blackWood, 0.025, true);
            const barAngle = -0.05;
            const barY = 1.38;
            const bar = this.addBeveledBox('aaa-door-bar', [2.6, 0.21, 0.21], [x, barY, z + 0.15], M.doorBarWood, 0.022, true);
            bar.rotation.z = barAngle;
            [-1.17, 1.17].forEach((socketX, index) => {
                const socketY = barY + Math.tan(barAngle) * socketX;
                this.addBeveledBox(`aaa-door-bar-bracket-${index}`, [0.2, 0.38, 0.04], [x + socketX, socketY, z + 0.17], M.doorIron, 0.008, true);
                this.addBeveledBox(`aaa-door-bar-shelf-${index}`, [0.23, 0.08, 0.18], [x + socketX, socketY - 0.14, z + 0.18], M.doorIron, 0.008, true);
                this.addBeveledBox(`aaa-door-bar-lip-${index}`, [0.08, 0.25, 0.1], [x + socketX + Math.sign(socketX) * 0.07, socketY, z + 0.24], M.doorIron, 0.007, true);
                [-0.11, 0.11].forEach((dy, nailIndex) => {
                    const nail = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 7), M.doorIron);
                    nail.name = `aaa-door-bar-rivet-${index}-${nailIndex}`;
                    nail.scale.z = 0.3;
                    nail.position.set(x + socketX, socketY + dy, z + 0.196);
                    this.scene.add(nail);
                });
            });
            [-0.92, 0.92].forEach((hingeX, side) => {
                [0.67, 2.04].forEach((hingeY, row) => {
                    const hinge = this.addBeveledBox(`aaa-door-hinge-${side}-${row}`, [0.56, 0.065, 0.035], [x + hingeX, hingeY, z + 0.065], M.doorIron, 0.007, true);
                    hinge.rotation.z = side === 0 ? -0.012 : 0.012;
                    [-0.17, 0, 0.17].forEach((dx, nailIndex) => {
                        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), M.doorIron);
                        rivet.scale.z = 0.3;
                        rivet.position.set(x + hingeX + dx, hingeY, z + 0.091);
                        rivet.name = `aaa-door-hinge-rivet-${side}-${row}-${nailIndex}`;
                        this.scene.add(rivet);
                    });
                    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 10), M.doorIron);
                    pivot.name = `aaa-door-hinge-pivot-${side}-${row}`;
                    pivot.position.set(x + (side === 0 ? -1.18 : 1.18), hingeY, z + 0.086);
                    pivot.castShadow = true;
                    this.scene.add(pivot);
                });
            });
            [-0.58, 0, 0.58].forEach((sealX, index) => {
                const sealHeight = 0.56 - index * 0.04;
                const sealY = 1.82 - Math.abs(index - 1) * 0.16;
                const sealRotation = (index - 1) * 0.055;
                this.createCurledPaper(
                    `aaa-door-seal-${index}`,
                    0.16,
                    sealHeight,
                    [x + sealX, sealY, z + 0.052],
                    [0, 0, sealRotation],
                    M.doorPaper
                );
                this.createCurledPaper(`aaa-door-seal-ink-${index}`, 0.026, 0.2, [x + sealX, sealY, z + 0.058], [0, 0, sealRotation], M.sealInk);
                this.createCurledPaper(`aaa-door-seal-mark-${index}`, 0.078, 0.018, [x + sealX, sealY + 0.065, z + 0.059], [0, 0, sealRotation], M.sealInk);
                const pinOffset = sealHeight * 0.5 - 0.03;
                const pin = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 7), M.doorIron);
                pin.name = `aaa-door-seal-pin-${index}`;
                pin.scale.z = 0.28;
                pin.position.set(
                    x + sealX - Math.sin(sealRotation) * pinOffset,
                    sealY + Math.cos(sealRotation) * pinOffset,
                    z + 0.084
                );
                this.scene.add(pin);
            });
            this.createDoorCrack(x, z);
            this.createDoorLightSpill(x, z);
            const ringPlate = this.addBeveledBox('aaa-door-ring-backplate', [0.18, 0.18, 0.035], [x + 0.62, 1.11, z + 0.062], M.doorIron, 0.012, true);
            ringPlate.rotation.z = Math.PI / 4;
            const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, 0.08, 12), M.doorIron);
            pivot.name = 'aaa-door-ring-pivot';
            pivot.rotation.x = Math.PI / 2;
            pivot.position.set(x + 0.62, 1.1, z + 0.105);
            pivot.castShadow = true;
            this.scene.add(pivot);
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.019, 10, 24), M.doorIron);
            ring.name = 'aaa-door-ring';
            ring.position.set(x + 0.62, 0.98, z + 0.11);
            ring.castShadow = true;
            this.scene.add(ring);
        }

        createDoorCrack(x, z) {
            const cavity = new THREE.MeshBasicMaterial({ color: 0x020101, side: THREE.DoubleSide });
            this.addPlane('aaa-door-crack-cavity', 0.052, 2.24, [x, 1.23, z - 0.032], [0, 0, 0], cavity);
            const glowMaterial = new THREE.MeshStandardMaterial({
                color: 0x220403,
                emissive: 0x8a1913,
                emissiveIntensity: 2.2,
                transparent: true,
                opacity: 0.84,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const segments = [
                { y0: -1.03, y1: -0.36, width: 0.021, dx0: -0.002, dx1: 0.002 },
                { y0: -0.29, y1: 0.24, width: 0.019, dx0: 0.002, dx1: -0.001 },
                { y0: 0.33, y1: 0.98, width: 0.022, dx0: -0.001, dx1: 0.003 }
            ];
            segments.forEach((segment, index) => {
                const shape = new THREE.Shape();
                shape.moveTo(segment.dx0 - segment.width * 0.46, segment.y0);
                shape.lineTo(segment.dx1 - segment.width * 0.54, segment.y1);
                shape.lineTo(segment.dx1 + segment.width * 0.46, segment.y1);
                shape.lineTo(segment.dx0 + segment.width * 0.54, segment.y0);
                shape.closePath();
                const glow = new THREE.Mesh(new THREE.ShapeGeometry(shape), glowMaterial.clone());
                glow.name = `aaa-door-crack-glow-${index}`;
                glow.position.set(x, 1.23, z - 0.005);
                this.scene.add(glow);
            });
        }

        createDoorLightSpill(x, z) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 512;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, 128, 512);
            for (let i = 0; i < 54; i += 1) {
                const t = i / 53;
                const alpha = Math.pow(1 - t, 2.2) * 0.14;
                const width = 12 + t * 47;
                context.fillStyle = `rgba(150, 24, 16, ${alpha})`;
                context.beginPath();
                context.ellipse(64, 8 + t * 496, width, 15, 0, 0, Math.PI * 2);
                context.fill();
            }
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
            this.addPlane('aaa-door-light-spill', 1.08, 3.25, [x, 0.028, z + 1.7], [-Math.PI / 2, 0, 0], material);
        }

        createCorridorCord(side) {
            const points = [];
            for (let i = 0; i < 7; i += 1) {
                points.push(new THREE.Vector3(side * 1.285, 1.08 + Math.sin(i * 1.35 + side) * 0.1, -4.5 - i * 1.12));
            }
            const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.3);
            const cord = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.007, 7, false), this.materials.cord);
            cord.name = `aaa-corridor-cord-${side}`;
            cord.castShadow = true;
            this.scene.add(cord);
            points.forEach((point, index) => {
                if (index % 2 !== 0) return;
                const nail = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 6), this.materials.iron);
                nail.scale.x = 0.35;
                nail.position.copy(point);
                nail.position.x -= side * 0.012;
                this.scene.add(nail);
            });
        }

        createSetDressing() {
            this.createAltar();
            this.createCoffin();
            this.createChairs();
            this.createPaperTrail();
            this.createWallTalismans();
            this.createArtBackdrops();
        }

        createAltar() {
            const M = this.materials;
            this.addBeveledBox('aaa-altar-body', [2.5, 0.76, 0.72], [0, 0.48, -3.16], M.wood, 0.022, true);
            this.addBeveledBox('aaa-altar-top', [2.85, 0.13, 0.96], [0, 0.94, -3.16], M.blackWood, 0.014, true);
            [-1.03, 1.03].forEach((x) => {
                this.addBeveledBox(`aaa-altar-leg-${x}`, [0.22, 0.92, 0.34], [x, 0.46, -3.13], M.blackWood, 0.025, true);
                this.createCandle(x, -2.86);
            });
            this.addBeveledBox('aaa-altar-apron', [2.12, 0.24, 0.08], [0, 0.72, -2.76], M.blackWood, 0.018, true);
            [-0.68, 0, 0.68].forEach((x, index) => {
                this.addBeveledBox(`aaa-altar-panel-${index}`, [0.54, 0.42, 0.045], [x, 0.46, -2.775], M.agedWood, 0.018, true);
            });
            const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.22, 24), M.brass);
            burner.name = 'aaa-incense-burner';
            burner.position.set(0, 1.1, -2.92);
            burner.castShadow = true;
            this.scene.add(burner);
            for (let i = -2; i <= 2; i += 1) {
                const incense = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.52, 6), M.cord);
                incense.position.set(i * 0.045, 1.42 - Math.abs(i) * 0.015, -2.92 + Math.abs(i) * 0.012);
                this.scene.add(incense);
            }
            this.createIncenseSmoke();
            this.createOfferings();
            this.addBox('aaa-portrait-frame', [1.35, 1.72, 0.1], [0, 1.98, -4.0], M.blackWood, true);
            const portraitMaterial = new THREE.MeshBasicMaterial({ map: this.textures.portrait, transparent: true, opacity: 0.78 });
            const cloth = this.addPlane('aaa-black-cloth', 1.16, 1.54, [0, 2.0, -3.925], [0, 0, 0], portraitMaterial);
            cloth.geometry.translate(0, -0.05, 0);
        }

        createCandle(x, z) {
            const wax = new THREE.MeshStandardMaterial({ color: 0xcdbd91, roughness: 0.82 });
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.35, 16), wax);
            body.position.set(x, 1.17, z);
            body.castShadow = true;
            this.scene.add(body);
            const waxPool = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), wax);
            waxPool.rotation.x = -Math.PI / 2;
            waxPool.scale.set(1.3, 0.75, 1);
            waxPool.position.set(x + 0.02, 1.015, z + 0.01);
            this.scene.add(waxPool);
            [-0.032, 0.028].forEach((dx, index) => {
                const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.1 + index * 0.035, 8), wax);
                drip.position.set(x + dx, 1.25 - index * 0.035, z + 0.052);
                this.scene.add(drip);
            });
            const wick = new THREE.Mesh(
                new THREE.CylinderGeometry(0.006, 0.008, 0.052, 7),
                new THREE.MeshStandardMaterial({ color: 0x17100c, roughness: 1 })
            );
            wick.position.set(x, 1.37, z);
            wick.rotation.z = x < 0 ? -0.06 : 0.05;
            this.scene.add(wick);

            const ember = new THREE.Mesh(
                new THREE.SphereGeometry(0.011, 10, 7),
                new THREE.MeshBasicMaterial({ color: 0xff5b20 })
            );
            ember.position.set(x, 1.397, z);
            this.scene.add(ember);

            const flameTexture = this.flameTexture || (this.flameTexture = this.createFlameTexture());
            const outer = new THREE.Sprite(new THREE.SpriteMaterial({
                map: flameTexture,
                color: 0xff7a24,
                transparent: true,
                opacity: 0.7,
                depthWrite: false,
                alphaTest: 0.018,
                blending: THREE.NormalBlending
            }));
            outer.scale.set(0.13, 0.24, 1);
            outer.position.set(x, 1.505, z);
            outer.renderOrder = 4;
            this.scene.add(outer);

            const core = new THREE.Sprite(new THREE.SpriteMaterial({
                map: flameTexture,
                color: 0xfff1bd,
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
                alphaTest: 0.025,
                blending: THREE.NormalBlending
            }));
            core.scale.set(0.058, 0.132, 1);
            core.position.set(x, 1.452, z + 0.002);
            core.renderOrder = 5;
            this.scene.add(core);

            this.flames.push({
                anchor: new THREE.Vector3(x, 1.397, z),
                outer,
                core,
                ember,
                wick,
                phase: this.flames.length * 2.6,
                light: null,
                lightBase: 30
            });
        }

        createFlameTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 256;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
            const gradient = context.createRadialGradient(64, 174, 8, 64, 150, 92);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.32, 'rgba(255,238,178,0.92)');
            gradient.addColorStop(0.72, 'rgba(255,120,38,0.48)');
            gradient.addColorStop(1, 'rgba(255,80,18,0)');
            context.fillStyle = gradient;
            context.beginPath();
            context.moveTo(64, 14);
            context.bezierCurveTo(99, 74, 113, 151, 91, 220);
            context.bezierCurveTo(79, 250, 49, 250, 36, 220);
            context.bezierCurveTo(14, 153, 36, 76, 64, 14);
            context.closePath();
            context.fill();
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            return texture;
        }

        createOfferings() {
            const ceramic = new THREE.MeshPhysicalMaterial({ color: 0x4c473f, roughness: 0.62, clearcoat: 0.08, clearcoatRoughness: 0.68 });
            const fruitMaterials = [
                new THREE.MeshStandardMaterial({ color: 0x3b160f, roughness: 0.86 }),
                new THREE.MeshStandardMaterial({ color: 0x574018, roughness: 0.9 }),
                new THREE.MeshStandardMaterial({ color: 0x283014, roughness: 0.94 })
            ];
            [-0.56, 0.56].forEach((x, side) => {
                const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.055, 24), ceramic);
                plate.position.set(x, 1.05, -3.12);
                plate.castShadow = true;
                this.scene.add(plate);
                const count = side === 0 ? 3 : 4;
                for (let i = 0; i < count; i += 1) {
                    const radius = 0.074 - (i % 3) * 0.006;
                    const fruit = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), fruitMaterials[(side + i) % fruitMaterials.length]);
                    fruit.scale.set(0.92 + i * 0.04, 0.78 + i * 0.07, 0.9);
                    fruit.position.set(x + (i - (count - 1) / 2) * 0.095, 1.145 + (i % 2) * 0.04, -3.12 + Math.sin(i * 1.7 + side) * 0.035);
                    fruit.rotation.set(i * 0.37, side * 0.41 + i * 0.22, i * 0.18);
                    fruit.castShadow = true;
                    this.scene.add(fruit);
                    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.045, 6), this.materials.wood);
                    stem.position.set(fruit.position.x + 0.01, fruit.position.y + radius * 0.84, fruit.position.z);
                    stem.rotation.z = (i - 1) * 0.16;
                    this.scene.add(stem);
                }
            });
            [-0.32, 0.32].forEach((x, index) => {
                const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 18), ceramic);
                cup.position.set(x, 1.075, -2.78 - index * 0.01);
                cup.castShadow = true;
                this.scene.add(cup);
            });
            const ash = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 10), this.materials.ash);
            ash.scale.set(1.25, 0.11, 0.72);
            ash.position.set(0, 1.02, -2.92);
            this.scene.add(ash);
        }

        createIncenseSmoke() {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, 128, 128);
            const stroke = context.createLinearGradient(0, 124, 0, 6);
            stroke.addColorStop(0, 'rgba(225,231,230,0)');
            stroke.addColorStop(0.16, 'rgba(225,231,230,0.72)');
            stroke.addColorStop(0.58, 'rgba(192,202,201,0.42)');
            stroke.addColorStop(1, 'rgba(176,188,188,0)');
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.shadowColor = 'rgba(205,216,215,0.42)';
            context.shadowBlur = 11;
            context.strokeStyle = stroke;
            context.lineWidth = 8;
            context.beginPath();
            context.moveTo(63, 124);
            context.bezierCurveTo(42, 105, 83, 90, 67, 70);
            context.bezierCurveTo(50, 50, 82, 35, 58, 5);
            context.stroke();
            context.shadowBlur = 4;
            context.globalAlpha = 0.45;
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(72, 122);
            context.bezierCurveTo(88, 96, 49, 80, 76, 56);
            context.bezierCurveTo(88, 42, 67, 24, 80, 8);
            context.stroke();
            context.globalAlpha = 1;
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            const material = new THREE.SpriteMaterial({
                map: texture,
                color: 0xbfc7c6,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                alphaTest: 0.006,
                blending: THREE.NormalBlending
            });
            for (let i = 0; i < 12; i += 1) {
                const wisp = new THREE.Sprite(material.clone());
                const sourceIndex = i % 5;
                const phase = (i * 0.61803398875) % 1;
                const lifetime = 4.7 + (i % 4) * 0.56;
                const sourceX = (sourceIndex - 2) * 0.045;
                wisp.scale.set(0.09, 0.15, 1);
                wisp.position.set(sourceX, 1.67, -2.92);
                this.scene.add(wisp);
                this.smokeWisps.push({
                    mesh: wisp,
                    phase,
                    lifetime,
                    sourceX,
                    sourceZ: -2.92 + (sourceIndex % 2) * 0.009,
                    curl: 0.04 + (i % 5) * 0.009,
                    drift: (this.seededVFXUnit(0x534d4f4b, i, 0) - 0.5) * 0.16
                });
            }
        }

        createCoffin() {
            const M = this.materials;
            const base = this.addTaperedPrism('aaa-coffin', 2.55, 2.28, 1.28, 0.68, [0, 0.36, 0.76], M.blackWood, 0.03, true);
            base.rotation.y = 0.015;
            const lid = this.addTaperedPrism('aaa-coffin-lid', 2.72, 2.42, 1.42, 0.17, [0, 0.79, 0.76], M.blackWood, 0.022, true);
            lid.rotation.y = 0.015;
            const coffinArt = new THREE.MeshStandardMaterial({ map: this.textures.coffin, transparent: true, opacity: 0.52, roughness: 0.76, metalness: 0.01, depthWrite: false });
            this.addPlane('aaa-coffin-art', 2.55, 1.27, [0, 0.918, 0.76], [-Math.PI / 2, 0, 0.015], coffinArt);
            const cordArt = new THREE.MeshBasicMaterial({ map: this.textures.redCord, transparent: true, opacity: 0.035, depthWrite: false });
            this.addPlane('aaa-coffin-cord-art', 1.65, 1.65, [0, 0.923, 0.76], [-Math.PI / 2, 0, 0], cordArt);
            [-0.72, 0, 0.72].forEach((x, index) => {
                this.addBeveledBox(`aaa-coffin-front-panel-${index}`, [0.52, 0.32, 0.052], [x, 0.4, 1.425], M.agedWood, 0.018, true);
                const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 20, Math.PI), M.brass);
                handle.position.set(x, 0.46, 1.462);
                handle.castShadow = true;
                this.scene.add(handle);
            });
            [0.43, 0.76, 1.09].forEach((z, index) => this.createCoffinCord(z, index));
            this.addBox('aaa-coffin-front-top-trim', [2.38, 0.07, 0.045], [0, 0.67, 1.414], M.blackWood, true);
            this.addBox('aaa-coffin-front-bottom-trim', [2.38, 0.07, 0.045], [0, 0.13, 1.414], M.blackWood, true);
            const frontArt = new THREE.MeshStandardMaterial({ map: this.textures.coffin, transparent: true, opacity: 0.32, roughness: 0.84, metalness: 0.01, depthWrite: false });
            this.addPlane('aaa-coffin-front-art', 2.32, 0.48, [0, 0.4, 1.416], [0, 0, 0], frontArt);
            const sideArt = new THREE.MeshStandardMaterial({ map: this.textures.coffin, transparent: true, opacity: 0.18, roughness: 0.86, depthWrite: false, side: THREE.DoubleSide });
            this.addPlane('aaa-coffin-side-art-left', 1.12, 0.46, [-1.225, 0.4, 0.76], [0, Math.PI / 2, 0], sideArt);
            this.addPlane('aaa-coffin-side-art-right', 1.12, 0.46, [1.225, 0.4, 0.76], [0, -Math.PI / 2, 0], sideArt.clone());
            [-1.08, 1.08].forEach((x, side) => {
                [0.17, 0.63].forEach((y, row) => {
                    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.brass);
                    boss.scale.z = 0.32;
                    boss.position.set(x, y, 1.466);
                    boss.name = `aaa-coffin-boss-${side}-${row}`;
                    this.scene.add(boss);
                });
            });
        }

        createCoffinCord(z, index) {
            const normalizedZ = Math.max(0, Math.min(1, (z - 0.05) / 1.42));
            const halfWidth = 1.2 + normalizedZ * 0.16;
            const curve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-halfWidth, 0.922, z),
                new THREE.Vector3(0, 0.916 - index * 0.003, z + (index - 1) * 0.012),
                new THREE.Vector3(halfWidth, 0.922, z),
                new THREE.Vector3(halfWidth - 0.025, 0.46, z),
                new THREE.Vector3(halfWidth - 0.095, 0.1, z),
                new THREE.Vector3(0, 0.07, z),
                new THREE.Vector3(-halfWidth + 0.095, 0.1, z),
                new THREE.Vector3(-halfWidth + 0.025, 0.46, z)
            ], true, 'centripetal', 0.24);
            const cord = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.0045, 7, true), this.materials.cord);
            cord.name = `aaa-coffin-cord-${index}`;
            cord.castShadow = true;
            cord.receiveShadow = true;
            this.scene.add(cord);
        }

        createChairs() {
            const M = this.materials;
            [[-3.25, 1.05], [3.25, 1.05], [-3.25, -1.15], [3.25, -1.15]].forEach(([x, z], index) => {
                this.addBox(`aaa-chair-seat-${index}`, [0.68, 0.13, 0.66], [x, 0.46, z], M.wood, true);
                this.addBox(`aaa-chair-back-${index}`, [0.68, 0.92, 0.11], [x, 0.91, z - 0.32], M.blackWood, true);
                [-0.25, 0.25].forEach((dx) => [-0.23, 0.23].forEach((dz) => {
                    this.addBox(`aaa-chair-leg-${index}-${dx}-${dz}`, [0.08, 0.46, 0.08], [x + dx, 0.23, z + dz], M.wood, true);
                }));
            });
        }

        createPaperTrail() {
            const M = this.materials;
            for (let i = 0; i < 34; i += 1) {
                const lane = (i % 5) - 2;
                const z = 3.0 - i * 0.38;
                const x = Math.sin(i * 2.43) * (0.25 + Math.abs(lane) * 0.13);
                const paper = this.createCurledPaper(`aaa-paper-${i}`, 0.18 + (i % 3) * 0.03, 0.11, [x, 0.022, z], [-Math.PI / 2, 0, (i * 1.17) % Math.PI], M.paper);
                paper.receiveShadow = true;
            }
            for (let i = 0; i < 12; i += 1) {
                const stain = new THREE.Mesh(new THREE.CircleGeometry(0.16 + (i % 4) * 0.08, 20), M.stain);
                stain.rotation.x = -Math.PI / 2;
                stain.scale.x = 1.8;
                stain.position.set(Math.sin(i * 1.9) * 2.1, 0.012, 2.7 - i * 0.55);
                this.scene.add(stain);
            }
        }

        createWallTalismans() {
            const M = this.materials.paper;
            for (let i = 0; i < 18; i += 1) {
                const left = i % 2 === 0;
                const z = 3.35 - Math.floor(i / 2) * 0.83;
                const paper = this.createCurledPaper(`aaa-talisman-${i}`, 0.2, 0.54, [left ? -4.96 : 4.96, 1.55 + (i % 3) * 0.15, z], [0, left ? Math.PI / 2 : -Math.PI / 2, (i % 4 - 1.5) * 0.035], M);
                paper.castShadow = true;
            }
        }

        createArtBackdrops() {
            const translucent = (map, opacity) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
            this.addPlane('aaa-altar-art', 3.85, 2.72, [0, 1.62, -4.005], [0, 0, 0], translucent(this.textures.altar, 0.48));
            this.addPlane('aaa-corridor-art-left', 6.7, 2.38, [-1.292, 1.5, -7.55], [0, Math.PI / 2, 0], translucent(this.textures.corridor, 0.27));
            this.addPlane('aaa-corridor-art-right', 6.7, 2.38, [1.292, 1.5, -7.55], [0, -Math.PI / 2, 0], translucent(this.textures.corridor, 0.27));
        }

        createLighting() {
            const hemi = new THREE.HemisphereLight(0x536378, 0x180d08, 0.68);
            this.scene.add(hemi);

            const moon = new THREE.DirectionalLight(0x8fa7c0, 3.1);
            moon.position.set(-3.2, 5.5, 3.8);
            moon.castShadow = true;
            moon.shadow.mapSize.set(2048, 2048);
            moon.shadow.camera.left = -6;
            moon.shadow.camera.right = 6;
            moon.shadow.camera.top = 6;
            moon.shadow.camera.bottom = -6;
            moon.shadow.bias = -0.00035;
            this.scene.add(moon);

            [-1.03, 1.03].forEach((x, index) => {
                const light = new THREE.PointLight(0xff8b3c, 30, 6.5, 1.85);
                const flame = this.flames[index];
                if (flame) light.position.copy(flame.anchor).add(new THREE.Vector3(0, 0.09, 0.018));
                else light.position.set(x, 1.49, -2.84);
                light.castShadow = index === 0;
                if (light.castShadow) light.shadow.mapSize.set(1024, 1024);
                this.scene.add(light);
                if (flame) {
                    flame.light = light;
                    flame.lightBase = 30;
                }
                this.flickerLights.push({ light, base: 30, phase: index * 2.6, flame });
            });

            const corridor = new THREE.SpotLight(0x8aa6bd, 31, 12, Math.PI / 7.2, 0.82, 1.5);
            corridor.position.set(0, 2.68, -5.4);
            corridor.target.position.set(0, 0.62, -8.1);
            corridor.castShadow = true;
            corridor.shadow.mapSize.set(1024, 1024);
            this.scene.add(corridor, corridor.target);

            const doorCrackLight = new THREE.SpotLight(0x9b2118, 3.6, 4.2, Math.PI / 8, 0.95, 1.8);
            doorCrackLight.position.set(0, 0.75, -11.36);
            doorCrackLight.target.position.set(0, 0.08, -9.15);
            this.scene.add(doorCrackLight, doorCrackLight.target);
            const doorCrackFill = new THREE.PointLight(0x6f1511, 0.9, 1.2, 2);
            doorCrackFill.position.set(0, 0.72, -11.28);
            this.scene.add(doorCrackFill);

            this.flashlight = new THREE.SpotLight(0xffe6bf, 118, 16, Math.PI / 5.6, 0.94, 1.55);
            this.flashlight.castShadow = true;
            this.flashlight.shadow.mapSize.set(1024, 1024);
            this.flashlight.shadow.bias = -0.00025;
            this.flashlightTarget = new THREE.Object3D();
            this.scene.add(this.flashlight, this.flashlightTarget);
            this.flashlight.target = this.flashlightTarget;
        }

        createAtmosphere() {
            const count = 220;
            const positions = new Float32Array(count * 3);
            for (let i = 0; i < count; i += 1) {
                positions[i * 3] = (this.nextVFXRandom() - 0.5) * 9.4;
                positions[i * 3 + 1] = 0.12 + this.nextVFXRandom() * 2.7;
                positions[i * 3 + 2] = 3.8 - this.nextVFXRandom() * 15.1;
            }
            this.dustBasePositions = positions.slice();
            this.dustMotion = Array.from({ length: count }, (_, index) => ({
                phaseX: this.seededVFXUnit(0x44555354, index, 0) * Math.PI * 2,
                phaseY: this.seededVFXUnit(0x44555354, index, 1) * Math.PI * 2,
                phaseZ: this.seededVFXUnit(0x44555354, index, 2) * Math.PI * 2,
                speed: 0.055 + this.seededVFXUnit(0x44555354, index, 3) * 0.105,
                amplitudeX: 0.018 + this.seededVFXUnit(0x44555354, index, 4) * 0.055,
                amplitudeY: 0.012 + this.seededVFXUnit(0x44555354, index, 5) * 0.04,
                amplitudeZ: 0.012 + this.seededVFXUnit(0x44555354, index, 6) * 0.04
            }));
            const geometry = new THREE.BufferGeometry();
            const positionAttribute = new THREE.BufferAttribute(positions, 3);
            positionAttribute.setUsage(THREE.DynamicDrawUsage);
            geometry.setAttribute('position', positionAttribute);
            const material = new THREE.PointsMaterial({
                color: 0xd8c49a,
                map: this.createDustTexture(),
                size: 0.03,
                transparent: true,
                opacity: 0.27,
                alphaTest: 0.055,
                depthWrite: false,
                blending: THREE.NormalBlending,
                sizeAttenuation: true
            });
            this.dust = new THREE.Points(geometry, material);
            this.dust.name = 'aaa-soft-dust';
            this.dust.frustumCulled = false;
            this.scene.add(this.dust);

            const coneMaterial = new THREE.MeshBasicMaterial({ color: 0x7894aa, transparent: true, opacity: 0.028, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
            const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8.0, 32, 1, true), coneMaterial);
            cone.name = 'aaa-corridor-volume';
            cone.position.set(0, 2.3, -8.0);
            cone.rotation.x = Math.PI / 2;
            this.scene.add(cone);

            this.createWaterLeaks();
        }

        createDustTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const context = canvas.getContext('2d');
            const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 30);
            gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
            gradient.addColorStop(0.3, 'rgba(255,255,255,0.72)');
            gradient.addColorStop(0.72, 'rgba(255,255,255,0.2)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, 64, 64);
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            return texture;
        }

        createWetPatchTexture(seedOffset) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const context = canvas.getContext('2d');
            context.fillStyle = 'rgb(0,0,0)';
            context.fillRect(0, 0, 256, 256);
            const gradient = context.createRadialGradient(128, 132, 12, 128, 128, 116);
            gradient.addColorStop(0, 'rgb(242,242,242)');
            gradient.addColorStop(0.48, 'rgb(184,184,184)');
            gradient.addColorStop(0.8, 'rgb(58,58,58)');
            gradient.addColorStop(1, 'rgb(0,0,0)');
            context.fillStyle = gradient;
            context.beginPath();
            const pointCount = 28;
            for (let index = 0; index < pointCount; index += 1) {
                const angle = index / pointCount * Math.PI * 2;
                const wobble = 0.79 + this.seededVFXUnit(0x57455450 + seedOffset, index, 0) * 0.22;
                const radiusX = 116 * wobble;
                const radiusY = 91 * (0.82 + this.seededVFXUnit(0x57455450 + seedOffset, index, 1) * 0.18);
                const px = 128 + Math.cos(angle) * radiusX;
                const py = 128 + Math.sin(angle) * radiusY;
                if (index === 0) context.moveTo(px, py);
                else context.lineTo(px, py);
            }
            context.closePath();
            context.fill();
            context.globalCompositeOperation = 'destination-out';
            for (let index = 0; index < 17; index += 1) {
                const px = 48 + this.seededVFXUnit(0x504f5245 + seedOffset, index, 0) * 160;
                const py = 58 + this.seededVFXUnit(0x504f5245 + seedOffset, index, 1) * 140;
                const radius = 2 + this.seededVFXUnit(0x504f5245 + seedOffset, index, 2) * 7;
                context.globalAlpha = 0.08 + this.seededVFXUnit(0x504f5245 + seedOffset, index, 3) * 0.18;
                context.beginPath();
                context.arc(px, py, radius, 0, Math.PI * 2);
                context.fill();
            }
            context.globalCompositeOperation = 'source-over';
            context.globalAlpha = 1;
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            return texture;
        }

        createRippleTexture() {
            const canvas = document.createElement('canvas');
            const size = 256;
            const center = size / 2;
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            context.fillStyle = 'rgb(0,0,0)';
            context.fillRect(0, 0, size, size);
            const gradient = context.createRadialGradient(center, center, 0, center, center, center - 1);
            gradient.addColorStop(0, 'rgb(0,0,0)');
            gradient.addColorStop(0.7, 'rgb(0,0,0)');
            gradient.addColorStop(0.79, 'rgb(48,48,48)');
            gradient.addColorStop(0.86, 'rgb(228,228,228)');
            gradient.addColorStop(0.93, 'rgb(62,62,62)');
            gradient.addColorStop(1, 'rgb(0,0,0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, size, size);
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.NoColorSpace;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            return texture;
        }

        createWaterLeaks() {
            const rippleTexture = this.rippleTexture || (this.rippleTexture = this.createRippleTexture());
            const leakConfigs = [
                { name: 'hall', x: -2.18, z: -1.55, sourceY: 3.085, period: 2.82, phase: 0.15, patch: [1.18, 0.76], rotation: -0.18 },
                { name: 'corridor', x: 0.86, z: -7.77, sourceY: 2.945, period: 3.36, phase: 0.43, patch: [0.68, 0.46], rotation: 0.31 }
            ];
            leakConfigs.forEach((config, leakIndex) => {
                const patchTexture = this.createWetPatchTexture(leakIndex * 97 + 11);
                const wetMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0x171d1e,
                    roughness: 0.28,
                    metalness: 0,
                    clearcoat: 0.55,
                    clearcoatRoughness: 0.22,
                    ior: 1.33,
                    specularIntensity: 0.45,
                    transparent: true,
                    opacity: 0.3,
                    alphaMap: patchTexture,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                    polygonOffset: true,
                    polygonOffsetFactor: -1,
                    polygonOffsetUnits: -1
                });
                const wetPatch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wetMaterial);
                wetPatch.name = `aaa-wet-patch-${config.name}`;
                wetPatch.rotation.set(-Math.PI / 2, 0, config.rotation);
                wetPatch.scale.set(config.patch[0], config.patch[1], 1);
                wetPatch.position.set(config.x, -0.007, config.z);
                wetPatch.receiveShadow = true;
                wetPatch.renderOrder = 1;
                this.scene.add(wetPatch);

                const ceilingMaterial = new THREE.MeshStandardMaterial({
                    color: 0x202221,
                    roughness: 0.96,
                    transparent: true,
                    opacity: 0.78,
                    alphaMap: patchTexture,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
                const ceilingStain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ceilingMaterial);
                ceilingStain.name = `aaa-ceiling-damp-${config.name}`;
                ceilingStain.rotation.set(Math.PI / 2, 0, config.rotation + 0.2);
                ceilingStain.scale.set(config.patch[0] * 0.55, config.patch[1] * 0.52, 1);
                ceilingStain.position.set(config.x, config.sourceY + 0.018, config.z);
                ceilingStain.renderOrder = 1;
                this.scene.add(ceilingStain);

                const source = new THREE.Mesh(
                    new THREE.RingGeometry(0.012, 0.036, 18),
                    new THREE.MeshBasicMaterial({ color: 0x07090a, transparent: true, opacity: 0.86, side: THREE.DoubleSide })
                );
                source.name = `aaa-leak-source-${config.name}`;
                source.rotation.x = Math.PI / 2;
                source.position.set(config.x, config.sourceY - 0.004, config.z);
                this.scene.add(source);

                const waterMaterial = new THREE.MeshBasicMaterial({
                    color: 0xa7bcc1,
                    transparent: true,
                    opacity: 0.5,
                    depthWrite: false,
                    blending: THREE.NormalBlending
                });
                const sourceBead = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), waterMaterial);
                sourceBead.name = `aaa-leak-bead-${config.name}`;
                sourceBead.position.set(config.x, config.sourceY - 0.023, config.z);
                sourceBead.renderOrder = 5;
                this.scene.add(sourceBead);

                const floorSurfaceY = -0.01;
                const dropRadius = 0.0095;
                const dropGeometry = new THREE.SphereGeometry(dropRadius, 10, 8);
                const ringGeometry = new THREE.PlaneGeometry(2, 2);
                const splashGeometry = new THREE.PlaneGeometry(2, 2);
                const splashBeadGeometry = new THREE.SphereGeometry(0.005, 10, 8);
                const cycles = [];
                for (let cycleIndex = 0; cycleIndex < 2; cycleIndex += 1) {
                    const drop = new THREE.Mesh(dropGeometry, waterMaterial.clone());
                    drop.name = `aaa-leak-drop-${config.name}-${cycleIndex}`;
                    drop.visible = false;
                    drop.renderOrder = 5;
                    this.scene.add(drop);

                    const rippleMaterial = new THREE.MeshBasicMaterial({ color: 0xa1b6ba, alphaMap: rippleTexture, transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide, blending: THREE.NormalBlending });
                    const ripple = new THREE.Mesh(ringGeometry, rippleMaterial);
                    ripple.name = `aaa-leak-ripple-${config.name}-${cycleIndex}`;
                    ripple.rotation.x = -Math.PI / 2;
                    ripple.rotation.z = config.rotation + cycleIndex * 1.37;
                    ripple.position.set(config.x, -0.004, config.z);
                    ripple.visible = false;
                    ripple.renderOrder = 4;
                    this.scene.add(ripple);

                    const secondRipple = new THREE.Mesh(ringGeometry, rippleMaterial.clone());
                    secondRipple.name = `aaa-leak-ripple-secondary-${config.name}-${cycleIndex}`;
                    secondRipple.rotation.x = -Math.PI / 2;
                    secondRipple.rotation.z = config.rotation - 0.8 - cycleIndex * 1.11;
                    secondRipple.position.set(config.x, -0.0035, config.z);
                    secondRipple.visible = false;
                    secondRipple.renderOrder = 3;
                    this.scene.add(secondRipple);

                    const splash = new THREE.Mesh(splashGeometry, rippleMaterial.clone());
                    splash.name = `aaa-leak-splash-${config.name}-${cycleIndex}`;
                    splash.rotation.x = -Math.PI / 2;
                    splash.rotation.z = config.rotation + 0.45 + cycleIndex * 0.73;
                    splash.position.set(config.x, -0.003, config.z);
                    splash.visible = false;
                    splash.renderOrder = 2;
                    this.scene.add(splash);

                    const splashDroplets = [];
                    for (let beadIndex = 0; beadIndex < 7; beadIndex += 1) {
                        const bead = new THREE.Mesh(splashBeadGeometry, waterMaterial.clone());
                        bead.name = `aaa-leak-spray-${config.name}-${cycleIndex}-${beadIndex}`;
                        bead.visible = false;
                        bead.renderOrder = 5;
                        this.scene.add(bead);
                        splashDroplets.push({
                            mesh: bead,
                            angle: this.seededVFXUnit(0x53505259 + leakIndex, cycleIndex, beadIndex) * Math.PI * 2,
                            reach: 0.075 + this.seededVFXUnit(0x52454143 + leakIndex, cycleIndex, beadIndex) * 0.11,
                            height: 0.06 + this.seededVFXUnit(0x48454947 + leakIndex, cycleIndex, beadIndex) * 0.09
                        });
                    }
                    cycles.push({ drop, ripple, secondRipple, splash, splashDroplets, offset: cycleIndex / 2 });
                }
                this.waterLeaks.push({ ...config, floorSurfaceY, dropRadius, wetPatch, ceilingStain, sourceBead, cycles });
            });
        }

        seededVFXUnit(salt, index, channel) {
            let value = (this.qaSeed ^ salt ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca6b)) >>> 0;
            value ^= value >>> 16;
            value = Math.imul(value, 0x7feb352d) >>> 0;
            value ^= value >>> 15;
            value = Math.imul(value, 0x846ca68b) >>> 0;
            value ^= value >>> 16;
            return (value >>> 0) / 4294967296;
        }

        nextVFXRandom() {
            this.vfxSeed = (this.vfxSeed * 1664525 + 1013904223) >>> 0;
            return this.vfxSeed / 4294967296;
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

        createCurledPaper(name, width, height, position, rotation, material) {
            const depth = Math.min(0.006, width * 0.035);
            const geometry = new THREE.BoxGeometry(width, height, depth, 3, 6, 1);
            const vertices = geometry.attributes.position;
            for (let i = 0; i < vertices.count; i += 1) {
                const normalizedY = vertices.getY(i) / height + 0.5;
                const normalizedX = vertices.getX(i) / width;
                const curl = Math.pow(Math.abs(normalizedY - 0.5) * 2, 2) * 0.024
                    + Math.sin(normalizedY * Math.PI * 2 + normalizedX) * 0.004;
                vertices.setZ(i, vertices.getZ(i) + curl);
            }
            vertices.needsUpdate = true;
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = name;
            mesh.position.set(position[0], position[1], position[2]);
            mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        }

        addBox(name, size, position, material, castShadow) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2], 2, 2, 2), material);
            mesh.name = name;
            mesh.position.set(position[0], position[1], position[2]);
            mesh.castShadow = !!castShadow;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        }

        addBeveledBox(name, size, position, material, bevel, castShadow) {
            const width = size[0];
            const height = size[1];
            const depth = size[2];
            const radius = Math.min(bevel * 1.35, width * 0.18, height * 0.28);
            const halfW = width / 2;
            const halfH = height / 2;
            const shape = new THREE.Shape();
            shape.moveTo(-halfW + radius, -halfH);
            shape.lineTo(halfW - radius, -halfH);
            shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + radius);
            shape.lineTo(halfW, halfH - radius);
            shape.quadraticCurveTo(halfW, halfH, halfW - radius, halfH);
            shape.lineTo(-halfW + radius, halfH);
            shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - radius);
            shape.lineTo(-halfW, -halfH + radius);
            shape.quadraticCurveTo(-halfW, -halfH, -halfW + radius, -halfH);
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth,
                steps: 1,
                bevelEnabled: true,
                bevelSegments: 3,
                bevelSize: bevel,
                bevelThickness: bevel * 0.72,
                curveSegments: 6
            });
            geometry.translate(0, 0, -depth / 2);
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = name;
            mesh.position.set(position[0], position[1], position[2]);
            mesh.castShadow = !!castShadow;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        }

        addTaperedPrism(name, headWidth, footWidth, depth, height, position, material, bevel, castShadow) {
            const halfDepth = depth / 2;
            const shape = new THREE.Shape();
            shape.moveTo(-headWidth / 2, -halfDepth);
            shape.lineTo(headWidth / 2, -halfDepth);
            shape.lineTo(footWidth / 2, halfDepth);
            shape.lineTo(-footWidth / 2, halfDepth);
            shape.closePath();
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: height,
                steps: 1,
                bevelEnabled: true,
                bevelSegments: 3,
                bevelSize: bevel,
                bevelThickness: bevel * 0.72,
                curveSegments: 4
            });
            geometry.translate(0, 0, -height / 2);
            geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = name;
            mesh.position.set(position[0], position[1], position[2]);
            mesh.rotation.x = -Math.PI / 2;
            mesh.castShadow = !!castShadow;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            return mesh;
        }

        updateFlashlight() {
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            this.flashlight.position.copy(this.camera.position).add(new THREE.Vector3(0.12, -0.08, 0));
            this.flashlightTarget.position.copy(this.camera.position).add(direction.multiplyScalar(6));
            const doorDistance = this.camera.position.distanceTo(new THREE.Vector3(0, 1.25, -11.55));
            const distanceFactor = THREE.MathUtils.smoothstep(doorDistance, 1.4, 3.6);
            this.flashlight.intensity = THREE.MathUtils.lerp(42, 118, distanceFactor);
        }

        updateAtmosphere(delta) {
            if (this.fixedQATime === null) this.elapsed += delta;
            else this.elapsed = this.fixedQATime;
            this.updateCandles(this.elapsed);
            this.updateIncenseSmoke(this.elapsed);
            this.updateDust(this.elapsed);
            this.updateWaterLeaks(this.elapsed);
        }

        updateCandles(time) {
            this.flames.forEach((flame) => {
                const low = Math.sin(time * 6.8 + flame.phase);
                const high = Math.sin(time * 17.1 + flame.phase * 1.63);
                const tremor = Math.sin(time * 29.3 + flame.phase * 0.71);
                const signal = low * 0.54 + high * 0.31 + tremor * 0.15;
                const sway = Math.sin(time * 4.4 + flame.phase * 0.83) * 0.62 + high * 0.38;
                const height = 1 + signal * 0.085;
                const width = 1 - signal * 0.035;

                flame.outer.scale.set(0.13 * width, 0.24 * height, 1);
                flame.outer.position.set(
                    flame.anchor.x + sway * 0.008,
                    flame.anchor.y + 0.108 * height,
                    flame.anchor.z
                );
                flame.outer.material.rotation = -sway * 0.075;
                flame.outer.material.opacity = 0.68 + signal * 0.045;

                flame.core.scale.set(0.058 * (1 - signal * 0.02), 0.132 * (1 + signal * 0.055), 1);
                flame.core.position.set(
                    flame.anchor.x + sway * 0.0035,
                    flame.anchor.y + 0.058 * (1 + signal * 0.055),
                    flame.anchor.z + 0.002
                );
                flame.core.material.rotation = -sway * 0.045;
                flame.ember.scale.setScalar(0.93 + signal * 0.06);

                if (flame.light) {
                    flame.light.intensity = flame.lightBase * (0.935 + signal * 0.038 + low * 0.012);
                }
            });
        }

        updateIncenseSmoke(time) {
            this.smokeWisps.forEach((wisp, index) => {
                const ageValue = time / wisp.lifetime + wisp.phase;
                const age = ageValue - Math.floor(ageValue);
                const rise = Math.pow(age, 0.82);
                const fadeIn = THREE.MathUtils.smoothstep(age, 0.015, 0.14);
                const fadeOut = 1 - THREE.MathUtils.smoothstep(age, 0.62, 0.995);
                const opacity = fadeIn * fadeOut * (0.115 + (index % 3) * 0.01);
                const curlAngle = age * Math.PI * 3.2 + wisp.phase * Math.PI * 2;
                const curlRadius = wisp.curl * (0.35 + age * 1.35);
                wisp.mesh.position.set(
                    wisp.sourceX + Math.sin(curlAngle) * curlRadius + wisp.drift * age,
                    1.67 + rise * 1.22,
                    wisp.sourceZ + Math.cos(curlAngle * 0.72) * curlRadius * 0.42
                );
                wisp.mesh.scale.set(0.065 + age * 0.17, 0.17 + age * 0.38, 1);
                wisp.mesh.material.rotation = Math.sin(curlAngle * 0.58) * 0.34;
                wisp.mesh.material.opacity = opacity;
                wisp.mesh.visible = opacity > 0.0015;
            });
        }

        updateDust(time) {
            if (!this.dust || !this.dustBasePositions || !this.dustMotion) return;
            const positions = this.dust.geometry.attributes.position.array;
            this.dustMotion.forEach((motion, index) => {
                const offset = index * 3;
                const motionTime = time * motion.speed;
                positions[offset] = this.dustBasePositions[offset]
                    + (Math.sin(motionTime + motion.phaseX) - Math.sin(motion.phaseX)) * motion.amplitudeX;
                positions[offset + 1] = this.dustBasePositions[offset + 1]
                    + (Math.sin(motionTime * 0.79 + motion.phaseY) - Math.sin(motion.phaseY)) * motion.amplitudeY;
                positions[offset + 2] = this.dustBasePositions[offset + 2]
                    + (Math.sin(motionTime * 0.63 + motion.phaseZ) - Math.sin(motion.phaseZ)) * motion.amplitudeZ;
            });
            this.dust.geometry.attributes.position.needsUpdate = true;
        }

        updateWaterLeaks(time) {
            this.waterLeaks.forEach((leak) => {
                const beadPulse = 0.5 + Math.sin(time * Math.PI * 2 / leak.period + leak.phase * Math.PI * 2) * 0.5;
                leak.sourceBead.scale.setScalar(0.72 + beadPulse * 0.42);
                leak.sourceBead.material.opacity = 0.28 + beadPulse * 0.38;
                leak.cycles.forEach((cycle) => {
                    const cycleValue = time / leak.period + leak.phase + cycle.offset;
                    const age = cycleValue - Math.floor(cycleValue);
                    const fallEnd = 0.62;
                    const contactHold = 0.018;
                    const falling = age > 0.018 && age < fallEnd + contactHold;
                    cycle.drop.visible = falling;
                    if (falling) {
                        const fall = THREE.MathUtils.clamp((age - 0.018) / (fallEnd - 0.018), 0, 1);
                        const gravity = fall * fall;
                        const midStretch = Math.sin(Math.PI * THREE.MathUtils.clamp(fall / 0.9, 0, 1));
                        const impactRetraction = THREE.MathUtils.smoothstep(fall, 0.78, 1);
                        const stretchedScaleY = 1.18 + midStretch * 2.15;
                        const fallingScaleY = THREE.MathUtils.lerp(stretchedScaleY, 1.04, impactRetraction);
                        const contactAge = THREE.MathUtils.clamp((age - fallEnd) / contactHold, 0, 1);
                        const dropScaleY = THREE.MathUtils.lerp(fallingScaleY, 0.48, contactAge);
                        const dropScaleXZ = THREE.MathUtils.lerp(0.9, 1.28, contactAge);
                        const landingY = leak.floorSurfaceY + leak.dropRadius * dropScaleY + 0.001;
                        const sideDrift = Math.sin(fall * Math.PI * 1.4 + cycle.offset * Math.PI * 2) * 0.006 * fall;
                        cycle.drop.position.set(
                            leak.x + sideDrift,
                            THREE.MathUtils.lerp(leak.sourceY - 0.035, landingY, gravity),
                            leak.z + Math.cos(fall * Math.PI * 1.1 + cycle.offset) * 0.004 * fall
                        );
                        cycle.drop.scale.set(dropScaleXZ, dropScaleY, dropScaleXZ);
                    }

                    const splashAge = (age - fallEnd) / 0.17;
                    const splashVisible = splashAge >= 0 && splashAge < 1;
                    cycle.splash.visible = splashVisible;
                    if (splashVisible) {
                        const radius = 0.022 + splashAge * 0.065;
                        cycle.splash.scale.set(radius, radius, 1);
                        cycle.splash.material.opacity = (1 - splashAge) * 0.11;
                    }
                    cycle.splashDroplets.forEach((droplet) => {
                        droplet.mesh.visible = splashVisible;
                        if (!splashVisible) return;
                        const radial = droplet.reach * splashAge;
                        droplet.mesh.position.set(
                            leak.x + Math.cos(droplet.angle) * radial,
                            -0.004 + droplet.height * 4 * splashAge * (1 - splashAge),
                            leak.z + Math.sin(droplet.angle) * radial
                        );
                        droplet.mesh.scale.setScalar(0.75 + (1 - splashAge) * 0.45);
                    });

                    const rippleAge = (age - fallEnd) / 0.34;
                    const rippleVisible = rippleAge >= 0 && rippleAge < 1;
                    cycle.ripple.visible = rippleVisible;
                    if (rippleVisible) {
                        const eased = 1 - Math.pow(1 - rippleAge, 2);
                        const radius = 0.038 + eased * 0.18;
                        cycle.ripple.scale.set(radius, radius, 1);
                        cycle.ripple.material.opacity = Math.sin(rippleAge * Math.PI) * 0.09;
                    }

                    const secondAge = (age - fallEnd - 0.075) / 0.28;
                    const secondVisible = secondAge >= 0 && secondAge < 1;
                    cycle.secondRipple.visible = secondVisible;
                    if (secondVisible) {
                        const eased = 1 - Math.pow(1 - secondAge, 2);
                        const radius = 0.027 + eased * 0.12;
                        cycle.secondRipple.scale.set(radius, radius, 1);
                        cycle.secondRipple.material.opacity = Math.sin(secondAge * Math.PI) * 0.05;
                    }
                });
            });
        }

        updateCameraResponse(delta) {
            if (!this.controls || !this.lastCameraXZ || delta <= 0) return;
            const dx = this.camera.position.x - this.lastCameraXZ.x;
            const dz = this.camera.position.z - this.lastCameraXZ.y;
            const distance = Math.hypot(dx, dz);
            this.lastCameraXZ.set(this.camera.position.x, this.camera.position.z);
            const expectedDistance = Math.max(this.controls.speed * delta, 0.0001);
            const targetWeight = THREE.MathUtils.clamp(distance / expectedDistance, 0, 1);
            const response = targetWeight > this.movementWeight ? 10.5 : 6.5;
            const damping = 1 - Math.exp(-response * delta);
            this.movementWeight = THREE.MathUtils.lerp(this.movementWeight, targetWeight, damping);
            this.stepPhase += distance * 4.8;
            const vertical = Math.sin(this.stepPhase * 2) * 0.0095 * this.movementWeight;
            const roll = Math.sin(this.stepPhase) * 0.0042 * this.movementWeight;
            this.camera.position.y += vertical;
            this.camera.rotateZ(roll);
        }

        animate() {
            this.animationId = requestAnimationFrame(() => this.animate());
            const delta = Math.min(this.clock.getDelta(), 0.05);
            if (!this.qaCaptureMode) {
                this.controls.update(delta);
                this.updateCameraResponse(delta);
                this.interaction.update();
            }
            this.updateAtmosphere(delta);
            this.updateFlashlight();
            this.renderer.render(this.scene, this.camera);
        }

        resize() {
            if (!this.renderer || !this.camera) return;
            this.camera.aspect = this.root.clientWidth / this.root.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.root.clientWidth, this.root.clientHeight);
        }

        setQATime(value) {
            const time = Number(value);
            if (!Number.isFinite(time)) return false;
            this.qaCaptureMode = true;
            this.fixedQATime = Math.max(0, time);
            this.elapsed = this.fixedQATime;
            this.updateAtmosphere(0);
            return true;
        }

        renderAt(value) {
            if (!this.setQATime(value)) return false;
            this.updateFlashlight();
            this.renderer.compile(this.scene, this.camera);
            this.renderer.render(this.scene, this.camera);
            return true;
        }

        setCapturePose(name) {
            const poses = {
                hero: { position: [2.55, 1.48, 2.35], target: [0, 0.72, 0.72] },
                altar: { position: [1.72, 1.5, -0.42], target: [0, 1.12, -3.0] },
                angle: { position: [-3.15, 1.58, 2.62], target: [0, 0.68, 0.64] },
                wetLeak: { position: [2.4, 1.48, -0.42], target: [-2.18, 1.54, -1.55], fov: 48 },
                wetSurface: { position: [0.58, 1.12, -0.35], target: [-2.18, 0.1, -1.72], fov: 50 },
                corridorLeak: { position: [-0.72, 1.4, -5.28], target: [0.86, 1.47, -7.77], fov: 58 },
                corridor: { position: [0, 1.55, -5.1], target: [0, 1.38, -10.8] },
                doorLock: { position: [-0.9, 1.45, -9.3], target: [0.72, 1.25, -10.92] },
                doorCrack: { position: [0.28, 1.32, -9.95], target: [0, 1.03, -11.2] }
            };
            const pose = poses[name];
            if (!pose || !this.controls) return false;
            this.qaCaptureMode = true;
            const position = new THREE.Vector3(...pose.position);
            const target = new THREE.Vector3(...pose.target);
            const direction = target.clone().sub(position).normalize();
            this.camera.position.copy(position);
            this.camera.fov = pose.fov ?? 61;
            this.camera.updateProjectionMatrix();
            this.controls.yaw = Math.atan2(direction.x, direction.z);
            this.controls.pitch = Math.asin(direction.y);
            this.controls.applyLook();
            return true;
        }

        disposeSceneResources() {
            if (!this.scene) return;
            const geometries = new Set();
            const materials = new Set();
            const textures = new Set();
            const collectTexture = (value) => {
                if (value && value.isTexture) textures.add(value);
            };
            const collectMaterial = (material) => {
                if (!material || materials.has(material)) return;
                materials.add(material);
                Object.values(material).forEach(collectTexture);
                if (material.uniforms) {
                    Object.values(material.uniforms).forEach((uniform) => collectTexture(uniform && uniform.value));
                }
            };
            this.scene.traverse((object) => {
                if (object.geometry) geometries.add(object.geometry);
                if (Array.isArray(object.material)) object.material.forEach(collectMaterial);
                else collectMaterial(object.material);
            });
            Object.values(this.textures || {}).forEach(collectTexture);
            collectTexture(this.detailMap);
            collectTexture(this.flameTexture);
            geometries.forEach((geometry) => geometry.dispose());
            materials.forEach((material) => material.dispose());
            textures.forEach((texture) => texture.dispose());
            this.rippleTexture = null;
            this.flames.length = 0;
            this.flickerLights.length = 0;
            this.smokeWisps.length = 0;
            this.waterLeaks.length = 0;
            this.dust = null;
        }

        dispose() {
            if (this.animationId) cancelAnimationFrame(this.animationId);
            if (this.controls) this.controls.dispose();
            if (this.interaction) this.interaction.dispose();
            global.removeEventListener('resize', this.onResize);
            if (this.renderer) {
                this.disposeSceneResources();
                if (this.renderer.renderLists) this.renderer.renderLists.dispose();
                this.renderer.dispose();
                this.renderer.domElement.remove();
            }
        }
    }

    Huisha3D.AAAExperienceScene = AAAExperienceScene;
})(window);
