import originalActionsRuntime from '../assets/runtime/reference/original_actions_runtime.json';

export type OriginalInfluenceBonusAction =
    | 'War Cry'
    | 'Calm'
    | 'Brandish'
    | 'Blow Horn'
    | 'Confuse';

type OriginalActionsRuntime = {
    _meta?: {
        baselineVersion?: string;
    };
    specialRules?: {
        influenceBonusExperience?: {
            WarCry?: number;
            Calm?: number;
            Brandish?: number;
            BlowHorn?: number;
            Confuse?: number;
        };
    };
};

const ORIGINAL_ACTIONS = originalActionsRuntime as OriginalActionsRuntime;

const INFLUENCE_BONUS_BY_ACTION: Record<OriginalInfluenceBonusAction, number> = {
    'War Cry': ORIGINAL_ACTIONS.specialRules?.influenceBonusExperience?.WarCry ?? 0,
    Calm: ORIGINAL_ACTIONS.specialRules?.influenceBonusExperience?.Calm ?? 0,
    Brandish: ORIGINAL_ACTIONS.specialRules?.influenceBonusExperience?.Brandish ?? 0,
    'Blow Horn': ORIGINAL_ACTIONS.specialRules?.influenceBonusExperience?.BlowHorn ?? 0,
    Confuse: ORIGINAL_ACTIONS.specialRules?.influenceBonusExperience?.Confuse ?? 0,
};

export const ORIGINAL_ACTIONS_BASELINE_VERSION =
    ORIGINAL_ACTIONS._meta?.baselineVersion ?? 'Dungeon Master 1.2 / Amiga 2.0 compatible values unless variants are attached.';

export function isOriginalInfluenceBonusAction(value: string): value is OriginalInfluenceBonusAction {
    return value in INFLUENCE_BONUS_BY_ACTION;
}

export function getOriginalInfluenceBonusExperience(action: OriginalInfluenceBonusAction): number {
    return INFLUENCE_BONUS_BY_ACTION[action] ?? 0;
}
