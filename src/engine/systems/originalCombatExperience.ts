export function getOriginalCreatureExperienceClass(
    experienceClass: number | undefined,
): number {
    return Math.max(0, Math.floor(experienceClass ?? 0));
}

export function getOriginalMeleeExperienceAmount(
    damage: number,
    experienceClass: number | undefined,
): number {
    const normalizedDamage = Math.max(0, Math.floor(damage));
    if (normalizedDamage <= 0) return 0;
    return ((normalizedDamage * getOriginalCreatureExperienceClass(experienceClass)) >> 4) + 3;
}

export function getOriginalParryExperienceAmount(
    experienceClass: number | undefined,
): number {
    return getOriginalCreatureExperienceClass(experienceClass);
}
