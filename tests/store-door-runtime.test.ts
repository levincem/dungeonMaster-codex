import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Champion } from '../src/types/champion.js';
import type { ChampionCombat, DamageEvent } from '../src/engine/runtimeTypes.js';
import { normalizeCreatureCellsOnTile as normalizeCreatureCellsOnTileSystem } from '../src/engine/systems/creatureTileState.js';
import {
    buildStoreCombatTickPatch,
    buildStoreTickDoorsPatch,
    buildStoreToggleDoorPatch,
} from '../src/engine/systems/storeDoorRuntime.js';

const normalizeCreatureCellsOnTile = <TCreature extends {
    id: string;
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
}>(creatures: TCreature[], level: number, x: number, y: number) => {
    const tileCreatures = creatures.filter((creature) =>
        creature.alive &&
        creature.mapIndex === level &&
        creature.x === x &&
        creature.y === y &&
        'typeId' in creature &&
        'cell' in creature,
    );
    if (tileCreatures.length === 0) return creatures;
    return normalizeCreatureCellsOnTileSystem(
        creatures as Array<TCreature & {
            typeId: number;
            cell: 'center' | 'frontLeft' | 'frontRight' | 'backLeft' | 'backRight';
        }>,
        level,
        x,
        y,
        () => 4,
    ) as TCreature[];
};

test('buildStoreToggleDoorPatch opens a closed door and clears an existing crush cycle', () => {
    const motions: Array<{ duration: number; volume: number }> = [];
    const result = buildStoreToggleDoorPatch(
        {
            level: 0,
            brokenDoors: new Set<string>(),
            openDoors: new Set<string>(),
            crushingDoors: { '0,5,6': { phase: 'closing', timer: 0.5 } },
            creatures: [],
        },
        6,
        5,
        {
            hasDoorButton: () => true,
            isDoorControlledByMechanism: () => false,
            isDoorLockedByWallSensor: () => false,
            playDoorMotion: (duration, volume) => motions.push({ duration, volume }),
            getDoorSoundVolume: () => 0.5,
            doorToggleSoundDurationMs: 1000,
            doorCloseDurationSeconds: 1,
        },
    );

    assert.deepEqual([...result.openDoors ?? []], ['0,5,6']);
    assert.deepEqual(result.crushingDoors, {});
    assert.deepEqual(motions, [{ duration: 1000, volume: 0.5 }]);
});

test('buildStoreToggleDoorPatch ignores clicks on doors without a button', () => {
    const motions: Array<{ duration: number; volume: number }> = [];
    const state = {
        level: 0,
        brokenDoors: new Set<string>(),
        openDoors: new Set<string>(),
        crushingDoors: {},
        creatures: [],
    };

    const result = buildStoreToggleDoorPatch(
        state,
        6,
        5,
        {
            hasDoorButton: () => false,
            isDoorControlledByMechanism: () => false,
            isDoorLockedByWallSensor: () => false,
            playDoorMotion: (duration, volume) => motions.push({ duration, volume }),
            getDoorSoundVolume: () => 0.5,
            doorToggleSoundDurationMs: 1000,
            doorCloseDurationSeconds: 1,
        },
    );

    assert.equal(result, state);
    assert.deepEqual(motions, []);
});

test('buildStoreTickDoorsPatch delegates door crush progress and emits damage', () => {
    const bumps: number[] = [];
    const result = buildStoreTickDoorsPatch(
        {
            crushingDoors: { '0,5,6': { phase: 'closing', timer: 0.1 } },
            openDoors: new Set<string>(),
            creatures: [{ id: 'creature-1', alive: true, mapIndex: 0, x: 6, y: 5, currentHP: 10 }],
            damageEvents: [],
            floorItems: [] as Array<{ id: string }>,
            spellVisualEvents: [] as Array<{ id: string }>,
        },
        0.2,
        {
            doorReboundDurationSeconds: 0.3,
            doorRecloseDurationSeconds: 0.4,
            buildCreatureDamageEvent: (_level, _x, _y, amount, creatureId) => ({ amount, creatureId }),
            dropCreatureCarriedItems: (creatures, floorItems) => ({ creatures, floorItems }),
            normalizeCreatureCellsOnTile,
            buildDeathDustEvent: (_level, _x, _y) => ({ id: 'unused-death' }),
            playWallBump: () => {
                bumps.push(1);
            },
        },
    );

    assert.ok(result);
    assert.equal(result?.damageEvents?.length, 1);
    assert.equal(result?.crushingDoors?.['0,5,6']?.phase, 'bouncing');
    assert.equal(bumps.length, 1);
});

