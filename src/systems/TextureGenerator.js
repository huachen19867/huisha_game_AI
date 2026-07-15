export class TextureGenerator {
    static generate(scene) {
        this.scene = scene;
        this.createPlayerSheet();
        this.createNpc();
        this.createEnvironment();
        this.createFlashlight();
        this.createVignette();
        this.createRain();
        this.createToyPlane(); // Added
        this.createScratch(); // Added
        this.createSliceProps();
    }

    static createScratch() {
        const scratchG = this.scene.make.graphics({x:0, y:0, add:false});
        scratchG.lineStyle(2, 0x888888, 0.8);
        scratchG.beginPath();
        scratchG.moveTo(4, 4); scratchG.lineTo(28, 28);
        scratchG.moveTo(28, 4); scratchG.lineTo(4, 28);
        scratchG.moveTo(16, 2); scratchG.lineTo(16, 30);
        scratchG.strokePath();
        scratchG.generateTexture('scratch', 32, 32);
    }

    static createToyPlane() {
        const planeG = this.scene.make.graphics({x:0, y:0, add:false});
        planeG.fillStyle(0xffffff);
        planeG.beginPath();
        planeG.moveTo(16, 4);
        planeG.lineTo(28, 20);
        planeG.lineTo(16, 32);
        planeG.lineTo(4, 20);
        planeG.closePath();
        planeG.fillPath();
        
        planeG.lineStyle(1, 0xcccccc);
        planeG.beginPath();
        planeG.moveTo(16, 4); planeG.lineTo(16, 32);
        planeG.strokePath();
        
        planeG.generateTexture('toy_plane', 32, 32);
    }

    static createSliceProps() {
        const makeBowlTexture = (key, baseColor, accentColor, mark) => {
            const bowl = this.scene.make.graphics({ x: 0, y: 0, add: false });
            bowl.fillStyle(0x000000, 0.25);
            bowl.fillEllipse(14, 15, 26, 9);
            bowl.fillStyle(baseColor);
            bowl.fillEllipse(14, 11, 28, 17);
            bowl.fillStyle(0x2b2722);
            bowl.fillEllipse(14, 8, 22, 9);
            bowl.lineStyle(2, accentColor, 1);
            bowl.strokeEllipse(14, 8, 23, 10);

            if (mark === 'chip') {
                bowl.fillStyle(0x16130f);
                bowl.fillTriangle(22, 2, 28, 5, 24, 10);
            } else if (mark === 'stain') {
                bowl.fillStyle(accentColor, 0.9);
                bowl.fillCircle(10, 8, 3);
                bowl.fillCircle(15, 6, 2);
            } else if (mark === 'plane') {
                bowl.lineStyle(2, accentColor, 1);
                bowl.beginPath();
                bowl.moveTo(8, 10);
                bowl.lineTo(15, 4);
                bowl.lineTo(20, 10);
                bowl.lineTo(15, 8);
                bowl.closePath();
                bowl.strokePath();
            } else if (mark === 'rice') {
                bowl.fillStyle(0xd8d0c2, 0.85);
                bowl.fillEllipse(10, 7, 4, 2);
                bowl.fillEllipse(15, 6, 5, 2);
                bowl.fillEllipse(19, 8, 4, 2);
            }

            bowl.generateTexture(key, 28, 20);
        };

        makeBowlTexture('bowl_wine', 0xb7a27e, 0x5b2e1f, 'chip');
        makeBowlTexture('bowl_medicine', 0xe8e3d7, 0x7b8e52, 'stain');
        makeBowlTexture('bowl_child', 0xd9e6ef, 0x3f6f9d, 'plane');
        makeBowlTexture('bowl_offering', 0x8a8175, 0x4b4038, 'rice');

        const chair = this.scene.make.graphics({ x: 0, y: 0, add: false });
        chair.fillStyle(0x3f2b20);
        chair.fillRect(8, 4, 32, 30);
        chair.fillRect(5, 30, 7, 24);
        chair.fillRect(36, 30, 7, 24);
        chair.lineStyle(3, 0x241812);
        chair.strokeRect(8, 4, 32, 30);
        chair.fillStyle(0xd6d6c8);
        chair.fillCircle(8, 49, 3);
        chair.fillCircle(40, 49, 3);
        chair.generateTexture('chair_nailed', 48, 56);

        const shard = this.scene.make.graphics({ x: 0, y: 0, add: false });
        shard.fillStyle(0xd7d0bd);
        shard.fillTriangle(1, 11, 7, 1, 17, 9);
        shard.lineStyle(2, 0x315f89);
        shard.beginPath();
        shard.moveTo(1, 11);
        shard.lineTo(7, 1);
        shard.lineTo(17, 9);
        shard.strokePath();
        shard.generateTexture('blue_shard', 18, 12);

        const mirror = this.scene.make.graphics({ x: 0, y: 0, add: false });
        mirror.fillStyle(0x49382c);
        mirror.fillRoundedRect(0, 0, 48, 72, 4);
        mirror.fillStyle(0x1d2931);
        mirror.fillRoundedRect(5, 5, 38, 62, 3);
        mirror.lineStyle(2, 0x71808a, 0.5);
        mirror.beginPath();
        mirror.moveTo(9, 58);
        mirror.lineTo(36, 12);
        mirror.strokePath();
        mirror.generateTexture('slice_mirror', 48, 72);

        const uniform = this.scene.make.graphics({ x: 0, y: 0, add: false });
        uniform.fillStyle(0x202936);
        uniform.fillRoundedRect(2, 8, 44, 30, 3);
        uniform.fillStyle(0x141a23);
        uniform.fillRect(8, 2, 32, 10);
        uniform.lineStyle(2, 0x33465a);
        uniform.strokeRect(2, 8, 44, 30);
        uniform.fillStyle(0x4d7da5);
        uniform.fillRect(34, 27, 9, 6);
        uniform.generateTexture('slice_uniform', 48, 40);

        const ticket = this.scene.make.graphics({ x: 0, y: 0, add: false });
        ticket.fillStyle(0xc8b996);
        ticket.fillRect(1, 1, 46, 20);
        ticket.fillStyle(0x2b2925);
        ticket.fillCircle(43, 4, 3);
        ticket.lineStyle(1, 0x716750);
        ticket.beginPath();
        ticket.moveTo(23, 2);
        ticket.lineTo(22, 20);
        ticket.moveTo(7, 8);
        ticket.lineTo(18, 8);
        ticket.moveTo(7, 13);
        ticket.lineTo(16, 13);
        ticket.strokePath();
        ticket.generateTexture('train_ticket', 48, 22);

        const comics = this.scene.make.graphics({ x: 0, y: 0, add: false });
        comics.fillStyle(0x25344a);
        comics.fillRect(5, 8, 39, 25);
        comics.fillStyle(0x6f4938);
        comics.fillRect(2, 5, 39, 25);
        comics.fillStyle(0x8b7b59);
        comics.fillRect(0, 2, 39, 25);
        comics.lineStyle(2, 0x26211c);
        comics.strokeRect(0, 2, 39, 25);
        comics.lineStyle(1, 0xd0c59f);
        comics.beginPath();
        comics.moveTo(8, 8);
        comics.lineTo(31, 22);
        comics.moveTo(31, 8);
        comics.lineTo(8, 22);
        comics.strokePath();
        comics.generateTexture('comic_stack', 48, 36);
    }

    static createPlayerSheet() {
        const frameWidth = 32;
        const frameHeight = 48;
        const playerTexture = this.scene.make.graphics({ x: 0, y: 0, add: false });
        
        const drawPlayer = (x, y, dir, step) => {
            const hairColor = 0x1a1a1a;
            const skinColor = 0xe0c0a0;
            const clothesColor = 0x2c3e50;
            const pantsColor = 0x111111;
            
            // Body
            playerTexture.fillStyle(clothesColor);
            playerTexture.fillRect(x + 8, y + 16, 16, 18);
            
            // Legs
            playerTexture.fillStyle(pantsColor);
            let leftLegY = 0, rightLegY = 0;
            if (step === 1) { leftLegY = -2; rightLegY = 2; }
            if (step === 2) { leftLegY = 2; rightLegY = -2; }
            
            if (dir === 0 || dir === 3) {
                 playerTexture.fillRect(x + 10, y + 34 + leftLegY, 5, 12);
                 playerTexture.fillRect(x + 17, y + 34 + rightLegY, 5, 12);
            } else if (dir === 1) {
                if (step === 0) {
                    playerTexture.fillRect(x + 12, y + 34, 8, 12);
                } else if (step === 1) {
                    playerTexture.fillRect(x + 8, y + 32, 6, 12);
                    playerTexture.fillRect(x + 16, y + 34, 6, 10);
                } else {
                    playerTexture.fillRect(x + 16, y + 32, 6, 12);
                    playerTexture.fillRect(x + 8, y + 34, 6, 10);
                }
            } else if (dir === 2) {
                if (step === 0) {
                    playerTexture.fillRect(x + 12, y + 34, 8, 12);
                } else if (step === 1) {
                    playerTexture.fillRect(x + 16, y + 32, 6, 12);
                    playerTexture.fillRect(x + 8, y + 34, 6, 10);
                } else {
                    playerTexture.fillRect(x + 8, y + 32, 6, 12);
                    playerTexture.fillRect(x + 16, y + 34, 6, 10);
                }
            }

            // Head
            playerTexture.fillStyle(skinColor);
            playerTexture.fillRect(x + 9, y + 4, 14, 12);
            
            // Hair
            playerTexture.fillStyle(hairColor);
            if (dir === 3) {
                playerTexture.fillRect(x + 8, y + 2, 16, 14);
            } else {
                playerTexture.fillRect(x + 8, y + 2, 16, 6);
                if (dir === 1) playerTexture.fillRect(x + 20, y + 4, 4, 10);
                if (dir === 2) playerTexture.fillRect(x + 8, y + 4, 4, 10);
                if (dir === 0) {
                    playerTexture.fillRect(x + 8, y + 2, 4, 8);
                    playerTexture.fillRect(x + 20, y + 2, 4, 8);
                }
            }

            // Face
            if (dir !== 3) {
                 playerTexture.fillStyle(0x000000);
                 if (dir === 0) {
                     playerTexture.fillRect(x + 11, y + 10, 2, 2);
                     playerTexture.fillRect(x + 19, y + 10, 2, 2);
                 } else if (dir === 1) {
                     playerTexture.fillRect(x + 10, y + 10, 2, 2);
                 } else if (dir === 2) {
                     playerTexture.fillRect(x + 20, y + 10, 2, 2);
                 }
            }
        };

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 3; col++) {
                drawPlayer(col * frameWidth, row * frameHeight, row, col);
            }
        }
        playerTexture.generateTexture('player_sheet', frameWidth * 3, frameHeight * 4);
    }

    static createNpc() {
        const npcGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
        npcGraphics.fillStyle(0xffffff);
        npcGraphics.fillCircle(16, 16, 14);
        npcGraphics.fillStyle(0xffffff);
        npcGraphics.fillRect(8, 28, 16, 20);
        npcGraphics.fillStyle(0xff0000);
        npcGraphics.fillCircle(10, 18, 5);
        npcGraphics.fillCircle(22, 18, 5);
        npcGraphics.lineStyle(2, 0x000000);
        npcGraphics.strokeCircle(11, 14, 2);
        npcGraphics.strokeCircle(21, 14, 2);
        npcGraphics.lineStyle(2, 0xcc0000);
        npcGraphics.beginPath();
        npcGraphics.arc(16, 22, 6, 0.2, 2.94, false);
        npcGraphics.strokePath();
        npcGraphics.generateTexture('npc_paper', 32, 48);
    }

    static createEnvironment() {
        // Tile Floor
        const floorG = this.scene.make.graphics({x:0, y:0, add:false});
        floorG.fillStyle(0x3e2723);
        floorG.fillRect(0,0,32,32);
        floorG.lineStyle(1, 0x281a16);
        floorG.strokeRect(0,0,32,32);
        floorG.lineStyle(1, 0x4e342e, 0.5);
        floorG.beginPath();
        floorG.moveTo(4, 0); floorG.lineTo(4, 32);
        floorG.moveTo(18, 0); floorG.lineTo(18, 32);
        floorG.strokePath();
        floorG.generateTexture('tile_floor', 32, 32);

        // Outdoor Ground (Mud/Grass)
        const mudG = this.scene.make.graphics({x:0, y:0, add:false});
        mudG.fillStyle(0x2d2d2d); // Darker base
        mudG.fillRect(0,0,32,32);
        mudG.fillStyle(0x3e3e3e); // Noise
        mudG.fillRect(4, 4, 2, 2);
        mudG.fillRect(20, 10, 3, 3);
        mudG.fillRect(10, 25, 2, 2);
        mudG.generateTexture('tile_mud', 32, 32);

        // Outdoor Wall (Hedge/Fence)
        const hedgeG = this.scene.make.graphics({x:0, y:0, add:false});
        hedgeG.fillStyle(0x1b3c1b); // Dark green
        hedgeG.fillRect(0,0,32,32);
        hedgeG.fillStyle(0x2d4d2d);
        hedgeG.fillCircle(10, 10, 8);
        hedgeG.fillCircle(22, 22, 6);
        hedgeG.generateTexture('tile_hedge', 32, 32);

        // Photo Frame
        const frameG = this.scene.make.graphics({x:0, y:0, add:false});
        frameG.fillStyle(0x3e2723);
        frameG.fillRect(0, 0, 32, 40);
        frameG.fillStyle(0x1a1a1a);
        frameG.fillRect(4, 4, 24, 32);
        frameG.generateTexture('photo_frame', 32, 40);

        // Wall
        const wallG = this.scene.make.graphics({x:0, y:0, add:false});
        wallG.fillStyle(0x555555);
        wallG.fillRect(0,0,32,32);
        wallG.fillStyle(0x333333);
        wallG.fillRect(0, 28, 32, 4);
        wallG.generateTexture('tile_wall', 32, 32);

        // Car (Improved)
        const carG = this.scene.make.graphics({x:0, y:0, add:false});
        
        // Shadow
        carG.fillStyle(0x000000, 0.5);
        carG.fillEllipse(32, 70, 70, 40);

        // Body (Sedan shape, top-down)
        carG.fillStyle(0x333333); // Dark Grey Body
        carG.fillRoundedRect(0, 10, 64, 110, 10);
        
        // Roof
        carG.fillStyle(0x222222);
        carG.fillRoundedRect(4, 35, 56, 50, 5);

        // Windshields
        carG.fillStyle(0x111111); // Glass
        carG.fillRect(6, 25, 52, 10); // Front Windshield
        carG.fillRect(6, 85, 52, 8);  // Rear Windshield
        
        // Side Windows
        carG.fillRect(2, 38, 4, 44);
        carG.fillRect(58, 38, 4, 44);

        // Headlights (Front is top in this orientation usually? No, let's assume Up is Front for car, but map has car sideways or vertical?)
        // Assuming car faces UP (y=0)
        carG.fillStyle(0xffffcc); // Yellowish light
        carG.fillCircle(10, 12, 6);
        carG.fillCircle(54, 12, 6);
        
        // Taillights
        carG.fillStyle(0xcc0000); // Red light
        carG.fillRect(6, 116, 12, 4);
        carG.fillRect(46, 116, 12, 4);
        
        // Damage/Rust
        carG.fillStyle(0x5d4037, 0.6);
        carG.beginPath();
        carG.moveTo(10, 40); carG.lineTo(20, 50); carG.lineTo(15, 60);
        carG.fill();

        carG.generateTexture('car', 64, 128);

        // Coffin
        const coffinG = this.scene.make.graphics({x:0, y:0, add:false});
        coffinG.fillStyle(0x0a0a0a);
        coffinG.fillRect(0, 0, 64, 128);
        coffinG.fillStyle(0x222222, 0.5);
        coffinG.fillRect(10, 0, 44, 128);
        coffinG.lineStyle(2, 0xd4af37);
        coffinG.strokeRect(4, 4, 56, 120);
        coffinG.fillStyle(0xd4af37);
        coffinG.fillCircle(32, 32, 12);
        coffinG.fillStyle(0x000000);
        coffinG.generateTexture('coffin', 64, 128);

        // Altar
        const altarG = this.scene.make.graphics({x:0, y:0, add:false});
        altarG.fillStyle(0x4e342e);
        altarG.fillRect(0, 0, 96, 48);
        altarG.fillStyle(0x8b0000);
        altarG.beginPath();
        altarG.moveTo(0, 0);
        altarG.lineTo(96, 0);
        altarG.lineTo(86, 30);
        altarG.lineTo(10, 30);
        altarG.closePath();
        altarG.fillPath();
        altarG.lineStyle(2, 0xd4af37);
        altarG.strokeRect(15, 5, 66, 20);
        altarG.generateTexture('altar', 96, 48);

        // Candle
        const candleG = this.scene.make.graphics({x:0, y:0, add:false});
        candleG.fillStyle(0xdddddd);
        candleG.fillRect(10, 10, 12, 22);
        candleG.fillStyle(0xff0000);
        candleG.fillRect(14, 14, 4, 4);
        candleG.fillStyle(0x222222);
        candleG.fillRect(15, 6, 2, 4);
        candleG.generateTexture('candle', 32, 32);

        // Rice
        const riceG = this.scene.make.graphics({x:0, y:0, add:false});
        riceG.fillStyle(0xffffff);
        riceG.beginPath();
        riceG.arc(16, 20, 10, Math.PI, 0);
        riceG.fillPath();
        riceG.fillStyle(0x336699);
        riceG.beginPath();
        riceG.arc(16, 20, 10, 0, Math.PI);
        riceG.fillPath();
        riceG.lineStyle(2, 0x000000);
        riceG.beginPath();
        riceG.moveTo(14, 5); riceG.lineTo(15, 20);
        riceG.moveTo(18, 5); riceG.lineTo(17, 20);
        riceG.strokePath();
        riceG.generateTexture('rice', 32, 32);

        // Well (Backyard)
        const wellG = this.scene.make.graphics({x:0, y:0, add:false});
        wellG.fillStyle(0x555555);
        wellG.fillCircle(32, 32, 28);
        wellG.fillStyle(0x000000);
        wellG.fillCircle(32, 32, 20);
        wellG.lineStyle(4, 0x333333);
        wellG.strokeCircle(32, 32, 28);
        wellG.generateTexture('well', 64, 64);

        // Dead Tree
        const treeG = this.scene.make.graphics({x:0, y:0, add:false});
        treeG.lineStyle(4, 0x2d2d2d);
        treeG.beginPath();
        treeG.moveTo(32, 64);
        treeG.lineTo(32, 20);
        treeG.lineTo(10, 10);
        treeG.moveTo(32, 40);
        treeG.lineTo(54, 15);
        treeG.strokePath();
        treeG.generateTexture('tree', 64, 64);

        // Bed (Improved)
        const bedG = this.scene.make.graphics({x:0, y:0, add:false});
        bedG.fillStyle(0x5d4037); // Frame
        bedG.fillRoundedRect(0, 0, 48, 80, 4);
        bedG.fillStyle(0xffffff); // Mattress
        bedG.fillRoundedRect(4, 4, 40, 72, 2);
        bedG.fillStyle(0xe0e0e0); // Blanket (Folded)
        bedG.fillRect(4, 30, 40, 46);
        bedG.fillStyle(0xeeeeee); // Pillow
        bedG.fillRoundedRect(8, 8, 32, 16, 4);
        bedG.generateTexture('bed', 48, 80);

        // Cabinet (Hiding Spot - Improved)
        const cabG = this.scene.make.graphics({x:0, y:0, add:false});
        cabG.fillStyle(0x4e342e); // Wood
        cabG.fillRect(0, 0, 48, 64);
        cabG.lineStyle(2, 0x3e2723);
        cabG.strokeRect(0, 0, 48, 64);
        
        // Doors gap
        cabG.beginPath();
        cabG.moveTo(24, 2); cabG.lineTo(24, 62);
        cabG.strokePath();
        
        // Handles
        cabG.fillStyle(0xd4af37); // Gold handles
        cabG.fillCircle(20, 32, 2);
        cabG.fillCircle(28, 32, 2);
        
        // Wood grain details
        cabG.lineStyle(1, 0x5d4037, 0.5);
        cabG.beginPath();
        cabG.moveTo(10, 10); cabG.lineTo(10, 50);
        cabG.moveTo(38, 10); cabG.lineTo(38, 50);
        cabG.strokePath();

        cabG.generateTexture('cabinet', 48, 64);

        // Kitchen Sink
        const sinkG = this.scene.make.graphics({x:0, y:0, add:false});
        sinkG.fillStyle(0xcccccc);
        sinkG.fillRect(0, 0, 64, 32);
        sinkG.fillStyle(0xaaaaaa); // Basin
        sinkG.fillRect(36, 4, 24, 24);
        sinkG.fillStyle(0x333333); // Stove burners
        sinkG.fillCircle(12, 16, 8);
        sinkG.generateTexture('kitchen_sink', 64, 32);

        // Toilet
        const toiletG = this.scene.make.graphics({x:0, y:0, add:false});
        toiletG.fillStyle(0xffffff);
        toiletG.fillCircle(16, 16, 12); // Bowl
        toiletG.fillRect(8, 0, 16, 10); // Tank
        toiletG.fillStyle(0xccccff); // Water
        toiletG.fillCircle(16, 18, 8);
        toiletG.generateTexture('toilet', 32, 32);

        // Desk
        const deskG = this.scene.make.graphics({x:0, y:0, add:false});
        deskG.fillStyle(0x5d4037);
        deskG.fillRect(0, 0, 64, 32);
        deskG.lineStyle(2, 0x3e2723);
        deskG.strokeRect(0, 0, 64, 32);
        deskG.generateTexture('desk', 64, 32);

        // Diary
        const diaryG = this.scene.make.graphics({x:0, y:0, add:false});
        diaryG.fillStyle(0x8b4513); // Leather cover
        diaryG.fillRect(0, 0, 16, 20);
        diaryG.fillStyle(0xf5deb3); // Pages
        diaryG.fillRect(14, 2, 2, 16);
        diaryG.generateTexture('diary', 16, 20);

        // Stove (Improved)
        const stoveG = this.scene.make.graphics({x:0, y:0, add:false});
        stoveG.fillStyle(0x7f8c8d); // Metal body
        stoveG.fillRect(0, 0, 64, 48);
        stoveG.lineStyle(2, 0x2c3e50);
        stoveG.strokeRect(0, 0, 64, 48);
        
        // Burners
        stoveG.fillStyle(0x2c3e50);
        stoveG.fillCircle(16, 16, 10);
        stoveG.fillCircle(48, 16, 10);
        
        // Grate pattern on burners
        stoveG.lineStyle(2, 0x95a5a6);
        stoveG.beginPath();
        stoveG.moveTo(16, 6); stoveG.lineTo(16, 26);
        stoveG.moveTo(6, 16); stoveG.lineTo(26, 16);
        stoveG.moveTo(48, 6); stoveG.lineTo(48, 26);
        stoveG.moveTo(38, 16); stoveG.lineTo(58, 16);
        stoveG.strokePath();
        
        // Knobs
        stoveG.fillStyle(0x000000);
        stoveG.fillCircle(12, 40, 4);
        stoveG.fillCircle(24, 40, 4);
        stoveG.fillCircle(40, 40, 4);
        stoveG.fillCircle(52, 40, 4);
        
        stoveG.generateTexture('stove', 64, 48);

        // Trash/Clutter (Random Papers)
        const trashG = this.scene.make.graphics({x:0, y:0, add:false});
        trashG.fillStyle(0xecf0f1);
        trashG.fillRect(0, 0, 10, 8);
        trashG.lineStyle(1, 0xbdc3c7);
        trashG.strokeRect(0, 0, 10, 8);
        trashG.generateTexture('trash_paper', 10, 8);

        // Safe (Steel Box)
        const safeG = this.scene.make.graphics({x:0, y:0, add:false});
        safeG.fillStyle(0x333333); // Dark steel body
        safeG.fillRect(0, 0, 48, 48);
        safeG.lineStyle(2, 0x111111);
        safeG.strokeRect(0, 0, 48, 48);
        
        // Door Outline
        safeG.lineStyle(1, 0x000000);
        safeG.strokeRect(4, 4, 40, 40);
        
        // Digital Pad
        safeG.fillStyle(0x000000);
        safeG.fillRect(28, 10, 12, 8); // Screen
        safeG.fillStyle(0x00ff00);
        safeG.fillRect(30, 12, 8, 4); // Lit screen
        
        // Keypad buttons
        safeG.fillStyle(0x555555);
        safeG.fillRect(28, 22, 12, 12);
        
        // Handle
        safeG.fillStyle(0x888888); // Silver handle
        safeG.fillCircle(12, 24, 6);
        safeG.lineStyle(2, 0x555555);
        safeG.beginPath();
        safeG.moveTo(12, 24); safeG.lineTo(18, 30);
        safeG.strokePath();

        safeG.generateTexture('safe', 48, 48);

        // Wet Paper (Blueish tint for ink bleed)
    }

    static createFlashlight() {
        const lightTexture = this.scene.textures.createCanvas('flashlight_cone', 200, 300);
        const ctx = lightTexture.getContext();
        
        const grd = ctx.createRadialGradient(100, 0, 0, 100, 0, 300);
        grd.addColorStop(0, 'rgba(255, 255, 220, 0.6)');
        grd.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
        grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grd;
        
        ctx.beginPath();
        ctx.moveTo(100, 0);
        ctx.lineTo(0, 300);
        ctx.quadraticCurveTo(100, 320, 200, 300); 
        ctx.lineTo(100, 0);
        ctx.fill();

        const coreGrd = ctx.createRadialGradient(100, 0, 0, 100, 0, 200);
        coreGrd.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        coreGrd.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = coreGrd;
        ctx.beginPath();
        ctx.moveTo(100, 0);
        ctx.lineTo(60, 200);
        ctx.quadraticCurveTo(100, 210, 140, 200);
        ctx.lineTo(100, 0);
        ctx.fill();
        
        lightTexture.refresh();
    }

    static createVignette() {
        const vignetteTexture = this.scene.textures.createCanvas('vignette', 800, 600);
        const vCtx = vignetteTexture.getContext();
        const vGrd = vCtx.createRadialGradient(400, 300, 300, 400, 300, 500);
        vGrd.addColorStop(0, 'rgba(0,0,0,0)');
        vGrd.addColorStop(1, 'rgba(0,0,0,0.9)');
        vCtx.fillStyle = vGrd;
        vCtx.fillRect(0, 0, 800, 600);
        vignetteTexture.refresh();
    }

    static createRain() {
        const rainG = this.scene.make.graphics({x:0, y:0, add:false});
        rainG.fillStyle(0xaaaaaa, 0.5);
        rainG.fillRect(0, 0, 2, 10);
        rainG.generateTexture('rain', 2, 10);
    }
}
