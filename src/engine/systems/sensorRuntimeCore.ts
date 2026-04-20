import { getGameMap } from '../../data/mapLoader';
import type {
    CardinalDir,
    FloorItem,
    GameMap,
    GameTile,
    SensorObject,
} from '../../types/game';

type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

type MapResolver = (level: number) => { tiles: GameTile[][] };

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

export function findSensorByIndex(
    level: number,
    sensorIndex: number,
    mapResolver: MapResolver = getGameMap,
): SensorObject | null {
    const map = mapResolver(level);
    for (const row of map.tiles) {
        for (const tile of row) {
            for (const obj of tile.objects) {
                if (obj.category === 'Sensor' && (obj as SensorObject).index === sensorIndex) {
                    return obj as SensorObject;
                }
            }
        }
    }
    return null;
}

export type SensorPlacement = {
    x: number;
    y: number;
    tile: GameTile;
    sensor: SensorObject;
};

type SensorStateSnapshotSource<TCreature, TPendingGeneratorSpawn, TProjectile> = Partial<{
    level: number;
    position: [number, number];
    direction: Direction;
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    projectiles: TProjectile[];
    creatures: TCreature[];
    pendingGeneratorSpawns: TPendingGeneratorSpawn[];
    elapsedGameTimeTicks: number;
}>;

export type SensorStateSnapshot<TCreature, TPendingGeneratorSpawn, TProjectile> = {
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    projectiles: TProjectile[];
    creatures: TCreature[];
    pendingGeneratorSpawns: TPendingGeneratorSpawn[];
    currentLevel: number;
    currentPosition: [number, number];
    currentDirection: Direction;
    elapsedGameTimeTicks: number;
};

export type WallLauncherProjectileEffect =
    | 'fireball'
    | 'lightning'
    | 'poison_cloud'
    | 'poison_bolt'
    | 'open'
    | 'disrupt_nonmaterial'
    | 'physical';

export type WallLauncherPhysicalItem = Pick<
    FloorItem,
    'id' | 'category' | 'typeId' | 'rawName' | 'mapIndex' | 'x' | 'y' | 'tilePos'
>;

export type WallLauncherProjectile<TPhysicalItem = WallLauncherPhysicalItem> = {
    id: string;
    level: number;
    x: number;
    y: number;
    direction: Direction;
    effect: WallLauncherProjectileEffect;
    damage: [number, number];
    nextMoveAt: number;
    remainingRange: number;
    remainingAttack: number;
    stepDecay: number;
    visualScale?: number;
    physicalItem?: TPhysicalItem;
};

const CARDINAL_TO_DIRECTION: Record<CardinalDir, Direction> = {
    North: 'NORTH',
    East: 'EAST',
    South: 'SOUTH',
    West: 'WEST',
};

export const WALL_LAUNCHER_SENSOR_TYPES = new Set([7, 8, 9, 10, 14, 15]);
const EXPLOSION_LAUNCHER_SENSOR_TYPES = new Set([8, 10]);
const NEW_OBJECT_LAUNCHER_SENSOR_TYPES = new Set([7, 9]);
const SINGLE_PROJECTILE_LAUNCHER_SENSOR_TYPES = new Set([7, 8, 14]);

function getWallLauncherExplosionEffect(sensorData: number): Exclude<WallLauncherProjectileEffect, 'physical'> | null {
    switch (sensorData) {
        case 0: return 'fireball';
        case 2: return 'lightning';
        case 3: return 'disrupt_nonmaterial';
        case 4: return 'open';
        case 6: return 'poison_bolt';
        case 7: return 'poison_cloud';
        default: return null;
    }
}

function getWallLauncherWeaponTypeId(sensorData: number): number | null {
    switch (sensorData) {
        case 55: return 31; // Poison Dart
        default: return null;
    }
}

function getFrontPosition(position: [number, number], direction: Direction): { x: number; y: number } {
    const [y, x] = position;
    if (direction === 'NORTH') return { x, y: y - 1 };
    if (direction === 'SOUTH') return { x, y: y + 1 };
    if (direction === 'EAST') return { x: x + 1, y };
    return { x: x - 1, y };
}

export function getSensorStateKey(level: number, sensorIndex: number): string {
    return `${level}_${sensorIndex}`;
}

export function buildSensorStateSnapshot<TCreature, TPendingGeneratorSpawn, TProjectile>(
    source: SensorStateSnapshotSource<TCreature, TPendingGeneratorSpawn, TProjectile>,
): SensorStateSnapshot<TCreature, TPendingGeneratorSpawn, TProjectile> {
    return {
        openDoors: source.openDoors ?? new Set<string>(),
        openPits: source.openPits ?? new Set<string>(),
        openTeleporters: source.openTeleporters ?? new Set<string>(),
        openWalls: source.openWalls ?? new Set<string>(),
        activeSensors: source.activeSensors ?? new Set<string>(),
        firedSensors: source.firedSensors ?? new Set<string>(),
        sensorRuntimeData: source.sensorRuntimeData ?? {},
        sensorRotationOffsets: source.sensorRotationOffsets ?? {},
        visibleTexts: source.visibleTexts ?? new Set<string>(),
        projectiles: source.projectiles ?? [],
        creatures: source.creatures ?? [],
        pendingGeneratorSpawns: source.pendingGeneratorSpawns ?? [],
        currentLevel: source.level ?? 0,
        currentPosition: source.position ?? [0, 0],
        currentDirection: source.direction ?? 'NORTH',
        elapsedGameTimeTicks: source.elapsedGameTimeTicks ?? 0,
    };
}

