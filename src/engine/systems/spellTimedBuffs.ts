import type { SpellDef } from '../../data/runes';
import {
    getSpellDurationMs,
    getSpellLightContribution,
    getSpellShieldProfile,
} from '../../data/spellRuntime';
import type { ChampionVitals, PartyShield, SpellLight } from '../runtimeTypes';

export type SpellTimedBuffAction = 'light' | 'darkness' | 'shield' | 'fire_shield';

type SpellTimedBuffDeps = {
    buildIdSuffix?: () => string;
};

export type SpellTimedBuffResult = {
    spellLight?: SpellLight;
    shield?: PartyShield;
};

export type SpellTimedBuffPatch = {
    championVitals: Record<number, ChampionVitals>;
    spellLights?: SpellLight[];
    activeShields?: PartyShield[];
};

function buildId(prefix: string, now: number, deps: SpellTimedBuffDeps): string {
    return `${prefix}_${now}_${deps.buildIdSuffix?.() ?? Math.random().toString(36).slice(2)}`;
}

export function resolveSpellTimedBuff(
    action: SpellTimedBuffAction,
    now: number,
    deps: SpellTimedBuffDeps,
    spell: SpellDef,
): SpellTimedBuffResult | null {
    switch (action) {
        case 'light':
        case 'darkness': {
            const durationMs = getSpellDurationMs(spell);
            if (!durationMs) return null;
            return {
                spellLight: {
                    id: buildId(action, now, deps),
                    lightContrib: getSpellLightContribution(spell),
                    expiresAt: now + durationMs,
                },
            };
        }
        case 'shield':
        case 'fire_shield': {
            const shieldProfile = getSpellShieldProfile(spell);
            if (!shieldProfile) return null;
            return {
                shield: {
                    id: buildId('shield', now, deps),
                    expiresAt: now + shieldProfile.durationMs,
                    defense: shieldProfile.defense,
                    kind: action === 'fire_shield' ? 'fire' : 'physical',
                },
            };
        }
    }
}

type BuildSpellTimedBuffPatchArgs = {
    championId: number;
    nextVitals: ChampionVitals;
    currentChampionVitals: Record<number, ChampionVitals>;
    currentSpellLights: SpellLight[];
    currentActiveShields: PartyShield[];
    buff: SpellTimedBuffResult | null;
};

export function buildSpellTimedBuffPatch({
    championId,
    nextVitals,
    currentChampionVitals,
    currentSpellLights,
    currentActiveShields,
    buff,
}: BuildSpellTimedBuffPatchArgs): SpellTimedBuffPatch {
    const championVitals = {
        ...currentChampionVitals,
        [championId]: nextVitals,
    };

    if (buff?.spellLight) {
        return {
            championVitals,
            spellLights: [...currentSpellLights, buff.spellLight],
        };
    }

    if (buff?.shield) {
        return {
            championVitals,
            activeShields: [...currentActiveShields, buff.shield],
        };
    }

    return { championVitals };
}
