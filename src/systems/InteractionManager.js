import { collectClue, ensureStoryFlags, getTruthLevel } from './StoryState.js';
import { CLUE_NAMES, ensureInvestigation, rememberDocument, getMemoryReturn } from './Investigation.js';
import { Maps } from '../data/Maps.js';
import { examineObject, inspectionStatus, hasClearInteractionPath } from './Exploration.js';
import { ManorPresentation } from './ManorPresentation.js';
import { MapManager } from './MapManager.js';

export class InteractionManager {
    constructor(scene) {
        this.scene = scene;
        this.interactText = scene.interactText;
        this.gameState = scene.gameState;
    }

    update() {
        this.checkInteraction();
    }

    ensureStoryFlags() {
        return ensureStoryFlags(this.gameState);
    }

    collectClue(clueId, clueType) {
        const added = collectClue(this.gameState, clueId, clueType);
        if (added) this.scene.showHint(`记入手记：${CLUE_NAMES[clueId] || '新物证'}  [J]`);
        return added;
    }

    getTruthLevel() {
        return getTruthLevel(this.gameState);
    }

    // Helper to get distance to object bounds
    getDistanceToObj(px, py, obj) {
        if (!obj || !obj.active) return Infinity;

        // Debug: Log interaction attempt for ghosts/safe
        // const isTarget = obj.objId === 'kitchen_ghost' || obj.objId === 'safe';

        let distBody = Infinity;

        // If object has a physics body, use it for accurate bounds
        if (obj.body) {
            // obj.body.x/y is top-left in world space
            const left = obj.body.x;
            const right = obj.body.x + obj.body.width;
            const top = obj.body.y;
            const bottom = obj.body.y + obj.body.height;

            const closestX = Phaser.Math.Clamp(px, left, right);
            const closestY = Phaser.Math.Clamp(py, top, bottom);

            distBody = Phaser.Math.Distance.Between(px, py, closestX, closestY);
        }

        // Fallback to center distance (robustness for desynced bodies)
        const distCenter = Phaser.Math.Distance.Between(px, py, obj.x, obj.y);

        // Return the smaller of the two to ensure interaction works if player is "visually" close
        // Special case: If distance is very small (colliding), return 0 to guarantee interaction
        if (distBody < 5) return 0;

        return Math.min(distBody, distCenter);
    }

    // Debug: Visualize interaction range
    debugInteraction(px, py, closestObj, closestDist, threshold) {
        if (!this.scene.debugGraphics) {
            this.scene.debugGraphics = this.scene.add.graphics().setDepth(1000);
        }
        const g = this.scene.debugGraphics;
        g.clear();

        // Player position
        g.lineStyle(1, 0x00ff00);
        g.strokeCircle(px, py, 10);

        if (closestObj) {
            // Line to closest object
            g.lineStyle(1, closestDist < threshold ? 0x00ff00 : 0xff0000);
            g.lineBetween(px, py, closestObj.x, closestObj.y);

            // Object bounds
            if (closestObj.body) {
                g.strokeRect(closestObj.body.x, closestObj.body.y, closestObj.body.width, closestObj.body.height);
            }
        }
    }

