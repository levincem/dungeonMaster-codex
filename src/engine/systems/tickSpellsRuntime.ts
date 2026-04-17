import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    FootprintEntry,
    PartyShield,
    Projectile,
    SpellLight,
    SpellVisualEvent,
} from '../runtimeTypes';
import { runSpellProjectileTickRuntime } from './spellProjectileTickRuntime';
import { buildTickSpellsPatch } from './tickSpellsFinalize';

export type TickSpellsRuntimeState = {
    optionsModalOpen: boolean;
    elapsedGameTimeTicks: number;
    spellLights: SpellLight[];
    projectiles: Projectile[];
    creatures: CreatureInstance[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    floorItems: FloorItem[];
    openDoors: Set<string>;
    party: Champion[];
    level: number;
    position: [number, number];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    activePoisonClouds: ActivePoisonCloud[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat: Record<number, ChampionCombat>;
    openWalls: Set<string>;
    openTeleporters: Set<string>;
    footprintHistory: FootprintEntry[];
    lastCreatureAttackGameTick: number;
};

export type TickSpellsProjectileDeps = Parameters<typeof runSpellProjectileTickRuntime>[1];

export type TickSpellsRuntimeDeps = {
    buildProjectileTickDeps: (
        state: TickSpellsRuntimeState,
        currentGameTick: number,
        now: number,
    ) => TickSpellsProjectileDeps;
    footprintLifetimeMs: number;
    damageEventLifetimeMs: number;
};

export function buildTickSpellsRuntimePatch(
    state: TickSpellsRuntimeState,
    now: number,
    deps: TickSpellsRuntimeDeps,
): Partial<TickSpellsRuntimeState> | TickSpellsRuntimeState {
    if (state.optionsModalOpen) return state;

    const currentGameTick = state.elapsedGameTimeTicks;
    const projectileTick = runSpellProjectileTickRuntime(
        {
            projectiles: state.projectiles,
            creatures: state.creatures,
            damageEvents: state.damageEvents,
            spellVisualEvents: state.spellVisualEvents,
            floorItems: state.floorItems,
            openDoors: state.openDoors,
            party: state.party,
            level: state.level,
            position: state.position,
            championVitals: state.championVitals,
            championInventories: state.championInventories,
            championEquipment: state.championEquipment,
            deadChampions: state.deadChampions,
            selectedChampionIndex: state.selectedChampionIndex,
            activePoisonClouds: state.activePoisonClouds,
            activeShields: state.activeShields,
            activePotionBoosts: state.activePotionBoosts,
            championCombat: state.championCombat,
            openWalls: state.openWalls,
            lastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
        },
        deps.buildProjectileTickDeps(state, currentGameTick, now),
    );

    return buildTickSpellsPatch(
        {
            spellLights: state.spellLights,
            projectiles: state.projectiles,
            creatures: state.creatures,
            damageEvents: state.damageEvents,
            spellVisualEvents: state.spellVisualEvents,
            floorItems: state.floorItems,
            openDoors: state.openDoors,
            party: state.party,
            championVitals: state.championVitals,
            championInventories: state.championInventories,
            championEquipment: state.championEquipment,
            deadChampions: state.deadChampions,
            selectedChampionIndex: state.selectedChampionIndex,
            activePoisonClouds: state.activePoisonClouds,
            activeShields: state.activeShields,
            activePotionBoosts: state.activePotionBoosts,
            footprintHistory: state.footprintHistory,
            lastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
        },
        projectileTick,
        now,
        {
            footprintLifetimeMs: deps.footprintLifetimeMs,
            damageEventLifetimeMs: deps.damageEventLifetimeMs,
        },
    ) ?? state;
}
