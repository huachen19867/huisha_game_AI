export const KITCHEN_SEATS = Object.freeze(['nail', 'stove', 'side']);
export const KITCHEN_BOWLS = Object.freeze(['wine', 'medicine', 'child']);
export const CORRECT_SEATING = Object.freeze({
    nail: 'wine',
    stove: 'medicine',
    side: 'child'
});

const CONTRADICTIONS = [
    ['nail', 'wine', 'father_lock'],
    ['stove', 'medicine', 'mother_break'],
    ['side', 'child', 'child_shard']
];

export function normalizeBowlPlacements(placements) {
    if (placements === null || typeof placements !== 'object' || Array.isArray(placements)) {
        throw new Error('Placements must be an object');
    }

    const seenBowls = new Set();
    return Object.fromEntries(KITCHEN_SEATS.map(seat => {
        const bowl = placements[seat];
        if (!KITCHEN_BOWLS.includes(bowl) || seenBowls.has(bowl)) {
            return [seat, null];
        }
        seenBowls.add(bowl);
        return [seat, bowl];
    }));
}

export function placeBowl(placements, seat, bowl) {
    const nextPlacements = normalizeBowlPlacements(placements);
    if (!KITCHEN_SEATS.includes(seat)) {
        throw new Error(`Unknown seat: ${seat}`);
    }
    if (!KITCHEN_BOWLS.includes(bowl)) {
        throw new Error(`Unknown bowl: ${bowl}`);
    }

    for (const currentSeat of KITCHEN_SEATS) {
        if (nextPlacements[currentSeat] === bowl) nextPlacements[currentSeat] = null;
    }
    nextPlacements[seat] = bowl;
    return nextPlacements;
}

export function evaluateSeating(placements) {
    const normalizedPlacements = normalizeBowlPlacements(placements);
    if (KITCHEN_SEATS.some(seat => normalizedPlacements[seat] === null)) {
        return { status: 'incomplete', contradictions: [] };
    }

    const contradictions = CONTRADICTIONS
        .filter(([seat, expectedBowl]) => normalizedPlacements[seat] !== expectedBowl)
        .map(([, , contradictionId]) => contradictionId);

    if (contradictions.length === 0) {
        return { status: 'correct', contradictions: [] };
    }
    return { status: 'incorrect', contradictions };
}

export function selectContradiction(placements, seen = []) {
    if (!Array.isArray(seen)) {
        throw new Error('Seen contradictions must be an array');
    }
    const { contradictions } = evaluateSeating(placements);
    if (contradictions.length === 0) return null;
    return contradictions.find(contradictionId => !seen.includes(contradictionId))
        ?? contradictions[0];
}
