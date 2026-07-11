import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const interactions = await readFile(new URL('src/systems/InteractionManager.js', root), 'utf8');
const scene = await readFile(new URL('src/scenes/GameScene.js', root), 'utf8');

for (const id of ['puzzle-clues', 'puzzle-slots', 'puzzle-tokens', 'puzzle-submit']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
}
assert.match(html, /window\.showPuzzle\s*=\s*function\s*\(config,\s*initialProgress,\s*callbacks\)/);
assert.match(html, /callbacks\.onChange/);
assert.match(html, /callbacks\.onMistake/);
assert.match(html, /callbacks\.onSuccess/);
assert.match(html, /callbacks\.onClose/);
assert.match(
    html,
    /if \(result\.status === 'correct'\) \{\s*close\(false\);\s*callbacks\.onSuccess\?\.\(result\)/,
    'the puzzle must release its own input lock before the success callback opens a dialog'
);
assert.match(html, /evaluatePuzzle\(config/);
assert.match(html, /assignPuzzleToken\(/);
assert.match(html, /attempts\s*>=\s*config\.strongHintAfter/);
assert.match(html, /attempts\s*>=\s*config\.hintAfter/);

assert.match(interactions, /openConfiguredPuzzle\(obj/);
assert.match(interactions, /flags\.puzzleProgress\[puzzle\.id\]/);
assert.match(interactions, /flags\.caseConclusions/);
assert.match(interactions, /window\.showPuzzle\(\{\s*\.\.\.puzzle,\s*availableEvidence:\s*evidenceIds\s*\},\s*progress,\s*\{/);
assert.match(scene, /window\.closePuzzle\?\.\(\)/, 'scene shutdown must release the puzzle input lock');

console.log('Puzzle runtime contract verification passed');
