import assert from 'node:assert/strict';
import { Maps } from '../src/data/Maps.js';
import { Puzzles } from '../src/data/Puzzles.js';
import { createDefaultGameState } from '../src/systems/StoryState.js';
import { getNarrativePhase, getNarrativeSummary, getPendingNarrativeBeat } from '../src/systems/NarrativeDirector.js';
import { getCurrentObjective } from '../src/systems/ObjectiveManager.js';

const ids = mapId => Maps[mapId].objects.interactables.map(item => item.clueId).filter(Boolean);
for (const clueId of ['school_detention_clock', 'school_bus_ticket', 'school_report', 'father_school_statement']) {
    assert.ok(ids('memory_school').includes(clueId), `school is missing ${clueId}`);
}
for (const clueId of ['hospital_prescription', 'hospital_pill_count', 'hospital_ward_log', 'hospital_bill']) {
    assert.ok(ids('memory_hospital').includes(clueId), `hospital is missing ${clueId}`);
}
assert.deepEqual(Puzzles.school.prerequisites, ['school_detention_clock', 'school_bus_ticket', 'school_report', 'father_school_statement']);
assert.deepEqual(Puzzles.hospital.prerequisites, ['hospital_prescription', 'hospital_pill_count', 'hospital_ward_log', 'hospital_bill']);
assert.equal(Maps.memory_school.purpose, '用时间证据找出父亲改写的最后一夜');
assert.equal(Maps.memory_hospital.purpose, '用处方与余量找出治疗被中断的日期');

const lastNight = createDefaultGameState();
lastNight.doorSlammed = true;
lastNight.storyFlags.caseConclusions.push('empty_seat', 'rewritten_night');
assert.equal(getPendingNarrativeBeat(lastNight)?.id, 'last_night_echo');
assert.equal(getNarrativePhase(lastNight), 'recognition');
assert.equal(getNarrativeSummary(lastNight), '父亲改写了最后一夜；饭桌空位等的是我。');

const family = createDefaultGameState();
family.storyFlags.caseConclusions.push('treatment_blocked', 'sealed_house');
assert.equal(getPendingNarrativeBeat(family)?.id, 'sealed_family_echo');
assert.equal(getNarrativePhase(family), 'anger');

const objective = createDefaultGameState();
objective.doorSlammed = true;
assert.equal(getCurrentObjective(objective, 'room_kitchen'), '找出饭桌上空着的是谁的位置');
assert.equal(getCurrentObjective(objective, 'memory_school'), '用时间证据找出父亲哪句话不可能成立');
assert.equal(getCurrentObjective(objective, 'memory_hospital'), '用处方和药盒余量计算实际停药日');

console.log('Case conclusion verification passed');
