import {
    INTERACTION_FOCUS_BAND,
    selectInteractionCandidate
} from './InteractionRules.js';

const DEFAULT_INTERACTION_RADIUS = 72;
const SLICE_MIN_FACING_DOT = 0;
const SLICE_DIRECTION_EPSILON = 0.000001;

export function getSlicePrompt(meta) {
    return `${meta.verb}：${meta.label}  [空格/E]`;
}

export function routeSliceAction(action) {
    if (action === 'bowl' || action === 'seat') return 'table';
    if (action === 'plane' || action === 'plane_choice' || action === 'mirror') return 'plane';
    if (action === 'observe') return 'observe';
    return 'ignore';
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function isAvailableInteraction(object) {
    if (!object || object.active === false || object.visible === false) return false;
    if (object.interactionEnabled === false) return false;
    if (object.sliceAction === 'ambient_anchor' || object.sliceData?.kind === 'ambient_anchor') return false;
    return routeSliceAction(object.sliceAction) !== 'ignore';
}

function getInteractionMeta(object) {
    const authored = object.sliceData || {};
    return {
        label: object.interaction?.label || authored.label || authored.id || object.objId || '可疑物件',
        verb: object.interaction?.verb || authored.verb || (object.sliceAction === 'observe' ? '观察' : '操作'),
        priority: object.interaction?.priority ?? authored.priority ?? 30,
        radius: object.interaction?.radius ?? authored.radius ?? DEFAULT_INTERACTION_RADIUS
    };
}

export class SliceInteractionManager {
    constructor(scene, focusBand = INTERACTION_FOCUS_BAND) {
        this.scene = scene;
        this.focusBand = focusBand;
    }

    update() {
        this.checkInteraction();
    }

    getDistanceToObject(playerX, playerY, object) {
        if (!object || object.active === false) return Infinity;

        let bodyDistance = Infinity;
        const body = object.body;
        if (
            body &&
            Number.isFinite(body.x) &&
            Number.isFinite(body.y) &&
            Number.isFinite(body.width) &&
            Number.isFinite(body.height)
        ) {
            const nearestX = clamp(playerX, body.x, body.x + body.width);
            const nearestY = clamp(playerY, body.y, body.y + body.height);
            bodyDistance = Math.hypot(nearestX - playerX, nearestY - playerY);
        }

        const centerDistance = Number.isFinite(object.x) && Number.isFinite(object.y)
            ? Math.hypot(object.x - playerX, object.y - playerY)
            : Infinity;
        return Math.min(bodyDistance, centerDistance);
    }

    findInteractionTarget() {
        const player = this.scene.player;
        const sprite = player?.sprite;
        if (!sprite) return null;

        const rawFacingX = Number.isFinite(player.facingX) ? player.facingX : 0;
        const rawFacingY = Number.isFinite(player.facingY) ? player.facingY : 0;
        const facingLength = Math.hypot(rawFacingX, rawFacingY);
        const hasFacing = facingLength > SLICE_DIRECTION_EPSILON;
        const facingX = hasFacing ? rawFacingX / facingLength : 0;
        const facingY = hasFacing ? rawFacingY / facingLength : 0;
        const candidates = [];
        for (const object of this.scene.interactables?.getChildren?.() || []) {
            if (!isAvailableInteraction(object)) continue;
            const meta = getInteractionMeta(object);
            const distance = this.getDistanceToObject(sprite.x, sprite.y, object);
            const radius = Number.isFinite(meta.radius) && meta.radius > 0
                ? meta.radius
                : DEFAULT_INTERACTION_RADIUS;
            if (distance > radius) continue;

            const dx = object.x - sprite.x;
            const dy = object.y - sprite.y;
            const centerDistance = Math.hypot(dx, dy);
            const centersOverlap = centerDistance <= SLICE_DIRECTION_EPSILON;
            const facingDot = centersOverlap || !hasFacing
                ? 0
                : (dx / centerDistance) * facingX + (dy / centerDistance) * facingY;
            if (hasFacing && !centersOverlap && facingDot <= SLICE_MIN_FACING_DOT) continue;
            candidates.push({
                obj: object,
                distance,
                priority: meta.priority,
                facingDot,
                meta,
                route: routeSliceAction(object.sliceAction)
            });
        }
        return selectInteractionCandidate(candidates, this.focusBand);
    }

    checkInteraction() {
        const selected = this.findInteractionTarget();
        const prompt = this.scene.interactText;
        const sprite = this.scene.player?.sprite;

        if (!selected || !prompt || !sprite) {
            prompt?.setVisible?.(false);
            this.scene.currentTarget = null;
            return null;
        }

        this.scene.currentTarget = {
            type: selected.route,
            route: selected.route,
            obj: selected.obj
        };
        prompt
            .setText(getSlicePrompt(selected.meta))
            .setPosition(sprite.x, sprite.y - 40)
            .setVisible(true);

        const keyboard = globalThis.Phaser?.Input?.Keyboard;
        if (keyboard?.JustDown?.(this.scene.keyE) || keyboard?.JustDown?.(this.scene.keySpace)) {
            return this.handleInteraction();
        }
        return this.scene.currentTarget;
    }

    handleInteraction() {
        const target = this.scene.currentTarget;
        const object = target?.obj;
        if (!target || !isAvailableInteraction(object)) return { status: 'ignored' };

        const route = target.route || target.type || routeSliceAction(object.sliceAction);
        if (route === 'table') {
            return this.scene.kitchenTableController?.handleAction(object) || { status: 'table_unavailable' };
        }

        if (route === 'observe') {
            const fact = object.sliceData?.text;
            if (typeof fact !== 'string' || fact.length === 0) return { status: 'missing_fact' };
            globalThis.window?.showDialog?.('主角', fact);
            return { status: 'observed', targetId: object.objId || object.sliceData?.id || null };
        }

        if (route === 'plane') {
            return {
                status: 'deferred',
                route: 'plane',
                targetId: object.objId || object.sliceData?.id || null
            };
        }
        return { status: 'ignored' };
    }

    destroy() {
        this.scene.interactText?.setVisible?.(false);
        this.scene.currentTarget = null;
    }
}
