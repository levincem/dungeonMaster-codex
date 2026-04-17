import type { Champion } from '../../types/champion';
import type {
    CardinalDir,
    ChampionEquipment,
    CreatureCell,
    CreatureInstance,
    FloorItem,
    GameTile,
    SensorObject,
    TeleporterObject,
} from '../../types/game';
import type {
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    Direction,
    PartyShield,
    SpellVisualEvent,
} from '../runtimeTypes';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type TeleporterRuntimeMeta = { rotationType?: number; rotation?: CardinalDir } | null | undefined;
type PitLanding = { level: number; x: number; y: number } | null;
type ProjectileTeleportResult = { level: number; x: number; y: number; direction: Direction };
type CreatureTeleportResult = ProjectileTeleportResult & { cell: CreatureCell };

type TransportRuntimeState<TPendingSensorEvent extends PendingSensorEventLike> = {
    level: number;
    position: [number, number];
    direction: Direction;
    party: Champion[];
    selectedChampionIndex: number;
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    deadChampions: Record<number, Champion>;
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat: Record<number, ChampionCombat>;
    pendingSensorEvents: TPendingSensorEvent[];
    elapsedGameTimeTicks: number;
};

type MovementSensorDepsLike<TSensorState, TPendingSensorEvent extends PendingSensorEventLike> = {
    getTile: (level: number, x: number, y: number) => { objects: unknown[] } | undefined;
    asSensor: (obj: unknown) => SensorObject | null;
    isCreatureOnlyFloorSensor: (sensor: SensorObject) => boolean;
    isGeneratorSensor: (sensor: SensorObject) => boolean;
    isPartyPossessionSensor: (sensor: SensorObject) => boolean;
    isSpecificObjectFloorSensor: (sensor: SensorObject) => boolean;
    getRequiredSensorItemName: (sensor: SensorObject) => string | undefined;
    partyHasRequiredItem: (
        requiredName: string | undefined,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
    ) => boolean;
    tileHasRequiredFloorItem: (
        level: number,
        x: number,
        y: number,
        requiredName: string | undefined,
        floorItems: FloorItem[],
    ) => boolean;
    computeSensorEffect: (sensor: SensorObject, level: number, ss: TSensorState) => Partial<TSensorState>;
    triggerGeneratorSensor: (level: number, sensor: SensorObject, ss: TSensorState) => TSensorState;
    queueOrComputeSensorEffect: (
        sensor: SensorObject,
        level: number,
        ss: TSensorState,
        pendingSensorEvents: TPendingSensorEvent[],
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => { level: number; x: number; y: number } | null;
    playDoorMotion: (target: { level: number; x: number; y: number } | null) => void;
    playPlate: () => void;
    notifyPlateActivated: (level: number, x: number, y: number) => void;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
};

type TransportRuntimeDepsParams<
    TGameState extends TransportRuntimeState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
> = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    isWalkable: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => boolean;
    getOriginalTeleporterRuntime: (
        level: number,
        x: number,
        y: number,
        index: number,
    ) => TeleporterRuntimeMeta;
    getTeleporter: (tile: GameTile) => TeleporterObject | undefined;
    resolvePitLanding: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
        deps: {
            getTile: (level: number, x: number, y: number) => GameTile | undefined;
            isWalkable: TransportRuntimeDepsParams<TGameState, TSensorState, TPendingSensorEvent>['isWalkable'];
        },
    ) => PitLanding;
    resolveProjectileTeleporterTransport: (
        state: Pick<TGameState, 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        direction: Direction,
        deps: {
            getTile: (level: number, x: number, y: number) => GameTile | undefined;
            getOriginalTeleporterRuntime: TransportRuntimeDepsParams<TGameState, TSensorState, TPendingSensorEvent>['getOriginalTeleporterRuntime'];
        },
    ) => ProjectileTeleportResult;
    resolveCreatureTeleporterTransport: (
        state: Pick<TGameState, 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        direction: Direction,
        cell: CreatureCell,
        deps: {
            getTile: (level: number, x: number, y: number) => GameTile | undefined;
            getOriginalTeleporterRuntime: TransportRuntimeDepsParams<TGameState, TSensorState, TPendingSensorEvent>['getOriginalTeleporterRuntime'];
        },
    ) => CreatureTeleportResult;
    applyPartyTelefragAtSquare: (
        state: Pick<TGameState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
        level: number,
        x: number,
        y: number,
        deps: {
            dropCreatureCarriedItems: (
                creatures: CreatureInstance[],
                floorItems: FloorItem[],
                creatureId: string,
            ) => { creatures: CreatureInstance[]; floorItems: FloorItem[] };
            buildDeathDustEvent: (level: number, x: number, y: number) => SpellVisualEvent;
            normalizeCreatureCellsOnTile: (
                creatures: CreatureInstance[],
                level: number,
                x: number,
                y: number,
            ) => CreatureInstance[];
        },
    ) => Pick<TGameState, 'creatures' | 'floorItems' | 'spellVisualEvents'> | null;
    applyCreaturesStandingOnOpenPit: (
        state: Pick<TGameState, 'level' | 'position' | 'creatures' | 'floorItems' | 'damageEvents' | 'spellVisualEvents' | 'openDoors' | 'openWalls' | 'openPits'>,
        level: number,
        x: number,
        y: number,
        deps: {
            resolvePitLanding: (
                level: number,
                y: number,
                x: number,
                openDoors: Set<string>,
                openWalls: Set<string>,
                openPits: Set<string>,
            ) => PitLanding;
            isWalkable: TransportRuntimeDepsParams<TGameState, TSensorState, TPendingSensorEvent>['isWalkable'];
            canCreatureShareTile: (
                creature: CreatureInstance,
                level: number,
                x: number,
                y: number,
                creatures: CreatureInstance[],
            ) => boolean;
            dropCreatureCarriedItems: (
                creatures: CreatureInstance[],
                floorItems: FloorItem[],
                creatureId: string,
            ) => { creatures: CreatureInstance[]; floorItems: FloorItem[] };
            buildDeathDustEvent: (level: number, x: number, y: number) => SpellVisualEvent;
            buildCreatureDamageEvent: (
                level: number,
                x: number,
                y: number,
                amount: number,
                creatureId: string,
            ) => DamageEvent;
            normalizeCreatureCellsOnTile: (
                creatures: CreatureInstance[],
                level: number,
                x: number,
                y: number,
            ) => CreatureInstance[];
        },
    ) => Pick<TGameState, 'creatures' | 'floorItems' | 'damageEvents' | 'spellVisualEvents'> | null;
    applyCreaturesStandingOnOpenTeleporter: (
        state: Pick<TGameState, 'level' | 'position' | 'creatures' | 'openDoors' | 'openWalls' | 'openPits' | 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        deps: {
            getTile: (level: number, x: number, y: number) => GameTile | undefined;
            getTeleporter: (tile: GameTile) => TeleporterObject | undefined;
            resolveCreatureTeleporterTransport: (
                state: Pick<TGameState, 'openTeleporters'>,
                level: number,
                x: number,
                y: number,
                direction: Direction,
                cell: CreatureCell,
            ) => CreatureTeleportResult;
            isWalkable: TransportRuntimeDepsParams<TGameState, TSensorState, TPendingSensorEvent>['isWalkable'];
            canCreatureShareTile: (
                creature: CreatureInstance,
                level: number,
                x: number,
                y: number,
                creatures: CreatureInstance[],
            ) => boolean;
            normalizeCreatureCellsOnTile: (
                creatures: CreatureInstance[],
                level: number,
                x: number,
                y: number,
            ) => CreatureInstance[];
        },
    ) => Pick<TGameState, 'creatures'> | null;
    dropCreatureCarriedItems: (
        creatures: CreatureInstance[],
        floorItems: FloorItem[],
        creatureId: string,
    ) => { creatures: CreatureInstance[]; floorItems: FloorItem[] };
    buildDeathDustEvent: (level: number, x: number, y: number) => SpellVisualEvent;
    buildCreatureDamageEvent: (
        level: number,
        x: number,
        y: number,
        amount: number,
        creatureId: string,
    ) => DamageEvent;
    normalizeCreatureCellsOnTile: (
        creatures: CreatureInstance[],
        level: number,
        x: number,
        y: number,
    ) => CreatureInstance[];
    canCreatureShareTile: (
        creature: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ) => boolean;
    buildSensorStateSnapshot: (state: TGameState) => TSensorState;
    triggerFloorSensors: (
        level: number,
        x: number,
        y: number,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        floorItems: FloorItem[],
        pendingSensorEvents: TPendingSensorEvent[],
        deps: MovementSensorDepsLike<TSensorState, TPendingSensorEvent>,
        mode: 'enter' | 'leave',
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    transitionFloorSensors: (
        level: number,
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
        partySize: number,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        floorItems: FloorItem[],
        pendingSensorEvents: TPendingSensorEvent[],
        deps: MovementSensorDepsLike<TSensorState, TPendingSensorEvent>,
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
        blockedMessage?: string;
    };
    buildMovementSensorDeps: () => MovementSensorDepsLike<TSensorState, TPendingSensorEvent>;
    applyPartyFallImpactDamage: (
        state: Pick<
            TGameState,
            | 'level'
            | 'position'
            | 'party'
            | 'championInventories'
            | 'championEquipment'
            | 'floorItems'
            | 'deadChampions'
            | 'selectedChampionIndex'
            | 'damageEvents'
            | 'activeShields'
            | 'activePotionBoosts'
            | 'championCombat'
        >,
        championVitals: Record<number, ChampionVitals>,
        landingLevel: number,
        landingPosition: [number, number],
    ) => Partial<
        Pick<
            TGameState,
            | 'championVitals'
            | 'damageEvents'
            | 'party'
            | 'floorItems'
            | 'championInventories'
            | 'championEquipment'
            | 'deadChampions'
            | 'selectedChampionIndex'
        >
    > | null;
    applyImmediateTransportSquareEffects: (state: TGameState, basePatch: Partial<TGameState>) => Partial<TGameState>;
    computeMovementCooldown: (state: TGameState) => number;
    playTeleport: () => void;
};

