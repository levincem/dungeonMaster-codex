// Creature definitions — sourced from Old_data/game_db.json creatureTypes
// 27 creature types (IDs 0–26)

import originalCreatures from '../../public/original_creatures_runtime.json';

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
    armor: number;      // damage reduction (0–100)
    hitProb: number;    // hit probability (0–100)
    atkSpd: number;     // attack speed in ticks
    moveSpd: number;    // movement speed in ticks
    exp: number;        // experience awarded on kill
    poison: boolean;
    attackTypes: AttackType[];
    drops: string[];    // item names dropped on death
}

const LEGACY_CREATURE_TYPES: Record<number, CreatureDef> = {
    0:  { id: 0,  name: 'Giant Scorpion',    baseHP: 150, armor: 55, hitProb: 55, atkSpd: 20, moveSpd:  8, exp:  20, poison: true,  attackTypes: ['Physical'],                  drops: [] },
    1:  { id: 1,  name: 'Swamp Slime',       baseHP: 110, armor: 20, hitProb: 20, atkSpd: 32, moveSpd: 15, exp:  12, poison: false, attackTypes: ['Physical'],                  drops: [] },
    2:  { id: 2,  name: 'Giggler',           baseHP:  40, armor: 10, hitProb: 60, atkSpd: 15, moveSpd: 15, exp:  15, poison: false, attackTypes: ['Physical', 'Steal'],         drops: [] },
    3:  { id: 3,  name: 'Wizard Eye',        baseHP:  40, armor: 30, hitProb: 80, atkSpd: 21, moveSpd: 10, exp:  20, poison: false, attackTypes: ['Magic'],                     drops: [] },
    4:  { id: 4,  name: 'Pain Rat',          baseHP:  80, armor: 15, hitProb: 50, atkSpd: 10, moveSpd: 20, exp:  10, poison: false, attackTypes: ['Physical'],                  drops: [] },
    5:  { id: 5,  name: 'Ruster',            baseHP:  80, armor: 25, hitProb: 45, atkSpd: 18, moveSpd: 12, exp:  15, poison: false, attackTypes: ['Rust'],                      drops: [] },
    6:  { id: 6,  name: 'Screamer',          baseHP:  30, armor:  5, hitProb: 20, atkSpd: 40, moveSpd:  5, exp:   5, poison: false, attackTypes: ['Alert'],                     drops: [] },
    7:  { id: 7,  name: 'Rockpile',          baseHP: 250, armor: 90, hitProb: 40, atkSpd: 25, moveSpd:  5, exp:  30, poison: false, attackTypes: ['Physical'],                  drops: [] },
    8:  { id: 8,  name: 'Ghost',             baseHP:  50, armor: 60, hitProb: 70, atkSpd: 18, moveSpd: 12, exp:  25, poison: false, attackTypes: ['StaminaDrain'],              drops: [] },
    9:  { id: 9,  name: 'Stone Golem',       baseHP: 300, armor: 85, hitProb: 60, atkSpd: 30, moveSpd:  5, exp:  40, poison: false, attackTypes: ['Physical'],                  drops: [] },
    10: { id: 10, name: 'Mummy',             baseHP: 180, armor: 30, hitProb: 50, atkSpd: 22, moveSpd:  8, exp:  25, poison: false, attackTypes: ['Physical', 'Immobilize'],    drops: [] },
    11: { id: 11, name: 'Black Flame',       baseHP: 120, armor: 80, hitProb: 65, atkSpd: 20, moveSpd: 10, exp:  30, poison: false, attackTypes: ['Fire'],                      drops: [] },
    12: { id: 12, name: 'Skeleton',          baseHP: 100, armor: 35, hitProb: 55, atkSpd: 18, moveSpd: 10, exp:  20, poison: false, attackTypes: ['Physical'],                  drops: [] },
    13: { id: 13, name: 'Couatl',            baseHP:  39, armor: 42, hitProb: 88, atkSpd: 10, moveSpd:  5, exp:  35, poison: true,  attackTypes: ['Physical', 'Poison'],        drops: [] },
    14: { id: 14, name: 'Vexirk',            baseHP:  44, armor: 47, hitProb: 90, atkSpd: 20, moveSpd: 10, exp:  40, poison: false, attackTypes: ['Magic', 'Physical'],         drops: [] },
    15: { id: 15, name: 'Magenta Worm',      baseHP: 400, armor: 60, hitProb: 55, atkSpd: 25, moveSpd:  8, exp:  50, poison: true,  attackTypes: ['Physical', 'Poison'],        drops: [] },
    16: { id: 16, name: 'Trolin',            baseHP: 120, armor: 30, hitProb: 55, atkSpd: 16, moveSpd: 12, exp:  20, poison: false, attackTypes: ['Physical'],                  drops: [] },
    17: { id: 17, name: 'Giant Wasp',        baseHP:  60, armor: 20, hitProb: 75, atkSpd: 12, moveSpd: 18, exp:  20, poison: true,  attackTypes: ['Physical', 'Poison'],        drops: [] },
    18: { id: 18, name: 'Animated Armour',   baseHP: 200, armor: 80, hitProb: 65, atkSpd: 20, moveSpd:  8, exp:  45, poison: false, attackTypes: ['Physical'],                  drops: ['Falchion', 'TorsoPlateCursed'] },
    19: { id: 19, name: 'Materializer',      baseHP: 100, armor: 45, hitProb: 70, atkSpd: 15, moveSpd: 15, exp:  35, poison: false, attackTypes: ['Physical', 'Teleport'],      drops: [] },
    20: { id: 20, name: 'Water Elemental',   baseHP: 200, armor: 70, hitProb: 60, atkSpd: 20, moveSpd: 10, exp:  40, poison: false, attackTypes: ['Physical'],                  drops: [] },
    21: { id: 21, name: 'Oitu',              baseHP: 250, armor: 75, hitProb: 70, atkSpd: 20, moveSpd:  8, exp:  50, poison: false, attackTypes: ['Physical', 'Magic'],         drops: [] },
    22: { id: 22, name: 'Demon',             baseHP: 300, armor: 70, hitProb: 75, atkSpd: 18, moveSpd: 10, exp:  60, poison: false, attackTypes: ['Physical', 'Fire'],          drops: [] },
    23: { id: 23, name: 'Lord Chaos',        baseHP: 990, armor: 90, hitProb: 95, atkSpd:  8, moveSpd:  5, exp: 500, poison: false, attackTypes: ['Magic', 'Physical', 'Fire'], drops: [] },
    24: { id: 24, name: 'Red Dragon',        baseHP: 800, armor: 85, hitProb: 85, atkSpd: 15, moveSpd:  8, exp: 200, poison: false, attackTypes: ['Fire', 'Physical'],          drops: [] },
    25: { id: 25, name: 'Lord Order',        baseHP: 500, armor: 80, hitProb: 90, atkSpd: 12, moveSpd:  8, exp: 100, poison: false, attackTypes: ['Physical', 'Magic'],         drops: [] },
    26: { id: 26, name: 'Grey Lord',         baseHP: 500, armor: 80, hitProb: 90, atkSpd: 12, moveSpd:  8, exp: 100, poison: false, attackTypes: ['Physical', 'Magic'],         drops: [] },
};

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
    attackTypeId: number;
    attackType: OriginalAttackType;
    notes?: string[];
}

