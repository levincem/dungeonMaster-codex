import type {
    CardinalDir,
    CreatureCell,
    GameTile,
    TeleporterObject,
} from '../../types/game';
import { CREATURE_TYPES } from '../../data/creatures';
import { getGameMap } from '../../data/mapLoader';
import type { Direction } from '../runtimeTypes';
import { isDisabledTeleporterKey } from './disabledTeleporters';

const DIRECTIONS: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
const CARDINAL_TO_DIRECTION: Record<CardinalDir, Direction> = {
    North: 'NORTH',
    East: 'EAST',
    South: 'SOUTH',
    West: 'WEST',
};

type TeleporterScope = 'Items' | 'Creatures' | 'Items+Party' | 'Everything';
type TeleporterTransportKind = 'item' | 'creature' | 'party';

function normalizeTeleporterScope(scope: string | undefined): TeleporterScope {
    if (scope === 'Items' || scope === 'Creatures' || scope === 'Items+Party' || scope === 'Everything') {
        return scope;
    }
    return 'Everything';
}

export function getTeleporterScope(
    level: number,
    x: number,
    y: number,
    teleporter: TeleporterObject,
    getOriginalTeleporterRuntime: (
        level: number,
        x: number,
        y: number,
        index: number,
    ) => { scope?: string } | null | undefined,
): TeleporterScope {
    const meta = getOriginalTeleporterRuntime(level, x, y, teleporter.index);
    return normalizeTeleporterScope(teleporter.scope ?? meta?.scope);
}

function teleporterAllowsTransport(
    level: number,
    x: number,
    y: number,
    teleporter: TeleporterObject,
    transportKind: TeleporterTransportKind,
    getOriginalTeleporterRuntime: (
        level: number,
        x: number,
        y: number,
        index: number,
    ) => { scope?: string } | null | undefined,
): boolean {
    const scope = getTeleporterScope(level, x, y, teleporter, getOriginalTeleporterRuntime);
    if (transportKind === 'item') {
        return scope === 'Items' || scope === 'Items+Party' || scope === 'Everything';
    }
    if (transportKind === 'party') {
        return scope === 'Items+Party' || scope === 'Everything';
    }
    return scope === 'Creatures' || scope === 'Everything';
}

export function getTeleporter(tile: GameTile): TeleporterObject | undefined {
    return tile.objects.find((entry): entry is TeleporterObject => entry.category === 'Teleporter');
}

export function getTeleporterRotationDirection(
    level: number,
    x: number,
    y: number,
    teleporter: TeleporterObject,
    currentDirection: Direction,
    getOriginalTeleporterRuntime: (
        level: number,
        x: number,
        y: number,
        index: number,
    ) => { scope?: string; rotationType?: number; rotation?: CardinalDir } | null | undefined,
): Direction {
    const meta = getOriginalTeleporterRuntime(level, x, y, teleporter.index);
    const rotationType = teleporter.rotationType ?? meta?.rotationType ?? 0;
    const rotation = teleporter.rotation ?? meta?.rotation ?? 'North';
    if (rotationType === 1) {
        return CARDINAL_TO_DIRECTION[rotation];
    }
    const currentIndex = DIRECTIONS.indexOf(currentDirection);
    const rotationIndex = ['North', 'East', 'South', 'West'].indexOf(rotation);
    if (currentIndex < 0 || rotationIndex < 0) return currentDirection;
    return DIRECTIONS[(currentIndex + rotationIndex) % DIRECTIONS.length] ?? currentDirection;
}

export function getTeleporterRotationQuarterTurns(
    level: number,
    x: number,
    y: number,
    teleporter: TeleporterObject,
    currentDirection: Direction,
    getOriginalTeleporterRuntime: (
        level: number,
        x: number,
        y: number,
        index: number,
    ) => { scope?: string; rotationType?: number; rotation?: CardinalDir } | null | undefined,
): number {
    const currentIndex = DIRECTIONS.indexOf(currentDirection);
    const rotatedIndex = DIRECTIONS.indexOf(
        getTeleporterRotationDirection(level, x, y, teleporter, currentDirection, getOriginalTeleporterRuntime),
    );
    if (currentIndex < 0 || rotatedIndex < 0) return 0;
    return (rotatedIndex - currentIndex + DIRECTIONS.length) % DIRECTIONS.length;
}

