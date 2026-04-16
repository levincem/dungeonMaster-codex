import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionVitals,
    DamageEvent,
    FootprintEntry,
    PartyShield,
    Projectile,
    SpellLight,
    SpellVisualEvent,
} from '../runtimeTypes';

type TickSpellsFinalizeState = {
    spellLights: SpellLight[];
    projectiles: Projectile[];
    creatures: CreatureInstance[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    floorItems: FloorItem[];
    openDoors: Set<string>;
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    activePoisonClouds: ActivePoisonCloud[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    footprintHistory: FootprintEntry[];
    lastCreatureAttackGameTick: number;
};

type TickSpellsFinalizeAccumulators = {
    keepProjectiles: Projectile[];
    creatures: CreatureInstance[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    floorItems: FloorItem[];
    openDoors: Set<string>;
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    activePoisonClouds: ActivePoisonCloud[];
    lastCreatureAttackGameTick: number;
};

type TickSpellsFinalizeDeps = {
    footprintLifetimeMs: number;
    damageEventLifetimeMs: number;
};

export function buildTickSpellsPatch(
    state: TickSpellsFinalizeState,
    accumulators: TickSpellsFinalizeAccumulators,
    now: number,
    deps: TickSpellsFinalizeDeps,
): Partial<TickSpellsFinalizeState> | null {
    const spellLights = state.spellLights.filter((light) => light.expiresAt > now);
    const activeShields = state.activeShields.filter((shield) => shield.expiresAt > now);
    const activePotionBoosts = state.activePotionBoosts.filter((boost) => boost.expiresAt > now);
    const footprintHistory = state.footprintHistory.filter((entry) => now - entry.ts < deps.footprintLifetimeMs);
    const nextSpellVisualEvents = accumulators.spellVisualEvents.filter(
        (event) => now - event.ts < deps.damageEventLifetimeMs,
    );

    const lightsChanged = spellLights.length !== state.spellLights.length;
    const projectilesChanged = accumulators.keepProjectiles.length !== state.projectiles.length ||
        accumulators.keepProjectiles.some((projectile, index) => projectile !== state.projectiles[index]);
    const creaturesChanged = accumulators.creatures !== state.creatures;
    const damageChanged = accumulators.damageEvents !== state.damageEvents;
    const spellVisualsChanged = nextSpellVisualEvents.length !== state.spellVisualEvents.length ||
        nextSpellVisualEvents.some((event, index) => event !== state.spellVisualEvents[index]);
    const floorItemsChanged = accumulators.floorItems !== state.floorItems;
    const openDoorsChanged = accumulators.openDoors !== state.openDoors;
    const partyChanged = accumulators.party !== state.party;
    const championVitalsChanged = accumulators.championVitals !== state.championVitals;
    const championInventoriesChanged = accumulators.championInventories !== state.championInventories;
    const championEquipmentChanged = accumulators.championEquipment !== state.championEquipment;
    const deadChampionsChanged = accumulators.deadChampions !== state.deadChampions;
    const selectedChampionIndexChanged = accumulators.selectedChampionIndex !== state.selectedChampionIndex;
    const poisonCloudsChanged = accumulators.activePoisonClouds.length !== state.activePoisonClouds.length ||
        accumulators.activePoisonClouds.some((cloud, index) => cloud !== state.activePoisonClouds[index]);
    const shieldsChanged = activeShields.length !== state.activeShields.length;
    const potionBoostsChanged = activePotionBoosts.length !== state.activePotionBoosts.length;
    const footprintsChanged = footprintHistory.length !== state.footprintHistory.length;
    const lastCreatureAttackChanged = accumulators.lastCreatureAttackGameTick !== state.lastCreatureAttackGameTick;

    if (
        !lightsChanged &&
        !projectilesChanged &&
        !creaturesChanged &&
        !damageChanged &&
        !spellVisualsChanged &&
        !floorItemsChanged &&
        !openDoorsChanged &&
        !partyChanged &&
        !championVitalsChanged &&
        !championInventoriesChanged &&
        !championEquipmentChanged &&
        !deadChampionsChanged &&
        !selectedChampionIndexChanged &&
        !poisonCloudsChanged &&
        !shieldsChanged &&
        !potionBoostsChanged &&
        !footprintsChanged &&
        !lastCreatureAttackChanged
    ) {
        return null;
    }

    return {
        ...(lightsChanged ? { spellLights } : {}),
        ...(projectilesChanged ? { projectiles: accumulators.keepProjectiles } : {}),
        ...(partyChanged ? { party: accumulators.party } : {}),
        ...(championVitalsChanged ? { championVitals: accumulators.championVitals } : {}),
        ...(championInventoriesChanged ? { championInventories: accumulators.championInventories } : {}),
        ...(championEquipmentChanged ? { championEquipment: accumulators.championEquipment } : {}),
        ...(creaturesChanged ? { creatures: accumulators.creatures } : {}),
        ...(damageChanged ? { damageEvents: accumulators.damageEvents } : {}),
        ...(spellVisualsChanged ? { spellVisualEvents: nextSpellVisualEvents } : {}),
        ...(floorItemsChanged ? { floorItems: accumulators.floorItems } : {}),
        ...(openDoorsChanged ? { openDoors: accumulators.openDoors } : {}),
        ...(deadChampionsChanged ? { deadChampions: accumulators.deadChampions } : {}),
        ...(selectedChampionIndexChanged ? { selectedChampionIndex: accumulators.selectedChampionIndex } : {}),
        ...(poisonCloudsChanged ? { activePoisonClouds: accumulators.activePoisonClouds } : {}),
        ...(shieldsChanged ? { activeShields } : {}),
        ...(potionBoostsChanged ? { activePotionBoosts } : {}),
        ...(footprintsChanged ? { footprintHistory } : {}),
        ...(lastCreatureAttackChanged ? { lastCreatureAttackGameTick: accumulators.lastCreatureAttackGameTick } : {}),
    };
}
