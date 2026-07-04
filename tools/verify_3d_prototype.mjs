import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function text(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const prototypeHtml = await text('prototype3d.html');
const titleScene = await text('src/scenes/TitleScene.js');
const planMap = await text('src/3d/ThreeHouseMap.js');
const sceneModule = await text('src/3d/ThreePrototypeScene.js');

assert.match(prototypeHtml, /vendor\/three\.min\.js/, '3D prototype must load local Three.js');
assert.match(prototypeHtml, /src\/3d\/ThreePrototypeScene\.js/, '3D prototype must load the prototype scene module');
assert.match(titleScene, /prototype3d\.html/, 'TitleScene must link to the 3D prototype');
assert.match(planMap, /room_main_3d/, '3D map must define the main hall');
assert.match(planMap, /coffin/, '3D map must include a coffin interactable');
assert.match(planMap, /altar/, '3D map must include an altar interactable');
assert.match(sceneModule, /class ThreePrototypeScene/, '3D scene module must export the prototype class');
assert.match(sceneModule, /requestAnimationFrame/, '3D scene must animate via requestAnimationFrame');

console.log('3D prototype verification passed');
