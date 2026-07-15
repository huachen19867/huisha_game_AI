import {
    KITCHEN_BOWLS,
    KITCHEN_SEATS,
    evaluateSeating,
    normalizeBowlPlacements,
    placeBowl
} from './KitchenTableRules.js';

const HELD_BOWL_OFFSET = Object.freeze({ x: 18, y: -28 });

const BOWL_PRESENTATION = Object.freeze({
    wine: Object.freeze({ texture: 'bowl_wine', label: '酒味缺口碗' }),
    medicine: Object.freeze({ texture: 'bowl_medicine', label: '药渍白瓷碗' }),
    child: Object.freeze({ texture: 'bowl_child', label: '蓝边纸飞机碗' })
});

const SEAT_LABELS = Object.freeze({
    nail: '钉死椅前的座位',
    stove: '靠灶台的座位',
    side: '靠侧门的座位'
});

function cloneKitchenTableValue(value) {
    if (Array.isArray(value)) return value.map(cloneKitchenTableValue);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [key, cloneKitchenTableValue(nested)])
        );
    }
    return value;
}

function setPosition(object, x, y) {
    if (typeof object?.setPosition === 'function') object.setPosition(x, y);
    else if (object) {
        object.x = x;
        object.y = y;
    }
}

function setBodyEnabled(object, enabled) {
    if (!object?.body) return;
    object.body.enable = enabled;
}

function syncBody(object) {
    object?.body?.updateFromGameObject?.();
}

export class KitchenTableController {
    constructor(scene, tableData = scene.sliceMapDef?.objects?.table, state = scene.sliceState || scene.gameState?.slice) {
        this.scene = scene;
        this.tableData = cloneKitchenTableValue(tableData);
        this.state = state;
        this.bowlSprites = new Map();
        this.seatHotspots = new Map();
        this.offeringBowl = null;
        this.ownedObjects = [];
        this.destroyed = false;

        if (!this.tableData || !this.state || typeof this.state !== 'object') {
            throw new Error('Kitchen table controller requires authored table data and slice state');
        }

        this.normalizePersistedState();
        this.createEntities();
        this.syncSprites();
    }

    normalizePersistedState() {
        const sourcePlacements = this.state.bowlPlacements;
        const safeSource = sourcePlacements !== null && typeof sourcePlacements === 'object' && !Array.isArray(sourcePlacements)
            ? sourcePlacements
            : Object.fromEntries(KITCHEN_SEATS.map(seatId => [seatId, null]));
        this.state.bowlPlacements = normalizeBowlPlacements(safeSource);

        let heldBowl = KITCHEN_BOWLS.includes(this.state.heldBowl) ? this.state.heldBowl : null;
        if (this.state.tableSolved === true) heldBowl = null;
        if (heldBowl) {
            for (const seatId of KITCHEN_SEATS) {
                if (this.state.bowlPlacements[seatId] === heldBowl) {
                    this.state.bowlPlacements[seatId] = null;
                }
            }
        }
        this.state.heldBowl = heldBowl;
    }

    createEntities() {
        for (const bowlId of KITCHEN_BOWLS) {
            const origin = this.tableData.bowlOrigins[bowlId];
            const presentation = BOWL_PRESENTATION[bowlId];
            const bowl = this.scene.add.image(origin.x, origin.y, presentation.texture);
            bowl.objId = `kitchen_bowl_${bowlId}`;
            bowl.sliceAction = 'bowl';
            bowl.sliceData = {
                id: bowl.objId,
                kind: 'bowl',
                bowlId,
                label: presentation.label,
                verb: '端起'
            };
            bowl.interaction = {
                label: presentation.label,
                verb: '端起',
                priority: 40,
                radius: 64,
                marker: false
            };
            bowl.interactionEnabled = true;
            bowl.setDepth?.(26);
            this.scene.physics.add.existing(bowl, true);
            this.scene.interactables.add(bowl);
            this.bowlSprites.set(bowlId, bowl);
            this.ownedObjects.push(bowl);
        }

        for (const seatId of KITCHEN_SEATS) {
            const seat = this.tableData.seats[seatId];
            const hotspot = this.scene.add.rectangle(seat.x, seat.y, 24, 24, 0xcab889, 0.02);
            hotspot.objId = `kitchen_seat_${seatId}`;
            hotspot.sliceAction = 'seat';
            hotspot.sliceData = {
                id: hotspot.objId,
                kind: 'seat',
                seatId,
                label: SEAT_LABELS[seatId],
                verb: '放下'
            };
            hotspot.interaction = {
                label: SEAT_LABELS[seatId],
                verb: '放下',
                priority: 35,
                radius: 64,
                marker: false
            };
            hotspot.interactionEnabled = false;
            hotspot.setDepth?.(24);
            hotspot.setStrokeStyle?.(1, 0xd6c7a5, 0.35);
            this.scene.physics.add.existing(hotspot, true);
            this.scene.interactables.add(hotspot);
            this.seatHotspots.set(seatId, hotspot);
            this.ownedObjects.push(hotspot);
        }

        const offering = this.tableData.offering;
        this.offeringBowl = this.scene.add.image(offering.x, offering.y, 'bowl_offering');
        this.offeringBowl.objId = 'kitchen_offering_bowl';
        this.offeringBowl.sliceAction = 'offering';
        this.offeringBowl.sliceData = {
            id: 'kitchen_offering_bowl',
            kind: 'offering',
            label: '积灰冷饭碗',
            verb: '不能端起',
            fixed: true
        };
        this.offeringBowl.interaction = {
            label: '积灰冷饭碗',
            verb: '不能端起',
            priority: 0,
            radius: 0,
            marker: false
        };
        this.offeringBowl.interactionEnabled = false;
        this.offeringBowl.setDepth?.(26);
        this.scene.physics.add.existing(this.offeringBowl, true);
        this.ownedObjects.push(this.offeringBowl);
    }

