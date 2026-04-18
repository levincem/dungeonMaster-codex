// Map loader - parses the generated runtime dungeon package into typed GameMap
// objects. Runtime canonical data now lives in src/assets/runtime/ and is
// preloaded through dungeonData.ts.

import type {
    GameMap,
    GameTile,
    TileType,
    TileObject,
    CardinalDir,
    WallTextObject,
} from '../types/game';
import {
    getDungeonBootstrapSync,
    getDungeonMapDataSync,
    type RawDungeonBootstrap,
    type RawDungeonMapSummary,
} from './dungeonData';
import { normalizeScrollText } from './textNormalization';

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

interface RawMap extends Omit<RawDungeonMapSummary, 'file'> {
    tiles: RawTile[];
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
    const objects = ((raw.objects ?? []) as unknown as TileObject[]).map((object) => {
        if (object.category !== 'Text') return object;
        return {
            ...object,
            text: normalizeScrollText((object as TileObject & { text?: string }).text),
        };
    });

    // Small runtime-only helper text in the Hall of Champions.
    if (raw.x === 9 && raw.y === 3 && raw.type === 'Wall') {
        objects.push({
            category: 'Text',
            index: 1000003,
            tilePos: 'West' as CardinalDir,
            visible: true,
            text: 'CHOOSE YOUR\nFOUR CHAMPIONS',
        } satisfies WallTextObject);
    }

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
        objects,
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

let cachedDungeonBootstrap: RawDungeonBootstrap | null = null;
const cachedGameMaps = new Map<number, GameMap>();
let cachedChampionStartPositions: ChampionStartPos[] | null = null;

function getDungeonBootstrap(): RawDungeonBootstrap {
    if (cachedDungeonBootstrap) return cachedDungeonBootstrap;
    cachedDungeonBootstrap = getDungeonBootstrapSync<RawDungeonBootstrap>();
    return cachedDungeonBootstrap;
}

function getRawMap(index: number): RawMap {
    return getDungeonMapDataSync<RawMap>(index);
}

export function getGameMaps(): GameMap[] {
    return getDungeonBootstrap().maps.map((map) => getGameMap(map.index));
}

export function getGameMap(index: number): GameMap {
    const cachedMap = cachedGameMaps.get(index);
    if (cachedMap) return cachedMap;

    const map = buildMap(getRawMap(index));
    cachedGameMaps.set(index, map);
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

type RawChampionStartRecord = {
    portraitId: number;
    x: number;
    y: number;
    wallFace: string;
    map?: number;
};

export function getChampionStartPositions(): ChampionStartPos[] {
    if (cachedChampionStartPositions) return cachedChampionStartPositions;
    cachedChampionStartPositions = (getDungeonBootstrap().champions as RawChampionStartRecord[]).map(c => ({
        portraitId: c.portraitId,
        mapIndex: c.map ?? 0,
        x: c.x,
        y: c.y,
        wallFace: c.wallFace as CardinalDir,
    }));
    return cachedChampionStartPositions;
}
