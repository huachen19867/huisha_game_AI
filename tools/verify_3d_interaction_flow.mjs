import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

function createElementStub() {
    const classes = new Set();
    return {
        textContent: '',
        classList: {
            add(name) {
                classes.add(name);
            },
            remove(name) {
                classes.delete(name);
            },
            contains(name) {
                return classes.has(name);
            }
        }
    };
}

const listeners = new Map();
const fakeWindow = {
    Huisha3D: {},
    addEventListener(type, handler) {
        listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
        if (listeners.get(type) === handler) listeners.delete(type);
    }
};

vm.runInNewContext(
    await readFile(new URL('../src/3d/ThreeInteraction.js', import.meta.url), 'utf8'),
    { window: fakeWindow },
    { filename: 'ThreeInteraction.js' }
);

const map = {
    objective: {
        initial: '目标：调查供桌、棺材和黑布相框',
        hallRequired: ['altar', 'coffin', 'black_frame'],
        hallComplete: '目标：沿走廊前进，调查尽头封门',
        completeRequired: ['altar', 'coffin', 'black_frame', 'corridor_end_door'],
        complete: '目标：返回正厅，等待下一段 3D 内容'
    },
    interactables: [
        { id: 'altar', label: '按 E 调查供桌', position: { x: 0, z: -3 }, radius: 1, title: '供桌', text: '供桌文本' },
        { id: 'coffin', label: '按 E 调查棺材', position: { x: 0, z: 0 }, radius: 1, title: '棺材', text: '棺材文本' },
        { id: 'black_frame', label: '按 E 掀开黑布', position: { x: 0, z: -4 }, radius: 1, title: '黑布相框', text: '相框文本' },
        { id: 'corridor_end_door', label: '按 E 调查尽头封门', position: { x: 0, z: -11 }, radius: 1, title: '尽头封门', text: '封门文本' }
    ]
};

const camera = { position: { x: 0, z: 3 } };
const prompt = createElementStub();
const objective = createElementStub();
const dialogs = [];
const interaction = new fakeWindow.Huisha3D.ThreeInteraction({
    camera,
    map,
    prompt,
    objective,
    onDialog(title, text) {
        dialogs.push({ title, text });
    }
});

function investigate(id) {
    const item = map.interactables.find((candidate) => candidate.id === id);
    camera.position.x = item.position.x;
    camera.position.z = item.position.z;
    interaction.update();
    assert.equal(prompt.classList.contains('is-visible'), true, `${id} should show an interaction prompt`);
    listeners.get('keydown')({ code: 'KeyE' });
    interaction.update();
}

assert.equal(objective.textContent, map.objective.initial);
assert.equal(objective.classList.contains('is-complete'), false);

investigate('altar');
assert.equal(objective.textContent, map.objective.initial);
assert.equal(prompt.textContent, '按 E 调查供桌（已调查）');

investigate('coffin');
assert.equal(objective.textContent, map.objective.initial);

investigate('black_frame');
assert.equal(objective.textContent, map.objective.hallComplete);
assert.equal(objective.classList.contains('is-complete'), false);

investigate('corridor_end_door');
assert.equal(objective.textContent, map.objective.complete);
assert.equal(objective.classList.contains('is-complete'), true);
assert.deepEqual(dialogs.map((dialog) => dialog.title), ['供桌', '棺材', '黑布相框', '尽头封门']);

interaction.dispose();
assert.equal(listeners.has('keydown'), false);

console.log('3D interaction flow verification passed');
