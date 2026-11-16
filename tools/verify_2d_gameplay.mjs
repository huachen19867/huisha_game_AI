import assert from 'node:assert/strict';
import { createDefaultGameState, collectClue } from '../src/systems/StoryState.js';
import { CASES, CLUE_NAMES, canDeduce, deduce, ensureInvestigation, getVisibleCases, getEvidence, getJournalEntries, rememberDocument, getCaseDraft, rememberCaseDraft, getMemoryReturn, getObjective, requestHint, readCheckpoint, saveCheckpoint, recoverFromCapture } from '../src/systems/Investigation.js';
import { getRoomObjects } from '../src/systems/MemoryEchoes.js';
import { Maps } from '../src/data/Maps.js';
import { visitRoom, knownConnections, knownRoute, inspectionStatus, examineObject, hasClearInteractionPath } from '../src/systems/Exploration.js';
import { InvestigationUI } from '../src/systems/InvestigationUI.js';
import { InteractionManager } from '../src/systems/InteractionManager.js';
import { Player } from '../src/entities/Player.js';
import { ManorPresentation } from '../src/systems/ManorPresentation.js';
import { MapManager } from '../src/systems/MapManager.js';

globalThis.window = { dialogActive: false, showDialog: (_name, _text, callback) => callback?.() };
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const state = createDefaultGameState();
ensureInvestigation(state);
assert.deepEqual(getVisibleCases(state), [], 'A new journal must not reveal future events');
for (let i = 0; i < 3; i++) assert.doesNotMatch(requestHint(state, 'room_main').text, /事故|终章|医院|红钥匙/);
state.doorSlammed = true;
assert.equal(requestHint(state, 'room_main').level, 1, 'A new objective starts at a gentle hint');
state.hasRice = true;
assert.equal(requestHint(state, 'room_main').level, 1, 'Finding a supply resets hints for the next task');
state.hasRice = false;

// Optional hints follow the room under investigation, then fall back to the
// broader objective. They never collect materials or commit interpretations.
for (const [room, detail] of [['room_kitchen', /橱柜中层/], ['room_attic', /阁楼北侧/], ['room_backyard', /香/], ['room_secret', /工作台/]]) {
    const localHintState = createDefaultGameState();
    localHintState.doorSlammed = true;
    assert.equal(requestHint(localHintState, room).level, 1);
    assert.match(requestHint(localHintState, room).text, detail);
    assert.equal(requestHint(localHintState, room).level, 3);
    assert.deepEqual(localHintState.storyFlags.collectedClues, []);
    assert.deepEqual(localHintState.investigation.notes, []);
    assert.equal(localHintState.hasRice, false);
}
const localCabinetHint = createDefaultGameState();
assert.match(requestHint(localCabinetHint, 'room_bedroom_parents').text, /柜脚/);
requestHint(localCabinetHint, 'room_bedroom_parents'); requestHint(localCabinetHint, 'room_bedroom_parents');
localCabinetHint.cabinetMoved = true;
assert.equal(requestHint(localCabinetHint, 'room_bedroom_parents').level, 1, 'Opening the passage starts a new, gentle hint');
assert.match(requestHint(localCabinetHint, 'room_bedroom_parents').text, /暗门/);
const localWellHint = createDefaultGameState();
localWellHint.hasIncense = true;
assert.equal(requestHint(localWellHint, 'room_backyard').level, 1);
assert.match(requestHint(localWellHint, 'room_backyard').text, /钩尖/);
assert.match(requestHint(localWellHint, 'room_backyard').text, /追逐风险/);
const takenAtticHint = createDefaultGameState();
takenAtticHint.doorSlammed = true; takenAtticHint.hasSpiritMoney = true;
assert.match(requestHint(takenAtticHint, 'room_attic').text, /寻找饭/, 'A collected local supply yields to the wider task');
for (const [id, room] of [['school', 'room_study'], ['hospital', 'room_medicine']]) {
    const localFamilyHint = createDefaultGameState();
    const first = requestHint(localFamilyHint, room);
    assert.doesNotMatch(first.text, /寻找饭|黑布|事故/);
    requestHint(localFamilyHint, room); requestHint(localFamilyHint, room);
    collectClue(localFamilyHint, CASES[id].required[0], id === 'school' ? 'control' : 'illness');
    assert.equal(requestHint(localFamilyHint, room).level, 1, 'A newly found record resets that memory hint');
    collectClue(localFamilyHint, CASES[id].required[1], id === 'school' ? 'control' : 'illness');
    assert.equal(requestHint(localFamilyHint, room).level, 1);
    assert.equal(requestHint(localFamilyHint, room).text, CASES[id].comparison);
    assert.match(requestHint(localFamilyHint, room).text, /打开手记.*不必重访/);
    assert.equal(localFamilyHint.storyFlags.memories[id], false, 'Hints cannot submit a completed interpretation');
    assert.equal(localFamilyHint.investigation.deductions[id], undefined);
}
const resumedRitualHint = createDefaultGameState();
Object.assign(resumedRitualHint, { doorSlammed: true, hasRice: true, hasMatches: true, hasIncense: true, hasSpiritMoney: true });
ensureInvestigation(resumedRitualHint).ritualStep = 1;
assert.equal(requestHint(resumedRitualHint, 'room_main').level, 1);
assert.match(requestHint(resumedRitualHint, 'room_main').text, /供物仍在/);
assert.match(requestHint(resumedRitualHint, 'room_main').text, /不用重新摆饭/);
resumedRitualHint.investigation.ritualStep = 2;
assert.equal(requestHint(resumedRitualHint, 'room_main').level, 1);
requestHint(resumedRitualHint, 'room_main');
assert.match(requestHint(resumedRitualHint, 'room_main').text, /焚纸/);
assert.equal(resumedRitualHint.candlesLit, 0);
const dangerHint = createDefaultGameState();
dangerHint.isChasing = true;
assert.match(requestHint(dangerHint, 'room_attic').text, /脚步/);
dangerHint.isChasing = false; dangerHint.isHidden = true;
assert.match(requestHint(dangerHint, 'room_medicine').text, /脚步/);

for (const [id, puzzle] of Object.entries(CASES)) {
    assert.equal(canDeduce(state, id), false, 'Reading the answer alone must not unlock a deduction');
    assert.equal(deduce(state, id, puzzle.correct, puzzle.required), false);
    for (const clue of puzzle.required) collectClue(state, clue, id === 'school' ? 'control' : id === 'hospital' ? 'illness' : 'death');
    assert.equal(deduce(state, id, (puzzle.correct + 1) % 3, puzzle.required), false);
    assert.equal(deduce(state, id, puzzle.correct), false, 'A correct guess without submitted evidence must fail');
    assert.equal(deduce(state, id, puzzle.correct, [puzzle.required[0], puzzle.required[0]]), false);
    assert.equal(deduce(state, id, puzzle.correct, puzzle.required), true);
}
const untouchedMap = JSON.stringify(Maps.room_corridor.objects);
const echoState = createDefaultGameState();
assert.equal(getRoomObjects('room_corridor', echoState).interactables.length, 0);
echoState.storyFlags.memories.school = true;
assert.equal(getRoomObjects('room_corridor', echoState).photos.find(photo => photo.id === 3).texture, 'photo_uncovered');
assert.equal(getRoomObjects('room_corridor', echoState).interactables.length, 0, 'School does not unlock the hospital echo');
echoState.storyFlags.memories.hospital = true;
assert.equal(getRoomObjects('room_corridor', echoState).interactables[0].id, 'hospital_echo');
assert.equal(JSON.stringify(Maps.room_corridor.objects), untouchedMap, 'Room variants must never mutate the shared map');
assert.equal(getRoomObjects('room_corridor', createDefaultGameState()).photos[2].texture, undefined, 'Restarting restores the original photograph');
assert.equal(getEvidence(state).find(card => card.id === 'hospital_ward').text, Maps.memory_hospital.objects.interactables.find(item => item.clueId === 'hospital_ward').documentText);

const navState = createDefaultGameState();
visitRoom(navState, 'room_entrance');
visitRoom(navState, 'room_main', 'room_entrance');
visitRoom(navState, 'room_corridor', 'room_main');
visitRoom(navState, 'room_study', 'room_corridor');
visitRoom(navState, 'memory_school', 'room_study');
assert.deepEqual(knownRoute(navState, 'room_study', 'room_main'), ['room_study', 'room_corridor', 'room_main']);
assert.equal(knownRoute(navState, 'room_study', 'room_secret'), null, 'Unvisited rooms are never route destinations');
assert.equal(knownRoute(navState, 'memory_school', 'room_main'), null, 'Entering a memory does not invent a physical shortcut');
assert.equal(knownConnections(navState).length, 3);
visitRoom(navState, 'room_study', 'memory_school');
assert.equal(navState.investigation.visitedRooms.filter(id => id === 'room_study').length, 1);
navState.doorSlammed = true;
assert.equal(knownRoute(navState, 'room_main', 'room_entrance'), null, 'Routes respect the locked south door');
assert.deepEqual(knownRoute(navState, 'room_entrance', 'room_main'), ['room_entrance', 'room_main'], 'Door direction comes from the authored map');
navState.candlesLit = 1;
assert.deepEqual(knownRoute(navState, 'room_main', 'room_entrance'), ['room_main', 'room_entrance']);
visitRoom(navState, 'room_bedroom_parents', 'room_corridor');
visitRoom(navState, 'room_secret', 'room_bedroom_parents');
assert.equal(knownRoute(navState, 'room_bedroom_parents', 'room_secret'), null, 'Hidden doors must be opened even if an older save has visited the room');
navState.cabinetMoved = true;
assert.deepEqual(knownRoute(navState, 'room_bedroom_parents', 'room_secret'), ['room_bedroom_parents', 'room_secret']);

const readState = createDefaultGameState();
const oldPhoto = { type: 'photo', obj: { x: 48, y: 350, photoId: 3, dialogText: '原来的相纸' } };
examineObject(readState, 'room_corridor', oldPhoto);
assert.equal(inspectionStatus(readState, 'room_corridor', oldPhoto), '已调查');
assert.equal(inspectionStatus(readState, 'room_corridor', { type: 'photo', obj: { ...oldPhoto.obj, dialogText: '新显出的半边' } }), '有变化', 'A changed photo must be inspectable again');
const pendingMemory = { type: 'story_object', obj: { x: 400, y: 310, memoryComplete: 'school' } };
examineObject(readState, 'memory_school', pendingMemory);
assert.equal(inspectionStatus(readState, 'memory_school', pendingMemory), '待拼合', 'Reading an exit is different from completing its deduction');
const pendingKey = { type: 'well', obj: { x: 320, y: 320 } };
examineObject(readState, 'room_backyard', pendingKey);
assert.equal(inspectionStatus(readState, 'room_backyard', pendingKey), '钥匙未取', 'Reading the well and cancelling its choice must not imply the key is taken');
const sightMap = { data: [[0, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 0]] };
assert.equal(hasClearInteractionPath(sightMap, 48, 48, { x: 112, y: 48 }), false, 'Reach must not extend through intervening walls');
assert.equal(hasClearInteractionPath(sightMap, 48, 48, { x: 80, y: 48 }), true, 'A photo mounted on the near face of a wall remains readable');

// A tiny DOM surface exercises real selection handlers without a browser.
class Surface {
    constructor() { this.children = []; this.attributes = {}; this.value = ''; }
    appendChild(node) { this.children.push(node); return node; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; this.value = ''; }
    setAttribute(name, value) { this.attributes[name] = value; }
    set textContent(value) { this.value = value; this.children = []; }
    get textContent() { return this.value + this.children.map(node => node.textContent).join(''); }
}
globalThis.document = { createElement: () => new Surface(), createElementNS: () => new Surface() };
function descendants(node) { return node.children.flatMap(child => [child, ...descendants(child)]); }

// Exercise the actual modal lifecycle and keyboard handler. Layout visibility
// is supplied by this DOM surface; native browser tab order remains a play check.
const ordinaryCreateElement = document.createElement, ordinaryActiveElement = document.activeElement;
const ordinaryCloseTime = window.lastDialogCloseTime;
const focusNode = tag => Object.assign(new Surface(), {
    tag, tabIndex: tag === 'h2' ? -1 : 0, isConnected: true, rects: [{}],
    focus() { document.activeElement = this; }, getClientRects() { return this.rects; }
});
document.createElement = focusNode;
const modalNodes = Object.fromEntries(['case-modal', 'case-sheet', 'case-modal-title', 'case-body', 'case-feedback', 'case-actions', 'case-journal'].map(id => [id, focusNode(id === 'case-modal-title' ? 'h2' : 'div')]));
modalNodes['case-modal'].appendChild(modalNodes['case-sheet']);
modalNodes['case-sheet'].append(modalNodes['case-modal-title'], modalNodes['case-body'], modalNodes['case-feedback'], modalNodes['case-actions']);
modalNodes['case-modal'].querySelectorAll = () => descendants(modalNodes['case-modal']).filter(node => ['button', 'summary', 'input', 'select', 'textarea'].includes(node.tag));
let focusPaused = false;
const heldKeys = new Set(['KeyW']);
const captureCodes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
const gameKeyboard = { enabled: true, manager: { preventDefault: true, captures: [...captureCodes] }, resets: 0,
    disableGlobalCapture() { this.manager.preventDefault = false; }, enableGlobalCapture() { this.manager.preventDefault = true; },
    resetKeys() { heldKeys.clear(); this.resets++; } };
