export const Puzzles = {
    school: {
        id: 'school', title: '把试卷按年份排好',
        prerequisites: ['school_blackboard', 'school_report'],
        options: [
            { id: 'exam_1988', label: '1988：离家前最后一次考试' },
            { id: 'exam_1986', label: '1986：第一次被罚站' },
            { id: 'exam_1987', label: '1987：奖状背面的红字' }
        ],
        answer: ['exam_1986', 'exam_1987', 'exam_1988'],
        successText: '三张试卷连成了父亲控制逐年加深的轨迹。'
    },
    hospital: {
        id: 'hospital', title: '拼出治疗被阻断的过程',
        prerequisites: ['hospital_window', 'hospital_ward'],
        options: [
            { id: 'unpaid_bill', label: '未缴费单：家丑不可外扬' },
            { id: 'diagnosis', label: '诊断：需要规律服药与住院观察' },
            { id: 'prescription', label: '处方：医生开出的治疗方案' }
        ],
        answer: ['diagnosis', 'prescription', 'unpaid_bill'],
        successText: '母亲不是不肯治疗，而是治疗被父亲亲手中断。'
    }
};

export function canStartPuzzle(puzzle, collectedClues) {
    return puzzle.prerequisites.every(id => collectedClues.includes(id));
}

export function isPuzzleAnswerCorrect(puzzle, answer) {
    return answer.length === puzzle.answer.length && answer.every((id, index) => id === puzzle.answer[index]);
}
