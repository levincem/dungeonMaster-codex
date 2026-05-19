import type { ChampionVitals, DamageEvent } from '../runtimeTypes';
import type { CreatureInstance } from '../../types/game';
import { CREATURE_TYPES } from '../../data/creatures';
import { originalTimerTicksToMs } from '../time';
import { normalizePersistedSpellStatsName } from './spellStats';

export type GameStatsDamageSource = 'melee' | 'projectile' | 'magic' | 'environment' | 'poison' | 'other';

export type GameStatsDamageTotals = Record<GameStatsDamageSource | 'total', number>;

export type GameStatsActionCounters = {
    total: number;
    melee: number;
    projectile: number;
    magic: number;
    utility: number;
};

export type GameStatsSpellCounters = {
    attempted: number;
    succeeded: number;
    failed: number;
};

export type GameStatsNamedCounters = Record<string, number>;

export type GameStatsExploration = {
    levelTransitions: number;
    doorsToggled: number;
    wallSensorsActivated: number;
    fountainDrinks: number;
    waterContainersFilled: number;
    sleeps: number;
    wakes: number;
    resurrections: number;
    timeByLevelMs: GameStatsNamedCounters;
    currentLevel: number;
    currentLevelStartedAtTick: number;
};

type GameStatsExplorationCounterKey =
    | 'levelTransitions'
    | 'doorsToggled'
    | 'wallSensorsActivated'
    | 'fountainDrinks'
    | 'waterContainersFilled'
    | 'sleeps'
    | 'wakes'
    | 'resurrections';

export type GameStats = {
    runId: string;
    startedAt: number;
    movement: {
        stepsForward: number;
        stepsBackward: number;
        strafesLeft: number;
        strafesRight: number;
        turnsLeft: number;
        turnsRight: number;
        bumps: number;
        falls: number;
    };
    exploration: GameStatsExploration;
    combat: {
        attacks: GameStatsActionCounters;
        monstersKilled: number;
        championsKilled: number;
        damageDealt: GameStatsDamageTotals;
        damageTaken: GameStatsDamageTotals;
        damageTakenByCreature: GameStatsNamedCounters;
        byCreature: Record<string, number>;
    };
    magic: {
        spells: GameStatsSpellCounters;
        manaSpent: number;
        bySpell: Record<string, GameStatsSpellCounters>;
    };
    items: {
        pickedUp: number;
        dropped: number;
        thrown: number;
        used: number;
        storedInContainers: number;
        takenFromContainers: number;
        given: number;
        equipped: number;
        unequipped: number;
    };
};

export const GAME_RUN_ID_PATTERN = /^[A-Za-z0-9_-]{8,96}$/;

function generateGameRunId(now = Date.now()): string {
    const randomPart = typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)
        : Math.random().toString(36).slice(2, 14);
    return `run_${Math.floor(now)}_${randomPart}`;
}

export function isValidGameRunId(value: unknown): value is string {
    return typeof value === 'string' && GAME_RUN_ID_PATTERN.test(value.trim());
}

