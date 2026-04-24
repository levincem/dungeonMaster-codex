import type { CreatureDef } from '../../data/creatures';
import type { ChampionTemporaryXP, ChampionXP } from '../../data/skillProgression';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureCell, CreatureInstance, FloorItem } from '../../types/game';
import type { ActivePotionBoost, ChampionVitals, DamageEvent, Direction, MonsterAttackDebugEntry, Projectile } from '../runtimeTypes';
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
    championXP?: Record<number, ChampionXP>;
    championTemporaryXP?: Record<number, ChampionTemporaryXP>;
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
    elapsedGameTimeTicks?: number;
    lastCreatureAttackGameTick?: number;
    partySleeping: boolean;
    lastMonsterAttackDebug?: MonsterAttackDebugEntry | null;
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
    buildChampionSkillExperiencePatch?: Parameters<typeof resolveCreatureAttackState>[1]['buildChampionSkillExperiencePatch'];
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
    championXP?: Record<number, ChampionXP>;
    championTemporaryXP?: Record<number, ChampionTemporaryXP>;
    party?: Champion[];
    damageEvents?: DamageEvent[];
    defeatedChampionId?: number | null;
    shouldFlee?: boolean;
    lastMonsterAttackDebug?: MonsterAttackDebugEntry | null;
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
            lastMonsterAttackDebug: args.lastMonsterAttackDebug,
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
            lastMonsterAttackDebug: args.lastMonsterAttackDebug,
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
            lastMonsterAttackDebug: args.lastMonsterAttackDebug,
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
            party: args.party,
            championVitals: args.championVitals,
            championXP: args.championXP,
            championTemporaryXP: args.championTemporaryXP,
            targetInventory: targetState.targetInventory,
            targetEquipment: targetState.targetEquipment,
            level: args.level,
            levelDifficulty: args.levelDifficulty,
            elapsedGameTimeTicks: args.elapsedGameTimeTicks,
            lastCreatureAttackGameTick: args.lastCreatureAttackGameTick,
            nowMs: args.nowMs,
            partySleeping: args.partySleeping,
        },
        {
            randomInt: deps.randomInt,
            buildProjectile: deps.buildProjectile,
            getEffectiveChampionStats: deps.getEffectiveChampionStats,
            tryStealChampionItem: deps.tryStealChampionItem,
            resolveMonsterAttackAgainstChampion: deps.resolveMonsterAttackAgainstChampion,
            buildChampionSkillExperiencePatch: deps.buildChampionSkillExperiencePatch,
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
            party: args.party,
            championXP: args.championXP ?? {},
            championTemporaryXP: args.championTemporaryXP ?? {},
            damageEvents: args.damageEvents,
            level: args.level,
            lastMonsterAttackDebug: args.lastMonsterAttackDebug,
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
            lastMonsterAttackDebug: args.lastMonsterAttackDebug,
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
            lastMonsterAttackDebug: args.lastMonsterAttackDebug,
        };
    }

    if (attackOutcome.kind === 'damage') {
        return {
            kind: 'damage',
            nextAttackTimer: attackStart.nextAttackTimer,
            attackWindowExpiresAt: attackStart.attackWindowExpiresAt,
            championVitals: attackOutcome.championVitals,
            ...(attackOutcome.party ? { party: attackOutcome.party } : {}),
            ...(attackOutcome.championXP ? { championXP: attackOutcome.championXP } : {}),
            ...(attackOutcome.championTemporaryXP ? { championTemporaryXP: attackOutcome.championTemporaryXP } : {}),
            damageEvents: attackOutcome.damageEvents,
            defeatedChampionId: attackOutcome.defeatedChampionId,
            lastMonsterAttackDebug: attackOutcome.lastMonsterAttackDebug,
        };
    }

    return {
        kind: 'none',
        nextAttackTimer: attackStart.nextAttackTimer,
        attackWindowExpiresAt: attackStart.attackWindowExpiresAt,
        championVitals: attackOutcome.championVitals,
        ...(attackOutcome.party ? { party: attackOutcome.party } : {}),
        ...(attackOutcome.championXP ? { championXP: attackOutcome.championXP } : {}),
        ...(attackOutcome.championTemporaryXP ? { championTemporaryXP: attackOutcome.championTemporaryXP } : {}),
        lastMonsterAttackDebug: attackOutcome.lastMonsterAttackDebug,
    };
}
