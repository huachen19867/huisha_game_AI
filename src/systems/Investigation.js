import { ensureStoryFlags } from './StoryState.js';
import { Maps } from '../data/Maps.js';
import { isPursuitSpace } from './HorrorPacing.js';

export const CASES = {
    school: {
        title: '谁把家变成了考场？',
        required: ['school_blackboard', 'school_report'],
        leads: ['school_last_argument'],
        question: '那晚不能出门的决定，来自哪里？',
        answers: ['学校因三分之差，要求学生留校', '父亲在成绩单上追加了禁足要求', '我在成绩公布前，主动申请了禁足'],
        correct: 1,
        comparison: '对照两份记录的书写者、对成绩的评价，以及有没有写下限制出门的决定。',
        conclusion: '成绩只是借口。父亲用惩罚和禁闭要求服从，离开不是孩子的过错。'
    },
    hospital: {
        title: '母亲为什么没能得到帮助？',
        required: ['hospital_window', 'hospital_ward'],
        leads: ['hospital_mother_voice'],
        question: '母亲的这次求助，停在了哪一步？',
        answers: ['医生建议住院后，父亲签字拒绝', '母亲在见医生之前，撤回了求助', '医院没有床位，所以没有提出住院'],
        correct: 0,
        comparison: '对照日期与时间，再看住院建议由谁提出，最后的家属意见由谁签下。',
        conclusion: '病历写的是需要治疗的人，不是怪物。她的痛苦不该由孩子负责。'
    },
    death: {
        title: '这个雨夜发生过几次？',
        required: ['crash_car_memory', 'crash_guardrail'],
        question: '车门与护栏留下的痕迹，指向怎样的经过？',
        answers: ['车门是今晚撞坏的，旧编号与我无关', '安全带已经解开，我当年走出了车', '我没有逃出那辆车，今晚是记忆的重演'],
        correct: 2,
        comparison: '对照人名、事故编号的年岁，以及安全带扣环有没有被解开的痕迹。',
        conclusion: '事故发生在十年前。回家的执念让雨夜重演，门外的路需要自己选择。'
    }
};

export const CLUE_NAMES = {
    family_rules: '相框家规 · 背面残字', father_note: '父亲笔记', award_stack: '叠起的奖状', locked_window: '从外封死的窗',
    school_blackboard: '黑板上的第二名', school_report: '划破的成绩单', school_last_argument: '最后一张试卷',
    medical_record: '被藏起的诊断书', diary_mother: '母亲日记', prescription_note: '处方单', unpaid_bill: '未缴的住院费',
    hospital_window: '诊室窗口', hospital_ward: '被划掉的住院建议', hospital_mother_voice: '母亲的回声',
    toy_plane: '童年的纸飞机', well_red_key: '井边的红钥匙', red_key: '血红钥匙', coffin_truth: '空棺里的名字',
    crash_car_memory: '没有解开的安全带', crash_guardrail: '护栏外的纸飞机', ritual_rule: '守灯纸条'
};

export function ensureInvestigation(state) {
    ensureStoryFlags(state);
    if (!state.investigation) state.investigation = {};
    const data = state.investigation;
    if (!data.notes) data.notes = [];
    if (!data.deductions) data.deductions = {};
    if (!data.hints) data.hints = {};
    if (!data.drafts || typeof data.drafts !== 'object' || Array.isArray(data.drafts)) data.drafts = {};
    // A supported interpretation completes a family memory, wherever the
    // journal was opened. Also reconcile saves made before this rule existed.
    for (const id of ['school', 'hospital']) {
        if (data.deductions[id]) state.storyFlags.memories[id] = true;
    }
    data.ritualStep = state.candlesLit ? 3 : Number.isInteger(data.ritualStep) ? Math.max(0, Math.min(3, data.ritualStep)) : 0;
    return data;
}

export function getMemoryReturn(mapId) {
    if (!['memory_school', 'memory_hospital'].includes(mapId)) return null;
    const target = Maps[mapId].objects.interactables.find(item => item.memoryReturn)?.memoryReturn;
    return target ? { ...target } : null;
}

// Record the place of actual reading, including room variants. Rereading an
// older note can supply its missing location without duplicating its text.
export function rememberDocument(state, mapId, title, content) {
    const notes = ensureInvestigation(state).notes;
    let note = notes.find(item => item.title === title && item.content === content);
    if (!note) {
        note = { title, content };
        notes.push(note);
    }
    if (!Maps[note.sourceMapId] && Maps[mapId]) note.sourceMapId = mapId;
    return note;
}

