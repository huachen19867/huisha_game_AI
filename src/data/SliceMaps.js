function boxedRoom(width, height, openings) {
    const data = Array.from({ length: height }, (_, y) => (
        Array.from({ length: width }, (_, x) => (
            x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 1 : 0
        ))
    ));

    for (const [x, y] of openings) {
        const inBounds = x >= 0 && x < width && y >= 0 && y < height;
        if (!inBounds) throw new Error(`Room opening is out of bounds: ${x},${y}`);
        const onBoundary = x === 0 || y === 0 || x === width - 1 || y === height - 1;
        if (!onBoundary) throw new Error(`Room opening is not on the boundary: ${x},${y}`);
        data[y][x] = 0;
    }

    return data;
}

export const SliceMaps = {
    room_main: {
        id: 'room_main',
        name: '正厅',
        purpose: '听见第四副碗筷并进入厨房',
        width: 24,
        height: 18,
        data: boxedRoom(24, 18, [[23, 8]]),
        visual: {
            ambient: 0x5a4638,
            floorTint: 0x8c745d,
            wallTint: 0x5d4535,
            rain: false
        },
        objects: {
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
            ],
            props: [
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
        }
    },

    room_kitchen: {
        id: 'room_kitchen',
        name: '厨房',
        purpose: '用碗、桌位和残影还原饭桌',
        width: 20,
        height: 16,
        data: boxedRoom(20, 16, [[0, 8], [19, 8]]),
        visual: {
            ambient: 0x594638,
            floorTint: 0x846b52,
            wallTint: 0x553d2d,
            rain: false
        },
        objects: {
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
            ],
            table: {
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
                }
            },
            props: [
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
        }
    },

    room_bedroom_me: {
        id: 'room_bedroom_me',
        name: '孩子卧室',
        purpose: '决定带走还是留下纸飞机',
        width: 20,
        height: 16,
        data: boxedRoom(20, 16, [[0, 8], [10, 15]]),
        visual: {
            ambient: 0x4b5063,
            floorTint: 0x677083,
            wallTint: 0x3d4353,
            rain: false
        },
        objects: {
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
            ],
            props: [
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
        }
    }
};

export function getSliceDoorAccess(doorId, state) {
    switch (doorId) {
        case 'main_kitchen_door':
        case 'kitchen_main_door':
            return true;
        case 'kitchen_side_door':
            return state?.tableSolved === true;
        case 'bedroom_side_door':
            return state?.planeChoice === 'take';
        case 'bedroom_main_door':
            return state?.planeChoice === 'take' || state?.planeChoice === 'leave';
        default:
            throw new Error(`Unknown slice door: ${doorId}`);
    }
}
