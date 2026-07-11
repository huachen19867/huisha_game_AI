import assert from 'node:assert/strict';
import {
    collectClue,
    createDefaultStoryFlags,
    ensureStoryFlags,
    getTruthLevel
} from '../src/systems/StoryState.js';

const emptyState = {};
const flags = ensureStoryFlags(emptyState);

assert.deepEqual(flags.clues, { control: 0, illness: 0, death: 0 });
assert.deepEqual(flags.memories, { school: false, hospital: false, crash: false });
assert.equal(flags.endingChoice, null);
assert.equal(emptyState.sanity, 100);

assert.equal(collectClue(emptyState, 'family_rules', 'control'), true);
assert.equal(collectClue(emptyState, 'family_rules', 'control'), false);
assert.equal(emptyState.storyFlags.clues.control, 1);

collectClue(emptyState, 'father_note', 'control');
collectClue(emptyState, 'medical_record', 'illness');
collectClue(emptyState, 'prescription', 'illness');
assert.equal(getTruthLevel(emptyState), 'surface');
flags.puzzles.school = true;
flags.puzzles.hospital = true;
assert.equal(getTruthLevel(emptyState), 'family');

collectClue(emptyState, 'toy_plane', 'death');
collectClue(emptyState, 'crash_guardrail', 'death');
flags.photoSetCollected = true;
flags.familyPhotoCornerFound = true;
flags.familyPhotoAssembled = true;
flags.coffinOpened = true;
assert.equal(getTruthLevel(emptyState), 'complete');

const freshFlags = createDefaultStoryFlags();
freshFlags.clues.control = 5;
assert.equal(createDefaultStoryFlags().clues.control, 0);

console.log('Story state verification passed');
