import type { SpellDef } from './runes';
import {
    getOriginalShieldStrength,
    getOriginalSpellDurationMs,
    getOriginalSpellLightContribution,
    getOriginalSpellPowerLevel,
} from './originalSpells';

export interface SpellProjectileDamage {
    min: number;
    max: number;
}

export interface SpellCloudDamage {
    min: number;
    max: number;
}

export interface SpellShieldProfile {
    defense: number;
    durationMs: number;
}

export interface SpellProjectileLaunchProfile {
    initialRange: number;
    stepDecay: number;
}

export interface SpellProjectileImpactResult {
    damage: number;
    poisonStrength: number;
}

function signature(spell: SpellDef): string {
    return spell.runes.slice(1).join(',');
}

export function getSpellDurationMs(spell: SpellDef): number | null {
    return getOriginalSpellDurationMs(spell.runes);
}

export function getSpellLightContribution(spell: SpellDef): number {
    return getOriginalSpellLightContribution(spell.runes);
}

export function getSpellShieldProfile(spell: SpellDef): SpellShieldProfile | null {
    const sig = signature(spell);
    if (sig !== 'ya,ir' && sig !== 'ful,bro,neta') return null;
    const defense = getOriginalShieldStrength(spell.runes);
    const durationMs = getOriginalSpellDurationMs(spell.runes);
    if (defense == null || durationMs == null) return null;
    return {
        defense,
        durationMs,
    };
}

export function getProjectileDamage(spell: SpellDef): SpellProjectileDamage | null {
    switch (spell.effect) {
        case 'fireball':
        case 'lightning':
        case 'poison_cloud':
        case 'poison_bolt':
        case 'disrupt_nonmaterial':
            return {
                min: Math.round(spell.manaCost * 3),
                max: Math.round(spell.manaCost * 5),
            };
        default:
            return null;
    }
}

export function getPoisonCloudDamage(spell: SpellDef): SpellCloudDamage {
    return {
        min: Math.max(2, Math.round(spell.manaCost * 1.5)),
        max: Math.max(Math.max(2, Math.round(spell.manaCost * 1.5)) + 2, Math.round(spell.manaCost * 2.5)),
    };
}

export function getSpellProjectileLaunchProfile(spell: SpellDef, maxMana: number): SpellProjectileLaunchProfile | null {
    const sig = signature(spell);
    if (!['ful,ir', 'oh,kath,ra', 'des,ven', 'des,ew', 'oh,ven', 'zo'].includes(sig)) return null;

    return {
        initialRange: 21,
        stepDecay: 10 - Math.min(8, Math.max(0, Math.floor(maxMana / 8))),
    };
}

export function getOriginalSpellProjectileLaunchProfile(
    spell: SpellDef,
    skillLevel: number,
    maxMana: number,
): SpellProjectileLaunchProfile | null {
    const sig = signature(spell);
    if (!['ful,ir', 'oh,kath,ra', 'des,ven', 'des,ew', 'oh,ven', 'zo'].includes(sig)) return null;

    const powerLevel = getOriginalSpellPowerLevel(spell.runes);
    if (!powerLevel || powerLevel <= 0) return null;

    const launchSkillLevel = spell.effect === 'open' ? skillLevel << 1 : skillLevel;
    const initialRange = Math.max(21, Math.min(255, (powerLevel + 2) * (4 + (launchSkillLevel << 1))));
    const stepDecay = Math.max(2, 10 - Math.min(8, Math.floor(Math.max(0, maxMana) / 8)));

    return {
        initialRange,
        stepDecay,
    };
}

function rollFireLikeProjectileImpact(
    multiplier: number,
    kineticEnergy: number,
    projectileAttack: number,
    rollExclusive: (maxExclusive: number) => number,
): SpellProjectileImpactResult {
    let attack = rollExclusive(16) + rollExclusive(16) + 10;
    attack *= multiplier;
    attack = ((attack + kineticEnergy) >> 4) + 1;
    attack += rollExclusive((attack >> 1) + 1) + rollExclusive(4);
    attack = Math.max(attack >> 1, attack - (32 - (projectileAttack >> 3)));
    return {
        damage: Math.max(0, attack),
        poisonStrength: 0,
    };
}

export function rollOriginalSpellProjectileImpact(
    spell: SpellDef,
    kineticEnergy: number,
    projectileAttack: number,
    rollExclusive: (maxExclusive: number) => number,
): SpellProjectileImpactResult | null {
    switch (spell.effect) {
        case 'fireball':
            return rollFireLikeProjectileImpact(1, kineticEnergy, projectileAttack, rollExclusive);
        case 'lightning':
            return rollFireLikeProjectileImpact(5, kineticEnergy, projectileAttack, rollExclusive);
        case 'poison_bolt':
            return {
                damage: 1,
                poisonStrength: Math.max(0, kineticEnergy),
            };
        case 'poison_cloud':
        case 'disrupt_nonmaterial':
            return {
                damage: 0,
                poisonStrength: 0,
            };
        default:
            return null;
    }
}
