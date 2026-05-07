import type { ChampionEquipment, CreatureInstance, FloorItem, GameTile } from '../../types/game';
import type { Direction, SpellVisualEvent } from '../runtimeTypes';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type TeleporterLoopState<TPendingSensorEvent extends PendingSensorEventLike = PendingSensorEventLike> = {
    level: number;
    position: [number, number];
    direction: Direction;
    hydratedLevels: Set<number>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    spellVisualEvents: SpellVisualEvent[];
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    pendingSensorEvents: TPendingSensorEvent[];
};

type SensorTransitionChanges<TPendingSensorEvent extends PendingSensorEventLike> = {
    sensorChanges: Partial<Pick<
        TeleporterLoopState<TPendingSensorEvent>,
        'openDoors' | 'openWalls' | 'openPits' | 'openTeleporters'
    >>;
    pendingSensorEvents: TPendingSensorEvent[];
};

type TeleporterLoopDeps<TSensorState, TPendingSensorEvent extends PendingSensorEventLike> = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    getTeleporter: (tile: GameTile) => { destMap: number; destX: number; destY: number } | undefined;
    resolveProjectileTeleporterTransport: (
        state: Pick<TeleporterLoopState<TPendingSensorEvent>, 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        direction: Direction,
        transportKind?: 'item' | 'party',
    ) => { level: number; x: number; y: number; direction: Direction };
    applyPartyTelefragAtSquare: (
        state: Pick<TeleporterLoopState<TPendingSensorEvent>, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
        level: number,
        x: number,
        y: number,
    ) => Pick<TeleporterLoopState<TPendingSensorEvent>, 'creatures' | 'floorItems' | 'spellVisualEvents'> | null;
    buildLevelHydrationPatch: (
        state: Pick<TeleporterLoopState<TPendingSensorEvent>, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'>,
        level: number,
    ) => Partial<Pick<TeleporterLoopState<TPendingSensorEvent>, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'>> | null;
    applyCreaturesStandingOnOpenTeleporter: (
        state: Pick<TeleporterLoopState<TPendingSensorEvent>, 'level' | 'position' | 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors' | 'openWalls' | 'openPits' | 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
    ) => Pick<TeleporterLoopState<TPendingSensorEvent>, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'> | null;
    buildSensorStateSnapshot: (
        state: Pick<
            TeleporterLoopState<TPendingSensorEvent>,
            | 'level'
            | 'position'
            | 'direction'
            | 'openDoors'
            | 'openWalls'
            | 'openPits'
            | 'openTeleporters'
        >,
    ) => TSensorState;
    triggerFloorSensors: (
        level: number,
        x: number,
        y: number,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        floorItems: FloorItem[],
        pendingSensorEvents: TPendingSensorEvent[],
        mode: 'enter' | 'leave',
    ) => SensorTransitionChanges<TPendingSensorEvent>;
};

type TeleporterLoopResult<TPendingSensorEvent extends PendingSensorEventLike> = Pick<
    TeleporterLoopState<TPendingSensorEvent>,
    | 'level'
    | 'position'
    | 'direction'
    | 'hydratedLevels'
    | 'creatures'
    | 'floorItems'
    | 'spellVisualEvents'
    | 'openDoors'
    | 'openWalls'
    | 'openPits'
    | 'openTeleporters'
    | 'pendingSensorEvents'
> & { changed: boolean };

