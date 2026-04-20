import type { CreatureDef } from '../../data/creatures';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureCell, CreatureInstance, FloorItem } from '../../types/game';
import type { ActivePotionBoost, ChampionVitals, DamageEvent, Direction, Projectile } from '../runtimeTypes';
import { resolveCreatureAttackOpportunity } from './creatureAttackOpportunity';
import { resolveCreatureAttackOutcomeState } from './creatureAttackOutcomeState';
import { resolveCreatureAttackStartState } from './creatureAttackStartState';
import { resolveCreatureAttackState } from './creatureAttackState';
import { resolveCreatureAttackTargetState } from './creatureAttackTargetState';
import { isCreatureContactCell, resolveCreatureContactAdvance, selectCreatureAttackTarget } from './frontCreatureState';

type MonsterAttackTurnArgs = {
    creature: CreatureInstance;
    attackerDef: CreatureDef;
    creatures: CreatureInstance[];
    stateCreatures: CreatureInstance[];
    projectiles: Projectile[];
    stateProjectiles: Projectile[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    baseChampionEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    damageEvents: DamageEvent[];
    party: Champion[];
    partyDirection: Direction;
    activePotionBoosts: ActivePotionBoost[];
    partyPosition: [number, number];
    movedPosition: { x: number; y: number };
    movedThisTick: boolean;
    canDetectParty: boolean;
    frightened: boolean;
    confused: boolean;
    attackReach: number;
    currentAttackTimer: number;
    nowMs: number;
    level: number;
    levelDifficulty: number;
    partySleeping: boolean;
};

type MonsterAttackTurnDeps = {
    randomInt: (maxExclusive: number) => number;
    chooseCreatureProjectileEffect: (
        creatureTypeId: number,
        randomInt: (maxExclusive: number) => number,
    ) => Exclude<Projectile['effect'], 'physical'> | null;
    getCreatureSizeOnTile: (typeId: number) => number;
    isCreatureCellOccupiedOnTile: (
        creatures: CreatureInstance[],
        mover: CreatureInstance,
        targetCell: CreatureCell,
    ) => boolean;
    nextMonsterMoveDelaySeconds: (moveSpeed: number) => number;
    nextMonsterAttackDelaySeconds: (attackSpeed: number) => number;
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
    ) => { dexterity: number; luck: number };
    tryStealChampionItem: Parameters<typeof resolveCreatureAttackState>[1]['tryStealChampionItem'];
    resolveMonsterAttackAgainstChampion: Parameters<typeof resolveCreatureAttackState>[1]['resolveMonsterAttackAgainstChampion'];
    buildChampionDamageEvent: (level: number, championId: number, amount: number) => DamageEvent;
    attackWindowMs: number;
};

export type MonsterAttackTurnResult = {
    kind: 'idle' | 'blocked' | 'contactAdvance' | 'projectile' | 'steal' | 'damage' | 'none';
    nextAttackTimer: number;
    nextMoveTimer?: number;
    targetCell?: CreatureCell;
    attackWindowExpiresAt?: number;
    creatures?: CreatureInstance[];
    projectiles?: Projectile[];
    championInventories?: Record<number, FloorItem[]>;
    championEquipment?: Record<number, ChampionEquipment>;
    championVitals?: Record<number, ChampionVitals>;
    damageEvents?: DamageEvent[];
    defeatedChampionId?: number | null;
    shouldFlee?: boolean;
};

