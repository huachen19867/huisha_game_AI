import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Maps } from '../src/data/Maps.js';

const textureSource = readFileSync(new URL('../src/systems/TextureGenerator.js', import.meta.url), 'utf8');
const generatedTextures = new Set([...textureSource.matchAll(/generateTexture\('([^']+)'/g)].map(match => match[1]));

const requiredMaps = [
    'room_study',
    'room_medicine',
    'memory_school',
    'memory_hospital',
    'memory_crash'
];

for (const mapId of requiredMaps) {
    assert.ok(Maps[mapId], `Missing map: ${mapId}`);
}

for (const mapId of ['memory_school', 'memory_hospital', 'memory_crash']) {
    assert.ok(Maps[mapId].visual, `${mapId} is missing visual style`);
    assert.equal(typeof Maps[mapId].visual.ambient, 'number', `${mapId} visual.ambient must be a number`);
    assert.equal(typeof Maps[mapId].visual.floorTint, 'number', `${mapId} visual.floorTint must be a number`);
    assert.equal(typeof Maps[mapId].visual.wallTint, 'number', `${mapId} visual.wallTint must be a number`);
}

assert.ok(
    Maps.room_study.objects.interactables.some(item => item.memoryTrigger?.mapId === 'memory_school'),
    'room_study must include a school memory trigger'
);
assert.ok(
    Maps.room_medicine.objects.interactables.some(item => item.memoryTrigger?.mapId === 'memory_hospital'),
    'room_medicine must include a hospital memory trigger'
);
assert.ok(
    Maps.memory_school.objects.interactables.some(item => item.memoryReturn?.mapId === 'room_study' && item.puzzleId === 'school'),
    'memory_school must include a completing return to room_study'
);
assert.ok(
    Maps.memory_hospital.objects.interactables.some(item => item.memoryReturn?.mapId === 'room_medicine' && item.puzzleId === 'hospital'),
    'memory_hospital must include a completing return to room_medicine'
);
assert.ok(
    Maps.memory_crash.objects.interactables.some(item => item.endingChoice === 'leave'),
    'memory_crash must include the leave ending choice'
);
assert.ok(
    Maps.memory_crash.objects.interactables.some(item => item.endingChoice === 'return'),
    'memory_crash must include the return ending choice'
);

for (const [mapId, map] of Object.entries(Maps)) {
    assert.ok(map.objects, `${mapId} is missing objects`);
    assert.ok(map.objects.playerStart, `${mapId} is missing playerStart`);

    for (const door of map.objects.doors || []) {
        assert.ok(Maps[door.targetMap], `${mapId} has door to missing map ${door.targetMap}`);
    }

    for (const item of map.objects.interactables || []) {
        if (item.texture) {
            assert.ok(generatedTextures.has(item.texture), `${mapId} interactable ${item.id || item.clueId} uses missing texture ${item.texture}`);
        }
        if (item.clueType) {
            assert.ok(item.clueId, `${mapId} interactable ${item.id || item.texture || item.x} has clueType without clueId`);
            assert.ok(['control', 'illness', 'death'].includes(item.clueType), `${mapId} interactable ${item.id || item.clueId} has invalid clueType ${item.clueType}`);
        }
        if (item.memoryTrigger) {
            assert.ok(Maps[item.memoryTrigger.mapId], `${mapId} interactable ${item.id || item.clueId} triggers missing map ${item.memoryTrigger.mapId}`);
        }
        if (item.memoryReturn) {
            assert.ok(Maps[item.memoryReturn.mapId], `${mapId} interactable ${item.id || item.clueId} returns to missing map ${item.memoryReturn.mapId}`);
        }
    }
}

console.log('Map verification passed');
