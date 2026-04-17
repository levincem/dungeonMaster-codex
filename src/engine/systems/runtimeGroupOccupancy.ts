type RuntimeGroupOccupancyCreatureLike = {
    id: string;
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
    typeId: number;
    groupId?: string;
};

export function canCreatureShareRuntimeTile<
    TCreature extends RuntimeGroupOccupancyCreatureLike,
>(
    mover: TCreature,
    level: number,
    x: number,
    y: number,
    creatures: readonly TCreature[],
    getTileCapacity: (occupants: readonly TCreature[]) => number,
): boolean {
    const occupants = creatures.filter((other) =>
        other.alive &&
        other.id !== mover.id &&
        other.mapIndex === level &&
        other.x === x &&
        other.y === y,
    );

    if (occupants.some((other) => other.typeId !== mover.typeId)) return false;
    if (occupants.length <= 0) return true;

    const moverGroupId = mover.groupId ?? null;
    const occupantGroupIds = new Set(occupants.map((other) => other.groupId ?? null));

    // Different runtime groups should not merge onto the same tile. This keeps
    // generator-spawned groups and placed groups structurally separate even
    // when they share the same creature family.
    if (occupantGroupIds.size > 1) return false;

    const [occupantGroupId] = occupantGroupIds;
    if (moverGroupId !== occupantGroupId) return false;

    return occupants.length < getTileCapacity([mover, ...occupants]);
}
