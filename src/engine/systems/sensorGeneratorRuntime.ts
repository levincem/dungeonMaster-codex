import type { GameTile, SensorObject } from '../../types/game';

type CreaturePositionLike = {
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
};

type PendingGeneratorSpawnEventLike = {
    sensorLevel: number;
    sensorIndex: number;
    spawnLevel: number;
    spawnX: number;
    spawnY: number;
    typeId: number;
    hpMultiplier: number;
    creatureCount: number;
    groupId: string;
};

type SensorGeneratorStateLike<TCreature extends CreaturePositionLike, TPendingGeneratorSpawn> = {
    sensorRuntimeData: Record<string, number>;
    creatures: TCreature[];
    pendingGeneratorSpawns: TPendingGeneratorSpawn[];
    currentLevel: number;
    currentPosition: [number, number];
    elapsedGameTimeTicks: number;
};

type GeneratorConfigLike = {
    spawnX: number;
    spawnY: number;
    typeId: number;
    hpMultiplier: number;
    countRaw: number;
    randomized: boolean;
    ticks: number;
};

type TriggerGeneratorSensorDeps<
    TState extends SensorGeneratorStateLike<TCreature, TPendingGeneratorSpawn>,
    TCreature extends CreaturePositionLike,
    TPendingGeneratorSpawn extends PendingGeneratorSpawnEventLike,
> = {
    getGeneratorConfig: (level: number, sensorIndex: number) => GeneratorConfigLike | null;
    getSpawnTile: (level: number, x: number, y: number) => GameTile | undefined;
    getSensorStateKey: (level: number, sensorIndex: number) => string;
    randomInt: (maxExclusive: number) => number;
    canReserveGeneratorGroup: (state: TState, level: number) => boolean;
    queuePendingGeneratorSpawnEvent: (
        pendingGeneratorSpawns: TPendingGeneratorSpawn[],
        event: Omit<TPendingGeneratorSpawn, 'remaining'>,
        remaining: number,
    ) => TPendingGeneratorSpawn[];
    retrySeconds: number;
    createGeneratedCreatureGroupInstances: (
        level: number,
        x: number,
        y: number,
        typeId: number,
        hpMultiplier: number,
        creatureCount: number,
        groupId: string,
    ) => TCreature[];
};

export function getOriginalGeneratorDisableTicks(rawTicks: number): number {
    if (rawTicks <= 0) return 0;
    return rawTicks > 127 ? ((rawTicks - 126) << 6) : rawTicks;
}

export function isGeneratorSpawnBlocked<TCreature extends CreaturePositionLike>(
    state: Pick<SensorGeneratorStateLike<TCreature, unknown>, 'creatures' | 'currentLevel' | 'currentPosition'>,
    level: number,
    x: number,
    y: number,
): boolean {
    if (
        level === state.currentLevel &&
        state.currentPosition[1] === x &&
        state.currentPosition[0] === y
    ) {
        return true;
    }

    return state.creatures.some((creature) =>
        creature.alive &&
        creature.mapIndex === level &&
        creature.x === x &&
        creature.y === y,
    );
}

export function buildPendingGeneratedCreatureGroupId(
    sensorLevel: number,
    sensorIndex: number,
    spawnLevel: number,
    spawnX: number,
    spawnY: number,
    typeId: number,
    elapsedGameTimeTicks: number,
): string {
    return [
        'generator',
        sensorLevel,
        sensorIndex,
        spawnLevel,
        spawnX,
        spawnY,
        typeId,
        elapsedGameTimeTicks,
        Math.random().toString(36).slice(2),
    ].join('_');
}

export function triggerGeneratorSensor<
    TState extends SensorGeneratorStateLike<TCreature, TPendingGeneratorSpawn>,
    TCreature extends CreaturePositionLike,
    TPendingGeneratorSpawn extends PendingGeneratorSpawnEventLike & { remaining: number },
>(
    level: number,
    sensor: SensorObject,
    state: TState,
    deps: TriggerGeneratorSensorDeps<TState, TCreature, TPendingGeneratorSpawn>,
): TState {
    const generatorConfig = deps.getGeneratorConfig(level, sensor.index);
    if (!generatorConfig) return state;

    const sensorKey = deps.getSensorStateKey(level, sensor.index);
    const nextAllowedTick = state.sensorRuntimeData[sensorKey] ?? 0;
    if (state.elapsedGameTimeTicks < nextAllowedTick) return state;

    const spawnTile = deps.getSpawnTile(level, generatorConfig.spawnX, generatorConfig.spawnY);
    if (!spawnTile || spawnTile.type === 'Wall' || spawnTile.type === 'TrickWall') return state;

    const desiredCount = generatorConfig.randomized
        ? 1 + deps.randomInt(Math.max(1, generatorConfig.countRaw))
        : generatorConfig.countRaw;
    if (!deps.canReserveGeneratorGroup(state, level)) return state;

    const disableTicks = getOriginalGeneratorDisableTicks(generatorConfig.ticks);
    const groupId = buildPendingGeneratedCreatureGroupId(
        level,
        sensor.index,
        level,
        generatorConfig.spawnX,
        generatorConfig.spawnY,
        generatorConfig.typeId,
        state.elapsedGameTimeTicks,
    );

    if (isGeneratorSpawnBlocked(state, level, generatorConfig.spawnX, generatorConfig.spawnY)) {
        const nextPendingGeneratorSpawns = deps.queuePendingGeneratorSpawnEvent(
            state.pendingGeneratorSpawns,
            {
                sensorLevel: level,
                sensorIndex: sensor.index,
                spawnLevel: level,
                spawnX: generatorConfig.spawnX,
                spawnY: generatorConfig.spawnY,
                typeId: generatorConfig.typeId,
                hpMultiplier: generatorConfig.hpMultiplier,
                creatureCount: desiredCount,
                groupId,
            } as Omit<TPendingGeneratorSpawn, 'remaining'>,
            deps.retrySeconds,
        );
        if (nextPendingGeneratorSpawns === state.pendingGeneratorSpawns) return state;

        return {
            ...state,
            pendingGeneratorSpawns: nextPendingGeneratorSpawns,
            sensorRuntimeData: {
                ...state.sensorRuntimeData,
                [sensorKey]: state.elapsedGameTimeTicks + disableTicks,
            },
        };
    }

    const generatedCreatures = deps.createGeneratedCreatureGroupInstances(
        level,
        generatorConfig.spawnX,
        generatorConfig.spawnY,
        generatorConfig.typeId,
        generatorConfig.hpMultiplier,
        desiredCount,
        groupId,
    );
    if (generatedCreatures.length <= 0) return state;

    return {
        ...state,
        creatures: [
            ...state.creatures,
            ...generatedCreatures,
        ],
        sensorRuntimeData: {
            ...state.sensorRuntimeData,
            [sensorKey]: state.elapsedGameTimeTicks + disableTicks,
        },
    };
}
