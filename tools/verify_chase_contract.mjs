import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultGameState, reconcileFamilyPhoto } from '../src/systems/StoryState.js';

const state = createDefaultGameState();
state.storyFlags.photoSetCollected = true;
assert.equal(reconcileFamilyPhoto(state), false);
state.storyFlags.familyPhotoCornerFound = true;
assert.equal(reconcileFamilyPhoto(state), true);

const chaseSource = readFileSync(new URL('../src/systems/ChaseManager.js', import.meta.url), 'utf8');
const interactionSource = readFileSync(new URL('../src/systems/InteractionManager.js', import.meta.url), 'utf8');
assert.match(chaseSource, /HIDE_ESCAPE_MS = 6000/);
assert.match(chaseSource, /escape\('hide'\)/);
assert.match(interactionSource, /chaseManager\.escape\('photo'\)/);
assert.match(chaseSource, /scene\.physics\.resume\(\)/);

console.log('Chase contract verification passed');
