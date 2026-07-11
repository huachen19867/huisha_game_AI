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