export function applyOpenedTeleporterEffects<
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
    state: TeleporterLoopState<TPendingSensorEvent>,
    openedTeleporterKeys: string[],
    deps: TeleporterLoopDeps<TSensorState, TPendingSensorEvent>,
): TeleporterLoopResult<TPendingSensorEvent> {
    let level = state.level;
    let position = state.position;
    let direction = state.direction;
    let hydratedLevels = state.hydratedLevels;
    let creatures = state.creatures;
    let floorItems = state.floorItems;
    let spellVisualEvents = state.spellVisualEvents;
    let openDoors = state.openDoors;
    let openWalls = state.openWalls;
    let openPits = state.openPits;
    let openTeleporters = state.openTeleporters;
    let pendingSensorEvents = state.pendingSensorEvents;
    let changed = false;

    const applySensorTransition = (
        sensorResult: SensorTransitionChanges<TPendingSensorEvent>,
    ) => {
        const pendingChanged = sensorResult.pendingSensorEvents !== pendingSensorEvents;
        openDoors = sensorResult.sensorChanges.openDoors ?? openDoors;
        openWalls = sensorResult.sensorChanges.openWalls ?? openWalls;
        openPits = sensorResult.sensorChanges.openPits ?? openPits;
        openTeleporters = sensorResult.sensorChanges.openTeleporters ?? openTeleporters;
        if (pendingChanged) {
            pendingSensorEvents = sensorResult.pendingSensorEvents;
        }
        if (
            Object.keys(sensorResult.sensorChanges).length > 0 ||
            pendingChanged
        ) {
            changed = true;
        }
    };

    for (const key of openedTeleporterKeys) {
        const [tpLevelRaw, tpYRaw, tpXRaw] = key.split(',');
        const tpLevel = Number(tpLevelRaw);
        const tpY = Number(tpYRaw);
        const tpX = Number(tpXRaw);
        if (!Number.isFinite(tpLevel) || !Number.isFinite(tpY) || !Number.isFinite(tpX)) continue;

        const tile = deps.getTile(tpLevel, tpX, tpY);
        const teleporter = tile?.type === 'Teleporter' ? deps.getTeleporter(tile) : null;
        if (!teleporter) continue;

        if (level === tpLevel && position[0] === tpY && position[1] === tpX) {
            const sourceLevel = level;
            const sourcePosition = position;
            const sourceDirection = direction;
            const resolvedTransport = deps.resolveProjectileTeleporterTransport(
                { openTeleporters },
                tpLevel,
                tpX,
                tpY,
                direction,
                'party',
            );

            const hydrationPatch = deps.buildLevelHydrationPatch(
                {
                    hydratedLevels,
                    creatures,
                    floorItems,
                    openDoors,
                },
                resolvedTransport.level,
            );
            if (hydrationPatch) {
                hydratedLevels = hydrationPatch.hydratedLevels ?? hydratedLevels;
                creatures = hydrationPatch.creatures ?? creatures;
                floorItems = hydrationPatch.floorItems ?? floorItems;
                openDoors = hydrationPatch.openDoors ?? openDoors;
            }

            const sourceSensorState = deps.buildSensorStateSnapshot({
                level: sourceLevel,
                position: sourcePosition,
                direction: sourceDirection,
                openDoors,
                openWalls,
                openPits,
                openTeleporters,
            });
            applySensorTransition(
                deps.triggerFloorSensors(
                    sourceLevel,
                    sourcePosition[1],
                    sourcePosition[0],
                    sourceSensorState,
                    state.championInventories,
                    state.championEquipment,
                    floorItems,
                    pendingSensorEvents,
                    'leave',
                ),
            );

            const destinationChanged =
                resolvedTransport.level !== sourceLevel ||
                resolvedTransport.x !== sourcePosition[1] ||
                resolvedTransport.y !== sourcePosition[0] ||
                resolvedTransport.direction !== sourceDirection;

            if (destinationChanged) {
                const destinationSensorState = deps.buildSensorStateSnapshot({
                    level: resolvedTransport.level,
                    position: [resolvedTransport.y, resolvedTransport.x],
                    direction: resolvedTransport.direction,
                    openDoors,
                    openWalls,
                    openPits,
                    openTeleporters,
                });
                applySensorTransition(
                    deps.triggerFloorSensors(
                        resolvedTransport.level,
                        resolvedTransport.x,
                        resolvedTransport.y,
                        destinationSensorState,
                        state.championInventories,
                        state.championEquipment,
                        floorItems,
                        pendingSensorEvents,
                        'enter',
                    ),
                );
            }

            const telefrag = deps.applyPartyTelefragAtSquare(
                { creatures, floorItems, spellVisualEvents },
                resolvedTransport.level,
                resolvedTransport.x,
                resolvedTransport.y,
            );
            if (telefrag) {
                creatures = telefrag.creatures ?? creatures;
                floorItems = telefrag.floorItems ?? floorItems;
                spellVisualEvents = telefrag.spellVisualEvents ?? spellVisualEvents;
            }

            level = resolvedTransport.level;
            position = [resolvedTransport.y, resolvedTransport.x];
            direction = resolvedTransport.direction;
            changed = true;
        }

        const creatureTeleportPatch = deps.applyCreaturesStandingOnOpenTeleporter(
            {
                level,
                position,
                hydratedLevels,
                creatures,
                floorItems,
                openDoors,
                openWalls,
                openPits,
                openTeleporters,
            },
            tpLevel,
            tpX,
            tpY,
        );
        if (creatureTeleportPatch) {
            hydratedLevels = creatureTeleportPatch.hydratedLevels ?? hydratedLevels;
            creatures = creatureTeleportPatch.creatures ?? creatures;
            floorItems = creatureTeleportPatch.floorItems ?? floorItems;
            openDoors = creatureTeleportPatch.openDoors ?? openDoors;
            changed = true;
        }
    }

    return {
        level,
        position,
        direction,
        hydratedLevels,
        creatures,
        floorItems,
        spellVisualEvents,
        openDoors,
        openWalls,
        openPits,
        openTeleporters,
        pendingSensorEvents,
        changed,
    };
}
