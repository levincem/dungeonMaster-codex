export function getOriginalMonsterMoveDelaySeconds(
    moveTicks: number,
    randomInt: (maxExclusive: number) => number,
): number {
    return Math.max(1, moveTicks + randomInt(4) - 1) / 6;
}

export function getOriginalMonsterAttackDelaySeconds(
    attackTicks: number,
    randomInt: (maxExclusive: number) => number,
): number {
    let ticks = attackTicks + randomInt(4) - 1;
    if (attackTicks > 15) {
        ticks += randomInt(8) - 2;
    }
    return Math.max(1, ticks) / 6;
}
