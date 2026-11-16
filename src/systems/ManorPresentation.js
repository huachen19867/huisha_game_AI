// Small local pixel textures keep the standalone file portable and offline.
export class ManorPresentation {
    static coffinTexture(state) {
        const deductions = state.investigation?.deductions || {};
        const mask = (deductions.school ? 1 : 0) | (state.candlesLit ? 2 : 0) | (deductions.hospital ? 4 : 0);
        return mask ? `coffin_${mask}` : 'coffin';
    }

    static syncCoffin(scene) {
        scene.coffin?.setTexture(ManorPresentation.coffinTexture(scene.gameState));
    }

    static floorTexture(mapId) {
        if (['room_prologue', 'memory_crash'].includes(mapId)) return 'tile_road';
        if (['room_entrance', 'room_backyard'].includes(mapId)) return 'tile_mud';
        if (['room_kitchen', 'room_bathroom'].includes(mapId)) return 'tile_ceramic';
        if (['room_basement', 'room_secret'].includes(mapId)) return 'tile_stone';
        if (mapId === 'memory_hospital') return 'tile_hospital';
        if (mapId === 'memory_school') return 'tile_classroom';
        return 'tile_floor';
    }

    static floorDebris(map, x, y) {
        if (map.visual?.debris === false || map.id.startsWith('memory_') || ['room_memory', 'room_prologue', 'room_entrance', 'room_backyard'].includes(map.id)) return null;
        const seed = [...map.id].reduce((value, char) => Math.imul(value, 31) + char.charCodeAt(0) | 0, 7);
        const hash = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ seed) >>> 0;
        if (hash % 23 !== 0) return null;
        const px = x * 32 + 16, py = y * 32 + 16;
        // Decoration stays clear of objects and door thresholds.
        for (const [key, value] of Object.entries(map.objects)) {
            for (const item of Array.isArray(value) ? value : [value]) {
                if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y)) continue;
                const ix = key === 'doors' ? (item.x + (item.w || 1) / 2) * 32 : item.x;
                const iy = key === 'doors' ? (item.y + (item.h || 1) / 2) * 32 : item.y;
                if (Math.hypot(px - ix, py - iy) < 48) return null;
            }
        }
        return { x: px + (hash % 11) - 5, y: py + ((hash >>> 8) % 11) - 5, rotation: (hash % 628) / 100 };
    }

    static syncRitual(scene, progress) {
        const offerings = scene.ritualOfferings;
        if (!offerings) return;
        offerings.rice.setVisible(progress >= 1);
        offerings.incense.setVisible(progress >= 2);
        offerings.ash.setVisible(progress >= 3);
        const lit = progress >= 2;
        scene.leftCandle.setAlpha(lit ? 1 : 0.3);
        scene.rightCandle.setAlpha(lit ? 1 : 0.3);
        if (lit && !scene.ritualLights.length) {
            scene.ritualLights = [scene.leftCandle, scene.rightCandle].map(candle =>
                scene.lights.addLight(candle.x, candle.y, 100).setColor(0xffbb66).setIntensity(1.2));
        } else if (!lit && scene.ritualLights.length) {
            scene.ritualLights.forEach(light => scene.lights.removeLight(light));
            scene.ritualLights = [];
        }
    }

    static syncSecretDoor(scene) {
        const revealed = !!scene.gameState.cabinetMoved;
        (scene.doors?.getChildren() || []).forEach(door => {
            if (door.targetMap !== 'room_secret') return;
            door.body.enable = revealed;
            door.visible = revealed;
            door.isHiddenDoor = !revealed;
        });
        (scene.secretDoorVisuals || []).forEach(item => item.setVisible(revealed));
    }

    static generateTextures(scene) {
        const make = (key, width, height, draw) => {
            if (scene.textures.exists(key)) scene.textures.remove(key);
            const texture = scene.textures.createCanvas(key, width, height);
            const ctx = texture.getContext();
            ctx.imageSmoothingEnabled = false;
            const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
            draw(ctx, rect);
            texture.refresh();
        };
        make('tile_floor', 32, 32, (ctx, r) => {
            r(0, 0, 32, 32, '#635548');
            for (let i = 0; i < 4; i++) {
                r(i * 8, 0, 1, 32, '#332f2a');
                r(i * 8 + 1, 0, 1, 32, '#8b7357');
                r(i * 8 + 3, (i * 7) % 22, 1, 11, '#796550');
                r(i * 8 + 2, (i * 13 + 4) % 30, 5, 1, '#494137');
                r(i * 8 + 4, (i * 5 + 3) % 25, 1, 1, '#a18b67');
            }
        });
        make('tile_wall', 32, 32, (ctx, r) => {
            r(0, 0, 32, 32, '#555751');
            r(0, 0, 32, 3, '#99917a');
            r(0, 26, 32, 6, '#222a29');
            r(0, 24, 32, 2, '#8b7960');
            r(3, 4, 26, 18, '#6d6e5e');
            r(5, 5, 1, 14, '#85806a');
            r(17, 12, 12, 1, '#4d574d');
            r(22, 13, 1, 7, '#4d574d');
            r(0, 28, 32, 1, '#101a1c');
        });
        make('tile_mud', 32, 32, (ctx, r) => {
            r(0, 0, 32, 32, '#343e3e');
            r(0, 15, 32, 1, '#252f32');
            r(15, 0, 1, 15, '#252f32');
            r(6, 16, 1, 16, '#252f32');
            r(2, 3, 11, 1, '#53605a');
            r(19, 21, 9, 1, '#65716a');
            r(21, 24, 5, 1, '#455b5e');
        });
        for (const [key, base, edge, inset] of [
            ['tile_ceramic', '#879489', '#404f4d', '#a6b0a0'],
            ['tile_hospital', '#b2c4bd', '#7a9695', '#d1d8c6'],
            ['tile_stone', '#586362', '#303d3f', '#6e7770']
        ]) make(key, 32, 32, (ctx, r) => {
            r(0, 0, 32, 32, edge); r(1, 1, 30, 30, base);
            r(2, 2, 28, 1, inset); r(2, 3, 1, 26, inset);
            r(24, 24, 4, 1, edge); r(25, 25, 2, 1, edge);
            if (key === 'tile_ceramic') { r(14, 14, 4, 4, edge); r(15, 15, 2, 2, inset); }
            if (key === 'tile_hospital') { r(27, 3, 2, 26, '#94aaa3'); }
        });
        make('tile_classroom', 32, 32, (ctx, r) => {
            r(0, 0, 32, 32, '#968361');
            for (let i = 0; i < 4; i++) {
                r(0, i * 8, 32, 1, '#504b3c'); r(2, i * 8 + 1, 27, 1, '#b5a078');
                r(i % 2 ? 10 : 23, i * 8, 1, 8, '#665d46');
                r(i * 5 + 4, i * 8 + 5, 7, 1, '#7a6c51');
            }
        });
        make('tile_road', 32, 32, (ctx, r) => {
            r(0, 0, 32, 32, '#424e53');
            for (let i = 0; i < 14; i++) r((i * 13 + 3) % 32, (i * 7 + 2) % 32, 2, 1, i % 2 ? '#586166' : '#333f45');
            r(2, 23, 14, 1, '#69767a'); r(6, 25, 6, 1, '#53676c');
        });
        make('floor_scuff', 12, 8, (ctx, r) => {
            r(0, 4, 7, 2, '#343d36'); r(4, 2, 7, 1, '#454839'); r(8, 5, 3, 1, '#302f2b');
        });
        make('offering_rice', 20, 16, (ctx, r) => {
            r(2, 6, 16, 5, '#c4c8b0'); r(4, 11, 12, 3, '#7f9e95'); r(7, 14, 6, 2, '#bbbc9a');
            r(3, 3, 14, 4, '#e1d8ad'); r(6, 1, 8, 3, '#d3c9a0'); r(4, 6, 12, 1, '#f0e1b4');
            r(8, 9, 4, 2, '#536e69');
        });
        make('offering_ash', 20, 12, (ctx, r) => {
            r(1, 3, 18, 5, '#8b8069'); r(3, 8, 14, 3, '#534f46'); r(3, 3, 14, 3, '#333d39');
            r(5, 4, 4, 1, '#b2ac8e'); r(10, 3, 5, 2, '#777f71'); r(8, 1, 3, 1, '#b0a278');
        });
        make('document_page', 24, 30, (ctx, r) => {
            r(2, 2, 21, 28, '#3b3d33'); r(0, 0, 21, 27, '#d1c5a1');
            r(1, 1, 19, 1, '#f0dfb6'); r(3, 5, 13, 2, '#76644e');
            for (let y = 11; y < 23; y += 4) r(3, y, y === 19 ? 10 : 15, 1, '#8d866c');
            r(15, 19, 4, 4, '#9b5744'); r(0, 25, 21, 2, '#ac9a77');
        });
        make('incense_bundle', 24, 32, (ctx, r) => {
            for (let i = 0; i < 5; i++) { r(4 + i * 3, 2 + i % 2, 2, 27, '#aa7950'); r(4 + i * 3, 1 + i % 2, 2, 5, '#57483e'); }
            r(2, 18, 20, 7, '#985b42'); r(3, 19, 18, 1, '#c28d60');
            r(11, 17, 2, 10, '#c9ac73');
        });
        make('spirit_money_bundle', 32, 28, (ctx, r) => {
            for (let i = 2; i >= 0; i--) {
                const x = i * 3, y = i * 4;
                r(x + 1, y + 1, 24, 17, '#73644b'); r(x, y, 24, 16, '#bfab70');
                r(x + 2, y + 2, 20, 12, '#777552'); r(x + 3, y + 3, 18, 10, '#c9b880');
                r(x + 9, y + 5, 6, 6, '#8c6949'); r(x + 11, y + 7, 2, 2, '#d6c592');
            }
        });
        make('red_key', 32, 20, (ctx, r) => {
            r(2, 3, 11, 12, '#b6955b'); r(4, 5, 7, 8, '#303a34');
            r(12, 7, 16, 4, '#b6955b'); r(22, 10, 3, 5, '#b6955b'); r(27, 10, 3, 4, '#b6955b');
            r(13, 6, 2, 11, '#9f4f40'); r(15, 12, 5, 2, '#c07751');
            r(3, 3, 9, 1, '#debd7b');
        });
        for (const empty of [false, true]) make(empty ? 'well_empty' : 'well', 64, 64, (ctx, r) => {
            // Same footprint in both states; sealed slabs and the outward hook stay in place.
            r(9, 15, 46, 43, '#1d2929'); r(3, 24, 58, 24, '#364440');
            r(8, 13, 48, 35, '#737761'); r(3, 21, 58, 21, '#737761');
            r(8, 12, 48, 3, '#a29c7c'); r(4, 21, 3, 19, '#9b9a7c');
            r(10, 18, 44, 25, '#172a2b');
            r(12, 17, 18, 24, '#7f8572'); r(32, 18, 19, 23, '#636e61');
            r(14, 18, 14, 2, '#afb091'); r(34, 19, 14, 2, '#979e84');
            r(16, 23, 2, 14, '#515e53'); r(41, 28, 10, 2, '#424f47');
            r(29, 20, 5, 14, '#b6a16b'); r(30, 22, 2, 9, '#936441');
            r(11, 43, 42, 9, '#677360'); r(11, 43, 42, 2, '#a3a184');
            r(18, 48, 1, 7, '#344c42'); r(48, 43, 5, 3, '#50654c');
            r(38, 43, 3, 10, '#90653f'); r(36, 51, 6, 3, '#684d36');
            r(40, 39, 3, 13, '#c3b28b'); r(40, 38, 3, 2, '#e0d0a6');
            r(43, 43, 2, 12, '#b4ad8c'); // Existing scrape leads out over the rim.
            if (!empty) {
                r(37, 40, 9, 9, '#bd985d'); r(39, 42, 5, 5, '#35423c');
                r(41, 42, 2, 5, '#c3b28b'); // Hook tip passes through the ring.
                r(40, 49, 3, 10, '#b7965b'); r(43, 55, 4, 3, '#b7965b');
                r(37, 50, 3, 9, '#b05e48'); r(36, 56, 2, 5, '#c57a52');
                r(37, 40, 9, 1, '#e2bd7b');
            }
        });
        for (const open of [false, true]) make(open ? 'safe_open' : 'safe', 48, 48, (ctx, r) => {
            r(1, 2, 46, 44, '#292f2b'); r(2, 3, 44, 41, '#7b7b61');
            r(3, 4, 42, 2, '#aaa185'); r(5, 7, 38, 35, '#414d45');
            r(6, 8, 36, 32, open ? '#111e20' : '#6e7764');
            r(4, 42, 7, 5, '#343e36'); r(37, 42, 7, 5, '#343e36');
            r(2, 31, 3, 8, '#8b6444'); r(39, 5, 5, 2, '#9c7956');
            if (open) {
                r(10, 34, 24, 2, '#857a5c'); r(12, 37, 13, 1, '#435249');
                r(34, 5, 11, 37, '#8c8b6f'); r(36, 7, 7, 32, '#515f51');
                r(39, 20, 3, 9, '#b4a481');
            } else {
                for (let i = 0; i < 4; i++) { r(9 + i * 8, 12, 6, 10, '#293d37'); r(10 + i * 8, 14, 4, 5, '#bfbd95'); }
                r(13, 28, 20, 3, '#b2ab89'); r(29, 27, 4, 8, '#bbb393');
            }
        });
        make('height_marks', 20, 64, (ctx, r) => {
            r(2, 0, 16, 64, '#3a3930'); r(3, 0, 2, 64, '#827452');
            r(6, 0, 11, 64, '#5c503b'); r(11, 4, 1, 56, '#756043');
            for (const [y, w] of [[46, 8], [31, 9], [13, 11]]) { r(5, y, w, 1, '#c7b78e'); r(5, y + 1, w, 1, '#272f2b'); }
            r(14, 15, 2, 4, '#a28a60'); r(14, 21, 2, 2, '#a28a60');
            r(4, 58, 13, 6, '#394641');
        });
        for (const wrecked of [false, true]) make(wrecked ? 'car_wrecked' : 'car', 64, 128, (ctx, r) => {
            r(3, 8, 58, 116, '#1b2c2d');
            for (const x of [0, 58]) { r(x, 28, 6, 23, '#152326'); r(x, 89, 6, 23, '#152326'); }
            r(6, 5, 52, 116, '#65776b'); r(8, 8, 48, 110, '#8e9781');
            r(10, 10, 44, 27, '#5e756e'); r(12, 11, 40, 2, '#b3b599');
            r(9, 39, 46, 20, '#273f43'); r(12, 41, 40, 3, '#577578');
            r(10, 60, 44, 29, '#778d7b'); r(12, 61, 2, 25, '#a8b39a');
            r(11, 91, 42, 14, '#2b4546'); r(13, 93, 38, 2, '#698482');
            r(10, 107, 44, 10, '#5d7368'); r(7, 120, 50, 3, '#a0a18a');
            r(8, 13, 8, 5, '#dccda0'); r(48, 13, 8, 5, '#dccda0');
            r(9, 114, 7, 5, '#955e4d'); r(48, 114, 7, 5, '#955e4d');
            r(6, 62, 2, 24, '#314c47'); r(56, 62, 2, 24, '#314c47');
            // The same pale crescent scratch can be observed in both scenes.
            r(6, 87, 1, 5, '#d5c69b'); r(7, 92, 1, 4, '#d5c69b'); r(8, 96, 4, 1, '#d5c69b');
            if (wrecked) {
                r(5, 5, 25, 9, '#4e5a51'); r(29, 9, 30, 7, '#26383b');
                r(9, 18, 40, 3, '#a49c7b'); r(20, 23, 28, 6, '#354a49');
                r(14, 44, 2, 8, '#a7b5a3'); r(16, 51, 13, 2, '#a7b5a3'); r(28, 53, 2, 5, '#a7b5a3');
                r(15, 65, 34, 22, '#293e3e'); r(23, 71, 17, 14, '#b7af8a');
                r(30, 66, 3, 20, '#4a4a41'); r(30, 79, 4, 3, '#b09c71');
                r(5, 85, 3, 12, '#7b654b'); r(6, 88, 1, 4, '#c4b18b'); r(8, 96, 4, 1, '#c4b18b');
            }
        });
        for (const covered of [true, false]) make(covered ? 'portrait_covered' : 'portrait_father', 30, 38, (ctx, r) => {
            r(0, 0, 30, 38, '#171e1c'); r(1, 1, 28, 35, '#967c50'); r(3, 3, 24, 31, '#333e37');
            if (covered) {
                r(1, 0, 28, 33, '#18272a'); r(2, 0, 26, 3, '#39484a');
                r(5, 4, 3, 25, '#26373a'); r(20, 2, 2, 28, '#101e22');
                r(8, 30, 17, 5, '#172428'); r(23, 29, 4, 7, '#c5b48c');
                r(24, 31, 2, 3, '#846b4c');
            } else {
                r(5, 5, 20, 24, '#b1b49c'); r(10, 7, 10, 13, '#c5c2a5');
                r(10, 6, 10, 5, '#454d41'); r(9, 8, 2, 7, '#555a48');
                r(11, 13, 2, 1, '#545749'); r(17, 13, 2, 1, '#545749'); r(14, 18, 3, 1, '#777862');
                r(8, 21, 14, 8, '#4f5b4e'); r(13, 21, 4, 3, '#bec0a5'); r(14, 24, 2, 5, '#2c3e36');
                r(9, 31, 12, 1, '#beb08b'); r(4, 35, 22, 3, '#263538');
                r(6, 36, 12, 2, '#3b4948');
            }
        });
        for (let mask = 0; mask < 8; mask++) make(mask ? `coffin_${mask}` : 'coffin', 64, 128, (ctx, r) => {
            r(9, 5, 48, 119, '#100f10');
            r(4, 12, 56, 108, '#232725');
            r(8, 9, 48, 110, '#4a3931');
            r(11, 12, 42, 101, '#262b28');
            r(13, 14, 38, 2, '#a68a56');
            r(13, 109, 38, 2, '#a68a56');
            r(13, 14, 2, 97, '#7c6748');
            r(49, 14, 2, 97, '#7c6748');
            r(15, 24, 10, 10, '#c1b38c'); r(17, 26, 6, 1, '#9a5543'); r(19, 28, 1, 4, '#9a5543');
            r(39, 86, 10, 10, '#c2c1a2'); r(39, 86, 10, 2, '#608290'); r(41, 91, 6, 1, '#7d816e');
            r(24, 48, 16, 30, '#bda56e');
            r(29, 52, 6, 2, '#63362c');
            r(31, 56, 2, 16, '#63362c');
            r(27, 61, 10, 2, '#63362c');
            r(26, 69, 12, 2, '#63362c');
            // Draw over the paper so the middle knot and its slack remain visible.
            for (let i = 0; i < 3; i++) {
                const y = 30 + i * 31;
                if (mask & (1 << i)) {
                    r(8, y, 12, 2, '#8b3e36'); r(18, y + 2, 8, 2, '#8b3e36');
                    r(26, y + 4, 13, 2, '#a9644c'); r(39, y + 2, 9, 2, '#8b3e36');
                    r(48, y, 8, 2, '#8b3e36');
                } else {
                    r(8, y, 48, 3, '#8b3e36'); r(8, y, 48, 1, '#b3614d');
                    r(29, y - 2, 7, 7, '#a85743'); r(31, y, 3, 3, '#55382e');
                }
            }
            // The separate metal lock stays closed until the player opens it.
            r(27, 79, 11, 9, '#9c8c61'); r(29, 76, 7, 3, '#b2a475'); r(32, 82, 2, 4, '#29332e');
            r(54, 18, 3, 93, '#574436');
        });
        make('altar', 96, 48, (ctx, r) => {
            r(5, 7, 86, 36, '#392d29');
            r(2, 5, 92, 21, '#785541');
            r(2, 5, 92, 3, '#a28260');
            r(8, 12, 80, 18, '#713b35');
            r(10, 29, 5, 18, '#44372e');
            r(81, 29, 5, 18, '#44372e');
            r(16, 30, 64, 3, '#a88451');
            r(38, 0, 22, 25, '#b69560');
            r(41, 3, 16, 19, '#232b2b');
            r(44, 8, 10, 11, '#111918');
            r(44, 27, 11, 7, '#97805d');
            for (let i = 0; i < 3; i++) r(46 + i * 3, 21, 1, 8, '#c4ac77');
        });
        make('cabinet', 48, 64, (ctx, r) => {
            r(1, 2, 46, 60, '#302a27');
            r(2, 3, 44, 5, '#9b7957');
            r(4, 8, 40, 50, '#604736');
            for (let x of [6, 25]) {
                r(x, 10, 17, 45, '#856047');
                r(x + 2, 12, 13, 40, '#5a4435');
                r(x + 4, 13, 1, 36, '#785a40');
            }
            r(23, 8, 2, 49, '#201f1d');
            r(19, 32, 3, 4, '#c1a274'); r(27, 32, 3, 4, '#c1a274');
            r(5, 58, 5, 6, '#292725'); r(38, 58, 5, 6, '#292725');
        });
        for (const hasRice of [true, false]) make(hasRice ? 'kitchen_cabinet_rice' : 'kitchen_cabinet_empty', 48, 64, (ctx, r) => {
            r(1, 2, 46, 60, '#342e28'); r(2, 3, 44, 5, '#a38b63');
            r(5, 8, 38, 32, '#25302d'); r(6, 10, 36, 3, '#544738');
            r(4, 39, 40, 4, '#aa8c61'); r(6, 43, 36, 14, '#68513b');
            r(8, 45, 32, 10, '#524535'); r(20, 46, 8, 2, '#b6a477');
            r(3, 8, 3, 50, '#8b7452'); r(42, 8, 3, 50, '#6e5e43');
            r(5, 58, 5, 6, '#302d26'); r(38, 58, 5, 6, '#302d26');
            r(12, 36, 24, 2, '#a69469'); r(15, 34, 18, 1, '#8f805f');
            r(19, 35, 10, 1, '#29312d');
            if (hasRice) {
                r(10, 27, 28, 5, '#d1d1b4'); r(12, 32, 24, 3, '#8ca8a0');
                r(16, 35, 16, 2, '#75958f'); r(13, 24, 22, 3, '#dfd6b1');
                r(17, 22, 14, 3, '#e6d9ae'); r(22, 16, 2, 12, '#8e6a44');
                r(27, 16, 2, 12, '#99784c'); r(33, 36, 6, 3, '#914f3c');
            }
        });
        make('bed', 48, 80, (ctx, r) => {
            r(1, 1, 46, 77, '#604837'); r(3, 2, 42, 7, '#a08461');
            r(5, 9, 38, 63, '#b8b197'); r(8, 11, 32, 14, '#d0c7a9');
            r(10, 12, 28, 2, '#e1d7b7'); r(7, 30, 34, 41, '#486365');
            for (let i = 0; i < 6; i++) r(9 + i * 6, 32, 1, 37, '#668281');
            r(7, 30, 34, 5, '#90a69b'); r(3, 73, 42, 4, '#856a4c');
        });
        make('desk', 64, 48, (ctx, r) => {
            r(3, 6, 58, 35, '#3f342c'); r(1, 3, 62, 25, '#8d6a48');
            r(2, 3, 60, 2, '#b29063'); r(6, 29, 23, 10, '#5c4935');
            r(15, 32, 8, 2, '#bba172'); r(5, 39, 5, 9, '#42372d'); r(54, 28, 5, 20, '#42372d');
            r(11, 8, 22, 14, '#cabda0'); r(14, 10, 13, 1, '#7b7e71'); r(14, 14, 16, 1, '#7b7e71');
            r(39, 7, 7, 13, '#713f37'); r(42, 8, 1, 11, '#b08860');
        });
        for (const hasMatches of [true, false]) make(hasMatches ? 'workbench_matches' : 'workbench_empty', 64, 48, (ctx, r) => {
            r(3, 6, 58, 35, '#40372d'); r(1, 3, 62, 25, '#756547');
            r(2, 3, 60, 2, '#a3946c'); r(4, 28, 56, 3, '#aa9060');
            r(6, 32, 51, 7, '#514331'); r(24, 34, 12, 2, '#8a7754');
            r(5, 39, 5, 9, '#40372d'); r(54, 29, 5, 19, '#40372d');
            // Carving tools, unfinished puppet and red thread stay after pickup.
            r(8, 7, 13, 2, '#b8c0a4'); r(21, 6, 7, 4, '#473d2e');
            r(33, 7, 5, 5, '#b19a6b'); r(31, 13, 9, 9, '#b19a6b');
            r(44, 8, 8, 7, '#8e503d'); r(48, 16, 6, 1, '#ac6650');
            r(53, 17, 3, 4, '#ac6650'); r(41, 21, 12, 3, '#c3b38b');
            r(9, 16, 18, 11, '#b0a078'); r(11, 18, 14, 7, '#ab9a72');
            if (hasMatches) {
                r(8, 15, 19, 12, '#3b372c'); r(9, 15, 18, 9, '#d1bc83');
                r(11, 17, 14, 5, '#9a5540'); r(15, 18, 6, 2, '#e0c992');
                r(9, 24, 18, 3, '#624734'); r(12, 25, 12, 1, '#b6a47b');
            }
        });
        make('boarded_window', 40, 40, (ctx, r) => {
            r(0, 0, 40, 40, '#332e27'); r(1, 1, 38, 38, '#7b674b');
            r(4, 4, 32, 32, '#162a30'); r(5, 5, 30, 29, '#2f4a4e');
            r(7, 6, 4, 12, '#516765'); r(26, 19, 5, 14, '#415d60');
            r(18, 4, 3, 32, '#a08b62'); r(4, 18, 32, 3, '#927956');
            // Outer boards sit behind the inner frame and latch.
            for (const y of [10, 26]) {
                r(4, y, 32, 6, '#70533a'); r(6, y + 1, 28, 1, '#987451');
                r(8, y + 4, 21, 1, '#4b3d2d');
                r(5, y + 2, 2, 1, '#c3c1a6'); r(33, y + 2, 2, 1, '#c3c1a6');
                r(6, y + 3, 1, 2, '#817f71'); r(34, y + 3, 1, 2, '#817f71');
            }
            r(2, 3, 3, 34, '#ab9266'); r(35, 3, 3, 34, '#8a7452');
            r(18, 18, 3, 6, '#b3a47e'); r(20, 21, 7, 2, '#c7b38c');
            r(4, 35, 31, 1, '#0c1d23'); r(7, 37, 26, 1, '#b29a6b');
            for (const x of [10, 14, 25]) { r(x, 32, 1, 4, '#c8b48b'); r(x + 1, 34, 1, 2, '#c8b48b'); }
        });
        make('classroom_desk', 64, 64, (ctx, r) => {
            r(4, 12, 56, 31, '#342e28'); r(2, 3, 60, 28, '#8c704b');
            r(3, 4, 58, 3, '#b69967'); r(5, 8, 54, 19, '#9c7d53');
            r(8, 12, 21, 1, '#b09462'); r(35, 20, 17, 1, '#735b3e');
            r(7, 30, 50, 6, '#604b36'); r(9, 36, 5, 14, '#403b30'); r(50, 36, 5, 14, '#403b30');
            r(15, 46, 34, 13, '#6b543b'); r(17, 47, 30, 3, '#a08053');
            r(17, 59, 4, 4, '#3f3930'); r(43, 59, 4, 4, '#3f3930');
            r(23, 10, 2, 9, '#75603f'); r(25, 17, 5, 1, '#75603f');
        });
        make('teacher_desk', 104, 48, (ctx, r) => {
            r(3, 12, 98, 32, '#49392a'); r(0, 1, 104, 23, '#806444');
            r(2, 2, 100, 3, '#ad8e59'); r(6, 7, 91, 13, '#90734b');
            r(6, 25, 27, 16, '#5d4733'); r(37, 25, 28, 16, '#614a35'); r(69, 25, 28, 16, '#58422f');
            for (const x of [17, 49, 81]) r(x, 29, 7, 2, '#b29463');
            r(8, 43, 7, 4, '#37332b'); r(89, 43, 7, 4, '#37332b');
            r(75, 7, 13, 7, '#444c3a'); r(77, 8, 9, 2, '#adb193');
        });
        make('classroom_window', 40, 72, (ctx, r) => {
            r(1, 1, 38, 68, '#3b4038'); r(3, 3, 34, 63, '#8d8d68');
            r(6, 6, 28, 57, '#355355'); r(8, 8, 24, 18, '#547270');
            r(9, 35, 22, 23, '#3e5f5e'); r(18, 5, 3, 59, '#858365');
            r(5, 28, 30, 3, '#999474'); r(5, 48, 30, 3, '#858365');
            r(10, 10, 2, 13, '#73918a'); r(26, 36, 2, 9, '#65867e');
            r(0, 66, 40, 5, '#aca078'); r(2, 70, 36, 2, '#494e40');
        });
        make('exam_stack', 32, 24, (ctx, r) => {
            r(3, 5, 28, 18, '#635741'); r(1, 3, 28, 18, '#b8ad87');
            r(3, 0, 27, 18, '#dfcfa4'); r(6, 3, 21, 2, '#8c8466');
            for (const y of [8, 11, 14]) r(7, y, 18, 1, '#9e987b');
            r(21, 5, 4, 1, '#a3513d'); r(22, 6, 1, 3, '#a3513d');
        });
        make('waiting_bench', 104, 48, (ctx, r) => {
            r(4, 7, 96, 20, '#405d59'); r(6, 8, 92, 4, '#849b88');
            r(8, 14, 88, 10, '#607e70'); r(2, 26, 100, 12, '#7b9481');
            r(4, 27, 96, 3, '#a8b69a'); r(6, 37, 92, 4, '#4f6a60');
            for (const x of [35, 68]) { r(x, 10, 2, 15, '#3b5954'); r(x, 30, 2, 7, '#4a665b'); }
            r(12, 41, 5, 6, '#3f5550'); r(87, 41, 5, 6, '#3f5550');
        });
        make('privacy_screen', 72, 96, (ctx, r) => {
            r(3, 1, 3, 88, '#7c9c98'); r(66, 1, 3, 88, '#7c9c98');
            r(4, 2, 64, 3, '#c1cec0'); r(7, 6, 58, 72, '#8caeaa');
            for (let x = 9; x < 64; x += 8) { r(x, 7, 3, 70, '#739893'); r(x + 3, 8, 2, 66, '#acc2b6'); }
            r(7, 78, 58, 3, '#b1c4b6'); r(2, 88, 13, 3, '#647e77'); r(57, 88, 13, 3, '#647e77');
            r(4, 91, 5, 4, '#2e4642'); r(63, 91, 5, 4, '#2e4642');
        });
        make('bedside_cabinet', 40, 48, (ctx, r) => {
            r(2, 10, 36, 34, '#6b857b'); r(0, 1, 40, 14, '#a0b4a2');
            r(2, 2, 36, 3, '#d2d8bb'); r(4, 17, 32, 10, '#9bb09e');
            r(15, 21, 10, 2, '#4e6b62'); r(4, 29, 32, 12, '#819d8f');
            r(18, 32, 3, 5, '#bfc9ab'); r(5, 44, 4, 4, '#425b51'); r(31, 44, 4, 4, '#425b51');
        });
        make('forms_table', 64, 40, (ctx, r) => {
            r(4, 9, 56, 26, '#4d6258'); r(0, 1, 64, 18, '#8c9f88');
            r(2, 2, 60, 3, '#b5bba0'); r(5, 8, 54, 8, '#9caa90');
            r(7, 19, 5, 20, '#44594f'); r(52, 19, 5, 20, '#44594f');
        });
        make('payment_slip', 24, 28, (ctx, r) => {
            r(3, 3, 21, 25, '#64766b'); r(0, 0, 21, 26, '#d5d8b9');
            r(2, 3, 17, 3, '#799c9c'); r(3, 10, 15, 1, '#99a992');
            r(3, 15, 15, 1, '#99a992'); r(3, 20, 9, 1, '#99a992'); r(14, 19, 4, 4, '#a17458');
        });
        make('school_board', 112, 56, (ctx, r) => {
            r(0, 1, 112, 52, '#483b2d'); r(1, 1, 110, 3, '#a58c5f');
            r(3, 4, 106, 44, '#213f38'); r(5, 5, 103, 2, '#466356');
            r(6, 9, 69, 2, '#345146'); r(8, 43, 58, 2, '#2b483e');
            // Chalk ranking: the second row is included, not crossed out.
            r(11, 12, 2, 7, '#b8c5a8'); r(9, 18, 6, 1, '#b8c5a8');
            r(9, 24, 6, 1, '#d6d3ad'); r(14, 25, 1, 3, '#d6d3ad');
            r(9, 28, 6, 1, '#d6d3ad'); r(9, 29, 1, 3, '#d6d3ad'); r(9, 32, 6, 1, '#d6d3ad');
            for (const y of [14, 26, 38]) { r(23, y, 25, 1, '#a5b89a'); r(52, y, 11, 1, '#879f88'); }
            r(67, 27, 2, 2, '#d0d0a7'); r(69, 29, 2, 2, '#d0d0a7'); r(71, 24, 2, 5, '#d0d0a7');
            r(80, 8, 24, 34, '#c5ba92'); r(82, 10, 20, 2, '#917b53');
            for (let y = 16; y <= 32; y += 6) r(84, y, 15, 1, '#8c8869');
            r(86, 20, 14, 3, '#a69a6d'); r(91, 33, 7, 5, '#9c6750');
            r(0, 48, 112, 6, '#785d3e'); r(3, 49, 106, 1, '#b79b6c');
            r(15, 47, 12, 2, '#d3d0b1'); r(60, 46, 15, 4, '#8a8b70'); r(62, 46, 11, 1, '#b8b99a');
        });
        make('school_report', 32, 40, (ctx, r) => {
            r(3, 2, 28, 37, '#514936'); r(1, 0, 28, 37, '#d5c6a0');
            r(3, 2, 24, 2, '#eee0ba'); r(5, 7, 19, 2, '#6d715c');
            for (const y of [13, 19, 25]) { r(5, y, 21, 1, '#a49c7e'); r(15, y - 2, 1, 5, '#b0a486'); }
            r(19, 12, 5, 1, '#a34f3b'); r(23, 13, 1, 2, '#a34f3b');
            r(20, 15, 4, 1, '#a34f3b'); r(23, 16, 1, 2, '#a34f3b'); r(19, 18, 5, 1, '#a34f3b');
            r(17, 20, 10, 2, '#ac513c'); r(18, 23, 9, 1, '#9b4635');
            r(19, 21, 7, 1, '#2e3831'); r(22, 22, 4, 2, '#2e3831');
            r(5, 30, 8, 1, '#8c8b70'); r(15, 29, 5, 2, '#98543e'); r(19, 31, 7, 1, '#98543e');
            r(1, 35, 5, 3, '#263c37'); r(26, 34, 4, 4, '#263c37');
        });
        make('clinic_window', 96, 64, (ctx, r) => {
            r(2, 1, 92, 60, '#303f3c'); r(3, 2, 90, 4, '#a4b3a6');
            r(5, 6, 86, 43, '#819c97'); r(8, 8, 80, 38, '#547b7c');
            r(10, 9, 2, 34, '#9ab5aa'); r(15, 11, 28, 2, '#7a9e97');
            r(48, 6, 3, 38, '#b4c0ac'); r(8, 28, 80, 2, '#a9b9a7');
            r(15, 18, 22, 6, '#638886'); r(55, 33, 28, 2, '#78988d');
            r(34, 37, 30, 12, '#152f32'); r(36, 38, 26, 2, '#375553');
            r(0, 49, 96, 9, '#a8b2a0'); r(0, 49, 96, 2, '#d0d0b6');
            r(4, 58, 88, 4, '#5a746c'); r(7, 60, 82, 2, '#334f49');
            r(65, 42, 22, 13, '#cfd0b7'); r(67, 43, 18, 2, '#688f9b');
            r(69, 48, 13, 1, '#858d7c'); r(70, 51, 9, 1, '#858d7c');
        });
        make('hospital_bed', 48, 80, (ctx, r) => {
            r(2, 0, 3, 76, '#81998e'); r(43, 0, 3, 76, '#81998e');
            r(3, 1, 42, 3, '#ccd0b7'); r(6, 5, 36, 67, '#b3c2b2');
            r(8, 8, 32, 16, '#e0dfc4'); r(10, 9, 28, 2, '#f1e9cd');
            r(8, 27, 32, 39, '#c6d0bd'); r(10, 28, 28, 2, '#e0e2c8');
            r(8, 31, 2, 34, '#a5baae'); r(38, 31, 2, 34, '#a5baae');
            r(11, 64, 26, 2, '#e5e2c7'); r(3, 69, 42, 3, '#d1d4bb');
            r(10, 71, 2, 5, '#829f91'); r(36, 71, 2, 5, '#829f91');
            r(15, 62, 18, 15, '#d7caa5'); r(21, 60, 6, 4, '#738b80');
            r(18, 66, 12, 1, '#8b907a'); r(18, 69, 12, 1, '#8b907a');
            r(17, 68, 14, 2, '#a35a47'); r(18, 73, 8, 1, '#9f6a50');
            r(1, 76, 5, 3, '#324e48'); r(42, 76, 5, 3, '#324e48');
        });
        make('road_guardrail', 96, 40, (ctx, r) => {
            r(8, 9, 5, 29, '#405c59'); r(80, 9, 5, 29, '#405c59');
            r(0, 7, 96, 7, '#97aba0'); r(0, 8, 96, 2, '#cfceb1');
            r(0, 21, 96, 6, '#617f78'); r(0, 21, 96, 1, '#a0b5a3');
            for (const x of [10, 82]) { r(x, 10, 2, 2, '#415956'); r(x, 23, 2, 2, '#354e4d'); }
            r(42, 9, 11, 3, '#b9a26a'); r(45, 10, 5, 1, '#ded0a0');
        });
        make('road_lane', 96, 16, (ctx, r) => {
            r(14, 6, 65, 3, '#7c846e'); r(16, 9, 60, 1, '#435e58');
            for (const x of [25, 46, 67]) r(x, 6, 3, 3, '#334c4b');
        });
        make('skid_marks', 96, 80, (ctx, r) => {
            for (let y = 0; y < 78; y += 3) {
                const drift = Math.floor(y * y / 420);
                for (const x of [22 + drift, 60 + drift]) {
                    r(x, y, 4, 3, '#152226'); r(x - 1, y, 1, 2, '#405550');
                }
            }
        });
        make('guardrail_marker', 96, 56, (ctx, r) => {
            r(9, 26, 5, 28, '#3c5554'); r(79, 19, 5, 32, '#3c5554');
            r(0, 23, 58, 7, '#b2b5a1'); r(0, 24, 56, 2, '#dde0c2');
            r(56, 26, 6, 7, '#829b96'); r(68, 20, 13, 7, '#829b96'); r(80, 16, 16, 7, '#a7b4a2');
            r(0, 37, 58, 6, '#728f8a'); r(0, 37, 56, 1, '#afbca7');
            r(57, 40, 6, 6, '#607f7b'); r(69, 34, 12, 6, '#607f7b'); r(80, 30, 16, 6, '#8da49a');
            r(25, 23, 3, 19, '#776c4f'); r(28, 26, 6, 2, '#9c7952');
            r(7, 27, 20, 11, '#3a5550'); r(8, 28, 18, 9, '#b9b697');
            r(10, 29, 14, 1, '#7d7054'); r(11, 33, 4, 2, '#6a7662'); r(17, 33, 5, 2, '#6a7662');
            // The paper plane lies beyond the rail, away from the wrecked car.
            r(70, 10, 17, 2, '#e0d4ae'); r(73, 8, 15, 2, '#e0d4ae'); r(77, 6, 13, 2, '#e0d4ae');
            r(75, 12, 9, 2, '#bcb795'); r(76, 14, 5, 3, '#c6c1a0'); r(80, 9, 2, 4, '#84988a');
            r(9, 52, 7, 3, '#55766a'); r(77, 48, 8, 3, '#55766a');
        });
        make('mountain_path', 96, 64, (ctx, r) => {
            // Wet stones climb toward the open side of the memory road.
            r(36, 35, 22, 15, '#3e5754'); r(51, 28, 19, 15, '#465f5a');
            r(65, 20, 18, 15, '#526b61'); r(79, 11, 17, 17, '#658074');
            r(37, 35, 19, 3, '#9aa88e'); r(53, 28, 16, 3, '#a3b196');
            r(67, 20, 14, 3, '#aebba0'); r(81, 11, 15, 3, '#bac4a7');
            r(37, 48, 21, 2, '#263e3d'); r(53, 41, 17, 2, '#2d4642');
            r(66, 33, 17, 2, '#354f48'); r(81, 26, 15, 2, '#405d52');
            r(10, 49, 30, 4, '#263f3c'); r(14, 46, 21, 3, '#526b58');
            r(19, 13, 5, 35, '#63533c'); r(20, 14, 2, 32, '#a08a5e');
            r(7, 11, 28, 10, '#9f8a60'); r(35, 13, 4, 6, '#9f8a60');
            r(39, 15, 3, 2, '#9f8a60'); r(8, 11, 27, 2, '#c0ad7b');
            r(11, 15, 18, 1, '#6c6248'); r(19, 21, 6, 2, '#493f31');
            r(48, 47, 12, 3, '#6b826c'); r(71, 38, 13, 3, '#607b66');
        });
        make('manor_threshold', 80, 64, (ctx, r) => {
            // A familiar lintel and warm slit of light, without an ending label.
            r(7, 5, 66, 5, '#353b33'); r(11, 10, 58, 43, '#4d4938');
            r(15, 12, 50, 39, '#172725'); r(19, 14, 42, 36, '#2b3329');
            r(13, 10, 5, 42, '#8b7551'); r(62, 10, 5, 42, '#6f6246');
            r(18, 10, 44, 3, '#ad9162'); r(20, 15, 25, 34, '#4a3c2b');
            r(22, 17, 20, 29, '#5b4930'); r(24, 19, 15, 1, '#816a43');
            r(43, 14, 3, 36, '#a48249'); r(46, 16, 8, 34, '#c4a15e');
            r(54, 19, 5, 31, '#8b784a'); r(39, 31, 3, 3, '#c6af76');
            r(10, 51, 60, 5, '#8c8b6d'); r(7, 56, 66, 5, '#626e5c');
            r(12, 52, 56, 1, '#b5b195'); r(10, 60, 61, 3, '#344c43');
            r(44, 50, 15, 2, '#b5a56d'); r(49, 52, 12, 2, '#8d8a5b');
            r(31, 49, 2, 8, '#a15c45'); r(29, 56, 3, 4, '#a15c45'); r(28, 60, 2, 3, '#b36c50');
        });
        make('photo_frame', 32, 40, (ctx, r) => {
            r(0, 0, 32, 40, '#3a2e27'); r(2, 2, 28, 36, '#b39161');
            r(4, 4, 24, 32, '#c1b69b'); r(6, 6, 20, 28, '#555f58');
            for (let [x, y] of [[8, 12], [18, 12], [13, 20]]) {
                r(x, y, 5, 5, '#c0ad8c'); r(x - 1, y + 5, 7, 8, '#383e3c');
            }
            r(5, 5, 1, 29, '#e1c88e');
        });
        make('photo_uncovered', 32, 40, (ctx, r) => {
            r(0, 0, 32, 40, '#493e30'); r(2, 2, 28, 36, '#bb9c69');
            r(4, 4, 24, 32, '#c9b994'); r(6, 6, 20, 28, '#606e65');
            r(7, 10, 7, 7, '#bfa57f'); r(6, 17, 10, 16, '#35413e');
            r(18, 17, 5, 5, '#d1b28b'); r(17, 22, 7, 11, '#8a8460');
            r(14, 21, 5, 3, '#bda17c'); r(11, 19, 3, 10, '#e0ceb0');
            r(14, 5, 1, 30, '#b6a782'); r(5, 34, 22, 1, '#dbc9a0');
        });
        make('prescription_envelope', 32, 24, (ctx, r) => {
            r(0, 0, 32, 24, '#3d5055'); r(1, 1, 30, 22, '#c8cab7');
            r(2, 2, 28, 2, '#567c91'); r(2, 20, 28, 2, '#567c91');
            r(5, 8, 15, 1, '#717971'); r(5, 11, 20, 1, '#717971');
            r(23, 5, 5, 4, '#aa7761'); r(10, 16, 13, 1, '#969f90');
        });
        make('pursuer_shadow', 32, 48, (ctx, r) => {
            r(10, 2, 12, 14, '#273032'); r(12, 4, 9, 11, '#111a1d');
            r(8, 15, 17, 26, '#202d2e'); r(12, 17, 11, 24, '#142124');
            r(5, 19, 4, 20, '#394240'); r(24, 17, 3, 22, '#172326');
            r(3, 35, 6, 4, '#595548'); r(25, 37, 4, 4, '#42463e');
            r(9, 39, 6, 7, '#152023'); r(18, 39, 5, 8, '#101b20');
            r(14, 17, 2, 19, '#80574b'); r(15, 33, 1, 11, '#ad8163');
            r(7, 44, 18, 3, '#0c181d'); r(11, 13, 11, 2, '#373d35');
        });
        make('npc_paper', 32, 48, (ctx, r) => {
            r(9, 3, 14, 14, '#d5c7a4'); r(8, 5, 1, 9, '#a79c81');
            r(8, 17, 16, 26, '#bcb594'); r(11, 19, 1, 22, '#7e8576');
            r(21, 19, 1, 22, '#7e8576'); r(15, 18, 2, 23, '#92654e');
            r(3, 19, 5, 15, '#c3b999'); r(24, 19, 5, 15, '#a39f87');
            r(11, 9, 3, 1, '#403d34'); r(19, 9, 3, 1, '#403d34');
            r(13, 13, 7, 1, '#8e5042'); r(8, 43, 7, 3, '#464c43'); r(19, 43, 7, 3, '#464c43');
        });
        // Same 3x4 frame contract as the original character; no runtime asset fetches.
        make('player_sheet', 96, 192, (ctx, r) => {
            for (let dir = 0; dir < 4; dir++) for (let step = 0; step < 3; step++) {
                const x = step * 32, y = dir * 48;
                const stride = step === 1 ? 2 : step === 2 ? -2 : 0;
                r(x + 8, y + 42, 17, 4, '#182122');
                r(x + 10, y + 31, 5, 12 + stride, '#303b3d');
                r(x + 18, y + 31, 5, 12 - stride, '#242f33');
                r(x + 9, y + 41 + stride, 7, 4, '#171e22');
                r(x + 17, y + 41 - stride, 7, 4, '#171e22');
                r(x + 7, y + 16, 19, 18, '#b19b6d');
                r(x + 8, y + 17, 8, 16, '#c8b282'); r(x + 16, y + 18, 8, 15, '#8f805d');
                r(x + 5, y + 19 - stride, 4, 12, '#8e805e'); r(x + 25, y + 19 + stride, 3, 12, '#8e805e');
                r(x + 5, y + 30 - stride, 4, 4, '#c5aa86'); r(x + 25, y + 30 + stride, 3, 4, '#c5aa86');
                r(x + 10, y + 5, 13, 12, '#c5ad8b'); r(x + 9, y + 3, 15, 6, '#262b29');
                r(x + 9, y + 8, 3, 5, '#32352c'); r(x + 21, y + 8, 3, 5, '#32352c');
                if (dir === 3) { r(x + 9, y + 4, 15, 11, '#262b29'); r(x + 12, y + 19, 9, 13, '#4f5c55'); }
                else {
                    if (dir !== 2) r(x + 12, y + 10, 2, 2, '#35332e');
                    if (dir !== 1) r(x + 19, y + 10, 2, 2, '#35332e');
                    r(x + 15, y + 17, 3, 2, '#ebe0b6'); r(x + 16, y + 20, 1, 10, '#695e48');
                }
            }
        });
    }

    constructor(scene, map) {
        const outside = ['room_prologue', 'room_entrance', 'room_backyard', 'memory_crash'].includes(map.id);
        const g = scene.add.graphics().setDepth(3);
        const cabinet = map.objects.cabinet;
        if (cabinet?.id === 'parents_cabinet') {
            g.fillStyle(0xc5b58c, 0.65);
            for (const offset of [26, 31]) g.fillRect(cabinet.x - 34, cabinet.y + offset, 36, 1);
            g.fillStyle(0x302c25, 0.8);
            for (const offset of [27, 32]) g.fillRect(cabinet.x - 34, cabinet.y + offset, 36, 1);
        }
        // Stable room decoration: changing rooms never reshuffles the environment.
        for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
            if (map.data[y][x] !== 0) continue;
            if (map.data[y - 1]?.[x] === 1) { g.fillStyle(0x071016, 0.35); g.fillRect(x * 32, y * 32, 32, 10); }
            if ((x * 17 + y * 29) % 23 === 0) { g.fillStyle(outside ? 0x7b9797 : 0x1c2527, 0.2); g.fillEllipse(x * 32 + 16, y * 32 + 20, 23, 5); }
        }
        scene.furniture.getChildren().forEach(item => {
            item.setDepth(20 + (item.y + item.height * 0.35) / 1000);
            g.fillStyle(0x061016, 0.35);
            g.fillEllipse(item.x + 3, item.y + item.height * 0.4, item.width * 1.1, 12);
        });
        scene.interactables.getChildren().forEach(item => { if (item.depth === 0) item.setDepth(21); });
        scene.ritualOfferings = null;
        scene.ritualLights = [];
        if (map.objects.altar) {
            const { x, y } = map.objects.altar;
            const depth = scene.altar.depth + 0.001;
            scene.ritualOfferings = {
                rice: scene.add.image(x - 18, y + 3, 'offering_rice').setDepth(depth),
                incense: scene.add.image(x + 3, y + 2, 'incense_bundle').setScale(0.5).setDepth(depth),
                ash: scene.add.image(x + 25, y + 8, 'offering_ash').setDepth(depth)
            };
            if (!scene.isMobile) Object.values(scene.ritualOfferings).forEach(item => item.setPipeline('Light2D'));
            ManorPresentation.syncRitual(scene, scene.gameState.candlesLit ? 3 : scene.gameState.investigation?.ritualStep || 0);
        }
        const labels = { room_main: '正厅', room_kitchen: '厨房', room_corridor: '走廊', room_entrance: '大门', room_basement: '地下室', room_attic: '阁楼', room_backyard: '后院', room_bathroom: '盥洗间', room_bedroom_parents: '父母卧室', room_bedroom_me: '旧卧室', room_study: '旧书房', room_medicine: '药柜小间', room_secret: '暗室' };
        scene.secretDoorVisuals = [];
        (map.objects.doors || []).forEach(door => {
            const cx = (door.x + (door.w || 1) / 2) * 32;
            const cy = (door.y + (door.h || 1) / 2) * 32;
            if (door.hidden) {
                if (door.targetMap === 'room_secret') {
                    scene.secretDoorVisuals = [
                        scene.add.rectangle(cx, cy, (door.w || 1) * 32, (door.h || 1) * 32, 0x101b1b).setStrokeStyle(1, 0x70644c).setDepth(10),
                        scene.add.text(cx - 20, cy - 20, '暗室', { fontFamily: 'SimSun,serif', fontSize: '11px', color: '#d9c398', backgroundColor: '#222b2a', padding: { x: 4, y: 3 } }).setOrigin(0.5).setDepth(30)
                    ];
                }
                return;
            }
            const horizontal = (door.w || 1) > (door.h || 1);
            const tx = door.x === 0 ? cx + 32 : door.x >= map.width - 2 ? cx - 32 : cx;
            const ty = door.y === 0 ? cy + 35 : door.y >= map.height - 2 ? cy - 34 : cy;
            g.fillStyle(0xb89b69, 0.45);
            g.fillRect(cx - (horizontal ? 22 : 2), cy - (horizontal ? 2 : 22), horizontal ? 44 : 4, horizontal ? 4 : 44);
            scene.add.text(tx, ty, labels[door.targetMap] || '出口', { fontFamily: 'SimSun,serif', fontSize: '11px', color: '#d9c398', backgroundColor: '#222b2a', padding: { x: 4, y: 3 } }).setOrigin(0.5).setDepth(30);
        });
        ManorPresentation.syncSecretDoor(scene);
        if (!outside) {
            const dust = scene.add.particles(0, 0, 'rain', { x: { min: 32, max: map.width * 32 - 32 }, y: { min: 32, max: map.height * 32 - 32 }, lifespan: 5000, speed: 3, scale: 0.13, alpha: { start: 0.2, end: 0 }, frequency: 600, quantity: 1, tint: 0xd6c298 });
            dust.setDepth(35);
        }
    }
}
