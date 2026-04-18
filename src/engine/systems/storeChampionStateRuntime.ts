import type { Champion } from '../../types/champion';
import type { ChampionEquipment } from '../../types/game';
import type {
    ChampionWoundSlot,
    EquipmentStatBonuses,
} from '../../data/equipment';
import type {
    ChampionTemporaryXP,
    ChampionXP,
    SkillKey,
} from '../../data/skillProgression';
import type {
    ActivePotionBoost,
    ChampionVitals,
    PartyShield,
} from '../runtimeTypes';
import type { OriginalProjectileIncomingAttackType } from './originalProjectileImpact';
import { applyOriginalChampionSkillExperience } from './originalChampionLeveling';
import { applyOriginalPoisonCharacter, healOriginalChampionWounds } from './originalChampionConditionEffects';
import { adjustOriginalAttackByAttribute, getOriginalPsychicAdjustedAttack, scaleOriginalAttackValue } from './originalAttackMath';
import { resolveChampionIncomingAttack } from './incomingAttackState';

type IncomingAttackStateLike = {
    championEquipment: Record<number, ChampionEquipment>;
    activePotionBoosts: ActivePotionBoost[];
    activeShields: PartyShield[];
};

type ChampionXpStateLike = {
    level: number;
    party: Champion[];
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    elapsedGameTimeTicks: number;
    lastCreatureAttackGameTick: number;
};

type ArmorCoverageZone = 'head' | 'torso' | 'legs' | 'feet' | 'hands';

type StoreChampionStateRuntimeParams<TIncomingState extends IncomingAttackStateLike> = {
    poisonTickIntervalSec: number;
    randomInt: (maxExclusive: number) => number;
    getMapDifficulty: (level: number) => number;
    getEffectiveChampionStatsWithBonuses: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        extraBonuses?: Partial<EquipmentStatBonuses>,
    ) => { vitality: number; wisdom: number };
    computeChampionWoundDefense: (
        state: TIncomingState,
        championId: number,
        champion: Champion,
        vitals: ChampionVitals,
        woundSlot: ChampionWoundSlot,
        useSharpDefense: boolean,
    ) => number;
    getChampionAdjustedAttackFromResistance: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        attack: number,
        damageClass: 'physical' | 'fire' | 'magic' | 'mental',
        extraBonuses?: Partial<EquipmentStatBonuses>,
    ) => number;
    getActiveShieldDefense: (
        shields: PartyShield[],
        nowMs: number,
        shieldKind: 'physical' | 'fire' | 'magic',
        championId?: number,
    ) => number;
    getChampionRuntimeBonuses: (
        champion: Champion,
        vitals: ChampionVitals | undefined,
        activePotionBoosts: ActivePotionBoost[],
        now?: number,
    ) => Partial<EquipmentStatBonuses>;
};

export function chooseChampionWoundSlotsFromZones(
    hitZones: readonly ArmorCoverageZone[] | undefined,
): ChampionWoundSlot[] {
    if (!hitZones || hitZones.length === 0) return ['torso'];
    const slots = new Set<ChampionWoundSlot>();
    for (const zone of hitZones) {
        if (zone === 'hands') {
            slots.add('rightHand');
            slots.add('leftHand');
            continue;
        }
        slots.add(zone);
    }
    return [...slots];
}

export function applyChampionWound(vitals: ChampionVitals, slot: ChampionWoundSlot): ChampionVitals {
    if (vitals.wounds[slot]) return vitals;
    return {
        ...vitals,
        wounds: {
            ...vitals.wounds,
            [slot]: true,
        },
    };
}

export function computeOriginalTimeCriteria(gameTimeTicks: number): number {
    return (((gameTimeTicks & 0x0080) + ((gameTimeTicks & 0x0100) >> 2) + ((gameTimeTicks & 0x0040) << 2)) >> 2);
}

