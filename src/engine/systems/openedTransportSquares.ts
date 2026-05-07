import type { CreatureInstance, FloorItem, GameTile } from '../../types/game';
import type { Direction, SpellVisualEvent } from '../runtimeTypes';

type TeleporterLoopState = {
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
    championEquipment: Record<number, import('../../types/game').ChampionEquipment>;
    pendingSensorEvents: Array<{ level: number; sensorIndex: number; remaining: number }>;
};

type TeleporterLoopDeps = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    getTeleporter: (tile: GameTile) => { destMap: number; destX: number; destY: number } | undefined;
    resolveProjectileTeleporterTransport: (
        state: Pick<TeleporterLoopState, 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        direction: Direction,
        transportKind?: 'item' | 'party',
    ) => { level: number; x: number; y: number; direction: Direction };
    applyPartyTelefragAtSquare: (
        state: Pick<TeleporterLoopState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
        level: number,
        x: number,
        y: number,
    ) => Pick<TeleporterLoopState, 'creatures' | 'floorItems' | 'spellVisualEvents'> | null;
    buildLevelHydrationPatch: (
        state: Pick<TeleporterLoopState, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'>,
        level: number,
    ) => Partial<Pick<TeleporterLoopState, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'>> | null;
    applyCreaturesStandingOnOpenTeleporter: (
        state: Pick<TeleporterLoopState, 'level' | 'position' | 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors' | 'openWalls' | 'openPits' | 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
    ) => Pick<TeleporterLoopState, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'> | null;
    triggerFloorSensorsOnOpenedPartyTeleporter?: (
        state: Pick<
            TeleporterLoopState,
            | 'level'
            | 'position'
            | 'direction'
            | 'openDoors'
            | 'openWalls'
            | 'openPits'
            | 'openTeleporters'
            | 'championInventories'
            | 'championEquipment'
            | 'floorItems'
            | 'pendingSensorEvents'
        >,
        level: number,
        x: number,
        y: number,
    ) => Pick<TeleporterLoopState, 'openDoors' | 'openWalls' | 'openPits' | 'openTeleporters' | 'pendingSensorEvents'> | null;
};

type TeleporterLoopResult = Pick<
    TeleporterLoopState,
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

export function applyOpenedTeleporterEffects(
    state: TeleporterLoopState,
    openedTeleporterKeys: string[],
    deps: TeleporterLoopDeps,
): TeleporterLoopResult {
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
    const pendingTeleporterKeys = [...openedTeleporterKeys];
    const queuedTeleporterKeys = new Set(openedTeleporterKeys);
    const processedTeleporterKeys = new Set<string>();

    const queueNewTeleporterKeys = (nextOpenTeleporters: Set<string> | undefined) => {
        if (!nextOpenTeleporters) return;
        for (const nextKey of nextOpenTeleporters) {
            if (openTeleporters.has(nextKey) || queuedTeleporterKeys.has(nextKey) || processedTeleporterKeys.has(nextKey)) {
                continue;
            }
            queuedTeleporterKeys.add(nextKey);
            pendingTeleporterKeys.push(nextKey);
        }
    };

    while (pendingTeleporterKeys.length > 0) {
        const key = pendingTeleporterKeys.shift();
        if (!key || processedTeleporterKeys.has(key)) continue;
        processedTeleporterKeys.add(key);

        const [tpLevelRaw, tpYRaw, tpXRaw] = key.split(',');
        const tpLevel = Number(tpLevelRaw);
        const tpY = Number(tpYRaw);
        const tpX = Number(tpXRaw);
        if (!Number.isFinite(tpLevel) || !Number.isFinite(tpY) || !Number.isFinite(tpX)) continue;

        const tile = deps.getTile(tpLevel, tpX, tpY);
        const teleporter = tile?.type === 'Teleporter' ? deps.getTeleporter(tile) : null;
        if (!teleporter) continue;

        if (level === tpLevel && position[0] === tpY && position[1] === tpX) {
            const sensorPatch = deps.triggerFloorSensorsOnOpenedPartyTeleporter?.(
                {
                    level,
                    position,
                    direction,
                    openDoors,
                    openWalls,
                    openPits,
                    openTeleporters,
                    championInventories: state.championInventories,
                    championEquipment: state.championEquipment,
                    floorItems,
                    pendingSensorEvents,
                },
                tpLevel,
                tpX,
                tpY,
            );
            if (sensorPatch) {
                queueNewTeleporterKeys(sensorPatch.openTeleporters);
                openDoors = sensorPatch.openDoors ?? openDoors;
                openWalls = sensorPatch.openWalls ?? openWalls;
                openPits = sensorPatch.openPits ?? openPits;
                openTeleporters = sensorPatch.openTeleporters ?? openTeleporters;
                pendingSensorEvents = sensorPatch.pendingSensorEvents ?? pendingSensorEvents;
                changed = true;
            }

            const resolvedTransport = deps.resolveProjectileTeleporterTransport(
                { openTeleporters },
                tpLevel,
                tpX,
                tpY,
                direction,
                'party',
            );
            direction = resolvedTransport.direction;
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
            changed = true;

            const arrivalSensorPatch = deps.triggerFloorSensorsOnOpenedPartyTeleporter?.(
                {
                    level,
                    position,
                    direction,
                    openDoors,
                    openWalls,
                    openPits,
                    openTeleporters,
                    championInventories: state.championInventories,
                    championEquipment: state.championEquipment,
                    floorItems,
                    pendingSensorEvents,
                },
                level,
                resolvedTransport.x,
                resolvedTransport.y,
            );
            if (arrivalSensorPatch) {
                queueNewTeleporterKeys(arrivalSensorPatch.openTeleporters);
                openDoors = arrivalSensorPatch.openDoors ?? openDoors;
                openWalls = arrivalSensorPatch.openWalls ?? openWalls;
                openPits = arrivalSensorPatch.openPits ?? openPits;
                openTeleporters = arrivalSensorPatch.openTeleporters ?? openTeleporters;
                pendingSensorEvents = arrivalSensorPatch.pendingSensorEvents ?? pendingSensorEvents;
                changed = true;
            }
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
