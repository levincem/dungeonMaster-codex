import type { ActiveFluxcage, ActivePotionBoost, PartyShield, SpellLight } from '../runtimeTypes';

type TimedEffectsState = {
    torchBurnStart: Record<string, number>;
    spellLights: SpellLight[];
    activeFluxcages?: ActiveFluxcage[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    invisibleUntil: number;
    magicVisionUntil: number;
    seeThroughWallsUntil: number;
    footprintsUntil: number;
};

type LightTimedEffectsState = Pick<TimedEffectsState, 'torchBurnStart' | 'spellLights' | 'activeFluxcages'>;

export function shiftRealtimeLightEffectsState<TState extends LightTimedEffectsState>(
    state: TState,
    shiftMs: number,
): Pick<LightTimedEffectsState, 'torchBurnStart' | 'spellLights' | 'activeFluxcages'> {
    if (shiftMs <= 0) {
        return {
            torchBurnStart: state.torchBurnStart,
            spellLights: state.spellLights,
            activeFluxcages: state.activeFluxcages ?? [],
        };
    }

    return {
        torchBurnStart: Object.fromEntries(
            Object.entries(state.torchBurnStart).map(([itemId, litAt]) => [itemId, litAt + shiftMs]),
        ),
        spellLights: state.spellLights.map((light) => ({
            ...light,
            expiresAt: light.expiresAt + shiftMs,
        })),
        activeFluxcages: (state.activeFluxcages ?? []).map((fluxcage) => ({
            ...fluxcage,
            expiresAt: fluxcage.expiresAt + shiftMs,
        })),
    };
}

export function ageTimedEffectsState(
    state: TimedEffectsState,
    advanceMs: number,
    now: number,
): Partial<TimedEffectsState> {
    if (advanceMs <= 0) return {};

    const torchBurnStart = Object.fromEntries(
        Object.entries(state.torchBurnStart).map(([itemId, litAt]) => [itemId, litAt - advanceMs]),
    );
    const spellLights = state.spellLights
        .map((light) => ({ ...light, expiresAt: light.expiresAt - advanceMs }))
        .filter((light) => light.expiresAt > now);
    const activeFluxcages = (state.activeFluxcages ?? [])
        .map((fluxcage) => ({ ...fluxcage, expiresAt: fluxcage.expiresAt - advanceMs }))
        .filter((fluxcage) => fluxcage.expiresAt > now);
    const activeShields = state.activeShields
        .map((shield) => ({ ...shield, expiresAt: shield.expiresAt - advanceMs }))
        .filter((shield) => shield.expiresAt > now);
    const activePotionBoosts = state.activePotionBoosts
        .map((boost) => ({ ...boost, expiresAt: boost.expiresAt - advanceMs }))
        .filter((boost) => boost.expiresAt > now);

    return {
        torchBurnStart,
        spellLights,
        activeFluxcages,
        activeShields,
        activePotionBoosts,
        invisibleUntil: Math.max(0, state.invisibleUntil - advanceMs),
        magicVisionUntil: Math.max(0, state.magicVisionUntil - advanceMs),
        seeThroughWallsUntil: Math.max(0, state.seeThroughWallsUntil - advanceMs),
        footprintsUntil: Math.max(0, state.footprintsUntil - advanceMs),
    };
}
