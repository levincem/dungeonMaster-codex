import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';

type PendingSensorChangeResult<TPatch, TPendingSensorEvent> = {
    sensorChanges: TPatch;
    pendingSensorEvents: TPendingSensorEvent[];
};

type FloorItemPitState<TPendingSensorEvent> = {
    hydratedLevels: Set<number>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    pendingSensorEvents: TPendingSensorEvent[];
};

type FloorItemPitDeps<
    TState extends FloorItemPitState<TPendingSensorEvent>,
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
    resolvePitLanding: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => { level: number; x: number; y: number } | null;
    buildLevelHydrationPatch: (
        state: Pick<TState, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'>,
        level: number,
    ) => TPatch | null;
};

function hasItemPositionChanged(previous: FloorItem | undefined, current: FloorItem): boolean {
    return !previous
        || previous.mapIndex !== current.mapIndex
        || previous.x !== current.x
        || previous.y !== current.y;
}

export function applyFloorItemPitEffects<
    TState extends FloorItemPitState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent,
    TPatch extends Partial<TState>,
>(
    state: TState,
    basePatch: TPatch,
    deps: FloorItemPitDeps<TState, TSensorState, TPendingSensorEvent, TPatch>,
): TPatch {
    const nextFloorItems = basePatch.floorItems ?? state.floorItems;
    const nextOpenPits = basePatch.openPits ?? state.openPits;
    const floorItemsChanged = nextFloorItems !== state.floorItems;
    const openedPitKeys = [...nextOpenPits].filter((key) => !state.openPits.has(key));
    if (!floorItemsChanged && openedPitKeys.length === 0) return basePatch;

    const previousItemsById = new Map(state.floorItems.map((item) => [item.id, item]));
    const queuedItemIds: string[] = [];
    const queuedItemIdSet = new Set<string>();
    const seenOpenedPitKeys = new Set<string>();

    const queueItemId = (itemId: string) => {
        if (queuedItemIdSet.has(itemId)) return;
        queuedItemIdSet.add(itemId);
        queuedItemIds.push(itemId);
    };

    const queueItemsOnNewlyOpenedPits = (floorItems: FloorItem[], openPits: Set<string>) => {
        for (const key of openPits) {
            if (state.openPits.has(key) || seenOpenedPitKeys.has(key)) continue;
            seenOpenedPitKeys.add(key);
            for (const item of floorItems) {
                if (`${item.mapIndex},${item.y},${item.x}` === key) {
                    queueItemId(item.id);
                }
            }
        }
    };

    for (const item of nextFloorItems) {
        if (hasItemPositionChanged(previousItemsById.get(item.id), item)) {
            queueItemId(item.id);
        }
    }

    queueItemsOnNewlyOpenedPits(nextFloorItems, nextOpenPits);

    if (queuedItemIds.length === 0) return basePatch;

    let currentPatch = {
        ...basePatch,
        floorItems: nextFloorItems,
        openPits: nextOpenPits,
    } as TPatch;

    while (queuedItemIds.length > 0) {
        const itemId = queuedItemIds.shift();
        if (!itemId) continue;

        const currentFloorItems = currentPatch.floorItems ?? nextFloorItems;
        const currentOpenPits = currentPatch.openPits ?? nextOpenPits;
        const currentOpenDoors = currentPatch.openDoors ?? state.openDoors;
        const currentOpenWalls = currentPatch.openWalls ?? state.openWalls;
        const currentCreatures = currentPatch.creatures ?? state.creatures;
        const currentHydratedLevels = currentPatch.hydratedLevels ?? state.hydratedLevels;
        const currentPendingSensorEvents = currentPatch.pendingSensorEvents ?? state.pendingSensorEvents;
        const currentChampionInventories = currentPatch.championInventories ?? state.championInventories;
        const currentChampionEquipment = currentPatch.championEquipment ?? state.championEquipment;

        queueItemsOnNewlyOpenedPits(currentFloorItems, currentOpenPits);

        const item = currentFloorItems.find((entry) => entry.id === itemId);
        if (!item) continue;

        if (!currentOpenPits.has(`${item.mapIndex},${item.y},${item.x}`)) continue;

        const landing = deps.resolvePitLanding(
            item.mapIndex,
            item.y,
            item.x,
            currentOpenDoors,
            currentOpenWalls,
            currentOpenPits,
        );
        if (!landing) continue;

        const hydrationPatch = deps.buildLevelHydrationPatch(
            {
                hydratedLevels: currentHydratedLevels,
                creatures: currentCreatures,
                floorItems: currentFloorItems,
                openDoors: currentOpenDoors,
            } as Pick<TState, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'>,
            landing.level,
        );

        const hydratedLevels = hydrationPatch?.hydratedLevels ?? currentHydratedLevels;
        const hydratedCreatures = hydrationPatch?.creatures ?? currentCreatures;
        const hydratedFloorItems = hydrationPatch?.floorItems ?? currentFloorItems;
        const hydratedOpenDoors = hydrationPatch?.openDoors ?? currentOpenDoors;
        const sourceItem = hydratedFloorItems.find((entry) => entry.id === itemId);
        if (!sourceItem) continue;

        const withoutSourceItem = hydratedFloorItems.filter((entry) => entry.id !== itemId);
        const leaveState = deps.buildSensorStateSnapshot({
            ...state,
            ...currentPatch,
            ...(hydrationPatch ?? {}),
            creatures: hydratedCreatures,
            floorItems: hydratedFloorItems,
            hydratedLevels,
            openDoors: hydratedOpenDoors,
            openPits: currentOpenPits,
            pendingSensorEvents: currentPendingSensorEvents,
        } as TState);
        const leave = deps.triggerFloorSensors(
            sourceItem.mapIndex,
            sourceItem.x,
            sourceItem.y,
            leaveState,
            currentChampionInventories,
            currentChampionEquipment,
            withoutSourceItem,
            currentPendingSensorEvents,
            'item',
            'leave',
        );

        const fallenItem: FloorItem = {
            ...sourceItem,
            mapIndex: landing.level,
            x: landing.x,
            y: landing.y,
            tilePos: 'North',
        };
        const landedFloorItems = [...withoutSourceItem, fallenItem];
        const leaveOpenDoors = leave.sensorChanges.openDoors ?? hydratedOpenDoors;
        const leaveOpenPits = leave.sensorChanges.openPits ?? currentOpenPits;
        const enterState = deps.buildSensorStateSnapshot({
            ...state,
            ...currentPatch,
            ...(hydrationPatch ?? {}),
            ...leave.sensorChanges,
            creatures: hydratedCreatures,
            floorItems: landedFloorItems,
            hydratedLevels,
            openDoors: leaveOpenDoors,
            openPits: leaveOpenPits,
            pendingSensorEvents: leave.pendingSensorEvents,
        } as TState);
        const enter = deps.triggerFloorSensors(
            fallenItem.mapIndex,
            fallenItem.x,
            fallenItem.y,
            enterState,
            currentChampionInventories,
            currentChampionEquipment,
            landedFloorItems,
            leave.pendingSensorEvents,
            'item',
            'enter',
        );

        currentPatch = {
            ...currentPatch,
            ...(hydrationPatch ?? {}),
            ...leave.sensorChanges,
            ...enter.sensorChanges,
            creatures: hydratedCreatures,
            floorItems: landedFloorItems,
            hydratedLevels,
            openDoors: enter.sensorChanges.openDoors ?? leaveOpenDoors,
            openPits: enter.sensorChanges.openPits ?? leaveOpenPits,
            pendingSensorEvents: enter.pendingSensorEvents,
        } as TPatch;
    }

    return currentPatch;
}
