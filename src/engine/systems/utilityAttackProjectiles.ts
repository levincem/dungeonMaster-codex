import type { Direction, Projectile, ProjectileEffect } from '../runtimeTypes';

export type UtilityProjectileAttack = 'Lightning' | 'Fireball' | 'Dispell' | 'Disrupt' | 'Invoke';

type UtilityProjectileDeps = {
    randomInt: (max: number) => number;
    championMaxMana?: number;
    buildIdSuffix?: () => string;
};

const SOURCE_BACKED_SPELL_PROJECTILE_ATTACK = 90;

const INVOKE_EFFECT_TO_CANONICAL_RUNES: Record<
    Extract<ProjectileEffect, 'fireball' | 'poison_bolt' | 'poison_cloud' | 'disrupt_nonmaterial'>,
    string[]
> = {
    fireball: ['lo', 'ful', 'ir'],
    poison_bolt: ['lo', 'des', 'ven'],
    poison_cloud: ['lo', 'oh', 'ven'],
    disrupt_nonmaterial: ['lo', 'des', 'ew'],
};

function getSourceBackedSpellStepDecay(championMaxMana: number | undefined): number {
    return Math.max(2, 10 - Math.min(8, Math.floor(Math.max(0, championMaxMana ?? 0) / 8)));
}

function rollInvokeEffect(randomInt: (max: number) => number): Extract<
    ProjectileEffect,
    'fireball' | 'poison_bolt' | 'poison_cloud' | 'disrupt_nonmaterial'
> {
    switch (randomInt(6)) {
        case 0: return 'poison_bolt';
        case 1: return 'poison_cloud';
        case 2: return 'disrupt_nonmaterial';
        default: return 'fireball';
    }
}

function getFrontPosition(position: [number, number], direction: Direction): { x: number; y: number } {
    const [y, x] = position;
    if (direction === 'NORTH') return { x, y: y - 1 };
    if (direction === 'SOUTH') return { x, y: y + 1 };
    if (direction === 'EAST') return { x: x + 1, y };
    return { x: x - 1, y };
}

function buildProjectileId(prefix: string, now: number, deps: UtilityProjectileDeps): string {
    return `${prefix}_${now}_${deps.buildIdSuffix?.() ?? Math.random().toString(36).slice(2)}`;
}

export function buildUtilityAttackProjectile(
    attack: UtilityProjectileAttack,
    level: number,
    position: [number, number],
    direction: Direction,
    now: number,
    deps: UtilityProjectileDeps,
): Projectile {
    const { x, y } = getFrontPosition(position, direction);

    switch (attack) {
        case 'Lightning':
            return {
                id: buildProjectileId('weapon_lightning', now, deps),
                level,
                x,
                y,
                direction,
                effect: 'lightning',
                damage: [20, 45],
                nextMoveAt: now,
            };
        case 'Fireball':
            return {
                id: buildProjectileId('weapon_fireball', now, deps),
                level,
                x,
                y,
                direction,
                effect: 'fireball',
                damage: [18, 42],
                nextMoveAt: now,
            };
        case 'Dispell':
        case 'Disrupt':
            return {
                id: buildProjectileId(
                    attack === 'Disrupt' ? 'weapon_disrupt' : 'weapon_dispell',
                    now,
                    deps,
                ),
                level,
                x,
                y,
                direction,
                effect: 'disrupt_nonmaterial',
                damage: [14, 34],
                nextMoveAt: now,
            };
        case 'Invoke': {
            const effect = rollInvokeEffect(deps.randomInt);
            return {
                id: buildProjectileId('weapon_invoke', now, deps),
                level,
                x,
                y,
                direction,
                effect,
                spellRunes: [...INVOKE_EFFECT_TO_CANONICAL_RUNES[effect]],
                visualVariant: 'invoke',
                damage: [20, 50],
                nextMoveAt: now,
                remainingRange: deps.randomInt(128) + 100,
                remainingAttack: SOURCE_BACKED_SPELL_PROJECTILE_ATTACK,
                stepDecay: getSourceBackedSpellStepDecay(deps.championMaxMana),
            };
        }
    }
}
