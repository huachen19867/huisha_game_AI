import { isSliceDoorId } from '../data/SliceMaps.js';
import {
    KITCHEN_BOWLS,
    evaluateSeating,
    normalizeBowlPlacements
} from './KitchenTableRules.js';
import { normalizeMealReplaySeen } from './MemoryReplayDirector.js';

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
        bedroomInvestigations: { mirror: false, plane: false },
        paperDollIndex: 0,
        takeReturnAttentionRaised: false,
        sliceCompleted: false
    };
}

export function ensureSliceState(gameState) {
    if (!gameState.slice || typeof gameState.slice !== 'object' || Array.isArray(gameState.slice)) {
        gameState.slice = createDefaultSliceState();
    }
    const defaults = createDefaultSliceState();
    const source = gameState.slice;
    let slicePhase = SLICE_PHASES.includes(source.slicePhase) ? source.slicePhase : defaults.slicePhase;
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
    const mealReplaySeen = normalizeMealReplaySeen(source.mealReplaySeen);
    const planeChoice = source.planeChoice === 'take' || source.planeChoice === 'leave'
        ? source.planeChoice
        : null;
    const rawInvestigations = source.bedroomInvestigations;
    const bedroomInvestigations = {
        mirror: rawInvestigations?.mirror === true,
        plane: rawInvestigations?.plane === true
    };
    if (planeChoice) {
        bedroomInvestigations.mirror = true;
        bedroomInvestigations.plane = true;
        if (SLICE_PHASES.indexOf(slicePhase) < SLICE_PHASES.indexOf('return')) slicePhase = 'return';
    }
    gameState.slice = {
        enabled: true,
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
        planeChoice,
        bedroomInvestigations,
        paperDollIndex: Number.isInteger(source.paperDollIndex) && source.paperDollIndex >= 0 && source.paperDollIndex <= 2
            ? source.paperDollIndex
            : defaults.paperDollIndex,
        takeReturnAttentionRaised: planeChoice === 'take' && source.takeReturnAttentionRaised === true,
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
    if (state.planeChoice === choice) return { ...state };
    if (state.slicePhase !== 'bedroom') throw new Error('Plane choice requires the bedroom phase');
    return {
        ...state,
        planeChoice: choice,
        slicePhase: 'return',
        sliceCompleted: false
    };
}
