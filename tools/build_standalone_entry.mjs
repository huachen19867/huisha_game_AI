import { readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const indexUrl = new URL('index.html', rootUrl);

const sourceFiles = [
    'src/data/Maps.js',
    'src/data/SliceMaps.js',
    'src/data/Puzzles.js',
    'src/systems/PuzzleState.js',
    'src/systems/TextureGenerator.js',
    'src/systems/StoryState.js',
    'src/systems/KitchenTableRules.js',
    'src/systems/MemoryReplayDirector.js',
    'src/systems/SliceState.js',
    'src/systems/SliceNarrativeDirector.js',
    'src/systems/HouseRuleState.js',
    'src/systems/NarrativeDirector.js',
    'src/systems/RuntimeState.js',
    'src/systems/InteractionRules.js',
    'src/systems/DomListenerRegistry.js',
    'src/systems/ObjectiveManager.js',
    'src/systems/GridNavigation.js',
    'src/systems/ChaseManager.js',
    'src/systems/HouseRuleDirector.js',
    'src/systems/HauntingDirector.js',
    'src/systems/StartRoute.js',
    'src/systems/SoundManager.js',
    'src/entities/Player.js',
    'src/systems/PhysicsSync.js',
    'src/systems/EventManager.js',
    'src/systems/MapManager.js',
    'src/systems/SliceMapManager.js',
    'src/systems/SliceInteractionManager.js',
    'src/systems/KitchenTableController.js',
    'src/systems/InteractionManager.js',
    'src/scenes/BootScene.js',
    'src/scenes/TitleScene.js',
    'src/scenes/IntroScene.js',
    'src/scenes/GameScene.js'
];

function stripModuleSyntax(source) {
    return source
        .replace(/^[ \t]*import(?:[ \t]+[\s\S]*?[ \t]+from)?[ \t]+['"][^'"]+['"];[ \t]*\r?\n?/gm, '')
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

const nextModuleScript = [
    '',
    '        // Bundled game modules. Regenerate with: node tools\\build_standalone_entry.mjs',
    bundledModules.join(`${eol}${eol}`),
    '',
    bootstrapScript.trimStart()
].join(eol);

const nextHtml = indexHtml
    .replace(currentModuleScript, nextModuleScript)
    .replace(/[ \t]+$/gm, '');
await writeFile(indexUrl, nextHtml, 'utf8');

console.log('Standalone index.html generated');
