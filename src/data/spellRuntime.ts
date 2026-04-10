import type { SpellDef } from './runes';
import { getOriginalShieldProtectionApprox, getOriginalSpellDurationMs, getOriginalSpellLightContribution } from './originalSpells';

export interface SpellProjectileDamage {
    min: number;
    max: number;
}

export interface SpellCloudDamage {
    min: number;
    max: number;
}

export interface SpellShieldProfile {
    protection: number;
    durationMs: number;
}

export interface SpellProjectileLaunchProfile {
    initialRange: number;
    initialAttack: number;
    stepDecay: number;
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
    const protection = getOriginalShieldProtectionApprox(spell.runes);
    const durationMs = getOriginalSpellDurationMs(spell.runes);
    if (protection == null || durationMs == null) return null;
    return {
        protection,
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
    if (!['ful,ir', 'oh,kath,ra', 'des,ven', 'des,ew', 'oh,ven'].includes(sig)) return null;

    const powerRune = spell.runes[0];
    const powerLevel = ['lo', 'um', 'on', 'ee', 'pal', 'mon'].indexOf(powerRune) + 1;
    if (powerLevel <= 0) return null;

    const d6 = 4 * (powerLevel + 1);
    let initialRange = Math.max(21, Math.min(255, (2 * d6 + 4) * (powerLevel + 2)));
    let stepDecay = 10 - Math.min(8, Math.floor(Math.max(0, maxMana) / 8));
    if (initialRange < 4 * stepDecay) {
        initialRange += 3;
        stepDecay = Math.max(1, stepDecay - 1);
    }

    return {
        initialRange,
        initialAttack: 90,
        stepDecay,
    };
}
