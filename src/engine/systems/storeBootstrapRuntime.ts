import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type { GameOptions } from '../runtimeTypes';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    Projectile,
    SpellLight,
    SpellVisualEvent,
} from '../runtimeTypes';
import { createInitialGameStats, type GameStats } from './gameStats';

export type StoreBootstrapDirection = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
export type StoreBootstrapGamePhase =
    | 'title'
    | 'exploration'
    | 'mirror_open'
    | 'endgame'
    | 'victory'
    | 'game_over';

export type StoreBootstrapFootprintEntry = {
    x: number;
    y: number;
    level: number;
    ts: number;
};

export type StoreBootstrapState = {
    level: number;
    position: [number, number];
    direction: StoreBootstrapDirection;
    party: Champion[];
    gameOptions: GameOptions;
    selectedChampionIndex: number;
    gamePhase: StoreBootstrapGamePhase;
    optionsModalOpen: boolean;
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    gateOpen: boolean;
    hydratedLevels: Set<number>;
    openDoors: Set<string>;
    brokenDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    pendingSensorEvents: never[];
    pendingGeneratorSpawns: never[];
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    championManaRegenBlockedUntilTick: Record<number, number>;
    elapsedGameTimeTicks: number;
    regenTickRemainder: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
    lastPartyMoveGameTick: number;
    movementCooldown: number;
    sleeping: boolean;
    paused: boolean;
    pausedAt?: number | null;
    lastMonsterAttackDebug: null;
    endgameSequence: null;
    lastCastResult: null;
    championXP: Record<number, never>;
    championTemporaryXP: Record<number, never>;
    gameStats: GameStats;
    championCombat: Record<number, never>;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    torchBurnStart: Record<string, number>;
    spellLights: SpellLight[];
    projectiles: Projectile[];
    activePoisonClouds: ActivePoisonCloud[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    invisibleUntil: number;
    magicVisionUntil: number;
    seeThroughWallsUntil: number;
    footprintsUntil: number;
    footprintHistory: StoreBootstrapFootprintEntry[];
    deadChampions: Record<number, Champion>;
    activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
    inventoryFullFeedback: { championId: number; ts: number } | null;
    lastCreatureAttackGameTick: number;
    tutorialOverlayActive: boolean;
};

type StoreBootstrapRuntimeParams = {
    hallStart: [number, number];
    hallStartDirection: StoreBootstrapDirection;
    buildDefaultOpenPits: () => Set<string>;
    buildDefaultOpenTeleporters: () => Set<string>;
    buildDefaultVisibleTexts: () => Set<string>;
    buildCreatureInstancesForLevel: (level: number) => CreatureInstance[];
    buildFloorItemsForLevel: (level: number) => FloorItem[];
};

export function createStoreBootstrapRuntime(
    params: StoreBootstrapRuntimeParams,
) {
    const createEmptyStringSet = () => new Set<string>();

    const buildFreshDungeonState = (
        gameOptions: GameOptions,
        gamePhase: StoreBootstrapGamePhase,
    ): StoreBootstrapState => {
        const shouldHydrateWorld = gamePhase !== 'title';
        const hydratedLevels = shouldHydrateWorld ? new Set<number>([0]) : new Set<number>();

        return {
        level: 0,
        position: params.hallStart,
        direction: params.hallStartDirection,
        party: [],
        gameOptions,
        selectedChampionIndex: 0,
        gamePhase,
        optionsModalOpen: false,
        activeMirrorChampionId: null,
        activePartyMemberId: null,
        gateOpen: false,
        hydratedLevels,
        openDoors: createEmptyStringSet(),
        brokenDoors: createEmptyStringSet(),
        openPits: shouldHydrateWorld ? params.buildDefaultOpenPits() : createEmptyStringSet(),
        openTeleporters: shouldHydrateWorld ? params.buildDefaultOpenTeleporters() : createEmptyStringSet(),
        openWalls: createEmptyStringSet(),
        activeSensors: createEmptyStringSet(),
        firedSensors: createEmptyStringSet(),
        sensorRuntimeData: {},
        sensorRotationOffsets: {},
        visibleTexts: shouldHydrateWorld ? params.buildDefaultVisibleTexts() : createEmptyStringSet(),
        pendingSensorEvents: [],
        pendingGeneratorSpawns: [],
        creatures: shouldHydrateWorld ? params.buildCreatureInstancesForLevel(0) : [],
        floorItems: shouldHydrateWorld ? params.buildFloorItemsForLevel(0) : [],
        championInventories: {},
        championEquipment: {},
        championVitals: {},
        championManaRegenBlockedUntilTick: {},
        elapsedGameTimeTicks: 0,
        regenTickRemainder: 0,
        lastSurvivalEffectGameTick: 0,
        freezeLifeRemainingTicks: 0,
        lastPartyMoveGameTick: 0,
        movementCooldown: 0,
        sleeping: false,
        paused: false,
        pausedAt: null,
        lastMonsterAttackDebug: null,
        endgameSequence: null,
        lastCastResult: null,
        championXP: {},
        championTemporaryXP: {},
        gameStats: createInitialGameStats(),
        championCombat: {},
        damageEvents: [],
        spellVisualEvents: [],
        crushingDoors: {},
        torchBurnStart: {},
        spellLights: [],
        projectiles: [],
        activePoisonClouds: [],
        activeShields: [],
        activePotionBoosts: [],
        invisibleUntil: 0,
        magicVisionUntil: 0,
        seeThroughWallsUntil: 0,
        footprintsUntil: 0,
        footprintHistory: [],
        deadChampions: {},
        activeFloorDrag: null,
        inventoryFullFeedback: null,
        lastCreatureAttackGameTick: 0,
        tutorialOverlayActive: false,
    };
    };

    return {
        buildFreshDungeonState,
    };
}
