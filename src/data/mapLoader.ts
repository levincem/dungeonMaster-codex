// Map loader - parses public/dungeon.json into typed GameMap objects.
// The source of truth remains Old_data/dungeon.json, copied into public/
// so the browser can fetch it at runtime instead of inlining 2.7 MB in JS.

import type {
    GameMap,
    GameTile,
    TileType,
    TileObject,
    CardinalDir,
} from '../types/game';
import { getDungeonDataSync } from './dungeonData';

interface RawObject {
    category: string;
    [key: string]: unknown;
}

interface RawTile {
    x: number;
    y: number;
    globalX?: number;
    globalY?: number;
    type: string;
    allowDecoN?: boolean;
    allowDecoE?: boolean;
    allowDecoS?: boolean;
    allowDecoW?: boolean;
    orientation?: string;
    state?: string;
    open?: boolean;
    visible?: boolean;
    objects?: RawObject[];
}

interface RawMap {
    index: number;
    name: string;
    level: number;
    width: number;
    height: number;
    difficulty: number;
    mapOffset?: { x: number; y: number };
    localBounds?: { minX: number; minY: number; maxX: number; maxY: number };
    globalBounds?: { minX: number; minY: number; maxX: number; maxY: number };
    tiles: RawTile[];
}

interface RawDungeon {
    champions: Array<{
        portraitId: number;
        x: number;
        y: number;
        wallFace: string;
    }>;
    maps: RawMap[];
}

function normaliseTileType(raw: string): TileType {
    switch (raw) {
        case 'Floor':      return 'Floor';
        case 'Wall':       return 'Wall';
        case 'TrickWall':  return 'TrickWall';
        case 'Door':       return 'Door';
        case 'Teleporter': return 'Teleporter';
        case 'Pit':        return 'Pit';
        case 'Water':      return 'Water';
        case 'Stairs':     return 'Stairs';
        case 'StairsUp':   return 'StairsUp';
        case 'StairsDown': return 'StairsDown';
        default:           return 'Floor';
    }
}

function buildTile(raw: RawTile): GameTile {
    return {
        x: raw.x,
        y: raw.y,
        globalX: raw.globalX,
        globalY: raw.globalY,
        type: normaliseTileType(raw.type),
        allowDecoN: raw.allowDecoN,
        allowDecoE: raw.allowDecoE,
        allowDecoS: raw.allowDecoS,
        allowDecoW: raw.allowDecoW,
        orientation: raw.orientation as GameTile['orientation'],
        state: raw.state as GameTile['state'],
        open: raw.open,
        visible: raw.visible,
        objects: (raw.objects ?? []) as unknown as TileObject[],
    };
}

function buildMap(raw: RawMap): GameMap {
    const tiles: GameTile[][] = Array.from(
        { length: raw.height },
        (_, y) => Array.from({ length: raw.width }, (__, x) => ({
            x,
            y,
            type: 'Wall' as TileType,
            objects: [],
        })),
    );

    for (const rawTile of raw.tiles) {
        tiles[rawTile.y][rawTile.x] = buildTile(rawTile);
    }

    return {
        index: raw.index,
        name: raw.name,
        level: raw.level,
        width: raw.width,
        height: raw.height,
        difficulty: raw.difficulty,
        mapOffset: raw.mapOffset,
        localBounds: raw.localBounds,
        globalBounds: raw.globalBounds,
        tiles,
    };
}

let cachedDungeon: RawDungeon | null = null;
let cachedGameMaps: GameMap[] | null = null;
let cachedChampionStartPositions: ChampionStartPos[] | null = null;

function getDungeon(): RawDungeon {
    if (cachedDungeon) return cachedDungeon;
    cachedDungeon = getDungeonDataSync<RawDungeon>();
    return cachedDungeon;
}

export function getGameMaps(): GameMap[] {
    if (cachedGameMaps) return cachedGameMaps;
    cachedGameMaps = getDungeon().maps.map(buildMap);
    return cachedGameMaps;
}

export function getGameMap(index: number): GameMap {
    const map = getGameMaps()[index];
    if (!map) throw new Error(`Map index ${index} does not exist`);
    return map;
}

export function toGlobalCoords(mapIndex: number, x: number, y: number): { x: number; y: number } {
    const map = getGameMap(mapIndex);
    return {
        x: (map.mapOffset?.x ?? 0) + x,
        y: (map.mapOffset?.y ?? 0) + y,
    };
}

export function toLocalCoords(mapIndex: number, globalX: number, globalY: number): { x: number; y: number } {
    const map = getGameMap(mapIndex);
    return {
        x: globalX - (map.mapOffset?.x ?? 0),
        y: globalY - (map.mapOffset?.y ?? 0),
    };
}

export interface ChampionStartPos {
    portraitId: number;
    mapIndex: number;
    x: number;
    y: number;
    wallFace: CardinalDir;
}

export function getChampionStartPositions(): ChampionStartPos[] {
    if (cachedChampionStartPositions) return cachedChampionStartPositions;
    cachedChampionStartPositions = getDungeon().champions.map(c => ({
        portraitId: c.portraitId,
        mapIndex: (c as { map?: number }).map ?? 0,
        x: c.x,
        y: c.y,
        wallFace: c.wallFace as CardinalDir,
    }));
    return cachedChampionStartPositions;
}
