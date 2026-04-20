import originalCreatures from '../assets/runtime/reference/original_creatures_runtime.json';
import packagedGameDbCreatures from '../assets/runtime/db/game_db_creatures.json';
import { getGameDbCreaturesRawSync } from './gameDbData';
import { resolveItemName } from './items';

export type AttackType =
    | 'Physical'
    | 'Magic'
    | 'Fire'
    | 'Poison'
    | 'Steal'
    | 'Rust'
    | 'StaminaDrain';

export interface CreatureDef {
    id: number;
    name: string;
    sizeOnTile: number;
    baseHP: number;
    armor: number;
    hitProb: number;
    atkSpd: number;
    moveSpd: number;
    exp: number;
    poison: boolean;
    originalAttackType: OriginalAttackType;
    attackTypes: AttackType[];
    drops: string[];
    fixedDrops: CreatureFixedDropSpec[];
    rawAttack: number;
    poisonAttack: number;
    dexterity: number;
    fireResistance: number;
    poisonResistance: number;
    nonMaterial: boolean;
    attackAnyChampion: boolean;
    attackFromAllSides: boolean;
    attackRange: number;
    sightRange: number;
    preferBackRow: boolean;
    levitates: boolean;
    absorbMissiles: boolean;
    seeInvisible: boolean;
    fearResistance: number;
    archenemy: boolean;
}

export type OriginalAttackType = 'Unconditional' | 'Fire' | 'Impact' | 'Blunt' | 'Sharp' | 'Magic' | 'Mental' | 'Blast';

export interface CreatureFixedDropSpec {
    category: 'Weapon' | 'Armor' | 'Misc';
    typeId: number;
    rawName: string;
    random: boolean;
    cursed: boolean;
    sourceObjectIndex: number;
}

interface OriginalCreatureDef {
    id: number;
    name: string;
    baseHP: number;
    armor: number;
    hitProb: number;
    atkSpd: number;
    moveSpd: number;
    exp: number;
    poison: boolean;
    attackType: OriginalAttackType;
}

interface OriginalCreaturesDataset {
    creatures: OriginalCreatureDef[];
}

type RawI559Creature = {
    index: number;
    sizeOnTile?: number;
    movementTicks?: number;
    attackTicks?: number;
    defense?: number;
    baseHealth?: number;
    attack?: number;
    poisonAttack?: number;
    dexterity?: number;
    archenemy?: boolean;
    byte22?: number[];
    properties?: { fearResistance?: number };
    resistances?: { fire?: number; poison?: number };
    nonMaterial?: boolean;
    attackAnyChampion?: boolean;
    attackFromAllSides?: boolean;
    preferBackRow?: boolean;
    levitates?: boolean;
    absorbMissiles?: boolean;
    seeInvisible?: boolean;
    ranges?: { attack?: number; sight?: number };
};

const ORIGINAL_ATTACK_TYPE_BY_ID: readonly OriginalAttackType[] = [
    'Unconditional',
    'Fire',
    'Impact',
    'Blunt',
    'Sharp',
    'Magic',
    'Mental',
    'Blast',
];

const BASE_ATTACK_TYPE_MAP: Record<OriginalAttackType, AttackType[]> = {
    Unconditional: ['Physical'],
    Fire: ['Fire'],
    Impact: ['Physical'],
    Blunt: ['Physical'],
    Sharp: ['Physical'],
    Magic: ['Magic'],
    Mental: ['StaminaDrain'],
    Blast: ['Physical'],
};

const ATTACK_TYPE_OVERRIDES: Partial<Record<number, AttackType[]>> = {
    2: ['Physical', 'Steal'],
    5: ['Physical', 'Rust'],
    8: ['StaminaDrain'],
    13: ['Physical', 'Poison'],
    14: ['Magic', 'Physical'],
    15: ['Physical', 'Poison'],
    17: ['Physical', 'Poison'],
    19: ['Magic', 'Physical'],
    21: ['Physical', 'Magic'],
    22: ['Physical', 'Fire'],
    23: ['Magic', 'Physical', 'Fire'],
    24: ['Fire', 'Physical'],
    25: ['Physical', 'Magic'],
    26: ['Physical', 'Magic'],
};