function normalizeRunId(value: unknown, now = Date.now()): string {
    if (isValidGameRunId(value)) {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return generateGameRunId(now);
}

export type GameStatsDelta = Partial<{
    movement: Partial<GameStats['movement']>;
    exploration: Partial<Omit<GameStatsExploration, 'timeByLevelMs'>> & {
        timeByLevelMs?: GameStatsNamedCounters;
    };
    combat: Partial<{
        attacks: Partial<GameStatsActionCounters>;
        monstersKilled: number;
        championsKilled: number;
        damageDealt: Partial<GameStatsDamageTotals>;
        damageTaken: Partial<GameStatsDamageTotals>;
        damageTakenByCreature: GameStatsNamedCounters;
        byCreature: Record<string, number>;
    }>;
    magic: Partial<{
        spells: Partial<GameStatsSpellCounters>;
        manaSpent: number;
        bySpell: Record<string, Partial<GameStatsSpellCounters>>;
    }>;
    items: Partial<GameStats['items']>;
}>;

type StatsTransitionState = {
    creatures: CreatureInstance[];
    championVitals: Record<number, ChampionVitals>;
    deadChampions: Record<number, unknown>;
    damageEvents?: DamageEvent[];
    level?: number;
    elapsedGameTimeTicks?: number;
    gameStats?: GameStats;
};

const DAMAGE_SOURCES: GameStatsDamageSource[] = ['melee', 'projectile', 'magic', 'environment', 'poison', 'other'];

function createDamageTotals(): GameStatsDamageTotals {
    return {
        total: 0,
        melee: 0,
        projectile: 0,
        magic: 0,
        environment: 0,
        poison: 0,
        other: 0,
    };
}

function createActionCounters(): GameStatsActionCounters {
    return {
        total: 0,
        melee: 0,
        projectile: 0,
        magic: 0,
        utility: 0,
    };
}

function createSpellCounters(): GameStatsSpellCounters {
    return {
        attempted: 0,
        succeeded: 0,
        failed: 0,
    };
}

function createNamedCounters(): Record<string, number> {
    return {};
}

function createExplorationStats(): GameStatsExploration {
    return {
        levelTransitions: 0,
        doorsToggled: 0,
        wallSensorsActivated: 0,
        fountainDrinks: 0,
        waterContainersFilled: 0,
        sleeps: 0,
        wakes: 0,
        resurrections: 0,
        timeByLevelMs: createNamedCounters(),
        currentLevel: 0,
        currentLevelStartedAtTick: 0,
    };
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.floor(value as number));
}

function resolveLevelCounterKey(level: number): string {
    return String(normalizeNonNegativeInteger(level));
}

export function createInitialGameStats(now = Date.now()): GameStats {
    return {
        runId: generateGameRunId(now),
        startedAt: now,
        movement: {
            stepsForward: 0,
            stepsBackward: 0,
            strafesLeft: 0,
            strafesRight: 0,
            turnsLeft: 0,
            turnsRight: 0,
            bumps: 0,
            falls: 0,
        },
        exploration: createExplorationStats(),
        combat: {
            attacks: createActionCounters(),
            monstersKilled: 0,
            championsKilled: 0,
            damageDealt: createDamageTotals(),
            damageTaken: createDamageTotals(),
            damageTakenByCreature: createNamedCounters(),
            byCreature: createNamedCounters(),
        },
        magic: {
            spells: createSpellCounters(),
            manaSpent: 0,
            bySpell: {},
        },
        items: {
            pickedUp: 0,
            dropped: 0,
            thrown: 0,
            used: 0,
            storedInContainers: 0,
            takenFromContainers: 0,
            given: 0,
            equipped: 0,
            unequipped: 0,
        },
    };
}

function addNumber(base: number | undefined, delta: number | undefined): number {
    return (base ?? 0) + Math.max(0, delta ?? 0);
}

function mergeDamageTotals(base: GameStatsDamageTotals | undefined, delta?: Partial<GameStatsDamageTotals>): GameStatsDamageTotals {
    const next = { ...createDamageTotals(), ...(base ?? {}) };
    if (!delta) return next;
    for (const source of ['total', ...DAMAGE_SOURCES] as Array<keyof GameStatsDamageTotals>) {
        next[source] = addNumber(next[source], delta[source]);
    }
    return next;
}

function mergeActionCounters(base: GameStatsActionCounters | undefined, delta?: Partial<GameStatsActionCounters>): GameStatsActionCounters {
    const next = { ...createActionCounters(), ...(base ?? {}) };
    if (!delta) return next;
    for (const key of Object.keys(createActionCounters()) as Array<keyof GameStatsActionCounters>) {
        next[key] = addNumber(next[key], delta[key]);
    }
    return next;
}

function mergeSpellCounters(base: GameStatsSpellCounters | undefined, delta?: Partial<GameStatsSpellCounters>): GameStatsSpellCounters {
    const next = { ...createSpellCounters(), ...(base ?? {}) };
    if (!delta) return next;
    for (const key of Object.keys(createSpellCounters()) as Array<keyof GameStatsSpellCounters>) {
        next[key] = addNumber(next[key], delta[key]);
    }
    return next;
}

