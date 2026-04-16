import type { Champion } from '../../types/champion';
import type { CreatureInstance, FloorItem } from '../../types/game';
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
    getCreatureKillXp: (typeId: number) => number;
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
};

export function buildMeleeAttackResolutionPatch(
    state: MeleeAttackState,
    championId: number,
    target: CreatureInstance,
    totalDmg: number,
    attackSkill: SkillKey,
    newCombat: ChampionCombat,
    championVitals: Record<number, ChampionVitals>,
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
        newCreatures = dropped.creatures;
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
    let xpParty = state.party;

    const attackerXpPatch = deps.applyChampionSkillExperience(
        xpCarrier,
        championId,
        attackSkill,
        totalDmg,
    );
    if (attackerXpPatch) {
        newChampXP = attackerXpPatch.championXP;
        newChampionTemporaryXP = attackerXpPatch.championTemporaryXP;
        xpParty = attackerXpPatch.party ?? xpParty;
        xpCarrier = {
            ...xpCarrier,
            championXP: newChampXP,
            championTemporaryXP: newChampionTemporaryXP,
            party: xpParty,
        };
    }

    if (killed) {
        const killXP = deps.getCreatureKillXp(target.typeId);
        const living = xpParty.filter((champion) => (state.championVitals[champion.id]?.hp ?? 0) > 0);
        const share = living.length > 0 ? Math.floor(killXP / living.length) : 0;
        if (share > 0) {
            for (const champion of living) {
                const killXpPatch = deps.applyChampionSkillExperience(
                    xpCarrier,
                    champion.id,
                    'fighter',
                    share,
                );
                if (!killXpPatch) continue;
                newChampXP = killXpPatch.championXP;
                newChampionTemporaryXP = killXpPatch.championTemporaryXP;
                xpParty = killXpPatch.party ?? xpParty;
                xpCarrier = {
                    ...xpCarrier,
                    championXP: newChampXP,
                    championTemporaryXP: newChampionTemporaryXP,
                    party: xpParty,
                };
            }
        }
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
        championVitals,
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
