export type OriginalResistanceDamageClass = 'physical' | 'fire' | 'magic' | 'mental';

type OriginalResistanceStats = {
    antiFire: number;
    antiMagic: number;
    wisdom: number;
};

export function scaleOriginalAttackValue(value: number, shift: number, factor: number): number {
    return Math.floor((Math.max(0, value) * factor) / (1 << shift));
}

export function adjustOriginalAttackByAttribute(value: number, currentAttribute: number): number {
    const factor = 170 - currentAttribute;
    if (factor < 16) return Math.floor(value / 8);
    return Math.floor((value * factor) / 128);
}

export function getOriginalPsychicAdjustedAttack(attack: number, wisdom: number): number {
    const wisdomFactor = 115 - wisdom;
    if (wisdomFactor <= 0) return 0;
    return scaleOriginalAttackValue(attack, 6, wisdomFactor);
}

export function getOriginalAttackAdjustedByResistance(
    attack: number,
    damageClass: OriginalResistanceDamageClass,
    stats: OriginalResistanceStats,
): number {
    if (damageClass === 'fire') {
        return adjustOriginalAttackByAttribute(attack, stats.antiFire);
    }
    if (damageClass === 'magic') {
        return adjustOriginalAttackByAttribute(attack, stats.antiMagic);
    }
    if (damageClass === 'mental') {
        return adjustOriginalAttackByAttribute(attack, stats.wisdom);
    }
    return attack;
}