export function canDeduce(state, id) {
    ensureInvestigation(state);
    const puzzle = CASES[id];
    return !!puzzle && puzzle.required.every(clue => state.storyFlags.collectedClues.includes(clue));
}

export function deduce(state, id, answer, evidenceIds = []) {
    if (!canDeduce(state, id) || answer !== CASES[id].correct || !Array.isArray(evidenceIds)) return false;
    const selected = new Set(evidenceIds);
    if (evidenceIds.length !== CASES[id].required.length || selected.size !== evidenceIds.length || !CASES[id].required.every(clue => selected.has(clue))) return false;
    const data = ensureInvestigation(state);
    data.deductions[id] = true;
    delete data.drafts[id];
    if (id === 'school' || id === 'hospital') state.storyFlags.memories[id] = true;
    return true;
}

export function getVisibleCases(state) {
    const data = ensureInvestigation(state);
    return Object.entries(CASES).filter(([id, puzzle]) => data.deductions[id] || [...puzzle.required, ...(puzzle.leads || [])].some(clue => state.storyFlags.collectedClues.includes(clue)));
}

// A draft records the player's choices, never a verdict. Match explanations by
// text so an edited/reordered option cannot silently become another answer.
export function getCaseDraft(state, id) {
    const data = ensureInvestigation(state), puzzle = CASES[id];
    const empty = { evidenceIds: [], answer: null };
    if (!puzzle || data.deductions[id]) return empty;
    const saved = data.drafts[id];
    if (!saved || typeof saved !== 'object') return empty;
    const evidenceIds = Array.isArray(saved.evidenceIds) ? [...new Set(saved.evidenceIds.filter(clue => typeof clue === 'string' && state.storyFlags.collectedClues.includes(clue)))].slice(0, 2) : [];
    return { evidenceIds, answer: puzzle.answers.includes(saved.answer) ? saved.answer : null };
}

export function rememberCaseDraft(state, id, evidenceIds, answer) {
    const data = ensureInvestigation(state);
    if (!CASES[id] || data.deductions[id]) return;
    data.drafts[id] = { evidenceIds, answer };
    const draft = getCaseDraft(state, id);
    if (draft.evidenceIds.length || draft.answer !== null) data.drafts[id] = draft;
    else delete data.drafts[id];
}

// Read cards from the same map records used by the world, so rereading never
// invents a more revealing version of a clue than the player actually found.
export function getEvidence(state) {
    ensureInvestigation(state);
    return state.storyFlags.collectedClues.map(id => {
        for (const map of Object.values(Maps)) {
            const records = [...(map.objects.interactables || []), ...Object.values(map.objects).filter(item => item && !Array.isArray(item))];
            const item = records.find(item => item.clueId === id);
            if (item) return { id, name: CLUE_NAMES[id] || item.documentTitle || '旧宅物证', source: map.name, sourceMapId: map.id, text: item.documentText || item.dialog || '记录留在原处，可以回去查看。' };
        }
        return { id, name: CLUE_NAMES[id] || '旧宅物证', source: '老宅', text: '调查时读到的文书保存在下方，可展开回看。' };
    });
}

export function getJournalEntries(state) {
    const evidence = getEvidence(state);
    const notes = ensureInvestigation(state).notes.filter(note => !evidence.some(card => card.text === note.content));
    return [...evidence, ...notes.map(note => ({
        name: note.title, text: note.content,
        sourceMapId: Maps[note.sourceMapId] ? note.sourceMapId : undefined,
        source: Maps[note.sourceMapId]?.name || '地点未记'
    }))];
}

