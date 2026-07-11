const board = config => ({ kind: 'board', hintAfter: 2, strongHintAfter: 4, ...config });

export const Puzzles = {
    kitchen_table: board({
        id: 'kitchen_table', title: '还原七月十四的饭桌座次',
        prerequisites: ['kitchen_sink_bowls', 'kitchen_stove_marks', 'kitchen_ghost_gesture'],
        clues: [
            { id: 'kitchen_sink_bowls', label: '洗碗槽：酒味缺口碗、药渍白瓷碗、刻纸飞机的小碗' },
            { id: 'kitchen_stove_marks', label: '灰痕：灶在北、侧门在东；父亲写着“我坐背门的位置”' },
            { id: 'kitchen_ghost_gesture', label: '纸人手势：先指灶边，再指侧门，最后指向空位' }
        ],
        slots: [
            { id: 'near_stove', label: '北位·靠灶' },
            { id: 'back_to_door', label: '西位·背门' },
            { id: 'side_door', label: '东位·挨侧门' },
            { id: 'offering', label: '南位·空着的供位' }
        ],
        tokens: [
            { id: 'mother_bowl', label: '药渍白瓷碗' },
            { id: 'father_bowl', label: '酒味缺口碗' },
            { id: 'child_bowl', label: '纸飞机小碗' },
            { id: 'cold_rice', label: '插筷的冷饭碗' }
        ],
        answer: { near_stove: 'mother_bowl', back_to_door: 'father_bowl', side_door: 'child_bowl', offering: 'cold_rice' },
        conflicts: {
            near_stove: 'seat_near_stove', back_to_door: 'father_back_to_door',
            side_door: 'child_near_side_door', offering: 'offering_is_not_daily_bowl'
        },
        messages: {
            seat_near_stove: '靠灶的位置属于每天守着药锅的人。',
            father_back_to_door: '父亲亲手写过：他坐在背门的位置。',
            child_near_side_door: '刻着纸飞机的小碗一直挨着能逃出去的侧门。',
            offering_is_not_daily_bowl: '供位不是任何人的日常碗，它等的是没回来的人。'
        },
        hints: ['先用碗上的痕迹认出三个人。', '北位靠灶，西位背门，东位挨侧门；剩下的才是供位。'],
        reward: { flag: 'hasRice', item: '倒头饭' },
        conclusion: 'empty_seat', successText: '饭桌终于摆回原样。南边那碗冷饭，从一开始就在等没有回来的我。'
    }),
    secret_seals: board({
        id: 'secret_seals', title: '拆开封宅的四张纸扎封条',
        prerequisites: ['father_seal_note', 'puppet_shadow_map'],
        clues: [
            { id: 'father_seal_note', label: '父亲笔记：门留归路，窗绝外念，井压水魂，棺锁亡名' },
            { id: 'puppet_shadow_map', label: '木偶影子：东门、西窗、南井、北棺' }
        ],
        slots: [
            { id: 'east', label: '东方封条' }, { id: 'west', label: '西方封条' },
            { id: 'south', label: '南方封条' }, { id: 'north', label: '北方封条' }
        ],
        tokens: [
            { id: 'door', label: '门纹' }, { id: 'window', label: '窗纹' },
            { id: 'well', label: '井纹' }, { id: 'coffin', label: '棺纹' }
        ],
        answer: { east: 'door', west: 'window', south: 'well', north: 'coffin' },
        conflicts: { east: 'seal_east', west: 'seal_west', south: 'seal_south', north: 'seal_north' },
        messages: {
            seal_east: '木偶投向东方的是门框影子。', seal_west: '西边影子有窗棂。',
            seal_south: '南边圆口垂着井绳。', seal_north: '北边长方影子钉着七点。'
        },
        hints: ['先辨认四道影子的轮廓。', '按东门、西窗、南井、北棺放置。'],
        reward: { flag: 'hasMatches', item: '火柴' },
        conclusion: 'sealed_house', successText: '封条下面压着划火片和火柴。父亲封的不是鬼，是这栋不肯结束的家。'
    }),
    well_knots: board({
        id: 'well_knots', title: '辨认井绳上的结',
        prerequisites: ['well_charm_marks', 'kitchen_ghost_gesture'],
        clues: [
            { id: 'well_charm_marks', label: '湿符：圆结镇水，双结锁门，短结牵孩子' },
            { id: 'kitchen_ghost_gesture', label: '纸人袖口：纸飞机旁缝着一道短结' }
        ],
        slots: [{ id: 'child_mark', label: '孩子的记号' }, { id: 'leave_tied', label: '必须保留的镇水结' }],
        tokens: [
            { id: 'short_knot', label: '短结' }, { id: 'round_knot', label: '圆结' }, { id: 'double_knot', label: '双结' }
        ],
        answer: { child_mark: 'short_knot', leave_tied: 'round_knot' },
        conflicts: { child_mark: 'child_knot', leave_tied: 'water_knot' },
        messages: { child_knot: '纸飞机旁缝着的是短结。', water_knot: '湿符写明圆结镇水，不能解开。' },
        hints: ['纸人的袖口能认出孩子的结。', '解短结，保留圆结。'],
        reward: { flag: 'hasIncense', item: '香' },
        successText: '短结一松，井绳带出一把受潮的香。圆结还在，井下的水没有继续上涨。'
    }),
    attic_debt: board({
        id: 'attic_debt', title: '找出没有牌位的债主',
        prerequisites: ['attic_overview', 'father_debt_note'],
        clues: [
            { id: 'attic_overview', label: '破窗：父母都有坟位，孩子的方向只有一只空碗' },
            { id: 'father_debt_note', label: '账页：无尸、无牌位、照片缺角者，纸钱十年未断' }
        ],
        slots: [{ id: 'debtor', label: '被祭奠的人' }, { id: 'proof', label: '能排除父母的证据' }],
        tokens: [
            { id: 'father_bundle', label: '写“父”的纸束' }, { id: 'mother_bundle', label: '写“母”的纸束' },
            { id: 'child_bundle', label: '没有名字的短纸束' }, { id: 'grave_record', label: '父母坟位记录' }
        ],
        answer: { debtor: 'child_bundle', proof: 'grave_record' },
        conflicts: { debtor: 'debt_has_no_name', proof: 'parents_have_graves' },
        messages: { debt_has_no_name: '账页说债主没有牌位，也就不会写名字。', parents_have_graves: '坟位记录能证明父母不是那个无尸无牌位的人。' },
        hints: ['先排除已有坟位的人。', '选择无名短纸束，并用父母坟位记录作证。'],
        reward: { flag: 'hasSpiritMoney', item: '纸钱' },
        conclusion: 'unpaid_debt', successText: '无名纸束落下来。父亲烧了十年纸钱，却从没敢在上面写我的名字。'
    }),
    school: board({
        id: 'school', title: '找出被改写的最后一夜',
        prerequisites: ['school_detention_clock', 'school_bus_ticket', 'school_report', 'father_school_statement'],
        clues: [
            { id: 'school_detention_clock', label: '留堂钟停在 18:10' },
            { id: 'school_bus_ticket', label: '末班车 18:20 发车，回村至少二十分钟' },
            { id: 'school_report', label: '成绩单背面的红字被反复改写' },
            { id: 'father_school_statement', label: '父亲声称 18:00 已在家中争吵' }
        ],
        slots: [
            { id: 'leave_time', label: '能证明离校时间' },
            { id: 'earliest_home', label: '能证明最早到家时间' },
            { id: 'false_claim', label: '不可能成立的说法' }
        ],
        tokens: [
            { id: 'clock', label: '留堂钟' }, { id: 'bus', label: '末班车票' },
            { id: 'report', label: '涂改成绩单' }, { id: 'father_claim', label: '父亲给老师的说明' }
        ],
        answer: { leave_time: 'clock', earliest_home: 'bus', false_claim: 'father_claim' },
        conflicts: { leave_time: 'clock_proves_departure', earliest_home: 'bus_proves_travel', false_claim: 'claim_breaks_timeline' },
        messages: {
            clock_proves_departure: '成绩单不能证明几点离校，停住的留堂钟可以。',
            bus_proves_travel: '末班车票和车程共同限制了最早到家时间。',
            claim_breaks_timeline: '18:10 仍在学校的人，不可能 18:00 已在家争吵。'
        },
        hints: ['先分别找“离开学校”和“回到村里”的时间证据。', '18:10 仍在学校，父亲声称的 18:00 争吵不可能发生。'],
        conclusion: 'rewritten_night', successText: '时间线对上了。父亲后来改写了最后一夜，想把我的逃跑变成一次普通顶嘴。'
    }),
    hospital: board({
        id: 'hospital', title: '找出治疗被中断的那一天',
        prerequisites: ['hospital_prescription', 'hospital_pill_count', 'hospital_ward_log', 'hospital_bill'],
        clues: [
            { id: 'hospital_prescription', label: '七日处方：每天早晚各一片，共十四片' },
            { id: 'hospital_pill_count', label: '第五天清晨药盒还剩八片' },
            { id: 'hospital_ward_log', label: '第四日晚父亲取走药盒，母亲次日未服药' },
            { id: 'hospital_bill', label: '缴费单在第四日晚被签字拒付' }
        ],
        slots: [{ id: 'stop_day', label: '实际停药日' }, { id: 'cause_evidence', label: '能证明人为阻断的证据' }],
        tokens: [
            { id: 'day_three', label: '第三日' }, { id: 'day_four', label: '第四日' }, { id: 'day_five', label: '第五日' },
            { id: 'pill_count', label: '药盒余量' }, { id: 'ward_log', label: '病房记录' }, { id: 'bill', label: '拒付缴费单' }
        ],
        answer: { stop_day: 'day_four', cause_evidence: 'ward_log' },
        conflicts: { stop_day: 'pill_count_math', cause_evidence: 'record_proves_action' },
        messages: {
            pill_count_math: '十四片每天用两片，第五天清晨剩八片，说明第四日之后没有再服。',
            record_proves_action: '余量和账单只能证明中断，病房记录才写明父亲取走了药。'
        },
        hints: ['先用十四片和每天两片计算余量。', '停在第四日；病房记录直接写明谁取走了药盒。'],
        conclusion: 'treatment_blocked', successText: '八片药把谎话堵死了：治疗在第四天被父亲拿走药盒后中断。'
    }),
    altar_ritual: board({
        id: 'altar_ritual', title: '把最后一顿饭送到正确的位置',
        prerequisites: ['empty_seat', 'sealed_house', 'unpaid_debt'],
        clues: [
            { id: 'empty_seat', label: '空位：饭等的是没有回来的孩子' },
            { id: 'sealed_house', label: '封宅：火只能在最后照出亡名' },
            { id: 'unpaid_debt', label: '旧债：纸钱先替亡者买一条归路' }
        ],
        slots: [
            { id: 'leave_seat', label: '留位' }, { id: 'guide_spirit', label: '引魂' },
            { id: 'pay_debt', label: '偿债' }, { id: 'show_truth', label: '照真' }
        ],
        tokens: [
            { id: 'rice', label: '倒头饭' }, { id: 'incense', label: '香' },
            { id: 'spirit_money', label: '纸钱' }, { id: 'matches', label: '火柴' }
        ],
        answer: { leave_seat: 'rice', guide_spirit: 'incense', pay_debt: 'spirit_money', show_truth: 'matches' },
        conflicts: { leave_seat: 'rice_waits', guide_spirit: 'incense_guides', pay_debt: 'money_pays', show_truth: 'fire_reveals' },
        messages: {
            rice_waits: '留位上该放等待未归者的饭。', incense_guides: '香负责把散去的魂引到桌前。',
            money_pays: '纸钱偿还旧债，不负责照明。', fire_reveals: '火最后点亮遗像，让亡者看见自己的名字。'
        },
        hints: ['四个位置的动词已经说明供品用途。', '饭留位、香引魂、纸钱偿债、火柴照真。'],
        ritual: true,
        successText: '火光照过遗像，父亲的脸褪成了少年时的我。供桌一直在等我入席。'
    })
};

export function canStartPuzzle(puzzle, collectedClues) {
    return (puzzle?.prerequisites || []).every(id => collectedClues.includes(id));
}

export function isPuzzleAnswerCorrect(puzzle, answer) {
    if (Array.isArray(puzzle?.answer)) {
        return Array.isArray(answer) && answer.length === puzzle.answer.length && answer.every((id, index) => id === puzzle.answer[index]);
    }
    return (puzzle?.slots || []).every(slot => answer?.[slot.id] === puzzle.answer?.[slot.id]);
}
