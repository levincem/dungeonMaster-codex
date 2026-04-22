import type {
    ChampionEquipment,
    CreatureObject,
    CreatureInstance,
    FloorItemObject,
    FloorItem,
    GameMap,
    SensorObject,
    WallTextObject,
} from '../../types/game';
import {
    buildGeneratedCreatureGroupPlan as buildGeneratedCreatureGroupPlanSystem,
    createGeneratedCreatureGroupInstances as createGeneratedCreatureGroupInstancesSystem,
    type GeneratedCreatureGroupPlanEntry,
} from './generatedCreatureGroups';

type CreatureDefinitionLike = {
    baseHP: number;
    moveSpd: number;
    atkSpd: number;
    sizeOnTile?: number;
};

type SensorStateLike = {
    currentLevel: number;
    creatures: CreatureInstance[];
    pendingGeneratorSpawns: unknown[];
};

type StoreWorldRuntimeParams<TSensorState extends SensorStateLike> = {
    getGameMaps: () => GameMap[];
    getGameMap: (level: number) => GameMap;
    getMapDifficulty: (level: number) => number;
    creatureTypes: Record<number, CreatureDefinitionLike | undefined>;
    buildRuntimeCreatureGroupId: (
        kind: 'generator' | 'init',
        level: number,
        x: number,
        y: number,
        typeId: number,
    ) => string;
    registerCreatureTimers: (id: string, timers: { mt: number; at: number }) => void;
    normalizeCreatureCells: (creatures: CreatureInstance[]) => CreatureInstance[];
    resolveItemName: (category: FloorItem['category'], typeId: number, rawName?: string) => string;
    normalizeScrollText: (text?: string) => string | undefined;
    parseItemCharges: (rawName: string | undefined) => { charges?: number; maxCharges?: number };
    normaliseWaterContainer: (item: FloorItem) => FloorItem;
    buildChampionStarterLoadout: (
        championId: number,
    ) => { equipment: ChampionEquipment; inventory: FloorItem[] };
    canMaterializeReservedGeneratorSpawnOnLevel: (
        partyLevel: number,
        level: number,
        creatures: TSensorState['creatures'],
        pendingGeneratorSpawns: TSensorState['pendingGeneratorSpawns'],
    ) => boolean;
    isGeneratorSpawnBlocked: (state: TSensorState, level: number, x: number, y: number) => boolean;
    randomInt: (maxExclusive: number) => number;
    randomFraction?: () => number;
    now?: () => number;
};

const ITEM_CATEGORIES = new Set<FloorItem['category']>([
    'Weapon',
    'Armor',
    'Potion',
    'Scroll',
    'Misc',
    'Container',
]);

const MAX_CONTAINER_ITEMS = 8;

function getOriginalGeneratorEffectiveHealthMultiplier(
    level: number,
    hpMultiplier: number,
    getMapDifficulty: (level: number) => number,
): number {
    if (hpMultiplier > 0) return hpMultiplier;
    return Math.max(1, getMapDifficulty(level));
}

function getPlacedCreatureHPValues(
    creature: CreatureObject,
    fallbackHP: number,
): number[] {
    if (Array.isArray(creature.hp) && creature.hp.length > 0) {
        return creature.hp.map((hp) => (typeof hp === 'number' && hp > 0 ? hp : fallbackHP));
    }

    if (typeof creature.count === 'number' && creature.count > 1) {
        const hp = typeof creature.hp === 'number' && creature.hp > 0 ? creature.hp : fallbackHP;
        return Array.from({ length: creature.count }, () => hp);
    }

    const singleHP = typeof creature.hp === 'number' && creature.hp > 0 ? creature.hp : fallbackHP;
    return [singleHP];
}

