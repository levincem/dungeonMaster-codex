import type { CreatureInstance, GameTile } from '../../types/game';
import { isTrickWallPassable } from './trickWallState';

type LordChaosFluxcageEscapeDeps = {
    getMapTile: (level: number, x: number, y: number) => GameTile | undefined;
    canCreatureShareTile: (
        mover: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ) => boolean;
};

function isEscapeTileOpen(
    level: number,
    x: number,
    y: number,
    openDoors: Set<string>,
    openPits: Set<string>,
    openWalls: Set<string>,
    deps: LordChaosFluxcageEscapeDeps,
): boolean {
    const tile = deps.getMapTile(level, x, y);
    if (!tile) return false;
    if (tile.type === 'Wall') return false;
    if (tile.type === 'TrickWall') return isTrickWallPassable(tile, level, y, x, openWalls);
    if (tile.type === 'Door') return openDoors.has(`${level},${y},${x}`);
    if (tile.type === 'Pit') return !openPits.has(`${level},${y},${x}`);
    return true;
}

export function resolveLordChaosFluxcageEscape(
    target: CreatureInstance | null,
    creatures: CreatureInstance[],
    partyPosition: [number, number],
    openDoors: Set<string>,
    openPits: Set<string>,
    openWalls: Set<string>,
    deps: LordChaosFluxcageEscapeDeps,
): { x: number; y: number } | null {
    if (!target || !target.alive || target.typeId !== 23) return null;

    const [partyY, partyX] = partyPosition;
    const candidates = [
        { x: target.x + 1, y: target.y },
        { x: target.x - 1, y: target.y },
        { x: target.x, y: target.y + 1 },
        { x: target.x, y: target.y - 1 },
    ]
        .filter(({ x, y }) => !(x === partyX && y === partyY))
        .filter(({ x, y }) =>
            isEscapeTileOpen(
                target.mapIndex,
                x,
                y,
                openDoors,
                openPits,
                openWalls,
                deps,
            ),
        )
        .filter(({ x, y }) =>
            deps.canCreatureShareTile(
                { ...target, x, y },
                target.mapIndex,
                x,
                y,
                creatures,
            ),
        )
        .map(({ x, y }) => ({
            x,
            y,
            distanceFromParty: Math.abs(partyX - x) + Math.abs(partyY - y),
        }))
        .sort((a, b) => b.distanceFromParty - a.distanceFromParty);

    const choice = candidates[0];
    return choice ? { x: choice.x, y: choice.y } : null;
}
