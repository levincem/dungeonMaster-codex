import { getOriginalSpellPowerLevel } from '../../data/originalSpells';
import type { SpellDef } from '../../data/runes';
import type { ProjectileEffect } from '../runtimeTypes';

type MagicProjectileEffect = Exclude<ProjectileEffect, 'physical'>;

const DEFAULT_NON_RUNE_PROJECTILE_POWER_LEVEL = 3;

function clampPowerLevel(powerLevel: number): number {
    return Math.max(1, Math.min(6, Math.floor(powerLevel)));
}

export function getProjectileVisualScaleForPower(
    effect: MagicProjectileEffect,
    powerLevel: number,
): number {
    const normalizedPowerLevel = clampPowerLevel(powerLevel);

    switch (effect) {
        case 'fireball':
            return 0.82 + ((normalizedPowerLevel - 1) * 0.15);
        case 'lightning':
            return 0.9 + ((normalizedPowerLevel - 1) * 0.14);
        case 'poison_bolt':
            return 0.84 + ((normalizedPowerLevel - 1) * 0.11);
        case 'poison_cloud':
            return 0.94 + ((normalizedPowerLevel - 1) * 0.14);
        case 'open':
            return 0.82 + ((normalizedPowerLevel - 1) * 0.1);
        case 'disrupt_nonmaterial':
            return 0.88 + ((normalizedPowerLevel - 1) * 0.1);
        case 'slime':
            return 0.98;
        default:
            return 1;
    }
}

export function getSpellVisualScale(spell: Pick<SpellDef, 'effect' | 'runes'>): number {
    const powerLevel = getOriginalSpellPowerLevel(spell.runes) ?? 1;
    return getProjectileVisualScaleForPower(spell.effect as MagicProjectileEffect, powerLevel);
}

export function getSharedNonRuneProjectileVisualScale(effect: MagicProjectileEffect): number {
    // Creature and wall launchers do not carry rune context, so we give them
    // a shared mid-tier spell read instead of shrinking them relative to player casts.
    return getProjectileVisualScaleForPower(effect, DEFAULT_NON_RUNE_PROJECTILE_POWER_LEVEL);
}
