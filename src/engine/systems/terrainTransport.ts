import type {
    CardinalDir,
    CreatureCell,
    GameTile,
    TeleporterObject,
} from '../../types/game';
import type { Direction } from '../runtimeTypes';

const DIRECTIONS: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
const CARDINAL_TO_DIRECTION: Record<CardinalDir, Direction> = {
    North: 'NORTH',
    East: 'EAST',
    South: 'SOUTH',
    West: 'WEST',
};

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
    ) => { rotationType?: number; rotation?: CardinalDir } | null | undefined,
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
    ) => { rotationType?: number; rotation?: CardinalDir } | null | undefined,
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
    ) => { rotationType?: number; rotation?: CardinalDir } | null | undefined;
};

export function resolveProjectileTeleporterTransport(
    state: Pick<{ openTeleporters: Set<string> }, 'openTeleporters'>,
    level: number,
    x: number,
    y: number,
    direction: Direction,
    deps: TeleportTransportDeps,
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
        if (!teleporter || !state.openTeleporters.has(teleporterKey)) break;

        const loopKey = `${nextLevel},${nextX},${nextY},${teleporter.index},${nextDirection}`;
        if (visited.has(loopKey)) break;
        visited.add(loopKey);

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
    deps: TeleportTransportDeps,
): { level: number; x: number; y: number; direction: Direction; cell: CreatureCell } {
    let nextLevel = level;
    let nextX = x;
    let nextY = y;
    let nextDirection = direction;
    let nextCell = cell;
    const visited = new Set<string>();

    for (let iteration = 0; iteration < 8; iteration += 1) {
        const tile = deps.getTile(nextLevel, nextX, nextY);
        if (tile?.type !== 'Teleporter') break;
        const teleporter = getTeleporter(tile);
        const teleporterKey = `${nextLevel},${nextY},${nextX}`;
        if (!teleporter || !state.openTeleporters.has(teleporterKey)) break;

        const loopKey = `${nextLevel},${nextX},${nextY},${teleporter.index},${nextDirection},${nextCell}`;
        if (visited.has(loopKey)) break;
        visited.add(loopKey);

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
    level: number,
    y: number,
    x: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    openPits: Set<string>,
    deps: PitLandingDeps,
): { level: number; y: number; x: number } | null {
    let currentLevel = level;

    while (true) {
        const tile = deps.getTile(currentLevel, x, y);
        if (!tile) return null;
        if (tile.type !== 'Pit' || !openPits.has(`${currentLevel},${y},${x}`)) {
            return deps.isWalkable(currentLevel, y, x, openDoors, openWalls, openPits)
                ? { level: currentLevel, y, x }
                : null;
        }
        currentLevel += 1;
    }
}
