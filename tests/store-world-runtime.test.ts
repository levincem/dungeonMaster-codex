import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoreWorldRuntime } from '../src/engine/systems/storeWorldRuntime.js';
import type { ChampionEquipment, CreatureInstance, FloorItem, GameMap, SensorObject, WallTextObject } from '../src/types/game.js';

function createMap(index: number, difficulty: number, tiles: GameMap['tiles']): GameMap {
    return {
        index,
        name: `Map ${index}`,
        level: index,
        width: tiles[0]?.length ?? 0,
        height: tiles.length,
        difficulty,
        tiles,
    };
}

function createBaseParams(
    maps: GameMap[],
    registeredTimers: Map<string, { mt: number; at: number }>,
    reservationCalls: Array<{
        partyLevel: number;
        level: number;
        creatures: CreatureInstance[];
        pendingGeneratorSpawns: unknown[];
    }>,
) {
    return {
        getGameMaps: (): GameMap[] => maps,
        getGameMap: (level: number): GameMap => maps.find((map) => map.index === level) ?? maps[0]!,
        getMapDifficulty: (level: number): number => maps.find((map) => map.index === level)?.difficulty ?? 1,
        creatureTypes: {
            7: { baseHP: 30, moveSpd: 12, atkSpd: 18, sizeOnTile: 0 },
            9: { baseHP: 10, moveSpd: 12, atkSpd: 18, sizeOnTile: 2 },
        },
        buildRuntimeCreatureGroupId: (
            kind: 'generator' | 'init',
            level: number,
            x: number,
            y: number,
            typeId: number,
        ) => `${kind}:${level}:${x}:${y}:${typeId}`,
        registerCreatureTimers: (id: string, timers: { mt: number; at: number }) => {
            registeredTimers.set(id, timers);
        },
        normalizeCreatureCells: (creatures: CreatureInstance[]) => creatures.map((creature, index) => ({
            ...creature,
            cell: index === 0 ? 'frontLeft' : creature.cell,
        })),
        resolveItemName: (category: FloorItem['category'], typeId: number, rawName?: string) => `${category}:${typeId}:${rawName ?? ''}`,
        normalizeScrollText: (text?: string) => `normalized:${text ?? ''}`,
        parseItemCharges: (rawName?: string) => rawName ? { charges: 2, maxCharges: 4 } : {},
        normaliseWaterContainer: (item: FloorItem): FloorItem => item.category === 'Container'
            ? { ...item, waterCharges: 1, waterMaxCharges: 1 }
            : item,
        buildChampionStarterLoadout: (championId: number) => ({
            equipment: {
                rightHand: {
                    id: `starter-equip-${championId}`,
                    category: 'Container',
                    typeId: 1,
                    mapIndex: 0,
                    x: 0,
                    y: 0,
                    tilePos: 'North',
                },
            } satisfies ChampionEquipment,
            inventory: [
                {
                    id: `starter-inv-${championId}`,
                    category: 'Container',
                    typeId: 2,
                    mapIndex: 0,
                    x: 0,
                    y: 0,
                    tilePos: 'North',
                } satisfies FloorItem,
            ],
        }),
        canMaterializeReservedGeneratorSpawnOnLevel: (
            partyLevel: number,
            level: number,
            creatures: CreatureInstance[],
            pendingGeneratorSpawns: unknown[],
        ) => {
            reservationCalls.push({ partyLevel, level, creatures, pendingGeneratorSpawns });
            return creatures.length === 0 && pendingGeneratorSpawns.length === 0;
        },
        isGeneratorSpawnBlocked: (
            state: { creatures: CreatureInstance[] },
            level: number,
            x: number,
            y: number,
        ) => state.creatures.some((creature) => creature.mapIndex === level && creature.x === x && creature.y === y),
        randomInt: () => 0,
        randomFraction: () => 0.5,
        now: () => 99,
    };
}

