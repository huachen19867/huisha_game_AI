import { readFile, writeFile } from 'node:fs/promises';
import { ART_ASSETS } from '../src/data/ArtAssets.js';

const rootUrl = new URL('../', import.meta.url);
const indexUrl = new URL('index.html', rootUrl);

const sourceFiles = [
    'src/data/ArtAssets.js',
    'src/data/Maps.js',
    'src/systems/MemoryEchoes.js',
    'src/systems/ManorPresentation.js',
    'src/systems/TextureGenerator.js',
    'src/systems/StoryState.js',
    'src/systems/HorrorPacing.js',
    'src/systems/Investigation.js',
    'src/systems/Exploration.js',
    'src/systems/InvestigationUI.js',
    'src/systems/StartRoute.js',
    'src/systems/SoundManager.js',
    'src/entities/Player.js',
    'src/systems/EventManager.js',
    'src/systems/MapManager.js',
    'src/systems/InteractionManager.js',
    'src/scenes/BootScene.js',
    'src/scenes/TitleScene.js',
    'src/scenes/IntroScene.js',
    'src/scenes/GameScene.js'
];

function stripModuleSyntax(source) {
    return source
        .replace(/^\s*import\s+.+?;\s*$/gm, '')
        .replace(/^export\s+class\s+/gm, 'class ')
        .replace(/^export\s+function\s+/gm, 'function ')
        .replace(/^export\s+const\s+/gm, 'const ');
}

function getInlineModuleScript(html) {
    const match = html.match(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!match) {
        throw new Error('index.html does not contain an inline module script');
    }
    return match;
}

function getBootstrapScript(currentScript) {
    const markerMatch = currentScript.match(/^[ \t]*\/\/ UI Logic/m);
    if (!markerMatch) {
        throw new Error('Could not find UI Logic marker in index.html module script');
    }
    return currentScript.slice(markerMatch.index);
}

const indexHtml = await readFile(indexUrl, 'utf8');
const eol = indexHtml.includes('\r\n') ? '\r\n' : '\n';
const [, currentModuleScript] = getInlineModuleScript(indexHtml);
const bootstrapScript = getBootstrapScript(currentModuleScript);

const bundledModules = [];
for (const sourceFile of sourceFiles) {
    const source = await readFile(new URL(sourceFile, rootUrl), 'utf8');
    bundledModules.push([
        `        // BEGIN bundled ${sourceFile}`,
        stripModuleSyntax(source).trimEnd(),
        `        // END bundled ${sourceFile}`
    ].join(eol));
}

const embeddedArt = {};
for (const [key, asset] of Object.entries(ART_ASSETS)) {
    const bytes = await readFile(new URL(asset.file, rootUrl));
    embeddedArt[key] = `data:${asset.mime};base64,${bytes.toString('base64')}`;
}

const nextModuleScript = [
    '',
    '        // Bundled game modules. Regenerate with: node tools\\build_standalone_entry.mjs',
    `        window.huishaEmbeddedArt = ${JSON.stringify(embeddedArt)};`,
    bundledModules.join(`${eol}${eol}`),
    '',
    bootstrapScript.trimStart()
].join(eol);

const nextHtml = indexHtml.replace(currentModuleScript, nextModuleScript);
await writeFile(indexUrl, nextHtml.replace(/[\t ]+$/gm, ''), 'utf8');

console.log('Standalone index.html generated');
