import type { CreatureDef } from '../../data/creatures';
import type { ChampionTemporaryXP, ChampionXP, SkillKey } from '../../data/skillProgression';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type { ActivePotionBoost, ChampionVitals, Projectile } from '../runtimeTypes';
import type { MonsterAttackResolution } from './monsterAttackResolution';
import { getOriginalParryExperienceAmount } from './originalCombatExperience';
import { applyOriginalLuckCheck } from './originalLuck';

type EffectiveStats = {
    dexterity: number;
    luck: number;
};

type CreatureStealResult = {
    stolenItem: FloorItem | null;
    nextInventory: FloorItem[];
    nextEquipment: ChampionEquipment;
    nextVitals: ChampionVitals;
    shouldFlee: boolean;
};

type CreatureAttackStateArgs = {
    state: {
        position: [number, number];
        activePotionBoosts: ActivePotionBoost[];
    };
    creature: CreatureInstance;
    attackerDef: CreatureDef;
    creatureProjectileEffect: Exclude<Projectile['effect'], 'physical'> | null;
    shouldLaunchProjectile: boolean;
    adjacentAfterMove: boolean;
    targetChampion: Champion | null;
    targetVitals: ChampionVitals | null | undefined;
    party?: Champion[];
    championVitals?: Record<number, ChampionVitals>;
    championXP?: Record<number, ChampionXP>;
    championTemporaryXP?: Record<number, ChampionTemporaryXP>;
    targetInventory: FloorItem[];
    targetEquipment: ChampionEquipment;
    level?: number;
    levelDifficulty: number;
    elapsedGameTimeTicks?: number;
    lastCreatureAttackGameTick?: number;
    nowMs: number;
    partySleeping?: boolean;
};

type CreatureAttackExperiencePatch = {
    championVitals?: Record<number, ChampionVitals>;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    party?: Champion[];
};

type CreatureAttackStateDeps = {
    randomInt: (maxExclusive: number) => number;
    buildProjectile: (
        state: { position: [number, number] },
        creature: CreatureInstance,
        def: CreatureDef,
        effect: Exclude<Projectile['effect'], 'physical'>,
        targetChampionId: number | undefined,
        now: number,
    ) => Projectile;
    getEffectiveChampionStats: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals?: ChampionVitals,
    ) => EffectiveStats;
    tryStealChampionItem: (
        inventory: FloorItem[],
        equipment: ChampionEquipment,
        currentVitals: ChampionVitals,
        dexterity: number,
        deps: {
            randomInt: (maxExclusive: number) => number;
            applyLuckCheck: (
                currentVitals: ChampionVitals,
                luckNeeded: number,
            ) => { success: boolean; nextVitals: ChampionVitals };
        },
    ) => CreatureStealResult;
    resolveMonsterAttackAgainstChampion: (
        args: {
            targetChampion: Champion;
            targetVitals: ChampionVitals;
            targetEquipment: ChampionEquipment;
            targetInventory: FloorItem[];
            targetChampionXP?: ChampionXP;
            targetChampionTemporaryXP?: ChampionTemporaryXP;
            activePotionBoosts: ActivePotionBoost[];
            attackerDef: CreatureDef;
            attackMode: 'melee' | 'ranged';
            levelDifficulty: number;
            nowMs: number;
            partySleeping?: boolean;
        },
    ) => MonsterAttackResolution;
    buildChampionSkillExperiencePatch?: (
        state: {
            level: number;
            party: Champion[];
            championVitals: Record<number, ChampionVitals>;
            championXP: Record<number, ChampionXP>;
            championTemporaryXP: Record<number, ChampionTemporaryXP>;
            elapsedGameTimeTicks: number;
            lastCreatureAttackGameTick: number;
        },
        championId: number,
        skill: SkillKey,
        amount: number,
    ) => CreatureAttackExperiencePatch | null;
};

export type CreatureAttackStateResult =
    | {
        kind: 'none';
        targetChampionId?: number;
        nextVitals?: ChampionVitals;
        party?: Champion[];
        championXP?: Record<number, ChampionXP>;
        championTemporaryXP?: Record<number, ChampionTemporaryXP>;
        debug?: MonsterAttackResolution['debug'];
    }
    | { kind: 'projectile'; projectile: Projectile }
    | {
        kind: 'steal';
        targetChampionId: number;
        stolenItem: FloorItem;
        nextInventory: FloorItem[];
        nextEquipment: ChampionEquipment;
        nextVitals: ChampionVitals;
        shouldFlee: boolean;
    }
    | {
        kind: 'damage';
        targetChampionId: number;
        damage: number;
        nextVitals: ChampionVitals;
        party?: Champion[];
        championXP?: Record<number, ChampionXP>;
        championTemporaryXP?: Record<number, ChampionTemporaryXP>;
        debug?: MonsterAttackResolution['debug'];
    };

