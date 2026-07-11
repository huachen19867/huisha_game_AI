import assert from 'node:assert/strict';
import { DomListenerRegistry } from '../src/systems/DomListenerRegistry.js';

const listeners = new Map();
const target = {
    addEventListener(type, handler) { listeners.set(`${type}:${handler.name}`, handler); },
    removeEventListener(type, handler) { listeners.delete(`${type}:${handler.name}`); }
};

const registry = new DomListenerRegistry();
function onTouchStart() {}
function onMouseDown() {}
registry.add(target, 'touchstart', onTouchStart, { passive: false });
registry.add(target, 'mousedown', onMouseDown);
assert.equal(registry.size, 2);
assert.equal(listeners.size, 2);
registry.clear();
assert.equal(registry.size, 0);
assert.equal(listeners.size, 0);
registry.clear();

console.log('DOM listener registry verification passed');