interface OriginalCreaturesDataset {
    creatures: OriginalCreatureDef[];
}

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

const LEGACY_ATTACK_TYPE_OVERRIDES: Partial<Record<number, AttackType[]>> = {
    2: ['Physical', 'Steal'],
    5: ['Physical', 'Rust'],
    6: ['Alert'],
    8: ['StaminaDrain'],
    10: ['Physical', 'Immobilize'],
    13: ['Physical', 'Poison'],
    14: ['Magic', 'Physical'],
    15: ['Physical', 'Poison'],
    17: ['Physical', 'Poison'],
    19: ['Magic', 'Teleport'],
    21: ['Physical', 'Magic'],
    22: ['Physical', 'Fire'],
    23: ['Magic', 'Physical', 'Fire'],
    24: ['Fire', 'Physical'],
    25: ['Physical', 'Magic'],
    26: ['Physical', 'Magic'],
};

const LEGACY_DROP_OVERRIDES: Partial<Record<number, string[]>> = {
    18: ['Falchion', 'TorsoPlateCursed'],
};

const dataset = originalCreatures as OriginalCreaturesDataset;

export const CREATURE_TYPES: Record<number, CreatureDef> = Object.fromEntries(
    dataset.creatures.map(creature => {
        const legacy = LEGACY_CREATURE_TYPES[creature.id];
        const attackTypes =
            LEGACY_ATTACK_TYPE_OVERRIDES[creature.id] ??
            BASE_ATTACK_TYPE_MAP[creature.attackType] ??
            legacy?.attackTypes ??
            ['Physical'];

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
            attackTypes,
            drops: LEGACY_DROP_OVERRIDES[creature.id] ?? legacy?.drops ?? [],
        } satisfies CreatureDef];
    }),
);
