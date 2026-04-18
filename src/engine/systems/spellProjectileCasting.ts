import type { SpellDef } from '../../data/runes';
import { getOriginalSpellPowerLevel } from '../../data/originalSpells';
import {
    getOriginalSpellProjectileLaunchProfile,
    getProjectileDamage,
    getSpellProjectileLaunchProfile,
    type SpellProjectileDamage,
    type SpellProjectileLaunchProfile,
} from '../../data/spellRuntime';
import type { Direction, Projectile, ProjectileEffect } from '../runtimeTypes';

type SpellProjectileCastingDeps = {
    projectileAttack: number;
    projectileStepMs: number;
    buildIdSuffix?: () => string;
};

export type SpellProjectileCastResult = {
    startX: number;
    startY: number;
    frontX: number;
    frontY: number;
    visualScale: number;
    projectileDamage: SpellProjectileDamage;
    launchProfile: SpellProjectileLaunchProfile | null;
    projectile: Projectile;
};

function getSpellVisualScale(spell: SpellDef): number {
    if (spell.effect !== 'fireball' && spell.effect !== 'open') return 1;
    const powerLevel = getOriginalSpellPowerLevel(spell.runes) ?? 1;
    return 0.82 + ((powerLevel - 1) * 0.15);
}

function getFrontPosition(position: [number, number], direction: Direction): { x: number; y: number } {
    const [y, x] = position;
    if (direction === 'NORTH') return { x, y: y - 1 };
    if (direction === 'SOUTH') return { x, y: y + 1 };
    if (direction === 'EAST') return { x: x + 1, y };
    return { x: x - 1, y };
}

function getPartyPosition(position: [number, number]): { x: number; y: number } {
    const [y, x] = position;
    return { x, y };
}

function buildProjectileId(now: number, deps: SpellProjectileCastingDeps): string {
    return `proj_${now}_${deps.buildIdSuffix?.() ?? Math.random().toString(36).slice(2)}`;
}

export function buildSpellProjectileCast(
    spell: SpellDef,
    level: number,
    position: [number, number],
    direction: Direction,
    now: number,
    skillLevel: number,
    maxMana: number,
    deps: SpellProjectileCastingDeps,
): SpellProjectileCastResult | null {
    const launchProfile =
        getOriginalSpellProjectileLaunchProfile(spell, skillLevel, maxMana) ??
        getSpellProjectileLaunchProfile(spell, maxMana);
    const projectileDamage = spell.effect === 'open'
        ? { min: 0, max: 0 }
        : getProjectileDamage(spell);
    if (!projectileDamage) return null;

    const { x: startX, y: startY } = getPartyPosition(position);
    const { x: frontX, y: frontY } = getFrontPosition(position, direction);
    const visualScale = getSpellVisualScale(spell);

    const projectile: Projectile = {
        id: buildProjectileId(now, deps),
        level,
        x: startX,
        y: startY,
        direction,
        effect: spell.effect as ProjectileEffect,
        spellRunes: [...spell.runes],
        visualScale,
        damage: [projectileDamage.min, projectileDamage.max],
        nextMoveAt: now + deps.projectileStepMs,
        remainingRange: launchProfile?.initialRange,
        remainingAttack: spell.effect === 'open' ? 0 : deps.projectileAttack,
        stepDecay: launchProfile?.stepDecay,
    };

    return {
        startX,
        startY,
        frontX,
        frontY,
        visualScale,
        projectileDamage,
        launchProfile,
        projectile,
    };
}
