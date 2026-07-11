import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const moduleScripts = [...indexHtml.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)];

assert.equal(moduleScripts.length, 1, 'index.html should have one inline module script');
assert.doesNotMatch(
    moduleScripts[0][1],
    /^\s*import\b/m,
    'standalone entry must strip both single-line and multiline imports'
);
assert.doesNotMatch(
    moduleScripts[0][1],
    /^\s*import\s+.+from\s+['"]\.\/src\//m,
    'index.html must not import src modules at runtime; file:// launch blocks module imports'
);
assert.doesNotMatch(
    moduleScripts[0][1],
    /\bimport\s*\(/,
    'index.html must not use dynamic import; file:// launch blocks imported modules'
);

for (const expectedSymbol of ['class BootScene', 'class TitleScene', 'class IntroScene', 'class GameScene']) {
    assert.match(moduleScripts[0][1], new RegExp(expectedSymbol), `standalone entry should include ${expectedSymbol}`);
}

console.log('Standalone entry verification passed');
