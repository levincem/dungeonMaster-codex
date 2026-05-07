import { CREATURE_TYPES } from '../../data/creatures';
import type { Champion } from '../../types/champion';
import type { CreatureInstance, FloorItem } from '../../types/game';
import { getOriginalMeleeExperienceAmount } from './originalCombatExperience';
import type {
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    SpellVisualEvent,
} from '../runtimeTypes';
import type {
    ChampionTemporaryXP,
    ChampionXP,
    SkillKey,
} from '../../data/skillProgression';

type MeleeAttackState = {
    level: number;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    elapsedGameTimeTicks: number;
    lastCreatureAttackGameTick: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
};

type XpCarrier = Pick<
    MeleeAttackState,
    'level' | 'party' | 'championVitals' | 'championXP' | 'championTemporaryXP' | 'elapsedGameTimeTicks' | 'lastCreatureAttackGameTick'
>;

type AttackXpPatch = {
    championVitals?: Record<number, ChampionVitals>;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    party?: Champion[];
};

type MeleeAttackResolutionDeps = {
    applyChampionSkillExperience: (
        state: XpCarrier,
        championId: number,
        skill: SkillKey,
        amount: number,
    ) => AttackXpPatch | null;
    dropCreatureCarriedItems: (
        creatures: CreatureInstance[],
        floorItems: FloorItem[],
        creatureId: string,
    ) => { creatures: CreatureInstance[]; floorItems: FloorItem[] };
    buildCreatureDamageEvent: (
        level: number,
        x: number,
        y: number,
        amount: number,
        creatureId?: string,
    ) => DamageEvent;
    buildDeathDustEvent: (level: number, x: number, y: number) => SpellVisualEvent;
    normalizeCreatureCellsOnTile: (
        creatures: CreatureInstance[],
        level: number,
        x: number,
        y: number,
    ) => CreatureInstance[];
};

export function buildMeleeAttackResolutionPatch(
    state: MeleeAttackState,
    championId: number,
    target: CreatureInstance,
    totalDmg: number,
    attackSkill: SkillKey,
    newCombat: ChampionCombat,
    deps: MeleeAttackResolutionDeps,
) {
    const newHP = target.currentHP - totalDmg;
    const killed = newHP <= 0;
    let newCreatures = state.creatures.map((creature) =>
        creature.id === target.id
            ? { ...creature, currentHP: Math.max(0, newHP), alive: !killed }
            : creature,
    );
    let newFloorItems = state.floorItems;
    if (killed) {
        const dropped = deps.dropCreatureCarriedItems(newCreatures, newFloorItems, target.id);
        newCreatures = deps.normalizeCreatureCellsOnTile(
            dropped.creatures,
            target.mapIndex,
            target.x,
            target.y,
        );
        newFloorItems = dropped.floorItems;
    }

    let xpCarrier: XpCarrier = {
        level: state.level,
        party: state.party,
        championVitals: state.championVitals,
        championXP: state.championXP,
        championTemporaryXP: state.championTemporaryXP,
        elapsedGameTimeTicks: state.elapsedGameTimeTicks,
        lastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
    };
    let newChampXP = state.championXP;
    let newChampionTemporaryXP = state.championTemporaryXP;
    let newChampionVitals = state.championVitals;
    let xpParty = state.party;
    const attackExperience = getOriginalMeleeExperienceAmount(
        totalDmg,
        CREATURE_TYPES[target.typeId]?.experienceClass,
    );

    const attackerXpPatch = deps.applyChampionSkillExperience(
        xpCarrier,
        championId,
        attackSkill,
        attackExperience,
    );
    if (attackerXpPatch) {
        newChampionVitals = attackerXpPatch.championVitals ?? newChampionVitals;
        newChampXP = attackerXpPatch.championXP;
        newChampionTemporaryXP = attackerXpPatch.championTemporaryXP;
        xpParty = attackerXpPatch.party ?? xpParty;
        xpCarrier = {
            ...xpCarrier,
            championVitals: newChampionVitals,
            championXP: newChampXP,
            championTemporaryXP: newChampionTemporaryXP,
            party: xpParty,
        };
    }

    const damageEvent = deps.buildCreatureDamageEvent(
        state.level,
        target.x,
        target.y,
        totalDmg,
        target.id,
    );

    return {
        creatures: newCreatures,
        ...(newFloorItems !== state.floorItems ? { floorItems: newFloorItems } : {}),
        championVitals: newChampionVitals,
        championXP: newChampXP,
        championTemporaryXP: newChampionTemporaryXP,
        ...(xpParty !== state.party ? { party: xpParty } : {}),
        championCombat: { [championId]: newCombat },
        damageEvents: [...state.damageEvents, damageEvent],
        ...(killed
            ? {
                spellVisualEvents: [
                    ...state.spellVisualEvents,
                    deps.buildDeathDustEvent(state.level, target.x, target.y),
                ],
            }
            : {}),
    };
}
