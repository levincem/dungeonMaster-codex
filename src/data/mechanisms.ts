import { getDungeonDataSync } from './dungeonData';
import { normalizeLookupName, resolveItemName } from './items';
import type {
    CardinalDir,
    FloorItem,
    GameMap,
    SensorAction,
    SensorObject,
    TileType,
} from '../types/game';

export type MechAction = SensorAction;

export type MechanismTrigger =
    | 'wall-button'
    | 'wall-lock'
    | 'logic-gate'
    | 'countdown'
    | 'alcove'
    | 'object-exchanger'
    | 'floor-pressure'
    | 'party-possession'
    | 'object-pressure'
    | 'generator'
    | 'special'
    | 'unknown';

export interface Mechanism {
    sensorIndex: number;
    sensorType: number;
    trigger: MechanismTrigger;
    x: number;
    y: number;
    face: CardinalDir;
    kind: string;
    support: TileType;
    action: MechAction;
    onceOnly: boolean;
    delay: number;
    target: { x: number; y: number } | null;
    targetTileType?: TileType;
    requires?: string;
    storedObject?: string;
}

type RawTile = {
    x: number;
    y: number;
    type: TileType;
    objects?: SensorObject[];
};

type RawMap = Pick<GameMap, 'index' | 'name'> & {
    tiles: RawTile[];
};

type RawDungeon = {
    maps: RawMap[];
};

const WALL_SENSOR_LABELS: Record<number, string> = {
    1: 'Levier / bouton mural',
    2: 'Bouton (objet quelconque requis)',
    3: 'Serrure (objet specifique)',
    4: 'Serrure (objet consomme)',
    5: 'Porte logique AND/OR',
    6: 'Compte a rebours',
    11: 'Serrure (objet consomme + rotation)',
    12: 'Generateur d objet mural',
    13: 'Alcove (depot/retrait objet)',
    16: 'Echangeur d objet',
    17: 'Serrure (objet consomme + suppression sensor)',
    18: 'Fin de jeu',
};

const FLOOR_SENSOR_LABELS: Record<number, string> = {
    1: 'Dalle de pression (tout)',
    2: 'Dalle de pression (creature)',
    3: 'Dalle de pression (groupe)',
    4: 'Dalle de pression (objet specifique)',
    5: 'Dalle d escalier',
    6: 'Generateur de groupe (sol)',
    7: 'Dalle de pression (creature uniquement)',
    8: 'Dalle de possession (groupe detient objet)',
    9: 'Verificateur de version',
};

const dungeon = getDungeonDataSync<RawDungeon>();

function getMechanismLabel(tileType: TileType, sensorType: number): string {
    const isWall = tileType === 'Wall' || tileType === 'TrickWall';
    return isWall
        ? (WALL_SENSOR_LABELS[sensorType] ?? `Type mural ${sensorType}`)
        : (FLOOR_SENSOR_LABELS[sensorType] ?? `Type sol ${sensorType}`);
}

function getMechanismTrigger(tileType: TileType, sensorType: number): MechanismTrigger {
    const isWall = tileType === 'Wall' || tileType === 'TrickWall';
    if (isWall) {
        if (sensorType === 5) return 'logic-gate';
        if (sensorType === 6) return 'countdown';
        if (sensorType === 13) return 'alcove';
        if (sensorType === 16) return 'object-exchanger';
        if (sensorType === 1 || sensorType === 2) return 'wall-button';
        if (sensorType === 3 || sensorType === 4 || sensorType === 11 || sensorType === 17) return 'wall-lock';
        if (sensorType === 18) return 'special';
        return 'unknown';
    }

    if (sensorType === 6) return 'generator';
    if (sensorType === 8) return 'party-possession';
    if (sensorType === 4) return 'object-pressure';
    if (sensorType === 1 || sensorType === 2 || sensorType === 3 || sensorType === 5 || sensorType === 7) return 'floor-pressure';
    return 'unknown';
}

