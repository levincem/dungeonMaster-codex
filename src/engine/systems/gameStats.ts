import type { ChampionVitals } from '../runtimeTypes';
import type { CreatureInstance } from '../../types/game';

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

export type GameStats = {
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
    exploration: {
        levelTransitions: number;
        doorsToggled: number;
        wallSensorsActivated: number;
        fountainDrinks: number;
        waterContainersFilled: number;
        sleeps: number;
        wakes: number;
        resurrections: number;
    };
    combat: {
        attacks: GameStatsActionCounters;
        monstersKilled: number;
        championsKilled: number;
        damageDealt: GameStatsDamageTotals;
        damageTaken: GameStatsDamageTotals;
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

export type GameStatsDelta = Partial<{
    movement: Partial<GameStats['movement']>;
    exploration: Partial<GameStats['exploration']>;
    combat: Partial<{
        attacks: Partial<GameStatsActionCounters>;
        monstersKilled: number;
        championsKilled: number;
        damageDealt: Partial<GameStatsDamageTotals>;
        damageTaken: Partial<GameStatsDamageTotals>;
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

export function createInitialGameStats(now = Date.now()): GameStats {
    return {
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
        exploration: {
            levelTransitions: 0,
            doorsToggled: 0,
            wallSensorsActivated: 0,
            fountainDrinks: 0,
            waterContainersFilled: 0,
            sleeps: 0,
            wakes: 0,
            resurrections: 0,
        },
        combat: {
            attacks: createActionCounters(),
            monstersKilled: 0,
            championsKilled: 0,
            damageDealt: createDamageTotals(),
            damageTaken: createDamageTotals(),
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
    return {
        startedAt: typeof source.startedAt === 'number' ? source.startedAt : initial.startedAt,
        movement: { ...initial.movement, ...(source.movement ?? {}) },
        exploration: { ...initial.exploration, ...(source.exploration ?? {}) },
        combat: {
            attacks: mergeActionCounters(source.combat?.attacks),
            monstersKilled: source.combat?.monstersKilled ?? 0,
            championsKilled: source.combat?.championsKilled ?? 0,
            damageDealt: mergeDamageTotals(source.combat?.damageDealt),
            damageTaken: mergeDamageTotals(source.combat?.damageTaken),
        },
        magic: {
            spells: mergeSpellCounters(source.magic?.spells),
            manaSpent: source.magic?.manaSpent ?? 0,
            bySpell: Object.fromEntries(
                Object.entries(source.magic?.bySpell ?? {}).map(([spellName, counters]) => [
                    spellName,
                    mergeSpellCounters(counters),
                ]),
            ),
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

    return {
        ...stats,
        movement: { ...stats.movement, ...addSection(stats.movement, delta.movement) },
        exploration: { ...stats.exploration, ...addSection(stats.exploration, delta.exploration) },
        combat: {
            attacks: mergeActionCounters(stats.combat.attacks, delta.combat?.attacks),
            monstersKilled: addNumber(stats.combat.monstersKilled, delta.combat?.monstersKilled),
            championsKilled: addNumber(stats.combat.championsKilled, delta.combat?.championsKilled),
            damageDealt: mergeDamageTotals(stats.combat.damageDealt, delta.combat?.damageDealt),
            damageTaken: mergeDamageTotals(stats.combat.damageTaken, delta.combat?.damageTaken),
        },
        magic: {
            spells: mergeSpellCounters(stats.magic.spells, delta.magic?.spells),
            manaSpent: addNumber(stats.magic.manaSpent, delta.magic?.manaSpent),
            bySpell: nextMagicBySpell,
        },
        items: { ...stats.items, ...addSection(stats.items, delta.items) },
    };
}

function addSection<T extends Record<string, number>>(base: T, delta: Partial<T> | undefined): Partial<T> {
    if (!delta) return {};
    const next: Partial<T> = {};
    for (const key of Object.keys(delta) as Array<keyof T>) {
        next[key] = addNumber(base[key], delta[key]) as T[keyof T];
    }
    return next;
}

export function buildGameStatsTransitionDelta(
    before: StatsTransitionState,
    after: StatsTransitionState,
    damageSource: GameStatsDamageSource,
): GameStatsDelta {
    const damageDealt: Partial<GameStatsDamageTotals> = {};
    const damageTaken: Partial<GameStatsDamageTotals> = {};
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
        }
    }

    for (const [championId, vitals] of Object.entries(before.championVitals)) {
        const nextVitals = after.championVitals[Number(championId)];
        if (!nextVitals) continue;
        addDamageSource(damageTaken, damageSource, Math.max(0, vitals.hp - nextVitals.hp));
    }

    const championsKilled = Math.max(0, Object.keys(after.deadChampions).length - Object.keys(before.deadChampions).length);
    const delta: GameStatsDelta = {};
    if (Object.keys(damageDealt).length > 0 || Object.keys(damageTaken).length > 0 || monstersKilled > 0 || championsKilled > 0) {
        delta.combat = {
            ...(Object.keys(damageDealt).length > 0 ? { damageDealt } : {}),
            ...(Object.keys(damageTaken).length > 0 ? { damageTaken } : {}),
            ...(monstersKilled > 0 ? { monstersKilled } : {}),
            ...(championsKilled > 0 ? { championsKilled } : {}),
        };
    }
    return delta;
}