function mergeNamedCounters(base: Record<string, number> | undefined, delta?: Record<string, number>): Record<string, number> {
    const next: Record<string, number> = { ...(base ?? {}) };
    if (!delta) return next;
    for (const [key, value] of Object.entries(delta)) {
        next[key] = addNumber(next[key], value);
    }
    return next;
}

function normalizeSpellNameCounters(
    source: Record<string, Partial<GameStatsSpellCounters>> | undefined,
): Record<string, GameStatsSpellCounters> {
    const next: Record<string, GameStatsSpellCounters> = {};
    for (const [rawSpellName, counters] of Object.entries(source ?? {})) {
        const spellName = normalizePersistedSpellStatsName(rawSpellName);
        if (!spellName) continue;
        next[spellName] = mergeSpellCounters(next[spellName], counters);
    }
    return next;
}

function addDamageSource(total: Partial<GameStatsDamageTotals>, source: GameStatsDamageSource, amount: number): void {
    if (amount <= 0) return;
    total.total = addNumber(total.total, amount);
    total[source] = addNumber(total[source], amount);
}

function isDeltaEmpty(delta: GameStatsDelta): boolean {
    return JSON.stringify(delta) === '{}';
}

export function normalizeGameStats(value: unknown, now = Date.now()): GameStats {
    const source = value && typeof value === 'object' ? value as Partial<GameStats> : {};
    const initial = createInitialGameStats(now);
    const exploration = source.exploration ?? {};
    return {
        runId: normalizeRunId(source.runId, now),
        startedAt: typeof source.startedAt === 'number' ? source.startedAt : initial.startedAt,
        movement: { ...initial.movement, ...(source.movement ?? {}) },
        exploration: {
            ...initial.exploration,
            ...(exploration ?? {}),
            timeByLevelMs: mergeNamedCounters((exploration as Partial<GameStatsExploration>).timeByLevelMs),
            currentLevel: normalizeNonNegativeInteger((exploration as Partial<GameStatsExploration>).currentLevel),
            currentLevelStartedAtTick: normalizeNonNegativeInteger(
                (exploration as Partial<GameStatsExploration>).currentLevelStartedAtTick,
            ),
        },
        combat: {
            attacks: mergeActionCounters(source.combat?.attacks),
            monstersKilled: source.combat?.monstersKilled ?? 0,
            championsKilled: source.combat?.championsKilled ?? 0,
            damageDealt: mergeDamageTotals(source.combat?.damageDealt),
            damageTaken: mergeDamageTotals(source.combat?.damageTaken),
            damageTakenByCreature: mergeNamedCounters(source.combat?.damageTakenByCreature),
            byCreature: mergeNamedCounters(source.combat?.byCreature),
        },
        magic: {
            spells: mergeSpellCounters(source.magic?.spells),
            manaSpent: source.magic?.manaSpent ?? 0,
            bySpell: normalizeSpellNameCounters(source.magic?.bySpell),
        },
        items: { ...initial.items, ...(source.items ?? {}) },
    };
}

