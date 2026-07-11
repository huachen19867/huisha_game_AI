import assert from 'node:assert/strict';
import { Puzzles } from '../src/data/Puzzles.js';
import { createDefaultStoryFlags, ensureStoryFlags } from '../src/systems/StoryState.js';
import { assignPuzzleToken, createPuzzleProgress, evaluatePuzzle } from '../src/systems/PuzzleState.js';

const tinyPuzzle = {
    prerequisites: ['sink'],
    slots: [{ id: 'north' }, { id: 'south' }],
    answer: { north: 'mother', south: 'child' },
    conflicts: { north: 'seat_near_stove', south: 'child_near_door' }
};

const progress = createPuzzleProgress(tinyPuzzle);
assert.deepEqual(progress, { assignments: {}, attempts: 0 });

const one = assignPuzzleToken(progress, 'north', 'mother');
assert.deepEqual(one.assignments, { north: 'mother' });
assert.deepEqual(progress.assignments, {}, 'assignment must not mutate persisted state in place');

const moved = assignPuzzleToken(one, 'south', 'mother');
assert.deepEqual(moved.assignments, { south: 'mother' }, 'a token may occupy only one slot');

assert.deepEqual(
    evaluatePuzzle(tinyPuzzle, { north: 'father' }, []),
    { status: 'blocked', missing: ['sink'] }
);
assert.deepEqual(
    evaluatePuzzle(tinyPuzzle, { north: 'mother' }, ['sink']),
    { status: 'incomplete', emptySlots: ['south'] }
);
assert.deepEqual(
    evaluatePuzzle(tinyPuzzle, { north: 'father', south: 'child' }, ['sink']),
    { status: 'incorrect', conflictKey: 'seat_near_stove', conflictSlots: ['north'] }
);
assert.deepEqual(
    evaluatePuzzle(tinyPuzzle, { north: 'mother', south: 'child' }, ['sink']),
    { status: 'correct' }
);

for (const puzzleId of ['kitchen_table', 'school', 'hospital', 'secret_seals', 'well_knots', 'attic_debt', 'altar_ritual']) {
    assert.equal(Puzzles[puzzleId]?.kind, 'board', `${puzzleId} must use the evidence board`);
    assert.ok(Puzzles[puzzleId].slots.length >= 2, `${puzzleId} must require more than one assignment`);
    assert.ok(Puzzles[puzzleId].tokens.length >= Puzzles[puzzleId].slots.length);
    assert.ok(Puzzles[puzzleId].conclusion || puzzleId === 'well_knots' || puzzleId === 'altar_ritual');
}

const defaults = createDefaultStoryFlags();
assert.deepEqual(defaults.puzzleProgress, {});
assert.deepEqual(defaults.caseConclusions, []);
assert.equal(defaults.ritualSolved, false);
assert.deepEqual(defaults.hauntingSeen, []);

const legacy = { storyFlags: { puzzleProgress: null, caseConclusions: null, hauntingSeen: null, ritualSolved: 1 } };
const normalized = ensureStoryFlags(legacy);
assert.deepEqual(normalized.puzzleProgress, {});
assert.deepEqual(normalized.caseConclusions, []);
assert.deepEqual(normalized.hauntingSeen, []);
assert.equal(normalized.ritualSolved, true);

console.log('Puzzle state verification passed');
