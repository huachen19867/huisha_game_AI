import assert from 'node:assert/strict';
import {
    resolveSpawnCoordinate,
    updateBoundedResource,
    updateStaminaState
} from '../src/systems/RuntimeState.js';

assert.equal(resolveSpawnCoordinate(0, 320), 0);
assert.equal(resolveSpawnCoordinate(undefined, 320), 320);
assert.equal(resolveSpawnCoordinate(null, 320), 320);

const running = updateStaminaState({
    stamina: 50,
    maxStamina: 100,
    exhausted: false,
    wantsRun: true,
    isMoving: true,
    deltaMs: 1000
});
assert.deepEqual(running, { stamina: 40, exhausted: false, isRunning: true });

const idle60 = Array.from({ length: 60 }).reduce(
    state => updateStaminaState({ ...state, maxStamina: 100, wantsRun: false, isMoving: false, deltaMs: 1000 / 60 }),
    { stamina: 50, exhausted: false, isRunning: false }
);
const idle144 = Array.from({ length: 144 }).reduce(
    state => updateStaminaState({ ...state, maxStamina: 100, wantsRun: false, isMoving: false, deltaMs: 1000 / 144 }),
    { stamina: 50, exhausted: false, isRunning: false }
);
assert.ok(Math.abs(idle60.stamina - idle144.stamina) < 0.001);

const sanity60 = Array.from({ length: 60 }).reduce(value => updateBoundedResource(value, -3, 1000 / 60, 0, 100), 100);
const sanity144 = Array.from({ length: 144 }).reduce(value => updateBoundedResource(value, -3, 1000 / 144, 0, 100), 100);
assert.ok(Math.abs(sanity60 - 97) < 0.001);
assert.ok(Math.abs(sanity60 - sanity144) < 0.001);

console.log('Runtime state verification passed');
