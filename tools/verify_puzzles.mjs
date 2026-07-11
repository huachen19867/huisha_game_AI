import assert from 'node:assert/strict';
import { Puzzles, canStartPuzzle, isPuzzleAnswerCorrect } from '../src/data/Puzzles.js';

assert.equal(Puzzles.school.kind, 'board');
assert.equal(Puzzles.hospital.kind, 'board');
assert.equal(canStartPuzzle(Puzzles.school, ['school_detention_clock']), false);
assert.equal(canStartPuzzle(Puzzles.school, Puzzles.school.prerequisites), true);
assert.equal(isPuzzleAnswerCorrect(Puzzles.school, Puzzles.school.answer), true);
assert.equal(isPuzzleAnswerCorrect(Puzzles.school, { ...Puzzles.school.answer, false_claim: 'report' }), false);

console.log('Puzzle verification passed');
