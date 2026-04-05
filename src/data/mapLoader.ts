// Map loader — parses Old_data/dungeon.json into typed GameMap objects
// dungeon.json contains 14 maps (index 0–13) with full tile & object data.
//
// NOTE: dungeon.json is ~2.7 MB. Vite inlines it at build time.
// If bundle size becomes a concern, move it to public/ and use fetch().

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JSON import resolved by Vite; resolveJsonModule in tsconfig
import rawDungeon from '../../Old_data/dungeon.json';

import type {
    GameMap,
    GameTile,
    TileType,
    TileObject,
    CardinalDir,
} from '../types/game';

// ─── Raw JSON shapes (loose, from dungeon.json) ────────────────────────────────

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
    maps: RawMap[];
}

// ─── Converter ────────────────────────────────────────────────────────────────

function normaliseTileType(raw: string): TileType {
    switch (raw) {
        case 'Floor':       return 'Floor';
        case 'Wall':        return 'Wall';
        case 'Door':        return 'Door';
        case 'Teleporter':  return 'Teleporter';
        case 'Pit':         return 'Pit';
        case 'Water':       return 'Water';
        case 'Stairs':      return 'Stairs';
        case 'StairsUp':    return 'StairsUp';
        case 'StairsDown':  return 'StairsDown';
        default:            return 'Floor'; // safe fallback
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
        state:       raw.state       as GameTile['state'],
        open:    raw.open,
        visible: raw.visible,
        objects: (raw.objects ?? []) as unknown as TileObject[],
    };
}

function buildMap(raw: RawMap): GameMap {
    // Initialise a [height][width] grid
    const tiles: GameTile[][] = Array.from(
        { length: raw.height },
        (_, y) => Array.from({ length: raw.width }, (__, x) => ({
            x, y, type: 'Wall' as TileType, objects: [],
        }))
    );

    for (const rawTile of raw.tiles) {
        tiles[rawTile.y][rawTile.x] = buildTile(rawTile);
    }

    return {
        index:      raw.index,
        name:       raw.name,
        level:      raw.level,
        width:      raw.width,
        height:     raw.height,
        difficulty: raw.difficulty,
        tiles,
    };
}

// ─── Exported maps ────────────────────────────────────────────────────────────

const dungeon = rawDungeon as unknown as RawDungeon;

/** All 14 dungeon maps, indexed by their map index (0–13). */
export const GAME_MAPS: GameMap[] = dungeon.maps.map(buildMap);

/** Get a map by its index. Throws if out of range. */
export function getGameMap(index: number): GameMap {
    const map = GAME_MAPS[index];
    if (!map) throw new Error(`Map index ${index} does not exist`);
    return map;
}

/** Champion start positions from dungeon.json (map 0 — Hall of Champions).
 *  Each entry: { portraitId, x, y, wallFace }
 *  Used in Phase 2 to place mirrors at the correct tile coordinates.
 */
export interface ChampionStartPos {
    portraitId: number;
    x: number;
    y: number;
    wallFace: CardinalDir;
}

export const CHAMPION_START_POSITIONS: ChampionStartPos[] =
    (rawDungeon as unknown as { champions: Array<{
        portraitId: number; x: number; y: number; wallFace: string;
    }> }).champions.map(c => ({
        portraitId: c.portraitId,
        x: c.x,
        y: c.y,
        wallFace: c.wallFace as CardinalDir,
    }));
