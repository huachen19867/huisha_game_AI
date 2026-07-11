import { ensureStoryFlags } from './StoryState.js';
import { Maps } from '../data/Maps.js';
import { getNarrativeSummary } from './NarrativeDirector.js';

function isMapPurposeComplete(gameState, mapId) {
    const flags = ensureStoryFlags(gameState);
    const completed = {
        room_prologue: gameState.viewedEntrance,
        room_entrance: flags.endingChoice !== null,
        room_main: Boolean(gameState.candlesLit && flags.coffinOpened),
        room_kitchen: gameState.hasRice,
        room_corridor: flags.photoSetCollected,
        room_bathroom: flags.collectedClues.includes('bathroom_medicine_hint'),
        room_bedroom_parents: gameState.inventory.includes('地下室钥匙') && gameState.cabinetMoved,
        room_secret: gameState.hasMatches,
        room_study: flags.puzzles.school,
        room_medicine: flags.puzzles.hospital,
        room_bedroom_me: flags.collectedClues.includes('diary_mother') && flags.collectedClues.includes('toy_plane'),
        room_backyard: gameState.hasIncense && gameState.hasRedKey,
        room_basement: flags.familyPhotoCornerFound,
        room_attic: gameState.hasSpiritMoney,
        memory_school: flags.puzzles.school,
        memory_hospital: flags.puzzles.hospital,
        memory_crash: flags.crashEvidence.car && flags.crashEvidence.guardrail,
        room_memory: flags.endingChoice !== null
    };
    return Boolean(completed[mapId]);
}

export function getCurrentObjective(gameState, mapId) {
    const flags = ensureStoryFlags(gameState);
    if (mapId === 'room_prologue') return '沿公路寻找避雨处';
    if (!gameState.doorSlammed) return '进入老宅，调查正厅里的黑布遗像';
    if (mapId === 'room_kitchen' && !gameState.hasRice) return '找出饭桌上空着的是谁的位置';
    if (mapId === 'room_secret' && !gameState.hasMatches) return '用笔记和木偶影子拆开四张封条';
    if (mapId === 'room_backyard' && !gameState.hasIncense) return '辨认井绳上代表孩子的结';
    if (mapId === 'room_attic' && !gameState.hasSpiritMoney) return '找出没有牌位的纸钱债主';
    if (mapId === 'memory_school' && !flags.puzzles.school) return '用时间证据找出父亲哪句话不可能成立';
    if (mapId === 'memory_hospital' && !flags.puzzles.hospital) return '用处方和药盒余量计算实际停药日';
    const missing = [
        ['hasRice', '倒头饭（厨房）'], ['hasMatches', '火柴（密室）'],
        ['hasIncense', '香（后院）'], ['hasSpiritMoney', '纸钱（阁楼）']
    ].filter(([key]) => !gameState[key]).map(([, label]) => label);
    if (missing.length) return `完成供桌仪式：寻找${missing.join('、')}`;
    if (!flags.ritualSolved) return '回到正厅，根据已经证明的结论完成供桌仪式';
    if (!flags.puzzles.school || !flags.puzzles.hospital) return '还原两段记忆：从旧书房进入学校，从药柜小间进入医院';
    if (!flags.photoSetCollected) return '调查走廊里的四张旧照片';
    if (!flags.familyPhotoCornerFound) return '用地下室钥匙进入地下禁闭室寻找照片缺角';
    if (flags.chasePhase === 'active') return '躲藏 6 秒，或把完整全家福带回正厅';
    if (!flags.coffinOpened) return '用血红钥匙打开棺材';
    if (flags.crashEvidence && (!flags.crashEvidence.car || !flags.crashEvidence.guardrail)) return '调查变形车门和护栏缺口';
    return '根据已经查明的真相作出选择';
}

export function getObjectiveView(gameState, mapId) {
    const map = Maps[mapId];
    return {
        main: getCurrentObjective(gameState, mapId),
        local: map?.purpose || '调查当前区域',
        completed: isMapPurposeComplete(gameState, mapId),
        memory: getNarrativeSummary(gameState)
    };
}

export class ObjectiveManager {
    constructor(gameState, element) { this.gameState = gameState; this.element = element; }
    refresh(mapId) {
        if (!this.element) return;
        const view = getObjectiveView(this.gameState, mapId);
        const localStatus = view.completed ? '本区域关键内容已完成' : view.local;
        this.element.textContent = `主线：${view.main}\n当前区域：${localStatus}\n记忆：${view.memory}`;
        this.element.style.whiteSpace = 'pre-line';
        this.element.style.display = 'block';
    }
    hide() { if (this.element) this.element.style.display = 'none'; }
}
