import type { ChampionVitals, Direction, SpellVisualEvent } from '../runtimeTypes';

type SpellProjectileImpactDeps = {
    buildIdSuffix?: () => string;
};

type DoorImpactParams = {
    openDoors: Set<string>;
    doorKey: string;
    doorHasButton: boolean;
    level: number;
    x: number;
    y: number;
    now: number;
    gridSize: number;
    visualScale: number;
};

type WallImpactParams = {
    level: number;
    x: number;
    y: number;
    now: number;
    gridSize: number;
    visualScale: number;
    effect: SpellVisualEvent['effect'];
};

type BlockedWallImpactParams = WallImpactParams & {
    direction: Direction;
    gridSize: number;
};

type OpenDoorPatchParams = {
    nextChampionVitals: Record<number, ChampionVitals>;
    currentSpellVisualEvents: SpellVisualEvent[];
    currentOpenDoors: Set<string>;
    doorImpact: ReturnType<typeof buildSpellDoorImpactResult>;
};

type OpenBlockedPatchParams = {
    nextChampionVitals: Record<number, ChampionVitals>;
    currentSpellVisualEvents: SpellVisualEvent[];
    impactEvent: SpellVisualEvent;
};

function buildImpactId(prefix: string, now: number, deps: SpellProjectileImpactDeps): string {
    return `${prefix}_${now}_${deps.buildIdSuffix?.() ?? Math.random().toString(36).slice(2)}`;
}

export function buildSpellDoorImpactResult(
    params: DoorImpactParams,
    deps: SpellProjectileImpactDeps,
): {
    nextOpenDoors: Set<string>;
    shouldPlayDoorMotion: boolean;
    visualEvent: SpellVisualEvent;
} {
    return {
        nextOpenDoors: params.doorHasButton
            ? new Set([...params.openDoors, params.doorKey])
            : params.openDoors,
        shouldPlayDoorMotion: params.doorHasButton,
        visualEvent: {
            id: buildImpactId('spellimpact_door', params.now, deps),
            level: params.level,
            x: params.x,
            y: params.y,
            height: params.gridSize * 0.08,
            effect: 'open',
            visualScale: params.visualScale,
            ts: params.now,
            kind: 'wall',
        },
    };
}

export function buildOpenSpellDoorPatch({
    nextChampionVitals,
    currentSpellVisualEvents,
    currentOpenDoors,
    doorImpact,
}: OpenDoorPatchParams): {
    championVitals: Record<number, ChampionVitals>;
    openDoors?: Set<string>;
    spellVisualEvents: SpellVisualEvent[];
    shouldPlayDoorMotion: boolean;
} {
    return {
        championVitals: nextChampionVitals,
        ...(doorImpact.nextOpenDoors !== currentOpenDoors ? { openDoors: doorImpact.nextOpenDoors } : {}),
        spellVisualEvents: [
            ...currentSpellVisualEvents,
            doorImpact.visualEvent,
        ],
        shouldPlayDoorMotion: doorImpact.shouldPlayDoorMotion,
    };
}

export function buildOpenBlockedSpellImpactEvent(
    params: WallImpactParams,
    deps: SpellProjectileImpactDeps,
): SpellVisualEvent {
    return {
        id: buildImpactId('spellimpact_wall', params.now, deps),
        level: params.level,
        x: params.x,
        y: params.y,
        height: params.gridSize * 0.08,
        effect: 'open',
        visualScale: params.visualScale,
        ts: params.now,
        kind: 'wall',
    };
}

export function buildOpenBlockedSpellPatch({
    nextChampionVitals,
    currentSpellVisualEvents,
    impactEvent,
}: OpenBlockedPatchParams): {
    championVitals: Record<number, ChampionVitals>;
    spellVisualEvents: SpellVisualEvent[];
} {
    return {
        championVitals: nextChampionVitals,
        spellVisualEvents: [
            ...currentSpellVisualEvents,
            impactEvent,
        ],
    };
}

export function getBlockedSpellImpactOffset(direction: Direction, gridSize: number): { offsetX: number; offsetZ: number } {
    if (direction === 'NORTH') return { offsetX: 0, offsetZ: -gridSize * 0.18 };
    if (direction === 'SOUTH') return { offsetX: 0, offsetZ: gridSize * 0.18 };
    if (direction === 'EAST') return { offsetX: gridSize * 0.18, offsetZ: 0 };
    return { offsetX: -gridSize * 0.18, offsetZ: 0 };
}

export function buildBlockedSpellImpactEvent(
    params: BlockedWallImpactParams,
    deps: SpellProjectileImpactDeps,
): SpellVisualEvent {
    const offset = getBlockedSpellImpactOffset(params.direction, params.gridSize);
    return {
        id: buildImpactId('spellimpact_wall', params.now, deps),
        level: params.level,
        x: params.x,
        y: params.y,
        offsetX: offset.offsetX,
        offsetZ: offset.offsetZ,
        height: params.gridSize * 0.08,
        effect: params.effect,
        visualScale: params.visualScale * 1.2,
        ts: params.now,
        kind: 'wall',
    };
}