    checkInteraction() {
        // Prevent accidental re-trigger
        if (window.dialogActive || this.scene.isSwitching || this.scene.isManipulating || this.gameState.isHidden || Date.now() - (window.lastDialogCloseTime || 0) < 500) { this.clearTarget(); return; }

        let target = null;
        const px = this.scene.player.sprite.x;
        const py = this.scene.player.sprite.y;
        const scene = this.scene;

        // Interaction distance threshold
        const INTERACT_DIST = 80;

        // --- 2. Generic Interactions (Everything in interactables group) ---
        // MapManager adds almost everything to scene.interactables
        if (!target && scene.interactables) {
            let closestDist = Infinity;
            let closestObj = null;

            scene.interactables.getChildren().forEach(obj => {
                // If object is hidden/disabled, skip
                if (!obj.active || obj.visible === false || obj.body?.enable === false) return;

                const dist = this.getDistanceToObj(px, py, obj);

                // Adjust threshold based on object type if needed
                let threshold = INTERACT_DIST;
                if (obj.texture && obj.texture.key === 'car') threshold = 120; // Bigger reach for cars
                if (obj.objId === 'parents_cabinet') threshold = 100; // Easier access for secret room
                if (obj.texture && obj.texture.key === 'toy_plane') threshold = 40; // Harder to accidentally click
                if (obj === scene.well) threshold = 100; // Keep reach after the key changes its texture.
                if (obj.objId === 'dad_ghost' || obj.objId === 'mom_ghost' || obj.objId === 'kitchen_ghost') threshold = 120; // Increased reach
                if (obj === scene.safe || obj.objId === 'safe' || (obj.texture && obj.texture.key === 'safe')) threshold = 120; // Increased reach for safe
                if (obj === scene.family_rules) threshold = 80; // Reset to normal range now that it has body


                if (dist < threshold && hasClearInteractionPath(Maps[scene.currentMapId], px, py, obj)) {
                    // Retain focus within a small distance band to avoid flicker
                    // between adjacent items. A much nearer item always wins.
                    const score = dist - (scene.currentTarget?.obj === obj ? 6 : 0);
                    if (score < closestDist) {
                        closestDist = score;
                        closestObj = obj;
                        // this.debugInteraction(px, py, closestObj, closestDist, threshold);
                    }
                }
            });

            // DEBUG: Force interaction debug if safe or ghost is nearby
            // scene.interactables.getChildren().forEach(obj => {
            //     if (obj.objId === 'safe' || obj.objId === 'kitchen_ghost') {
            //         const d = this.getDistanceToObj(px, py, obj);
            //         if (d < 200) console.log(`Obj: ${obj.objId}, Dist: ${d}, Active: ${obj.active}, Body: ${!!obj.body}`);
            //     }
            // });

            if (closestObj) {
                const obj = closestObj;
                // Determine type for logic dispatch
                let type = 'generic';

                // Identify specific objects by reference OR texture/properties
                // Priority: Specific IDs/Refs -> Generic Textures

                if (obj === scene.locked_window || obj.objId === 'locked_window') type = 'locked_window';
                else if (obj === scene.diary || obj.objId === 'mother_diary') type = 'diary';
                else if (obj.memoryTrigger || obj.memoryReturn || obj.clueType || obj.documentText || obj.endingChoice) type = 'story_object';
                else if (obj === scene.safe || obj.objId === 'safe' || (obj.texture && obj.texture.key === 'safe')) type = 'safe';
                else if (obj.objId === 'dad_ghost') type = 'dad_ghost';
                else if (obj.objId === 'mom_ghost') type = 'mom_ghost';
                else if (obj.objId === 'kitchen_ghost') type = 'kitchen_ghost';
                else if (obj === scene.npc) type = 'npc';
                else if (obj === scene.chest) type = 'chest';
                else if (obj === scene.bed || (obj.texture && obj.texture.key === 'bed')) type = 'bed';
                else if (obj === scene.cabinet || (obj.texture && obj.texture.key === 'cabinet')) type = 'cabinet';
                else if (obj === scene.table && scene.currentMapId === 'room_memory') type = 'memory_table';
                else if (obj === scene.desk || (obj.texture && obj.texture.key === 'desk')) type = 'desk';
                else if (obj === scene.black_cloth) type = 'black_cloth';
                else if (obj === scene.toy_plane || (obj.texture && obj.texture.key === 'toy_plane')) type = 'toy_plane';
                else if (obj === scene.diary || (obj.texture && obj.texture.key === 'diary')) type = 'diary';
                else if (obj === scene.medical_record) type = 'medical_record';
                else if (obj === scene.wet_paper) type = 'wet_paper';
                else if (obj === scene.family_rules) type = 'family_rules';
                else if (obj === scene.sink || (obj.texture && obj.texture.key === 'kitchen_sink')) type = 'sink';
                else if (obj === scene.toilet || (obj.texture && obj.texture.key === 'toilet')) type = 'toilet';
                else if (obj === scene.mirror) type = 'mirror';
                else if (obj === scene.well || (obj.texture && obj.texture.key === 'well')) type = 'well';
                else if (obj === scene.exit_door) type = 'exit_door';
                else if (obj === scene.car || (obj.texture && obj.texture.key === 'car')) type = 'car';
                else if (obj === scene.crashed_car) type = 'crashed_car';

                // Identify groups or special properties
                else if (obj.photoId !== undefined) type = 'photo';
                else if (obj.objId === 'kitchen_cabinet' || obj.objId === 'parents_cabinet') type = 'cabinet'; // Fallback if ref check fails

                // Priority Items (Ensure we pick them up correctly even if generic loop finds them)
                if (obj === scene.dirtPile) {
                        if (!this.gameState.hasRice) type = 'dirt';
                        else type = 'generic'; // Show description if already have rice
                }
                else if (obj === scene.stove) {
                        if (!this.gameState.hasMatches) type = 'stove';
                        else type = 'generic';
                }
                else if (obj === scene.incense) {
                        if (!this.gameState.hasIncense) type = 'incense';
                        else return; // Don't interact if already picked up (usually destroyed)
                }
                else if (obj === scene.spirit_money) {
                        if (!this.gameState.hasSpiritMoney) type = 'spirit_money';
                        else return;
                }
                else if (obj === scene.red_key) {
                        if (!this.gameState.hasRedKey) type = 'red_key';
                        else return;
                }
                else if (obj === scene.altar) type = 'altar';
                else if (obj === scene.coffin) type = 'coffin';

                target = { type: type, obj: obj };
            }
        }

        if (target) {
            const names = { altar: '供桌 · 守灯仪式', coffin: '红线棺材', black_cloth: '盖布相框', cabinet: '衣柜', bed: '床 · 躲藏', safe: '保险箱', well: '井边铁钩', diary: '母亲日记', family_rules: '相框家规', medical_record: '诊断书', photo: '旧照片', incense: '香', spirit_money: '纸钱', exit_door: '离开的门', desk: '书桌', toy_plane: '纸飞机' };
            const status = inspectionStatus(this.gameState, scene.currentMapId, target);
            const label = target.type === 'black_cloth' && this.gameState.doorSlammed ? '揭开的遗像' : target.obj.objId === 'kitchen_cabinet' ? '厨房橱柜' : target.obj.interactLabel || target.obj.documentTitle || names[target.type] || '调查';
            scene.interactText.setText(`[E] ${label} · ${status}`);
            scene.interactText.setPosition(px, py - 40).setVisible(true);
            scene.currentTarget = target;
            this.drawFocus(target.obj, status);

            if (Phaser.Input.Keyboard.JustDown(scene.keyE) || Phaser.Input.Keyboard.JustDown(scene.keySpace)) {
                this.handleInteraction();
            }
        } else {
            this.clearTarget();
        }
    }

