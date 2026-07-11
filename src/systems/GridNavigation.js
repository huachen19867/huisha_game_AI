export const GRID_SIZE = 32;

export function worldToGrid(x, y) {
    return { x: Math.floor(x / GRID_SIZE), y: Math.floor(y / GRID_SIZE) };
}

export function gridToWorld(cell) {
    return { x: cell.x * GRID_SIZE + GRID_SIZE / 2, y: cell.y * GRID_SIZE + GRID_SIZE / 2 };
}

export function createNavigationGrid(mapData, blockedRects = [], forceOpen = []) {
    const grid = mapData.map(row => row.map(tile => tile === 0));
    for (const rect of blockedRects) {
        const left = Math.floor(rect.x / GRID_SIZE);
        const right = Math.floor((rect.x + Math.max(1, rect.width) - 1) / GRID_SIZE);
        const top = Math.floor(rect.y / GRID_SIZE);
        const bottom = Math.floor((rect.y + Math.max(1, rect.height) - 1) / GRID_SIZE);
        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) {
                if (grid[y]?.[x] !== undefined) grid[y][x] = false;
            }
        }
    }
    for (const cell of forceOpen) {
        if (grid[cell.y]?.[cell.x] !== undefined) grid[cell.y][cell.x] = true;
    }
    return grid;
}

export function findGridPath(grid, start, goal) {
    if (!grid[start.y]?.[start.x] || !grid[goal.y]?.[goal.x]) return [];
    const queue = [start];
    let head = 0;
    const startKey = `${start.x},${start.y}`;
    const cameFrom = new Map([[startKey, null]]);
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    while (head < queue.length) {
        const current = queue[head++];
        if (current.x === goal.x && current.y === goal.y) {
            const path = [];
            let key = `${goal.x},${goal.y}`;
            while (key) {
                const [x, y] = key.split(',').map(Number);
                path.push({ x, y });
                key = cameFrom.get(key);
            }
            return path.reverse();
        }
        for (const [dx, dy] of directions) {
            const next = { x: current.x + dx, y: current.y + dy };
            const key = `${next.x},${next.y}`;
            if (grid[next.y]?.[next.x] && !cameFrom.has(key)) {
                cameFrom.set(key, `${current.x},${current.y}`);
                queue.push(next);
            }
        }
    }
    return [];
}

export function findSafeDoorSpawn(grid, door, playerCell, minDistance = 5) {
    const start = {
        x: door.x + Math.floor((door.w || 1) / 2),
        y: door.y + Math.floor((door.h || 1) / 2)
    };
    const queue = [start];
    let head = 0;
    const seen = new Set([`${start.x},${start.y}`]);
    while (head < queue.length) {
        const current = queue[head++];
        const distance = Math.abs(current.x - playerCell.x) + Math.abs(current.y - playerCell.y);
        if (grid[current.y]?.[current.x] && distance >= minDistance) return current;
        for (const [dx, dy] of [[1,0], [0,1], [-1,0], [0,-1]]) {
            const next = { x: current.x + dx, y: current.y + dy };
            const key = `${next.x},${next.y}`;
            if (!seen.has(key) && grid[next.y]?.[next.x]) {
                seen.add(key);
                queue.push(next);
            }
        }
    }
    return null;
}
