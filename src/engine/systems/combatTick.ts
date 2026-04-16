import type { Champion } from '../../types/champion';
import type { ChampionCombat, DamageEvent } from '../runtimeTypes';

type TickCombatStateArgs = {
    party: Champion[];
    championCombat: Record<number, ChampionCombat>;
    damageEvents: DamageEvent[];
    delta: number;
    now: number;
    damageEventLifetimeMs: number;
};

export type TickCombatStateResult = {
    championCombat?: Record<number, ChampionCombat>;
    damageEvents?: DamageEvent[];
};

export function tickCombatState({
    party,
    championCombat,
    damageEvents,
    delta,
    now,
    damageEventLifetimeMs,
}: TickCombatStateArgs): TickCombatStateResult | null {
    const updates: Record<number, ChampionCombat> = {};
    let combatChanged = false;

    for (const champion of party) {
        const combat = championCombat[champion.id];
        if (!combat) continue;
        if (combat.cooldown > 0) {
            const nextCooldown = Math.max(0, combat.cooldown - delta);
            updates[champion.id] = {
                ...combat,
                cooldown: nextCooldown,
                defenseModifier: nextCooldown > 0 ? combat.defenseModifier : 0,
            };
            combatChanged = true;
            continue;
        }
        if (combat.defenseModifier !== 0) {
            updates[champion.id] = {
                ...combat,
                defenseModifier: 0,
            };
            combatChanged = true;
        }
    }

    const nextDamageEvents = damageEvents.filter((event) => now - event.ts < damageEventLifetimeMs);
    const eventsChanged = nextDamageEvents.length !== damageEvents.length;

    if (!combatChanged && !eventsChanged) return null;

    return {
        ...(combatChanged ? { championCombat: { ...championCombat, ...updates } } : {}),
        ...(eventsChanged ? { damageEvents: nextDamageEvents } : {}),
    };
}
