import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Maps } from '../src/data/Maps.js';

const outdoorMaps = new Set(['room_prologue', 'room_entrance', 'room_backyard', 'memory_crash']);
for (const [mapId, map] of Object.entries(Maps)) {
    assert.equal(map.visual?.rain === true, outdoorMaps.has(mapId), `${mapId} rain contract mismatch`);
}

const gameSceneSource = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
const chaseSource = readFileSync(new URL('../src/systems/ChaseManager.js', import.meta.url), 'utf8');
const soundSource = readFileSync(new URL('../src/systems/SoundManager.js', import.meta.url), 'utf8');
assert.match(gameSceneSource, /this\.soundManager\.setScene\(this\)/);
assert.match(chaseSource, /this\.scene\.physics\.resume\(\)/);
assert.doesNotMatch(gameSceneSource, /this\.scene\.restart\(\);/);
assert.match(soundSource, /setScene\(scene\)/);

console.log('Scene runtime contract verification passed');
