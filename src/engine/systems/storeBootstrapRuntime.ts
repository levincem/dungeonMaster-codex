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
    endgameSequence: null;
    lastCastResult: null;
    championXP: Record<number, never>;
    championTemporaryXP: Record<number, never>;
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
    lastCreatureAttackGameTick: number;
};

type StoreBootstrapRuntimeParams = {
    hallStart: [number, number];
    hallStartDirection: StoreBootstrapDirection;
    buildOpenPits: () => Set<string>;
    buildOpenTeleporters: () => Set<string>;
    buildVisibleTexts: () => Set<string>;
    buildCreatureInstances: () => CreatureInstance[];
    buildFloorItems: () => FloorItem[];
};

export function createStoreBootstrapRuntime(
    params: StoreBootstrapRuntimeParams,
) {
    const buildFreshDungeonState = (
        gameOptions: GameOptions,
        gamePhase: StoreBootstrapGamePhase,
    ): StoreBootstrapState => ({
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
        openDoors: new Set<string>(),
        brokenDoors: new Set<string>(),
        openPits: params.buildOpenPits(),
        openTeleporters: params.buildOpenTeleporters(),
        openWalls: new Set<string>(),
        activeSensors: new Set<string>(),
        firedSensors: new Set<string>(),
        sensorRuntimeData: {},
        sensorRotationOffsets: {},
        visibleTexts: params.buildVisibleTexts(),
        pendingSensorEvents: [],
        pendingGeneratorSpawns: [],
        creatures: params.buildCreatureInstances(),
        floorItems: params.buildFloorItems(),
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
        endgameSequence: null,
        lastCastResult: null,
        championXP: {},
        championTemporaryXP: {},
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
        lastCreatureAttackGameTick: 0,
    });

    return {
        buildFreshDungeonState,
    };
}
