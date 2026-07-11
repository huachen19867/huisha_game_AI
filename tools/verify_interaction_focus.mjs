import assert from 'node:assert/strict';
import { Maps } from '../src/data/Maps.js';
import { selectInteractionCandidate } from '../src/systems/InteractionRules.js';

const cabinet = { id: 'kitchen_cabinet', distance: 18, priority: 30, facingDot: 1 };
const ghost = { id: 'kitchen_ghost', distance: 43, priority: 30, facingDot: 0.8 };
assert.equal(
    selectInteractionCandidate([cabinet, ghost]).id,
    'kitchen_cabinet',
    'the closest kitchen prop should win inside the focus band'
);

const nearGeneric = { id: 'generic', distance: 40, priority: 10, facingDot: 0.9 };
const closeStory = { id: 'story', distance: 52, priority: 30, facingDot: 1 };
assert.equal(
    selectInteractionCandidate([nearGeneric, closeStory]).id,
    'story',
    'story priority should break ties between similarly close props'
);

const distantStory = { id: 'distant_story', distance: 75, priority: 30, facingDot: 1 };
assert.equal(
    selectInteractionCandidate([cabinet, distantStory]).id,
    'kitchen_cabinet',
    'a distant story prop must not steal a prop the player is touching'
);

const kitchen = Maps.room_kitchen;
assert.deepEqual(kitchen.objects.cabinet.interaction, {
    label: '封死的饭柜',
    verb: '检查',
    priority: 30,
    radius: 80,
    marker: true
});
assert.ok(
    kitchen.objects.interactables?.some(item => item.id === 'kitchen_stove_marks'),
    'the kitchen needs stove marks as spatial evidence'
);

console.log('Interaction focus verification passed');
