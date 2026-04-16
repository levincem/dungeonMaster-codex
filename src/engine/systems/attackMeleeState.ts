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
    buildMeleeAttackResolution: (
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
    if (totalDmg <= 0) {
        return basePatch;
    }

    const attackSkill = deps.getAttackSkill(selectedAttack, fallbackSkill);
    const resolution = deps.buildMeleeAttackResolution(
        attackSkill,
        target,
        totalDmg,
    );

    return {
        ...resolution,
        championCombat: { ...state.championCombat, ...resolution.championCombat },
    };
}
