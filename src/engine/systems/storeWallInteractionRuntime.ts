import type { CardinalDir, ChampionEquipment, FloorItem, GameTile } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import {
    runChampionItemOnFrontWallRuntime,
    runFloorItemOnFrontWallRuntime,
} from './itemCommandRuntime';
import {
    buildUseChampionItemOnViAltarPatch,
    buildUseFloorItemOnViAltarPatch,
} from './viAltarInteraction';
import { activateWallSensor as activateWallSensorSystem } from './wallSensorActivation';

type FrontWallInteractionResult<TPatch extends Record<string, unknown>> = {
    matched: boolean;
    patch: TPatch | null;
    shouldPlayPlate: boolean;
};

type ActiveFloorDragLike = {
    itemId: string;
} | null;

type FrontWallRuntimeStateLike = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    activeFloorDrag: ActiveFloorDragLike;
};

type SensorStateLike = {
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    openDoors: Set<string>;
    openWalls: Set<string>;
    sensorRotationOffsets: Record<string, number>;
};

type WallSensorActivationStateLike<TPendingSensorEvent> = {
    pendingSensorEvents: TPendingSensorEvent[];
    floorItems: FloorItem[];
};

type ViAltarInteractionStateLike = {
    level: number;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    activeFloorDrag?: ActiveFloorDragLike;
};

type ViAltarInteractionPatchDeps<
    TState extends ViAltarInteractionStateLike,
    TPatch extends Record<string, unknown>,
> = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    isAltarWallFaceSystem: (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        getTile: (level: number, x: number, y: number) => GameTile | undefined,
    ) => boolean;
    buildBaseResurrectionPatch: (
        state: TState,
        deadChampionId: number,
        consumedItemId: string,
        carriedChampionId: number | null,
    ) => TPatch | null;
    decorateResurrectionPatch: (
        state: TState,
        basePatch: TPatch | null,
        wallX: number,
        wallY: number,
        wallFace: CardinalDir,
        carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
    ) => TPatch | null;
};

type ApplyFrontWallInteractionDeps<TPatch extends Record<string, unknown>> = {
    applyPatch: (patch: TPatch) => void;
    playPlate: () => void;
};

type ChampionFrontWallRuntimeDeps<
    TState extends FrontWallRuntimeStateLike,
    TSensorState,
    TPatch extends Record<string, unknown>,
> = Parameters<typeof runChampionItemOnFrontWallRuntime<TState, TSensorState, TPatch>>[4];

type FloorFrontWallRuntimeDeps<
    TState extends FrontWallRuntimeStateLike,
    TSensorState,
    TPatch extends Record<string, unknown>,
> = Parameters<typeof runFloorItemOnFrontWallRuntime<TState, TSensorState, TPatch>>[3];

type WallSensorActivationRuntimeDeps<
    TState extends WallSensorActivationStateLike<TPendingSensorEvent>,
    TSensorState extends SensorStateLike,
    TPendingSensorEvent,
    TAppliedPatch,
> = Parameters<typeof activateWallSensorSystem<TState, TSensorState, TPendingSensorEvent, TAppliedPatch>>[5];

function createStoreViAltarInteractionDeps<
    TState extends ViAltarInteractionStateLike,
    TPatch extends Record<string, unknown>,
>(
    altarX: number,
    altarY: number,
    altarFace: CardinalDir,
    deps: ViAltarInteractionPatchDeps<TState, TPatch>,
) {
    return {
        isAltarWallFace: (level: number, x: number, y: number, face: CardinalDir) =>
            deps.isAltarWallFaceSystem(level, x, y, face, deps.getTile),
        buildViAltarResurrectionPatch: (
            state: TState,
            deadChampionId: number,
            consumedItemId: string,
            carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
        ) =>
            deps.decorateResurrectionPatch(
                state,
                deps.buildBaseResurrectionPatch(
                    state,
                    deadChampionId,
                    consumedItemId,
                    carriedBy?.championId ?? null,
                ),
                altarX,
                altarY,
                altarFace,
                carriedBy,
            ),
    };
}

export function applyStoreFrontWallInteractionResult<TPatch extends Record<string, unknown>>(
    result: FrontWallInteractionResult<TPatch>,
    deps: ApplyFrontWallInteractionDeps<TPatch>,
): boolean {
    if (!result.matched || !result.patch) return false;
    deps.applyPatch(result.patch);
    if (result.shouldPlayPlate) deps.playPlate();
    return true;
}

export function runStoreWallSensorActivation<
    TState extends WallSensorActivationStateLike<TPendingSensorEvent>,
    TSensorState extends SensorStateLike,
    TPendingSensorEvent,
    TAppliedPatch,
>(
    state: TState,
    mapIndex: number,
    x: number,
    y: number,
    sensorIndex: number,
    buildDeps: () => WallSensorActivationRuntimeDeps<TState, TSensorState, TPendingSensorEvent, TAppliedPatch>,
): TAppliedPatch | TState {
    return activateWallSensorSystem<TState, TSensorState, TPendingSensorEvent, TAppliedPatch>(
        state,
        mapIndex,
        x,
        y,
        sensorIndex,
        buildDeps(),
    );
}

export function runStoreChampionItemOnFrontWall<
    TState extends FrontWallRuntimeStateLike,
    TSensorState,
    TPatch extends Record<string, unknown>,
>(
    state: TState,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    buildDeps: () => ChampionFrontWallRuntimeDeps<TState, TSensorState, TPatch>,
): FrontWallInteractionResult<TPatch> {
    return runChampionItemOnFrontWallRuntime<TState, TSensorState, TPatch>(
        state,
        championId,
        itemId,
        fromSlot,
        buildDeps(),
    );
}

export function runStoreFloorItemOnFrontWall<
    TState extends FrontWallRuntimeStateLike,
    TSensorState,
    TPatch extends Record<string, unknown>,
>(
    state: TState,
    itemId: string,
    championId: number,
    buildDeps: () => FloorFrontWallRuntimeDeps<TState, TSensorState, TPatch>,
): FrontWallInteractionResult<TPatch> {
    return runFloorItemOnFrontWallRuntime<TState, TSensorState, TPatch>(
        state,
        itemId,
        championId,
        buildDeps(),
    );
}

export function buildStoreChampionItemOnViAltarPatch<
    TState extends ViAltarInteractionStateLike,
    TPatch extends Record<string, unknown>,
>(
    state: TState,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    altarX: number,
    altarY: number,
    altarFace: CardinalDir,
    deps: ViAltarInteractionPatchDeps<TState, TPatch>,
): TPatch | null {
    return buildUseChampionItemOnViAltarPatch(
        state,
        championId,
        itemId,
        fromSlot,
        altarX,
        altarY,
        altarFace,
        createStoreViAltarInteractionDeps(altarX, altarY, altarFace, deps),
    );
}

export function buildStoreFloorItemOnViAltarPatch<
    TState extends ViAltarInteractionStateLike,
    TPatch extends Record<string, unknown>,
>(
    state: TState,
    itemId: string,
    altarX: number,
    altarY: number,
    altarFace: CardinalDir,
    deps: ViAltarInteractionPatchDeps<TState, TPatch>,
): TPatch | null {
    return buildUseFloorItemOnViAltarPatch(
        state,
        itemId,
        altarX,
        altarY,
        altarFace,
        createStoreViAltarInteractionDeps(altarX, altarY, altarFace, deps),
    );
}
