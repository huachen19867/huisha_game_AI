const TEXTURE_LABELS = {
    altar: '供桌', bed: '床', cabinet: '衣柜', car: '汽车', coffin: '棺材',
    desk: '书桌', diary: '日记', kitchen_sink: '水槽', npc_paper: '人影',
    photo_frame: '照片', safe: '保险柜', scratch: '抓痕', stove: '灶台',
    toilet: '马桶', toy_plane: '纸飞机', trash_paper: '纸张', well: '井'
};

const ID_LABELS = {
    kitchen_ghost: '灶台边的女人', dad_ghost: '父亲的影子', mom_ghost: '母亲的影子',
    parents_cabinet: '父母的衣柜', kitchen_cabinet: '厨房柜子', my_cabinet: '我的衣柜'
};

function inferVerb(data, textureKey) {
    if (data.interaction?.verb) return data.interaction.verb;
    if (data.itemGrant || data.id === 'incense' || data.id === 'spirit_money') return '拾取';
    if (data.documentText || data.documentTitle || data.clueId) return '阅读';
    if (textureKey === 'photo_frame') return '查看';
    if (data.endingChoice) return '选择';
    if (data.memoryTrigger || data.puzzleId) return '触碰';
    if (textureKey === 'cabinet' || data.id?.includes('cabinet')) return '躲藏';
    if (textureKey === 'bed') return '躲藏';
    return '调查';
}

export function normalizeInteractionMeta(data = {}, fallback = {}) {
    const textureKey = fallback.textureKey || data.texture || '';
    const label = data.interaction?.label
        || data.interactLabel
        || data.documentTitle
        || data.label
        || ID_LABELS[data.id]
        || TEXTURE_LABELS[textureKey]
        || (data.id ? data.id.replaceAll('_', ' ') : '可疑物件');
    const isStory = Boolean(data.clueId || data.itemGrant || data.puzzleId || data.memoryTrigger || data.endingChoice || data.documentText);
    const isFurniture = ['altar', 'bed', 'cabinet', 'car', 'coffin', 'desk', 'safe', 'stove', 'well'].includes(textureKey)
        || ['parents_cabinet', 'kitchen_cabinet', 'my_cabinet'].includes(data.id);
    return {
        label,
        verb: inferVerb(data, textureKey),
        priority: data.interaction?.priority ?? (isStory ? 30 : data.dialog ? 20 : 10),
        radius: data.interaction?.radius ?? (textureKey === 'car' ? 120 : 80),
        marker: data.interaction?.marker ?? isStory,
        blocksMovement: data.interaction?.blocksMovement ?? isFurniture
    };
}

export function scoreInteractionCandidate({ distance, priority, facingDot }) {
    return priority * 1000 + facingDot * 200 - distance;
}

export const INTERACTION_FOCUS_BAND = 28;

export function selectInteractionCandidate(candidates, focusBand = INTERACTION_FOCUS_BAND) {
    if (!candidates.length) return null;
    const nearest = Math.min(...candidates.map(candidate => candidate.distance));
    return candidates
        .filter(candidate => candidate.distance <= nearest + focusBand)
        .sort((a, b) => {
            const scoreA = a.priority * 10 + a.facingDot * 40 - a.distance;
            const scoreB = b.priority * 10 + b.facingDot * 40 - b.distance;
            return scoreB - scoreA;
        })[0] || null;
}

export function formatInteractionPrompt(meta) {
    return `${meta.verb}：${meta.label}  [空格/E]`;
}
