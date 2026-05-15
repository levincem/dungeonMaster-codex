import type { GameTile } from '../../types/game';
import type { ActiveFluxcage, Direction } from '../runtimeTypes';
import { getDirectionStep } from './directionState';
import { isTrickWallPassable } from './trickWallState';

export const FLUXCAGE_DURATION_MS = 120_000;

type FluxcageTileLookupDeps = {
    getMapTile: (level: number, x: number, y: number) => GameTile | undefined;
};

export function getFrontFluxcageTile(
    position: [number, number],
    direction: Direction,
): { x: number; y: number } {
    const [stepX, stepY] = getDirectionStep(direction);
    const [partyY, partyX] = position;
    return {
        x: partyX + stepX,
        y: partyY + stepY,
    };
}

export function hasActiveFluxcageAt(
    activeFluxcages: readonly ActiveFluxcage[],
    level: number,
    x: number,
    y: number,
    now: number,
): boolean {
    return activeFluxcages.some((fluxcage) =>
        fluxcage.level === level &&
        fluxcage.x === x &&
        fluxcage.y === y &&
        fluxcage.expiresAt > now,
    );
}

export function upsertActiveFluxcage(
    activeFluxcages: readonly ActiveFluxcage[],
    level: number,
    x: number,
    y: number,
    expiresAt: number,
): ActiveFluxcage[] {
    const nextFluxcage: ActiveFluxcage = {
        id: `fluxcage_${level}_${x}_${y}`,
        level,
        x,
        y,
        expiresAt,
    };
    const existingIndex = activeFluxcages.findIndex((fluxcage) =>
        fluxcage.level === level &&
        fluxcage.x === x &&
        fluxcage.y === y,
    );

    if (existingIndex < 0) {
        return [...activeFluxcages, nextFluxcage];
    }

    return activeFluxcages.map((fluxcage, index) =>
        index === existingIndex ? nextFluxcage : fluxcage,
    );
}

export function isFluxcagePlaceableTile(
    level: number,
    x: number,
    y: number,
    openDoors: Set<string>,
    openPits: Set<string>,
    openWalls: Set<string>,
    deps: FluxcageTileLookupDeps,
): boolean {
    const tile = deps.getMapTile(level, x, y);
    if (!tile) return false;
    if (tile.type === 'Wall') return false;
    if (tile.type === 'TrickWall') return isTrickWallPassable(tile, level, y, x, openWalls);
    if (tile.type === 'Door') return openDoors.has(`${level},${y},${x}`);
    if (tile.type === 'Pit') return !openPits.has(`${level},${y},${x}`);
    return true;
}