export function rotateCreatureCell(cell: CreatureCell, quarterTurns: number): CreatureCell {
    if (cell === 'center') return cell;
    const normalizedTurns = ((quarterTurns % 4) + 4) % 4;
    if (normalizedTurns === 0) return cell;

    const cellCoords: Record<Exclude<CreatureCell, 'center'>, [number, number]> = {
        frontLeft: [-1, -1],
        frontRight: [1, -1],
        backRight: [1, 1],
        backLeft: [-1, 1],
    };
    const coordsToCell = new Map<string, CreatureCell>([
        ['-1,-1', 'frontLeft'],
        ['1,-1', 'frontRight'],
        ['1,1', 'backRight'],
        ['-1,1', 'backLeft'],
    ]);

    let [cellX, cellY] = cellCoords[cell];
    for (let turn = 0; turn < normalizedTurns; turn += 1) {
        [cellX, cellY] = [-cellY, cellX];
    }
    return coordsToCell.get(`${cellX},${cellY}`) ?? cell;
}

type TeleportTransportDeps = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    getOriginalTeleporterRuntime: (
        level: number,
        x: number,
        y: number,
        index: number,
    ) => { scope?: string; rotationType?: number; rotation?: CardinalDir } | null | undefined;
    isCreatureAllowedOnMap?: (mapIndex: number, creatureTypeId: number) => boolean;
    getCreatureWariness?: (creatureTypeId: number) => number;
};

export function resolveProjectileTeleporterTransport(
    state: Pick<{ openTeleporters: Set<string> }, 'openTeleporters'>,
    level: number,
    x: number,
    y: number,
    direction: Direction,
    deps: TeleportTransportDeps,
    transportKind: Extract<TeleporterTransportKind, 'item' | 'party'> = 'item',
): { level: number; x: number; y: number; direction: Direction } {
    let nextLevel = level;
    let nextX = x;
    let nextY = y;
    let nextDirection = direction;
    const visited = new Set<string>();

    for (let iteration = 0; iteration < 8; iteration += 1) {
        const tile = deps.getTile(nextLevel, nextX, nextY);
        if (tile?.type !== 'Teleporter') break;
        const teleporter = getTeleporter(tile);
        const teleporterKey = `${nextLevel},${nextY},${nextX}`;
        if (!teleporter || isDisabledTeleporterKey(teleporterKey) || !state.openTeleporters.has(teleporterKey)) break;
        if (!teleporterAllowsTransport(
            nextLevel,
            nextX,
            nextY,
            teleporter,
            transportKind,
            deps.getOriginalTeleporterRuntime,
        )) break;

        const loopKey = `${nextLevel},${nextX},${nextY},${teleporter.index},${nextDirection}`;
        if (visited.has(loopKey)) break;
        visited.add(loopKey);

        const destinationIsTeleporterTarget =
            nextLevel === teleporter.destMap &&
            nextX === teleporter.destX &&
            nextY === teleporter.destY;

        nextDirection = getTeleporterRotationDirection(
            nextLevel,
            nextX,
            nextY,
            teleporter,
            nextDirection,
            deps.getOriginalTeleporterRuntime,
        );
        nextLevel = teleporter.destMap;
        nextX = teleporter.destX;
        nextY = teleporter.destY;

        if (destinationIsTeleporterTarget) break;
    }

    return {
        level: nextLevel,
        x: nextX,
        y: nextY,
        direction: nextDirection,
    };
}

