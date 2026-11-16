import { Maps } from '../data/Maps.js';
import { ensureInvestigation } from './Investigation.js';

export function ensureExploration(state) {
    const data = ensureInvestigation(state);
    if (!data.visitedRooms) data.visitedRooms = [];
    if (!data.walkedLinks) data.walkedLinks = [];
    if (!data.examinations) data.examinations = {};
    return data;
}

const linkKey = (from, to) => [from, to].sort().join('|');

export function visitRoom(state, mapId, previousMapId) {
    if (!Maps[mapId]) return;
    const data = ensureExploration(state);
    if (!data.visitedRooms.includes(mapId)) data.visitedRooms.push(mapId);
    if (data.visitedRooms.includes(previousMapId) && Maps[previousMapId].objects.doors?.some(door => door.targetMap === mapId)) {
        const key = linkKey(previousMapId, mapId);
        if (!data.walkedLinks.includes(key)) data.walkedLinks.push(key);
    }
}

export function doorIsOpen(state, from, door) {
    if (door.hidden && door.targetMap === 'room_secret' && !state.cabinetMoved) return false;
    if (from === 'room_main' && door.targetMap === 'room_entrance' && state.doorSlammed && !state.candlesLit) return false;
    return !door.locked || (door.key === 'silver_key' && state.inventory.includes('地下室钥匙'));
}

export function knownConnections(state) {
    const data = ensureExploration(state);
    return data.walkedLinks.flatMap(key => {
        const [from, to] = key.split('|');
        if (!data.visitedRooms.includes(from) || !data.visitedRooms.includes(to) || !Maps[from] || !Maps[to]) return [];
        const directions = [from, to].flatMap((source, index) => {
            const target = index === 0 ? to : from;
            const door = Maps[source].objects.doors?.find(door => door.targetMap === target);
            return door ? [{ from: source, to: target, open: doorIsOpen(state, source, door) }] : [];
        });
        return [{ from, to, directions }];
    });
}

export function knownRoute(state, from, to) {
    const data = ensureExploration(state);
    if (!data.visitedRooms.includes(from) || !data.visitedRooms.includes(to)) return null;
    const edges = knownConnections(state).flatMap(link => link.directions).filter(edge => edge.open);
    const queue = [[from]], visited = new Set([from]);
    for (let i = 0; i < queue.length; i++) {
        const route = queue[i], end = route.at(-1);
        if (end === to) return route;
        for (const edge of edges.filter(edge => edge.from === end)) {
            if (visited.has(edge.to)) continue;
            visited.add(edge.to);
            queue.push([...route, edge.to]);
        }
    }
    return null;
}

export function nextDoorDescription(from, to) {
    const map = Maps[from];
    const door = map?.objects.doors?.find(door => door.targetMap === to);
    if (!door) return '';
    const side = door.x === 0 ? '西侧' : door.y === 0 ? '北侧' : door.x >= map.width - 2 ? '东侧' : '南侧';
    return `从${map.name}的${side}门前往${Maps[to].name}。`;
}

function examinationKey(mapId, target) {
    const obj = target.obj;
    const identity = obj.photoId !== undefined ? `photo-${obj.photoId}` : obj.objId || `${target.type}-${Math.round(obj.x)}-${Math.round(obj.y)}`;
    return `${mapId}:${identity}`;
}

function examinationVersion(target) {
    const obj = target.obj;
    return obj.documentText || obj.dialogText || JSON.stringify(obj.dialog || target.type);
}

export function examineObject(state, mapId, target) {
    const data = ensureExploration(state);
    data.examinations[examinationKey(mapId, target)] = examinationVersion(target);
}

export function inspectionStatus(state, mapId, target) {
    const { obj, type } = target;
    const data = ensureExploration(state);
    if (obj.memoryTrigger) return state.storyFlags.memories[obj.memoryTrigger.mapId === 'memory_school' ? 'school' : 'hospital'] ? '记忆已回返' : '记忆入口';
    if (obj.memoryComplete) return state.storyFlags.memories[obj.memoryComplete] ? '已拼合' : data.deductions[obj.memoryComplete] ? '可回返' : '待拼合';
    if (obj.endingChoice || type === 'exit_door' || type === 'memory_table') return '确认去留';
    if (type === 'altar') return state.candlesLit ? '守灯已成' : data.ritualStep ? '守灯未完' : state.hasRice ? '可试着守灯' : '可查看供桌';
    if (type === 'safe') return state.inventory.includes('地下室钥匙') ? '已打开' : '未打开';
    if (type === 'black_cloth') return state.doorSlammed ? '遗像已显露' : '黑布未揭';
    if (type === 'cabinet' && obj.objId === 'parents_cabinet') return state.cabinetMoved ? '暗门已打开' : data.notes.some(note => note.title === Maps.room_bedroom_parents.objects.cabinet.observationTitle) ? '可试着挪动' : '柜脚有痕迹';
    if (type === 'cabinet' && obj.objId === 'kitchen_cabinet') return state.hasRice ? '已取饭' : '可调查';
    if (type === 'well') return state.hasRedKey ? '已取钥匙' : data.examinations[examinationKey(mapId, target)] !== undefined ? '钥匙未取' : '可调查';
    if (type === 'coffin') return !state.hasRedKey ? '缺钥匙' : !state.candlesLit ? '待点灯' : !data.deductions.school || !data.deductions.hospital ? '红线未松' : '可开棺';
    if (type === 'desk' && mapId === 'room_secret') return state.hasMatches ? '已取火柴' : '可调查';
    if (type === 'bed' || (type === 'cabinet' && !['parents_cabinet', 'kitchen_cabinet'].includes(obj.objId))) return '可躲藏';
    const read = data.examinations[examinationKey(mapId, target)];
    if (read !== undefined) return read === examinationVersion(target) ? '已调查' : '有变化';
    if (obj.clueId && state.storyFlags.collectedClues.includes(obj.clueId)) return '已记录';
    return '可调查';
}

// Ignore the endpoint tile so wall-mounted photos remain readable. Intervening
// walls still block focus, even when another object's reach extends across them.
export function hasClearInteractionPath(map, px, py, obj) {
    if (!map) return true;
    const endX = Math.floor(obj.x / 32), endY = Math.floor(obj.y / 32);
    const length = Math.hypot(obj.x - px, obj.y - py);
    const samples = Math.max(1, Math.ceil(length / 8));
    for (let i = 1; i < samples; i++) {
        const x = Math.floor((px + (obj.x - px) * i / samples) / 32);
        const y = Math.floor((py + (obj.y - py) * i / samples) / 32);
        if (x === endX && y === endY) continue;
        if (map.data[y]?.[x] !== 0) return false;
    }
    return true;
}

// This is a schematic of authored connections, revealed only for visited rooms.
export const ROOM_LAYOUT = {
    room_prologue: [300, 620], room_entrance: [300, 550], room_main: [300, 460],
    room_kitchen: [510, 460], room_basement: [90, 460], room_corridor: [300, 280],
    room_backyard: [300, 55], room_attic: [510, 115], room_bathroom: [90, 190],
    room_bedroom_parents: [510, 230], room_bedroom_me: [510, 330],
    room_study: [90, 290], room_medicine: [90, 380], room_secret: [720, 230]
};
