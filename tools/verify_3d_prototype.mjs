import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

async function text(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const prototypeHtml = await text('prototype3d.html');
const titleScene = await text('src/scenes/TitleScene.js');
const planMap = await text('src/3d/ThreeHouseMap.js');
const sceneModule = await text('src/3d/ThreePrototypeScene.js');
const controlsModule = await text('src/3d/ThreeControls.js');
const interactionModule = await text('src/3d/ThreeInteraction.js');

const requiredArtFiles = [
    '美术/木墙.png',
    '美术/木地板.png',
    '美术/木梁.png',
    '美术/供桌区域.png',
    '美术/走廊墙面.png',
    '美术/纸钱与香灰.png',
    '美术/相框.png',
    '美术/香炉.png',
    '美术/烛.png',
    '美术/红绳.png',
    '美术/椅子.png',
    '美术/棺材区域.png',
    '美术/走廊全景.png'
];

await Promise.all(requiredArtFiles.map((path) => access(new URL(`../${path}`, import.meta.url))));

assert.match(prototypeHtml, /vendor\/three\.min\.js/, '3D prototype must load local Three.js');
assert.match(prototypeHtml, /src\/3d\/ThreePrototypeScene\.js/, '3D prototype must load the prototype scene module');
assert.match(prototypeHtml, /\.hud[\s\S]*z-index:\s*2/, '3D HUD must render above the vignette');
assert.match(prototypeHtml, /\.vignette[\s\S]*opacity:\s*0\.55/, '3D vignette must stay light enough for readable gameplay');
assert.match(prototypeHtml, /id="objective-panel"/, '3D prototype must show an objective panel');
assert.match(titleScene, /prototype3d\.html/, 'TitleScene must link to the 3D prototype');
assert.match(planMap, /room_main_3d/, '3D map must define the main hall');
assert.match(planMap, /playerRadius/, '3D map must define a player collision radius');
assert.match(planMap, /obstacles/, '3D map must define blocking obstacle rectangles');
assert.match(planMap, /objective:\s*{/, '3D map must define objective flow copy');
assert.match(planMap, /hallRequired:\s*\[/, '3D objective flow must define hall investigation requirements');
assert.match(planMap, /completeRequired:\s*\[/, '3D objective flow must define final investigation requirements');
assert.match(planMap, /id: 'coffin'/, '3D map must block the coffin footprint');
assert.match(planMap, /id: 'altar'/, '3D map must block the altar footprint');
assert.match(planMap, /coffin/, '3D map must include a coffin interactable');
assert.match(planMap, /altar/, '3D map must include an altar interactable');
assert.match(planMap, /corridor_end_door/, '3D map must include a corridor end-door interactable');
assert.match(planMap, /corridor_midpoint/, '3D map must include a midpoint corridor beat');
assert.match(sceneModule, /class ThreePrototypeScene/, '3D scene module must export the prototype class');
assert.match(sceneModule, /requestAnimationFrame/, '3D scene must animate via requestAnimationFrame');
assert.match(sceneModule, /TextureLoader/, '3D scene must load generated art as textures');
assert.match(sceneModule, /美术\/木墙\.png/, '3D scene must use the generated wall texture');
assert.match(sceneModule, /美术\/木地板\.png/, '3D scene must use the generated floor texture');
assert.match(sceneModule, /美术\/相框\.png/, '3D scene must use the generated portrait frame art');
assert.match(sceneModule, /美术\/香炉\.png/, '3D scene must use the generated incense burner art');
assert.match(sceneModule, /美术\/烛\.png/, '3D scene must use the generated candle art');
assert.match(sceneModule, /美术\/红绳\.png/, '3D scene must use the generated red cord art');
assert.match(sceneModule, /美术\/椅子\.png/, '3D scene must use the generated chair art');
assert.match(sceneModule, /美术\/棺材区域\.png/, '3D scene must use the generated coffin area art');
assert.match(sceneModule, /美术\/走廊全景\.png/, '3D scene must use the generated corridor vista art');
assert.match(sceneModule, /portrait-art-plane/, '3D scene must place a portrait art plane');
assert.match(sceneModule, /incense-art-plane/, '3D scene must place an incense art plane');
assert.match(sceneModule, /candle-art-left/, '3D scene must place candle art planes');
assert.match(sceneModule, /coffin-art-panel/, '3D scene must place a coffin detail art panel');
assert.match(sceneModule, /corridor-end-art-plane/, '3D scene must place a corridor end art plane');
assert.match(sceneModule, /corridorGuideLight/, '3D scene must include corridor guide lighting');
assert.match(sceneModule, /toneMappingExposure/, '3D scene must raise exposure for readable lighting');
assert.match(sceneModule, /objective:\s*this\.objective/, '3D scene must wire objective UI into interaction state');
assert.match(controlsModule, /canOccupy/, '3D controls must test occupied space before moving');
assert.match(controlsModule, /collidesWithObstacle/, '3D controls must collide against obstacle rectangles');
assert.match(interactionModule, /visited\s*=\s*new Set/, '3D interaction must remember investigated objects');
assert.match(interactionModule, /updateObjective/, '3D interaction must update objective text as investigation progresses');
assert.match(interactionModule, /objective\.classList\.add\('is-complete'\)/, '3D interaction must mark the objective complete');

console.log('3D prototype verification passed');
