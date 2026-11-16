export function isPursuitSpace(mapId) {
    return !!mapId && !mapId.startsWith('memory_') && mapId !== 'room_memory';
}

// Only consider reachable floor cells. A preferred doorway supplies a direction,
// never permission to spawn inside furniture, a tree, or the player's space.
export function choosePursuerSpawn(map, player, isOpen, preferred = null) {
    const start = { x: Math.floor(player.x / 32), y: Math.floor(player.y / 32) };
    const queue = [start], visited = new Set([`${start.x},${start.y}`]), candidates = [];
    for (let i = 0; i < queue.length; i++) {
        const cell = queue[i];
        if (isOpen(cell.x, cell.y)) {
            const x = cell.x * 32 + 16, y = cell.y * 32 + 16;
            const distance = Math.hypot(x - player.x, y - player.y);
            if (distance >= 192) candidates.push({ x, y, distance });
        }
        for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
            const x = cell.x + dx, y = cell.y + dy, key = `${x},${y}`;
            if (x < 0 || y < 0 || x >= map.width || y >= map.height || visited.has(key) || !isOpen(x, y)) continue;
            visited.add(key);
            queue.push({ x, y });
        }
    }
    candidates.sort((a, b) => preferred ? Math.hypot(a.x - preferred.x, a.y - preferred.y) - Math.hypot(b.x - preferred.x, b.y - preferred.y) : a.distance - b.distance);
    return candidates[0] || null;
}

export function advanceWarning(remaining, delta, paused = false) {
    return paused ? remaining : Math.max(0, remaining - Math.min(delta, 50));
}

export function pursuitCue(scene) {
    if (!scene.gameState.isChasing || !isPursuitSpace(scene.currentMapId)) return '';
    if (!scene.chaser?.active) return '脚步还在门外 · 留意藏身处';
    const dx = scene.chaser.x - scene.player.sprite.x, dy = scene.chaser.y - scene.player.sprite.y;
    const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '东侧' : '西侧') : (dy > 0 ? '南侧' : '北侧');
    if (scene.pursuitWarningMs > 0) return `${side}传来拖曳声 · 它还没走近`;
    const distance = Math.hypot(dx, dy);
    return `${side}${distance < 160 ? '的脚步就在附近' : distance < 360 ? '的脚步正在靠近' : '远处有脚步声'}`;
}

export function sanityRate(mapId, chasing, distance = Infinity) {
    if (!isPursuitSpace(mapId)) return -1;
    if (chasing && distance < 300) return 0.9;
    if (!chasing && mapId === 'room_bedroom_me') return -2;
    return ['room_basement', 'room_attic', 'room_secret'].includes(mapId) ? 0.4 : 0;
}
