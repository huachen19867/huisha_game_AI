import { choosePlane, transitionSlicePhase } from './SliceState.js';

export const REACTIONS = Object.freeze({
    arrival: Object.freeze({
        cold_bowl: '三只碗留着新擦痕。第四只没有。'
    }),
    table: Object.freeze({
        wrong_meal: '影子坐下了，但没有一个人碰筷子。'
    }),
    bedroom: Object.freeze({
        mirror: '镜子挂得很低。我得弯腰才能照见脸。'
    }),
    return: Object.freeze({
        plane_take: '书包沉了一下。侧门的插销自己弹开了。',
        plane_leave: '抽屉合上后，门外多了一道很轻的纸响。'
    })
});

export const CODA_TEXT = Object.freeze({
    mother: '饭凉了。',
    preview: '实体解谜重做预览结束'
});

const PLANE_CHOICE_EFFECTS = Object.freeze({
    take: Object.freeze({ sideDoorOpen: true, paperDollPresent: false, kitchenSafe: false }),
    leave: Object.freeze({ sideDoorOpen: false, paperDollPresent: true, kitchenSafe: true })
});

const FORBIDDEN_REVEAL_PATTERNS = Object.freeze([
    /主角就是明儿/,
    /明儿.{0,8}(?:身份|就是|是).{0,8}(?:我|主角|确认)/,
    /(?:我|主角).{0,8}(?:就是|是).{0,8}明儿/,
    /忌日/,
    /已经死/,
    /死在雨夜/,
    /棺材.{0,12}(?:等|装|躺).{0,12}(?:我|主角)/,
    /(?:我|主角).{0,12}棺材.{0,12}(?:等|装|躺)/
]);

export function getPlaneChoiceEffects(choice) {
    if (!Object.hasOwn(PLANE_CHOICE_EFFECTS, choice)) {
        throw new Error(`Unknown plane choice: ${String(choice)}`);
    }
    return { ...PLANE_CHOICE_EFFECTS[choice] };
}

export function getReaction(phase, intent) {
    return REACTIONS[phase]?.[intent] || '';
}

export function listReactions() {
    return Object.values(REACTIONS).flatMap(reactions => Object.values(reactions));
}

export function shouldPaperDollMove({ planeChoice, facingDot, movedDistance, blocked } = {}) {
    return planeChoice !== 'take' &&
        Number.isFinite(facingDot) && facingDot <= -0.25 &&
        Number.isFinite(movedDistance) && movedDistance >= 24 &&
        blocked !== true;
}

export function findForbiddenReveal(value, seen = new Set()) {
    if (typeof value === 'string') {
        return FORBIDDEN_REVEAL_PATTERNS.some(pattern => pattern.test(value)) ? value : null;
    }
    if (value === null || typeof value !== 'object' || seen.has(value)) return null;
    seen.add(value);
    for (const nestedValue of Object.values(value)) {
        const offending = findForbiddenReveal(nestedValue, seen);
        if (offending) return offending;
    }
    return null;
}

const NARRATIVE_SHUTDOWN_EVENT = globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || 'shutdown';
const CODA_TIMING = Object.freeze({
    drop: 1250,
    mother: 1750,
    preview: 2600,
    finish: 5200
});
const PAPER_DOLL_REVEAL_DISTANCE = 160;
const PAPER_DOLL_TURN_AWAY_DOT = -0.25;
const PAPER_DOLL_FALLBACK_ANCHORS = Object.freeze([
    Object.freeze({ x: 512, y: 336 }),
    Object.freeze({ x: 448, y: 384 }),
    Object.freeze({ x: 400, y: 320, facing: 'left', pointsTo: 'under_table' })
]);

function setNarrativeDepth(object, depth) {
    object?.setDepth?.(depth);
    return object;
}

function destroyObject(object) {
    object?.destroy?.();
}

function narrativeDistanceBetween(first, second) {
    if (!first || !second) return 0;
    return Math.hypot((first.x || 0) - (second.x || 0), (first.y || 0) - (second.y || 0));
}