export function createStoreWorldRuntime<TSensorState extends SensorStateLike>(
    params: StoreWorldRuntimeParams<TSensorState>,
) {
    const randomFraction = params.randomFraction ?? Math.random;
    const now = params.now ?? Date.now;

    const buildRuntimeFloorItem = (
        map: GameMap,
        tile: { x: number; y: number },
        obj: FloorItemObject,
        id: string,
    ): FloorItem => {
        const rawObj = obj as FloorItemObject & {
            power?: number;
            name?: string;
            text?: string;
            contents?: FloorItemObject[];
        };
        const rawText = rawObj.text ?? rawObj.name;
        const parsedCharges = params.parseItemCharges(rawText);
        const runtimeItem = params.normaliseWaterContainer({
            id,
            category: obj.category as FloorItem['category'],
            typeId: rawObj.type ?? 0,
            rawName: params.resolveItemName(
                obj.category as FloorItem['category'],
                rawObj.type ?? 0,
                obj.category === 'Scroll'
                    ? params.normalizeScrollText(rawText)
                    : rawText,
            ),
            mapIndex: map.index,
            x: tile.x,
            y: tile.y,
            tilePos: obj.tilePos,
            actionCharges: parsedCharges.charges,
            actionMaxCharges: parsedCharges.maxCharges,
            potionPower: obj.category === 'Potion' ? rawObj.power : undefined,
        });

        if (obj.category !== 'Container') return runtimeItem;

        const nestedItems = (rawObj.contents ?? [])
            .slice(0, MAX_CONTAINER_ITEMS)
            .filter((entry): entry is FloorItemObject => ITEM_CATEGORIES.has(entry.category as FloorItem['category']))
            .map((entry, index) =>
                buildRuntimeFloorItem(
                    map,
                    tile,
                    entry,
                    `${id}_contained_${index}_${entry.category}_${entry.index}`,
                ),
            );
        return nestedItems.length > 0
            ? { ...runtimeItem, containerContents: nestedItems }
            : runtimeItem;
    };

    const normalizeRuntimeItemTree = (item: FloorItem): FloorItem => {
        const normalizedItem = params.normaliseWaterContainer({ ...item });
        return normalizedItem.containerContents?.length
            ? {
                ...normalizedItem,
                containerContents: normalizedItem.containerContents.map(normalizeRuntimeItemTree),
            }
            : normalizedItem;
    };

    const buildCreatureInstancesForMap = (map: GameMap): CreatureInstance[] => {
        const instances: CreatureInstance[] = [];

        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Creature') continue;
                    const definition = params.creatureTypes[obj.type];
                    if (!definition) continue;
                    const moveSec = definition.moveSpd / 6;
                    const atkSec = definition.atkSpd / 6;
                    const groupId = params.buildRuntimeCreatureGroupId(
                        'init',
                        map.index,
                        tile.x,
                        tile.y,
                        obj.type,
                    );
                    const hpValues = getPlacedCreatureHPValues(obj as CreatureObject, definition.baseHP);
                    hpValues.forEach((currentHP, ordinal) => {
                        const id = hpValues.length > 1
                            ? `${map.index}_${tile.x}_${tile.y}_${obj.index}_${ordinal}`
                            : `${map.index}_${tile.x}_${tile.y}_${obj.index}`;
                        params.registerCreatureTimers(id, {
                            mt: randomFraction() * moveSec,
                            at: randomFraction() * atkSec,
                        });
                        instances.push({
                            id,
                            groupId,
                            typeId: obj.type,
                            mapIndex: map.index,
                            x: tile.x,
                            y: tile.y,
                            currentHP,
                            alive: true,
                            cell: 'center',
                            carriedItems: [],
                        });
                    });
                }
            }
        }

        return params.normalizeCreatureCells(instances);
    };

    const buildCreatureInstances = (): CreatureInstance[] =>
        params.getGameMaps().flatMap((map) => buildCreatureInstancesForMap(map));

    const buildCreatureInstancesForLevel = (level: number): CreatureInstance[] =>
        buildCreatureInstancesForMap(params.getGameMap(level));

    const canApproximateOriginalReservedGeneratorSpawn = (
        state: TSensorState,
        level: number,
    ): boolean =>
        params.canMaterializeReservedGeneratorSpawnOnLevel(
            state.currentLevel,
            level,
            state.creatures,
            state.pendingGeneratorSpawns,
        );

    const createGeneratedCreatureGroupInstances = (
        level: number,
        x: number,
        y: number,
        typeId: number,
        hpMultiplier: number,
        creatureCount: number,
        groupId: string,
    ): CreatureInstance[] => createGeneratedCreatureGroupInstancesSystem(
        level,
        x,
        y,
        typeId,
        hpMultiplier,
        creatureCount,
        groupId,
        {
            getCreatureDefinition: (spawnTypeId) => params.creatureTypes[spawnTypeId],
            getEffectiveHealthMultiplier: (spawnLevel, spawnHpMultiplier) =>
                getOriginalGeneratorEffectiveHealthMultiplier(
                    spawnLevel,
                    spawnHpMultiplier,
                    params.getMapDifficulty,
                ),
            randomInt: params.randomInt,
            createCreatureId: (spawnLevel, spawnX, spawnY, spawnTypeId, ordinal) =>
                `gen_${spawnLevel}_${spawnX}_${spawnY}_${spawnTypeId}_${now()}_${ordinal}_${Math.random().toString(36).slice(2)}`,
            registerCreatureTimers: (id, timers) => {
                params.registerCreatureTimers(id, timers);
            },
            createCreature: ({
                id,
                groupId: nextGroupId,
                typeId: nextTypeId,
                mapIndex,
                currentHP,
                cell,
            }) => ({
                id,
                groupId: nextGroupId,
                typeId: nextTypeId,
                mapIndex,
                x,
                y,
                currentHP,
                alive: true,
                cell,
                carriedItems: [],
            }),
        },
    );

    const buildPendingGeneratedCreatureGroup = (
        level: number,
        x: number,
        y: number,
        typeId: number,
        hpMultiplier: number,
        creatureCount: number,
        groupId: string,
    ): GeneratedCreatureGroupPlanEntry[] => buildGeneratedCreatureGroupPlanSystem(
        level,
        x,
        y,
        typeId,
        hpMultiplier,
        creatureCount,
        groupId,
        {
            getCreatureDefinition: (spawnTypeId) => params.creatureTypes[spawnTypeId],
            getEffectiveHealthMultiplier: (spawnLevel, spawnHpMultiplier) =>
                getOriginalGeneratorEffectiveHealthMultiplier(
                    spawnLevel,
                    spawnHpMultiplier,
                    params.getMapDifficulty,
                ),
            randomInt: params.randomInt,
            randomFraction,
            createCreatureId: (spawnLevel, spawnX, spawnY, spawnTypeId, ordinal) =>
                `gen_${spawnLevel}_${spawnX}_${spawnY}_${spawnTypeId}_${now()}_${ordinal}_${Math.random().toString(36).slice(2)}`,
        },
    );

    const materializePendingGeneratedCreatureGroup = (
        plan: GeneratedCreatureGroupPlanEntry[],
    ): CreatureInstance[] => {
        for (const entry of plan) {
            params.registerCreatureTimers(entry.id, {
                mt: entry.moveTimer,
                at: entry.attackTimer,
            });
        }

        return plan.map((entry) => ({
            id: entry.id,
            groupId: entry.groupId,
            typeId: entry.typeId,
            mapIndex: entry.mapIndex,
            x: entry.x,
            y: entry.y,
            currentHP: entry.currentHP,
            alive: true,
            cell: entry.cell,
            carriedItems: [],
        }));
    };

    const buildFloorItemsForMap = (map: GameMap): FloorItem[] => {
        const items: FloorItem[] = [];

        for (const row of map.tiles) {
            for (const tile of row) {
                const isHallChampionTile =
                    map.index === 0 &&
                    tile.objects.some((obj) =>
                        obj.category === 'Sensor' &&
                        (obj as SensorObject & { championGraphic?: number }).championGraphic !== undefined,
                    );
                for (const obj of tile.objects) {
                    if (!ITEM_CATEGORIES.has(obj.category as FloorItem['category'])) continue;
                    if (isHallChampionTile) continue;
                    items.push(buildRuntimeFloorItem(
                        map,
                        tile,
                        obj as FloorItemObject,
                        `${map.index}_${tile.x}_${tile.y}_${obj.category}_${obj.index}`,
                    ));
                }
            }
        }

        return items;
    };

    const buildFloorItems = (): FloorItem[] =>
        params.getGameMaps().flatMap((map) => buildFloorItemsForMap(map));

    const buildFloorItemsForLevel = (level: number): FloorItem[] =>
        buildFloorItemsForMap(params.getGameMap(level));

    const getChampionStarterLoadout = (championId: number): {
        equipment: ChampionEquipment;
        inventory: FloorItem[];
    } => {
        const loadout = params.buildChampionStarterLoadout(championId);
        return {
            equipment: Object.fromEntries(
                Object.entries(loadout.equipment).map(([slot, item]) => [
                    slot,
                    item ? normalizeRuntimeItemTree(item) : item,
                ]),
            ) as ChampionEquipment,
            inventory: loadout.inventory.map((item) => normalizeRuntimeItemTree(item)),
        };
    };

    const buildOpenTeleporters = (): Set<string> => {
        const open = new Set<string>();
        for (const map of params.getGameMaps()) {
            for (const row of map.tiles) {
                for (const tile of row) {
                    if (tile.type === 'Teleporter' && tile.open) {
                        open.add(`${map.index},${tile.y},${tile.x}`);
                    }
                }
            }
        }
        return open;
    };

    const buildVisibleTexts = (): Set<string> => {
        const visible = new Set<string>();
        for (const map of params.getGameMaps()) {
            for (const row of map.tiles) {
                for (const tile of row) {
                    for (const obj of tile.objects) {
                        if (obj.category !== 'Text') continue;
                        if ((obj as WallTextObject).visible) {
                            visible.add(`${map.index}_${tile.x}_${tile.y}_${obj.index}`);
                        }
                    }
                }
            }
        }
        return visible;
    };

    const buildOpenPits = (): Set<string> => {
        const open = new Set<string>();
        for (const map of params.getGameMaps()) {
            for (const row of map.tiles) {
                for (const tile of row) {
                    if (tile.type === 'Pit' && tile.open) {
                        open.add(`${map.index},${tile.y},${tile.x}`);
                    }
                }
            }
        }
        return open;
    };

    return {
        buildCreatureInstances,
        buildCreatureInstancesForLevel,
        buildFloorItems,
        buildFloorItemsForLevel,
        buildOpenPits,
        buildOpenTeleporters,
        buildVisibleTexts,
        buildPendingGeneratedCreatureGroup,
        canApproximateOriginalReservedGeneratorSpawn,
        createGeneratedCreatureGroupInstances,
        getChampionStarterLoadout,
        isGeneratorSpawnBlocked: params.isGeneratorSpawnBlocked,
        materializePendingGeneratedCreatureGroup,
    };
}
