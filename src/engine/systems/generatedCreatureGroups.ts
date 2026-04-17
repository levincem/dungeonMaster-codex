import type { CreatureCell } from '../../types/game';

type CreatureDefinitionLike = {
    baseHP: number;
    moveSpd: number;
    atkSpd: number;
    sizeOnTile?: number;
};

type CreateGeneratedCreatureGroupInstancesDeps<TCreature> = {
    getCreatureDefinition: (typeId: number) => CreatureDefinitionLike | undefined;
    getEffectiveHealthMultiplier: (level: number, hpMultiplier: number) => number;
    randomInt: (maxExclusive: number) => number;
    createCreatureId: (
        level: number,
        x: number,
        y: number,
        typeId: number,
        ordinal: number,
    ) => string;
    registerCreatureTimers?: (
        id: string,
        timers: { mt: number; at: number },
        definition: CreatureDefinitionLike,
    ) => void;
    createCreature: (args: {
        id: string;
        groupId: string;
        typeId: number;
        mapIndex: number;
        x: number;
        y: number;
        currentHP: number;
        cell: CreatureCell;
    }) => TCreature;
};

export function getCreatureTileCapacity(sizeOnTile: number): number {
    if (sizeOnTile >= 2) return 1;
    if (sizeOnTile === 1) return 2;
    return 4;
}

export function getGeneratedCreatureCellsForOccupancy(
    count: number,
    capacity: number,
    rotationSeed: number,
): CreatureCell[] {
    if (count <= 0) return [];
    if (capacity <= 1 || count <= 1) return ['center'];

    if (capacity === 2) {
        const halfTileCells: CreatureCell[] =
            (rotationSeed & 0x1) === 0
                ? ['frontLeft', 'frontRight']
                : ['frontRight', 'frontLeft'];
        return halfTileCells.slice(0, Math.min(count, 2));
    }

    const clockwiseQuarterCells: CreatureCell[] = ['frontLeft', 'frontRight', 'backRight', 'backLeft'];
    const startIndex = ((rotationSeed % clockwiseQuarterCells.length) + clockwiseQuarterCells.length) % clockwiseQuarterCells.length;
    const rotated = clockwiseQuarterCells
        .slice(startIndex)
        .concat(clockwiseQuarterCells.slice(0, startIndex));
    return rotated.slice(0, Math.min(count, 4));
}

export function createGeneratedCreatureGroupInstances<TCreature>(
    level: number,
    x: number,
    y: number,
    typeId: number,
    hpMultiplier: number,
    creatureCount: number,
    groupId: string,
    deps: CreateGeneratedCreatureGroupInstancesDeps<TCreature>,
): TCreature[] {
    const definition = deps.getCreatureDefinition(typeId);
    if (!definition || creatureCount <= 0) return [];

    const effectiveMultiplier = deps.getEffectiveHealthMultiplier(level, hpMultiplier);
    const capacity = getCreatureTileCapacity(definition.sizeOnTile ?? 0);
    const actualCount = Math.max(1, Math.min(creatureCount, capacity));
    const cells = getGeneratedCreatureCellsForOccupancy(actualCount, capacity, deps.randomInt(4));
    const instances: TCreature[] = [];

    for (let ordinal = 0; ordinal < actualCount; ordinal += 1) {
        const currentHP = Math.max(
            1,
            (definition.baseHP * effectiveMultiplier) + deps.randomInt((definition.baseHP >> 2) + 1),
        );
        const id = deps.createCreatureId(level, x, y, typeId, ordinal);
        deps.registerCreatureTimers?.(id, {
            mt: Math.random() * (definition.moveSpd / 6),
            at: Math.random() * (definition.atkSpd / 6),
        }, definition);
        instances.push(deps.createCreature({
            id,
            groupId,
            typeId,
            mapIndex: level,
            x,
            y,
            currentHP,
            cell: cells[ordinal] ?? 'center',
        }));
    }

    return instances;
}