    clearTarget() {
        this.focusMarks?.clear();
        this.scene.interactText?.setVisible(false);
        this.scene.currentTarget = null;
    }

    drawFocus(obj, status) {
        if (!this.scene.add?.graphics) return;
        if (!this.focusMarks) this.focusMarks = this.scene.add.graphics().setDepth(210);
        const g = this.focusMarks;
        g.clear();
        const bounds = obj.getBounds?.() || { x: obj.x - 16, y: obj.y - 16, width: 32, height: 32 };
        const left = bounds.x - 4, top = bounds.y - 4;
        const right = left + bounds.width + 8, bottom = top + bounds.height + 8;
        g.lineStyle(1.5, status === '已调查' || status === '已记录' ? 0x8eaaa6 : 0xe3bf82, 0.9);
        for (const [x, y, dx, dy] of [[left, top, 1, 1], [right, top, -1, 1], [left, bottom, 1, -1], [right, bottom, -1, -1]]) {
            g.lineBetween(x, y, x + dx * 7, y);
            g.lineBetween(x, y, x, y + dy * 7);
        }
    }

    handleInteraction() {
        const scene = this.scene;
        if (!scene.currentTarget || window.dialogActive || scene.isSwitching || scene.isManipulating) return;
        const { type, obj } = scene.currentTarget;

        // Safety check: if object is already destroyed/inactive, ignore
        if (obj && !obj.active) {
            scene.currentTarget = null;
            return;
        }

        // --- Helper: Show Dialog Sequence ---
        const showDialogSequence = (dialogData, callback) => {
            if (Array.isArray(dialogData)) {
                const showSequence = (index) => {
                    if (index >= dialogData.length) {
                        if (callback) callback();
                        return;
                    }
                    const item = dialogData[index];
                    const speaker = item.speaker || '主角';
                    const text = item.text || item;
                    window.showDialog(speaker, text, () => showSequence(index + 1));
                };
                showSequence(0);
            } else {
                window.showDialog('主角', dialogData, callback);
            }
        };

        // --- Logic Execution Phase ---
        // This runs EITHER after the dialog is closed, OR immediately if there is no dialog.
        const executeLogic = () => {
            examineObject(this.gameState, scene.currentMapId, { type, obj });

            if (type === 'story_object') {
                if (obj.memoryTrigger) {
                    const target = obj.memoryTrigger;
                    if (obj.documentText) rememberDocument(this.gameState, scene.currentMapId, obj.documentTitle || obj.interactLabel || '旧物', obj.documentText);
                    const origin = getMemoryReturn(target.mapId);
                    const exitInfo = origin ? `\n进入后可从暂停或拼合界面暂回${Maps[origin.mapId].name}，已读线索会保留。` : '';
                    const pursuitInfo = this.gameState.isChasing ? '\n外面的追逐会在记忆中暂避，回到旧宅后恢复。' : '';
                    scene.investigationUI.confirm(Maps[target.mapId].name, `${obj.documentText || obj.dialog || '旧物里传来一段熟悉的声音。'}${exitInfo}${pursuitInfo}`, '进入这段记忆', () => {
                        scene.switchScene(target.mapId, target.x, target.y);
                    });
                    return;
                }
                const afterClue = () => {
                    if (['viewedIntro', 'viewedEntrance'].includes(obj.openingFlag)) this.gameState[obj.openingFlag] = true;
                    if (obj.memoryReturn) {
                        scene.switchScene(obj.memoryReturn.mapId, obj.memoryReturn.x, obj.memoryReturn.y);
                        return;
                    }

                    if (obj.endingChoice) {
                        this.handleEndingChoice(obj.endingChoice);
                    }
                };

                const collected = obj.clueId && obj.clueType ? this.collectClue(obj.clueId, obj.clueType) : false;
                if (collected && scene.playSound) scene.playSound(400, 'triangle', 0.4);

                if (obj.memoryComplete) {
                    if (obj.documentText) rememberDocument(this.gameState, scene.currentMapId, obj.documentTitle || obj.interactLabel || '记忆里的记录', obj.documentText);
                    scene.investigationUI.memoryClue(obj);
                } else if (obj.documentText) {
                    window.showDocument(obj.documentTitle || '线索', obj.documentText);
                    afterClue();
                } else {
                    afterClue();
                }
                return;
            }

            // 1. Memory Room
            if (type === 'memory_table' || (scene.currentMapId === 'room_memory' && (type === 'dad_ghost' || type === 'mom_ghost'))) {
                scene.investigationUI.modal('一桌凉掉的饭', `父亲把椅子拉开：“这次不许再走。”
母亲的声音从门后传来：“明儿，你可以自己决定。”
椅背的红线，和棺材上的是同一根。`, [
                    { label: '推开椅子，走向门外', run: () => {
                        scene.investigationUI.close();
                        this.handleEndingChoice('leave');
                    } },
                    { label: '坐下，留在这段记忆里', run: () => {
                        scene.investigationUI.close();
                        scene.investigationUI.confirm('红线重新收紧', '你会留下，成为每天等在这张桌边的人。确定把门关上吗？', '我决定留下', () => {
                            window.showEndingScreen('结局：永远在一起', '门在身后合上。第二天，饭仍是凉的。你终于明白，这个家从未学会告别。', () => scene.scene.start('TitleScene'));
                        });
                    } },
                    { label: '先看看屋子', run: () => scene.investigationUI.close() }
                ]);
                return;
            }

            // 2. Functional Items
            if (type === 'cabinet') {
                // Safety check for parents cabinet if ID is missing but it matches the object
                if (!obj.objId && scene.currentMapId === 'room_bedroom_parents' && obj === scene.cabinet) {
                    obj.objId = 'parents_cabinet';
                }

                if (obj.objId === 'kitchen_cabinet') {
                    this.inspectSupply(obj, Maps.room_kitchen.objects.cabinet.supply, () => scene.eventManager?.triggerPaperDollEvent());
                    return;
                } else if (obj.objId === 'parents_cabinet') {
                    if (!this.gameState.cabinetMoved) {
                        const record = Maps.room_bedroom_parents.objects.cabinet;
                        scene.investigationUI.modal('贴着东墙的衣柜', '木柜沉重，柜脚下的灰却被擦掉了两道。你想先看看，还是试着挪动？', [
                            { label: '俯身查看柜脚', run: () => {
                                scene.investigationUI.close();
                                window.showDocument(record.observationTitle, record.observationText);
                            } },
                            { label: '向左挪一掌', run: () => { scene.investigationUI.close(); this.moveParentsCabinet(obj); } },
                            { label: '试着向右挪', run: () => { scene.investigationUI.el('case-feedback').textContent = '柜脚抵着东墙，挪不动。先看看地上留下的痕迹。'; } },
                            { label: '先离开', run: () => scene.investigationUI.close() }
                        ]);
                    } else {
                        window.showDialog('主角', '暗门已经打开了。');
                    }
                    return;
                } else {
                     scene.toggleHide();
                }
                return;
            }

            if (type === 'desk' && scene.currentMapId === 'room_secret') {
                this.inspectSupply(obj, Maps.room_secret.objects.desk.supply);
                return;
            }

            if (type === 'bed') {
                // If it's my bed, maybe hide?
                if (scene.currentMapId === 'room_bedroom_me') {
                     scene.toggleHide();
                } else {
                     scene.toggleHide();
                }
                return;
            }

            if (type === 'diary') {
                this.collectClue('diary_mother', 'illness');
                const record = Maps[scene.currentMapId].objects.diary;
                scene.triggerFlashback('diary');
                if (!this.gameState.clues.includes('diary')) this.gameState.clues.push('diary');
                window.showDocument(record.documentTitle, record.documentText);
                return;
            }

            if (type === 'medical_record') {
                 this.collectClue('medical_record', 'illness');
                 if (!this.gameState.clues.includes('meds')) this.gameState.clues.push('meds');
                 const record = Maps[scene.currentMapId].objects.medical_record;
                 window.showDocument(record.documentTitle, record.documentText);
                 return;
            }

            if (type === 'family_rules') {
                this.collectClue('family_rules', 'control');
                const record = Maps[scene.currentMapId].objects.family_rules;
                window.showDocument(record.documentTitle, record.documentText);
                return;
            }

            if (type === 'sink') {
                window.showDialog('主角', '满是水垢的水槽...仿佛很久没人用过了。');
                return;
            }

            if (type === 'safe') {
                if (this.gameState.inventory.includes('地下室钥匙')) {
                    window.showDialog('主角', '保险箱已经打开了，里面空空如也。');
                    return;
                }

                scene.investigationUI.unlockSafe(() => {
                    if (this.gameState.inventory.includes('地下室钥匙')) return;
                    this.gameState.inventory.push('地下室钥匙');
                    window.updateInventory('地下室钥匙');
                    scene.safe?.setTexture('safe_open');
                    scene.playSound(1000, 'sine', 1);
                    window.showDialog('李明', '锁舌松开了。箱里只有一把地下室钥匙，齿缝里沾着旧灰。');
                });
                return;
            }

            if (type === 'wet_paper') {
                const record = Maps[scene.currentMapId].objects.wet_paper;
                window.showDocument(record.documentTitle, record.documentText);
                return;
            }

            if (type === 'red_key') {
                scene.red_key.destroy();
                scene.red_key = null;
                this.gameState.hasRedKey = true;
                this.collectClue('red_key', 'death');
                window.updateInventory('血红钥匙');
                scene.playSound(600, 'triangle', 0.5);
                window.showDialog('主角', '你捡起了那把【血红钥匙】...上面还沾着未干的血迹。', () => {
                    if (!this.gameState.isChasing) {
                        this.gameState.isChasing = true;
                        scene.spawnChaser();
                        window.showDialog('主角', '（周围的温度突然降低了...有什么东西来了！）');
                    }
                });
                return;
            }

            if (type === 'toy_plane') {
                this.collectClue('toy_plane', 'death');
                if (!this.gameState.clues.includes('plane')) this.gameState.clues.push('plane');
                return;
            }

            if (type === 'locked_window') {
                this.collectClue('locked_window', 'control');
                if (!this.gameState.clues.includes('window')) this.gameState.clues.push('window');
                const record = Maps[scene.currentMapId].objects.locked_window;
                window.showDocument(record.documentTitle, record.documentText);
                return;
            }

            if (type === 'exit_door') {
                scene.investigationUI.confirm('门外的雨', '现在离开，将结束这次回家。还未拼合的记忆会留在老宅里。', '推门离开', () => {
                    if (scene.currentMapId === 'room_memory') { this.handleEndingChoice('leave'); return; }
                    const truthLevel = this.getTruthLevel();
                    const deductions = ensureInvestigation(this.gameState).deductions;
                    if (truthLevel === 'complete' && deductions.school && deductions.hospital) {
                        scene.switchScene('memory_crash', 120, 200);
                    } else {
                        const family = truthLevel !== 'surface';
                        window.showEndingScreen(family ? '结局：回煞' : '结局：破茧', family ? '你知道这个家如何伤害了彼此，却还没有认出雨夜里的自己。远处的门铃，又响了一次。' : '你走出了那扇门。没有得到所有答案，也没有再向谁请求离开的许可。', () => scene.scene.start('TitleScene'));
                    }
                });
                return;
            }

            if (type === 'npc') {
                if (this.gameState.storyStep === 0) {
                    this.gameState.storyStep = 1;
                }
                return;
            }

            if (type === 'incense') {
                 if (this.gameState.hasIncense) return;
                 this.gameState.hasIncense = true;
                 window.updateInventory('香');
                 if (scene.incense) { scene.incense.destroy(); scene.incense = null; }
                 scene.playSound(400, 'triangle', 0.5);
                 return;
            }

            if (type === 'spirit_money') {
                 if (this.gameState.hasSpiritMoney) return;
                 this.gameState.hasSpiritMoney = true;
                 window.updateInventory('纸钱');
                 if (scene.spirit_money) { scene.spirit_money.destroy(); scene.spirit_money = null; }
                 scene.playSound(400, 'triangle', 0.5);
                 return;
            }

            if (type === 'altar') {
                if (this.gameState.candlesLit) {
                    window.showDialog('李明', '灯还亮着。这不是把人留下的仪式，是让他能认清回去的路。');
                    return;
                }
                scene.investigationUI.ritual(() => {
                    scene.playSound(600, 'sine', 1);
                    this.gameState.candlesLit = true;
                    ensureInvestigation(this.gameState).ritualStep = 3;
                    ManorPresentation.syncRitual(scene, 3);
                    ManorPresentation.syncCoffin(scene);
                    window.showDialog('李明', '纸灰落进盆底，南门的门闩松了。烛火没有灭，棺材里的声音却叫着我的名字。旧书房和药柜小间，还留着家里没说完的话。');
                    // A lit lamp releases the latch, keeping the early-exit choice reachable.
                    scene.doors.getChildren().forEach(door => {
                        if (door.targetMap === 'room_entrance') door.locked = false;
                    });
                });
                return;
            }

            if (type === 'coffin') {
                this.inspectCoffin();
                return;
            }

            if (type === 'photo') {
                const photo = obj;
                if (!this.gameState.viewedPhotos.includes(photo.photoId)) this.gameState.viewedPhotos.push(photo.photoId);
                window.showDocument(photo.documentTitle || `走廊旧照 · ${photo.photoId}`, photo.dialogText || '相片已经褪色。');
                return;
            }

            if (type === 'black_cloth') {
                const record = Maps.room_main.objects.black_cloth;
                const rules = Maps.room_main.objects.interactables.find(item => item.id === 'ritual_note');
                const remember = source => {
                    const notes = ensureInvestigation(this.gameState).notes;
                    const existing = notes.find(note => note.title === source.documentTitle);
                    if (existing) existing.content = source.documentText;
                    rememberDocument(this.gameState, scene.currentMapId, source.documentTitle, source.documentText);
                };
                if (this.gameState.doorSlammed) {
                    // Older saves already saw the portrait; restore its factual records
                    // from the same sources as world reading, without replaying the latch.
                    remember(record);
                    remember(rules);
                    scene.investigationUI.modal('揭开的遗像', '黑布已放在相框脚边。背面的名字和守灯纸条都记在手记里，可以再对照。', [
                        { label: '回看遗像与背面', run: () => { scene.investigationUI.close(); window.showDocument(record.documentTitle, record.documentText); } },
                        { label: '查看守灯纸条', run: () => { scene.investigationUI.close(); window.showDocument(rules.documentTitle, rules.documentText); } },
                        { label: '先离开供桌', run: () => scene.investigationUI.close() }
                    ]);
                } else {
                    scene.investigationUI.modal('盖着黑布的相框', '布角垂在供桌边，露出半截旧纸。你可以先看一看，也可以把布掀开。', [
                        { label: '查看布角和纸角', run: () => { scene.investigationUI.close(); window.showDocument(record.observationTitle, record.observationText); } },
                        { label: '揭开黑布', run: () => {
                            if (this.gameState.doorSlammed) return;
                            scene.investigationUI.close();
                            this.gameState.doorSlammed = true;
                            obj.setTexture('portrait_father');
                            remember(record);
                            remember(rules);
                            const door = scene.doors.getChildren().find(item => item.targetMap === 'room_entrance');
                            if (door) door.locked = !this.gameState.candlesLit;
                            scene.playSound(140, 'triangle', 0.18);
                            window.showDialog('李明', `是父亲的遗像。相框背面写着“李明收”……谁把它留给了我？守灯纸条也夹在这里，先收好。${this.gameState.candlesLit ? '南门的门闩仍然松着。' : '身后传来门闩落下的声音，南门合上了。'}`);
                        } },
                        { label: '先不揭开', run: () => scene.investigationUI.close() }
                    ]);
                }
                return;
            }

            /*
            // Merged into Memory Room Logic above
            if (type === 'dad_ghost') {
                window.showDialog('父亲的虚影', '...不听话...打死你...不听话...', () => {
                     window.showDialog('主角', '（颤抖）这是...爸爸？可是他的脸...为什么是一张白纸？');
                });
                return;
            }

            if (type === 'mom_ghost') {
                 window.showDialog('母亲的虚影', '...我的孩子...乖...吃药...吃了药就不痛了...', () => {
                     window.showDialog('主角', '（恐惧）那是妈妈的声音...她在给谁吃药？');
                });
                return;
            }
            */

            if (type === 'kitchen_ghost') {
                window.showDialog('奇怪的纸人', '（空洞的声音）...饿...好饿...给我饭...', () => {
                    if (this.scene.gameState.hasRice) {
                        window.showDialog('主角', '这就是你要的饭吗？（似乎需要把饭放在某个地方）');
                    } else {
                        window.showDialog('主角', '这个纸人...它的嘴是用红笔画的，好像在流血。');
                    }
                });
                return;
            }

            if (type === 'chest') {
                 if (!this.gameState.hasRice || !this.gameState.hasMatches || !this.gameState.hasIncense || !this.gameState.hasSpiritMoney || !this.gameState.hasRedKey) {
                     window.showDialog('主角', '你发现了【开发者宝箱】！获得了：倒头饭、火柴、香、纸钱、血红钥匙。', () => {
                         this.gameState.hasRice = true;
                         this.gameState.hasMatches = true;
                         this.gameState.hasIncense = true;
                         this.gameState.hasSpiritMoney = true;
                         this.gameState.hasRedKey = true;
                         window.updateInventory('倒头饭');
                         window.updateInventory('火柴');
                         window.updateInventory('香');
                         window.updateInventory('纸钱');
                         window.updateInventory('血红钥匙');
                         scene.playSound(400, 'triangle', 0.5);
                     });
                 }
                 return;
            }

            if (type === 'well') {
                if (this.gameState.hasRedKey) {
                    window.showDialog('李明', '铁钩空了。钩尖上新添了一道亮痕，石板和符纸还在原处。');
                    return;
                }
                const record = Maps.room_backyard.objects.well;
                scene.investigationUI.modal('井沿的铁钩', '红钥匙挂在外侧的锈钩上，钥匙环抵着钩尖。井口的石板不用搬动。', [
                    { label: '查看铁钩和锈痕', run: () => {
                        scene.investigationUI.close();
                        window.showDocument(record.observationTitle, record.observationText);
                    } },
                    { label: '抬高钥匙环，再向井外移', run: () => {
                        scene.investigationUI.confirm('越过钩尖', `钥匙环可以从上方脱出。井里传来父亲的声音：“拿了它，就别想出门。”
取走钥匙会引来追逐。先记住卧室的床和衣柜：Shift 能奔跑，E 能躲藏，安静藏好 6 秒可以甩掉黑影。`, '取下钥匙，准备离开', () => {
                            if (this.gameState.hasRedKey) return;
                            this.gameState.hasRedKey = true;
                            obj.setTexture('well_empty');
                            this.collectClue('well_red_key', 'death');
                            window.updateInventory('血红钥匙');
                            window.showDialog('李明', '钥匙环越过钩尖，滑进手心。上面刻着我的名字。屋里的脚步声停了——它发现我了。', () => {
                                this.gameState.isChasing = true;
                                scene.playSound(80, 'sine', 0.8);
                                scene.spawnChaser();
                            });
                        });
                    } },
                    { label: '试着径直向下拉', run: () => {
                        scene.investigationUI.el('case-feedback').textContent = '钥匙环抵住向上的钩尖，拉不下来。我松了手，钥匙还挂在原处；看看锈层上的亮痕。';
                    } },
                    { label: '先离开井边', run: () => scene.investigationUI.close() }
                ]);
                return;
            }

        };

        // --- Execution Strategy ---
        // If obj has dialog, show it first. Then execute logic.
        // Unless it's a type where logic overrides dialog flow (like Memory Table which handles its own dialogs).

        if (type === 'memory_table' || (type === 'story_object' && obj.memoryTrigger)) {
            executeLogic(); // Handles its own dialogs
        } else if (obj.dialog) {
            showDialogSequence(obj.dialog, executeLogic);
        } else {
            executeLogic();
        }
    }