export function getObjective(state, mapId) {
    const data = ensureInvestigation(state);
    if (state.isHidden) return ['屏息藏好', '等脚步远去；保持安静 6 秒后可以脱身。'];
    if (state.isChasing && isPursuitSpace(mapId)) return ['先活过这个雨夜', '留意脚步的方向；Shift 奔跑，靠近床或衣柜按 E 躲藏。'];
    if (mapId === 'room_prologue') return ['雨夜 · 找一处灯火', state.viewedIntro ? '信里提到供桌右侧的黑布。沿公路向右，先找到老宅。' : 'WASD / 方向键移动，靠近信封或车辆按 E 调查。老宅在公路右端。'];
    if (mapId === 'room_entrance') return ['故宅 · 门还开着', state.doorSlammed ? '门闩松开了。离开或回去调查，由你决定。' : state.viewedIntro ? '信上写着供桌右侧的黑布。向上进入正厅。' : '正厅就在门内。可以先看看门柱，或直接向上进屋。'];
    if (mapId === 'memory_school') return data.deductions.school ? ['记忆 · 已拼合', '判断已经留在手记。可从试卷旁或暂停回到旧书房，或再看看教室。'] : ['记忆 · 最后一张试卷', '那晚是谁不让我出门？找到记录，在手记中对照。'];
    if (mapId === 'memory_hospital') return data.deductions.hospital ? ['记忆 · 已拼合', '判断已经留在手记。可从缴费单旁或暂停回到药柜小间，或再看看病房。'] : ['记忆 · 被划掉的求助', '治疗停在了哪一步？留意同一天留下的记录。'];
    if (mapId === 'memory_crash') return ['终章 · 认出这个雨夜', data.deductions.death ? '东侧是通向山路的石阶，西侧是老宅门口。靠近后确认你的选择。' : '调查车门与护栏，在手记中拼合最后的记忆。'];
    if (mapId === 'room_memory') return ['终章 · 一桌凉掉的饭', '这一次，你可以拒绝留下。调查餐桌，或走向南门。'];
    if (!state.doorSlammed) return ['第一章 · 谁在等我', state.viewedIntro ? '来信提到正厅供桌右侧的黑布。那下面是谁留下的东西？' : '正厅的供桌边留着未署名的东西。靠近物件按 E，看看是谁在等你。'];
    if (!state.candlesLit) {
        const count = [state.hasRice, state.hasMatches, state.hasIncense, state.hasSpiritMoney].filter(Boolean).length;
        const ritual = ['供品已齐。回正厅，按守灯纸条的顺序完成仪式。', '饭已摆上供桌。守灯尚未完成，找到香与火柴后可继续。', '香烛已燃，纸还未送。找到纸钱后可回供桌继续。'][Math.min(data.ritualStep, 2)];
        return ['第二章 · 灯给谁点', data.ritualStep ? `${ritual}${count < 4 ? `手边还缺材料（已找到 ${count}/4），桌上的供物会保留。` : ''}` : count < 4 ? `守灯要用的东西还散落在家里（已找到 ${count}/4）。已有材料可以先带回供桌试着操作；卡住时可打开提示。` : ritual];
    }
    if (!data.deductions.school || !data.deductions.hospital) return ['第三章 · 家里没说完的话', '灯亮了，那些被藏起来的记录还在。沿走廊看看，哪些房间一直无人提起？'];
    if (!state.hasRedKey) return ['第四章 · 空棺', '棺材上的锁还没打开。宅子里是否还有没查过的角落？'];
    return ['第四章 · 把名字还给自己', '回正厅打开棺材；也可以从南门选择提前离开。'];
}

