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

export type GeneratedCreatureGroupPlanEntry = {
    id: string;
    groupId: string;
    typeId: number;
    mapIndex: number;
    x: number;
    y: number;
    currentHP: number;
    cell: CreatureCell;
    moveTimer: number;
    attackTimer: number;
};

type BuildGeneratedCreatureGroupPlanDeps = {
    getCreatureDefinition: (typeId: number) => CreatureDefinitionLike | undefined;
    getEffectiveHealthMultiplier: (level: number, hpMultiplier: number) => number;
    randomInt: (maxExclusive: number) => number;
    randomFraction?: () => number;
    createCreatureId: (
        level: number,
        x: number,
        y: number,
        typeId: number,
        ordinal: number,
    ) => string;
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

export function buildGeneratedCreatureGroupPlan(
    level: number,
    x: number,
    y: number,
    typeId: number,
    hpMultiplier: number,
    creatureCount: number,
    groupId: string,
    deps: BuildGeneratedCreatureGroupPlanDeps,
): GeneratedCreatureGroupPlanEntry[] {
    const definition = deps.getCreatureDefinition(typeId);
    if (!definition || creatureCount <= 0) return [];

    const randomFraction = deps.randomFraction ?? Math.random;
    const effectiveMultiplier = deps.getEffectiveHealthMultiplier(level, hpMultiplier);
    const capacity = getCreatureTileCapacity(definition.sizeOnTile ?? 0);
    const actualCount = Math.max(1, Math.min(creatureCount, capacity));
    const cells = getGeneratedCreatureCellsForOccupancy(actualCount, capacity, deps.randomInt(4));

    return Array.from({ length: actualCount }, (_, ordinal) => ({
        id: deps.createCreatureId(level, x, y, typeId, ordinal),
        groupId,
        typeId,
        mapIndex: level,
        x,
        y,
        currentHP: Math.max(
            1,
            (definition.baseHP * effectiveMultiplier) + deps.randomInt((definition.baseHP >> 2) + 1),
        ),
        cell: cells[ordinal] ?? 'center',
        moveTimer: randomFraction() * (definition.moveSpd / 6),
        attackTimer: randomFraction() * (definition.atkSpd / 6),
    }));
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

    const plan = buildGeneratedCreatureGroupPlan(
        level,
        x,
        y,
        typeId,
        hpMultiplier,
        creatureCount,
        groupId,
        deps,
    );

    return plan.map((entry) => {
        deps.registerCreatureTimers?.(entry.id, {
            mt: entry.moveTimer,
            at: entry.attackTimer,
        }, definition);
        return deps.createCreature({
            id: entry.id,
            groupId: entry.groupId,
            typeId: entry.typeId,
            mapIndex: entry.mapIndex,
            x: entry.x,
            y: entry.y,
            currentHP: entry.currentHP,
            cell: entry.cell,
        });
    });
}
