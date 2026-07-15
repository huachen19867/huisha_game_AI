export const SLICE_PHASES = Object.freeze(['arrival', 'investigation', 'table', 'rule', 'bedroom', 'return', 'complete']);

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
        lastTraversedDoor: 'main_to_kitchen',
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
    const slicePhase = SLICE_PHASES.includes(gameState.slice.slicePhase) ? gameState.slice.slicePhase : defaults.slicePhase;
    gameState.slice = {
        ...defaults,
        ...gameState.slice,
        slicePhase,
        bowlPlacements: { ...defaults.bowlPlacements, ...(gameState.slice.bowlPlacements || {}) },
        mealReplaySeen: Array.isArray(gameState.slice.mealReplaySeen) ? [...new Set(gameState.slice.mealReplaySeen)] : [],
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
