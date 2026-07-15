import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    SLICE_PHASES,
    choosePlane,
    createDefaultSliceState,
    ensureSliceState,
    transitionSlicePhase
} from '../src/systems/SliceState.js';
import { SLICE_DOOR_IDS } from '../src/data/SliceMaps.js';
import { createDefaultGameState, normalizeGameState } from '../src/systems/StoryState.js';

const initial = createDefaultSliceState();
const canonicalSliceKeys = Object.keys(initial);
assert.deepEqual(initial, {
    enabled: true,
    slicePhase: 'arrival',
    bowlPlacements: { nail: null, stove: null, side: null },
    heldBowl: null,
    mealReplaySeen: [],
    tableSolved: false,
    houseRuleDemonstrated: false,
    fatherAttention: 'quiet',
    lastTraversedDoor: 'main_kitchen_door',
    planeChoice: null,
    paperDollIndex: 0,
    sliceCompleted: false
});
assert.deepEqual(SLICE_PHASES, ['arrival', 'investigation', 'table', 'rule', 'bedroom', 'return', 'complete']);
assert.equal(Object.isFrozen(SLICE_PHASES), true);
assert.equal(Object.isFrozen(initial), false);
assert.equal(Object.isFrozen(initial.bowlPlacements), false);
assert.ok(SLICE_DOOR_IDS.includes(initial.lastTraversedDoor));

for (const doorId of SLICE_DOOR_IDS) {
    const persistedDoorState = { slice: { lastTraversedDoor: doorId } };
    assert.equal(ensureSliceState(persistedDoorState).lastTraversedDoor, doorId);
}

for (const invalidDoorId of [undefined, null, '', 1, 'main_to_kitchen', 'missing_slice_door']) {
    const invalidDoorState = { slice: { lastTraversedDoor: invalidDoorId } };
    assert.equal(ensureSliceState(invalidDoorState).lastTraversedDoor, 'main_kitchen_door');
}

const gameState = {};
assert.equal(ensureSliceState(gameState), gameState.slice);
assert.deepEqual(gameState.slice, initial);

const partialSliceState = {
    slice: {
        bowlPlacements: { nail: 'left' },
        mealReplaySeen: ['first_meal', 'first_meal', 'second_meal']
    }
};
ensureSliceState(partialSliceState);
assert.deepEqual(partialSliceState.slice.bowlPlacements, { nail: null, stove: null, side: null });
assert.deepEqual(partialSliceState.slice.mealReplaySeen, ['first_meal', 'second_meal']);

const invalidReplayState = { slice: { mealReplaySeen: 'first_meal' } };
assert.deepEqual(ensureSliceState(invalidReplayState).mealReplaySeen, []);

const injectedSlice = {
    enabled: 'yes',
    mealReplaySeen: ['first_meal'],
    contradictionsSeen: ['father_lock'],
    injectedUnknownField: { unsafe: true }
};
const injectedSliceSnapshot = structuredClone(injectedSlice);
const injectedState = { slice: injectedSlice };
const canonicalInjectedSlice = ensureSliceState(injectedState);
assert.deepEqual(Object.keys(canonicalInjectedSlice), canonicalSliceKeys);
assert.equal(Object.hasOwn(canonicalInjectedSlice, 'contradictionsSeen'), false);
assert.equal(Object.hasOwn(canonicalInjectedSlice, 'injectedUnknownField'), false);
assert.deepEqual(canonicalInjectedSlice.mealReplaySeen, ['first_meal']);
assert.equal(canonicalInjectedSlice.enabled, true);
assert.notEqual(canonicalInjectedSlice, injectedSlice);
assert.deepEqual(injectedSlice, injectedSliceSnapshot);

assert.deepEqual(
    [false, 'yes'].map(enabled => ensureSliceState({ slice: { enabled } }).enabled),
    [true, true]
);

