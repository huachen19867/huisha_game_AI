import { SliceMaps, getSliceDoorAccess } from '../data/SliceMaps.js';
import { normalizeInteractionMeta } from './InteractionRules.js';
import { getPlaneChoiceEffects } from './SliceNarrativeDirector.js';

const TILE_SIZE = 32;

function cloneAuthoredValue(value) {
    if (Array.isArray(value)) return value.map(cloneAuthoredValue);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, nestedValue]) => [key, cloneAuthoredValue(nestedValue)])
        );
    }
    return value;
}

function getSliceState(scene) {
    return scene.sliceState || scene.gameState?.slice || {};
}

export class SliceMapManager {
    constructor(scene) {
        this.scene = scene;
        this.mapDef = null;
        this.currentMapId = null;
        this.walls = null;
        this.doors = null;
        this.furniture = null;
        this.interactables = null;
        this.floorLayer = [];
        this.navigationBlockedRects = [];
        this.safeZones = {};
        this.baseSafeZones = {};
        this.roomEffects = [];
        this.revisionEffects = [];
        this._revisionKey = null;
    }

    createMap(mapId) {
        const authoredMap = SliceMaps[mapId];
        if (!authoredMap) {
            console.error('Slice map not found:', mapId);
            return false;
        }

        this.destroyRoomEffects();
        this.clearRevisionEffects();
        this.currentMapId = mapId;
        this.mapDef = cloneAuthoredValue(authoredMap);
        this._revisionKey = null;
        this.scene.sliceMapDef = this.mapDef;

        const mapWidth = this.mapDef.width * TILE_SIZE;
        const mapHeight = this.mapDef.height * TILE_SIZE;
        this.scene.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        this.scene.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

        this.scene.lights.enable();
        this.scene.lights.setAmbientColor(this.mapDef.visual?.ambient ?? 0x555555);

        this.walls = this.scene.physics.add.staticGroup();
        this.doors = this.scene.add.group();
        this.furniture = this.scene.physics.add.staticGroup();
        this.interactables = this.scene.physics.add.staticGroup();
        this.floorLayer = [];
        this.navigationBlockedRects = [];
        this.safeZones = {};
        this.baseSafeZones = {};

        this.scene.walls = this.walls;
        this.scene.doors = this.doors;
        this.scene.furniture = this.furniture;
        this.scene.interactables = this.interactables;
        this.scene.floorLayer = this.floorLayer;
        this.scene.navigationBlockedRects = this.navigationBlockedRects;
        this.scene.sliceSafeZones = this.safeZones;

        this.renderTiles();
        this.createTable(this.mapDef.objects.table);
        this.createProps(this.mapDef.objects.props || []);
        this.createDoors(this.mapDef.objects.doors || []);
        this.applyRoomRevision(getSliceState(this.scene));
        return true;
    }

    renderTiles() {
        const visual = this.mapDef.visual || {};
        for (let y = 0; y < this.mapDef.data.length; y += 1) {
            for (let x = 0; x < this.mapDef.data[y].length; x += 1) {
                const worldX = x * TILE_SIZE + TILE_SIZE / 2;
                const worldY = y * TILE_SIZE + TILE_SIZE / 2;
                const floor = this.scene.add.image(worldX, worldY, 'tile_floor');
                if (visual.floorTint !== undefined) floor.setTint(visual.floorTint);
                if (!this.scene.isMobile) floor.setPipeline('Light2D');
                this.floorLayer.push(floor);

                if (this.mapDef.data[y][x] !== 1) continue;
                const wall = this.walls.create(worldX, worldY, 'tile_wall');
                if (visual.wallTint !== undefined) wall.setTint(visual.wallTint);
                if (!this.scene.isMobile) wall.setPipeline('Light2D');
            }
        }
    }

    createTable(tableData) {
        if (!tableData) return;

        const tableVisual = this.scene.add.image(tableData.x, tableData.y, 'desk');
        tableVisual.setDisplaySize?.(tableData.collisionBounds.width, tableData.collisionBounds.height);
        if (!this.scene.isMobile) tableVisual.setPipeline('Light2D');
        tableVisual.setDepth?.(20);
        this.scene.table = tableVisual;

        const bounds = cloneAuthoredValue(tableData.collisionBounds);
        const blocker = this.scene.add.rectangle(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height / 2,
            bounds.width,
            bounds.height,
            0x000000,
            0
        );
        blocker.objId = 'kitchen_table_collision';
        blocker.sliceAction = null;
        this.scene.physics.add.existing(blocker, true);
        blocker.body?.setSize?.(bounds.width, bounds.height);
        blocker.refreshBody?.();
        this.furniture.add(blocker);
        this.scene.tableCollision = blocker;

        this.navigationBlockedRects.push(bounds);
        this.baseSafeZones = cloneAuthoredValue(tableData.safeZones || {});
        this.safeZones = cloneAuthoredValue(this.baseSafeZones);
        this.scene.navigationBlockedRects = this.navigationBlockedRects;
        this.scene.sliceSafeZones = this.safeZones;
    }

