import type { Champion } from '../types/champion';
import type { ChampionWounds } from '../data/equipment';
import type { ChampionTemporaryXP, ChampionXP } from '../data/skillProgression';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../types/game';
import type { GameStats } from './systems/gameStats';
import type { MinimapSeenTileKind } from './systems/minimapDiscovery';

export type { ChampionTemporaryXP, ChampionXP } from '../data/skillProgression';

export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

export interface ChampionVitals {
    hp: number;
    stamina: number;
    mana: number;
    food: number;
    water: number;
    currentStats: {
        luck: number;
        strength: number;
        dexterity: number;
        wisdom: number;
        vitality: number;
        antiMagic: number;
        antiFire: number;
    };
    wounds: ChampionWounds;
    poisonEntries: { remaining: number; nextTickIn: number }[];
}

export type DamageEventKind = 'normal' | 'poison';

export interface DamageEvent {
    id: string;
    level: number;
    target: 'creature' | 'champion';
    championId?: number;
    creatureId?: string;
    x?: number;
    y?: number;
    amount: number;
    kind?: DamageEventKind;
    ts: number;
}

export interface MonsterAttackDebugEntry {
    attackerName: string;
    targetName: string;
    attackMode: 'melee' | 'ranged';
    attackType: string;
    quickness: number;
    requiredQuickness: number;
    parryMastery: number;
    rolledAttack: number;
    finalDamage: number;
    hpBefore: number;
    hpAfter: number;
    hitZones?: string[];
    woundSlots?: string[];
    defenseApplied?: number;
    activeShieldDefense?: number;
    postMitigationAttack?: number;
    defenseSlotBreakdown?: Array<{
        slot: string;
        vitalityRoll: number;
        defenseModifier: number;
        slotArmor: number;
        slotItemName?: string | null;
        shieldContribution: number;
        shieldDetails?: string[];
        woundPenalty: number;
        finalDefense: number;
    }>;
    ts: number;
}

export type ProjectileEffect =
    | 'fireball'
    | 'lightning'
    | 'slime'
    | 'poison_cloud'
    | 'poison_bolt'
    | 'open'
    | 'disrupt_nonmaterial'
    | 'physical';

export type ProjectileVisualVariant = 'invoke';

export interface SpellVisualEvent {
    id: string;
    level: number;
    x: number;
    y: number;
    offsetX?: number;
    offsetZ?: number;
    height?: number;
    effect: Exclude<ProjectileEffect, 'physical'>;
    visualScale?: number;
    ts: number;
    kind: 'wall' | 'creature' | 'death';
}

export interface SpellLight {
    id: string;
    lightContrib: number;
    expiresAt: number;
}

export interface Projectile {
    id: string;
    level: number;
    x: number;
    y: number;
    direction: Direction;
    effect: ProjectileEffect;
    launchedBy?: 'party' | 'creature' | 'wall';
    sourceCreatureId?: string;
    targetChampionId?: number;
    spellRunes?: string[];
    visualScale?: number;
    visualVariant?: ProjectileVisualVariant;
    damage: [number, number];
    nextMoveAt: number;
    remainingRange?: number;
    remainingAttack?: number;
    stepDecay?: number;
    physicalItem?: FloorItem;
    explosionOnImpact?: Exclude<ProjectileEffect, 'physical'>;
    explosionAttack?: number;
}

export interface ActivePoisonCloud {
    id: string;
    level: number;
    x: number;
    y: number;
    remainingAttack: number;
    nextPulseGameTick: number;
    visualScale?: number;
}

export interface ActiveFluxcage {
    id: string;
    level: number;
    x: number;
    y: number;
    expiresAt: number;
}

export interface PartyShield {
    id: string;
    expiresAt: number;
    defense: number;
    kind?: 'physical' | 'magic' | 'fire';
    protection?: number;
    fireOnly?: boolean;
    championId?: number;
}

export interface ActivePotionBoost {
    id: string;
    championId: number;
    stat: 'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire';
    amount: number;
    expiresAt: number;
}

export interface FootprintEntry {
    x: number;
    y: number;
    level: number;
    ts: number;
}

export interface ChampionCombat {
    cooldown: number;
    cooldownMax: number;
    defenseModifier: number;
}

export type GameAction =
    | 'moveForward'
    | 'moveBackward'
    | 'turnLeft'
    | 'turnRight'
    | 'strafeLeft'
    | 'strafeRight';

export type KeyBindings = Record<GameAction, string[]>;

export interface GameOptions {
    keybindings: KeyBindings;
    showMinimap: boolean;
}

export interface PersistedCreatureTimers {
    moveRemaining: number;
    attackRemaining: number;
    attackWindowRemainingMs: number;
    confusedRemainingMs: number;
    fluxcageRemainingMs: number;
    frightenedRemainingMs?: number;
    lastSeenPartyX?: number;
    lastSeenPartyY?: number;
    lastSeenPartyRemainingMs?: number;
}

export interface PersistedSaveData {
    version: number;
    buildVersion?: string;
    savedAt: number;
    integrity?: string;
    gameOptions?: GameOptions;
    minimapTiles?: Record<string, MinimapSeenTileKind>;
    level: number;
    position: [number, number];
    direction: Direction;
    party: Champion[];
    gateOpen: boolean;
    hydratedLevels?: number[];
    openDoors: string[];
    brokenDoors?: string[];
    openPits: string[];
    openTeleporters: string[];
    openWalls: string[];
    activeSensors: string[];
    firedSensors: string[];
    sensorRuntimeData?: Record<string, number>;
    sensorRotationOffsets?: Record<string, number>;
    visibleTexts: string[];
    pendingSensorEvents: unknown[];
    pendingGeneratorSpawns?: unknown[];
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    championManaRegenBlockedUntilTick?: Record<number, number>;
    elapsedGameTimeTicks: number;
    regenTickRemainder: number;
    lastSurvivalEffectGameTick?: number;
    freezeLifeRemainingTicks?: number;
    lastPartyMoveGameTick: number;
    movementCooldown: number;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP?: Record<number, ChampionTemporaryXP>;
    gameStats?: GameStats;
    championCombat: Record<number, ChampionCombat>;
    spellVisualEvents?: SpellVisualEvent[];
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    torchBurnElapsed: Record<string, number>;
    spellLights: Array<Omit<SpellLight, 'expiresAt'> & { remainingMs: number }>;
    projectiles: Array<Omit<Projectile, 'nextMoveAt'> & { nextMoveInMs: number }>;
    activePoisonClouds?: ActivePoisonCloud[];
    activeFluxcages?: Array<Omit<ActiveFluxcage, 'expiresAt'> & { remainingMs: number }>;
    activeShields: Array<Omit<PartyShield, 'expiresAt'> & { remainingMs: number }>;
    activePotionBoosts: Array<Omit<ActivePotionBoost, 'expiresAt'> & { remainingMs: number }>;
    invisibleRemainingMs: number;
    magicVisionRemainingMs: number;
    seeThroughWallsRemainingMs: number;
    footprintsRemainingMs: number;
    footprintHistory: FootprintEntry[];
    deadChampions: Record<number, Champion>;
    creatureTimers: Record<string, PersistedCreatureTimers>;
    lastCreatureAttackGameTick?: number;
}