export function applyGameStatsDelta(stats: GameStats, delta: GameStatsDelta): GameStats {
    if (isDeltaEmpty(delta)) return stats;
    const nextMagicBySpell = { ...stats.magic.bySpell };
    for (const [spellName, spellDelta] of Object.entries(delta.magic?.bySpell ?? {})) {
        nextMagicBySpell[spellName] = mergeSpellCounters(nextMagicBySpell[spellName], spellDelta);
    }

    const nextExploration = {
        ...stats.exploration,
        ...addSection<GameStatsExplorationCounterKey>(
            {
                levelTransitions: stats.exploration.levelTransitions,
                doorsToggled: stats.exploration.doorsToggled,
                wallSensorsActivated: stats.exploration.wallSensorsActivated,
                fountainDrinks: stats.exploration.fountainDrinks,
                waterContainersFilled: stats.exploration.waterContainersFilled,
                sleeps: stats.exploration.sleeps,
                wakes: stats.exploration.wakes,
                resurrections: stats.exploration.resurrections,
            },
            delta.exploration as Partial<Record<GameStatsExplorationCounterKey, number>> | undefined,
            ['timeByLevelMs', 'currentLevel', 'currentLevelStartedAtTick'],
        ),
        timeByLevelMs: mergeNamedCounters(stats.exploration.timeByLevelMs, delta.exploration?.timeByLevelMs),
    };
    if (delta.exploration?.currentLevel !== undefined) {
        nextExploration.currentLevel = normalizeNonNegativeInteger(delta.exploration.currentLevel, stats.exploration.currentLevel);
    }
    if (delta.exploration?.currentLevelStartedAtTick !== undefined) {
        nextExploration.currentLevelStartedAtTick = normalizeNonNegativeInteger(
            delta.exploration.currentLevelStartedAtTick,
            stats.exploration.currentLevelStartedAtTick,
        );
    }

    return {
        ...stats,
        movement: { ...stats.movement, ...addSection(stats.movement, delta.movement) },
        exploration: nextExploration,
        combat: {
            attacks: mergeActionCounters(stats.combat.attacks, delta.combat?.attacks),
            monstersKilled: addNumber(stats.combat.monstersKilled, delta.combat?.monstersKilled),
            championsKilled: addNumber(stats.combat.championsKilled, delta.combat?.championsKilled),
            damageDealt: mergeDamageTotals(stats.combat.damageDealt, delta.combat?.damageDealt),
            damageTaken: mergeDamageTotals(stats.combat.damageTaken, delta.combat?.damageTaken),
            damageTakenByCreature: mergeNamedCounters(
                stats.combat.damageTakenByCreature,
                delta.combat?.damageTakenByCreature,
            ),
            byCreature: mergeNamedCounters(stats.combat.byCreature, delta.combat?.byCreature),
        },
        magic: {
            spells: mergeSpellCounters(stats.magic.spells, delta.magic?.spells),
            manaSpent: addNumber(stats.magic.manaSpent, delta.magic?.manaSpent),
            bySpell: nextMagicBySpell,
        },
        items: { ...stats.items, ...addSection(stats.items, delta.items) },
    };
}

function addSection<TKey extends string>(
    base: Record<TKey, number>,
    delta: Partial<Record<TKey, number>> | undefined,
    skipKeys: readonly string[] = [],
): Partial<Record<TKey, number>> {
    if (!delta) return {};
    const skip = new Set(skipKeys);
    const next: Partial<Record<TKey, number>> = {};
    for (const key of Object.keys(delta) as TKey[]) {
        if (skip.has(String(key))) continue;
        next[key] = addNumber(base[key], delta[key]);
    }
    return next;
}

function buildTimeByLevelTransitionDelta(
    before: StatsTransitionState,
    after: StatsTransitionState,
): GameStatsDelta['exploration'] | null {
    if (
        typeof before.level !== 'number' ||
        typeof after.level !== 'number' ||
        before.level === after.level ||
        !before.gameStats
    ) {
        return null;
    }

    const checkpointTick = normalizeNonNegativeInteger(
        after.elapsedGameTimeTicks ?? before.elapsedGameTimeTicks,
        before.gameStats.exploration.currentLevelStartedAtTick,
    );
    const startedAtTick = normalizeNonNegativeInteger(
        before.gameStats.exploration.currentLevelStartedAtTick,
    );
    const elapsedMs = originalTimerTicksToMs(Math.max(0, checkpointTick - startedAtTick));

    return {
        ...(elapsedMs > 0
            ? { timeByLevelMs: { [resolveLevelCounterKey(before.level)]: elapsedMs } }
            : {}),
        currentLevel: normalizeNonNegativeInteger(after.level),
        currentLevelStartedAtTick: checkpointTick,
    };
}

function buildDamageTakenByCreatureDelta(
    before: StatsTransitionState,
    after: StatsTransitionState,
): GameStatsNamedCounters {
    const beforeIds = new Set((before.damageEvents ?? []).map((event) => event.id));
    const next: GameStatsNamedCounters = {};
    for (const event of after.damageEvents ?? []) {
        if (beforeIds.has(event.id)) continue;
        if (event.target !== 'champion') continue;
        const sourceName = typeof event.sourceName === 'string' ? event.sourceName.trim() : '';
        if (!sourceName) continue;
        next[sourceName] = addNumber(next[sourceName], event.amount);
    }
    return next;
}

