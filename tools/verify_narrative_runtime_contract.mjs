import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const interactionSource = readFileSync(new URL('../src/systems/InteractionManager.js', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');

assert.match(interactionSource, /if \(collected\) this\.scene\.queueNarrativeBeat\?\.\(\)/);
assert.match(sceneSource, /queueNarrativeBeat\(\)/);
assert.match(sceneSource, /flushNarrativeBeat\(\)/);
assert.match(sceneSource, /this\.narrativeBeatPlaying/);
assert.match(sceneSource, /getPendingNarrativeBeat\(this\.gameState\)/);
assert.match(sceneSource, /markNarrativeBeatSeen\(this\.gameState, beat\.id\)/);
assert.match(sceneSource, /if \(window\.dialogActive \|\| this\.isSwitching\)/);
assert.match(interactionSource, /flags\.photoSetCollected = true;\s+scene\.queueNarrativeBeat\(\)/);
assert.match(
    sceneSource,
    /if \(flags\.caseConclusions\.includes\('rewritten_night'\)\) flags\.postMemoryDialogShown\.school = true;/,
    'the school conclusion beat must replace the old duplicate return monologue'
);
assert.match(
    sceneSource,
    /if \(flags\.caseConclusions\.includes\('treatment_blocked'\)\) flags\.postMemoryDialogShown\.hospital = true;/,
    'the hospital conclusion beat must replace the old duplicate return monologue'
);

console.log('Narrative runtime contract verification passed');
