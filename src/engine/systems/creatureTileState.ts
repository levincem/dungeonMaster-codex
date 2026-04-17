import type { CreatureCell } from '../../types/game';
import { compareCreatureCells } from './frontCreatureState';

type CreatureTileLike = {
    id: string;
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
    typeId: number;
    cell: CreatureCell;
};

export function getTileCapacityForCreatures<TCreature extends Pick<CreatureTileLike, 'typeId'>>(
    creatures: readonly TCreature[],
    getCreatureTileCapacity: (typeId: number) => number,
): number {
    if (creatures.length <= 0) return 4;
    return creatures.reduce(
        (capacity, creature) => Math.min(capacity, getCreatureTileCapacity(creature.typeId)),
        4,
    );
}

export function getCreatureCellsForOccupancy(count: number, capacity: number): CreatureCell[] {
    if (count <= 0) return [];
    if (capacity <= 1 || count <= 1) return ['center'];
    const halfTileCells: CreatureCell[] = ['frontLeft', 'frontRight'];
    const quarterTileCells: CreatureCell[] = ['frontLeft', 'frontRight', 'backLeft', 'backRight'];
    if (capacity === 2) return halfTileCells.slice(0, count);
    return quarterTileCells.slice(0, Math.min(count, 4));
}

export function normalizeCreatureCellsOnTile<TCreature extends CreatureTileLike>(
    creatures: readonly TCreature[],
    level: number,
    x: number,
    y: number,
    getCreatureTileCapacity: (typeId: number) => number,
): TCreature[] {
    const tileEntries = creatures
        .map((creature, index) => ({ creature, index }))
        .filter(({ creature }) => creature.alive && creature.mapIndex === level && creature.x === x && creature.y === y);
    if (tileEntries.length <= 0) return creatures as TCreature[];

    const ordered = [...tileEntries].sort((a, b) => {
        const cellDelta = compareCreatureCells(a.creature.cell, b.creature.cell);
        if (cellDelta !== 0) return cellDelta;
        return a.creature.id.localeCompare(b.creature.id);
    });
    const nextCells = getCreatureCellsForOccupancy(
        ordered.length,
        getTileCapacityForCreatures(ordered.map(({ creature }) => creature), getCreatureTileCapacity),
    );

    let nextCreatures = creatures as TCreature[];
    ordered.forEach(({ creature, index }, orderIndex) => {
        const nextCell = nextCells[orderIndex] ?? 'center';
        if (creature.cell === nextCell) return;
        if (nextCreatures === creatures) nextCreatures = [...creatures] as TCreature[];
        nextCreatures[index] = { ...creature, cell: nextCell };
    });
    return nextCreatures;
}

export function normalizeCreatureCells<TCreature extends CreatureTileLike>(
    creatures: readonly TCreature[],
    getCreatureTileCapacity: (typeId: number) => number,
): TCreature[] {
    let nextCreatures = creatures as TCreature[];
    const seenTiles = new Set<string>();
    for (const creature of creatures) {
        if (!creature.alive) continue;
        const tileKey = `${creature.mapIndex},${creature.x},${creature.y}`;
        if (seenTiles.has(tileKey)) continue;
        seenTiles.add(tileKey);
        nextCreatures = normalizeCreatureCellsOnTile(
            nextCreatures,
            creature.mapIndex,
            creature.x,
            creature.y,
            getCreatureTileCapacity,
        );
    }
    return nextCreatures;
}

export function isCreatureCellOccupiedOnTile<TCreature extends CreatureTileLike>(
    creatures: readonly TCreature[],
    mover: Pick<CreatureTileLike, 'id' | 'mapIndex' | 'x' | 'y'>,
    targetCell: CreatureCell,
): boolean {
    return creatures.some((other) =>
        other.alive &&
        other.id !== mover.id &&
        other.mapIndex === mover.mapIndex &&
        other.x === mover.x &&
        other.y === mover.y &&
        other.cell === targetCell,
    );
}
