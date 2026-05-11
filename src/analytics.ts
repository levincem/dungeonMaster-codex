type AnalyticsEventParams = Record<string, string | number | boolean | undefined>;

export type TrackedGamePhase =
    'title'
    | 'exploration'
    | 'mirror_open'
    | 'endgame'
    | 'alternate_ending'
    | 'victory'
    | 'game_over';
export type GameSessionSource = 'new_game' | 'resume';

export interface GameAnalyticsSnapshot {
    level: number;
    partySize: number;
    phase: TrackedGamePhase;
    sleeping: boolean;
}

interface ActiveGameSession {
    source: GameSessionSource;
    startedAt: number;
    lastHeartbeatAt: number;
}

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

const HEARTBEAT_INTERVAL_MS = 30_000;

let activeGameSession: ActiveGameSession | null = null;

function canTrackAnalytics(): boolean {
    return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

function sendAnalyticsEvent(eventName: string, params: AnalyticsEventParams = {}): void {
    if (!canTrackAnalytics()) return;
    window.gtag?.('event', eventName, {
        ...params,
        transport_type: 'beacon',
    });
}

function buildSessionParams(
    snapshot: GameAnalyticsSnapshot,
    source: GameSessionSource,
    startedAt: number,
): AnalyticsEventParams {
    return {
        session_source: source,
        play_time_sec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
        level: snapshot.level,
        party_size: snapshot.partySize,
        phase: snapshot.phase,
        sleeping: snapshot.sleeping ? 1 : 0,
    };
}

export function startTrackedGameSession(source: GameSessionSource, snapshot: GameAnalyticsSnapshot): void {
    if (activeGameSession) {
        endTrackedGameSession('restart', snapshot);
    }

    const startedAt = Date.now();
    activeGameSession = {
        source,
        startedAt,
        lastHeartbeatAt: startedAt,
    };

    sendAnalyticsEvent(source === 'resume' ? 'game_resume' : 'game_start', {
        ...buildSessionParams(snapshot, source, startedAt),
    });
}

export function maybeTrackGameplayHeartbeat(snapshot: GameAnalyticsSnapshot): void {
    if (!activeGameSession) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const now = Date.now();
    if (now - activeGameSession.lastHeartbeatAt < HEARTBEAT_INTERVAL_MS) return;

    activeGameSession.lastHeartbeatAt = now;
    sendAnalyticsEvent('game_heartbeat', buildSessionParams(snapshot, activeGameSession.source, activeGameSession.startedAt));
}

export function trackGameVictory(snapshot: GameAnalyticsSnapshot): void {
    const source = activeGameSession?.source ?? 'new_game';
    const startedAt = activeGameSession?.startedAt ?? Date.now();
    sendAnalyticsEvent('game_victory', buildSessionParams(snapshot, source, startedAt));
}

export function endTrackedGameSession(reason: string, snapshot: GameAnalyticsSnapshot): void {
    if (!activeGameSession) return;

    const session = activeGameSession;
    activeGameSession = null;

    sendAnalyticsEvent('game_end', {
        end_reason: reason,
        ...buildSessionParams(snapshot, session.source, session.startedAt),
    });
}
