import assert from 'node:assert/strict';
import { createDefaultGameState } from '../src/systems/StoryState.js';
import { getCurrentObjective } from '../src/systems/ObjectiveManager.js';

const state = createDefaultGameState();
assert.equal(getCurrentObjective(state, 'room_prologue'), '沿公路寻找避雨处');
state.doorSlammed = true;
assert.equal(getCurrentObjective(state, 'room_main'), '找齐供品：倒头饭、火柴、香、纸钱');
state.hasRice = state.hasMatches = state.hasIncense = state.hasSpiritMoney = true;
assert.equal(getCurrentObjective(state, 'room_main'), '调查旧书房与药柜小间');
state.storyFlags.puzzles.school = true;
state.storyFlags.puzzles.hospital = true;
assert.equal(getCurrentObjective(state, 'room_corridor'), '调查走廊里的四张旧照片');
state.storyFlags.photoSetCollected = true;
assert.equal(getCurrentObjective(state, 'room_corridor'), '用地下室钥匙进入地下禁闭室寻找照片缺角');
state.storyFlags.familyPhotoCornerFound = true;
state.storyFlags.familyPhotoAssembled = true;
state.storyFlags.chasePhase = 'active';
assert.equal(getCurrentObjective(state, 'room_backyard'), '躲藏 6 秒，或把完整全家福带回正厅');

console.log('Objective verification passed');