export class SliceNarrativeDirector {
    constructor(scene, state = scene?.sliceState || scene?.gameState?.slice) {
        if (!scene || !state || typeof state !== 'object') {
            throw new Error('Slice narrative director requires a scene and slice state');
        }
        this.scene = scene;
        this.state = state;
        this.destroyed = false;
        this.paperDoll = null;
        this.bagPlane = null;
        this.mirrorReflection = null;
        this.mirrorCuff = null;
        this.coda = null;
        this.ownedTweens = [];
        this.ownedTimers = [];
        this.lastPlayerPosition = null;
        this.shutdownHandler = () => this.destroy();
        this.scene.events?.once?.(NARRATIVE_SHUTDOWN_EVENT, this.shutdownHandler);
        this.syncRoomState();
    }

    syncRoomState() {
        if (this.scene.currentMapId === 'room_bedroom_me' && this.state.slicePhase === 'rule') {
            Object.assign(this.state, transitionSlicePhase(this.state, 'bedroom'));
            this.applyRevision();
        }
        if (this.scene.currentMapId === 'room_kitchen') this.syncPaperDoll();
        if (this.scene.currentMapId === 'room_bedroom_me' && this.state.planeChoice === 'take') this.createBagPlane();
    }

    anchors() {
        const authored = this.scene.sliceMapDef?.objects?.paperDollAnchors;
        return Array.isArray(authored) && authored.length >= 3 ? authored : PAPER_DOLL_FALLBACK_ANCHORS;
    }

    isPlaneChoiceReady() {
        const investigations = this.state.bedroomInvestigations || {};
        return this.state.planeChoice === null && investigations.mirror === true && investigations.plane === true;
    }

    handleInteraction(object) {
        if (this.destroyed || !object) return null;
        if (this.coda?.card && this.skipCoda()) return { status: 'coda_skipped' };

        const id = object.objId || object.sliceData?.id;
        if (id === 'child_mirror') return this.handleMirror(object);
        if (id === 'bedroom_plane') return this.handlePlaneObservation();
        if (id === 'plane_bag' || id === 'plane_drawer') return this.handlePlaneChoice(object, id === 'plane_bag' ? 'take' : 'leave');
        if (id === 'main_cold_bowl') return this.handleColdBowl();
        return null;
    }

    handleMirror(object) {
        if (this.state.planeChoice) {
            this.createFinalMirrorReflection(object);
            return { status: 'mirror_after_choice' };
        }
        this.state.bedroomInvestigations = { ...this.state.bedroomInvestigations, mirror: true };
        this.showReaction(getReaction('bedroom', 'mirror'));
        this.applyRevision();
        return { status: 'investigated', targetId: 'child_mirror' };
    }

    handlePlaneObservation() {
        if (this.state.planeChoice) return { status: 'locked' };
        this.state.bedroomInvestigations = { ...this.state.bedroomInvestigations, plane: true };
        this.applyRevision();
        return { status: 'investigated', targetId: 'bedroom_plane' };
    }

    handlePlaneChoice(object, choice) {
        if (this.state.planeChoice) return { status: 'locked', choice: this.state.planeChoice };
        if (!this.isPlaneChoiceReady()) return { status: 'unavailable' };
        Object.assign(this.state, choosePlane(this.state, choice));
        object.interactionEnabled = false;
        this.applyPlaneChoice(choice);
        this.applyRevision();
        return { status: 'chosen', choice };
    }

    applyPlaneChoice(choice) {
        if (choice === 'take') {
            this.createBagPlane();
            this.removePaperDoll();
            this.showReaction(getReaction('return', 'plane_take'));
            return;
        }

        const plane = this.findProp('bedroom_plane');
        const drawer = this.findProp('plane_drawer');
        if (plane && drawer) {
            const echo = setNarrativeDepth(this.scene.add?.image?.(plane.x, plane.y, plane.texture?.key || 'toy_plane'), 42);
            if (echo) {
                echo.setAlpha?.(0.82);
                this.ownTween({
                    targets: echo,
                    x: drawer.x,
                    y: drawer.y,
                    alpha: 0,
                    duration: 460,
                    ease: 'Sine.easeIn',
                    onComplete: () => destroyObject(echo)
                });
            }
            drawer.slicePlaneStored = true;
        }
        this.movePaperDollToFinalAnchor();
        this.showReaction(getReaction('return', 'plane_leave'));
    }

