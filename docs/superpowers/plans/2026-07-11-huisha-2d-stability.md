# 《回煞》2D 稳定性修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复冲刺、帧率差异、坐标回退、静态碰撞、移动端监听、室内雨、空间音效和追逐失败重试问题，为玩法重构提供稳定底座。

**Architecture:** 把帧率相关计算、出生数据和静态物理体同步抽成可独立测试的纯函数或小工具；`GameScene` 只负责装配和生命周期。原生 DOM 监听统一登记并在 Phaser `shutdown` 事件中解绑。

**Tech Stack:** JavaScript ES modules、Phaser 3.60、Node.js `assert`、静态 HTML

---

### Task 1: 建立帧率独立的移动与资源计算

**Files:**
- Create: `src/systems/RuntimeState.js`
- Create: `tools/verify_runtime_state.mjs`
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: 写入失败测试，覆盖冲刺、体力、理智和零坐标**

```js
import assert from 'node:assert/strict';
import {
    resolveSpawnCoordinate,
    updateBoundedResource,
    updateStaminaState
} from '../src/systems/RuntimeState.js';

assert.equal(resolveSpawnCoordinate(0, 320), 0);
assert.equal(resolveSpawnCoordinate(undefined, 320), 320);
assert.equal(resolveSpawnCoordinate(null, 320), 320);

const running = updateStaminaState({
    stamina: 50,
    maxStamina: 100,
    exhausted: false,
    wantsRun: true,
    isMoving: true,
    deltaMs: 1000
});
assert.deepEqual(running, { stamina: 40, exhausted: false, isRunning: true });

const idle60 = Array.from({ length: 60 }).reduce(
    state => updateStaminaState({ ...state, maxStamina: 100, wantsRun: false, isMoving: false, deltaMs: 1000 / 60 }),
    { stamina: 50, exhausted: false, isRunning: false }
);
const idle144 = Array.from({ length: 144 }).reduce(
    state => updateStaminaState({ ...state, maxStamina: 100, wantsRun: false, isMoving: false, deltaMs: 1000 / 144 }),
    { stamina: 50, exhausted: false, isRunning: false }
);
assert.ok(Math.abs(idle60.stamina - idle144.stamina) < 0.001);

const sanity60 = Array.from({ length: 60 }).reduce(value => updateBoundedResource(value, -3, 1000 / 60, 0, 100), 100);
const sanity144 = Array.from({ length: 144 }).reduce(value => updateBoundedResource(value, -3, 1000 / 144, 0, 100), 100);
assert.ok(Math.abs(sanity60 - 97) < 0.001);
assert.ok(Math.abs(sanity60 - sanity144) < 0.001);

console.log('Runtime state verification passed');
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run: `node tools/verify_runtime_state.mjs`

Expected: FAIL，错误包含 `Cannot find module 'src/systems/RuntimeState.js'`。

- [ ] **Step 3: 实现纯运行时计算**

```js
export function resolveSpawnCoordinate(value, fallback) {
    return value === undefined || value === null ? fallback : value;
}

export function updateBoundedResource(current, ratePerSecond, deltaMs, min = 0, max = 100) {
    const next = current + ratePerSecond * (deltaMs / 1000);
    return Math.max(min, Math.min(max, next));
}

export function updateStaminaState({ stamina, maxStamina, exhausted, wantsRun, isMoving, deltaMs }) {
    const drainPerSecond = 10;
    const rechargePerSecond = 5;
    let nextStamina = stamina;
    let nextExhausted = exhausted;
    let isRunning = wantsRun && isMoving && !nextExhausted;

    if (isRunning) {
        nextStamina = updateBoundedResource(nextStamina, -drainPerSecond, deltaMs, 0, maxStamina);
        if (nextStamina <= 0) {
            nextExhausted = true;
            isRunning = false;
        }
    } else {
        nextStamina = updateBoundedResource(nextStamina, rechargePerSecond, deltaMs, 0, maxStamina);
        if (nextExhausted && nextStamina > 30) nextExhausted = false;
    }

    return { stamina: nextStamina, exhausted: nextExhausted, isRunning };
}
```

- [ ] **Step 4: 让 Player 先读取方向，再计算冲刺**

把 `Player.update` 签名改为 `update(cursors, wasd, joystick, soundManager, delta)`。先计算 `moveX`、`moveY`，再调用：

```js
const staminaState = updateStaminaState({
    stamina: this.stamina,
    maxStamina: this.maxStamina,
    exhausted: this.exhausted,
    wantsRun: this.keyShift.isDown,
    isMoving: moveX !== 0 || moveY !== 0,
    deltaMs: delta
});
this.stamina = staminaState.stamina;
this.exhausted = staminaState.exhausted;
this.isRunning = staminaState.isRunning;
```

删除旧的按帧 `staminaDrainRate`、`staminaRechargeRate` 分支。

- [ ] **Step 5: 让 GameScene 传入 delta，并按秒计算理智值**

把 `update()` 签名从 `update()` 改为 `update(time, delta)`；把玩家更新调用精确替换为：

```js
this.player.update(this.cursors, this.wasd, this.joystick, this.soundManager, delta);
```

把末尾调用精确替换为 `this.updateSanity(delta)`，并把理智方法替换为：

```js

