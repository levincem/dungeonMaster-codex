import type { Champion } from '../../types/champion';
import type { ChampionVitals } from '../runtimeTypes';
import { buildCastSpellStatePatch } from './spellCastState';

type PreparedCastResult<TPatch> =
    | { kind: 'blocked'; patch: TPatch }
    | {
        kind: 'ready';
        basePatch: TPatch;
        castSucceeded: boolean;
        nextVitals: ChampionVitals;
        skillLevel: number;
    };

type ProjectilePatchResult<TPatch> = {
    patch: TPatch;
    shouldPlayDoorMotion?: boolean;
    doorMotionSquare?: {
        level: number;
        x: number;
        y: number;
    };
};

type CastSpellRuntimeState = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
};

type CastSpellRuntimeDeps<TSpell, TPatch> = {
    findSpell: (runeIds: string[]) => TSpell | null | undefined;
    buildUnknownCombinationPatch: () => TPatch;
    prepareCast: (
        spell: TSpell,
        champion: Champion,
        vitals: ChampionVitals,
    ) => PreparedCastResult<TPatch>;
    buildFailedCastPatch: (basePatch: TPatch, nextVitals: ChampionVitals) => TPatch;
    buildNonProjectilePatch: (
        spell: TSpell,
        nextVitals: ChampionVitals,
        champion: Champion,
    ) => TPatch | null;
    buildProjectilePatch: (
        spell: TSpell,
        nextVitals: ChampionVitals,
        skillLevel: number,
        champion: Champion,
    ) => ProjectilePatchResult<TPatch> | null;
    mergeBasePatch: (basePatch: TPatch, nextPatch: TPatch) => TPatch;
};

export function runCastSpellRuntime<TSpell, TPatch>(
    state: CastSpellRuntimeState,
    championId: number,
    runeIds: string[],
    deps: CastSpellRuntimeDeps<TSpell, TPatch>,
): ProjectilePatchResult<TPatch> | null {
    const champion = state.party.find((entry) => entry.id === championId);
    if (!champion) return null;

    const vitals = state.championVitals[championId];
    if (!vitals) return null;

    return buildCastSpellStatePatch<TSpell, TPatch, ChampionVitals>(runeIds, {
        findSpell: deps.findSpell,
        buildUnknownCombinationPatch: deps.buildUnknownCombinationPatch,
        prepareCast: (spell) => deps.prepareCast(spell, champion, vitals),
        buildFailedCastPatch: deps.buildFailedCastPatch,
        buildNonProjectilePatch: (spell, nextVitals) =>
            deps.buildNonProjectilePatch(spell, nextVitals, champion),
        buildProjectilePatch: (spell, nextVitals, skillLevel) =>
            deps.buildProjectilePatch(spell, nextVitals, skillLevel, champion),
        mergeBasePatch: deps.mergeBasePatch,
    });
}