export function materializeGameStatsSnapshot(
    stats: GameStats,
    elapsedGameTimeTicks: number,
    currentLevel = stats.exploration.currentLevel,
    options?: { resetCurrentLevelStart?: boolean },
): GameStats {
    const checkpointTick = normalizeNonNegativeInteger(
        elapsedGameTimeTicks,
        stats.exploration.currentLevelStartedAtTick,
    );
    const activeLevel = normalizeNonNegativeInteger(currentLevel, stats.exploration.currentLevel);
    const levelStartedAtTick = normalizeNonNegativeInteger(
        stats.exploration.currentLevelStartedAtTick,
    );
    const additionalMs = originalTimerTicksToMs(Math.max(0, checkpointTick - levelStartedAtTick));
    const timeByLevelMs = additionalMs > 0
        ? mergeNamedCounters(
            stats.exploration.timeByLevelMs,
            { [resolveLevelCounterKey(activeLevel)]: additionalMs },
        )
        : stats.exploration.timeByLevelMs;

    if (
        timeByLevelMs === stats.exploration.timeByLevelMs &&
        activeLevel === stats.exploration.currentLevel &&
        (!options?.resetCurrentLevelStart || checkpointTick === stats.exploration.currentLevelStartedAtTick)
    ) {
        return stats;
    }

    return {
        ...stats,
        exploration: {
            ...stats.exploration,
            timeByLevelMs,
            currentLevel: activeLevel,
            currentLevelStartedAtTick: options?.resetCurrentLevelStart
                ? checkpointTick
                : stats.exploration.currentLevelStartedAtTick,
        },
    };
}

export function buildGameStatsTransitionDelta(
    before: StatsTransitionState,
    after: StatsTransitionState,
    damageSource: GameStatsDamageSource,
): GameStatsDelta {
    const damageDealt: Partial<GameStatsDamageTotals> = {};
    const damageTaken: Partial<GameStatsDamageTotals> = {};
    const byCreature: Record<string, number> = {};
    const damageTakenByCreature = buildDamageTakenByCreatureDelta(before, after);
    let monstersKilled = 0;

    const afterCreatures = new Map(after.creatures.map((creature) => [creature.id, creature]));
    for (const creature of before.creatures) {
        if (!creature.alive) continue;
        const nextCreature = afterCreatures.get(creature.id);
        if (!nextCreature) continue;
        const dealt = Math.max(0, creature.currentHP - nextCreature.currentHP);
        addDamageSource(damageDealt, damageSource, dealt);
        if (nextCreature.alive === false || nextCreature.currentHP <= 0) {
            monstersKilled += 1;
            const creatureName = CREATURE_TYPES[creature.typeId]?.name ?? `Creature ${creature.typeId}`;
            byCreature[creatureName] = addNumber(byCreature[creatureName], 1);
        }
    }

    for (const [championId, vitals] of Object.entries(before.championVitals)) {
        const nextVitals = after.championVitals[Number(championId)];
        if (!nextVitals) continue;
        addDamageSource(damageTaken, damageSource, Math.max(0, vitals.hp - nextVitals.hp));
    }

    const championsKilled = Math.max(0, Object.keys(after.deadChampions).length - Object.keys(before.deadChampions).length);
    const delta: GameStatsDelta = {};
    if (
        Object.keys(damageDealt).length > 0 ||
        Object.keys(damageTaken).length > 0 ||
        Object.keys(damageTakenByCreature).length > 0 ||
        monstersKilled > 0 ||
        championsKilled > 0
    ) {
        delta.combat = {
            ...(Object.keys(damageDealt).length > 0 ? { damageDealt } : {}),
            ...(Object.keys(damageTaken).length > 0 ? { damageTaken } : {}),
            ...(Object.keys(damageTakenByCreature).length > 0 ? { damageTakenByCreature } : {}),
            ...(monstersKilled > 0 ? { monstersKilled } : {}),
            ...(championsKilled > 0 ? { championsKilled } : {}),
            ...(Object.keys(byCreature).length > 0 ? { byCreature } : {}),
        };
    }
    const explorationDelta = buildTimeByLevelTransitionDelta(before, after);
    if (explorationDelta) {
        delta.exploration = explorationDelta;
    }
    return delta;
}
