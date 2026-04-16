import {
    type WeaponAttackOption,
} from '../../data/weaponAttacks';
import { mapOriginalSkillNumberToSkillKey, type SkillKey } from '../../data/skillProgression';

type ResolveAttackSelectionArgs = {
    attackType?: number;
    availableAttacks: WeaponAttackOption[];
};

type ResolveAttackSelectionDeps = {
    getMasteryLevel: (skill: SkillKey) => number;
    hasCompatibleAmmo: () => boolean;
    isAttackUsableAtMastery: (option: WeaponAttackOption, masteryLevel: number) => boolean;
    getAttackUnusableReason: (option: WeaponAttackOption, masteryLevel: number) => string | null;
    isShootAttack: (option: WeaponAttackOption | null) => boolean;
};

export type ResolvedAttackSelection = {
    availableAttacks: WeaponAttackOption[];
    selectedAttack: WeaponAttackOption | null;
    selectedSkill: SkillKey;
    blockedMessage?: string;
};

export function resolveAttackSelection(
    { attackType, availableAttacks }: ResolveAttackSelectionArgs,
    deps: ResolveAttackSelectionDeps,
): ResolvedAttackSelection {
    const requestedAttack = availableAttacks.find((option) => option.attackType === attackType) ?? null;
    const usableAttacks = availableAttacks.filter((option) => {
        const skill = mapOriginalSkillNumberToSkillKey(option.attack.skillNumber);
        const masteryLevel = deps.getMasteryLevel(skill);
        return deps.isAttackUsableAtMastery(option, masteryLevel);
    });
    const selectedAttack = attackType !== undefined
        ? requestedAttack
        : (usableAttacks[0] ?? availableAttacks[0] ?? null);
    const selectedSkill = selectedAttack
        ? mapOriginalSkillNumberToSkillKey(selectedAttack.attack.skillNumber)
        : 'fighter';

    if (selectedAttack) {
        const masteryLevel = deps.getMasteryLevel(selectedSkill);
        const unusableReason = deps.getAttackUnusableReason(selectedAttack, masteryLevel);
        if (unusableReason) {
            return {
                availableAttacks,
                selectedAttack,
                selectedSkill,
                blockedMessage: `${selectedAttack.displayName} indisponible: ${unusableReason}.`,
            };
        }
        if (deps.isShootAttack(selectedAttack) && !deps.hasCompatibleAmmo()) {
            return {
                availableAttacks,
                selectedAttack,
                selectedSkill,
                blockedMessage: 'Aucune munition compatible dans le carquois.',
            };
        }
    }

    return {
        availableAttacks,
        selectedAttack,
        selectedSkill,
    };
}
