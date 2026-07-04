(function defineThreeHouseMap(global) {
    const Huisha3D = global.Huisha3D || (global.Huisha3D = {});

    Huisha3D.MAIN_HALL_MAP = {
        id: 'room_main_3d',
        playerStart: { x: 0, y: 1.55, z: 3.2, yaw: Math.PI },
        walkable: [
            { xMin: -4.7, xMax: 4.7, zMin: -3.9, zMax: 4.1 },
            { xMin: -1.15, xMax: 1.15, zMin: -11.5, zMax: -3.2 }
        ],
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
            }
        ]
    };
})(window);
