import { Maps } from '../data/Maps.js';
import { syncStaticBody } from './PhysicsSync.js';

export class MapManager {
    constructor(scene) {
        this.scene = scene;
        this.walls = null;
        this.doors = null;
        this.photos = null;
        this.furniture = null;
        this.floorLayer = [];
    }

    createMap(mapId) {
        const mapDef = Maps[mapId];
        if (!mapDef) {
            console.error('Map not found:', mapId);
            return;
        }

        const mapData = mapDef.data;
        const visual = mapDef.visual || {};

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

        for (const guide of visual.guideLights || []) {
            this.scene.lights.addLight(guide.x, guide.y, guide.radius)
                .setColor(guide.color)
                .setIntensity(1.1);
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
                let floorTex = 'tile_floor';
                let wallTex = 'tile_wall';

                if (mapId === 'room_entrance' || mapId === 'room_backyard' || mapId === 'room_prologue') {
                    floorTex = 'tile_mud';
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
                    // Random clutter on floor (5% chance)
                    if (visual.debris !== false && Math.random() < 0.05 && mapId !== 'room_backyard' && mapId !== 'room_entrance' && mapId !== 'room_memory') {
                        const debris = this.scene.add.image(x * 32 + 16 + Phaser.Math.Between(-8, 8), y * 32 + 16 + Phaser.Math.Between(-8, 8), 'trash_paper');
                        debris.setRotation(Phaser.Math.FloatBetween(0, 6.28));
                        debris.setAlpha(0.7);
                        if (visual.paperTint !== undefined) debris.setTint(visual.paperTint);
                        debris.setPipeline('Light2D');
                        this.floorLayer.push(debris);
                    }
                }
            }
        }

