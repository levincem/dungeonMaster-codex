import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type { ChampionVitals, Projectile } from '../runtimeTypes';

type DeadChampionsState = Record<number, unknown>;

type TickMonstersFinalizeState = {
    creatures: CreatureInstance[];
    baseCreatures: CreatureInstance[];
    projectiles: Projectile[];
    baseProjectiles: Projectile[];
    championVitals: Record<number, ChampionVitals>;
    baseChampionVitals: Record<number, ChampionVitals>;
    damageEvents: unknown[];
    baseDamageEvents: unknown[];
    championInventories: Record<number, FloorItem[]>;
    baseChampionInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    baseChampionEquipment: Record<number, ChampionEquipment>;
    lastCreatureAttackGameTick: number;
    baseLastCreatureAttackGameTick: number;
    party: Champion[];
    baseParty: Champion[];
    selectedChampionIndex: number;
    floorItems: FloorItem[];
    deadChampions: DeadChampionsState;
};

export function buildTickMonstersPatch(
    state: TickMonstersFinalizeState,
): Record<string, unknown> | null {
    const creaturesChanged = state.creatures !== state.baseCreatures;
    const projectilesChanged = state.projectiles !== state.baseProjectiles;
    const championVitalsChanged = state.championVitals !== state.baseChampionVitals;
    const damageEventsChanged = state.damageEvents !== state.baseDamageEvents;
    const championInventoriesChanged = state.championInventories !== state.baseChampionInventories;
    const championEquipmentChanged = state.championEquipment !== state.baseChampionEquipment;
    const lastCreatureAttackChanged = state.lastCreatureAttackGameTick !== state.baseLastCreatureAttackGameTick;
    const partyChanged = state.party !== state.baseParty;
    const anyChange =
        creaturesChanged ||
        projectilesChanged ||
        championVitalsChanged ||
        damageEventsChanged ||
        championInventoriesChanged ||
        championEquipmentChanged ||
        lastCreatureAttackChanged ||
        partyChanged;

    if (!anyChange) return null;

    const nextSelectedChampionIndex = state.party.length > 0
        ? Math.min(state.selectedChampionIndex, state.party.length - 1)
        : 0;

    return {
        ...(creaturesChanged ? { creatures: state.creatures } : {}),
        ...(projectilesChanged ? { projectiles: state.projectiles } : {}),
        ...(championVitalsChanged ? { championVitals: state.championVitals } : {}),
        ...(damageEventsChanged ? { damageEvents: state.damageEvents } : {}),
        ...(championInventoriesChanged ? { championInventories: state.championInventories } : {}),
        ...(championEquipmentChanged ? { championEquipment: state.championEquipment } : {}),
        ...(lastCreatureAttackChanged
            ? { lastCreatureAttackGameTick: state.lastCreatureAttackGameTick }
            : {}),
        ...(partyChanged
            ? {
                party: state.party,
                selectedChampionIndex: nextSelectedChampionIndex,
                floorItems: state.floorItems,
                deadChampions: state.deadChampions,
            }
            : {}),
    };
}
