import type { ProjectileEffect, SpellVisualEvent } from '../../engine/runtimeTypes';

export const PARTY_FIREBALL_FLASH_MS = 400;

export type PartySpellImpactEffect = Extract<
    ProjectileEffect,
    'fireball' | 'lightning' | 'poison_bolt' | 'poison_cloud' | 'slime'
>;

export type PartySpellImpactEvent = SpellVisualEvent & {
    effect: PartySpellImpactEffect;
};

export function isPartySpellImpactEffect(
    effect: SpellVisualEvent['effect'],
): effect is PartySpellImpactEffect {
    return effect === 'fireball' ||
        effect === 'lightning' ||
        effect === 'poison_bolt' ||
        effect === 'poison_cloud' ||
        effect === 'slime';
}

export function findLatestPartySpellImpactEvent(
    spellVisualEvents: SpellVisualEvent[],
    level: number,
    position: [number, number],
): PartySpellImpactEvent | null {
    const targetX = position[1];
    const targetY = position[0];

    for (let index = spellVisualEvents.length - 1; index >= 0; index -= 1) {
        const event = spellVisualEvents[index];
        const effect = event.effect;
        if (!isPartySpellImpactEffect(effect)) continue;
        if (event.level !== level || event.x !== targetX || event.y !== targetY) continue;
        return { ...event, effect };
    }

    return null;
}

export function findLatestPartyFireballImpactEvent(
    spellVisualEvents: SpellVisualEvent[],
    level: number,
    position: [number, number],
): PartySpellImpactEvent | null {
    const event = findLatestPartySpellImpactEvent(spellVisualEvents, level, position);
    return event?.effect === 'fireball' ? event : null;
}
