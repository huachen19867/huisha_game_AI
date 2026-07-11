import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Maps } from '../src/data/Maps.js';

const mapsSource = readFileSync(new URL('../src/data/Maps.js', import.meta.url), 'utf8');
const interactionSource = readFileSync(new URL('../src/systems/InteractionManager.js', import.meta.url), 'utf8');
const chaseSource = readFileSync(new URL('../src/systems/ChaseManager.js', import.meta.url), 'utf8');

assert.match(interactionSource, /今天是明儿的忌日/);
assert.match(interactionSource, /饭在锅里/);
assert.match(mapsSource, /雨停前，我会回来吃饭/);
assert.match(chaseSource, /明儿，别跑，外面下雨/);
assert.match(interactionSource, /纸飞机、校服纽扣和一只凉透的饭碗/);
assert.match(interactionSource, /棺材里等的人是我/);
assert.match(interactionSource, /棺材里等的人是我。', \(\) => \{\s+if \(getTruthLevel/s);

assert.match(interactionSource, /十年前同一路段的少年死亡事故/);
assert.match(interactionSource, /黑影学会了我的站姿/);
assert.match(interactionSource, /妈，饭别再热了/);
assert.match(interactionSource, /母亲又说了一遍.*饭凉了/s);
assert.match(interactionSource, /父亲起身.*锁上了门/s);

for (const [mapId, map] of Object.entries(Maps)) {
    for (const item of map.objects.interactables || []) {
        if (item.documentText) {
            assert.ok(item.documentText.length <= 120, `${mapId}.${item.id} document is too long`);
        }
    }
}

console.log('Narrative text verification passed');
