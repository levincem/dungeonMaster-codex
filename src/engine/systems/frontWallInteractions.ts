import type { ChampionEquipment, FloorItem, CardinalDir } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type { Direction } from '../runtimeTypes';
import { resolveFrontWallTarget } from './frontWallState';
export { resolveFrontWallTarget } from './frontWallState';

type SelectedItem = {
    championId: number;
    itemId: string;
    fromSlot: EquipSlotKey | 'inventory';
};

type ActiveFloorDragLike = {
    itemId: string;
} | null;

type FrontWallStateLike = {
    level: number;
    position: [number, number];
    direction: Direction;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    activeFloorDrag: ActiveFloorDragLike;
};

type LockResult = {
    sensorChanges: Record<string, unknown>;
    newInventories: Record<number, FloorItem[]> | null;
    newEquipment: Record<number, ChampionEquipment> | null;
    matched: boolean;
};

type AnyObjectResult = {
    sensorChanges: Record<string, unknown>;
    matched: boolean;
};

type AlcoveResult = {
    sensorChanges: Record<string, unknown>;
    newInventories: Record<number, FloorItem[]> | null;
    newEquipment: Record<number, ChampionEquipment> | null;
    depositedItem: FloorItem | null;
    matched: boolean;
};

type ExchangerResult = {
    sensorChanges: Record<string, unknown>;
    newInventories: Record<number, FloorItem[]> | null;
    newEquipment: Record<number, ChampionEquipment> | null;
    matched: boolean;
};

type FirestaffExchangeResult = {
    nextInventories: Record<number, FloorItem[]> | null;
    nextEquipment: Record<number, ChampionEquipment> | null;
    nextFloorItems: FloorItem[];
    transformed: boolean;
};

type FrontWallItemDeps<TState, TSensorState, TAppliedPatch extends Record<string, unknown>> = {
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    isAltarWallFace: (level: number, x: number, y: number, face: CardinalDir) => boolean;
    buildViAltarResurrectionPatch: (
        state: TState,
        deadChampionId: number,
        consumedItemId: string,
        carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
    ) => TAppliedPatch | null;
    triggerLockSensors: (
        level: number,
        wallX: number,
        wallY: number,
        face: CardinalDir,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        selectedItem: SelectedItem,
    ) => LockResult;
    triggerAnyObjectWallSensor: (
        level: number,
        wallX: number,
        wallY: number,
        face: CardinalDir,
        ss: TSensorState,
    ) => AnyObjectResult;
    triggerAlcoveDepositSensor: (
        level: number,
        wallX: number,
        wallY: number,
        face: CardinalDir,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        selectedItem: SelectedItem,
    ) => AlcoveResult;
    triggerObjectExchangerSensor: (
        level: number,
        wallX: number,
        wallY: number,
        face: CardinalDir,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        selectedItem: SelectedItem,
    ) => ExchangerResult;
    applyFirestaffExchangerReward: (
        state: TState,
        wallX: number,
        wallY: number,
        face: CardinalDir,
        candidate: FloorItem | undefined,
        receiver: { championId: number; fromSlot: EquipSlotKey | 'inventory' },
        nextInventories: Record<number, FloorItem[]> | null,
        nextEquipment: Record<number, ChampionEquipment> | null,
        nextFloorItems: FloorItem[],
    ) => FirestaffExchangeResult;
    applyImmediateTransportSquareEffects: (state: TState, patch: Record<string, unknown>) => TAppliedPatch;
    buildAttackResultMessage: (message: string) => unknown;
};

export type FrontWallInteractionResult<TAppliedPatch> = {
    matched: boolean;
    patch: TAppliedPatch | null;
    shouldPlayPlate: boolean;
};

function hasSensorChanges(sensorChanges: Record<string, unknown>): boolean {
    return Object.keys(sensorChanges).length > 0;
}

function tryResolveViAltarResurrectionOnFrontWall<
    TState extends FrontWallStateLike,
    TSensorState,
    TAppliedPatch extends Record<string, unknown>,
>(
    state: TState,
    wallX: number,
    wallY: number,
    item: FloorItem | null | undefined,
    carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
    deps: FrontWallItemDeps<TState, TSensorState, TAppliedPatch>,
): TAppliedPatch | null {
    if (!item || item.category !== 'Misc' || item.typeId !== 5 || item.championId === undefined) {
        return null;
    }
    const { face } = resolveFrontWallTarget(state.position, state.direction);
    if (!deps.isAltarWallFace(state.level, wallX, wallY, face)) {
        return null;
    }
    return deps.buildViAltarResurrectionPatch(state, item.championId, item.id, carriedBy);
}

