import { doorBlocksVision } from '../../data/doors';
import { isSelfRevealingWallTile } from '../../engine/store';
import type { CardinalDir, DoorObject, GameMap, GameTile } from '../../types/game';

const WALL_TEXT_FACE_VECTORS: Record<CardinalDir, { dx: number; dy: number }> = {
    North: { dx: 0, dy: -1 },
    South: { dx: 0, dy: 1 },
    East: { dx: 1, dy: 0 },
    West: { dx: -1, dy: 0 },
};

const LEFT_FACE_BY_FACE: Record<CardinalDir, CardinalDir> = {
    North: 'West',
    South: 'East',
    East: 'North',
    West: 'South',
};

const RIGHT_FACE_BY_FACE: Record<CardinalDir, CardinalDir> = {
    North: 'East',
    South: 'West',
    East: 'South',
    West: 'North',
};

function isWallTextAnchorTile(tile: GameTile | undefined): boolean {
    return tile?.type === 'Wall' || tile?.type === 'TrickWall' || tile?.type === 'Door';
}

function blocksWallFaceSight(
    tile: GameTile | undefined,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
): boolean {
    if (!tile) return true;
    if (tile.type === 'Wall') {
        const selfRevealingOpen = isSelfRevealingWallTile(level, tile.x, tile.y) &&
            openWalls.has(`${level},${tile.y},${tile.x}`);
        return !selfRevealingOpen;
    }
    if (tile.type === 'TrickWall') {
        return !openWalls.has(`${level},${tile.y},${tile.x}`);
    }
    if (tile.type === 'Door') {
        if (openDoors.has(`${level},${tile.y},${tile.x}`)) return false;
        const door = tile.objects.find((obj): obj is DoorObject => obj.category === 'Door');
        return doorBlocksVision(door?.doorType);
    }
    return false;
}

export function isDoorTileVisible(
    map: GameMap,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    partyX: number,
    partyY: number,
    tileX: number,
    tileY: number,
): boolean {
    const dx = tileX - partyX;
    const dy = tileY - partyY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return true;
    for (let i = 1; i < steps; i++) {
        const x = Math.round(partyX + (dx * i) / steps);
        const y = Math.round(partyY + (dy * i) / steps);
        if (blocksWallFaceSight(map.tiles[y]?.[x], level, openDoors, openWalls)) {
            return false;
        }
    }
    const target = map.tiles[tileY]?.[tileX];
    if (!target) return false;
    if (target.type === 'Wall') return false;
    if (target.type === 'TrickWall') return openWalls.has(`${level},${tileY},${tileX}`);
    return true;
}

export function resolveWallTextFace(map: GameMap, tile: GameTile, face: CardinalDir, text: string): CardinalDir {
    if (text === 'WELCOME\nBRAVE\nADVENTURERS.') {
        return 'West';
    }

    if (isWallTextAnchorTile(tile)) {
        return face;
    }

    const forward = WALL_TEXT_FACE_VECTORS[face];
    const forwardTile = map.tiles[tile.y + forward.dy]?.[tile.x + forward.dx];
    if (isWallTextAnchorTile(forwardTile)) {
        return face;
    }

    const leftFace = LEFT_FACE_BY_FACE[face];
    const leftStep = WALL_TEXT_FACE_VECTORS[leftFace];
    const leftTile = map.tiles[tile.y + leftStep.dy]?.[tile.x + leftStep.dx];
    if (isWallTextAnchorTile(leftTile)) {
        return leftFace;
    }

    const rightFace = RIGHT_FACE_BY_FACE[face];
    const rightStep = WALL_TEXT_FACE_VECTORS[rightFace];
    const rightTile = map.tiles[tile.y + rightStep.dy]?.[tile.x + rightStep.dx];
    if (isWallTextAnchorTile(rightTile)) {
        return rightFace;
    }

    return face;
}