updateSanity(delta) {
    let ratePerSecond = 0;
    if (['room_basement', 'room_attic', 'room_secret'].includes(this.currentMapId)) ratePerSecond -= 3;
    if (this.chaser?.active && this.gameState.isChasing) {
        const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, this.chaser.x, this.chaser.y);
        if (dist < 300) ratePerSecond -= 12;
    }
    if (['room_bedroom_me', 'room_memory'].includes(this.currentMapId)) ratePerSecond = 6;
    this.gameState.sanity = updateBoundedResource(this.gameState.sanity, ratePerSecond, delta, 0, 100);
    window.updateSanityUI?.(this.gameState.sanity, 100);
}
```

- [ ] **Step 6: 修复零坐标出生点并登记构建依赖**

`GameScene.init()` 与 `create()` 使用 `resolveSpawnCoordinate`：

```js
this.playerStartX = data.x ?? null;
this.playerStartY = data.y ?? null;
const startX = resolveSpawnCoordinate(this.playerStartX, mapData.objects.playerStart.x);
const startY = resolveSpawnCoordinate(this.playerStartY, mapData.objects.playerStart.y);
```

把 `src/systems/RuntimeState.js` 放在 `tools/build_standalone_entry.mjs` 的 `StoryState.js` 之后、`Player.js` 之前。

- [ ] **Step 7: 运行测试和语法检查**

Run: `node tools/verify_runtime_state.mjs; node --check src/entities/Player.js; node --check src/scenes/GameScene.js`

Expected: runtime state 输出 `passed`，两项语法检查退出码为 0。

- [ ] **Step 8: 提交帧率与冲刺修复**

```powershell
git add -- src/systems/RuntimeState.js src/entities/Player.js src/scenes/GameScene.js tools/verify_runtime_state.mjs tools/build_standalone_entry.mjs
git commit -m "fix: make movement and resources frame-rate independent"
```

### Task 2: 统一静态物理体同步

**Files:**
- Create: `src/systems/PhysicsSync.js`
- Create: `tools/verify_physics_sync.mjs`
- Modify: `src/systems/MapManager.js`
- Modify: `src/systems/InteractionManager.js`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: 写入失败测试**

```js
import assert from 'node:assert/strict';
import { syncStaticBody } from '../src/systems/PhysicsSync.js';

let refreshCalls = 0;
assert.equal(syncStaticBody({ refreshBody() { refreshCalls += 1; } }), true);
assert.equal(refreshCalls, 1);

let updateCalls = 0;
assert.equal(syncStaticBody({ body: { updateFromGameObject() { updateCalls += 1; } } }), true);
assert.equal(updateCalls, 1);
assert.equal(syncStaticBody(null), false);
assert.equal(syncStaticBody({}), false);

console.log('Physics sync verification passed');
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run: `node tools/verify_physics_sync.mjs`

Expected: FAIL，错误包含 `Cannot find module 'src/systems/PhysicsSync.js'`。

- [ ] **Step 3: 实现同步工具**

```js
export function syncStaticBody(gameObject) {
    if (!gameObject) return false;
    if (typeof gameObject.refreshBody === 'function') {
        gameObject.refreshBody();
        return true;
    }
    if (gameObject.body && typeof gameObject.body.updateFromGameObject === 'function') {
        gameObject.body.updateFromGameObject();
        return true;
    }
    return false;
}
```

- [ ] **Step 4: 在 MapManager 的所有静态尺寸和位置变更后调用工具**

`setupFurniture()` 在 `setSize`、`setOffset` 后执行 `syncStaticBody(obj)`；父母衣柜根据 `cabinetMoved` 修改 `x` 后再次同步；保险箱、家规、棺材和通用剧情物件使用同一工具，删除重复的 `refreshBody/updateFromGameObject` 分支。

- [ ] **Step 5: 在衣柜 tween 完成后同步物理体**

`InteractionManager` 的 `parents_cabinet` tween `onComplete` 第一行执行：

```js
syncStaticBody(obj);
this.gameState.cabinetMoved = true;
```

- [ ] **Step 6: 登记构建依赖并运行验证**

把 `PhysicsSync.js` 放在 `MapManager.js` 与 `InteractionManager.js` 之前。运行：

Run: `node tools/verify_physics_sync.mjs; node tools/verify_maps.mjs; node --check src/systems/MapManager.js; node --check src/systems/InteractionManager.js`