const corruptPlacements = { nail: 'wine', stove: 'wine', side: 'unknown', extra: 'child' };
const corruptReplay = [7, '', 'first_meal', 'first_meal', null, 'second_meal'];
const corruptSlice = {
    enabled: true,
    slicePhase: 'unknown',
    bowlPlacements: corruptPlacements,
    heldBowl: 'unknown',
    mealReplaySeen: corruptReplay,
    tableSolved: 'false',
    houseRuleDemonstrated: 'true',
    fatherAttention: 'alert',
    lastTraversedDoor: 'main_to_kitchen',
    planeChoice: 'burn',
    paperDollIndex: 4,
    sliceCompleted: true
};
const corruptSliceSnapshot = structuredClone(corruptSlice);
const corruptState = { slice: corruptSlice };
const canonicalSlice = ensureSliceState(corruptState);
assert.equal(Object.isFrozen(canonicalSlice), false);
assert.equal(Object.isFrozen(canonicalSlice.bowlPlacements), false);
assert.notEqual(canonicalSlice, corruptSlice);
assert.notEqual(canonicalSlice.bowlPlacements, corruptPlacements);
assert.notEqual(canonicalSlice.mealReplaySeen, corruptReplay);
assert.deepEqual(corruptSlice, corruptSliceSnapshot);
assert.deepEqual(canonicalSlice, {
    enabled: true,
    slicePhase: 'arrival',
    bowlPlacements: { nail: 'wine', stove: null, side: null },
    heldBowl: null,
    mealReplaySeen: ['first_meal', 'second_meal'],
    tableSolved: false,
    houseRuleDemonstrated: false,
    fatherAttention: 'quiet',
    lastTraversedDoor: 'main_kitchen_door',
    planeChoice: null,
    paperDollIndex: 0,
    sliceCompleted: false
});

const correctPlacements = { nail: 'wine', stove: 'medicine', side: 'child' };
const persistedSolvedState = {
    slice: {
        bowlPlacements: correctPlacements,
        heldBowl: 'child',
        tableSolved: true,
        houseRuleDemonstrated: true
    }
};
const solvedSlice = ensureSliceState(persistedSolvedState);
assert.deepEqual(solvedSlice.bowlPlacements, correctPlacements);
assert.equal(solvedSlice.tableSolved, true);
assert.equal(solvedSlice.heldBowl, null);
assert.equal(solvedSlice.houseRuleDemonstrated, true);

for (const bowlPlacements of [
    { nail: 'wine', stove: 'medicine', side: null },
    { nail: 'medicine', stove: 'wine', side: 'child' }
]) {
    const inconsistentSolvedState = {
        slice: {
            bowlPlacements,
            tableSolved: true,
            houseRuleDemonstrated: true
        }
    };
    const normalizedSlice = ensureSliceState(inconsistentSolvedState);
    assert.equal(normalizedSlice.tableSolved, false);
    assert.equal(normalizedSlice.houseRuleDemonstrated, false);
}

const heldBowlState = {
    slice: {
        bowlPlacements: correctPlacements,
        heldBowl: 'wine',
        tableSolved: false
    }
};
const heldBowlSlice = ensureSliceState(heldBowlState);
assert.deepEqual(heldBowlSlice.bowlPlacements, { nail: null, stove: 'medicine', side: 'child' });
assert.equal(heldBowlSlice.heldBowl, 'wine');
assert.equal(heldBowlSlice.tableSolved, false);

for (const persistedBoolean of [false, 'true', 'false', 1]) {
    const nonStrictBooleanState = {
        slice: {
            bowlPlacements: correctPlacements,
            tableSolved: persistedBoolean,
            houseRuleDemonstrated: persistedBoolean
        }
    };
    const normalizedSlice = ensureSliceState(nonStrictBooleanState);
    assert.equal(normalizedSlice.tableSolved, false);
    assert.equal(normalizedSlice.houseRuleDemonstrated, false);
}

for (const persistedHouseRule of [false, 'true', 'false', 1]) {
    const nonStrictHouseRuleState = {
        slice: {
            bowlPlacements: correctPlacements,
            tableSolved: true,
            houseRuleDemonstrated: persistedHouseRule
        }
    };
    const normalizedSlice = ensureSliceState(nonStrictHouseRuleState);
    assert.equal(normalizedSlice.tableSolved, true);
    assert.equal(normalizedSlice.houseRuleDemonstrated, false);
}

for (const invalidPlacements of [undefined, null, [], 'invalid']) {
    const invalidPlacementsState = { slice: { bowlPlacements: invalidPlacements } };
    assert.deepEqual(
        ensureSliceState(invalidPlacementsState).bowlPlacements,
        { nail: null, stove: null, side: null }
    );
}

for (const attention of ['quiet', 'suspicious', 'checking', 'chasing']) {
    assert.equal(ensureSliceState({ slice: { fatherAttention: attention } }).fatherAttention, attention);
}
for (const invalidAttention of [undefined, null, '', 'alert', 1]) {
    assert.equal(ensureSliceState({ slice: { fatherAttention: invalidAttention } }).fatherAttention, 'quiet');
}

for (const planeChoice of ['take', 'leave']) {
    assert.equal(ensureSliceState({ slice: { planeChoice } }).planeChoice, planeChoice);
}
for (const invalidPlaneChoice of [undefined, '', 'burn', 1]) {
    assert.equal(ensureSliceState({ slice: { planeChoice: invalidPlaneChoice } }).planeChoice, null);
}

