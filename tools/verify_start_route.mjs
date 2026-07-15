import assert from 'node:assert/strict';
import { resolveStartRoute } from '../src/systems/StartRoute.js';

assert.deepEqual(resolveStartRoute(''), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?legacy=1'), { scene: 'IntroScene', data: undefined });
assert.deepEqual(resolveStartRoute('?legacy=1&map=memory_school'), {
    scene: 'GameScene',
    data: { mapId: 'memory_school', sliceMode: false }
});

for (const search of [
    '?legacy=1&legacy=0&map=memory_school',
    '?legacy=0&legacy=1&map=memory_school',
    '?legacy=1&legacy=1&map=memory_school'
]) {
    assert.deepEqual(resolveStartRoute(search), {
        scene: 'GameScene',
        data: { mapId: 'room_main', sliceMode: true }
    });
}

assert.deepEqual(resolveStartRoute('?legacy=1&map=room_study&x=320&y=160'), {
    scene: 'GameScene',
    data: { mapId: 'room_study', sliceMode: false, x: 320, y: 160 }
});
assert.deepEqual(resolveStartRoute('?legacy=1&map=room_study&x=&y=%20'), {
    scene: 'GameScene',
    data: { mapId: 'room_study', sliceMode: false }
});
assert.deepEqual(resolveStartRoute('?legacy=1&map=room_study&x=   &y=0'), {
    scene: 'GameScene',
    data: { mapId: 'room_study', sliceMode: false, y: 0 }
});
assert.deepEqual(resolveStartRoute('?legacy=1&map=room_study&x=0&y=%09'), {
    scene: 'GameScene',
    data: { mapId: 'room_study', sliceMode: false, x: 0 }
});
assert.deepEqual(resolveStartRoute('?legacy=1&map=missing_map'), {
    scene: 'IntroScene',
    data: undefined
});
for (const inheritedMapId of ['constructor', 'toString', '__proto__']) {
    assert.deepEqual(
        resolveStartRoute(`?legacy=1&map=${inheritedMapId}`),
        { scene: 'IntroScene', data: undefined },
        `legacy route should reject inherited Maps.${inheritedMapId}`
    );
}

console.log('Start route verification passed');
