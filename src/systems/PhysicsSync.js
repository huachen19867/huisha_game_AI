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
