import assert from 'node:assert/strict';
import { Puzzles, canStartPuzzle, isPuzzleAnswerCorrect } from '../src/data/Puzzles.js';

assert.deepEqual(Puzzles.school.answer, ['exam_1986', 'exam_1987', 'exam_1988']);
assert.deepEqual(Puzzles.hospital.answer, ['diagnosis', 'prescription', 'unpaid_bill']);
assert.equal(canStartPuzzle(Puzzles.school, ['school_blackboard']), false);
assert.equal(canStartPuzzle(Puzzles.school, ['school_blackboard', 'school_report']), true);
assert.equal(isPuzzleAnswerCorrect(Puzzles.school, ['exam_1986', 'exam_1987', 'exam_1988']), true);
assert.equal(isPuzzleAnswerCorrect(Puzzles.school, ['exam_1988', 'exam_1987', 'exam_1986']), false);

console.log('Puzzle verification passed');
