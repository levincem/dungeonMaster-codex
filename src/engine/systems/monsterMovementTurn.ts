import type { Direction } from '../runtimeTypes';
import type { CreatureInstance } from '../../types/game';
import { resolveCreatureMovementState, type CreatureMovementStateResult } from './creatureMovementState';
import { resolveSharedRuntimeGroupMovement } from './runtimeGroupMovement';

type RememberedTarget = {
    x: number;
    y: number;
};

type MonsterMovementTurnArgs = {
    creature: CreatureInstance;
    creatures: CreatureInstance[];
    groupMovementPlans: Map<string, CreatureMovementStateResult>;
    canDetectParty: boolean;
    rememberedTarget: RememberedTarget | null;
    partyPosition: [number, number];
    currentDistance: number;
    adjacent: boolean;
    frightened: boolean;
    confused: boolean;
    fluxcaged: boolean;
    prefersRangedSpacing: boolean;
    attackReach: number;
    isArchenemy: boolean;
    currentMoveTimer: number;
    moveSpeed: number;
};

type MonsterMovementTurnDeps = {
    randomInt: (maxExclusive: number) => number;
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
        direction: Direction,
    ) => { x: number; y: number } | null;
    nextMonsterMoveDelaySeconds: (moveSpeed: number) => number;
};

export type MonsterMovementTurnResult = {
    kind: 'none' | 'move' | 'skipTurn';
    moveTimer: number;
    x: number;
    y: number;
    movedThisTick: boolean;
    usesTeleport: boolean;
};

export function resolveMonsterMovementTurn(
    args: MonsterMovementTurnArgs,
    deps: MonsterMovementTurnDeps,
): MonsterMovementTurnResult {
    let moveTimer = args.currentMoveTimer;
    let x = args.creature.x;
    let y = args.creature.y;

    if (moveTimer !== 0 || (args.adjacent && !args.frightened)) {
        return {
            kind: 'none',
            moveTimer,
            x,
            y,
            movedThisTick: false,
            usesTeleport: false,
        };
    }

    moveTimer = deps.nextMonsterMoveDelaySeconds(args.moveSpeed);

    if (args.fluxcaged) {
        return {
            kind: 'skipTurn',
            moveTimer,
            x,
            y,
            movedThisTick: false,
            usesTeleport: false,
        };
    }

    if (args.confused && deps.randomInt(2) === 0) {
        return {
            kind: 'skipTurn',
            moveTimer,
            x,
            y,
            movedThisTick: false,
            usesTeleport: false,
        };
    }

    const movementResult = resolveSharedRuntimeGroupMovement(
        args.creature,
        args.groupMovementPlans,
        () => resolveCreatureMovementState(
            {
                creature: args.creature,
                canDetectParty: args.canDetectParty,
                rememberedTarget: args.rememberedTarget,
                partyPosition: args.partyPosition,
                currentDistance: args.currentDistance,
                frightened: args.frightened,
                prefersRangedSpacing: args.prefersRangedSpacing,
                attackReach: args.attackReach,
                isArchenemy: args.isArchenemy,
            },
            {
                randomInt: deps.randomInt,
                monsterWalkable: deps.monsterWalkable,
                tileAvailable: (targetX, targetY) =>
                    deps.canCreatureShareTile(
                        args.creature,
                        args.creature.mapIndex,
                        targetX,
                        targetY,
                        args.creatures,
                    ),
                canArchenemyDoubleMove: deps.canArchenemyDoubleMove,
            },
        ),
    );

    if (movementResult.kind === 'hold') {
        return {
            kind: 'skipTurn',
            moveTimer,
            x,
            y,
            movedThisTick: false,
            usesTeleport: false,
        };
    }

    if (movementResult.kind === 'move') {
        x = movementResult.x;
        y = movementResult.y;
        return {
            kind: 'move',
            moveTimer,
            x,
            y,
            movedThisTick: x !== args.creature.x || y !== args.creature.y,
            usesTeleport: Boolean(movementResult.usesTeleport),
        };
    }

    return {
        kind: 'none',
        moveTimer,
        x,
        y,
        movedThisTick: false,
        usesTeleport: false,
    };
}