    inspectCoffin() {
        const scene = this.scene, state = this.gameState;
        const record = Maps.room_main.objects.coffin;
        const deductions = ensureInvestigation(state).deductions;
        const description = `${record.observationText}\n\n${deductions.school ? '上端的红线垂了下来，方格纸上的红笔痕还在。' : '上端红线绷得很紧，死结压住了方格纸。'}\n${state.candlesLit ? '中间那圈已经松开，结上沾着一点纸灰。' : '中间那圈仍拉紧着，线头朝向供桌。'}\n${deductions.hospital ? '下端的红线松了，蓝边纸从结里露出一角。' : '下端红线仍勒着蓝边纸，结口没有松动。'}`;
        let opening = false;
        scene.investigationUI.modal('棺锁与红线', description, [
            { label: '记下锁与纸片的痕迹', run: () => {
                scene.investigationUI.close();
                window.showDocument(record.observationTitle, description);
            } },
            { label: state.hasRedKey ? '用钥匙试开棺盖' : '试着抬动棺盖', run: () => {
                if (opening) return;
                const feedback = scene.investigationUI.el('case-feedback');
                if (!state.hasRedKey) { feedback.textContent = '棺盖被旧锁扣着。先找与锁孔相配的钥匙，不能硬抬。'; return; }
                if (!state.candlesLit) { feedback.textContent = '钥匙插得进，中间那圈红线却仍绷紧。供桌旁的守灯纸条也许写着办法。'; return; }
                const current = ensureInvestigation(state).deductions;
                if (!current.school || !current.hospital) {
                    feedback.textContent = `锁舌动了一点，棺盖还被${!current.school && !current.hospital ? '上、下两处死结' : !current.school ? '上端的死结' : '下端的死结'}拴着。再看看结里夹着的纸片，哪些旧物还留着同样的痕迹？`;
                    return;
                }
                scene.investigationUI.confirm('红线已经松开', '旧锁是最后一道阻碍。打开棺盖会走进最后一段记忆；也可以放下钥匙，先继续调查老宅。', '打开棺盖，继续追忆', () => {
                    if (opening) return;
                    opening = true;
                    this.collectClue('coffin_truth', 'death');
                    scene.playSound(160, 'triangle', 0.25);
                    window.showDialog('李明', '锁舌转过了半圈，松掉的红线滑到棺沿。我认得这把旧锁——小时候，玩具箱上用的就是它。', () => scene.triggerRealEnding());
                });
            } },
            { label: '先离开棺边', run: () => scene.investigationUI.close() }
        ]);
    }

