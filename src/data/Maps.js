export const Maps = {
    room_prologue: {
        id: 'room_prologue',
        name: '荒野公路',
        purpose: '教会移动与调查并建立车祸循环',
        rewards: ['movement_tutorial', 'old_house_direction'],
        visual: { rain: true },
        width: 30,
        height: 12,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Exit
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Exit
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Exit
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Exit
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 100, y: 200 },
            crashed_car: { x: 500, y: 250, dialog: '车头已经完全变形，像一头死去的钢铁巨兽。引擎盖下冒着黑烟，空气中弥漫着汽油味和...一股淡淡的铁锈腥味。奇怪，我记得出发前才刚做过保养。' },
            rain_trigger: { x: 300, y: 200, dialog: '雨点砸在脸上，生疼。这场雨下得太久了，久到我都快忘了太阳长什么样。前面的路通向那座老宅...如果不是因为那封没有署名的信，我这辈子都不想再回来。' },
            trees: [
                { x: 100, y: 50 }, { x: 300, y: 50 }, { x: 500, y: 50 }, { x: 700, y: 50 },
                { x: 100, y: 350 }, { x: 300, y: 350 }, { x: 500, y: 350 }, { x: 700, y: 350 }
            ],
            doors: [
                 { x: 29, y: 6, w: 1, h: 4, targetMap: 'room_entrance', targetX: 384, targetY: 350 }
            ]
        }
    },
    room_entrance: {
        id: 'room_entrance',
        name: '老宅大门',
        purpose: '承载老宅入口与阶段性离开选择',
        rewards: ['exit_choice'],
        visual: { rain: true },
        width: 24,
        height: 14,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 384, y: 350 },
            car: { x: 250, y: 300 },
            exit_door: { x: 384, y: 416, dialog: '朱红色的大门漆皮剥落，露出了里面发黑的木头，像是一块块尸斑。推开门，生锈的门轴发出令人牙酸的“吱呀”声。' },
            doors: [
                { x: 11, y: 0, w: 2, h: 1, targetMap: 'room_main', targetX: 368, targetY: 330 }
            ]
        }
    },
    room_main: {
        id: 'room_main',
        name: '正厅',
        purpose: '承载供品仪式、棺材和全家福反制',
        rewards: ['ritual', 'coffin_truth', 'photo_counter'],
        visual: { rain: false },
        width: 24,
        height: 16,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,1],
            [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
            [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 384, y: 450 },
            coffin: { x: 384, y: 150, dialog: '黑棺钉着七颗锁魂钉。里面每响一下，我的胸口也跟着疼一下。' },
            altar: { x: 384, y: 250, puzzleId: 'altar_ritual', dialog: '供桌摆着三副碗筷，中间那只碗落灰最少，像每年都有人重新擦过。' },
            black_cloth: { x: 384, y: 240, dialog: '黑布下是父亲的遗像。相框玻璃却映出另一张更年轻的脸，一闪就不见了。' },
            candles: [
                { x: 354, y: 240 },
                { x: 414, y: 240 }
            ],
            dirt: { x: 650, y: 400 },
            stove: { x: 100, y: 400 },
            medical_record: { x: 200, y: 300 },
            doors: [
                { x: 11, y: 0, w: 2, h: 1, targetMap: 'room_corridor', targetX: 240, targetY: 580 },
                { x: 11, y: 15, w: 2, h: 1, targetMap: 'room_entrance', targetX: 368, targetY: 64 },
                { x: 23, y: 8, w: 1, h: 2, targetMap: 'room_kitchen', targetX: 64, targetY: 240 },
                { x: 0, y: 8, w: 1, h: 2, targetMap: 'room_basement', targetX: 304, targetY: 400, locked: true, key: 'silver_key' }
            ]
        }
    },
    room_kitchen: {
        id: 'room_kitchen',
        name: '厨房',
        purpose: '根据水槽、灶台与纸人手势还原饭桌座次',
        rewards: ['rice', 'paper_doll_event'],
        visual: { rain: false },
        width: 16,
        height: 14,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 64, y: 240 },
            sink: { x: 250, y: 50, dialog: '水槽里并排放着三只旧碗，水滴只落在刻着纸飞机的那只上。' },
            cabinet: {
                x: 400, y: 50, id: 'kitchen_cabinet',
                puzzleId: 'kitchen_table',
                interaction: { label: '封死的饭柜', verb: '检查', priority: 30, radius: 80, marker: true }
            },
            npc: { x: 360, y: 160, clueId: 'kitchen_ghost_gesture', clueType: 'death' },
            interactables: [
                {
                    id: 'kitchen_stove_marks', x: 150, y: 82, texture: 'stove',
                    clueId: 'kitchen_stove_marks', clueType: 'control',
                    documentTitle: '灶台边的灰痕',
                    documentText: '灰里压着一张饭桌轮廓：灶在北，侧门在东。父亲写过“我坐背门的位置”。'
                }
            ],
            doors: [
                { x: 0, y: 7, w: 1, h: 2, targetMap: 'room_main', targetX: 700, targetY: 272 }
            ]
        }
    },
    room_corridor: {
        id: 'room_corridor',
        name: '走廊',
        purpose: '连接房间并收集四张照片',
        rewards: ['photo_set'],
        visual: { rain: false },
        width: 10,
        height: 20,
        data: [
            [1,1,1,1,1,0,0,1,1,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,0,0,1,1,1],
        ],
        objects: {
            playerStart: { x: 176, y: 580 },
            locked_window: { x: 48, y: 100 },
            photos: [
                { x: 48, y: 150, id: 1, text: '第一张全家福。母亲端着饭，父亲的手按在我肩上。照片右下角缺了一块。' },
                { x: 272, y: 250, id: 2, text: '生日照里只有两碗长寿面，母亲却摆了三双筷子。' },
                { x: 48, y: 350, id: 3, text: '入学那年，我把纸飞机藏在袖口。父亲按着我的肩，像怕我飞走。' },
                { x: 272, y: 450, id: 4, text: '最后一张停在十年前的七月十四。照片里的我已经淡得只剩轮廓。' }
            ],
            doors: [
                { x: 5, y: 0, w: 2, h: 1, targetMap: 'room_backyard', targetX: 320, targetY: 100 },
                { x: 9, y: 2, w: 1, h: 2, targetMap: 'room_attic', targetX: 320, targetY: 384 },
                { x: 0, y: 6, w: 1, h: 2, targetMap: 'room_bathroom', targetX: 448, targetY: 208 },
                { x: 9, y: 8, w: 1, h: 2, targetMap: 'room_bedroom_parents', targetX: 64, targetY: 240 },
                { x: 9, y: 11, w: 1, h: 2, targetMap: 'room_bedroom_me', targetX: 64, targetY: 240 },
                { x: 0, y: 14, w: 1, h: 2, targetMap: 'room_study', targetX: 448, targetY: 208 },
                { x: 0, y: 17, w: 1, h: 2, targetMap: 'room_medicine', targetX: 448, targetY: 208 },
                { x: 5, y: 19, w: 2, h: 1, targetMap: 'room_main', targetX: 368, targetY: 64 }
            ]
        }
    },
    room_bathroom: {
        id: 'room_bathroom',
        name: '卫生间',
        purpose: '提供密码替代提示与母亲病情线索',
        rewards: ['safe_code_hint', 'illness_clue'],
        visual: { rain: false },
        width: 16,
        height: 12,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 448, y: 200 },
            toilet: { x: 80, y: 80, dialog: '狭窄逼仄的空间，只有一扇高高的小窗。墙角堆满了杂物。这里是我的"反省室"。每次考试没考好，或者说错了一句话，我就会被关在这里。' },
            mirror: { x: 250, y: 20, dialog: '镜面上布满了裂纹，把我的脸分割得支离破碎。我凑近看...镜子里的我脸色惨白，眼神空洞。等等...为什么镜子里的我，嘴角在微微上扬？' },
            wet_paper: {
                x: 150, y: 300,
                clueId: 'bathroom_self_harm', clueType: 'illness',
                documentTitle: '1988 年急诊记录',
                documentText: '母亲曾在 1988 年服药自伤，被及时救回。记录背面写着：保险柜还是那一年，他不许我忘。'
            },
            doors: [
                { x: 15, y: 6, w: 1, h: 2, targetMap: 'room_corridor', targetX: 80, targetY: 208 }
            ]
        }
    },
    room_bedroom_parents: {
        id: 'room_bedroom_parents',
        name: '父母卧室',
        purpose: '取得家规、地下室钥匙并打开密室',
        rewards: ['control_clue', 'basement_key', 'secret_room'],
        visual: { rain: false },
        width: 18,
        height: 14,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Hidden door loc (was 1)
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Hidden door loc (was 1)
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 64, y: 240 },
            bed: { x: 450, y: 150, dialog: '一张巨大的双人床，占据了房间的一半。床单上绣着鸳鸯戏水，现在看来却显得格外讽刺。床头柜上放着一瓶安眠药，瓶子已经空了。' },
            cabinet: { x: 528, y: 240, id: 'parents_cabinet', dialog: '一个沉重的红木衣柜。看起来...后面似乎有什么空间？' },
            family_rules: { x: 250, y: 50 },
            safe: { x: 100, y: 350 },
            doors: [
                { x: 0, y: 7, w: 1, h: 2, targetMap: 'room_corridor', targetX: 240, targetY: 272 },
                // Hidden door (Initially inaccessible, handled by logic)
                { x: 17, y: 7, w: 1, h: 2, targetMap: 'room_secret', targetX: 64, targetY: 200, hidden: true }
            ]
        }
    },
    room_secret: {
        id: 'room_secret',
        name: '密室',
        purpose: '取得火柴并发现封宅证据',
        rewards: ['matches', 'seal_note'],
        visual: { rain: false },
        width: 12,
        height: 12,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,0,0,1], // Entry from left
            [0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 64, y: 200 },
            desk: { x: 300, y: 200, puzzleId: 'secret_seals', dialog: '空火柴盒被四张纸扎封条压住，划火片藏在最下面。' },
            notes: [
                {
                    x: 300, y: 300, id: 'father_seal_note', clueId: 'father_seal_note', clueType: 'control',
                    documentTitle: '封宅笔记', documentText: '门留归路，窗绝外念，井压水魂，棺锁亡名。四封错一处，整座宅子都会听见。',
                    dialog: '父亲把封宅方法写成了四句。'
                },
                {
                    x: 100, y: 100, id: 'puppet_shadow_map', clueId: 'puppet_shadow_map', clueType: 'control',
                    documentTitle: '木偶投影', documentText: '烛痕把四只木偶投向墙面：东边像门框，西边是窗棂，南边垂井绳，北边钉着七点。',
                    dialog: '墙上的木偶影子分别朝向四方。'
                }
            ],
            interactables: [
                { id: 'secret_seal_board', x: 300, y: 210, texture: 'desk', puzzleId: 'secret_seals', dialog: '四张封条压着一个空火柴盒。' }
            ],
            doors: [
                    { x: 0, y: 6, w: 1, h: 2, targetMap: 'room_bedroom_parents', targetX: 450, targetY: 400 }
            ]
        }
    },
    room_study: {
        id: 'room_study',
        name: '旧书房',
        purpose: '收集控制线索并进入学校记忆',
        rewards: ['control_clues', 'school_memory'],
        visual: { rain: false },
        width: 16,
        height: 12,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 448, y: 208 },
            desk: { x: 180, y: 120, id: 'study_desk', dialog: '父亲的旧书桌。抽屉锁已经锈死，桌面却被擦得很干净，像是有人每天都在这里批改一份永远写不完的试卷。' },
            interactables: [
                {
                    id: 'father_note',
                    x: 180,
                    y: 170,
                    texture: 'trash_paper',
                    tint: 0xffdd88,
                    clueId: 'father_note',
                    clueType: 'control',
                    documentTitle: '父亲笔记',
                    documentText: '明儿最近又顶嘴。孩子不能惯，一惯就会走歪路。我要把他的时间安排好，几点起床，几点做题，几点睡觉。只要照我说的做，他就不会像我一样没出息。'
                },
                {
                    id: 'award_stack',
                    x: 330,
                    y: 120,
                    texture: 'photo_frame',
                    tint: 0xddddaa,
                    clueId: 'award_stack',
                    clueType: 'control',
                    documentTitle: '奖状夹',
                    documentText: '一沓奖状被压在玻璃板下，每张都被父亲用红笔圈出名次。第二名那张旁边写着：差一名就是没用。'
                },
                {
                    id: 'school_memory_trigger',
                    x: 330,
                    y: 290,
                    texture: 'desk',
                    tint: 0x777777,
                    dialog: '桌下塞着一个旧书包。拉链拉开的瞬间，粉笔灰的味道涌了出来。',
                    memoryTrigger: { mapId: 'memory_school', x: 240, y: 320 }
                }
            ],
            doors: [
                { x: 15, y: 6, w: 1, h: 2, targetMap: 'room_corridor', targetX: 80, targetY: 464 }
            ]
        }
    },
    room_medicine: {
        id: 'room_medicine',
        name: '药柜小间',
        purpose: '收集治疗线索并进入医院记忆',
        rewards: ['illness_clues', 'hospital_memory'],
        visual: { rain: false },
        width: 16,
        height: 12,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 448, y: 208 },
            cabinet: { x: 150, y: 120, id: 'medicine_cabinet', dialog: '药柜里空了一大半，只剩几只没有标签的棕色药瓶。瓶口有苦味，像母亲常年含在舌根下的话。' },
            interactables: [
                {
                    id: 'prescription_note',
                    x: 250,
                    y: 150,
                    texture: 'trash_paper',
                    tint: 0x99ddff,
                    clueId: 'prescription_note',
                    clueType: 'illness',
                    documentTitle: '处方单',
                    documentText: '处方上写着王秀兰需要规律服药和复诊，下面却有一行被父亲按破纸背的字：吃这些就能好？她是被脏东西缠上了。'
                },
                {
                    id: 'unpaid_bill',
                    x: 330,
                    y: 250,
                    texture: 'trash_paper',
                    tint: 0xffffff,
                    clueId: 'unpaid_bill',
                    clueType: 'illness',
                    documentTitle: '缴费单',
                    documentText: '缴费单被撕成两半，金额不大，却一直没有交。背面写着：家丑不可外扬。'
                },
                {
                    id: 'hospital_memory_trigger',
                    x: 150,
                    y: 300,
                    texture: 'cabinet',
                    tint: 0x8899aa,
                    dialog: '药柜最底层压着一张医院排号单。号码牌翻过来，灯光突然变成惨白。',
                    memoryTrigger: { mapId: 'memory_hospital', x: 80, y: 240 }
                }
            ],
            doors: [
                { x: 15, y: 6, w: 1, h: 2, targetMap: 'room_corridor', targetX: 80, targetY: 560 }
            ]
        }
    },
    room_bedroom_me: {
        id: 'room_bedroom_me',
        name: '我的卧室',
        purpose: '取得日记、纸飞机并提供躲藏点',
        rewards: ['diary_clue', 'death_clue', 'hide_spot'],
        visual: { rain: false },
        width: 16,
        height: 14,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 64, y: 240 },
            bed: { x: 400, y: 150, dialog: '我的床。很小，很硬。床单是我最喜欢的蓝色，上面印着卡通图案。这是我在这个家里唯一的避风港。以前我总是躲在被子里，用手电筒照着漫画书，那是唯一的亮光。' },
            cabinet: {
                x: 400, y: 350, id: 'my_cabinet',
                dialog: '柜门里还挂着十年前的校服。这里空间很窄，却比房间中央安全。',
                interaction: { label: '我的衣柜', verb: '躲藏', priority: 20, radius: 90, marker: false, blocksMovement: true }
            },
            desk: { x: 100, y: 150, id: 'my_desk', dialog: '这是我的书桌。上面刻着"早"字，但那只是我为了模仿鲁迅刻的。抽屉里塞满了没及格的试卷，每一次打开都需要勇气。' },
            diary: { x: 100, y: 140 },
            toy_plane: { x: 300, y: 300, dialog: '纸飞机的机翼被踩断了。背面是我的字：雨停前，我会回来吃饭。' },
            doors: [
                { x: 0, y: 7, w: 1, h: 2, targetMap: 'room_corridor', targetX: 240, targetY: 368 }
            ]
        }
    },
    room_backyard: {
        id: 'room_backyard',
        name: '后院',
        purpose: '取得香和血红钥匙并启动追逐',
        rewards: ['incense', 'red_key', 'chase_start'],
        visual: { rain: true },
        width: 20,
        height: 20,
        data: [
            [1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 320, y: 100 },
            well: { x: 320, y: 320, dialog: '古老的枯井，井口被几块大石头死死压住，缝隙里塞满了画着符咒的黄纸。井底深处，似乎有冷风不断吹上来。小时候，我不小心把球踢到了井边，父亲发了疯一样打我，说井里住着吃人的怪物。' },
            incense: {
                x: 550, y: 550, id: 'incense', puzzleId: 'well_knots', dialog: '一把香被井绳拖进树根，只露出缠结的绳头。',
                interaction: { label: '缠结的井绳', verb: '解结', priority: 30, radius: 80, marker: true, blocksMovement: false }
            },
            interactables: [
                {
                    id: 'well_charm_marks', x: 390, y: 330, texture: 'trash_paper',
                    clueId: 'well_charm_marks', clueType: 'illness', documentTitle: '受潮的三结符',
                    documentText: '符上画着三种结：圆结镇水，双结锁门，短结牵孩子。最下面一行被水泡成了“莫解圆结”。'
                }
            ],
            trees: [
                { x: 100, y: 200 },
                { x: 500, y: 200 },
                { x: 100, y: 500 },
                { x: 500, y: 500 }
            ],
            doors: [
                { x: 9, y: 0, w: 2, h: 1, targetMap: 'room_corridor', targetX: 176, targetY: 64 }
            ]
        }
    },
    room_basement: {
        id: 'room_basement',
        name: '地下禁闭室',
        purpose: '取得全家福缺角与锁门证据',
        rewards: ['family_photo_corner', 'locked_chain_clue'],
        visual: {
            ambient: 0x554433,
            floorTint: 0x776655,
            wallTint: 0x554433,
            rain: false,
            guideLights: [
                { x: 304, y: 400, radius: 110, color: 0xffcc88 },
                { x: 304, y: 240, radius: 100, color: 0xffcc88 },
                { x: 304, y: 80, radius: 110, color: 0xff8866 }
            ]
        },
        width: 18,
        height: 14,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
            [1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
            [1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1],
            [1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
            [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1]
        ],
        objects: {
            playerStart: { x: 304, y: 400 },
            interactables: [
                {
                    id: 'basement_photo_corner', x: 304, y: 80, texture: 'photo_frame',
                    dialog: '缺角上是少年时的我。背面写着：七月十四，明儿忌日。',
                    itemGrant: 'family_photo_corner'
                },
                {
                    id: 'basement_chain', x: 112, y: 176, texture: 'trash_paper',
                    clueId: 'basement_lock_chain', clueType: 'control',
                    documentTitle: '锁门铁链', documentText: '铁链锁在门外。内侧的抓痕属于孩子，外侧还有父亲反复开锁又锁回去的磨痕。'
                },
                {
                    id: 'basement_scratches', x: 464, y: 176, texture: 'scratch',
                    clueId: 'basement_last_night', clueType: 'death',
                    dialog: '墙上反复刻着：雨停前，我会回来吃饭。最后一个“回”字只写了一半。'
                }
            ],
            doors: [
                { x: 8, y: 13, w: 2, h: 1, targetMap: 'room_main', targetX: 64, targetY: 208 }
            ]
        }
    },
    room_attic: {
        id: 'room_attic',
        name: '阁楼',
        purpose: '取得纸钱并提供方向提示',
        rewards: ['spirit_money', 'house_overview_hint'],
        visual: { rain: false },
        width: 20,
        height: 14,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 320, y: 384 },
            spirit_money: {
                x: 320, y: 100, id: 'spirit_money', puzzleId: 'attic_debt',
                dialog: '横梁上挂着一串串纸钱，随着气流轻轻晃动，发出沙沙的声音。就像是有无数个看不见的幽灵在窃窃私语。这些钱...是烧给谁的？',
                interaction: { label: '四束纸钱', verb: '辨认', priority: 30, radius: 80, marker: true, blocksMovement: false }
            },
            interactables: [
                {
                    id: 'attic_overview', x: 480, y: 160, texture: 'photo_frame',
                    clueId: 'attic_overview', clueType: 'death', documentTitle: '破窗外的坟位',
                    documentText: '父亲和母亲的坟位都能从窗外看见。只有孩子的方向没有坟，正厅却年年摆着一只空碗。'
                },
                {
                    id: 'father_debt_note', x: 165, y: 150, texture: 'trash_paper',
                    clueId: 'father_debt_note', clueType: 'death', documentTitle: '十年纸钱账',
                    documentText: '父亲记着：无尸、无牌位、照片缺角者，纸钱十年未断。名字一栏始终空白。'
                }
            ],
            doors: [
                { x: 9, y: 13, w: 2, h: 1, targetMap: 'room_corridor', targetX: 176, targetY: 64 }
            ]
        }
    },
    memory_school: {
        id: 'memory_school',
        name: '记忆：夜校',
        purpose: '用时间证据找出父亲改写的最后一夜',
        rewards: ['school_puzzle'],
        visual: {
            rain: false,
            ambient: 0x4a3a2a,
            floorTint: 0x6b5a35,
            wallTint: 0x242015,
            paperTint: 0xffe0aa
        },
        width: 18,
        height: 14,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 240, y: 320 },
            interactables: [
                {
                    id: 'school_detention_clock', x: 100, y: 90,
                    texture: 'photo_frame',
                    tint: 0x332711,
                    clueId: 'school_detention_clock',
                    clueType: 'control',
                    documentTitle: '停住的留堂钟',
                    documentText: '教室后钟停在 18:10。值日表写着：李明留堂结束后负责锁窗，签名墨迹与当天一致。'
                },
                {
                    id: 'school_bus_ticket', x: 455, y: 95,
                    texture: 'trash_paper', tint: 0xd6ba78,
                    clueId: 'school_bus_ticket', clueType: 'control',
                    documentTitle: '末班车票',
                    documentText: '票面时间 18:20。校门到村口只有这一班车，旧时刻表注明全程至少二十分钟。'
                },
                {
                    id: 'school_report', x: 155, y: 245,
                    texture: 'trash_paper', tint: 0xffeeee,
                    clueId: 'school_report', clueType: 'control',
                    documentTitle: '成绩单',
                    documentText: '成绩单背面原写“到家后争吵”，后来被红笔改成“放学前顶撞”。日期也被刮过。'
                },
                {
                    id: 'father_school_statement', x: 430, y: 245,
                    texture: 'trash_paper', tint: 0xffcccc,
                    clueId: 'father_school_statement', clueType: 'control',
                    documentTitle: '父亲给老师的说明',
                    documentText: '父亲写道：李明 18:00 已回家并因成绩争吵，随后自行离开。落款日期是事故第二天。'
                },
                {
                    id: 'school_final_stack', x: 300, y: 360,
                    texture: 'desk', tint: 0x666666,
                    dialog: '把离校、车程和父亲的说法放到一起，只有一条时间线能成立。',
                    clueId: 'school_last_argument',
                    clueType: 'control',
                    puzzleId: 'school',
                    memoryReturn: { mapId: 'room_study', x: 330, y: 290 }
                }
            ],
            doors: []
        }
    },
    memory_hospital: {
        id: 'memory_hospital',
        name: '记忆：旧医院',
        purpose: '用处方与余量找出治疗被中断的日期',
        rewards: ['hospital_puzzle'],
        visual: {
            rain: false,
            ambient: 0x9fb8c8,
            floorTint: 0x9fb3b8,
            wallTint: 0x52636b,
            paperTint: 0xdff7ff
        },
        width: 20,
        height: 14,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 80, y: 240 },
            interactables: [
                {
                    id: 'hospital_prescription', x: 120, y: 95,
                    texture: 'trash_paper', tint: 0xe5f6ff,
                    clueId: 'hospital_prescription', clueType: 'illness',
                    documentTitle: '七日处方',
                    documentText: '白片早晚各一片，连续七日，共十四片。任何一天不得自行停药。'
                },
                {
                    id: 'hospital_pill_count', x: 350, y: 95,
                    texture: 'trash_paper', tint: 0xffffff,
                    clueId: 'hospital_pill_count', clueType: 'illness',
                    documentTitle: '药盒余量',
                    documentText: '第五天清晨清点：十四片药还剩八片。护士在数字旁画了一个问号。'
                },
                {
                    id: 'hospital_ward_log', x: 520, y: 205,
                    texture: 'bed', tint: 0xaaccff,
                    clueId: 'hospital_ward_log', clueType: 'illness',
                    documentTitle: '病房记录',
                    documentText: '第四日晚，丈夫强行取走药盒；第五日早晚均未服药。病人反复要求把药还来。'
                },
                {
                    id: 'hospital_bill', x: 190, y: 330,
                    texture: 'trash_paper', tint: 0xffdddd,
                    clueId: 'hospital_bill', clueType: 'illness',
                    documentTitle: '拒付缴费单',
                    documentText: '第四日晚签字拒绝继续住院。签名旁写着：家丑不可外扬，带回家管。'
                },
                {
                    id: 'hospital_return', x: 450, y: 355,
                    texture: 'desk', tint: 0xffffff,
                    dialog: '药量、病房记录和拒付单能共同指出治疗在哪一天、被谁中断。',
                    clueId: 'hospital_mother_voice',
                    clueType: 'illness',
                    puzzleId: 'hospital',
                    memoryReturn: { mapId: 'room_medicine', x: 150, y: 300 }
                }
            ],
            doors: []
        }
    },
    memory_crash: {
        id: 'memory_crash',
        name: '记忆：雨夜车祸',
        purpose: '调查死亡现场并作最终选择',
        rewards: ['crash_evidence', 'final_choice'],
        visual: {
            rain: true,
            ambient: 0x26384a,
            floorTint: 0x2b3038,
            wallTint: 0x111a22,
            paperTint: 0x9db5c8,
            debris: false
        },
        width: 30,
        height: 12,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 120, y: 200 },
            interactables: [
                {
                    id: 'crash_car_memory',
                    x: 420,
                    y: 230,
                    texture: 'car',
                    tint: 0x666666,
                    clueId: 'crash_car_memory',
                    clueType: 'death',
                    documentTitle: '变形的车门',
                    documentText: '车门从里面撞弯了。安全带还扣着，像一只不肯松开的手。你终于想起来，自己并不是从这里走出去的。'
                },
                {
                    id: 'crash_guardrail',
                    x: 660,
                    y: 160,
                    texture: 'photo_frame',
                    tint: 0xcccccc,
                    clueId: 'crash_guardrail',
                    clueType: 'death',
                    documentTitle: '护栏缺口',
                    documentText: '护栏外的坡下有一只纸飞机，湿透了，却还保持着飞出去的姿势。'
                },
                {
                    id: 'final_leave',
                    x: 850,
                    y: 180,
                    texture: 'tile_mud',
                    tint: 0x88ccff,
                    dialog: '前面的路没有灯。身后的饭香越来越淡，雨声也第一次有了尽头。',
                    endingChoice: 'leave'
                },
                {
                    id: 'final_return',
                    x: 850,
                    y: 320,
                    texture: 'tile_wall',
                    tint: 0x884444,
                    dialog: '老宅亮起一盏灯。母亲喊你吃饭，父亲扶着门，像那场雨夜从未发生。',
                    endingChoice: 'return'
                }
            ],
            doors: []
        }
    },
    room_memory: {
        id: 'room_memory',
        name: '记忆空间',
        purpose: '确认回家选择并触发团聚结局',
        rewards: ['return_confirmation', 'ending_together'],
        visual: { rain: false },
        width: 24,
        height: 18,
        data: [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1],
        ],
        objects: {
            playerStart: { x: 384, y: 350 },
            table: { x: 384, y: 200 },
            parents_npc: { x: 384, y: 150 },
            exit_door: { x: 384, y: 560 },
            doors: []
        }
    }
};
