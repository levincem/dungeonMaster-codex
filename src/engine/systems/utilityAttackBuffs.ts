import type { PartyShield, SpellLight } from '../runtimeTypes';

export type UtilityBuffAction = 'Light' | 'Spellshield' | 'Fireshield' | 'Freeze Life' | 'Window';

type UtilityBuffDeps = {
    quantizeDurationMs: (durationMs: number) => number;
    buildIdSuffix?: () => string;
};

export type UtilityBuffResult = {
    spellLight?: SpellLight;
    shield?: PartyShield;
    freezeLifeRemainingTicks?: number;
    seeThroughWallsUntil?: number;
};

function buildId(prefix: string, now: number, deps: UtilityBuffDeps): string {
    return `${prefix}_${now}_${deps.buildIdSuffix?.() ?? Math.random().toString(36).slice(2)}`;
}

export function resolveUtilityBuffAction(
    action: UtilityBuffAction,
    now: number,
    currentFreezeLifeRemainingTicks: number,
    currentSeeThroughWallsUntil: number,
    deps: UtilityBuffDeps,
): UtilityBuffResult {
    switch (action) {
        case 'Light':
            return {
                spellLight: {
                    id: buildId('weapon_light', now, deps),
                    lightContrib: 0.5,
                    expiresAt: now + deps.quantizeDurationMs(10 * 60_000),
                },
            };
        case 'Spellshield':
            return {
                shield: {
                    id: buildId('weapon_spellshield', now, deps),
                    expiresAt: now + deps.quantizeDurationMs(90_000),
                    defense: 22,
                    kind: 'magic',
                },
            };
        case 'Fireshield':
            return {
                shield: {
                    id: buildId('weapon_fireshield', now, deps),
                    expiresAt: now + deps.quantizeDurationMs(90_000),
                    defense: 22,
                    kind: 'fire',
                },
            };
        case 'Freeze Life':
            return {
                freezeLifeRemainingTicks: Math.min(200, currentFreezeLifeRemainingTicks + 70),
            };
        case 'Window':
            return {
                seeThroughWallsUntil: Math.max(currentSeeThroughWallsUntil, now + deps.quantizeDurationMs(120_000)),
            };
    }
}