export function resolveCreatureAttackState(
    args: CreatureAttackStateArgs,
    deps: CreatureAttackStateDeps,
): CreatureAttackStateResult {
    const {
        state,
        creature,
        attackerDef,
        creatureProjectileEffect,
        shouldLaunchProjectile,
        adjacentAfterMove,
        targetChampion,
        targetVitals,
        targetInventory,
        targetEquipment,
        levelDifficulty,
        nowMs,
        partySleeping,
    } = args;

    if (!targetChampion || !targetVitals || targetVitals.hp <= 0) {
        return { kind: 'none' };
    }

    if (shouldLaunchProjectile && creatureProjectileEffect) {
        return {
            kind: 'projectile',
            projectile: deps.buildProjectile(
                state,
                creature,
                attackerDef,
                creatureProjectileEffect,
                targetChampion.id,
                nowMs,
            ),
        };
    }

    if (attackerDef.attackTypes.includes('Steal')) {
        const effective = deps.getEffectiveChampionStats(
            targetChampion,
            targetEquipment,
            state.activePotionBoosts,
            targetVitals,
        );
        const stealResult = deps.tryStealChampionItem(
            targetInventory,
            targetEquipment,
            targetVitals,
            effective.dexterity,
            {
                randomInt: deps.randomInt,
                applyLuckCheck: (currentVitals, luckNeeded) =>
                    applyOriginalLuckCheck(targetChampion, currentVitals, luckNeeded, deps.randomInt),
            },
        );
        if (!stealResult.stolenItem) {
            return {
                kind: 'none',
                targetChampionId: targetChampion.id,
                nextVitals: stealResult.nextVitals,
            };
        }
        return {
            kind: 'steal',
            targetChampionId: targetChampion.id,
            stolenItem: stealResult.stolenItem,
            nextInventory: stealResult.nextInventory,
            nextEquipment: stealResult.nextEquipment,
            nextVitals: stealResult.nextVitals,
            shouldFlee: stealResult.shouldFlee,
        };
    }

    const attackMode: 'melee' | 'ranged' = !adjacentAfterMove ? 'ranged' : 'melee';
    let currentTargetChampion = targetChampion;
    let currentTargetVitals = targetVitals;
    let nextParty = args.party;
    let nextChampionXP = args.championXP;
    let nextChampionTemporaryXP = args.championTemporaryXP;

    if (
        attackMode === 'melee'
        && deps.buildChampionSkillExperiencePatch
        && args.party
        && args.championVitals
        && args.championXP
        && args.championTemporaryXP
        && typeof args.level === 'number'
        && typeof args.elapsedGameTimeTicks === 'number'
        && typeof args.lastCreatureAttackGameTick === 'number'
    ) {
        const parryExperience = getOriginalParryExperienceAmount(args.attackerDef.experienceClass);
        const xpPatch = deps.buildChampionSkillExperiencePatch(
            {
                level: args.level,
                party: args.party,
                championVitals: args.championVitals,
                championXP: args.championXP,
                championTemporaryXP: args.championTemporaryXP,
                elapsedGameTimeTicks: args.elapsedGameTimeTicks,
                lastCreatureAttackGameTick: args.lastCreatureAttackGameTick,
            },
            targetChampion.id,
            'parry',
            parryExperience,
        );

        if (xpPatch) {
            nextParty = xpPatch.party ?? args.party;
            nextChampionXP = xpPatch.championXP;
            nextChampionTemporaryXP = xpPatch.championTemporaryXP;
            const nextChampionVitals = xpPatch.championVitals ?? args.championVitals;
            currentTargetChampion = nextParty.find((champion) => champion.id === targetChampion.id) ?? targetChampion;
            currentTargetVitals = nextChampionVitals[targetChampion.id] ?? targetVitals;
        }
    }

    const attackResolution = deps.resolveMonsterAttackAgainstChampion({
        targetChampion: currentTargetChampion,
        targetVitals: currentTargetVitals,
        targetEquipment,
        targetInventory,
        targetChampionXP: nextChampionXP?.[targetChampion.id],
        targetChampionTemporaryXP: nextChampionTemporaryXP?.[targetChampion.id],
        activePotionBoosts: state.activePotionBoosts,
        attackerDef,
        attackMode,
        levelDifficulty,
        nowMs,
        partySleeping: partySleeping ?? false,
    });

    if (attackResolution.damage <= 0) {
        return {
            kind: 'none',
            targetChampionId: targetChampion.id,
            nextVitals: attackResolution.nextVitals,
            ...(nextParty ? { party: nextParty } : {}),
            ...(nextChampionXP ? { championXP: nextChampionXP } : {}),
            ...(nextChampionTemporaryXP ? { championTemporaryXP: nextChampionTemporaryXP } : {}),
            ...(attackResolution.debug ? { debug: attackResolution.debug } : {}),
        };
    }

    return {
        kind: 'damage',
        targetChampionId: targetChampion.id,
        damage: Math.max(1, attackResolution.damage),
        nextVitals: attackResolution.nextVitals,
        ...(nextParty ? { party: nextParty } : {}),
        ...(nextChampionXP ? { championXP: nextChampionXP } : {}),
        ...(nextChampionTemporaryXP ? { championTemporaryXP: nextChampionTemporaryXP } : {}),
        ...(attackResolution.debug ? { debug: attackResolution.debug } : {}),
    };
}
