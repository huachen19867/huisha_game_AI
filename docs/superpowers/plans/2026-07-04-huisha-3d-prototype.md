# Huisha 3D Prototype Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a playable Three.js 3D prototype entry beside the existing Phaser 2D game.

**Architecture:** Keep the existing 2D game unchanged as the default path. Add a standalone `prototype3d.html` page and focused `src/3d/` modules for scene setup, map geometry, controls, and interaction. Link the prototype from `TitleScene`, then regenerate `index.html` so the single-file entry exposes the same option.

**Tech Stack:** Phaser 3, Three.js r160 local script, plain HTML/CSS/JS, Node verification scripts, Playwright browser smoke test.

---

### Task 1: Contract Test

**Files:**
- Create: `tools/verify_3d_prototype.mjs`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools\verify_3d_prototype.mjs`

Expected: FAIL because `prototype3d.html` and `src/3d/` do not exist yet.

### Task 2: Static Prototype Page

**Files:**
- Create: `vendor/three.min.js`
- Create: `prototype3d.html`
- Create: `src/3d/ThreeHouseMap.js`
- Create: `src/3d/ThreePrototypeScene.js`
- Create: `src/3d/ThreeControls.js`
- Create: `src/3d/ThreeInteraction.js`

- [ ] **Step 1: Vendor Three.js**

Run: `Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js' -OutFile 'vendor\three.min.js'`

- [ ] **Step 2: Implement the 3D page**

Create `prototype3d.html` with a full-screen canvas host, terse controls, a return button, and script tags for `vendor/three.min.js` plus `src/3d/ThreePrototypeScene.js`.

- [ ] **Step 3: Implement the 3D scene modules**

Create a low-poly main hall and corridor using Three.js primitives. Add WASD movement, pointer drag look, a flashlight-style spot light, distance-based interactions, and cleanup-safe animation.

- [ ] **Step 4: Run contract test**

Run: `node tools\verify_3d_prototype.mjs`

Expected: PASS.

### Task 3: Title Entry and Standalone Sync

**Files:**
- Modify: `src/scenes/TitleScene.js`
- Modify: `tools/build_standalone_entry.mjs`
- Modify: `tools/verify_standalone_entry.mjs`
- Modify: `index.html`

- [ ] **Step 1: Add title option**

Add a secondary title action labeled `3D 原型` that navigates to `prototype3d.html`. Keep the original start action as the default 2D route.

- [ ] **Step 2: Include title change in standalone build**

Run: `node tools\build_standalone_entry.mjs`.

- [ ] **Step 3: Verify standalone entry**

Run: `node tools\verify_standalone_entry.mjs`.

Expected: PASS and `index.html` contains `prototype3d.html`.

### Task 4: Verification and Git

**Files:**
- Modify: `DEV_LOG.md`
- Modify: `README.md`

- [ ] **Step 1: Update docs**

Add a README note for the 3D prototype page and record implementation details in `DEV_LOG.md`.

- [ ] **Step 2: Run full verification**

Run:

```powershell
node tools\verify_story_state.mjs
node tools\verify_maps.mjs
node tools\verify_start_route.mjs
node tools\verify_3d_prototype.mjs
node tools\build_standalone_entry.mjs
node tools\verify_standalone_entry.mjs
git diff --check
```

- [ ] **Step 3: Browser smoke test**

Start a local static server and use Playwright to confirm `prototype3d.html` renders a nonblank canvas, accepts movement keys, shows an interaction prompt near the altar, and returns to `index.html`.

- [ ] **Step 4: Commit and push**

Commit the implementation and push to GitHub. If work was done on `codex/3d-prototype-entry`, merge it into `main`, push `main`, and leave both `main` and `origin/main` aligned.
