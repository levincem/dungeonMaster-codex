import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ActivePoisonCloud, ChampionVitals, DamageEvent, ProjectileEffect, SpellVisualEvent } from '../runtimeTypes';

export type SpellBacklashPatch = {
    championVitals?: Record<number, ChampionVitals>;
    damageEvents?: DamageEvent[];
    party?: Champion[];
    floorItems?: FloorItem[];
    championInventories?: Record<number, FloorItem[]>;
    championEquipment?: Record<number, ChampionEquipment>;
    deadChampions?: Record<number, Champion>;
    selectedChampionIndex?: number;
};

export type BlockedSpellProjectilePatch = {
    championVitals: Record<number, ChampionVitals>;
    damageEvents?: DamageEvent[];
    party?: Champion[];
    floorItems?: FloorItem[];
    championInventories?: Record<number, FloorItem[]>;
    championEquipment?: Record<number, ChampionEquipment>;
    deadChampions?: Record<number, Champion>;
    selectedChampionIndex?: number;
    activePoisonClouds?: ActivePoisonCloud[];
    spellVisualEvents: SpellVisualEvent[];
};

type ProjectileDamageRange = {
    min: number;
    max: number;
};

type ResolveBlockedSpellProjectileConsequencesArgs = {
    spellEffect: Exclude<ProjectileEffect, 'physical'>;
    level: number;
    x: number;
    y: number;
    visualScale: number;
    projectileAttack: number;
    elapsedGameTimeTicks: number;
    projectileDamage: ProjectileDamageRange;
    initialRange: number;
    buildBlockedPoisonCloud: (
        level: number,
        x: number,
        y: number,
        attack: number,
        elapsedGameTimeTicks: number,
        visualScale: number,
    ) => ActivePoisonCloud;
    rollSourceBackedImpactDamage: (initialRange: number) => number | null;
    rollRandomDamage: (min: number, max: number) => number;
    applyBacklash: (rolledDamage: number) => SpellBacklashPatch | null;
};

export function resolveBlockedSpellProjectileConsequences({
    spellEffect,
    level,
    x,
    y,
    visualScale,
    projectileAttack,
    elapsedGameTimeTicks,
    projectileDamage,
    initialRange,
    buildBlockedPoisonCloud,
    rollSourceBackedImpactDamage,
    rollRandomDamage,
    applyBacklash,
}: ResolveBlockedSpellProjectileConsequencesArgs): {
    blockedPoisonCloud: ActivePoisonCloud | null;
    backlash: SpellBacklashPatch | null;
} {
    const blockedPoisonCloud = spellEffect === 'poison_cloud'
        ? buildBlockedPoisonCloud(
            level,
            x,
            y,
            projectileAttack,
            elapsedGameTimeTicks,
            visualScale * 1.08,
        )
        : null;

    if (blockedPoisonCloud) {
        return {
            blockedPoisonCloud,
            backlash: null,
        };
    }

    const sourceBackedDamage =
        spellEffect === 'fireball' || spellEffect === 'lightning'
            ? rollSourceBackedImpactDamage(initialRange)
            : null;
    const rolledDamage = sourceBackedDamage
        ?? rollRandomDamage(projectileDamage.min, projectileDamage.max);

    return {
        blockedPoisonCloud: null,
        backlash: applyBacklash(rolledDamage),
    };
}

type BuildBlockedSpellProjectilePatchArgs = {
    nextChampionVitals: Record<number, ChampionVitals>;
    blockedPoisonCloud: ActivePoisonCloud | null;
    backlash: SpellBacklashPatch | null;
    currentSpellVisualEvents: SpellVisualEvent[];
    blockedImpactEvent: SpellVisualEvent;
    currentActivePoisonClouds: ActivePoisonCloud[];
};

export function buildBlockedSpellProjectilePatch({
    nextChampionVitals,
    blockedPoisonCloud,
    backlash,
    currentSpellVisualEvents,
    blockedImpactEvent,
    currentActivePoisonClouds,
}: BuildBlockedSpellProjectilePatchArgs): BlockedSpellProjectilePatch {
    return {
        championVitals: backlash?.championVitals ?? nextChampionVitals,
        ...(backlash?.damageEvents ? { damageEvents: backlash.damageEvents } : {}),
        ...(backlash?.party ? { party: backlash.party } : {}),
        ...(backlash?.floorItems ? { floorItems: backlash.floorItems } : {}),
        ...(backlash?.championInventories ? { championInventories: backlash.championInventories } : {}),
        ...(backlash?.championEquipment ? { championEquipment: backlash.championEquipment } : {}),
        ...(backlash?.deadChampions ? { deadChampions: backlash.deadChampions } : {}),
        ...(backlash?.selectedChampionIndex !== undefined ? { selectedChampionIndex: backlash.selectedChampionIndex } : {}),
        ...(blockedPoisonCloud ? { activePoisonClouds: [...currentActivePoisonClouds, blockedPoisonCloud] } : {}),
        spellVisualEvents: [...currentSpellVisualEvents, blockedImpactEvent],
    };
}
