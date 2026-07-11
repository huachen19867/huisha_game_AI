import { collectClue, ensureStoryFlags, getTruthLevel, reconcileFamilyPhoto } from './StoryState.js';
import { syncStaticBody } from './PhysicsSync.js';
import { Puzzles, canStartPuzzle } from '../data/Puzzles.js';

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
        return collectClue(this.gameState, clueId, clueType);
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
        if (Date.now() - (window.lastDialogCloseTime || 0) < 500) return;

        let target = null;
        const px = this.scene.player.sprite.x;
        const py = this.scene.player.sprite.y;
        const scene = this.scene;

        // Interaction distance threshold
        const INTERACT_DIST = 80;

        // --- 1. Priority Interactions (Logic Heavy / Conditional) ---
        // These are objects that might NOT be in the generic loop or need special conditions

        if (scene.npc && scene.npc.visible) {
            if (this.getDistanceToObj(px, py, scene.npc) < 100) target = { type: 'npc', obj: scene.npc };
        }

        // --- 2. Generic Interactions (Everything in interactables group) ---
        // MapManager adds almost everything to scene.interactables
        if (!target && scene.interactables) {
            let closestDist = Infinity;
            let closestObj = null;

            scene.interactables.getChildren().forEach(obj => {
                // If object is hidden/disabled, skip
                if (!obj.active || (obj.visible === false)) return;

                const dist = this.getDistanceToObj(px, py, obj);

                // Adjust threshold based on object type if needed
                let threshold = INTERACT_DIST;
                if (obj.texture && obj.texture.key === 'car') threshold = 120; // Bigger reach for cars
                if (obj.objId === 'parents_cabinet') threshold = 100; // Easier access for secret room
                if (obj.texture && obj.texture.key === 'toy_plane') threshold = 40; // Harder to accidentally click
                if (obj.texture && obj.texture.key === 'well') threshold = 100; // Easier access for well
                if (obj.objId === 'dad_ghost' || obj.objId === 'mom_ghost' || obj.objId === 'kitchen_ghost') threshold = 120; // Increased reach
                if (obj === scene.safe || obj.objId === 'safe' || (obj.texture && obj.texture.key === 'safe')) threshold = 120; // Increased reach for safe
                if (obj === scene.family_rules) threshold = 80; // Reset to normal range now that it has body


                if (dist < threshold) {
                    if (dist < closestDist) {
                        closestDist = dist;
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

                if (obj.puzzleId || obj.itemGrant || obj.memoryTrigger || obj.memoryReturn || obj.clueType || obj.documentText || obj.endingChoice) type = 'story_object';
                else if (obj === scene.safe || obj.objId === 'safe' || (obj.texture && obj.texture.key === 'safe')) type = 'safe';
                else if (obj.objId === 'dad_ghost') type = 'dad_ghost';
                else if (obj.objId === 'mom_ghost') type = 'mom_ghost';
                else if (obj.objId === 'kitchen_ghost') type = 'kitchen_ghost';
                else if (obj === scene.chest) type = 'chest';
                else if (obj === scene.bed || (obj.texture && obj.texture.key === 'bed')) type = 'bed';
                else if (obj === scene.cabinet || (obj.texture && obj.texture.key === 'cabinet')) type = 'cabinet';
                else if (obj === scene.table && scene.currentMapId === 'room_memory') type = 'memory_table';
                else if (obj === scene.desk || (obj.texture && obj.texture.key === 'desk')) type = 'desk';
                else if (obj === scene.black_cloth) type = 'black_cloth';
                else if (obj === scene.toy_plane || (obj.texture && obj.texture.key === 'toy_plane')) type = 'toy_plane';
                else if (obj === scene.locked_window) type = 'locked_window';
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
            scene.interactText.setPosition(px, py - 40).setVisible(true);
            scene.currentTarget = target;

            if (Phaser.Input.Keyboard.JustDown(scene.keyE) || Phaser.Input.Keyboard.JustDown(scene.keySpace)) {
                this.handleInteraction();
            }
        } else {
            scene.interactText.setVisible(false);
            scene.currentTarget = null;
        }
    }

    handleInteraction() {
        const scene = this.scene;
        if (!scene.currentTarget) return;
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

            if (type === 'story_object') {
                if (obj.itemGrant === 'family_photo_corner') {
                    const flags = this.ensureStoryFlags();
                    if (!flags.familyPhotoCornerFound) {
                        flags.familyPhotoCornerFound = true;
                        window.updateInventory('全家福缺角');
                        if (reconcileFamilyPhoto(this.gameState)) window.replaceInventoryItem('残缺全家福', '完整全家福');
                        scene.refreshObjective();
                    }
                    return;
                }

                if (obj.puzzleId) {
                    const flags = this.ensureStoryFlags();
                    const puzzle = Puzzles[obj.puzzleId];
                    if (!canStartPuzzle(puzzle, flags.collectedClues)) {
                        window.showDialog('主角', '先调查这段记忆中的另外两件证据。');
                        return;
                    }
                    window.showPuzzle(puzzle, () => {
                        const collected = obj.clueId && obj.clueType ? this.collectClue(obj.clueId, obj.clueType) : false;
                        if (collected && scene.playSound) scene.playSound(400, 'triangle', 0.4);
                        flags.puzzles[obj.puzzleId] = true;
                        flags.memories[obj.puzzleId] = true;
                        scene.refreshObjective();
                        window.showDialog('主角', puzzle.successText, () => {
                            if (obj.memoryReturn) scene.switchScene(obj.memoryReturn.mapId, obj.memoryReturn.x, obj.memoryReturn.y);
                        });
                    });
                    return;
                }

                const afterClue = () => {
                    if (obj.memoryComplete) {
                        const flags = this.ensureStoryFlags();
                        flags.memories[obj.memoryComplete] = true;
                    }

                    if (obj.memoryTrigger) {
                        scene.switchScene(obj.memoryTrigger.mapId, obj.memoryTrigger.x, obj.memoryTrigger.y);
                        return;
                    }

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

                if (obj.documentText) {
                    window.showDocument(obj.documentTitle || '线索', obj.documentText);
                    afterClue();
                } else {
                    afterClue();
                }
                return;
            }

            // 1. Memory Room
            if (type === 'memory_table' || (scene.currentMapId === 'room_memory' && (type === 'dad_ghost' || type === 'mom_ghost'))) {
                 // Hardcoded sequence for ending
                window.showDialog('父亲的幻影', '（跪在地上，对着空气痛哭）明儿...我的明儿...是爸对不起你...那天我不该骂你...如果不把你锁起来...你就不会偷偷跑出去...就不会出车祸...', () => {
                    scene.time.delayedCall(1000, () => {
                        window.showDialog('母亲', '（温柔地出现）明儿，饭菜都凉了。快来吃吧，我们一家人，终于团聚了。', () => {
                            scene.cameras.main.shake(1000, 0.005);
                            window.showDialog('主角', '爸，妈...其实我一直都知道。那场车祸...十年前就已经发生了。我早就该走了。', () => {
                                window.showDialog('父亲', '（紧紧抓住主角的手）不！明儿，别走！我们已经错过了十年...剩下的时间，我们要永远在一起！', () => {
                                    window.showDialog('主角', '（含泪微笑）好...我不走。我们永远不分开。', () => {
                                        scene.cameras.main.fadeOut(4000, 255, 255, 255);
                                        scene.time.delayedCall(4000, () => {
                                             window.showEndingScreen('结局：永远在一起', '在那个没有痛苦、没有分离的世界里，你们永远在一起。', () => {
                                                 window.location.reload();
                                             });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
                return;
            }

            // 2. Functional Items
            if (type === 'cabinet') {
                // Safety check for parents cabinet if ID is missing but it matches the object
                if (!obj.objId && scene.currentMapId === 'room_bedroom_parents' && obj === scene.cabinet) {
                    obj.objId = 'parents_cabinet';
                }

                if (obj.objId === 'kitchen_cabinet') {
                    if (!this.gameState.hasRice) {
                        this.gameState.hasRice = true;
                        window.updateInventory('倒头饭');
                        scene.playSound(400, 'triangle', 0.5);
                        window.showDialog('主角', '柜子里有一碗发馊的饭...这是给死人的供品。你获得了【倒头饭】。', () => {
                            if (scene.eventManager) scene.eventManager.triggerPaperDollEvent();
                        });
                    } else {
                        window.showDialog('主角', '柜子已经空了。');
                    }
                    return;
                } else if (obj.objId === 'parents_cabinet') {
                    if (!this.gameState.cabinetMoved) {
                        window.showDialog('主角', '这个柜子后面...有风？好像可以推开。', () => {
                            scene.tweens.add({
                                targets: obj,
                                x: obj.x - 32,
                                duration: 1000,
                                ease: 'Power2',
                                onComplete: () => {
                                    syncStaticBody(obj);
                                    this.gameState.cabinetMoved = true;
                                    if (scene.soundManager) scene.soundManager.playNoise(1.0);

                                    if (scene.doors) {
                                        scene.doors.getChildren().forEach(door => {
                                            if (door.targetMap === 'room_secret') {
                                                door.body.enable = true;
                                                door.visible = true;
                                                console.log("Secret door unlocked!");
                                            }
                                        });
                                    }
                                    window.showDialog('主角', '果然...这里有个暗门。');
                                }
                            });
                        });
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
                if (!this.gameState.hasMatches) {
                     window.showDialog('主角', '工作台上有一盒火柴。', () => {
                          this.gameState.hasMatches = true;
                          window.updateInventory('火柴');
                          scene.playSound(400, 'triangle', 0.5);
                          window.showDialog('主角', '找到了一盒【火柴】。');
                     });
                } else {
                     window.showDialog('主角', '这里有些关于木偶制作的笔记："心中的鬼，要用木偶封印..."');
                }
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
                const diaryContent = `
七月十四日，阴。
今天是明儿的忌日。
我总觉得他还在这个家里。
每天晚上，我都能听到走廊里有脚步声。
不是老鼠，是孩子跑跳的声音。
他最喜欢玩捉迷藏了。
可是...那场车祸带走了他，也带走了我的魂。
那个"疯子"（此处被涂黑）又喝醉了，他说听到了儿子的哭声。
我也听到了。
明儿，是你回来了吗？
如果是你，带妈妈走吧。
`;
                scene.triggerFlashback('diary');
                if (!this.gameState.clues.includes('diary')) this.gameState.clues.push('diary');
                window.showDocument('残破的日记', diaryContent);
                return;
            }

            if (type === 'medical_record') {
                 this.collectClue('medical_record', 'illness');
                 if (!this.gameState.clues.includes('meds')) this.gameState.clues.push('meds');
                 window.showDocument('诊断书', '姓名：王秀兰。\n诊断：重度抑郁，伴精神分裂样症状。\n建议：规律服药，避免刺激，必要时住院观察。\n背面写着一行潦草的字：他把药藏起来了。');
                 return;
            }

            if (type === 'family_rules') {
                this.collectClue('family_rules', 'control');
                window.showDialog('主角', '这好像是一张家规...', () => {
                    window.showDialog('家规', '一、吃饭不许说话。\n二、晚上十点前必须回家。\n三、不许顶撞长辈。\n四、即使我们不在了，也要听话...', () => {
                        window.showDialog('主角', '（翻过相框）相框背面写着一串数字：1988。');
                    });
                });
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

                window.showSafeUI(() => {
                    scene.playSound(1000, 'sine', 1);
                    window.showDialog('主角', '密码正确！保险箱打开了。', () => {
                        window.showDialog('主角', '里面只有一把冰冷的【地下室钥匙】。', () => {
                            window.updateInventory('地下室钥匙');
                            this.gameState.inventory.push('地下室钥匙');
                        });
                    });
                });
                return;
            }

            if (type === 'wet_paper') {
                window.showDocument('湿纸条', '...1988年...那是我噩梦开始的一年...（后面的字迹模糊不清）');
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
                        this.ensureStoryFlags().chasePhase = 'active';
                        scene.chaseManager.start();
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
                window.showDialog('主角', '窗户从外面被钉死了。钉子很新，像是有人怕我再一次从这里逃出去。');
                return;
            }

            if (type === 'exit_door') {
                 const truthLevel = this.getTruthLevel();
                 if (truthLevel === 'complete') {
                     window.showDialog('主角', '我已经想起来了。真正的出口不在这扇门外，而在那条雨夜公路上。', () => {
                         scene.switchScene('memory_crash', 120, 200);
                     });
                 } else if (truthLevel === 'family') {
                     window.showDialog('主角', '我终于明白了这个家为什么会变成这样。可还有什么东西被压在棺材里，没有说完。', () => {
                         scene.cameras.main.fadeOut(3000, 120, 0, 0);
                         scene.time.delayedCall(3000, () => {
                             window.showEndingScreen('结局：回煞', '你看见了父亲的控制，也看见了母亲的病。可你仍把最深的真相留在雨夜里，任它一遍遍回到这座宅子。', () => {
                                scene.scene.start('TitleScene');
                                window.globalGameState = null;
                             });
                         });
                     });
                 } else {
                     window.showDialog('主角', '（回头看了一眼）...爸，妈，再见了。我要去过我自己的生活了。', () => {
                        scene.cameras.main.fadeOut(3000, 255, 255, 255);
                        scene.time.delayedCall(3000, () => {
                             window.showEndingScreen('结局：破茧', '你离开了那个家，再也没有回头。', () => {
                                scene.scene.start('TitleScene');
                                window.globalGameState = null;
                             });
                        });
                    });
                 }
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
                const flags = this.ensureStoryFlags();
                if (flags.chasePhase === 'active' && flags.familyPhotoAssembled) {
                    scene.chaseManager.escape('photo');
                    return;
                }
                if (this.gameState.hasRice && this.gameState.hasMatches && this.gameState.hasIncense && this.gameState.hasSpiritMoney) {
                    scene.leftCandle.setAlpha(1);
                    scene.rightCandle.setAlpha(1);
                    scene.lights.addLight(scene.leftCandle.x, scene.leftCandle.y, 100).setColor(0xffaa00).setIntensity(1.5);
                    scene.lights.addLight(scene.rightCandle.x, scene.rightCandle.y, 100).setColor(0xffaa00).setIntensity(1.5);
                    scene.playSound(600, 'sine', 1);
                    this.gameState.candlesLit = true;

                    window.showDialog('主角', '（你摆上了倒头饭，点燃了香和蜡烛，烧了纸钱。火苗诡异地跳动了一下。）', () => {
                        scene.time.delayedCall(500, () => {
                            scene.cameras.main.shake(500, 0.02);
                            scene.playSound(100, 'sawtooth', 3);
                            window.showDialog('主角', '蜡烛点燃了。火光摇曳中，我仿佛看到遗像上的人在笑...那是...我吗？这声音...是从棺材里传出来的？！');
                        });
                    });
                } else {
                    let missing = [];
                    if (!this.gameState.hasRice) missing.push('倒头饭');
                    if (!this.gameState.hasMatches) missing.push('火柴');
                    if (!this.gameState.hasIncense) missing.push('香');
                    if (!this.gameState.hasSpiritMoney) missing.push('纸钱');

                    window.showDialog('主角', `供桌上的遗像被黑布遮住了...香炉也是空的。好像在等待供奉。还缺：${missing.join('、')}。`);
                }
                return;
            }

            if (type === 'coffin') {
                if (this.gameState.hasRedKey) {
                    if (this.gameState.candlesLit) {
                        this.collectClue('coffin_truth', 'death');
                        window.showDialog('主角', '钥匙插进去了。这把锁...是我小时候藏玩具箱用的那把。真相就在里面。', () => {
                            scene.playSound(100, 'sawtooth', 2);
                            scene.triggerRealEnding();
                        });
                    } else {
                        window.showDialog('主角', '我有钥匙，但棺材周围的怨气太重了...上面的符咒还在闪烁。也许我应该先去供桌那边做点什么，平息亡魂的怨气。');
                    }
                } else if (scene.leftCandle && scene.leftCandle.alpha === 1) {
                     window.showDialog('棺材里的声音', '（咚！咚！咚！）放我出去...那个逆子...那个疯婆娘...把门打开！放我出去！', () => {
                         window.showDialog('主角', '（惊恐）是父亲的声音！他...他没死？可是棺材盖上钉着七颗长钉，还缠着红线...这是在镇压什么？');
                     });
                } else {
                    // Default dialog is shown, no extra logic needed if candle not lit
                }
                return;
            }

            if (type === 'photo') {
                const photo = scene.currentTarget.obj;
                if (!this.gameState.viewedPhotos.includes(photo.photoId)) {
                    this.gameState.viewedPhotos.push(photo.photoId);
                    scene.playSound(400, 'triangle', 0.5);

                    // Show dialog with photo content
                    if (photo.dialogText) {
                         window.showDialog('旧照片', photo.dialogText);
                    }

                    scene.cameras.main.shake(100, 0.005);

                    if (this.gameState.viewedPhotos.length >= 4 && !this.gameState.corridorSolved) {
                        this.gameState.corridorSolved = true;
                        const flags = this.ensureStoryFlags();
                        flags.photoSetCollected = true;
                        window.updateInventory('残缺全家福');
                        if (reconcileFamilyPhoto(this.gameState)) window.replaceInventoryItem('残缺全家福', '完整全家福');
                        scene.playSound(100, 'sawtooth', 2);
                        scene.cameras.main.flash(500, 255, 0, 0);
                        scene.time.delayedCall(500, () => {
                            window.showDialog('主角', '走廊尽头的气息...似乎变了。墙上的照片...最后一张，是一场车祸的现场。');
                        });
                    }
                } else {
                     // Already viewed, just show text again
                     if (photo.dialogText) {
                         window.showDialog('旧照片', photo.dialogText);
                    }
                }
                return;
            }

            if (type === 'car') {
                 scene.triggerFlashback('car_crash');
                 window.showDialog('主角', '（靠近车辆时，眼前突然一片血红...耳边传来刺耳的刹车声和巨大的撞击声...）');
                 return;
            }

            if (type === 'black_cloth') {
                 if (!this.gameState.doorSlammed) {
                     window.showDialog('主角', '（突然，身后传来“砰”的一声巨响！大门关上了。）', () => {
                         scene.playSound(50, 'sawtooth', 4);
                         scene.cameras.main.shake(500, 0.02);
                         this.gameState.doorSlammed = true;

                         // Lock the door!
                         const doorToEntrance = scene.doors.getChildren().find(d => d.targetMap === 'room_entrance');
                         if (doorToEntrance) {
                             doorToEntrance.locked = true;
                         }
                     });
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
                    window.showDialog('主角', '井底的水正在上涨...那具尸体...它好像在笑。不能再靠近了。');
                } else {
                    // Trigger Ghost Event
                    scene.time.delayedCall(500, () => {
                        scene.playSound(100, 'sawtooth', 3);
                        scene.cameras.main.shake(1000, 0.02);
                        window.showDialog('井底的声音', '乖孙子...下来陪奶奶...下面很凉快...', () => {
                            window.showDialog('主角', '奶奶？可是奶奶刚才不是...在屋里吗？', () => {
                                window.showDialog('井底的声音', '不...那不是奶奶...那是纸糊的假货...我是真的...我是妈妈啊...', () => {
                                    scene.playSound(50, 'sawtooth', 4);
                                    scene.cameras.main.flash(200, 255, 0, 0);
                                    window.showDialog('主角', '（惊恐）一只惨白的手抓住了井沿！那是...那是一具泡得发肿的女尸！', () => {
                                        window.showDialog('尸体', '为什么...不救我...你看着我死的...你就站在那里...看着我割开了手腕...', () => {
                                            window.showDialog('主角', '不！不是这样的！我被关起来了！我出不去！', () => {
                                                window.showDialog('尸体', '撒谎...把钥匙给我...（猛地扑上来）', () => {
                                                    scene.playSound(600, 'sine', 1);
                                                    this.gameState.hasRedKey = true;
                                                    this.collectClue('well_red_key', 'death');
                                                    window.updateInventory('血红钥匙');
                                                    window.showDialog('主角', '你拼命挣扎，在混乱中抓住了井边铁钩上的一把【血红钥匙】，并将尸体踹回了井里。', () => {
                                                        window.showDialog('主角', '这把钥匙...是血红色的。奶奶说钥匙在"他"肚子里，难道是指...');

                                                        scene.playSound(50, 'square', 4);
                                                        scene.cameras.main.flash(500, 255, 0, 0);
                                                        this.ensureStoryFlags().chasePhase = 'active';
                                                        scene.chaseManager.start();
                                                        scene.chaseTimer = scene.time.addEvent({
                                                            delay: 2000,
                                                            callback: () => {
                                                                scene.cameras.main.shake(200, 0.01);
                                                                if (scene.soundManager && scene.chaser && scene.chaser.active) {
                                                                    scene.soundManager.playSpatialNoise(0.5, scene.chaser.x, scene.chaser.y);
                                                                }
                                                            },
                                                            loop: true
                                                        });
                                                        window.showDialog('恐怖的声音', '是他...那个把门窗都钉死的人！他不想让你打开棺材看到真相！快跑！！！');
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                }
                return;
            }
        };

        // --- Execution Strategy ---
        // If obj has dialog, show it first. Then execute logic.
        // Unless it's a type where logic overrides dialog flow (like Memory Table which handles its own dialogs).

        if (type === 'memory_table') {
            executeLogic(); // Handles its own dialogs
        } else if (obj.dialog) {
            showDialogSequence(obj.dialog, executeLogic);
        } else {
            executeLogic();
        }
    }

    handleEndingChoice(choice) {
        const scene = this.scene;
        const flags = this.ensureStoryFlags();
        flags.endingChoice = choice;

        if (choice === 'leave') {
            window.showDialog('主角', '我不再回头了。雨声还在，可那座宅子终于离我越来越远。', () => {
                scene.cameras.main.fadeOut(2500, 255, 255, 255);
                scene.time.delayedCall(2500, () => {
                    window.showEndingScreen('结局：归路', '你承认了死亡，也承认了自己曾经拼命想离开。路的尽头没有家，只有终于安静下来的雨。', () => {
                        scene.scene.start('TitleScene');
                        window.globalGameState = null;
                    });
                });
            });
            return;
        }

        if (choice === 'return') {
            window.showDialog('主角', '如果这就是我最后一次回家，那至少让我亲手推开那扇门。', () => {
                scene.switchScene('room_memory', 320, 400);
            });
        }
    }
}
