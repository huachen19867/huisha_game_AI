import assert from 'node:assert/strict';
import { Maps } from '../src/data/Maps.js';
import { Puzzles } from '../src/data/Puzzles.js';
import { applyPuzzleOutcome, createDefaultGameState } from '../src/systems/StoryState.js';
import { readFile } from 'node:fs/promises';

const state = createDefaultGameState();
for (const [puzzleId, flag, item] of [
    ['kitchen_table', 'hasRice', '倒头饭'],
    ['secret_seals', 'hasMatches', '火柴'],
    ['well_knots', 'hasIncense', '香'],
    ['attic_debt', 'hasSpiritMoney', '纸钱']
]) {
    assert.equal(state[flag], false);
    const first = applyPuzzleOutcome(state, Puzzles[puzzleId]);
    assert.equal(first.newlyCompleted, true);
    assert.equal(first.rewardItem, item);
    assert.equal(state[flag], true);
    assert.equal(applyPuzzleOutcome(state, Puzzles[puzzleId]).newlyCompleted, false, `${puzzleId} reward must be idempotent`);
}

assert.equal(state.storyFlags.ritualSolved, false);
const ritual = applyPuzzleOutcome(state, Puzzles.altar_ritual);
assert.equal(ritual.newlyCompleted, true);
assert.equal(state.storyFlags.ritualSolved, true);
assert.equal(state.candlesLit, 2);

assert.equal(Maps.room_kitchen.objects.cabinet.puzzleId, 'kitchen_table');
assert.ok(Maps.room_secret.objects.interactables.some(item => item.puzzleId === 'secret_seals'));
assert.equal(Maps.room_backyard.objects.incense.puzzleId, 'well_knots');
assert.equal(Maps.room_attic.objects.spirit_money.puzzleId, 'attic_debt');
assert.equal(Maps.room_main.objects.altar.puzzleId, 'altar_ritual');
assert.equal(Maps.room_kitchen.objects.npc.clueId, 'kitchen_ghost_gesture');

const interactions = await readFile(new URL('../src/systems/InteractionManager.js', import.meta.url), 'utf8');
assert.match(
    interactions,
    /if \(type === 'kitchen_ghost'\) \{\s*this\.collectClue\('kitchen_ghost_gesture', 'death'\)/,
    'observing the kitchen ghost must record the gesture evidence'
);

console.log('Ritual progression verification passed');
