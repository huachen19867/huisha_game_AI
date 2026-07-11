import assert from 'node:assert/strict';
import { syncCustomStaticBody, syncStaticBody } from '../src/systems/PhysicsSync.js';

let refreshCalls = 0;
assert.equal(syncStaticBody({ refreshBody() { refreshCalls += 1; } }), true);
assert.equal(refreshCalls, 1);

let updateCalls = 0;
assert.equal(syncStaticBody({ body: { updateFromGameObject() { updateCalls += 1; } } }), true);
assert.equal(updateCalls, 1);
assert.equal(syncStaticBody(null), false);
assert.equal(syncStaticBody({}), false);

const calls = [];
const customBody = {
    refreshBody() { calls.push('refresh'); },
    body: {
        setSize(width, height) { calls.push(`size:${width}x${height}`); },
        setOffset(x, y) { calls.push(`offset:${x},${y}`); }
    }
};
assert.equal(syncCustomStaticBody(customBody, 14, 28, 25, 34), true);
assert.deepEqual(calls, ['refresh', 'size:14x28', 'offset:25,34']);

console.log('Physics sync verification passed');
