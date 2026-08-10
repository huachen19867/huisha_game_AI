const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { dirname, resolve } = require('node:path');

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (error) {
    throw new Error('Playwright is required. Use the bundled workspace Node runtime and NODE_PATH.', { cause: error });
}

const root = resolve(dirname(__filename), '..');
const output = resolve(root, 'artifacts/visual-qa/v4-playable-smoke.png');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
    await mkdir(dirname(output), { recursive: true });
    const errors = [];
    let browser;
    try {
        browser = await chromium.launch({
        executablePath: edge,
        headless: true,
        args: [
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--enable-webgl',
            '--ignore-gpu-blocklist'
        ]
        });
        const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
        page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(`console: ${message.text()}`);
        });

        await page.goto('http://localhost:8000/aaa3d.html?capture=hero&qaDpr=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => window.__HUISHA_QA_READY__?.ready === true, null, { timeout: 30000 });
        console.log('Playable scene ready');
        const start = await page.evaluate(() => {
            const scene = window.huishaAAAScene;
            const spawn = scene.map.playerStart;
            document.body.classList.remove('qa-clean');
            scene.camera.position.set(spawn.x, spawn.y, spawn.z);
            scene.controls.yaw = spawn.yaw;
            scene.controls.pitch = 0;
            scene.controls.applyLook();
            scene.interaction.update();
            scene.updateFlashlight();
            scene.renderer.render(scene.scene, scene.camera);
            return scene.camera.position.toArray();
        });

        await page.keyboard.down('KeyW');
        await page.evaluate(() => {
            const scene = window.huishaAAAScene;
            for (let frame = 0; frame < 54; frame += 1) scene.controls.update(1 / 60);
            scene.interaction.update();
            scene.updateFlashlight();
            scene.renderer.render(scene.scene, scene.camera);
        });
        await page.keyboard.up('KeyW');

        const movement = await page.evaluate(() => ({
            position: window.huishaAAAScene.camera.position.toArray(),
            promptText: document.getElementById('interaction-prompt').textContent,
            promptVisible: document.getElementById('interaction-prompt').classList.contains('is-visible')
        }));
        const moved = Math.hypot(movement.position[0] - start[0], movement.position[2] - start[2]);
        assert(moved > 0.5, `W input must move the player, observed ${moved.toFixed(3)}m`);
        assert.equal(movement.promptVisible, true, 'Approaching the coffin must expose an interaction prompt');
        assert.match(movement.promptText, /调查棺材/, 'The nearest prompt must identify the coffin interaction');
        console.log(`Movement and prompt ready: ${moved.toFixed(3)}m`);

        await page.keyboard.press('KeyE');
        await page.waitForFunction(() => document.getElementById('dialog-panel').classList.contains('is-visible'));
        const interaction = await page.evaluate(() => ({
            title: document.getElementById('dialog-title').textContent,
            text: document.getElementById('dialog-text').textContent,
            objective: document.getElementById('objective-panel').textContent
        }));
        assert.equal(interaction.title, '棺材');
        assert.match(interaction.text, /棺盖被红线压住/);
        console.log('Interaction dialog ready');
        await page.screenshot({ path: output, type: 'png' });

        assert.deepEqual(errors, [], 'Playable smoke test must complete without browser errors');
        console.log(JSON.stringify({
            contract: 'huisha-aaa-playable-smoke-v1',
            movedMeters: Number(moved.toFixed(3)),
            prompt: movement.promptText,
            dialog: interaction.title,
            objective: interaction.objective,
            screenshot: output,
            browserErrors: errors
        }, null, 2));
    } finally {
        if (browser) await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