function createRuntime(
    maps: GameMap[],
    overrides: Partial<ReturnType<typeof createBaseParams>> = {},
) {
    const registeredTimers = new Map<string, { mt: number; at: number }>();
    const reservationCalls: Array<{
        partyLevel: number;
        level: number;
        creatures: CreatureInstance[];
        pendingGeneratorSpawns: unknown[];
    }> = [];

    const baseParams = createBaseParams(maps, registeredTimers, reservationCalls);

    const runtime = createStoreWorldRuntime({
        ...baseParams,
        ...overrides,
    });

    return { runtime, registeredTimers, reservationCalls };
}

test('store world runtime builds initial creatures with timer registration and normalized cells', () => {
    const maps = [
        createMap(0, 2, [[{
            x: 3,
            y: 4,
            type: 'Floor',
            objects: [{
                category: 'Creature',
                index: 2,
                tilePos: 'North',
                type: 7,
                hp: 0,
            }],
        }]]),
    ];
    const { runtime, registeredTimers } = createRuntime(maps);

    const creatures = runtime.buildCreatureInstances();

    assert.equal(creatures.length, 1);
    assert.deepEqual(creatures[0], {
        id: '0_3_4_2',
        groupId: 'init:0:3:4:7',
        typeId: 7,
        mapIndex: 0,
        x: 3,
        y: 4,
        currentHP: 30,
        alive: true,
        cell: 'frontLeft',
        carriedItems: [],
    });
    assert.deepEqual(registeredTimers.get('0_3_4_2'), {
        mt: 1,
        at: 1.5,
    });
});

test('store world runtime expands placed creature groups with per-member HP values from map data', () => {
    const maps = [
        createMap(0, 2, [[{
            x: 3,
            y: 4,
            type: 'Floor',
            objects: [{
                category: 'Creature',
                index: 2,
                tilePos: 'North',
                type: 7,
                hp: [21, 32],
                count: 2,
                positions: 255,
            }],
        }]]),
    ];
    const { runtime, registeredTimers } = createRuntime(maps);

    const creatures = runtime.buildCreatureInstances();

    assert.equal(creatures.length, 2);
    assert.deepEqual(
        creatures.map((creature) => ({
            id: creature.id,
            groupId: creature.groupId,
            currentHP: creature.currentHP,
            cell: creature.cell,
        })),
        [
            {
                id: '0_3_4_2_0',
                groupId: 'init:0:3:4:7',
                currentHP: 21,
                cell: 'frontLeft',
            },
            {
                id: '0_3_4_2_1',
                groupId: 'init:0:3:4:7',
                currentHP: 32,
                cell: 'center',
            },
        ],
    );
    assert.deepEqual(registeredTimers.get('0_3_4_2_0'), {
        mt: 1,
        at: 1.5,
    });
    assert.deepEqual(registeredTimers.get('0_3_4_2_1'), {
        mt: 1,
        at: 1.5,
    });
});

test('store world runtime hydrates original special creature possessions without duplicating them across a group', () => {
    const maps = [
        createMap(3, 2, [[{
            x: 21,
            y: 24,
            type: 'Floor',
            objects: [{
                category: 'Creature',
                index: 7,
                tilePos: 'North',
                type: 7,
                hp: [21, 32],
                count: 2,
                possession: { pos: 0, category: 10, index: 36 },
                raw: { possessionWord: 10276 },
            }],
        }]]),
    ];
    const { runtime } = createRuntime(maps);

    const creatures = runtime.buildCreatureInstances();

    assert.equal(creatures.length, 2);
    assert.deepEqual(
        creatures.map((creature) => creature.carriedItems?.map((item) => item.rawName) ?? []),
        [
            ['Misc:8:Gold Coin'],
            [],
        ],
    );
});

