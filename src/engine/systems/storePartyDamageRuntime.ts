import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipmentStatBonuses } from '../../data/equipment';
import type {
    ActivePotionBoost,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    ProjectileEffect,
} from '../runtimeTypes';
import {
    applyFrontRowWallBumpDamageRuntimeState,
    applyPartyFallImpactDamageRuntimeState,
    applyPartySpellBacklashDamageRuntimeState,
    applyPartyWideIncomingAttackRuntimeState,
} from './partyIncomingDamageState';

type PartyDamageStateBase = {
    level: number;
    position: [number, number];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
    selectedChampionIndex?: number | null;
    damageEvents: DamageEvent[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat?: unknown;
};

type WallBumpState = Pick<
    PartyDamageStateBase,
    | 'level'
    | 'position'
    | 'party'
    | 'championInventories'
    | 'championEquipment'
    | 'floorItems'
    | 'deadChampions'
    | 'selectedChampionIndex'
>;

type IncomingAttackState = Pick<
    PartyDamageStateBase,
    | 'level'
    | 'position'
    | 'party'
    | 'championInventories'
    | 'championEquipment'
    | 'floorItems'
    | 'deadChampions'
    | 'selectedChampionIndex'
    | 'damageEvents'
    | 'activeShields'
    | 'activePotionBoosts'
    | 'championCombat'
>;

type StorePartyDamageRuntimeParams = {
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
        state: IncomingAttackState,
        champion: Champion,
        currentVitals: ChampionVitals,
        attack: number,
        attackType: string,
        allowedSlots: readonly string[],
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
    getChampionRuntimeBonuses: (
        champion: Champion,
        vitals: ChampionVitals,
        activePotionBoosts: ActivePotionBoost[],
    ) => Partial<EquipmentStatBonuses> | undefined;
    getActiveShieldDefense: (
        activeShields: PartyShield[],
        nowMs: number,
        kind: 'fire' | 'magic',
        championId: number,
    ) => number;
};

export function createStorePartyDamageRuntimeDeps(params: StorePartyDamageRuntimeParams) {
    const sharedDeps = {
        buildChampionDamageEvent: params.buildChampionDamageEvent,
        buildDeathDrop: params.buildDeathDrop,
    };

    return {
        applyFrontRowWallBumpDamage: (
            state: WallBumpState,
            championVitals: Record<number, ChampionVitals>,
            nowMs: number,
        ) => applyFrontRowWallBumpDamageRuntimeState(
            state,
            championVitals,
            nowMs,
            {
                ...sharedDeps,
                randomInt: params.randomInt,
            },
        ),
        applyPartyFallImpactDamage: (
            state: IncomingAttackState,
            championVitals: Record<number, ChampionVitals>,
            landingLevel: number,
            landingPosition: [number, number],
            nowMs = Date.now(),
        ) => applyPartyFallImpactDamageRuntimeState(
            state,
            championVitals,
            landingLevel,
            landingPosition,
            nowMs,
            {
                ...sharedDeps,
                rollOriginalPartyWideAttack: params.rollOriginalPartyWideAttack,
                resolveChampionIncomingAttack: params.resolveChampionIncomingAttack,
            },
        ),
        applyPartySpellBacklashDamage: (
            state: Pick<
                IncomingAttackState,
                | 'level'
                | 'position'
                | 'party'
                | 'championInventories'
                | 'championEquipment'
                | 'floorItems'
                | 'deadChampions'
                | 'selectedChampionIndex'
                | 'damageEvents'
                | 'activeShields'
                | 'activePotionBoosts'
            >,
            championVitals: Record<number, ChampionVitals>,
            effect: Exclude<ProjectileEffect, 'physical'>,
            rawDamage: number,
            nowMs: number,
        ) => applyPartySpellBacklashDamageRuntimeState(
            state,
            championVitals,
            effect,
            rawDamage,
            nowMs,
            {
                ...sharedDeps,
                rollOriginalPartyWideAttack: params.rollOriginalPartyWideAttack,
                getProjectileDamageClass: params.getProjectileDamageClass,
                getChampionAdjustedAttackFromResistance: params.getChampionAdjustedAttackFromResistance,
                getChampionRuntimeBonuses: params.getChampionRuntimeBonuses,
                getActiveShieldDefense: params.getActiveShieldDefense,
            },
        ),
        applyPartyWideIncomingAttack: (
            state: IncomingAttackState,
            championVitals: Record<number, ChampionVitals>,
            rawAttack: number,
            attackType: string,
            allowedSlots: readonly string[],
            nowMs: number,
            spread = true,
        ) => applyPartyWideIncomingAttackRuntimeState(
            state,
            championVitals,
            rawAttack,
            attackType,
            allowedSlots,
            nowMs,
            spread,
            {
                ...sharedDeps,
                rollOriginalPartyWideAttack: params.rollOriginalPartyWideAttack,
                resolveChampionIncomingAttack: params.resolveChampionIncomingAttack,
            },
        ),
    };
}
