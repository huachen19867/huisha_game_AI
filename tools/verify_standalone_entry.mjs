import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { ART_ASSETS } from '../src/data/ArtAssets.js';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const moduleScripts = [...indexHtml.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)];

assert.equal(moduleScripts.length, 1, 'index.html should have one inline module script');
assert.doesNotMatch(
    moduleScripts[0][1],
    /^\s*import\s+.+from\s+['"]\.\/src\//m,
    'index.html must not import src modules at runtime; file:// launch blocks module imports'
);
assert.doesNotMatch(
    moduleScripts[0][1],
    /\bimport\s*\(/,
    'index.html must not use dynamic import; file:// launch blocks imported modules'
);

for (const expectedSymbol of ['class BootScene', 'class TitleScene', 'class IntroScene', 'class GameScene']) {
    assert.match(moduleScripts[0][1], new RegExp(expectedSymbol), `standalone entry should include ${expectedSymbol}`);
}

assert.match(indexHtml, /class InvestigationUI/, 'standalone entry should include the 2D investigation interface');
assert.doesNotThrow(() => new Script(moduleScripts[0][1]), 'the complete generated game script must parse');

const artMatch = moduleScripts[0][1].match(/window\.huishaEmbeddedArt = (\{[^\r\n]+\});/);
assert.ok(artMatch, 'standalone entry must embed project artwork for file:// launches');
const embeddedArt = JSON.parse(artMatch[1]);
for (const [key, asset] of Object.entries(ART_ASSETS)) {
    const prefix = `data:${asset.mime};base64,`;
    assert.ok(embeddedArt[key]?.startsWith(prefix), `missing embedded art: ${key}`);
    const embeddedBytes = Buffer.from(embeddedArt[key].slice(prefix.length), 'base64');
    const sourceBytes = await readFile(new URL(`../${asset.file}`, import.meta.url));
    assert.deepEqual(embeddedBytes, sourceBytes, `embedded ${key} must match the project source image`);
}

// Exercise real BootScene sequencing; this does not simulate WebGL upload.
globalThis.Phaser = { Scene: class {} };
const { BootScene } = await import('../src/scenes/BootScene.js');
const images = [];
globalThis.Image = class { constructor() { images.push(this); } };
for (const decodeSucceeds of [true, false]) {
    globalThis.window = { huishaEmbeddedArt: { ...embeddedArt } };
    const textures = new Map();
    const started = [];
    const scene = Object.assign(Object.create(BootScene.prototype), {
        load: { off() {} },
        textures: { exists: key => textures.has(key), addImage: (key, image) => textures.set(key, image) },
        artProgress: value => { scene.progress = value; },
        scene: { start: key => started.push(key) }
    });
    const ready = scene.create();
    assert.deepEqual(started, [], 'Boot must wait for embedded artwork decoding');
    assert.equal(scene.progress, 0);
    for (const key of Object.keys(ART_ASSETS)) {
        const image = images.shift();
        assert.equal(image.src, embeddedArt[key], 'Boot must decode the embedded project image');
        if (decodeSucceeds) image.onload();
        else image.onerror();
        assert.equal(image.onload, null, 'decode listeners must be released');
        assert.equal(image.onerror, null);
    }
    await ready;
    assert.deepEqual(started, ['TitleScene'], 'successful decoding and decode failure must both reach the title');
    assert.equal(scene.progress, 1);
    assert.equal(textures.has('title_manor'), decodeSucceeds, 'failed art must leave the procedural title fallback available');
    assert.equal(window.huishaEmbeddedArt, undefined, 'temporary embedded art data must be released');
}

// Exercise the actual preserved UI Logic listener without starting a browser.
const dialogStart = indexHtml.indexOf('// Global Input Handler for Dialog');
const dialogEnd = indexHtml.indexOf('window.updateInventory', dialogStart);
assert.ok(dialogStart >= 0 && dialogEnd > dialogStart);
let onDialogKey, dialogHidden = true, advances = 0;
const docOverlay = { style: { display: 'none' } };
const dialogInputWindow = { dialogActive: true, currentDialogNextHandler: () => advances++, skipDialog: false };
new Script(indexHtml.slice(dialogStart, dialogEnd)).runInNewContext({
    window: dialogInputWindow,
    dialogBox: { classList: { contains: () => dialogHidden } },
    document: { addEventListener(name, handler) { assert.equal(name, 'keydown'); onDialogKey = handler; }, getElementById: id => id === 'doc-overlay' ? docOverlay : { textContent: '之前读过的对白' } }
});
for (const code of ['Space', 'Enter']) onDialogKey({ code });
assert.equal(advances, 0, 'A custom reading panel cannot advance a hidden narrative dialog');
dialogInputWindow.currentDialogNextHandler = null;
onDialogKey({ code: 'Space' });
assert.equal(dialogInputWindow.skipDialog, false, 'Typing into the custom reader cannot leak a dialog skip');
dialogHidden = false;
dialogInputWindow.currentDialogNextHandler = () => advances++;
for (const extra of [{ isComposing: true }, { keyCode: 229 }, { defaultPrevented: true }]) onDialogKey({ code: 'Enter', ...extra });
assert.equal(advances, 0, 'IME and already-consumed keys remain with their current owner');
onDialogKey({ code: 'Space' }); onDialogKey({ code: 'Enter' });
assert.equal(advances, 2, 'Visible narrative dialogs retain their normal advance keys');
docOverlay.style.display = 'flex';
onDialogKey({ code: 'Escape', isComposing: true });
assert.equal(docOverlay.style.display, 'flex');
onDialogKey({ code: 'Escape' });
assert.equal(docOverlay.style.display, 'none');
assert.equal(dialogInputWindow.dialogActive, false);

console.log('Standalone entry, Boot artwork sequencing and dialog keyboard ownership verification passed');