const modalUI = Object.assign(Object.create(InvestigationUI.prototype), {
    el: id => modalNodes[id], scene: { input: { keyboard: gameKeyboard }, player: { sprite: { setVelocity() {} } }, physics: { pause() { focusPaused = true; }, resume() { focusPaused = false; } } }
});
const modalOpener = focusNode('button'); modalOpener.focus();
modalNodes['case-sheet'].scrollTop = 170;
modalUI.modal('手记', '阅读原文', [{ label: '继续阅读' }, { label: '不可用', disabled: true }, { label: '合上' }]);
assert.equal(document.activeElement, modalNodes['case-modal-title']);
assert.equal(modalNodes['case-sheet'].scrollTop, 0);
assert.equal(focusPaused, true);
assert.equal(gameKeyboard.enabled, false);
assert.equal(gameKeyboard.manager.preventDefault, false, 'The reading layer releases global Phaser browser captures');
assert.equal(heldKeys.size, 0, 'A movement key held while opening is reset');
const hiddenModalButton = focusNode('button'); hiddenModalButton.rects = [];
const negativeModalButton = focusNode('button'); negativeModalButton.tabIndex = -1;
const firstModalControl = focusNode('summary');
modalNodes['case-body'].append(hiddenModalButton, negativeModalButton, firstModalControl);
const middleModalControl = modalNodes['case-actions'].children[0], lastModalControl = modalNodes['case-actions'].children[2];
const modalKey = (code, extra = {}) => {
    const event = { code, prevented: false, preventDefault() { this.prevented = true; }, ...extra };
    modalUI.handleKey(event); return event;
};
const searchControl = Object.assign(focusNode('input'), { matches: selector => selector.includes('input') });
modalNodes['case-body'].appendChild(searchControl);
for (const code of captureCodes) {
    const event = modalKey(code, { target: searchControl });
    // Model the documented KeyboardManager window phase after document handlers.
    if (!event.prevented && gameKeyboard.manager.preventDefault && gameKeyboard.manager.captures.includes(code)) event.preventDefault();
    if (gameKeyboard.enabled) heldKeys.add(code);
    assert.equal(event.prevented, false, `${code} must remain available to the DOM input`);
}
assert.equal(heldKeys.size, 0, 'Typing cannot press game movement or interaction keys');
let composingActions = 0;
modalUI.modalKeyHandler = () => composingActions++;
for (const extra of [{ isComposing: true }, { keyCode: 229 }, { defaultPrevented: true }]) {
    assert.equal(modalKey('Escape', extra).prevented, false);
    assert.equal(modalUI.open, true, 'IME confirmation/cancellation cannot close the reading layer');
    modalKey('Enter', extra);
}
assert.equal(composingActions, 0);
modalUI.modalKeyHandler = null;
modalNodes['case-modal-title'].focus();
assert.equal(modalKey('Tab').prevented, true);
assert.equal(document.activeElement, firstModalControl, 'Title enters the first visible control');
assert.equal(modalKey('Tab', { shiftKey: true }).prevented, true);
assert.equal(document.activeElement, lastModalControl, 'Backward tab wraps inside the reading layer');
assert.equal(modalKey('Tab', { repeat: true }).prevented, true);
assert.equal(document.activeElement, firstModalControl, 'Holding Tab cannot escape the last control');
middleModalControl.focus();
assert.equal(modalKey('Tab').prevented, false, 'Interior movement keeps native DOM tab order');
lastModalControl.focus();
assert.equal(modalKey('Tab', { ctrlKey: true }).prevented, false, 'Browser tab-switch shortcuts remain native');
assert.equal(document.activeElement, lastModalControl);
modalOpener.focus(); modalKey('Tab');
assert.equal(document.activeElement, firstModalControl, 'An escaped focus is returned to the reading layer');
middleModalControl.focus();
modalUI.modal('路线', '另一页', []);
assert.equal(gameKeyboard.resets, 1, 'Page replacement keeps the first keyboard snapshot');
assert.equal(modalUI.previousFocus, modalOpener, 'Page replacement keeps the original world opener');
assert.equal(modalKey('Tab').prevented, true);
assert.equal(document.activeElement, modalNodes['case-modal-title'], 'An empty control list keeps a reachable focus');
assert.equal(modalKey('Escape').prevented, true);
assert.equal(document.activeElement, modalOpener);
assert.equal(modalUI.previousFocus, null);
assert.equal(focusPaused, false);
assert.equal(gameKeyboard.enabled, true);
assert.equal(gameKeyboard.manager.preventDefault, true);
assert.equal(gameKeyboard.resets, 2);
assert.deepEqual(gameKeyboard.manager.captures, captureCodes, 'Captures are restored, never removed from the game');
assert.equal(modalKey('Tab').prevented, false, 'A closed modal does not contain focus');
modalOpener.focus(); modalUI.modal('手记', '再打开', []);
modalOpener.isConnected = false;
modalUI.close();
assert.equal(document.activeElement, modalNodes['case-journal'], 'A removed opener falls back to a live journal button');
gameKeyboard.enabled = false; gameKeyboard.manager.preventDefault = false;
modalUI.modal('手记', '已有外部输入设置', []); modalUI.close();
assert.equal(gameKeyboard.enabled, false); assert.equal(gameKeyboard.manager.preventDefault, false, 'Closing cannot enable capture that was originally disabled');
gameKeyboard.enabled = true; gameKeyboard.manager.preventDefault = true;
modalUI.modal('手记', '离场前', []);
const outgoingManager = gameKeyboard.manager;
gameKeyboard.manager = null;
modalUI.close();
assert.equal(outgoingManager.preventDefault, true, 'A destroyed plugin still releases its saved global capture setting');
assert.equal(gameKeyboard.enabled, false, 'A detached keyboard plugin must not be reactivated');
gameKeyboard.manager = outgoingManager;
document.createElement = ordinaryCreateElement; document.activeElement = ordinaryActiveElement;
window.lastDialogCloseTime = ordinaryCloseTime;

// Run the actual modal actions with a minimal surface: cancellation and wrong
// answers must never invoke completion, grant an ending, or consume supplies.
const ui = Object.create(InvestigationUI.prototype);
let actions = [], completed = 0;
const feedback = { textContent: '' };
const body = new Surface();
ui.modal = (_title, message, choices) => { ui.modalKeyHandler = null; actions = choices; body.textContent = message; return true; };
ui.el = id => id === 'case-body' ? body : feedback;
ui.close = () => { ui.modalKeyHandler = null; };
ui.state = state;
ui.data = state.investigation;
ui.scene = { playSound() {} };
const newState = createDefaultGameState();
ui.state = newState;
ui.data = ensureInvestigation(newState);
ui.journal();
assert.doesNotMatch(body.textContent, /雨夜发生过几次|护栏|安全带|母亲为什么/);
collectClue(newState, 'school_blackboard', 'control');
ui.journal();
assert.match(body.textContent, /谁把家变成了考场/);
assert.doesNotMatch(body.textContent, /划破的成绩单|护栏|住院建议/, 'Unfound evidence names stay hidden');
assert.doesNotMatch(body.textContent, /1\/2|2\/2|份相关记录/, 'The journal cannot grade which discovered cards belong to a solution');
assert.ok(descendants(body).some(node => node.textContent === '尝试还原这段经过' && node.onclick), 'One discovered lead is sufficient to try a hypothesis');
visitRoom(newState, 'room_main');
visitRoom(newState, 'room_kitchen', 'room_main');
ui.scene.currentMapId = 'room_main';
ui.sketch();
assert.match(body.textContent, /正厅|厨房/);
assert.doesNotMatch(body.textContent, /暗室|事故|旧医院|父母卧室/, 'The sketch cannot reveal an unvisited room');
descendants(body).find(node => node.textContent === '厨房' && typeof node.onclick === 'function').onclick();
assert.match(body.textContent, /下一段：从正厅的东侧门前往厨房/, 'Selecting a visited room provides a real directional route');

// Source locations connect discovered observations to routes. Notes alone never
// invent visited rooms, and memory evidence never becomes a physical shortcut.
const documentState = createDefaultGameState();
const cabinetRecord = Maps.room_bedroom_parents.objects.cabinet;
visitRoom(documentState, 'room_main');
visitRoom(documentState, 'room_corridor', 'room_main');
visitRoom(documentState, 'room_bedroom_parents', 'room_corridor');
const oldNote = { title: '旧记录', content: '没有留下房间名。' };
ensureInvestigation(documentState).notes.push(oldNote);
rememberDocument(documentState, 'room_bedroom_parents', cabinetRecord.observationTitle, cabinetRecord.observationText);
rememberDocument(documentState, 'room_bedroom_parents', cabinetRecord.observationTitle, cabinetRecord.observationText);
assert.equal(documentState.investigation.notes.length, 2, 'Reading again cannot duplicate a document');
assert.equal(getJournalEntries(documentState).find(card => card.name === '旧记录').source, '地点未记');
assert.equal(oldNote.sourceMapId, undefined, 'Unknown old locations must not be guessed');
rememberDocument(documentState, 'room_main', oldNote.title, oldNote.content);
assert.equal(oldNote.sourceMapId, 'room_main', 'Actually rereading an old note supplies its missing location');
rememberDocument(documentState, 'room_corridor', oldNote.title, oldNote.content);
assert.equal(oldNote.sourceMapId, 'room_main', 'Rereading does not move the first recorded source');
rememberDocument(documentState, 'missing_map', '无地点的纸', '仍保留原文。');
assert.equal(getJournalEntries(documentState).find(card => card.name === '无地点的纸').sourceMapId, undefined);
const changedPhoto = getRoomObjects('room_corridor', { storyFlags: { memories: { school: true } } }).photos.find(photo => photo.id === 3);
rememberDocument(documentState, 'room_corridor', changedPhoto.title, changedPhoto.text);
const recordCount = documentState.investigation.notes.length;
ui.state = documentState; ui.data = documentState.investigation; ui.scene = { currentMapId: 'room_main' };
ui.journal();
assert.match(body.textContent, /衣柜底下的擦痕 · 父母卧室/);
assert.doesNotMatch(body.textContent, /护栏外的纸飞机|没有寄出的复诊提醒|被划掉的住院建议/, 'Source navigation cannot add undiscovered records');
descendants(body).find(node => node.textContent === '回想去父母卧室的路').onclick();
assert.match(body.textContent, /正厅 → 走廊 → 父母卧室/);
assert.match(body.textContent, /在父母卧室记下的发现/);
assert.match(body.textContent, /向左延伸/);
assert.doesNotMatch(body.textContent, /没有留下房间名|老师说第二名/, 'A selected room lists only its own discovered records');
descendants(body).find(node => node.textContent === '走廊' && typeof node.onclick === 'function').onclick();
assert.match(body.textContent, /老师说第二名/, 'Room variants retain the text actually observed');
assert.equal(documentState.investigation.notes.length, recordCount, 'Map viewing cannot collect new observations');
// Location metadata is insufficient to claim a path the player never walked.
rememberDocument(documentState, 'room_backyard', '井边旧记录', '井沿上看过的锈痕。');
ui.journal();
assert.equal(descendants(body).some(node => node.textContent === '回想去后院的路'), false);
assert.equal(documentState.investigation.visitedRooms.includes('room_backyard'), false);
ui.sketch('room_backyard');
assert.doesNotMatch(body.textContent, /井边旧记录|井沿上看过/, 'Unvisited room selection cannot bypass discovered-map rules');
documentState.doorSlammed = true;
visitRoom(documentState, 'room_entrance', 'room_main');
rememberDocument(documentState, 'room_entrance', '门柱记录', '刻过身高的旧门柱。');
ui.journal();
descendants(body).find(node => node.textContent === `回想去${Maps.room_entrance.name}的路`).onclick();
assert.match(body.textContent, /没有记下可直接走通的路线/, 'A source link must respect a currently sealed door');
assert.match(body.textContent, /刻过身高的旧门柱/, 'Known source records remain available behind a sealed route');
documentState.candlesLit = true;
ui.sketch('room_entrance');
assert.match(body.textContent, /下一段：从正厅的南侧门/);
collectClue(documentState, 'hospital_window', 'illness');
const windowRecord = Maps.memory_hospital.objects.interactables.find(item => item.clueId === 'hospital_window');
rememberDocument(documentState, 'memory_hospital', windowRecord.documentTitle, windowRecord.documentText);
ui.journal();
assert.equal(getJournalEntries(documentState).filter(card => card.text === windowRecord.documentText).length, 1, 'Evidence and its recorded document share one entry');
assert.equal(descendants(body).some(node => node.textContent.startsWith('回想去记忆：')), false, 'A memory record cannot create a physical route button');
saveCheckpoint(documentState, 'room_main', 384, 450);
assert.equal(readCheckpoint().state.investigation.notes.find(note => note.title === cabinetRecord.observationTitle).sourceMapId, 'room_bedroom_parents');

ui.state = state;
ui.data = state.investigation;
ui.scene = { currentMapId: 'room_main', playSound() {} };
function selectEvidence(ids) {
    for (const id of ids) descendants(body).find(node => node.textContent === `选用：${CLUE_NAMES[id]}`)?.onclick();
}
function selectAnswer(id, index) {
    descendants(body).find(node => node.textContent === CASES[id].answers[index])?.onclick();
}

// The first lead opens a question, not a hidden checklist. Players may test a
// hypothesis early, but unrelated support cannot complete a family memory.
const earlyDialog = window.showDialog;
for (const [id, puzzle] of Object.entries(CASES)) {
    const partialState = createDefaultGameState();
    const type = id === 'school' ? 'control' : id === 'hospital' ? 'illness' : 'death';
    collectClue(partialState, puzzle.required[0], type);
    collectClue(partialState, 'family_rules', 'control');
    ui.state = partialState; ui.data = ensureInvestigation(partialState); ui.scene = { currentMapId: 'room_main' };
    let earlyConclusions = 0;
    window.showDialog = () => earlyConclusions++;
    ui.journal();
    descendants(body).find(node => node.textContent === '尝试还原这段经过').onclick();
    assert.match(body.textContent, /现在就可以尝试/);
    assert.equal(canDeduce(partialState, id), false, 'Opening a hypothesis cannot manufacture missing support');
    assert.equal(descendants(body).some(node => node.textContent === `选用：${CLUE_NAMES[puzzle.required[1]]}`), false, 'Missing records cannot be selected');
    if (id === 'school') assert.doesNotMatch(body.textContent, /学校没有处分第二名/);
    if (id === 'death') assert.doesNotMatch(body.value, /十年前的纸飞机/, 'The prompt cannot present an unseen date as fact');
    selectEvidence([puzzle.required[0], 'family_rules']); selectAnswer(id, puzzle.correct);
    actions[0].run();
    assert.equal(earlyConclusions, 0);
    assert.equal(partialState.investigation.deductions[id], undefined);
    assert.notEqual(partialState.storyFlags.memories[id], true);
    assert.match(feedback.textContent, /不能共同支持/);
    assert.equal(feedback.textContent.includes(CLUE_NAMES[puzzle.required[1]]), false);
    assert.deepEqual(partialState.storyFlags.collectedClues, [puzzle.required[0], 'family_rules']);
    actions.at(-1).run();
    saveCheckpoint(partialState, 'room_main', 384, 450);
    assert.equal(readCheckpoint().state.investigation.deductions[id], undefined);
    // Resume in a new state/room, as after loading or visiting the next source.
    const restoredDraftState = readCheckpoint().state;
    ui.state = restoredDraftState; ui.data = ensureInvestigation(restoredDraftState); ui.scene = { currentMapId: 'room_corridor' };
    ui.journal();
    assert.match(body.textContent, /未提交的草稿/);
    descendants(body).find(node => node.textContent === '继续整理这段经过').onclick();
    assert.equal(descendants(body).find(node => node.className === 'case-pool').open, false, 'A two-card draft opens on its comparison instead of the entire library');
    let draftComparison = descendants(body).find(node => node.className === 'case-comparison');
    assert.equal(draftComparison.children.length, 2);
    for (const clue of [puzzle.required[0], 'family_rules']) assert.equal(descendants(body).find(node => node.textContent === `已选：${CLUE_NAMES[clue]}`).attributes['aria-pressed'], 'true');
    assert.equal(descendants(body).find(node => node.textContent === puzzle.answers[puzzle.correct]).attributes['aria-pressed'], 'true');
    assert.equal(earlyConclusions, 0, 'Opening a fully filled draft cannot submit it');
    actions[0].run();
    assert.equal(earlyConclusions, 0, 'An unsupported draft remains unsupported after loading');
    actions.at(-1).run();
    collectClue(restoredDraftState, puzzle.required[1], type);
    ui.solve(id);
    draftComparison = descendants(body).find(node => node.className === 'case-comparison');
    descendants(draftComparison).find(node => node.textContent === `换掉：${CLUE_NAMES.family_rules}`).onclick();
    assert.equal(descendants(body).find(node => node.className === 'case-pool').open, true, 'Replacing a card reveals the library again');
    selectEvidence([puzzle.required[1]]);
    assert.equal(earlyConclusions, 0, 'New evidence and a remembered answer still require explicit submission');
    actions[0].run();
    assert.equal(earlyConclusions, 1);
    assert.equal(restoredDraftState.investigation.deductions[id], true);
    assert.equal(restoredDraftState.investigation.drafts[id], undefined, 'Successful submission retires its draft');
}
window.showDialog = earlyDialog;