export function applyChampionStaminaDeltaOriginal(
    vitals: ChampionVitals,
    maxStamina: number,
    staminaDelta: number,
): ChampionVitals {
    if (staminaDelta === 0) return vitals;

    const rawStamina = vitals.stamina + staminaDelta;
    if (rawStamina >= 0) {
        return {
            ...vitals,
            stamina: Math.min(maxStamina, rawStamina),
        };
    }

    return {
        ...vitals,
        stamina: 0,
        hp: Math.max(0, vitals.hp - Math.floor((-rawStamina) / 2)),
    };
}

export function createStoreChampionStateRuntime<
    TIncomingState extends IncomingAttackStateLike,
    TChampionXpState extends ChampionXpStateLike,
>(
    params: StoreChampionStateRuntimeParams<TIncomingState>,
) {
    const healChampionWoundsOriginal = (
        vitals: ChampionVitals,
        iterations = 1,
    ): ChampionVitals => healOriginalChampionWounds(vitals, iterations, params.randomInt);

    const applyPoisonCharacterOriginal = (
        vitals: ChampionVitals,
        poisonStrength: number,
    ): ChampionVitals => applyOriginalPoisonCharacter(vitals, poisonStrength, params.poisonTickIntervalSec);

    const buildChampionSkillExperiencePatchOriginal = (
        state: TChampionXpState,
        championId: number,
        skill: SkillKey,
        amount: number,
    ): {
        championXP: Record<number, ChampionXP>;
        championTemporaryXP: Record<number, ChampionTemporaryXP>;
        party?: Champion[];
    } | null => {
        if (amount <= 0) return null;
        const championIndex = state.party.findIndex((entry) => entry.id === championId);
        const champion = championIndex >= 0 ? state.party[championIndex] : null;
        if (!champion) return null;

        const result = applyOriginalChampionSkillExperience(
            champion,
            state.championXP[championId],
            state.championTemporaryXP[championId],
            skill,
            amount,
            {
                mapDifficulty: params.getMapDifficulty(state.level),
                elapsedGameTimeTicks: state.elapsedGameTimeTicks,
                lastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
            },
            params.randomInt,
        );
        if (!result) return null;

        let nextParty: Champion[] | undefined;
        if (result.leveledChampion) {
            nextParty = [...state.party];
            nextParty[championIndex] = result.leveledChampion;
        }

        return {
            championXP: {
                ...state.championXP,
                [championId]: result.championXP,
            },
            championTemporaryXP: {
                ...state.championTemporaryXP,
                [championId]: result.championTemporaryXP,
            },
            ...(nextParty ? { party: nextParty } : {}),
        };
    };

    const resolveChampionIncomingAttackRuntime = (
        state: TIncomingState,
        champion: Champion,
        currentVitals: ChampionVitals,
        rawAttack: number,
        attackType: OriginalProjectileIncomingAttackType,
        allowedSlots: readonly ChampionWoundSlot[],
        nowMs: number,
    ): { damage: number; nextVitals: ChampionVitals } =>
        resolveChampionIncomingAttack(
            state,
            champion,
            currentVitals,
            rawAttack,
            attackType,
            allowedSlots,
            nowMs,
            {
                randomInt: params.randomInt,
                applyChampionWound,
                adjustByAttribute: adjustOriginalAttackByAttribute,
                getEffectiveChampionStatsWithBonuses: params.getEffectiveChampionStatsWithBonuses,
                computeChampionWoundDefense: (
                    attackState,
                    championId,
                    incomingChampion,
                    vitals,
                    woundSlot,
                    useSharpDefense,
                ) => params.computeChampionWoundDefense(
                    attackState as TIncomingState,
                    championId,
                    incomingChampion,
                    vitals,
                    woundSlot,
                    useSharpDefense,
                ),
                getPsychicAdjustedAttack: getOriginalPsychicAdjustedAttack,
                getChampionAdjustedAttackFromResistance: params.getChampionAdjustedAttackFromResistance,
                getActiveShieldDefense: params.getActiveShieldDefense,
                scaleOriginalAttack: scaleOriginalAttackValue,
                getChampionRuntimeBonuses: params.getChampionRuntimeBonuses,
            },
        );

    return {
        applyPoisonCharacterOriginal,
        buildChampionSkillExperiencePatchOriginal,
        healChampionWoundsOriginal,
        resolveChampionIncomingAttackRuntime,
    };
}