Expected: 两项验证输出 `passed`，两项语法检查退出码为 0。

- [ ] **Step 7: 提交物理同步修复**

```powershell
git add -- src/systems/PhysicsSync.js src/systems/MapManager.js src/systems/InteractionManager.js tools/verify_physics_sync.mjs tools/build_standalone_entry.mjs
git commit -m "fix: keep static collision bodies synchronized"
```

### Task 3: 管理移动端 DOM 监听生命周期

**Files:**
- Create: `src/systems/DomListenerRegistry.js`
- Create: `tools/verify_dom_listener_registry.mjs`
- Modify: `src/scenes/GameScene.js`
- Modify: `tools/build_standalone_entry.mjs`

- [ ] **Step 1: 写入失败测试**

```js
import assert from 'node:assert/strict';
import { DomListenerRegistry } from '../src/systems/DomListenerRegistry.js';

const listeners = new Map();
const target = {
    addEventListener(type, handler) { listeners.set(`${type}:${handler.name}`, handler); },
    removeEventListener(type, handler) { listeners.delete(`${type}:${handler.name}`); }
};

const registry = new DomListenerRegistry();
function onTouchStart() {}
function onMouseDown() {}
registry.add(target, 'touchstart', onTouchStart, { passive: false });
registry.add(target, 'mousedown', onMouseDown);
assert.equal(registry.size, 2);
assert.equal(listeners.size, 2);
registry.clear();
assert.equal(registry.size, 0);
assert.equal(listeners.size, 0);
registry.clear();

console.log('DOM listener registry verification passed');
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run: `node tools/verify_dom_listener_registry.mjs`

Expected: FAIL，错误包含 `Cannot find module 'src/systems/DomListenerRegistry.js'`。

- [ ] **Step 3: 实现监听登记器**

```js
export class DomListenerRegistry {
    constructor() {
        this.entries = [];
    }

    add(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        this.entries.push({ target, type, handler, options });
    }

    clear() {
        for (const { target, type, handler, options } of this.entries.splice(0)) {
            target.removeEventListener(type, handler, options);
        }
    }

    get size() {
        return this.entries.length;
    }
}
```

- [ ] **Step 4: 让 GameScene 使用命名处理器和 registry**

`initJoystick()` 首先调用 `destroyJoystick()`，再建立 `this.domListeners = new DomListenerRegistry()`；所有 `zone.addEventListener` 和 `actionBtn.addEventListener` 改为 `this.domListeners.add`，处理器保存为局部命名函数。`uiTimer` 保存为 `this.mobileUiTimer`。

```js
destroyJoystick() {
    this.domListeners?.clear();
    this.domListeners = null;
    if (this.mobileUiTimer) clearTimeout(this.mobileUiTimer);
    this.mobileUiTimer = null;
    if (this.exitHideListener) document.removeEventListener('touchstart', this.exitHideListener);
    this.exitHideListener = null;
}
```

在 `create()` 注册一次：

```js
this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyJoystick());
```

- [ ] **Step 5: 登记构建依赖并运行验证**

Run: `node tools/verify_dom_listener_registry.mjs; node --check src/scenes/GameScene.js`

Expected: 验证输出 `passed`，语法检查退出码为 0。

- [ ] **Step 6: 提交监听生命周期修复**

```powershell
git add -- src/systems/DomListenerRegistry.js src/scenes/GameScene.js tools/verify_dom_listener_registry.mjs tools/build_standalone_entry.mjs
git commit -m "fix: clean up mobile input listeners"
```

### Task 4: 修复地图氛围、空间音效和追逐重试

**Files:**
- Create: `tools/verify_scene_runtime_contracts.mjs`
- Modify: `src/data/Maps.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `src/systems/SoundManager.js`

- [ ] **Step 1: 写入运行时契约失败测试**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Maps } from '../src/data/Maps.js';

const outdoorMaps = new Set(['room_prologue', 'room_entrance', 'room_backyard', 'memory_crash']);
for (const [mapId, map] of Object.entries(Maps)) {
    assert.equal(map.visual?.rain === true, outdoorMaps.has(mapId), `${mapId} rain contract mismatch`);
}

const gameSceneSource = readFileSync(new URL('../src/scenes/GameScene.js', import.meta.url), 'utf8');
const soundSource = readFileSync(new URL('../src/systems/SoundManager.js', import.meta.url), 'utf8');
assert.match(gameSceneSource, /this\.soundManager\.setScene\(this\)/);
assert.match(gameSceneSource, /this\.physics\.resume\(\)/);
assert.doesNotMatch(gameSceneSource, /this\.scene\.restart\(\);/);
assert.match(soundSource, /setScene\(scene\)/);