// Loading a draft never makes its unknown evidence readable or its explanation
// valid after the option text has changed. Separate events retain separate work.
const draftState = createDefaultGameState();
collectClue(draftState, 'school_blackboard', 'control');
collectClue(draftState, 'family_rules', 'control');
draftState.investigation = { drafts: {
    school: { evidenceIds: ['school_report', 'school_blackboard', 'school_blackboard', 'family_rules'], answer: '旧版已删除的解释' },
    hospital: { evidenceIds: ['hospital_window'], answer: CASES.hospital.answers[0] }
} };
ui.state = draftState; ui.data = ensureInvestigation(draftState); ui.scene = { currentMapId: 'room_main' };
assert.deepEqual(getVisibleCases(draftState).map(([id]) => id), ['school'], 'An unseen event cannot be revealed by a saved draft');
ui.solve('school');
assert.deepEqual(getCaseDraft(draftState, 'school'), { evidenceIds: ['school_blackboard', 'family_rules'], answer: null });
assert.equal(descendants(body).some(node => node.textContent === `已选：${CLUE_NAMES.school_report}`), false);
for (const label of CASES.school.answers) assert.equal(descendants(body).find(node => node.textContent === label).attributes['aria-pressed'], 'false');
const hospitalDraftBytes = JSON.stringify(draftState.investigation.drafts.hospital);
actions.find(action => action.label === '清空这份草稿').run();
assert.equal(draftState.investigation.drafts.school, undefined);
assert.equal(JSON.stringify(draftState.investigation.drafts.hospital), hospitalDraftBytes, 'Clearing one event leaves another draft untouched');
assert.deepEqual(draftState.storyFlags.collectedClues, ['school_blackboard', 'family_rules']);
assert.deepEqual(draftState.investigation.notes, []);
assert.match(feedback.textContent, /已选 0\/2.*尚未选择解释/);
ui.solve('school');
assert.equal(descendants(body).filter(node => node.attributes['aria-pressed'] === 'true').length, 0, 'Explicit clearing survives reopening');

// The comparison shows precisely the selected originals, lets a player replace
// a record, and offers a reading focus without validating individual guesses.
const ordinaryDialog = window.showDialog;
for (const id of Object.keys(CASES)) {
    const puzzle = CASES[id], compareState = createDefaultGameState();
    const clueType = id === 'school' ? 'control' : id === 'hospital' ? 'illness' : 'death';
    for (const clue of puzzle.required) collectClue(compareState, clue, clueType);
    collectClue(compareState, 'family_rules', 'control');
    ui.state = compareState; ui.data = ensureInvestigation(compareState);
    ui.scene = { currentMapId: id === 'death' ? 'memory_crash' : `memory_${id}` };
    let conclusions = 0;
    window.showDialog = () => conclusions++;
    ui.solve(id);
    const comparison = descendants(body).find(node => node.className === 'case-comparison');
    const cards = getEvidence(compareState);
    assert.match(comparison.textContent, /选用物证后/);
    assert.doesNotMatch(body.textContent, /没有寄出的复诊提醒|井沿铁钩/, 'Comparison cannot add undiscovered observations');
    selectEvidence([puzzle.required[0], 'family_rules']); selectAnswer(id, puzzle.correct);
    assert.ok(comparison.textContent.includes(cards.find(card => card.id === puzzle.required[0]).text));
    assert.ok(comparison.textContent.includes(cards.find(card => card.id === 'family_rules').text));
    assert.equal(comparison.textContent.includes(cards.find(card => card.id === puzzle.required[1]).text), false);
    actions[0].run();
    assert.equal(compareState.investigation.deductions[id], undefined);
    assert.ok(feedback.textContent.includes(puzzle.comparison));
    assert.equal(feedback.textContent.includes(CLUE_NAMES[puzzle.required[1]]), false, 'Failure cannot name a missing selected record as the answer');
    descendants(comparison).find(node => node.textContent === `换掉：${CLUE_NAMES.family_rules}`).onclick();
    assert.equal(descendants(body).find(node => node.textContent === `选用：${CLUE_NAMES.family_rules}`).attributes['aria-pressed'], 'false');
    assert.equal(comparison.textContent.includes(cards.find(card => card.id === 'family_rules').text), false);
    assert.match(feedback.textContent, /已提出解释/);
    selectEvidence([puzzle.required[1]]);
    assert.equal(comparison.children.length, 2);
    assert.ok(comparison.textContent.includes(cards.find(card => card.id === puzzle.required[1]).text));
    selectEvidence(['family_rules']);
    assert.equal(comparison.children.length, 2, 'A third record cannot silently replace either selected original');
    assert.match(feedback.textContent, /已经选了两份/);
    selectAnswer(id, (puzzle.correct + 1) % puzzle.answers.length); actions[0].run();
    assert.equal(compareState.investigation.deductions[id], undefined);
    assert.equal(conclusions, 0);
    selectAnswer(id, puzzle.correct);
    const submit = actions[0].run;
    submit(); submit();
    assert.equal(compareState.investigation.deductions[id], true);
    assert.equal(conclusions, 1, 'Repeated submission cannot replay the conclusion');
    assert.equal(compareState.investigation.notes.length, 0, 'Comparing originals cannot collect extra documents');
}
window.showDialog = ordinaryDialog;
ui.state = state; ui.data = state.investigation; ui.scene = { currentMapId: 'room_main', playSound() {} };

// Manual filters only search discovered words/places. They cannot choose which
// cards support a case, alter drafts, or hide the selected comparison originals.
const browseState = createDefaultGameState();
for (const clue of CASES.school.required) collectClue(browseState, clue, 'control');
collectClue(browseState, 'medical_record', 'illness');
visitRoom(browseState, 'room_main'); visitRoom(browseState, 'room_corridor', 'room_main');
rememberDocument(browseState, 'room_corridor', '纸背批注', '编号 ＡＢＣ；看过的文字保存在这里。');
ensureInvestigation(browseState).notes.push({ title: '旧页', content: '没有留下地点。' });
ui.state = browseState; ui.data = browseState.investigation; ui.scene = { currentMapId: 'room_main' };
const filters = () => ({
    input: descendants(body).find(node => node.className === 'case-record-search'),
    source: descendants(body).find(node => node.className === 'case-source-filter'),
    count: descendants(body).find(node => node.className === 'case-record-count case-caption'),
    list: descendants(body).find(node => ['case-record-list', 'case-evidence'].includes(node.className)),
    clear: descendants(body).find(node => node.textContent === '清除筛选' && node.onclick)
});
ui.journal();
const journalFilters = filters();
const browsingBytes = JSON.stringify(browseState);
assert.equal(journalFilters.count.attributes.role, 'status');
const places = journalFilters.source.children.map(option => option.value);
assert.ok(places.includes(Maps.memory_school.name) && places.includes(Maps.room_corridor.name) && places.includes('地点未记'));
assert.equal(places.includes(Maps.memory_hospital.name) || places.includes(Maps.memory_crash.name), false, 'Unvisited/unread event names cannot be offered as source filters');
journalFilters.input.focus = () => { document.activeElement = journalFilters.input; };
journalFilters.input.focus(); journalFilters.input.value = 'abc'; journalFilters.input.oninput();
assert.match(journalFilters.list.textContent, /纸背批注/);
assert.doesNotMatch(journalFilters.list.textContent, /成绩单|诊断书|旧页/);
assert.match(journalFilters.count.textContent, /显示 1\/5/);
assert.equal(document.activeElement, journalFilters.input, 'Updating results must not steal typing focus');
journalFilters.input.value = ''; journalFilters.source.value = '地点未记'; journalFilters.source.onchange();
assert.match(journalFilters.list.textContent, /旧页/);
assert.equal(descendants(journalFilters.list).some(node => node.textContent.startsWith('回想去')), false);
journalFilters.source.value = Maps.room_corridor.name; journalFilters.source.onchange();
assert.match(journalFilters.list.textContent, /纸背批注/);
assert.ok(descendants(journalFilters.list).some(node => node.textContent === '回想去走廊的路'));
journalFilters.input.value = '尚未读到的整行文字'; journalFilters.input.oninput();
assert.match(journalFilters.list.textContent, /没有匹配/);
assert.match(journalFilters.count.textContent, /显示 0\/5/);
journalFilters.clear.onclick();
assert.equal(journalFilters.input.value, ''); assert.equal(journalFilters.source.value, '');
assert.match(journalFilters.count.textContent, /显示 5\/5/);
assert.equal(JSON.stringify(browseState), browsingBytes, 'Filtering cannot discover, submit, or save any new game facts');

ui.solve('school');
const evidenceFilters = filters();
const filteredComparison = descendants(body).find(node => node.className === 'case-comparison');
evidenceFilters.input.focus = () => { document.activeElement = evidenceFilters.input; };
evidenceFilters.source.value = Maps.room_main.name; evidenceFilters.source.onchange();
selectEvidence(['medical_record']);
evidenceFilters.source.value = Maps.memory_school.name; evidenceFilters.source.onchange();
selectEvidence(['school_blackboard']); selectAnswer('school', CASES.school.correct);
assert.equal(filteredComparison.children.length, 2);
assert.ok(filteredComparison.textContent.includes(getEvidence(browseState).find(card => card.id === 'medical_record').text));
evidenceFilters.input.value = '没有这样的已读文字'; evidenceFilters.input.oninput();
assert.match(evidenceFilters.list.textContent, /没有匹配/);
assert.equal(filteredComparison.children.length, 2);
actions[0].run();
assert.equal(browseState.investigation.deductions.school, undefined, 'Filtering cannot turn unrelated support into a correct submission');
descendants(filteredComparison).find(node => node.textContent === `换掉：${CLUE_NAMES.medical_record}`).onclick();
assert.equal(document.activeElement, evidenceFilters.input, 'Removing a filtered-out card returns focus to the search input');
assert.equal(browseState.investigation.drafts.school.answer, CASES.school.answers[CASES.school.correct]);
evidenceFilters.input.value = ''; evidenceFilters.input.oninput(); selectEvidence(['school_report']);
evidenceFilters.source.value = Maps.room_main.name; evidenceFilters.source.onchange();
actions.find(action => action.label === '清空这份草稿').run();
assert.equal(browseState.investigation.drafts.school, undefined, 'Draft clearing must include cards hidden by a source filter');
evidenceFilters.clear.onclick();
assert.equal(descendants(evidenceFilters.list).some(node => node.attributes['aria-pressed'] === 'true'), false);
selectEvidence(CASES.school.required); selectAnswer('school', CASES.school.correct);
evidenceFilters.input.value = '没有这样的已读文字'; evidenceFilters.input.oninput();
let filteredSubmissions = 0;
window.showDialog = () => filteredSubmissions++;
actions[0].run();
assert.equal(filteredSubmissions, 1, 'A known selected pair can be explicitly submitted while its browser is filtered');
assert.equal(browseState.investigation.deductions.school, true);
window.showDialog = ordinaryDialog;
ui.journal();
assert.equal(filters().input.value, ''); assert.equal(filters().source.value, '', 'A new page starts with all found records visible');
assert.match(filters().count.textContent, /显示 5\/5/);
ui.state = state; ui.data = state.investigation; ui.scene = { currentMapId: 'room_main', playSound() {} };

const ritualAction = label => actions.find(action => action.label.endsWith(label));
const supplylessState = createDefaultGameState();
ui.state = supplylessState; ui.data = ensureInvestigation(supplylessState);
ui.ritual(() => completed++);
assert.doesNotMatch(body.textContent, /饭留其名|先摆倒头饭|供品都在手边/, 'An unread paper must not be invented by the ritual page');
assert.match(body.textContent, /南门还开着/, 'The table cannot invent a latched door before the portrait is uncovered');
assert.equal(inspectionStatus(supplylessState, 'room_main', { type: 'altar', obj: {} }), '可查看供桌');
ritualAction('摆上倒头饭').run();
assert.equal(supplylessState.investigation.ritualStep, 0, 'No material means no performed action');
assert.match(feedback.textContent, /还没有倒头饭/);
assert.equal(completed, 0);
Object.assign(supplylessState, { hasRice: true, hasMatches: true, hasIncense: true, hasSpiritMoney: true });
ritualAction('点燃香与烛').run(); // Available material, wrong first step.
assert.equal(completed, 0);
assert.ok(feedback.textContent.includes('顺序'));
assert.equal(actions[0].label, '点燃香与烛', 'The action list must not list the solution in order');
ritualAction('摆上倒头饭').run(); ritualAction('点燃香与烛').run(); ritualAction('焚纸引路').run();
assert.equal(completed, 1);
assert.equal(supplylessState.hasRice, true, 'Ritual actions do not consume reusable supply flags');

