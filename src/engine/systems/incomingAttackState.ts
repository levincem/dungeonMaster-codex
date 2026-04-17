import type { Champion } from '../../types/champion';
import type { ChampionEquipment } from '../../types/game';
import type { ChampionWoundSlot, EquipmentStatBonuses } from '../../data/equipment';
import type { ActivePotionBoost, ChampionVitals, PartyShield } from '../runtimeTypes';

type IncomingAttackType =
    | 'Normal'
    | 'Blunt'
    | 'Sharp'
    | 'Magic'
    | 'Fire'
    | 'Impact'
    | 'Mental'
    | 'Blast'
    | 'Lightning'
    | 'Unconditional';
type DamageClass = 'physical' | 'fire' | 'magic' | 'mental';

type IncomingAttackState = {
    championEquipment: Record<number, ChampionEquipment>;
    activePotionBoosts: ActivePotionBoost[];
    activeShields: PartyShield[];
};

type IncomingAttackDeps = {
    randomInt: (maxExclusive: number) => number;
    applyChampionWound: (vitals: ChampionVitals, slot: ChampionWoundSlot) => ChampionVitals;
    adjustByAttribute: (value: number, currentAttribute: number) => number;
    getEffectiveChampionStatsWithBonuses: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        extraBonuses?: Partial<EquipmentStatBonuses>,
    ) => { vitality: number; wisdom: number };
    computeChampionWoundDefense: (
        state: IncomingAttackState,
        championId: number,
        champion: Champion,
        vitals: ChampionVitals,
        woundSlot: ChampionWoundSlot,
        useSharpDefense: boolean,
    ) => number;
    getPsychicAdjustedAttack: (attack: number, wisdom: number) => number;
    getChampionAdjustedAttackFromResistance: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        attack: number,
        damageClass: DamageClass,
        extraBonuses?: Partial<EquipmentStatBonuses>,
    ) => number;
    getActiveShieldDefense: (
        shields: PartyShield[],
        nowMs: number,
        shieldKind: 'physical' | 'fire' | 'magic',
        championId?: number,
    ) => number;
    scaleOriginalAttack: (value: number, shift: number, factor: number) => number;
    getChampionRuntimeBonuses: (
        champion: Champion,
        vitals: ChampionVitals | undefined,
        activePotionBoosts: ActivePotionBoost[],
        now?: number,
    ) => Partial<EquipmentStatBonuses>;
};

function applyWoundsFromIncomingAttack(
    vitals: ChampionVitals,
    champion: Champion,
    equip: ChampionEquipment | undefined,
    attack: number,
    allowedSlots: readonly ChampionWoundSlot[],
    deps: IncomingAttackDeps,
    extraBonuses?: Partial<EquipmentStatBonuses>,
): ChampionVitals {
    if (attack <= 0 || allowedSlots.length === 0) return vitals;

    const effective = deps.getEffectiveChampionStatsWithBonuses(champion, equip, extraBonuses);
    let woundThreshold = deps.adjustByAttribute(deps.randomInt(128) + 10, effective.vitality);
    if (attack <= woundThreshold) return vitals;

    let nextVitals = vitals;
    do {
        const unwounded = allowedSlots.filter((slot) => !nextVitals.wounds[slot]);
        const pool = unwounded.length > 0 ? unwounded : allowedSlots;
        const slot = pool[deps.randomInt(pool.length)];
        if (slot) nextVitals = deps.applyChampionWound(nextVitals, slot);
        woundThreshold <<= 1;
    } while (attack > woundThreshold && woundThreshold > 0);

    return nextVitals;
}

export function resolveChampionIncomingAttack(
    state: IncomingAttackState,
    champion: Champion,
    currentVitals: ChampionVitals,
    rawAttack: number,
    attackType: IncomingAttackType,
    allowedSlots: readonly ChampionWoundSlot[],
    nowMs: number,
    deps: IncomingAttackDeps,
): { damage: number; nextVitals: ChampionVitals } {
    if (rawAttack <= 0) return { damage: 0, nextVitals: currentVitals };

    const equip = state.championEquipment[champion.id] ?? {};
    const bonuses = deps.getChampionRuntimeBonuses(champion, currentVitals, state.activePotionBoosts);
    let attack = rawAttack;

    if (attackType !== 'Normal') {
        let defense = 0;
        if (allowedSlots.length > 0) {
            for (const woundSlot of allowedSlots) {
                defense += deps.computeChampionWoundDefense(
                    state,
                    champion.id,
                    champion,
                    currentVitals,
                    woundSlot,
                    attackType === 'Sharp',
                );
            }
            defense = Math.floor(defense / allowedSlots.length);
        }
        defense += deps.getActiveShieldDefense(state.activeShields, nowMs, 'physical', champion.id);

        switch (attackType) {
            case 'Mental':
                attack = deps.getPsychicAdjustedAttack(
                    attack,
                    deps.getEffectiveChampionStatsWithBonuses(champion, equip, bonuses).wisdom,
                );
                break;
            case 'Magic':
                attack = deps.getChampionAdjustedAttackFromResistance(champion, equip, attack, 'magic', bonuses);
                attack -= deps.getActiveShieldDefense(state.activeShields, nowMs, 'magic', champion.id);
                break;
            case 'Fire':
                attack = deps.getChampionAdjustedAttackFromResistance(champion, equip, attack, 'fire', bonuses);
                attack -= deps.getActiveShieldDefense(state.activeShields, nowMs, 'fire', champion.id);
                break;
            case 'Impact':
                defense = Math.floor(defense / 2);
                break;
            case 'Blunt':
            case 'Sharp':
            case 'Blast':
            case 'Lightning':
            case 'Unconditional':
                break;
        }

        if (attack <= 0) return { damage: 0, nextVitals: currentVitals };
        if (attackType !== 'Magic' && attackType !== 'Mental') {
            attack = deps.scaleOriginalAttack(attack, 6, Math.max(0, 130 - defense));
        }
        if (attack <= 0) return { damage: 0, nextVitals: currentVitals };
    }

    const damage = Math.max(0, attack);
    if (damage <= 0) return { damage: 0, nextVitals: currentVitals };

    let nextVitals: ChampionVitals = {
        ...currentVitals,
        hp: Math.max(0, currentVitals.hp - damage),
    };
    if (nextVitals.hp > 0 && attackType !== 'Normal') {
        nextVitals = applyWoundsFromIncomingAttack(
            nextVitals,
            champion,
            equip,
            damage,
            allowedSlots,
            deps,
            bonuses,
        );
    }

    return {
        damage: Math.max(0, currentVitals.hp - nextVitals.hp),
        nextVitals,
    };
}