    createProps(props) {
        for (const data of props) {
            if (data.kind === 'ambient_anchor') {
                this.createAmbientAnchor(data);
                continue;
            }

            const object = this.scene.add.image(data.x, data.y, data.texture);
            if (!this.scene.isMobile) object.setPipeline('Light2D');
            this.scene.physics.add.existing(object, true);
            this.attachInteraction(object, data);
        }
    }

    attachInteraction(obj, data) {
        obj.objId = data.id;
        obj.sliceAction = data.kind;
        obj.sliceData = cloneAuthoredValue(data);
        obj.interaction = normalizeInteractionMeta({
            id: data.id,
            dialog: data.text,
            interaction: {
                label: data.label || data.id,
                verb: data.verb || (data.kind === 'observe' ? '观察' : '操作'),
                priority: data.priority || 30,
                radius: data.radius || 72,
                marker: false,
                blocksMovement: data.blocksMovement ?? false
            }
        }, { textureKey: obj.texture?.key });
        this.scene.interactables.add(obj);
    }

    createAmbientAnchor(data) {
        if (data.effect === 'four_place_settings') {
            const timer = this.scene.time.addEvent({
                delay: 5200,
                loop: true,
                callback: () => this.scene.soundManager?.playSpatialNoise(0.025, data.x, data.y)
            });
            this.roomEffects.push(timer);
            return;
        }

        if (data.effect === 'warm_door_seam') {
            const seam = this.scene.add.rectangle(data.x, data.y, 6, 54, 0xc58b55, 0.24);
            seam.setDepth?.(18);
            if (!this.scene.isMobile) seam.setPipeline?.('Light2D');
            this.roomEffects.push(seam);
            return;
        }

        if (data.effect === 'faint_rice_steam') {
            const steam = this.scene.add.particles(data.x, data.y, 'rain', {
                speedY: { min: -12, max: -5 },
                speedX: { min: -3, max: 3 },
                scale: { start: 0.28, end: 0 },
                alpha: { start: 0.16, end: 0 },
                lifespan: 1800,
                quantity: 1,
                frequency: 650,
                tint: 0xd8d0bd
            });
            steam.setDepth?.(16);
            this.roomEffects.push(steam);
        }
    }

    createDoors(doors) {
        for (const data of doors) {
            const width = (data.w || 1) * TILE_SIZE;
            const height = (data.h || 1) * TILE_SIZE;
            const x = data.x * TILE_SIZE + width / 2;
            const y = data.y * TILE_SIZE + height / 2;
            const door = this.scene.add.image(x, y, 'tile_wall');
            door.setDisplaySize?.(width + 16, height + 16);
            door.setDepth?.(12);
            this.scene.physics.add.existing(door, true);
            door.body?.setSize?.(width + 16, height + 16);
            door.refreshBody?.();
            door.objId = data.id;
            door.doorId = data.id;
            door.targetMap = data.targetMap;
            door.targetX = data.targetX;
            door.targetY = data.targetY;
            door.sliceData = cloneAuthoredValue(data);
            this.doors.add(door);
        }
        this.refreshDoorAccess(getSliceState(this.scene));
    }

    refreshDoorAccess(sliceState = getSliceState(this.scene)) {
        for (const door of this.doors?.getChildren?.() || []) {
            door.locked = !getSliceDoorAccess(door.doorId, sliceState);
            if (
                this.currentMapId === 'room_kitchen' &&
                door.doorId === 'kitchen_side_door' &&
                sliceState?.planeChoice === 'leave'
            ) {
                door.locked = true;
            }
            door.setTint?.(door.locked ? 0x4a2727 : 0x796754);
            door.setAlpha?.(door.locked ? 0.82 : 0.32);
        }
    }

