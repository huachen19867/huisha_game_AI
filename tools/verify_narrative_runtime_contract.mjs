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

console.log('Narrative runtime contract verification passed');
