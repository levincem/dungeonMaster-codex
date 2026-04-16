import type { CreatureDef } from '../../data/creatures';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type { ActivePotionBoost, ChampionVitals, Projectile } from '../runtimeTypes';
import type { MonsterAttackResolution } from './monsterAttackResolution';

type EffectiveStats = {
    dexterity: number;
    luck: number;
};

type CreatureStealResult = {
    stolenItem: FloorItem | null;
    nextInventory: FloorItem[];
    nextEquipment: ChampionEquipment;
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
    targetInventory: FloorItem[];
    targetEquipment: ChampionEquipment;
    levelDifficulty: number;
    nowMs: number;
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
        dexterity: number,
        luck: number,
        deps: {
            randomInt: (maxExclusive: number) => number;
            isLucky: (luck: number, luckNeeded: number) => boolean;
        },
    ) => CreatureStealResult;
    isCharacterLucky: (luck: number, luckNeeded: number) => boolean;
    resolveMonsterAttackAgainstChampion: (
        args: {
            targetChampion: Champion;
            targetVitals: ChampionVitals;
            targetEquipment: ChampionEquipment;
            targetInventory: FloorItem[];
            activePotionBoosts: ActivePotionBoost[];
            attackerDef: CreatureDef;
            attackMode: 'melee' | 'ranged';
            levelDifficulty: number;
            nowMs: number;
        },
    ) => MonsterAttackResolution;
};

export type CreatureAttackStateResult =
    | { kind: 'none' }
    | { kind: 'projectile'; projectile: Projectile }
    | {
        kind: 'steal';
        targetChampionId: number;
        stolenItem: FloorItem;
        nextInventory: FloorItem[];
        nextEquipment: ChampionEquipment;
        shouldFlee: boolean;
    }
    | {
        kind: 'damage';
        targetChampionId: number;
        damage: number;
        nextVitals: ChampionVitals;
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
            effective.dexterity,
            effective.luck,
            {
                randomInt: deps.randomInt,
                isLucky: deps.isCharacterLucky,
            },
        );
        if (!stealResult.stolenItem) {
            return { kind: 'none' };
        }
        return {
            kind: 'steal',
            targetChampionId: targetChampion.id,
            stolenItem: stealResult.stolenItem,
            nextInventory: stealResult.nextInventory,
            nextEquipment: stealResult.nextEquipment,
            shouldFlee: stealResult.shouldFlee,
        };
    }

    const attackMode: 'melee' | 'ranged' = !adjacentAfterMove ? 'ranged' : 'melee';
    const attackResolution = deps.resolveMonsterAttackAgainstChampion({
        targetChampion,
        targetVitals,
        targetEquipment,
        targetInventory,
        activePotionBoosts: state.activePotionBoosts,
        attackerDef,
        attackMode,
        levelDifficulty,
        nowMs,
    });

    if (attackResolution.damage <= 0) {
        return { kind: 'none' };
    }

    return {
        kind: 'damage',
        targetChampionId: targetChampion.id,
        damage: Math.max(1, attackResolution.damage),
        nextVitals: attackResolution.nextVitals,
    };
}
