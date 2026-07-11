import assert from 'node:assert/strict';
import {
    canChooseCrashEnding,
    createDefaultGameState,
    ensureStoryFlags,
    getExitRoute,
    getTruthLevel,
    reconcileFamilyPhoto
} from '../src/systems/StoryState.js';

const state = createDefaultGameState();
const flags = ensureStoryFlags(state);
assert.deepEqual(flags.puzzles, { school: false, hospital: false });
assert.equal(flags.photoSetCollected, false);
assert.equal(flags.familyPhotoCornerFound, false);
assert.equal(flags.familyPhotoAssembled, false);
assert.equal(flags.chasePhase, 'idle');
assert.deepEqual(flags.crashEvidence, { car: false, guardrail: false });
assert.equal(flags.coffinOpened, false);
assert.equal(getTruthLevel(state), 'surface');
assert.equal(getExitRoute(state), 'ending_pojian');

flags.puzzles.school = true;
flags.puzzles.hospital = true;
assert.equal(getTruthLevel(state), 'family');
assert.equal(getExitRoute(state), 'ending_huisha');

flags.photoSetCollected = true;
assert.equal(reconcileFamilyPhoto(state), false);
flags.familyPhotoCornerFound = true;
assert.equal(reconcileFamilyPhoto(state), true);
flags.clues.death = 2;
flags.coffinOpened = true;
assert.equal(getTruthLevel(state), 'complete');
assert.equal(getExitRoute(state), 'memory_crash');
assert.equal(canChooseCrashEnding(state), false);
flags.crashEvidence.car = true;
flags.crashEvidence.guardrail = true;
assert.equal(canChooseCrashEnding(state), true);

console.log('Progression verification passed');
