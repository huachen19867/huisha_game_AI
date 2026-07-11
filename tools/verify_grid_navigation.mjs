import assert from 'node:assert/strict';
import {
    createNavigationGrid,
    findGridPath,
    findSafeDoorSpawn,
    gridToWorld,
    worldToGrid
} from '../src/systems/GridNavigation.js';

const map = [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1]
];
const grid = createNavigationGrid(map, [{ x: 64, y: 64, width: 96, height: 32 }], [{ x: 1, y: 2 }, { x: 5, y: 2 }]);
const path = findGridPath(grid, { x: 1, y: 2 }, { x: 5, y: 2 });
assert.ok(path.length > 5, 'path should go around the table instead of through it');
assert.equal(path.some(cell => cell.y === 2 && cell.x >= 2 && cell.x <= 4), false);

assert.deepEqual(worldToGrid(111, 79), { x: 3, y: 2 });
assert.deepEqual(gridToWorld({ x: 3, y: 2 }), { x: 112, y: 80 });

const longMap = Array.from({ length: 9 }, (_, y) => Array.from({ length: 9 }, (_, x) => (x === 0 || y === 0 || x === 8 || y === 8 ? 1 : 0)));
const longGrid = createNavigationGrid(longMap);
const spawn = findSafeDoorSpawn(longGrid, { x: 0, y: 4 }, { x: 1, y: 4 }, 5);
assert.ok(spawn, 'a safe interior door spawn should exist');
assert.ok(Math.abs(spawn.x - 1) + Math.abs(spawn.y - 4) >= 5);

const tinyGrid = createNavigationGrid([[1,1,1],[1,0,1],[1,1,1]]);
assert.equal(findSafeDoorSpawn(tinyGrid, { x: 0, y: 1 }, { x: 1, y: 1 }, 5), null);

console.log('Grid navigation verification passed');
