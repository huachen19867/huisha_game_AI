import assert from 'node:assert/strict';
import { canAdvanceWatcher, evaluateListeningWindow } from '../src/systems/HauntingDirector.js';

assert.equal(canAdvanceWatcher({ dialogActive: true, puzzleActive: false, facingDot: -1, movedDistance: 40 }), false);
assert.equal(canAdvanceWatcher({ dialogActive: false, puzzleActive: true, facingDot: -1, movedDistance: 40 }), false);
assert.equal(canAdvanceWatcher({ dialogActive: false, puzzleActive: false, facingDot: 0.8, movedDistance: 40 }), false);
assert.equal(canAdvanceWatcher({ dialogActive: false, puzzleActive: false, facingDot: -0.4, movedDistance: 40 }), true);
assert.equal(canAdvanceWatcher({ dialogActive: false, puzzleActive: false, facingDot: -0.4, movedDistance: 10 }), false);

assert.equal(evaluateListeningWindow({ elapsedMs: 2500, movedDistance: 0 }), 'survived');
assert.equal(evaluateListeningWindow({ elapsedMs: 900, movedDistance: 18 }), 'noticed');
assert.equal(evaluateListeningWindow({ elapsedMs: 900, movedDistance: 2 }), 'listening');

console.log('Haunting director verification passed');
