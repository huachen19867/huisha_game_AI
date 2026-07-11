export function createPuzzleProgress() {
    return { assignments: {}, attempts: 0 };
}

export function assignPuzzleToken(progress, slotId, tokenId) {
    const assignments = { ...(progress?.assignments || {}) };
    Object.keys(assignments).forEach(key => {
        if (assignments[key] === tokenId) delete assignments[key];
    });
    if (tokenId) assignments[slotId] = tokenId;
    else delete assignments[slotId];
    return { assignments, attempts: progress?.attempts || 0 };
}

export function evaluatePuzzle(puzzle, assignments = {}, collectedClues = []) {
    const missing = (puzzle?.prerequisites || []).filter(id => !collectedClues.includes(id));
    if (missing.length) return { status: 'blocked', missing };

    const emptySlots = (puzzle?.slots || [])
        .map(slot => slot.id)
        .filter(slotId => !assignments[slotId]);
    if (emptySlots.length) return { status: 'incomplete', emptySlots };

    const wrongSlot = (puzzle?.slots || []).find(slot => assignments[slot.id] !== puzzle.answer?.[slot.id]);
    if (wrongSlot) {
        return {
            status: 'incorrect',
            conflictKey: puzzle.conflicts?.[wrongSlot.id] || 'evidence_conflict',
            conflictSlots: [wrongSlot.id]
        };
    }
    return { status: 'correct' };
}
