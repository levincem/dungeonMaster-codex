export type PlateListener = (level: number, x: number, y: number) => void;
export type CreatureActionListener = (id: string, action: 'move' | 'attack') => void;
export type CreatureRuntimeTimers = { mt: number; at: number };
export type CreatureRememberedPartyPosition = { x: number; y: number; expiresAt: number };

const plateListeners = new Set<PlateListener>();
const creatureActionListeners = new Set<CreatureActionListener>();

export const creatureTimers = new Map<string, CreatureRuntimeTimers>();
export const creatureAttackWindows = new Map<string, number>();
export const creatureConfusedUntil = new Map<string, number>();
export const creatureFluxcageUntil = new Map<string, number>();
export const creatureFrightenedUntil = new Map<string, number>();
export const creatureLastSeenPartyPos = new Map<string, CreatureRememberedPartyPosition>();

export function subscribePlateActivated(fn: PlateListener) {
    plateListeners.add(fn);
    return () => plateListeners.delete(fn);
}

export function notifyPlateActivated(level: number, x: number, y: number) {
    for (const fn of plateListeners) fn(level, x, y);
}

export function onCreatureAction(fn: CreatureActionListener): () => void {
    creatureActionListeners.add(fn);
    return () => {
        creatureActionListeners.delete(fn);
    };
}

export function notifyCreatureAction(id: string, action: 'move' | 'attack'): void {
    for (const fn of creatureActionListeners) fn(id, action);
}

export function resetExternalCreatureRuntimeState(): void {
    creatureTimers.clear();
    creatureAttackWindows.clear();
    creatureConfusedUntil.clear();
    creatureFluxcageUntil.clear();
    creatureFrightenedUntil.clear();
    creatureLastSeenPartyPos.clear();
}

export function getCreatureFluxcageExpiry(id: string): number {
    return creatureFluxcageUntil.get(id) ?? 0;
}

export function clearCreatureControlStatuses(): void {
    creatureFluxcageUntil.clear();
    creatureConfusedUntil.clear();
    creatureFrightenedUntil.clear();
}

export function pruneExternalCreatureRuntimeState(livingCreatureIds: ReadonlySet<string>): void {
    const pruneMap = <T>(map: Map<string, T>) => {
        for (const id of map.keys()) {
            if (!livingCreatureIds.has(id)) {
                map.delete(id);
            }
        }
    };

    pruneMap(creatureTimers);
    pruneMap(creatureAttackWindows);
    pruneMap(creatureConfusedUntil);
    pruneMap(creatureFluxcageUntil);
    pruneMap(creatureFrightenedUntil);
    pruneMap(creatureLastSeenPartyPos);
}
