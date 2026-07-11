import assert from 'node:assert/strict';
import { createDefaultGameState } from '../src/systems/StoryState.js';
import {
    getNarrativePhase,
    getNarrativeSummary,
    getObjectReflection,
    getPendingNarrativeBeat,
    markNarrativeBeatSeen
} from '../src/systems/NarrativeDirector.js';

const state = createDefaultGameState();
assert.equal(getNarrativePhase(state), 'denial');
assert.equal(getNarrativeSummary(state), '父亲死了，我只是回来避雨。');
assert.equal(getObjectReflection(state, 'rice'), '给死人的饭。这个家连吃饭都像一条规矩。');

state.storyFlags.collectedClues.push('medical_record', 'prescription_note');
assert.equal(getPendingNarrativeBeat(state)?.id, 'mother_echo');
assert.equal(markNarrativeBeatSeen(state, 'mother_echo'), true);
assert.equal(markNarrativeBeatSeen(state, 'mother_echo'), false);
assert.equal(getPendingNarrativeBeat(state), null);
assert.equal(getNarrativePhase(state), 'anger');

state.storyFlags.collectedClues.push('locked_window', 'toy_plane');
assert.equal(getPendingNarrativeBeat(state)?.id, 'escape_echo');
markNarrativeBeatSeen(state, 'escape_echo');
assert.equal(getNarrativePhase(state), 'recognition');

state.storyFlags.collectedClues.push('diary_mother');
state.storyFlags.photoSetCollected = true;
assert.equal(getPendingNarrativeBeat(state)?.id, 'memorial_echo');
assert.equal(getNarrativeSummary(state), '所有日期都停在十年前的七月十四。');
assert.equal(getObjectReflection(state, 'rice'), '这碗饭等的人是我。它已经凉了十年。');

const priorityState = createDefaultGameState();
priorityState.storyFlags.collectedClues.push('medical_record', 'prescription_note', 'locked_window', 'toy_plane', 'diary_mother');
priorityState.storyFlags.photoSetCollected = true;
assert.equal(getPendingNarrativeBeat(priorityState)?.id, 'memorial_echo');

state.storyFlags.coffinOpened = true;
assert.equal(getNarrativePhase(state), 'acceptance');
assert.equal(getNarrativeSummary(state), '棺材里等的人是我。');

console.log('Narrative director verification passed');