    handleColdBowl() {
        if (this.scene.currentMapId !== 'room_main') {
            return { status: 'unavailable' };
        }
        if (this.state.slicePhase !== 'return' || !this.state.planeChoice) {
            this.showReaction(getReaction('arrival', 'cold_bowl'));
            return { status: 'observed', targetId: 'main_cold_bowl' };
        }
        if (this.coda || this.state.sliceCompleted) return { status: 'complete' };
        this.startCoda();
        return { status: 'coda_playing' };
    }

    showReaction(line) {
        if (!line) return;
        if (typeof this.scene.showSliceReaction === 'function') this.scene.showSliceReaction(line);
    }

    applyRevision() {
        this.scene.sliceMapManager?.refreshDoorAccess?.(this.state);
        this.scene.sliceMapManager?.applyRoomRevision?.(this.state);
    }

    findProp(id) {
        return this.scene.sliceMapManager?.findProp?.(id)
            || (this.scene.interactables?.getChildren?.() || []).find(object => object.objId === id)
            || null;
    }

    createBagPlane() {
        if (this.bagPlane || this.scene.currentMapId !== 'room_bedroom_me') return this.bagPlane;
        const player = this.scene.player?.sprite;
        const bag = setNarrativeDepth(this.scene.add?.image?.(player?.x ?? 0, player?.y ?? 0, 'toy_plane'), 42);
        if (!bag) return null;
        bag.setScale?.(0.56);
        bag.setAlpha?.(0.72);
        bag.sliceNarrativeEffect = 'bag_plane';
        this.bagPlane = bag;
        this.syncBagPlane();
        return bag;
    }

    syncBagPlane() {
        if (!this.bagPlane || !this.scene.player?.sprite) return;
        const player = this.scene.player.sprite;
        this.bagPlane.setPosition?.(player.x + 17, player.y - 22);
        if (typeof this.bagPlane.setPosition !== 'function') {
            this.bagPlane.x = player.x + 17;
            this.bagPlane.y = player.y - 22;
        }
    }

    syncPaperDoll() {
        if (this.scene.currentMapId !== 'room_kitchen') return;
        if (getPlaneChoiceEffects(this.state.planeChoice || 'leave').paperDollPresent === false) {
            this.removePaperDoll();
            return;
        }
        if (this.paperDoll) return;
        const anchors = this.anchors();
        const index = Math.max(0, Math.min(anchors.length - 1, this.state.paperDollIndex || 0));
        const anchor = anchors[index];
        if (this.shouldDelayFinalPaperDoll(anchor, index, anchors.length)) return;
        const doll = setNarrativeDepth(this.scene.add?.image?.(anchor.x, anchor.y, 'npc_paper'), 33);
        if (!doll) return;
        doll.setAlpha?.(0.38);
        doll.setTint?.(0xc7d0d3);
        doll.sliceNarrativeEffect = 'paper_doll';
        this.applyPaperDollPose(anchor, doll);
        this.paperDoll = doll;
    }

