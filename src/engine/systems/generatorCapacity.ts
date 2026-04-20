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
export type RuntimeGroupActivity = 'active' | 'dormant';

export type RuntimeGroupRecord = {
    groupId: string;
    level: number;
    lifecycle: RuntimeGroupLifecycle;
    activity: RuntimeGroupActivity;
    memberCount: number;
    tileKeys: string[];
    hasExplicitGroupId: boolean;
};

export type RuntimeGroupCapacitySnapshot = {
    activeGroups: number;
    dormantGroups: number;
    reservedGroups: number;
    reservedDormantGroups: number;
    occupiedActiveGroups: number;
    occupiedGroups: number;
};

function buildCreatureFallbackGroupId(creature: CreatureLike): string {
    return `tile_${creature.x},${creature.y}`;
}

function buildPendingFallbackGroupId(pending: PendingGeneratorSpawnLike): string {
    return `pending_${pending.spawnX},${pending.spawnY}`;
}

export function collectRuntimeGroupsOnLevel(
    partyLevel: number,
    level: number,
    creatures: readonly CreatureLike[],
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): RuntimeGroupRecord[] {
    const records = new Map<string, RuntimeGroupRecord>();
    const creatureActivity: RuntimeGroupActivity = level === partyLevel ? 'active' : 'dormant';

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
            activity: creatureActivity,
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
        const pendingActivity: RuntimeGroupActivity = pending.spawnLevel === partyLevel ? 'active' : 'dormant';
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
            activity: pendingActivity,
            memberCount: 1,
            tileKeys: [tileKey],
            hasExplicitGroupId: Boolean(pending.groupId),
        });
    }

    return [...records.values()];
}

export function getApproximateActiveGroupCountOnLevel(
    partyLevel: number,
    level: number,
    creatures: readonly CreatureLike[],
): number {
    return getRuntimeGroupCapacitySnapshotOnLevel(partyLevel, level, creatures, []).activeGroups;
}

export function getApproximateReservedGeneratorGroupCountOnLevel(
    partyLevel: number,
    level: number,
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): number {
    return getRuntimeGroupCapacitySnapshotOnLevel(partyLevel, level, [], pendingGeneratorSpawns).reservedGroups;
}

export function getApproximateGeneratorOccupiedGroupCountOnLevel(
    partyLevel: number,
    level: number,
    creatures: readonly CreatureLike[],
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): number {
    return getRuntimeGroupCapacitySnapshotOnLevel(
        partyLevel,
        level,
        creatures,
        pendingGeneratorSpawns,
    ).occupiedActiveGroups;
}

export function getRuntimeGroupCapacitySnapshotOnLevel(
    partyLevel: number,
    level: number,
    creatures: readonly CreatureLike[],
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): RuntimeGroupCapacitySnapshot {
    const records = collectRuntimeGroupsOnLevel(partyLevel, level, creatures, pendingGeneratorSpawns);
    const activeGroups = records.filter((record) => record.lifecycle === 'alive' && record.activity === 'active').length;
    const dormantGroups = records.filter((record) => record.lifecycle === 'alive' && record.activity === 'dormant').length;
    const reservedGroups = records.filter((record) => record.lifecycle === 'reserved' && record.activity === 'active').length;
    const reservedDormantGroups = records.filter(
        (record) => record.lifecycle === 'reserved' && record.activity === 'dormant',
    ).length;
    return {
        activeGroups,
        dormantGroups,
        reservedGroups,
        reservedDormantGroups,
        occupiedActiveGroups: activeGroups + reservedGroups,
        occupiedGroups: records.length,
    };
}

export function canReserveApproximateGeneratorGroupOnLevel(
    partyLevel: number,
    level: number,
    creatures: readonly CreatureLike[],
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): boolean {
    if (level !== partyLevel) return true;
    const snapshot = getRuntimeGroupCapacitySnapshotOnLevel(partyLevel, level, creatures, pendingGeneratorSpawns);
    return snapshot.activeGroups < (ORIGINAL_ACTIVE_GROUP_CAP - ORIGINAL_GENERATOR_RESERVED_ACTIVE_GROUP_SLOTS)
        && snapshot.reservedGroups < ORIGINAL_GENERATOR_RESERVED_ACTIVE_GROUP_SLOTS
        && snapshot.occupiedActiveGroups < ORIGINAL_ACTIVE_GROUP_CAP;
}

export function canMaterializeReservedGeneratorSpawnOnLevel(
    partyLevel: number,
    level: number,
    creatures: readonly CreatureLike[],
    pendingGeneratorSpawns: readonly PendingGeneratorSpawnLike[],
): boolean {
    if (level !== partyLevel) return true;
    return getRuntimeGroupCapacitySnapshotOnLevel(partyLevel, level, creatures, pendingGeneratorSpawns).occupiedActiveGroups
        <= ORIGINAL_ACTIVE_GROUP_CAP;
}
