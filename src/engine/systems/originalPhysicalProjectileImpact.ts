import { CREATURE_TYPES } from '../../data/creatures';
import { getItemWeight } from '../../data/equipment';
import { getOriginalWeaponReference } from '../../data/weaponAttacks';
import type { Projectile } from '../runtimeTypes';

function getOriginalPhysicalProjectileImpactWeight(projectile: Projectile): number {
    if (!projectile.physicalItem) return 0;
    return Math.round(getItemWeight(projectile.physicalItem) * 10);
}

export function rollOriginalPhysicalProjectileBaseDamage(
    projectile: Projectile,
    randomInt: (maxExclusive: number) => number,
): number {
    if (projectile.effect !== 'physical') return 0;

    const physicalItem = projectile.physicalItem;
    if (!physicalItem) {
        return Math.max(0, Math.round(projectile.remainingAttack ?? projectile.damage[1] ?? 0));
    }

    const weaponDescriptor = physicalItem.category === 'Weapon'
        ? getOriginalWeaponReference(physicalItem)
        : null;
    let impactDamage = physicalItem.category === 'Weapon'
        ? (weaponDescriptor?.kineticEnergy ?? 0)
        : randomInt(4);

    impactDamage += Math.floor(getOriginalPhysicalProjectileImpactWeight(projectile) / 2);
    impactDamage = Math.floor(
        (impactDamage + Math.max(0, Math.round(projectile.remainingRange ?? 0))) / 16,
    ) + 1;
    impactDamage += randomInt(Math.floor(impactDamage / 2) + 1) + randomInt(4);

    const damageRemaining = Math.max(0, Math.round(projectile.remainingAttack ?? 0));
    const attenuation = 32 - Math.floor(damageRemaining / 8);
    return Math.max(Math.floor(impactDamage / 2), impactDamage - attenuation);
}

export function rollOriginalPhysicalProjectileCreatureDamage(
    projectile: Projectile,
    creatureTypeId: number,
    randomInt: (maxExclusive: number) => number,
): number {
    const baseDamage = rollOriginalPhysicalProjectileBaseDamage(projectile, randomInt);
    if (baseDamage <= 0) return 0;

    const creatureDefense = Math.max(1, CREATURE_TYPES[creatureTypeId]?.armor ?? 1);
    return Math.max(0, Math.floor((64 * baseDamage) / creatureDefense));
}