// Exercise the real altar callback: partial progress survives leaving, but the
// south door is released only after the third step. Reset removes its own lights.
const altarState = createDefaultGameState();
Object.assign(altarState, { hasRice: true, doorSlammed: true });
const display = () => ({ visible: false, setVisible(value) { this.visible = value; } });
const candle = () => ({ x: 10, y: 20, alpha: 0.3, setAlpha(value) { this.alpha = value; } });
const activeLights = new Set();
const southDoor = { targetMap: 'room_entrance', locked: true };
const altarScene = {
    currentMapId: 'room_main', gameState: altarState, investigationUI: ui, playSound() {},
    currentTarget: { type: 'altar', obj: { active: true, x: 384, y: 250 } },
    ritualOfferings: { rice: display(), incense: display(), ash: display() }, ritualLights: [],
    coffin: { texture: 'coffin', setTexture(key) { this.texture = key; } },
    leftCandle: candle(), rightCandle: candle(), doors: { getChildren: () => [southDoor] },
    lights: {
        addLight() { const light = { setColor() { return this; }, setIntensity() { return this; } }; activeLights.add(light); return light; },
        removeLight(light) { activeLights.delete(light); }
    }
};
ui.state = altarState; ui.data = ensureInvestigation(altarState); ui.scene = altarScene;
const altarInteraction = new InteractionManager(altarScene);
assert.equal(inspectionStatus(altarState, 'room_main', altarScene.currentTarget), '可试着守灯');
altarInteraction.handleInteraction();
assert.match(body.textContent, /南门的门闩仍扣着/);
assert.match(body.textContent, /手边有：倒头饭/);
assert.doesNotMatch(body.textContent, /饭留其名|先摆倒头饭/);
assert.deepEqual(altarState.investigation.notes, [], 'Inspecting the table does not read its nearby paper');
ritualAction('摆上倒头饭').run();
assert.equal(altarScene.ritualOfferings.rice.visible, true);
assert.equal(inspectionStatus(altarState, 'room_main', altarScene.currentTarget), '守灯未完');
ritualAction('点燃香与烛').run();
assert.match(feedback.textContent, /还没有火柴和香/);
assert.equal(altarState.investigation.ritualStep, 1, 'Unavailable materials preserve completed actions');
assert.equal(altarScene.ritualOfferings.rice.visible, true);
assert.equal(activeLights.size, 0);
assert.equal(southDoor.locked, true);
assert.match(getObjective(altarState, 'room_main')[1], /饭已摆上.*还缺材料/);
actions.at(-1).run();
saveCheckpoint(altarState, 'room_main', 384, 450);
assert.equal(readCheckpoint().state.investigation.ritualStep, 1, 'A partial ritual is checkpointed');
assert.equal(readCheckpoint().state.hasIncense, false, 'The partial save cannot grant uncollected supplies');
const knownRitualPaper = Maps.room_main.objects.interactables.find(item => item.id === 'ritual_note');
rememberDocument(altarState, 'room_main', knownRitualPaper.documentTitle, knownRitualPaper.documentText);
altarInteraction.handleInteraction();
assert.equal(ritualAction('摆上倒头饭').disabled, true, 'Completed steps cannot be repeated accidentally');
const paperDetail = body.children.find(node => node.className === 'case-note');
assert.equal(paperDetail.open, true);
assert.match(paperDetail.textContent, /饭留其名/);
assert.equal(altarState.investigation.notes.length, 1, 'Rereading at the table does not duplicate the paper');
Object.assign(altarState, { hasMatches: true, hasIncense: true, hasSpiritMoney: true });
ritualAction('焚纸引路').run(); // Burning paper before incense resets the display and progress.
assert.equal(altarState.investigation.ritualStep, 0);
assert.equal(altarScene.ritualOfferings.rice.visible, false);
ritualAction('摆上倒头饭').run(); ritualAction('点燃香与烛').run();
assert.equal(activeLights.size, 2);
assert.equal(altarState.candlesLit, 0, 'Visible flames alone do not complete the ritual');
assert.equal(altarScene.coffin.texture, 'coffin', 'Partial flames cannot slacken the ritual binding');
assert.equal(southDoor.locked, true);
ManorPresentation.syncRitual(altarScene, 2);
assert.equal(activeLights.size, 2, 'Updating partial progress cannot duplicate lights');
ManorPresentation.syncRitual(altarScene, 0);
assert.equal(activeLights.size, 0, 'A reset removes the ritual lights');
ManorPresentation.syncRitual(altarScene, 2);
actions.at(-1).run();
altarInteraction.handleInteraction();
assert.equal(ritualAction('点燃香与烛').disabled, true, 'Returning resumes the second completed step');
altarState.hasSpiritMoney = false;
ritualAction('焚纸引路').run();
assert.match(feedback.textContent, /还没有纸钱/);
assert.equal(altarState.investigation.ritualStep, 2);
assert.equal(activeLights.size, 2, 'Missing paper does not extinguish established candles');
assert.equal(southDoor.locked, true);
altarState.hasSpiritMoney = true;
const burn = ritualAction('焚纸引路').run;
burn(); burn();
assert.equal(altarScene.ritualOfferings.ash.visible, true);
assert.equal(altarState.candlesLit, true);
assert.equal(altarScene.coffin.texture, 'coffin_2', 'Completing the ritual immediately slackens only its own binding');
assert.equal(southDoor.locked, false);
assert.equal(activeLights.size, 2);
ui.state = state; ui.data = state.investigation;

const safeState = createDefaultGameState();
const safeProp = { active: true, x: 100, y: 350, setTexture(key) { this.texture = key; } };
const safeScene = { currentMapId: 'room_bedroom_parents', gameState: safeState, investigationUI: ui, safe: safeProp, playSound() {}, showHint() {}, currentTarget: { type: 'safe', obj: safeProp } };
ui.scene = safeScene; ui.state = safeState; ui.data = ensureInvestigation(safeState);
const safeInteraction = new InteractionManager(safeScene);
window.updateInventory = () => {};
const safeKey = key => ui.modalKeyHandler({ key, preventDefault() {} });
const safeDigit = key => descendants(body).find(node => node.textContent === key && node.onclick).onclick();
safeInteraction.handleInteraction();
assert.doesNotMatch(body.textContent, /1988|相框里的家规|湿纸条/, 'The safe must not reveal unfound records or the code');
safeKey('1'); safeDigit('9'); safeKey('9'); safeDigit('0');
actions[0].run();
assert.match(feedback.textContent, /锁钮没有松开/);
assert.equal(safeState.inventory.length, 0);
safeKey('Backspace');
assert.equal(descendants(body).find(node => node.className === 'case-safe-display').textContent, '1 9 9 —');
safeKey('Delete');
for (const key of '19889') safeKey(key);
assert.equal(descendants(body).find(node => node.className === 'case-safe-display').textContent, '1 9 8 8', 'Input is limited to four digits');
const abandonedSubmit = actions[0].run;
actions[1].run();
abandonedSubmit();
assert.equal(safeState.inventory.length, 0, 'Cancelling a correct code cannot grant the key');
assert.equal(ui.modalKeyHandler, null);
let rulesRead = '';
window.showDocument = (title, text) => { rulesRead = text; rememberDocument(safeState, safeScene.currentMapId, title, text); };
safeScene.currentTarget = { type: 'family_rules', obj: { active: true, x: 250, y: 50 } };
safeInteraction.handleInteraction();
assert.equal(rulesRead, Maps.room_bedroom_parents.objects.family_rules.documentText);
assert.equal(getEvidence(safeState).find(card => card.id === 'family_rules').text, rulesRead, 'The journal retains the actual year clue');
safeScene.currentTarget = { type: 'safe', obj: safeProp };
safeInteraction.handleInteraction();
assert.match(body.textContent, /结婚那年，一九□□/);
assert.doesNotMatch(body.textContent, /1988|□□八八|湿纸条/, 'The frame alone cannot reveal the other discovered fragment or complete code');
assert.equal(descendants(body).find(node => node.className === 'case-safe-display').textContent, '— — — —', 'Reopening clears abandoned input');
safeKey('Enter');
assert.match(feedback.textContent, /四只数字轮/);
actions[1].run();
safeScene.currentMapId = 'room_bathroom';
safeScene.currentTarget = { type: 'wet_paper', obj: { active: true, x: 150, y: 300 } };
safeInteraction.handleInteraction();
assert.equal(rulesRead, Maps.room_bathroom.objects.wet_paper.documentText);
safeScene.currentMapId = 'room_bedroom_parents';
safeScene.currentTarget = { type: 'safe', obj: safeProp };
safeInteraction.handleInteraction();
assert.match(body.textContent, /一九□□/);
assert.match(body.textContent, /□□八八/);
assert.doesNotMatch(body.textContent, /1988/, 'The panel displays originals without combining or filling the answer');
const safeOriginals = descendants(body).filter(node => node.className === 'case-note');
assert.equal(safeOriginals.length, 2, 'The evidence card and document remain a single frame record');
assert.ok(safeOriginals.every(note => note.open), 'Both read fragments are available for direct comparison');
for (const key of '1988') safeKey(key);
const submitAgain = actions[0].run;
safeKey('Enter');
submitAgain();
assert.deepEqual(safeState.inventory, ['地下室钥匙'], 'A correct explicit submission grants one key');
assert.equal(safeProp.texture, 'safe_open');
assert.equal(ui.modalKeyHandler, null);

// A prior save may already contain a full year. Keep that observed text; new
// players can also guess a correct code without satisfying a reading checklist.
const wetOnlySafeState = createDefaultGameState();
rememberDocument(wetOnlySafeState, 'room_bathroom', Maps.room_bathroom.objects.wet_paper.documentTitle, Maps.room_bathroom.objects.wet_paper.documentText);
ui.state = wetOnlySafeState; ui.data = ensureInvestigation(wetOnlySafeState);
ui.unlockSafe(() => {});
assert.match(body.textContent, /□□八八/);
assert.doesNotMatch(body.textContent, /一九□□|相框家规|1988/, 'Reading wet paper cannot discover the frame');
actions[1].run();
const legacySafeState = createDefaultGameState();
collectClue(legacySafeState, 'family_rules', 'control');
const legacySafeYear = '背面有母亲细小的字：结婚那年，1988。旁边画着一只小保险箱。';
rememberDocument(legacySafeState, 'room_bedroom_parents', Maps.room_bedroom_parents.objects.family_rules.documentTitle, legacySafeYear);
ui.state = legacySafeState; ui.data = ensureInvestigation(legacySafeState);
ui.unlockSafe(() => { throw new Error('Reading legacy records cannot unlock a safe'); });
assert.ok(body.textContent.includes(legacySafeYear), 'Legacy observations remain readable beside current records');
assert.equal(legacySafeState.investigation.notes[0].content, legacySafeYear);
assert.equal(descendants(body).find(node => node.className === 'case-safe-display').textContent, '— — — —');
actions[1].run();
const guessedSafeState = createDefaultGameState();
const guessedSafeProp = { ...safeProp };
ui.scene = { ...safeScene, gameState: guessedSafeState, safe: guessedSafeProp, currentTarget: { type: 'safe', obj: guessedSafeProp } };
ui.state = guessedSafeState; ui.data = ensureInvestigation(guessedSafeState);
new InteractionManager(ui.scene).handleInteraction();
assert.doesNotMatch(body.textContent, /一九□□|□□八八|1988/);
for (const key of '1988') safeKey(key);
actions[0].run();
assert.deepEqual(guessedSafeState.inventory, ['地下室钥匙'], 'The correct code works without collecting either fragment');
assert.deepEqual(guessedSafeState.storyFlags.collectedClues, []);
assert.deepEqual(guessedSafeState.investigation.notes, []);
ui.state = state; ui.data = state.investigation;

const cabinetState = createDefaultGameState();
const cabinetProp = { active: true, objId: 'parents_cabinet', x: 528, y: 240, displayWidth: 48, displayHeight: 64 };
// Match the documented StaticBody semantics: refresh resets size/position but
// leaves offset intact; setOffset adjusts position by the offset difference.
cabinetProp.body = {
    x: 504, y: 208, width: 48, height: 64, offset: { x: 0, y: 0 },
    setOffset(x, y) { this.x += x - this.offset.x; this.y += y - this.offset.y; this.offset = { x, y }; },
    setSize(width, height, center) { assert.equal(center, false); this.width = width; this.height = height; }
};
cabinetProp.refreshBody = () => Object.assign(cabinetProp.body, { x: cabinetProp.x - 24, y: cabinetProp.y - 32, width: 48, height: 64 });
const hiddenDoor = { targetMap: 'room_secret', visible: false, isHiddenDoor: true, body: { enable: false } };
const doorVisual = { visible: false, setVisible(value) { this.visible = value; } };
const movements = [];
const cabinetScene = {
    currentMapId: 'room_bedroom_parents', gameState: cabinetState, investigationUI: ui,
    currentTarget: { type: 'cabinet', obj: cabinetProp },
    player: { sprite: { body: { x: 480, y: 253, width: 20, height: 20 }, setVelocity() {} } },
    physics: { pause() {}, resume() {} }, tweens: { add: config => movements.push(config) }, playSound() {},
    doors: { getChildren: () => [hiddenDoor] }, secretDoorVisuals: [doorVisual]
};
ui.scene = cabinetScene; ui.state = cabinetState; ui.data = ensureInvestigation(cabinetState);
window.showDocument = (title, content) => rememberDocument(ui.state, ui.scene.currentMapId, title, content);
const cabinetInteraction = new InteractionManager(cabinetScene);
const inspectCabinet = () => {
    cabinetScene.currentTarget = { type: 'cabinet', obj: cabinetProp };
    cabinetInteraction.handleInteraction();
};
inspectCabinet();
assert.equal(movements.length, 0, 'Reading the cabinet must not move it automatically');
actions[0].run();
assert.match(ui.data.notes[0].content, /向左延伸/);
assert.equal(ui.data.notes[0].sourceMapId, 'room_bedroom_parents');
assert.equal(inspectionStatus(cabinetState, 'room_bedroom_parents', { type: 'cabinet', obj: cabinetProp }), '可试着挪动');
inspectCabinet(); actions[2].run();
assert.match(feedback.textContent, /抵着东墙/);
assert.equal(cabinetState.cabinetMoved, false);
actions[3].run();
assert.equal(movements.length, 0, 'Cancelling cannot reveal the door');
inspectCabinet(); actions[1].run();
assert.equal(movements.length, 0, 'The cabinet must not move onto the player');
cabinetScene.player.sprite.body = { x: 430, y: 300, width: 20, height: 20 };
inspectCabinet(); actions[1].run(); actions[1].run();
assert.equal(movements.length, 1, 'Repeated actions cannot stack movement');
assert.equal(cabinetScene.isManipulating, true);
assert.equal(InvestigationUI.prototype.modal.call({ scene: cabinetScene }, '手记', '', []), false, 'A new reading layer cannot interrupt furniture movement');
assert.equal(cabinetState.cabinetMoved, false, 'The passage opens after the movement finishes');
assert.equal(hiddenDoor.body.enable, false);
cabinetProp.x = 512; movements[0].onUpdate();
assert.ok(Math.abs(cabinetProp.body.x - 492.8) < 0.001);
assert.ok(Math.abs(cabinetProp.body.height - 19.2) < 0.001);
cabinetProp.x = 496; movements[0].onComplete();
assert.equal(cabinetScene.isManipulating, false);
assert.equal(cabinetState.cabinetMoved, true);
assert.equal(hiddenDoor.body.enable, true);
assert.equal(hiddenDoor.isHiddenDoor, false);
assert.equal(doorVisual.visible, true, 'The opening is visible immediately without re-entering');
MapManager.syncCabinetBody(cabinetProp); MapManager.syncCabinetBody(cabinetProp);
assert.ok(Math.abs(cabinetProp.body.x - 476.8) < 0.001, 'Repeated body synchronisation cannot drift');
assert.ok(Math.abs(cabinetProp.body.y - 252.8) < 0.001);
assert.deepEqual(cabinetState.storyFlags.collectedClues, [], 'Inspecting furniture cannot inflate truth counters');