export function tryUseChampionItemOnFrontWall<
    TState extends FrontWallStateLike,
    TSensorState,
    TAppliedPatch extends Record<string, unknown>,
>(
    state: TState,
    selectedItem: SelectedItem,
    deps: FrontWallItemDeps<TState, TSensorState, TAppliedPatch>,
): FrontWallInteractionResult<TAppliedPatch> {
    const { wallX, wallY, face } = resolveFrontWallTarget(state.position, state.direction);
    const carriedItem = selectedItem.fromSlot === 'inventory'
        ? state.championInventories[selectedItem.championId]?.find((item) => item.id === selectedItem.itemId)
        : state.championEquipment[selectedItem.championId]?.[selectedItem.fromSlot];
    const altarPatch = tryResolveViAltarResurrectionOnFrontWall(
        state,
        wallX,
        wallY,
        carriedItem,
        { championId: selectedItem.championId, fromSlot: selectedItem.fromSlot },
        deps,
    );
    if (altarPatch) {
        return { matched: true, patch: altarPatch, shouldPlayPlate: false };
    }

    const ss = deps.buildSensorStateSnapshot(state);

    const lockResult = deps.triggerLockSensors(
        state.level,
        wallX,
        wallY,
        face,
        ss,
        state.championInventories,
        state.championEquipment,
        selectedItem,
    );
    if (lockResult.matched) {
        return {
            matched: true,
            patch: deps.applyImmediateTransportSquareEffects(state, {
                ...lockResult.sensorChanges,
                ...(lockResult.newInventories ? { championInventories: lockResult.newInventories } : {}),
                ...(lockResult.newEquipment ? { championEquipment: lockResult.newEquipment } : {}),
            }),
            shouldPlayPlate: hasSensorChanges(lockResult.sensorChanges),
        };
    }

    const anyObjectResult = deps.triggerAnyObjectWallSensor(
        state.level,
        wallX,
        wallY,
        face,
        ss,
    );
    if (anyObjectResult.matched) {
        return {
            matched: true,
            patch: deps.applyImmediateTransportSquareEffects(state, anyObjectResult.sensorChanges),
            shouldPlayPlate: hasSensorChanges(anyObjectResult.sensorChanges),
        };
    }

    const alcoveResult = deps.triggerAlcoveDepositSensor(
        state.level,
        wallX,
        wallY,
        face,
        ss,
        state.championInventories,
        state.championEquipment,
        selectedItem,
    );
    if (alcoveResult.matched && alcoveResult.depositedItem) {
        return {
            matched: true,
            patch: deps.applyImmediateTransportSquareEffects(state, {
                ...alcoveResult.sensorChanges,
                ...(alcoveResult.newInventories ? { championInventories: alcoveResult.newInventories } : {}),
                ...(alcoveResult.newEquipment ? { championEquipment: alcoveResult.newEquipment } : {}),
                floorItems: [...state.floorItems, alcoveResult.depositedItem],
            }),
            shouldPlayPlate: hasSensorChanges(alcoveResult.sensorChanges),
        };
    }

    const exchangerResult = deps.triggerObjectExchangerSensor(
        state.level,
        wallX,
        wallY,
        face,
        ss,
        state.championInventories,
        state.championEquipment,
        selectedItem,
    );
    if (!exchangerResult.matched) {
        return { matched: false, patch: null, shouldPlayPlate: false };
    }

    const replacementCandidate = selectedItem.fromSlot !== 'inventory'
        ? state.championEquipment[selectedItem.championId]?.[selectedItem.fromSlot as EquipSlotKey]
        : state.championInventories[selectedItem.championId]?.find((item) => item.id === selectedItem.itemId);
    const firestaffExchange = deps.applyFirestaffExchangerReward(
        state,
        wallX,
        wallY,
        face,
        replacementCandidate,
        { championId: selectedItem.championId, fromSlot: selectedItem.fromSlot },
        exchangerResult.newInventories,
        exchangerResult.newEquipment,
        state.floorItems,
    );

    return {
        matched: true,
        patch: deps.applyImmediateTransportSquareEffects(state, {
            ...exchangerResult.sensorChanges,
            ...(firestaffExchange.nextInventories ? { championInventories: firestaffExchange.nextInventories } : {}),
            ...(firestaffExchange.nextEquipment ? { championEquipment: firestaffExchange.nextEquipment } : {}),
            ...(firestaffExchange.nextFloorItems !== state.floorItems ? { floorItems: firestaffExchange.nextFloorItems } : {}),
            ...(firestaffExchange.transformed ? {
                lastCastResult: deps.buildAttackResultMessage('Le Firestaff absorbe l energie de l Amalgam.'),
            } : {}),
        }),
        shouldPlayPlate: hasSensorChanges(exchangerResult.sensorChanges),
    };
}

