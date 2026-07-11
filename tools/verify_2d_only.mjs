import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const removedRuntimePaths = [
    'prototype3d.html',
    'vendor/three.min.js',
    'src/3d',
    'tools/verify_3d_prototype.mjs',
    'tools/verify_3d_interaction_flow.mjs'
];

for (const relativePath of removedRuntimePaths) {
    assert.equal(existsSync(new URL(relativePath, root)), false, `3D runtime path still exists: ${relativePath}`);
}

const titleSource = readFileSync(new URL('src/scenes/TitleScene.js', root), 'utf8');
const indexSource = readFileSync(new URL('index.html', root), 'utf8');
const readmeSource = readFileSync(new URL('README.md', root), 'utf8');

for (const [label, source] of [['TitleScene', titleSource], ['index.html', indexSource]]) {
    assert.doesNotMatch(source, /prototype3d\.html|进入 3D 原型|Huisha3D/, `${label} still exposes the 3D product`);
}

assert.doesNotMatch(readmeSource, /## 🧪 3D 原型|docs\/3D_ART_PROMPTS\.md/, 'README still documents the 3D product');
assert.equal(existsSync(new URL('archive/3d/art', root)), true, '3D art archive is missing');
assert.equal(existsSync(new URL('archive/3d/docs/3D_ART_PROMPTS.md', root)), true, '3D prompt archive is missing');

console.log('2D-only product verification passed');
