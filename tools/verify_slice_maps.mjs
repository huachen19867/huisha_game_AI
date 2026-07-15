import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    SLICE_DOOR_IDS,
    SliceMaps,
    getSliceDoorAccess,
    isSliceDoorId
} from '../src/data/SliceMaps.js';
import { createDefaultSliceState } from '../src/systems/SliceState.js';

const TILE_SIZE = 32;
const mapIds = ['room_main', 'room_kitchen', 'room_bedroom_me'];

assert.deepEqual(Object.keys(SliceMaps), mapIds);
assert.deepEqual(SLICE_DOOR_IDS, [
    'main_kitchen_door',
    'kitchen_main_door',
    'kitchen_side_door',
    'bedroom_side_door',
    'bedroom_main_door'
]);
assert.equal(Object.isFrozen(SLICE_DOOR_IDS), true);
for (const doorId of SLICE_DOOR_IDS) assert.equal(isSliceDoorId(doorId), true);
for (const unknownDoorId of [
    undefined,
    null,
    '',
    1,
    '__proto__',
    'constructor',
    'toString',
    'main_to_kitchen',
    'missing_slice_door'
]) {
    assert.equal(isSliceDoorId(unknownDoorId), false);
}

const expectedMapMetadata = {
    room_main: {
        id: 'room_main',
        name: '正厅',
        purpose: '听见第四副碗筷并进入厨房',
        width: 24,
        height: 18,
        visual: { ambient: 0x5a4638, floorTint: 0x8c745d, wallTint: 0x5d4535, rain: false },
        playerStart: { x: 384, y: 496 },
        doors: [
            {
                id: 'main_kitchen_door',
                x: 23,
                y: 8,
                targetMap: 'room_kitchen',
                targetX: 64,
                targetY: 256
            }
        ]
    },
    room_kitchen: {
        id: 'room_kitchen',
        name: '厨房',
        purpose: '用碗、桌位和残影还原饭桌',
        width: 20,
        height: 16,
        visual: { ambient: 0x594638, floorTint: 0x846b52, wallTint: 0x553d2d, rain: false },
        playerStart: { x: 64, y: 256 },
        doors: [
            {
                id: 'kitchen_main_door',
                x: 0,
                y: 8,
                targetMap: 'room_main',
                targetX: 704,
                targetY: 272
            },
            {
                id: 'kitchen_side_door',
                x: 19,
                y: 8,
                targetMap: 'room_bedroom_me',
                targetX: 64,
                targetY: 256,
                gate: 'tableSolved'
            }
        ]
    },
    room_bedroom_me: {
        id: 'room_bedroom_me',
        name: '孩子卧室',
        purpose: '决定带走还是留下纸飞机',
        width: 20,
        height: 16,
        visual: { ambient: 0x4b5063, floorTint: 0x677083, wallTint: 0x3d4353, rain: false },
        playerStart: { x: 64, y: 256 },
        doors: [
            {
                id: 'bedroom_side_door',
                x: 0,
                y: 8,
                targetMap: 'room_kitchen',
                targetX: 576,
                targetY: 256,
                gate: 'planeTake'
            },
            {
                id: 'bedroom_main_door',
                x: 10,
                y: 15,
                targetMap: 'room_main',
                targetX: 384,
                targetY: 128,
                gate: 'planeChosen'
            }
        ]
    }
};

function assertPixelAnchorInside(map, anchor, description) {
    assert.equal(typeof anchor.x, 'number', `${description} x must be a number`);
    assert.equal(typeof anchor.y, 'number', `${description} y must be a number`);
    const tileX = Math.floor(anchor.x / TILE_SIZE);
    const tileY = Math.floor(anchor.y / TILE_SIZE);
    assert.ok(tileX >= 0 && tileX < map.width, `${description} x is outside ${map.id}`);
    assert.ok(tileY >= 0 && tileY < map.height, `${description} y is outside ${map.id}`);
    assert.equal(map.data[tileY][tileX], 0, `${description} lands on a wall in ${map.id}`);
}