// Bind the well through the actual factory: observation-only props still need
// an interaction identity. Cancellation and failed attempts cannot start pursuit.
function wellRoom(gameState) {
    const items = [];
    const wellScene = { currentMapId: 'room_backyard', gameState, isMobile: true, investigationUI: ui,
        interactables: { add: item => items.push(item), getChildren: () => items },
        playSound() {}, showHint() {}, spawnChaser() { this.spawns = (this.spawns || 0) + 1; } };
    const manager = new MapManager(wellScene);
    manager.furniture = { create: (x, y, key) => ({ x, y, active: true, texture: { key },
        setTexture(value) { this.texture.key = value; return this; } }) };
    manager.createObjects({ well: Maps.room_backyard.objects.well }, 'room_backyard');
    assert.equal(items[0], wellScene.well, 'The well must remain discoverable through the factory');
    wellScene.currentTarget = { type: 'well', obj: items[0] };
    return wellScene;
}
const wellState = createDefaultGameState();
const wellScene = wellRoom(wellState);
ui.scene = wellScene; ui.state = wellState; ui.data = ensureInvestigation(wellState);
const wellInteraction = new InteractionManager(wellScene);
const inspectWell = () => wellInteraction.handleInteraction();
let keysGranted = 0, chaseDialog;
window.updateInventory = item => { assert.equal(item, '血红钥匙'); keysGranted++; };
window.showDialog = (_name, _text, callback) => { chaseDialog = callback; };
inspectWell(); actions[3].run();
assert.equal(wellState.hasRedKey, false);
inspectWell(); actions[2].run();
assert.match(feedback.textContent, /钩尖/);
assert.equal(wellState.hasRedKey, false);
assert.equal(wellScene.spawns, undefined);
actions[0].run();
assert.equal(ui.data.notes[0].content, Maps.room_backyard.objects.well.observationText);
assert.deepEqual(wellState.storyFlags.collectedClues, [], 'Looking at the hook cannot add a truth clue');
inspectWell(); actions[1].run();
assert.match(body.textContent, /取走钥匙会引来追逐/);
assert.equal(wellState.hasRedKey, false, 'Choosing a valid motion still needs risk confirmation');
actions[1].run();
assert.equal(wellState.hasRedKey, false, 'Cancelling confirmation keeps the key on its hook');
assert.equal(wellScene.well.texture.key, 'well');
assert.equal(keysGranted, 0);
assert.equal(wellScene.spawns, undefined);
saveCheckpoint(wellState, 'room_backyard', 320, 390);
assert.equal(wellRoom(readCheckpoint().state).well.texture.key, 'well');
inspectWell(); actions[1].run();
const takeKey = actions[0].run;
takeKey(); takeKey();
assert.equal(keysGranted, 1, 'Repeated confirmation cannot grant or trigger twice');
assert.equal(wellScene.well.texture.key, 'well_empty', 'Taking the key changes the object immediately');
assert.equal(wellState.hasRedKey, true);
assert.equal(wellState.isChasing, false, 'The acquisition response finishes before pursuit starts');
assert.equal(wellScene.spawns, undefined);
chaseDialog();
assert.equal(wellState.isChasing, true);
assert.equal(wellScene.spawns, 1);
assert.ok(wellState.storyFlags.collectedClues.includes('well_red_key'));
inspectWell();
assert.equal(keysGranted, 1);
wellState.isChasing = false;
saveCheckpoint(wellState, 'room_backyard', 320, 390);
assert.equal(wellRoom(readCheckpoint().state).well.texture.key, 'well_empty', 'A safe save restores the empty hook');
// A correct guess is allowed without requiring a prior inspection click.
const guessState = createDefaultGameState();
const guessScene = wellRoom(guessState);
ui.scene = guessScene; ui.state = guessState; ui.data = ensureInvestigation(guessState);
new InteractionManager(guessScene).handleInteraction(); actions[1].run(); actions[0].run();
assert.equal(guessState.hasRedKey, true);
assert.equal(ui.data.notes.length, 0);
window.showDialog = (_name, _text, callback) => callback?.();
ui.state = state; ui.data = state.investigation;

let switched = null;
state.investigation.deductions.school = false;
state.storyFlags.memories.school = false;
const scene = {
    gameState: state, investigationUI: ui, currentMapId: 'memory_school',
    currentTarget: { type: 'story_object', obj: { active: true, memoryComplete: 'school', memoryReturn: { mapId: 'room_study', x: 330, y: 290 } } },
    switchScene: map => { switched = map; }, showHint() {}, playSound() {}
};
ui.scene = scene;
const interaction = new InteractionManager(scene);
interaction.handleInteraction();
assert.equal(switched, null, 'Inspecting the final prop must not auto-complete the memory');
actions.find(action => action.label === '对照已读物证').run();
selectEvidence(CASES.school.required);
selectAnswer('school', CASES.school.correct);
actions.at(-1).run();
assert.equal(state.storyFlags.memories.school, false, 'Cancelling must leave the memory unfinished');
assert.equal(state.investigation.deductions.school, false, 'Selecting without submitting does not commit a deduction');
interaction.handleInteraction();
assert.equal(switched, null, 'Reopening a draft cannot submit it or return from the memory');
actions.find(action => action.label === '对照已读物证').run();
for (const clue of CASES.school.required) assert.ok(descendants(body).some(node => node.textContent === `已选：${CLUE_NAMES[clue]}`));
actions.find(action => action.label === '清空这份草稿').run();
actions[0].run();
assert.equal(switched, null, 'An explicitly cleared draft must require new selections');
selectEvidence(CASES.hospital.required);
selectAnswer('school', CASES.school.correct);
actions[0].run();
assert.equal(switched, null, 'A correct explanation with unrelated evidence must not complete the memory');
for (const id of CASES.hospital.required) descendants(body).find(node => node.textContent === `已选：${CLUE_NAMES[id]}`).onclick();
selectEvidence(CASES.school.required);
actions[0].run();
assert.equal(state.storyFlags.memories.school, true);
assert.equal(switched, null, 'A supported submission returns to the record, leaving scene departure voluntary');
assert.match(body.textContent, /已经拼合/);
actions.find(action => action.label.startsWith('回到')).run();
assert.equal(switched, 'room_study');

scene.currentMapId = 'memory_crash';
interaction.handleEndingChoice('return');
assert.equal(state.storyFlags.endingChoice, null, 'Approaching an ending must not select it');
actions[1].run();
assert.equal(state.storyFlags.endingChoice, null, 'Cancelling an ending must preserve player choice');
interaction.handleEndingChoice('return');
actions[0].run();
assert.equal(state.storyFlags.endingChoice, 'return');
assert.equal(switched, 'room_memory');

globalThis.Phaser = {
    Math: { Clamp: (n, min, max) => Math.max(min, Math.min(max, n)), Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) } },
    Input: { Keyboard: { JustDown: () => false } }
};
const focusText = { setText(text) { this.text = text; return this; }, setPosition() { return this; }, setVisible(visible) { this.visible = visible; return this; } };
const nearbyPaper = { active: true, x: 170, y: 200, objId: 'nearby_paper', documentText: '纸上的字' };
const nearbyGhost = { active: true, visible: true, x: 230, y: 200, objId: 'kitchen_ghost' };
const focusScene = {
    currentMapId: 'memory_school', gameState: createDefaultGameState(), player: { sprite: { x: 160, y: 200 } },
    npc: nearbyGhost, interactables: { getChildren: () => [nearbyGhost, nearbyPaper] }, interactText: focusText
};
const focusManager = new InteractionManager(focusScene);
focusManager.checkInteraction();
assert.equal(focusScene.currentTarget.obj, nearbyPaper, 'A nearby NPC must not steal focus from a much closer clue');
examineObject(focusScene.gameState, 'memory_school', focusScene.currentTarget);
focusManager.checkInteraction();
assert.match(focusText.text, /已调查/);
window.dialogActive = true;
focusManager.checkInteraction();
assert.equal(focusScene.currentTarget, null, 'Opening a dialog clears stale touch targets');
assert.equal(focusText.visible, false);
window.dialogActive = false;

// Discover the bedroom book and hiding cabinet through the real factory and
// focus, rather than manually supplying a target that may not exist in play.
const diaryState = createDefaultGameState();
const bedroomItems = [], bedroomFurniture = [];
const bedroomProp = (x, y, key) => ({ x, y, active: true, visible: true, depth: 0, width: 32, height: 32, texture: { key },
    setDepth(value) { this.depth = value; return this; }, setPipeline() { return this; } });
const bedroomGraphics = { setDepth() { return this; }, fillStyle() {}, fillRect() {}, fillEllipse() {}, clear() {}, lineStyle() {}, lineBetween() {} };
let bedroomHides = 0, earlyDiary = '';
const bedroomScene = { currentMapId: 'room_bedroom_me', gameState: diaryState, isMobile: true,
    player: { sprite: { x: 100, y: 104 } }, interactText: focusText, showHint() {}, triggerFlashback() {},
    toggleHide() { bedroomHides++; }, physics: { add: { existing() {} } },
    add: { image: bedroomProp, graphics: () => bedroomGraphics, particles: () => ({ setDepth() {} }) },
    interactables: { add: item => bedroomItems.push(item), getChildren: () => bedroomItems },
    furniture: { create(x, y, key) { const item = bedroomProp(x, y, key); bedroomFurniture.push(item); return item; }, getChildren: () => bedroomFurniture } };
const bedroomObjects = Maps.room_bedroom_me.objects;
const bedroomFactory = new MapManager(bedroomScene);
bedroomFactory.furniture = bedroomScene.furniture;
const bedroomProps = { diary: bedroomObjects.diary, desk: bedroomObjects.desk, cabinet: bedroomObjects.cabinet };
bedroomFactory.createObjects(bedroomProps, 'room_bedroom_me');
new ManorPresentation(bedroomScene, { ...Maps.room_bedroom_me, objects: bedroomProps });
assert.equal(bedroomItems.filter(item => item === bedroomScene.diary).length, 1, 'The book is registered for actual discovery');
assert.equal(bedroomFurniture.includes(bedroomScene.diary), false, 'A book on the desk cannot add a furniture obstacle');
assert.ok(bedroomScene.diary.depth > bedroomScene.desk.depth, 'The desk cannot paint over its diary');
const bedroomReader = new InteractionManager(bedroomScene);
bedroomReader.checkInteraction();
assert.equal(bedroomScene.currentTarget.obj, bedroomScene.diary);
assert.equal(bedroomScene.currentTarget.type, 'diary');
assert.match(focusText.text, /母亲留下的日记/);
assert.deepEqual(diaryState.storyFlags.collectedClues, [], 'Approaching the diary does not collect it');
window.showDocument = (title, content) => { earlyDiary = content; rememberDocument(diaryState, 'room_bedroom_me', title, content); };
bedroomReader.handleInteraction();
assert.equal(earlyDiary, bedroomObjects.diary.documentText);
assert.doesNotMatch(earlyDiary, /车祸|十年|带走了他/, 'An ordinary bedroom diary must not state the accident reveal');
assert.equal(diaryState.storyFlags.clues.illness, 1);
assert.deepEqual(diaryState.clues, ['diary']);
const diaryCard = getEvidence(diaryState).find(card => card.id === 'diary_mother');
assert.equal(diaryCard.text, earlyDiary);
assert.equal(diaryCard.sourceMapId, 'room_bedroom_me');
bedroomReader.checkInteraction(); bedroomReader.handleInteraction();
assert.equal(diaryState.storyFlags.clues.illness, 1);
assert.equal(diaryState.investigation.notes.length, 1);
assert.equal(getJournalEntries(diaryState).filter(card => card.text === earlyDiary).length, 1, 'Legacy diary text and evidence stay one entry');
bedroomScene.player.sprite = { x: 400, y: 320 };
bedroomReader.checkInteraction();
assert.equal(bedroomScene.currentTarget.obj, bedroomScene.cabinet);
assert.match(focusText.text, /可躲藏/);
bedroomReader.handleInteraction();
assert.equal(bedroomHides, 1, 'The authored bedroom cabinet must actually dispatch hiding');

// Bind opening observations through the real map factory and select/read them
// through InteractionManager. They add notes, not mandatory truth counters.
const roomTextureSizes = new Map();
ManorPresentation.generateTextures({ textures: { exists: () => false, createCanvas(key, width, height) {
    roomTextureSizes.set(key, { width, height });
    return { getContext: () => ({ fillRect() {} }), refresh() {} };
} } });
function openingRoom(mapId, gameState = createDefaultGameState()) {
    const items = [], furniture = [], images = [];
    const prop = (x, y, key) => {
        const { width, height } = key === 'player_sheet' ? { width: 32, height: 48 } : roomTextureSizes.get(key) || { width: 32, height: 32 };
        const item = { x, y, width, height, displayWidth: width, displayHeight: height, originX: 0.5, originY: 0.5, scaleX: 1, scaleY: 1, depth: 0,
            texture: { key }, active: true, visible: true,
            setTint() { return this; }, setPipeline() { return this; }, setAlpha() { return this; }, setBlendMode() { return this; }, setCollideWorldBounds() { return this; },
            setOrigin(x, y = x) { this.originX = x; this.originY = y; return this; }, setDepth(value) { this.depth = value; return this; },
            setScale(value) { this.scaleX = this.scaleY = value; this.displayWidth = this.width * value; this.displayHeight = this.height * value; return this; } };
        images.push(item); return item;
    };
    const existing = item => { item.body = { enable: true, offset: { x: 0, y: 0 }, width: item.displayWidth, height: item.displayHeight,
        get x() { return item.x - item.displayWidth * item.originX + this.offset.x; }, get y() { return item.y - item.displayHeight * item.originY + this.offset.y; },
        setSize(width, height) { this.width = width; this.height = height; return this; }, setOffset(x, y) { this.offset = { x, y }; return this; },
        updateFromGameObject() { this.width = item.displayWidth; this.height = item.displayHeight; }, reset(x, y) { item.x = x; item.y = y; } }; return item; };
    const group = { create(x, y, key) { const item = existing(prop(x, y, key)); item.refreshBody = () => { item.body.updateFromGameObject(); return item; }; furniture.push(item); return item; }, add(item) { furniture.push(item); }, getChildren: () => furniture };
    const graphics = { setDepth() { return this; }, fillStyle() {}, fillRect() {}, fillEllipse() {}, clear() {}, lineStyle() {}, lineBetween() {} };
    const scene = { currentMapId: mapId, gameState, isMobile: true,
        player: { sprite: { x: 0, y: 0 } }, interactText: focusText,
        furniture: group, images, anims: { exists: () => true }, input: { keyboard: { addKey: () => ({}) } },
        interactables: { add: item => items.push(item), getChildren: () => items },
        physics: { add: { existing, sprite: (x, y, key) => existing(prop(x, y, key)) } },
        add: { image: prop, graphics: () => graphics, particles: () => ({ setDepth() {} }) }, playSound() {}, showHint() {} };
    const mapManager = new MapManager(scene);
    mapManager.furniture = group; scene.mapManager = mapManager;
    const objects = Maps[mapId].objects;
    mapManager.createObjects({ crashed_car: objects.crashed_car, locked_window: objects.locked_window, furnishings: objects.furnishings, interactables: objects.interactables }, mapId);
    scene.reader = new InteractionManager(scene);
    window.showDocument = (title, content) => rememberDocument(scene.gameState, scene.currentMapId, title, content);
    return scene;
}

