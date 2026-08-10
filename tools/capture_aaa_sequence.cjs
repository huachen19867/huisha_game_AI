const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { dirname, resolve } = require('node:path');

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (error) {
    throw new Error('Playwright is required. Run with the bundled workspace Node runtime and NODE_PATH set to its node_modules directory.', { cause: error });
}

const root = resolve(dirname(__filename), '..');
const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
    const split = entry.indexOf('=');
    const rawKey = split === -1 ? entry : entry.slice(0, split);
    const key = rawKey.replace(/^--?/, '');
    return split === -1 ? [key, true] : [key, entry.slice(split + 1)];
}));
const width = Number(args.width || 1600);
const height = Number(args.height || 900);
const dpr = Number(args.dpr || 1);
const seed = Number(args.seed || 12469113) >>> 0;
const pose = String(args.pose || 'altar');
const output = resolve(root, args.output || 'artifacts/visual-qa/v4-sequence');
const edge = String(args.edge || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
const baseUrl = String(args.url || 'http://localhost:8000/aaa3d.html');
const defaultTimes = Array.from({ length: 25 }, (_, index) => index * 0.25);
const times = args.times
    ? String(args.times).split(',').map(Number)
    : defaultTimes;
assert(times.length > 0 && times.every(Number.isFinite), 'Capture times must be a non-empty comma-separated number list');

function parseVector(raw, label) {
    if (raw === undefined) return null;
    const vector = String(raw).split(',').map(Number);
    assert(vector.length === 3 && vector.every(Number.isFinite), `${label} must contain three comma-separated numbers`);
    return vector;
}

const cameraOverride = {
    position: parseVector(args.position, '--position'),
    target: parseVector(args.target, '--target'),
    fov: args.fov === undefined ? null : Number(args.fov)
};
assert(
    (cameraOverride.position === null) === (cameraOverride.target === null),
    '--position and --target must be supplied together'
);
assert(cameraOverride.fov === null || (Number.isFinite(cameraOverride.fov) && cameraOverride.fov > 1 && cameraOverride.fov < 179), '--fov must be between 1 and 179 degrees');

(async () => {
await mkdir(output, { recursive: true });
const browserErrors = [];
const browser = await chromium.launch({
    executablePath: edge,
    headless: true,
    args: [
        '--no-first-run',
        '--disable-default-apps',
        '--disable-background-networking',
        '--disable-component-update',
        '--hide-scrollbars',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist'
    ]
});
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
const page = await context.newPage();
page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});
const url = new URL(baseUrl);
url.searchParams.set('capture', pose);
url.searchParams.set('qa', '1');
url.searchParams.set('qaTime', String(times[0]));
url.searchParams.set('qaSeed', String(seed));
url.searchParams.set('qaDpr', String(dpr));
await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__HUISHA_QA_READY__?.ready === true, null, { timeout: 30000 });
const readiness = await page.evaluate(() => window.__HUISHA_QA_READY__);
if (cameraOverride.position || cameraOverride.fov !== null) {
    await page.evaluate((override) => {
        const scene = window.huishaAAAScene;
        if (override.position) {
            scene.camera.position.set(...override.position);
            scene.camera.lookAt(...override.target);
        }
        if (override.fov !== null) {
            scene.camera.fov = override.fov;
            scene.camera.updateProjectionMatrix();
        }
        scene.camera.updateMatrixWorld(true);
    }, cameraOverride);
}
for (const time of times) {
    const warmed = await page.evaluate((absoluteTime) => window.huishaAAAScene.renderAt(absoluteTime), time);
    assert.equal(warmed, true, `Warm-up renderAt(${time}) must succeed`);
}
await page.evaluate((absoluteTime) => window.huishaAAAScene.renderAt(absoluteTime), times[0]);
const frames = [];
for (let index = 0; index < times.length; index += 1) {
    const time = times[index];
    const rendered = await page.evaluate((absoluteTime) => window.huishaAAAScene.renderAt(absoluteTime), time);
    assert.equal(rendered, true, `renderAt(${time}) must succeed`);
    const filename = `frame-${String(index).padStart(3, '0')}.png`;
    const path = resolve(output, filename);
    await page.screenshot({ path, type: 'png', animations: 'disabled' });
    const state = await page.evaluate(() => {
        const scene = window.huishaAAAScene;
        const dustPositions = scene.dust?.geometry?.attributes?.position?.array;
        const smokeVisible = scene.smokeWisps.filter((wisp) => wisp.mesh.visible);
        return {
            camera: {
                position: scene.camera.position.toArray(),
                quaternion: scene.camera.quaternion.toArray(),
                matrixWorld: scene.camera.matrixWorld.elements.slice(),
                fov: scene.camera.fov,
                near: scene.camera.near,
                far: scene.camera.far,
                projectionMatrix: scene.camera.projectionMatrix.elements.slice()
            },
            memory: { ...scene.renderer.info.memory },
            render: { ...scene.renderer.info.render },
            flames: scene.flames.map((flame) => ({
                outerPosition: flame.outer.position.toArray(),
                outerScale: flame.outer.scale.toArray(),
                lightIntensity: flame.light?.intensity ?? null
            })),
            smoke: {
                visible: smokeVisible.length,
                opacityRange: smokeVisible.length ? [
                    Math.min(...smokeVisible.map((wisp) => wisp.mesh.material.opacity)),
                    Math.max(...smokeVisible.map((wisp) => wisp.mesh.material.opacity))
                ] : [0, 0],
                heightRange: smokeVisible.length ? [
                    Math.min(...smokeVisible.map((wisp) => wisp.mesh.position.y)),
                    Math.max(...smokeVisible.map((wisp) => wisp.mesh.position.y))
                ] : [0, 0]
            },
            dustSample: dustPositions ? Array.from(dustPositions.slice(0, 12)) : [],
            leaks: scene.waterLeaks.map((leak) => ({
                name: leak.name,
                sourceNdc: leak.sourceBead.position.clone().project(scene.camera).toArray(),
                impactNdc: leak.wetPatch.position.clone().project(scene.camera).toArray(),
                floorSurfaceY: leak.floorSurfaceY,
                wetSurfaceY: leak.wetPatch.position.y,
                rippleSurfaceY: leak.cycles[0].ripple.position.y,
                drops: leak.cycles.filter((cycle) => cycle.drop.visible).length,
                visibleDrops: leak.cycles.filter((cycle) => cycle.drop.visible).map((cycle) => ({
                    name: cycle.drop.name,
                    position: cycle.drop.position.toArray(),
                    scale: cycle.drop.scale.toArray(),
                    bottomY: cycle.drop.position.y - leak.dropRadius * cycle.drop.scale.y
                })),
                splashes: leak.cycles.filter((cycle) => cycle.splash.visible).length,
                ripples: leak.cycles.filter((cycle) => cycle.ripple.visible || cycle.secondRipple.visible).length
            }))
        };
    });
    const bytes = await readFile(path);
    frames.push({
        index,
        time,
        filename,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        state
    });
}
await browser.close();

const referenceCamera = frames[0].state.camera;
const referenceMemory = frames[0].state.memory;
frames.forEach((frame) => {
    assert.deepEqual(frame.state.camera, referenceCamera, 'QA camera must remain frozen throughout fixed-time capture');
    assert.deepEqual(frame.state.memory, referenceMemory, 'VFX capture must not allocate new GPU resources over time');
    frame.state.leaks.forEach((leak) => {
        leak.visibleDrops.forEach((drop) => {
            assert(
                drop.bottomY >= leak.floorSurfaceY - 1e-6,
                `${drop.name} must not penetrate the floor at t=${frame.time}: ${drop.bottomY} < ${leak.floorSurfaceY}`
            );
        });
    });
});
assert.deepEqual(browserErrors, [], 'Browser capture must complete without console or page errors');
const manifest = {
    contract: 'huisha-aaa-fixed-time-sequence-v1',
    url: baseUrl,
    pose,
    seed,
    viewport: [width, height],
    dpr,
    cameraOverride,
    readiness,
    browserErrors,
    frames
};
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Captured ${frames.length} deterministic frames at ${output}`);
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
