import assert from 'node:assert/strict';
import { syncStaticBody } from '../src/systems/PhysicsSync.js';

let refreshCalls = 0;
assert.equal(syncStaticBody({ refreshBody() { refreshCalls += 1; } }), true);
assert.equal(refreshCalls, 1);

let updateCalls = 0;
assert.equal(syncStaticBody({ body: { updateFromGameObject() { updateCalls += 1; } } }), true);
assert.equal(updateCalls, 1);
assert.equal(syncStaticBody(null), false);
assert.equal(syncStaticBody({}), false);

console.log('Physics sync verification passed');
