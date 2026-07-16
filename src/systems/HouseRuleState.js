const ATTENTION_STATES = Object.freeze(['quiet', 'suspicious', 'checking', 'chasing']);

function normalizeAttention(attention) {
    return ATTENTION_STATES.includes(attention) ? attention : 'quiet';
}

export function evaluateDinnerBell({ demonstrated, elapsedMs = 0, movedDistance = 0 } = {}) {
    if (demonstrated !== true) return 'demonstration';
    if (movedDistance >= 16) return 'violated';
    return elapsedMs >= 2500 ? 'obeyed' : 'listening';
}

export function advanceAttention(attention) {
    if (!ATTENTION_STATES.includes(attention)) return 'quiet';
    const current = normalizeAttention(attention);
    return ATTENTION_STATES[Math.min(ATTENTION_STATES.indexOf(current) + 1, ATTENTION_STATES.length - 1)];
}

export function recoverAttention(attention) {
    if (!ATTENTION_STATES.includes(attention)) return 'quiet';
    const current = normalizeAttention(attention);
    return ATTENTION_STATES[Math.max(ATTENTION_STATES.indexOf(current) - 1, 0)];
}

export function shouldPauseHouseRule({ dialog, replay, switching, carryingAnimation } = {}) {
    return dialog === true || replay === true || switching === true || carryingAnimation === true;
}

export function isFatherSafeZone({ zone, moving } = {}) {
    return zone === 'under_table' && moving !== true;
}
