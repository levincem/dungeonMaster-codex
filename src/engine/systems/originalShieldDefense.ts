import type { PartyShield } from '../runtimeTypes';

export function getOriginalPartyShieldKind(shield: PartyShield): 'physical' | 'magic' | 'fire' {
    if (shield.kind) return shield.kind;
    if (shield.fireOnly) return 'fire';
    return shield.championId !== undefined ? 'magic' : 'physical';
}

export function getOriginalActiveShieldDefense(
    shields: PartyShield[],
    nowMs: number,
    shieldKind: 'physical' | 'magic' | 'fire',
    championId?: number,
): number {
    const matchesChampion = (shield: PartyShield) =>
        shield.championId === undefined || shield.championId === championId;

    return shields
        .filter((shield) => (
            shield.expiresAt > nowMs &&
            matchesChampion(shield) &&
            getOriginalPartyShieldKind(shield) === shieldKind
        ))
        .reduce((sum, shield) => {
            if (shield.defense !== undefined) return sum + shield.defense;
            if (shield.protection !== undefined) return sum + Math.round(shield.protection * 64);
            return sum;
        }, 0);
}