// True fixed-possession tables extracted from I559 creature droppings.
// Values are object-info indexes with 0x8000 marking a 50% random drop.
const ORIGINAL_FIXED_DROP_OBJECTS: Partial<Record<number, readonly number[]>> = {
    24: [163, 163, 163, 163, 163, 163, 163, 163, 0x80A3, 0x80A3],
    15: [161, 0x80A1, 0x80A1],
    6: [160, 0x80A0],
    4: [162, 0x80A2],
    7: [152, 0x8098, 0x8035, 0x8035],
    18: [110, 109, 108, 33, 107, 33],
    16: [46],
    9: [47],
    12: [32, 99],
};

function decodeFixedDropObject(
    rawValue: number,
    cursed: boolean,
): CreatureFixedDropSpec {
    const random = (rawValue & 0x8000) !== 0;
    const objectInfoIndex = rawValue & 0x7fff;

    if (objectInfoIndex >= 127) {
        const typeId = objectInfoIndex - 127;
        return {
            category: 'Misc',
            typeId,
            rawName: resolveItemName('Misc', typeId),
            random,
            cursed,
            sourceObjectIndex: objectInfoIndex,
        };
    }

    if (objectInfoIndex >= 69) {
        const typeId = objectInfoIndex - 69;
        return {
            category: 'Armor',
            typeId,
            rawName: resolveItemName('Armor', typeId),
            random,
            cursed,
            sourceObjectIndex: objectInfoIndex,
        };
    }

    const typeId = objectInfoIndex - 23;
    return {
        category: 'Weapon',
        typeId,
        rawName: resolveItemName('Weapon', typeId),
        random,
        cursed,
        sourceObjectIndex: objectInfoIndex,
    };
}

export function getOriginalCreatureFixedDropSpecs(creatureId: number): CreatureFixedDropSpec[] {
    const rawEntries = ORIGINAL_FIXED_DROP_OBJECTS[creatureId] ?? [];
    const cursed = creatureId === 18;
    return rawEntries.map((entry) => decodeFixedDropObject(entry, cursed));
}

const dataset = originalCreatures as OriginalCreaturesDataset;

let creatureTypesCache: Record<number, CreatureDef> | null = null;
let creatureSourceDataHydrated = false;

const creatureTypesTarget: Record<number, CreatureDef> = {};

function replaceCreatureRecord(target: Record<number, CreatureDef>, source: Record<number, CreatureDef>): void {
    for (const key of Object.keys(target)) {
        delete target[Number(key)];
    }
    Object.assign(target, source);
}

function syncExportedCreatureTargets(source: Record<number, CreatureDef>): void {
    replaceCreatureRecord(creatureTypesTarget, source);
}

function createHydratingCreatureRecordProxy<T extends Record<number, unknown>>(target: T): T {
    return new Proxy(target, {
        get(currentTarget, prop, receiver) {
            getCreatureTypes();
            return Reflect.get(currentTarget, prop, receiver);
        },
        has(currentTarget, prop) {
            getCreatureTypes();
            return Reflect.has(currentTarget, prop);
        },
        ownKeys(currentTarget) {
            getCreatureTypes();
            return Reflect.ownKeys(currentTarget);
        },
        getOwnPropertyDescriptor(currentTarget, prop) {
            getCreatureTypes();
            return Reflect.getOwnPropertyDescriptor(currentTarget, prop);
        },
    });
}

function tryReadGameDbCreatures(): unknown {
    try {
        return JSON.parse(getGameDbCreaturesRawSync()) as unknown;
    } catch {
        return packagedGameDbCreatures as unknown;
    }
}