export function getHintContext(state, mapId) {
    const data = ensureInvestigation(state);
    const context = (key, steps) => ({ key: `${mapId}:${key}`, steps });
    if (state.isHidden || (state.isChasing && isPursuitSpace(mapId))) return context('danger', ['先留意脚步，暂时放下调查。', '卧室的床和衣柜可以藏身。', 'Shift 奔跑，靠近床或衣柜按 E；藏好后保持安静 6 秒。']);
    const memoryId = { memory_school: 'school', memory_hospital: 'hospital', memory_crash: 'death' }[mapId];
    if (memoryId) {
        const puzzle = CASES[memoryId];
        const missing = puzzle.required.filter(id => !state.storyFlags.collectedClues.includes(id));
        if (data.deductions[memoryId]) {
            const target = getMemoryReturn(mapId);
            return context('memory-solved', ['这段记忆已经拼合，手记保留了你的判断。', target ? '可以继续观察，也可以从暂停返回旧宅。' : '东侧的石阶通向山路，西侧的老宅门口亮着灯。', target ? `在暂停里选择“暂回${Maps[target.mapId].name}”。之后仍能从原来的旧物重访。` : '调查山路或回宅的方向，再明确确认选择。']);
        }
        return context(`memory:${missing.join(',')}`, [
            memoryId === 'school' ? '记忆里的命令是谁写下的？' : memoryId === 'hospital' ? '先按时间对照两份记录。' : '留意物件的年岁与留下的人名。',
            missing.length ? '房间里的文字和痕迹，比声音更可靠。靠近物件按 E 调查。' : '物证已在手记里，展开原文再作判断。',
            missing.length ? `还可以调查：${missing.map(id => CLUE_NAMES[id]).join('、')}。` : `打开手记，选出“${puzzle.required.map(id => CLUE_NAMES[id]).join('”与“')}”，对照记录选择解释后提交。`
        ]);
    }
    if (mapId === 'room_prologue') return context('road', ['雨里有一处灯火。', '顺着公路向右走。', '走到公路右端，靠近通往老宅的出口。']);
    if (mapId === 'room_memory') return context('table', ['先听一听桌边的人在说什么。', '留下与离开，都需要你自己选择。', '调查餐桌可决定是否留下；南门也能离开。']);
    const supplies = [
        { flag: 'hasRice', name: '饭', rooms: ['room_kitchen'], look: '灶火旁的柜子里还留着一份饭。', act: '去厨房调查橱柜，可取得倒头饭。' },
        { flag: 'hasMatches', name: '火柴', rooms: ['room_bedroom_parents', 'room_secret'], look: '有件家具挡住了旧日的通路。', act: '在父母卧室查看柜脚，沿向左的擦痕挪开衣柜，再进暗室取火柴。' },
        { flag: 'hasIncense', name: '香', rooms: ['room_backyard'], look: '屋外也有人留下了祭祀的东西。', act: '走廊北端通向后院；调查后院的香。' },
        { flag: 'hasSpiritMoney', name: '纸钱', rooms: ['room_attic'], look: '抬头看看走廊东侧的高处。', act: '从走廊东侧北端上阁楼，调查纸钱。' }
    ];
    const localSupply = !state.candlesLit && supplies.find(item => item.rooms.includes(mapId) && !state[item.flag]);
    if (localSupply) {
        if (localSupply.flag === 'hasMatches') {
            if (mapId === 'room_secret') return context('local-matches:desk', ['火柴不需要再去别处找。', '工作台的刻刀旁放着一小盒东西。', '调查工作台，选择拿走火柴；也可以留在原处。']);
            if (state.cabinetMoved) return context('local-matches:passage', ['柜子已经挪开，不必再推一次。', '衣柜后面的暗门已露出来。', '从已打开的暗门进入暗室，调查工作台拿火柴。']);
            return context('local-matches:cabinet', ['柜脚下的灰，比柜门更值得留意。', '地上有向左的擦痕，右侧柜脚贴着东墙。', localSupply.act]);
        }
        const details = {
            hasRice: ['这间屋子还留着一份守灯要用的东西。', '橱柜中层单独留着一只碗。', '靠近厨房橱柜按 E，查看后可选择拿走倒头饭。'],
            hasIncense: ['先看看后院树木后面留下了什么。', '后侧的树边有一束尚未燃过的香。', '调查后院树后的香，可带回供桌。'],
            hasSpiritMoney: ['梁下的纸片和普通灰尘不同。', '阁楼北侧留着一叠祭祀用的纸。', '靠近阁楼北侧的纸钱按 E 调查并带走。']
        };
        return context(`local-supply:${localSupply.flag}`, details[localSupply.flag]);
    }
    const familyHint = id => {
        const missing = CASES[id].required.filter(clue => !state.storyFlags.collectedClues.includes(clue));
        const key = id === 'school' ? 'study' : 'medicine';
        if (!missing.length) return context(`${key}:ready`, [`“${CASES[id].title}”已经有两份可对照记录。`, CASES[id].comparison, `打开手记，拼合“${CASES[id].title}”，选物证与解释后提交；不必重访最后一件物品。`]);
        return context(`${key}:${missing.join(',')}`, id === 'school'
            ? ['成绩与家规之间，有些话没有说完。', mapId === 'room_study' ? '旧书房桌下的书包连着当年的教室。' : '走廊西侧的旧书房保留着当年的东西。', '调查旧书房桌下的旧书包进入学校记忆，寻找还没有读到的黑板或成绩单；已找到的记录会保留。']
            : ['药柜里的记录，也许与家人的说法不同。', mapId === 'room_medicine' ? '药柜底层的排号单连着那次求助。' : '走廊西侧南端有一间药柜小间。', '调查药柜小间底层的排号单进入医院记忆，核对诊室窗口与病床记录；已找到的内容会保留。']);
    };
    if (mapId === 'room_study' && !data.deductions.school) return familyHint('school');
    if (mapId === 'room_medicine' && !data.deductions.hospital) return familyHint('hospital');
    if (mapId === 'room_backyard' && !state.hasRedKey) return context('local-key', ['井沿的钥匙环被什么挡住了？', '钩尖朝上，亮痕从上方延到井外侧。', '抬高钥匙环越过钩尖，再向井外移。取走前会确认追逐风险，先记住卧室藏身处。']);
    if (!state.doorSlammed) return context('cloth', ['屋里有人为归家的人准备了东西。', '正厅的供桌旁有一张遮住的相框。', '从大门向上进入正厅，靠近供桌右侧的黑布相框，按 E。']);
    if (!state.candlesLit) {
        const missing = supplies.find(item => !state[item.flag]);
        const nextReady = data.ritualStep === 0 ? state.hasRice : data.ritualStep === 1 ? state.hasMatches && state.hasIncense : state.hasSpiritMoney;
        if (nextReady && missing) return context(`ritual-ready:${data.ritualStep}`, ['有些东西已经可以放到供桌上，不必等找齐才动手。', data.ritualStep ? '先前的供物仍在，守灯纸条能帮助对照下一步。' : '回正厅看看守灯纸条与空着的器物。', ['回供桌先摆倒头饭，其余材料可以之后再找。', '回供桌点燃香与烛，纸钱可以之后再找。', '回供桌焚纸，完成后才会松开南门门闩。'][data.ritualStep]]);
        if (missing) return context(`supply:${missing.flag}`, [`这一回先寻找${missing.name}。房间的用途能指路。`, missing.look, missing.act]);
        if (data.ritualStep === 1) return context('ritual:1', ['饭已经留名，守灯还差后两步。', '可以回到供桌继续，供物仍在原处。', '接着点香烛，再焚纸；不用重新摆饭。']);
        if (data.ritualStep === 2) return context('ritual:2', ['香烛已燃，守灯还没有送行。', '供桌上的纸盆仍等着最后一步。', '回供桌焚纸，完成后才会松开南门门闩和棺上中间那圈红线。']);
        return context('ritual', ['供品已经齐了，顺序还没有确定。', '正厅供桌旁的守灯纸条写着顺序。', '调查供桌：摆饭 → 点香烛 → 焚纸。失败可重试，不消耗供品。']);
    }
    if (!data.deductions.school) return familyHint('school');
    if (!data.deductions.hospital) return familyHint('hospital');
    if (!state.hasRedKey) return context('key', ['还有一把锁，没有找到对应的钥匙。', '试着去宅子外面，看看井沿铁钩上的痕迹。', '从走廊北端到后院。抬高钥匙环越过钩尖，再向井外移。取走前先留意卧室藏身处。']);
    return context('coffin', ['现在可以看看那把锁后面是什么。', '红钥匙对应正厅的棺材。', '回正厅调查棺材。南门也已解锁，可以先离开。']);
}

