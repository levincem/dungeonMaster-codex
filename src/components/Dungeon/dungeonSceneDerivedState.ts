import type { Direction } from '../../engine/runtimeTypes';
import { isAltarWallFace as isAltarWallFaceSystem } from '../../engine/systems/resurrection';
import {
    resolveFrontWallTarget,
    resolveLeftWallTarget,
    resolveRightWallTarget,
} from '../../engine/systems/frontWallState';
import { getGameMap } from '../../data/mapLoader';
import type { CardinalDir, DoorObject, GameMap, GameTile, SensorObject } from '../../types/game';

const WALL_FACE_VECTORS: Record<CardinalDir, { dx: number; dy: number }> = {
    North: { dx: 0, dy: -1 },
    South: { dx: 0, dy: 1 },
    East: { dx: 1, dy: 0 },
    West: { dx: -1, dy: 0 },
};

type MechanismEntry = {
    trigger: string;
};
type MapMechanismEntry = {
    x: number;
    y: number;
    kind: string;
    support: string;
};
type StairConnection = {
    fromLevel: number;
    fromX: number;
    fromY: number;
    toLevel: number;
};

export type FrontWallInteractionKind = 'wall-lock' | 'alcove' | 'object-exchanger';
export type AltarDropTarget = {
    placement: WallDropPlacement;
    wallX: number;
    wallY: number;
    face: CardinalDir;
};
export type WallButtonRender = {
    tileX: number;
    tileY: number;
    face: CardinalDir;
    sensorIndex: number;
};
export type TileMarkerRender = { tileX: number; tileY: number };
export type WallDropPlacement = 'front' | 'left' | 'right';
export type WallDecalRender = {
    tileX: number;
    tileY: number;
    face: CardinalDir;
    image?: string;
    label?: string;
    accent?: string;
    width?: number;
    height?: number;
    interactiveSensorIndices?: number[];
};

function wallFaceAnchor(tileX: number, tileY: number, face: CardinalDir): { x: number; y: number } {
    const step = WALL_FACE_VECTORS[face];
    return { x: tileX + step.dx, y: tileY + step.dy };
}

