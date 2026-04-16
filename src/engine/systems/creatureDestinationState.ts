import type { CreatureCell, CreatureInstance, GameTile, TeleporterObject } from '../../types/game';
import type { Direction } from '../runtimeTypes';

type ResolveCreatureDestinationArgs = {
    creature: CreatureInstance;
    destination: {
        mapIndex: number;
        x: number;
        y: number;
    };
    movementDirection: Direction | null;
    openTeleporters: Set<string>;
};

type ResolveCreatureDestinationDeps = {
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
    canCreatureShareTile: (creature: CreatureInstance, level: number, x: number, y: number) => boolean;
};

export type CreatureDestinationState = {
    mapIndex: number;
    x: number;
    y: number;
    cell: CreatureCell;
};

export function resolveCreatureDestinationState(
    args: ResolveCreatureDestinationArgs,
    deps: ResolveCreatureDestinationDeps,
): CreatureDestinationState {
    const result: CreatureDestinationState = {
        mapIndex: args.destination.mapIndex,
        x: args.destination.x,
        y: args.destination.y,
        cell: args.creature.cell,
    };

    const destinationTile = deps.getTile(result.mapIndex, result.x, result.y);
    if (destinationTile?.type !== 'Teleporter') {
        return result;
    }

    const tpKey = `${result.mapIndex},${result.y},${result.x}`;
    const teleporter = deps.getTeleporter(destinationTile);
    if (!teleporter || !args.openTeleporters.has(tpKey)) {
        return result;
    }

    const resolvedTransport = deps.resolveCreatureTeleporterTransport(
        { openTeleporters: args.openTeleporters },
        result.mapIndex,
        result.x,
        result.y,
        args.movementDirection ?? 'NORTH',
        args.creature.cell,
    );
    const teleportedMover: CreatureInstance = {
        ...args.creature,
        mapIndex: resolvedTransport.level,
        x: resolvedTransport.x,
        y: resolvedTransport.y,
        cell: resolvedTransport.cell,
    };
    if (
        deps.monsterWalkable(resolvedTransport.level, resolvedTransport.y, resolvedTransport.x) &&
        deps.canCreatureShareTile(teleportedMover, resolvedTransport.level, resolvedTransport.x, resolvedTransport.y)
    ) {
        return {
            mapIndex: resolvedTransport.level,
            x: resolvedTransport.x,
            y: resolvedTransport.y,
            cell: resolvedTransport.cell,
        };
    }

    return result;
}
