import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ChampionWoundSlot, EquipmentStatBonuses } from '../../data/equipment';
import type { ChampionTemporaryXP, ChampionXP, SkillKey } from '../../data/skillProgression';
import type {
    ActivePotionBoost,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    ProjectileEffect,
} from '../runtimeTypes';
import { advanceSurvivalTimeState, isPartyRestedState } from './survivalState';
import { applyPartyLoadBasedFatigueState } from './partyFatigueState';
import { computePartyMovementCooldownSeconds } from './partyMovementCooldownState';
import { applyChampionDeathDropsToPartyState } from './partyDeathState';
import { createStorePartyDamageRuntimeDeps } from './storePartyDamageRuntime';

type SurvivalPartyState = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championEquipment: Record<number, ChampionEquipment>;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    damageEvents?: DamageEvent[];
    elapsedGameTimeTicks: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
    lastPartyMoveGameTick: number;
    activePotionBoosts: ActivePotionBoost[];
    level?: number;
    position?: [number, number];
    floorItems?: FloorItem[];
    championInventories?: Record<number, FloorItem[]>;
    deadChampions?: Record<number, Champion>;
    selectedChampionIndex?: number;
};

type AdvanceStoreSurvivalResult = ReturnType<typeof advanceSurvivalTimeState> & Partial<{
    party: Champion[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
}>;

type PartyRestState = Pick<
    SurvivalPartyState,
    'party' | 'championVitals' | 'championEquipment' | 'activePotionBoosts'
>;

type PartyMovementState = Pick<
    PartyRestState,
    'party' | 'championVitals' | 'championEquipment' | 'activePotionBoosts'
> & {
    championInventories: Record<number, FloorItem[]>;
};

type EffectiveChampionStats = {
    health: number;
    stamina: number;
    mana: number;
    wisdom: number;
    vitality: number;
    luck: number;
    strength: number;
    dexterity: number;
    antiMagic: number;
    antiFire: number;
};

type StorePartyRuntimeParams<TCombatState> = {
    sleepSurvivalIntervalTicks: number;
    awakeSurvivalIntervalTicks: number;
    originalTimerTickSeconds: number;
    poisonTickIntervalSec: number;
    foodDrainScale: number;
    waterDrainScale: number;
    maxFood: number;
    maxWater: number;
    sleepStatRelaxIntervalMask: number;
    awakeStatRelaxIntervalMask: number;
    normalizeChampionVitalsForChampion: (champion: Champion, vitals: ChampionVitals) => ChampionVitals;
    getChampionRuntimeBonuses: (
        champion: Champion,
        currentVitals: ChampionVitals | undefined,
        activePotionBoosts: ActivePotionBoost[],
        now?: number,
    ) => Partial<EquipmentStatBonuses>;
    getEffectiveChampionStatsWithBonuses: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        bonuses: Partial<EquipmentStatBonuses> | undefined,
    ) => EffectiveChampionStats;
    getChampionSkillLevelFromXP: (
        championXP: ChampionXP | undefined,
        temporaryXP: ChampionTemporaryXP | undefined,
        skillKey: SkillKey,
        options?: { bonusLevels?: number },
    ) => number;
    getEquipmentSkillLevelModifier: (
        skillKey: 'wizard' | 'priest',
        equip: ChampionEquipment | undefined,
    ) => number;
    normalizeChampionTemporaryXP: (xp: ChampionTemporaryXP | undefined) => ChampionTemporaryXP;
    computeOriginalTimeCriteria: (gameTimeTicks: number) => number;
    applyChampionStaminaDeltaOriginal: (
        vitals: ChampionVitals,
        maxStamina: number,
        delta: number,
    ) => ChampionVitals;
    applyLimits: (min: number, value: number, max: number) => number;
    clampFoodWater: (value: number, max: number) => number;
    getChampionStatRelaxTargets: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
    ) => ChampionVitals['currentStats'];
    relaxChampionCurrentStatsTowardMaximum: (
        currentStats: ChampionVitals['currentStats'],
        targets: ChampionVitals['currentStats'],
    ) => ChampionVitals['currentStats'];
    buildCombatTickPatch: (
        state: TCombatState,
        delta: number,
        now: number,
        damageEventLifetimeMs: number,
    ) => Partial<TCombatState> | null;
    damageEventLifetimeMs: number;
    getTotalWeight: (equip: ChampionEquipment, inventory: FloorItem[]) => number;
    getChampionMaxLoad: (
        champion: Champion,
        equip: ChampionEquipment,
        stamina: number,
        wounds: ChampionVitals['wounds'],
        extraBonuses?: Partial<EquipmentStatBonuses>,
    ) => number;
    buildChampionDamageEvent: (level: number, championId: number, amount: number) => DamageEvent;
    buildDeathDrop: (
        state: {
            level: number;
            position: [number, number];
            party: Champion[];
            championInventories: Record<number, FloorItem[]>;
            championEquipment: Record<number, ChampionEquipment>;
            floorItems: FloorItem[];
            deadChampions: Record<number, Champion>;
        },
        championId: number,
        nowMs: number,
    ) => {
        party: Champion[];
        floorItems: FloorItem[];
        championInventories: Record<number, FloorItem[]>;
        championEquipment: Record<number, ChampionEquipment>;
        deadChampions: Record<number, Champion>;
    };
    randomInt: (maxExclusive: number) => number;
    rollOriginalPartyWideAttack: (rawAttack: number) => number;
    resolveChampionIncomingAttack: (
        state: object,
        champion: Champion,
        currentVitals: ChampionVitals,
        attack: number,
        attackType: string,
        allowedSlots: readonly ChampionWoundSlot[],
        nowMs: number,
    ) => { damage: number; nextVitals: ChampionVitals };
    getProjectileDamageClass: (
        effect: Exclude<ProjectileEffect, 'physical'>,
    ) => 'physical' | 'fire' | 'magic' | 'mental';
    getChampionAdjustedAttackFromResistance: (
        champion: Champion,
        equip: ChampionEquipment,
        adjustedAttack: number,
        damageClass: 'physical' | 'fire' | 'magic' | 'mental',
        runtimeBonuses: Partial<EquipmentStatBonuses> | undefined,
    ) => number;
    getActiveShieldDefense: (
        activeShields: PartyShield[],
        nowMs: number,
        kind: 'fire' | 'magic',
        championId: number,
    ) => number;
};

