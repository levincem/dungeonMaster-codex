import type { Champion } from '../../types/champion';
import type { ChampionTemporaryXP, ChampionXP } from '../../data/skillProgression';
import type { CreatureInstance, ChampionEquipment, FloorItem } from '../../types/game';
import type { ChampionVitals, MonsterAttackDebugEntry, Projectile } from '../runtimeTypes';
import type { CreatureAttackStateResult } from './creatureAttackState';

type CreatureAttackOutcomeStateArgs<TDamageEvent> = {
    attackResult: CreatureAttackStateResult;
    creature: CreatureInstance;
    creatures: CreatureInstance[];
    stateCreatures: CreatureInstance[];
    stateProjectiles: Projectile[];
    currentProjectiles: Projectile[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    baseChampionEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    party: Champion[];
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    damageEvents: TDamageEvent[];
    level: number;
    lastMonsterAttackDebug?: MonsterAttackDebugEntry | null;
};

type CreatureAttackOutcomeStateDeps<TDamageEvent> = {
    buildChampionDamageEvent: (
        level: number,
        championId: number,
        amount: number,
        kind?: 'normal' | 'poison',
        sourceName?: string,
    ) => TDamageEvent;
};

export type CreatureAttackOutcomeStateResult<TDamageEvent> =
    | {
        kind: 'none';
        championVitals?: Record<number, ChampionVitals>;
        party?: Champion[];
        championXP?: Record<number, ChampionXP>;
        championTemporaryXP?: Record<number, ChampionTemporaryXP>;
        lastMonsterAttackDebug?: MonsterAttackDebugEntry | null;
    }
    | {
        kind: 'projectile';
        projectiles: Projectile[];
    }
    | {
        kind: 'steal';
        creatures: CreatureInstance[];
        championInventories: Record<number, FloorItem[]>;
        championEquipment: Record<number, ChampionEquipment>;
        championVitals: Record<number, ChampionVitals>;
        targetChampionId: number;
        shouldFlee: boolean;
    }
    | {
        kind: 'damage';
        championVitals: Record<number, ChampionVitals>;
        party?: Champion[];
        championXP?: Record<number, ChampionXP>;
        championTemporaryXP?: Record<number, ChampionTemporaryXP>;
        damageEvents: TDamageEvent[];
        defeatedChampionId: number | null;
        lastMonsterAttackDebug: MonsterAttackDebugEntry | null;
    };

export function resolveCreatureAttackOutcomeState<TDamageEvent>(
    args: CreatureAttackOutcomeStateArgs<TDamageEvent>,
    deps: CreatureAttackOutcomeStateDeps<TDamageEvent>,
): CreatureAttackOutcomeStateResult<TDamageEvent> {
    if (args.attackResult.kind === 'projectile') {
        const projectiles = args.currentProjectiles === args.stateProjectiles
            ? [...args.stateProjectiles, args.attackResult.projectile]
            : [...args.currentProjectiles, args.attackResult.projectile];
        return {
            kind: 'projectile',
            projectiles,
        };
    }

    if (args.attackResult.kind === 'steal') {
        const nextCreatures = args.creatures === args.stateCreatures ? [...args.stateCreatures] : [...args.creatures];
        const creatureIndex = nextCreatures.findIndex((entry) => entry.id === args.creature.id);
        if (creatureIndex >= 0) {
            nextCreatures[creatureIndex] = {
                ...args.creature,
                carriedItems: [...(args.creature.carriedItems ?? []), args.attackResult.stolenItem],
            };
        }
        return {
            kind: 'steal',
            creatures: nextCreatures,
            championInventories: {
                ...args.championInventories,
                [args.attackResult.targetChampionId]: args.attackResult.nextInventory,
            },
            championEquipment: {
                ...args.baseChampionEquipment,
                ...args.championEquipment,
                [args.attackResult.targetChampionId]: args.attackResult.nextEquipment,
            },
            championVitals: {
                ...args.championVitals,
                [args.attackResult.targetChampionId]: args.attackResult.nextVitals,
            },
            targetChampionId: args.attackResult.targetChampionId,
            shouldFlee: args.attackResult.shouldFlee,
        };
    }

    if (args.attackResult.kind === 'damage') {
        const defeatedChampionId = args.attackResult.nextVitals.hp === 0
            ? args.attackResult.targetChampionId
            : null;
        return {
            kind: 'damage',
            championVitals: {
                ...args.championVitals,
                [args.attackResult.targetChampionId]: args.attackResult.nextVitals,
            },
            ...(args.attackResult.party ? { party: args.attackResult.party } : {}),
            ...(args.attackResult.championXP ? { championXP: args.attackResult.championXP } : {}),
            ...(args.attackResult.championTemporaryXP ? { championTemporaryXP: args.attackResult.championTemporaryXP } : {}),
            damageEvents: [
                ...args.damageEvents,
                deps.buildChampionDamageEvent(
                    args.level,
                    args.attackResult.targetChampionId,
                    args.attackResult.damage,
                    'normal',
                    args.attackResult.debug?.attackerName,
                ),
            ],
            defeatedChampionId,
            lastMonsterAttackDebug: args.attackResult.debug ?? null,
        };
    }

    if (args.attackResult.targetChampionId !== undefined && args.attackResult.nextVitals) {
        return {
            kind: 'none',
            championVitals: {
                ...args.championVitals,
                [args.attackResult.targetChampionId]: args.attackResult.nextVitals,
            },
            ...(args.attackResult.party ? { party: args.attackResult.party } : {}),
            ...(args.attackResult.championXP ? { championXP: args.attackResult.championXP } : {}),
            ...(args.attackResult.championTemporaryXP ? { championTemporaryXP: args.attackResult.championTemporaryXP } : {}),
            lastMonsterAttackDebug: args.attackResult.debug ?? args.lastMonsterAttackDebug,
        };
    }

    return { kind: 'none' };
}