function blocksWallFaceSight(
    tile: GameTile | undefined,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    isSelfRevealingWallTile: (level: number, tileX: number, tileY: number) => boolean,
    doorBlocksVision: (doorType: number | undefined) => boolean,
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

function hasWallFaceLineOfSight(
    map: GameMap,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    isSelfRevealingWallTile: (level: number, tileX: number, tileY: number) => boolean,
    doorBlocksVision: (doorType: number | undefined) => boolean,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
): boolean {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return true;
    for (let i = 1; i < steps; i++) {
        const x = Math.round(fromX + (dx * i) / steps);
        const y = Math.round(fromY + (dy * i) / steps);
        if (blocksWallFaceSight(map.tiles[y]?.[x], level, openDoors, openWalls, isSelfRevealingWallTile, doorBlocksVision)) {
            return false;
        }
    }
    return !blocksWallFaceSight(map.tiles[toY]?.[toX], level, openDoors, openWalls, isSelfRevealingWallTile, doorBlocksVision);
}

function isWallFaceVisible(
    map: GameMap,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    isSelfRevealingWallTile: (level: number, tileX: number, tileY: number) => boolean,
    doorBlocksVision: (doorType: number | undefined) => boolean,
    partyX: number,
    partyY: number,
    tileX: number,
    tileY: number,
    face: CardinalDir,
): boolean {
    const anchor = wallFaceAnchor(tileX, tileY, face);
    return hasWallFaceLineOfSight(map, level, openDoors, openWalls, isSelfRevealingWallTile, doorBlocksVision, partyX, partyY, anchor.x, anchor.y);
}

function resolveStairsEntryFace(map: GameMap, x: number, y: number): CardinalDir {
    const neighbours: Array<{ dx: number; dy: number; dir: CardinalDir }> = [
        { dx: 0, dy: -1, dir: 'North' },
        { dx: 0, dy: 1, dir: 'South' },
        { dx: 1, dy: 0, dir: 'East' },
        { dx: -1, dy: 0, dir: 'West' },
    ];
    for (const { dx, dy, dir } of neighbours) {
        const row = map.tiles[y + dy];
        const neighbour = row?.[x + dx];
        if (neighbour && neighbour.type !== 'Wall') return dir;
    }
    return 'South';
}

export function resolveFrontWallInteractionKind(args: {
    level: number;
    map: GameMap;
    position: [number, number];
    direction: Direction;
    openWalls: Set<string>;
    getMechanismsAtFace?: (level: number, tileX: number, tileY: number, face: CardinalDir) => MechanismEntry[];
    isSelfRevealingWallTile?: (level: number, tileX: number, tileY: number) => boolean;
}): FrontWallInteractionKind | null {
    const { direction, level, map, openWalls, position } = args;
    const mechanismLookup = args.getMechanismsAtFace ?? (() => []);
    const selfRevealingWallTile = args.isSelfRevealingWallTile ?? (() => false);
    const frontTileY = direction === 'NORTH' ? position[0] - 1 : direction === 'SOUTH' ? position[0] + 1 : position[0];
    const frontTileX = direction === 'EAST' ? position[1] + 1 : direction === 'WEST' ? position[1] - 1 : position[1];
    const frontFace: CardinalDir =
        direction === 'NORTH' ? 'South'
            : direction === 'SOUTH' ? 'North'
                : direction === 'EAST' ? 'West'
                    : 'East';
    const tile = map.tiles[frontTileY]?.[frontTileX];
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return null;
    if (selfRevealingWallTile(level, frontTileX, frontTileY) && openWalls.has(`${level},${frontTileY},${frontTileX}`)) {
        return null;
    }
    const mechanism = mechanismLookup(level, frontTileX, frontTileY, frontFace).find((entry) =>
        entry.trigger === 'wall-lock' || entry.trigger === 'alcove' || entry.trigger === 'object-exchanger',
    );
    if (!mechanism) return null;
    if (mechanism.trigger === 'alcove') return 'alcove';
    if (mechanism.trigger === 'object-exchanger') return 'object-exchanger';
    return 'wall-lock';
}

export function resolveAltarDropTargets(args: {
    level: number;
    map: GameMap;
    position: [number, number];
    direction: Direction;
    openDoors: Set<string>;
    openWalls: Set<string>;
    isSelfRevealingWallTile?: (level: number, tileX: number, tileY: number) => boolean;
    doorBlocksVision?: (doorType: number | undefined) => boolean;
    isAltarWallFace?: (
        level: number,
        tileX: number,
        tileY: number,
        face: CardinalDir,
        mapTileLookup: (level: number, tileX: number, tileY: number) => GameTile | undefined,
    ) => boolean;
    mapTileLookup?: (level: number, tileX: number, tileY: number) => GameTile | undefined;
}): AltarDropTarget[] {
    const { direction, level, map, openDoors, openWalls, position } = args;
    const selfRevealingWallTile = args.isSelfRevealingWallTile ?? (() => false);
    const doorBlocksVisionFn = args.doorBlocksVision ?? (() => true);
    const altarWallFaceCheck = args.isAltarWallFace ?? isAltarWallFaceSystem;
    const mapTileLookup = args.mapTileLookup ?? ((mapLevel, tileX, tileY) => getGameMap(mapLevel).tiles[tileY]?.[tileX]);
    const partyX = position[1];
    const partyY = position[0];
    const candidates = [
        { placement: 'front' as const, ...resolveFrontWallTarget(position, direction) },
        { placement: 'left' as const, ...resolveLeftWallTarget(position, direction) },
        { placement: 'right' as const, ...resolveRightWallTarget(position, direction) },
    ];

    return candidates.filter(({ wallX, wallY, face }) => {
        const tile = map.tiles[wallY]?.[wallX];
        if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return false;
        if (selfRevealingWallTile(level, wallX, wallY) && openWalls.has(`${level},${wallY},${wallX}`)) {
            return false;
        }
        if (!isWallFaceVisible(map, level, openDoors, openWalls, selfRevealingWallTile, doorBlocksVisionFn, partyX, partyY, wallX, wallY, face)) {
            return false;
        }
        return altarWallFaceCheck(level, wallX, wallY, face, mapTileLookup);
    });
}

export function buildDungeonSceneWallButtons(args: {
    level: number;
    map: GameMap;
    openDoors: Set<string>;
    openWalls: Set<string>;
    partyPosition: [number, number];
    originalWallOverlays: readonly Pick<WallDecalRender, 'tileX' | 'tileY' | 'face'>[];
    isSelfRevealingWallTile?: (level: number, tileX: number, tileY: number) => boolean;
    doorBlocksVision?: (doorType: number | undefined) => boolean;
}): WallButtonRender[] {
    const { level, map, openDoors, openWalls, partyPosition } = args;
    const overlays = args.originalWallOverlays;
    const selfRevealingWallTile = args.isSelfRevealingWallTile ?? (() => false);
    const doorBlocksVisionFn = args.doorBlocksVision ?? (() => true);
    const partyX = partyPosition[1];
    const partyY = partyPosition[0];
    const buttonsByFace = new Map<string, { tileX: number; tileY: number; face: CardinalDir; sensorIndex: number; isLocal: boolean }>();
    const overlayKeys = new Set(
        overlays.map((overlay) => `${overlay.tileX}:${overlay.tileY}:${overlay.face}`),
    );

    for (const row of map.tiles) {
        for (const tile of row) {
            const hiddenWallOpen = tile.type === 'Wall' && selfRevealingWallTile(level, tile.x, tile.y) && openWalls.has(`${level},${tile.y},${tile.x}`);
            for (const obj of tile.objects) {
                if (obj.category !== 'Sensor') continue;
                const sensor = obj as SensorObject;
                if (sensor.type !== 1 && sensor.type !== 2) continue;
                if (hiddenWallOpen) continue;
                const hasExplicitOverlay = overlayKeys.has(`${tile.x}:${tile.y}:${sensor.tilePos}`);
                if (hasExplicitOverlay) continue;
                if (!isWallFaceVisible(map, level, openDoors, openWalls, selfRevealingWallTile, doorBlocksVisionFn, partyX, partyY, tile.x, tile.y, sensor.tilePos)) continue;
                const key = `${tile.x}:${tile.y}:${sensor.tilePos}`;
                const current = buttonsByFace.get(key);
                if (!current || (current.isLocal && !sensor.isLocal)) {
                    buttonsByFace.set(key, {
                        tileX: tile.x,
                        tileY: tile.y,
                        face: sensor.tilePos,
                        sensorIndex: sensor.index,
                        isLocal: sensor.isLocal,
                    });
                }
            }
        }
    }

    return [...buttonsByFace.values()].map((button) => ({
        tileX: button.tileX,
        tileY: button.tileY,
        face: button.face,
        sensorIndex: button.sensorIndex,
    }));
}

export function buildDungeonSceneWallDecals(args: {
    level: number;
    map: GameMap;
    openDoors: Set<string>;
    openWalls: Set<string>;
    partyPosition: [number, number];
    originalWallOverlays: readonly WallDecalRender[];
    stairConnections?: readonly StairConnection[];
    miscImagePathBuilder?: (file: string) => string;
    isSelfRevealingWallTile?: (level: number, tileX: number, tileY: number) => boolean;
    doorBlocksVision?: (doorType: number | undefined) => boolean;
}): WallDecalRender[] {
    const { level, map, openDoors, openWalls, partyPosition } = args;
    const overlays = args.originalWallOverlays;
    const stairConnections = args.stairConnections ?? [];
    const miscImagePathBuilder = args.miscImagePathBuilder ?? ((file: string) => `/game/images/misc/${file}`);
    const selfRevealingWallTile = args.isSelfRevealingWallTile ?? (() => false);
    const doorBlocksVisionFn = args.doorBlocksVision ?? (() => true);
    const partyX = partyPosition[1];
    const partyY = partyPosition[0];
    const decals: WallDecalRender[] = [];
    const seen = new Set<string>();
    const add = (overlay: WallDecalRender) => {
        const visualKey = overlay.image ?? overlay.label ?? 'overlay';
        const key = `${overlay.tileX}_${overlay.tileY}_${overlay.face}_${visualKey}`;
        if (seen.has(key)) return;
        if (!isWallFaceVisible(map, level, openDoors, openWalls, selfRevealingWallTile, doorBlocksVisionFn, partyX, partyY, overlay.tileX, overlay.tileY, overlay.face)) return;
        seen.add(key);
        decals.push(overlay);
    };

    for (const row of map.tiles) {
        for (const tile of row) {
            if (tile.type !== 'Stairs') continue;
            const link = stairConnections.find(
                (stair) => stair.fromLevel === level && stair.fromY === tile.y && stair.fromX === tile.x,
            );
            if (!link) continue;
            add({
                tileX: tile.x,
                tileY: tile.y,
                face: resolveStairsEntryFace(map, tile.x, tile.y),
                image: link.toLevel > level ? miscImagePathBuilder('stairs_down.png') : miscImagePathBuilder('stairs_up.png'),
            });
        }
    }

    for (const overlay of overlays) {
        if (
            selfRevealingWallTile(level, overlay.tileX, overlay.tileY) &&
            openWalls.has(`${level},${overlay.tileY},${overlay.tileX}`)
        ) {
            continue;
        }
        add(overlay);
    }

    return decals;
}

export function collectDungeonScenePressurePlates(args: {
    level: number;
    map: GameMap;
    mechanisms: readonly MapMechanismEntry[];
}): TileMarkerRender[] {
    const { map } = args;
    const mechanisms = args.mechanisms;
    const seen = new Set<string>();
    const plates: TileMarkerRender[] = [];
    for (const mech of mechanisms) {
        if (mech.support !== 'Floor' || !mech.kind.startsWith('Dalle de pression')) continue;
        const tile = map.tiles[mech.y]?.[mech.x];
        if (!tile || tile.type === 'Wall' || tile.type === 'Door' || tile.type === 'Teleporter') continue;
        const key = `${mech.x},${mech.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        plates.push({ tileX: mech.x, tileY: mech.y });
    }
    return plates;
}

export function collectDungeonSceneTrickWalls(args: {
    level: number;
    map: GameMap;
    openWalls: Set<string>;
}): TileMarkerRender[] {
    const { level, map, openWalls } = args;
    const walls: TileMarkerRender[] = [];
    for (const row of map.tiles) {
        for (const tile of row) {
            if (tile.type !== 'TrickWall') continue;
            if (openWalls.has(`${level},${tile.y},${tile.x}`)) continue;
            walls.push({ tileX: tile.x, tileY: tile.y });
        }
    }
    return walls;
}

export function collectDungeonScenePits(args: {
    map: GameMap;
}): TileMarkerRender[] {
    const out: TileMarkerRender[] = [];
    for (const row of args.map.tiles) {
        for (const tile of row) {
            if (tile.type !== 'Pit') continue;
            out.push({ tileX: tile.x, tileY: tile.y });
        }
    }
    return out;
}