    applyRoomRevision(sliceState = getSliceState(this.scene)) {
        const revision = {
            mapId: this.currentMapId,
            slicePhase: sliceState?.slicePhase || 'arrival',
            tableSolved: sliceState?.tableSolved === true,
            bowlPlacements: cloneAuthoredValue(sliceState?.bowlPlacements || {}),
            mealReplaySeen: Array.isArray(sliceState?.mealReplaySeen) ? [...sliceState.mealReplaySeen] : [],
            planeChoice: sliceState?.planeChoice === 'take' || sliceState?.planeChoice === 'leave'
                ? sliceState.planeChoice
                : null,
            bedroomInvestigations: {
                mirror: sliceState?.bedroomInvestigations?.mirror === true,
                plane: sliceState?.bedroomInvestigations?.plane === true
            },
            paperDollIndex: Number.isInteger(sliceState?.paperDollIndex) ? sliceState.paperDollIndex : 0
        };
        const revisionKey = JSON.stringify(revision);
        if (revisionKey === this._revisionKey) return false;
        this._revisionKey = revisionKey;

        this.clearRevisionEffects();
        if (this.currentMapId === 'room_kitchen') {
            const keepsTableProtection = revision.planeChoice
                ? getPlaneChoiceEffects(revision.planeChoice).kitchenSafe
                : true;
            this.safeZones = keepsTableProtection ? cloneAuthoredValue(this.baseSafeZones) : {};
            this.scene.sliceSafeZones = this.safeZones;
            if (revision.tableSolved && keepsTableProtection) this.createKitchenProtectionEffects();
        }

        this.refreshDoorAccess(sliceState);
        this.scene.sliceRoomRevision = cloneAuthoredValue(revision);

        if (this.currentMapId === 'room_main') {
            const coldBowl = this.findProp('main_cold_bowl');
            coldBowl?.setAlpha(revision.tableSolved ? (revision.slicePhase === 'return' ? 0.28 : 0.55) : 1);
            if (coldBowl) coldBowl.sliceRevision = revision.tableSolved ? 'table_restored' : 'cold_fourth_place';
        }

        if (this.currentMapId === 'room_kitchen') {
            this.scene.sliceBowlPlacements = cloneAuthoredValue(revision.bowlPlacements);
            this.scene.sliceMealReplaySeen = [...revision.mealReplaySeen];
            this.scene.slicePaperDollIndex = revision.paperDollIndex;
            if (this.scene.table) this.scene.table.sliceRevision = revision.tableSolved ? 'solved' : 'unresolved';
        }

        if (this.currentMapId === 'room_bedroom_me') {
            const plane = this.findProp('bedroom_plane');
            if (plane) {
                plane.sliceRevision = revision.planeChoice || 'unresolved';
                plane.interactionEnabled = revision.planeChoice === null && revision.bedroomInvestigations.plane !== true;
                plane.setVisible(revision.planeChoice === null);
                plane.setAlpha(1);
            }
            const mirror = this.findProp('child_mirror');
            if (mirror) mirror.sliceRevision = revision.planeChoice ? 'after_choice' : 'waiting';
            for (const choiceId of ['plane_bag', 'plane_drawer']) {
                const choice = this.findProp(choiceId);
                if (choice) {
                    choice.choiceSelected = choice.sliceData?.choice === revision.planeChoice;
                    choice.interactionEnabled = revision.planeChoice === null &&
                        revision.bedroomInvestigations.mirror === true &&
                        revision.bedroomInvestigations.plane === true;
                    choice.slicePlaneStored = choiceId === 'plane_drawer' && revision.planeChoice === 'leave';
                }
            }
        }

        return true;
    }

    createKitchenProtectionEffects() {
        const table = this.mapDef?.objects?.table;
        if (!table) return;

        const warmth = this.scene.add.rectangle(table.x, table.y, 104, 84, 0xb37845, 0.09);
        warmth.objId = 'kitchen_table_warmth';
        warmth.sliceEffectId = 'kitchen_table_warmth';
        warmth.setDepth?.(19);
        if (!this.scene.isMobile) warmth.setPipeline?.('Light2D');

        const steam = this.scene.add.particles(table.offering.x, table.offering.y - 5, 'rain', {
            speedY: { min: -16, max: -7 },
            speedX: { min: -3, max: 3 },
            scale: { start: 0.3, end: 0 },
            alpha: { start: 0.2, end: 0 },
            lifespan: 1600,
            quantity: 1,
            frequency: 520,
            tint: 0xe1d5bb
        });
        steam.objId = 'kitchen_offering_steam';
        steam.sliceEffectId = 'kitchen_offering_steam';
        steam.setDepth?.(22);
        this.revisionEffects.push(warmth, steam);
    }

    findProp(objId) {
        return (this.interactables?.getChildren?.() || []).find(object => object.objId === objId) || null;
    }

    destroyRoomEffects() {
        for (const effect of this.roomEffects) {
            if (typeof effect?.remove === 'function') effect.remove();
            else effect?.destroy?.();
        }
        this.roomEffects = [];
    }

    clearRevisionEffects() {
        for (const effect of this.revisionEffects) {
            if (typeof effect?.remove === 'function') effect.remove();
            else effect?.destroy?.();
        }
        this.revisionEffects = [];
    }

    destroy() {
        this.destroyRoomEffects();
        this.clearRevisionEffects();
        this._revisionKey = null;
    }
}