export function resolveCreatureTeleporterTransport(
    state: Pick<{ openTeleporters: Set<string> }, 'openTeleporters'>,
    level: number,
    x: number,
    y: number,
    direction: Direction,
    cell: CreatureCell,
    creatureTypeId: number,
    deps: TeleportTransportDeps,
): { level: number; x: number; y: number; direction: Direction; cell: CreatureCell } {
    let nextLevel = level;
    let nextX = x;
    let nextY = y;
    let nextDirection = direction;
    let nextCell = cell;
    const visited = new Set<string>();
    const wariness = deps.getCreatureWariness?.(creatureTypeId) ?? CREATURE_TYPES[creatureTypeId]?.wariness ?? 0;

    for (let iteration = 0; iteration < 8; iteration += 1) {
        const tile = deps.getTile(nextLevel, nextX, nextY);
        if (tile?.type !== 'Teleporter') break;
        const teleporter = getTeleporter(tile);
        const teleporterKey = `${nextLevel},${nextY},${nextX}`;
        if (!teleporter || isDisabledTeleporterKey(teleporterKey) || !state.openTeleporters.has(teleporterKey)) break;
        if (!teleporterAllowsTransport(
            nextLevel,
            nextX,
            nextY,
            teleporter,
            'creature',
            deps.getOriginalTeleporterRuntime,
        )) break;
        if (
            wariness >= 10 &&
            deps.isCreatureAllowedOnMap &&
            !deps.isCreatureAllowedOnMap(teleporter.destMap, creatureTypeId)
        ) {
            break;
        }

        const loopKey = `${nextLevel},${nextX},${nextY},${teleporter.index},${nextDirection},${nextCell}`;
        if (visited.has(loopKey)) break;
        visited.add(loopKey);

        const destinationIsTeleporterTarget =
            nextLevel === teleporter.destMap &&
            nextX === teleporter.destX &&
            nextY === teleporter.destY;

        const turns = getTeleporterRotationQuarterTurns(
            nextLevel,
            nextX,
            nextY,
            teleporter,
            nextDirection,
            deps.getOriginalTeleporterRuntime,
        );
        nextCell = rotateCreatureCell(nextCell, turns);
        nextDirection = getTeleporterRotationDirection(
            nextLevel,
            nextX,
            nextY,
            teleporter,
            nextDirection,
            deps.getOriginalTeleporterRuntime,
        );
        nextLevel = teleporter.destMap;
        nextX = teleporter.destX;
        nextY = teleporter.destY;

        if (destinationIsTeleporterTarget) break;
    }

    return {
        level: nextLevel,
        x: nextX,
        y: nextY,
        direction: nextDirection,
        cell: nextCell,
    };
}

type PitLandingDeps = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    isWalkable: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => boolean;
};

export function resolvePitLanding(
    sourceLevel: number,
    y: number,
    x: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    openPits: Set<string>,
    deps: PitLandingDeps,
): { level: number; y: number; x: number } | null {
    const readMap = (level: number) => {
        try {
            return getGameMap(level);
        } catch {
            return null;
        }
    };

    const sourceMap = readMap(sourceLevel);
    if (!sourceMap) return null;

    const sourceGlobalX = (sourceMap.mapOffset?.x ?? 0) + x;
    const sourceGlobalY = (sourceMap.mapOffset?.y ?? 0) + y;
    let currentLevel = sourceLevel + 1;

    while (true) {
        const currentMap = readMap(currentLevel);
        if (!currentMap) return null;

        // Pits fall straight down in world space, even when stacked maps have different local offsets.
        const landingX = sourceGlobalX - (currentMap.mapOffset?.x ?? 0);
        const landingY = sourceGlobalY - (currentMap.mapOffset?.y ?? 0);
        const tile = deps.getTile(currentLevel, landingX, landingY);
        if (!tile) return null;
        if (tile.type !== 'Pit' || !openPits.has(`${currentLevel},${landingY},${landingX}`)) {
            return deps.isWalkable(currentLevel, landingY, landingX, openDoors, openWalls, openPits)
                ? { level: currentLevel, y: landingY, x: landingX }
                : null;
        }
        currentLevel += 1;
    }
}
