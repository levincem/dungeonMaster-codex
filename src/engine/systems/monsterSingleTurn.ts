import type { CreatureDef } from '../../data/creatures';
import type { Champion } from '../../types/champion';
import type {
    ChampionEquipment,
    CreatureCell,
    CreatureInstance,
    FloorItem,
    GameTile,
    TeleporterObject,
} from '../../types/game';
import type { ActivePotionBoost, ChampionVitals, DamageEvent, Direction, MonsterAttackDebugEntry, Projectile } from '../runtimeTypes';
import type { CreatureMovementStateResult } from './creatureMovementState';
import { resolveMonsterAttackTurn } from './monsterAttackTurn';
import { resolveMonsterDestinationTurn } from './monsterDestinationTurn';
import { resolveMonsterMovementTurn } from './monsterMovementTurn';
import {
    resolveMonsterTurnState,
    type MonsterLastSeenPartyPosition,
    type MonsterMemoryUpdate,
    type MonsterTimers,
} from './monsterTurnState';

type MonsterSingleTurnArgs = {
    creature: CreatureInstance;
    creatureIndex: number;
    creatureDef: CreatureDef;
    deltaSeconds: number;
    nowMs: number;
    level: number;
    levelDifficulty: number;
    partyPosition: [number, number];
    partyDirection: Direction;
    party: Champion[];
    activePotionBoosts: ActivePotionBoost[];
    invisibleUntil: number;
    openTeleporters: Set<string>;
    currentTimers: MonsterTimers | undefined;
    lastSeen: MonsterLastSeenPartyPosition | undefined;
    confusedUntilMs: number;
    fluxcageUntilMs: number;
    frightenedUntilMs: number;
    creatures: CreatureInstance[];
    stateCreatures: CreatureInstance[];
    projectiles: Projectile[];
    stateProjectiles: Projectile[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    baseChampionEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    damageEvents: DamageEvent[];
    partySleeping: boolean;
    groupMovementPlans: Map<string, CreatureMovementStateResult>;
    lastMonsterAttackDebug?: MonsterAttackDebugEntry | null;
};

type MonsterSingleTurnDeps = {
    randomFraction: () => number;
    randomInt: (maxExclusive: number) => number;
    hasLineOfSight: () => boolean;
    nextMonsterMoveDelaySeconds: (moveTicks: number) => number;
    nextMonsterAttackDelaySeconds: (attackTicks: number) => number;
    monsterWalkable: (level: number, y: number, x: number) => boolean;
    canCreatureShareTile: (
        creature: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ) => boolean;
    canArchenemyDoubleMove: (
        creature: CreatureInstance,
        level: number,
        x: number,
        y: number,
        direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST',
    ) => { x: number; y: number } | null;
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
    tryStealChampionItem: Parameters<typeof resolveMonsterAttackTurn>[1]['tryStealChampionItem'];
    resolveMonsterAttackAgainstChampion: Parameters<typeof resolveMonsterAttackTurn>[1]['resolveMonsterAttackAgainstChampion'];
    buildChampionDamageEvent: (level: number, championId: number, amount: number) => DamageEvent;
    attackWindowMs: number;
    buildFrightenedUntilMs: (nowMs: number) => number;
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    getTeleporter: (tile: GameTile) => TeleporterObject | undefined;
    resolveCreatureTeleporterTransport: (
        state: Pick<{ openTeleporters: Set<string> }, 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST',
        cell: CreatureCell,
    ) => { level: number; x: number; y: number; cell: CreatureCell };
    normalizeCreatureCellsOnTile: (
        creatures: CreatureInstance[],
        level: number,
        x: number,
        y: number,
    ) => CreatureInstance[];
};

export type MonsterSingleTurnResult = {
    creatures: CreatureInstance[];
    projectiles: Projectile[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    damageEvents: DamageEvent[];
    moveTimer: number;
    attackTimer: number;
    memoryUpdate: MonsterMemoryUpdate;
    notifyMove: boolean;
    movementSound: 'teleport' | 'creature' | null;
    notifyAttack: boolean;
    attackWindowExpiresAt?: number;
    shouldPlayChampionWounded: boolean;
    frightenedUntilMs?: number;
    defeatedChampionId?: number | null;
    lastMonsterAttackDebug?: MonsterAttackDebugEntry | null;
};

export function resolveMonsterSingleTurn(
    args: MonsterSingleTurnArgs,
    deps: MonsterSingleTurnDeps,
): MonsterSingleTurnResult {
    const turnState = resolveMonsterTurnState(
        {
            creature: args.creature,
            creatureDef: args.creatureDef,
            currentTimers: args.currentTimers,
            deltaSeconds: args.deltaSeconds,
            nowMs: args.nowMs,
            partyPosition: [args.partyPosition[1], args.partyPosition[0]],
            invisibleUntil: args.invisibleUntil,
            lastSeen: args.lastSeen,
            confusedUntilMs: args.confusedUntilMs,
            fluxcageUntilMs: args.fluxcageUntilMs,
            frightenedUntilMs: args.frightenedUntilMs,
        },
        {
            randomFraction: deps.randomFraction,
            nextMonsterMoveDelaySeconds: deps.nextMonsterMoveDelaySeconds,
            nextMonsterAttackDelaySeconds: deps.nextMonsterAttackDelaySeconds,
            hasLineOfSight: deps.hasLineOfSight,
        },
    );

    let creatures = args.creatures;
    let projectiles = args.projectiles;
    let championInventories = args.championInventories;
    let championEquipment = args.championEquipment;
    let championVitals = args.championVitals;
    let damageEvents = args.damageEvents;
    let moveTimer = turnState.moveTimer;
    let attackTimer = turnState.attackTimer;
    let memoryUpdate = turnState.memoryUpdate;
    let notifyMove = false;
    let movementSound: 'teleport' | 'creature' | null = null;
    let notifyAttack = false;
    let attackWindowExpiresAt: number | undefined;
    let shouldPlayChampionWounded = false;
    let frightenedUntilMs: number | undefined;
    let defeatedChampionId: number | null | undefined;
    let lastMonsterAttackDebug = args.lastMonsterAttackDebug;

    const perception = turnState.perception;
    const runtimeState = turnState.runtimeState;

    const movementTurn = resolveMonsterMovementTurn(
        {
            creature: args.creature,
            creatures,
            groupMovementPlans: args.groupMovementPlans,
            canDetectParty: perception.canDetectParty,
            rememberedTarget: perception.rememberedTarget,
            partyPosition: args.partyPosition,
            currentDistance: perception.distance,
            adjacent: perception.adjacent,
            frightened: runtimeState.frightened,
            confused: runtimeState.confused,
            fluxcaged: runtimeState.fluxcaged,
            prefersRangedSpacing: runtimeState.prefersRangedSpacing,
            attackReach: runtimeState.attackReach,
            isArchenemy: args.creatureDef.archenemy,
            currentMoveTimer: moveTimer,
            moveSpeed: args.creatureDef.moveSpd,
        },
        {
            randomInt: deps.randomInt,
            monsterWalkable: deps.monsterWalkable,
            canCreatureShareTile: deps.canCreatureShareTile,
            canArchenemyDoubleMove: deps.canArchenemyDoubleMove,
            nextMonsterMoveDelaySeconds: deps.nextMonsterMoveDelaySeconds,
        },
    );
    moveTimer = movementTurn.moveTimer;
    const x = movementTurn.x;
    const y = movementTurn.y;

    if (movementTurn.kind === 'skipTurn') {
        return {
            creatures,
            projectiles,
            championInventories,
            championEquipment,
            championVitals,
            damageEvents,
            moveTimer,
            attackTimer,
            memoryUpdate,
            notifyMove,
            movementSound,
            notifyAttack,
            attackWindowExpiresAt,
            shouldPlayChampionWounded,
            lastMonsterAttackDebug,
        };
    }

    if (movementTurn.kind === 'move' && movementTurn.movedThisTick) {
        notifyMove = true;
        movementSound = movementTurn.usesTeleport
            ? 'teleport'
            : perception.canDetectParty
                ? 'creature'
                : null;
    }

    const attackTurn = resolveMonsterAttackTurn(
        {
            creature: args.creature,
            attackerDef: args.creatureDef,
            creatures,
            stateCreatures: args.stateCreatures,
            projectiles,
            stateProjectiles: args.stateProjectiles,
            championInventories,
            championEquipment,
            baseChampionEquipment: args.baseChampionEquipment,
            championVitals,
            damageEvents,
            party: args.party,
            partyDirection: args.partyDirection,
            activePotionBoosts: args.activePotionBoosts,
            partyPosition: args.partyPosition,
            movedPosition: { x, y },
            movedThisTick: movementTurn.movedThisTick,
            canDetectParty: perception.canDetectParty,
            frightened: runtimeState.frightened,
            confused: runtimeState.confused,
            attackReach: runtimeState.attackReach,
            currentAttackTimer: attackTimer,
            nowMs: args.nowMs,
            level: args.level,
            levelDifficulty: args.levelDifficulty,
            partySleeping: args.partySleeping,
            lastMonsterAttackDebug,
        },
        {
            randomInt: deps.randomInt,
            chooseCreatureProjectileEffect: deps.chooseCreatureProjectileEffect,
            getCreatureSizeOnTile: deps.getCreatureSizeOnTile,
            isCreatureCellOccupiedOnTile: deps.isCreatureCellOccupiedOnTile,
            nextMonsterMoveDelaySeconds: deps.nextMonsterMoveDelaySeconds,
            nextMonsterAttackDelaySeconds: deps.nextMonsterAttackDelaySeconds,
            buildProjectile: deps.buildProjectile,
            getEffectiveChampionStats: deps.getEffectiveChampionStats,
            tryStealChampionItem: deps.tryStealChampionItem,
            resolveMonsterAttackAgainstChampion: deps.resolveMonsterAttackAgainstChampion,
            buildChampionDamageEvent: deps.buildChampionDamageEvent,
            attackWindowMs: deps.attackWindowMs,
        },
    );
    attackTimer = attackTurn.nextAttackTimer;

    if (attackTurn.kind === 'contactAdvance') {
        if (creatures === args.creatures) creatures = [...creatures];
        creatures[args.creatureIndex] = {
            ...args.creature,
            cell: attackTurn.targetCell ?? args.creature.cell,
        };
        moveTimer = attackTurn.nextMoveTimer ?? moveTimer;
        notifyMove = true;
        movementSound = null;
        return {
            creatures,
            projectiles,
            championInventories,
            championEquipment,
            championVitals,
            damageEvents,
            moveTimer,
            attackTimer,
            memoryUpdate,
            notifyMove,
            movementSound,
            notifyAttack,
            attackWindowExpiresAt,
            shouldPlayChampionWounded,
            lastMonsterAttackDebug,
        };
    }

    if (attackTurn.attackWindowExpiresAt) {
        notifyAttack = true;
        attackWindowExpiresAt = attackTurn.attackWindowExpiresAt;
    }

    if (attackTurn.kind === 'projectile') {
        projectiles = attackTurn.projectiles ?? projectiles;
        return {
            creatures,
            projectiles,
            championInventories,
            championEquipment,
            championVitals,
            damageEvents,
            moveTimer,
            attackTimer,
            memoryUpdate,
            notifyMove,
            movementSound,
            notifyAttack,
            attackWindowExpiresAt,
            shouldPlayChampionWounded,
            lastMonsterAttackDebug,
        };
    }

    if (attackTurn.kind === 'steal') {
        creatures = attackTurn.creatures ?? creatures;
        championInventories = attackTurn.championInventories ?? championInventories;
        championEquipment = attackTurn.championEquipment ?? championEquipment;
        championVitals = attackTurn.championVitals ?? championVitals;
        if (attackTurn.shouldFlee) {
            frightenedUntilMs = deps.buildFrightenedUntilMs(args.nowMs);
            memoryUpdate = { kind: 'clear' };
        }
        return {
            creatures,
            projectiles,
            championInventories,
            championEquipment,
            championVitals,
            damageEvents,
            moveTimer,
            attackTimer,
            memoryUpdate,
            notifyMove,
            movementSound,
            notifyAttack,
            attackWindowExpiresAt,
            shouldPlayChampionWounded,
            frightenedUntilMs,
            lastMonsterAttackDebug,
        };
    }

    if (attackTurn.kind === 'damage') {
        championVitals = attackTurn.championVitals ?? championVitals;
        damageEvents = attackTurn.damageEvents ?? damageEvents;
        defeatedChampionId = attackTurn.defeatedChampionId;
        shouldPlayChampionWounded = true;
        lastMonsterAttackDebug = attackTurn.lastMonsterAttackDebug ?? lastMonsterAttackDebug;
    } else if (attackTurn.kind === 'none' && attackTurn.championVitals) {
        championVitals = attackTurn.championVitals;
        lastMonsterAttackDebug = attackTurn.lastMonsterAttackDebug ?? lastMonsterAttackDebug;
    }

    const destinationTurn = resolveMonsterDestinationTurn(
        {
            creature: args.creature,
            creatures,
            creatureIndex: args.creatureIndex,
            destination: {
                mapIndex: args.creature.mapIndex,
                x,
                y,
            },
            openTeleporters: args.openTeleporters,
        },
        {
            getTile: deps.getTile,
            getTeleporter: deps.getTeleporter,
            resolveCreatureTeleporterTransport: deps.resolveCreatureTeleporterTransport,
            monsterWalkable: deps.monsterWalkable,
            canCreatureShareTile: deps.canCreatureShareTile,
            normalizeCreatureCellsOnTile: deps.normalizeCreatureCellsOnTile,
        },
    );
    creatures = destinationTurn.creatures;

    return {
        creatures,
        projectiles,
        championInventories,
        championEquipment,
        championVitals,
        damageEvents,
        moveTimer,
        attackTimer,
        memoryUpdate,
        notifyMove,
        movementSound,
        notifyAttack,
        attackWindowExpiresAt,
        shouldPlayChampionWounded,
        frightenedUntilMs,
        defeatedChampionId,
        lastMonsterAttackDebug,
    };
}