test('buildStoreTickDoorsPatch drops creature loot and emits death dust when a crusher kill lands', () => {
    const result = buildStoreTickDoorsPatch(
        {
            crushingDoors: { '0,5,6': { phase: 'closing', timer: 0.05 } },
            openDoors: new Set<string>(),
            creatures: [
                {
                    id: 'creature-1',
                    alive: true,
                    mapIndex: 0,
                    x: 6,
                    y: 5,
                    currentHP: 5,
                    typeId: 1,
                    cell: 'frontLeft',
                    carriedItems: [{ id: 'loot-1', category: 'Misc', typeId: 1, mapIndex: 0, x: 6, y: 5, tilePos: 'North' }],
                },
                {
                    id: 'creature-2',
                    alive: true,
                    mapIndex: 0,
                    x: 6,
                    y: 5,
                    currentHP: 12,
                    typeId: 1,
                    cell: 'backLeft',
                },
                {
                    id: 'creature-3',
                    alive: true,
                    mapIndex: 0,
                    x: 6,
                    y: 5,
                    currentHP: 12,
                    typeId: 1,
                    cell: 'backRight',
                },
            ],
            damageEvents: [],
            floorItems: [] as Array<{ id: string; category: 'Misc'; typeId: number; mapIndex: number; x: number; y: number; tilePos: 'North' }>,
            spellVisualEvents: [] as Array<{ id: string; level: number; x: number; y: number; kind: 'death' }>,
        },
        0.2,
        {
            doorReboundDurationSeconds: 0.3,
            doorRecloseDurationSeconds: 0.4,
            buildCreatureDamageEvent: (_level, _x, _y, amount, creatureId) => ({ amount, creatureId }),
            dropCreatureCarriedItems: (creatures, floorItems, creatureId) => {
                const nextCreatures = creatures.map((creature) =>
                    creature.id === creatureId
                        ? { ...creature, carriedItems: [] }
                        : creature,
                );
                return {
                    creatures: nextCreatures,
                    floorItems: [
                        ...floorItems,
                        { id: 'loot-1', category: 'Misc', typeId: 1, mapIndex: 0, x: 6, y: 5, tilePos: 'North' as const },
                    ],
                };
            },
            normalizeCreatureCellsOnTile,
            buildDeathDustEvent: (level, x, y) => ({ id: 'death-dust', level, x, y, kind: 'death' }),
            playWallBump: () => undefined,
        },
    );

    assert.ok(result);
    assert.equal(result?.creatures?.[0]?.alive, false);
    assert.deepEqual(result?.creatures?.[0]?.carriedItems, []);
    assert.deepEqual(
        result?.creatures?.map((creature) => [creature.id, creature.alive, creature.cell]),
        [
            ['creature-1', false, 'frontLeft'],
            ['creature-2', true, 'frontLeft'],
            ['creature-3', true, 'frontRight'],
        ],
    );
    assert.equal(result?.floorItems?.[0]?.id, 'loot-1');
    assert.deepEqual(result?.spellVisualEvents, [{ id: 'death-dust', level: 0, x: 6, y: 5, kind: 'death' }]);
    assert.deepEqual(result?.crushingDoors, {});
});

test('buildStoreCombatTickPatch delegates cleanup of expired damage events', () => {
    const champion: Champion = {
        id: 1,
        name: 'Test',
        title: 'Champion',
        gender: 'M',
        class: 'Fighter',
        health: 10,
        stamina: 10,
        mana: 0,
        luck: 10,
        strength: 10,
        dexterity: 10,
        wisdom: 10,
        vitality: 10,
        antiMagic: 0,
        antiFire: 0,
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
        color: '#fff',
        equipment: [],
        portrait: 'test.png',
    };
    const combat: ChampionCombat = { cooldown: 0, cooldownMax: 1, defenseModifier: 0 };
    const damageEvent: DamageEvent = {
        id: 'old',
        level: 0,
        target: 'champion',
        championId: 1,
        amount: 1,
        ts: 0,
    };
    const result = buildStoreCombatTickPatch(
        {
            party: [champion],
            championCombat: { 1: combat },
            damageEvents: [damageEvent],
        },
        0.1,
        1000,
        200,
    );

    assert.ok(result);
    assert.deepEqual(result?.damageEvents, []);
});