    inspectSupply(obj, supply, afterTaken) {
        const scene = this.scene;
        if (this.gameState[supply.flag]) {
            obj.setTexture(supply.emptyTexture);
            window.showDialog('李明', supply.emptyText);
            return;
        }
        let finished = false;
        scene.investigationUI.modal(supply.title, supply.text, [
            { label: `拿走${supply.name}`, run: () => {
                if (finished || this.gameState[supply.flag]) return;
                finished = true;
                this.gameState[supply.flag] = true;
                obj.setTexture(supply.emptyTexture);
                window.updateInventory(supply.name);
                scene.investigationUI.close();
                scene.playSound(400, 'triangle', 0.5);
                window.showDialog('李明', supply.takenText, afterTaken);
            } },
            { label: '先留在原处', run: () => { finished = true; scene.investigationUI.close(); } }
        ]);
    }

    moveParentsCabinet(obj) {
        const scene = this.scene;
        if (this.gameState.cabinetMoved || scene.isManipulating) return;
        const targetX = Maps.room_bedroom_parents.objects.cabinet.x - 32;
        const w = obj.displayWidth, h = obj.displayHeight;
        const left = targetX - w * 0.4, top = obj.y + h * 0.2;
        const player = scene.player.sprite.body;
        if (player && player.x < left + w * 0.8 && player.x + player.width > left && player.y < top + h * 0.3 && player.y + player.height > top) {
            window.showDialog('李明', '我还站在柜脚要经过的地方，得先退开一点。');
            return;
        }
        scene.isManipulating = true;
        scene.player.sprite.setVelocity(0);
        scene.physics.pause();
        this.clearTarget();
        scene.tweens.add({
            targets: obj, x: targetX, duration: 650, ease: 'Sine.easeInOut',
            onUpdate: () => MapManager.syncCabinetBody(obj),
            onComplete: () => {
                MapManager.syncCabinetBody(obj);
                this.gameState.cabinetMoved = true;
                scene.isManipulating = false;
                ManorPresentation.syncSecretDoor(scene);
                scene.physics.resume();
                scene.playSound(160, 'triangle', 0.2);
                window.showDialog('李明', '柜脚正好停在旧擦痕的尽头。后面露出一扇窄门，冷风从门缝里透出来。');
            }
        });
    }

    handleEndingChoice(choice) {
        const scene = this.scene;
        const data = ensureInvestigation(this.gameState);
        if (!data.deductions.death && scene.currentMapId === 'memory_crash') {
            scene.investigationUI.solve('death', () => this.handleEndingChoice(choice));
            return;
        }
        scene.investigationUI.confirm(choice === 'leave' ? '走向山路' : '再看一眼老宅', choice === 'leave' ? '认清那场事故，也承认自己曾想离开。你无需先原谅谁，才有资格告别。' : '门里有一桌熟悉的饭。你仍然可以在最后一刻选择离开。', choice === 'leave' ? '这一次，我自己走' : '回到餐桌旁', () => {
            this.ensureStoryFlags().endingChoice = choice;
            if (choice === 'return') { scene.switchScene('room_memory', 320, 400); return; }
            scene.physics.pause();
            window.showEndingScreen('结局：归路', '十年前，你没能走出那个雨夜。这一次，你把名字留给自己，把责任还给大人。天亮以前，雨停了。', () => scene.scene.start('TitleScene'));
        });
    }
}
