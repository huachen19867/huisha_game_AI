import assert from 'node:assert/strict';
import { Maps } from '../src/data/Maps.js';

assert.equal(Object.keys(Maps).length, 18);
for (const [mapId, map] of Object.entries(Maps)) {
    assert.equal(typeof map.purpose, 'string', `${mapId} purpose must be a string`);
    assert.ok(map.purpose.trim().length > 0, `${mapId} purpose is empty`);
    assert.ok(Array.isArray(map.rewards) && map.rewards.length > 0, `${mapId} rewards are empty`);
}

const basement = Maps.room_basement;
assert.equal(basement.width, 18);
assert.equal(basement.height, 14);
assert.ok(basement.objects.interactables.some(item => item.id === 'basement_photo_corner'));
assert.ok(basement.objects.interactables.some(item => item.id === 'basement_chain'));
assert.ok(basement.objects.doors.some(door => door.targetMap === 'room_main'));

const startCell = [Math.floor(basement.objects.playerStart.x / 32), Math.floor(basement.objects.playerStart.y / 32)];
const corner = basement.objects.interactables.find(item => item.id === 'basement_photo_corner');
const targetCell = [Math.floor(corner.x / 32), Math.floor(corner.y / 32)];
const exitCell = [8, 13];

function reachable(data, start, target) {
    const queue = [start];
    const seen = new Set([start.join(',')]);
    while (queue.length) {
        const [x, y] = queue.shift();
        if (x === target[0] && y === target[1]) return true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            const key = `${nx},${ny}`;
            if (data[ny]?.[nx] === 0 && !seen.has(key)) {
                seen.add(key);
                queue.push([nx, ny]);
            }
        }
    }
    return false;
}

assert.equal(reachable(basement.data, startCell, targetCell), true, 'Basement photo corner is unreachable');
assert.equal(reachable(basement.data, targetCell, exitCell), true, 'Basement exit is unreachable after collecting the photo corner');
console.log('Map purpose verification passed');
