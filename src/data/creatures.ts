import originalCreaturesRaw from '../assets/data/original_creatures_runtime.json?raw';
import { getGameDbRawSync } from './gameDbData';

const gameDb = JSON.parse(getGameDbRawSync()) as unknown;
const originalCreatures = JSON.parse(originalCreaturesRaw) as unknown;

export type AttackType =
    | 'Physical'
    | 'Magic'
    | 'Fire'
    | 'Poison'
    | 'Steal'
    | 'Rust'
    | 'Alert'
    | 'StaminaDrain'
    | 'Immobilize'
    | 'Teleport';

export interface CreatureDef {
    id: number;
    name: string;
    baseHP: number;
    armor: number;
    hitProb: number;
    atkSpd: number;
    moveSpd: number;
    exp: number;
    poison: boolean;
    attackTypes: AttackType[];
    drops: string[];
    rawAttack: number;
    poisonAttack: number;
    nonMaterial: boolean;
    attackAnyChampion: boolean;
    attackFromAllSides: boolean;
    attackRange: number;
    sightRange: number;
    preferBackRow: boolean;
    levitates: boolean;
    absorbMissiles: boolean;
    seeInvisible: boolean;
}

type OriginalAttackType = 'Unconditional' | 'Fire' | 'Impact' | 'Blunt' | 'Sharp' | 'Magic' | 'Mental' | 'Blast';

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
    attack?: number;
    poisonAttack?: number;
    nonMaterial?: boolean;
    attackAnyChampion?: boolean;
    attackFromAllSides?: boolean;
    preferBackRow?: boolean;
    levitates?: boolean;
    absorbMissiles?: boolean;
    seeInvisible?: boolean;
    ranges?: { attack?: number; sight?: number };
};

const originalAtariI559Creatures =
    ((gameDb as {
        originalAtari?: { i559?: { creatures?: RawI559Creature[] } };
    }).originalAtari?.i559?.creatures ?? []) as RawI559Creature[];

const I559_CREATURES_BY_INDEX = new Map<number, RawI559Creature>(
    originalAtariI559Creatures.map((creature) => [creature.index, creature]),
);

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
    6: ['Alert'],
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

const DROP_OVERRIDES: Partial<Record<number, string[]>> = {
    18: ['Falchion', 'TorsoPlateCursed'],
};

const dataset = originalCreatures as OriginalCreaturesDataset;

export const CREATURE_TYPES: Record<number, CreatureDef> = Object.fromEntries(
    dataset.creatures.map((creature) => {
        const original = I559_CREATURES_BY_INDEX.get(creature.id);
        return [creature.id, {
            id: creature.id,
            name: creature.name,
            baseHP: creature.baseHP,
            armor: creature.armor,
            hitProb: creature.hitProb,
            atkSpd: creature.atkSpd,
            moveSpd: creature.moveSpd,
            exp: creature.exp,
            poison: creature.poison,
            attackTypes: ATTACK_TYPE_OVERRIDES[creature.id] ?? BASE_ATTACK_TYPE_MAP[creature.attackType] ?? ['Physical'],
            drops: DROP_OVERRIDES[creature.id] ?? [],
            rawAttack: original?.attack ?? 0,
            poisonAttack: original?.poisonAttack ?? 0,
            nonMaterial: Boolean(original?.nonMaterial),
            attackAnyChampion: Boolean(original?.attackAnyChampion),
            attackFromAllSides: Boolean(original?.attackFromAllSides),
            attackRange: Math.max(1, original?.ranges?.attack ?? 1),
            sightRange: Math.max(1, original?.ranges?.sight ?? 8),
            preferBackRow: Boolean(original?.preferBackRow),
            levitates: Boolean(original?.levitates),
            absorbMissiles: Boolean(original?.absorbMissiles),
            seeInvisible: Boolean(original?.seeInvisible),
        } satisfies CreatureDef];
    }),
);