    shouldDelayFinalPaperDoll(anchor, index, anchorCount) {
        if (this.state.planeChoice !== 'leave' || index !== anchorCount - 1) return false;
        const player = this.scene.player?.sprite;
        if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return false;
        const dx = anchor.x - player.x;
        const dy = anchor.y - player.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= PAPER_DOLL_REVEAL_DISTANCE) return false;
        const facingX = this.scene.player?.facingX || 0;
        const facingY = this.scene.player?.facingY || 0;
        const facingLength = Math.hypot(facingX, facingY);
        if (facingLength === 0 || distance === 0) return true;
        const facingDot = (dx / distance) * (facingX / facingLength) +
            (dy / distance) * (facingY / facingLength);
        return facingDot > PAPER_DOLL_TURN_AWAY_DOT;
    }

    applyPaperDollPose(anchor, doll = this.paperDoll) {
        if (!anchor || !doll) return;
        doll.setFlipX?.(anchor.facing === 'left');
        doll.sliceNarrativeFacing = anchor.facing || null;
        doll.slicePointsTo = anchor.pointsTo || null;
    }

    tryMovePaperDoll(input) {
        if (!this.paperDoll || this.state.paperDollIndex >= 2 || !shouldPaperDollMove({ ...input, planeChoice: this.state.planeChoice })) {
            return false;
        }
        const nextIndex = this.state.paperDollIndex + 1;
        const target = this.anchors()[nextIndex];
        if (!target) return false;
        this.state.paperDollIndex = nextIndex;
        this.applyPaperDollPose(target);
        this.ownTween({
            targets: this.paperDoll,
            x: target.x,
            y: target.y,
            duration: 520,
            ease: 'Sine.easeInOut'
        });
        this.applyRevision();
        return true;
    }

    movePaperDollToFinalAnchor() {
        if (this.state.paperDollIndex >= 2) return false;
        const target = this.anchors()[2];
        if (!target) return false;
        this.state.paperDollIndex = 2;
        if (this.paperDoll) {
            this.applyPaperDollPose(target);
            this.ownTween({
                targets: this.paperDoll,
                x: target.x,
                y: target.y,
                duration: 520,
                ease: 'Sine.easeInOut'
            });
        }
        return true;
    }

    removePaperDoll() {
        destroyObject(this.paperDoll);
        this.paperDoll = null;
    }

    createFinalMirrorReflection(mirror) {
        this.clearMirrorReflection();
        const reflection = setNarrativeDepth(this.scene.add?.rectangle?.(mirror.x, mirror.y + 15, 34, 20, 0xbcc7d1, 0.26), 41);
        const cuff = setNarrativeDepth(this.scene.add?.image?.(mirror.x + 10, mirror.y + 18, 'slice_uniform'), 42);
        reflection && (reflection.sliceMirrorDetail = 'child_height_shoulders');
        cuff?.setScale?.(0.28);
        cuff?.setAlpha?.(0.5);
        cuff && (cuff.sliceMirrorDetail = 'blue_cuff_patch');
        this.mirrorReflection = reflection || null;
        this.mirrorCuff = cuff || null;
    }

    clearMirrorReflection() {
        destroyObject(this.mirrorReflection);
        destroyObject(this.mirrorCuff);
        this.mirrorReflection = null;
        this.mirrorCuff = null;
    }

    startCoda() {
        Object.assign(this.state, transitionSlicePhase(this.state, 'complete'));
        this.applyRevision();
        const bowl = this.findProp('main_cold_bowl');
        const fourthBowl = setNarrativeDepth(this.scene.add?.image?.(bowl?.x ?? 384, bowl?.y ?? 220, 'bowl_offering'), 46);
        const outline = setNarrativeDepth(this.scene.add?.image?.(bowl?.x ?? 384, (bowl?.y ?? 220) - 24, 'npc_paper'), 47);
        outline?.setAlpha?.(0.17);
        this.coda = { bowl: fourthBowl, outline, drop: null, line: null, card: null, timers: [], tweens: [] };
        const scheduleCoda = (delay, callback) => {
            const timer = this.ownTimer(delay, callback);
            if (timer) this.coda?.timers.push(timer);
            return timer;
        };
        scheduleCoda(CODA_TIMING.drop, () => this.breakCodaReflection());
        scheduleCoda(CODA_TIMING.mother, () => {
            if (!this.coda) return;
            this.coda.line = setNarrativeDepth(this.scene.add?.text?.(320, 160, CODA_TEXT.mother, {
                fontSize: '18px', color: '#d9d4c7'
            }), 49);
        });
        scheduleCoda(CODA_TIMING.preview, () => this.showCodaCard());
        scheduleCoda(CODA_TIMING.finish, () => this.finishCoda());
    }

    breakCodaReflection() {
        const coda = this.coda;
        if (!coda || coda.drop) return;
        const bowl = this.findProp('main_cold_bowl');
        const drop = setNarrativeDepth(this.scene.add?.rectangle?.((bowl?.x ?? 384) + 5, (bowl?.y ?? 220) - 8, 3, 8, 0xa8c7d8, 0.7), 48);
        if (!drop) return;
        drop.setAlpha?.(0.7);
        coda.drop = drop;
        const outline = coda.outline;
        outline?.setAlpha?.(0.06);
        outline?.setScale?.(0.82);
        outline?.setPosition?.((outline.x ?? 0) + 3, (outline.y ?? 0) + 7);
        this.ownCodaTween(coda, {
            targets: outline,
            alpha: 0,
            scale: 0.66,
            duration: 360,
            ease: 'Sine.easeOut'
        });
        this.ownCodaTween(coda, {
            targets: drop,
            y: drop.y + 14,
            alpha: 0,
            duration: 360,
            ease: 'Sine.easeIn'
        });
    }

    showCodaCard() {
        if (!this.coda || this.coda.card) return;
        this.coda.card = setNarrativeDepth(this.scene.add?.text?.(320, 220, CODA_TEXT.preview, {
            fontSize: '20px', color: '#ece6db'
        }), 50);
        this.coda.card?.setAlpha?.(0);
        this.ownCodaTween(this.coda, {
            targets: this.coda.card,
            alpha: 1,
            duration: 420,
            ease: 'Sine.easeOut'
        });
    }

    skipCoda() {
        if (!this.coda?.card) return false;
        this.finishCoda();
        return true;
    }

    finishCoda() {
        const coda = this.coda;
        if (!coda) return;
        this.coda = null;
        for (const timer of coda.timers || []) {
            timer?.remove?.();
            timer?.destroy?.();
        }
        for (const tween of coda.tweens || []) {
            tween?.stop?.();
            if (typeof tween?.remove === 'function') tween.remove();
            else tween?.destroy?.();
        }
        this.ownedTimers = this.ownedTimers.filter(timer => !(coda.timers || []).includes(timer));
        this.ownedTweens = this.ownedTweens.filter(tween => !(coda.tweens || []).includes(tween));
        for (const key of ['bowl', 'outline', 'drop', 'line', 'card']) destroyObject(coda[key]);
    }

    ownCodaTween(coda, config) {
        const tween = this.ownTween(config);
        if (tween) coda?.tweens.push(tween);
        return tween;
    }

    ownTween(config) {
        const tween = this.scene.tweens?.add?.(config);
        if (tween) this.ownedTweens.push(tween);
        return tween;
    }

    ownTimer(delay, callback) {
        const timer = this.scene.time?.delayedCall?.(delay, callback);
        if (timer) this.ownedTimers.push(timer);
        return timer;
    }

    update(_time, _delta) {
        if (this.destroyed) return;
        this.syncBagPlane();
        this.syncPaperDoll();
        const player = this.scene.player?.sprite;
        const movedDistance = narrativeDistanceBetween(player, this.lastPlayerPosition);
        if (this.mirrorReflection && movedDistance > 0.5) this.clearMirrorReflection();
        if (this.paperDoll && player) {
            const dx = this.paperDoll.x - player.x;
            const dy = this.paperDoll.y - player.y;
            const length = Math.hypot(dx, dy);
            const facingLength = Math.hypot(this.scene.player?.facingX || 0, this.scene.player?.facingY || 0);
            const facingDot = length > 0 && facingLength > 0
                ? (dx / length) * (this.scene.player.facingX / facingLength) +
                    (dy / length) * (this.scene.player.facingY / facingLength)
                : 0;
            this.tryMovePaperDoll({ facingDot, movedDistance, blocked: this.isPaperDollBlocked() });
        }
        this.lastPlayerPosition = player ? { x: player.x, y: player.y } : null;
    }

    isPaperDollBlocked() {
        return globalThis.window?.dialogActive === true ||
            this.scene.memoryReplayDirector?.active === true ||
            this.scene.isSwitching === true ||
            this.scene.kitchenTableController?.isCarryingAnimation === true ||
            this.scene.houseRuleDirector?.activeBell != null;
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.events?.off?.(NARRATIVE_SHUTDOWN_EVENT, this.shutdownHandler);
        for (const tween of this.ownedTweens) {
            tween?.stop?.();
            if (typeof tween?.remove === 'function') tween.remove();
            else tween?.destroy?.();
        }
        for (const timer of this.ownedTimers) {
            timer?.remove?.();
            timer?.destroy?.();
        }
        this.ownedTweens = [];
        this.ownedTimers = [];
        this.removePaperDoll();
        destroyObject(this.bagPlane);
        this.bagPlane = null;
        this.clearMirrorReflection();
        this.finishCoda();
    }
}