test('store world runtime preserves chained original creature possessions', () => {
    const maps = [
        createMap(1, 2, [[{
            x: 8,
            y: 24,
            type: 'Floor',
            objects: [{
                category: 'Creature',
                index: 6,
                tilePos: 'North',
                type: 7,
                hp: 11,
                possession: { pos: 0, category: 5, index: 23 },
                raw: { possessionWord: 5143 },
            }],
        }]]),
    ];
    const { runtime } = createRuntime(maps);

    const creatures = runtime.buildCreatureInstances();
    const carriedItems = creatures[0]?.carriedItems ?? [];

    assert.deepEqual(
        carriedItems.map((item) => ({
            rawName: item.rawName,
            potionPower: item.potionPower,
        })),
        [
            { rawName: 'Weapon:2:Torch', potionPower: undefined },
            { rawName: 'Potion:20:Empty Flask', potionPower: 0 },
        ],
    );
});

test('store world runtime can build creatures and floor items for a single level only', () => {
    const maps = [
        createMap(0, 1, [[{
            x: 0,
            y: 0,
            type: 'Floor',
            objects: [{ category: 'Creature', index: 0, tilePos: 'North', type: 7, hp: 10 }],
        }]]),
        createMap(1, 1, [[{
            x: 1,
            y: 1,
            type: 'Floor',
            objects: [{ category: 'Weapon', index: 1, tilePos: 'South', type: 4 }],
        }]]),
    ];
    const { runtime } = createRuntime(maps);

    const levelZeroCreatures = runtime.buildCreatureInstancesForLevel(0);
    const levelOneItems = runtime.buildFloorItemsForLevel(1);

    assert.equal(levelZeroCreatures.length, 1);
    assert.equal(levelZeroCreatures[0]?.mapIndex, 0);
    assert.equal(levelOneItems.length, 1);
    assert.equal(levelOneItems[0]?.mapIndex, 1);
});

test('store world runtime builds floor items while skipping the hall champion tile', () => {
    const maps = [
        createMap(0, 1, [[
            {
                x: 0,
                y: 0,
                type: 'Floor',
                objects: [
                    {
                        category: 'Sensor',
                        index: 0,
                        tilePos: 'North',
                        type: 0,
                        data: 0,
                        graphic: 0,
                        isLocal: false,
                        delay: 0,
                        sound: false,
                        revert: false,
                        action: 'Set',
                        onceOnly: false,
                        targetY: 0,
                        targetX: 0,
                        targetDir: 'North',
                        championGraphic: 1,
                    } as unknown as SensorObject,
                    {
                        category: 'Weapon',
                        index: 1,
                        tilePos: 'North',
                        type: 4,
                    },
                ],
            },
            {
                x: 1,
                y: 0,
                type: 'Floor',
                objects: [
                    {
                        category: 'Scroll',
                        index: 2,
                        tilePos: 'East',
                        type: 5,
                        text: 'FUL BRO KU',
                    } as unknown as WallTextObject,
                    {
                        category: 'Container',
                        index: 3,
                        tilePos: 'South',
                        type: 6,
                        name: 'Waterskin',
                    } as unknown as WallTextObject,
                ],
            },
        ]]),
    ];
    const { runtime } = createRuntime(maps);

    const items = runtime.buildFloorItems();

    assert.equal(items.length, 2);
    assert.equal(items[0]?.id, '0_1_0_Scroll_2');
    assert.equal(items[0]?.rawName, 'Scroll:5:normalized:FUL BRO KU');
    assert.equal(items[0]?.actionCharges, 2);
    assert.equal(items[0]?.actionMaxCharges, 4);
    assert.equal(items[1]?.id, '0_1_0_Container_3');
    assert.equal(items[1]?.waterCharges, 1);
    assert.equal(items[1]?.waterMaxCharges, 1);
});

