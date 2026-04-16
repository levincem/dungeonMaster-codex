import type { SpellDef } from '../../data/runes';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ChampionVitals } from '../runtimeTypes';
import {
    buildPlasmaSpellPatch,
    resolvePlasmaSpellResult,
} from './spellItemCreation';
import {
    buildPotionSpellPatch,
    resolvePotionSpellResult,
} from './spellPotionCreation';

type BuildPotionSpellStatePatchArgs = {
    championId: number;
    now: number;
    spell: SpellDef;
    currentEquipment: ChampionEquipment;
    nextVitals: ChampionVitals;
    currentChampionVitals: Record<number, ChampionVitals>;
    currentChampionEquipment: Record<number, ChampionEquipment>;
    randomInt: (maxExclusive: number) => number;
    resolvePotionName: (typeId: number) => string;
};

export function buildPotionSpellStatePatch({
    championId,
    now,
    spell,
    currentEquipment,
    nextVitals,
    currentChampionVitals,
    currentChampionEquipment,
    randomInt,
    resolvePotionName,
}: BuildPotionSpellStatePatchArgs) {
    const result = resolvePotionSpellResult(
        spell,
        currentEquipment,
        {
            randomInt,
            resolvePotionName,
        },
    );

    return buildPotionSpellPatch({
        championId,
        now,
        result,
        currentChampionVitals,
        nextVitals,
        currentChampionEquipment,
        currentEquipment,
    });
}

type BuildPlasmaSpellStatePatchArgs = {
    championId: number;
    now: number;
    level: number;
    position: [number, number];
    currentEquipment: ChampionEquipment;
    nextVitals: ChampionVitals;
    currentChampionVitals: Record<number, ChampionVitals>;
    currentChampionEquipment: Record<number, ChampionEquipment>;
    currentFloorItems: FloorItem[];
    buildDroppedItem: (item: FloorItem) => FloorItem;
    plasmaName: string;
};

export function buildPlasmaSpellStatePatch({
    championId,
    now,
    level,
    position,
    currentEquipment,
    nextVitals,
    currentChampionVitals,
    currentChampionEquipment,
    currentFloorItems,
    buildDroppedItem,
    plasmaName,
}: BuildPlasmaSpellStatePatchArgs) {
    const result = resolvePlasmaSpellResult(
        now,
        level,
        position,
        currentEquipment,
        plasmaName,
        {},
    );

    return buildPlasmaSpellPatch({
        championId,
        result,
        currentChampionVitals,
        nextVitals,
        currentChampionEquipment,
        currentEquipment,
        currentFloorItems,
        buildDroppedItem,
    });
}
