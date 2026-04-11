import type { Champion } from '../data/champions';
import type { CastSkill } from '../data/runes';
import type { ChampionWounds } from '../data/equipment';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../types/game';

export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

export interface ChampionVitals {
    hp: number;
    stamina: number;
    mana: number;
    food: number;
    water: number;
    wounds: ChampionWounds;
    poisonEntries: { remaining: number; nextTickIn: number }[];
}

export interface DamageEvent {
    id: string;
    x: number;
    y: number;
    amount: number;
    ts: number;
}

export type ProjectileEffect =
    | 'fireball'
    | 'lightning'
    | 'poison_cloud'
    | 'poison_bolt'
    | 'disrupt_nonmaterial'
    | 'physical';

export interface SpellVisualEvent {
    id: string;
    level: number;
    x: number;
    y: number;
    effect: Exclude<ProjectileEffect, 'physical'>;
    ts: number;
    kind: 'wall' | 'creature';
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
    damage: [number, number];
    nextMoveAt: number;
    remainingRange?: number;
    remainingAttack?: number;
    stepDecay?: number;
    physicalItem?: FloorItem;
}

export interface PartyShield {
    id: string;
    expiresAt: number;
    protection: number;
    fireOnly: boolean;
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

export type ChampionXP = Record<CastSkill, number>;

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
}

export interface PersistedCreatureTimers {
    moveRemaining: number;
    attackRemaining: number;
    attackWindowRemainingMs: number;
    confusedRemainingMs: number;
    fluxcageRemainingMs: number;
    lastSeenPartyX?: number;
    lastSeenPartyY?: number;
    lastSeenPartyRemainingMs?: number;
}

export interface PersistedSaveData {
    version: 1;
    savedAt: number;
    gameOptions?: GameOptions;
    level: number;
    position: [number, number];
    direction: Direction;
    party: Champion[];
    gateOpen: boolean;
    openDoors: string[];
    openTeleporters: string[];
    openWalls: string[];
    activeSensors: string[];
    firedSensors: string[];
    visibleTexts: string[];
    pendingSensorEvents: unknown[];
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    elapsedGameTimeTicks: number;
    regenTickRemainder: number;
    lastPartyMoveGameTick: number;
    movementCooldown: number;
    championXP: Record<number, ChampionXP>;
    championCombat: Record<number, ChampionCombat>;
    spellVisualEvents?: SpellVisualEvent[];
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    torchBurnElapsed: Record<string, number>;
    spellLights: Array<Omit<SpellLight, 'expiresAt'> & { remainingMs: number }>;
    projectiles: Array<Omit<Projectile, 'nextMoveAt'> & { nextMoveInMs: number }>;
    activeShields: Array<Omit<PartyShield, 'expiresAt'> & { remainingMs: number }>;
    activePotionBoosts: Array<Omit<ActivePotionBoost, 'expiresAt'> & { remainingMs: number }>;
    invisibleRemainingMs: number;
    magicVisionRemainingMs: number;
    seeThroughWallsRemainingMs: number;
    footprintsRemainingMs: number;
    footprintHistory: FootprintEntry[];
    deadChampions: Record<number, Champion>;
    creatureTimers: Record<string, PersistedCreatureTimers>;
}
