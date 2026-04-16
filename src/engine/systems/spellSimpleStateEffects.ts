import type { SpellDef } from '../../data/runes';
import type { ChampionVitals, PartyShield, SpellLight } from '../runtimeTypes';
import {
    buildSpellStatusStatePatch,
    resolveSpellStatusPatch,
    type SpellStatusEffectAction,
    type SpellStatusStatePatch,
} from './spellStatusEffects';
import {
    buildSpellTimedBuffPatch,
    resolveSpellTimedBuff,
    type SpellTimedBuffAction,
    type SpellTimedBuffPatch,
} from './spellTimedBuffs';

type BuildSimpleTimedSpellPatchArgs = {
    action: SpellTimedBuffAction;
    championId: number;
    now: number;
    spell: SpellDef;
    nextVitals: ChampionVitals;
    currentChampionVitals: Record<number, ChampionVitals>;
    currentSpellLights: SpellLight[];
    currentActiveShields: PartyShield[];
};

type BuildSimpleStatusSpellPatchArgs = {
    action: SpellStatusEffectAction;
    championId: number;
    now: number;
    spell: SpellDef;
    nextVitals: ChampionVitals;
    currentChampionVitals: Record<number, ChampionVitals>;
    currentUntil: number;
    quantizeDurationMs: (durationMs: number) => number;
    currentUntilKey?: 'magicVisionUntil';
};

export function buildSimpleTimedSpellPatch({
    action,
    championId,
    now,
    spell,
    nextVitals,
    currentChampionVitals,
    currentSpellLights,
    currentActiveShields,
}: BuildSimpleTimedSpellPatchArgs): SpellTimedBuffPatch {
    const buff = resolveSpellTimedBuff(action, now, {}, spell);
    return buildSpellTimedBuffPatch({
        championId,
        nextVitals,
        currentChampionVitals,
        currentSpellLights,
        currentActiveShields,
        buff,
    });
}

export function buildSimpleStatusSpellPatch({
    action,
    championId,
    now,
    spell,
    nextVitals,
    currentChampionVitals,
    currentUntil,
    quantizeDurationMs,
    currentUntilKey,
}: BuildSimpleStatusSpellPatchArgs): SpellStatusStatePatch {
    const statusPatch = resolveSpellStatusPatch(
        action,
        now,
        currentUntil,
        spell,
        { quantizeDurationMs },
    );

    if (currentUntilKey) {
        return buildSpellStatusStatePatch({
            championId,
            nextVitals,
            currentChampionVitals,
            statusPatch,
            currentUntilKey,
            currentUntilValue: currentUntil,
        });
    }

    return buildSpellStatusStatePatch({
        championId,
        nextVitals,
        currentChampionVitals,
        statusPatch,
    });
}