export function readWallSensorRuntimeData(
    level: number,
    sensor: SensorObject,
    sensorRuntimeData: Record<string, number>,
): number {
    return sensorRuntimeData[getSensorStateKey(level, sensor.index)] ?? sensor.data;
}

export function writeWallSensorRuntimeData(
    level: number,
    sensor: SensorObject,
    sensorRuntimeData: Record<string, number>,
    nextValue: number,
): Record<string, number> {
    const key = getSensorStateKey(level, sensor.index);
    const clampedValue = Math.max(0, Math.min(511, nextValue));
    const previousValue = sensorRuntimeData[key] ?? sensor.data;
    if (previousValue === clampedValue) return sensorRuntimeData;

    if (clampedValue === sensor.data) {
        if (!(key in sensorRuntimeData)) return sensorRuntimeData;
        const nextRuntimeData = { ...sensorRuntimeData };
        delete nextRuntimeData[key];
        return nextRuntimeData;
    }

    return {
        ...sensorRuntimeData,
        [key]: clampedValue,
    };
}

export function findSensorPlacement(
    level: number,
    sensorIndex: number,
    mapResolver: MapResolver = getGameMap,
): SensorPlacement | null {
    const map = mapResolver(level);
    for (const row of map.tiles) {
        for (const tile of row) {
            for (const obj of tile.objects) {
                if (obj.category === 'Sensor' && (obj as SensorObject).index === sensorIndex) {
                    return {
                        x: tile.x,
                        y: tile.y,
                        tile,
                        sensor: obj as SensorObject,
                    };
                }
            }
        }
    }
    return null;
}

export function buildWallLauncherProjectiles(
    level: number,
    wallX: number,
    wallY: number,
    sensor: SensorObject,
    now: number,
    mapResolver: (level: number) => Pick<GameMap, 'width' | 'height'> = getGameMap,
    resolveWeaponProjectile?: (weaponTypeId: number) => { rawName: string; baseDamage: number } | null,
): WallLauncherProjectile[] {
    if (!WALL_LAUNCHER_SENSOR_TYPES.has(sensor.type)) return [];

    const direction = CARDINAL_TO_DIRECTION[sensor.tilePos];
    const { x: startX, y: startY } = getFrontPosition([wallY, wallX], direction);
    const launchMap = mapResolver(level);
    if (startY < 0 || startY >= launchMap.height || startX < 0 || startX >= launchMap.width) {
        return [];
    }

    const projectileCount = SINGLE_PROJECTILE_LAUNCHER_SENSOR_TYPES.has(sensor.type) ? 1 : 2;
    const kineticEnergy = Math.max(1, sensor.kineticEnergy ?? 1);
    const stepEnergy = Math.max(0, sensor.stepEnergy ?? 0);

    if (EXPLOSION_LAUNCHER_SENSOR_TYPES.has(sensor.type)) {
        const effect = getWallLauncherExplosionEffect(sensor.data);
        if (!effect) return [];
        return Array.from({ length: projectileCount }, (_, index) => ({
            id: `wall_launcher_${level}_${sensor.index}_${index}_${now}_${Math.random().toString(36).slice(2)}`,
            level,
            x: startX,
            y: startY,
            direction,
            effect,
            damage: effect === 'open' ? [0, 0] : [1, kineticEnergy],
            nextMoveAt: now + index * 40,
            remainingRange: kineticEnergy,
            remainingAttack: effect === 'open' ? 0 : 100,
            stepDecay: stepEnergy,
            visualScale: effect === 'poison_cloud' ? 1.08 : effect === 'lightning' ? 1.04 : 1,
        }));
    }

    if (NEW_OBJECT_LAUNCHER_SENSOR_TYPES.has(sensor.type)) {
        const weaponTypeId = getWallLauncherWeaponTypeId(sensor.data);
        if (weaponTypeId == null) return [];
        const weaponProjectile = resolveWeaponProjectile?.(weaponTypeId);
        if (!weaponProjectile) return [];
        const { rawName, baseDamage } = weaponProjectile;
        return Array.from({ length: projectileCount }, (_, index) => ({
            id: `wall_launcher_item_${level}_${sensor.index}_${index}_${now}_${Math.random().toString(36).slice(2)}`,
            level,
            x: startX,
            y: startY,
            direction,
            effect: 'physical' as const,
            damage: [baseDamage, Math.max(baseDamage, kineticEnergy)],
            nextMoveAt: now + index * 40,
            remainingRange: kineticEnergy,
            remainingAttack: Math.max(baseDamage, kineticEnergy),
            stepDecay: Math.max(1, stepEnergy),
            physicalItem: {
                id: `wall_launcher_item_drop_${level}_${sensor.index}_${index}_${now}_${Math.random().toString(36).slice(2)}`,
                category: 'Weapon',
                typeId: weaponTypeId,
                rawName,
                mapIndex: level,
                x: startX,
                y: startY,
                tilePos: sensor.tilePos,
            },
        }));
    }

    return [];
}