export function requestHint(state, mapId) {
    const data = ensureInvestigation(state);
    const { key, steps } = getHintContext(state, mapId);
    const level = Math.min((data.hints[key] || 0) + 1, steps.length);
    data.hints[key] = level;
    return { level, total: steps.length, text: steps[level - 1] };
}

export const SAVE_KEY = 'huisha-2d-checkpoint-v1';

export function recoverFromCapture(checkpointState, currentState) {
    const recovered = JSON.parse(JSON.stringify(checkpointState));
    const learned = JSON.parse(JSON.stringify(currentState));
    const ritualStep = ensureInvestigation(recovered).ritualStep;
    const investigation = ensureInvestigation(learned);
    // Physical progress rewinds; facts the player actually observed do not.
    for (const field of ['storyFlags', 'clues', 'viewedPhotos', 'viewedIntro', 'viewedEntrance', 'storyStep']) recovered[field] = learned[field];
    recovered.investigation = { ...investigation, ritualStep };
    recovered.isChasing = false;
    recovered.isHidden = false;
    ensureInvestigation(recovered);
    return recovered;
}

export function readCheckpoint() {
    try {
        const save = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (save?.version !== 1 || typeof save.mapId !== 'string' || !save.state || !Number.isFinite(save.x) || !Number.isFinite(save.y)) return null;
        return save;
    } catch { return null; }
}

export function saveCheckpoint(state, mapId, x, y) {
    if ((state.isChasing && isPursuitSpace(mapId)) || state.isHidden || mapId === 'room_memory') return;
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, mapId, x, y, state }));
    } catch { /* Private browsing or full storage must not block play. */ }
}
