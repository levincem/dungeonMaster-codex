import type { SpellDef } from '../../data/runes';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ChampionVitals, PartyShield, SpellLight } from '../runtimeTypes';
import { buildPlasmaSpellStatePatch, buildPotionSpellStatePatch } from './spellItemActions';
import { buildSimpleStatusSpellPatch, buildSimpleTimedSpellPatch } from './spellSimpleStateEffects';
import { applySpellHeal } from './utilityAttackVitals';

type BuildHandledNonProjectileSpellPatchArgs = {
    championId: number;
    championHealth: number;
    now: number;
    spell: SpellDef;
    level: number;
    position: [number, number];
    nextVitals: ChampionVitals;
    currentChampionVitals: Record<number, ChampionVitals>;
    currentChampionEquipment: Record<number, ChampionEquipment>;
    currentEquipment: ChampionEquipment;
    currentFloorItems: FloorItem[];
    currentSpellLights: SpellLight[];
    currentActiveShields: PartyShield[];
    invisibleUntil: number;
    seeThroughWallsUntil: number;
    magicVisionUntil: number;
    footprintsUntil: number;
    quantizeDurationMs: (durationMs: number) => number;
    randomInt: (maxExclusive: number) => number;
    resolvePotionName: (typeId: number) => string;
    plasmaName: string;
    buildDroppedItem: (item: FloorItem) => FloorItem;
};

type NonProjectileSpellPatch = {
    championVitals: Record<number, ChampionVitals>;
    spellLights?: SpellLight[];
    activeShields?: PartyShield[];
    championEquipment?: Record<number, ChampionEquipment>;
    floorItems?: FloorItem[];
    invisibleUntil?: number;
    seeThroughWallsUntil?: number;
    magicVisionUntil?: number;
    footprintsUntil?: number;
    lastCastResult?: { success: boolean; message: string; ts: number } | null;
};

export function buildHandledNonProjectileSpellPatch({
    championId,
    championHealth,
    now,
    spell,
    level,
    position,
    nextVitals,
    currentChampionVitals,
    currentChampionEquipment,
    currentEquipment,
    currentFloorItems,
    currentSpellLights,
    currentActiveShields,
    invisibleUntil,
    seeThroughWallsUntil,
    magicVisionUntil,
    footprintsUntil,
    quantizeDurationMs,
    randomInt,
    resolvePotionName,
    plasmaName,
    buildDroppedItem,
}: BuildHandledNonProjectileSpellPatchArgs): NonProjectileSpellPatch | null {
    switch (spell.effect) {
        case 'heal': {
            const healedVitals = applySpellHeal(nextVitals, championHealth, spell.manaCost) ?? nextVitals;
            return {
                championVitals: { ...currentChampionVitals, [championId]: healedVitals },
            };
        }
        case 'light':
        case 'darkness':
        case 'shield':
        case 'fire_shield':
            return buildSimpleTimedSpellPatch({
                action: spell.effect,
                championId,
                now,
                spell,
                nextVitals,
                currentChampionVitals,
                currentSpellLights,
                currentActiveShields,
            });
        case 'invisibility':
            return buildSimpleStatusSpellPatch({
                action: 'invisibility',
                championId,
                now,
                spell,
                nextVitals,
                currentChampionVitals,
                currentUntil: invisibleUntil,
                quantizeDurationMs,
            });
        case 'see_through_walls':
            return buildSimpleStatusSpellPatch({
                action: 'see_through_walls',
                championId,
                now,
                spell,
                nextVitals,
                currentChampionVitals,
                currentUntil: seeThroughWallsUntil,
                quantizeDurationMs,
            });
        case 'reveal_hidden':
            return buildSimpleStatusSpellPatch({
                action: 'reveal_hidden',
                championId,
                now,
                spell,
                nextVitals,
                currentChampionVitals,
                currentUntil: magicVisionUntil,
                currentUntilKey: 'magicVisionUntil',
                quantizeDurationMs,
            });
        case 'footprints':
            return buildSimpleStatusSpellPatch({
                action: 'footprints',
                championId,
                now,
                spell,
                nextVitals,
                currentChampionVitals,
                currentUntil: footprintsUntil,
                quantizeDurationMs,
            });
        case 'potion':
            return buildPotionSpellStatePatch({
                championId,
                now,
                spell,
                currentEquipment,
                nextVitals,
                currentChampionVitals,
                currentChampionEquipment,
                randomInt,
                resolvePotionName,
            });
        case 'plasma':
            return buildPlasmaSpellStatePatch({
                championId,
                now,
                level,
                position,
                plasmaName,
                currentEquipment,
                currentChampionVitals,
                nextVitals,
                currentChampionEquipment,
                currentFloorItems,
                buildDroppedItem,
            });
        default:
            return null;
    }
}
