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
        tiles,
    };
}

const dungeon = getDungeonDataSync<RawDungeon>();

export const GAME_MAPS: GameMap[] = dungeon.maps.map(buildMap);

export function getGameMap(index: number): GameMap {
    const map = GAME_MAPS[index];
    if (!map) throw new Error(`Map index ${index} does not exist`);
    return map;
}

export interface ChampionStartPos {
    portraitId: number;
    mapIndex: number;
    x: number;
    y: number;
    wallFace: CardinalDir;
}

export const CHAMPION_START_POSITIONS: ChampionStartPos[] =
    dungeon.champions.map(c => ({
        portraitId: c.portraitId,
        mapIndex: (c as { map?: number }).map ?? 0,
        x: c.x,
        y: c.y,
        wallFace: c.wallFace as CardinalDir,
    }));