function buildMechanismMap(map: RawMap): Mechanism[] {
    const mechanisms: Mechanism[] = [];
    for (const tile of map.tiles) {
        for (const object of tile.objects ?? []) {
            if (object.category !== 'Sensor') continue;
            if (object.type === 0 || object.type === 127) continue;
            const targetTile = map.tiles.find((entry) => entry.x === object.targetX && entry.y === object.targetY);
            mechanisms.push({
                sensorIndex: object.index,
                sensorType: object.type,
                trigger: getMechanismTrigger(tile.type, object.type),
                x: tile.x,
                y: tile.y,
                face: object.tilePos,
                kind: getMechanismLabel(tile.type, object.type),
                support: tile.type,
                action: object.action,
                onceOnly: object.onceOnly,
                delay: object.delay,
                target: object.targetX !== 0 || object.targetY !== 0
                    ? { x: object.targetX, y: object.targetY }
                    : null,
                targetTileType: targetTile?.type,
                requires: object.requiredObjectName,
                storedObject: object.type === 12 || object.type === 13 || object.type === 16
                    ? object.requiredObjectName
                    : undefined,
            });
        }
    }
    return mechanisms;
}

const MAP_MECHANISMS = dungeon.maps.map((map) => buildMechanismMap(map));

export function getMapMechanisms(level: number): Mechanism[] {
    return MAP_MECHANISMS[level] ?? [];
}

export function getMechanismsAt(level: number, x: number, y: number, face: CardinalDir): Mechanism[] {
    return getMapMechanisms(level).filter((mechanism) => mechanism.x === x && mechanism.y === y && mechanism.face === face);
}

export function isWallLockSensor(sensor: SensorObject): boolean {
    return sensor.type === 3 || sensor.type === 4 || sensor.type === 11 || sensor.type === 17;
}

export function isConsumableLockSensor(sensor: SensorObject): boolean {
    return sensor.type === 4 || sensor.type === 11 || sensor.type === 17;
}

export function isPartyPossessionSensor(sensor: SensorObject): boolean {
    return sensor.type === 8;
}

export function isSpecificObjectFloorSensor(sensor: SensorObject): boolean {
    return sensor.type === 4;
}

export function isCreatureOnlyFloorSensor(sensor: SensorObject): boolean {
    return sensor.type === 2 || sensor.type === 7;
}

export function isGeneratorSensor(sensor: SensorObject): boolean {
    return sensor.type === 6;
}

export function isWallAlcoveSensor(sensor: SensorObject): boolean {
    return sensor.type === 13;
}

export function isWallObjectExchangerSensor(sensor: SensorObject): boolean {
    return sensor.type === 16;
}

export function getRequiredSensorItemName(sensor: SensorObject): string | undefined {
    return sensor.requiredObjectName ?? LOCK_DATA_TO_NAME[sensor.data];
}

export function itemMatchesMechanismRequirement(item: FloorItem, requiredName: string | undefined): boolean {
    const normalizedRequired = normalizeLookupName(requiredName);
    if (!normalizedRequired) return false;

    if (normalizedRequired === 'zokathra spell') {
        const itemRaw = normalizeLookupName(item.rawName);
        const itemResolved = normalizeLookupName(resolveItemName(item.category, item.typeId, item.rawName));
        if (itemRaw === 'zokathra' || itemResolved === 'zokathra') return true;
    }

    const rawMatch = normalizeLookupName(item.rawName);
    if (rawMatch === normalizedRequired) return true;

    const resolvedName = resolveItemName(item.category, item.typeId, item.rawName);
    return normalizeLookupName(resolvedName) === normalizedRequired;
}

export function itemToLockData(category: string, typeId: number): number {
    if (category === 'Misc' || category === 'Weapon') return 128 + typeId;
    return 0;
}

export const LOCK_DATA_TO_NAME: Record<number, string> = {
    125: 'COPPER COIN',
    126: 'SILVER COIN',
    127: 'GOLD COIN',
    129: 'BLUE GEM',
    176: 'IRON KEY',
    177: 'KEY OF B',
    178: 'SOLID KEY',
    179: 'SQUARE KEY',
    180: 'TOURQUOISE KEY',
    181: 'CROSS KEY',
    183: 'SKELETON KEY',
    184: 'GOLD KEY',
    185: 'WINGED KEY',
    186: 'TOPAZ KEY',
    188: 'EMERALD KEY',
    189: 'RUBY KEY',
    190: 'RA KEY',
    191: 'MASTER KEY',
};
