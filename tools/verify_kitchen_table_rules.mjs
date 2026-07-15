import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    CORRECT_SEATING,
    KITCHEN_BOWLS,
    KITCHEN_SEATS,
    evaluateSeating,
    normalizeBowlPlacements,
    placeBowl,
    selectContradiction
} from '../src/systems/KitchenTableRules.js';

const empty = { nail:null, stove:null, side:null };
assert.deepEqual(placeBowl(empty,'nail','wine'), {nail:'wine',stove:null,side:null});
assert.deepEqual(placeBowl({nail:'wine',stove:null,side:null},'stove','wine'), {nail:null,stove:'wine',side:null});
assert.deepEqual(evaluateSeating(CORRECT_SEATING), {status:'correct',contradictions:[]});
const fatherWrong={nail:'medicine',stove:'wine',side:'child'};
assert.deepEqual(evaluateSeating(fatherWrong).contradictions,['father_lock','mother_break']);
assert.equal(selectContradiction(fatherWrong,[]),'father_lock');
assert.equal(selectContradiction(fatherWrong),'father_lock');
assert.equal(selectContradiction(fatherWrong,['father_lock']),'mother_break');
assert.equal(selectContradiction(fatherWrong,['father_lock','mother_break']),'father_lock');
assert.throws(()=>placeBowl(empty,'missing','wine'),/unknown seat/i);
assert.throws(()=>placeBowl(empty,'nail','missing'),/unknown bowl/i);

assert.deepEqual(KITCHEN_SEATS, ['nail', 'stove', 'side']);
assert.deepEqual(KITCHEN_BOWLS, ['wine', 'medicine', 'child']);
assert.deepEqual(CORRECT_SEATING, { nail: 'wine', stove: 'medicine', side: 'child' });
assert.equal(Object.isFrozen(KITCHEN_SEATS), true);
assert.equal(Object.isFrozen(KITCHEN_BOWLS), true);
assert.equal(Object.isFrozen(CORRECT_SEATING), true);

const invalidPlacements = [null, undefined, 'not placements', []];
for (const invalidPlacementsValue of invalidPlacements) {
    assert.throws(
        () => normalizeBowlPlacements(invalidPlacementsValue),
        /placements must be an object/i
    );
    assert.throws(
        () => evaluateSeating(invalidPlacementsValue),
        /placements must be an object/i
    );
    assert.throws(
        () => placeBowl(invalidPlacementsValue, 'nail', 'wine'),
        /placements must be an object/i
    );
    assert.throws(
        () => selectContradiction(invalidPlacementsValue),
        /placements must be an object/i
    );
}

const normalizedCorrect = normalizeBowlPlacements(CORRECT_SEATING);
assert.deepEqual(normalizedCorrect, CORRECT_SEATING);
assert.notEqual(normalizedCorrect, CORRECT_SEATING, 'normalization must return a fresh object');
assert.deepEqual(normalizeBowlPlacements({ nail: undefined, stove: null }), empty);

const corruptPlacements = {
    nail: 'wine',
    stove: 'wine',
    side: 'missing',
    unrelated: 'medicine'
};
const corruptPlacementsSnapshot = structuredClone(corruptPlacements);
const normalizedCorrupt = normalizeBowlPlacements(corruptPlacements);
assert.deepEqual(normalizedCorrupt, { nail: 'wine', stove: null, side: null });
assert.deepEqual(Object.keys(normalizedCorrupt), KITCHEN_SEATS);
assert.deepEqual(corruptPlacements, corruptPlacementsSnapshot, 'normalization must not mutate input');

const placement = { nail: 'wine', stove: null, side: 'child' };
const placementSnapshot = structuredClone(placement);
assert.deepEqual(placeBowl(placement, 'stove', 'wine'), {
    nail: null,
    stove: 'wine',
    side: 'child'
});
assert.deepEqual(placement, placementSnapshot, 'placeBowl must not mutate its input');

const occupied = { nail: 'wine', stove: 'medicine', side: null };
const occupiedSnapshot = structuredClone(occupied);
assert.deepEqual(placeBowl(occupied, 'stove', 'child'), {
    nail: 'wine',
    stove: 'child',
    side: null
});
assert.deepEqual(occupied, occupiedSnapshot, 'displacing a bowl must not mutate the input');