// Authored furniture has real footprints, but does not become a row of new
// tasks. Use the real Player constructor to obtain its frame/body contract.
Phaser.BlendModes = { ADD: 'add' };
Phaser.Input.Keyboard.KeyCodes = { SHIFT: 'shift' };
for (const mapId of ['memory_school', 'memory_hospital', 'memory_crash']) {
    const map = Maps[mapId], room = openingRoom(mapId);
    new ManorPresentation(room, map);
    assert.equal(room.interactables.getChildren().length, map.objects.interactables.length, 'Background furnishings cannot steal clue focus');
    assert.deepEqual(room.gameState.storyFlags.collectedClues, []);
    const start = map.objects.playerStart;
    const player = new Player(room, start.x, start.y);
    const sprite = player.sprite;
    room.player = player;
    const free = (x, y) => {
        const left = x - sprite.displayWidth * sprite.originX + sprite.body.offset.x;
        const top = y - sprite.displayHeight * sprite.originY + sprite.body.offset.y;
        const right = left + sprite.body.width, bottom = top + sprite.body.height;
        for (let ty = Math.floor(top / 32); ty <= Math.floor((bottom - 0.01) / 32); ty++) for (let tx = Math.floor(left / 32); tx <= Math.floor((right - 0.01) / 32); tx++) if (map.data[ty]?.[tx] !== 0) return false;
        return room.furniture.getChildren().every(item => left >= item.body.x + item.body.width || right <= item.body.x || top >= item.body.y + item.body.height || bottom <= item.body.y);
    };
    room.mapManager.restorePlayerStart(sprite);
    assert.deepEqual([sprite.x, sprite.y], [start.x, start.y], 'Valid existing entry coordinates stay untouched');
    assert.ok(free(sprite.x, sprite.y));
    // An 8px flood fill covers actual player clearance and four directions,
    // rather than assuming tile centers represent a navigable aisle.
    const queue = [{ x: start.x, y: start.y }], visited = new Set([`${start.x},${start.y}`]);
    for (let index = 0; index < queue.length; index++) for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
        const x = queue[index].x + dx, y = queue[index].y + dy, key = `${x},${y}`;
        if (visited.has(key) || !free(x, y)) continue;
        visited.add(key); queue.push({ x, y });
    }
    const approaches = new Map();
    for (const item of room.interactables.getChildren()) {
        const approach = queue.find(point => {
            sprite.x = point.x; sprite.y = point.y; room.currentTarget = null; room.reader.checkInteraction();
            return room.currentTarget?.obj === item;
        });
        assert.ok(approach, `${mapId}:${item.objId} needs a reachable point with actual interaction focus`);
        approaches.set(item.objId, approach);
        if (['school_report', 'school_final_stack', 'hospital_return'].includes(item.objId)) {
            const desk = room.furniture.getChildren().find(prop => Math.abs(prop.x - item.x) < 1 && Math.abs(prop.y - item.y) <= 10);
            assert.ok(desk && item.depth > desk.depth, 'Desk papers must draw above their supporting surface');
        }
    }
    for (const item of room.furniture.getChildren()) {
        assert.equal(item.body.immovable, true);
        const authored = [...map.objects.furnishings, ...map.objects.interactables].find(data => data.collision && data.x === item.x && data.y === item.y && data.texture === item.texture.key);
        assert.deepEqual([item.body.x, item.body.y, item.body.width, item.body.height], [authored.x - item.width / 2 + authored.collision.x, authored.y - item.height / 2 + authored.collision.y, authored.collision.width, authored.collision.height], 'Factory bodies must retain their authored offset after joining both static groups');
        sprite.x = item.body.x + item.body.width / 2;
        sprite.y = item.body.y + item.body.height / 2;
        const previous = { x: sprite.x, y: sprite.y };
        assert.equal(free(sprite.x, sprite.y), false);
        room.mapManager.restorePlayerStart(sprite);
        assert.ok(free(sprite.x, sprite.y), 'A legacy saved point inside new furniture moves onto clear floor');
        assert.ok(Math.hypot(previous.x - sprite.x, previous.y - sprite.y) <= 96, 'Furniture recovery stays near the original saved point');
        assert.ok(queue.some(point => Math.hypot(point.x - sprite.x, point.y - sprite.y) < 12), 'The recovered point stays in the reachable room area');
    }
    if (mapId === 'memory_crash') {
        const choices = room.interactables.getChildren().filter(item => item.endingChoice);
        const inspect = item => {
            Object.assign(sprite, approaches.get(item.objId)); room.currentTarget = null;
            room.reader.checkInteraction();
            assert.equal(room.currentTarget?.obj, item);
            room.reader.handleInteraction();
        };
        ui.scene = room; ui.state = room.gameState; ui.data = ensureInvestigation(room.gameState); room.investigationUI = ui;
        const leave = choices.find(item => item.endingChoice === 'leave'), back = choices.find(item => item.endingChoice === 'return');
        assert.ok(back.x < start.x + 80 && leave.x > 800, 'Returning stays on the entry side; leaving follows the road east');
        inspect(back);
        assert.equal(room.gameState.storyFlags.endingChoice, null);
        assert.equal(room.gameState.investigation.deductions.death, undefined, 'Going to a destination before proof cannot select an ending');
        actions.find(action => action.label === '继续调查').run();
        for (const item of room.interactables.getChildren().filter(item => item.clueId)) inspect(item);
        assert.deepEqual(new Set(room.gameState.storyFlags.collectedClues), new Set(CASES.death.required));
        ui.solve('death'); selectEvidence(CASES.death.required); selectAnswer('death', CASES.death.correct); actions[0].run();
        assert.equal(room.gameState.investigation.deductions.death, true);
        assert.match(getObjective(room.gameState, mapId)[1], /东侧.*山路.*西侧.*老宅/);
        const previousEnding = window.showEndingScreen, endings = [], transitions = [];
        window.showEndingScreen = title => endings.push(title);
        room.switchScene = (...args) => transitions.push(args);
        room.physics.pause = () => {};
        for (const item of [back, leave]) {
            room.gameState.storyFlags.endingChoice = null;
            inspect(item);
            assert.equal(room.gameState.storyFlags.endingChoice, null);
            const previousTransitions = transitions.length, previousEndings = endings.length;
            actions[1].run();
            assert.equal(room.gameState.storyFlags.endingChoice, null, 'Cancelling a physical destination preserves the choice');
            assert.equal(transitions.length, previousTransitions); assert.equal(endings.length, previousEndings);
            inspect(item); actions[0].run();
            assert.equal(room.gameState.storyFlags.endingChoice, item.endingChoice);
            if (item.endingChoice === 'return') assert.deepEqual(transitions.at(-1), ['room_memory', 320, 400]);
            else assert.match(endings.at(-1), /归路/);
        }
        if (previousEnding === undefined) delete window.showEndingScreen; else window.showEndingScreen = previousEnding;
    }
}
const road = openingRoom('room_prologue');
assert.equal(road.gameState.viewedIntro, false);
assert.doesNotMatch(getObjective(road.gameState, 'room_main')[1], /黑布/, 'The exact lead comes from finding the letter or requesting a hint');
road.player.sprite = { x: 480, y: 250 };
road.reader.checkInteraction();
assert.equal(road.currentTarget.type, 'story_object', 'The parked car must use document inspection');
road.reader.handleInteraction();
assert.match(ensureInvestigation(road.gameState).notes[0].content, /月牙形划痕/);
assert.equal(road.gameState.investigation.notes[0].sourceMapId, 'room_prologue');
assert.doesNotMatch(ensureInvestigation(road.gameState).notes[0].content, /十年前|血红|已经死亡|黑烟/);
road.player.sprite = { x: 300, y: 200 };
road.reader.checkInteraction();
assert.equal(road.currentTarget.obj.objId, 'return_letter');
road.reader.handleInteraction();
assert.equal(road.gameState.viewedIntro, true, 'The arrival observation is marked only by actual inspection');
assert.match(getObjective(road.gameState, 'room_prologue')[1], /供桌右侧/);
assert.match(getObjective(road.gameState, 'room_main')[1], /供桌右侧的黑布/);
assert.deepEqual(road.gameState.storyFlags.collectedClues, [], 'Optional opening observations do not alter ending counters');
const gate = openingRoom('room_entrance');
gate.player.sprite = { x: 432, y: 100 };
gate.reader.checkInteraction(); gate.reader.handleInteraction();
assert.equal(gate.gameState.viewedEntrance, true);
assert.equal(ensureInvestigation(gate.gameState).notes[0].title, '门柱上的旧刻痕');
assert.equal(Maps.room_entrance.objects.car, undefined, 'There is one physical opening car');
assert.match(Maps.memory_crash.objects.interactables.find(item => item.clueId === 'crash_car_memory').documentText, /月牙形划痕/);

// A visible window remains an observation, not an escape route. Its original
// control clue, legacy flag and journal card all come from the actual reading.
const windowRoom = openingRoom('room_corridor');
const boardedWindowRecord = Maps.room_corridor.objects.locked_window;
assert.equal(windowRoom.locked_window.texture.key, 'boarded_window');
assert.equal(windowRoom.interactables.getChildren().filter(item => item === windowRoom.locked_window).length, 1);
assert.deepEqual(windowRoom.gameState.storyFlags.collectedClues, [], 'Seeing the window does not collect it');
windowRoom.player.sprite = { x: 80, y: 100 };
windowRoom.reader.checkInteraction();
assert.equal(windowRoom.currentTarget.type, 'locked_window', 'Window documents retain their dedicated legacy behavior');
assert.match(focusText.text, /钉死的窗/);
windowRoom.reader.handleInteraction();
assert.equal(windowRoom.gameState.storyFlags.clues.control, 1);
assert.deepEqual(windowRoom.gameState.clues, ['window']);
assert.equal(windowRoom.gameState.investigation.notes[0].content, boardedWindowRecord.documentText);
const windowCard = getEvidence(windowRoom.gameState).find(card => card.id === 'locked_window');
assert.equal(windowCard.text, boardedWindowRecord.documentText);
assert.equal(windowCard.sourceMapId, 'room_corridor');
assert.equal(getJournalEntries(windowRoom.gameState).filter(card => card.text === boardedWindowRecord.documentText).length, 1);
windowRoom.reader.checkInteraction();
assert.match(focusText.text, /已调查/);
windowRoom.reader.handleInteraction();
assert.equal(windowRoom.gameState.storyFlags.clues.control, 1, 'Rereading cannot inflate ending counters');
assert.equal(windowRoom.gameState.investigation.notes.length, 1);
const legacyWindow = createDefaultGameState();
collectClue(legacyWindow, 'locked_window', 'control');
assert.equal(getEvidence(legacyWindow)[0].text, boardedWindowRecord.documentText, 'Existing discovered windows gain a readable source without recollection');

// Optional environmental text must be found and read in its room before it is
// retained. Brick-wall writing stays readable from the adjacent floor tile.
for (const mapId of ['room_secret', 'room_basement']) {
    const archiveState = createDefaultGameState(), archiveRoom = openingRoom(mapId, archiveState);
    const approaches = {
        secret_workbench_notes: [300, 320], secret_red_words: [100, 120],
        basement_old_scratches: [304, 304], basement_route_note: [688, 688], basement_hidden_note: [400, 624]
    };
    const records = Maps[mapId].objects.interactables;
    assert.deepEqual(ensureInvestigation(archiveState).notes, [], 'Room creation cannot read environmental records');
    for (const [index, record] of records.entries()) {
        const [x, y] = approaches[record.id];
        assert.equal(Maps[mapId].data[Math.floor(y / 32)][Math.floor(x / 32)], 0, 'The authored reading approach lies on floor');
        archiveRoom.player.sprite = { x, y };
        archiveRoom.reader.checkInteraction();
        assert.equal(archiveRoom.currentTarget.obj.objId, record.id);
        assert.match(focusText.text, new RegExp(record.documentTitle));
        archiveRoom.reader.handleInteraction();
        assert.equal(archiveState.investigation.notes.length, index + 1);
        const note = archiveState.investigation.notes.at(-1);
        assert.equal(note.content, record.documentText);
        assert.equal(note.sourceMapId, mapId);
        archiveRoom.reader.checkInteraction(); archiveRoom.reader.handleInteraction();
        assert.equal(archiveState.investigation.notes.length, index + 1, 'Rereading optional text cannot duplicate a page');
    }
    assert.deepEqual(archiveState.storyFlags.collectedClues, [], 'Environmental records cannot inflate truth or ending counts');
    const [savedArchiveX, savedArchiveY] = approaches[records.at(-1).id];
    saveCheckpoint(archiveState, mapId, savedArchiveX, savedArchiveY);
    const restoredArchive = getJournalEntries(readCheckpoint().state);
    assert.equal(restoredArchive.length, records.length);
    assert.ok(records.every(record => restoredArchive.some(card => card.name === record.documentTitle && card.text === record.documentText && card.sourceMapId === mapId)));
}