export function resolveDoorSoundTarget(
    sensor: SensorObject,
    level: number,
    mapResolver: MapResolver = getGameMap,
): { level: number; x: number; y: number } | null {
    const map = mapResolver(level);
    const targetTile = map.tiles[sensor.targetY]?.[sensor.targetX];
    if (!targetTile) return null;
    if (targetTile.type === 'Door') {
        return { level, x: sensor.targetX, y: sensor.targetY };
    }
    const gates = targetTile.objects.filter(
        (obj): obj is SensorObject => obj.category === 'Sensor' && obj.type === 5,
    );
    for (const gate of gates) {
        const gateTarget = map.tiles[gate.targetY]?.[gate.targetX];
        if (gateTarget?.type === 'Door') {
            return { level, x: gate.targetX, y: gate.targetY };
        }
    }
    return null;
}

export function getSelfRevealingWallSensor(
    tile: GameTile | undefined,
    isWallRevealableObject: (obj: GameTile['objects'][number]) => boolean,
): SensorObject | null {
    if (!tile || tile.type !== 'Wall') return null;
    const sensors = tile.objects.filter(
        (obj): obj is SensorObject => obj.category === 'Sensor',
    );
    for (const sensor of sensors) {
        if ((sensor.type !== 1 && sensor.type !== 2) || sensor.targetX !== 0 || sensor.targetY !== 0 || !sensor.onceOnly) {
            continue;
        }
        const hasMountedObject = tile.objects.some((obj) =>
            isWallRevealableObject(obj) && obj.tilePos === sensor.tilePos,
        );
        if (hasMountedObject) return sensor;
    }
    return null;
}

export function revealSelfWallMountedItems(
    floorItems: FloorItem[],
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
): FloorItem[] {
    let changed = false;
    const nextItems = floorItems.map((item) => {
        if (item.mapIndex !== level || item.x !== x || item.y !== y || item.tilePos !== face) {
            return item;
        }
        changed = true;
        return {
            ...item,
            x,
            y,
            tilePos: face,
        };
    });

    return changed ? nextItems : floorItems;
}

export function computeSensorEffect<TSensorState>(
    sensor: SensorObject,
    level: number,
    ss: TSensorState,
    deps: {
        getTile: (level: number, x: number, y: number) => GameTile | undefined;
        dispatchTriggeredSensorEffect: (
            sensor: SensorObject,
            level: number,
            ss: TSensorState,
            options?: { actionOverride?: SensorObject['action']; updateSourceActive?: boolean },
        ) => Partial<TSensorState>;
    },
): Partial<TSensorState> {
    if (sensor.type === 5) return {};
    if (sensor.action === 'Hold') return {};

    const targetTile = deps.getTile(level, sensor.targetX, sensor.targetY);
    const updateSourceActive = targetTile?.type === 'Wall' || targetTile?.type === 'TrickWall';
    return deps.dispatchTriggeredSensorEffect(sensor, level, ss, { updateSourceActive });
}

export function queueOrComputeSensorEffect<TSensorState, TPendingSensorEvent extends PendingSensorEventLike>(
    sensor: SensorObject,
    level: number,
    ss: TSensorState,
    pendingSensorEvents: TPendingSensorEvent[],
    deps: {
        computeSensorEffect: (
            sensor: SensorObject,
            level: number,
            ss: TSensorState,
        ) => Partial<TSensorState>;
        originalTimerTicksToSeconds: (ticks: number) => number;
        getFiredSensors: (state: TSensorState) => Set<string>;
        setFiredSensors: (state: TSensorState, firedSensors: Set<string>) => Partial<TSensorState>;
        getSensorStateKey: (level: number, sensorIndex: number) => string;
    },
): {
    sensorChanges: Partial<TSensorState>;
    pendingSensorEvents: TPendingSensorEvent[];
} {
    if (sensor.delay > 1) {
        const sensorKey = deps.getSensorStateKey(level, sensor.index);
        const firedSensors = deps.getFiredSensors(ss);
        const nextFired = sensor.onceOnly && !firedSensors.has(sensorKey)
            ? new Set([...firedSensors, sensorKey])
            : firedSensors;
        const alreadyQueued = pendingSensorEvents.some((event) => event.level === level && event.sensorIndex === sensor.index);
        return {
            sensorChanges: nextFired !== firedSensors ? deps.setFiredSensors(ss, nextFired) : {},
            pendingSensorEvents: alreadyQueued
                ? pendingSensorEvents
                : [...pendingSensorEvents, { level, sensorIndex: sensor.index, remaining: deps.originalTimerTicksToSeconds(sensor.delay) } as TPendingSensorEvent],
        };
    }

    return {
        sensorChanges: deps.computeSensorEffect(sensor, level, ss),
        pendingSensorEvents,
    };
}
