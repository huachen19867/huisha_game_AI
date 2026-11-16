import { Maps } from '../data/Maps.js';
import { getRoomObjects } from './MemoryEchoes.js';
import { ManorPresentation } from './ManorPresentation.js';

export class MapManager {
    static fitFurnitureBody(obj, collision) {
        // Refresh the full image first, then apply the authored floor footprint.
        obj.body.setOffset(0, 0);
        if (typeof obj.refreshBody === 'function') obj.refreshBody();
        else obj.body.updateFromGameObject();
        obj.body.setSize(collision.width, collision.height, false);
        obj.body.setOffset(collision.x, collision.y);
        obj.body.immovable = true;
    }

    static syncCabinetBody(obj) {
        if (!obj.body) return;
        // refreshBody restores full image bounds but retains the old offset.
        // Reset it first, then apply the foot-sized body at the new position.
        obj.body.setOffset(0, 0);
        obj.refreshBody();
        obj.body.setSize(obj.displayWidth * 0.8, obj.displayHeight * 0.3, false);
        obj.body.setOffset(obj.displayWidth * 0.1, obj.displayHeight * 0.7);
    }

    constructor(scene) {
        this.scene = scene;
        this.walls = null;
        this.doors = null;
        this.photos = null;
        this.furniture = null;
        this.floorLayer = [];
    }

