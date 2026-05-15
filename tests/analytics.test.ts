import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    endTrackedGameSession,
    startTrackedGameSession,
    trackGameAlternateEnding,
    trackGameLevelChange,
    type GameAnalyticsSnapshot,
} from '../src/analytics.js';

type CapturedEvent = {
    name: string;
    params: Record<string, unknown>;
};

const realDateNow = Date.now;
const globalWithWindow = globalThis as typeof globalThis & {
    window?: Window & typeof globalThis;
    gtag?: (...args: unknown[]) => void;
};

function createSnapshot(overrides: Partial<GameAnalyticsSnapshot> = {}): GameAnalyticsSnapshot {
    return {
        level: 0,
        partySize: 4,
        phase: 'exploration',
        sleeping: false,
        ...overrides,
    };
}

function installAnalyticsSpy(): CapturedEvent[] {
    const events: CapturedEvent[] = [];
    globalWithWindow.window = globalThis as Window & typeof globalThis;
    globalWithWindow.gtag = (...args: unknown[]) => {
        if (args[0] !== 'event') return;
        events.push({
            name: String(args[1]),
            params: (args[2] as Record<string, unknown>) ?? {},
        });
    };
    return events;
}

function setNow(now: number): void {
    Date.now = () => now;
}

afterEach(() => {
    Date.now = realDateNow;
    endTrackedGameSession('test_cleanup', createSnapshot());
    globalWithWindow.window = globalThis as Window & typeof globalThis;
    globalWithWindow.gtag = undefined;
});

test('trackGameLevelChange emits a game_level_change event with from/to levels', () => {
    const events = installAnalyticsSpy();

    setNow(1_000);
    startTrackedGameSession('new_game', createSnapshot({ level: 0 }));

    setNow(2_500);
    trackGameLevelChange(0, createSnapshot({ level: 2 }));

    assert.equal(events.length, 2);
    assert.equal(events[1]?.name, 'game_level_change');
    assert.deepEqual(events[1]?.params, {
        from_level: 0,
        to_level: 2,
        session_source: 'new_game',
        play_time_sec: 1,
        level: 2,
        party_size: 4,
        phase: 'exploration',
        sleeping: 0,
        transport_type: 'beacon',
    });
});

test('trackGameLevelChange does not emit when the level stays the same', () => {
    const events = installAnalyticsSpy();

    setNow(5_000);
    startTrackedGameSession('new_game', createSnapshot({ level: 3 }));

    setNow(6_000);
    trackGameLevelChange(3, createSnapshot({ level: 3 }));

    assert.equal(events.length, 1);
    assert.equal(events[0]?.name, 'game_start');
});

test('trackGameAlternateEnding emits the alternate ending event', () => {
    const events = installAnalyticsSpy();

    setNow(10_000);
    startTrackedGameSession('resume', createSnapshot({ level: 12, phase: 'exploration' }));

    setNow(14_400);
    trackGameAlternateEnding(createSnapshot({ level: 0, phase: 'alternate_ending' }));

    assert.equal(events.length, 2);
    assert.equal(events[1]?.name, 'game_alternate_ending');
    assert.deepEqual(events[1]?.params, {
        session_source: 'resume',
        play_time_sec: 4,
        level: 0,
        party_size: 4,
        phase: 'alternate_ending',
        sleeping: 0,
        transport_type: 'beacon',
    });
});