export function resolveMonsterAttackTurn(
    args: MonsterAttackTurnArgs,
    deps: MonsterAttackTurnDeps,
): MonsterAttackTurnResult {
    const px = args.partyPosition[1];
    const py = args.partyPosition[0];
    const distanceAfterMove = Math.abs(px - args.movedPosition.x) + Math.abs(py - args.movedPosition.y);
    const adjacentAfterMove = distanceAfterMove === 1;
    const creatureProjectileEffect = deps.chooseCreatureProjectileEffect(args.creature.typeId, deps.randomInt);

    const attackOpportunity = resolveCreatureAttackOpportunity(
        {
            attackReach: args.attackReach,
            distanceAfterMove,
            canDetectParty: args.canDetectParty,
            movedThisTick: args.movedThisTick,
            frightened: args.frightened,
            atkTimer: args.currentAttackTimer,
            projectileEffectAvailable: Boolean(creatureProjectileEffect),
            adjacentAfterMove,
            isContactCell: isCreatureContactCell(args.creature.cell),
            attackWindowSeconds: deps.attackWindowMs / 1000,
        },
        { randomInt: deps.randomInt },
    );

    const contactAdvance = resolveCreatureContactAdvance(
        args.creature,
        args.creatures,
        {
            frightened: args.frightened,
            movedThisTick: args.movedThisTick,
            adjacentAfterMove,
            attackReach: args.attackReach,
            creatureSizeOnTile: deps.getCreatureSizeOnTile(args.creature.typeId),
        },
        {
            isCreatureCellOccupiedOnTile: deps.isCreatureCellOccupiedOnTile,
            nextMonsterMoveDelaySeconds: () => deps.nextMonsterMoveDelaySeconds(args.attackerDef.moveSpd),
        },
    );
    if (contactAdvance) {
        return {
            kind: 'contactAdvance',
            nextAttackTimer: attackOpportunity.nextAttackTimer,
            nextMoveTimer: contactAdvance.nextMoveTimer,
            targetCell: contactAdvance.targetCell,
        };
    }

    const attackStart = resolveCreatureAttackStartState({
        shouldAttemptAttack: attackOpportunity.shouldAttemptAttack,
        confused: args.confused,
        currentAttackTimer: attackOpportunity.nextAttackTimer,
        nextAttackDelaySeconds: deps.nextMonsterAttackDelaySeconds(args.attackerDef.atkSpd),
        nowMs: args.nowMs,
        attackWindowMs: deps.attackWindowMs,
        confusedSkipRoll: deps.randomInt(2),
    });
    if (attackStart.kind === 'idle' || attackStart.kind === 'blocked') {
        return {
            kind: attackStart.kind,
            nextAttackTimer: attackStart.nextAttackTimer,
        };
    }

    const targetingContext = {
        partyPosition: args.partyPosition,
        attackerPosition: args.movedPosition,
        partyDirection: args.partyDirection,
    };

    const target = selectCreatureAttackTarget(
        args.party,
        args.championVitals,
        args.creature.cell,
        args.attackerDef.attackAnyChampion,
        args.attackerDef.attackFromAllSides,
        (maxExclusive) => deps.randomInt(maxExclusive),
        targetingContext,
    );

    const constrainedAdjacentTarget = adjacentAfterMove
        ? selectCreatureAttackTarget(
            args.party,
            args.championVitals,
            args.creature.cell,
            false,
            false,
            (maxExclusive) => deps.randomInt(maxExclusive),
            targetingContext,
        )
        : null;
    const finalTarget = constrainedAdjacentTarget ?? target;

    if (!finalTarget) {
        return {
            kind: 'none',
            nextAttackTimer: attackStart.nextAttackTimer,
            attackWindowExpiresAt: attackStart.attackWindowExpiresAt,
        };
    }

    const targetState = resolveCreatureAttackTargetState({
        party: args.party,
        championVitals: args.championVitals,
        championInventories: args.championInventories,
        championEquipment: {
            ...args.baseChampionEquipment,
            ...args.championEquipment,
        },
        selectedTargetId: finalTarget.id,
    });

    const attackResult = resolveCreatureAttackState(
        {
            state: {
                position: args.partyPosition,
                activePotionBoosts: args.activePotionBoosts,
            },
            creature: {
                ...args.creature,
                x: args.movedPosition.x,
                y: args.movedPosition.y,
            },
            attackerDef: args.attackerDef,
            creatureProjectileEffect,
            shouldLaunchProjectile: attackOpportunity.shouldLaunchProjectile,
            adjacentAfterMove,
            targetChampion: targetState.targetChampion,
            targetVitals: targetState.targetVitals,
            targetInventory: targetState.targetInventory,
            targetEquipment: targetState.targetEquipment,
            levelDifficulty: args.levelDifficulty,
            nowMs: args.nowMs,
            partySleeping: args.partySleeping,
        },
        {
            randomInt: deps.randomInt,
            buildProjectile: deps.buildProjectile,
            getEffectiveChampionStats: deps.getEffectiveChampionStats,
            tryStealChampionItem: deps.tryStealChampionItem,
            resolveMonsterAttackAgainstChampion: deps.resolveMonsterAttackAgainstChampion,
        },
    );

    const attackOutcome = resolveCreatureAttackOutcomeState(
        {
            attackResult,
            creature: args.creature,
            creatures: args.creatures,
            stateCreatures: args.stateCreatures,
            stateProjectiles: args.stateProjectiles,
            currentProjectiles: args.projectiles,
            championInventories: args.championInventories,
            championEquipment: args.championEquipment,
            baseChampionEquipment: args.baseChampionEquipment,
            championVitals: args.championVitals,
            damageEvents: args.damageEvents,
            level: args.level,
        },
        {
            buildChampionDamageEvent: deps.buildChampionDamageEvent,
        },
    );

    if (attackOutcome.kind === 'projectile') {
        return {
            kind: 'projectile',
            nextAttackTimer: attackStart.nextAttackTimer,
            attackWindowExpiresAt: attackStart.attackWindowExpiresAt,
            projectiles: attackOutcome.projectiles,
        };
    }

    if (attackOutcome.kind === 'steal') {
        return {
            kind: 'steal',
            nextAttackTimer: attackStart.nextAttackTimer,
            attackWindowExpiresAt: attackStart.attackWindowExpiresAt,
            creatures: attackOutcome.creatures,
            championInventories: attackOutcome.championInventories,
            championEquipment: attackOutcome.championEquipment,
            championVitals: attackOutcome.championVitals,
            shouldFlee: attackOutcome.shouldFlee,
        };
    }

    if (attackOutcome.kind === 'damage') {
        return {
            kind: 'damage',
            nextAttackTimer: attackStart.nextAttackTimer,
            attackWindowExpiresAt: attackStart.attackWindowExpiresAt,
            championVitals: attackOutcome.championVitals,
            damageEvents: attackOutcome.damageEvents,
            defeatedChampionId: attackOutcome.defeatedChampionId,
        };
    }

    return {
        kind: 'none',
        nextAttackTimer: attackStart.nextAttackTimer,
        attackWindowExpiresAt: attackStart.attackWindowExpiresAt,
        championVitals: attackOutcome.championVitals,
    };
}
