import type { Direction, Projectile, ProjectileEffect } from '../runtimeTypes';

export type UtilityProjectileAttack = 'Lightning' | 'Fireball' | 'Dispell' | 'Disrupt' | 'Invoke';

type UtilityProjectileDeps = {
    randomInt: (max: number) => number;
    buildIdSuffix?: () => string;
};

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
            const invokeEffects: ProjectileEffect[] = [
                'poison_bolt',
                'poison_cloud',
                'disrupt_nonmaterial',
                'fireball',
            ];
            const effect = invokeEffects[deps.randomInt(invokeEffects.length)] ?? 'fireball';
            return {
                id: buildProjectileId('weapon_invoke', now, deps),
                level,
                x,
                y,
                direction,
                effect,
                damage: [20, 50],
                nextMoveAt: now,
            };
        }
    }
}
