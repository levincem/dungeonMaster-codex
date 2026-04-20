import { getOriginalSpellCastXpRange } from '../../data/originalSpells';
import { getTranslations } from '../../i18n';
import type { SpellDef } from '../../data/runes';
import type { ChampionCombat, ChampionVitals } from '../runtimeTypes';
import type { SkillKey } from '../../data/skillProgression';

const runtimeText = getTranslations().runtime;

type CastCheck = {
    success: boolean;
    requiredSkillLevel: number;
    missingSkillLevels: number;
    successChance: number;
};

type SpellCastPreparationArgs = {
    championId: number;
    spell: SpellDef;
    vitals: ChampionVitals;
    currentChampionCombat: Record<number, ChampionCombat>;
    now: number;
};

type SpellCastPreparationDeps<TXpPatch extends object> = {
    getSkillLevel: (skill: SkillKey) => number;
    rollCastCheck: (skillLevel: number) => CastCheck;
    applySkillXp: (skill: SkillKey, amount: number) => TXpPatch | null;
    originalTimerTicksToSeconds: (ticks: number) => number;
    createChampionCombatState: (cooldownSeconds: number, defenseModifier?: number) => ChampionCombat;
    randomInt: (maxExclusive: number) => number;
};

export type SpellCastBlockedPatch = {
    lastCastResult: {
        success: false;
        message: string;
        ts: number;
    };
};

export type SpellCastPreparationReady<TXpPatch extends object> = {
    kind: 'ready';
    spellSkill: SkillKey;
    skillLevel: number;
    castCheck: CastCheck;
    castSucceeded: boolean;
    nextVitals: ChampionVitals;
    basePatch: TXpPatch & {
        championCombat: Record<number, ChampionCombat>;
        lastCastResult: {
            success: boolean;
            message: string;
            ts: number;
        };
    };
};

export type SpellCastPreparationResult<TXpPatch extends object> =
    | { kind: 'blocked'; patch: SpellCastBlockedPatch }
    | SpellCastPreparationReady<TXpPatch>;

export function prepareSpellCast<TXpPatch extends object>(
    {
        championId,
        spell,
        vitals,
        currentChampionCombat,
        now,
    }: SpellCastPreparationArgs,
    deps: SpellCastPreparationDeps<TXpPatch>,
): SpellCastPreparationResult<TXpPatch> {
    const combat = currentChampionCombat[championId];
    if (combat && combat.cooldown > 0) {
        return {
            kind: 'blocked',
            patch: {
                lastCastResult: {
                    success: false,
                    message: runtimeText.championRecovering,
                    ts: now,
                },
            },
        };
    }

    if (vitals.mana < spell.manaCost) {
        return {
            kind: 'blocked',
            patch: {
                lastCastResult: {
                    success: false,
                    message: runtimeText.insufficientMana(spell.name, spell.manaCost),
                    ts: now,
                },
            },
        };
    }

    const spellSkill = spell.progressionSkill ?? spell.castSkill;
    const skillLevel = deps.getSkillLevel(spellSkill);
    const castCheck = deps.rollCastCheck(skillLevel);
    const castSucceeded = castCheck.success;

    const spellXpRange = getOriginalSpellCastXpRange(spell.runes);
    const spellXPGain = spellXpRange
        ? spellXpRange.min + deps.randomInt((spellXpRange.max - spellXpRange.min) + 1)
        : spell.manaBase * 15;
    const awardedSpellXP = castSucceeded
        ? spellXPGain
        : spellXpRange
            ? spellXPGain >> castCheck.missingSkillLevels
            : spellXPGain;
    const spellXpPatch = deps.applySkillXp(spellSkill, awardedSpellXP);
    const xpPatch = (spellXpPatch ?? {}) as TXpPatch;

    const lowSkill = castCheck.missingSkillLevels > 0;
    const message = !castSucceeded
        ? runtimeText.spellFailed(spell.name)
        : lowSkill
            ? runtimeText.spellCastWithDifficulty(
                spell.name,
                runtimeText.skillNames[spell.castSkill],
                skillLevel,
                castCheck.requiredSkillLevel,
            )
            : runtimeText.spellSuccess(spell.name, spell.description);

    const nextVitals = {
        ...vitals,
        mana: Math.max(0, vitals.mana - spell.manaCost),
    };
    const spellCooldownSeconds = deps.originalTimerTicksToSeconds(spell.sourceDisableTimeTicks ?? 0);
    const newCombat = deps.createChampionCombatState(spellCooldownSeconds, 0);

    return {
        kind: 'ready',
        spellSkill,
        skillLevel,
        castCheck,
        castSucceeded,
        nextVitals,
        basePatch: {
            ...xpPatch,
            championCombat: { ...currentChampionCombat, [championId]: newCombat },
            lastCastResult: {
                success: castSucceeded,
                message: `${message} (${Math.round(castCheck.successChance * 100)}%)`,
                ts: now,
            },
        },
    };
}
