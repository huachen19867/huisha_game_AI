import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    formatInteractionPrompt,
    normalizeInteractionMeta,
    scoreInteractionCandidate
} from '../src/systems/InteractionRules.js';
import { Maps } from '../src/data/Maps.js';

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

const photoMeta = normalizeInteractionMeta({ id: 'photo_1', interactLabel: '1998 年旧照片' }, { textureKey: 'photo_frame' });
assert.equal(photoMeta.label, '1998 年旧照片');
assert.equal(photoMeta.verb, '查看');

const frontStory = scoreInteractionCandidate({ distance: 62, priority: 30, facingDot: 0.9 });
const behindDecoration = scoreInteractionCandidate({ distance: 24, priority: 10, facingDot: -0.9 });
assert.ok(frontStory > behindDecoration, 'facing story object should beat a closer object behind the player');

const mapManagerSource = readFileSync(new URL('../src/systems/MapManager.js', import.meta.url), 'utf8');
assert.match(mapManagerSource, /addToInteractables\(photo,/);
assert.match(mapManagerSource, /if \(objs\.incense && !scene\.gameState\.hasIncense\)/);
assert.match(mapManagerSource, /if \(objs\.spirit_money && !scene\.gameState\.hasSpiritMoney\)/);

const incenseMeta = normalizeInteractionMeta(Maps.room_backyard.objects.incense, { textureKey: 'trash_paper' });
assert.equal(incenseMeta.label, '缠结的井绳');
assert.equal(incenseMeta.verb, '解结');

console.log('Interaction rule verification passed');