function assertPixelRectInside(map, rect, description) {
    assert.ok(rect && typeof rect === 'object', `${description} must be an object`);
    for (const key of ['x', 'y', 'width', 'height']) {
        assert.equal(typeof rect[key], 'number', `${description} ${key} must be a number`);
    }
    assert.ok(rect.width > 0, `${description} width must be positive`);
    assert.ok(rect.height > 0, `${description} height must be positive`);
    assert.ok(rect.x >= 0 && rect.x + rect.width <= map.width * TILE_SIZE, `${description} x bounds escape ${map.id}`);
    assert.ok(rect.y >= 0 && rect.y + rect.height <= map.height * TILE_SIZE, `${description} y bounds escape ${map.id}`);

    const minTileX = Math.floor(rect.x / TILE_SIZE);
    const maxTileX = Math.ceil((rect.x + rect.width) / TILE_SIZE) - 1;
    const minTileY = Math.floor(rect.y / TILE_SIZE);
    const maxTileY = Math.ceil((rect.y + rect.height) / TILE_SIZE) - 1;
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
        for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
            assert.ok(
                tileX > 0 && tileX < map.width - 1 && tileY > 0 && tileY < map.height - 1,
                `${description} overlaps a boundary tile at ${tileX},${tileY}`
            );
            assert.equal(map.data[tileY][tileX], 0, `${description} overlaps a wall at ${tileX},${tileY}`);
        }
    }
}

function rectContainsPoint(rect, point) {
    return point.x >= rect.x && point.x < rect.x + rect.width &&
        point.y >= rect.y && point.y < rect.y + rect.height;
}

function rectsOverlap(left, right) {
    return left.x < right.x + right.width && left.x + left.width > right.x &&
        left.y < right.y + right.height && left.y + left.height > right.y;
}

for (const [mapId, map] of Object.entries(SliceMaps)) {
    assert.deepEqual({
        id: map.id,
        name: map.name,
        purpose: map.purpose,
        width: map.width,
        height: map.height,
        visual: map.visual,
        playerStart: map.objects.playerStart,
        doors: map.objects.doors
    }, expectedMapMetadata[mapId]);
    assert.ok(map.name && map.purpose);
    assert.ok(map.width >= 18 && map.height >= 14);
    assert.equal(map.data.length, map.height);
    assert.ok(map.data.every(row => row.length === map.width));
    assert.equal(new Set(map.data).size, map.height, `${map.id} must not alias row arrays`);
    assert.ok(map.data.every(row => row.every(cell => cell === 0 || cell === 1)));
    assertPixelAnchorInside(map, map.objects.playerStart, `${map.id} player start`);

    const openings = new Set(map.objects.doors.map(door => `${door.x},${door.y}`));
    for (const door of map.objects.doors) {
        assert.ok(
            door.x === 0 || door.y === 0 || door.x === map.width - 1 || door.y === map.height - 1,
            `${door.id} must be on the ${map.id} boundary`
        );
        assert.equal(map.data[door.y]?.[door.x], 0, `${door.id} boundary tile must be open`);
    }
    for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
            if (x !== 0 && y !== 0 && x !== map.width - 1 && y !== map.height - 1) {
                assert.equal(map.data[y][x], 0, `${map.id} interior tile ${x},${y} must be open`);
                continue;
            }
            assert.equal(
                map.data[y][x],
                openings.has(`${x},${y}`) ? 0 : 1,
                `${map.id} boundary tile ${x},${y} has the wrong wall value`
            );
        }
    }
}

const kitchenProps = SliceMaps.room_kitchen.objects.props;
assert.equal(
    kitchenProps.find(prop => prop.id === 'stove_stain').text,
    '灶台边缘结着几圈褐色药渍，旁边木面被烫得发黑。'
);
assert.equal(
    kitchenProps.find(prop => prop.id === 'door_shard').text,
    '侧门门槛下卡着一片蓝边碎瓷，断面落满旧灰。'
);

const kitchenDoors = SliceMaps.room_kitchen.objects.doors;
assert.ok(kitchenDoors.some(door => door.id === 'kitchen_side_door' && door.targetMap === 'room_bedroom_me'));
assert.equal(getSliceDoorAccess('kitchen_side_door', createDefaultSliceState()), false);
assert.equal(getSliceDoorAccess('kitchen_side_door', { ...createDefaultSliceState(), tableSolved: true }), true);
assert.equal(getSliceDoorAccess('bedroom_side_door', { ...createDefaultSliceState(), planeChoice: 'take' }), true);
assert.equal(getSliceDoorAccess('bedroom_side_door', { ...createDefaultSliceState(), planeChoice: 'leave' }), false);
assert.equal(getSliceDoorAccess('bedroom_main_door', createDefaultSliceState()), false);
assert.equal(getSliceDoorAccess('bedroom_main_door', { ...createDefaultSliceState(), planeChoice: 'take' }), true);
assert.equal(getSliceDoorAccess('bedroom_main_door', { ...createDefaultSliceState(), planeChoice: 'leave' }), true);