for (const paperDollIndex of [0, 1, 2]) {
    assert.equal(ensureSliceState({ slice: { paperDollIndex } }).paperDollIndex, paperDollIndex);
}
for (const invalidPaperDollIndex of [undefined, null, -1, 1.5, 3, '1']) {
    assert.equal(ensureSliceState({ slice: { paperDollIndex: invalidPaperDollIndex } }).paperDollIndex, 0);
}

const persistedCompleteState = {
    slice: { enabled: true, slicePhase: 'complete', sliceCompleted: false }
};
assert.equal(ensureSliceState(persistedCompleteState).sliceCompleted, true);

const persistedIncompleteState = {
    slice: { enabled: true, slicePhase: 'table', sliceCompleted: true }
};
assert.equal(ensureSliceState(persistedIncompleteState).sliceCompleted, false);

const invalidPersistedPhaseState = {
    slice: { enabled: true, slicePhase: 'bogus', sliceCompleted: true }
};
ensureSliceState(invalidPersistedPhaseState);
assert.equal(invalidPersistedPhaseState.slice.slicePhase, 'arrival');
assert.equal(invalidPersistedPhaseState.slice.sliceCompleted, false);

const investigated = transitionSlicePhase(gameState.slice, 'investigation');
assert.equal(investigated.slicePhase, 'investigation');
assert.equal(investigated.sliceCompleted, false);
const table = transitionSlicePhase(investigated, 'table');
assert.equal(table.slicePhase, 'table');
assert.equal(table.sliceCompleted, false);
const backwards = transitionSlicePhase(table, 'investigation');
assert.equal(backwards, table);
assert.equal(backwards.slicePhase, 'table');
assert.throws(() => transitionSlicePhase(gameState.slice, 'complete'), /cannot skip/i);
assert.throws(
    () => transitionSlicePhase({ ...gameState.slice, slicePhase: 'bogus' }, 'arrival'),
    /unknown slice phase/i
);
assert.throws(() => transitionSlicePhase(gameState.slice, 'bogus'), /unknown slice phase/i);
const rule = transitionSlicePhase(table, 'rule');
assert.equal(rule.slicePhase, 'rule');
assert.equal(rule.sliceCompleted, false);
const bedroom = transitionSlicePhase(rule, 'bedroom');
assert.equal(bedroom.slicePhase, 'bedroom');
assert.equal(bedroom.sliceCompleted, false);
const returning = transitionSlicePhase(bedroom, 'return');
assert.equal(returning.slicePhase, 'return');
assert.equal(returning.sliceCompleted, false);
const completed = transitionSlicePhase(returning, 'complete');
assert.equal(completed.slicePhase, 'complete');
assert.equal(completed.sliceCompleted, true);

assert.throws(() => choosePlane(gameState.slice, 'fold'), /unknown plane choice/i);
const tookPlane = choosePlane(gameState.slice, 'take');
assert.equal(tookPlane.planeChoice, 'take');
assert.equal(choosePlane(tookPlane, 'take').planeChoice, 'take');
assert.throws(() => choosePlane(choosePlane(gameState.slice, 'leave'), 'take'), /locked/i);

const legacyState = createDefaultGameState();
assert.equal(legacyState.slice, null);
normalizeGameState(legacyState);
assert.equal(legacyState.slice, null);

const disabledSlice = {
    enabled: false,
    slicePhase: 'complete',
    sliceCompleted: false,
    bowlPlacements: { nail: 'legacy' }
};
const disabledSliceSnapshot = structuredClone(disabledSlice);
const disabledSliceState = { slice: disabledSlice };
normalizeGameState(disabledSliceState);
assert.equal(disabledSliceState.slice, disabledSlice);
assert.deepEqual(disabledSliceState.slice, disabledSliceSnapshot);

const nonBooleanEnabledSlice = {
    enabled: 'yes',
    contradictionsSeen: ['legacy_value'],
    injectedUnknownField: true
};
const nonBooleanEnabledSnapshot = structuredClone(nonBooleanEnabledSlice);
const nonBooleanEnabledState = { slice: nonBooleanEnabledSlice };
normalizeGameState(nonBooleanEnabledState);
assert.equal(nonBooleanEnabledState.slice, nonBooleanEnabledSlice);
assert.deepEqual(nonBooleanEnabledState.slice, nonBooleanEnabledSnapshot);

