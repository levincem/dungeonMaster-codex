import type { CreatureCell, CreatureInstance, GameTile, TeleporterObject } from '../../types/game';
import type { Direction } from '../runtimeTypes';
import { resolveCreatureDestinationState } from './creatureDestinationState';

type MonsterDestinationTurnArgs = {
    creature: CreatureInstance;
    creatures: CreatureInstance[];
    creatureIndex: number;
    destination: {
        mapIndex: number;
        x: number;
        y: number;
    };
    openTeleporters: Set<string>;
};

type MonsterDestinationTurnDeps = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    getTeleporter: (tile: GameTile) => TeleporterObject | undefined;
    resolveCreatureTeleporterTransport: (
        state: Pick<{ openTeleporters: Set<string> }, 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        direction: Direction,
        cell: CreatureCell,
    ) => { level: number; x: number; y: number; cell: CreatureCell };
    monsterWalkable: (level: number, y: number, x: number) => boolean;
    canCreatureShareTile: (
        creature: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ) => boolean;
    normalizeCreatureCellsOnTile: (
        creatures: CreatureInstance[],
        level: number,
        x: number,
        y: number,
    ) => CreatureInstance[];
};

export type MonsterDestinationTurnResult = {
    creatures: CreatureInstance[];
    destinationMapIndex: number;
    x: number;
    y: number;
    cell: CreatureCell;
};

function getMovementDirection(
    creature: CreatureInstance,
    x: number,
    y: number,
): Direction | null {
    if (x > creature.x) return 'EAST';
    if (x < creature.x) return 'WEST';
    if (y > creature.y) return 'SOUTH';
    if (y < creature.y) return 'NORTH';
    return null;
}

export function resolveMonsterDestinationTurn(
    args: MonsterDestinationTurnArgs,
    deps: MonsterDestinationTurnDeps,
): MonsterDestinationTurnResult {
    const movementDirection = getMovementDirection(
        args.creature,
        args.destination.x,
        args.destination.y,
    );
    const destinationState = resolveCreatureDestinationState(
        {
            creature: args.creature,
            destination: args.destination,
            movementDirection,
            openTeleporters: args.openTeleporters,
        },
        {
            getTile: deps.getTile,
            getTeleporter: deps.getTeleporter,
            resolveCreatureTeleporterTransport: deps.resolveCreatureTeleporterTransport,
            monsterWalkable: deps.monsterWalkable,
            canCreatureShareTile: (creature, level, x, y) =>
                deps.canCreatureShareTile(creature, level, x, y, args.creatures),
        },
    );

    if (
        destinationState.mapIndex === args.creature.mapIndex &&
        destinationState.x === args.creature.x &&
        destinationState.y === args.creature.y
    ) {
        return {
            creatures: args.creatures,
            destinationMapIndex: destinationState.mapIndex,
            x: destinationState.x,
            y: destinationState.y,
            cell: destinationState.cell,
        };
    }

    const previousMapIndex = args.creature.mapIndex;
    const previousX = args.creature.x;
    const previousY = args.creature.y;
    let nextCreatures = [...args.creatures];
    nextCreatures[args.creatureIndex] = {
        ...args.creature,
        mapIndex: destinationState.mapIndex,
        x: destinationState.x,
        y: destinationState.y,
        cell: destinationState.cell,
    };
    nextCreatures = deps.normalizeCreatureCellsOnTile(nextCreatures, previousMapIndex, previousX, previousY);
    nextCreatures = deps.normalizeCreatureCellsOnTile(
        nextCreatures,
        destinationState.mapIndex,
        destinationState.x,
        destinationState.y,
    );

    return {
        creatures: nextCreatures,
        destinationMapIndex: destinationState.mapIndex,
        x: destinationState.x,
        y: destinationState.y,
        cell: destinationState.cell,
    };
}