test('store world runtime hydrates action charges from runtime map objects', () => {
    const maps = [
        createMap(0, 1, [[{
            x: 1,
            y: 2,
            type: 'Floor',
            objects: [
                {
                    category: 'Weapon',
                    index: 4,
                    tilePos: 'North',
                    type: 0,
                    name: 'Eye Of Time',
                    charges: 5,
                } as unknown as WallTextObject,
            ],
        }]]),
    ];
    const { runtime } = createRuntime(maps, {
        parseItemCharges: () => ({}),
    });

    const items = runtime.buildFloorItems();

    assert.equal(items[0]?.actionCharges, 5);
    assert.equal(items[0]?.actionMaxCharges, 5);
});

test('store world runtime preserves nested contents for dungeon chests', () => {
    const maps = [
        createMap(1, 1, [[{
            x: 4,
            y: 6,
            type: 'Floor',
            objects: [
                {
                    category: 'Container',
                    index: 9,
                    tilePos: 'West',
                    type: 0,
                    name: 'Chest',
                    contents: [
                        {
                            category: 'Misc',
                            index: 10,
                            tilePos: 'North',
                            type: 35,
                            name: 'Drumstick',
                        },
                        {
                            category: 'Weapon',
                            index: 11,
                            tilePos: 'North',
                            type: 3,
                            name: 'Dagger',
                        },
                    ],
                } as unknown as WallTextObject,
            ],
        }]]),
    ];
    const { runtime } = createRuntime(maps);

    const items = runtime.buildFloorItems();
    const chest = items[0];

    assert.equal(chest?.category, 'Container');
    assert.equal(chest?.containerContents?.length, 2);
    assert.equal(chest?.containerContents?.[0]?.rawName, 'Misc:35:Drumstick');
    assert.equal(chest?.containerContents?.[1]?.rawName, 'Weapon:3:Dagger');
});

test('store world runtime forwards generator reservation checks and difficulty-based creature spawning', () => {
    const maps = [createMap(2, 4, [[{ x: 0, y: 0, type: 'Floor', objects: [] }]])];
    const { runtime, registeredTimers, reservationCalls } = createRuntime(maps);

    const canSpawn = runtime.canApproximateOriginalReservedGeneratorSpawn({
        currentLevel: 2,
        creatures: [],
        pendingGeneratorSpawns: [],
    }, 2);
    const creatures = runtime.createGeneratedCreatureGroupInstances(2, 3, 4, 9, 0, 1, 'group-1');

    assert.equal(canSpawn, true);
    assert.deepEqual(reservationCalls, [{
        partyLevel: 2,
        level: 2,
        creatures: [],
        pendingGeneratorSpawns: [],
    }]);
    assert.equal(creatures.length, 1);
    assert.equal(creatures[0]?.groupId, 'group-1');
    assert.equal(creatures[0]?.currentHP, 40);
    assert.equal(creatures[0]?.alive, true);
    assert.match(creatures[0]?.id ?? '', /^gen_2_3_4_9_99_0_/);
    assert.equal(registeredTimers.size, 1);
});

test('store world runtime normalizes starter loadouts and discovers open world markers', () => {
    const maps = [
        createMap(1, 1, [[{
            x: 2,
            y: 5,
            type: 'Teleporter',
            open: true,
            objects: [
                {
                    category: 'Text',
                    index: 7,
                    tilePos: 'West',
                    visible: true,
                },
            ],
        }]]),
        createMap(2, 1, [[{
            x: 1,
            y: 4,
            type: 'Pit',
            open: true,
            objects: [],
        }]]),
    ];
    const { runtime } = createRuntime(maps);

    const loadout = runtime.getChampionStarterLoadout(12);

    assert.equal(loadout.equipment.rightHand?.waterCharges, 1);
    assert.equal(loadout.inventory[0]?.waterCharges, 1);
    assert.deepEqual([...runtime.buildOpenTeleporters()], ['1,5,2']);
    assert.deepEqual([...runtime.buildVisibleTexts()], ['1_2_5_7']);
    assert.deepEqual([...runtime.buildOpenPits()], ['2,4,1']);
});
