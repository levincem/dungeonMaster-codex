import type { CreatureInstance, ChampionEquipment, FloorItem } from '../../types/game';
import type { ChampionVitals, Projectile } from '../runtimeTypes';
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
    damageEvents: TDamageEvent[];
    level: number;
};

type CreatureAttackOutcomeStateDeps<TDamageEvent> = {
    buildChampionDamageEvent: (level: number, championId: number, amount: number) => TDamageEvent;
};

export type CreatureAttackOutcomeStateResult<TDamageEvent> =
    | {
        kind: 'none';
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
        targetChampionId: number;
        shouldFlee: boolean;
    }
    | {
        kind: 'damage';
        championVitals: Record<number, ChampionVitals>;
        damageEvents: TDamageEvent[];
        defeatedChampionId: number | null;
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
            damageEvents: [
                ...args.damageEvents,
                deps.buildChampionDamageEvent(
                    args.level,
                    args.attackResult.targetChampionId,
                    args.attackResult.damage,
                ),
            ],
            defeatedChampionId,
        };
    }

    return { kind: 'none' };
}
