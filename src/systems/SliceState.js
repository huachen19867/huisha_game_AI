import { isSliceDoorId } from '../data/SliceMaps.js';
import {
    KITCHEN_BOWLS,
    evaluateSeating,
    normalizeBowlPlacements
} from './KitchenTableRules.js';

export const SLICE_PHASES = Object.freeze(['arrival', 'investigation', 'table', 'rule', 'bedroom', 'return', 'complete']);

const FATHER_ATTENTION_STATES = Object.freeze(['quiet', 'suspicious', 'checking', 'chasing']);

export function createDefaultSliceState() {
    return {
        enabled: true,
        slicePhase: 'arrival',
        bowlPlacements: { nail: null, stove: null, side: null },
        heldBowl: null,
        mealReplaySeen: [],
        tableSolved: false,
        houseRuleDemonstrated: false,
        fatherAttention: 'quiet',
        lastTraversedDoor: 'main_kitchen_door',
        planeChoice: null,
        paperDollIndex: 0,
        sliceCompleted: false
    };
}

export function ensureSliceState(gameState) {
    if (!gameState.slice || typeof gameState.slice !== 'object' || Array.isArray(gameState.slice)) {
        gameState.slice = createDefaultSliceState();
    }
    const defaults = createDefaultSliceState();
    const source = gameState.slice;
    const slicePhase = SLICE_PHASES.includes(source.slicePhase) ? source.slicePhase : defaults.slicePhase;
    const sourcePlacements = source.bowlPlacements;
    const bowlPlacements = normalizeBowlPlacements(
        sourcePlacements !== null && typeof sourcePlacements === 'object' && !Array.isArray(sourcePlacements)
            ? sourcePlacements
            : defaults.bowlPlacements
    );
    const tableSolved = source.tableSolved === true && evaluateSeating(bowlPlacements).status === 'correct';
    let heldBowl = KITCHEN_BOWLS.includes(source.heldBowl) ? source.heldBowl : null;
    if (tableSolved) {
        heldBowl = null;
    } else if (heldBowl !== null) {
        for (const seat of Object.keys(bowlPlacements)) {
            if (bowlPlacements[seat] === heldBowl) bowlPlacements[seat] = null;
        }
    }
    const mealReplaySeen = Array.isArray(source.mealReplaySeen)
        ? [...new Set(source.mealReplaySeen.filter(replayId => typeof replayId === 'string' && replayId.length > 0))]
        : [];
    gameState.slice = {
        ...defaults,
        ...source,
        slicePhase,
        bowlPlacements,
        heldBowl,
        mealReplaySeen,
        tableSolved,
        houseRuleDemonstrated: tableSolved && source.houseRuleDemonstrated === true,
        fatherAttention: FATHER_ATTENTION_STATES.includes(source.fatherAttention)
            ? source.fatherAttention
            : defaults.fatherAttention,
        lastTraversedDoor: isSliceDoorId(source.lastTraversedDoor)
            ? source.lastTraversedDoor
            : defaults.lastTraversedDoor,
        planeChoice: source.planeChoice === 'take' || source.planeChoice === 'leave'
            ? source.planeChoice
            : null,
        paperDollIndex: Number.isInteger(source.paperDollIndex) && source.paperDollIndex >= 0 && source.paperDollIndex <= 2
            ? source.paperDollIndex
            : defaults.paperDollIndex,
        sliceCompleted: slicePhase === 'complete'
    };
    return gameState.slice;
}

export function transitionSlicePhase(state, nextPhase) {
    const current = SLICE_PHASES.indexOf(state.slicePhase);
    const next = SLICE_PHASES.indexOf(nextPhase);
    if (current < 0) throw new Error(`Unknown slice phase: ${state.slicePhase}`);
    if (next < 0) throw new Error(`Unknown slice phase: ${nextPhase}`);
    if (next > current + 1) throw new Error(`Slice phase cannot skip from ${state.slicePhase} to ${nextPhase}`);
    if (next < current) return state;
    return { ...state, slicePhase: nextPhase, sliceCompleted: nextPhase === 'complete' };
}

export function choosePlane(state, choice) {
    if (!['take', 'leave'].includes(choice)) throw new Error(`Unknown plane choice: ${choice}`);
    if (state.planeChoice && state.planeChoice !== choice) throw new Error('Plane choice is locked');
    return { ...state, planeChoice: choice };
}
