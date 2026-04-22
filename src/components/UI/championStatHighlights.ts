type HighlightStatKey =
    | 'strength'
    | 'dexterity'
    | 'wisdom'
    | 'vitality'
    | 'luck'
    | 'antiMagic'
    | 'antiFire';

type ChampionHighlightState = Partial<Record<HighlightStatKey, number>>;
type ChampionHighlightSnapshot = Partial<Record<HighlightStatKey, boolean>>;

const highlightState = new Map<number, ChampionHighlightState>();
const highlightSnapshots = new Map<number, ChampionHighlightSnapshot>();
const highlightTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
const EMPTY_HIGHLIGHT_SNAPSHOT: ChampionHighlightSnapshot = Object.freeze({});

function emitChange(): void {
    for (const listener of listeners) listener();
}

function rebuildChampionSnapshot(championId: number, state: ChampionHighlightState): ChampionHighlightSnapshot {
    const activeStats = Object.keys(state) as HighlightStatKey[];
    if (activeStats.length === 0) {
        highlightSnapshots.delete(championId);
        return EMPTY_HIGHLIGHT_SNAPSHOT;
    }

    const snapshot = Object.fromEntries(activeStats.map((stat) => [stat, true])) as ChampionHighlightSnapshot;
    highlightSnapshots.set(championId, snapshot);
    return snapshot;
}

function clearExpiredHighlights(championId: number, now: number): ChampionHighlightState {
    const current = highlightState.get(championId) ?? {};
    const nextEntries = Object.entries(current).filter(([, expiresAt]) =>
        typeof expiresAt === 'number' && expiresAt > now) as Array<[HighlightStatKey, number]>;

    if (nextEntries.length === Object.keys(current).length) {
        return current;
    }

    if (nextEntries.length === 0) {
        highlightState.delete(championId);
        highlightSnapshots.delete(championId);
        return {};
    }

    const nextState = Object.fromEntries(nextEntries) as ChampionHighlightState;
    highlightState.set(championId, nextState);
    rebuildChampionSnapshot(championId, nextState);
    return nextState;
}

export function subscribeChampionStatHighlights(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function recordChampionStatHighlights(
    championId: number,
    stats: HighlightStatKey[],
    durationMs: number,
    now = Date.now(),
): void {
    if (stats.length === 0) return;

    const championState = { ...(highlightState.get(championId) ?? {}) };

    for (const stat of stats) {
        const expiresAt = now + durationMs;
        championState[stat] = expiresAt;

        const timeoutKey = `${championId}:${stat}`;
        const existingTimeout = highlightTimeouts.get(timeoutKey);
        if (existingTimeout) clearTimeout(existingTimeout);

        highlightTimeouts.set(timeoutKey, setTimeout(() => {
            highlightTimeouts.delete(timeoutKey);
            clearExpiredHighlights(championId, Date.now());
            emitChange();
        }, durationMs));
    }

    highlightState.set(championId, championState);
    rebuildChampionSnapshot(championId, championState);
    emitChange();
}

export function getChampionStatHighlightSnapshot(championId: number): ChampionHighlightSnapshot {
    return highlightSnapshots.get(championId) ?? EMPTY_HIGHLIGHT_SNAPSHOT;
}

export function resetChampionStatHighlightsForTests(): void {
    for (const timeout of highlightTimeouts.values()) {
        clearTimeout(timeout);
    }
    highlightState.clear();
    highlightSnapshots.clear();
    highlightTimeouts.clear();
    listeners.clear();
}

export type { HighlightStatKey };