assert.deepEqual(placeBowl(CORRECT_SEATING, 'stove', 'wine'), {
    nail: null,
    stove: 'wine',
    side: 'child'
});

const repairedPlacements = placeBowl(corruptPlacements, 'side', 'medicine');
assert.deepEqual(repairedPlacements, { nail: 'wine', stove: null, side: 'medicine' });
assert.deepEqual(corruptPlacements, corruptPlacementsSnapshot, 'repairing must not mutate input');

const stableInput = { nail: 'wine', stove: null, side: null };
const stableResult = placeBowl(stableInput, 'nail', 'wine');
assert.deepEqual(stableResult, stableInput);
assert.notEqual(stableResult, stableInput, 'stable placement must return a fresh object');

assert.deepEqual(evaluateSeating(empty), { status: 'incomplete', contradictions: [] });
assert.deepEqual(
    evaluateSeating({ nail: 'wine', stove: 'medicine', side: null }),
    { status: 'incomplete', contradictions: [] }
);
assert.deepEqual(
    evaluateSeating({ nail: 'wine', stove: 'medicine', side: 'missing' }),
    { status: 'incomplete', contradictions: [] }
);
assert.deepEqual(
    evaluateSeating({ nail: 'wine', stove: 'wine', side: 'child' }),
    { status: 'incomplete', contradictions: [] }
);

function permutations(values) {
    if (values.length === 0) return [[]];
    return values.flatMap((value, index) =>
        permutations(values.filter((_, itemIndex) => itemIndex !== index))
            .map(rest => [value, ...rest])
    );
}

const contradictionBySeat = {
    nail: 'father_lock',
    stove: 'mother_break',
    side: 'child_shard'
};
let correctCount = 0;
for (const bowls of permutations(KITCHEN_BOWLS)) {
    const seating = Object.fromEntries(KITCHEN_SEATS.map((seat, index) => [seat, bowls[index]]));
    const seatingSnapshot = structuredClone(seating);
    const expectedContradictions = KITCHEN_SEATS
        .filter(seat => seating[seat] !== CORRECT_SEATING[seat])
        .map(seat => contradictionBySeat[seat]);
    const evaluation = evaluateSeating(seating);

    if (expectedContradictions.length === 0) {
        correctCount += 1;
        assert.deepEqual(evaluation, { status: 'correct', contradictions: [] });
    } else {
        assert.deepEqual(evaluation, {
            status: 'incorrect',
            contradictions: expectedContradictions
        });
    }
    assert.deepEqual(seating, seatingSnapshot, 'evaluateSeating must not mutate placements');
}
assert.equal(correctCount, 1, 'exactly one complete seating must be correct');

const allWrong = { nail: 'medicine', stove: 'child', side: 'wine' };
const seen = ['father_lock'];
const seenSnapshot = structuredClone(seen);
assert.equal(selectContradiction(allWrong, seen), 'mother_break');
assert.deepEqual(seen, seenSnapshot, 'selectContradiction must not mutate seen IDs');
assert.equal(selectContradiction(allWrong, ['father_lock', 'mother_break']), 'child_shard');
assert.equal(
    selectContradiction(allWrong, ['father_lock', 'mother_break', 'child_shard']),
    'father_lock'
);
assert.equal(selectContradiction(empty, []), null);
assert.equal(selectContradiction(CORRECT_SEATING, []), null);
for (const invalidSeen of [null, 'father_lock', {}, 1]) {
    assert.throws(
        () => selectContradiction(fatherWrong, invalidSeen),
        /seen contradictions must be an array/i
    );
}

const builderSource = readFileSync(new URL('./build_standalone_entry.mjs', import.meta.url), 'utf8');
const sliceStateEntry = "    'src/systems/SliceState.js',";
const kitchenRulesEntry = "    'src/systems/KitchenTableRules.js',";
const sliceStateIndex = builderSource.indexOf(sliceStateEntry);
const kitchenRulesIndex = builderSource.indexOf(kitchenRulesEntry);
assert.notEqual(sliceStateIndex, -1, 'Standalone builder must list SliceState');
assert.notEqual(kitchenRulesIndex, -1, 'Standalone builder must list KitchenTableRules');
assert.equal(
    builderSource.slice(sliceStateIndex + sliceStateEntry.length, kitchenRulesIndex).trim(),
    '',
    'Standalone builder must list KitchenTableRules immediately after SliceState'
);

console.log('Kitchen table rules verification passed');
