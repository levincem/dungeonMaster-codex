import type { ActivePotionBoost, PartyShield, SpellLight } from '../runtimeTypes';

type TimedEffectsState = {
    torchBurnStart: Record<string, number>;
    spellLights: SpellLight[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    invisibleUntil: number;
    magicVisionUntil: number;
    seeThroughWallsUntil: number;
    footprintsUntil: number;
};

type LightTimedEffectsState = Pick<TimedEffectsState, 'torchBurnStart' | 'spellLights'>;

export function shiftRealtimeLightEffectsState<TState extends LightTimedEffectsState>(
    state: TState,
    shiftMs: number,
): Pick<LightTimedEffectsState, 'torchBurnStart' | 'spellLights'> {
    if (shiftMs <= 0) {
        return {
            torchBurnStart: state.torchBurnStart,
            spellLights: state.spellLights,
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
    const activeShields = state.activeShields
        .map((shield) => ({ ...shield, expiresAt: shield.expiresAt - advanceMs }))
        .filter((shield) => shield.expiresAt > now);
    const activePotionBoosts = state.activePotionBoosts
        .map((boost) => ({ ...boost, expiresAt: boost.expiresAt - advanceMs }))
        .filter((boost) => boost.expiresAt > now);

    return {
        torchBurnStart,
        spellLights,
        activeShields,
        activePotionBoosts,
        invisibleUntil: Math.max(0, state.invisibleUntil - advanceMs),
        magicVisionUntil: Math.max(0, state.magicVisionUntil - advanceMs),
        seeThroughWallsUntil: Math.max(0, state.seeThroughWallsUntil - advanceMs),
        footprintsUntil: Math.max(0, state.footprintsUntil - advanceMs),
    };
}
