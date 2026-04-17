type CreatureLike = {
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
    groupId?: string;
};

type PendingGeneratorSpawnLike = {
    spawnLevel: number;
    spawnX: number;
    spawnY: number;
    groupId: string;
};

export const ORIGINAL_ACTIVE_GROUP_CAP = 60;
export const ORIGINAL_GENERATOR_RESERVED_ACTIVE_GROUP_SLOTS = 5;

export type RuntimeGroupLifecycle = 'alive' | 'reserved';

export type RuntimeGroupRecord = {
    groupId: string;
    level: number;
    lifecycle: RuntimeGroupLifecycle;
    memberCount: number;
    tileKeys: string[];
    hasExplicitGroupId: boolean;
};

export type RuntimeGroupCapacitySnapshot = {
    activeGroups: number;
    reservedGroups: number;
    occupiedGroups: number;
};

function buildCreatureFallbackGroupId(creature: CreatureLike): string {
    return `tile_${creature.x},${creature.y}`;
}

function buildPendingFallbackGroupId(pending: PendingGeneratorSpawnLike): string {
    return `pending_${pending.spawnX},${pending.spawnY}`;
}

export function collectRuntimeGroupsOnLevel(
    level: number,
    creatures: readonly CreatureLike[],
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): RuntimeGroupRecord[] {
    const records = new Map<string, RuntimeGroupRecord>();

    for (const creature of creatures) {
        if (!creature.alive || creature.mapIndex !== level) continue;
        const resolvedGroupId = creature.groupId ?? buildCreatureFallbackGroupId(creature);
        const recordKey = `alive:${resolvedGroupId}`;
        const tileKey = `${creature.mapIndex},${creature.x},${creature.y}`;
        const existing = records.get(recordKey);
        if (existing) {
            existing.memberCount += 1;
            if (!existing.tileKeys.includes(tileKey)) existing.tileKeys.push(tileKey);
            continue;
        }
        records.set(recordKey, {
            groupId: resolvedGroupId,
            level,
            lifecycle: 'alive',
            memberCount: 1,
            tileKeys: [tileKey],
            hasExplicitGroupId: Boolean(creature.groupId),
        });
    }

    for (const pending of pendingGeneratorSpawns) {
        if (pending.spawnLevel !== level) continue;
        const resolvedGroupId = pending.groupId || buildPendingFallbackGroupId(pending);
        const recordKey = `reserved:${resolvedGroupId}`;
        const tileKey = `${pending.spawnLevel},${pending.spawnX},${pending.spawnY}`;
        const existing = records.get(recordKey);
        if (existing) {
            existing.memberCount += 1;
            if (!existing.tileKeys.includes(tileKey)) existing.tileKeys.push(tileKey);
            continue;
        }
        records.set(recordKey, {
            groupId: resolvedGroupId,
            level,
            lifecycle: 'reserved',
            memberCount: 1,
            tileKeys: [tileKey],
            hasExplicitGroupId: Boolean(pending.groupId),
        });
    }

    return [...records.values()];
}

export function getApproximateActiveGroupCountOnLevel(
    level: number,
    creatures: readonly CreatureLike[],
): number {
    return getRuntimeGroupCapacitySnapshotOnLevel(level, creatures, []).activeGroups;
}

export function getApproximateReservedGeneratorGroupCountOnLevel(
    level: number,
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): number {
    return getRuntimeGroupCapacitySnapshotOnLevel(level, [], pendingGeneratorSpawns).reservedGroups;
}

export function getApproximateGeneratorOccupiedGroupCountOnLevel(
    level: number,
    creatures: readonly CreatureLike[],
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): number {
    return getRuntimeGroupCapacitySnapshotOnLevel(level, creatures, pendingGeneratorSpawns).occupiedGroups;
}

export function getRuntimeGroupCapacitySnapshotOnLevel(
    level: number,
    creatures: readonly CreatureLike[],
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): RuntimeGroupCapacitySnapshot {
    const records = collectRuntimeGroupsOnLevel(level, creatures, pendingGeneratorSpawns);
    const activeGroups = records.filter((record) => record.lifecycle === 'alive').length;
    const reservedGroups = records.filter((record) => record.lifecycle === 'reserved').length;
    return {
        activeGroups,
        reservedGroups,
        occupiedGroups: records.length,
    };
}

export function canReserveApproximateGeneratorGroupOnLevel(
    level: number,
    creatures: readonly CreatureLike[],
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): boolean {
    const snapshot = getRuntimeGroupCapacitySnapshotOnLevel(level, creatures, pendingGeneratorSpawns);
    return snapshot.activeGroups < (ORIGINAL_ACTIVE_GROUP_CAP - ORIGINAL_GENERATOR_RESERVED_ACTIVE_GROUP_SLOTS)
        && snapshot.reservedGroups < ORIGINAL_GENERATOR_RESERVED_ACTIVE_GROUP_SLOTS
        && snapshot.occupiedGroups < ORIGINAL_ACTIVE_GROUP_CAP;
}

export function canMaterializeReservedGeneratorSpawnOnLevel(
    level: number,
    creatures: readonly CreatureLike[],
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): boolean {
    return getRuntimeGroupCapacitySnapshotOnLevel(level, creatures, pendingGeneratorSpawns).occupiedGroups
        <= ORIGINAL_ACTIVE_GROUP_CAP;
}