export function createTransportRuntimeDeps<
    TGameState extends TransportRuntimeState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
    params: TransportRuntimeDepsParams<TGameState, TSensorState, TPendingSensorEvent>,
) {
    const buildTerrainTransportDeps = () => ({
        getTile: params.getTile,
        getOriginalTeleporterRuntime: params.getOriginalTeleporterRuntime,
    });

    const buildTerrainEffectsDeps = () => ({
        dropCreatureCarriedItems: params.dropCreatureCarriedItems,
        buildDeathDustEvent: params.buildDeathDustEvent,
        buildCreatureDamageEvent: params.buildCreatureDamageEvent,
        normalizeCreatureCellsOnTile: params.normalizeCreatureCellsOnTile,
        resolvePitLanding: (
            level: number,
            y: number,
            x: number,
            openDoors: Set<string>,
            openWalls: Set<string>,
            openPits: Set<string>,
        ) => params.resolvePitLanding(
            level,
            y,
            x,
            openDoors,
            openWalls,
            openPits,
            { getTile: params.getTile, isWalkable: params.isWalkable },
        ),
        isWalkable: params.isWalkable,
        canCreatureShareTile: params.canCreatureShareTile,
        getTile: params.getTile,
        getTeleporter: params.getTeleporter,
        resolveCreatureTeleporterTransport: (
            state: Pick<TGameState, 'openTeleporters'>,
            level: number,
            x: number,
            y: number,
            direction: Direction,
            cell: CreatureCell,
        ) => params.resolveCreatureTeleporterTransport(
            state,
            level,
            x,
            y,
            direction,
            cell,
            buildTerrainTransportDeps(),
        ),
    });

    const buildOpenedTeleporterEffectsDeps = () => {
        const terrainTransportDeps = buildTerrainTransportDeps();
        const terrainEffectsDeps = buildTerrainEffectsDeps();
        return {
            getTile: params.getTile,
            getTeleporter: params.getTeleporter,
            resolveProjectileTeleporterTransport: (
                state: Pick<TGameState, 'openTeleporters'>,
                level: number,
                x: number,
                y: number,
                direction: Direction,
            ) => params.resolveProjectileTeleporterTransport(
                state,
                level,
                x,
                y,
                direction,
                terrainTransportDeps,
            ),
            applyPartyTelefragAtSquare: (
                state: Pick<TGameState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
                level: number,
                x: number,
                y: number,
            ) => params.applyPartyTelefragAtSquare(state, level, x, y, terrainEffectsDeps),
            applyCreaturesStandingOnOpenTeleporter: (
                state: Pick<TGameState, 'level' | 'position' | 'creatures' | 'openDoors' | 'openWalls' | 'openPits' | 'openTeleporters'>,
                level: number,
                x: number,
                y: number,
            ) => params.applyCreaturesStandingOnOpenTeleporter(state, level, x, y, terrainEffectsDeps),
        };
    };

    const buildOpenedPitEffectsDeps = () => {
        const terrainEffectsDeps = buildTerrainEffectsDeps();
        return {
            resolvePitLanding: (
                level: number,
                y: number,
                x: number,
                openDoors: Set<string>,
                openWalls: Set<string>,
                openPits: Set<string>,
            ) => params.resolvePitLanding(
                level,
                y,
                x,
                openDoors,
                openWalls,
                openPits,
                { getTile: params.getTile, isWalkable: params.isWalkable },
            ),
            applyPartyTelefragAtSquare: (
                state: Pick<TGameState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
                level: number,
                x: number,
                y: number,
            ) => params.applyPartyTelefragAtSquare(state, level, x, y, terrainEffectsDeps),
            applyPartyFallImpactDamage: params.applyPartyFallImpactDamage,
            applyCreaturesStandingOnOpenPit: (
                state: Pick<TGameState, 'level' | 'position' | 'creatures' | 'floorItems' | 'damageEvents' | 'spellVisualEvents' | 'openDoors' | 'openWalls' | 'openPits'>,
                level: number,
                x: number,
                y: number,
            ) => params.applyCreaturesStandingOnOpenPit(state, level, x, y, terrainEffectsDeps),
        };
    };

    const buildPitEntryTransportDeps = () => {
        const movementSensorDeps = params.buildMovementSensorDeps();
        const terrainEffectsDeps = buildTerrainEffectsDeps();
        return {
            resolvePitLanding: (
                level: number,
                y: number,
                x: number,
                openDoors: Set<string>,
                openWalls: Set<string>,
                openPits: Set<string>,
            ) => params.resolvePitLanding(
                level,
                y,
                x,
                openDoors,
                openWalls,
                openPits,
                { getTile: params.getTile, isWalkable: params.isWalkable },
            ),
            buildSensorStateSnapshot: params.buildSensorStateSnapshot,
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
            ) => params.triggerFloorSensors(
                level,
                x,
                y,
                ss,
                inventories,
                equipment,
                floorItems,
                pendingSensorEvents,
                movementSensorDeps,
                mode,
            ),
            applyPartyTelefragAtSquare: (
                state: Pick<TGameState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
                level: number,
                x: number,
                y: number,
            ) => params.applyPartyTelefragAtSquare(state, level, x, y, terrainEffectsDeps),
            applyPartyFallImpactDamage: params.applyPartyFallImpactDamage,
            applyImmediateTransportSquareEffects: params.applyImmediateTransportSquareEffects,
            computeMovementCooldown: params.computeMovementCooldown,
        };
    };

    const buildTeleporterStepTransportDeps = () => {
        const movementSensorDeps = params.buildMovementSensorDeps();
        const terrainTransportDeps = buildTerrainTransportDeps();
        const terrainEffectsDeps = buildTerrainEffectsDeps();
        return {
            resolveProjectileTeleporterTransport: (
                state: Pick<TGameState, 'openTeleporters'>,
                level: number,
                x: number,
                y: number,
                direction: Direction,
            ) => params.resolveProjectileTeleporterTransport(
                state,
                level,
                x,
                y,
                direction,
                terrainTransportDeps,
            ),
            buildSensorStateSnapshot: params.buildSensorStateSnapshot,
            transitionFloorSensors: (
                level: number,
                fromX: number,
                fromY: number,
                toX: number,
                toY: number,
                partySize: number,
                ss: TSensorState,
                inventories: Record<number, FloorItem[]>,
                equipment: Record<number, ChampionEquipment>,
                floorItems: FloorItem[],
                pendingSensorEvents: TPendingSensorEvent[],
            ) => params.transitionFloorSensors(
                level,
                fromX,
                fromY,
                toX,
                toY,
                partySize,
                ss,
                inventories,
                equipment,
                floorItems,
                pendingSensorEvents,
                movementSensorDeps,
            ),
            applyPartyTelefragAtSquare: (
                state: Pick<TGameState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
                level: number,
                x: number,
                y: number,
            ) => params.applyPartyTelefragAtSquare(state, level, x, y, terrainEffectsDeps),
            applyImmediateTransportSquareEffects: params.applyImmediateTransportSquareEffects,
            computeMovementCooldown: params.computeMovementCooldown,
            playTeleport: params.playTeleport,
        };
    };

    const buildStairStepTransportDeps = () => ({
        computeMovementCooldown: params.computeMovementCooldown,
    });

    const buildStandardStepTransportDeps = () => {
        const movementSensorDeps = params.buildMovementSensorDeps();
        return {
            buildSensorStateSnapshot: params.buildSensorStateSnapshot,
            transitionFloorSensors: (
                level: number,
                fromX: number,
                fromY: number,
                toX: number,
                toY: number,
                partySize: number,
                ss: TSensorState,
                inventories: Record<number, FloorItem[]>,
                equipment: Record<number, ChampionEquipment>,
                floorItems: FloorItem[],
                pendingSensorEvents: TPendingSensorEvent[],
            ) => params.transitionFloorSensors(
                level,
                fromX,
                fromY,
                toX,
                toY,
                partySize,
                ss,
                inventories,
                equipment,
                floorItems,
                pendingSensorEvents,
                movementSensorDeps,
            ),
            applyImmediateTransportSquareEffects: params.applyImmediateTransportSquareEffects,
            computeMovementCooldown: params.computeMovementCooldown,
            now: Date.now,
        };
    };

    return {
        buildTerrainTransportDeps,
        buildTerrainEffectsDeps,
        buildOpenedTeleporterEffectsDeps,
        buildOpenedPitEffectsDeps,
        buildPitEntryTransportDeps,
        buildTeleporterStepTransportDeps,
        buildStairStepTransportDeps,
        buildStandardStepTransportDeps,
    };
}

export function createStoreTransportRuntimeDepsBundle<
    TGameState extends TransportRuntimeState<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent extends PendingSensorEventLike,
>(
    params: TransportRuntimeDepsParams<TGameState, TSensorState, TPendingSensorEvent>,
) {
    const buildTransportRuntimeDeps = () => createTransportRuntimeDeps(params);

    return {
        buildTransportRuntimeDeps,
        buildTerrainTransportDeps: () => buildTransportRuntimeDeps().buildTerrainTransportDeps(),
        buildOpenedTeleporterEffectsDeps: () => buildTransportRuntimeDeps().buildOpenedTeleporterEffectsDeps(),
        buildOpenedPitEffectsDeps: () => buildTransportRuntimeDeps().buildOpenedPitEffectsDeps(),
        buildPitEntryTransportDeps: () => buildTransportRuntimeDeps().buildPitEntryTransportDeps(),
        buildTeleporterStepTransportDeps: () => buildTransportRuntimeDeps().buildTeleporterStepTransportDeps(),
        buildStairStepTransportDeps: () => buildTransportRuntimeDeps().buildStairStepTransportDeps(),
        buildStandardStepTransportDeps: () => buildTransportRuntimeDeps().buildStandardStepTransportDeps(),
    };
}
