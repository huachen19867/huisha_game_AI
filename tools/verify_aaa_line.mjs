import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

async function text(path) {
    return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

await Promise.all([
    access(new URL('../aaa3d.html', import.meta.url)),
    access(new URL('../src/aaa/AAAExperienceScene.js', import.meta.url)),
    access(new URL('../tools/build_visual_blind_test.mjs', import.meta.url)),
    access(new URL('../tools/build_vfx_blind_test.mjs', import.meta.url)),
    access(new URL('../tools/vfx_blind_test_template.html', import.meta.url)),
    access(new URL('../tools/capture_aaa_sequence.cjs', import.meta.url)),
    access(new URL('../tools/build_vfx_sequence_preview.py', import.meta.url))
]);

const html = await text('aaa3d.html');
const scene = await text('src/aaa/AAAExperienceScene.js');
const title = await text('src/scenes/TitleScene.js');
const blindBuilder = await text('tools/build_visual_blind_test.mjs');
const vfxBlindBuilder = await text('tools/build_vfx_blind_test.mjs');
const sequenceCapture = await text('tools/capture_aaa_sequence.cjs');
const sequencePreview = await text('tools/build_vfx_sequence_preview.py');
const standalone = await text('index.html');

assert.match(html, /AAAExperienceScene\.js/, 'AAA page must load its independent scene');
assert.match(html, /body\.qa-clean/, 'AAA page must support clean QA captures');
assert.match(html, /cinema-grade/, 'AAA page must include a restrained color-grade layer');
assert.match(html, /grain/, 'AAA page must include a film-grain layer');
assert.match(title, /aaa3d\.html/, 'title scene must link to the AAA line');
assert.match(standalone, /aaa3d\.html/, 'standalone entry must include the AAA line link');
assert.match(scene, /MeshPhysicalMaterial/, 'AAA line must use physically based materials');
assert.match(scene, /ACESFilmicToneMapping/, 'AAA line must use filmic tone mapping');
assert.match(scene, /PCFSoftShadowMap/, 'AAA line must use soft shadow filtering');
assert.match(scene, /useLegacyLights\s*=\s*false/, 'AAA line must use physically consistent light units');
assert.match(scene, /createAtmosphere/, 'AAA line must include atmospheric depth');
assert.match(scene, /flickerLights/, 'AAA line must animate practical lighting');
assert.match(scene, /aaa-coffin/, 'AAA line must preserve the coffin gameplay landmark');
assert.match(scene, /aaa-altar/, 'AAA line must preserve the altar gameplay landmark');
assert.match(scene, /shadow\.mapSize\.set\(2048, 2048\)/, 'AAA hero light must use a high-resolution shadow map');
assert.match(scene, /addTaperedPrism/, 'Build 02 must use a tapered coffin silhouette');
assert.match(scene, /CatmullRomCurve3/, 'Build 02 cords must wrap the coffin as closed 3D curves');
assert.match(scene, /createOfferings/, 'Build 02 altar must include physical offerings');
assert.match(scene, /createIncenseSmoke/, 'Build 02 altar must include soft incense smoke');
assert.match(scene, /setCapturePose/, 'Build 02 must expose fixed visual-QA camera poses');
assert.match(scene, /for \(let i = 0; i < 6; i \+= 1\)/, 'Build 03 sealed door must use six physical planks');
assert.match(scene, /aaa-door-hinge/, 'Build 03 sealed door must include physical hinge hardware');
assert.match(scene, /aaa-door-light-spill/, 'Build 03 door crack must motivate a soft floor-light spill');
assert.match(scene, /aaa-door-crack-cavity/, 'Build 03 door crack must sit inside a dark physical recess');
assert.match(scene, /aaa-door-ring-backplate/, 'Build 03 door ring must include visible mounting hardware');
assert.match(scene, /BoxGeometry\(width, height, depth, 3, 6, 1\)/, 'Build 03 hero papers must retain edge thickness');
assert.match(scene, /smoothstep\(doorDistance, 1\.4, 3\.6\)/, 'Build 03 flashlight must preserve close-range material detail');
assert.doesNotMatch(scene, /addPlane\('aaa-corridor-vista'/, 'Build 03 sealed doorway must not reuse the baked corridor-vista card');
assert.match(scene, /doorLock:/, 'Build 03 must expose the door-lock QA camera pose');
assert.match(scene, /doorCrack:/, 'Build 03 must expose the door-crack QA camera pose');
assert.match(scene, /nextVFXRandom/, 'V4 QA must use a deterministic atmosphere seed');
assert.match(scene, /setQATime/, 'V4 QA must expose deterministic animation phases');
assert.match(html, /params\.has\('qaTime'\)/, 'AAA page must route fixed VFX times into the scene');
assert.match(scene, /if \(!this\.qaCaptureMode\)/, 'V4 QA must freeze controls and camera bob');
assert.match(scene, /renderAt\(value\)/, 'V4 QA must render fixed animation phases synchronously');
assert.match(scene, /new THREE\.LoadingManager/, 'V4 QA must wait for texture loading');
assert.match(html, /__HUISHA_QA_READY__/, 'AAA page must expose capture readiness metadata');
assert.match(html, /qaSeed: params\.get\('qaSeed'\)/, 'AAA page must route deterministic VFX seeds');
assert.match(html, /qaDpr: params\.get\('qaDpr'\)/, 'AAA page must route deterministic capture DPR');
assert.match(blindBuilder, /replace\(\/\^--\?\//, 'blind-test CLI must accept documented --key=value arguments');
assert.match(scene, /map: this\.createDustTexture\(\)/, 'V4 dust must use a soft alpha texture instead of square points');
assert.match(scene, /dustBasePositions/, 'V4 dust must preserve deterministic base positions');
assert.doesNotMatch(scene, /this\.dust\.rotation/, 'V4 dust must not move as one rigid particle cloud');
assert.match(scene, /updateCandles\(time\)/, 'V4 candles must share one absolute-time flame and light update');
assert.match(scene, /updateIncenseSmoke\(time\)/, 'V4 smoke must use absolute lifecycle evaluation');
assert.match(scene, /blending: THREE\.NormalBlending/, 'V4 atmospheric sprites must support normal alpha blending');
assert.match(scene, /createWaterLeaks\(\)/, 'V4 must include physically motivated indoor water leaks');
assert.match(scene, /aaa-wet-patch-/, 'V4 leaks must include locally lit wet surfaces');
assert.match(scene, /aaa-leak-ripple-secondary-/, 'V4 impacts must include staged deterministic ripples');
assert.match(scene, /wetLeak:/, 'V4 must expose a dedicated leak-source QA camera');
assert.match(scene, /wetSurface:/, 'V4 must expose a glancing wet-surface QA camera');
assert.match(scene, /corridorLeak: \{ position: \[-0\.72, 1\.4, -5\.28\], target: \[0\.86, 1\.47, -7\.77\], fov: 58 \}/, 'V4 corridor-leak camera must keep both source and impact inside its vertical field of view');
assert.match(scene, /this\.camera\.fov = pose\.fov \?\? 61/, 'V4 specialist QA poses must reset and apply their declared field of view');
assert.match(scene, /wetPatch\.position\.set\(config\.x, -0\.007, config\.z\)/, 'V4 wet patches must sit within a millimetre-scale offset of the floor surface');
assert.match(scene, /ripple\.position\.set\(config\.x, -0\.004, config\.z\)/, 'V4 impact ripples must not hover centimetres above the floor');
assert.match(scene, /clearcoat: 0\.55/, 'V4 wet surfaces must avoid a full-clearcoat projection-like hotspot');
assert.match(scene, /createRippleTexture\(\)/, 'V4 impact rings must use a soft procedural alpha instead of hard ring geometry');
assert.match(scene, /alphaMap: rippleTexture/, 'V4 ripple softness must be applied through a grayscale alpha map');
assert.match(scene, /const size = 256/, 'V4 soft ripple mask must retain enough resolution for glancing close-up views');
assert.match(scene, /texture\.colorSpace = THREE\.NoColorSpace/, 'V4 grayscale ripple mask must bypass color-space conversion');
assert.match(scene, /texture\.wrapS = THREE\.ClampToEdgeWrapping/, 'V4 ripple mask must clamp rather than tile at its boundary');
assert.match(scene, /const dropRadius = 0\.0095/, 'V4 water drops must remain readable at the corridor QA distance');
assert.match(scene, /const sourceBead = new THREE\.Mesh\([^\n]+, waterMaterial\)/, 'V4 leak source must own the base water material so scene disposal can release it');
assert.match(scene, /drop\.renderOrder = 5/, 'V4 drops must render above impact layers');
assert.match(scene, /splash\.renderOrder = 2/, 'V4 splash sheet must remain below both ripple rings');
assert.match(scene, /secondRipple\.renderOrder = 3/, 'V4 secondary ripple must remain below the primary ripple');
assert.match(scene, /ripple\.renderOrder = 4/, 'V4 primary ripple must retain the strongest impact ordering');
assert.match(scene, /const landingY = leak\.floorSurfaceY \+ leak\.dropRadius \* dropScaleY \+ 0\.001/, 'V4 falling drops must land from their current half-height rather than intersecting the floor');
assert.match(scene, /const contactHold = 0\.018/, 'V4 falling drops must retain a short collision pose instead of skipping directly to the splash');
assert.match(scene, /const dropScaleXZ = THREE\.MathUtils\.lerp\(0\.9, 1\.28, contactAge\)/, 'V4 collision pose must flatten and spread the drop before it disappears');
assert.match(scene, /cycle\.drop\.scale\.set\(dropScaleXZ, dropScaleY, dropScaleXZ\)/, 'V4 falling drops must retain lateral readability while stretching and retracting');
assert.match(scene, /this\.rippleTexture = null/, 'V4 disposal must not retain a stale procedural ripple texture reference');
assert.doesNotMatch(scene, /aaa-floor-debris/, 'V4 must not retain the unrelated baked floor overlay that reads as a static water hotspot');
assert.match(scene, /updateCameraResponse\(delta\)/, 'V4 movement response must be driven by actual camera displacement');
assert.match(scene, /disposeSceneResources\(\)/, 'V4 procedural VFX resources must be explicitly released');
assert.match(html, /translate\(-1px,1px\)/, 'V4 film grain must use sub-pixel-scale motion instead of viewport percentages');
assert.match(vfxBlindBuilder, /ordered-four-frame-groups/, 'V4 blind testing must randomize whole ordered time groups');
assert.match(vfxBlindBuilder, /assert\.deepEqual\(size, expectedSize/, 'V4 blind testing must reject mismatched frame dimensions');
assert.match(vfxBlindBuilder, /args\.frames/, 'V4 blind testing must accept exact frames selected from a deterministic sequence');
assert.match(sequenceCapture, /cameraOverride/, 'V4 sequence capture must support identical-camera before-and-after refinement evidence');
assert.match(sequenceCapture, /sourceNdc/, 'V4 sequence manifests must record whether each leak source and impact remain inside the QA frame');
assert.match(sequenceCapture, /bottomY: cycle\.drop\.position\.y - leak\.dropRadius \* cycle\.drop\.scale\.y/, 'V4 sequence manifests must record the live lower bound of each falling drop');
assert.match(sequenceCapture, /drop\.bottomY >= leak\.floorSurfaceY - 1e-6/, 'V4 capture must fail if a falling drop penetrates the floor');
assert.match(sequencePreview, /--crop/, 'V4 sequence previews must support enlarged detail evidence for small VFX');

console.log('AAA visual line verification passed');
