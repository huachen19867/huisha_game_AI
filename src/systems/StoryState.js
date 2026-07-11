export function createDefaultStoryFlags() {
    return {
        clues: { control: 0, illness: 0, death: 0 },
        collectedClues: [],
        memories: { school: false, hospital: false, crash: false },
        puzzles: { school: false, hospital: false },
        photoSetCollected: false,
        familyPhotoCornerFound: false,
        familyPhotoAssembled: false,
        chasePhase: 'idle',
        crashEvidence: { car: false, guardrail: false },
        coffinOpened: false,
        endingChoice: null,
        postMemoryDialogShown: {
            school: false,
            hospital: false
        }
    };
}

export function createDefaultGameState() {
    return {
        storyStep: 0,
        hasMatches: false,
        hasRice: false,
        hasIncense: false,
        hasSpiritMoney: false,
        hasRedKey: false,
        candlesLit: 0,
        inventory: [],
        viewedPhotos: [],
        clues: [],
        corridorSolved: false,
        viewedIntro: false,
        viewedEntrance: false,
        doorSlammed: false,
        isHidden: false,
        isChasing: false,
        cabinetMoved: false,
        sanity: 100,
        storyFlags: createDefaultStoryFlags()
    };
}

export function ensureStoryFlags(gameState) {
    if (!gameState.storyFlags) {
        gameState.storyFlags = createDefaultStoryFlags();
    }

    const flags = gameState.storyFlags;
    if (!flags.clues) flags.clues = { control: 0, illness: 0, death: 0 };
    flags.clues.control = flags.clues.control || 0;
    flags.clues.illness = flags.clues.illness || 0;
    flags.clues.death = flags.clues.death || 0;

    if (!flags.collectedClues) flags.collectedClues = [];
    if (!flags.memories) flags.memories = { school: false, hospital: false, crash: false };
    flags.memories.school = !!flags.memories.school;
    flags.memories.hospital = !!flags.memories.hospital;
    flags.memories.crash = !!flags.memories.crash;

    if (!flags.puzzles) flags.puzzles = { school: false, hospital: false };
    flags.puzzles.school = !!flags.puzzles.school;
    flags.puzzles.hospital = !!flags.puzzles.hospital;
    flags.photoSetCollected = !!flags.photoSetCollected;
    flags.familyPhotoCornerFound = !!flags.familyPhotoCornerFound;
    flags.familyPhotoAssembled = !!flags.familyPhotoAssembled;
    flags.coffinOpened = !!flags.coffinOpened;
    if (!['idle', 'active', 'escaped'].includes(flags.chasePhase)) flags.chasePhase = 'idle';
    if (!flags.crashEvidence) flags.crashEvidence = { car: false, guardrail: false };
    flags.crashEvidence.car = !!flags.crashEvidence.car;
    flags.crashEvidence.guardrail = !!flags.crashEvidence.guardrail;

    if (flags.endingChoice === undefined) flags.endingChoice = null;
    if (!flags.postMemoryDialogShown) {
        flags.postMemoryDialogShown = { school: false, hospital: false };
    }
    flags.postMemoryDialogShown.school = !!flags.postMemoryDialogShown.school;
    flags.postMemoryDialogShown.hospital = !!flags.postMemoryDialogShown.hospital;

    if (typeof gameState.sanity !== 'number' || Number.isNaN(gameState.sanity)) {
        gameState.sanity = 100;
    }

    return flags;
}

export function normalizeGameState(gameState) {
    if (!gameState.inventory) gameState.inventory = [];
    if (!gameState.viewedPhotos) gameState.viewedPhotos = [];
    if (!gameState.clues) gameState.clues = [];
    if (gameState.candlesLit === undefined) gameState.candlesLit = 0;
    ensureStoryFlags(gameState);
    return gameState;
}

export function collectClue(gameState, clueId, clueType) {
    const flags = ensureStoryFlags(gameState);
    if (!clueId || !clueType || flags.collectedClues.includes(clueId)) return false;
    flags.collectedClues.push(clueId);
    flags.clues[clueType] = (flags.clues[clueType] || 0) + 1;
    return true;
}

export function getTruthLevel(gameState) {
    const flags = ensureStoryFlags(gameState);
    const complete = flags.puzzles.school &&
        flags.puzzles.hospital &&
        flags.familyPhotoAssembled &&
        flags.clues.death >= 2 &&
        flags.coffinOpened;
    if (complete) return 'complete';
    if (flags.puzzles.school && flags.puzzles.hospital) return 'family';
    return 'surface';
}

export function reconcileFamilyPhoto(gameState) {
    const flags = ensureStoryFlags(gameState);
    flags.familyPhotoAssembled = flags.photoSetCollected && flags.familyPhotoCornerFound;
    return flags.familyPhotoAssembled;
}

export function getExitRoute(gameState) {
    const truthLevel = getTruthLevel(gameState);
    if (truthLevel === 'complete') return 'memory_crash';
    if (truthLevel === 'family') return 'ending_huisha';
    return 'ending_pojian';
}

export function canChooseCrashEnding(gameState) {
    const flags = ensureStoryFlags(gameState);
    return getTruthLevel(gameState) === 'complete' && flags.crashEvidence.car && flags.crashEvidence.guardrail;
}