const unmarkedSlice = {
    slicePhase: 'complete',
    sliceCompleted: false,
    mealReplaySeen: ['meal', 'meal']
};
const unmarkedSliceSnapshot = structuredClone(unmarkedSlice);
const unmarkedSliceState = { slice: unmarkedSlice };
normalizeGameState(unmarkedSliceState);
assert.equal(unmarkedSliceState.slice, unmarkedSlice);
assert.deepEqual(unmarkedSliceState.slice, unmarkedSliceSnapshot);

const enabledSliceState = {
    slice: {
        enabled: true,
        bowlPlacements: { side: 'right' },
        mealReplaySeen: ['meal', 'meal']
    }
};
normalizeGameState(enabledSliceState);
assert.equal(enabledSliceState.slice.slicePhase, 'arrival');
assert.deepEqual(enabledSliceState.slice.bowlPlacements, { nail: null, stove: null, side: null });
assert.deepEqual(enabledSliceState.slice.mealReplaySeen, ['meal']);

const tempRoot = await mkdtemp(join(tmpdir(), 'huisha-slice-state-'));
try {
    const tempToolsDir = join(tempRoot, 'tools');
    const tempBuilderPath = join(tempToolsDir, 'build_standalone_entry.mjs');
    await mkdir(tempToolsDir, { recursive: true });
    await Promise.all([
        copyFile(new URL('../index.html', import.meta.url), join(tempRoot, 'index.html')),
        cp(new URL('../src/', import.meta.url), join(tempRoot, 'src'), { recursive: true }),
        copyFile(new URL('./build_standalone_entry.mjs', import.meta.url), tempBuilderPath)
    ]);

    const buildResult = spawnSync(process.execPath, [tempBuilderPath], {
        cwd: tempRoot,
        encoding: 'utf8'
    });
    assert.equal(
        buildResult.status,
        0,
        `Standalone builder failed:\n${buildResult.error?.message || buildResult.stderr || buildResult.stdout}`
    );

    const generatedIndex = await readFile(join(tempRoot, 'index.html'), 'utf8');
    const storyEndMarker = '// END bundled src/systems/StoryState.js';
    const sliceBeginMarker = '// BEGIN bundled src/systems/SliceState.js';
    const sliceEndMarker = '// END bundled src/systems/SliceState.js';
    const kitchenRulesBeginMarker = '// BEGIN bundled src/systems/KitchenTableRules.js';
    const storyEndIndex = generatedIndex.indexOf(storyEndMarker);
    const sliceBeginIndex = generatedIndex.indexOf(sliceBeginMarker);
    const sliceEndIndex = generatedIndex.indexOf(sliceEndMarker);
    const kitchenRulesBeginIndex = generatedIndex.indexOf(kitchenRulesBeginMarker);
    assert.notEqual(storyEndIndex, -1, 'generated index must contain the StoryState bundle block');
    assert.notEqual(sliceBeginIndex, -1, 'generated index must contain the SliceState bundle block');
    assert.notEqual(sliceEndIndex, -1, 'generated index must contain the SliceState bundle end marker');
    assert.notEqual(kitchenRulesBeginIndex, -1, 'generated index must contain the KitchenTableRules bundle block');
    assert.ok(sliceBeginIndex > storyEndIndex, 'SliceState bundle block must follow StoryState');
    assert.equal(
        generatedIndex.slice(storyEndIndex + storyEndMarker.length, sliceBeginIndex).trim(),
        '',
        'SliceState bundle block must be immediately after StoryState'
    );
    assert.ok(kitchenRulesBeginIndex > sliceEndIndex, 'KitchenTableRules bundle block must follow SliceState');
    assert.equal(
        generatedIndex.slice(sliceEndIndex + sliceEndMarker.length, kitchenRulesBeginIndex).trim(),
        '',
        'KitchenTableRules bundle block must be immediately after SliceState'
    );

    const moduleScripts = [...generatedIndex.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)];
    assert.equal(moduleScripts.length, 1, 'generated index must contain one inline module');
    const generatedModule = moduleScripts[0][1];
    assert.doesNotMatch(generatedModule, /^\s*import\b/m, 'generated module must not retain static imports');
    assert.doesNotMatch(generatedModule, /\bimport\s*\(/, 'generated module must not retain dynamic imports');

    const tempModulePath = join(tempRoot, 'standalone-module.mjs');
    await writeFile(tempModulePath, generatedModule, 'utf8');
    const parseResult = spawnSync(process.execPath, ['--check', tempModulePath], {
        cwd: tempRoot,
        encoding: 'utf8'
    });
    assert.equal(
        parseResult.status,
        0,
        `Generated module did not parse:\n${parseResult.error?.message || parseResult.stderr || parseResult.stdout}`
    );
} finally {
    await rm(tempRoot, { recursive: true, force: true });
}

console.log('Slice state verification passed');
