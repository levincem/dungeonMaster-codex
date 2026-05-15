import type { PersistedSaveData } from '../engine/runtimeTypes';

type LevelRecord = { level?: unknown; mapIndex?: unknown };
type PendingSensorEventRecord = { level?: unknown };
type PendingGeneratorSpawnRecord = { sensorLevel?: unknown; spawnLevel?: unknown };

function addLevel(target: Set<number>, value: unknown): void {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return;
    target.add(value);
}

function addLevelsFromRecords(
    target: Set<number>,
    records: readonly unknown[] | undefined,
    field: keyof LevelRecord,
): void {
    for (const record of records ?? []) {
        if (!record || typeof record !== 'object') continue;
        addLevel(target, (record as LevelRecord)[field]);
    }
}

export function collectPersistedGameplayPreloadLevels(data: PersistedSaveData): number[] {
    const levels = new Set<number>();

    addLevel(levels, data.level);
    for (const hydratedLevel of data.hydratedLevels ?? []) {
        addLevel(levels, hydratedLevel);
    }

    addLevelsFromRecords(levels, data.creatures, 'mapIndex');
    addLevelsFromRecords(levels, data.floorItems, 'mapIndex');
    addLevelsFromRecords(levels, data.projectiles, 'level');
    addLevelsFromRecords(levels, data.activePoisonClouds, 'level');
    addLevelsFromRecords(levels, data.activeFluxcages, 'level');
    addLevelsFromRecords(levels, data.spellVisualEvents, 'level');
    addLevelsFromRecords(levels, data.footprintHistory, 'level');

    for (const event of data.pendingSensorEvents ?? []) {
        if (!event || typeof event !== 'object') continue;
        addLevel(levels, (event as PendingSensorEventRecord).level);
    }

    for (const event of data.pendingGeneratorSpawns ?? []) {
        if (!event || typeof event !== 'object') continue;
        addLevel(levels, (event as PendingGeneratorSpawnRecord).sensorLevel);
        addLevel(levels, (event as PendingGeneratorSpawnRecord).spawnLevel);
    }

    return [...levels].sort((left, right) => left - right);
}
