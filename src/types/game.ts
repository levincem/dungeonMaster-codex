// Rich tile and map types — derived from the canonical extracted dungeon data structure

import type { EquipSlotKey } from './items';

export type CardinalDir = 'North' | 'East' | 'South' | 'West';

export type TileType =
    | 'Floor'
    | 'Wall'
    | 'TrickWall'
    | 'Door'
    | 'Teleporter'
    | 'Pit'
    | 'Water'
    | 'Stairs'
    | 'StairsUp'
    | 'StairsDown';

// ─── Tile objects ──────────────────────────────────────────────────────────────

export interface DoorObject {
    category: 'Door';
    index: number;
    tilePos: CardinalDir;
    destructChop: boolean;
    destructFire: boolean;
    hasButton: boolean;
    openDirection: 'Horizontal' | 'Vertical';
    ornate: number;
    doorType: number;
}

export interface TeleporterObject {
    category: 'Teleporter';
    index: number;
    tilePos: CardinalDir;
    globalX?: number;
    globalY?: number;
    sound: boolean;
    scope: string;
    rotationType: number;
    rotation: CardinalDir;
    destX: number;
    destY: number;
    destMap: number;
    destGlobalX?: number;
    destGlobalY?: number;
}

export type SensorAction = 'Set' | 'Clear' | 'Toggle' | 'Hold';

export interface SensorObject {
    category: 'Sensor';
    index: number;
    tilePos: CardinalDir;
    globalX?: number;
    globalY?: number;
    type: number;
    data: number;
    graphic: number;
    isLocal: boolean;
    multipleValue?: number;
    delay: number;
    sound: boolean;
    revert: boolean;
    action: SensorAction;
    onceOnly: boolean;
    targetY: number;
    targetX: number;
    targetGlobalY?: number;
    targetGlobalX?: number;
    targetDir: CardinalDir;
    kineticEnergy?: number;
    stepEnergy?: number;
    requiredObjectType?: number;
    requiredObjectName?: string;
}

export interface WallTextObject {
    category: 'Text';
    index: number;
    tilePos: CardinalDir;
    globalX?: number;
    globalY?: number;
    visible: boolean;
    text?: string;
}

export interface CreatureObject {
    category: 'Creature';
    index: number;
    tilePos: CardinalDir;
    globalX?: number;
    globalY?: number;
    type: number;   // creature type id from extracted original data
    hp: number;
}

export interface WeaponObject {
    category: 'Weapon';
    index: number;
    tilePos: CardinalDir;
    globalX?: number;
    globalY?: number;
    type: number;
}

export interface ArmorObject {
    category: 'Armor';
    index: number;
    tilePos: CardinalDir;
    globalX?: number;
    globalY?: number;
    type: number;
}

export interface PotionObject {
    category: 'Potion';
    index: number;
    tilePos: CardinalDir;
    globalX?: number;
    globalY?: number;
    type: number;
    power?: number;
}

export interface ScrollObject {
    category: 'Scroll';
    index: number;
    tilePos: CardinalDir;
    globalX?: number;
    globalY?: number;
    type: number;
}

export interface MiscObject {
    category: 'Misc';
    index: number;
    tilePos: CardinalDir;
    globalX?: number;
    globalY?: number;
    type: number;
    name: string;
    important?: boolean;
}

export interface ContainerObject {
    category: 'Container';
    index: number;
    tilePos: CardinalDir;
    globalX?: number;
    globalY?: number;
    type: number;
}

export type TileObject =
    | DoorObject
    | TeleporterObject
    | SensorObject
    | WallTextObject
    | CreatureObject
    | WeaponObject
    | ArmorObject
    | PotionObject
    | ScrollObject
    | MiscObject
    | ContainerObject;

// ─── Tile & Map ────────────────────────────────────────────────────────────────

export interface GameTile {
    x: number;
    y: number;
    globalX?: number;
    globalY?: number;
    type: TileType;
    // Which wall faces allow decorations
    allowDecoN?: boolean;
    allowDecoE?: boolean;
    allowDecoS?: boolean;
    allowDecoW?: boolean;
    // Door-specific
    orientation?: 'NorthSouth' | 'EastWest' | 'WestEast';
    state?: 'Open' | 'Closed';
    // Teleporter-specific
    open?: boolean;
    visible?: boolean;
    // All objects placed on this tile
    objects: TileObject[];
}

export interface GameMap {
    index: number;
    name: string;
    level: number;
    width: number;
    height: number;
    difficulty: number;
    mapOffset?: { x: number; y: number };
    localBounds?: { minX: number; minY: number; maxX: number; maxY: number };
    globalBounds?: { minX: number; minY: number; maxX: number; maxY: number };
    // 2D grid indexed as tiles[y][x]
    tiles: GameTile[][];
}

// ─── Runtime instances ─────────────────────────────────────────────────────────

/** Sub-position within a tile, modeled after the original group cells. */
export type CreatureCell = 'center' | 'frontLeft' | 'frontRight' | 'backLeft' | 'backRight';

/** A creature alive in the dungeon */
export interface CreatureInstance {
    id: string;          // unique per-spawn id
    groupId?: string;    // shared by creatures belonging to the same original group
    typeId: number;      // references CREATURE_TYPES
    mapIndex: number;
    x: number;
    y: number;
    currentHP: number;
    alive: boolean;
    /** Sub-position within the tile */
    cell: CreatureCell;
    carriedItems?: FloorItem[];
    fixedDropsDropped?: boolean;
}

/** An item lying on the dungeon floor */
export interface FloorItem {
    id: string;
    category: 'Weapon' | 'Armor' | 'Potion' | 'Scroll' | 'Misc' | 'Container';
    typeId: number;
    /** Raw name from dungeon.json — may be a placeholder like "Misc_29" */
    rawName?: string;
    cursed?: boolean;
    mapIndex: number;
    x: number;
    y: number;
    tilePos: CardinalDir;
    actionCharges?: number;
    actionMaxCharges?: number;
    potionPower?: number;
    waterCharges?: number;
    waterMaxCharges?: number;
    /** Set on bones items (Misc typeId 5) - links to the dead champion's id */
    championId?: number;
}

/** Per-champion equipped items, keyed by slot. */
export type ChampionEquipment = Partial<Record<EquipSlotKey, FloorItem>>;
