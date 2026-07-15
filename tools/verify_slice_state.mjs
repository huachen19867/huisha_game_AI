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
import { createDefaultGameState, normalizeGameState } from '../src/systems/StoryState.js';

const initial = createDefaultSliceState();
assert.deepEqual(initial, {
    enabled: true,
    slicePhase: 'arrival',
    bowlPlacements: { nail: null, stove: null, side: null },
    heldBowl: null,
    mealReplaySeen: [],
    tableSolved: false,
    houseRuleDemonstrated: false,
    fatherAttention: 'quiet',
    lastTraversedDoor: 'main_to_kitchen',
    planeChoice: null,
    paperDollIndex: 0,
    sliceCompleted: false
});
assert.deepEqual(SLICE_PHASES, ['arrival', 'investigation', 'table', 'rule', 'bedroom', 'return', 'complete']);
assert.equal(Object.isFrozen(SLICE_PHASES), true);

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
assert.deepEqual(partialSliceState.slice.bowlPlacements, { nail: 'left', stove: null, side: null });
assert.deepEqual(partialSliceState.slice.mealReplaySeen, ['first_meal', 'second_meal']);

const invalidReplayState = { slice: { mealReplaySeen: 'first_meal' } };
assert.deepEqual(ensureSliceState(invalidReplayState).mealReplaySeen, []);

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
assert.deepEqual(enabledSliceState.slice.bowlPlacements, { nail: null, stove: null, side: 'right' });
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
    const storyEndIndex = generatedIndex.indexOf(storyEndMarker);
    const sliceBeginIndex = generatedIndex.indexOf(sliceBeginMarker);
    assert.notEqual(storyEndIndex, -1, 'generated index must contain the StoryState bundle block');
    assert.notEqual(sliceBeginIndex, -1, 'generated index must contain the SliceState bundle block');
    assert.ok(sliceBeginIndex > storyEndIndex, 'SliceState bundle block must follow StoryState');
    assert.equal(
        generatedIndex.slice(storyEndIndex + storyEndMarker.length, sliceBeginIndex).trim(),
        '',
        'SliceState bundle block must be immediately after StoryState'
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