console.log('Scene runtime contract verification passed');
```

- [ ] **Step 2: 运行测试并确认 rain 与 setScene 契约失败**

Run: `node tools/verify_scene_runtime_contracts.mjs`

Expected: FAIL，错误指向首个缺少 `visual.rain` 的地图或缺少 `setScene`。

- [ ] **Step 3: 给地图写入明确 rain 配置**

`room_prologue`、`room_entrance`、`room_backyard`、`memory_crash` 的 `visual.rain` 设为 `true`。`room_main`、`room_kitchen`、`room_corridor`、`room_bathroom`、`room_bedroom_parents`、`room_secret`、`room_study`、`room_medicine`、`room_bedroom_me`、`room_basement`、`room_attic`、`memory_school`、`memory_hospital`、`room_memory` 的 `visual.rain` 设为 `false`。不存在 `visual` 的地图新增对象，已有 `ambient`、`floorTint`、`wallTint`、`paperTint` 和 `debris` 字段原值不改。

- [ ] **Step 4: 让 GameScene 只在配置允许时生成雨并保留地图 ambient**

```js
const shouldRain = mapData.visual?.rain === true && !this.isMobile;
this.rainParticles = this.add.particles(0, 0, 'rain', {
    x: { min: 0, max: 800 },
    y: -10,
    quantity: shouldRain ? 2 : 0,
    lifespan: 1000,
    speedY: { min: 400, max: 600 },
    speedX: { min: -20, max: 20 },
    scale: { start: 1, end: 1 },
    alpha: { start: 0.5, end: 0 },
    blendMode: 'ADD'
});
if (!shouldRain) this.rainParticles.stop();
```

删除 `GameScene.create()` 中在 `MapManager.createMap()` 之后无条件执行的 `this.lights.setAmbientColor(0x888888)`；环境光只由 `MapManager` 决定。

- [ ] **Step 5: 更新 SoundManager 场景引用**

```js
setScene(scene) {
    this.scene = scene;
    return this;
}
```

`GameScene.create()` 在取得 `this.game.soundManager` 后执行 `this.soundManager.setScene(this)`。

- [ ] **Step 6: 修复追逐失败重启数据**

被追逐者捕获的回调改为：

```js
this.physics.pause();
this.chaser.body.setVelocity(0);
window.showDialog('暴怒的黑影', '抓到你了……但这次记忆没有把你送回最初。', () => {
    this.physics.resume();
    this.gameState.isHidden = false;
    const retryMap = Maps[this.currentMapId];
    this.scene.restart({
        mapId: this.currentMapId,
        x: retryMap.objects.playerStart.x,
        y: retryMap.objects.playerStart.y,
        previousMapId: this.previousMapId
    });
});
```

- [ ] **Step 7: 运行稳定性验证**

Run: `node tools/verify_scene_runtime_contracts.mjs; node tools/verify_maps.mjs; node --check src/scenes/GameScene.js; node --check src/systems/SoundManager.js`

Expected: 两项验证输出 `passed`，两项语法检查退出码为 0。

- [ ] **Step 8: 提交场景运行时修复**

```powershell
git add -- src/data/Maps.js src/scenes/GameScene.js src/systems/SoundManager.js tools/verify_scene_runtime_contracts.mjs
git commit -m "fix: stabilize scene atmosphere and retries"
```

### Task 5: 重建单文件并完成稳定性阶段验证

**Files:**
- Modify: `index.html`
- Modify: `DEV_LOG.md`

- [ ] **Step 1: 重建单文件入口**

Run: `node tools/build_standalone_entry.mjs`

Expected: 输出 `Standalone index.html generated`。

- [ ] **Step 2: 运行完整自动化验证**

```powershell
$scripts = rg --files tools | Where-Object { $_ -match '^tools\\verify_.*\.mjs$' }
foreach ($script in $scripts) { node $script; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
$files = rg --files src tools | Where-Object { $_ -match '\.(js|mjs)$' }
foreach ($file in $files) { node --check $file; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
git diff --check
```

Expected: 所有 verify 脚本输出 `passed`，所有语法检查退出码为 0，差异检查无输出。

- [ ] **Step 3: 浏览器烟测桌面和 390×844 视口**

桌面验证冲刺速度变化、室内学校无雨、父母衣柜移动后不产生隐形阻挡；移动视口连续切换三张地图，确认摇杆与交互按钮各触发一次且不越界。追逐失败后确认返回当前地图出生点而非序章。

- [ ] **Step 4: 更新技术日志**

在 `DEV_LOG.md` 的 2026-07-11 条目记录每个根因、对应测试文件、浏览器验证路径，以及“帧率独立计算必须使用 delta”“静态体位置变化后必须 sync”“DOM 监听必须在 shutdown 清理”三条复用边界。

- [ ] **Step 5: 提交阶段结果**

```powershell
git add -- index.html DEV_LOG.md
git commit -m "docs: record the 2d stability pass"
```