export function tryUseFloorItemOnFrontWall<
    TState extends FrontWallStateLike,
    TSensorState,
    TAppliedPatch extends Record<string, unknown>,
>(
    state: TState,
    itemId: string,
    championId: number,
    deps: FrontWallItemDeps<TState, TSensorState, TAppliedPatch>,
): FrontWallInteractionResult<TAppliedPatch> {
    const item = state.floorItems.find((entry) => entry.id === itemId);
    if (!item || item.mapIndex !== state.level) {
        return { matched: false, patch: null, shouldPlayPlate: false };
    }

    const inventory = state.championInventories[championId] ?? [];
    const temporaryInventories = {
        ...state.championInventories,
        [championId]: [...inventory, item],
    };
    const { wallX, wallY, face } = resolveFrontWallTarget(state.position, state.direction);
    const altarPatch = tryResolveViAltarResurrectionOnFrontWall(
        state,
        wallX,
        wallY,
        item,
        null,
        deps,
    );
    if (altarPatch) {
        return {
            matched: true,
            patch: {
                ...altarPatch,
                activeFloorDrag: state.activeFloorDrag?.itemId === itemId ? null : state.activeFloorDrag,
            },
            shouldPlayPlate: false,
        };
    }
    const ss = deps.buildSensorStateSnapshot(state);
    const selectedItem: SelectedItem = { championId, itemId, fromSlot: 'inventory' };

    const lockResult = deps.triggerLockSensors(
        state.level,
        wallX,
        wallY,
        face,
        ss,
        temporaryInventories,
        state.championEquipment,
        selectedItem,
    );
    if (lockResult.matched) {
        return {
            matched: true,
            patch: deps.applyImmediateTransportSquareEffects(state, {
                ...lockResult.sensorChanges,
                championInventories: lockResult.newInventories ?? temporaryInventories,
                ...(lockResult.newEquipment ? { championEquipment: lockResult.newEquipment } : {}),
                floorItems: state.floorItems.filter((entry) => entry.id !== itemId),
                activeFloorDrag: state.activeFloorDrag?.itemId === itemId ? null : state.activeFloorDrag,
            }),
            shouldPlayPlate: hasSensorChanges(lockResult.sensorChanges),
        };
    }

    const alcoveResult = deps.triggerAlcoveDepositSensor(
        state.level,
        wallX,
        wallY,
        face,
        ss,
        temporaryInventories,
        state.championEquipment,
        selectedItem,
    );
    if (alcoveResult.matched && alcoveResult.depositedItem) {
        return {
            matched: true,
            patch: deps.applyImmediateTransportSquareEffects(state, {
                ...alcoveResult.sensorChanges,
                championInventories: alcoveResult.newInventories ?? temporaryInventories,
                ...(alcoveResult.newEquipment ? { championEquipment: alcoveResult.newEquipment } : {}),
                floorItems: [
                    ...state.floorItems.filter((entry) => entry.id !== itemId),
                    alcoveResult.depositedItem,
                ],
                activeFloorDrag: state.activeFloorDrag?.itemId === itemId ? null : state.activeFloorDrag,
            }),
            shouldPlayPlate: hasSensorChanges(alcoveResult.sensorChanges),
        };
    }

    const exchangerResult = deps.triggerObjectExchangerSensor(
        state.level,
        wallX,
        wallY,
        face,
        ss,
        temporaryInventories,
        state.championEquipment,
        selectedItem,
    );
    if (!exchangerResult.matched) {
        return { matched: false, patch: null, shouldPlayPlate: false };
    }

    const firestaffExchange = deps.applyFirestaffExchangerReward(
        state,
        wallX,
        wallY,
        face,
        item,
        { championId, fromSlot: 'inventory' },
        exchangerResult.newInventories ?? temporaryInventories,
        exchangerResult.newEquipment,
        state.floorItems.filter((entry) => entry.id !== itemId),
    );

    return {
        matched: true,
        patch: deps.applyImmediateTransportSquareEffects(state, {
            ...exchangerResult.sensorChanges,
            championInventories: firestaffExchange.nextInventories ?? temporaryInventories,
            ...(firestaffExchange.nextEquipment ? { championEquipment: firestaffExchange.nextEquipment } : {}),
            floorItems: firestaffExchange.nextFloorItems,
            activeFloorDrag: state.activeFloorDrag?.itemId === itemId ? null : state.activeFloorDrag,
            ...(firestaffExchange.transformed ? {
                lastCastResult: deps.buildAttackResultMessage('Le Firestaff absorbe l energie de l Amalgam.'),
            } : {}),
        }),
        shouldPlayPlate: true,
    };
}
