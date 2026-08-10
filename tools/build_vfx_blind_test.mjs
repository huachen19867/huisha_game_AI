import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
    const split = entry.indexOf('=');
    const rawKey = split === -1 ? entry : entry.slice(0, split);
    const key = rawKey.replace(/^--?/, '');
    return split === -1 ? [key, true] : [key, entry.slice(split + 1)];
}));
const baseline = resolve(root, args.baseline || 'artifacts/visual-qa/v4-baseline');
const candidate = resolve(root, args.candidate || 'artifacts/visual-qa/v4-candidate');
const output = resolve(root, args.output || 'artifacts/visual-qa/blind-v4-vfx');
const seed = Number(args.seed || Date.now());
const outputFrameNames = ['frame-00.png', 'frame-01.png', 'frame-02.png', 'frame-03.png'];
const frameNames = args.frames
    ? String(args.frames).split(',')
    : outputFrameNames;
const frameTimes = args.times
    ? String(args.times).split(',').map(Number)
    : [0, 1.25, 2.5, 3.75];
assert.equal(frameNames.length, outputFrameNames.length, '--frames must list exactly four PNG filenames');
assert(frameNames.every((name) => /^frame-\d+\.png$/.test(name)), '--frames must contain frame-*.png filenames');
assert.equal(frameTimes.length, outputFrameNames.length, '--times must list exactly four values');
assert(frameTimes.every(Number.isFinite), '--times values must be finite numbers');

function pngSize(buffer) {
    assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', 'Every VFX blind-test frame must be a PNG');
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const groups = [
    { directory: baseline, truth: 'baseline' },
    { directory: candidate, truth: 'candidate' }
];
let expectedSize = null;
for (const group of groups) {
    for (const frameName of frameNames) {
        const buffer = await readFile(resolve(group.directory, frameName));
        const size = pngSize(buffer);
        if (!expectedSize) expectedSize = size;
        assert.deepEqual(size, expectedSize, 'All eight VFX frames must share one viewport');
    }
}

const flip = Math.abs(seed) % 2 === 1;
const ordered = flip ? [groups[1], groups[0]] : groups;
await mkdir(resolve(output, 'A'), { recursive: true });
await mkdir(resolve(output, 'B'), { recursive: true });
for (let groupIndex = 0; groupIndex < ordered.length; groupIndex += 1) {
    const label = groupIndex === 0 ? 'A' : 'B';
    for (let frameIndex = 0; frameIndex < frameNames.length; frameIndex += 1) {
        await copyFile(
            resolve(ordered[groupIndex].directory, frameNames[frameIndex]),
            resolve(output, label, outputFrameNames[frameIndex])
        );
    }
}
let template = await readFile(resolve(root, 'tools/vfx_blind_test_template.html'), 'utf8');
frameTimes.forEach((time, index) => {
    template = template.replace(`>T${index}<`, `>${time}s<`);
});
await writeFile(resolve(output, 'index.html'), template, 'utf8');
await writeFile(resolve(output, '.answer.json'), JSON.stringify({
    seed,
    mode: 'ordered-four-frame-groups',
    viewport: expectedSize,
    times: frameTimes,
    A: ordered[0].truth,
    B: ordered[1].truth
}, null, 2), 'utf8');
console.log(`VFX blind test built at ${output}`);