// Supply inspection offers a deliberate pickup and restores the depleted world
// from the existing state, without creating another truth clue or supply flag.
const supplyDialog = window.showDialog, supplyInventory = window.updateInventory;
for (const [mapId, objectKey] of [['room_kitchen', 'cabinet'], ['room_secret', 'desk']]) {
    const source = Maps[mapId].objects[objectKey], supply = source.supply;
    let grants = [], responses = [], dollEvents = 0;
    window.updateInventory = name => grants.push(name);
    window.showDialog = (_name, text, callback) => responses.push({ text, callback });
    const supplyRoom = gameState => {
        const items = [];
        const room = { currentMapId: mapId, gameState, isMobile: true, investigationUI: ui,
            interactables: { add: item => items.push(item), getChildren: () => items },
            player: { sprite: { x: source.x + 35, y: source.y + 35 } }, interactText: focusText,
            eventManager: { triggerPaperDollEvent() { dollEvents++; } }, playSound() {} };
        const factory = new MapManager(room);
        factory.furniture = { create: (x, y, key) => ({ x, y, active: true, visible: true, texture: { key },
            setTexture(value) { this.texture.key = value; return this; }, setPipeline() { return this; } }) };
        factory.createObjects({ [objectKey]: source }, mapId);
        room.reader = new InteractionManager(room);
        room.reader.checkInteraction();
        assert.equal(room.currentTarget.type, objectKey, 'Supply variants retain furniture dispatch');
        return room;
    };
    const supplyState = createDefaultGameState(), room = supplyRoom(supplyState);
    const furniture = room[objectKey];
    assert.equal(furniture.texture.key, supply.texture);
    room.reader.handleInteraction();
    assert.ok(body.textContent.includes(supply.text));
    assert.equal(supplyState[supply.flag], false, 'Inspecting a supply cannot automatically take it');
    assert.equal(responses.length, 0, 'Supply inspection does not prepend a forced dialogue');
    const abandonedPickup = actions[0].run;
    actions[1].run(); abandonedPickup();
    assert.equal(supplyState[supply.flag], false);
    assert.deepEqual(grants, []);
    assert.equal(furniture.texture.key, supply.texture);
    room.reader.handleInteraction();
    const pickup = actions[0].run;
    pickup(); pickup();
    assert.equal(supplyState[supply.flag], true);
    assert.deepEqual(grants, [supply.name]);
    assert.equal(furniture.texture.key, supply.emptyTexture);
    assert.equal(responses.length, 1, 'Pickup produces one response even after repeated input');
    assert.equal(responses[0].text, supply.takenText);
    assert.equal(dollEvents, 0, 'The old kitchen response waits until pickup text is read');
    responses[0].callback?.();
    assert.equal(dollEvents, mapId === 'room_kitchen' ? 1 : 0);
    room.reader.checkInteraction();
    assert.match(focusText.text, objectKey === 'cabinet' ? /已取饭/ : /已取火柴/);
    room.reader.handleInteraction();
    assert.equal(responses.at(-1).text, supply.emptyText);
    assert.deepEqual(grants, [supply.name]);
    assert.deepEqual(supplyState.storyFlags.collectedClues, []);
    saveCheckpoint(supplyState, mapId, source.x + 35, source.y + 35);
    assert.equal(supplyRoom(readCheckpoint().state)[objectKey].texture.key, supply.emptyTexture, 'Save reload restores the taken appearance');
    assert.equal(supplyRoom(supplyState)[objectKey].texture.key, supply.emptyTexture, 'Room reentry retains the taken appearance');
    assert.equal(supplyRoom(createDefaultGameState())[objectKey].texture.key, supply.texture, 'Restart restores the original supply');
}
window.showDialog = supplyDialog; window.updateInventory = supplyInventory;

// Opening the portrait is a deliberate world action; plain inspection and
// cancellation leave its cover and the south door untouched.
function portraitRoom(gameState) {
    const items = [], sounds = [];
    const door = { targetMap: 'room_entrance', locked: !!gameState.doorSlammed && !gameState.candlesLit };
    const room = { currentMapId: 'room_main', gameState, isMobile: true, investigationUI: ui,
        interactables: { add: item => items.push(item), getChildren: () => items },
        doors: { getChildren: () => [door] }, physics: { add: { existing() {} } },
        add: { image: (x, y, key) => ({ x, y, active: true, texture: { key }, setTexture(value) { this.texture.key = value; return this; } }) },
        playSound: (...args) => sounds.push(args), showHint() {} };
    new MapManager(room).createObjects({ black_cloth: Maps.room_main.objects.black_cloth }, 'room_main');
    assert.equal(items[0], room.black_cloth, 'The new portrait image must remain registered for interaction');
    room.currentTarget = { type: 'black_cloth', obj: items[0] };
    return { room, door, sounds };
}
const portraitState = createDefaultGameState();
const { room: portraitScene, door: portraitDoor, sounds: portraitSounds } = portraitRoom(portraitState);
ui.scene = portraitScene; ui.state = portraitState; ui.data = ensureInvestigation(portraitState);
const portraitReader = new InteractionManager(portraitScene);
const portraitRecord = Maps.room_main.objects.black_cloth;
const ritualRecord = Maps.room_main.objects.interactables.find(item => item.id === 'ritual_note');
window.showDocument = (title, content) => rememberDocument(ui.state, ui.scene.currentMapId, title, content);
const inspectPortrait = () => portraitReader.handleInteraction();
assert.equal(portraitScene.black_cloth.texture.key, 'portrait_covered');
inspectPortrait();
assert.doesNotMatch(body.textContent, /父亲|李明收/, 'The covered inspection must not reveal the hidden portrait or name');
actions[2].run();
assert.equal(portraitState.doorSlammed, false);
assert.equal(portraitDoor.locked, false);
assert.equal(ui.data.notes.length, 0);
inspectPortrait(); actions[0].run();
assert.equal(ui.data.notes[0].content, portraitRecord.observationText);
assert.doesNotMatch(ui.data.notes[0].content, /父亲的遗像|李明收/);
assert.equal(portraitScene.black_cloth.texture.key, 'portrait_covered');
assert.equal(inspectionStatus(portraitState, 'room_main', portraitScene.currentTarget), '黑布未揭');
assert.equal(portraitSounds.length, 0);
saveCheckpoint(portraitState, 'room_main', 452, 270);
assert.equal(portraitRoom(readCheckpoint().state).room.black_cloth.texture.key, 'portrait_covered');
inspectPortrait();
const uncover = actions[1].run;
uncover(); uncover();
assert.equal(portraitScene.black_cloth.texture.key, 'portrait_father', 'Uncovering changes the image immediately');
assert.equal(portraitState.doorSlammed, true);
assert.equal(portraitDoor.locked, true);
assert.equal(portraitSounds.length, 1, 'Repeated action cannot replay the latch');
assert.equal(inspectionStatus(portraitState, 'room_main', portraitScene.currentTarget), '遗像已显露');
assert.equal(ui.data.notes.find(note => note.title === ritualRecord.documentTitle).content, ritualRecord.documentText);
assert.equal(ui.data.notes.find(note => note.title === ritualRecord.documentTitle).sourceMapId, 'room_main');
assert.equal(ui.data.notes.find(note => note.title === portraitRecord.documentTitle).content, portraitRecord.documentText);
inspectPortrait(); actions[1].run();
assert.equal(ui.data.notes.filter(note => note.title === ritualRecord.documentTitle).length, 1);
assert.equal(portraitSounds.length, 1, 'Rereading cannot replay the closure');
assert.deepEqual(portraitState.storyFlags.collectedClues, [], 'Opening observations cannot inflate ending evidence');
saveCheckpoint(portraitState, 'room_main', 452, 270);
assert.equal(portraitRoom(readCheckpoint().state).room.black_cloth.texture.key, 'portrait_father');
portraitState.candlesLit = true;
portraitDoor.locked = false;
inspectPortrait(); actions[2].run();
assert.equal(portraitDoor.locked, false, 'Returning after the ritual must never relock the south door');
// Existing checkpoints use doorSlammed; no new flag may hide a revealed portrait.
const oldPortraitState = createDefaultGameState();
oldPortraitState.doorSlammed = true;
ensureInvestigation(oldPortraitState).notes.push({ title: ritualRecord.documentTitle, content: '旧版缩写' });
const { room: oldPortraitScene, sounds: oldPortraitSounds } = portraitRoom(oldPortraitState);
ui.scene = oldPortraitScene; ui.state = oldPortraitState; ui.data = ensureInvestigation(oldPortraitState);
new InteractionManager(oldPortraitScene).handleInteraction();
assert.equal(oldPortraitScene.black_cloth.texture.key, 'portrait_father');
assert.equal(ui.data.notes.find(note => note.title === ritualRecord.documentTitle).content, ritualRecord.documentText);
assert.equal(oldPortraitSounds.length, 0);

// Binding appearance derives from the existing requirements. Looking, failed
// attempts and cancellation cannot start the final memory or grant its clue.
function coffinRoom(gameState) {
    const items = [];
    const room = { currentMapId: 'room_main', gameState, isMobile: true, investigationUI: ui, playSound() {}, showHint() {},
        player: { sprite: { x: 430, y: 190 } }, interactText: focusText,
        interactables: { add: item => items.push(item), getChildren: () => items } };
    const manager = new MapManager(room);
    manager.furniture = { create: (x, y, key) => ({ x, y, active: true, visible: true, texture: { key }, setTexture(value) { this.texture.key = value; return this; }, setPipeline() { return this; } }) };
    manager.createObjects({ coffin: Maps.room_main.objects.coffin }, 'room_main');
    assert.equal(items.filter(item => item === room.coffin).length, 1);
    room.mapManager = manager;
    room.reader = new InteractionManager(room);
    room.reader.checkInteraction();
    assert.equal(room.currentTarget.type, 'coffin');
    return room;
}
const coffinDialog = window.showDialog, coffinDocument = window.showDocument;
for (let mask = 0; mask < 8; mask++) {
    const bindingState = createDefaultGameState();
    const data = ensureInvestigation(bindingState);
    Object.assign(data.deductions, { school: !!(mask & 1), hospital: !!(mask & 4) });
    bindingState.candlesLit = !!(mask & 2); bindingState.hasRedKey = true;
    const room = coffinRoom(bindingState), responses = [];
    let finalEntries = 0;
    room.triggerRealEnding = () => finalEntries++;
    ui.scene = room; ui.state = bindingState; ui.data = data;
    window.showDialog = (_name, text, callback) => responses.push({ text, callback });
    window.showDocument = (title, content) => rememberDocument(bindingState, 'room_main', title, content);
    assert.equal(room.coffin.texture.key, mask ? `coffin_${mask}` : 'coffin');
    room.reader.handleInteraction(); actions[0].run();
    const observation = data.notes[0];
    assert.equal(observation.sourceMapId, 'room_main');
    assert.equal(observation.content.includes('上端的红线垂了下来'), !!(mask & 1));
    assert.equal(observation.content.includes('中间那圈已经松开'), !!(mask & 2));
    assert.equal(observation.content.includes('下端的红线松了'), !!(mask & 4));
    assert.doesNotMatch(observation.content, /事故|校服|棺材里没有父亲/);
    assert.deepEqual(bindingState.storyFlags.collectedClues, []);
    saveCheckpoint(bindingState, 'room_main', 430, 190);
    assert.equal(coffinRoom(readCheckpoint().state).coffin.texture.key, room.coffin.texture.key);
    room.reader.handleInteraction(); actions[2].run();
    assert.equal(finalEntries, 0);
    room.reader.handleInteraction(); actions[1].run();
    if (mask !== 7) {
        assert.match(feedback.textContent, mask & 2 ? /死结/ : /中间那圈红线/);
        assert.equal(responses.length, 0);
    } else {
        actions[1].run(); // Cancel the final-memory confirmation.
        assert.equal(finalEntries, 0);
        assert.deepEqual(bindingState.storyFlags.collectedClues, []);
        bindingState.hasRedKey = false;
        room.reader.handleInteraction(); actions[1].run();
        assert.match(feedback.textContent, /锁孔相配的钥匙/);
        bindingState.hasRedKey = true;
        room.reader.handleInteraction(); actions[1].run();
        const openCoffin = actions[0].run;
        openCoffin(); openCoffin();
        assert.equal(responses.length, 1);
        assert.deepEqual(bindingState.storyFlags.collectedClues, ['coffin_truth']);
        assert.equal(finalEntries, 0, 'The key response is read before entering the last memory');
        responses[0].callback();
        assert.equal(finalEntries, 1);
    }
}
// A submitted deduction in the hall updates the existing coffin immediately.
const liveBindingState = createDefaultGameState(), liveBindingRoom = coffinRoom(liveBindingState);
ui.scene = liveBindingRoom; ui.state = liveBindingState; ui.data = ensureInvestigation(liveBindingState);
for (const id of ['school', 'hospital']) {
    for (const clue of CASES[id].required) collectClue(liveBindingState, clue, id === 'school' ? 'control' : 'illness');
    ui.solve(id); selectEvidence(CASES[id].required); selectAnswer(id, CASES[id].correct);
    assert.equal(liveBindingRoom.coffin.texture.key, id === 'school' ? 'coffin' : 'coffin_1', 'Selections alone cannot loosen a binding');
    actions[0].run();
    assert.equal(liveBindingRoom.coffin.texture.key, id === 'school' ? 'coffin_1' : 'coffin_5');
}
assert.equal(coffinRoom(createDefaultGameState()).coffin.texture.key, 'coffin', 'Restart restores taut bindings');
window.showDialog = coffinDialog; window.showDocument = coffinDocument;