export function createStorePartyRuntime<TCombatState>(params: StorePartyRuntimeParams<TCombatState>) {
    const applySurvivalDeaths = (
        state: SurvivalPartyState,
        result: ReturnType<typeof advanceSurvivalTimeState>,
    ): AdvanceStoreSurvivalResult => {
        if (
            !state.position ||
            !state.floorItems ||
            !state.championInventories ||
            !state.deadChampions ||
            typeof state.selectedChampionIndex !== 'number'
        ) {
            return result;
        }

        const defeatedChampionIds = state.party
            .filter((champion) => {
                const nextVitals = result.championVitals[champion.id];
                return (nextVitals?.hp ?? 0) <= 0;
            })
            .map((champion) => champion.id);

        if (defeatedChampionIds.length === 0) {
            return result;
        }

        const deathPatch = applyChampionDeathDropsToPartyState(
            {
                level: state.level ?? 0,
                position: state.position,
                party: state.party,
                championInventories: state.championInventories,
                championEquipment: state.championEquipment,
                floorItems: state.floorItems,
                deadChampions: state.deadChampions,
                selectedChampionIndex: state.selectedChampionIndex,
            },
            defeatedChampionIds,
            Date.now(),
            {
                buildDeathDrop: params.buildDeathDrop,
            },
        );

        return deathPatch ? { ...result, ...deathPatch } : result;
    };

    const getEffectiveChampionStats = (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals?: ChampionVitals,
        now = Date.now(),
    ) => params.getEffectiveChampionStatsWithBonuses(
        champion,
        equip,
        params.getChampionRuntimeBonuses(champion, currentVitals, activePotionBoosts, now),
    );

    const advanceSurvivalTime = (
        state: SurvivalPartyState,
        stepCount: number,
        options?: { sleeping?: boolean },
    ): AdvanceStoreSurvivalResult => applySurvivalDeaths(
        state,
        advanceSurvivalTimeState(
            state,
            stepCount,
            {
                sleepSurvivalIntervalTicks: params.sleepSurvivalIntervalTicks,
                awakeSurvivalIntervalTicks: params.awakeSurvivalIntervalTicks,
                originalTimerTickSeconds: params.originalTimerTickSeconds,
                poisonTickIntervalSec: params.poisonTickIntervalSec,
                foodDrainScale: params.foodDrainScale,
                waterDrainScale: params.waterDrainScale,
                maxFood: params.maxFood,
                maxWater: params.maxWater,
                sleepStatRelaxIntervalMask: params.sleepStatRelaxIntervalMask,
                awakeStatRelaxIntervalMask: params.awakeStatRelaxIntervalMask,
                normalizeChampionVitalsForChampion: params.normalizeChampionVitalsForChampion,
                getEffectiveChampionStatsRuntime: getEffectiveChampionStats,
                getChampionSkillLevelFromXP: params.getChampionSkillLevelFromXP,
                getEquipmentSkillLevelModifier: params.getEquipmentSkillLevelModifier,
                normalizeChampionTemporaryXP: params.normalizeChampionTemporaryXP,
                computeOriginalTimeCriteria: params.computeOriginalTimeCriteria,
                applyChampionStaminaDeltaOriginal: params.applyChampionStaminaDeltaOriginal,
                applyLimits: params.applyLimits,
                clampFoodWater: params.clampFoodWater,
                getChampionStatRelaxTargets: params.getChampionStatRelaxTargets,
                relaxChampionCurrentStatsTowardMaximum: params.relaxChampionCurrentStatsTowardMaximum,
            },
            options,
        ),
    );

    const isPartyRested = (state: PartyRestState): boolean =>
        isPartyRestedState(state, { getEffectiveChampionStatsRuntime: getEffectiveChampionStats });

    const buildCombatTickPatch = (state: TCombatState, delta: number, now: number) =>
        params.buildCombatTickPatch(state, delta, now, params.damageEventLifetimeMs);

    const computeMovementCooldown = (state: PartyMovementState): number =>
        computePartyMovementCooldownSeconds(state, {
            getChampionRuntimeBonuses: params.getChampionRuntimeBonuses,
            getTotalWeight: params.getTotalWeight,
            getChampionMaxLoad: (
                champion,
                equip,
                stamina,
                wounds,
                extraBonuses,
            ) => params.getChampionMaxLoad(
                champion,
                equip ?? {},
                stamina,
                wounds,
                extraBonuses,
            ),
        });

    const buildPartyDamageDeps = () => createStorePartyDamageRuntimeDeps({
        buildChampionDamageEvent: params.buildChampionDamageEvent,
        buildDeathDrop: params.buildDeathDrop,
        randomInt: params.randomInt,
        rollOriginalPartyWideAttack: params.rollOriginalPartyWideAttack,
        resolveChampionIncomingAttack: (
            state,
            champion,
            currentVitals,
            attack,
            attackType,
            allowedSlots,
            attackNowMs,
        ) => params.resolveChampionIncomingAttack(
            state as object,
            champion,
            currentVitals,
            attack,
            attackType,
            allowedSlots as readonly ChampionWoundSlot[],
            attackNowMs,
        ),
        getProjectileDamageClass: params.getProjectileDamageClass,
        getChampionAdjustedAttackFromResistance: params.getChampionAdjustedAttackFromResistance,
        getChampionRuntimeBonuses: params.getChampionRuntimeBonuses,
        getActiveShieldDefense: params.getActiveShieldDefense,
    });

    const applyPartyLoadBasedFatigue = (
        state: PartyMovementState,
        loadFactor: number,
    ): Record<number, ChampionVitals> | null =>
        applyPartyLoadBasedFatigueState(state, loadFactor, {
            getEffectiveChampionStatsRuntime: getEffectiveChampionStats,
            getTotalWeight: params.getTotalWeight,
            getChampionMaxLoad: (
                champion,
                equip,
                stamina,
                wounds,
                extraBonuses,
            ) => params.getChampionMaxLoad(
                champion,
                equip ?? {},
                stamina,
                wounds,
                extraBonuses,
            ),
            getChampionRuntimeBonuses: params.getChampionRuntimeBonuses,
            applyChampionStaminaDeltaOriginal: params.applyChampionStaminaDeltaOriginal,
        });

    const applyPartyMoveFatigue = (state: PartyMovementState): Record<number, ChampionVitals> | null =>
        applyPartyLoadBasedFatigue(state, 3);

    return {
        advanceSurvivalTime,
        applyPartyLoadBasedFatigue,
        applyPartyMoveFatigue,
        buildCombatTickPatch,
        buildPartyDamageDeps,
        computeMovementCooldown,
        getEffectiveChampionStats,
        isPartyRested,
    };
}
