export function buildLoadedGameUiResetPatch<T extends object>(hydrated: T) {
    return {
        ...hydrated,
        selectedChampionIndex: 0,
        gamePhase: 'exploration' as const,
        optionsModalOpen: false,
        activeMirrorChampionId: null,
        activePartyMemberId: null,
        sleeping: false,
        paused: false,
        lastMonsterAttackDebug: null,
        endgameSequence: null,
        lastCastResult: null,
        damageEvents: [],
        spellVisualEvents: [],
        activeFloorDrag: null,
    };
}

export function buildReturnToTitlePatch() {
    return {
        gamePhase: 'title' as const,
        activeMirrorChampionId: null,
        activePartyMemberId: null,
        sleeping: false,
        paused: false,
        lastMonsterAttackDebug: null,
        endgameSequence: null,
        lastCastResult: null,
        damageEvents: [],
        spellVisualEvents: [],
    };
}
