import { ensureStoryFlags } from './StoryState.js';

const MOTHER_CLUES = ['medical_record', 'bathroom_medicine_hint', 'prescription_note', 'unpaid_bill', 'hospital_diagnosis'];
const ESCAPE_CLUES = ['locked_window', 'basement_lock_chain'];

export const NARRATIVE_BEATS = [
    {
        id: 'last_night_echo',
        isReady: flags => flags.caseConclusions.includes('empty_seat') && flags.caseConclusions.includes('rewritten_night'),
        lines: [
            { speaker: '主角', text: '18:10 我还在学校，父亲却说 18:00 已和我争吵。他改写了最后一夜。' },
            { speaker: '少年李明', text: '我不是吃完饭才走的。那张桌子从一开始就空着我的位置。' },
            { speaker: '主角', text: '没有回家吃饭的人，一直是我。' }
        ]
    },
    {
        id: 'sealed_family_echo',
        isReady: flags => flags.caseConclusions.includes('treatment_blocked') && flags.caseConclusions.includes('sealed_house'),
        lines: [
            { speaker: '主角', text: '父亲拿走母亲的药，又用封条把所有出口封住。他把控制叫作保护。' },
            { speaker: '母亲的声音', text: '明儿，别学他替别人决定该怎么活。' }
        ]
    },
    {
        id: 'memorial_echo',
        isReady: flags => flags.collectedClues.includes('diary_mother') && flags.photoSetCollected,
        lines: [
            { speaker: '主角', text: '等等。日记写的是“明儿的忌日”，照片也只停在十年前。' },
            { speaker: '母亲的声音', text: '明儿，饭在锅里。别让它再凉了。' },
            { speaker: '主角', text: '她不是把我当成死人……她是在等一个已经死去的人。' }
        ]
    },
    {
        id: 'escape_echo',
        isReady: flags => ESCAPE_CLUES.some(id => flags.collectedClues.includes(id)) && flags.collectedClues.includes('toy_plane'),
        lines: [
            { speaker: '主角', text: '钉死的窗、折断的纸飞机……我早就计划过从这里逃走。' },
            { speaker: '少年李明', text: '等雨小一点。我会回来吃饭。' },
            { speaker: '主角', text: '这不是想象。我记得自己说过这句话。' }
        ]
    },
    {
        id: 'mother_echo',
        isReady: flags => MOTHER_CLUES.filter(id => flags.collectedClues.includes(id)).length >= 2,
        lines: [
            { speaker: '主角', text: '诊断、处方、没交的钱……母亲不是疯了，是这个家不让她好起来。' },
            { speaker: '母亲的声音', text: '明儿，饭在锅里。你先吃，别等我。' }
        ]
    }
];

export function getNarrativePhase(gameState) {
    const flags = ensureStoryFlags(gameState);
    if (flags.coffinOpened) return 'acceptance';
    if (flags.caseConclusions.includes('empty_seat') || flags.caseConclusions.includes('rewritten_night')) return 'recognition';
    if (flags.caseConclusions.includes('treatment_blocked') || flags.caseConclusions.includes('sealed_house')) return 'anger';
    if (flags.narrativeBeatsSeen.includes('escape_echo') || flags.narrativeBeatsSeen.includes('memorial_echo') || flags.photoSetCollected) return 'recognition';
    if (flags.narrativeBeatsSeen.includes('mother_echo') || flags.clues.illness >= 2) return 'anger';
    return 'denial';
}

export function getPendingNarrativeBeat(gameState) {
    const flags = ensureStoryFlags(gameState);
    return NARRATIVE_BEATS.find(beat => !flags.narrativeBeatsSeen.includes(beat.id) && beat.isReady(flags)) || null;
}

export function markNarrativeBeatSeen(gameState, beatId) {
    const flags = ensureStoryFlags(gameState);
    if (flags.narrativeBeatsSeen.includes(beatId)) return false;
    flags.narrativeBeatsSeen.push(beatId);
    return true;
}

export function getNarrativeSummary(gameState) {
    const flags = ensureStoryFlags(gameState);
    if (flags.caseConclusions.includes('empty_seat') && flags.caseConclusions.includes('rewritten_night')) {
        return '父亲改写了最后一夜；饭桌空位等的是我。';
    }
    const phase = getNarrativePhase(gameState);
    if (phase === 'acceptance') return '棺材里等的人是我。';
    if (phase === 'recognition') return '所有日期都停在十年前的七月十四。';
    if (phase === 'anger') return '母亲没有疯，是这个家不让她好起来。';
    return '父亲死了，我只是回来避雨。';
}

export function getObjectReflection(gameState, objectId) {
    const phase = getNarrativePhase(gameState);
    const late = phase === 'recognition' || phase === 'acceptance';
    const reflections = {
        rice: late ? '这碗饭等的人是我。它已经凉了十年。' : '给死人的饭。这个家连吃饭都像一条规矩。',
        diary: late ? '母亲写的不是胡话。七月十四，是我的忌日。' : '母亲把活着的我写成了死人。她那时已经分不清了。',
        locked_window: late ? '钉子不是新钉的。是记忆每晚把它们重新钉回去。' : '父亲连窗也不许我打开。',
        toy_plane: late ? '背面是我的字：雨停前，我会回来吃饭。' : '折断的翅膀。小时候的我只想飞出去。',
        altar: late ? '供桌等的不是父亲，是那个没有回家吃饭的孩子。' : '像是在等一场给父亲的祭祀。',
        coffin: phase === 'acceptance' ? '纸飞机、校服纽扣、冷饭碗——他们把我的空位留了十年。' : '里面的抓挠声，为什么和我的心跳一样？'
    };
    return reflections[objectId] || '';
}
