import assert from 'node:assert/strict';
import { resolveStartRoute } from '../src/systems/StartRoute.js';

await verifyTitlePresentation();

assert.deepEqual(resolveStartRoute(''), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?map=room_kitchen'), {
    scene: 'GameScene',
    data: { mapId: 'room_kitchen', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?map=room_bedroom_me'), {
    scene: 'GameScene',
    data: { mapId: 'room_bedroom_me', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?map=missing_map'), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?map=memory_school'), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?legacy=0&map=memory_school'), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?legacy=true&map=memory_school'), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?map=room_main&x=96&y=144'), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true, x: 96, y: 144 }
});
assert.deepEqual(resolveStartRoute('?map=room_main&x=not-a-number&y=144'), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true, y: 144 }
});
assert.deepEqual(resolveStartRoute('?map=room_main&x=96&y=Infinity'), {
    scene: 'GameScene',
    data: { mapId: 'room_main', sliceMode: true, x: 96 }
});
assert.deepEqual(resolveStartRoute('?map=room_kitchen&x=&y=%20'), {
    scene: 'GameScene',
    data: { mapId: 'room_kitchen', sliceMode: true }
});
assert.deepEqual(resolveStartRoute('?map=room_kitchen&x=   &y=0'), {
    scene: 'GameScene',
    data: { mapId: 'room_kitchen', sliceMode: true, y: 0 }
});
assert.deepEqual(resolveStartRoute('?map=room_kitchen&x=0&y=%09'), {
    scene: 'GameScene',
    data: { mapId: 'room_kitchen', sliceMode: true, x: 0 }
});

function relativeLuminance(color) {
    const match = /^#([0-9a-f]{6})$/i.exec(color);
    assert.ok(match, `expected a six-digit hex color, got ${color}`);

    const channels = [0, 2, 4].map((offset) => {
        const encoded = Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255;
        return encoded <= 0.04045
            ? encoded / 12.92
            : ((encoded + 0.055) / 1.055) ** 2.4;
    });

    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(firstColor, secondColor) {
    const firstLuminance = relativeLuminance(firstColor);
    const secondLuminance = relativeLuminance(secondColor);
    const lighter = Math.max(firstLuminance, secondLuminance);
    const darker = Math.min(firstLuminance, secondLuminance);
    return (lighter + 0.05) / (darker + 0.05);
}

async function verifyTitlePresentation() {
    const globalSnapshots = ['Phaser', 'window', 'document'].map((name) => ({
        name,
        existed: Object.hasOwn(globalThis, name),
        value: globalThis[name]
    }));

    try {
        globalThis.Phaser = {
            Scene: class {
                constructor(key) {
                    this.sceneKey = key;
                }
            },
            Cameras: {
                Scene2D: {
                    Events: { FADE_OUT_COMPLETE: 'fade-out-complete' }
                }
            }
        };
        globalThis.window = { location: { search: '' } };

        const elements = new Map();
        globalThis.document = {
            getElementById(id) {
                if (!elements.has(id)) {
                    elements.set(id, {
                        innerHTML: '',
                        style: {},
                        classList: { add() {} }
                    });
                }
                return elements.get(id);
            }
        };

        const textCalls = [];
        const { TitleScene } = await import('../src/scenes/TitleScene.js');
        const scene = new TitleScene();
        scene.cameras = {
            main: {
                setBackgroundColor() {},
                fadeOut() {},
                once() {}
            }
        };
        scene.add = {
            text(x, y, text, style) {
                textCalls.push({ x, y, text, style });
                return {
                    alpha: 1,
                    setOrigin() { return this; },
                    setInteractive() { return this; },
                    setAlpha(alpha) { this.alpha = alpha; return this; },
                    on() {},
                    off() {}
                };
            }
        };
        scene.tweens = { add() {} };
        scene.input = {
            keyboard: {
                once() {},
                on() {},
                off() {}
            }
        };
        scene.game = {};
        scene.scene = { start() {} };

        scene.create();

        const callsFor = (text) => textCalls.filter((call) => call.text === text);
        const titleCalls = callsFor('回 煞');
        const previewCalls = callsFor('实体解谜重做预览');
        const startCalls = callsFor('开始游戏  [空格]');
        const authorCalls = callsFor('作者WeChat：baidai_baidai');

        assert.equal(titleCalls.length, 1, 'title should render the game name once');
        assert.equal(previewCalls.length, 1, 'title should render the redesign preview once');
        assert.equal(startCalls.length, 1, 'title should render exactly one start action');
        assert.equal(authorCalls.length, 1, 'title should render the author contact once');

        const titleCall = titleCalls[0];
        const previewCall = previewCalls[0];
        const startCall = startCalls[0];
        const authorCall = authorCalls[0];
        assert.ok(
            titleCall.y < previewCall.y && previewCall.y < startCall.y,
            'preview should sit between the title and start action'
        );
        assert.ok(authorCall.y > startCall.y, 'author contact should sit below the start action');
        assert.equal(authorCall.style.fontSize, '14px');

        const authorContrast = contrastRatio(authorCall.style.color, '#000000');
        assert.ok(
            authorContrast >= 4.5,
            `author contact contrast should be at least 4.5:1, got ${authorContrast.toFixed(2)}:1`
        );
    } finally {
        for (const snapshot of globalSnapshots) {
            if (snapshot.existed) {
                globalThis[snapshot.name] = snapshot.value;
            } else {
                delete globalThis[snapshot.name];
            }
        }
    }
}

console.log('Slice start route verification passed');
