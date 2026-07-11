import assert from 'node:assert/strict';
import {
    formatInteractionPrompt,
    normalizeInteractionMeta,
    scoreInteractionCandidate
} from '../src/systems/InteractionRules.js';

const storyMeta = normalizeInteractionMeta({
    id: 'father_note',
    documentTitle: '父亲笔记',
    clueId: 'father_note'
});
assert.deepEqual(storyMeta, {
    label: '父亲笔记',
    verb: '阅读',
    priority: 30,
    radius: 80,
    marker: true,
    blocksMovement: false
});
assert.equal(formatInteractionPrompt(storyMeta), '阅读：父亲笔记  [空格/E]');

const cabinetMeta = normalizeInteractionMeta({ id: 'my_cabinet' }, { textureKey: 'cabinet' });
assert.equal(cabinetMeta.label, '我的衣柜');
assert.equal(cabinetMeta.verb, '躲藏');
assert.equal(cabinetMeta.blocksMovement, true);

const frontStory = scoreInteractionCandidate({ distance: 62, priority: 30, facingDot: 0.9 });
const behindDecoration = scoreInteractionCandidate({ distance: 24, priority: 10, facingDot: -0.9 });
assert.ok(frontStory > behindDecoration, 'facing story object should beat a closer object behind the player');

console.log('Interaction rule verification passed');
