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
import { getOriginalTeleporterRuntime } from './originalTeleporters';
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
    [key: string]: unknown;
}

interface RawMap extends Omit<RawDungeonMapSummary, 'file'> {
    tiles: RawTile[];
    [key: string]: unknown;
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

function buildTile(mapIndex: number, raw: RawTile): GameTile {
    const objects = ((raw.objects ?? []) as unknown as TileObject[]).map((object) => {
        if (object.category === 'Teleporter') {
            const teleporter = object as TileObject & {
                index: number;
                scope?: string;
                rotationType?: number;
                rotation?: CardinalDir;
            };
            const meta = getOriginalTeleporterRuntime(mapIndex, raw.x, raw.y, teleporter.index);
            return {
                ...teleporter,
                scope: teleporter.scope ?? meta?.scope ?? 'Everything',
                rotationType: teleporter.rotationType ?? meta?.rotationType ?? 0,
                rotation: teleporter.rotation ?? meta?.rotation ?? 'North',
            };
        }
        if (object.category !== 'Text') return object;
        return {
            ...object,
            text: normalizeScrollText((object as TileObject & { text?: string }).text),
        };
    });

    // Small runtime-only helper text in the Hall of Champions.
    if (mapIndex === 0 && raw.x === 9 && raw.y === 3 && raw.type === 'Wall') {
        objects.push({
            category: 'Text',
            index: 1000003,
            tilePos: 'West' as CardinalDir,
            visible: true,
            text: 'CHOOSE YOUR\nFOUR CHAMPIONS',
        } satisfies WallTextObject);
    }

    return {
        ...raw,
        type: normaliseTileType(raw.type),
        objects,
    } as GameTile;
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
        tiles[rawTile.y][rawTile.x] = buildTile(raw.index, rawTile);
    }

    return {
        ...raw,
        tiles,
    } as GameMap;
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

export function isCreatureAllowedOnMap(mapIndex: number, creatureTypeId: number): boolean {
    const allowedCreatureTypes = getGameMap(mapIndex).metadata?.allowedCreatureTypes;
    if (!Array.isArray(allowedCreatureTypes)) return true;
    return allowedCreatureTypes.includes(creatureTypeId);
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