for (const state of [undefined, null, {}]) {
    assert.equal(getSliceDoorAccess('main_kitchen_door', state), true);
    assert.equal(getSliceDoorAccess('kitchen_main_door', state), true);
}

for (const state of [undefined, null, {}, { tableSolved: false }, { tableSolved: 'false' }, { tableSolved: 1 }]) {
    assert.doesNotThrow(() => getSliceDoorAccess('kitchen_side_door', state));
    assert.equal(getSliceDoorAccess('kitchen_side_door', state), false);
}

for (const state of [
    undefined,
    null,
    {},
    { planeChoice: undefined },
    { planeChoice: null },
    { planeChoice: false },
    { planeChoice: 'invalid' }
]) {
    assert.doesNotThrow(() => getSliceDoorAccess('bedroom_side_door', state));
    assert.equal(getSliceDoorAccess('bedroom_side_door', state), false);
    assert.doesNotThrow(() => getSliceDoorAccess('bedroom_main_door', state));
    assert.equal(getSliceDoorAccess('bedroom_main_door', state), false);
}

assert.throws(() => getSliceDoorAccess('missing_slice_door'), /unknown slice door/i);

const doorIds = new Set();
const edges = new Set();
for (const [mapId, map] of Object.entries(SliceMaps)) {
    for (const door of map.objects.doors) {
        assert.equal(doorIds.has(door.id), false, `Duplicate slice door ID: ${door.id}`);
        doorIds.add(door.id);
        assert.ok(mapIds.includes(door.targetMap), `${door.id} targets a non-slice map`);
        assertPixelAnchorInside(
            SliceMaps[door.targetMap],
            { x: door.targetX, y: door.targetY },
            `${door.id} target`
        );
        assert.doesNotThrow(() => getSliceDoorAccess(door.id, createDefaultSliceState()));
        edges.add(`${mapId}->${door.targetMap}`);
    }
}
assert.deepEqual([...edges].sort(), [
    'room_bedroom_me->room_kitchen',
    'room_bedroom_me->room_main',
    'room_kitchen->room_bedroom_me',
    'room_kitchen->room_main',
    'room_main->room_kitchen'
]);
assert.equal(Object.hasOwn(SliceMaps, 'room_corridor'), false);
assert.equal([...doorIds].some(id => id.includes('corridor')), false);

assert.equal(getSliceDoorAccess('main_kitchen_door', createDefaultSliceState()), true);
assert.equal(getSliceDoorAccess('kitchen_main_door', createDefaultSliceState()), true);
assert.throws(() => getSliceDoorAccess('missing_slice_door', createDefaultSliceState()), /unknown slice door/i);

const accessState = { ...createDefaultSliceState(), tableSolved: true, planeChoice: 'take' };
const accessStateSnapshot = structuredClone(accessState);
for (const doorId of doorIds) getSliceDoorAccess(doorId, accessState);
assert.deepEqual(accessState, accessStateSnapshot, 'Door access checks must not mutate slice state');

assert.deepEqual(
    Object.fromEntries([...doorIds].map(doorId => {
        const door = Object.values(SliceMaps).flatMap(map => map.objects.doors).find(item => item.id === doorId);
        return [doorId, door.gate ?? null];
    })),
    {
        main_kitchen_door: null,
        kitchen_main_door: null,
        kitchen_side_door: 'tableSolved',
        bedroom_side_door: 'planeTake',
        bedroom_main_door: 'planeChosen'
    }
);

const propIds = new Set();
const interactableKinds = new Set(['observe', 'plane', 'plane_choice', 'mirror']);
for (const map of Object.values(SliceMaps)) {
    for (const prop of map.objects.props) {
        assert.equal(propIds.has(prop.id), false, `Duplicate slice prop ID: ${prop.id}`);
        propIds.add(prop.id);
        assertPixelAnchorInside(map, prop, `${prop.id} prop`);

        if (interactableKinds.has(prop.kind)) {
            assert.ok(prop.label && prop.texture, `${prop.id} must have a label and texture`);
        }
        if (prop.kind === 'observe') {
            assert.equal(typeof prop.text, 'string', `${prop.id} must have observe text`);
            assert.equal(prop.text.trim(), prop.text, `${prop.id} observe text has outer whitespace`);
            assert.doesNotMatch(prop.text, /[\r\n]/, `${prop.id} observe text must be concise`);
            assert.equal(Object.hasOwn(prop, 'texts'), false, `${prop.id} must have one observe text`);
        }
        if (prop.kind === 'ambient_anchor') {
            assert.ok(prop.effect, `${prop.id} ambient anchor must have an effect`);
            assert.equal(interactableKinds.has(prop.kind), false);
        }
    }
}

