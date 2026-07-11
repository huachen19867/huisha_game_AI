import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mapSource = readFileSync(new URL('../src/systems/MapManager.js', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.doesNotMatch(mapSource, /Random clutter on floor|Math\.random\(\) < 0\.05[\s\S]{0,300}trash_paper/);
assert.match(mapSource, /tree\.body\.setSize\(14, 28\)/);
assert.match(mapSource, /tree\.body\.setOffset\(25, 34\)/);
assert.doesNotMatch(htmlSource, /document\.body\.style\.filter\s*=\s*`[^`]*blur\(/);

const sanityStart = sceneSource.indexOf('updateSanity(delta)');
const sanitySection = sceneSource.slice(sanityStart, sceneSource.indexOf('\n    spawnChaser()', sanityStart));
assert.doesNotMatch(sanitySection, /cameras\.main\.shake/);

console.log('Scene readability verification passed');
