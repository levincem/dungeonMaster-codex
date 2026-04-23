import type { FloorItem } from '../../types/game';

type ThrowWeaponDescriptor = {
    rawClass?: number;
    kineticEnergy?: number;
} | null;

export function getOriginalThrownObjectExperience(
    item: FloorItem,
    descriptor: ThrowWeaponDescriptor,
): number {
    let experience = 8;

    if (item.category !== 'Weapon') {
        return experience;
    }

    experience += 4;
    if ((descriptor?.rawClass ?? Number.MAX_SAFE_INTEGER) <= 12) {
        experience += Math.floor((descriptor?.kineticEnergy ?? 1) / 4);
    }

    return experience;
}
