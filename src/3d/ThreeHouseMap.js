(function defineThreeHouseMap(global) {
    const Huisha3D = global.Huisha3D || (global.Huisha3D = {});

    Huisha3D.MAIN_HALL_MAP = {
        id: 'room_main_3d',
        playerStart: { x: 0, y: 1.55, z: 3.2, yaw: Math.PI },
        playerRadius: 0.32,
        walkable: [
            { xMin: -4.7, xMax: 4.7, zMin: -3.9, zMax: 4.1 },
            { xMin: -1.15, xMax: 1.15, zMin: -11.5, zMax: -3.2 }
        ],
        obstacles: [
            { id: 'altar', xMin: -1.5, xMax: 1.5, zMin: -3.68, zMax: -2.48 },
            { id: 'coffin', xMin: -1.48, xMax: 1.48, zMin: -0.02, zMax: 1.58 },
            { id: 'chair_left_front', xMin: -3.64, xMax: -2.76, zMin: 0.5, zMax: 1.42 },
            { id: 'chair_right_front', xMin: 2.76, xMax: 3.64, zMin: 0.5, zMax: 1.42 },
            { id: 'chair_left_back', xMin: -3.64, xMax: -2.76, zMin: -1.6, zMax: -0.68 },
            { id: 'chair_right_back', xMin: 2.76, xMax: 3.64, zMin: -1.6, zMax: -0.68 },
            { id: 'pillar_left_front', xMin: -4.28, xMax: -3.68, zMin: 1.9, zMax: 2.5 },
            { id: 'pillar_right_front', xMin: 3.68, xMax: 4.28, zMin: 1.9, zMax: 2.5 },
            { id: 'pillar_left_back', xMin: -4.28, xMax: -3.68, zMin: -2.78, zMax: -2.18 },
            { id: 'pillar_right_back', xMin: 3.68, xMax: 4.28, zMin: -2.78, zMax: -2.18 }
        ],
        objective: {
            initial: '目标：调查供桌、棺材和黑布相框',
            hallRequired: ['altar', 'coffin', 'black_frame'],
            hallComplete: '目标：沿走廊前进，调查尽头封门',
            completeRequired: ['altar', 'coffin', 'black_frame', 'corridor_end_door'],
            complete: '目标：返回正厅，等待下一段 3D 内容'
        },
        interactables: [
            {
                id: 'altar',
                label: '按 E 调查供桌',
                position: { x: 0, y: 0.9, z: -2.85 },
                radius: 1.65,
                title: '供桌',
                text: '香灰冷得像雪。黑布后的相框没有照片，只有一块更深的黑。'
            },
            {
                id: 'coffin',
                label: '按 E 调查棺材',
                position: { x: 0, y: 0.7, z: 0.55 },
                radius: 1.85,
                title: '棺材',
                text: '棺盖被红线压住，木头里传来很轻的抓挠声。它不是从里面响，是从记忆里响。'
            },
            {
                id: 'black_frame',
                label: '按 E 掀开黑布',
                position: { x: 0, y: 1.95, z: -3.72 },
                radius: 1.5,
                title: '黑布相框',
                text: '手指碰到布角的一瞬间，身后的门像被什么东西用力合上。'
            },
            {
                id: 'corridor_shadow',
                label: '按 E 观察走廊',
                position: { x: 0, y: 1.4, z: -9.4 },
                radius: 1.7,
                title: '走廊',
                text: '走廊尽头贴着倒过来的福字。再往前，墙里的脚步声就会跟上你。'
            },
            {
                id: 'corridor_midpoint',
                label: '按 E 听墙里的脚步',
                position: { x: 0, y: 1.4, z: -6.55 },
                radius: 1.25,
                title: '墙里的脚步',
                text: '脚步声贴着木墙走，与你保持同样的速度。你停下，它也停下。'
            },
            {
                id: 'corridor_end_door',
                label: '按 E 调查尽头封门',
                position: { x: 0, y: 1.4, z: -11.1 },
                radius: 1.45,
                title: '尽头封门',
                text: '门缝后没有风，却有烛火在晃。门闩从这一侧落下，像是有人刚刚替你关好。'
            }
        ]
    };
})(window);