const kitchen = SliceMaps.room_kitchen;
const table = kitchen.objects.table;
assert.deepEqual(table.collisionBounds, { x: 280, y: 208, width: 80, height: 64 });
assert.deepEqual(table.safeZones, {
    under_table: { x: 296, y: 272, width: 48, height: 24 }
});
assertPixelRectInside(kitchen, table.collisionBounds, 'kitchen table collision');
assertPixelRectInside(kitchen, table.safeZones.under_table, 'kitchen under-table safe zone');

for (const [anchorName, anchor] of Object.entries({
    ...table.seats,
    offering: table.offering,
    playerStart: kitchen.objects.playerStart,
    ...Object.fromEntries(
        Object.values(SliceMaps)
            .flatMap(map => map.objects.doors)
            .filter(door => door.targetMap === kitchen.id)
            .map(door => [`${door.id}Target`, { x: door.targetX, y: door.targetY }])
    )
})) {
    assert.equal(
        rectContainsPoint(table.collisionBounds, anchor),
        false,
        `kitchen table collision must not cover ${anchorName}`
    );
}

const underTable = table.safeZones.under_table;
assert.equal(rectsOverlap(table.collisionBounds, underTable), false);
for (const [anchorName, anchor] of Object.entries({ ...table.seats, offering: table.offering })) {
    assert.equal(rectContainsPoint(underTable, anchor), false, `under-table safe zone must not contain ${anchorName}`);
}
assert.equal(Object.hasOwn(table, 'navigationBlockedBounds'), false);
assert.equal(Object.hasOwn(underTable, 'collisionBounds'), false);
const furnitureBlockers = [table.collisionBounds];
assert.deepEqual(furnitureBlockers, [{ x: 280, y: 208, width: 80, height: 64 }]);
assert.equal(furnitureBlockers.includes(underTable), false);

assert.deepEqual(table, {
    x: 320,
    y: 240,
    seats: {
        nail: { x: 320, y: 176 },
        stove: { x: 384, y: 240 },
        side: { x: 320, y: 304 }
    },
    offering: { x: 256, y: 240 },
    bowlOrigins: {
        wine: { x: 176, y: 120 },
        medicine: { x: 224, y: 120 },
        child: { x: 272, y: 120 }
    },
    collisionBounds: { x: 280, y: 208, width: 80, height: 64 },
    safeZones: {
        under_table: { x: 296, y: 272, width: 48, height: 24 }
    }
});
assert.deepEqual(Object.keys(table.seats), ['nail', 'stove', 'side']);
assert.deepEqual(Object.keys(table.bowlOrigins), ['wine', 'medicine', 'child']);
for (const [anchorName, anchor] of Object.entries({
    table,
    ...table.seats,
    offering: table.offering,
    ...table.bowlOrigins
})) {
    assertPixelAnchorInside(kitchen, anchor, `kitchen table ${anchorName}`);
}

assert.deepEqual(
    kitchen.objects.props,
    [
        {
            id: 'nailed_chair',
            kind: 'observe',
            texture: 'chair_nailed',
            x: 320,
            y: 160,
            label: '钉死的椅子',
            text: '椅脚钉进地板，坐在这里能看住两扇门。'
        },
        {
            id: 'stove_stain',
            kind: 'observe',
            texture: 'stove',
            x: 480,
            y: 112,
            label: '药渍和烫痕',
            text: '灶台边缘结着几圈褐色药渍，旁边木面被烫得发黑。'
        },
        {
            id: 'door_shard',
            kind: 'observe',
            texture: 'blue_shard',
            x: 560,
            y: 272,
            label: '蓝边碎瓷',
            text: '侧门门槛下卡着一片蓝边碎瓷，断面落满旧灰。'
        }
    ]
);

