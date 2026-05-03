import type { SpellDef } from '../../data/runes';
import {
    getOriginalPotionStrengthRange,
    getOriginalSpellDescriptorForRunes,
} from '../../data/originalSpells';
import { getTranslations } from '../../i18n';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ChampionVitals } from '../runtimeTypes';

export type PotionSpellResult =
    | { kind: 'invalid' }
    | { kind: 'missing_flask' }
    | { kind: 'success'; slot: 'rightHand' | 'leftHand'; potion: FloorItem };

export type PotionSpellPatch = {
    championVitals: Record<number, ChampionVitals>;
    championEquipment?: Record<number, ChampionEquipment>;
    lastCastResult?: { success: boolean; message: string; ts: number };
};

type PotionSpellDeps = {
    randomInt: (maxExclusive: number) => number;
    resolvePotionName: (typeId: number) => string;
};

function formatGeneratedPotionName(baseName: string, potionPower: number): string {
    return `${baseName} (${potionPower})`;
}

function isEmptyFlask(item: FloorItem | undefined): boolean {
    return item?.category === 'Potion' && item.typeId === 20;
}

export function resolvePotionSpellResult(
    spell: SpellDef,
    equipment: ChampionEquipment | undefined,
    deps: PotionSpellDeps,
): PotionSpellResult {
    const descriptor = getOriginalSpellDescriptorForRunes(spell.runes);
    if (!descriptor || descriptor.spellTypeName !== 'potion') {
        return { kind: 'invalid' };
    }

    const slot = (['rightHand', 'leftHand'] as const).find((candidate) => isEmptyFlask(equipment?.[candidate]));
    if (!slot) {
        return { kind: 'missing_flask' };
    }

    const flask = equipment?.[slot];
    if (!flask) {
        return { kind: 'missing_flask' };
    }

    const potionStrength = getOriginalPotionStrengthRange(spell.runes);
    const potionPower = potionStrength
        ? potionStrength.min + deps.randomInt((potionStrength.max - potionStrength.min) + 1)
        : 40;
    const potionName = deps.resolvePotionName(descriptor.subtype);

    return {
        kind: 'success',
        slot,
        potion: {
            ...flask,
            category: 'Potion',
            typeId: descriptor.subtype,
            rawName: formatGeneratedPotionName(potionName, potionPower),
            potionPower,
        },
    };
}

type BuildPotionSpellPatchArgs = {
    championId: number;
    now: number;
    result: PotionSpellResult;
    currentChampionVitals: Record<number, ChampionVitals>;
    nextVitals: ChampionVitals;
    currentChampionEquipment: Record<number, ChampionEquipment>;
    currentEquipment: ChampionEquipment;
};

export function buildPotionSpellPatch({
    championId,
    now,
    result,
    currentChampionVitals,
    nextVitals,
    currentChampionEquipment,
    currentEquipment,
}: BuildPotionSpellPatchArgs): PotionSpellPatch {
    const championVitals = {
        ...currentChampionVitals,
        [championId]: nextVitals,
    };

    if (result.kind === 'missing_flask') {
        return {
            championVitals,
            lastCastResult: {
                success: false,
                message: getTranslations().runtime.potionRequiresEmptyFlask,
                ts: now,
            },
        };
    }

    if (result.kind === 'success') {
        return {
            championVitals,
            championEquipment: {
                ...currentChampionEquipment,
                [championId]: { ...currentEquipment, [result.slot]: result.potion },
            },
        };
    }

    return { championVitals };
}
