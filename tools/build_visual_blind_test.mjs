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
const leftSource = resolve(root, args.left || 'artifacts/visual-qa/baseline.png');
const rightSource = resolve(root, args.right || 'artifacts/visual-qa/enhanced.png');
const output = resolve(root, args.output || 'artifacts/visual-qa/blind');
const seed = Number(args.seed || Date.now());
const flip = Math.abs(seed) % 2 === 1;
const ordered = flip
    ? [{ source: rightSource, truth: 'candidate' }, { source: leftSource, truth: 'baseline' }]
    : [{ source: leftSource, truth: 'baseline' }, { source: rightSource, truth: 'candidate' }];

await mkdir(output, { recursive: true });
await copyFile(ordered[0].source, resolve(output, 'A.png'));
await copyFile(ordered[1].source, resolve(output, 'B.png'));
const template = await readFile(resolve(root, 'tools/visual_blind_test_template.html'), 'utf8');
await writeFile(resolve(output, 'index.html'), template, 'utf8');
await writeFile(resolve(output, '.answer.json'), JSON.stringify({ seed, A: ordered[0].truth, B: ordered[1].truth }, null, 2), 'utf8');
console.log(`Blind test built at ${output}`);
