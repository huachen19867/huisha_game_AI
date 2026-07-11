import { ensureStoryFlags } from './StoryState.js';

export function getCurrentObjective(gameState, mapId) {
    const flags = ensureStoryFlags(gameState);
    if (mapId === 'room_prologue') return '沿公路寻找避雨处';
    if (!gameState.doorSlammed) return '进入老宅，调查正厅里的黑布遗像';
    const missing = [
        ['hasRice', '倒头饭'], ['hasMatches', '火柴'],
        ['hasIncense', '香'], ['hasSpiritMoney', '纸钱']
    ].filter(([key]) => !gameState[key]).map(([, label]) => label);
    if (missing.length) return `找齐供品：${missing.join('、')}`;
    if (!flags.puzzles.school || !flags.puzzles.hospital) return '调查旧书房与药柜小间';
    if (!flags.photoSetCollected) return '调查走廊里的四张旧照片';
    if (!flags.familyPhotoCornerFound) return '用地下室钥匙进入地下禁闭室寻找照片缺角';
    if (flags.chasePhase === 'active') return '躲藏 6 秒，或把完整全家福带回正厅';
    if (!gameState.candlesLit) return '回到正厅完成供品仪式';
    if (!flags.coffinOpened) return '用血红钥匙打开棺材';
    if (flags.crashEvidence && (!flags.crashEvidence.car || !flags.crashEvidence.guardrail)) return '调查变形车门和护栏缺口';
    return '根据已经查明的真相作出选择';
}

export class ObjectiveManager {
    constructor(gameState, element) { this.gameState = gameState; this.element = element; }
    refresh(mapId) {
        if (!this.element) return;
        this.element.textContent = `目标：${getCurrentObjective(this.gameState, mapId)}`;
        this.element.style.display = 'block';
    }
    hide() { if (this.element) this.element.style.display = 'none'; }
}