const bedroomProps = SliceMaps.room_bedroom_me.objects.props;
assert.deepEqual(
    bedroomProps,
    [
        {
            id: 'bedroom_plane',
            kind: 'plane',
            texture: 'toy_plane',
            x: 300,
            y: 220,
            label: '折断的纸飞机'
        },
        {
            id: 'plane_bag',
            kind: 'plane_choice',
            choice: 'take',
            texture: 'cabinet',
            x: 420,
            y: 250,
            label: '旧书包'
        },
        {
            id: 'plane_drawer',
            kind: 'plane_choice',
            choice: 'leave',
            texture: 'desk',
            x: 180,
            y: 250,
            label: '抽屉'
        },
        {
            id: 'child_mirror',
            kind: 'mirror',
            texture: 'slice_mirror',
            x: 320,
            y: 96,
            label: '过低的镜子'
        },
        {
            id: 'school_uniform',
            kind: 'observe',
            texture: 'slice_uniform',
            x: 470,
            y: 120,
            label: '叠好的旧校服',
            text: '袖口内侧缝着一小块蓝布，像是留给谁辨认。'
        },
        {
            id: 'unused_ticket',
            kind: 'observe',
            texture: 'train_ticket',
            x: 222,
            y: 190,
            label: '未寄出的车票',
            text: '车票只写了离开日期，背面没有回程。'
        },
        {
            id: 'comic_stack',
            kind: 'observe',
            texture: 'comic_stack',
            x: 500,
            y: 290,
            label: '压在床脚的漫画',
            text: '最后一册夹着一张画：孩子从侧门跑出去。'
        }
    ]
);

const mainProps = SliceMaps.room_main.objects.props;
assert.deepEqual(
    mainProps,
    [
        {
            id: 'main_cold_bowl',
            kind: 'observe',
            texture: 'bowl_offering',
            x: 384,
            y: 220,
            label: '积灰冷碗',
            text: '三只碗有擦拭痕迹，只有这只积着灰。'
        },
        {
            id: 'main_kitchen_sound',
            kind: 'ambient_anchor',
            effect: 'four_place_settings',
            x: 700,
            y: 256
        },
        {
            id: 'main_kitchen_light',
            kind: 'ambient_anchor',
            effect: 'warm_door_seam',
            x: 730,
            y: 256
        },
        {
            id: 'main_food_smell',
            kind: 'ambient_anchor',
            effect: 'faint_rice_steam',
            x: 640,
            y: 256
        }
    ]
);

assert.equal(Object.isFrozen(SliceMaps), true, 'SliceMaps root must be frozen');
for (const map of Object.values(SliceMaps)) {
    assert.equal(Object.isFrozen(map), true, `${map.id} map must be frozen`);
    assert.equal(Object.isFrozen(map.data), true, `${map.id} data array must be frozen`);
    for (const row of map.data) assert.equal(Object.isFrozen(row), true, `${map.id} data row must be frozen`);
    assert.equal(Object.isFrozen(map.objects), true, `${map.id} objects must be frozen`);
    assert.equal(Object.isFrozen(map.objects.doors), true, `${map.id} doors array must be frozen`);
    for (const door of map.objects.doors) assert.equal(Object.isFrozen(door), true, `${door.id} door must be frozen`);
    assert.equal(Object.isFrozen(map.objects.props), true, `${map.id} props array must be frozen`);
    for (const prop of map.objects.props) assert.equal(Object.isFrozen(prop), true, `${prop.id} prop must be frozen`);
}
assert.equal(Object.isFrozen(table), true, 'kitchen table must be frozen');
assert.equal(Object.isFrozen(table.collisionBounds), true, 'kitchen table collision must be frozen');
assert.equal(Object.isFrozen(table.safeZones), true, 'kitchen safe-zone registry must be frozen');
assert.equal(Object.isFrozen(table.safeZones.under_table), true, 'under-table safe zone must be frozen');

assert.throws(() => { kitchen.data[1][1] = 1; }, TypeError);
assert.throws(() => { kitchen.objects.doors[0].id = 'mutated'; }, TypeError);
assert.throws(() => { kitchen.objects.props[0].id = 'mutated'; }, TypeError);
assert.throws(() => { table.x = 0; }, TypeError);

function assertDeepFrozen(value, path = 'SliceMaps', seen = new Set()) {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
    for (const [key, nestedValue] of Object.entries(value)) {
        assertDeepFrozen(nestedValue, `${path}.${key}`, seen);
    }
}
assertDeepFrozen(SliceMaps);

const builderSource = readFileSync(new URL('./build_standalone_entry.mjs', import.meta.url), 'utf8');
const mapsEntry = "    'src/data/Maps.js',";
const sliceMapsEntry = "    'src/data/SliceMaps.js',";
const mapsIndex = builderSource.indexOf(mapsEntry);
const sliceMapsIndex = builderSource.indexOf(sliceMapsEntry);
assert.notEqual(mapsIndex, -1, 'Standalone builder must list Maps');
assert.notEqual(sliceMapsIndex, -1, 'Standalone builder must list SliceMaps');
assert.equal(
    builderSource.slice(mapsIndex + mapsEntry.length, sliceMapsIndex).trim(),
    '',
    'Standalone builder must list SliceMaps immediately after Maps'
);

console.log('Slice map verification passed');
