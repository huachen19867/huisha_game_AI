import assert from 'node:assert/strict';
import {
    ARRIVAL_DELAY_MS,
    DOOR_BANG_MS,
    MATERIALIZE_MS,
    REPATH_MS,
    SPAWN_RETRY_MS,
    WARNING_MS,
    getArrivalStage
} from '../src/systems/ChaseManager.js';
import { readFileSync } from 'node:fs';

assert.equal(DOOR_BANG_MS, 2000);
assert.equal(WARNING_MS, 3000);
assert.equal(ARRIVAL_DELAY_MS, 4000);
assert.equal(MATERIALIZE_MS, 600);
assert.equal(REPATH_MS, 350);
assert.equal(SPAWN_RETRY_MS, 500);
assert.equal(getArrivalStage(1999), 'approaching');
assert.equal(getArrivalStage(2000), 'door_bang');
assert.equal(getArrivalStage(3000), 'warning');
assert.equal(getArrivalStage(4000), 'arriving');

const sceneSource = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
assert.doesNotMatch(sceneSource, /\n\s+spawnChaser\(\)/);
assert.doesNotMatch(sceneSource, /\n\s+updateChaser\(\)/);
assert.doesNotMatch(sceneSource, /setPosition\(this\.player\.sprite\.x \+ Math\.cos\(angle\) \* 100/);

console.log('Chase timing verification passed');
