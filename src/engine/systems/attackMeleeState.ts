import type { SkillKey } from '../../data/skillProgression';
import type { WeaponAttackOption } from '../../data/weaponAttacks';
import type { Champion } from '../../types/champion';
import type {
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    Direction,
    SpellVisualEvent,
} from '../runtimeTypes';
import type {
    ChampionEquipment,
    CreatureInstance,
    FloorItem,
} from '../../types/game';
import type {
    ChampionTemporaryXP,
    ChampionXP,
} from '../../data/skillProgression';
import type { ActivePotionBoost } from '../runtimeTypes';

type BreakDoorResult = {
    openDoors: Set<string>;
    brokenDoors: Set<string>;
    message: { success: boolean; message: string; ts: number };
} | null;

type MeleeAttackState = {
    championId: number;
    championCombat: Record<number, ChampionCombat>;
    championVitals: Record<number, ChampionVitals>;
    level: number;
    position: [number, number];
    direction: Direction;
    openDoors: Set<string>;
    brokenDoors: Set<string>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    party: Champion[];
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    elapsedGameTimeTicks: number;
    lastCreatureAttackGameTick: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
};

type MeleeResolutionPatch = {
    creatures: CreatureInstance[];
    floorItems?: FloorItem[];
    championVitals: Record<number, ChampionVitals>;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    party?: Champion[];
    championCombat: Record<number, ChampionCombat>;
    damageEvents: DamageEvent[];
    spellVisualEvents?: SpellVisualEvent[];
};

type MeleeActionXpPatch = {
    championVitals?: Record<number, ChampionVitals>;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    party?: Champion[];
};

type AttackMeleeStateDeps = {
    tryBreakFrontDoor: (
        state: Pick<MeleeAttackState, 'level' | 'position' | 'direction' | 'openDoors' | 'brokenDoors' | 'championVitals'>,
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
        selectedAttack: WeaponAttackOption | null,
    ) => BreakDoorResult;
    determineMeleeDamage: (
        target: CreatureInstance,
    ) => number;
    getAttackSkill: (attackOption: WeaponAttackOption | null, fallbackSkill: SkillKey) => SkillKey;
    applyMeleeActionOutcomeVitals: (
        championVitals: Record<number, ChampionVitals>,
        championId: number,
        hit: boolean,
    ) => Record<number, ChampionVitals>;
    buildMeleeActionExperiencePatch: (
        state: Pick<
            MeleeAttackState,
            'level' | 'party' | 'championVitals' | 'championXP' | 'championTemporaryXP' | 'elapsedGameTimeTicks' | 'lastCreatureAttackGameTick'
        >,
        championId: number,
        skill: SkillKey,
        amount: number,
    ) => MeleeActionXpPatch | null;
    buildMeleeAttackResolution: (
        resolutionState: MeleeAttackState,
        attackSkill: SkillKey,
        target: CreatureInstance,
        totalDmg: number,
    ) => MeleeResolutionPatch;
};

export function buildAttackMeleeStatePatch(
    state: MeleeAttackState,
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    selectedAttack: WeaponAttackOption | null,
    target: CreatureInstance | null,
    newCombat: ChampionCombat,
    fallbackSkill: SkillKey,
    deps: AttackMeleeStateDeps,
) {
    const applyActionExperience = <TPatch extends {
        championVitals: Record<number, ChampionVitals>;
        championXP?: Record<number, ChampionXP>;
        championTemporaryXP?: Record<number, ChampionTemporaryXP>;
        party?: Champion[];
    }>(
        patch: TPatch,
        carrierState: MeleeAttackState,
        attackSkill: SkillKey,
        amount: number,
    ): TPatch & {
        championXP?: Record<number, ChampionXP>;
        championTemporaryXP?: Record<number, ChampionTemporaryXP>;
        party?: Champion[];
    } => {
        if (amount <= 0) return patch;

        const xpPatch = deps.buildMeleeActionExperiencePatch(
            {
                level: carrierState.level,
                party: patch.party ?? carrierState.party,
                championVitals: patch.championVitals,
                championXP: patch.championXP ?? carrierState.championXP,
                championTemporaryXP: patch.championTemporaryXP ?? carrierState.championTemporaryXP,
                elapsedGameTimeTicks: carrierState.elapsedGameTimeTicks,
                lastCreatureAttackGameTick: carrierState.lastCreatureAttackGameTick,
            },
            state.championId,
            attackSkill,
            amount,
        );
        if (!xpPatch) return patch;

        return {
            ...patch,
            championVitals: xpPatch.championVitals ?? patch.championVitals,
            championXP: xpPatch.championXP,
            championTemporaryXP: xpPatch.championTemporaryXP,
            ...(xpPatch.party ? { party: xpPatch.party } : {}),
        };
    };

    const basePatch = {
        championCombat: { ...state.championCombat, [state.championId]: newCombat },
        championVitals: state.championVitals,
    };

    if (!target) {
        const brokenDoor = deps.tryBreakFrontDoor(
            state,
            champion,
            equip,
            activePotionBoosts,
            selectedAttack,
        );
        return {
            ...basePatch,
            ...(brokenDoor
                ? {
                    openDoors: brokenDoor.openDoors,
                    brokenDoors: brokenDoor.brokenDoors,
                    lastCastResult: brokenDoor.message,
                }
                : {}),
        };
    }

    const totalDmg = deps.determineMeleeDamage(target);
    const attackSkill = deps.getAttackSkill(selectedAttack, fallbackSkill);
    const actionExperience = selectedAttack?.attack.experienceForAttacking ?? 0;

    if (totalDmg <= 0) {
        const missVitals = deps.applyMeleeActionOutcomeVitals(
            state.championVitals,
            state.championId,
            false,
        );
        const missState = {
            ...state,
            championVitals: missVitals,
        };
        return applyActionExperience(
            {
                ...basePatch,
                championVitals: missVitals,
            },
            missState,
            attackSkill,
            Math.floor(actionExperience / 2),
        );
    }

    const hitVitals = deps.applyMeleeActionOutcomeVitals(
        state.championVitals,
        state.championId,
        true,
    );
    const hitState = {
        ...state,
        championVitals: hitVitals,
    };
    const resolution = deps.buildMeleeAttackResolution(
        hitState,
        attackSkill,
        target,
        totalDmg,
    );

    return applyActionExperience(
        {
            ...resolution,
            championCombat: { ...state.championCombat, ...resolution.championCombat },
        },
        hitState,
        attackSkill,
        actionExperience,
    );
}
