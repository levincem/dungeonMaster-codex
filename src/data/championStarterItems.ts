import { getStarterAutoEquipSlots } from './equipment';
import { resolveItemName } from './items';
import dungeonBootstrap from '../assets/runtime/dungeon/bootstrap.json';
import hallMapData from '../assets/runtime/dungeon/maps/level-00.json';
import type { ChampionEquipment, FloorItem, TileObject } from '../types/game';

type RawChampionStartRecord = {
    portraitId: number;
    x: number;
    y: number;
    map?: number;
};

type RawHallTile = {
    x: number;
    y: number;
    objects?: TileObject[];
};

type RawHallMap = {
    tiles: RawHallTile[];
};

type RawDungeonBootstrap = {
    champions: RawChampionStartRecord[];
};

type StarterItemSpec = {
    category: FloorItem['category'];
    typeId: number;
    rawName: string;
};

export interface ChampionStarterLoadout {
    equipped: StarterItemSpec[];
    inventory?: StarterItemSpec[];
}

const STARTER_ITEM_CATEGORIES = new Set<FloorItem['category']>([
    'Weapon',
    'Armor',
    'Potion',
    'Scroll',
    'Misc',
    'Container',
]);

type TileItemObject = Extract<TileObject, { category: FloorItem['category'] }> & {
    type: number;
    name?: string;
    rawName?: string;
};

type HallMirrorObject = Extract<TileObject, { category: 'Sensor' }> & {
    type: 127;
    data: number;
};

function isStarterItemObject(object: TileObject): object is TileItemObject {
    return STARTER_ITEM_CATEGORIES.has(object.category as FloorItem['category']);
}

function isHallMirrorObject(object: TileObject): object is HallMirrorObject {
    return object.category === 'Sensor' && object.type === 127 && typeof object.data === 'number';
}

function buildHallStarterSpecs(): Record<number, ChampionStarterLoadout> {
    const hallMap = hallMapData as RawHallMap;
    const championStarts = (dungeonBootstrap as RawDungeonBootstrap).champions.filter((entry) => (entry.map ?? 0) === 0);
    const starters: Record<number, ChampionStarterLoadout> = {};

    for (const tile of hallMap.tiles) {
        const objects = tile.objects ?? [];
        const mirror = objects.find(isHallMirrorObject);
        if (!mirror) continue;

        const equipped = objects
            .filter(isStarterItemObject)
            .map((object) => ({
                category: object.category,
                typeId: object.type,
                rawName: resolveItemName(
                    object.category,
                    object.type,
                    object.category === 'Scroll'
                        ? object.rawName
                        : object.name ?? object.rawName,
                ),
            }));

        starters[mirror.data] = { equipped };
    }

    for (const champion of championStarts) {
        starters[champion.portraitId] ??= { equipped: [] };
    }

    return starters;
}

export const CHAMPION_STARTER_LOADOUTS: Record<number, ChampionStarterLoadout> = buildHallStarterSpecs();

function buildStarterItem(
    championId: number,
    kind: 'equipped' | 'inventory',
    index: number,
    spec: StarterItemSpec,
): FloorItem {
    return {
        id: `starter_${championId}_${kind}_${index}_${spec.category}_${spec.typeId}`,
        category: spec.category,
        typeId: spec.typeId,
        rawName: spec.rawName,
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

export function buildChampionStarterLoadout(
    championId: number,
): { equipment: ChampionEquipment; inventory: FloorItem[] } {
    const loadout = CHAMPION_STARTER_LOADOUTS[championId] ?? { equipped: [], inventory: [] };
    const equipment: ChampionEquipment = {};
    const inventory: FloorItem[] = [];

    const equippedItems = loadout.equipped.map((spec, index) => buildStarterItem(championId, 'equipped', index, spec));
    const inventoryItems = (loadout.inventory ?? []).map((spec, index) => buildStarterItem(championId, 'inventory', index, spec));

    for (const item of equippedItems) {
        const preferredSlots = getStarterAutoEquipSlots(item);
        const targetSlot = preferredSlots.find((slot) => !equipment[slot]);
        if (targetSlot) equipment[targetSlot] = item;
        else inventory.push(item);
    }

    inventory.push(...inventoryItems);
    return { equipment, inventory };
}
