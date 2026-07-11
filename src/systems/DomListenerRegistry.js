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