// Both family memories can be put down and revisited. Only a supported,
// submitted interpretation completes them, including submission back at home.
for (const id of ['school', 'hospital']) {
    const memoryId = `memory_${id}`;
    const returnTarget = getMemoryReturn(memoryId);
    const visitState = createDefaultGameState();
    const originScene = openingRoom(returnTarget.mapId, visitState);
    const transitions = [];
    originScene.switchScene = (...args) => transitions.push(args);
    originScene.investigationUI = ui;
    ui.scene = originScene; ui.state = visitState; ui.data = ensureInvestigation(visitState);
    originScene.currentTarget = { type: 'story_object', obj: originScene.interactables.getChildren().find(item => item.memoryTrigger?.mapId === memoryId) };
    originScene.reader.handleInteraction();
    assert.match(body.textContent, /暂回/);
    assert.equal(transitions.length, 0, 'Inspecting a memory entrance must not force a scene change');
    actions[1].run();
    assert.equal(transitions.length, 0, 'Declining entry keeps the player in the old room');
    assert.equal(visitState.storyFlags.memories[id], false);
    assert.equal(visitState.investigation.notes[0].sourceMapId, returnTarget.mapId, 'Declining entry still retains the observed entrance and its location');
    originScene.reader.handleInteraction(); actions[0].run();
    assert.equal(transitions[0][0], memoryId);
    const memoryScene = openingRoom(memoryId, visitState);
    memoryScene.investigationUI = ui;
    memoryScene.switchScene = (...args) => transitions.push(args);
    memoryScene.soundManager = { micStream: null };
    ui.scene = memoryScene;
    const readClue = clueId => {
        memoryScene.currentTarget = { type: 'story_object', obj: memoryScene.interactables.getChildren().find(item => item.clueId === clueId) };
        memoryScene.reader.handleInteraction();
    };
    readClue(CASES[id].leads[0]); // The final prop can be found before the two key records.
    const finalRecord = Maps[memoryId].objects.interactables.find(item => item.memoryComplete === id);
    assert.ok(body.textContent.includes(finalRecord.documentText), 'The final prop first presents its actual record');
    assert.equal(descendants(body).some(node => node.className === 'case-options'), false, 'Reading cannot force an answer page');
    assert.equal(getJournalEntries(visitState).filter(card => card.text === finalRecord.documentText).length, 1);
    assert.equal(visitState.investigation.notes.find(note => note.title === finalRecord.documentTitle).sourceMapId, memoryId);
    actions.find(action => action.label === '对照已读物证').run();
    assert.match(body.textContent, /现在就可以尝试/);
    assert.deepEqual(getVisibleCases(visitState).map(([caseId]) => caseId), [id]);
    assert.equal(visitState.storyFlags.memories[id], false);
    assert.equal(visitState.investigation.deductions[id], undefined);
    assert.equal(canDeduce(visitState, id), false, 'An emotional lead raises a question without proving its answer');
    actions.at(-1).run();
    readClue(CASES[id].required[0]);
    ui.solve(id);
    assert.match(body.textContent, /现在就可以尝试/);
    actions.find(action => action.label.startsWith('暂回')).run();
    assert.deepEqual(transitions.at(-1), [returnTarget.mapId, returnTarget.x, returnTarget.y]);
    assert.equal(visitState.storyFlags.memories[id], false);
    assert.equal(visitState.investigation.deductions[id], undefined);
    assert.equal(getRoomObjects('room_corridor', visitState).interactables.some(item => item.id === 'hospital_echo'), false);
    visitState.isChasing = true;
    ui.pause();
    const flee = actions.find(action => action.label.startsWith('暂回'));
    assert.match(flee.label, /追逐将恢复/);
    flee.run();
    assert.equal(visitState.isChasing, true, 'A voluntary return must preserve pending pursuit');
    visitState.isChasing = false;
    saveCheckpoint(visitState, returnTarget.mapId, returnTarget.x, returnTarget.y);
    const restoredVisit = readCheckpoint().state;
    assert.deepEqual(restoredVisit.storyFlags.collectedClues, [CASES[id].leads[0], CASES[id].required[0]]);
    assert.equal(restoredVisit.storyFlags.memories[id], false);
    const noteCount = visitState.investigation.notes.length;
    readClue(CASES[id].required[0]);
    assert.equal(visitState.investigation.notes.length, noteCount, 'Revisiting cannot duplicate discovered records');
    readClue(CASES[id].required[1]);
    ui.solve(id);
    selectEvidence(CASES[id].required); selectAnswer(id, CASES[id].correct);
    actions.find(action => action.label.startsWith('暂回')).run();
    assert.equal(visitState.storyFlags.memories[id], false, 'Leaving with an unsubmitted selection cannot complete a memory');
    assert.equal(visitState.investigation.deductions[id], undefined);
    // Finish from the home journal rather than requiring another final-prop visit.
    ui.scene = originScene;
    ui.solve(id);
    assert.equal(actions.some(action => action.label.startsWith('暂回')), false);
    selectEvidence(CASES[id].required); selectAnswer(id, CASES[id].correct); actions[0].run();
    assert.equal(visitState.investigation.deductions[id], true);
    assert.equal(visitState.storyFlags.memories[id], true, 'Journal submission completes the family memory wherever it occurs');
    assert.match(getObjective(visitState, memoryId)[1], /暂停/);
    const beforeRereading = transitions.length;
    ui.scene = memoryScene;
    readClue(CASES[id].leads[0]);
    assert.ok(body.textContent.includes(finalRecord.documentText));
    assert.match(body.textContent, /已经拼合/);
    assert.equal(transitions.length, beforeRereading, 'Revisiting a completed final prop cannot teleport the player');
    actions.find(action => action.label === '继续观察这里').run();
    assert.equal(transitions.length, beforeRereading);
    readClue(CASES[id].leads[0]);
    actions.find(action => action.label === '回看手记中的判断').run();
    assert.ok(body.textContent.includes(CASES[id].conclusion));
    assert.equal(transitions.length, beforeRereading);
    visitState.isChasing = true;
    readClue(CASES[id].leads[0]);
    const leaveCompleted = actions.find(action => action.label.startsWith('回到'));
    assert.match(leaveCompleted.label, /追逐将恢复/);
    leaveCompleted.run();
    assert.deepEqual(transitions.at(-1), [returnTarget.mapId, returnTarget.x, returnTarget.y]);
    assert.equal(visitState.isChasing, true);
    assert.equal(getJournalEntries(visitState).filter(card => card.text === finalRecord.documentText).length, 1, 'Repeated final-prop reading keeps one source text');
    saveCheckpoint(visitState, memoryId, Maps[memoryId].objects.playerStart.x, Maps[memoryId].objects.playerStart.y);
    assert.equal(readCheckpoint().state.investigation.notes.filter(note => note.title === finalRecord.documentTitle).length, 1);
    const echoes = getRoomObjects('room_corridor', visitState);
    if (id === 'school') assert.equal(echoes.photos.find(photo => photo.id === 3).texture, 'photo_uncovered');
    else assert.equal(echoes.interactables.some(item => item.id === 'hospital_echo'), true);
}
const legacyDeduction = createDefaultGameState();
legacyDeduction.investigation = { deductions: { school: true } };
ensureInvestigation(legacyDeduction);
assert.equal(legacyDeduction.storyFlags.memories.school, true, 'Old submitted deductions reconcile their family-memory state');
assert.equal(legacyDeduction.storyFlags.memories.hospital, false);

// Solving while standing in the corridor updates its existing objects without
// restarting the room or reading the newly appeared material for the player.
const liveEchoState = createDefaultGameState();
const echoItems = [], livePhotos = [];
const echoImage = (x, y, key) => ({ x, y, active: true, texture: { key },
    setTexture(value) { this.texture.key = value; return this; }, setPipeline() { return this; },
    setTint(value) { this.tint = value; return this; }, clearTint() { this.tint = undefined; return this; } });
const liveEchoScene = { currentMapId: 'room_corridor', gameState: liveEchoState, isMobile: true,
    add: { image: echoImage }, physics: { add: { existing() {} } },
    interactables: { add: item => echoItems.push(item), getChildren: () => echoItems } };
const liveEchoManager = new MapManager(liveEchoScene);
liveEchoScene.mapManager = liveEchoManager;
liveEchoManager.photos = { create: (x, y, key) => { const photo = echoImage(x, y, key); livePhotos.push(photo); return photo; }, getChildren: () => livePhotos };
const baseEchoObjects = getRoomObjects('room_corridor', liveEchoState);
liveEchoManager.createObjects({ photos: baseEchoObjects.photos, interactables: baseEchoObjects.interactables }, 'room_corridor');
const livePhoto = livePhotos.find(photo => photo.photoId === 3);
examineObject(liveEchoState, 'room_corridor', { type: 'photo', obj: livePhoto });
ui.scene = liveEchoScene; ui.state = liveEchoState; ui.data = ensureInvestigation(liveEchoState);
for (const id of ['school', 'hospital']) {
    for (const clue of CASES[id].required) collectClue(liveEchoState, clue, id === 'school' ? 'control' : 'illness');
    ui.solve(id); selectEvidence(CASES[id].required); selectAnswer(id, CASES[id].correct); actions[0].run();
}
assert.equal(livePhoto.texture.key, 'photo_uncovered');
assert.match(livePhoto.dialogText, /老师说第二名/);
assert.equal(inspectionStatus(liveEchoState, 'room_corridor', { type: 'photo', obj: livePhoto }), '有变化');
assert.equal(echoItems.filter(item => item.objId === 'hospital_echo').length, 1);
liveEchoManager.refreshMemoryEchoes();
assert.equal(echoItems.filter(item => item.objId === 'hospital_echo').length, 1, 'Refreshing cannot duplicate the new envelope');
assert.equal(liveEchoState.investigation.notes.length, 0, 'A visible change is not an automatic reading');
assert.equal(JSON.stringify(Maps.room_corridor.objects), untouchedMap);

for (const mapId of ['memory_crash', 'room_memory', 'room_main']) {
    assert.equal(getMemoryReturn(mapId), null, 'The family-memory exit cannot bypass the final choice');
    ui.scene = { currentMapId: mapId, soundManager: { micStream: null } };
    ui.pause();
    assert.equal(actions.some(action => action.label.startsWith('暂回')), false);
}

// Capture rewinds physical progress while preserving only the observations and
// interpretations actually earned since entry. Both source states stay intact.
const enteredState = createDefaultGameState();
Object.assign(enteredState, { doorSlammed: true, hasRice: true, hasMatches: true, sanity: 82 });
enteredState.inventory.push('地下室钥匙');
ensureInvestigation(enteredState).ritualStep = 1;
visitRoom(enteredState, 'room_main');
const caughtState = JSON.parse(JSON.stringify(enteredState));
Object.assign(caughtState, { hasRedKey: true, hasIncense: true, cabinetMoved: true, candlesLit: true, isChasing: true, sanity: 20, viewedIntro: true });
caughtState.inventory.push('本次取到的物品');
caughtState.viewedPhotos.push(3); caughtState.clues.push('window');
ensureInvestigation(caughtState).ritualStep = 3;
rememberDocument(caughtState, 'room_main', '新看到的棺锁', '红线下夹着纸片。');
visitRoom(caughtState, 'room_corridor', 'room_main');
visitRoom(caughtState, 'room_bedroom_parents', 'room_corridor');
visitRoom(caughtState, 'room_secret', 'room_bedroom_parents');
for (const id of ['school', 'hospital']) for (const clue of CASES[id].required) collectClue(caughtState, clue, id === 'school' ? 'control' : 'illness');
deduce(caughtState, 'school', CASES.school.correct, CASES.school.required);
rememberCaseDraft(caughtState, 'hospital', CASES.hospital.required, CASES.hospital.answers[CASES.hospital.correct]);
collectClue(caughtState, 'well_red_key', 'death');
const enteredBytes = JSON.stringify(enteredState), caughtBytes = JSON.stringify(caughtState);
const recoveredState = recoverFromCapture(enteredState, caughtState);
assert.equal(JSON.stringify(enteredState), enteredBytes);
assert.equal(JSON.stringify(caughtState), caughtBytes);
assert.equal(recoveredState.hasRedKey, false);
assert.equal(recoveredState.hasIncense, false);
assert.equal(recoveredState.cabinetMoved, false);
assert.equal(recoveredState.candlesLit, 0);
assert.equal(recoveredState.sanity, 82);
assert.deepEqual(recoveredState.inventory, ['地下室钥匙']);
assert.equal(recoveredState.investigation.ritualStep, 1, 'Ritual progress follows the restored physical checkpoint');
assert.deepEqual(recoveredState.investigation.notes, caughtState.investigation.notes);
assert.deepEqual(recoveredState.storyFlags.collectedClues, caughtState.storyFlags.collectedClues);
assert.equal(recoveredState.investigation.deductions.school, true);
assert.equal(recoveredState.storyFlags.memories.school, true);
assert.equal(recoveredState.investigation.deductions.hospital, undefined, 'Found records cannot become an unsubmitted deduction');
assert.equal(recoveredState.storyFlags.memories.hospital, false);
assert.deepEqual(getCaseDraft(recoveredState, 'hospital'), getCaseDraft(caughtState, 'hospital'), 'Capture preserves a hypothesis without submitting it');
assert.equal(recoveredState.isChasing, false);
assert.equal(recoveredState.isHidden, false);
assert.deepEqual(recoveredState.viewedPhotos, [3]);
assert.deepEqual(recoveredState.clues, ['window']);
assert.equal(recoveredState.viewedIntro, true);
assert.equal(knownRoute(recoveredState, 'room_bedroom_parents', 'room_secret'), null, 'Remembering a route cannot bypass its restored closed passage');
assert.equal(collectClue(recoveredState, 'well_red_key', 'death'), false, 'Recollecting a physical key cannot count its remembered clue twice');
assert.notEqual(recoveredState.investigation.notes[0], caughtState.investigation.notes[0]);

// Returning to the title explicitly flushes safe progress without waiting for
// the autosave timer. Pursuit and hiding continue to use the last safe record.
const exitState = createDefaultGameState();
rememberDocument(exitState, 'room_main', '刚读到的文字', '还没有等到下一次自动存档。');
const titleStarts = [];
ui.state = exitState; ui.data = ensureInvestigation(exitState);
ui.scene = { currentMapId: 'room_main', safeStart: { x: 384, y: 450 }, soundManager: { micStream: null },
    scene: { start(name) { titleStarts.push(name); assert.ok(readCheckpoint().state.investigation.notes.some(note => note.title === '刚读到的文字')); } } };
ui.pause(); actions.find(action => action.label === '保存并返回标题').run();
const safeBeforeUnsafeExit = readCheckpoint();
assert.equal(safeBeforeUnsafeExit.mapId, 'room_main');
exitState.isChasing = true;
rememberDocument(exitState, 'room_main', '危险中的观察', '不覆盖安全记录。');
ui.pause(); actions.find(action => action.label.startsWith('返回标题')).run();
assert.deepEqual(readCheckpoint(), safeBeforeUnsafeExit);
exitState.isChasing = false; exitState.isHidden = true;
ui.pause(); actions.find(action => action.label.startsWith('返回标题')).run();
assert.deepEqual(readCheckpoint(), safeBeforeUnsafeExit);
exitState.isHidden = false; exitState.isChasing = true;
ui.scene.currentMapId = 'memory_school'; ui.scene.safeStart = Maps.memory_school.objects.playerStart;
ui.pause(); actions.find(action => action.label === '保存并返回标题').run();
assert.equal(readCheckpoint().mapId, 'memory_school');
assert.equal(readCheckpoint().state.isChasing, true, 'A safe memory save retains the suspended pursuit');
assert.deepEqual(titleStarts, ['TitleScene', 'TitleScene', 'TitleScene', 'TitleScene']);

saveCheckpoint(state, 'room_main', 384, 450);
assert.equal(readCheckpoint().mapId, 'room_main');
state.isChasing = true;
saveCheckpoint(state, 'room_backyard', 100, 100);
assert.equal(readCheckpoint().mapId, 'room_main', 'Pursuit must not overwrite a safe checkpoint');
globalThis.localStorage = { getItem: () => '{broken', setItem: () => { throw new Error('storage disabled'); } };
assert.equal(readCheckpoint(), null);
state.isChasing = false;
assert.doesNotThrow(() => saveCheckpoint(state, 'room_main', 1, 1));

globalThis.Phaser = { Math: { Angle: { RotateTo: (_from, to) => to } } };
function runner() {
    const player = Object.create(Player.prototype);
    const velocity = { x: 0, y: 0 };
    player.sprite = {
        x: 100, y: 100, body: { velocity }, anims: { play() {}, stop() {} },
        setVelocity: n => { velocity.x = velocity.y = n; },
        setVelocityX: n => { velocity.x = n; }, setVelocityY: n => { velocity.y = n; },
        setDepth() {}, setAngle() {}
    };
    player.scene = { time: { now: 0 }, tweens: { add: () => ({ isPlaying: () => true, updateTo() {} }) } };
    Object.assign(player, { keyShift: { isDown: true }, speed: 150, runSpeed: 250, stamina: 100, maxStamina: 100, exhausted: false, flashlight: { rotation: 0 } });
    return player;
}
const input = { left: { isDown: false }, right: { isDown: true }, up: { isDown: false }, down: { isDown: false } };
const p30 = runner(), p60 = runner();
for (let i = 0; i < 30; i++) p30.update(input, input, { active: false }, null, 1000 / 30);
for (let i = 0; i < 60; i++) p60.update(input, input, { active: false }, null, 1000 / 60);
assert.equal(p60.sprite.body.velocity.x, 250, 'Shift must actually increase movement speed');
assert.ok(Math.abs(p30.stamina - p60.stamina) < 0.001, 'Stamina must not depend on display frame rate');
console.log('2D gameplay verification passed: discovered routes, door gates, changed-object feedback, focus, narrative reveal, evidence, hints, echoes, ritual, safe keypad, endings, saves, sprint timing');