    update() {
        if (this.destroyed || !this.state.heldBowl) return;
        this.syncHeldBowl();
    }

    syncHeldBowl() {
        const heldSprite = this.bowlSprites.get(this.state.heldBowl);
        const playerSprite = this.scene.player?.sprite;
        if (!heldSprite || !playerSprite) return;
        setPosition(
            heldSprite,
            playerSprite.x + HELD_BOWL_OFFSET.x,
            playerSprite.y + HELD_BOWL_OFFSET.y
        );
        setBodyEnabled(heldSprite, false);
        heldSprite.interactionEnabled = false;
    }

    syncSprites() {
        this.normalizePersistedState();
        const occupiedSeatByBowl = new Map();
        for (const seatId of KITCHEN_SEATS) {
            const bowlId = this.state.bowlPlacements[seatId];
            if (bowlId) occupiedSeatByBowl.set(bowlId, seatId);
        }

        for (const bowlId of KITCHEN_BOWLS) {
            const sprite = this.bowlSprites.get(bowlId);
            if (!sprite) continue;
            if (this.state.heldBowl === bowlId) {
                this.syncHeldBowl();
                continue;
            }

            const seatId = occupiedSeatByBowl.get(bowlId);
            const position = seatId
                ? this.tableData.seats[seatId]
                : this.tableData.bowlOrigins[bowlId];
            setPosition(sprite, position.x, position.y);
            setBodyEnabled(sprite, true);
            // While carrying a bowl, seat hotspots own the focus even when another bowl occupies that seat.
            // This makes replacement possible without the occupied bowl stealing the interaction target.
            sprite.interactionEnabled = this.state.tableSolved !== true && this.state.heldBowl === null;
            syncBody(sprite);
        }

        const canPlace = this.state.tableSolved !== true && this.state.heldBowl !== null;
        for (const hotspot of this.seatHotspots.values()) {
            hotspot.interactionEnabled = canPlace;
            hotspot.setAlpha?.(canPlace ? 0.16 : 0.02);
            setBodyEnabled(hotspot, canPlace);
            if (canPlace) syncBody(hotspot);
        }
        setBodyEnabled(this.offeringBowl, true);
        syncBody(this.offeringBowl);
    }

    pickBowl(bowlId) {
        if (this.state.tableSolved === true) return { status: 'locked' };
        if (!KITCHEN_BOWLS.includes(bowlId)) return { status: 'unknown_bowl' };
        if (this.state.heldBowl) {
            if (this.state.heldBowl === bowlId) return { status: 'holding', bowlId };
            return { status: 'hands_full', heldBowl: this.state.heldBowl };
        }

        for (const seatId of KITCHEN_SEATS) {
            if (this.state.bowlPlacements[seatId] === bowlId) this.state.bowlPlacements[seatId] = null;
        }
        this.state.heldBowl = bowlId;
        this.syncSprites();
        return { status: 'holding', bowlId };
    }

    placeHeldBowl(seatId) {
        if (this.state.tableSolved === true) return { status: 'locked' };
        if (!this.state.heldBowl) return { status: 'empty_hands' };
        if (!KITCHEN_SEATS.includes(seatId)) return { status: 'unknown_seat' };

        const bowlId = this.state.heldBowl;
        this.state.bowlPlacements = placeBowl(this.state.bowlPlacements, seatId, bowlId);
        this.state.heldBowl = null;
        this.syncSprites();
        return evaluateSeating(this.state.bowlPlacements);
    }

    handleAction(object) {
        if (!object) return { status: 'ignored' };
        if (object === this.offeringBowl || object.sliceAction === 'offering') {
            return { status: 'fixed_offering' };
        }
        if (object.sliceAction === 'bowl') return this.pickBowl(object.sliceData?.bowlId);
        if (object.sliceAction === 'seat') return this.placeHeldBowl(object.sliceData?.seatId);
        return { status: 'ignored' };
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        for (const object of this.ownedObjects) {
            this.scene.interactables?.remove?.(object);
            object.destroy?.();
        }
        this.ownedObjects = [];
    }
}
