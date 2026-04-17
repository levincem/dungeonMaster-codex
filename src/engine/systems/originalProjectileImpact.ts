import type { OriginalAttackType } from '../../data/creatures';
import type { ProjectileEffect } from '../runtimeTypes';

export type OriginalProjectileIncomingAttackType = OriginalAttackType | 'Lightning' | 'Normal';

export function rollOriginalProjectileImpactAttack(
    effect: Exclude<ProjectileEffect, 'physical'>,
    kineticEnergy: number,
    projectileAttack: number,
    randomInt: (maxExclusive: number) => number,
): { damage: number; attackType: OriginalProjectileIncomingAttackType; poisonAttack: number } {
    if (kineticEnergy <= 0) {
        return { damage: 0, attackType: 'Normal', poisonAttack: 0 };
    }

    if (effect === 'poison_bolt') {
        return {
            damage: 1,
            attackType: 'Magic',
            poisonAttack: Math.max(0, kineticEnergy),
        };
    }

    if (effect === 'slime') {
        let attack = randomInt(16);
        const poisonAttack = attack + 10;
        attack += randomInt(32);
        attack = Math.floor((attack + kineticEnergy) / 16) + 1;
        attack += randomInt(Math.floor(attack / 2) + 1) + randomInt(4);
        attack = Math.max(
            Math.floor(attack / 2),
            attack - (32 - Math.floor(projectileAttack / 8)),
        );
        return {
            damage: Math.max(0, attack),
            attackType: 'Blunt',
            poisonAttack,
        };
    }

    if (effect === 'poison_cloud' || effect === 'disrupt_nonmaterial' || effect === 'open') {
        return {
            damage: 0,
            attackType: effect === 'open' ? 'Normal' : 'Magic',
            poisonAttack: 0,
        };
    }

    const attackType: OriginalProjectileIncomingAttackType = effect === 'lightning' ? 'Lightning' : 'Fire';
    let attack = randomInt(16) + randomInt(16) + 10;
    if (effect === 'lightning') {
        attack *= 5;
    }

    attack = Math.floor((attack + kineticEnergy) / 16) + 1;
    attack += randomInt(Math.floor(attack / 2) + 1) + randomInt(4);
    attack = Math.max(
        Math.floor(attack / 2),
        attack - (32 - Math.floor(projectileAttack / 8)),
    );

    return {
        damage: Math.max(0, attack),
        attackType,
        poisonAttack: 0,
    };
}
