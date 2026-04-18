type FloorDragState = {
    itemId: string;
    pointerX: number;
    pointerY: number;
};

type FloorDragStateLike = {
    activeFloorDrag: FloorDragState | null;
};

type DirectionLike = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

type TurnStateLike = {
    gamePhase: string;
    direction: DirectionLike;
};

type PartyMemberLike = {
    id: number;
};

type PartySelectionStateLike<TPartyMember extends PartyMemberLike> = {
    party: TPartyMember[];
    selectedChampionIndex: number;
};

export function buildOpenMirrorPatch(championId: number) {
    return {
        gamePhase: 'mirror_open' as const,
        activeMirrorChampionId: championId,
    };
}

export function buildCloseMirrorPatch() {
    return {
        gamePhase: 'exploration' as const,
        activeMirrorChampionId: null,
    };
}

export function buildOpenPartyMemberPatch(championId: number) {
    return {
        activePartyMemberId: championId,
    };
}

export function buildClosePartyMemberPatch() {
    return {
        activePartyMemberId: null,
    };
}

export function buildOpenOptionsModalPatch() {
    return {
        optionsModalOpen: true,
    };
}

export function buildCloseOptionsModalPatch() {
    return {
        optionsModalOpen: false,
    };
}

export function buildTryOpenGatePatch(
    partySize: number,
    maxPartySize: number,
) {
    return {
        gateOpen: partySize >= maxPartySize,
    };
}

export function buildGoToLevelPatch(
    level: number,
    position: [number, number],
    direction: DirectionLike,
) {
    return {
        level,
        position,
        direction,
    };
}

export function buildTurnLeftPatch<TState extends TurnStateLike>(state: TState) {
    if (state.gamePhase !== 'exploration') return null;
    const directions: DirectionLike[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
    const index = directions.indexOf(state.direction);
    return { direction: directions[(index + 3) % 4] };
}

export function buildTurnRightPatch<TState extends TurnStateLike>(state: TState) {
    if (state.gamePhase !== 'exploration') return null;
    const directions: DirectionLike[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
    const index = directions.indexOf(state.direction);
    return { direction: directions[(index + 1) % 4] };
}

export function buildSelectChampionPatch(index: number) {
    return {
        selectedChampionIndex: index,
    };
}

export function buildReorderPartyPatch<TPartyMember extends PartyMemberLike>(
    state: PartySelectionStateLike<TPartyMember>,
    fromIndex: number,
    toIndex: number,
) {
    if (fromIndex === toIndex) return null;
    const newParty = [...state.party];
    const [moved] = newParty.splice(fromIndex, 1);
    newParty.splice(toIndex, 0, moved);
    const selectedId = state.party[state.selectedChampionIndex]?.id;
    const newSelectedIdx = selectedId !== undefined
        ? newParty.findIndex((champion) => champion.id === selectedId)
        : state.selectedChampionIndex;
    return {
        party: newParty,
        selectedChampionIndex: Math.max(0, newSelectedIdx),
    };
}

export function buildBeginFloorDragPatch(
    itemId: string,
    pointerX: number,
    pointerY: number,
) {
    return {
        activeFloorDrag: { itemId, pointerX, pointerY },
    };
}

export function buildUpdateFloorDragPatch<TState extends FloorDragStateLike>(
    state: TState,
    pointerX: number,
    pointerY: number,
) {
    if (!state.activeFloorDrag) return null;
    return {
        activeFloorDrag: {
            ...state.activeFloorDrag,
            pointerX,
            pointerY,
        },
    };
}

export function buildEndFloorDragPatch() {
    return {
        activeFloorDrag: null,
    };
}
