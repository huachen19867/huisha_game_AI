import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const scene = await readFile(new URL('src/scenes/GameScene.js', root), 'utf8');
const manager = await readFile(new URL('src/systems/InteractionManager.js', root), 'utf8');
const builder = await readFile(new URL('tools/build_standalone_entry.mjs', root), 'utf8');
const director = await readFile(new URL('src/systems/HauntingDirector.js', root), 'utf8');

assert.match(scene, /this\.hauntingDirector\s*=\s*new HauntingDirector\(this\)/);
assert.match(scene, /this\.hauntingDirector\?\.update\(time, delta\)/);
assert.match(scene, /this\.hauntingDirector\?\.destroy\(\)/);
assert.match(manager, /hauntingDirector\?\.onPuzzleMistake/);
assert.match(builder, /src\/systems\/HauntingDirector\.js/);
assert.doesNotMatch(director, /window\.showToast/, 'haunting feedback must use an implemented runtime surface');
assert.match(director, /scene\.showRoomTitle\?\.\(/);

console.log('Haunting runtime contract verification passed');