        this.createObjects(mapDef.objects, mapId);
    }

    createObjects(objs, mapId) {
        const scene = this.scene;
        const isHorror = mapId !== 'room_memory';

        // Helper to add to interactables
        const addToInteractables = (obj, data) => {
            if (data && (data.dialog || data.id)) {
                this.scene.interactables.add(obj);
                if (data.dialog) obj.dialog = data.dialog;
                if (data.id) obj.objId = data.id;
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
                syncStaticBody(obj);
            }
        };

        if (objs.photos) {
            objs.photos.forEach(photoData => {
                const photo = this.photos.create(photoData.x, photoData.y, 'photo_frame');
                if (isHorror) photo.setPipeline('Light2D');
                photo.photoId = photoData.id;
                photo.dialogText = photoData.text;
                // Photos are handled specifically in InteractionManager but we can add them to interactables too
                this.scene.interactables.add(photo);
            });
        }

        if (objs.coffin) {
            scene.coffin = this.furniture.create(objs.coffin.x, objs.coffin.y, 'coffin');
            if (isHorror) scene.coffin.setPipeline('Light2D');
            setupFurniture(scene.coffin);
            // Explicitly set immovable and refresh
            if (scene.coffin.body) {
                scene.coffin.body.immovable = true;
                syncStaticBody(scene.coffin);
            }
            addToInteractables(scene.coffin, objs.coffin);
        }

        if (objs.altar) {
            scene.altar = this.furniture.create(objs.altar.x, objs.altar.y, 'altar');
            if (isHorror) scene.altar.setPipeline('Light2D');
            setupFurniture(scene.altar);
            addToInteractables(scene.altar, objs.altar);

            scene.leftCandle = scene.add.sprite(objs.altar.x - 30, objs.altar.y - 10, 'candle').setAlpha(0.3);
            scene.rightCandle = scene.add.sprite(objs.altar.x + 30, objs.altar.y - 10, 'candle').setAlpha(0.3);
            if (isHorror) {
                scene.leftCandle.setPipeline('Light2D');
                scene.rightCandle.setPipeline('Light2D');
            }

            if (scene.gameState.candlesLit) {
                 scene.leftCandle.setAlpha(1);
                 scene.rightCandle.setAlpha(1);
                 scene.lights.addLight(scene.leftCandle.x, scene.leftCandle.y, 100).setColor(0xffaa00).setIntensity(1.5);
                 scene.lights.addLight(scene.rightCandle.x, scene.rightCandle.y, 100).setColor(0xffaa00).setIntensity(1.5);
            }
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
            syncStaticBody(scene.npc); // Ensure body is active


            if (scene.gameState.hasRice && scene.gameState.hasMatches) {
                 scene.npc.setVisible(false);
                 scene.npc.body.enable = false;
            }
            // NPC interaction is distance based in InteractionManager, but adding to group doesn't hurt
            this.scene.interactables.add(scene.npc);
        }

        if (objs.well) {
            scene.well = this.furniture.create(objs.well.x, objs.well.y, 'well');
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
             syncStaticBody(scene.car);
             // No setupFurniture here as it has custom bounds already
             addToInteractables(scene.car, objs.car);
        }

        if (objs.cabinet) {
            scene.cabinet = this.furniture.create(objs.cabinet.x, objs.cabinet.y, 'cabinet');
            if (isHorror && !scene.isMobile) scene.cabinet.setPipeline('Light2D');
            if (objs.cabinet.id === 'parents_cabinet' && scene.gameState.cabinetMoved) {
                scene.cabinet.x -= 32;
            }
            setupFurniture(scene.cabinet);
            addToInteractables(scene.cabinet, objs.cabinet);
        }

        if (objs.bed) {
            scene.bed = this.furniture.create(objs.bed.x, objs.bed.y, 'bed');
            if (isHorror && !scene.isMobile) scene.bed.setPipeline('Light2D');
            setupFurniture(scene.bed);
            addToInteractables(scene.bed, objs.bed);
        }

        if (objs.desk) {
            scene.desk = this.furniture.create(objs.desk.x, objs.desk.y, 'desk');
            if (isHorror && !scene.isMobile) scene.desk.setPipeline('Light2D');
            setupFurniture(scene.desk);
            addToInteractables(scene.desk, objs.desk);
        }

        if (objs.diary) {
             scene.diary = this.furniture.create(objs.diary.x, objs.diary.y, 'diary');
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
             scene.crashed_car.setRotation(0.2);
             scene.crashed_car.setTint(0x555555);
             addToInteractables(scene.crashed_car, objs.crashed_car);

             scene.add.particles(objs.crashed_car.x, objs.crashed_car.y - 20, 'rain', {
                speed: { min: 10, max: 30 },
                scale: { start: 0.5, end: 1 },
                alpha: { start: 0.5, end: 0 },
                lifespan: 2000,
                quantity: 1,
                frequency: 100,
                tint: 0xcccccc
            }).setDepth(200);
        }

        if (objs.medical_record) {
            scene.medical_record = this.scene.add.image(objs.medical_record.x, objs.medical_record.y, 'trash_paper');
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
                syncStaticBody(scene.family_rules);
            }

            // Force add to interactables since it has no dialog/id in map data
            this.scene.interactables.add(scene.family_rules);
            addToInteractables(scene.family_rules, objs.family_rules);
        }

        if (objs.safe) {
            scene.safe = this.furniture.create(objs.safe.x, objs.safe.y, 'safe');
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
                syncStaticBody(scene.safe); // Important for Static Bodies!
            }

            // Force add to interactables (even if no dialog/id in map data)
            this.scene.interactables.add(scene.safe);
            addToInteractables(scene.safe, objs.safe);
        }

        if (objs.wet_paper) {
            scene.wet_paper = this.scene.add.image(objs.wet_paper.x, objs.wet_paper.y, 'trash_paper');
            if (isHorror) scene.wet_paper.setPipeline('Light2D');
            scene.wet_paper.setTint(0x00aaff);
            scene.wet_paper.objId = 'wet_paper';
            this.scene.interactables.add(scene.wet_paper);
            addToInteractables(scene.wet_paper, objs.wet_paper);
        }

        if (objs.incense) {
            scene.incense = this.scene.add.image(objs.incense.x, objs.incense.y, 'trash_paper');
            if (isHorror) scene.incense.setPipeline('Light2D');
            scene.incense.setTint(0x884400);
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

        if (objs.spirit_money) {
            scene.spirit_money = this.scene.add.image(objs.spirit_money.x, objs.spirit_money.y, 'trash_paper');
            if (isHorror) scene.spirit_money.setPipeline('Light2D');
            scene.spirit_money.setTint(0xffff00);
            addToInteractables(scene.spirit_money, objs.spirit_money);
        }

        if (objs.red_key) {
            if (!scene.gameState.hasRedKey) {
                scene.red_key = this.scene.add.image(objs.red_key.x, objs.red_key.y, 'trash_paper');
                if (isHorror) scene.red_key.setPipeline('Light2D');
                scene.red_key.setTint(0xff0000);
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
            scene.locked_window = scene.add.rectangle(objs.locked_window.x, objs.locked_window.y, 40, 40, 0x0000ff, 0);
            scene.physics.add.existing(scene.locked_window, true);
            scene.locked_window.objId = 'locked_window';
            this.scene.interactables.add(scene.locked_window);
            addToInteractables(scene.locked_window, objs.locked_window);
        }

        if (objs.exit_door) {
            scene.exit_door = scene.add.rectangle(objs.exit_door.x, objs.exit_door.y, 64, 32, 0xff0000, 0);
            scene.physics.add.existing(scene.exit_door, true);
            addToInteractables(scene.exit_door, objs.exit_door);
        }

        if (objs.interactables) {
            objs.interactables.forEach(data => {
                const texture = data.texture || 'trash_paper';
                const item = scene.add.image(data.x, data.y, texture);
                if (data.tint !== undefined) item.setTint(data.tint);
                if (data.alpha !== undefined) item.setAlpha(data.alpha);
                if (data.scale !== undefined) item.setScale(data.scale);
                if (isHorror && !scene.isMobile) item.setPipeline('Light2D');

                scene.physics.add.existing(item, true);
                syncStaticBody(item);

                item.objId = data.id;
                item.dialog = data.dialog;
                item.documentTitle = data.documentTitle;
                item.documentText = data.documentText;
                item.clueId = data.clueId;
                item.clueType = data.clueType;
                item.memoryTrigger = data.memoryTrigger;
                item.memoryReturn = data.memoryReturn;
                item.memoryComplete = data.memoryComplete;
                item.puzzleId = data.puzzleId;
                item.itemGrant = data.itemGrant;
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
                if (door.targetMap === 'room_entrance' && scene.gameState.doorSlammed) {
                    door.locked = true;
                }
                door.key = doorData.key;
                door.isLoop = doorData.isLoop;

                // Handle hidden doors
                if (doorData.hidden) {
                    // Check if it should be revealed based on game state
                    if (door.targetMap === 'room_secret' && scene.gameState.cabinetMoved) {
                        door.visible = true;
                        door.body.enable = true;

                        // Add visual "hole"
                        const hole = scene.add.rectangle(cx, cy, w, h, 0x000000);
                        hole.setDepth(door.depth - 1); // Behind door debug
                    } else {
                        door.visible = false;
                        door.body.enable = false; // Disable physics collision
                        door.isHiddenDoor = true; // Flag for identification
                    }
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
            syncStaticBody(scene.dad);
            // Add interaction
            scene.dad.objId = 'dad_ghost';
            this.scene.interactables.add(scene.dad);

            // Mom (Right)
            scene.mom = this.furniture.create(objs.parents_npc.x + 40, objs.parents_npc.y, 'npc_paper');
            scene.mom.setTint(0xaaaaaa);
            syncStaticBody(scene.mom);
            // Add interaction
            scene.mom.objId = 'mom_ghost';
            this.scene.interactables.add(scene.mom);
        }

        if (objs.black_cloth) {
             scene.black_cloth = scene.add.rectangle(objs.black_cloth.x, objs.black_cloth.y, 40, 40, 0x000000, 0);
             scene.physics.add.existing(scene.black_cloth, true);
             addToInteractables(scene.black_cloth, objs.black_cloth);
        }
    }
}
