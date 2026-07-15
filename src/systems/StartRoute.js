import { Maps } from '../data/Maps.js';

const SLICE_MAP_IDS = new Set([
    'room_main',
    'room_kitchen',
    'room_bedroom_me'
]);

function createRouteData(mapId, sliceMode, params) {
    const data = { mapId, sliceMode };

    for (const coordinate of ['x', 'y']) {
        if (!params.has(coordinate)) continue;
        const rawValue = params.get(coordinate);
        if (rawValue.trim() === '') continue;
        const value = Number(rawValue);
        if (Number.isFinite(value)) data[coordinate] = value;
    }

    return data;
}

export function resolveStartRoute(search = '') {
    const params = new URLSearchParams(search);
    const mapId = params.get('map');
    const legacyValues = params.getAll('legacy');
    const legacy = legacyValues.length === 1 && legacyValues[0] === '1';

    if (legacy) {
        if (!mapId || !Object.hasOwn(Maps, mapId)) {
            return { scene: 'IntroScene', data: undefined };
        }

        return {
            scene: 'GameScene',
            data: createRouteData(mapId, false, params)
        };
    }

    const sliceMapId = SLICE_MAP_IDS.has(mapId) ? mapId : 'room_main';

    return {
        scene: 'GameScene',
        data: createRouteData(sliceMapId, true, params)
    };
}
