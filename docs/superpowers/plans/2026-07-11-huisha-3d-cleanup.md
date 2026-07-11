# 《回煞》3D 产品清退实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从当前产品树移除 3D 运行入口与依赖，同时保留 3D 美术和历史设计资料作为只读归档。

**Architecture:** 2D Phaser 主线继续使用 `src/` 与单文件 `index.html` 构建链；3D 运行时代码不进入归档，依靠 Git 历史保留。新增一个 2D-only 契约脚本，防止标题页、构建入口或 README 再次出现 3D 产品入口。

**Tech Stack:** PowerShell、Git、Node.js ESM、Phaser 3 静态页面

---

### Task 1: 建立 2D-only 失败契约

**Files:**
- Create: `tools/verify_2d_only.mjs`
- Modify: `tools/verify_standalone_entry.mjs`

- [ ] **Step 1: 写入会在当前 3D 文件仍存在时失败的验证脚本**

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const removedRuntimePaths = [
    'prototype3d.html',
    'vendor/three.min.js',
    'src/3d',
    'tools/verify_3d_prototype.mjs',
    'tools/verify_3d_interaction_flow.mjs'
];

for (const relativePath of removedRuntimePaths) {
    assert.equal(existsSync(new URL(relativePath, root)), false, `3D runtime path still exists: ${relativePath}`);
}

const titleSource = readFileSync(new URL('src/scenes/TitleScene.js', root), 'utf8');
const indexSource = readFileSync(new URL('index.html', root), 'utf8');
const readmeSource = readFileSync(new URL('README.md', root), 'utf8');

for (const [label, source] of [['TitleScene', titleSource], ['index.html', indexSource]]) {
    assert.doesNotMatch(source, /prototype3d\.html|进入 3D 原型|Huisha3D/, `${label} still exposes the 3D product`);
}

assert.doesNotMatch(readmeSource, /## 🧪 3D 原型|docs\/3D_ART_PROMPTS\.md/, 'README still documents the 3D product');
assert.equal(existsSync(new URL('archive/3d/art', root)), true, '3D art archive is missing');
assert.equal(existsSync(new URL('archive/3d/docs/3D_ART_PROMPTS.md', root)), true, '3D prompt archive is missing');

console.log('2D-only product verification passed');
```

- [ ] **Step 2: 运行验证并确认失败原因是 3D 运行路径仍存在**

Run: `node tools/verify_2d_only.mjs`

Expected: FAIL，首个错误包含 `3D runtime path still exists: prototype3d.html`。

- [ ] **Step 3: 从单文件入口验证中移除旧的 3D 必须存在断言**

删除 `tools/verify_standalone_entry.mjs` 中要求 `prototype3d.html` 出现在生成入口的断言，保留禁止运行时 import、要求完整 2D 场景和本地 Phaser 依赖的断言。

- [ ] **Step 4: 提交验证契约**

```powershell
git add -- tools/verify_2d_only.mjs tools/verify_standalone_entry.mjs
git commit -m "test: require a 2d-only product tree"
```

### Task 2: 归档 3D 创作资料

**Files:**
- Move: `美术/` → `archive/3d/art/`
- Move: `docs/3D_ART_PROMPTS.md` → `archive/3d/docs/3D_ART_PROMPTS.md`
- Move: `docs/superpowers/specs/2026-07-04-huisha-3d-prototype-design.md` → `archive/3d/docs/2026-07-04-huisha-3d-prototype-design.md`
- Move: `docs/superpowers/plans/2026-07-04-huisha-3d-prototype.md` → `archive/3d/docs/2026-07-04-huisha-3d-prototype-plan.md`

- [ ] **Step 1: 验证所有移动源都位于工作区内且目标目录不存在同名文件**

```powershell
$root = (Resolve-Path '.').Path
$sources = @(
  (Resolve-Path '.\美术').Path,
  (Resolve-Path '.\docs\3D_ART_PROMPTS.md').Path,
  (Resolve-Path '.\docs\superpowers\specs\2026-07-04-huisha-3d-prototype-design.md').Path,
  (Resolve-Path '.\docs\superpowers\plans\2026-07-04-huisha-3d-prototype.md').Path
)
foreach ($source in $sources) {
  if (-not $source.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Source escaped workspace: $source" }
}
```

Expected: 命令无异常退出。

- [ ] **Step 2: 创建归档目录并移动资产**

```powershell
New-Item -ItemType Directory -Force -Path '.\archive\3d\docs' | Out-Null
New-Item -ItemType Directory -Force -Path '.\archive\3d' | Out-Null
Move-Item -LiteralPath '.\美术' -Destination '.\archive\3d\art'
Move-Item -LiteralPath '.\docs\3D_ART_PROMPTS.md' -Destination '.\archive\3d\docs\3D_ART_PROMPTS.md'
Move-Item -LiteralPath '.\docs\superpowers\specs\2026-07-04-huisha-3d-prototype-design.md' -Destination '.\archive\3d\docs\2026-07-04-huisha-3d-prototype-design.md'
Move-Item -LiteralPath '.\docs\superpowers\plans\2026-07-04-huisha-3d-prototype.md' -Destination '.\archive\3d\docs\2026-07-04-huisha-3d-prototype-plan.md'
```

- [ ] **Step 3: 验证归档文件数与图片数**

```powershell
$images = @(Get-ChildItem -LiteralPath '.\archive\3d\art' -File -Filter '*.png')
if ($images.Count -ne 18) { throw "Expected 18 archived PNG files, got $($images.Count)" }
$docs = @(Get-ChildItem -LiteralPath '.\archive\3d\docs' -File)
if ($docs.Count -ne 3) { throw "Expected 3 archived documents, got $($docs.Count)" }
```

- [ ] **Step 4: 提交归档移动**

```powershell
git add -A -- archive/3d 美术 docs/3D_ART_PROMPTS.md docs/superpowers/specs/2026-07-04-huisha-3d-prototype-design.md docs/superpowers/plans/2026-07-04-huisha-3d-prototype.md
git commit -m "chore: archive 3d source material"
```

### Task 3: 删除 3D 运行时并收紧 2D 标题入口

**Files:**
- Delete: `prototype3d.html`
- Delete: `vendor/three.min.js`
- Delete: `src/3d/ThreeHouseMap.js`
- Delete: `src/3d/ThreeControls.js`
- Delete: `src/3d/ThreeInteraction.js`
- Delete: `src/3d/ThreePrototypeScene.js`
- Delete: `tools/verify_3d_prototype.mjs`
- Delete: `tools/verify_3d_interaction_flow.mjs`
- Modify: `src/scenes/TitleScene.js`

- [ ] **Step 1: 从 `TitleScene.create()` 删除 3D 文本、淡入目标和跳转回调**

标题场景只保留一个交互文本和一个启动函数：

```js
const startText = this.add.text(400, 415, '开始游戏  [空格]', {
    fontFamily: '"SimSun", serif',
    fontSize: '24px',
    color: '#aaaaaa'
}).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0);

this.tweens.add({
    targets: startText,
    alpha: 1,
    duration: 1000,
    delay: 200
});

const startGame = () => {
    if (startText.alpha < 0.1) return;
    this.input.keyboard.off('keydown-SPACE', startGame);
    this.input.keyboard.off('keydown-ENTER', startGame);
    if (!this.game.soundManager) this.game.soundManager = new SoundManager(this);
    this.game.soundManager.playTone(100, 'sawtooth', 2);
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        const route = resolveStartRoute(window.location.search);
        this.scene.start(route.scene, route.data);
    });
};

