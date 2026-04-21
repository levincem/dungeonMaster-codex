import type { ChampionEquipment, FloorItem } from '../../types/game';

type PendingSensorChangeResult<TPatch, TPendingSensorEvent> = {
    sensorChanges: TPatch;
    pendingSensorEvents: TPendingSensorEvent[];
};

type FloorItemTeleporterState<TPendingSensorEvent> = {
    floorItems: FloorItem[];
    openTeleporters: Set<string>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    pendingSensorEvents: TPendingSensorEvent[];
};

type FloorItemTeleporterDeps<
    TState extends FloorItemTeleporterState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent,
    TPatch extends Partial<TState>,
> = {
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    triggerFloorSensors: (
        level: number,
        x: number,
        y: number,
        sensorState: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        floorItems: FloorItem[],
        pendingSensorEvents: TPendingSensorEvent[],
        source: 'party' | 'item',
        mode: 'enter' | 'leave',
    ) => PendingSensorChangeResult<TPatch, TPendingSensorEvent>;
    resolveProjectileTeleporterTransport: (
        state: Pick<TState, 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST',
        transportKind?: 'item' | 'party',
    ) => { level: number; x: number; y: number; direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST' };
};

function hasItemPositionChanged(previous: FloorItem | undefined, current: FloorItem): boolean {
    return !previous
        || previous.mapIndex !== current.mapIndex
        || previous.x !== current.x
        || previous.y !== current.y;
}

export function applyFloorItemTeleporterEffects<
    TState extends FloorItemTeleporterState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent,
    TPatch extends Partial<TState>,
>(
    state: TState,
    basePatch: TPatch,
    deps: FloorItemTeleporterDeps<TState, TSensorState, TPendingSensorEvent, TPatch>,
): TPatch {
    const nextOpenTeleporters = basePatch.openTeleporters ?? state.openTeleporters;
    const nextFloorItems = basePatch.floorItems ?? state.floorItems;
    const floorItemsChanged = nextFloorItems !== state.floorItems;
    const previousItemsById = new Map(state.floorItems.map((item) => [item.id, item]));
    const openedTeleporterKeys = [...nextOpenTeleporters].filter((key) => !state.openTeleporters.has(key));
    if (!floorItemsChanged && openedTeleporterKeys.length === 0) return basePatch;

    const candidateIds = new Set<string>();

    for (const item of nextFloorItems) {
        if (hasItemPositionChanged(previousItemsById.get(item.id), item)) {
            candidateIds.add(item.id);
        }
    }

    if (openedTeleporterKeys.length > 0) {
        const openedTeleporterKeySet = new Set(openedTeleporterKeys);
        for (const item of nextFloorItems) {
            if (openedTeleporterKeySet.has(`${item.mapIndex},${item.y},${item.x}`)) {
                candidateIds.add(item.id);
            }
        }
    }

    if (candidateIds.size === 0) return basePatch;

    let currentPatch = {
        ...basePatch,
        openTeleporters: nextOpenTeleporters,
        floorItems: nextFloorItems,
    } as TPatch;
    let currentFloorItems = nextFloorItems;
    let currentPendingSensorEvents = currentPatch.pendingSensorEvents ?? state.pendingSensorEvents;

    for (const itemId of candidateIds) {
        const item = currentFloorItems.find((entry) => entry.id === itemId);
        if (!item) continue;

        const resolvedTransport = deps.resolveProjectileTeleporterTransport(
            { openTeleporters: nextOpenTeleporters } as Pick<TState, 'openTeleporters'>,
            item.mapIndex,
            item.x,
            item.y,
            'NORTH',
            'item',
        );
        if (
            resolvedTransport.level === item.mapIndex
            && resolvedTransport.x === item.x
            && resolvedTransport.y === item.y
        ) {
            continue;
        }

        const withoutSourceItem = currentFloorItems.filter((entry) => entry.id !== item.id);
        const leaveState = deps.buildSensorStateSnapshot({
            ...state,
            ...currentPatch,
            floorItems: currentFloorItems,
            openTeleporters: nextOpenTeleporters,
            pendingSensorEvents: currentPendingSensorEvents,
        } as TState);
        const leave = deps.triggerFloorSensors(
            item.mapIndex,
            item.x,
            item.y,
            leaveState,
            currentPatch.championInventories ?? state.championInventories,
            currentPatch.championEquipment ?? state.championEquipment,
            withoutSourceItem,
            currentPendingSensorEvents,
            'item',
            'leave',
        );

        const teleportedItem: FloorItem = {
            ...item,
            mapIndex: resolvedTransport.level,
            x: resolvedTransport.x,
            y: resolvedTransport.y,
            tilePos: 'North',
        };
        const nextTeleportedFloorItems = [...withoutSourceItem, teleportedItem];
        const enterState = deps.buildSensorStateSnapshot({
            ...state,
            ...currentPatch,
            ...leave.sensorChanges,
            floorItems: nextTeleportedFloorItems,
            openTeleporters: nextOpenTeleporters,
            pendingSensorEvents: leave.pendingSensorEvents,
        } as TState);
        const enter = deps.triggerFloorSensors(
            teleportedItem.mapIndex,
            teleportedItem.x,
            teleportedItem.y,
            enterState,
            currentPatch.championInventories ?? state.championInventories,
            currentPatch.championEquipment ?? state.championEquipment,
            nextTeleportedFloorItems,
            leave.pendingSensorEvents,
            'item',
            'enter',
        );

        currentFloorItems = nextTeleportedFloorItems;
        currentPendingSensorEvents = enter.pendingSensorEvents;
        currentPatch = {
            ...currentPatch,
            ...leave.sensorChanges,
            ...enter.sensorChanges,
            floorItems: currentFloorItems,
            pendingSensorEvents: currentPendingSensorEvents,
        } as TPatch;
    }

    return currentPatch;
}