function resolveOriginalAttackType(
    original: RawI559Creature | undefined,
    fallback: OriginalAttackType,
): OriginalAttackType {
    const attackTypeId = original?.byte22?.[2];
    if (
        typeof attackTypeId === 'number'
        && attackTypeId >= 0
        && attackTypeId < ORIGINAL_ATTACK_TYPE_BY_ID.length
    ) {
        return ORIGINAL_ATTACK_TYPE_BY_ID[attackTypeId] ?? fallback;
    }
    return fallback;
}

function buildCreatureTypes(rawGameDb: unknown): Record<number, CreatureDef> {
    const originalAtariI559Creatures =
        ((rawGameDb as {
            originalAtari?: { i559?: { creatures?: RawI559Creature[] } };
        }).originalAtari?.i559?.creatures ?? []) as RawI559Creature[];

    const creaturesByIndex = new Map<number, RawI559Creature>(
        originalAtariI559Creatures.map((creature) => [creature.index, creature]),
    );

    return Object.fromEntries(
        dataset.creatures.map((creature) => {
            const original = creaturesByIndex.get(creature.id);
            const fixedDrops = getOriginalCreatureFixedDropSpecs(creature.id);
            const originalAttackType = resolveOriginalAttackType(original, creature.attackType);
            return [creature.id, {
                id: creature.id,
                name: creature.name,
                sizeOnTile: Math.max(0, Math.min(2, original?.sizeOnTile ?? 0)),
                baseHP: original?.baseHealth ?? creature.baseHP,
                armor: original?.defense ?? creature.armor,
                hitProb: original?.dexterity ?? creature.hitProb,
                atkSpd: original?.attackTicks ?? creature.atkSpd,
                moveSpd: original?.movementTicks ?? creature.moveSpd,
                exp: creature.exp,
                poison: typeof original?.poisonAttack === 'number' ? original.poisonAttack > 0 : creature.poison,
                originalAttackType,
                attackTypes: ATTACK_TYPE_OVERRIDES[creature.id] ?? BASE_ATTACK_TYPE_MAP[originalAttackType] ?? ['Physical'],
                drops: fixedDrops.map((drop) => drop.rawName),
                fixedDrops,
                rawAttack: original?.attack ?? 0,
                poisonAttack: original?.poisonAttack ?? 0,
                dexterity: original?.dexterity ?? 0,
                fireResistance: original?.resistances?.fire ?? 0,
                poisonResistance: original?.resistances?.poison ?? 0,
                nonMaterial: Boolean(original?.nonMaterial),
                attackAnyChampion: Boolean(original?.attackAnyChampion),
                attackFromAllSides: Boolean(original?.attackFromAllSides),
                attackRange: Math.max(1, original?.ranges?.attack ?? 1),
                sightRange: Math.max(1, original?.ranges?.sight ?? 8),
                preferBackRow: Boolean(original?.preferBackRow),
                levitates: Boolean(original?.levitates),
                absorbMissiles: Boolean(original?.absorbMissiles),
                seeInvisible: Boolean(original?.seeInvisible),
                fearResistance: Math.max(0, Math.min(15, original?.properties?.fearResistance ?? 0)),
                archenemy: Boolean(original?.archenemy),
            } satisfies CreatureDef];
        }),
    );
}

function getCreatureTypes(): Record<number, CreatureDef> {
    if (!creatureSourceDataHydrated) {
        const rawGameDb = tryReadGameDbCreatures();
        creatureTypesCache = buildCreatureTypes(rawGameDb);
        creatureSourceDataHydrated = true;
        syncExportedCreatureTargets(creatureTypesCache);
        return creatureTypesCache;
    }

    if (!creatureTypesCache) {
        creatureTypesCache = buildCreatureTypes({});
        syncExportedCreatureTargets(creatureTypesCache);
    }

    return creatureTypesCache;
}

export const CREATURE_TYPES: Record<number, CreatureDef> = createHydratingCreatureRecordProxy(creatureTypesTarget);
