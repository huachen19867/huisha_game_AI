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

export function syncCustomStaticBody(gameObject, width, height, offsetX, offsetY) {
    if (!gameObject?.body) return false;
    syncStaticBody(gameObject);
    gameObject.body.setSize(width, height);
    gameObject.body.setOffset(offsetX, offsetY);
    return true;
}