    restorePlayerStart(sprite) {
        const map = Maps[this.scene.currentMapId];
        if (!map.objects.furnishings?.length) return;
        const offsetX = -sprite.displayWidth * sprite.originX + sprite.body.offset.x * sprite.scaleX;
        const offsetY = -sprite.displayHeight * sprite.originY + sprite.body.offset.y * sprite.scaleY;
        const fits = (x, y) => {
            const left = x + offsetX, top = y + offsetY;
            const right = left + sprite.body.width, bottom = top + sprite.body.height;
            for (let ty = Math.floor(top / 32); ty <= Math.floor((bottom - 0.01) / 32); ty++) {
                for (let tx = Math.floor(left / 32); tx <= Math.floor((right - 0.01) / 32); tx++) {
                    if (map.data[ty]?.[tx] !== 0) return false;
                }
            }
            return !this.furniture.getChildren().some(item => {
                const body = item.body;
                return item.active && body?.enable && left < body.x + body.width && right > body.x && top < body.y + body.height && bottom > body.y;
            });
        };
        if (fits(sprite.x, sprite.y)) return;
        const candidates = [];
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
            const px = x * 32 + 16, py = y * 32 + 16;
            if (fits(px, py)) candidates.push({ x: px, y: py, distance: Math.hypot(px - sprite.x, py - sprite.y) });
        }
        candidates.sort((a, b) => a.distance - b.distance);
        if (candidates.length) sprite.body.reset(candidates[0].x, candidates[0].y);
    }

    refreshMemoryEchoes() {
        ManorPresentation.syncCoffin(this.scene);
        if (this.scene.currentMapId !== 'room_corridor') return;
        const objects = getRoomObjects('room_corridor', this.scene.gameState);
        for (const data of objects.photos) {
            const photo = this.photos.getChildren().find(item => item.photoId === data.id);
            if (!photo) continue;
            photo.setTexture(data.texture || 'photo_frame');
            if (data.tint !== undefined) photo.setTint(data.tint);
            else photo.clearTint();
            photo.dialogText = data.text;
            photo.documentTitle = data.title;
        }
        const existing = new Set(this.scene.interactables.getChildren().filter(item => item.active).map(item => item.objId));
        const additions = objects.interactables.filter(item => !existing.has(item.id));
        if (additions.length) this.createObjects({ interactables: additions }, 'room_corridor');
    }

    createMap(mapId) {
        const mapDef = Maps[mapId];
        if (!mapDef) {
            console.error('Map not found:', mapId);
            return;
        }

        const mapData = mapDef.data;
        const visual = mapDef.visual || {};
        const roomObjects = getRoomObjects(mapId, this.scene.gameState);
        const presentationMap = { ...mapDef, objects: roomObjects };

        // Set World Bounds
        const mapWidth = mapDef.width * 32;
        const mapHeight = mapDef.height * 32;
        this.scene.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        this.scene.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

        // Memory Room Special Settings
        // On mobile, use simple lighting for ALL maps to improve performance
        if (mapId === 'room_memory' || this.scene.isMobile) {
            this.scene.lights.enable().setAmbientColor(0xffffff); // Full bright / No dynamic lights
        } else if (visual.ambient !== undefined) {
            this.scene.lights.enable();
            this.scene.lights.setAmbientColor(visual.ambient);
        } else {
            // Standard Horror Settings (PC Only)
            this.scene.lights.enable();
            this.scene.lights.setAmbientColor(0x666666);
        }

        // Initialize groups
        // We use scene-level properties because GameScene/InteractionManager expects them
        if (!this.scene.walls) this.scene.walls = this.scene.physics.add.staticGroup();
        if (!this.scene.doors) this.scene.doors = this.scene.add.group();
        if (!this.scene.photos) this.scene.photos = this.scene.physics.add.staticGroup();

        // Internal reference for convenience
        this.walls = this.scene.walls;
        this.doors = this.scene.doors;
        this.photos = this.scene.photos;

        // New group for furniture to simplify collision
        this.furniture = this.scene.physics.add.staticGroup();
        this.scene.furniture = this.furniture;
        this.scene.interactables = this.scene.physics.add.staticGroup(); // Unified interactables group

        this.floorLayer = [];
        this.scene.floorLayer = this.floorLayer;

        for (let y = 0; y < mapData.length; y++) {
            for (let x = 0; x < mapData[y].length; x++) {
                // Determine textures based on map type
                const floorTex = ManorPresentation.floorTexture(mapId);
                let wallTex = 'tile_wall';

                if (mapId === 'room_entrance' || mapId === 'room_backyard' || mapId === 'room_prologue') {
                    wallTex = 'tile_hedge';
                }

                const tile = this.scene.add.image(x * 32 + 16, y * 32 + 16, floorTex);
                if (visual.floorTint !== undefined) tile.setTint(visual.floorTint);

                // Only apply Light2D pipeline on PC and non-memory maps
                if (mapId !== 'room_memory' && !this.scene.isMobile) {
                    tile.setPipeline('Light2D');
                }

                this.floorLayer.push(tile);

                if (mapData[y][x] === 1) {
                    const wall = this.walls.create(x * 32 + 16, y * 32 + 16, wallTex);
                    if (visual.wallTint !== undefined) wall.setTint(visual.wallTint);
                    if (mapId !== 'room_memory' && !this.scene.isMobile) {
                        wall.setPipeline('Light2D');
                    }
                } else {
                    const mark = ManorPresentation.floorDebris(presentationMap, x, y);
                    if (mark) {
                        const debris = this.scene.add.image(mark.x, mark.y, 'floor_scuff');
                        debris.setRotation(mark.rotation);
                        debris.setAlpha(0.45);
                        if (visual.paperTint !== undefined) debris.setTint(visual.paperTint);
                        if (mapId !== 'room_memory' && !this.scene.isMobile) debris.setPipeline('Light2D');
                        this.floorLayer.push(debris);
                    }
                }
            }
        }

        this.createObjects(roomObjects, mapId);
    }

    createObjects(objs, mapId) {
        const scene = this.scene;
        const isHorror = mapId !== 'room_memory';

        // Helper to add to interactables
        const addToInteractables = (obj, data) => {
            if (data && (data.dialog || data.id || data.documentText)) {
                this.scene.interactables.add(obj);
                if (data.dialog) obj.dialog = data.dialog;
                if (data.id) obj.objId = data.id;
                if (data.interactLabel) obj.interactLabel = data.interactLabel;
            }
        };

        // Helper to setup furniture physics (smaller collision box)
        const setupFurniture = (obj, isInteractable = true) => {
            if (obj.body) {
                // Default to bottom 1/3 for collision to allow "walking behind" effect
                const w = obj.width;
                const h = obj.height;
                obj.body.setSize(w * 0.8, h * 0.3);
                obj.body.setOffset(w * 0.1, h * 0.7);
            }
        };

        for (const data of objs.furnishings || []) {
            const item = data.collision ? this.furniture.create(data.x, data.y, data.texture) : scene.add.image(data.x, data.y, data.texture);
            if (isHorror && !scene.isMobile) item.setPipeline('Light2D');
            if (data.alpha !== undefined) item.setAlpha(data.alpha);
            if (data.collision) MapManager.fitFurnitureBody(item, data.collision);
            else item.setDepth(10);
        }

        if (objs.photos) {
            objs.photos.forEach(photoData => {
                const photo = this.photos.create(photoData.x, photoData.y, photoData.texture || 'photo_frame');
                if (isHorror) photo.setPipeline('Light2D');
                if (photoData.tint !== undefined) photo.setTint(photoData.tint);
                photo.photoId = photoData.id;
                photo.dialogText = photoData.text;
                photo.documentTitle = photoData.title;
                // Photos are handled specifically in InteractionManager but we can add them to interactables too
                this.scene.interactables.add(photo);
            });
        }

        if (objs.coffin) {
            scene.coffin = this.furniture.create(objs.coffin.x, objs.coffin.y, ManorPresentation.coffinTexture(scene.gameState));
            if (isHorror) scene.coffin.setPipeline('Light2D');
            setupFurniture(scene.coffin);
            // Explicitly set immovable and refresh
            if (scene.coffin.body) {
                scene.coffin.body.immovable = true;
                scene.coffin.refreshBody();
            }
            addToInteractables(scene.coffin, objs.coffin);
        }

        if (objs.altar) {
            scene.altar = this.furniture.create(objs.altar.x, objs.altar.y, 'altar');
            if (isHorror) scene.altar.setPipeline('Light2D');
            setupFurniture(scene.altar);
            addToInteractables(scene.altar, { ...objs.altar, id: 'altar' });

            scene.leftCandle = scene.add.sprite(objs.altar.x - 30, objs.altar.y - 10, 'candle').setAlpha(0.3);
            scene.rightCandle = scene.add.sprite(objs.altar.x + 30, objs.altar.y - 10, 'candle').setAlpha(0.3);
            if (isHorror) {
                scene.leftCandle.setPipeline('Light2D');
                scene.rightCandle.setPipeline('Light2D');
            }

            // ManorPresentation restores partial offerings and candle light after depth setup.
        }

        if (objs.stove) {
            scene.stove = this.furniture.create(objs.stove.x, objs.stove.y, 'stove');
            if (isHorror) scene.stove.setPipeline('Light2D');
            setupFurniture(scene.stove);
            addToInteractables(scene.stove, objs.stove);
        }

        if (objs.dirt) {
             scene.dirtPile = this.furniture.create(objs.dirt.x, objs.dirt.y, 'tile_mud'); // Reuse mud tile
             scene.dirtPile.setScale(0.8);
             if (isHorror) scene.dirtPile.setPipeline('Light2D');
             addToInteractables(scene.dirtPile, { ...objs.dirt, dialog: '奇怪的土堆' });

             scene.add.particles(objs.dirt.x, objs.dirt.y, 'rain', {
                 speed: 10,
                 scale: { start: 0.5, end: 0 },
                 alpha: { start: 0.5, end: 0 },
                 lifespan: 500,
                 quantity: 1,
                 frequency: 500,
                 tint: 0xffff00
             }).setDepth(100);
        }

        if (objs.npc) {
            scene.npc = this.furniture.create(objs.npc.x, objs.npc.y, 'npc_paper');
            if (isHorror && !scene.isMobile) scene.npc.setPipeline('Light2D');

            // Interaction setup
            scene.npc.objId = 'kitchen_ghost';
            scene.npc.refreshBody(); // Ensure body is active


            if (scene.gameState.hasRice && scene.gameState.hasMatches) {
                 scene.npc.setVisible(false);
                 scene.npc.body.enable = false;
            }
            // NPC interaction is distance based in InteractionManager, but adding to group doesn't hurt
            this.scene.interactables.add(scene.npc);
        }

        if (objs.well) {
            scene.well = this.furniture.create(objs.well.x, objs.well.y, scene.gameState.hasRedKey ? 'well_empty' : 'well');
            if (isHorror && !scene.isMobile) scene.well.setPipeline('Light2D');
            addToInteractables(scene.well, objs.well);
        }

        if (objs.trees) {
            scene.trees = scene.physics.add.staticGroup();
            objs.trees.forEach(treeData => {
                const tree = scene.trees.create(treeData.x, treeData.y, 'tree');
                if (isHorror && !scene.isMobile) tree.setPipeline('Light2D');
            });
        }

        if (objs.chest) {
             scene.chest = this.furniture.create(objs.chest.x, objs.chest.y, 'cabinet');
             if (isHorror && !scene.isMobile) scene.chest.setPipeline('Light2D');
             scene.chest.setTint(0xffd700); // Gold tint
             scene.chest.setAlpha(0.01);
             setupFurniture(scene.chest);
             addToInteractables(scene.chest, objs.chest);
        }

        if (objs.car) {
             scene.car = this.furniture.create(objs.car.x, objs.car.y, 'car');
             if (isHorror && !scene.isMobile) scene.car.setPipeline('Light2D');
             scene.car.body.setSize(60, 100);
             scene.car.body.setOffset(2, 14);
             // No setupFurniture here as it has custom bounds already
             addToInteractables(scene.car, objs.car);
        }

        if (objs.cabinet) {
            const supply = objs.cabinet.supply;
            const texture = supply ? (scene.gameState[supply.flag] ? supply.emptyTexture : supply.texture) : 'cabinet';
            scene.cabinet = this.furniture.create(objs.cabinet.x, objs.cabinet.y, texture);
            if (isHorror && !scene.isMobile) scene.cabinet.setPipeline('Light2D');
            if (objs.cabinet.id === 'parents_cabinet' && scene.gameState.cabinetMoved) {
                scene.cabinet.x -= 32;
            }
            if (objs.cabinet.id === 'parents_cabinet') MapManager.syncCabinetBody(scene.cabinet);
            else setupFurniture(scene.cabinet);
            addToInteractables(scene.cabinet, objs.cabinet);
        }

        if (objs.bed) {
            scene.bed = this.furniture.create(objs.bed.x, objs.bed.y, 'bed');
            if (isHorror && !scene.isMobile) scene.bed.setPipeline('Light2D');
            setupFurniture(scene.bed);
            addToInteractables(scene.bed, objs.bed);
        }

        if (objs.desk) {
            const supply = objs.desk.supply;
            const texture = supply ? (scene.gameState[supply.flag] ? supply.emptyTexture : supply.texture) : 'desk';
            scene.desk = this.furniture.create(objs.desk.x, objs.desk.y, texture);
            if (isHorror && !scene.isMobile) scene.desk.setPipeline('Light2D');
            setupFurniture(scene.desk);
            addToInteractables(scene.desk, objs.desk);
        }

        if (objs.diary) {
             // A book rests above the desk; it is not a separate furniture obstacle.
             scene.diary = scene.add.image(objs.diary.x, objs.diary.y, 'diary').setDepth(21);
             scene.physics.add.existing(scene.diary, true);
             scene.diary.documentTitle = objs.diary.documentTitle;
             scene.diary.documentText = objs.diary.documentText;
             scene.diary.clueId = objs.diary.clueId;
             scene.diary.clueType = objs.diary.clueType;
             if (isHorror && !scene.isMobile) scene.diary.setPipeline('Light2D');
             addToInteractables(scene.diary, objs.diary);
        }

        if (objs.sink) {
             scene.sink = this.furniture.create(objs.sink.x, objs.sink.y, 'kitchen_sink');
             if (isHorror && !scene.isMobile) scene.sink.setPipeline('Light2D');
             addToInteractables(scene.sink, objs.sink);
        }

        if (objs.mirror) {
             scene.mirror = scene.add.rectangle(objs.mirror.x, objs.mirror.y, 40, 10, 0xaaaaaa, 0.5);
             if (isHorror && !scene.isMobile) scene.mirror.setPipeline('Light2D');
             scene.physics.add.existing(scene.mirror, true);
             addToInteractables(scene.mirror, objs.mirror);
        }

        if (objs.toilet) {
             scene.toilet = this.furniture.create(objs.toilet.x, objs.toilet.y, 'toilet');
             if (isHorror && !scene.isMobile) scene.toilet.setPipeline('Light2D');
             addToInteractables(scene.toilet, objs.toilet);
        }

        if (objs.crashed_car) {
             scene.crashed_car = this.furniture.create(objs.crashed_car.x, objs.crashed_car.y, 'car');
             if (isHorror && !scene.isMobile) scene.crashed_car.setPipeline('Light2D');
             scene.crashed_car.documentTitle = objs.crashed_car.documentTitle;
             scene.crashed_car.documentText = objs.crashed_car.documentText;
             addToInteractables(scene.crashed_car, objs.crashed_car);
        }

        if (objs.medical_record) {
            scene.medical_record = this.scene.add.image(objs.medical_record.x, objs.medical_record.y, 'document_page');
            if (isHorror) scene.medical_record.setPipeline('Light2D');
            scene.medical_record.setTint(0xffaaaa);
            scene.medical_record.objId = 'medical_record';
            this.scene.interactables.add(scene.medical_record);
            addToInteractables(scene.medical_record, objs.medical_record);
        }

        if (objs.family_rules) {
            // Change to physics object (furniture) for collision
            scene.family_rules = this.furniture.create(objs.family_rules.x, objs.family_rules.y, 'photo_frame');
            if (isHorror && !scene.isMobile) scene.family_rules.setPipeline('Light2D');
            scene.family_rules.setTint(0xffaaaa);

            // Setup physics body
            if (scene.family_rules.body) {
                scene.family_rules.body.immovable = true;
                // Make it a thin strip at the top wall
                scene.family_rules.body.setSize(32, 10);
                scene.family_rules.body.setOffset(0, 20);
                scene.family_rules.refreshBody();
            }

            // Force add to interactables since it has no dialog/id in map data
            this.scene.interactables.add(scene.family_rules);
            addToInteractables(scene.family_rules, objs.family_rules);
        }

        if (objs.safe) {
            scene.safe = this.furniture.create(objs.safe.x, objs.safe.y, scene.gameState.inventory.includes('地下室钥匙') ? 'safe_open' : 'safe');
            if (isHorror) scene.safe.setPipeline('Light2D');

            // Explicitly ensure physics body is active and immovable
            if (scene.safe.body) {
                scene.safe.body.enable = true;
                scene.safe.body.immovable = true;
                // Increase collision box height to prevent "walking through" feeling
                // Was 0.3, increasing to 0.5
                const w = scene.safe.width;
                const h = scene.safe.height;
                scene.safe.body.setSize(w * 0.9, h * 0.5);
                scene.safe.body.setOffset(w * 0.05, h * 0.5);
                scene.safe.refreshBody(); // Important for Static Bodies!
            }

            // Force add to interactables (even if no dialog/id in map data)
            this.scene.interactables.add(scene.safe);
            addToInteractables(scene.safe, objs.safe);
        }

        if (objs.wet_paper) {
            scene.wet_paper = this.scene.add.image(objs.wet_paper.x, objs.wet_paper.y, 'document_page');
            if (isHorror) scene.wet_paper.setPipeline('Light2D');
            scene.wet_paper.setTint(0x9fb6a6);
            scene.wet_paper.objId = 'wet_paper';
            this.scene.interactables.add(scene.wet_paper);
            addToInteractables(scene.wet_paper, objs.wet_paper);
        }

        if (objs.incense && !scene.gameState.hasIncense) {
            scene.incense = this.scene.add.image(objs.incense.x, objs.incense.y, 'incense_bundle');
            if (isHorror) scene.incense.setPipeline('Light2D');
            addToInteractables(scene.incense, objs.incense);

            scene.add.particles(objs.incense.x, objs.incense.y, 'rain', {
                speed: { min: 10, max: 20 },
                scale: { start: 0.3, end: 0 },
                alpha: { start: 0.5, end: 0 },
                lifespan: 1000,
                quantity: 1,
                frequency: 200,
                tint: 0xffffff
            }).setDepth(100);
        }

        if (objs.spirit_money && !scene.gameState.hasSpiritMoney) {
            scene.spirit_money = this.scene.add.image(objs.spirit_money.x, objs.spirit_money.y, 'spirit_money_bundle');
            if (isHorror) scene.spirit_money.setPipeline('Light2D');
            addToInteractables(scene.spirit_money, objs.spirit_money);
        }

        if (objs.red_key) {
            if (!scene.gameState.hasRedKey) {
                scene.red_key = this.scene.add.image(objs.red_key.x, objs.red_key.y, 'red_key');
                if (isHorror) scene.red_key.setPipeline('Light2D');
                addToInteractables(scene.red_key, objs.red_key);
            }
        }

        if (objs.toy_plane) {
            scene.toy_plane = this.scene.add.image(objs.toy_plane.x, objs.toy_plane.y, 'toy_plane');
            if (isHorror) scene.toy_plane.setPipeline('Light2D');
            addToInteractables(scene.toy_plane, objs.toy_plane);
        }

        if (objs.toys) {
            scene.toys = scene.physics.add.staticGroup();
            objs.toys.forEach(toyData => {
                const toy = scene.toys.create(toyData.x, toyData.y, toyData.frame);
                if (isHorror) toy.setPipeline('Light2D');
                if (toyData.dialog) {
                    toy.dialog = toyData.dialog;
                    this.scene.interactables.add(toy);
                }
            });
        }

        if (objs.scratches) {
            // Scratches as decals (no physics)
            objs.scratches.forEach(scratchData => {
                const scratch = this.scene.add.image(scratchData.x, scratchData.y, 'scratch');
                if (isHorror) scratch.setPipeline('Light2D');
                if (scratchData.dialog) {
                    scratch.dialog = scratchData.dialog;
                    this.scene.interactables.add(scratch);
                }
            });
        }

        if (objs.notes) {
            // Notes are static group but should not collide?
            // Actually let's use images for notes on floor
            objs.notes.forEach(noteData => {
                const note = this.scene.add.image(noteData.x, noteData.y, 'trash_paper');
                note.setTint(0xffcc00);
                if (isHorror) note.setPipeline('Light2D');
                if (noteData.dialog) {
                    note.dialog = noteData.dialog;
                    this.scene.interactables.add(note);
                }
            });
        }

        if (objs.locked_window) {
            scene.locked_window = scene.add.image(objs.locked_window.x, objs.locked_window.y, objs.locked_window.texture);
            scene.locked_window.documentTitle = objs.locked_window.documentTitle;
            scene.locked_window.documentText = objs.locked_window.documentText;
            scene.locked_window.clueId = objs.locked_window.clueId;
            scene.locked_window.clueType = objs.locked_window.clueType;
            if (isHorror && !scene.isMobile) scene.locked_window.setPipeline('Light2D');
            scene.physics.add.existing(scene.locked_window, true);
            addToInteractables(scene.locked_window, objs.locked_window);
        }

        if (objs.exit_door) {
            scene.exit_door = scene.add.rectangle(objs.exit_door.x, objs.exit_door.y, 64, 32, 0xff0000, 0);
            scene.physics.add.existing(scene.exit_door, true);
            addToInteractables(scene.exit_door, objs.exit_door);
        }

        if (objs.interactables) {
            objs.interactables.forEach(data => {
                const isPaperDocument = data.documentText && (!data.texture || data.texture === 'trash_paper');
                const texture = isPaperDocument ? 'document_page' : data.texture || 'trash_paper';
                const item = scene.add.image(data.x, data.y, texture);
                if (data.tint !== undefined) item.setTint(data.tint);
                if (data.alpha !== undefined) item.setAlpha(data.alpha);
                if (data.scale !== undefined) item.setScale(data.scale);
                if (isHorror && !scene.isMobile) item.setPipeline('Light2D');

                scene.physics.add.existing(item, true);
                if (typeof item.refreshBody === 'function') {
                    item.refreshBody();
                } else if (item.body && typeof item.body.updateFromGameObject === 'function') {
                    item.body.updateFromGameObject();
                }

                if (data.collision) {
                    this.furniture.add(item);
                    MapManager.fitFurnitureBody(item, data.collision);
                }

                item.objId = data.id;
                item.dialog = data.dialog;
                item.documentTitle = data.documentTitle;
                item.documentText = data.documentText;
                item.clueId = data.clueId;
                item.clueType = data.clueType;
                item.memoryTrigger = data.memoryTrigger;
                item.memoryReturn = data.memoryReturn;
                item.memoryComplete = data.memoryComplete;
                item.openingFlag = data.openingFlag;
                item.endingChoice = data.endingChoice;
                item.endingWeight = data.endingWeight;
                item.interactLabel = data.interactLabel;
                scene.interactables.add(item);
            });
        }

        if (objs.doors) {
            objs.doors.forEach(doorData => {
                const w = (doorData.w || 1) * 32;
                const h = (doorData.h || 1) * 32;
                const cx = (doorData.x * 32) + (w / 2);
                const cy = (doorData.y * 32) + (h / 2);

                const door = scene.add.rectangle(cx, cy, w + 16, h + 16, 0x00ff00, 0);
                scene.physics.add.existing(door, true);

                // Visual Indicator for Attic Door (since it's just a wall otherwise)
                if (doorData.targetMap === 'room_attic') {
                    const visual = scene.add.rectangle(cx, cy, w, h, 0x000000, 0.8);
                    visual.setDepth(10); // Above wall
                    // Maybe a ladder hint?
                    const ladder = scene.add.graphics();
                    ladder.lineStyle(2, 0x8b4513);
                    ladder.moveTo(cx - 10, cy - 20); ladder.lineTo(cx - 10, cy + 20);
                    ladder.moveTo(cx + 10, cy - 20); ladder.lineTo(cx + 10, cy + 20);
                    for(let i=0; i<5; i++) {
                        ladder.moveTo(cx - 10, cy - 15 + i*8); ladder.lineTo(cx + 10, cy - 15 + i*8);
                    }
                    ladder.strokePath();
                    ladder.setDepth(11);
                }

                door.targetMap = doorData.targetMap;
                door.targetX = doorData.targetX;
                door.targetY = doorData.targetY;
                door.locked = doorData.locked;
                if (door.targetMap === 'room_entrance' && scene.gameState.doorSlammed && !scene.gameState.candlesLit) {
                    door.locked = true;
                }
                door.key = doorData.key;
                door.isLoop = doorData.isLoop;

                // Handle hidden doors
                if (doorData.hidden) {
                    const revealed = door.targetMap === 'room_secret' && scene.gameState.cabinetMoved;
                    door.visible = revealed;
                    door.body.enable = revealed;
                    door.isHiddenDoor = !revealed;
                }

                this.doors.add(door);
            });
        }

        // Memory Room Objects
        if (objs.table) {
            scene.table = this.furniture.create(objs.table.x, objs.table.y, 'desk');
            addToInteractables(scene.table, { dialog: '一张桌子' });
        }
        if (objs.parents_npc) {
            // Dad (Left)
            scene.dad = this.furniture.create(objs.parents_npc.x - 40, objs.parents_npc.y, 'npc_paper');
            scene.dad.setTint(0xaaaaaa);
            scene.dad.refreshBody();
            // Add interaction
            scene.dad.objId = 'dad_ghost';
            this.scene.interactables.add(scene.dad);

            // Mom (Right)
            scene.mom = this.furniture.create(objs.parents_npc.x + 40, objs.parents_npc.y, 'npc_paper');
            scene.mom.setTint(0xaaaaaa);
            scene.mom.refreshBody();
            // Add interaction
            scene.mom.objId = 'mom_ghost';
            this.scene.interactables.add(scene.mom);
        }

        if (objs.black_cloth) {
             scene.black_cloth = scene.add.image(objs.black_cloth.x, objs.black_cloth.y, scene.gameState.doorSlammed ? 'portrait_father' : 'portrait_covered');
             scene.physics.add.existing(scene.black_cloth, true);
             addToInteractables(scene.black_cloth, objs.black_cloth);
        }
    }
}
