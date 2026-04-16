import type { SpellDef } from '../../data/runes';
import { getSpellDurationMs } from '../../data/spellRuntime';
import type { ChampionVitals } from '../runtimeTypes';

export type SpellStatusEffectAction =
    | 'invisibility'
    | 'see_through_walls'
    | 'reveal_hidden'
    | 'footprints';

type SpellStatusEffectDeps = {
    quantizeDurationMs: (durationMs: number) => number;
};

export type SpellStatusPatch = {
    invisibleUntil?: number;
    seeThroughWallsUntil?: number;
    magicVisionUntil?: number;
    footprintsUntil?: number;
};

export type SpellStatusStatePatch = SpellStatusPatch & {
    championVitals: Record<number, ChampionVitals>;
};

export function resolveSpellStatusEffect(
    action: SpellStatusEffectAction,
    now: number,
    currentUntil: number,
    durationMs: number | null,
    deps: SpellStatusEffectDeps,
    manaCost = 0,
): number | null {
    if (action === 'reveal_hidden') {
        const revealDuration = deps.quantizeDurationMs(manaCost * 12_000);
        return Math.max(currentUntil, now + revealDuration);
    }

    if (!durationMs) return null;
    return Math.max(currentUntil, now + durationMs);
}

export function resolveSpellStatusPatch(
    action: SpellStatusEffectAction,
    now: number,
    currentUntil: number,
    spell: SpellDef,
    deps: SpellStatusEffectDeps,
): SpellStatusPatch | null {
    const until = resolveSpellStatusEffect(
        action,
        now,
        currentUntil,
        getSpellDurationMs(spell),
        deps,
        spell.manaCost,
    );

    if (until === null) return null;

    switch (action) {
        case 'invisibility':
            return { invisibleUntil: until };
        case 'see_through_walls':
            return { seeThroughWallsUntil: until };
        case 'reveal_hidden':
            return { magicVisionUntil: until };
        case 'footprints':
            return { footprintsUntil: until };
    }
}

type BuildSpellStatusStatePatchArgs = {
    championId: number;
    nextVitals: ChampionVitals;
    currentChampionVitals: Record<number, ChampionVitals>;
    statusPatch: SpellStatusPatch | null;
    currentUntilKey: 'magicVisionUntil';
    currentUntilValue: number;
};

type BuildSpellStatusStatePatchArgsWithoutFallback = {
    championId: number;
    nextVitals: ChampionVitals;
    currentChampionVitals: Record<number, ChampionVitals>;
    statusPatch: SpellStatusPatch | null;
};

export function buildSpellStatusStatePatch(
    args: BuildSpellStatusStatePatchArgs | BuildSpellStatusStatePatchArgsWithoutFallback,
): SpellStatusStatePatch {
    const championVitals = {
        ...args.currentChampionVitals,
        [args.championId]: args.nextVitals,
    };

    if (args.statusPatch) {
        return {
            championVitals,
            ...args.statusPatch,
        };
    }

    if ('currentUntilKey' in args) {
        return {
            championVitals,
            [args.currentUntilKey]: args.currentUntilValue,
        };
    }

    return { championVitals };
}