this.input.keyboard.on('keydown-SPACE', startGame);
this.input.keyboard.on('keydown-ENTER', startGame);
startText.on('pointerdown', startGame);
```

- [ ] **Step 2: 删除精确的 3D 运行路径**

删除前验证以下解析路径都以工作区根目录开头，然后对这些精确路径执行删除：`prototype3d.html`、`vendor/three.min.js`、`src/3d`、`tools/verify_3d_prototype.mjs`、`tools/verify_3d_interaction_flow.mjs`。不删除 `vendor/` 根目录以外的任何路径。

- [ ] **Step 3: 重建单文件入口**

Run: `node tools/build_standalone_entry.mjs`

Expected: 输出 `Standalone index.html generated`，生成的标题场景只包含“开始游戏”。

- [ ] **Step 4: 运行 2D-only 与单文件验证**

Run: `node tools/verify_2d_only.mjs; node tools/verify_standalone_entry.mjs`

Expected: 两项都输出 `passed`。

- [ ] **Step 5: 提交运行时清退**

```powershell
git add -A -- prototype3d.html vendor src/3d tools src/scenes/TitleScene.js index.html
git commit -m "refactor: remove the 3d product path"
```

### Task 4: 更新产品文档并完成阶段验证

**Files:**
- Modify: `README.md`
- Modify: `DEV_LOG.md`

- [ ] **Step 1: 将 README 改为纯 2D 产品说明**

删除“3D 原型”章节、3D 维护命令、3D 文件树节点和旧提示词链接。项目结构展示 `archive/3d` 为历史资料，并把快速开始文案统一成“开始游戏”。

- [ ] **Step 2: 在 2026-07-11 日志记录实际移动、删除、验证命令与 Git 历史边界**

日志必须写明：运行时已删除、18 张图片和 3 份文档已归档、未重写 Git 历史、2D-only 验证脚本的用途，以及本地已合并分支只在所有阶段完成后删除。

- [ ] **Step 3: 运行阶段验证**

```powershell
node tools/verify_2d_only.mjs
node tools/verify_standalone_entry.mjs
node tools/verify_story_state.mjs
node tools/verify_maps.mjs
node tools/verify_start_route.mjs
$files = rg --files src tools | Where-Object { $_ -match '\.(js|mjs)$' }
foreach ($file in $files) { node --check $file; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
git diff --check
```

Expected: 五项验证全部通过、全部 JS/MJS 语法检查退出码为 0、`git diff --check` 无输出。

- [ ] **Step 4: 提交文档同步**

```powershell
git add -- README.md DEV_LOG.md
git commit -m "docs: document the 2d-only product"
```
