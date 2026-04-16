import type { ChampionVitals, Direction, PartyShield, Projectile, SpellLight } from '../runtimeTypes';
import { resolveUtilityBuffAction } from './utilityAttackBuffs';
import { buildUtilityAttackProjectile } from './utilityAttackProjectiles';
import { applyUtilityHeal } from './utilityAttackVitals';

export type SimpleUtilityAttack =
    | 'Heal'
    | 'Light'
    | 'Spellshield'
    | 'Fireshield'
    | 'Lightning'
    | 'Fireball'
    | 'Dispell'
    | 'Freeze Life'
    | 'Block'
    | 'Flip'
    | 'Invoke'
    | 'Window';

type SimpleUtilityAttackState = {
    now: number;
    level: number;
    position: [number, number];
    direction: Direction;
    freezeLifeRemainingTicks: number;
    seeThroughWallsUntil: number;
    spellLights: SpellLight[];
    activeShields: PartyShield[];
    projectiles: Projectile[];
};

type SimpleUtilityAttackDeps = {
    randomInt: (max: number) => number;
    quantizeDurationMs: (durationMs: number) => number;
    buildIdSuffix?: () => string;
};

export function buildSimpleUtilityAttackPatch<TPatch extends object>(
    action: SimpleUtilityAttack,
    state: SimpleUtilityAttackState,
    basePatch: TPatch,
    championVitals: Record<number, ChampionVitals>,
    championId: number,
    championHealth: number,
    deps: SimpleUtilityAttackDeps,
): TPatch {
    switch (action) {
        case 'Heal': {
            const healedVitals = applyUtilityHeal(
                championVitals[championId],
                championHealth,
            );
            if (!healedVitals) return basePatch;
            return {
                ...basePatch,
                championVitals: {
                    ...championVitals,
                    [championId]: healedVitals,
                },
            } as TPatch;
        }
        case 'Light': {
            const buff = resolveUtilityBuffAction(
                'Light',
                state.now,
                state.freezeLifeRemainingTicks,
                state.seeThroughWallsUntil,
                {
                    quantizeDurationMs: deps.quantizeDurationMs,
                    buildIdSuffix: deps.buildIdSuffix,
                },
            );
            return {
                ...basePatch,
                spellLights: buff.spellLight ? [...state.spellLights, buff.spellLight] : state.spellLights,
            } as TPatch;
        }
        case 'Spellshield':
        case 'Fireshield': {
            const buff = resolveUtilityBuffAction(
                action,
                state.now,
                state.freezeLifeRemainingTicks,
                state.seeThroughWallsUntil,
                {
                    quantizeDurationMs: deps.quantizeDurationMs,
                    buildIdSuffix: deps.buildIdSuffix,
                },
            );
            return {
                ...basePatch,
                activeShields: buff.shield ? [...state.activeShields, buff.shield] : state.activeShields,
            } as TPatch;
        }
        case 'Lightning':
        case 'Fireball':
        case 'Dispell':
        case 'Invoke': {
            const projectile = buildUtilityAttackProjectile(
                action,
                state.level,
                state.position,
                state.direction,
                state.now,
                {
                    randomInt: deps.randomInt,
                    buildIdSuffix: deps.buildIdSuffix,
                },
            );
            return {
                ...basePatch,
                projectiles: [...state.projectiles, projectile],
            } as TPatch;
        }
        case 'Freeze Life': {
            const buff = resolveUtilityBuffAction(
                'Freeze Life',
                state.now,
                state.freezeLifeRemainingTicks,
                state.seeThroughWallsUntil,
                { quantizeDurationMs: deps.quantizeDurationMs },
            );
            return {
                ...basePatch,
                freezeLifeRemainingTicks: buff.freezeLifeRemainingTicks ?? state.freezeLifeRemainingTicks,
            } as TPatch;
        }
        case 'Window': {
            const buff = resolveUtilityBuffAction(
                'Window',
                state.now,
                state.freezeLifeRemainingTicks,
                state.seeThroughWallsUntil,
                { quantizeDurationMs: deps.quantizeDurationMs },
            );
            return {
                ...basePatch,
                seeThroughWallsUntil: buff.seeThroughWallsUntil ?? state.seeThroughWallsUntil,
            } as TPatch;
        }
        case 'Block':
        case 'Flip':
            return basePatch;
    }
}
