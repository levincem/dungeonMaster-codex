import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { getGameMap, getGameMaps, getChampionStartPositions } from '../data/mapLoader';
import {
    getMapMechanisms,
    getRequiredSensorItemName,
    isWallAlcoveSensor,
    isWallObjectExchangerSensor,
    isConsumableLockSensor,
    isCreatureOnlyFloorSensor,
    isGeneratorSensor,
    isPartyPossessionSensor,
    isSpecificObjectFloorSensor,
    isWallLockSensor,
    itemMatchesMechanismRequirement,
    itemToLockData,
} from '../data/mechanisms';
import type {
    GameMap, GameTile, TeleporterObject,
    CreatureInstance, CreatureObject, FloorItem,
    SensorObject, SensorAction, WallTextObject, CardinalDir, DoorObject,
    ChampionEquipment, CreatureSide,
} from '../types/game';
import type { EquipSlotKey } from '../types/items';
import type { Champion } from '../data/champions';
import { CHAMPION_BY_ID } from '../data/champions';
import { buildChampionStarterLoadout } from '../data/championStarterItems';
import { CREATURE_TYPES } from '../data/creatures';
import type { CreatureDef, OriginalAttackType } from '../data/creatures';
import { findSpell } from '../data/runes';
import {
    getOriginalPotionStrengthRange,
    getOriginalSpellCastXpRange,
    getOriginalSpellDescriptorForRunes,
    getOriginalSpellRequiredSkillLevel,
} from '../data/originalSpells';
import {
    awardChampionXP,
    buildChampionInitialXP,
    createEmptyChampionTemporaryXP,
    createEmptyChampionXP,
    getChampionSkillLevel,
    getParentBasicSkill,
    isHiddenSkill,
    mapOriginalSkillNumberToSkillKey,
    normalizeChampionTemporaryXP,
    normalizeChampionXP,
    skillExperienceToLevel,
    type ChampionTemporaryXP,
    type ChampionXP,
    type SkillKey,
} from '../data/skillProgression';
import {
    getProjectileDamage,
    getOriginalSpellProjectileLaunchProfile,
    getSpellProjectileLaunchProfile,
    getSpellDurationMs,
    getSpellLightContribution,
    getSpellShieldProfile,
    rollOriginalSpellProjectileImpact,
} from '../data/spellRuntime';
import {
    getArmorDef,
    I562_WOUND_DEFENSE_FACTORS,
    WEAPON_TYPES,
    MISC_TYPES,
    getPotionDef,
    resolveItemName,
} from '../data/items';
import { normalizeScrollText } from '../data/textNormalization';
import {
    canEquipItemInSlot,
    EMPTY_CHAMPION_WOUNDS,
    getChampionMaxLoad,
    getEffectiveChampionStatsWithBonuses,
    getTotalWeight,
} from '../data/equipment';
import type { ChampionWoundSlot, ChampionWounds, EquipmentStatBonuses } from '../data/equipment';
import { hasOriginalWallOverlayAt } from '../data/originalWallOverlays';
import {
    getAttackOptionUnusableReason,
    getAttackCooldownSeconds,
    getDefaultAttackOption,
    getOriginalWeaponReference,
    getRequiredAmmoRawClass,
    getWeaponAttackOptions,
    isAttackOptionUsableAtMastery,
    isPhysicalAttack,
    isShootAttack,
    isThrowAttack,
    matchesRequiredAmmoRawClass,
    type WeaponAttackOption,
} from '../data/weaponAttacks';
import {
    canFillWaterContainer,
    consumeWaterContainer,
    fillWaterContainer,
    isWaterContainer,
    normaliseWaterContainer,
} from '../data/waterContainers';
import { doorBlocksThrownItems, doorBlocksVision } from '../data/doors';
import {
    playPartyAttack,
    playCreatureMove,
    playCreatureAttack,
    playPlate,
    playDoorMotion,
    playTeleport,
    playWallBump,
    playChampionWounded,
    playHornOfFear,
    playWarCry,
} from './sounds';
import { readPersistedSave, writePersistedSave } from './saveGame';
import type { GameOptions } from './runtimeTypes';
import {
    buildPersistedSaveData as buildPersistedSaveDataSystem,
    restoreExternalCreatureRuntimeFromSave as restoreExternalCreatureRuntimeFromSaveSystem,
    tryParsePersistedSaveData as tryParsePersistedSaveDataSystem,
} from './systems/persistence';
import { DEFAULT_GAME_OPTIONS } from './options';
import { GRID_SIZE } from './constants';
import {
    ORIGINAL_TIMER_TICK_MS,
    ORIGINAL_TIMER_TICK_SECONDS,
    originalTimerTicksToSeconds,
    quantizeMsToOriginalTimerTicks,
    minutesToMs,
    DAMAGE_EVENT_LIFETIME_MS,
    TRANSIENT_MESSAGE_LIFETIME_MS,
    FOOTPRINT_LIFETIME_MS,
    CREATURE_ATTACK_WINDOW_MS,
    PROJECTILE_STEP_MS,
    PHYSICAL_PROJECTILE_STEP_MS,
    DOOR_CLOSE_DURATION_SECONDS,
    DOOR_REBOUND_DURATION_SECONDS,
    DOOR_RECLOSE_DURATION_SECONDS,
} from './time';

export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
export type GamePhase = 'title' | 'exploration' | 'mirror_open' | 'endgame' | 'victory';

const DOOR_TOGGLE_SOUND_DURATION_MS = 1000;
const DOOR_SOUND_MAX_VOLUME = 0.65;
const DOOR_SOUND_MIN_VOLUME = 0.22;
const DOOR_SOUND_FALLOFF_PER_TILE = 0.075;

function getDoorSoundVolume(level: number, x: number, y: number): number {
    const state = useStore.getState();
    if (state.level !== level) return DOOR_SOUND_MIN_VOLUME;
    const dx = x - state.position[1];
    const dy = y - state.position[0];
    const distance = Math.hypot(dx, dy);
    return Math.max(DOOR_SOUND_MIN_VOLUME, DOOR_SOUND_MAX_VOLUME - distance * DOOR_SOUND_FALLOFF_PER_TILE);
}

function resolveDoorSoundTarget(sensor: SensorObject, level: number): { level: number; x: number; y: number } | null {
    const map = getMap(level);
    const targetTile = map.tiles[sensor.targetY]?.[sensor.targetX];
    if (!targetTile) return null;
    if (targetTile.type === 'Door') {
        return { level, x: sensor.targetX, y: sensor.targetY };
    }
    const gates = targetTile.objects.filter(
        (obj): obj is SensorObject => obj.category === 'Sensor' && obj.type === 5,
    );
    for (const gate of gates) {
        const gateTarget = map.tiles[gate.targetY]?.[gate.targetX];
        if (gateTarget?.type === 'Door') {
            return { level, x: gate.targetX, y: gate.targetY };
        }
    }
    return null;
}

// ─── Champion vitals (live HP / Stamina / Mana) ───────────────────────────────
export interface ChampionVitals {
    hp:      number;  // current hit points (0 … champion.health)
    stamina: number;  // current stamina    (0 … champion.stamina)
    mana:    number;  // current mana       (0 … champion.mana)
    food:    number;  // hunger reserve     (-1024 … 2048)
    water:   number;  // thirst reserve     (-1024 … 2048)
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

export interface CastResult {
    success: boolean;
    message: string;
    ts: number; // Date.now() — used to trigger re-display
}

let castResultTimeout: ReturnType<typeof setTimeout> | null = null;

// ─── Floating damage number shown on struck creature ─────────────────────────
export interface DamageEvent {
    id: string;
    level: number;
    target: 'creature' | 'champion';
    championId?: number;
    x?: number;
    y?: number;
    amount: number;
    ts: number;    // Date.now() — auto-cleared after ~600 ms
}

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

interface EndgameSequence {
    startedAt: number;
    level: number;
    x: number;
    y: number;
    lordChaosId: string;
    lastBurstIndex: number;
    stage: number;
}

// ─── Torch burn lifecycle ──────────────────────────────────────────────────────
export const TORCH_LIFETIME_MS  = quantizeMsToOriginalTimerTicks(minutesToMs(15));  // 15 min total
export const TORCH_STATE_MS     = quantizeMsToOriginalTimerTicks(minutesToMs(5));   // 5 min per visual state

/** Return 0=unlit, 1=used_2, 2=used_1, 3=lit based on ms elapsed since lit */
export function torchStateIndex(elapsedMs: number): number {
    if (elapsedMs >= TORCH_LIFETIME_MS)        return 0; // burnt out
    if (elapsedMs >= TORCH_STATE_MS * 2)       return 1; // used_2
    if (elapsedMs >= TORCH_STATE_MS)           return 2; // used_1
    return 3;                                            // fresh lit
}

// ─── Spell lights (torch / light spells) ─────────────────────────────────────
export interface SpellLight {
    id: string;
    lightContrib: number; // added to lightLevel (+0.25 for FUL, +0.5 for OH IR RA, negative for Darkness)
    expiresAt: number;    // Date.now() ms
}

// ─── Compute scene light level (0 = dark, 1 = full light) ────────────────────
export function computeLightLevel(
    spellLights: SpellLight[],
    torchBurnStart: Record<string, number>,
    championEquipment: Record<number, import('../types/game').ChampionEquipment>,
): number {
    const now = Date.now();

    // Torch in any champion's hand that hasn't burnt out
    let torchContrib = 0;
    outer: for (const equip of Object.values(championEquipment)) {
        if (!equip) continue;
        for (const slot of ['rightHand', 'leftHand'] as const) {
            const item = equip[slot];
            if (!item || item.category !== 'Weapon' || item.typeId !== 2) continue;
            const litAt = torchBurnStart[item.id];
            if (litAt !== undefined && now - litAt < TORCH_LIFETIME_MS) {
                torchContrib = 1.0;
                break outer;
            }
        }
    }

    // Active spell contributions (positive = light, negative = darkness)
    const spellContrib = spellLights
        .filter(l => l.expiresAt > now)
        .reduce((sum, l) => sum + l.lightContrib, 0);

    return Math.max(0, Math.min(1, torchContrib + spellContrib));
}

// ─── Active projectiles (fireball, lightning, poison, thrown items) ───────────
export type ProjectileEffect =
    | 'fireball'
    | 'lightning'
    | 'slime'
    | 'poison_cloud'
    | 'poison_bolt'
    | 'open'
    | 'disrupt_nonmaterial'
    | 'physical';

export interface Projectile {
    id: string;
    level: number;
    x: number;           // tile x
    y: number;           // tile y
    direction: Direction;
    effect: ProjectileEffect;
    launchedBy?: 'party' | 'creature';
    sourceCreatureId?: string;
    targetChampionId?: number;
    spellRunes?: string[];
    visualScale?: number;
    damage: [number, number]; // [min, max]
    nextMoveAt: number;  // Date.now() ms — when to advance to next tile
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

// ─── Party shields (magic shield / fire shield spells) ────────────────────────
export interface PartyShield {
    id: string;
    expiresAt: number;
    defense: number;
    kind?: 'physical' | 'magic' | 'fire';
    protection?: number; // legacy save compatibility
    fireOnly?: boolean;  // legacy save compatibility
    championId?: number;
}

export interface ActivePotionBoost {
    id: string;
    championId: number;
    stat: 'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire';
    amount: number;
    expiresAt: number;
}

// ─── Footprint trail (footprints spell) ──────────────────────────────────────
export interface FootprintEntry {
    x: number;
    y: number;
    level: number;
    ts: number; // Date.now() when placed
}

/** Total accumulated XP → source-backed skill level. */
export function xpToLevel(xp: number): number {
    return skillExperienceToLevel(xp);
}

function getChampionSkillLevelFromXP(
    xp: ChampionXP | undefined,
    temporaryXp: ChampionTemporaryXP | undefined,
    skill: SkillKey,
    options?: { ignoreTemporary?: boolean; bonusLevels?: number },
): number {
    return getChampionSkillLevel(
        normalizeChampionXP(xp),
        normalizeChampionTemporaryXP(temporaryXp),
        skill,
        options,
    ) + (options?.bonusLevels ?? 0);
}

function getEquipmentSkillLevelModifier(
    skill: SkillKey,
    equipment: ChampionEquipment | undefined,
): number {
    const actionHand = equipment?.rightHand;
    const neck = equipment?.neck;
    let modifier = 0;

    if (actionHand?.category === 'Weapon') {
        if (actionHand.typeId === 7) {
            modifier += 1;
        } else if (actionHand.typeId === 45) {
            modifier += 2;
        }
    }

    if (skill === 'wizard' && neck?.category === 'Misc' && neck.typeId === 41) {
        modifier += 1;
    }

    if (skill === 'defend' && neck?.category === 'Misc' && neck.typeId === 38) {
        modifier += 1;
    }

    if (skill === 'heal') {
        const hasGemOfAges = neck?.category === 'Misc' && neck.typeId === 37;
        const hasSceptreOfLyf = actionHand?.category === 'Weapon' && actionHand.typeId === 42;
        if (hasGemOfAges || hasSceptreOfLyf) {
            modifier += 1;
        }
    }

    if (skill === 'influence' && neck?.category === 'Misc' && neck.typeId === 39) {
        modifier += 1;
    }

    return modifier;
}

// ─── Per-champion combat state ────────────────────────────────────────────────
export interface ChampionCombat {
    cooldown:    number; // seconds remaining
    cooldownMax: number; // full duration (for overlay ratio)
    defenseModifier: number; // temporary defensive posture during attack recovery
}

const MAX_PARTY = 4;
type MirrorRecruitMode = 'resurrect' | 'reincarnate';
const QUIVER_SLOTS: EquipSlotKey[] = ['quiver1', 'quiver2', 'quiver3', 'quiver4'];

export const MAX_FOOD = 2048;
export const MAX_WATER = 2048;
export const LOW_FOOD_THRESHOLD = 1024;
export const CRITICAL_FOOD_THRESHOLD = 512;
export const LOW_WATER_THRESHOLD = 1024;
export const CRITICAL_WATER_THRESHOLD = 512;
const MIN_FOOD_WATER = -1024;
const POISON_TICK_INTERVAL_SEC = originalTimerTicksToSeconds(36);
const FOOD_DRAIN_SCALE = 1;
const WATER_DRAIN_SCALE = 1;
const AWAKE_SURVIVAL_INTERVAL_TICKS = 256;
const SLEEP_SURVIVAL_INTERVAL_TICKS = 64;
const ORIGINAL_SPELL_PROJECTILE_ATTACK = 90;

function clampVital(value: number, max: number): number {
    return Math.max(0, Math.min(max, value));
}

function clampFoodWater(value: number, max: number): number {
    return Math.max(MIN_FOOD_WATER, Math.min(max, value));
}

function rollInitialFoodWaterReserve(): number {
    return 1500 + randomInt(256);
}

function createChampionCurrentStats(champion: Champion): ChampionVitals['currentStats'] {
    return {
        luck: champion.luck,
        strength: champion.strength,
        dexterity: champion.dexterity,
        wisdom: champion.wisdom,
        vitality: champion.vitality,
        antiMagic: champion.antiMagic,
        antiFire: champion.antiFire,
    };
}

function normalizeChampionCurrentStats(
    champion: Champion,
    currentStats: Partial<ChampionVitals['currentStats']> | undefined,
): ChampionVitals['currentStats'] {
    const fallback = createChampionCurrentStats(champion);
    return {
        luck: currentStats?.luck ?? fallback.luck,
        strength: currentStats?.strength ?? fallback.strength,
        dexterity: currentStats?.dexterity ?? fallback.dexterity,
        wisdom: currentStats?.wisdom ?? fallback.wisdom,
        vitality: currentStats?.vitality ?? fallback.vitality,
        antiMagic: currentStats?.antiMagic ?? fallback.antiMagic,
        antiFire: currentStats?.antiFire ?? fallback.antiFire,
    };
}

function createChampionVitals(
    champion: Champion,
    hp: number,
    stamina: number,
    mana: number,
    food = rollInitialFoodWaterReserve(),
    water = rollInitialFoodWaterReserve(),
): ChampionVitals {
    return {
        hp,
        stamina,
        mana,
        food,
        water,
        currentStats: createChampionCurrentStats(champion),
        wounds: { ...EMPTY_CHAMPION_WOUNDS },
        poisonEntries: [],
    };
}

function normalizeChampionVitalsForChampion(champion: Champion, vitals: ChampionVitals): ChampionVitals {
    const normalizedStats = normalizeChampionCurrentStats(champion, vitals.currentStats);
    if (vitals.currentStats &&
        vitals.currentStats.luck === normalizedStats.luck &&
        vitals.currentStats.strength === normalizedStats.strength &&
        vitals.currentStats.dexterity === normalizedStats.dexterity &&
        vitals.currentStats.wisdom === normalizedStats.wisdom &&
        vitals.currentStats.vitality === normalizedStats.vitality &&
        vitals.currentStats.antiMagic === normalizedStats.antiMagic &&
        vitals.currentStats.antiFire === normalizedStats.antiFire) {
        return vitals;
    }
    return {
        ...vitals,
        currentStats: normalizedStats,
    };
}

function adjustOriginalStatisticCurrentValue(
    currentValue: number,
    delta: number,
): number {
    if (delta < 0) return Math.max(0, currentValue + delta);
    let adjustedDelta = delta;
    if (currentValue > 120) {
        adjustedDelta >>= 1;
        if (currentValue > 150) {
            adjustedDelta >>= 1;
        }
        adjustedDelta += 1;
    }
    return Math.min(170, currentValue + adjustedDelta);
}

function relaxChampionCurrentStatsTowardMaximum(
    champion: Champion,
    currentStats: ChampionVitals['currentStats'],
): ChampionVitals['currentStats'] {
    const next = { ...currentStats };
    const maxima = createChampionCurrentStats(champion);
    for (const key of Object.keys(maxima) as Array<keyof ChampionVitals['currentStats']>) {
        const maxValue = Math.max(1, maxima[key]);
        const currentValue = next[key];
        if (currentValue < maxValue) {
            next[key] = currentValue + 1;
        } else if (currentValue > maxValue) {
            next[key] = Math.max(maxValue, currentValue - Math.max(1, Math.floor(currentValue / maxValue)));
        }
    }
    return next;
}

function buildEmptyFlaskReplacement(item: FloorItem): FloorItem {
    return {
        ...item,
        category: 'Potion',
        typeId: 20,
        rawName: resolveItemName('Potion', 20, item.rawName),
        waterCharges: 0,
        waterMaxCharges: 1,
    };
}

function chooseChampionWoundSlotsFromZones(
    hitZones: readonly ArmorCoverageZone[] | undefined,
): ChampionWoundSlot[] {
    if (!hitZones || hitZones.length === 0) return ['torso'];
    const slots = new Set<ChampionWoundSlot>();
    for (const zone of hitZones) {
        if (zone === 'hands') {
            slots.add('rightHand');
            slots.add('leftHand');
            continue;
        }
        slots.add(zone);
    }
    return [...slots];
}

function applyChampionWound(vitals: ChampionVitals, slot: ChampionWoundSlot): ChampionVitals {
    if (vitals.wounds[slot]) return vitals;
    return {
        ...vitals,
        wounds: {
            ...vitals.wounds,
            [slot]: true,
        },
    };
}

function healChampionWoundsApprox(vitals: ChampionVitals, iterations = 1): ChampionVitals {
    let current = vitals;
    for (let i = 0; i < iterations; i += 1) {
        const woundedSlots = (Object.entries(current.wounds) as [ChampionWoundSlot, boolean][])
            .filter(([, wounded]) => wounded)
            .map(([slot]) => slot);
        if (woundedSlots.length === 0) break;
        const healedSlot = woundedSlots[randomInt(woundedSlots.length)];
        if (!healedSlot) break;
        current = {
            ...current,
            wounds: {
                ...current.wounds,
                [healedSlot]: false,
            },
        };
    }
    return current;
}

function adjustByAttributeApprox(value: number, currentAttribute: number): number {
    const factor = 170 - currentAttribute;
    if (factor < 16) return Math.floor(value / 8);
    return Math.floor((value * factor) / 128);
}

function scaleOriginalAttackApprox(value: number, shift: number, factor: number): number {
    return Math.floor((Math.max(0, value) * factor) / (1 << shift));
}

function getPartyShieldKind(shield: PartyShield): 'physical' | 'magic' | 'fire' {
    if (shield.kind) return shield.kind;
    if (shield.fireOnly) return 'fire';
    return shield.championId !== undefined ? 'magic' : 'physical';
}

function applyPoisonCharacterApprox(
    vitals: ChampionVitals,
    poisonStrength: number,
): ChampionVitals {
    if (poisonStrength <= 0) return vitals;
    const immediateDamage = Math.max(1, Math.floor(poisonStrength / 64));
    const remaining = poisonStrength - 1;
    return {
        ...vitals,
        hp: Math.max(0, vitals.hp - immediateDamage),
        poisonEntries: remaining > 0
            ? [...vitals.poisonEntries, { remaining, nextTickIn: POISON_TICK_INTERVAL_SEC }]
            : vitals.poisonEntries,
    };
}

function computeOriginalTimeCriteria(gameTimeTicks: number): number {
    return (((gameTimeTicks & 0x0080) + ((gameTimeTicks & 0x0100) >> 2) + ((gameTimeTicks & 0x0040) << 2)) >> 2);
}

function applyChampionStaminaDeltaOriginal(
    vitals: ChampionVitals,
    maxStamina: number,
    staminaDelta: number,
): ChampionVitals {
    if (staminaDelta === 0) return vitals;

    const rawStamina = vitals.stamina + staminaDelta;
    if (rawStamina >= 0) {
        return {
            ...vitals,
            stamina: Math.min(maxStamina, rawStamina),
        };
    }

    return {
        ...vitals,
        stamina: 0,
        hp: Math.max(0, vitals.hp - Math.floor((-rawStamina) / 2)),
    };
}

/** Back-calculate starting XP from a champion's initial skill levels. */
function buildInitialXP(champion: import('../data/champions').Champion): ChampionXP {
    return buildChampionInitialXP(champion.skills);
}

function isLegacyChampionXPForChampion(
    champion: Champion,
    xp: ChampionXP | undefined,
): boolean {
    const normalized = normalizeChampionXP(xp);
    const hasAnyHiddenXP = Object.keys(normalized)
        .some((key) => isHiddenSkill(key as SkillKey) && normalized[key as SkillKey] > 0);
    if (hasAnyHiddenXP) return false;

    const legacyInitial = createEmptyChampionXP();
    const lvlXP = (skills: [number, number, number, number]) => Math.pow(Math.max(skills[0], skills[2]), 2) * 500;
    legacyInitial.fighter = lvlXP(champion.skills.fighter);
    legacyInitial.ninja = lvlXP(champion.skills.ninja);
    legacyInitial.priest = lvlXP(champion.skills.priest);
    legacyInitial.wizard = lvlXP(champion.skills.wizard);

    return (
        normalized.fighter === legacyInitial.fighter &&
        normalized.ninja === legacyInitial.ninja &&
        normalized.priest === legacyInitial.priest &&
        normalized.wizard === legacyInitial.wizard
    );
}

function applyChampionSkillExperienceOriginalApprox(
    state: Pick<GameState,
        'level'
        | 'party'
        | 'championVitals'
        | 'championXP'
        | 'championTemporaryXP'
        | 'elapsedGameTimeTicks'
        | 'lastCreatureAttackGameTick'
    >,
    championId: number,
    skill: SkillKey,
    amount: number,
): {
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    party?: Champion[];
} | null {
    if (amount <= 0) return null;
    const championIndex = state.party.findIndex((entry) => entry.id === championId);
    const champion = championIndex >= 0 ? state.party[championIndex] : null;
    if (!champion) return null;

    const hiddenSkill = isHiddenSkill(skill);
    let adjustedExperience = amount;
    if (
        hiddenSkill &&
        (skill === 'swing' || skill === 'thrust' || skill === 'club' || skill === 'parry' || skill === 'steal' || skill === 'fight' || skill === 'throw' || skill === 'shoot') &&
        state.lastCreatureAttackGameTick < (state.elapsedGameTimeTicks - 150)
    ) {
        adjustedExperience >>= 1;
    }

    const mapDifficulty = getMap(state.level).difficulty;
    if (adjustedExperience > 0 && mapDifficulty > 0) {
        adjustedExperience *= mapDifficulty;
    }

    if (hiddenSkill && state.lastCreatureAttackGameTick > (state.elapsedGameTimeTicks - 25)) {
        adjustedExperience <<= 1;
    }

    if (adjustedExperience <= 0) return null;

    const baseSkill = getParentBasicSkill(skill);
    const previousBaseSkillLevel = getChampionSkillLevelFromXP(
        state.championXP[championId],
        state.championTemporaryXP[championId],
        baseSkill,
        { ignoreTemporary: true },
    );

    const nextChampionXP = awardChampionXP(state.championXP[championId], skill, adjustedExperience);
    const nextTemporaryChampionXP = normalizeChampionTemporaryXP(state.championTemporaryXP[championId]);
    if (nextTemporaryChampionXP[skill] < 32000) {
        nextTemporaryChampionXP[skill] += applyLimits(1, adjustedExperience >> 3, 100);
    }

    const nextBaseSkillLevel = getChampionSkillLevelFromXP(
        nextChampionXP,
        state.championTemporaryXP[championId],
        baseSkill,
        { ignoreTemporary: true },
    );

    let nextParty: Champion[] | undefined;
    if (nextBaseSkillLevel > previousBaseSkillLevel) {
        const updatedChampion = buildLevelUpChampionUpdateApprox(champion, baseSkill, nextBaseSkillLevel);
        if (updatedChampion) {
            nextParty = [...state.party];
            nextParty[championIndex] = updatedChampion;
        }
    }

    return {
        championXP: {
            ...state.championXP,
            [championId]: nextChampionXP,
        },
        championTemporaryXP: {
            ...state.championTemporaryXP,
            [championId]: nextTemporaryChampionXP,
        },
        ...(nextParty ? { party: nextParty } : {}),
    };
}

function createEmptyStatBonuses(): EquipmentStatBonuses {
    return {
        mana: 0,
        strength: 0,
        dexterity: 0,
        wisdom: 0,
        vitality: 0,
        antiMagic: 0,
        antiFire: 0,
        luck: 0,
    };
}

function getChampionPotionBonuses(
    activePotionBoosts: ActivePotionBoost[],
    championId: number,
    now = Date.now(),
): EquipmentStatBonuses {
    const bonuses = createEmptyStatBonuses();
    for (const boost of activePotionBoosts) {
        if (boost.championId !== championId || boost.expiresAt <= now) continue;
        bonuses[boost.stat] += boost.amount;
    }
    return bonuses;
}

function getChampionCurrentStatBonuses(
    champion: Champion,
    vitals: ChampionVitals | undefined,
): EquipmentStatBonuses {
    if (!vitals) return createEmptyStatBonuses();
    const currentStats = normalizeChampionCurrentStats(champion, vitals.currentStats);
    return {
        mana: 0,
        strength: currentStats.strength - champion.strength,
        dexterity: currentStats.dexterity - champion.dexterity,
        wisdom: currentStats.wisdom - champion.wisdom,
        vitality: currentStats.vitality - champion.vitality,
        antiMagic: currentStats.antiMagic - champion.antiMagic,
        antiFire: currentStats.antiFire - champion.antiFire,
        luck: currentStats.luck - champion.luck,
    };
}

function getChampionRuntimeBonuses(
    champion: Champion,
    vitals: ChampionVitals | undefined,
    activePotionBoosts: ActivePotionBoost[],
    now = Date.now(),
): EquipmentStatBonuses {
    const timedBonuses = getChampionPotionBonuses(activePotionBoosts, champion.id, now);
    const currentStatBonuses = getChampionCurrentStatBonuses(champion, vitals);
    return {
        mana: (timedBonuses.mana ?? 0) + (currentStatBonuses.mana ?? 0),
        strength: (timedBonuses.strength ?? 0) + (currentStatBonuses.strength ?? 0),
        dexterity: (timedBonuses.dexterity ?? 0) + (currentStatBonuses.dexterity ?? 0),
        wisdom: (timedBonuses.wisdom ?? 0) + (currentStatBonuses.wisdom ?? 0),
        vitality: (timedBonuses.vitality ?? 0) + (currentStatBonuses.vitality ?? 0),
        antiMagic: (timedBonuses.antiMagic ?? 0) + (currentStatBonuses.antiMagic ?? 0),
        antiFire: (timedBonuses.antiFire ?? 0) + (currentStatBonuses.antiFire ?? 0),
        luck: (timedBonuses.luck ?? 0) + (currentStatBonuses.luck ?? 0),
    };
}

function cloneChampionWithUpdatedMaximum(
    champion: Champion,
    updates: Partial<Pick<Champion, 'health' | 'stamina' | 'mana' | 'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire'>>,
): Champion {
    return {
        ...champion,
        ...updates,
    };
}

function buildLevelUpChampionUpdateApprox(
    champion: Champion,
    baseSkill: 'fighter' | 'ninja' | 'priest' | 'wizard',
    baseSkillLevelAfter: number,
): Champion | null {
    let updatedChampion = champion;
    const minorStatisticIncrease = randomInt(2);
    const majorStatisticIncrease = 1 + randomInt(2);
    let vitalityAmount = randomInt(2);

    if (baseSkill !== 'priest') {
        vitalityAmount &= baseSkillLevelAfter;
    }

    const nextVitality = champion.vitality + vitalityAmount;
    const nextAntiFire = champion.antiFire + (randomInt(2) & ~baseSkillLevelAfter);
    let nextStrength = champion.strength;
    let nextDexterity = champion.dexterity;
    let nextWisdom = champion.wisdom;
    let nextAntiMagic = champion.antiMagic;
    let nextHealth = champion.health;
    let nextStamina = champion.stamina;
    let nextMana = champion.mana;

    let healthLevelFactor = baseSkillLevelAfter;
    let staminaAmount = champion.stamina;

    switch (baseSkill) {
        case 'fighter':
            staminaAmount >>= 4;
            healthLevelFactor *= 3;
            nextStrength += majorStatisticIncrease;
            nextDexterity += minorStatisticIncrease;
            break;
        case 'ninja':
            staminaAmount = Math.floor(staminaAmount / 21);
            healthLevelFactor <<= 1;
            nextStrength += minorStatisticIncrease;
            nextDexterity += majorStatisticIncrease;
            break;
        case 'wizard':
            staminaAmount >>= 5;
            nextMana += baseSkillLevelAfter + (baseSkillLevelAfter >> 1);
            nextWisdom += majorStatisticIncrease;
            nextMana += Math.min(randomInt(4), Math.max(0, baseSkillLevelAfter - 1));
            nextAntiMagic += randomInt(3);
            break;
        case 'priest':
            staminaAmount = Math.floor(staminaAmount / 25);
            nextMana += baseSkillLevelAfter;
            healthLevelFactor += (healthLevelFactor + 1) >> 1;
            nextWisdom += minorStatisticIncrease;
            nextMana += Math.min(randomInt(4), Math.max(0, baseSkillLevelAfter - 1));
            nextAntiMagic += randomInt(3);
            break;
    }

    nextMana = Math.min(900, nextMana);
    nextHealth = Math.min(999, nextHealth + healthLevelFactor + randomInt((healthLevelFactor >> 1) + 1));
    nextStamina = Math.min(9999, nextStamina + staminaAmount + randomInt((staminaAmount >> 1) + 1));

    updatedChampion = cloneChampionWithUpdatedMaximum(champion, {
        health: nextHealth,
        stamina: nextStamina,
        mana: nextMana,
        strength: nextStrength,
        dexterity: nextDexterity,
        wisdom: nextWisdom,
        vitality: nextVitality,
        antiMagic: nextAntiMagic,
        antiFire: nextAntiFire,
    });

    return updatedChampion;
}

function getEffectiveChampionStatsRuntime(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    currentVitals?: ChampionVitals,
    now = Date.now(),
) {
    return getEffectiveChampionStatsWithBonuses(
        champion,
        equip,
        getChampionRuntimeBonuses(champion, currentVitals, activePotionBoosts, now),
    );
}

/** Weapon stats for the item in a champion's right hand (or unarmed). */
function getRightHandStats(equip: import('../types/game').ChampionEquipment | undefined): {
    name: string; dmgMin: number; dmgMax: number; cooldownSec: number; skill: SkillKey;
} {
    const item = equip?.rightHand;
    const selectedAttack = getDefaultAttackOption(item);
    if (item?.category === 'Weapon') {
        const wt = WEAPON_TYPES[item.typeId];
        if (wt && wt.atkSpd > 0) {
            const skill = selectedAttack
                ? mapOriginalSkillNumberToSkillKey(selectedAttack.attack.skillNumber)
                : wt.type === 'Staff' || wt.type === 'Wand' ? 'wizard' : 'fighter';
            return {
                name: selectedAttack?.displayName ?? wt.name,
                dmgMin: wt.damage[0],
                dmgMax: wt.damage[1],
                cooldownSec: selectedAttack ? getAttackCooldownSeconds(selectedAttack) : wt.atkSpd / 10,
                skill,
            };
        }
    }
    return { name: 'Poing', dmgMin: 1, dmgMax: 4, cooldownSec: 2.0, skill: 'fighter' };
}

function buildAttackResultMessage(message: string, success = false): CastResult {
    return { success, message, ts: Date.now() };
}

function getSpellPowerLevelApprox(runeIds: readonly string[]): number {
    const powerRunes = ['lo', 'um', 'on', 'ee', 'pal', 'mon'];
    const index = powerRunes.indexOf(runeIds[0] ?? '');
    return index >= 0 ? index + 1 : 1;
}

function getSpellVisualScaleFromRunes(runeIds: readonly string[]): number {
    const powerLevel = getSpellPowerLevelApprox(runeIds);
    return 0.82 + ((powerLevel - 1) * 0.15);
}

function getThrownExplosionVisualScale(attackPower: number | undefined): number {
    const normalized = Math.max(24, Math.min(255, attackPower ?? 40));
    return 0.78 + ((normalized - 24) / 231) * 0.72;
}

function getThrownPotionExplosionEffect(item: FloorItem): Exclude<ProjectileEffect, 'physical'> | undefined {
    if (item.category !== 'Potion') return undefined;
    const def = getPotionDef(item.typeId, item.rawName);
    if (def?.effect === 'firebomb') return 'fireball';
    if (def?.effect === 'poisonCloud') return 'poison_cloud';
    return undefined;
}

function getOriginalCreaturePoisonAdjustedAttack(creatureTypeId: number, poisonAttack: number): number {
    if (poisonAttack <= 0) return 0;
    const creature = CREATURE_TYPES[creatureTypeId];
    if (!creature) return poisonAttack;
    if (creature.poisonResistance >= 15) return 0;
    return Math.floor(((poisonAttack + randomInt(4)) << 3) / (creature.poisonResistance + 1));
}

function rollOriginalExplosionBurstAttack(
    effect: Exclude<ProjectileEffect, 'physical'>,
    attackPower: number,
): number {
    if (attackPower <= 0) return 0;
    if (effect === 'poison_cloud') {
        return Math.max(1, Math.min(attackPower >> 5, 4) + randomInt(2));
    }
    const burstBase = (attackPower >> 1) + 1;
    return burstBase + randomInt(Math.max(1, burstBase)) + 1;
}

function rollOriginalPartyWideAttack(rawAttack: number): number {
    if (rawAttack <= 0) return 0;
    const randomAttack = (rawAttack >> 3) + 1;
    const centeredAttack = rawAttack - randomAttack;
    return Math.max(1, centeredAttack + randomInt(Math.max(1, randomAttack << 1)));
}

function rollOriginalDisruptNonMaterialAttack(
    nowMs: number,
    target: CreatureInstance,
    baseExplosionAttack: number,
): number {
    if (baseExplosionAttack <= 0 || !isLikelyNonMaterial(target)) return 0;
    if (!isMaterializerLike(target)) return baseExplosionAttack;
    if (!canDisruptNonMaterialTarget(nowMs, target)) return 0;

    const additionalAttack = baseExplosionAttack >> 3;
    const centeredAttack = Math.max(0, baseExplosionAttack - additionalAttack);
    const randomAdditionalAttack = (additionalAttack << 1) + 1;
    return Math.max(
        1,
        centeredAttack + randomInt(Math.max(1, randomAdditionalAttack)) + randomInt(4),
    );
}

function getProjectileDamageClass(effect: Exclude<ProjectileEffect, 'physical'>): MonsterDamageClassApprox {
    if (effect === 'fireball') return 'fire';
    return 'magic';
}

type IncomingAttackTypeApprox = OriginalAttackType | 'Lightning' | 'Normal';

function getPsychicAdjustedAttackApprox(attack: number, wisdom: number): number {
    const wisdomFactor = 115 - wisdom;
    if (wisdomFactor <= 0) return 0;
    return scaleOriginalAttackApprox(attack, 6, wisdomFactor);
}

function rollOriginalProjectileImpactAttackApprox(
    effect: Exclude<ProjectileEffect, 'physical'>,
    kineticEnergy: number,
    projectileAttack: number,
): { damage: number; attackType: IncomingAttackTypeApprox; poisonAttack: number } {
    if (kineticEnergy <= 0) {
        return { damage: 0, attackType: 'Normal', poisonAttack: 0 };
    }

    let attackType: IncomingAttackTypeApprox = 'Blunt';
    let attack = 0;

    if (effect === 'poison_bolt') {
        return {
            damage: 1,
            attackType: 'Magic',
            poisonAttack: Math.max(0, kineticEnergy),
        };
    }

    if (effect === 'slime') {
        attackType = 'Blunt';
        attack = randomInt(16);
        const poisonAttack = attack + 10;
        attack += randomInt(32);
        attack = Math.floor((attack + kineticEnergy) / 16) + 1;
        attack += randomInt(Math.floor(attack / 2) + 1) + randomInt(4);
        attack = Math.max(
            Math.floor(attack / 2),
            attack - (32 - Math.floor(projectileAttack / 8)),
        );
        return {
            damage: Math.max(0, attack),
            attackType,
            poisonAttack,
        };
    }

    if (effect === 'poison_cloud' || effect === 'disrupt_nonmaterial' || effect === 'open') {
        return {
            damage: 0,
            attackType: effect === 'open' ? 'Normal' : 'Magic',
            poisonAttack: 0,
        };
    }

    attackType = effect === 'lightning' ? 'Lightning' : 'Fire';
    attack = randomInt(16) + randomInt(16) + 10;
    if (effect === 'lightning') {
        attack *= 5;
    }

    attack = Math.floor((attack + kineticEnergy) / 16) + 1;
    attack += randomInt(Math.floor(attack / 2) + 1) + randomInt(4);
    attack = Math.max(
        Math.floor(attack / 2),
        attack - (32 - Math.floor(projectileAttack / 8)),
    );

    return {
        damage: Math.max(0, attack),
        attackType,
        poisonAttack: 0,
    };
}

function applyWoundsFromIncomingAttackApprox(
    vitals: ChampionVitals,
    champion: Champion,
    equip: ChampionEquipment | undefined,
    attack: number,
    allowedSlots: readonly ChampionWoundSlot[],
    extraBonuses?: Partial<EquipmentStatBonuses>,
): ChampionVitals {
    if (attack <= 0 || allowedSlots.length === 0) return vitals;

    const effective = getEffectiveChampionStatsWithBonuses(champion, equip, extraBonuses);
    let woundThreshold = adjustByAttributeApprox(randomInt(128) + 10, effective.vitality);
    if (attack <= woundThreshold) return vitals;

    let nextVitals = vitals;
    do {
        const unwounded = allowedSlots.filter((slot) => !nextVitals.wounds[slot]);
        const pool = unwounded.length > 0 ? unwounded : allowedSlots;
        const slot = pool[randomInt(pool.length)];
        if (slot) nextVitals = applyChampionWound(nextVitals, slot);
        woundThreshold <<= 1;
    } while (attack > woundThreshold && woundThreshold > 0);

    return nextVitals;
}

function resolveChampionIncomingAttackApprox(
    state: GameState,
    champion: Champion,
    currentVitals: ChampionVitals,
    rawAttack: number,
    attackType: IncomingAttackTypeApprox,
    allowedSlots: readonly ChampionWoundSlot[],
    nowMs: number,
): { damage: number; nextVitals: ChampionVitals } {
    if (rawAttack <= 0) return { damage: 0, nextVitals: currentVitals };

    const equip = state.championEquipment[champion.id] ?? {};
    const bonuses = getChampionRuntimeBonuses(champion, currentVitals, state.activePotionBoosts);
    let attack = rawAttack;

    if (attackType !== 'Normal') {
        let defense = 0;
        if (allowedSlots.length > 0) {
            for (const woundSlot of allowedSlots) {
                defense += computeChampionWoundDefenseApprox(
                    state,
                    champion.id,
                    champion,
                    currentVitals,
                    woundSlot,
                    attackType === 'Sharp',
                );
            }
            defense = Math.floor(defense / allowedSlots.length);
        }

        switch (attackType) {
            case 'Mental':
                attack = getPsychicAdjustedAttackApprox(attack, getEffectiveChampionStatsWithBonuses(champion, equip, bonuses).wisdom);
                break;
            case 'Magic':
                attack = getChampionAdjustedAttackFromResistanceApprox(champion, equip, attack, 'magic', bonuses);
                attack -= getActiveShieldDefenseApprox(state.activeShields, nowMs, 'magic', champion.id);
                break;
            case 'Fire':
                attack = getChampionAdjustedAttackFromResistanceApprox(champion, equip, attack, 'fire', bonuses);
                attack -= getActiveShieldDefenseApprox(state.activeShields, nowMs, 'fire', champion.id);
                break;
            case 'Impact':
                defense = Math.floor(defense / 2);
                break;
            case 'Blunt':
            case 'Sharp':
            case 'Blast':
            case 'Lightning':
                break;
        }

        if (attack <= 0) return { damage: 0, nextVitals: currentVitals };
        if (attackType !== 'Magic' && attackType !== 'Mental') {
            attack = scaleOriginalAttackApprox(attack, 6, Math.max(0, 130 - defense));
        }
        if (attack <= 0) return { damage: 0, nextVitals: currentVitals };
    }

    const damage = Math.max(0, attack);
    if (damage <= 0) return { damage: 0, nextVitals: currentVitals };

    let nextVitals: ChampionVitals = {
        ...currentVitals,
        hp: Math.max(0, currentVitals.hp - damage),
    };
    if (nextVitals.hp > 0 && attackType !== 'Normal') {
        nextVitals = applyWoundsFromIncomingAttackApprox(
            nextVitals,
            champion,
            equip,
            damage,
            allowedSlots,
            bonuses,
        );
    }

    return {
        damage: Math.max(0, currentVitals.hp - nextVitals.hp),
        nextVitals,
    };
}

function getOriginalSpellSuccessChance(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    currentVitals: ChampionVitals | undefined,
    spell: ReturnType<typeof findSpell>,
    skillLevel: number,
): number {
    if (!spell) return 0;
    const effective = getEffectiveChampionStatsRuntime(champion, equip, activePotionBoosts, currentVitals);
    const requiredSkillLevel = getOriginalSpellRequiredSkillLevel(spell.runes) ?? spell.manaBase;
    if (skillLevel >= requiredSkillLevel) return 1;
    const missingSkillLevels = requiredSkillLevel - skillLevel;
    const wisdomThreshold = Math.min(effective.wisdom + 15, 115);
    const singleCheckChance = Math.max(0, Math.min(1, (wisdomThreshold + 1) / 128));
    return Math.pow(singleCheckChance, missingSkillLevels);
}

function rollOriginalSpellCastSuccess(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    currentVitals: ChampionVitals | undefined,
    spell: ReturnType<typeof findSpell>,
    skillLevel: number,
): { success: boolean; requiredSkillLevel: number; missingSkillLevels: number; successChance: number } {
    if (!spell) {
        return {
            success: false,
            requiredSkillLevel: 0,
            missingSkillLevels: 0,
            successChance: 0,
        };
    }
    const effective = getEffectiveChampionStatsRuntime(champion, equip, activePotionBoosts, currentVitals);
    const requiredSkillLevel = getOriginalSpellRequiredSkillLevel(spell.runes) ?? spell.manaBase;
    const missingSkillLevels = Math.max(0, requiredSkillLevel - skillLevel);
    const successChance = getOriginalSpellSuccessChance(champion, equip, activePotionBoosts, currentVitals, spell, skillLevel);
    if (missingSkillLevels <= 0) {
        return {
            success: true,
            requiredSkillLevel,
            missingSkillLevels: 0,
            successChance,
        };
    }
    const wisdomThreshold = Math.min(effective.wisdom + 15, 115);
    for (let i = 0; i < missingSkillLevels; i++) {
        if (randomInt(128) > wisdomThreshold) {
            return {
                success: false,
                requiredSkillLevel,
                missingSkillLevels,
                successChance,
            };
        }
    }
    return {
        success: true,
        requiredSkillLevel,
        missingSkillLevels,
        successChance,
    };
}

function getFrontPosition(position: [number, number], direction: Direction): { x: number; y: number } {
    const [y, x] = position;
    if (direction === 'NORTH') return { x, y: y - 1 };
    if (direction === 'SOUTH') return { x, y: y + 1 };
    if (direction === 'EAST') return { x: x + 1, y };
    return { x: x - 1, y };
}

function isBlockedForProjectile(
    state: Pick<GameState, 'openDoors' | 'openWalls'>,
    level: number,
    x: number,
    y: number,
): boolean {
    const map = getMap(level);
    const tile = map.tiles[y]?.[x];
    if (!tile) return true;
    if (tile.type === 'Wall') return true;
    if (tile.type === 'TrickWall' && !state.openWalls.has(`${level},${y},${x}`)) return true;
    if (tile.type !== 'Door' || state.openDoors.has(`${level},${y},${x}`)) return false;
    const door = tile.objects.find((obj): obj is DoorObject => obj.category === 'Door');
    return doorBlocksThrownItems(door?.doorType);
}

function getClosedDoorAt(
    state: Pick<GameState, 'openDoors'>,
    level: number,
    x: number,
    y: number,
): { key: string; door: DoorObject } | null {
    const tile = getMap(level).tiles[y]?.[x];
    if (!tile || tile.type !== 'Door') return null;
    const key = `${level},${y},${x}`;
    if (state.openDoors.has(key)) return null;
    const door = tile.objects.find((obj): obj is DoorObject => obj.category === 'Door');
    return door ? { key, door } : null;
}

function tryBreakFrontDoor(
    state: Pick<GameState, 'level' | 'position' | 'direction' | 'openDoors' | 'championVitals'>,
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    selectedAttack: WeaponAttackOption | null,
): { openDoors: Set<string>; message: CastResult } | null {
    const { x, y } = getFrontPosition(state.position, state.direction);
    const tile = getMap(state.level).tiles[y]?.[x];
    if (!tile || tile.type !== 'Door') return null;

    const key = `${state.level},${y},${x}`;
    if (state.openDoors.has(key)) return null;

    const door = tile.objects.find((obj): obj is import('../types/game').DoorObject => obj.category === 'Door');
    if (!door?.destructChop) return null;

    const effective = getEffectiveChampionStatsRuntime(champion, equip, activePotionBoosts, state.championVitals[champion.id]);
    const weaponMax = equip?.rightHand?.category === 'Weapon'
        ? (WEAPON_TYPES[equip.rightHand.typeId]?.damage[1] ?? 0)
        : 0;
    const attackBonus = selectedAttack ? Math.max(0, selectedAttack.attack.strengthRequired) : 0;
    const breakPower = effective.strength + weaponMax + attackBonus + randomInt(16);
    if (breakPower < 34) {
        return {
            openDoors: state.openDoors,
            message: buildAttackResultMessage('La porte resiste.'),
        };
    }

    const newOpenDoors = new Set(state.openDoors);
    newOpenDoors.add(key);
    return {
        openDoors: newOpenDoors,
        message: buildAttackResultMessage('La porte cede.', true),
    };
}

function applyChampionAttackVitals(
    state: GameState,
    championId: number,
    champion: Champion,
    option: WeaponAttackOption | null,
) {
    const current = state.championVitals[championId];
    if (!current) return null;
    const effective = getEffectiveChampionStatsRuntime(
        champion,
        state.championEquipment[championId] ?? {},
        state.activePotionBoosts,
        current,
    );
    const staminaCost = option ? option.attack.staminaCost + randomInt(2) : 0;
    const nextVitals = {
        ...current,
        stamina: clampVital(current.stamina - staminaCost, effective.stamina),
    };
    return { current, nextVitals, effective };
}

function createChampionCombatState(cooldownSec: number, defenseModifier = 0): ChampionCombat {
    return {
        cooldown: cooldownSec,
        cooldownMax: cooldownSec > 0 ? cooldownSec : 1,
        defenseModifier,
    };
}

function getChampionMasteryLevel(
    state: GameState,
    championId: number,
    champion: Champion,
    skill: SkillKey,
): number {
    void champion;
    const equipment = state.championEquipment[championId];
    return getChampionSkillLevelFromXP(
        state.championXP[championId],
        state.championTemporaryXP[championId],
        skill,
        { bonusLevels: getEquipmentSkillLevelModifier(skill, equipment) },
    );
}

function originalThrowingDistance(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    currentStamina: number | undefined,
    item: FloorItem,
    descriptor: ReturnType<typeof getOriginalWeaponReference>,
    fighterMastery: number,
    ninjaMastery: number,
    extraBonuses?: Partial<EquipmentStatBonuses>,
): number {
    const effective = getEffectiveChampionStatsWithBonuses(champion, equip ?? {}, extraBonuses);
    let value = (Math.floor(Math.random() * 16)) + effective.strength;
    const itemWeight = descriptor?.weightKg ?? 0;
    const maxLoadThreshold = getChampionMaxLoad(champion, equip, undefined) / 16;

    if (itemWeight <= maxLoadThreshold) {
        value += itemWeight - 12;
    } else {
        const upperThreshold = ((maxLoadThreshold - 12) / 2) + maxLoadThreshold;
        if (itemWeight <= upperThreshold) {
            value += (itemWeight - maxLoadThreshold) / 2;
        } else {
            value -= 2 * (itemWeight - upperThreshold);
        }
    }

    if (item.category === 'Weapon' && descriptor) {
        value += descriptor.damage;
        let masteryBonus = 0;
        if (descriptor.rawClass === 0 || descriptor.rawClass === 2) masteryBonus = fighterMastery;
        if (descriptor.rawClass !== 0 && descriptor.rawClass < 16) masteryBonus += ninjaMastery;
        if (descriptor.rawClass >= 16 && descriptor.rawClass < 112) masteryBonus += ninjaMastery;
        value += 2 * masteryBonus;
    }

    const maxStamina = Math.max(1, champion.stamina);
    const stamina = Math.max(0, currentStamina ?? maxStamina);
    value *= stamina / maxStamina;

    return Math.max(0, Math.min(100, Math.floor(value / 2)));
}

function buildDroppedItem(item: FloorItem, level: number, x: number, y: number): FloorItem {
    return {
        ...item,
        mapIndex: level,
        x,
        y,
        tilePos: 'North',
    };
}

function buildDragThrowProjectile(
    state: GameState,
    championId: number,
    champion: Champion,
    item: FloorItem,
): Projectile {
    const equip = state.championEquipment[championId] ?? {};
    const descriptor = getOriginalWeaponReference(item);
    const fighterMastery = getChampionMasteryLevel(state, championId, champion, 'fighter');
    const ninjaMastery = getChampionMasteryLevel(state, championId, champion, 'ninja');
    const currentStamina = state.championVitals[championId]?.stamina;
    const throwRange = originalThrowingDistance(
        champion,
        equip,
        currentStamina,
        item,
        descriptor,
        fighterMastery,
        ninjaMastery,
        getChampionRuntimeBonuses(champion, state.championVitals[championId], state.activePotionBoosts),
    );
    const launchBonus = descriptor && descriptor.rawClass <= 12 ? descriptor.kineticEnergy : 1;
    const rawRange = throwRange + launchBonus;
    const finalRange = Math.max(1, rawRange + Math.floor(Math.random() * 8) + Math.floor(rawRange / 3) + ninjaMastery);
    const baseDamage = Math.max(6, descriptor?.damage ?? Math.round((descriptor?.weightKg ?? 1) * 8));
    const maxDamage = Math.max(10, baseDamage * 4 + fighterMastery * 3 + ninjaMastery * 4 + Math.floor(Math.random() * 18));
    const minDamage = Math.max(2, Math.floor(maxDamage * 0.55));
    const decay = Math.max(3, 9 - Math.min(6, ninjaMastery));
    const explosionOnImpact = getThrownPotionExplosionEffect(item);
    const explosionAttack = explosionOnImpact ? Math.max(1, item.potionPower ?? 40) : undefined;

    return {
        id: `drag_throw_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level: state.level,
        x: state.position[1],
        y: state.position[0],
        direction: state.direction,
        effect: 'physical',
        damage: [minDamage, maxDamage],
        nextMoveAt: Date.now(),
        remainingRange: finalRange,
        remainingAttack: maxDamage,
        stepDecay: decay,
        physicalItem: buildDroppedItem(item, state.level, state.position[1], state.position[0]),
        explosionOnImpact,
        explosionAttack,
    };
}

function buildCreatureProjectileApprox(
    state: GameState,
    creature: CreatureInstance,
    def: CreatureDef,
    effect: Exclude<ProjectileEffect, 'physical'>,
    targetChampionId: number | undefined,
    now: number,
): Projectile {
    let kineticEnergy = Math.max(1, Math.floor(def.rawAttack / 4) + 1);
    kineticEnergy += randomInt(Math.max(1, kineticEnergy));
    kineticEnergy += randomInt(Math.max(1, kineticEnergy));
    kineticEnergy = applyLimits(20, kineticEnergy, 255);

    return {
        id: `creature_proj_${creature.id}_${now}_${Math.random().toString(36).slice(2)}`,
        level: creature.mapIndex,
        x: creature.x,
        y: creature.y,
        direction: getPrimaryDirectionTowardTargetApprox(creature.x, creature.y, state.position[1], state.position[0]),
        effect,
        launchedBy: 'creature',
        sourceCreatureId: creature.id,
        targetChampionId,
        damage: [1, Math.max(1, kineticEnergy)],
        nextMoveAt: now + PROJECTILE_STEP_MS,
        remainingRange: kineticEnergy,
        remainingAttack: Math.max(1, def.dexterity),
        stepDecay: 8,
        visualScale: effect === 'lightning' ? 1.05 : effect === 'poison_cloud' ? 1.1 : effect === 'slime' ? 0.96 : 1,
    };
}

function buildDroppedItems(items: FloorItem[], level: number, x: number, y: number): FloorItem[] {
    return items.map((item) => buildDroppedItem(item, level, x, y));
}

function parseItemCharges(rawName: string | undefined): { charges?: number; maxCharges?: number } {
    if (!rawName) return {};
    const match = rawName.match(/\(Charges=(\d+)\)/i);
    if (!match) return {};
    const charges = Number(match[1]);
    return Number.isFinite(charges) ? { charges, maxCharges: charges } : {};
}

function getActionCharges(item: FloorItem | undefined): number | null {
    if (!item) return null;
    if (typeof item.actionCharges === 'number') return item.actionCharges;
    const parsed = parseItemCharges(item.rawName);
    return typeof parsed.charges === 'number' ? parsed.charges : null;
}

function updateEquippedItemCharges(
    equip: ChampionEquipment,
    slot: 'rightHand' | 'leftHand',
    remainingCharges: number | null,
): ChampionEquipment {
    if (remainingCharges === null) return equip;
    const item = equip[slot];
    if (!item) return equip;
    return {
        ...equip,
        [slot]: {
            ...item,
            actionCharges: remainingCharges,
            actionMaxCharges: item.actionMaxCharges ?? getActionCharges(item) ?? undefined,
        },
    };
}

function findQuiverAmmo(
    equip: ChampionEquipment | undefined,
    requiredRawClass: number | null,
): { slot: EquipSlotKey; item: FloorItem } | null {
    if (!equip || requiredRawClass === null) return null;
    for (const slot of QUIVER_SLOTS) {
        const item = equip[slot];
        if (item && matchesRequiredAmmoRawClass(item, requiredRawClass)) {
            return { slot, item };
        }
    }
    return null;
}

function randomInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(Math.random() * maxExclusive);
}

function applyLimits(min: number, value: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function isCharacterLuckyApprox(luck: number, luckNeeded: number): boolean {
    if (Math.random() < 0.5 && randomInt(100) > luckNeeded) return true;
    if (luck <= 0) return false;
    return randomInt(luck) > luckNeeded;
}

function tryStealBackpackItemApprox(
    championId: number,
    champion: Champion,
    state: GameState,
): { stolenItem: FloorItem | null; nextInventory: FloorItem[] } {
    const inventory = state.championInventories[championId] ?? [];
    if (inventory.length === 0) return { stolenItem: null, nextInventory: inventory };

    const equip = state.championEquipment[championId] ?? {};
    const effective = getEffectiveChampionStatsRuntime(champion, equip, state.activePotionBoosts, state.championVitals[championId]);
    let percentage = 100 - effective.dexterity;

    for (let attempts = 0; attempts < 8 && percentage > 0; attempts += 1) {
        if (isCharacterLuckyApprox(effective.luck, percentage)) {
            percentage -= 10;
            continue;
        }
        const index = randomInt(inventory.length);
        const stolenItem = inventory[index] ?? null;
        if (!stolenItem) break;
        return {
            stolenItem,
            nextInventory: inventory.filter((_, itemIndex) => itemIndex !== index),
        };
    }

    return { stolenItem: null, nextInventory: inventory };
}

function dropCreatureCarriedItems(
    creatures: CreatureInstance[],
    floorItems: FloorItem[],
    creatureId: string,
): { creatures: CreatureInstance[]; floorItems: FloorItem[] } {
    const index = creatures.findIndex((creature) => creature.id === creatureId);
    if (index < 0) return { creatures, floorItems };

    const creature = creatures[index];
    if (!creature) return { creatures, floorItems };
    const carriedItems = creature.carriedItems ?? [];
    if (carriedItems.length === 0) return { creatures, floorItems };

    const nextCreatures = [...creatures];
    nextCreatures[index] = { ...creature, carriedItems: [] };

    return {
        creatures: nextCreatures,
        floorItems: [...floorItems, ...buildDroppedItems(carriedItems, creature.mapIndex, creature.x, creature.y)],
    };
}

function computeOriginalQuicknessApprox(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    inventory: FloorItem[] | undefined,
    currentStamina: number | undefined,
    wounds?: ChampionWounds,
    extraBonuses?: Partial<EquipmentStatBonuses>,
): number {
    const effective = getEffectiveChampionStatsWithBonuses(champion, equip ?? {}, extraBonuses);
    let quickness = effective.dexterity + randomInt(8);
    const load = getTotalWeight(equip ?? {}, inventory ?? []);
    const maxLoad = Math.max(
        1,
        getChampionMaxLoad(champion, equip, currentStamina, wounds, extraBonuses),
    );
    quickness -= Math.floor(((quickness / 2) * load) / maxLoad);
    quickness = Math.floor(quickness / 2);
    const lowLimit = randomInt(8) + 1;
    const highLimit = 100 - randomInt(8);
    return applyLimits(lowLimit, quickness, highLimit);
}

function isLikelyNonMaterial(target: CreatureInstance): boolean {
    const def = CREATURE_TYPES[target.typeId];
    if (def) return def.nonMaterial;
    const name = CREATURE_TYPES[target.typeId]?.name ?? '';
    return /ghost|materializer|wizard eye|black flame|lord chaos/i.test(name);
}

function isMaterializerLike(target: CreatureInstance): boolean {
    const name = CREATURE_TYPES[target.typeId]?.name ?? '';
    return target.typeId === 19 || /materializer|zytaz/i.test(name);
}

function canDisruptNonMaterialTarget(nowMs: number, target: CreatureInstance): boolean {
    if (!isLikelyNonMaterial(target)) return false;
    if (!isMaterializerLike(target)) return true;
    return (creatureAttackWindows.get(target.id) ?? 0) > nowMs;
}

function nextMonsterMoveDelaySecondsApprox(moveTicks: number): number {
    return Math.max(1, moveTicks + randomInt(4) - 1) / 6;
}

function nextMonsterAttackDelaySecondsApprox(attackTicks: number): number {
    let ticks = attackTicks + randomInt(4) - 1;
    if (attackTicks > 15) {
        ticks += randomInt(8) - 2;
    }
    return Math.max(1, ticks) / 6;
}

type MonsterDamageClassApprox = 'physical' | 'fire' | 'magic' | 'mental';
type ArmorCoverageZone = 'head' | 'torso' | 'legs' | 'feet' | 'hands';

const MONSTER_HIT_ZONE_PATTERNS: readonly ArmorCoverageZone[][] = [
    ['head'],
    ['torso'],
    ['hands'],
    ['legs'],
    ['feet'],
    ['head', 'torso'],
    ['torso', 'hands'],
    ['torso', 'legs'],
    ['legs', 'feet'],
    ['head', 'hands'],
];

function getArmorDefenseApprox(
    typeId: number,
    rawName: string | undefined,
    useSharpDefense: boolean,
): number {
    const armorDef = getArmorDef(typeId, rawName);
    if (!armorDef) return 0;
    if (!useSharpDefense) return armorDef.armor;
    return Math.floor((armorDef.armor * ((armorDef.sharpDefense ?? 0) + 4)) / 8);
}

function getWoundSlotFactorApprox(slot: ChampionWoundSlot): number {
    switch (slot) {
        case 'rightHand':
            return I562_WOUND_DEFENSE_FACTORS[0] ?? 0;
        case 'leftHand':
            return I562_WOUND_DEFENSE_FACTORS[1] ?? 0;
        case 'head':
            return I562_WOUND_DEFENSE_FACTORS[2] ?? 0;
        case 'torso':
            return I562_WOUND_DEFENSE_FACTORS[3] ?? 0;
        case 'legs':
            return I562_WOUND_DEFENSE_FACTORS[4] ?? 0;
        case 'feet':
            return I562_WOUND_DEFENSE_FACTORS[5] ?? 0;
    }
}

function getChampionHandStrengthApprox(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    currentVitals: ChampionVitals | undefined,
    slot: 'rightHand' | 'leftHand',
    extraBonuses?: Partial<EquipmentStatBonuses>,
): number {
    const effective = getEffectiveChampionStatsWithBonuses(champion, equip ?? {}, extraBonuses);
    let value = randomInt(16) + effective.strength;
    const item = equip?.[slot];
    const itemWeight = item?.category === 'Armor'
        ? (getArmorDef(item.typeId, item.rawName)?.weight ?? 0)
        : 0;
    const maxLoadThreshold = getChampionMaxLoad(
        champion,
        equip,
        currentVitals?.stamina,
        currentVitals?.wounds,
        extraBonuses,
    ) / 16;

    if (itemWeight <= maxLoadThreshold) {
        value += itemWeight - 12;
    } else {
        const upperThreshold = ((maxLoadThreshold - 12) / 2) + maxLoadThreshold;
        if (itemWeight <= upperThreshold) {
            value += (itemWeight - maxLoadThreshold) / 2;
        } else {
            value -= 2 * (itemWeight - upperThreshold);
        }
    }

    const maxStamina = Math.max(1, effective.stamina);
    const stamina = Math.max(0, currentVitals?.stamina ?? maxStamina);
    value *= stamina / maxStamina;
    if (currentVitals?.wounds[slot]) {
        value /= 2;
    }
    return applyLimits(0, Math.floor(value / 2), 100);
}

function getChampionArmorSlotDefenseApprox(
    equip: ChampionEquipment | undefined,
    slot: ChampionWoundSlot,
    useSharpDefense: boolean,
): number {
    if (!equip) return 0;
    if (slot === 'rightHand' || slot === 'leftHand') return 0;
    const item = equip[slot];
    if (!item || item.category !== 'Armor') return 0;
    return getArmorDefenseApprox(item.typeId, item.rawName, useSharpDefense);
}

function computeChampionWoundDefenseApprox(
    state: GameState,
    championId: number,
    champion: Champion,
    currentVitals: ChampionVitals | undefined,
    woundSlot: ChampionWoundSlot,
    useSharpDefense: boolean,
): number {
    const equip = state.championEquipment[championId] ?? {};
    const effective = getEffectiveChampionStatsRuntime(champion, equip, state.activePotionBoosts, currentVitals);
    let woundDefense = randomInt((Math.max(0, effective.vitality) >> 3) + 1);
    if (useSharpDefense) {
        woundDefense = Math.floor(woundDefense / 2);
    }
    woundDefense += state.championCombat[championId]?.defenseModifier ?? 0;
    woundDefense += getChampionArmorSlotDefenseApprox(equip, woundSlot, useSharpDefense);

    for (const handSlot of ['rightHand', 'leftHand'] as const) {
        const item = equip[handSlot];
        if (!item || item.category !== 'Armor') continue;
        const armorDef = getArmorDef(item.typeId, item.rawName);
        if (!armorDef?.isShield) continue;

        const shieldStrength = getChampionHandStrengthApprox(
            champion,
            equip,
            currentVitals,
            handSlot,
            getChampionRuntimeBonuses(champion, currentVitals, state.activePotionBoosts),
        );
        const shieldArmorDefense = getArmorDefenseApprox(item.typeId, item.rawName, useSharpDefense);
        const factor = getWoundSlotFactorApprox(woundSlot);
        const shift = handSlot === woundSlot ? 4 : 5;
        woundDefense += Math.floor(((shieldStrength + shieldArmorDefense) * factor) / (1 << shift));
    }

    if (currentVitals?.wounds[woundSlot]) {
        woundDefense -= 8 + randomInt(4);
    }

    return applyLimits(0, Math.floor(woundDefense / 2), 100);
}

function getMonsterBaseDamageClass(originalAttackType: OriginalAttackType): MonsterDamageClassApprox {
    switch (originalAttackType) {
        case 'Fire':
            return 'fire';
        case 'Magic':
            return 'magic';
        case 'Mental':
            return 'mental';
        default:
            return 'physical';
    }
}

function resolveMonsterAttackTypeApprox(
    def: CreatureDef,
    attackMode: 'melee' | 'ranged',
): OriginalAttackType {
    if (attackMode === 'ranged') {
        if (def.attackTypes.includes('Fire')) return 'Fire';
        if (def.attackTypes.includes('Magic') || def.attackTypes.includes('StaminaDrain') || def.nonMaterial) {
            return 'Magic';
        }
    }
    return def.originalAttackType;
}

function getPrimaryDirectionTowardTargetApprox(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
): Direction {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? 'EAST' : 'WEST';
    }
    return dy >= 0 ? 'SOUTH' : 'NORTH';
}

function chooseOriginalCreatureProjectileEffectApprox(creatureTypeId: number): Exclude<ProjectileEffect, 'physical'> | null {
    switch (creatureTypeId) {
        case 1: // Swamp Slime / Slime Devil
            return 'slime';
        case 14: // Vexirk
        case 23: // Lord Chaos
            if (randomInt(2) !== 0) return 'fireball';
            switch (randomInt(4)) {
                case 0: return 'disrupt_nonmaterial';
                case 1: return 'lightning';
                case 2: return 'poison_cloud';
                default: return 'open';
            }
        case 3: // Wizard Eye
            return randomInt(8) !== 0 ? 'lightning' : 'open';
        case 19: // Materializer / Zytaz
            return randomInt(2) !== 0 ? 'poison_cloud' : 'fireball';
        case 22: // Demon
        case 24: // Red Dragon
            return 'fireball';
        default:
            return null;
    }
}

function chooseMonsterHitZonesApprox(
    damageClass: MonsterDamageClassApprox,
    attackType?: OriginalAttackType,
): readonly ArmorCoverageZone[] | undefined {
    if (damageClass === 'magic' || damageClass === 'mental') return undefined;
    if (attackType === 'Unconditional') return undefined;
    return MONSTER_HIT_ZONE_PATTERNS[randomInt(MONSTER_HIT_ZONE_PATTERNS.length)] ?? ['torso'];
}

function getChampionAdjustedAttackFromResistanceApprox(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    attack: number,
    damageClass: MonsterDamageClassApprox,
    extraBonuses?: Partial<EquipmentStatBonuses>,
): number {
    const effective = getEffectiveChampionStatsWithBonuses(champion, equip ?? {}, extraBonuses);
    if (damageClass === 'fire') {
        return adjustByAttributeApprox(attack, effective.antiFire);
    }
    if (damageClass === 'magic') {
        return adjustByAttributeApprox(attack, effective.antiMagic);
    }
    if (damageClass === 'mental') {
        return adjustByAttributeApprox(attack, effective.wisdom);
    }
    return attack;
}

function getActiveShieldDefenseApprox(
    shields: PartyShield[],
    nowMs: number,
    shieldKind: 'physical' | 'magic' | 'fire',
    championId?: number,
): number {
    const matchesChampion = (shield: PartyShield) =>
        shield.championId === undefined || shield.championId === championId;
    return shields
        .filter((shield) => shield.expiresAt > nowMs && matchesChampion(shield) && getPartyShieldKind(shield) === shieldKind)
        .reduce((sum, shield) => {
            if (shield.defense !== undefined) return sum + shield.defense;
            if (shield.protection !== undefined) return sum + Math.round(shield.protection * 64);
            return sum;
        }, 0);
}

function determineMonsterAttackDamageApprox(
    state: GameState,
    targetChampion: Champion,
    targetVitals: ChampionVitals,
    attacker: CreatureInstance,
    attackMode: 'melee' | 'ranged' = 'melee',
    nowMs = Date.now(),
): {
    damage: number;
    hitZones?: readonly ArmorCoverageZone[];
    damageClass: MonsterDamageClassApprox;
    nextVitals: ChampionVitals;
} {
    const def = CREATURE_TYPES[attacker.typeId];
    if (!def) return { damage: 0, damageClass: 'physical', nextVitals: targetVitals };

    const equip = state.championEquipment[targetChampion.id] ?? {};
    const inventory = state.championInventories[targetChampion.id] ?? [];
    const effective = getEffectiveChampionStatsRuntime(targetChampion, equip, state.activePotionBoosts, targetVitals);
    const resolvedAttackType = resolveMonsterAttackTypeApprox(def, attackMode);
    const resolvedDamageClass = getMonsterBaseDamageClass(resolvedAttackType);
    const hitZones = chooseMonsterHitZonesApprox(resolvedDamageClass, resolvedAttackType);
    const quickness = computeOriginalQuicknessApprox(
        targetChampion,
        equip,
        inventory,
        targetVitals.stamina,
        targetVitals.wounds,
        getChampionRuntimeBonuses(targetChampion, targetVitals, state.activePotionBoosts),
    );
    const levelDifficulty = getMap(state.level).difficulty * 2;
    const requiredQuickness = randomInt(32) + def.hitProb + levelDifficulty - 16;

    if (quickness >= requiredQuickness && randomInt(4) !== 0) {
        return { damage: 0, hitZones, damageClass: resolvedDamageClass, nextVitals: targetVitals };
    }

    if (isCharacterLuckyApprox(effective.luck, 60)) {
        return { damage: 0, hitZones, damageClass: resolvedDamageClass, nextVitals: targetVitals };
    }

    let attackValue = levelDifficulty + randomInt(16) + Math.max(1, Math.floor(def.rawAttack / 16));

    if (attackValue <= 1) {
        if (randomInt(2) !== 0) return { damage: 0, hitZones, damageClass: resolvedDamageClass, nextVitals: targetVitals };
        attackValue = randomInt(4) + 2;
    }

    const firstSpread = attackValue > 0 ? randomInt(attackValue) : 0;
    attackValue += firstSpread + randomInt(4);
    if (attackValue > 0) {
        attackValue += randomInt(attackValue);
    }
    attackValue = Math.floor(attackValue / 4);
    attackValue += randomInt(4) + 1;

    if (randomInt(2) !== 0) {
        attackValue -= randomInt(Math.floor(attackValue / 2) + 1) - 1;
    }

    const allowedSlots = chooseChampionWoundSlotsFromZones(hitZones);
    const resolved = resolveChampionIncomingAttackApprox(
        state,
        targetChampion,
        targetVitals,
        Math.max(0, attackValue),
        resolvedAttackType,
        allowedSlots,
        nowMs,
    );

    return {
        damage: resolved.damage,
        hitZones,
        damageClass: resolvedDamageClass,
        nextVitals: resolved.nextVitals,
    };
}

function getWeaponName(item: FloorItem | undefined): string {
    if (!item) return '';
    if (item.category === 'Weapon') return WEAPON_TYPES[item.typeId]?.name ?? item.rawName ?? '';
    return item.rawName ?? '';
}

function determineMeleeDamageApprox(
    state: GameState,
    championId: number,
    champion: Champion,
    equip: ChampionEquipment | undefined,
    attackOption: WeaponAttackOption | null,
    currentStamina: number | undefined,
    target: CreatureInstance,
): number {
    const inventory = state.championInventories[championId] ?? [];
    const effective = getEffectiveChampionStatsRuntime(
        champion,
        equip ?? {},
        state.activePotionBoosts,
        state.championVitals[championId],
    );
    const descriptor = getOriginalWeaponReference(equip?.rightHand);
    const attackBaseDamage = attackOption?.attack.baseDamage ?? 32;
    const strengthRequired = attackOption?.attack.strengthRequired ?? 0;
    const levelDifficulty = getMap(state.level).difficulty;
    const targetDef = CREATURE_TYPES[target.typeId];
    const weaponName = getWeaponName(equip?.rightHand);
    const nonMaterial = isLikelyNonMaterial(target);
    const isDisrupt = attackOption?.enumName === 'Disrupt';
    const vorpalOrDisrupt = /vorpal blade/i.test(weaponName) || isDisrupt;

    if (nonMaterial && !vorpalOrDisrupt) {
        return 0;
    }

    const quickness = computeOriginalQuicknessApprox(
        champion,
        equip,
        inventory,
        currentStamina,
        state.championVitals[championId]?.wounds,
        getChampionRuntimeBonuses(champion, state.championVitals[championId], state.activePotionBoosts),
    );
    const requiredQuickness = randomInt(32) + (targetDef?.hitProb ?? 40) + levelDifficulty - 16;
    const luckyHit = randomInt(4) === 0;
    if (
        quickness <= requiredQuickness &&
        !luckyHit &&
        !isCharacterLuckyApprox(effective.luck, 75 - strengthRequired)
    ) {
        return 0;
    }

    const throwingDistance = equip?.rightHand
        ? originalThrowingDistance(
            champion,
            equip,
            currentStamina,
            equip.rightHand,
            descriptor,
            getChampionMasteryLevel(state, championId, champion, 'fighter'),
            getChampionMasteryLevel(state, championId, champion, 'ninja'),
            getChampionRuntimeBonuses(champion, state.championVitals[championId], state.activePotionBoosts),
        )
        : Math.max(0, Math.floor((effective.strength + randomInt(16)) / 2));

    let attackValue = 0;
    if (throwingDistance !== 0) {
        attackValue = throwingDistance + randomInt(Math.floor(throwingDistance / 2) + 1);
        attackValue = Math.floor((attackValue * attackBaseDamage) / 32);

        let defenseValue = randomInt(32) + (targetDef?.armor ?? 20) + levelDifficulty;
        if (/diamond edge/i.test(weaponName)) defenseValue -= Math.floor(defenseValue / 4);
        else if (/executioner/i.test(weaponName)) defenseValue -= Math.floor(defenseValue / 8);

        attackValue = attackValue + randomInt(32) - defenseValue;
    }

    if (throwingDistance === 0 || attackValue <= 1) {
        let salvageRoll = randomInt(4);
        if (salvageRoll === 0) return 0;
        attackValue += randomInt(16);
        if (attackValue > 0 || randomInt(2) !== 0) {
            salvageRoll += randomInt(4);
            if (randomInt(4) === 0) {
                salvageRoll += Math.max(0, randomInt(16) + attackValue);
            }
        }
        attackValue = salvageRoll;
    }

    attackValue = Math.floor(attackValue / 2);
    const firstSpread = attackValue > 0 ? randomInt(attackValue) : 0;
    attackValue += randomInt(4) + firstSpread;
    if (attackValue > 0) {
        attackValue += randomInt(attackValue);
    }
    attackValue = Math.floor(attackValue / 4);
    attackValue += randomInt(4) + 1;

    if (/vorpal blade/i.test(weaponName) && !nonMaterial) {
        attackValue = Math.floor(attackValue / 2);
        if (attackValue === 0) return 0;
    }

    const mastery = getChampionMasteryLevel(
        state,
        championId,
        champion,
        attackOption ? mapOriginalSkillNumberToSkillKey(attackOption.attack.skillNumber) : 'fighter',
    );
    if (randomInt(64) < mastery) {
        attackValue += 10;
    }

    return Math.max(0, attackValue);
}

/** Living creatures directly in front of the party (up to 2, left then right). */
function creaturesInFront(
    level: number,
    position: [number, number],
    direction: Direction,
    creatures: import('../types/game').CreatureInstance[],
): import('../types/game').CreatureInstance[] {
    const [y, x] = position;
    const ty = direction === 'NORTH' ? y - 1 : direction === 'SOUTH' ? y + 1 : y;
    const tx = direction === 'EAST'  ? x + 1 : direction === 'WEST'  ? x - 1 : x;
    return creatures.filter(c => c.alive && c.mapIndex === level && c.y === ty && c.x === tx)
                    .sort((a, b) => (a.side === 'left' ? -1 : 1) - (b.side === 'left' ? -1 : 1));
}

// ─── Line-of-sight helper (grid ray — checks for wall/door blocking) ──────────

function hasLineOfSight(map: GameMap, level: number, openDoors: Set<string>, ax: number, ay: number, bx: number, by: number): boolean {
    const dx = bx - ax, dy = by - ay;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return true;
    for (let i = 1; i < steps; i++) {
        const cx = Math.round(ax + dx * i / steps);
        const cy = Math.round(ay + dy * i / steps);
        const tile = map.tiles[cy]?.[cx];
        if (!tile || tile.type === 'Wall' || tile.type === 'TrickWall') return false;
        if (tile.type === 'Door') {
            if (openDoors.has(`${level},${cy},${cx}`)) continue;
            const door = tile.objects.find((o): o is import('../types/game').DoorObject => o.category === 'Door');
            if (doorBlocksVision(door?.doorType)) return false;
        }
    }
    return true;
}

// ─── Pressure plate activation pub/sub (no Zustand — only drives animation) ──
type PlateListener = (level: number, x: number, y: number) => void;
const plateListeners = new Set<PlateListener>();
export function subscribePlateActivated(fn: PlateListener) {
    plateListeners.add(fn);
    return () => plateListeners.delete(fn);
}
function notifyPlateActivated(level: number, x: number, y: number) {
    for (const fn of plateListeners) fn(level, x, y);
}

interface PendingSensorEvent {
    level: number;
    sensorIndex: number;
    remaining: number;
}

// ─── Creature action pub/sub (drives sprite frame changes) ───────────────────
type CreatureActionListener = (id: string, action: 'move' | 'attack') => void;
const creatureActionListeners = new Set<CreatureActionListener>();
export function onCreatureAction(fn: CreatureActionListener): () => void {
    creatureActionListeners.add(fn);
    return () => { creatureActionListeners.delete(fn); };
}
function notifyCreatureAction(id: string, action: 'move' | 'attack'): void {
    for (const fn of creatureActionListeners) fn(id, action);
}

// ─── Creature timers (mutable, kept outside Zustand to avoid per-frame re-renders) ──
const creatureTimers = new Map<string, { mt: number; at: number }>();
const creatureAttackWindows = new Map<string, number>();
const creatureConfusedUntil = new Map<string, number>();
const creatureFluxcageUntil = new Map<string, number>();
const creatureFrightenedUntil = new Map<string, number>();
const creatureLastSeenPartyPos = new Map<string, { x: number; y: number; expiresAt: number }>();

function resetExternalCreatureRuntimeState(): void {
    creatureTimers.clear();
    creatureAttackWindows.clear();
    creatureConfusedUntil.clear();
    creatureFluxcageUntil.clear();
    creatureFrightenedUntil.clear();
    creatureLastSeenPartyPos.clear();
}

export function getCreatureFluxcageExpiry(id: string): number {
    return creatureFluxcageUntil.get(id) ?? 0;
}

// ─── Creature initialisation ──────────────────────────────────────────────────

function buildCreatureInstances(): CreatureInstance[] {
    const instances: CreatureInstance[] = [];
    // Track how many creatures already placed per tile key
    const tileSides = new Map<string, CreatureSide>();

    for (const map of getGameMaps()) {
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Creature') continue;
                    const co = obj as CreatureObject;
                    const def = CREATURE_TYPES[co.type];
                    if (!def) continue;
                    const moveSec = def.moveSpd / 6;
                    const atkSec  = def.atkSpd  / 6;
                    // Assign side: first creature on tile = 'left', second = 'right'
                    const tileKey = `${map.index},${tile.x},${tile.y}`;
                    const existing = tileSides.get(tileKey);
                    const side: CreatureSide = existing ? 'right' : 'left';
                    tileSides.set(tileKey, side);
                    const id = `${map.index}_${tile.x}_${tile.y}_${co.index}`;
                    creatureTimers.set(id, {
                        mt: Math.random() * moveSec,
                        at: Math.random() * atkSec,
                    });
                    instances.push({
                        id,
                        typeId: co.type,
                        mapIndex: map.index,
                        x: tile.x,
                        y: tile.y,
                        currentHP: co.hp > 0 ? co.hp : def.baseHP,
                        alive: true,
                        side,
                        carriedItems: [],
                    });
                }
            }
        }
    }
    return instances;
}

// ─── Floor item initialisation ────────────────────────────────────────────────

const ITEM_CATEGORIES = new Set(['Weapon', 'Armor', 'Potion', 'Scroll', 'Misc', 'Container']);

function buildFloorItems(): FloorItem[] {
    const items: FloorItem[] = [];
    for (const map of getGameMaps()) {
        for (const row of map.tiles) {
            for (const tile of row) {
                const isHallChampionTile =
                    map.index === 0 &&
                    tile.objects.some(obj =>
                        obj.category === 'Sensor' &&
                        (obj as SensorObject & { championGraphic?: number }).championGraphic !== undefined
                    );
                for (const obj of tile.objects) {
                    if (!ITEM_CATEGORIES.has(obj.category)) continue;
                    if (isHallChampionTile) continue;
                    const rawObj = obj as unknown as { type: number; power?: number; name?: string; text?: string };
                    items.push({
                        id: `${map.index}_${tile.x}_${tile.y}_${obj.category}_${obj.index}`,
                        category: obj.category as FloorItem['category'],
                        typeId: rawObj.type ?? 0,
                        rawName: resolveItemName(
                            obj.category as FloorItem['category'],
                            rawObj.type ?? 0,
                            obj.category === 'Scroll'
                                ? normalizeScrollText(rawObj.text ?? rawObj.name)
                                : (rawObj.text ?? rawObj.name),
                        ),
                        mapIndex: map.index,
                        x: tile.x,
                        y: tile.y,
                        tilePos: obj.tilePos,
                        actionCharges: parseItemCharges(rawObj.text ?? rawObj.name).charges,
                        actionMaxCharges: parseItemCharges(rawObj.text ?? rawObj.name).maxCharges,
                        potionPower: obj.category === 'Potion' ? rawObj.power : undefined,
                    });
                    items[items.length - 1] = normaliseWaterContainer(items[items.length - 1]!);
                }
            }
        }
    }
    return items;
}

function getChampionStarterLoadout(championId: number): { equipment: ChampionEquipment; inventory: FloorItem[] } {
    const loadout = buildChampionStarterLoadout(championId);
    return {
        equipment: Object.fromEntries(
            Object.entries(loadout.equipment).map(([slot, item]) => [slot, item ? normaliseWaterContainer({ ...item }) : item]),
        ) as ChampionEquipment,
        inventory: loadout.inventory.map((item) => normaliseWaterContainer({ ...item })),
    };
}

function createReincarnatedChampion(champion: Champion): Champion {
    const reduceReincarnatedStat = (value: number): number => {
        const reduced = value - (value >> 3);
        return Math.max(30, reduced);
    };

    const reincarnated: Champion = {
        ...champion,
        strength: reduceReincarnatedStat(champion.strength),
        dexterity: reduceReincarnatedStat(champion.dexterity),
        wisdom: reduceReincarnatedStat(champion.wisdom),
        vitality: reduceReincarnatedStat(champion.vitality),
        antiMagic: reduceReincarnatedStat(champion.antiMagic),
        antiFire: reduceReincarnatedStat(champion.antiFire),
        health: Math.max(1, champion.health >> 1),
        stamina: Math.max(1, champion.stamina >> 1),
        mana: Math.max(0, champion.mana >> 1),
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
    };

    const statisticKeys: Array<keyof Pick<Champion, 'luck' | 'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire'>> = [
        'luck',
        'strength',
        'dexterity',
        'wisdom',
        'vitality',
        'antiMagic',
        'antiFire',
    ];

    for (let i = 0; i < 12; i += 1) {
        const statKey = statisticKeys[randomInt(statisticKeys.length)];
        if (!statKey) continue;
        reincarnated[statKey] += 1;
    }

    return reincarnated;
}

function createViAltarRevivedChampion(champion: Champion): Champion {
    const revivedMaximumHealth = Math.max(25, champion.health - (champion.health >> 6) - 1);
    return {
        ...champion,
        health: revivedMaximumHealth,
    };
}

// ─── Teleporter initialisation ────────────────────────────────────────────────

function buildOpenTeleporters(): Set<string> {
    const open = new Set<string>();
    for (const map of getGameMaps()) {
        for (const row of map.tiles) {
            for (const tile of row) {
                if (tile.type === 'Teleporter' && tile.open) {
                    open.add(`${map.index},${tile.y},${tile.x}`);
                }
            }
        }
    }
    return open;
}

// ─── Wall-text initialisation ─────────────────────────────────────────────────

function buildVisibleTexts(): Set<string> {
    const visible = new Set<string>();
    for (const map of getGameMaps()) {
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Text') continue;
                    if ((obj as WallTextObject).visible) {
                        visible.add(`${map.index}_${tile.x}_${tile.y}_${obj.index}`);
                    }
                }
            }
        }
    }
    return visible;
}

// ─── Map helpers ──────────────────────────────────────────────────────────────

const getMap = (level: number): GameMap => getGameMap(level);

function isWallRevealableObject(obj: GameTile['objects'][number]): boolean {
    return obj.category !== 'Sensor' && obj.category !== 'Text' && obj.category !== 'Door';
}

function buildOpenPits(): Set<string> {
    const open = new Set<string>();
    for (const map of getGameMaps()) {
        for (const row of map.tiles) {
            for (const tile of row) {
                if (tile.type === 'Pit' && tile.open) {
                    open.add(`${map.index},${tile.y},${tile.x}`);
                }
            }
        }
    }
    return open;
}

function isDoorLockedByWallSensor(level: number, x: number, y: number): boolean {
    const map = getMap(level);
    for (const row of map.tiles) {
        for (const tile of row) {
            if (tile.type !== 'Wall' && tile.type !== 'TrickWall') continue;
            for (const object of tile.objects) {
                if (object.category !== 'Sensor') continue;
                const sensor = object as SensorObject;
                if (!isWallLockSensor(sensor)) continue;
                if (sensor.targetX === x && sensor.targetY === y) return true;
            }
        }
    }
    return false;
}

function isDoorControlledByMechanism(level: number, x: number, y: number): boolean {
    return getMapMechanisms(level).some((mechanism) =>
        mechanism.target?.x === x &&
        mechanism.target?.y === y &&
        mechanism.targetTileType === 'Door',
    );
}

function hasDoorButton(level: number, x: number, y: number): boolean {
    const tile = getMap(level).tiles[y]?.[x];
    if (!tile || tile.type !== 'Door') return false;
    return tile.objects.some((object) => object.category === 'Door' && (object as DoorObject).hasButton);
}

function getSelfRevealingWallSensor(tile: GameTile | undefined): SensorObject | null {
    if (!tile || tile.type !== 'Wall') return null;
    const sensors = tile.objects.filter(
        (obj): obj is SensorObject => obj.category === 'Sensor'
    );
    for (const sensor of sensors) {
        if ((sensor.type !== 1 && sensor.type !== 2) || sensor.targetX !== 0 || sensor.targetY !== 0 || !sensor.onceOnly) {
            continue;
        }
        const hasMountedObject = tile.objects.some((obj) =>
            isWallRevealableObject(obj) && obj.tilePos === sensor.tilePos
        );
        if (hasMountedObject) return sensor;
    }
    return null;
}

export function isSelfRevealingWallTile(level: number, x: number, y: number): boolean {
    return getSelfRevealingWallSensor(getMap(level).tiles[y]?.[x]) !== null;
}

export function getSelfRevealingWallFace(level: number, x: number, y: number): CardinalDir | null {
    return getSelfRevealingWallSensor(getMap(level).tiles[y]?.[x])?.tilePos ?? null;
}

export const MIRROR_WALL_MAP: Map<string, Champion> = new Map(
    getChampionStartPositions().map(pos => [`${pos.mapIndex},${pos.x},${pos.y}`, CHAMPION_BY_ID[pos.portraitId]])
);
export const MIRROR_FACE_MAP: Map<string, CardinalDir> = new Map(
    getChampionStartPositions().map(pos => [`${pos.mapIndex},${pos.x},${pos.y}`, pos.wallFace])
);

// ─── Vi Altar detection ───────────────────────────────────────────────────────
// Altars are Text objects on a tile whose text contains "ALTAR".
// Positions from dungeon.json: map0(5,17), map2(28,29), map5(24,28).
function isAltarTile(level: number, x: number, y: number): boolean {
    const map = getMap(level);
    const tile = map.tiles[y]?.[x];
    if (!tile) return false;
    return tile.objects.some(
        o => o.category === 'Text' && typeof (o as import('../types/game').WallTextObject).text === 'string'
            && (o as import('../types/game').WallTextObject).text!.includes('ALTAR')
    );
}

const FRONT_WALL_FACE_BY_DIRECTION: Record<Direction, CardinalDir> = {
    NORTH: 'South',
    SOUTH: 'North',
    EAST: 'West',
    WEST: 'East',
};

function getFrontWallTarget(level: number, position: [number, number], direction: Direction): {
    tile: GameTile | undefined;
    x: number;
    y: number;
    face: CardinalDir;
} {
    const [y0, x0] = position;
    const y = direction === 'NORTH' ? y0 - 1 : direction === 'SOUTH' ? y0 + 1 : y0;
    const x = direction === 'EAST' ? x0 + 1 : direction === 'WEST' ? x0 - 1 : x0;
    return {
        tile: getMap(level).tiles[y]?.[x],
        x,
        y,
        face: FRONT_WALL_FACE_BY_DIRECTION[direction],
    };
}

function isFacingFountain(level: number, position: [number, number], direction: Direction): boolean {
    const front = getFrontWallTarget(level, position, direction);
    return !!front.tile &&
        (front.tile.type === 'Wall' || front.tile.type === 'TrickWall') &&
        hasOriginalWallOverlayAt(level, front.x, front.y, front.face, 'Fountain');
}

// ─── Champion death helper ────────────────────────────────────────────────────
// Drops all inventory + equipment + a bones item at the party position.
// Returns the partial state update (does NOT update party — caller handles that).
function buildDeathDrop(
    state: {
        level: number;
        position: [number, number];
        party: Champion[];
        championInventories: Record<number, import('../types/game').FloorItem[]>;
        championEquipment: Record<number, import('../types/game').ChampionEquipment>;
        floorItems: import('../types/game').FloorItem[];
        deadChampions: Record<number, Champion>;
    },
    championId: number,
): {
    floorItems: import('../types/game').FloorItem[];
    championInventories: Record<number, import('../types/game').FloorItem[]>;
    championEquipment: Record<number, import('../types/game').ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    party: Champion[];
} {
    const [y, x] = state.position;
    const inv   = state.championInventories[championId] ?? [];
    const equip = state.championEquipment[championId] ?? {};

    const droppedItems: import('../types/game').FloorItem[] = [
        ...inv,
        ...(Object.values(equip).filter(Boolean) as import('../types/game').FloorItem[]),
    ].map(item => ({ ...item, mapIndex: state.level, x, y, tilePos: 'North' as const }));

    const bonesItem: import('../types/game').FloorItem = {
        id: `bones_${championId}_${Date.now()}`,
        category: 'Misc',
        typeId: 5,
        rawName: 'Bones',
        mapIndex: state.level,
        x,
        y,
        tilePos: 'North' as const,
        championId,
    };

    const champion = state.party.find(c => c.id === championId);
    return {
        floorItems: [...state.floorItems, ...droppedItems, bonesItem],
        championInventories: { ...state.championInventories, [championId]: [] },
        championEquipment:   { ...state.championEquipment,   [championId]: {} },
        deadChampions: champion
            ? { ...state.deadChampions, [championId]: champion }
            : state.deadChampions,
        party: state.party.filter(c => c.id !== championId),
    };
}

const isWalkable = (
    level: number,
    y: number,
    x: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    openPits: Set<string>,
): boolean => {
    const map = getMap(level);
    if (y < 0 || y >= map.height || x < 0 || x >= map.width) return false;
    const tile = map.tiles[y]?.[x];
    if (!tile) return false;
    if (tile.type === 'Wall') return false;
    if (tile.type === 'TrickWall') return openWalls.has(`${level},${y},${x}`);
    if (tile.type === 'Door') return openDoors.has(`${level},${y},${x}`);
    if (tile.type === 'Pit') return !openPits.has(`${level},${y},${x}`);
    return true;
};

function resolvePitLanding(
    level: number,
    y: number,
    x: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    openPits: Set<string>,
): { level: number; y: number; x: number } | null {
    let currentLevel = level;

    while (true) {
        const map = getGameMaps()[currentLevel];
        const tile = map?.tiles[y]?.[x];
        if (!tile) return null;
        if (tile.type !== 'Pit' || !openPits.has(`${currentLevel},${y},${x}`)) {
            return isWalkable(currentLevel, y, x, openDoors, openWalls, openPits)
                ? { level: currentLevel, y, x }
                : null;
        }

        currentLevel += 1;
        if (!getGameMaps()[currentLevel]) return null;
    }
}

const getTeleporter = (tile: GameTile): TeleporterObject | undefined =>
    tile.objects.find((o): o is TeleporterObject => o.category === 'Teleporter');

// ─── Sensor effect helper ─────────────────────────────────────────────────────

type SensorState = {
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    projectiles: Projectile[];
};

const WALL_SENSOR_FACE_MASK: Record<CardinalDir, number> = {
    North: 0x1,
    East: 0x2,
    South: 0x4,
    West: 0x8,
};

const CARDINAL_TO_DIRECTION: Record<CardinalDir, Direction> = {
    North: 'NORTH',
    East: 'EAST',
    South: 'SOUTH',
    West: 'WEST',
};

const WALL_LAUNCHER_SENSOR_TYPES = new Set([7, 8, 9, 10, 14, 15]);
const EXPLOSION_LAUNCHER_SENSOR_TYPES = new Set([8, 10]);
const NEW_OBJECT_LAUNCHER_SENSOR_TYPES = new Set([7, 9]);
const SINGLE_PROJECTILE_LAUNCHER_SENSOR_TYPES = new Set([7, 8, 14]);

function getWallLauncherExplosionEffect(sensorData: number): Exclude<ProjectileEffect, 'physical'> | null {
    switch (sensorData) {
        case 0: return 'fireball';
        case 2: return 'lightning';
        case 3: return 'disrupt_nonmaterial';
        case 4: return 'open';
        case 6: return 'poison_bolt';
        case 7: return 'poison_cloud';
        default: return null;
    }
}

function getWallLauncherWeaponTypeId(sensorData: number): number | null {
    switch (sensorData) {
        case 55: return 31; // Poison Dart
        default: return null;
    }
}

function buildWallLauncherProjectiles(
    level: number,
    wallX: number,
    wallY: number,
    sensor: SensorObject,
    now: number,
): Projectile[] {
    if (!WALL_LAUNCHER_SENSOR_TYPES.has(sensor.type)) return [];

    const direction = CARDINAL_TO_DIRECTION[sensor.tilePos];
    const { x: startX, y: startY } = getFrontPosition([wallY, wallX], direction);
    const launchMap = getMap(level);
    if (startY < 0 || startY >= launchMap.height || startX < 0 || startX >= launchMap.width) {
        return [];
    }

    const projectileCount = SINGLE_PROJECTILE_LAUNCHER_SENSOR_TYPES.has(sensor.type) ? 1 : 2;
    const kineticEnergy = Math.max(1, sensor.kineticEnergy ?? 1);
    const stepEnergy = Math.max(0, sensor.stepEnergy ?? 0);

    if (EXPLOSION_LAUNCHER_SENSOR_TYPES.has(sensor.type)) {
        const effect = getWallLauncherExplosionEffect(sensor.data);
        if (!effect) return [];
        return Array.from({ length: projectileCount }, (_, index) => ({
            id: `wall_launcher_${level}_${sensor.index}_${index}_${now}_${Math.random().toString(36).slice(2)}`,
            level,
            x: startX,
            y: startY,
            direction,
            effect,
            damage: effect === 'open' ? [0, 0] : [1, kineticEnergy],
            nextMoveAt: now + index * 40,
            remainingRange: kineticEnergy,
            remainingAttack: effect === 'open' ? 0 : 100,
            stepDecay: stepEnergy,
            visualScale: effect === 'poison_cloud' ? 1.08 : effect === 'lightning' ? 1.04 : 1,
        }));
    }

    if (NEW_OBJECT_LAUNCHER_SENSOR_TYPES.has(sensor.type)) {
        const weaponTypeId = getWallLauncherWeaponTypeId(sensor.data);
        if (weaponTypeId == null) return [];
        const rawName = resolveItemName('Weapon', weaponTypeId);
        const descriptor = WEAPON_TYPES[weaponTypeId];
        const baseDamage = Math.max(1, descriptor?.damage?.[1] ?? 1);
        return Array.from({ length: projectileCount }, (_, index) => ({
            id: `wall_launcher_item_${level}_${sensor.index}_${index}_${now}_${Math.random().toString(36).slice(2)}`,
            level,
            x: startX,
            y: startY,
            direction,
            effect: 'physical',
            damage: [baseDamage, Math.max(baseDamage, kineticEnergy)],
            nextMoveAt: now + index * 40,
            remainingRange: kineticEnergy,
            remainingAttack: Math.max(baseDamage, kineticEnergy),
            stepDecay: Math.max(1, stepEnergy),
            physicalItem: {
                id: `wall_launcher_item_drop_${level}_${sensor.index}_${index}_${now}_${Math.random().toString(36).slice(2)}`,
                category: 'Weapon',
                typeId: weaponTypeId,
                rawName,
                mapIndex: level,
                x: startX,
                y: startY,
                tilePos: sensor.tilePos,
            },
        }));
    }

    return [];
}

function getSensorStateKey(level: number, sensorIndex: number): string {
    return `${level}_${sensorIndex}`;
}

function buildSensorStateSnapshot(
    source: Pick<
        GameState,
        | 'openDoors'
        | 'openPits'
        | 'openTeleporters'
        | 'openWalls'
        | 'activeSensors'
        | 'firedSensors'
        | 'sensorRuntimeData'
        | 'sensorRotationOffsets'
        | 'visibleTexts'
    > & { projectiles?: Projectile[] },
): SensorState {
    return {
        openDoors: source.openDoors,
        openPits: source.openPits,
        openTeleporters: source.openTeleporters,
        openWalls: source.openWalls,
        activeSensors: source.activeSensors,
        firedSensors: source.firedSensors,
        sensorRuntimeData: source.sensorRuntimeData,
        sensorRotationOffsets: source.sensorRotationOffsets ?? {},
        visibleTexts: source.visibleTexts,
        projectiles: source.projectiles ?? [],
    };
}

function shouldRotateWallFaceAfterActivation(
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
    rotationOffsets: Record<string, number>,
): boolean {
    return getWallFaceSensorsInRuntimeOrder(level, x, y, face, rotationOffsets).some(hasWallFaceLocalRotationEffect);
}

function readWallSensorRuntimeData(level: number, sensor: SensorObject, ss: SensorState): number {
    return ss.sensorRuntimeData[getSensorStateKey(level, sensor.index)] ?? sensor.data;
}

function writeWallSensorRuntimeData(
    level: number,
    sensor: SensorObject,
    ss: SensorState,
    nextValue: number,
): Record<string, number> {
    const key = getSensorStateKey(level, sensor.index);
    const clampedValue = Math.max(0, Math.min(511, nextValue));
    const previousValue = ss.sensorRuntimeData[key] ?? sensor.data;
    if (previousValue === clampedValue) return ss.sensorRuntimeData;

    if (clampedValue === sensor.data) {
        if (!(key in ss.sensorRuntimeData)) return ss.sensorRuntimeData;
        const nextRuntimeData = { ...ss.sensorRuntimeData };
        delete nextRuntimeData[key];
        return nextRuntimeData;
    }

    return {
        ...ss.sensorRuntimeData,
        [key]: clampedValue,
    };
}

function applyToSet(s: Set<string>, key: string, action: string): Set<string> {
    const next = new Set(s);
    if (action === 'Set') next.add(key);
    else if (action === 'Clear') next.delete(key);
    else if (action === 'Toggle') {
        if (next.has(key)) next.delete(key);
        else next.add(key);
    }
    return next;
}

function applyDirectSensorTargetAction(
    sensor: SensorObject,
    level: number,
    ss: SensorState,
    action: SensorAction,
): Partial<SensorState> {
    const targetTile = getMap(level).tiles[sensor.targetY]?.[sensor.targetX];
    if (!targetTile) return {};
    const tKey = `${level},${sensor.targetY},${sensor.targetX}`;

    if (targetTile.type === 'Door') {
        return { openDoors: applyToSet(ss.openDoors, tKey, action) };
    }
    if (targetTile.type === 'Pit') {
        return { openPits: applyToSet(ss.openPits, tKey, action) };
    }
    if (targetTile.type === 'TrickWall') {
        return { openWalls: applyToSet(ss.openWalls, tKey, action) };
    }
    if (targetTile.type === 'Teleporter') {
        return { openTeleporters: applyToSet(ss.openTeleporters, tKey, action) };
    }
    const textObj = targetTile.objects.find(
        (o) => o.category === 'Text' && (o as WallTextObject).tilePos === sensor.targetDir,
    ) as WallTextObject | undefined;
    if (textObj) {
        const vKey = `${level}_${sensor.targetX}_${sensor.targetY}_${textObj.index}`;
        return { visibleTexts: applyToSet(ss.visibleTexts, vKey, action) };
    }
    return {};
}

function dispatchTriggeredSensorEffect(
    sensor: SensorObject,
    level: number,
    ss: SensorState,
    options?: { actionOverride?: SensorAction; updateSourceActive?: boolean },
): Partial<SensorState> {
    const action = options?.actionOverride ?? sensor.action;
    if (action === 'Hold') return {};

    const sensorKey = getSensorStateKey(level, sensor.index);
    if (sensor.onceOnly && ss.firedSensors.has(sensorKey)) return {};

    let cur: SensorState = sensor.onceOnly
        ? { ...ss, firedSensors: new Set([...ss.firedSensors, sensorKey]) }
        : ss;

    if (options?.updateSourceActive) {
        const nextActive = applyToSet(cur.activeSensors, sensorKey, action);
        if (nextActive !== cur.activeSensors) {
            cur = { ...cur, activeSensors: nextActive };
        }
    }

    // Original FTL semantics: regular sensors with a local target do not dispatch
    // an event toward a remote (x,y) target. They trigger only their local effect
    // (rotation / local XP), so they must not fall through to our direct target path.
    //
    // The extracted DM dungeon uses only the rotation-style local effects here.
    if (sensor.isLocal) {
        return diffSensorState(ss, cur);
    }

    const targetTile = getMap(level).tiles[sensor.targetY]?.[sensor.targetX];
    if (!targetTile) return diffSensorState(ss, cur);

    let targetPatch: Partial<SensorState>;
    if (targetTile.type === 'Wall' || targetTile.type === 'TrickWall') {
        targetPatch = processWallSquareEvent(sensor, level, cur, action);
    } else {
        targetPatch = applyDirectSensorTargetAction(sensor, level, cur, action);
    }

    return diffSensorState(ss, { ...cur, ...targetPatch } as SensorState);
}

function processWallSquareEvent(
    sourceSensor: SensorObject,
    level: number,
    ss: SensorState,
    sourceAction: SensorAction,
): Partial<SensorState> {
    const targetTile = getMap(level).tiles[sourceSensor.targetY]?.[sourceSensor.targetX];
    if (!targetTile || (targetTile.type !== 'Wall' && targetTile.type !== 'TrickWall')) {
        return {};
    }

    const faceMask = WALL_SENSOR_FACE_MASK[sourceSensor.targetDir];
    if (!faceMask) return {};

    let cur = ss;
    let changed = false;

    for (const obj of targetTile.objects) {
        if (obj.category !== 'Sensor') continue;
        const targetSensor = obj as SensorObject;
        if (targetSensor.tilePos !== sourceSensor.targetDir) continue;

        if (WALL_LAUNCHER_SENSOR_TYPES.has(targetSensor.type)) {
            const sensorKey = getSensorStateKey(level, targetSensor.index);
            if (targetSensor.onceOnly && cur.firedSensors.has(sensorKey)) continue;

            let nextCur = cur;
            if (targetSensor.onceOnly) {
                nextCur = {
                    ...nextCur,
                    firedSensors: new Set([...nextCur.firedSensors, sensorKey]),
                };
            }

            const launchedProjectiles = buildWallLauncherProjectiles(
                level,
                sourceSensor.targetX,
                sourceSensor.targetY,
                targetSensor,
                Date.now(),
            );
            if (launchedProjectiles.length > 0) {
                nextCur = {
                    ...nextCur,
                    projectiles: [...nextCur.projectiles, ...launchedProjectiles],
                };
            }

            if (nextCur !== cur) {
                cur = nextCur;
                changed = true;
            }
            continue;
        }

        if (targetSensor.type === 5) {
            const currentData = readWallSensorRuntimeData(level, targetSensor, cur);
            let nextData = currentData;
            if (sourceAction === 'Set') nextData = currentData | faceMask;
            else if (sourceAction === 'Clear') nextData = currentData & ~faceMask;
            else if (sourceAction === 'Toggle') nextData = currentData ^ faceMask;

            const nextRuntimeData = writeWallSensorRuntimeData(level, targetSensor, cur, nextData);
            if (nextRuntimeData !== cur.sensorRuntimeData) {
                cur = { ...cur, sensorRuntimeData: nextRuntimeData };
                changed = true;
            }

            const mask1 = nextData & 0x000f;
            const mask2 = (nextData & 0x00f0) >> 4;
            const conditionMet = (mask1 === mask2) !== targetSensor.revert;
            const effectiveAction = targetSensor.action === 'Hold'
                ? (conditionMet ? 'Set' : 'Clear')
                : (conditionMet ? targetSensor.action : null);
            if (!effectiveAction) continue;

            const gateEffect = dispatchTriggeredSensorEffect(targetSensor, level, cur, {
                actionOverride: effectiveAction,
            });
            if (Object.keys(gateEffect).length > 0) {
                cur = { ...cur, ...gateEffect } as SensorState;
                changed = true;
            }
            continue;
        }

        if (targetSensor.type === 6) {
            const currentData = readWallSensorRuntimeData(level, targetSensor, cur);
            const nextData = sourceAction === 'Set'
                ? Math.min(511, currentData + 1)
                : Math.max(0, currentData - 1);

            const nextRuntimeData = writeWallSensorRuntimeData(level, targetSensor, cur, nextData);
            if (nextRuntimeData !== cur.sensorRuntimeData) {
                cur = { ...cur, sensorRuntimeData: nextRuntimeData };
                changed = true;
            }

            const effectiveAction = targetSensor.action === 'Hold'
                ? ((((nextData === 0) ? 1 : 0) !== (targetSensor.revert ? 1 : 0)) ? 'Set' : 'Clear')
                : (nextData === 0 ? targetSensor.action : null);
            if (!effectiveAction) continue;

            const countdownEffect = dispatchTriggeredSensorEffect(targetSensor, level, cur, {
                actionOverride: effectiveAction,
            });
            if (Object.keys(countdownEffect).length > 0) {
                cur = { ...cur, ...countdownEffect } as SensorState;
                changed = true;
            }
        }
    }

    return changed ? diffSensorState(ss, cur) : {};
}

function computeSensorEffect(sensor: SensorObject, level: number, ss: SensorState): Partial<SensorState> {
    if (sensor.type === 5) return {};
    if (sensor.action === 'Hold') return {};

    const targetTile = getMap(level).tiles[sensor.targetY]?.[sensor.targetX];
    const updateSourceActive = targetTile?.type === 'Wall' || targetTile?.type === 'TrickWall';
    return dispatchTriggeredSensorEffect(sensor, level, ss, { updateSourceActive });
}

function findSensorByIndex(level: number, sensorIndex: number): SensorObject | null {
    const map = getMap(level);
    for (const row of map.tiles) {
        for (const tile of row) {
            for (const obj of tile.objects) {
                if (obj.category === 'Sensor' && (obj as SensorObject).index === sensorIndex) {
                    return obj as SensorObject;
                }
            }
        }
    }
    return null;
}

function queueOrComputeSensorEffect(
    sensor: SensorObject,
    level: number,
    ss: SensorState,
    pendingSensorEvents: PendingSensorEvent[],
): {
    sensorChanges: Partial<SensorState>;
    pendingSensorEvents: PendingSensorEvent[];
} {
    if (sensor.delay > 1) {
        const sKey = `${level}_${sensor.index}`;
        const nextFired = sensor.onceOnly && !ss.firedSensors.has(sKey)
            ? new Set([...ss.firedSensors, sKey])
            : ss.firedSensors;
        const alreadyQueued = pendingSensorEvents.some((event) => event.level === level && event.sensorIndex === sensor.index);
        return {
            sensorChanges: nextFired !== ss.firedSensors ? { firedSensors: nextFired } : {},
            pendingSensorEvents: alreadyQueued
                ? pendingSensorEvents
                : [...pendingSensorEvents, { level, sensorIndex: sensor.index, remaining: originalTimerTicksToSeconds(sensor.delay) }],
        };
    }

    return {
        sensorChanges: computeSensorEffect(sensor, level, ss),
        pendingSensorEvents,
    };
}

function processPendingSensorEvents(
    delta: number,
    pendingSensorEvents: PendingSensorEvent[],
    ss: SensorState,
): {
    sensorChanges: Partial<SensorState>;
    pendingSensorEvents: PendingSensorEvent[];
} {
    let cur = ss;
    const remainingEvents: PendingSensorEvent[] = [];
    let changed = false;

    for (const event of pendingSensorEvents) {
        const remaining = event.remaining - delta;
        if (remaining > 0) {
            remainingEvents.push({ ...event, remaining });
            continue;
        }

        const sensor = findSensorByIndex(event.level, event.sensorIndex);
        if (!sensor) continue;
        const effect = computeSensorEffect(sensor, event.level, cur);
        if (Object.keys(effect).length > 0) {
            if (effect.openDoors && effect.openDoors !== cur.openDoors) {
                const target = resolveDoorSoundTarget(sensor, event.level);
                playDoorMotion(
                    DOOR_TOGGLE_SOUND_DURATION_MS,
                    target ? getDoorSoundVolume(target.level, target.x, target.y) : DOOR_SOUND_MIN_VOLUME,
                );
            }
            cur = { ...cur, ...effect } as SensorState;
            changed = true;
            if (sensor.sound || sensor.type === 6) {
                playPlate();
            }
        }
    }

    return {
        sensorChanges: changed ? diffSensorState(ss, cur) : {},
        pendingSensorEvents: remainingEvents,
    };
}

function diffSensorState(before: SensorState, after: SensorState): Partial<SensorState> {
    const patch: Partial<SensorState> = {};
    if (after.openDoors !== before.openDoors) patch.openDoors = after.openDoors;
    if (after.openPits !== before.openPits) patch.openPits = after.openPits;
    if (after.openTeleporters !== before.openTeleporters) patch.openTeleporters = after.openTeleporters;
    if (after.openWalls !== before.openWalls) patch.openWalls = after.openWalls;
    if (after.activeSensors !== before.activeSensors) patch.activeSensors = after.activeSensors;
    if (after.firedSensors !== before.firedSensors) patch.firedSensors = after.firedSensors;
    if (after.sensorRuntimeData !== before.sensorRuntimeData) patch.sensorRuntimeData = after.sensorRuntimeData;
    if (after.sensorRotationOffsets !== before.sensorRotationOffsets) patch.sensorRotationOffsets = after.sensorRotationOffsets;
    if (after.visibleTexts !== before.visibleTexts) patch.visibleTexts = after.visibleTexts;
    if (after.projectiles !== before.projectiles) patch.projectiles = after.projectiles;
    return patch;
}

function partyHasRequiredItem(
    requiredName: string | undefined,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
): boolean {
    if (!requiredName) return false;
    for (const inventory of Object.values(inventories)) {
        if (inventory.some((item) => itemMatchesMechanismRequirement(item, requiredName))) return true;
    }
    for (const equip of Object.values(equipment)) {
        if (Object.values(equip ?? {}).some((item) => item && itemMatchesMechanismRequirement(item, requiredName))) return true;
    }
    return false;
}

function tileHasRequiredFloorItem(
    level: number,
    x: number,
    y: number,
    requiredName: string | undefined,
    floorItems: FloorItem[],
): boolean {
    if (!requiredName) return false;
    return floorItems.some((item) =>
        item.mapIndex === level && item.x === x && item.y === y && itemMatchesMechanismRequirement(item, requiredName),
    );
}

/** Map movement direction → wall face toward the player (for wall-push sensors). */
const PUSH_FACE: Record<string, string> = {
    NORTH: 'South', SOUTH: 'North', EAST: 'West', WEST: 'East',
};

function revealSelfWallMountedItems(
    floorItems: FloorItem[],
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
): FloorItem[] {
    let changed = false;
    const nextItems = floorItems.map((item) => {
        if (item.mapIndex !== level || item.x !== x || item.y !== y || item.tilePos !== face) {
            return item;
        }
        changed = true;
        return {
            ...item,
            x,
            y,
            tilePos: face,
        };
    });

    return changed ? nextItems : floorItems;
}

function buildCreatureDamageEvent(level: number, x: number, y: number, amount: number): DamageEvent {
    return {
        id: `dmg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level,
        target: 'creature',
        x,
        y,
        amount,
        ts: Date.now(),
    };
}

function buildChampionDamageEvent(level: number, championId: number, amount: number): DamageEvent {
    return {
        id: `champ_dmg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level,
        target: 'champion',
        championId,
        amount,
        ts: Date.now(),
    };
}

function buildDeathDustEvent(level: number, x: number, y: number): SpellVisualEvent {
    return {
        id: `deathdust_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level,
        x,
        y,
        effect: 'poison_cloud',
        ts: Date.now(),
        kind: 'death',
    };
}

function buildEndgameSpellEvent(
    effect: Exclude<ProjectileEffect, 'physical'>,
    level: number,
    x: number,
    y: number,
    ts: number,
    visualScale = 1.2,
): SpellVisualEvent {
    return {
        id: `endgame_${effect}_${ts}_${Math.random().toString(36).slice(2)}`,
        level,
        x,
        y,
        effect,
        visualScale,
        ts,
        kind: 'creature',
        height: 0.02,
    };
}

function buildActivePoisonCloud(
    level: number,
    x: number,
    y: number,
    remainingAttack: number,
    nextPulseGameTick: number,
    visualScale = 1,
): ActivePoisonCloud {
    return {
        id: `poisoncloud_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level,
        x,
        y,
        remainingAttack,
        nextPulseGameTick,
        visualScale,
    };
}

function buildLingeringPoisonCloudAfterImmediatePulse(
    level: number,
    x: number,
    y: number,
    initialAttack: number,
    nextPulseGameTick: number,
    visualScale = 1,
): ActivePoisonCloud | null {
    if (initialAttack < 6) return null;
    return buildActivePoisonCloud(level, x, y, initialAttack - 3, nextPulseGameTick, visualScale);
}

/** Trigger sensors on a wall tile when the player pushes against it. */
function triggerWallPushSensors(
    level: number,
    wx: number,
    wy: number,
    dir: string,
    ss: SensorState,
    pendingSensorEvents: PendingSensorEvent[],
): {
    sensorChanges: Partial<SensorState>;
    pendingSensorEvents: PendingSensorEvent[];
} {
    const tile = getMap(level).tiles[wy]?.[wx];
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return { sensorChanges: {}, pendingSensorEvents };
    const face = PUSH_FACE[dir];
    let cur: SensorState = ss;
    let changed = false;
    let nextPending = pendingSensorEvents;
    for (const obj of tile.objects) {
        if (obj.category !== 'Sensor') continue;
        const sensor = obj as SensorObject;
        if (sensor.tilePos !== face) continue;
        // Skip: lever (1), wall-button (2), lock (4 — needs item), special (127)
        if (sensor.type === 1 || sensor.type === 2 || sensor.type === 5 || sensor.type === 127 || isWallLockSensor(sensor)) continue;
        const queued = queueOrComputeSensorEffect(sensor, level, cur, nextPending);
        nextPending = queued.pendingSensorEvents;
        if (Object.keys(queued.sensorChanges).length > 0) {
            if (queued.sensorChanges.openDoors && queued.sensorChanges.openDoors !== cur.openDoors) {
                const target = resolveDoorSoundTarget(sensor, level);
                playDoorMotion(
                    DOOR_TOGGLE_SOUND_DURATION_MS,
                    target ? getDoorSoundVolume(target.level, target.x, target.y) : DOOR_SOUND_MIN_VOLUME,
                );
            }
            cur = { ...cur, ...queued.sensorChanges } as SensorState;
            changed = true;
        }
    }
    return {
        sensorChanges: changed ? diffSensorState(ss, cur) : {},
        pendingSensorEvents: nextPending,
    };
}

/** Try to use an item from party inventory on a type-4 lock sensor.
 *  Returns updated sensor state + consumed inventory if a matching key was found. */
function triggerLockSensors(
    level: number,
    wx: number,
    wy: number,
    face: string,
    ss: SensorState,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
    selectedItem?: { championId: number; itemId: string; fromSlot: EquipSlotKey | 'inventory' },
): {
    sensorChanges: Partial<SensorState>;
    newInventories: Record<number, FloorItem[]> | null;
    newEquipment: Record<number, ChampionEquipment> | null;
    matched: boolean;
} {
    const tile = getMap(level).tiles[wy]?.[wx];
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) {
        return { sensorChanges: {}, newInventories: null, newEquipment: null, matched: false };
    }
    let cur: SensorState = ss;
    let sensorChanged = false;
    let matched = false;
    let newInventories: Record<number, FloorItem[]> | null = null;
    let newEquipment: Record<number, ChampionEquipment> | null = null;

    const faceSensors = getWallFaceSensorsInRuntimeOrder(level, wx, wy, face as CardinalDir, ss.sensorRotationOffsets);
    for (const sensor of faceSensors) {
        if (!isWallLockSensor(sensor)) continue;

        const requiredName = getRequiredSensorItemName(sensor);
        const requiredData = sensor.data;
        let matchChampId: number | null = null;
        let matchItemId: string | null = null;
        let matchSlot: EquipSlotKey | null = null;

        if (selectedItem) {
            const fromEquip = selectedItem.fromSlot !== 'inventory';
            const candidate = fromEquip
                ? equipment[selectedItem.championId]?.[selectedItem.fromSlot as EquipSlotKey]
                : inventories[selectedItem.championId]?.find((item) => item.id === selectedItem.itemId);
            if (!candidate) continue;

            const matchesByName = itemMatchesMechanismRequirement(candidate, requiredName);
            const matchesByData = requiredName === undefined && itemToLockData(candidate.category, candidate.typeId) === requiredData;
            const matchesRequirement = matchesByName || matchesByData;
            const shouldTrigger = sensor.revert ? !matchesRequirement : matchesRequirement;
            if (!shouldTrigger) continue;

            matchChampId = selectedItem.championId;
            matchItemId = candidate.id;
            matchSlot = fromEquip ? selectedItem.fromSlot as EquipSlotKey : null;
        } else {
            if (sensor.revert) continue;
            for (const [cidStr, inv] of Object.entries(inventories)) {
                for (const item of inv) {
                    const matchesByName = itemMatchesMechanismRequirement(item, requiredName);
                    const matchesByData = requiredName === undefined && itemToLockData(item.category, item.typeId) === requiredData;
                    if (matchesByName || matchesByData) {
                        matchChampId = parseInt(cidStr);
                        matchItemId = item.id;
                        break;
                    }
                }
                if (matchChampId !== null) break;
            }
            if (matchChampId === null) {
                for (const [cidStr, equip] of Object.entries(equipment)) {
                    for (const [slotKey, item] of Object.entries(equip ?? {}) as Array<[EquipSlotKey, FloorItem | undefined]>) {
                        if (!item) continue;
                        const matchesByName = itemMatchesMechanismRequirement(item, requiredName);
                        const matchesByData = requiredName === undefined && itemToLockData(item.category, item.typeId) === requiredData;
                        if (matchesByName || matchesByData) {
                            matchChampId = parseInt(cidStr);
                            matchItemId = item.id;
                            matchSlot = slotKey;
                            break;
                        }
                    }
                    if (matchChampId !== null) break;
                }
            }
            if (matchChampId === null) continue;
        }

        if (isConsumableLockSensor(sensor)) {
            if (matchSlot) {
                if (newEquipment === null) newEquipment = { ...equipment };
                const equip = { ...(newEquipment[matchChampId] ?? equipment[matchChampId] ?? {}) };
                delete equip[matchSlot];
                newEquipment[matchChampId] = equip;
            } else {
                if (newInventories === null) newInventories = { ...inventories };
                const inv = newInventories[matchChampId] ?? inventories[matchChampId] ?? [];
                newInventories[matchChampId] = inv.filter((item) => item.id !== matchItemId);
            }
        }

        const effectiveSensor = sensor.type === 17 && !sensor.onceOnly
            ? { ...sensor, onceOnly: true }
            : sensor;
        const effect = computeSensorEffect(effectiveSensor, level, cur);
        if (Object.keys(effect).length > 0) {
            if (effect.openDoors && effect.openDoors !== cur.openDoors) {
                const target = resolveDoorSoundTarget(effectiveSensor, level);
                playDoorMotion(
                    DOOR_TOGGLE_SOUND_DURATION_MS,
                    target ? getDoorSoundVolume(target.level, target.x, target.y) : DOOR_SOUND_MIN_VOLUME,
                );
            }
            cur = { ...cur, ...effect } as SensorState;
            sensorChanged = true;
        }
        if (shouldRotateWallFaceAfterActivation(level, wx, wy, face as CardinalDir, cur.sensorRotationOffsets)) {
            cur = { ...cur, sensorRotationOffsets: rotateWallFaceSensors(level, wx, wy, face as CardinalDir, cur) };
            sensorChanged = true;
        }
        matched = true;
        break;
    }
    return {
        sensorChanges: sensorChanged ? diffSensorState(ss, cur) : {},
        newInventories,
        newEquipment,
        matched,
    };
}

function triggerAlcoveDepositSensor(
    level: number,
    wx: number,
    wy: number,
    face: string,
    ss: SensorState,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
    selectedItem: { championId: number; itemId: string; fromSlot: EquipSlotKey | 'inventory' },
): {
    sensorChanges: Partial<SensorState>;
    newInventories: Record<number, FloorItem[]> | null;
    newEquipment: Record<number, ChampionEquipment> | null;
    depositedItem: FloorItem | null;
    matched: boolean;
} {
    const tile = getMap(level).tiles[wy]?.[wx];
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) {
        return { sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false };
    }

    const fromEquip = selectedItem.fromSlot !== 'inventory';
    const candidate = fromEquip
        ? equipment[selectedItem.championId]?.[selectedItem.fromSlot as EquipSlotKey]
        : inventories[selectedItem.championId]?.find((item) => item.id === selectedItem.itemId);
    if (!candidate) {
        return { sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false };
    }

    const faceSensors = getWallFaceSensorsInRuntimeOrder(level, wx, wy, face as CardinalDir, ss.sensorRotationOffsets);
    for (const sensor of faceSensors) {
        if (!isWallAlcoveSensor(sensor)) continue;

        const requiredName = getRequiredSensorItemName(sensor);
        if (requiredName && !itemMatchesMechanismRequirement(candidate, requiredName)) continue;

        let newInventories: Record<number, FloorItem[]> | null = null;
        let newEquipment: Record<number, ChampionEquipment> | null = null;
        if (fromEquip) {
            newEquipment = { ...equipment };
            const equip = { ...(newEquipment[selectedItem.championId] ?? equipment[selectedItem.championId] ?? {}) };
            delete equip[selectedItem.fromSlot as EquipSlotKey];
            newEquipment[selectedItem.championId] = equip;
        } else {
            newInventories = { ...inventories };
            const inv = newInventories[selectedItem.championId] ?? inventories[selectedItem.championId] ?? [];
            newInventories[selectedItem.championId] = inv.filter((item) => item.id !== selectedItem.itemId);
        }

        const sensorKey = `${level}_${sensor.index}`;
        const activeSensors = applyToSet(ss.activeSensors, sensorKey, 'Set');
        const nextState = {
            ...ss,
            activeSensors,
            sensorRotationOffsets: shouldRotateWallFaceAfterActivation(level, wx, wy, face as CardinalDir, ss.sensorRotationOffsets)
                ? rotateWallFaceSensors(level, wx, wy, face as CardinalDir, { ...ss, activeSensors } as SensorState)
                : ss.sensorRotationOffsets,
        } as SensorState;
        return {
            sensorChanges: diffSensorState(ss, nextState),
            newInventories,
            newEquipment,
            depositedItem: { ...candidate, mapIndex: level, x: wx, y: wy, tilePos: sensor.tilePos },
            matched: true,
        };
    }

    return { sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false };
}

function triggerObjectExchangerSensor(
    level: number,
    wx: number,
    wy: number,
    face: string,
    ss: SensorState,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
    selectedItem: { championId: number; itemId: string; fromSlot: EquipSlotKey | 'inventory' },
): {
    sensorChanges: Partial<SensorState>;
    newInventories: Record<number, FloorItem[]> | null;
    newEquipment: Record<number, ChampionEquipment> | null;
    matched: boolean;
} {
    const tile = getMap(level).tiles[wy]?.[wx];
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) {
        return { sensorChanges: {}, newInventories: null, newEquipment: null, matched: false };
    }

    const fromEquip = selectedItem.fromSlot !== 'inventory';
    const candidate = fromEquip
        ? equipment[selectedItem.championId]?.[selectedItem.fromSlot as EquipSlotKey]
        : inventories[selectedItem.championId]?.find((item) => item.id === selectedItem.itemId);
    if (!candidate) {
        return { sensorChanges: {}, newInventories: null, newEquipment: null, matched: false };
    }

    const faceSensors = getWallFaceSensorsInRuntimeOrder(level, wx, wy, face as CardinalDir, ss.sensorRotationOffsets);
    for (const sensor of faceSensors) {
        if (!isWallObjectExchangerSensor(sensor)) continue;

        const requiredName = getRequiredSensorItemName(sensor);
        if (requiredName && !itemMatchesMechanismRequirement(candidate, requiredName)) continue;

        let newInventories: Record<number, FloorItem[]> | null = null;
        let newEquipment: Record<number, ChampionEquipment> | null = null;
        if (fromEquip) {
            newEquipment = { ...equipment };
            const equip = { ...(newEquipment[selectedItem.championId] ?? equipment[selectedItem.championId] ?? {}) };
            delete equip[selectedItem.fromSlot as EquipSlotKey];
            newEquipment[selectedItem.championId] = equip;
        } else {
            newInventories = { ...inventories };
            const inv = newInventories[selectedItem.championId] ?? inventories[selectedItem.championId] ?? [];
            newInventories[selectedItem.championId] = inv.filter((item) => item.id !== selectedItem.itemId);
        }

        const sensorKey = `${level}_${sensor.index}`;
        const activeSensors = applyToSet(ss.activeSensors, sensorKey, 'Set');
        let baseState = { ...ss, activeSensors } as SensorState;
        const effect = computeSensorEffect(sensor, level, baseState);
        if (effect.openDoors && effect.openDoors !== baseState.openDoors) {
            const target = resolveDoorSoundTarget(sensor, level);
            playDoorMotion(
                DOOR_TOGGLE_SOUND_DURATION_MS,
                target ? getDoorSoundVolume(target.level, target.x, target.y) : DOOR_SOUND_MIN_VOLUME,
            );
        }
        baseState = { ...baseState, ...effect } as SensorState;
        if (shouldRotateWallFaceAfterActivation(level, wx, wy, face as CardinalDir, baseState.sensorRotationOffsets)) {
            baseState = {
                ...baseState,
                sensorRotationOffsets: rotateWallFaceSensors(level, wx, wy, face as CardinalDir, baseState),
            };
        }
        return {
            sensorChanges: diffSensorState(ss, baseState),
            newInventories,
            newEquipment,
            matched: true,
        };
    }

    return { sensorChanges: {}, newInventories: null, newEquipment: null, matched: false };
}

function clearAlcoveStateOnPickup(item: FloorItem, state: Pick<GameState, 'openDoors' | 'openPits' | 'openTeleporters' | 'openWalls' | 'activeSensors' | 'firedSensors' | 'sensorRuntimeData' | 'sensorRotationOffsets' | 'visibleTexts'>): Partial<SensorState> {
    const tile = getMap(item.mapIndex).tiles[item.y]?.[item.x];
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return {};
    const faceSensors = getWallFaceSensorsInRuntimeOrder(item.mapIndex, item.x, item.y, item.tilePos, state.sensorRotationOffsets);
    for (const sensor of faceSensors) {
        if (!isWallAlcoveSensor(sensor)) continue;
        const requiredName = getRequiredSensorItemName(sensor);
        if (requiredName && !itemMatchesMechanismRequirement(item, requiredName)) continue;
        const ss = buildSensorStateSnapshot(state);
        const sensorKey = `${item.mapIndex}_${sensor.index}`;
        let nextState = { ...ss, activeSensors: applyToSet(ss.activeSensors, sensorKey, 'Clear') } as SensorState;
        if (shouldRotateWallFaceAfterActivation(item.mapIndex, item.x, item.y, item.tilePos, nextState.sensorRotationOffsets)) {
            nextState = {
                ...nextState,
                sensorRotationOffsets: rotateWallFaceSensors(item.mapIndex, item.x, item.y, item.tilePos, nextState),
            };
        }
        return diffSensorState(ss, nextState);
    }
    return {};
}

function triggerFloorSensors(
    level: number,
    x: number,
    y: number,
    ss: SensorState,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
    floorItems: FloorItem[],
    pendingSensorEvents: PendingSensorEvent[],
    mode: 'enter' | 'leave' = 'enter',
) : {
    sensorChanges: Partial<SensorState>;
    pendingSensorEvents: PendingSensorEvent[];
} {
    const tile = getMap(level).tiles[y]?.[x];
    if (!tile) return { sensorChanges: {}, pendingSensorEvents };
    let cur: SensorState = ss;
    let changed = false;
    let playedSound = false;
    let nextPending = pendingSensorEvents;
    for (const obj of tile.objects) {
        if (obj.category !== 'Sensor') continue;
        const sensor = obj as SensorObject;
        if (sensor.type === 127) continue;

        if (mode === 'leave') {
            if (sensor.action !== 'Hold') continue;
            if (isCreatureOnlyFloorSensor(sensor) || isGeneratorSensor(sensor) || isSpecificObjectFloorSensor(sensor)) continue;
            const effect = computeSensorEffect({ ...sensor, action: sensor.revert ? 'Set' : 'Clear' }, level, cur);
            if (Object.keys(effect).length > 0) {
                cur = { ...cur, ...effect } as SensorState;
                changed = true;
            }
            continue;
        }

        if (isCreatureOnlyFloorSensor(sensor) || isGeneratorSensor(sensor)) continue;
        if (isPartyPossessionSensor(sensor)) {
            const hasRequiredItem = partyHasRequiredItem(getRequiredSensorItemName(sensor), inventories, equipment);
            const shouldTrigger = sensor.revert ? !hasRequiredItem : hasRequiredItem;
            if (!shouldTrigger) continue;
        }
        if (isSpecificObjectFloorSensor(sensor)) {
            const hasRequiredItem = tileHasRequiredFloorItem(level, x, y, getRequiredSensorItemName(sensor), floorItems);
            const shouldTrigger = sensor.revert ? !hasRequiredItem : hasRequiredItem;
            if (!shouldTrigger) continue;
        }

        const queued = queueOrComputeSensorEffect(
            sensor.action === 'Hold' ? { ...sensor, action: 'Set' } : sensor,
            level,
            cur,
            nextPending,
        );
        nextPending = queued.pendingSensorEvents;
        if (Object.keys(queued.sensorChanges).length > 0) {
            if (queued.sensorChanges.openDoors && queued.sensorChanges.openDoors !== cur.openDoors) {
                const target = resolveDoorSoundTarget(sensor, level);
                playDoorMotion(
                    DOOR_TOGGLE_SOUND_DURATION_MS,
                    target ? getDoorSoundVolume(target.level, target.x, target.y) : DOOR_SOUND_MIN_VOLUME,
                );
            }
            cur = { ...cur, ...queued.sensorChanges } as SensorState;
            changed = true;
            if (sensor.sound && !playedSound) {
                playPlate();
                playedSound = true;
            }
        }
    }
    // Notify pressure-plate animation subscribers
    if (changed) notifyPlateActivated(level, x, y);
    return {
        sensorChanges: changed ? diffSensorState(ss, cur) : {},
        pendingSensorEvents: nextPending,
    };
}

function transitionFloorSensors(
    level: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    partySize: number,
    ss: SensorState,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
    floorItems: FloorItem[],
    pendingSensorEvents: PendingSensorEvent[],
): {
    sensorChanges: Partial<SensorState>;
    pendingSensorEvents: PendingSensorEvent[];
    blockedMessage?: string;
} {
    let cur = ss;
    let changed = false;
    let nextPending = pendingSensorEvents;
    let blockedMessage: string | undefined;

    const leave = triggerFloorSensors(level, fromX, fromY, cur, inventories, equipment, floorItems, nextPending, 'leave');
    nextPending = leave.pendingSensorEvents;
    if (Object.keys(leave.sensorChanges).length > 0) {
        cur = { ...cur, ...leave.sensorChanges } as SensorState;
        changed = true;
    }

    const isStartingGatePlate = level === 0 && toX === 6 && toY === 9;
    if (isStartingGatePlate && partySize === 0) {
        blockedMessage = 'Choose at least one adventurer, four is better !';
    } else {
        const enter = triggerFloorSensors(level, toX, toY, cur, inventories, equipment, floorItems, nextPending, 'enter');
        nextPending = enter.pendingSensorEvents;
        if (Object.keys(enter.sensorChanges).length > 0) {
            cur = { ...cur, ...enter.sensorChanges } as SensorState;
            changed = true;
        }
    }

    return {
        sensorChanges: changed ? diffSensorState(ss, cur) : {},
        pendingSensorEvents: nextPending,
        blockedMessage,
    };
}

// ─── Staircase connections (auto-generated from dungeon.json destMap/destX/destY) ─
// requireGate is retained for data compatibility, but the level 0 entrance is no longer hard-locked to a full party.

export const STAIR_CONNECTIONS: Array<{
    fromLevel: number; fromY: number; fromX: number;
    toLevel: number; toY: number; toX: number; dir: Direction;
    requireGate: boolean;
}> = [
    { fromLevel: 0,  fromY: 15, fromX: 3,  toLevel: 1,  toY: 1,  toX: 3,  dir: 'NORTH', requireGate: false },
    { fromLevel: 1,  fromY: 1,  fromX: 3,  toLevel: 0,  toY: 15, toX: 3,  dir: 'EAST',  requireGate: false },
    { fromLevel: 1,  fromY: 26, fromX: 6,  toLevel: 2,  toY: 30, toX: 1,  dir: 'EAST',  requireGate: false },
    { fromLevel: 2,  fromY: 30, fromX: 1,  toLevel: 1,  toY: 26, toX: 6,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 2,  fromY: 21, fromX: 25, toLevel: 3,  toY: 31, toX: 30, dir: 'NORTH', requireGate: false },
    { fromLevel: 3,  fromY: 8,  fromX: 6,  toLevel: 4,  toY: 8,  toX: 1,  dir: 'WEST',  requireGate: false },
    { fromLevel: 3,  fromY: 12, fromX: 7,  toLevel: 4,  toY: 12, toX: 2,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 3,  fromY: 31, fromX: 30, toLevel: 2,  toY: 21, toX: 25, dir: 'SOUTH', requireGate: false },
    { fromLevel: 4,  fromY: 8,  fromX: 1,  toLevel: 3,  toY: 8,  toX: 6,  dir: 'NORTH', requireGate: false },
    { fromLevel: 4,  fromY: 12, fromX: 2,  toLevel: 3,  toY: 12, toX: 7,  dir: 'WEST',  requireGate: false },
    { fromLevel: 4,  fromY: 25, fromX: 6,  toLevel: 5,  toY: 20, toX: 6,  dir: 'EAST',  requireGate: false },
    { fromLevel: 4,  fromY: 6,  fromX: 8,  toLevel: 5,  toY: 1,  toX: 8,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 5,  fromY: 20, fromX: 6,  toLevel: 4,  toY: 25, toX: 6,  dir: 'WEST',  requireGate: false },
    { fromLevel: 5,  fromY: 1,  fromX: 8,  toLevel: 4,  toY: 6,  toX: 8,  dir: 'NORTH', requireGate: false },
    { fromLevel: 5,  fromY: 25, fromX: 25, toLevel: 6,  toY: 25, toX: 25, dir: 'NORTH', requireGate: false },
    { fromLevel: 6,  fromY: 29, fromX: 22, toLevel: 7,  toY: 23, toX: 7,  dir: 'EAST',  requireGate: false },
    { fromLevel: 6,  fromY: 25, fromX: 25, toLevel: 5,  toY: 25, toX: 25, dir: 'SOUTH', requireGate: false },
    { fromLevel: 6,  fromY: 26, fromX: 27, toLevel: 7,  toY: 20, toX: 12, dir: 'EAST',  requireGate: false },
    { fromLevel: 7,  fromY: 5,  fromX: 3,  toLevel: 8,  toY: 11, toX: 11, dir: 'SOUTH', requireGate: false },
    { fromLevel: 7,  fromY: 20, fromX: 4,  toLevel: 8,  toY: 26, toX: 12, dir: 'SOUTH', requireGate: false },
    { fromLevel: 7,  fromY: 23, fromX: 7,  toLevel: 6,  toY: 29, toX: 22, dir: 'WEST',  requireGate: false },
    { fromLevel: 7,  fromY: 19, fromX: 8,  toLevel: 8,  toY: 25, toX: 16, dir: 'SOUTH', requireGate: false },
    { fromLevel: 7,  fromY: 23, fromX: 9,  toLevel: 8,  toY: 29, toX: 17, dir: 'EAST',  requireGate: false },
    { fromLevel: 7,  fromY: 20, fromX: 12, toLevel: 6,  toY: 26, toX: 27, dir: 'EAST',  requireGate: false },
    { fromLevel: 8,  fromY: 5,  fromX: 10, toLevel: 9,  toY: 0,  toX: 12, dir: 'SOUTH', requireGate: false },
    { fromLevel: 8,  fromY: 11, fromX: 11, toLevel: 7,  toY: 5,  toX: 3,  dir: 'NORTH', requireGate: false },
    { fromLevel: 8,  fromY: 26, fromX: 12, toLevel: 7,  toY: 20, toX: 4,  dir: 'EAST',  requireGate: false },
    { fromLevel: 8,  fromY: 17, fromX: 14, toLevel: 9,  toY: 12, toX: 16, dir: 'WEST',  requireGate: false },
    { fromLevel: 8,  fromY: 25, fromX: 16, toLevel: 7,  toY: 19, toX: 8,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 8,  fromY: 27, fromX: 16, toLevel: 9,  toY: 22, toX: 18, dir: 'SOUTH', requireGate: false },
    { fromLevel: 8,  fromY: 29, fromX: 17, toLevel: 7,  toY: 23, toX: 9,  dir: 'WEST',  requireGate: false },
    { fromLevel: 8,  fromY: 29, fromX: 19, toLevel: 9,  toY: 24, toX: 21, dir: 'EAST',  requireGate: false },
    { fromLevel: 9,  fromY: 0,  fromX: 4,  toLevel: 10, toY: 0,  toX: 4,  dir: 'WEST',  requireGate: false },
    { fromLevel: 9,  fromY: 0,  fromX: 12, toLevel: 8,  toY: 5,  toX: 10, dir: 'NORTH', requireGate: false },
    { fromLevel: 9,  fromY: 12, fromX: 16, toLevel: 8,  toY: 17, toX: 14, dir: 'EAST',  requireGate: false },
    { fromLevel: 9,  fromY: 22, fromX: 18, toLevel: 8,  toY: 27, toX: 16, dir: 'NORTH', requireGate: false },
    { fromLevel: 9,  fromY: 24, fromX: 18, toLevel: 10, toY: 24, toX: 18, dir: 'SOUTH', requireGate: false },
    { fromLevel: 9,  fromY: 24, fromX: 21, toLevel: 8,  toY: 29, toX: 19, dir: 'WEST',  requireGate: false },
    { fromLevel: 9,  fromY: 24, fromX: 23, toLevel: 10, toY: 24, toX: 23, dir: 'EAST',  requireGate: false },
    { fromLevel: 10, fromY: 0,  fromX: 4,  toLevel: 9,  toY: 0,  toX: 4,  dir: 'EAST',  requireGate: false },
    { fromLevel: 10, fromY: 24, fromX: 18, toLevel: 9,  toY: 24, toX: 18, dir: 'NORTH', requireGate: false },
    { fromLevel: 10, fromY: 26, fromX: 18, toLevel: 11, toY: 16, toX: 8,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 10, fromY: 24, fromX: 23, toLevel: 9,  toY: 24, toX: 23, dir: 'WEST',  requireGate: false },
    { fromLevel: 10, fromY: 28, fromX: 24, toLevel: 11, toY: 18, toX: 14, dir: 'NORTH', requireGate: false },
    { fromLevel: 10, fromY: 24, fromX: 25, toLevel: 11, toY: 14, toX: 15, dir: 'EAST',  requireGate: false },
    { fromLevel: 11, fromY: 16, fromX: 8,  toLevel: 10, toY: 26, toX: 18, dir: 'NORTH', requireGate: false },
    { fromLevel: 11, fromY: 18, fromX: 8,  toLevel: 12, toY: 8,  toX: 3,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 11, fromY: 12, fromX: 10, toLevel: 12, toY: 2,  toX: 5,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 11, fromY: 18, fromX: 14, toLevel: 10, toY: 28, toX: 24, dir: 'SOUTH', requireGate: false },
    { fromLevel: 11, fromY: 14, fromX: 15, toLevel: 10, toY: 24, toX: 25, dir: 'WEST',  requireGate: false },
    { fromLevel: 11, fromY: 16, fromX: 15, toLevel: 12, toY: 6,  toX: 10, dir: 'WEST',  requireGate: false },
    { fromLevel: 12, fromY: 8,  fromX: 3,  toLevel: 11, toY: 18, toX: 8,  dir: 'NORTH', requireGate: false },
    { fromLevel: 12, fromY: 10, fromX: 3,  toLevel: 13, toY: 8,  toX: 3,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 12, fromY: 2,  fromX: 5,  toLevel: 11, toY: 12, toX: 10, dir: 'NORTH', requireGate: false },
    { fromLevel: 12, fromY: 11, fromX: 6,  toLevel: 13, toY: 9,  toX: 6,  dir: 'EAST',  requireGate: false },
    { fromLevel: 12, fromY: 6,  fromX: 10, toLevel: 11, toY: 16, toX: 15, dir: 'EAST',  requireGate: false },
    { fromLevel: 13, fromY: 8,  fromX: 3,  toLevel: 12, toY: 10, toX: 3,  dir: 'NORTH', requireGate: false },
    { fromLevel: 13, fromY: 9,  fromX: 6,  toLevel: 12, toY: 11, toX: 6,  dir: 'WEST',  requireGate: false },
];

// ─── Start position ───────────────────────────────────────────────────────────

const HALL_START: [number, number] = [3, 1];
const HALL_START_DIR: Direction = 'SOUTH';

// ─── State interface ───────────────────────────────────────────────────────────

interface GameState {
    level: number;
    position: [number, number];
    direction: Direction;
    party: Champion[];
    gameOptions: GameOptions;
    /** Index (0-3) of the currently selected party slot — picks up items. */
    selectedChampionIndex: number;
    gamePhase: GamePhase;
    optionsModalOpen: boolean;
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    gateOpen: boolean;
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    pendingSensorEvents: PendingSensorEvent[];
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    /** Per-champion inventories, keyed by champion.id */
    championInventories: Record<number, FloorItem[]>;
    /** Per-champion equipment, keyed by champion.id */
    championEquipment: Record<number, ChampionEquipment>;
    /** Live HP / Stamina / Mana, keyed by champion.id */
    championVitals: Record<number, ChampionVitals>;
    /** Legacy save field kept for compatibility; no longer used to block mana regeneration. */
    championManaRegenBlockedUntilTick: Record<number, number>;
    elapsedGameTimeTicks: number;
    regenTickRemainder: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
    lastPartyMoveGameTick: number;
    movementCooldown: number;
    sleeping: boolean;
    endgameSequence: EndgameSequence | null;
    /** Result of the most recent spell cast attempt */
    lastCastResult: CastResult | null;
    /** Per-champion accumulated XP, keyed by champion.id */
    championXP: Record<number, ChampionXP>;
    /** Temporary per-skill XP that decays over time and affects current mastery */
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    /** Per-champion combat state (cooldown), keyed by champion.id */
    championCombat: Record<number, ChampionCombat>;
    /** Floating damage numbers, cleared after ~600 ms */
    damageEvents: DamageEvent[];
    /** Transient spell visuals for impacts and flashes */
    spellVisualEvents: SpellVisualEvent[];
    /** Doors currently crushing a creature: key → { phase, timer } */
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    /** Timestamp (ms) when each torch item (Weapon typeId 16) was first equipped */
    torchBurnStart: Record<string, number>;
    /** Active torch / light spells — extend fog visibility until expiry */
    spellLights: SpellLight[];
    /** Flying projectiles (fireball, lightning, …) */
    projectiles: Projectile[];
    /** Persistent poison clouds that pulse every original timer tick */
    activePoisonClouds: ActivePoisonCloud[];
    /** Active magic / fire shields — reduce incoming damage */
    activeShields: PartyShield[];
    /** Temporary boosts from consumed potions */
    activePotionBoosts: ActivePotionBoost[];
    /** Party is invisible until this timestamp (0 = not invisible) */
    invisibleUntil: number;
    /** Reveal hidden active until this timestamp (0 = inactive) */
    magicVisionUntil: number;
    /** See-through-walls active until this timestamp (0 = inactive) */
    seeThroughWallsUntil: number;
    /** Footprint spell active until this timestamp (0 = inactive) */
    footprintsUntil: number;
    /** Tile positions visited while footprint spell was active */
    footprintHistory: FootprintEntry[];
    /** Champions who have died — preserved for resurrection, keyed by champion.id */
    deadChampions: Record<number, Champion>;
    activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
    lastCreatureAttackGameTick: number;

    moveForward: () => void;
    moveBackward: () => void;
    strafeLeft: () => void;
    strafeRight: () => void;
    turnLeft: () => void;
    turnRight: () => void;

    addToParty: (champion: Champion, mode?: MirrorRecruitMode) => void;
    removeFromParty: (championId: number) => void;
    openMirror: (championId: number) => void;
    closeMirror: () => void;
    openPartyMember: (championId: number) => void;
    closePartyMember: () => void;
    tryOpenGate: () => void;
    showTransientMessage: (message: string, success?: boolean, durationMs?: number) => void;
    goToLevel: (level: number, pos: [number, number], dir: Direction) => void;
    toggleDoor: (x: number, y: number) => void;
    activateWallSensor: (mapIndex: number, x: number, y: number, sensorIndex: number) => void;
    killCreature: (id: string) => void;

    selectChampion: (index: number) => void;
    setGameOptions: (updater: Partial<GameOptions>) => void;
    openOptionsModal: () => void;
    closeOptionsModal: () => void;
    reorderParty: (fromIndex: number, toIndex: number) => void;
    castSpell: (championId: number, runeIds: string[]) => void;
    tickFrame: (delta: number, now: number) => void;
    regenTick: (delta: number) => void;
    gainXP: (championId: number, skill: SkillKey, amount: number) => void;
    attackFront: (championId: number, attackType?: number) => void;
    tickCombat: (delta: number) => void;
    tickMovement: (delta: number) => void;
    tickMonsters: (delta: number) => void;
    tickDoors: (delta: number) => void;
    tickSpells: (now: number) => void;
    pickupItem: (id: string) => void;
    pickupItemToChampion: (id: string, championId: number) => boolean;
    dropItem: (itemId: string, championId: number) => void;
    dropCarriedItem: (championId: number, itemId: string, fromSlot: EquipSlotKey | 'inventory') => boolean;
    throwCarriedItem: (championId: number, itemId: string, fromSlot: EquipSlotKey | 'inventory') => boolean;
    equipItem: (championId: number, slotKey: EquipSlotKey, itemId: string) => void;
    unequipItem: (championId: number, slotKey: EquipSlotKey) => void;
    giveItem: (fromChampionId: number, toChampionId: number, itemId: string) => void;
    giveEquippedItem: (fromChampionId: number, slotKey: EquipSlotKey, toChampionId: number) => void;
    killChampion: (championId: number) => void;
    resurrectChampion: (bonesItemId: string) => void;
    useItem: (championId: number, itemId: string, fromSlot?: EquipSlotKey | 'inventory') => void;
    fillWaterContainer: (championId: number, itemId: string) => void;
    sleep: () => void;
    wakeUp: () => void;
    enterDungeon: () => void;
    saveGame: () => boolean;
    loadGame: () => boolean;
    returnToTitle: () => void;
    useItemOnFrontWall: (championId: number, itemId: string, fromSlot: EquipSlotKey | 'inventory') => boolean;
    useFloorItemOnFrontWall: (itemId: string, championId: number) => boolean;
    beginFloorDrag: (itemId: string, pointerX: number, pointerY: number) => void;
    updateFloorDrag: (pointerX: number, pointerY: number) => void;
    endFloorDrag: () => void;
}

const DIRECTIONS: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

function seedTorchBurnStartFromEquipment(
    equipment: ChampionEquipment | undefined,
    currentTorchBurnStart: Record<string, number>,
): Record<string, number> {
    if (!equipment) return currentTorchBurnStart;

    let next = currentTorchBurnStart;
    for (const slot of ['rightHand', 'leftHand'] as const) {
        const item = equipment[slot];
        if (!item || item.category !== 'Weapon' || item.typeId !== 2) continue;
        if (next[item.id] !== undefined) continue;
        if (next === currentTorchBurnStart) next = { ...currentTorchBurnStart };
        next[item.id] = Date.now();
    }
    return next;
}

function getWallSensorRotationKey(level: number, x: number, y: number, face: CardinalDir): string {
    return `${level}_${x}_${y}_${face}`;
}

function getWallFaceSensorsInRuntimeOrder(
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
    rotationOffsets: Record<string, number>,
): SensorObject[] {
    const tile = getMap(level).tiles[y]?.[x];
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return [];
    const sensors = tile.objects.filter(
        (obj): obj is SensorObject => obj.category === 'Sensor' && obj.tilePos === face,
    );
    if (sensors.length <= 1) return sensors;

    const offsetRaw = rotationOffsets[getWallSensorRotationKey(level, x, y, face)] ?? 0;
    const offset = ((offsetRaw % sensors.length) + sensors.length) % sensors.length;
    if (offset === 0) return sensors;
    return [...sensors.slice(offset), ...sensors.slice(0, offset)];
}

function rotateWallFaceSensors(
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
    ss: SensorState,
): Record<string, number> {
    const sensors = getWallFaceSensorsInRuntimeOrder(level, x, y, face, {});
    if (sensors.length <= 1) return ss.sensorRotationOffsets;

    const key = getWallSensorRotationKey(level, x, y, face);
    const nextOffset = ((ss.sensorRotationOffsets[key] ?? 0) + 1) % sensors.length;
    if (nextOffset === 0) {
        if (!(key in ss.sensorRotationOffsets)) return ss.sensorRotationOffsets;
        const next = { ...ss.sensorRotationOffsets };
        delete next[key];
        return next;
    }
    return {
        ...ss.sensorRotationOffsets,
        [key]: nextOffset,
    };
}

function hasWallFaceLocalRotationEffect(sensor: SensorObject): boolean {
    return sensor.isLocal && (sensor.multipleValue === 1 || sensor.multipleValue === 2);
}

function advanceSurvivalTimeApprox(
    state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'championXP' | 'championTemporaryXP' | 'elapsedGameTimeTicks' | 'lastSurvivalEffectGameTick' | 'freezeLifeRemainingTicks' | 'lastPartyMoveGameTick' | 'activePotionBoosts'>,
    stepCount: number,
    options?: { sleeping?: boolean },
): {
    championVitals: Record<number, ChampionVitals>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    elapsedGameTimeTicks: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
    advancedMs: number;
} {
    let elapsedGameTimeTicks = state.elapsedGameTimeTicks;
    let lastSurvivalEffectGameTick = state.lastSurvivalEffectGameTick;
    let freezeLifeRemainingTicks = state.freezeLifeRemainingTicks;
    const championVitals: Record<number, ChampionVitals> = { ...state.championVitals };
    let championTemporaryXP: Record<number, ChampionTemporaryXP> = { ...state.championTemporaryXP };
    const sleeping = options?.sleeping ?? false;
    const survivalIntervalTicks = sleeping ? SLEEP_SURVIVAL_INTERVAL_TICKS : AWAKE_SURVIVAL_INTERVAL_TICKS;

    for (let step = 0; step < stepCount; step += 1) {
        elapsedGameTimeTicks += 1;
        if (freezeLifeRemainingTicks > 0) {
            freezeLifeRemainingTicks -= 1;
        }
        const timeCriteria = computeOriginalTimeCriteria(elapsedGameTimeTicks);
        const timeSinceLastPartyMove = elapsedGameTimeTicks - state.lastPartyMoveGameTick;
        const applySurvivalTick = (elapsedGameTimeTicks - lastSurvivalEffectGameTick) >= survivalIntervalTicks;
        if (applySurvivalTick) {
            lastSurvivalEffectGameTick = elapsedGameTimeTicks;
        }

        for (const champ of state.party) {
            const current = championVitals[champ.id];
            if (!current || current.hp <= 0) continue;

            const normalizedCurrent = normalizeChampionVitalsForChampion(champ, current);
            const effective = getEffectiveChampionStatsRuntime(
                champ,
                state.championEquipment[champ.id] ?? {},
                state.activePotionBoosts,
                normalizedCurrent,
            );
            const maxHP = effective.health;
            const maxStamina = effective.stamina;
            const maxMana = effective.mana;
            const championEquipment = state.championEquipment[champ.id];
            const wizardSkill =
                getChampionSkillLevelFromXP(
                    state.championXP[champ.id],
                    championTemporaryXP[champ.id],
                    'wizard',
                    { bonusLevels: getEquipmentSkillLevelModifier('wizard', championEquipment) },
                ) +
                getChampionSkillLevelFromXP(
                    state.championXP[champ.id],
                    championTemporaryXP[champ.id],
                    'priest',
                    { bonusLevels: getEquipmentSkillLevelModifier('priest', championEquipment) },
                );

            let next = normalizedCurrent;
            const currentTemporaryXP = normalizeChampionTemporaryXP(championTemporaryXP[champ.id]);
            let championTempChanged = false;
            const nextTemporaryXPForChampion = { ...currentTemporaryXP };
            for (const skillKey of Object.keys(nextTemporaryXPForChampion) as SkillKey[]) {
                if (nextTemporaryXPForChampion[skillKey] <= 0) continue;
                nextTemporaryXPForChampion[skillKey] -= 1;
                championTempChanged = true;
            }
            if (championTempChanged) {
                championTemporaryXP = {
                    ...championTemporaryXP,
                    [champ.id]: nextTemporaryXPForChampion,
                };
            }

            if (applySurvivalTick) {
                next = {
                    ...next,
                    currentStats: relaxChampionCurrentStatsTowardMaximum(champ, next.currentStats),
                };
                if (
                    maxMana > 0 &&
                    next.mana < maxMana &&
                    timeCriteria < (effective.wisdom + wizardSkill)
                ) {
                    let manaGain = Math.floor(maxMana / 40);
                    if (sleeping) {
                        manaGain <<= 1;
                    }
                    manaGain += 1;
                    const staminaCost = manaGain * Math.max(7, 16 - wizardSkill);
                    next = applyChampionStaminaDeltaOriginal(next, maxStamina, -staminaCost);
                    next = {
                        ...next,
                        mana: next.mana + Math.min(manaGain, maxMana - next.mana),
                    };
                } else if (next.mana > maxMana) {
                    next = { ...next, mana: next.mana - 1 };
                }

                let staminaGainCycleCount = 4;
                let staminaMagnitude = maxStamina;
                while (next.stamina < (staminaMagnitude >>= 1)) {
                    staminaGainCycleCount += 2;
                }

                let staminaDelta = 0;
                let staminaAmount = applyLimits(1, (maxStamina >> 8) - 1, 6);
                if (sleeping) {
                    staminaAmount <<= 1;
                }
                if (timeSinceLastPartyMove > 80) {
                    staminaAmount += 1;
                    if (timeSinceLastPartyMove > 250) {
                        staminaAmount += 1;
                    }
                }

                let food = next.food;
                let water = next.water;
                do {
                    const staminaAboveHalf = staminaGainCycleCount <= 4;
                    if (food < -512) {
                        if (staminaAboveHalf) {
                            staminaDelta -= staminaAmount;
                            food -= 2 * FOOD_DRAIN_SCALE;
                        }
                    } else {
                        if (food >= 0) {
                            staminaDelta += staminaAmount;
                        }
                        food -= (staminaAboveHalf ? 2 : staminaGainCycleCount >> 1) * FOOD_DRAIN_SCALE;
                    }

                    if (water < -512) {
                        if (staminaAboveHalf) {
                            staminaDelta -= staminaAmount;
                            water -= 1 * WATER_DRAIN_SCALE;
                        }
                    } else {
                        if (water >= 0) {
                            staminaDelta += staminaAmount;
                        }
                        water -= (staminaAboveHalf ? 1 : staminaGainCycleCount >> 2) * WATER_DRAIN_SCALE;
                    }
                    staminaGainCycleCount -= 1;
                } while (staminaGainCycleCount > 0 && ((next.stamina + staminaDelta) < maxStamina));

                next = applyChampionStaminaDeltaOriginal(next, maxStamina, staminaDelta);
                next = {
                    ...next,
                    food: clampFoodWater(food, MAX_FOOD),
                    water: clampFoodWater(water, MAX_WATER),
                };

                if (next.hp < maxHP && next.stamina >= (maxStamina >> 2) && timeCriteria < (effective.vitality + 12)) {
                    let healthGain = (maxHP >> 7) + 1;
                    if (sleeping) {
                        healthGain <<= 1;
                    }
                    if (state.championEquipment[champ.id]?.neck?.category === 'Misc' && state.championEquipment[champ.id]?.neck?.typeId === 38) {
                        healthGain += (healthGain >> 1) + 1;
                    }
                    next = {
                        ...next,
                        hp: Math.min(maxHP, next.hp + healthGain),
                    };
                }
            }

            if (next.poisonEntries.length > 0) {
                const updatedEntries: { remaining: number; nextTickIn: number }[] = [];
                for (const entry of next.poisonEntries) {
                    const nextTickIn = entry.nextTickIn - ORIGINAL_TIMER_TICK_SECONDS;
                    if (nextTickIn > 0) {
                        updatedEntries.push({ ...entry, nextTickIn });
                        continue;
                    }
                    next = {
                        ...next,
                        hp: Math.max(0, next.hp - Math.max(1, Math.floor(entry.remaining / 64))),
                    };
                    const nextRemaining = entry.remaining - 1;
                    if (nextRemaining > 0) {
                        updatedEntries.push({ remaining: nextRemaining, nextTickIn: POISON_TICK_INTERVAL_SEC });
                    }
                }
                next = { ...next, poisonEntries: updatedEntries };
            }

            championVitals[champ.id] = next;
        }
    }

    return {
        championVitals,
        championTemporaryXP,
        elapsedGameTimeTicks,
        lastSurvivalEffectGameTick,
        freezeLifeRemainingTicks,
        advancedMs: stepCount * (ORIGINAL_TIMER_TICK_SECONDS * 1000),
    };
}

function applyRegenTickApprox(state: GameState, delta: number): Partial<GameState> | null {
    let regenTickRemainder = state.regenTickRemainder + delta;
    const stepCount = Math.floor(regenTickRemainder / ORIGINAL_TIMER_TICK_SECONDS);
    regenTickRemainder -= stepCount * ORIGINAL_TIMER_TICK_SECONDS;

    if (stepCount <= 0) {
        return regenTickRemainder !== state.regenTickRemainder ? { regenTickRemainder } : null;
    }

    const advanced = advanceSurvivalTimeApprox(state, stepCount);
    return {
        championVitals: advanced.championVitals,
        championTemporaryXP: advanced.championTemporaryXP,
        elapsedGameTimeTicks: advanced.elapsedGameTimeTicks,
        lastSurvivalEffectGameTick: advanced.lastSurvivalEffectGameTick,
        freezeLifeRemainingTicks: advanced.freezeLifeRemainingTicks,
        regenTickRemainder,
    };
}

function isPartyRestedApprox(state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'activePotionBoosts'>): boolean {
    return state.party.every((champ) => {
        const vitals = state.championVitals[champ.id];
        if (!vitals || vitals.hp <= 0) return true;
        const effective = getEffectiveChampionStatsRuntime(
            champ,
            state.championEquipment[champ.id] ?? {},
            state.activePotionBoosts,
            vitals,
        );
        return vitals.hp >= effective.health && vitals.stamina >= effective.stamina && vitals.mana >= effective.mana;
    });
}

function applySleepFrameApprox(state: GameState, now: number): Partial<GameState> | null {
    if (!state.sleeping) return null;

    const advanced = advanceSurvivalTimeApprox(state, 1, { sleeping: true });
    const timedEffects = ageTimedEffectsByMs(state, advanced.advancedMs);
    const pendingPatch = processPendingSensorEvents(
        advanced.advancedMs / 1000,
        state.pendingSensorEvents,
        buildSensorStateSnapshot(state),
    );
    const hasPendingPatch =
        Object.keys(pendingPatch.sensorChanges).length > 0 ||
        pendingPatch.pendingSensorEvents !== state.pendingSensorEvents;
    const combatPatch = applyCombatTickApprox(state, 0, now);
    const restedState = {
        ...state,
        championVitals: advanced.championVitals,
        championTemporaryXP: advanced.championTemporaryXP,
    };

    return {
        championVitals: advanced.championVitals,
        championTemporaryXP: advanced.championTemporaryXP,
        elapsedGameTimeTicks: advanced.elapsedGameTimeTicks,
        lastSurvivalEffectGameTick: advanced.lastSurvivalEffectGameTick,
        freezeLifeRemainingTicks: advanced.freezeLifeRemainingTicks,
        regenTickRemainder: 0,
        ...timedEffects,
        ...(combatPatch ?? {}),
        ...(hasPendingPatch ? { ...pendingPatch.sensorChanges, pendingSensorEvents: pendingPatch.pendingSensorEvents } : {}),
        sleeping: !isPartyRestedApprox(restedState),
    };
}

function applyEndgameFrameApprox(state: GameState, now: number): Partial<GameState> | null {
    const sequence = state.endgameSequence;
    if (!sequence) return null;

    const age = now - sequence.startedAt;
    const burstPlan: Array<{ at: number; effect: Exclude<ProjectileEffect, 'physical'>; scale: number }> = [
        { at: 180, effect: 'fireball', scale: 1.05 },
        { at: 480, effect: 'fireball', scale: 1.12 },
        { at: 780, effect: 'fireball', scale: 1.2 },
        { at: 1080, effect: 'fireball', scale: 1.28 },
        { at: 1460, effect: 'disrupt_nonmaterial', scale: 1.1 },
        { at: 1780, effect: 'disrupt_nonmaterial', scale: 1.16 },
        { at: 2100, effect: 'disrupt_nonmaterial', scale: 1.22 },
        { at: 2420, effect: 'fireball', scale: 1.3 },
        { at: 2740, effect: 'disrupt_nonmaterial', scale: 1.34 },
        { at: 3120, effect: 'fireball', scale: 1.44 },
    ];
    const switchPlan: Array<{ at: number; typeId: number; stage: number }> = [
        { at: 1260, typeId: 25, stage: 1 },
        { at: 1940, typeId: 23, stage: 2 },
        { at: 2320, typeId: 25, stage: 3 },
        { at: 2720, typeId: 23, stage: 4 },
        { at: 3160, typeId: 25, stage: 5 },
        { at: 3560, typeId: 26, stage: 6 },
    ];

    let nextSequence = sequence;
    let spellVisualEvents = state.spellVisualEvents;
    let creatures = state.creatures;
    let changed = false;

    while (nextSequence.lastBurstIndex < burstPlan.length && age >= burstPlan[nextSequence.lastBurstIndex]!.at) {
        const burst = burstPlan[nextSequence.lastBurstIndex]!;
        spellVisualEvents = [
            ...spellVisualEvents,
            buildEndgameSpellEvent(burst.effect, sequence.level, sequence.x, sequence.y, now, burst.scale),
        ];
        nextSequence = {
            ...nextSequence,
            lastBurstIndex: nextSequence.lastBurstIndex + 1,
        };
        changed = true;
    }

    for (const switchStep of switchPlan) {
        if (age < switchStep.at || nextSequence.stage >= switchStep.stage) continue;
        const targetIndex = creatures.findIndex((creature) => creature.id === sequence.lordChaosId);
        if (targetIndex >= 0) {
            if (creatures === state.creatures) creatures = [...creatures];
            creatures[targetIndex] = {
                ...creatures[targetIndex]!,
                typeId: switchStep.typeId,
                currentHP: switchStep.typeId === 26 ? 10000 : Math.max(creatures[targetIndex]!.currentHP, 10000),
                alive: true,
                side: 'left',
            };
        }
        nextSequence = { ...nextSequence, stage: switchStep.stage };
        changed = true;
    }

    if (age >= 3720 && nextSequence.stage < 7) {
        creatures = creatures
            .filter((creature) => creature.id === sequence.lordChaosId || !creature.alive)
            .map((creature) => creature.id === sequence.lordChaosId ? { ...creature, typeId: 26, alive: true } : creature);
        nextSequence = { ...nextSequence, stage: 7 };
        changed = true;
    }

    if (age >= 4600) {
        return {
            creatures,
            spellVisualEvents,
            gamePhase: 'victory',
            endgameSequence: null,
            activeMirrorChampionId: null,
            activePartyMemberId: null,
            sleeping: false,
        };
    }

    return changed ? {
        ...(creatures !== state.creatures ? { creatures } : {}),
        ...(spellVisualEvents !== state.spellVisualEvents ? { spellVisualEvents } : {}),
        endgameSequence: nextSequence,
    } : null;
}

function applyMovementTickApprox(state: GameState, delta: number): Partial<GameState> | null {
    if (!Number.isFinite(state.movementCooldown)) {
        return { movementCooldown: 0 };
    }
    if (state.movementCooldown <= 0) return null;
    return { movementCooldown: Math.max(0, state.movementCooldown - delta) };
}

function applyCombatTickApprox(state: GameState, delta: number, now: number): Partial<GameState> | null {
    const updates: Record<number, ChampionCombat> = {};
    let combatChanged = false;
    for (const c of state.party) {
        const cb = state.championCombat[c.id];
        if (!cb) continue;
        if (cb.cooldown > 0) {
            const nextCooldown = Math.max(0, cb.cooldown - delta);
            updates[c.id] = {
                ...cb,
                cooldown: nextCooldown,
                defenseModifier: nextCooldown > 0 ? cb.defenseModifier : 0,
            };
            combatChanged = true;
        } else if (cb.defenseModifier !== 0) {
            updates[c.id] = { ...cb, defenseModifier: 0 };
            combatChanged = true;
        }
    }
    const newEvents = state.damageEvents.filter((e) => now - e.ts < DAMAGE_EVENT_LIFETIME_MS);
    const eventsChanged = newEvents.length !== state.damageEvents.length;
    if (!combatChanged && !eventsChanged) return null;
    return {
        ...(combatChanged ? { championCombat: { ...state.championCombat, ...updates } } : {}),
        ...(eventsChanged ? { damageEvents: newEvents } : {}),
    };
}

function applyPartyMoveFatigue(state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'championInventories' | 'activePotionBoosts'>): Record<number, ChampionVitals> | null {
    let changed = false;
    const nextVitals: Record<number, ChampionVitals> = { ...state.championVitals };

    for (const champ of state.party) {
        const current = state.championVitals[champ.id];
        if (!current || current.hp <= 0) continue;

        const equip = state.championEquipment[champ.id] ?? {};
        const inventory = state.championInventories[champ.id] ?? [];
        const effective = getEffectiveChampionStatsRuntime(champ, equip, state.activePotionBoosts, current);
        const load = getTotalWeight(equip, inventory);
        const maxLoad = Math.max(
            1,
            getChampionMaxLoad(
                champ,
                equip,
                current.stamina,
                current.wounds,
                getChampionRuntimeBonuses(champ, current, state.activePotionBoosts),
            ),
        );
        const staminaCost = Math.floor((load * 25) / maxLoad) + 1;
        const next = applyChampionStaminaDeltaOriginal(current, effective.stamina, -staminaCost);

        if (next !== current && (next.hp !== current.hp || next.stamina !== current.stamina)) {
            nextVitals[champ.id] = next;
            changed = true;
        }
    }

    return changed ? nextVitals : null;
}

function applyFrontRowWallBumpDamage(
    state: Pick<GameState, 'level' | 'position' | 'party' | 'championInventories' | 'championEquipment' | 'floorItems' | 'deadChampions' | 'selectedChampionIndex'>,
    championVitals: Record<number, ChampionVitals>,
): Partial<GameState> | null {
    const frontChampions = state.party
        .slice(0, 2)
        .filter((champion) => (championVitals[champion.id]?.hp ?? 0) > 0);

    if (frontChampions.length === 0) return null;

    let vitals = championVitals;
    const newlyDead: number[] = [];

    for (const champion of frontChampions) {
        const current = vitals[champion.id];
        if (!current || current.hp <= 0) continue;
        const damage = 1 + randomInt(3); // light wall impact: 1-3 HP
        const next = {
            ...current,
            hp: Math.max(0, current.hp - damage),
        };
        if (next.hp === current.hp) continue;
        if (vitals === championVitals) vitals = { ...championVitals };
        vitals[champion.id] = next;
        if (next.hp === 0) newlyDead.push(champion.id);
    }

    if (vitals === championVitals) return null;

    let party = state.party;
    let floorItems = state.floorItems;
    let championInventories = state.championInventories;
    let championEquipment = state.championEquipment;
    let deadChampions = state.deadChampions;

    for (const championId of newlyDead) {
        const partial = buildDeathDrop(
            {
                level: state.level,
                position: state.position,
                party,
                championInventories,
                championEquipment,
                floorItems,
                deadChampions,
            },
            championId,
        );
        party = partial.party;
        floorItems = partial.floorItems;
        championInventories = partial.championInventories;
        championEquipment = partial.championEquipment;
        deadChampions = partial.deadChampions;
    }

    const partialState: Partial<GameState> = {
        championVitals: vitals,
    };

    if (party !== state.party) {
        partialState.party = party;
        partialState.floorItems = floorItems;
        partialState.championInventories = championInventories;
        partialState.championEquipment = championEquipment;
        partialState.deadChampions = deadChampions;
        partialState.selectedChampionIndex = party.length > 0
            ? Math.min(state.selectedChampionIndex, party.length - 1)
            : 0;
    }

    return partialState;
}

function applyPartyFallImpactDamage(
    state: Pick<GameState, 'party' | 'championInventories' | 'championEquipment' | 'floorItems' | 'deadChampions' | 'selectedChampionIndex' | 'damageEvents'>,
    championVitals: Record<number, ChampionVitals>,
    landingLevel: number,
    landingPosition: [number, number],
): Partial<GameState> | null {
    const livingChampions = state.party.filter((champion) => (championVitals[champion.id]?.hp ?? 0) > 0);
    if (livingChampions.length === 0) return null;

    let vitals = championVitals;
    let damageEvents = state.damageEvents;
    const newlyDead: number[] = [];

    for (const champion of livingChampions) {
        const current = vitals[champion.id];
        if (!current || current.hp <= 0) continue;
        const damage = 2 + randomInt(5); // fall impact: 2-6 HP
        const next = {
            ...current,
            hp: Math.max(0, current.hp - damage),
        };
        if (next.hp === current.hp) continue;
        if (vitals === championVitals) vitals = { ...championVitals };
        vitals[champion.id] = next;
        damageEvents = [...damageEvents, buildChampionDamageEvent(landingLevel, champion.id, damage)];
        if (next.hp === 0) newlyDead.push(champion.id);
    }

    if (vitals === championVitals && damageEvents === state.damageEvents) return null;

    let party = state.party;
    let floorItems = state.floorItems;
    let championInventories = state.championInventories;
    let championEquipment = state.championEquipment;
    let deadChampions = state.deadChampions;

    for (const championId of newlyDead) {
        const partial = buildDeathDrop(
            {
                level: landingLevel,
                position: landingPosition,
                party,
                championInventories,
                championEquipment,
                floorItems,
                deadChampions,
            },
            championId,
        );
        party = partial.party;
        floorItems = partial.floorItems;
        championInventories = partial.championInventories;
        championEquipment = partial.championEquipment;
        deadChampions = partial.deadChampions;
    }

    const partialState: Partial<GameState> = {
        championVitals: vitals,
        damageEvents,
    };

    if (party !== state.party) {
        partialState.party = party;
        partialState.floorItems = floorItems;
        partialState.championInventories = championInventories;
        partialState.championEquipment = championEquipment;
        partialState.deadChampions = deadChampions;
        partialState.selectedChampionIndex = party.length > 0
            ? Math.min(state.selectedChampionIndex, party.length - 1)
            : 0;
    }

    return partialState;
}

function applyPartySpellBacklashDamage(
    state: Pick<
        GameState,
        | 'level'
        | 'position'
        | 'party'
        | 'championInventories'
        | 'championEquipment'
        | 'floorItems'
        | 'deadChampions'
        | 'selectedChampionIndex'
        | 'damageEvents'
        | 'activeShields'
        | 'activePotionBoosts'
    >,
    championVitals: Record<number, ChampionVitals>,
    effect: Exclude<ProjectileEffect, 'physical'>,
    rawDamage: number,
    nowMs: number,
): Partial<GameState> | null {
    const livingChampions = state.party.filter((champion) => (championVitals[champion.id]?.hp ?? 0) > 0);
    if (livingChampions.length === 0 || rawDamage <= 0) return null;

    const damageClass = getProjectileDamageClass(effect);
    let vitals = championVitals;
    let damageEvents = state.damageEvents;
    const newlyDead: number[] = [];

    for (const champion of livingChampions) {
        const current = vitals[champion.id];
        if (!current || current.hp <= 0) continue;

        let adjustedAttack = rollOriginalPartyWideAttack(rawDamage);
        const equip = state.championEquipment[champion.id] ?? {};
        adjustedAttack = getChampionAdjustedAttackFromResistanceApprox(
            champion,
            equip,
            adjustedAttack,
            damageClass,
            getChampionRuntimeBonuses(champion, current, state.activePotionBoosts),
        );
        if (damageClass === 'fire') {
            adjustedAttack -= getActiveShieldDefenseApprox(state.activeShields, nowMs, 'fire', champion.id);
        } else if (damageClass === 'magic') {
            adjustedAttack -= getActiveShieldDefenseApprox(state.activeShields, nowMs, 'magic', champion.id);
        }
        if (adjustedAttack <= 0) continue;
        const damage = Math.max(1, adjustedAttack);
        const next = {
            ...current,
            hp: Math.max(0, current.hp - damage),
        };
        if (next.hp === current.hp) continue;
        if (vitals === championVitals) vitals = { ...championVitals };
        vitals[champion.id] = next;
        damageEvents = [...damageEvents, buildChampionDamageEvent(state.level, champion.id, damage)];
        if (next.hp === 0) newlyDead.push(champion.id);
    }

    if (vitals === championVitals && damageEvents === state.damageEvents) return null;

    let party = state.party;
    let floorItems = state.floorItems;
    let championInventories = state.championInventories;
    let championEquipment = state.championEquipment;
    let deadChampions = state.deadChampions;

    for (const championId of newlyDead) {
        const partial = buildDeathDrop(
            {
                level: state.level,
                position: state.position,
                party,
                championInventories,
                championEquipment,
                floorItems,
                deadChampions,
            },
            championId,
        );
        party = partial.party;
        floorItems = partial.floorItems;
        championInventories = partial.championInventories;
        championEquipment = partial.championEquipment;
        deadChampions = partial.deadChampions;
    }

    const partialState: Partial<GameState> = {
        championVitals: vitals,
        damageEvents,
    };

    if (party !== state.party) {
        partialState.party = party;
        partialState.floorItems = floorItems;
        partialState.championInventories = championInventories;
        partialState.championEquipment = championEquipment;
        partialState.deadChampions = deadChampions;
        partialState.selectedChampionIndex = party.length > 0
            ? Math.min(state.selectedChampionIndex, party.length - 1)
            : 0;
    }

    return partialState;
}

function applyPartyWideIncomingAttackApprox(
    state: Pick<
        GameState,
        | 'level'
        | 'position'
        | 'party'
        | 'championInventories'
        | 'championEquipment'
        | 'floorItems'
        | 'deadChampions'
        | 'selectedChampionIndex'
        | 'damageEvents'
        | 'activeShields'
        | 'activePotionBoosts'
        | 'championCombat'
    >,
    championVitals: Record<number, ChampionVitals>,
    rawAttack: number,
    attackType: IncomingAttackTypeApprox,
    allowedSlots: readonly ChampionWoundSlot[],
    nowMs: number,
    spread = true,
): Partial<GameState> | null {
    const livingChampions = state.party.filter((champion) => (championVitals[champion.id]?.hp ?? 0) > 0);
    if (livingChampions.length === 0 || rawAttack <= 0) return null;

    let vitals = championVitals;
    let damageEvents = state.damageEvents;
    const newlyDead: number[] = [];

    for (const champion of livingChampions) {
        const current = vitals[champion.id];
        if (!current || current.hp <= 0) continue;

        const resolved = resolveChampionIncomingAttackApprox(
            state as GameState,
            champion,
            current,
            spread ? rollOriginalPartyWideAttack(rawAttack) : rawAttack,
            attackType,
            allowedSlots,
            nowMs,
        );
        if (resolved.damage <= 0) continue;

        if (vitals === championVitals) vitals = { ...championVitals };
        vitals[champion.id] = resolved.nextVitals;
        damageEvents = [...damageEvents, buildChampionDamageEvent(state.level, champion.id, resolved.damage)];
        if (resolved.nextVitals.hp === 0) newlyDead.push(champion.id);
    }

    if (vitals === championVitals && damageEvents === state.damageEvents) return null;

    let party = state.party;
    let floorItems = state.floorItems;
    let championInventories = state.championInventories;
    let championEquipment = state.championEquipment;
    let deadChampions = state.deadChampions;

    for (const championId of newlyDead) {
        const partial = buildDeathDrop(
            {
                level: state.level,
                position: state.position,
                party,
                championInventories,
                championEquipment,
                floorItems,
                deadChampions,
            },
            championId,
        );
        party = partial.party;
        floorItems = partial.floorItems;
        championInventories = partial.championInventories;
        championEquipment = partial.championEquipment;
        deadChampions = partial.deadChampions;
    }

    const partialState: Partial<GameState> = {
        championVitals: vitals,
        damageEvents,
    };

    if (party !== state.party) {
        partialState.party = party;
        partialState.floorItems = floorItems;
        partialState.championInventories = championInventories;
        partialState.championEquipment = championEquipment;
        partialState.deadChampions = deadChampions;
        partialState.selectedChampionIndex = party.length > 0
            ? Math.min(state.selectedChampionIndex, party.length - 1)
            : 0;
    }

    return partialState;
}

function computeChampionMovementTicksApprox(
    champion: Champion,
    vitals: ChampionVitals | undefined,
    equip: ChampionEquipment | undefined,
    inventory: FloorItem[] | undefined,
    extraBonuses?: Partial<EquipmentStatBonuses>,
): number {
    if (!vitals || vitals.hp <= 0) return 1;
    const load = getTotalWeight(equip ?? {}, inventory ?? []);
    const maxLoad = Math.max(1, getChampionMaxLoad(champion, equip, vitals.stamina, vitals.wounds, extraBonuses));

    let ticks: number;
    let woundTicks: number;

    if (maxLoad > load) {
        ticks = 2;
        if ((load << 3) > (maxLoad * 5)) ticks += 1;
        woundTicks = 1;
    } else {
        ticks = 4 + Math.floor((((load - maxLoad) << 2) / maxLoad));
        woundTicks = 2;
    }

    if (vitals.wounds.feet) {
        ticks += woundTicks;
    }

    const feetName = equip?.feet?.rawName ?? '';
    if (/boots of speed/i.test(feetName)) {
        ticks -= 1;
    }

    return Math.max(1, ticks);
}

function computePartyMovementCooldownSecondsApprox(
    state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'championInventories' | 'activePotionBoosts'>,
): number {
    let ticks = 1;
    for (const champ of state.party) {
            ticks = Math.max(
                ticks,
                computeChampionMovementTicksApprox(
                    champ,
                    state.championVitals[champ.id],
                    state.championEquipment[champ.id] ?? {},
                    state.championInventories[champ.id] ?? [],
                    getChampionRuntimeBonuses(champ, state.championVitals[champ.id], state.activePotionBoosts),
                ),
            );
    }
    const cooldown = (ticks / 6) * 0.85;
    return Number.isFinite(cooldown) && cooldown > 0 ? cooldown : 0;
}

function ageTimedEffectsByMs(state: GameState, advanceMs: number): Partial<GameState> {
    if (advanceMs <= 0) return {};
    const now = Date.now();

    const torchBurnStart = Object.fromEntries(
        Object.entries(state.torchBurnStart).map(([itemId, litAt]) => [itemId, litAt - advanceMs]),
    );
    const spellLights = state.spellLights
        .map((light) => ({ ...light, expiresAt: light.expiresAt - advanceMs }))
        .filter((light) => light.expiresAt > now);
    const activeShields = state.activeShields
        .map((shield) => ({ ...shield, expiresAt: shield.expiresAt - advanceMs }))
        .filter((shield) => shield.expiresAt > now);
    const activePotionBoosts = state.activePotionBoosts
        .map((boost) => ({ ...boost, expiresAt: boost.expiresAt - advanceMs }))
        .filter((boost) => boost.expiresAt > now);

    return {
        torchBurnStart,
        spellLights,
        activeShields,
        activePotionBoosts,
        invisibleUntil: Math.max(0, state.invisibleUntil - advanceMs),
        magicVisionUntil: Math.max(0, state.magicVisionUntil - advanceMs),
        seeThroughWallsUntil: Math.max(0, state.seeThroughWallsUntil - advanceMs),
        footprintsUntil: Math.max(0, state.footprintsUntil - advanceMs),
    };
}

function transferFloorItemToChampionState(state: GameState, id: string, championId: number): Partial<GameState> | null {
    const item = state.floorItems.find(i => i.id === id);
    if (!item) return null;
    const champion = state.party.find((entry) => entry.id === championId);
    if (!champion) return null;
    if (item.category === 'Weapon' && item.typeId === 45) {
        const tile = getMap(item.mapIndex).tiles[item.y]?.[item.x];
        const hiddenAmalgamReward =
            (tile?.type === 'Wall' || tile?.type === 'TrickWall') &&
            tile.objects.some((object) =>
                object.category === 'Sensor' &&
                (
                    (object as SensorObject).requiredObjectName === 'THE FIRESTAFF' ||
                    (object as SensorObject).requiredObjectName === 'ZOKATHRA SPELL'
                ),
            );
        if (hiddenAmalgamReward) {
            return {
                lastCastResult: buildAttackResultMessage('Le Firestaff complet ne peut etre obtenu qu via l Amalgam.'),
            };
        }
    }
    const champInv = state.championInventories[championId] ?? [];
    const alcoveState = clearAlcoveStateOnPickup(item, state);
    return {
        floorItems: state.floorItems.filter(i => i.id !== id),
        championInventories: { ...state.championInventories, [championId]: [...champInv, item] },
        activeFloorDrag: state.activeFloorDrag?.itemId === id ? null : state.activeFloorDrag,
        ...alcoveState,
    };
}



// ─── Store ────────────────────────────────────────────────────────────────────

const storeCreator: StateCreator<GameState> = (set, get) => ({
    level: 0,
    position: HALL_START,
    direction: HALL_START_DIR,
    party: [],
    gameOptions: DEFAULT_GAME_OPTIONS,
    selectedChampionIndex: 0,
    gamePhase: 'title',
    optionsModalOpen: false,
    activeMirrorChampionId: null,
    activePartyMemberId: null,
    gateOpen: false,
    openDoors: new Set<string>(),
    openPits: buildOpenPits(),
    openTeleporters: buildOpenTeleporters(),
    openWalls: new Set<string>(),
    activeSensors: new Set<string>(),
    firedSensors: new Set<string>(),
    sensorRuntimeData: {},
    sensorRotationOffsets: {},
    visibleTexts: buildVisibleTexts(),
    pendingSensorEvents: [],
    creatures: buildCreatureInstances(),
    floorItems: buildFloorItems(),
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

    moveForward: () => {
        let blockedMessage: string | undefined;
        let fellThroughPit = false;
        set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        if (Number.isFinite(state.movementCooldown) && state.movementCooldown > 0) return state;
        const movedVitals = applyPartyMoveFatigue(state);
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') ny = y - 1;
        if (state.direction === 'SOUTH') ny = y + 1;
        if (state.direction === 'EAST')  nx = x + 1;
        if (state.direction === 'WEST')  nx = x - 1;
        const targetTile = getMap(state.level).tiles[ny]?.[nx];
        if (targetTile?.type === 'Pit' && state.openPits.has(`${state.level},${ny},${nx}`)) {
            const landing = resolvePitLanding(state.level + 1, ny, nx, state.openDoors, state.openWalls, state.openPits);
            if (!landing) {
                return movedVitals ? { championVitals: movedVitals } : state;
            }
            fellThroughPit = true;

            const ss = buildSensorStateSnapshot(state);
            const leave = triggerFloorSensors(
                state.level,
                x,
                y,
                ss,
                state.championInventories,
                state.championEquipment,
                state.floorItems,
                state.pendingSensorEvents,
                'leave',
            );
            const afterLeave = { ...ss, ...leave.sensorChanges } as SensorState;
            const enter = triggerFloorSensors(
                landing.level,
                landing.x,
                landing.y,
                afterLeave,
                state.championInventories,
                state.championEquipment,
                state.floorItems,
                leave.pendingSensorEvents,
                'enter',
            );
            const landingPosition: [number, number] = [landing.y, landing.x];
            const postFallVitals = movedVitals ?? state.championVitals;
            const fallDamageChanges = applyPartyFallImpactDamage(
                state,
                postFallVitals,
                landing.level,
                landingPosition,
            );
            return {
                level: landing.level,
                position: landingPosition,
                lastPartyMoveGameTick: state.elapsedGameTimeTicks,
                movementCooldown: computePartyMovementCooldownSecondsApprox(state),
                ...(movedVitals ? { championVitals: movedVitals } : {}),
                ...leave.sensorChanges,
                ...enter.sensorChanges,
                ...(fallDamageChanges ?? {}),
                pendingSensorEvents: enter.pendingSensorEvents,
            };
        }
        if (!isWalkable(state.level, ny, nx, state.openDoors, state.openWalls, state.openPits)) {
            const ss = buildSensorStateSnapshot(state);
            const pushChanges = triggerWallPushSensors(state.level, nx, ny, state.direction, ss, state.pendingSensorEvents);
            const postFatigueVitals = movedVitals ?? state.championVitals;
            const wallBumpChanges = targetTile && (targetTile.type === 'Wall' || targetTile.type === 'TrickWall')
                ? applyFrontRowWallBumpDamage(state, postFatigueVitals)
                : null;
            if (wallBumpChanges && state.party.length > 0) playWallBump();
            if (
                Object.keys(pushChanges.sensorChanges).length === 0
                && pushChanges.pendingSensorEvents === state.pendingSensorEvents
                && !wallBumpChanges
            ) {
                return movedVitals ? { championVitals: movedVitals } : state;
            }
            return {
                ...(movedVitals ? { championVitals: movedVitals } : {}),
                ...(wallBumpChanges ?? {}),
                ...pushChanges.sensorChanges,
                pendingSensorEvents: pushChanges.pendingSensorEvents,
            };
        }
        const map = getMap(state.level);
        const tile = map.tiles[ny]?.[nx];
        if (!tile) return state;
        if (tile.type === 'Stairs') {
            const link = STAIR_CONNECTIONS.find(
                s => s.fromLevel === state.level && s.fromY === ny && s.fromX === nx
            );
            if (link) {
                if (link.requireGate && !state.gateOpen) return state;
                // Land one step past the staircase tile, in the arrival direction
                const DIR_STEP: Record<Direction, [number, number]> = {
                    NORTH: [-1, 0], SOUTH: [1, 0], EAST: [0, 1], WEST: [0, -1],
                };
                const [dy, dx] = DIR_STEP[link.dir];
                return {
                    level: link.toLevel,
                    position: [link.toY + dy, link.toX + dx] as [number, number],
                    direction: link.dir,
                    lastPartyMoveGameTick: state.elapsedGameTimeTicks,
                    movementCooldown: computePartyMovementCooldownSecondsApprox(state),
                    ...(movedVitals ? { championVitals: movedVitals } : {}),
                };
            }
        }
        if (tile.type === 'Teleporter') {
            const tp = getTeleporter(tile);
            if (tp && tp.destMap !== state.level) {
                if (!state.gateOpen) return state;
                playTeleport();
                return {
                    level: tp.destMap,
                    position: [tp.destY, tp.destX] as [number, number],
                    direction: state.direction,
                    lastPartyMoveGameTick: state.elapsedGameTimeTicks,
                    movementCooldown: computePartyMovementCooldownSecondsApprox(state),
                    ...(movedVitals ? { championVitals: movedVitals } : {}),
                };
            }
            if (tp && tp.destMap === state.level) {
                const tpKey = `${state.level},${ny},${nx}`;
                if (state.openTeleporters.has(tpKey)) {
                    playTeleport();
                    const ss = buildSensorStateSnapshot(state);
                    const sensorChanges = transitionFloorSensors(
                        state.level,
                        nx,
                        ny,
                        tp.destX,
                        tp.destY,
                        state.party.length,
                        ss,
                        state.championInventories,
                        state.championEquipment,
                        state.floorItems,
                        state.pendingSensorEvents,
                    );
                    return {
                        position: [tp.destY, tp.destX] as [number, number],
                        lastPartyMoveGameTick: state.elapsedGameTimeTicks,
                        movementCooldown: computePartyMovementCooldownSecondsApprox(state),
                        ...(movedVitals ? { championVitals: movedVitals } : {}),
                        ...sensorChanges.sensorChanges,
                        pendingSensorEvents: sensorChanges.pendingSensorEvents,
                    };
                }
            }
        }
        const ss = buildSensorStateSnapshot(state);
        const sensorChanges = transitionFloorSensors(
            state.level,
            x,
            y,
            nx,
            ny,
            state.party.length,
            ss,
            state.championInventories,
            state.championEquipment,
            state.floorItems,
            state.pendingSensorEvents,
        );
        const footprintChanges = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        blockedMessage = sensorChanges.blockedMessage;
        return {
            position: [ny, nx] as [number, number],
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: computePartyMovementCooldownSecondsApprox(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...sensorChanges.sensorChanges,
            pendingSensorEvents: sensorChanges.pendingSensorEvents,
            ...footprintChanges,
        };
        });
        if (fellThroughPit && useStore.getState().party.length > 0) playWallBump();
        if (blockedMessage) useStore.getState().showTransientMessage(blockedMessage);
    },

    moveBackward: () => {
        let blockedMessage: string | undefined;
        set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        if (Number.isFinite(state.movementCooldown) && state.movementCooldown > 0) return state;
        const movedVitals = applyPartyMoveFatigue(state);
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') ny = y + 1;
        if (state.direction === 'SOUTH') ny = y - 1;
        if (state.direction === 'EAST')  nx = x - 1;
        if (state.direction === 'WEST')  nx = x + 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors, state.openWalls, state.openPits)) return movedVitals ? { championVitals: movedVitals } : state;
        const ss = buildSensorStateSnapshot(state);
        const sensorChanges = transitionFloorSensors(
            state.level,
            x,
            y,
            nx,
            ny,
            state.party.length,
            ss,
            state.championInventories,
            state.championEquipment,
            state.floorItems,
            state.pendingSensorEvents,
        );
        const footprintChanges = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        blockedMessage = sensorChanges.blockedMessage;
        return {
            position: [ny, nx] as [number, number],
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: computePartyMovementCooldownSecondsApprox(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...sensorChanges.sensorChanges,
            pendingSensorEvents: sensorChanges.pendingSensorEvents,
            ...footprintChanges,
        };
        });
        if (blockedMessage) useStore.getState().showTransientMessage(blockedMessage);
    },

    strafeLeft: () => {
        let blockedMessage: string | undefined;
        set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        if (Number.isFinite(state.movementCooldown) && state.movementCooldown > 0) return state;
        const movedVitals = applyPartyMoveFatigue(state);
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') nx = x - 1;
        if (state.direction === 'SOUTH') nx = x + 1;
        if (state.direction === 'EAST')  ny = y - 1;
        if (state.direction === 'WEST')  ny = y + 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors, state.openWalls, state.openPits)) return movedVitals ? { championVitals: movedVitals } : state;
        const ss = buildSensorStateSnapshot(state);
        const fpL = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        const sensorChanges = transitionFloorSensors(
            state.level,
            x,
            y,
            nx,
            ny,
            state.party.length,
            ss,
            state.championInventories,
            state.championEquipment,
            state.floorItems,
            state.pendingSensorEvents,
        );
        blockedMessage = sensorChanges.blockedMessage;
        return {
            position: [ny, nx] as [number, number],
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: computePartyMovementCooldownSecondsApprox(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...sensorChanges.sensorChanges,
            pendingSensorEvents: sensorChanges.pendingSensorEvents,
            ...fpL,
        };
        });
        if (blockedMessage) useStore.getState().showTransientMessage(blockedMessage);
    },

    strafeRight: () => {
        let blockedMessage: string | undefined;
        set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        if (Number.isFinite(state.movementCooldown) && state.movementCooldown > 0) return state;
        const movedVitals = applyPartyMoveFatigue(state);
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') nx = x + 1;
        if (state.direction === 'SOUTH') nx = x - 1;
        if (state.direction === 'EAST')  ny = y + 1;
        if (state.direction === 'WEST')  ny = y - 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors, state.openWalls, state.openPits)) return movedVitals ? { championVitals: movedVitals } : state;
        const ss = buildSensorStateSnapshot(state);
        const fpR = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        const sensorChanges = transitionFloorSensors(
            state.level,
            x,
            y,
            nx,
            ny,
            state.party.length,
            ss,
            state.championInventories,
            state.championEquipment,
            state.floorItems,
            state.pendingSensorEvents,
        );
        blockedMessage = sensorChanges.blockedMessage;
        return {
            position: [ny, nx] as [number, number],
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: computePartyMovementCooldownSecondsApprox(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...sensorChanges.sensorChanges,
            pendingSensorEvents: sensorChanges.pendingSensorEvents,
            ...fpR,
        };
        });
        if (blockedMessage) useStore.getState().showTransientMessage(blockedMessage);
    },

    turnLeft: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        const index = DIRECTIONS.indexOf(state.direction);
        return { direction: DIRECTIONS[(index + 3) % 4] };
    }),

    turnRight: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        const index = DIRECTIONS.indexOf(state.direction);
        return { direction: DIRECTIONS[(index + 1) % 4] };
    }),

    addToParty: (champion, mode = 'resurrect') => set((state) => {
        if (state.party.find(c => c.id === champion.id)) return state;
        if (state.party.length >= MAX_PARTY) return state;
        const recruitedChampion = mode === 'reincarnate'
            ? createReincarnatedChampion(champion)
            : champion;
        const newParty = [...state.party, recruitedChampion];
        const starterLoadout = getChampionStarterLoadout(champion.id);
        const nextTorchBurnStart = champion.id in state.championEquipment
            ? state.torchBurnStart
            : seedTorchBurnStartFromEquipment(starterLoadout.equipment, state.torchBurnStart);
        return {
            party: newParty,
            gateOpen: newParty.length >= MAX_PARTY,
            championInventories: champion.id in state.championInventories
                ? state.championInventories
                : { ...state.championInventories, [champion.id]: starterLoadout.inventory },
            championEquipment: champion.id in state.championEquipment
                ? state.championEquipment
                : { ...state.championEquipment, [champion.id]: starterLoadout.equipment },
            championVitals: champion.id in state.championVitals
                ? state.championVitals
                : {
                    ...state.championVitals,
                    [champion.id]: {
                        ...createChampionVitals(
                            recruitedChampion,
                            recruitedChampion.health,
                            recruitedChampion.stamina,
                            recruitedChampion.mana,
                        ),
                    },
                },
            championXP: champion.id in state.championXP
                ? state.championXP
                : {
                    ...state.championXP,
                    [champion.id]: mode === 'reincarnate'
                        ? createEmptyChampionXP()
                        : buildInitialXP(recruitedChampion),
                },
            championTemporaryXP: champion.id in state.championTemporaryXP
                ? state.championTemporaryXP
                : {
                    ...state.championTemporaryXP,
                    [champion.id]: createEmptyChampionTemporaryXP(),
                },
            championCombat: champion.id in state.championCombat
                ? state.championCombat
                : { ...state.championCombat, [champion.id]: createChampionCombatState(0) },
            torchBurnStart: nextTorchBurnStart,
        };
    }),

    removeFromParty: (championId) => set((state) => {
        const newParty = state.party.filter(c => c.id !== championId);
        const [y, x] = state.position;
        const inv = state.championInventories[championId] ?? [];
        const equip = state.championEquipment[championId] ?? {};
        const dropped: FloorItem[] = [
            ...inv,
            ...(Object.values(equip).filter(Boolean) as FloorItem[]),
        ].map(item => ({ ...item, mapIndex: state.level, x, y, tilePos: 'North' as const }));
        return {
            party: newParty,
            gateOpen: false,
            floorItems: [...state.floorItems, ...dropped],
            championInventories: { ...state.championInventories, [championId]: [] },
            championEquipment: { ...state.championEquipment, [championId]: {} },
        };
    }),

      openMirror:       (championId) => set({ gamePhase: 'mirror_open', activeMirrorChampionId: championId }),
      closeMirror:      () => set({ gamePhase: 'exploration', activeMirrorChampionId: null }),
      openPartyMember:  (championId) => set({ activePartyMemberId: championId }),
      closePartyMember: () => set({ activePartyMemberId: null }),

      tryOpenGate: () => set((state) => ({ gateOpen: state.party.length >= MAX_PARTY })),

    showTransientMessage: (message, success = false, durationMs = TRANSIENT_MESSAGE_LIFETIME_MS) => {
        const ts = Date.now();
        set({ lastCastResult: { success, message, ts } });
        if (castResultTimeout) clearTimeout(castResultTimeout);
        castResultTimeout = setTimeout(() => {
            const current = useStore.getState().lastCastResult;
            if (current?.ts === ts) {
                useStore.setState({ lastCastResult: null });
            }
        }, durationMs);
    },

      goToLevel: (level, pos, dir) => set({ level, position: pos, direction: dir }),

    toggleDoor: (x, y) => set((state) => {
        const key = `${state.level},${y},${x}`;
        const next = new Set(state.openDoors);

        if (!hasDoorButton(state.level, x, y) && isDoorControlledByMechanism(state.level, x, y)) {
            return state;
        }

        if (!next.has(key)) {
            if (isDoorLockedByWallSensor(state.level, x, y)) {
                return state;
            }
            // Door is closed → open it, cancel any crush
            next.add(key);
            const remaining = { ...state.crushingDoors };
            delete remaining[key];
            playDoorMotion(DOOR_TOGGLE_SOUND_DURATION_MS, getDoorSoundVolume(state.level, x, y));
            return { openDoors: next, crushingDoors: remaining };
        }

        // Door is open → try to close it
        next.delete(key);
        const blocker = state.creatures.find(
            c => c.alive && c.mapIndex === state.level && c.x === x && c.y === y
        );
        playDoorMotion(DOOR_TOGGLE_SOUND_DURATION_MS, getDoorSoundVolume(state.level, x, y));
        if (blocker) {
            // Start crush cycle
            return {
                openDoors: next,
                crushingDoors: { ...state.crushingDoors, [key]: { phase: 'closing' as const, timer: DOOR_CLOSE_DURATION_SECONDS } },
            };
        }
        return { openDoors: next };
    }),

    activateWallSensor: (mapIndex, x, y, sensorIndex) => set((state) => {
        const tile = getMap(mapIndex).tiles[y]?.[x];
        if (!tile) return state;
        const sensor = tile.objects.find(
            o => o.category === 'Sensor' && (o as SensorObject).index === sensorIndex
        ) as SensorObject | undefined;
        if (!sensor) return state;
        const ss = buildSensorStateSnapshot(state);
        const face = sensor.tilePos;
        const clickableSensors = getWallFaceSensorsInRuntimeOrder(mapIndex, x, y, face, ss.sensorRotationOffsets)
            .filter((entry) => entry.type === 1 || entry.type === 2);
        let cur = ss;
        let nextPending = state.pendingSensorEvents;
        let revealedThisTick = false;

        for (const faceSensor of clickableSensors) {
            if (faceSensor.type === 2 && !faceSensor.revert) continue;
            const sensorKey = `${mapIndex}_${faceSensor.index}`;
            const withVisualState = {
                ...cur,
                activeSensors: applyToSet(cur.activeSensors, sensorKey, faceSensor.action === 'Hold' ? 'Set' : faceSensor.action),
            } as SensorState;
            const isSelfRevealingWall =
                faceSensor.targetX === 0 &&
                faceSensor.targetY === 0 &&
                getSelfRevealingWallSensor(tile)?.index === faceSensor.index;
            const queued = isSelfRevealingWall
                ? {
                    sensorChanges: {
                        openWalls: applyToSet(withVisualState.openWalls, `${mapIndex},${y},${x}`, faceSensor.action === 'Hold' ? 'Set' : faceSensor.action),
                        firedSensors: faceSensor.onceOnly && !withVisualState.firedSensors.has(sensorKey)
                            ? new Set([...withVisualState.firedSensors, sensorKey])
                            : withVisualState.firedSensors,
                    } as Partial<SensorState>,
                    pendingSensorEvents: nextPending,
                }
                : queueOrComputeSensorEffect(faceSensor, mapIndex, withVisualState, nextPending);
            const nextState = { ...withVisualState, ...queued.sensorChanges } as SensorState;
            if ((faceSensor.sound || faceSensor.type === 1 || faceSensor.type === 2) && Object.keys(queued.sensorChanges).length > 0) {
                playPlate();
            }
            if (queued.sensorChanges.openDoors && queued.sensorChanges.openDoors !== cur.openDoors) {
                const target = resolveDoorSoundTarget(faceSensor, mapIndex);
                playDoorMotion(
                    DOOR_TOGGLE_SOUND_DURATION_MS,
                    target ? getDoorSoundVolume(target.level, target.x, target.y) : DOOR_SOUND_MIN_VOLUME,
                );
            }
            if (isSelfRevealingWall && !cur.openWalls.has(`${mapIndex},${y},${x}`) && nextState.openWalls.has(`${mapIndex},${y},${x}`)) {
                revealedThisTick = true;
            }
            cur = nextState;
            nextPending = queued.pendingSensorEvents;
        }

        if (clickableSensors.length > 0 && shouldRotateWallFaceAfterActivation(mapIndex, x, y, face, cur.sensorRotationOffsets)) {
            cur = { ...cur, sensorRotationOffsets: rotateWallFaceSensors(mapIndex, x, y, face, cur) };
        }

        const patch = diffSensorState(ss, cur);
        const pendingChanged = nextPending !== state.pendingSensorEvents;
        const nextFloorItems = revealedThisTick
            ? revealSelfWallMountedItems(state.floorItems, mapIndex, x, y, face)
            : state.floorItems;
        return {
            ...patch,
            ...(pendingChanged ? { pendingSensorEvents: nextPending } : {}),
            ...(nextFloorItems !== state.floorItems ? { floorItems: nextFloorItems } : {}),
        };
    }),

    useItemOnFrontWall: (championId, itemId, fromSlot) => {
        const state = get();
        const [y, x] = state.position;
        const wallY = state.direction === 'NORTH' ? y - 1 : state.direction === 'SOUTH' ? y + 1 : y;
        const wallX = state.direction === 'EAST' ? x + 1 : state.direction === 'WEST' ? x - 1 : x;
        const face = { NORTH: 'South', SOUTH: 'North', EAST: 'West', WEST: 'East' }[state.direction]!;
        const ss = buildSensorStateSnapshot(state);
        const { sensorChanges, newInventories, newEquipment, matched } = triggerLockSensors(
            state.level,
            wallX,
            wallY,
            face,
            ss,
            state.championInventories,
            state.championEquipment,
            { championId, itemId, fromSlot },
        );
        if (matched) {
            set({
                ...sensorChanges,
                ...(newInventories ? { championInventories: newInventories } : {}),
                ...(newEquipment ? { championEquipment: newEquipment } : {}),
            });
            if (Object.keys(sensorChanges).length > 0) {
                playPlate();
            }
            return true;
        }

        const alcoveResult = triggerAlcoveDepositSensor(
            state.level,
            wallX,
            wallY,
            face,
            ss,
            state.championInventories,
            state.championEquipment,
            { championId, itemId, fromSlot },
        );
        if (!alcoveResult.matched || !alcoveResult.depositedItem) return false;
        if (alcoveResult.matched && alcoveResult.depositedItem) {
            set({
                ...alcoveResult.sensorChanges,
                ...(alcoveResult.newInventories ? { championInventories: alcoveResult.newInventories } : {}),
                ...(alcoveResult.newEquipment ? { championEquipment: alcoveResult.newEquipment } : {}),
                floorItems: [...state.floorItems, alcoveResult.depositedItem],
            });
            if (Object.keys(alcoveResult.sensorChanges).length > 0) {
                playPlate();
            }
            return true;
        }

        const exchangerResult = triggerObjectExchangerSensor(
            state.level,
            wallX,
            wallY,
            face,
            ss,
            state.championInventories,
            state.championEquipment,
            { championId, itemId, fromSlot },
        );
        if (!exchangerResult.matched) return false;
        const completeFirestaffReward = state.floorItems.find((item) =>
            item.mapIndex === state.level &&
            item.x === wallX &&
            item.y === wallY &&
            item.tilePos === face &&
            item.category === 'Weapon' &&
            item.typeId === 45,
        );
        const replacementCandidate = fromSlot !== 'inventory'
            ? state.championEquipment[championId]?.[fromSlot as EquipSlotKey]
            : state.championInventories[championId]?.find((item) => item.id === itemId);
        const transformsToCompleteFirestaff =
            completeFirestaffReward &&
            replacementCandidate?.category === 'Weapon' &&
            replacementCandidate.typeId === 7;

        let nextInventories = exchangerResult.newInventories;
        let nextEquipment = exchangerResult.newEquipment;
        let nextFloorItems = state.floorItems;

        if (transformsToCompleteFirestaff && completeFirestaffReward) {
            nextFloorItems = state.floorItems.filter((item) => item.id !== completeFirestaffReward.id);
            const upgradedFirestaff: FloorItem = {
                ...completeFirestaffReward,
                mapIndex: state.level,
                x: state.position[1],
                y: state.position[0],
                tilePos: 'North',
            };
            if (fromSlot !== 'inventory') {
                nextEquipment = { ...(nextEquipment ?? state.championEquipment) };
                nextEquipment[championId] = {
                    ...(nextEquipment[championId] ?? state.championEquipment[championId] ?? {}),
                    [fromSlot as EquipSlotKey]: upgradedFirestaff,
                };
            } else {
                nextInventories = { ...(nextInventories ?? state.championInventories) };
                nextInventories[championId] = [
                    ...(nextInventories[championId] ?? state.championInventories[championId] ?? []),
                    upgradedFirestaff,
                ];
            }
        }
        set({
            ...exchangerResult.sensorChanges,
            ...(nextInventories ? { championInventories: nextInventories } : {}),
            ...(nextEquipment ? { championEquipment: nextEquipment } : {}),
            ...(nextFloorItems !== state.floorItems ? { floorItems: nextFloorItems } : {}),
            ...(transformsToCompleteFirestaff ? {
                lastCastResult: buildAttackResultMessage('Le Firestaff absorbe l energie de l Amalgam.'),
            } : {}),
        });
        if (Object.keys(exchangerResult.sensorChanges).length > 0) {
            playPlate();
        }
        return true;
    },

    useFloorItemOnFrontWall: (itemId, championId) => {
        const state = get();
        const item = state.floorItems.find((entry) => entry.id === itemId);
        if (!item || item.mapIndex !== state.level) return false;

        const inventory = state.championInventories[championId] ?? [];
        const temporaryInventories = {
            ...state.championInventories,
            [championId]: [...inventory, item],
        };
        const [y, x] = state.position;
        const wallY = state.direction === 'NORTH' ? y - 1 : state.direction === 'SOUTH' ? y + 1 : y;
        const wallX = state.direction === 'EAST' ? x + 1 : state.direction === 'WEST' ? x - 1 : x;
        const face = { NORTH: 'South', SOUTH: 'North', EAST: 'West', WEST: 'East' }[state.direction]!;
        const ss = buildSensorStateSnapshot(state);

        const lockResult = triggerLockSensors(
            state.level,
            wallX,
            wallY,
            face,
            ss,
            temporaryInventories,
            state.championEquipment,
            { championId, itemId, fromSlot: 'inventory' },
        );
        if (lockResult.matched) {
            set({
                ...lockResult.sensorChanges,
                championInventories: lockResult.newInventories ?? temporaryInventories,
                ...(lockResult.newEquipment ? { championEquipment: lockResult.newEquipment } : {}),
                floorItems: state.floorItems.filter((entry) => entry.id !== itemId),
                activeFloorDrag: state.activeFloorDrag?.itemId === itemId ? null : state.activeFloorDrag,
            });
            if (Object.keys(lockResult.sensorChanges).length > 0) playPlate();
            return true;
        }

        const alcoveResult = triggerAlcoveDepositSensor(
            state.level,
            wallX,
            wallY,
            face,
            ss,
            temporaryInventories,
            state.championEquipment,
            { championId, itemId, fromSlot: 'inventory' },
        );
        if (alcoveResult.matched && alcoveResult.depositedItem) {
            set({
                ...alcoveResult.sensorChanges,
                championInventories: alcoveResult.newInventories ?? temporaryInventories,
                ...(alcoveResult.newEquipment ? { championEquipment: alcoveResult.newEquipment } : {}),
                floorItems: [
                    ...state.floorItems.filter((entry) => entry.id !== itemId),
                    alcoveResult.depositedItem,
                ],
                activeFloorDrag: state.activeFloorDrag?.itemId === itemId ? null : state.activeFloorDrag,
            });
            if (Object.keys(alcoveResult.sensorChanges).length > 0) playPlate();
            return true;
        }

        const exchangerResult = triggerObjectExchangerSensor(
            state.level,
            wallX,
            wallY,
            face,
            ss,
            temporaryInventories,
            state.championEquipment,
            { championId, itemId, fromSlot: 'inventory' },
        );
        if (!exchangerResult.matched) return false;
        set({
            ...exchangerResult.sensorChanges,
            championInventories: exchangerResult.newInventories ?? temporaryInventories,
            ...(exchangerResult.newEquipment ? { championEquipment: exchangerResult.newEquipment } : {}),
            floorItems: state.floorItems.filter((entry) => entry.id !== itemId),
            activeFloorDrag: state.activeFloorDrag?.itemId === itemId ? null : state.activeFloorDrag,
        });
        playPlate();
        return true;
    },

    beginFloorDrag: (itemId, pointerX, pointerY) => set({ activeFloorDrag: { itemId, pointerX, pointerY } }),
    updateFloorDrag: (pointerX, pointerY) => set((state) => (
        state.activeFloorDrag ? { activeFloorDrag: { ...state.activeFloorDrag, pointerX, pointerY } } : state
    )),
    endFloorDrag: () => set({ activeFloorDrag: null }),

    killCreature: (id) => set((state) => {
        const creatures = state.creatures.map(c => c.id === id ? { ...c, alive: false } : c);
        const dropped = dropCreatureCarriedItems(creatures, state.floorItems, id);
        return {
            creatures: dropped.creatures,
            floorItems: dropped.floorItems,
        };
    }),

    killChampion: (championId) => set((state) => {
        const v = state.championVitals[championId];
        if (!v || v.hp > 0) return state; // only kill champions already at 0 HP
        const partial = buildDeathDrop(
            { level: state.level, position: state.position, party: state.party,
              championInventories: state.championInventories, championEquipment: state.championEquipment,
              floorItems: state.floorItems, deadChampions: state.deadChampions },
            championId,
        );
        const selectedChampionIndex = partial.party.length > 0
            ? Math.min(state.selectedChampionIndex, partial.party.length - 1)
            : 0;
        return { ...partial, selectedChampionIndex };
    }),

    selectChampion: (index) => set({ selectedChampionIndex: index }),

    setGameOptions: (updater) => set((state) => ({
        gameOptions: {
            ...state.gameOptions,
            ...updater,
            keybindings: updater.keybindings
                ? {
                    ...state.gameOptions.keybindings,
                    ...updater.keybindings,
                }
                : state.gameOptions.keybindings,
        },
    })),

    openOptionsModal: () => set({ optionsModalOpen: true }),
    closeOptionsModal: () => set({ optionsModalOpen: false }),

    reorderParty: (fromIndex, toIndex) => set((state) => {
        if (fromIndex === toIndex) return state;
        const newParty = [...state.party];
        const [moved] = newParty.splice(fromIndex, 1);
        newParty.splice(toIndex, 0, moved);
        // Keep selectedChampionIndex pointing to the same champion
        const selectedId = state.party[state.selectedChampionIndex]?.id;
        const newSelectedIdx = selectedId !== undefined
            ? newParty.findIndex(c => c.id === selectedId)
            : state.selectedChampionIndex;
        return { party: newParty, selectedChampionIndex: Math.max(0, newSelectedIdx) };
    }),

    pickupItem: (id) => set((state) => {
        const activeChampion = state.party[state.selectedChampionIndex];
        if (!activeChampion) return state;
        const patch = transferFloorItemToChampionState(state, id, activeChampion.id);
        return patch ? { ...state, ...patch } : state;
    }),

    pickupItemToChampion: (id, championId) => {
        const state = get();
        const patch = transferFloorItemToChampionState(state, id, championId);
        if (!patch) return false;
        set(patch);
        return true;
    },

    dropItem: (itemId, championId) => set((state) => {
        const inv = state.championInventories[championId] ?? [];
        const item = inv.find(i => i.id === itemId);
        if (!item) return state;
        const [y, x] = state.position;

        // ── Altar resurrection: dropping bones on a Vi Altar tile ──────────────
        if (item.category === 'Misc' && item.typeId === 5 && item.championId !== undefined) {
            const deadChampId = item.championId;
            const deadChamp   = state.deadChampions[deadChampId];
            if (deadChamp && isAltarTile(state.level, x, y) && state.party.length < MAX_PARTY) {
                const revivedChampion = createViAltarRevivedChampion(deadChamp);
                const newInv = inv.filter(i => i.id !== itemId);
                const newDead = { ...state.deadChampions };
                delete newDead[deadChampId];
                return {
                    party: [...state.party, revivedChampion],
                    championVitals: {
                        ...state.championVitals,
                        [deadChampId]: createChampionVitals(
                            revivedChampion,
                            Math.max(1, revivedChampion.health >> 1),
                            0,
                            0,
                            Math.round(MAX_FOOD * 0.35),
                            Math.round(MAX_WATER * 0.35),
                        ),
                    },
                    championInventories: { ...state.championInventories, [championId]: newInv, [deadChampId]: [] },
                    championEquipment: { ...state.championEquipment, [deadChampId]: {} },
                    deadChampions: newDead,
                };
            }
        }

        const dropped: FloorItem = { ...item, mapIndex: state.level, x, y, tilePos: 'North' };
        const nextFloorItems = [...state.floorItems, dropped];
        const ss = buildSensorStateSnapshot(state);
        const sensorChanges = triggerFloorSensors(
            state.level,
            x,
            y,
            ss,
            state.championInventories,
            state.championEquipment,
            nextFloorItems,
            state.pendingSensorEvents,
            'enter',
        );
        return {
            championInventories: { ...state.championInventories, [championId]: inv.filter(i => i.id !== itemId) },
            floorItems: nextFloorItems,
            ...sensorChanges.sensorChanges,
            pendingSensorEvents: sensorChanges.pendingSensorEvents,
        };
    }),

    dropCarriedItem: (championId, itemId, fromSlot) => {
        const state = get();
        if (fromSlot === 'inventory') {
            const inventory = state.championInventories[championId] ?? [];
            if (!inventory.some((item) => item.id === itemId)) return false;
            get().dropItem(itemId, championId);
            return true;
        }
        const equipped = state.championEquipment[championId]?.[fromSlot];
        if (!equipped || equipped.id !== itemId) return false;
        set((current) => {
            const equip = { ...(current.championEquipment[championId] ?? {}) };
            delete equip[fromSlot];
            const [y, x] = current.position;
            return {
                championEquipment: { ...current.championEquipment, [championId]: equip },
                floorItems: [...current.floorItems, { ...equipped, mapIndex: current.level, x, y, tilePos: 'North' as const }],
            };
        });
        return true;
    },

    throwCarriedItem: (championId, itemId, fromSlot) => {
        const state = get();
        const champion = state.party.find((entry) => entry.id === championId);
        if (!champion) return false;

        let carriedItem: FloorItem | undefined;
        if (fromSlot === 'inventory') {
            carriedItem = (state.championInventories[championId] ?? []).find((item) => item.id === itemId);
        } else {
            carriedItem = state.championEquipment[championId]?.[fromSlot];
        }
        if (!carriedItem || carriedItem.id !== itemId) return false;

        const projectile = buildDragThrowProjectile(state, championId, champion, carriedItem);
        const thrownItemXP = applyChampionSkillExperienceOriginalApprox(state, championId, 'throw', 5);

        set((current) => {
            if (fromSlot === 'inventory') {
                const inventory = current.championInventories[championId] ?? [];
                if (!inventory.some((item) => item.id === itemId)) return current;
                return {
                    championInventories: {
                        ...current.championInventories,
                        [championId]: inventory.filter((item) => item.id !== itemId),
                    },
                    ...(thrownItemXP ?? {}),
                    projectiles: [...current.projectiles, projectile],
                };
            }

            const equipped = current.championEquipment[championId]?.[fromSlot];
            if (!equipped || equipped.id !== itemId) return current;
            return {
                championEquipment: {
                    ...current.championEquipment,
                    [championId]: {
                        ...(current.championEquipment[championId] ?? {}),
                        [fromSlot]: undefined,
                    },
                },
                ...(thrownItemXP ?? {}),
                projectiles: [...current.projectiles, projectile],
            };
        });

        return true;
    },

    equipItem: (championId, slotKey, itemId) => set((state) => {
        const inv = state.championInventories[championId] ?? [];
        const item = inv.find(i => i.id === itemId);
        if (!item) return state;
        if (!canEquipItemInSlot(item, slotKey)) return state;
        const curEquip = state.championEquipment[championId] ?? {};
        const displaced = curEquip[slotKey];
        const newInv = inv.filter(i => i.id !== itemId);
        if (displaced) newInv.push(displaced);
        // Light a torch the first time it is equipped
        const isTorch = item.category === 'Weapon' && item.typeId === 2;
        const torchChanges = isTorch && !state.torchBurnStart[item.id]
            ? { torchBurnStart: { ...state.torchBurnStart, [item.id]: Date.now() } }
            : {};
        return {
            championInventories: { ...state.championInventories, [championId]: newInv },
            championEquipment: { ...state.championEquipment, [championId]: { ...curEquip, [slotKey]: item } },
            ...torchChanges,
        };
    }),

    unequipItem: (championId, slotKey) => set((state) => {
        const curEquip = state.championEquipment[championId] ?? {};
        const item = curEquip[slotKey];
        if (!item) return state;
        const inv = state.championInventories[championId] ?? [];
        const newEquip = { ...curEquip };
        delete newEquip[slotKey];
        return {
            championInventories: { ...state.championInventories, [championId]: [...inv, item] },
            championEquipment: { ...state.championEquipment, [championId]: newEquip },
        };
    }),

    giveItem: (fromChampionId, toChampionId, itemId) => set((state) => {
        const fromInv = state.championInventories[fromChampionId] ?? [];
        const item = fromInv.find(i => i.id === itemId);
        if (!item) return state;
        const toInv = state.championInventories[toChampionId] ?? [];
        return {
            championInventories: {
                ...state.championInventories,
                [fromChampionId]: fromInv.filter(i => i.id !== itemId),
                [toChampionId]: [...toInv, item],
            },
        };
    }),

    giveEquippedItem: (fromChampionId, slotKey, toChampionId) => set((state) => {
        const fromEquip = state.championEquipment[fromChampionId] ?? {};
        const item = fromEquip[slotKey];
        if (!item) return state;
        const toInv = state.championInventories[toChampionId] ?? [];
        const newEquip = { ...fromEquip };
        delete newEquip[slotKey];
        return {
            championEquipment: { ...state.championEquipment, [fromChampionId]: newEquip },
            championInventories: { ...state.championInventories, [toChampionId]: [...toInv, item] },
        };
    }),

    resurrectChampion: (bonesItemId) => set((state) => {
        // Find the bones in inventory or on the floor
        let carriedBy: number | null = null;
        let bonesItem: FloorItem | undefined;
        for (const [cidStr, inv] of Object.entries(state.championInventories)) {
            const found = inv.find(i => i.id === bonesItemId);
            if (found) { bonesItem = found; carriedBy = Number(cidStr); break; }
        }
        if (!bonesItem) bonesItem = state.floorItems.find(i => i.id === bonesItemId);
        if (!bonesItem || bonesItem.championId === undefined) return state;

        const deadChampId = bonesItem.championId;
        const deadChamp   = state.deadChampions[deadChampId];
        if (!deadChamp) return state;
        if (state.party.length >= MAX_PARTY) return state;
        const revivedChampion = createViAltarRevivedChampion(deadChamp);

        const [y, x] = state.position;
        if (!isAltarTile(state.level, x, y)) return state;

        const newDead = { ...state.deadChampions };
        delete newDead[deadChampId];

        const newFloorItems = state.floorItems.filter(i => i.id !== bonesItemId);
        const newInv = carriedBy !== null
            ? (state.championInventories[carriedBy] ?? []).filter(i => i.id !== bonesItemId)
            : state.championInventories[carriedBy!] ?? [];

        return {
            party: [...state.party, revivedChampion],
            championVitals: {
                ...state.championVitals,
                [deadChampId]: createChampionVitals(
                    revivedChampion,
                    Math.max(1, revivedChampion.health >> 1),
                    0,
                    0,
                    Math.round(MAX_FOOD * 0.35),
                    Math.round(MAX_WATER * 0.35),
                ),
            },
            championInventories: carriedBy !== null
                ? { ...state.championInventories, [carriedBy]: newInv, [deadChampId]: [] }
                : { ...state.championInventories, [deadChampId]: [] },
            championEquipment: { ...state.championEquipment, [deadChampId]: {} },
            floorItems: newFloorItems,
            deadChampions: newDead,
        };
    }),

    useItem: (championId, itemId, fromSlot = 'inventory') => set((state) => {
        const inv = state.championInventories[championId] ?? [];
        const equip = state.championEquipment[championId] ?? {};
        const inventoryIndex = inv.findIndex((entry) => entry.id === itemId);
        const equippedEntry = Object.entries(equip).find(([, entry]) => entry?.id === itemId) as [EquipSlotKey, FloorItem] | undefined;

        const slotKey =
            fromSlot !== 'inventory' && equip[fromSlot]?.id === itemId
                ? fromSlot
                : equippedEntry?.[0];
        const item = slotKey ? equip[slotKey] : inventoryIndex >= 0 ? inv[inventoryIndex] : undefined;
        if (!item) return state;
        const vitals = state.championVitals[championId];
        if (!vitals) return state;
        const champ = state.party.find(c => c.id === championId);
        if (!champ) return state;
        const effective = getEffectiveChampionStatsRuntime(champ, equip, state.activePotionBoosts, vitals);

        const newVitals = { ...vitals };
        let replacementItem: FloorItem | null = null;
        let shouldConsumeOriginal = true;

        const waterUse = consumeWaterContainer(item);
        if (isWaterContainer(item) && !waterUse) return state;
        if (waterUse) {
            newVitals.water = clampFoodWater(vitals.water + waterUse.waterGain, MAX_WATER);
            newVitals.stamina = Math.min(effective.stamina, vitals.stamina + waterUse.staminaGain);
            replacementItem = waterUse.nextItem;
            shouldConsumeOriginal = false;
        } else if (item.category === 'Potion') {
            const def = getPotionDef(item.typeId, item.rawName);
            if (!def?.drinkable) return state;

            const potionPower = Math.max(40, Math.min(255, item.potionPower ?? 40));
            const rawCounter = Math.floor((511 - potionPower) / (32 + Math.floor((potionPower + 1) / 8)));
            const counter = Math.max(1, rawCounter >> 1);
            const adjustedPotionPower = Math.floor(potionPower / 25) + 8;
            const normalizedStats = normalizeChampionCurrentStats(champ, newVitals.currentStats);

            switch (def.effect) {
                case 'dexterity':
                    normalizedStats.dexterity = adjustOriginalStatisticCurrentValue(
                        normalizedStats.dexterity,
                        adjustedPotionPower,
                    );
                    break;
                case 'strength':
                    normalizedStats.strength = adjustOriginalStatisticCurrentValue(
                        normalizedStats.strength,
                        Math.floor(potionPower / 35) + 5,
                    );
                    break;
                case 'wisdom':
                    normalizedStats.wisdom = adjustOriginalStatisticCurrentValue(
                        normalizedStats.wisdom,
                        adjustedPotionPower,
                    );
                    break;
                case 'vitality':
                    normalizedStats.vitality = adjustOriginalStatisticCurrentValue(
                        normalizedStats.vitality,
                        adjustedPotionPower,
                    );
                    break;
                case 'antivenin':
                    newVitals.poisonEntries = [];
                    break;
                case 'stamina': {
                    const staminaGain = Math.min(
                        Math.max(0, effective.stamina - vitals.stamina),
                        Math.floor(effective.stamina / counter),
                    );
                    newVitals.stamina = Math.min(effective.stamina, vitals.stamina + staminaGain);
                    break;
                }
                case 'shield': {
                    let shieldPower = adjustedPotionPower + (adjustedPotionPower >> 1);
                    const existingChampionShield = state.activeShields
                        .filter((shield) => shield.championId === championId && getPartyShieldKind(shield) === 'physical' && shield.expiresAt > Date.now())
                        .reduce((max, shield) => Math.max(max, shield.defense ?? 0), 0);
                    if (existingChampionShield > 50) {
                        shieldPower >>= 2;
                    }
                    const shield: PartyShield = {
                        id: `champion_shield_${item.id}`,
                        championId,
                        expiresAt: Date.now() + quantizeMsToOriginalTimerTicks((shieldPower * shieldPower) * ORIGINAL_TIMER_TICK_MS),
                        defense: shieldPower,
                        kind: 'physical',
                    };
                    replacementItem = buildEmptyFlaskReplacement(item);
                    shouldConsumeOriginal = false;
                    return {
                        championVitals: {
                            ...state.championVitals,
                            [championId]: { ...newVitals, currentStats: normalizedStats },
                        },
                        ...(slotKey
                            ? {
                                championEquipment: {
                                    ...state.championEquipment,
                                    [championId]: { ...equip, [slotKey]: replacementItem },
                                },
                            }
                            : {
                                championInventories: {
                                    ...state.championInventories,
                                    [championId]: inv.map((entry, index) => index === inventoryIndex ? replacementItem! : entry),
                                },
                            }),
                        activeShields: [
                            ...state.activeShields.filter((shield) => !(shield.championId === championId && getPartyShieldKind(shield) === 'physical')),
                            shield,
                        ],
                    };
                }
                case 'mana': {
                    let mana = Math.min(900, vitals.mana + adjustedPotionPower + (adjustedPotionPower - 8));
                    if (mana > effective.mana) {
                        mana -= (mana - Math.max(vitals.mana, effective.mana)) >> 1;
                    }
                    newVitals.mana = mana;
                    break;
                }
                case 'health': {
                    newVitals.hp = Math.min(effective.health, vitals.hp + Math.floor(effective.health / counter));
                    Object.assign(newVitals, healChampionWoundsApprox(newVitals, Math.max(1, Math.floor(potionPower / 42))));
                    break;
                }
                case 'water':
                    replacementItem = buildEmptyFlaskReplacement(item);
                    shouldConsumeOriginal = false;
                    break;
                default:
                    return state;
            }

            newVitals.currentStats = normalizedStats;
            replacementItem = replacementItem ?? buildEmptyFlaskReplacement(item);
            shouldConsumeOriginal = false;
        } else if (item.category === 'Misc') {
            const def = MISC_TYPES[item.typeId];
            if (def?.food && def.nutrition) {
                newVitals.food = clampFoodWater(vitals.food + def.nutrition, MAX_FOOD);
            }
        }

        return {
            championVitals: { ...state.championVitals, [championId]: newVitals },
            ...(slotKey
                ? {
                    championEquipment: {
                        ...state.championEquipment,
                        [championId]: (() => {
                            const nextEquip = { ...equip };
                            if (shouldConsumeOriginal) delete nextEquip[slotKey];
                            else nextEquip[slotKey] = replacementItem ?? item;
                            return nextEquip;
                        })(),
                    },
                }
                : {
                    championInventories: {
                        ...state.championInventories,
                        [championId]: shouldConsumeOriginal
                            ? inv.filter((entry) => entry.id !== itemId)
                            : inv.map((entry, index) => index === inventoryIndex ? (replacementItem ?? entry) : entry),
                    },
                }),
        };
    }),

    fillWaterContainer: (championId, itemId) => set((state) => {
        if (!isFacingFountain(state.level, state.position, state.direction)) return state;

        const inv = state.championInventories[championId] ?? [];
        const invIndex = inv.findIndex(item => item.id === itemId);
        if (invIndex >= 0) {
            const filled = fillWaterContainer(inv[invIndex]!);
            if (!filled || !canFillWaterContainer(inv[invIndex]!)) return state;
            return {
                championInventories: {
                    ...state.championInventories,
                    [championId]: inv.map((item, index) => index === invIndex ? filled : item),
                },
            };
        }

        const equip = state.championEquipment[championId] ?? {};
        for (const slot of Object.keys(equip) as EquipSlotKey[]) {
            const item = equip[slot];
            if (!item || item.id !== itemId) continue;
            const filled = fillWaterContainer(item);
            if (!filled || !canFillWaterContainer(item)) return state;
            return {
                championEquipment: {
                    ...state.championEquipment,
                    [championId]: { ...equip, [slot]: filled },
                },
            };
        }

        return state;
    }),

    sleep: () => set((state) => {
        if (state.gamePhase !== 'exploration' || state.party.length === 0) return state;
        if (isPartyRestedApprox(state)) {
            return { sleeping: false };
        }
        return {
            sleeping: !state.sleeping,
            lastCastResult: null,
        };
    }),

    wakeUp: () => set((state) => (state.sleeping ? { sleeping: false } : state)),

    // ─── Potion rune → typeId mapping (spell runes without power rune) ──────────
    // Source: canonical runtime potion table in src/data/items.ts
    // vi → Vi Potion (14) | vi,bro → Antivenin (10) | ya → Mon Potion (11 stamina)
    // ya,bro → Ya Potion (12 shield) | zo,bro,ra → Ee Potion (13 mana)

    // ─── Spell casting ────────────────────────────────────────────────────────
    enterDungeon: () => {
        resetExternalCreatureRuntimeState();
        set((state) => ({
            level: 0,
            position: HALL_START,
            direction: HALL_START_DIR,
            party: [],
            selectedChampionIndex: 0,
            gamePhase: 'exploration',
            optionsModalOpen: false,
            activeMirrorChampionId: null,
            activePartyMemberId: null,
            gateOpen: false,
            openDoors: new Set<string>(),
            openPits: buildOpenPits(),
            openTeleporters: buildOpenTeleporters(),
            openWalls: new Set<string>(),
            activeSensors: new Set<string>(),
            firedSensors: new Set<string>(),
            sensorRuntimeData: {},
            sensorRotationOffsets: {},
            visibleTexts: buildVisibleTexts(),
            pendingSensorEvents: [],
            creatures: buildCreatureInstances(),
            floorItems: buildFloorItems(),
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
            gameOptions: state.gameOptions,
        }));
    },

    saveGame: (): boolean => {
        const state: GameState = get();
        const payload = JSON.stringify(buildPersistedSaveDataSystem(state, {
            creatureTimers,
            creatureAttackWindows,
            creatureConfusedUntil,
            creatureFluxcageUntil,
            creatureFrightenedUntil,
            creatureLastSeenPartyPos,
        }));
        return writePersistedSave(payload);
    },

    loadGame: (): boolean => {
        const data = tryParsePersistedSaveDataSystem(readPersistedSave());
        if (!data) return false;
        const now = Date.now();
        const normalizedChampionXP = Object.fromEntries(
            data.party.map((champion) => {
                const loaded = normalizeChampionXP(data.championXP?.[champion.id]);
                const migrated = isLegacyChampionXPForChampion(champion, loaded)
                    ? buildInitialXP(champion)
                    : loaded;
                return [champion.id, migrated];
            }),
        );
        const normalizedChampionTemporaryXP = Object.fromEntries(
            data.party.map((champion) => [
                champion.id,
                normalizeChampionTemporaryXP(data.championTemporaryXP?.[champion.id]),
            ]),
        );
        restoreExternalCreatureRuntimeFromSaveSystem(data, {
            creatureTimers,
            creatureAttackWindows,
            creatureConfusedUntil,
            creatureFluxcageUntil,
            creatureFrightenedUntil,
            creatureLastSeenPartyPos,
        });
        set({
            gameOptions: data.gameOptions ?? DEFAULT_GAME_OPTIONS,
            level: data.level,
            position: data.position,
            direction: data.direction,
            party: data.party,
            selectedChampionIndex: 0,
            gamePhase: 'exploration',
            activeMirrorChampionId: null,
            activePartyMemberId: null,
            gateOpen: data.gateOpen,
            openDoors: new Set<string>(data.openDoors),
            openPits: new Set<string>(data.openPits ?? [...buildOpenPits()]),
            openTeleporters: new Set<string>(data.openTeleporters),
            openWalls: new Set<string>(data.openWalls),
            activeSensors: new Set<string>(data.activeSensors),
            firedSensors: new Set<string>(data.firedSensors),
            sensorRuntimeData: data.sensorRuntimeData ?? {},
            sensorRotationOffsets: data.sensorRotationOffsets ?? {},
            visibleTexts: new Set<string>(data.visibleTexts),
            pendingSensorEvents: (data.pendingSensorEvents ?? []) as PendingSensorEvent[],
            creatures: data.creatures,
            floorItems: data.floorItems,
            championInventories: data.championInventories,
            championEquipment: data.championEquipment,
            championVitals: Object.fromEntries(
                data.party
                    .map((champion) => {
                        const vitals = data.championVitals[champion.id];
                        return vitals ? [champion.id, normalizeChampionVitalsForChampion(champion, vitals)] : null;
                    })
                    .filter((entry): entry is [number, ChampionVitals] => entry !== null),
            ),
            championManaRegenBlockedUntilTick: data.championManaRegenBlockedUntilTick ?? {},
            elapsedGameTimeTicks: data.elapsedGameTimeTicks,
            regenTickRemainder: data.regenTickRemainder,
            lastSurvivalEffectGameTick: data.lastSurvivalEffectGameTick ?? data.elapsedGameTimeTicks,
            freezeLifeRemainingTicks: Math.max(0, data.freezeLifeRemainingTicks ?? 0),
            lastPartyMoveGameTick: data.lastPartyMoveGameTick,
            movementCooldown: data.movementCooldown,
            sleeping: false,
            endgameSequence: null,
            lastCastResult: null,
            championXP: normalizedChampionXP,
            championTemporaryXP: normalizedChampionTemporaryXP,
            championCombat: data.championCombat,
            damageEvents: [],
            spellVisualEvents: [],
            crushingDoors: data.crushingDoors,
            torchBurnStart: Object.fromEntries(
                Object.entries(data.torchBurnElapsed).map(([itemId, elapsed]) => [itemId, now - elapsed]),
            ),
            spellLights: data.spellLights
                .map((light) => ({ id: light.id, lightContrib: light.lightContrib, expiresAt: now + light.remainingMs }))
                .filter((light) => light.expiresAt > now),
            projectiles: data.projectiles.map((projectile) => {
                const { nextMoveInMs, ...rest } = projectile;
                return {
                    ...rest,
                    remainingAttack: rest.remainingAttack ?? (rest.effect !== 'physical' ? ORIGINAL_SPELL_PROJECTILE_ATTACK : rest.remainingAttack),
                    nextMoveAt: now + nextMoveInMs,
                };
            }),
            activePoisonClouds: data.activePoisonClouds ?? [],
            activeShields: data.activeShields
                .map((shield) => {
                    const { remainingMs, ...rest } = shield;
                    return { ...rest, expiresAt: now + remainingMs };
                })
                .filter((shield) => shield.expiresAt > now),
            activePotionBoosts: (data.activePotionBoosts ?? [])
                .map((boost) => {
                    const { remainingMs, ...rest } = boost;
                    return { ...rest, expiresAt: now + remainingMs };
                })
                .filter((boost) => boost.expiresAt > now),
            invisibleUntil: data.invisibleRemainingMs > 0 ? now + data.invisibleRemainingMs : 0,
            magicVisionUntil: data.magicVisionRemainingMs > 0 ? now + data.magicVisionRemainingMs : 0,
            seeThroughWallsUntil: data.seeThroughWallsRemainingMs > 0 ? now + data.seeThroughWallsRemainingMs : 0,
            footprintsUntil: data.footprintsRemainingMs > 0 ? now + data.footprintsRemainingMs : 0,
            footprintHistory: data.footprintHistory,
            deadChampions: data.deadChampions,
            lastCreatureAttackGameTick: data.lastCreatureAttackGameTick ?? 0,
        });
        return true;
    },

    returnToTitle: () => set({
        gamePhase: 'title',
        activeMirrorChampionId: null,
        activePartyMemberId: null,
        sleeping: false,
        endgameSequence: null,
        lastCastResult: null,
        damageEvents: [],
        spellVisualEvents: [],
    }),

    castSpell: (championId, runeIds) => set((state) => {
        const champion = state.party.find(c => c.id === championId);
        if (!champion) return state;

        const spell = findSpell(runeIds);
        if (!spell) {
            return {
                lastCastResult: { success: false, message: 'Combinaison de runes inconnue.', ts: Date.now() },
            };
        }

        const combat = state.championCombat[championId];
        if (combat && combat.cooldown > 0) {
            return {
                lastCastResult: {
                    success: false,
                    message: 'Le champion recupere encore de sa derniere action.',
                    ts: Date.now(),
                },
            };
        }

        const vitals = state.championVitals[championId];
        if (!vitals) return state;

        if (vitals.mana < spell.manaCost) {
            return {
                lastCastResult: {
                    success: false,
                    message: `Mana insuffisant — ${spell.name} requiert ${spell.manaCost} points.`,
                    ts: Date.now(),
                },
            };
        }

        const spellSkill = spell.progressionSkill ?? spell.castSkill;
        const skillLevel = getChampionMasteryLevel(state, championId, champion, spellSkill);
        const castEquip = state.championEquipment[championId] ?? {};
        const castCheck = rollOriginalSpellCastSuccess(
            champion,
            castEquip,
            state.activePotionBoosts,
            vitals,
            spell,
            skillLevel,
        );
        const lowSkill = castCheck.missingSkillLevels > 0;
        const castSucceeded = castCheck.success;

        const newMana = vitals.mana - spell.manaCost;

        const spellXpRange = getOriginalSpellCastXpRange(spell.runes);
        const spellXPGain = spellXpRange
            ? spellXpRange.min + randomInt((spellXpRange.max - spellXpRange.min) + 1)
            : spell.manaBase * 15;
        const awardedSpellXP = castSucceeded
            ? spellXPGain
            : spellXpRange
                ? spellXPGain >> castCheck.missingSkillLevels
                : spellXPGain;
        const spellXpPatch = applyChampionSkillExperienceOriginalApprox(state, championId, spellSkill, awardedSpellXP);

        const message = !castSucceeded
            ? `${spell.name} échoue.`
            : lowSkill
                ? `${spell.name} lancé avec difficulté. (${spell.castSkill} niv. ${skillLevel}/${castCheck.requiredSkillLevel})`
                : `${spell.name} — ${spell.description}`;

        const now = Date.now();
        let newVitals = { ...vitals, mana: Math.max(0, newMana) };
        const spellCooldownSeconds = originalTimerTicksToSeconds(spell.sourceDisableTimeTicks ?? 0);
        const newCombat = createChampionCombatState(spellCooldownSeconds, 0);

        const base = {
            ...(spellXpPatch ?? {}),
            championCombat: { ...state.championCombat, [championId]: newCombat },
            lastCastResult: { success: castSucceeded, message: `${message} (${Math.round(castCheck.successChance * 100)}%)`, ts: now } as CastResult,
        };

        if (!castSucceeded) {
            return {
                ...base,
                championVitals: { ...state.championVitals, [championId]: newVitals },
            };
        }

        // ── Apply spell effect ────────────────────────────────────────────────
        switch (spell.effect) {

            case 'heal': {
                const healAmount = Math.round(spell.manaCost * 10);
                newVitals = { ...newVitals, hp: Math.min(champion.health, vitals.hp + healAmount) };
                return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
            }

            case 'light': {
                const lightContrib = getSpellLightContribution(spell);
                const durationMs = getSpellDurationMs(spell);
                if (!durationMs) {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }
                const newLight: SpellLight = {
                    id: `light_${now}_${Math.random().toString(36).slice(2)}`,
                    lightContrib,
                    expiresAt: now + durationMs,
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    spellLights: [...state.spellLights, newLight],
                };
            }

            case 'fireball':
            case 'lightning':
            case 'poison_cloud':
            case 'poison_bolt':
            case 'open':
            case 'disrupt_nonmaterial': {
                const equip = state.championEquipment[championId] ?? {};
                const effective = getEffectiveChampionStatsRuntime(champion, equip, state.activePotionBoosts, newVitals);
                const launchProfile =
                    getOriginalSpellProjectileLaunchProfile(spell, skillLevel, effective.mana) ??
                    getSpellProjectileLaunchProfile(spell, effective.mana);
                const projectileDamage = spell.effect === 'open'
                    ? { min: 0, max: 0 }
                    : getProjectileDamage(spell);
                const visualScale = spell.effect === 'fireball' || spell.effect === 'open'
                    ? getSpellVisualScaleFromRunes(spell.runes)
                    : 1;
                if (!projectileDamage) {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }
                const [py, px] = state.position;
                // Start one tile ahead of the player so it's visible from cast
                let startX = px, startY = py;
                if      (state.direction === 'NORTH') startY--;
                else if (state.direction === 'SOUTH') startY++;
                else if (state.direction === 'EAST')  startX++;
                else                                   startX--;
                if (spell.effect === 'open') {
                    const immediateDoor = getClosedDoorAt(state, state.level, startX, startY);
                    if (immediateDoor) {
                        const nextOpenDoors = immediateDoor.door.hasButton
                            ? new Set([...state.openDoors, immediateDoor.key])
                            : state.openDoors;
                        if (immediateDoor.door.hasButton) {
                            playDoorMotion(
                                DOOR_TOGGLE_SOUND_DURATION_MS,
                                getDoorSoundVolume(state.level, startX, startY),
                            );
                        }
                        return {
                            ...base,
                            championVitals: { ...state.championVitals, [championId]: newVitals },
                            ...(nextOpenDoors !== state.openDoors ? { openDoors: nextOpenDoors } : {}),
                            spellVisualEvents: [
                                ...state.spellVisualEvents,
                                {
                                    id: `spellimpact_door_${now}_${Math.random().toString(36).slice(2)}`,
                                    level: state.level,
                                    x: startX,
                                    y: startY,
                                    height: GRID_SIZE * 0.08,
                                    effect: 'open',
                                    visualScale,
                                    ts: now,
                                    kind: 'wall',
                                },
                            ],
                        };
                    }
                }
                const immediateBlocked = isBlockedForProjectile(state, state.level, startX, startY);
                if (immediateBlocked) {
                    if (spell.effect === 'open') {
                        return {
                            ...base,
                            championVitals: { ...state.championVitals, [championId]: newVitals },
                            spellVisualEvents: [
                                ...state.spellVisualEvents,
                                {
                                    id: `spellimpact_wall_${now}_${Math.random().toString(36).slice(2)}`,
                                    level: state.level,
                                    x: px,
                                    y: py,
                                    height: GRID_SIZE * 0.08,
                                    effect: 'open',
                                    visualScale,
                                    ts: now,
                                    kind: 'wall',
                                },
                            ],
                        };
                    }
                    const blockedPoisonCloud = spell.effect === 'poison_cloud'
                        ? buildActivePoisonCloud(
                            state.level,
                            px,
                            py,
                            ORIGINAL_SPELL_PROJECTILE_ATTACK,
                            state.elapsedGameTimeTicks,
                            visualScale * 1.08,
                        )
                        : null;
                    const impactOffset = (() => {
                        if (state.direction === 'NORTH') return { offsetX: 0, offsetZ: -GRID_SIZE * 0.18 };
                        if (state.direction === 'SOUTH') return { offsetX: 0, offsetZ: GRID_SIZE * 0.18 };
                        if (state.direction === 'EAST') return { offsetX: GRID_SIZE * 0.18, offsetZ: 0 };
                        return { offsetX: -GRID_SIZE * 0.18, offsetZ: 0 };
                    })();
                    const sourceBackedImpact =
                        (spell.effect === 'fireball' || spell.effect === 'lightning')
                            ? rollOriginalSpellProjectileImpact(
                                spell,
                                launchProfile?.initialRange ?? 0,
                                0,
                                randomInt,
                            )
                            : null;
                    const rolledDamage = sourceBackedImpact
                        ? sourceBackedImpact.damage
                        : projectileDamage.min + Math.floor(Math.random() * (projectileDamage.max - projectileDamage.min + 1));
                    const backlash = blockedPoisonCloud
                        ? null
                        : applyPartySpellBacklashDamage(
                            state,
                            { ...state.championVitals, [championId]: newVitals },
                            spell.effect as Exclude<ProjectileEffect, 'physical'>,
                            rolledDamage,
                            now,
                        );
                    return {
                        ...base,
                        championVitals: backlash?.championVitals ?? { ...state.championVitals, [championId]: newVitals },
                        ...(backlash?.damageEvents ? { damageEvents: backlash.damageEvents } : {}),
                        ...(backlash?.party ? { party: backlash.party } : {}),
                        ...(backlash?.floorItems ? { floorItems: backlash.floorItems } : {}),
                        ...(backlash?.championInventories ? { championInventories: backlash.championInventories } : {}),
                        ...(backlash?.championEquipment ? { championEquipment: backlash.championEquipment } : {}),
                        ...(backlash?.deadChampions ? { deadChampions: backlash.deadChampions } : {}),
                        ...(backlash?.selectedChampionIndex !== undefined ? { selectedChampionIndex: backlash.selectedChampionIndex } : {}),
                        ...(blockedPoisonCloud ? { activePoisonClouds: [...state.activePoisonClouds, blockedPoisonCloud] } : {}),
                        spellVisualEvents: [
                            ...state.spellVisualEvents,
                            {
                                id: `spellimpact_wall_${now}_${Math.random().toString(36).slice(2)}`,
                                level: state.level,
                                x: px,
                                y: py,
                                offsetX: impactOffset.offsetX,
                                offsetZ: impactOffset.offsetZ,
                                height: GRID_SIZE * 0.08,
                                effect: spell.effect as Exclude<ProjectileEffect, 'physical'>,
                                visualScale: visualScale * 1.2,
                                ts: now,
                                kind: 'wall',
                            },
                        ],
                    };
                }
                const newProj: Projectile = {
                    id: `proj_${now}_${Math.random().toString(36).slice(2)}`,
                    level: state.level,
                    x: startX,
                    y: startY,
                    direction: state.direction,
                    effect: spell.effect as ProjectileEffect,
                    spellRunes: [...spell.runes],
                    visualScale,
                    damage: [projectileDamage.min, projectileDamage.max],
                    nextMoveAt: now + PROJECTILE_STEP_MS,
                    remainingRange: launchProfile?.initialRange,
                    remainingAttack: spell.effect === 'open' ? 0 : ORIGINAL_SPELL_PROJECTILE_ATTACK,
                    stepDecay: launchProfile?.stepDecay,
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    projectiles: [...state.projectiles, newProj],
                };
            }

            case 'darkness': {
                const durationMs = getSpellDurationMs(spell);
                if (!durationMs) {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }
                const darkEntry: SpellLight = {
                    id: `dark_${now}_${Math.random().toString(36).slice(2)}`,
                    lightContrib: getSpellLightContribution(spell),
                    expiresAt: now + durationMs,
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    spellLights: [...state.spellLights, darkEntry],
                };
            }

            case 'plasma': {
                const equip = state.championEquipment[championId] ?? {};
                const freeSlot = (['rightHand', 'leftHand'] as const).find((slot) => !equip[slot]);
                const zokathraItem: FloorItem = {
                    id: `misc_zokathra_${now}_${Math.random().toString(36).slice(2)}`,
                    mapIndex: state.level,
                    x: state.position[1],
                    y: state.position[0],
                    tilePos: 'North',
                    category: 'Misc',
                    typeId: 51,
                    rawName: resolveItemName('Misc', 51),
                };
                if (freeSlot) {
                    return {
                        ...base,
                        championVitals: { ...state.championVitals, [championId]: newVitals },
                        championEquipment: {
                            ...state.championEquipment,
                            [championId]: { ...equip, [freeSlot]: zokathraItem },
                        },
                    };
                }
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    floorItems: [
                        ...state.floorItems,
                        buildDroppedItem(zokathraItem, state.level, state.position[1], state.position[0]),
                    ],
                };
            }

            case 'shield':
            case 'fire_shield': {
                const shieldProfile = getSpellShieldProfile(spell);
                if (!shieldProfile) {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }
                const shield: PartyShield = {
                    id: `shield_${now}_${Math.random().toString(36).slice(2)}`,
                    expiresAt: now + shieldProfile.durationMs,
                    defense: shieldProfile.defense,
                    kind: spell.effect === 'fire_shield' ? 'fire' : 'physical',
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    activeShields: [...state.activeShields, shield],
                };
            }

            case 'invisibility': {
                const durationMs = getSpellDurationMs(spell);
                if (!durationMs) {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    invisibleUntil: Math.max(state.invisibleUntil, now + durationMs),
                };
            }

            case 'see_through_walls': {
                const durationMs = getSpellDurationMs(spell);
                if (!durationMs) {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    seeThroughWallsUntil: Math.max(state.seeThroughWallsUntil, now + durationMs),
                };
            }

            case 'reveal_hidden': {
                const durationMs = quantizeMsToOriginalTimerTicks(spell.manaCost * 12_000);
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    magicVisionUntil: Math.max(state.magicVisionUntil, now + durationMs),
                };
            }

            case 'footprints': {
                const durationMs = getSpellDurationMs(spell);
                if (!durationMs) {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    footprintsUntil: Math.max(state.footprintsUntil, now + durationMs),
                };
            }

            case 'potion': {
                const descriptor = getOriginalSpellDescriptorForRunes(spell.runes);
                if (!descriptor || descriptor.spellTypeName !== 'potion') {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }
                const equip = state.championEquipment[championId] ?? {};
                const flaskSlot = (['rightHand', 'leftHand'] as const).find(
                    slot => (equip[slot]?.category === 'Potion' && equip[slot]?.typeId === 20) || (equip[slot]?.category === 'Misc' && equip[slot]?.typeId === 40)
                );
                if (!flaskSlot) {
                    return {
                        ...base,
                        championVitals: { ...state.championVitals, [championId]: newVitals },
                        lastCastResult: {
                            success: false,
                            message: 'Il faut une flasque vide dans la main.',
                            ts: now,
                        },
                    };
                }
                const flask = equip[flaskSlot]!;
                const potionStrength = getOriginalPotionStrengthRange(spell.runes);
                const potionPower = potionStrength
                    ? potionStrength.min + randomInt((potionStrength.max - potionStrength.min) + 1)
                    : 40;
                const potion = {
                    ...flask,
                    category: 'Potion' as const,
                    typeId: descriptor.subtype,
                    rawName: resolveItemName('Potion', descriptor.subtype),
                    potionPower,
                };
                const newEquip = { ...equip, [flaskSlot]: potion };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    championEquipment: { ...state.championEquipment, [championId]: newEquip },
                };
            }

            default:
                return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
        }
    }),

    tickFrame: (delta, now) => set((state) => {
        if (state.optionsModalOpen) return state;
        if (state.gamePhase === 'endgame') {
            return applyEndgameFrameApprox(state, now) ?? state;
        }
        if (state.sleeping) {
            return applySleepFrameApprox(state, now) ?? state;
        }
        const regenPatch = applyRegenTickApprox(state, delta);
        const afterRegen = regenPatch ? { ...state, ...regenPatch } : state;

        const movementPatch = applyMovementTickApprox(afterRegen, delta);
        const afterMovement = movementPatch ? { ...afterRegen, ...movementPatch } : afterRegen;

        const combatPatch = applyCombatTickApprox(afterMovement, delta, now);
        const afterCombat = combatPatch ? { ...afterMovement, ...combatPatch } : afterMovement;

        const pendingPatch = processPendingSensorEvents(
            delta,
            afterCombat.pendingSensorEvents,
            buildSensorStateSnapshot(afterCombat),
        );

        const hasPendingPatch =
            Object.keys(pendingPatch.sensorChanges).length > 0 ||
            pendingPatch.pendingSensorEvents !== afterCombat.pendingSensorEvents;

        if (!regenPatch && !movementPatch && !combatPatch && !hasPendingPatch) return state;

        return {
            ...(regenPatch ?? {}),
            ...(movementPatch ?? {}),
            ...(combatPatch ?? {}),
            ...(hasPendingPatch ? { ...pendingPatch.sensorChanges, pendingSensorEvents: pendingPatch.pendingSensorEvents } : {}),
        };
    }),

    regenTick: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        let regenTickRemainder = state.regenTickRemainder + delta;
        const stepCount = Math.floor(regenTickRemainder / ORIGINAL_TIMER_TICK_SECONDS);
        regenTickRemainder -= stepCount * ORIGINAL_TIMER_TICK_SECONDS;

        if (stepCount <= 0) {
            return regenTickRemainder !== state.regenTickRemainder
                ? { regenTickRemainder }
                : state;
        }

        const advanced = advanceSurvivalTimeApprox(state, stepCount);

        return {
            championVitals: advanced.championVitals,
            championTemporaryXP: advanced.championTemporaryXP,
            elapsedGameTimeTicks: advanced.elapsedGameTimeTicks,
            lastSurvivalEffectGameTick: advanced.lastSurvivalEffectGameTick,
            freezeLifeRemainingTicks: advanced.freezeLifeRemainingTicks,
            regenTickRemainder,
        };
    }),

    tickMovement: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        if (!Number.isFinite(state.movementCooldown)) {
            return { movementCooldown: 0 };
        }
        if (state.movementCooldown <= 0) return state;
        return { movementCooldown: Math.max(0, state.movementCooldown - delta) };
    }),

    // ─── XP ───────────────────────────────────────────────────────────────────
    gainXP: (championId, skill, amount) => set((state) => {
        if (amount <= 0) return state;
        return applyChampionSkillExperienceOriginalApprox(state, championId, skill, amount) ?? state;
    }),

    // ─── Weapon action / physical attack ─────────────────────────────────────
    attackFront: (championId, attackType) => set((state) => {
        const combat = state.championCombat[championId];
        if (!combat || combat.cooldown > 0) return state;

        const champion = state.party.find(c => c.id === championId);
        if (!champion) return state;

        const equip = state.championEquipment[championId] ?? {};
        const rightHand = equip.rightHand;
        const availableAttacks = getWeaponAttackOptions(rightHand);
        const requestedAttack = availableAttacks.find((option) => option.attackType === attackType) ?? null;
        const usableAttacks = availableAttacks.filter((option) => {
            const skill = mapOriginalSkillNumberToSkillKey(option.attack.skillNumber);
            const masteryLevel = getChampionMasteryLevel(state, championId, champion, skill);
            return isAttackOptionUsableAtMastery(option, masteryLevel);
        });
        const selectedAttack = attackType !== undefined
            ? requestedAttack
            : (usableAttacks[0] ?? availableAttacks[0] ?? null);
        const selectedSkill = selectedAttack
            ? mapOriginalSkillNumberToSkillKey(selectedAttack.attack.skillNumber)
            : 'fighter';

        if (selectedAttack) {
            const masteryLevel = getChampionMasteryLevel(state, championId, champion, selectedSkill);
            const unusableReason = getAttackOptionUnusableReason(selectedAttack, masteryLevel);
            if (unusableReason) {
                return {
                    lastCastResult: buildAttackResultMessage(`${selectedAttack.displayName} indisponible: ${unusableReason}.`),
                };
            }
        }

        if (selectedAttack && isShootAttack(selectedAttack)) {
            const requiredAmmoRawClass = getRequiredAmmoRawClass(rightHand);
            const ammo = findQuiverAmmo(equip, requiredAmmoRawClass);
            if (!ammo) {
                return {
                    lastCastResult: buildAttackResultMessage('Aucune munition compatible dans le carquois.'),
                };
            }
        }

        const stats = getRightHandStats(state.championEquipment[championId]);
        const cooldownSec = selectedAttack ? getAttackCooldownSeconds(selectedAttack) : stats.cooldownSec;
        const newCombat = createChampionCombatState(
            cooldownSec,
            selectedAttack?.attack.defenseModifier ?? 0,
        );
        const vitalsUpdate = applyChampionAttackVitals(state, championId, champion, selectedAttack);
        const championVitals = vitalsUpdate
            ? { ...state.championVitals, [championId]: vitalsUpdate.nextVitals }
            : state.championVitals;
        const rightHandCharges = getActionCharges(rightHand);
        if (selectedAttack?.requiresCharges && rightHandCharges !== null && rightHandCharges <= 0) {
            return {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
                lastCastResult: buildAttackResultMessage(`${selectedAttack.displayName} impossible: plus de charges.`),
            };
        }
        const chargedEquip = selectedAttack?.requiresCharges
            ? updateEquippedItemCharges(equip, 'rightHand', rightHandCharges === null ? null : Math.max(0, rightHandCharges - 1))
            : equip;

        if (selectedAttack && isThrowAttack(selectedAttack) && rightHand) {
            const descriptor = getOriginalWeaponReference(rightHand);
            const fighterMastery = getChampionMasteryLevel(state, championId, champion, 'fighter');
            const ninjaMastery = getChampionMasteryLevel(state, championId, champion, 'ninja');
            const throwRange = originalThrowingDistance(
                champion,
                equip,
                vitalsUpdate?.nextVitals.stamina,
                rightHand,
                descriptor,
                fighterMastery,
                ninjaMastery,
                getChampionRuntimeBonuses(champion, vitalsUpdate?.nextVitals ?? state.championVitals[championId], state.activePotionBoosts),
            );
            const launchBonus = descriptor && descriptor.rawClass <= 12 ? descriptor.kineticEnergy : 1;
            const rawRange = throwRange + launchBonus;
            const finalRange = rawRange + Math.floor(Math.random() * 16) + Math.floor(rawRange / 2) + ninjaMastery;
            const rawDamage = Math.max(40, Math.min(200, 8 * ninjaMastery + Math.floor(Math.random() * 32)));
            const decay = Math.max(5, 11 - ninjaMastery);
            const explosionOnImpact = getThrownPotionExplosionEffect(rightHand);
            const explosionAttack = explosionOnImpact ? Math.max(1, rightHand.potionPower ?? 40) : undefined;
            const projectile: Projectile = {
                id: `throw_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                level: state.level,
                x: state.position[1],
                y: state.position[0],
                direction: state.direction,
                effect: 'physical',
                damage: [rawDamage, rawDamage],
                nextMoveAt: Date.now(),
                remainingRange: Math.max(1, finalRange),
                remainingAttack: rawDamage,
                stepDecay: decay,
                physicalItem: buildDroppedItem(rightHand, state.level, state.position[1], state.position[0]),
                explosionOnImpact,
                explosionAttack,
            };
            const attackXpPatch = applyChampionSkillExperienceOriginalApprox(
                state,
                championId,
                selectedSkill,
                selectedAttack.attack.experienceForAttacking,
            );
            return {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
                championEquipment: { ...state.championEquipment, [championId]: { ...equip, rightHand: undefined } },
                ...(attackXpPatch ?? {}),
                projectiles: [...state.projectiles, projectile],
                lastCastResult: buildAttackResultMessage(selectedAttack.displayName, true),
            };
        }

        if (selectedAttack && isShootAttack(selectedAttack)) {
            const launcher = getOriginalWeaponReference(rightHand);
            const requiredAmmoRawClass = getRequiredAmmoRawClass(rightHand);
            const ammo = findQuiverAmmo(equip, requiredAmmoRawClass);
            if (!ammo) {
                return {
                    lastCastResult: buildAttackResultMessage('Aucune munition compatible dans le carquois.'),
                };
            }
            const ammoDescriptor = getOriginalWeaponReference(ammo.item);
            const mastery = getChampionMasteryLevel(state, championId, champion, 'ninja');
            const maxDamage = Math.max(6, 2 * ((launcher?.shootDamage ?? 4) + mastery));
            const minDamage = Math.max(2, Math.floor(maxDamage * 0.55));
            const range = Math.max(1, (launcher?.kineticEnergy ?? 1) + (ammoDescriptor?.kineticEnergy ?? 1));
            const decay = Math.max(1, maxDamage & 0x0f);
            const projectile: Projectile = {
                id: `shoot_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                level: state.level,
                x: state.position[1],
                y: state.position[0],
                direction: state.direction,
                effect: 'physical',
                damage: [minDamage, maxDamage],
                nextMoveAt: Date.now(),
                remainingRange: range,
                remainingAttack: maxDamage,
                stepDecay: decay,
                physicalItem: buildDroppedItem(ammo.item, state.level, state.position[1], state.position[0]),
            };
            const nextEquip = { ...equip, [ammo.slot]: undefined };
            const attackXpPatch = applyChampionSkillExperienceOriginalApprox(
                state,
                championId,
                selectedSkill,
                selectedAttack.attack.experienceForAttacking,
            );
            return {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
                championEquipment: { ...state.championEquipment, [championId]: nextEquip },
                ...(attackXpPatch ?? {}),
                projectiles: [...state.projectiles, projectile],
                lastCastResult: buildAttackResultMessage(selectedAttack.displayName, true),
            };
        }

        const performSupportedUtilityAction = (): Partial<GameState> | null => {
            if (!selectedAttack) return null;
            const now = Date.now();
            const champIdx = state.party.findIndex(c => c.id === championId);
            const isLeftCol = champIdx === 0 || champIdx === 2;
            const preferredSide: CreatureSide = isLeftCol ? 'left' : 'right';
            const front = creaturesInFront(state.level, state.position, state.direction, state.creatures);
            const target = front.find(c => c.side === preferredSide) ?? front[0] ?? null;
            const frightenFrontCreatures = (frightAmount: number): void => {
                for (const creature of front) {
                    const creatureDef = CREATURE_TYPES[creature.typeId];
                    if (!creatureDef) continue;
                    const fearResistance = creatureDef.fearResistance;
                    if (fearResistance >= 15) continue;
                    if (fearResistance > randomInt(Math.max(1, frightAmount))) continue;
                    const frightTicks = Math.max(8, (16 - fearResistance) << 2);
                    creatureFrightenedUntil.set(
                        creature.id,
                        now + quantizeMsToOriginalTimerTicks(frightTicks * ORIGINAL_TIMER_TICK_MS),
                    );
                    creatureLastSeenPartyPos.delete(creature.id);
                }
            };
            const utilityXP = selectedAttack.attack.experienceForAttacking;
            const utilityXpPatch = utilityXP > 0
                ? applyChampionSkillExperienceOriginalApprox(state, championId, selectedSkill, utilityXP)
                : null;
            const base = {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
                ...(utilityXpPatch ?? {}),
                ...(chargedEquip !== equip ? { championEquipment: { ...state.championEquipment, [championId]: chargedEquip } } : {}),
                lastCastResult: buildAttackResultMessage(selectedAttack.displayName, true),
            } satisfies Partial<GameState>;

            switch (selectedAttack.enumName) {
                case 'Heal': {
                    const currentVitals = championVitals[championId];
                    if (!currentVitals) return base;
                    const healAmount = 25;
                    return {
                        ...base,
                        championVitals: {
                            ...championVitals,
                            [championId]: {
                                ...currentVitals,
                                hp: Math.min(champion.health, currentVitals.hp + healAmount),
                            },
                        },
                    };
                }
                case 'Light': {
                    const newLight: SpellLight = {
                        id: `weapon_light_${now}_${Math.random().toString(36).slice(2)}`,
                        lightContrib: 0.5,
                        expiresAt: now + quantizeMsToOriginalTimerTicks(minutesToMs(10)),
                    };
                    return {
                        ...base,
                        spellLights: [...state.spellLights, newLight],
                    };
                }
                case 'Spellshield': {
                    const shield: PartyShield = {
                        id: `weapon_spellshield_${now}_${Math.random().toString(36).slice(2)}`,
                        expiresAt: now + quantizeMsToOriginalTimerTicks(90_000),
                        defense: 22,
                        kind: 'magic',
                    };
                    return {
                        ...base,
                        activeShields: [...state.activeShields, shield],
                    };
                }
                case 'Fireshield': {
                    const shield: PartyShield = {
                        id: `weapon_fireshield_${now}_${Math.random().toString(36).slice(2)}`,
                        expiresAt: now + quantizeMsToOriginalTimerTicks(90_000),
                        defense: 22,
                        kind: 'fire',
                    };
                    return {
                        ...base,
                        activeShields: [...state.activeShields, shield],
                    };
                }
                case 'Lightning': {
                    const { x, y } = getFrontPosition(state.position, state.direction);
                    const newProj: Projectile = {
                        id: `weapon_lightning_${now}_${Math.random().toString(36).slice(2)}`,
                        level: state.level,
                        x,
                        y,
                        direction: state.direction,
                        effect: 'lightning',
                        damage: [20, 45],
                        nextMoveAt: now,
                    };
                    return {
                        ...base,
                        projectiles: [...state.projectiles, newProj],
                    };
                }
                case 'Fireball': {
                    const { x, y } = getFrontPosition(state.position, state.direction);
                    const newProj: Projectile = {
                        id: `weapon_fireball_${now}_${Math.random().toString(36).slice(2)}`,
                        level: state.level,
                        x,
                        y,
                        direction: state.direction,
                        effect: 'fireball',
                        damage: [18, 42],
                        nextMoveAt: now,
                    };
                    return {
                        ...base,
                        projectiles: [...state.projectiles, newProj],
                    };
                }
                case 'Dispell': {
                    const { x, y } = getFrontPosition(state.position, state.direction);
                    const newProj: Projectile = {
                        id: `weapon_dispell_${now}_${Math.random().toString(36).slice(2)}`,
                        level: state.level,
                        x,
                        y,
                        direction: state.direction,
                        effect: 'disrupt_nonmaterial',
                        damage: [14, 34],
                        nextMoveAt: now,
                    };
                    return {
                        ...base,
                        projectiles: [...state.projectiles, newProj],
                    };
                }
                case 'Confuse': {
                    if (!target) {
                        return {
                            ...base,
                            lastCastResult: buildAttackResultMessage('CONFUSE sans cible.'),
                        };
                    }
                    creatureConfusedUntil.set(target.id, now + quantizeMsToOriginalTimerTicks(90_000));
                    const timers = creatureTimers.get(target.id);
                    if (timers) {
                        creatureTimers.set(target.id, {
                            mt: Math.max(timers.mt, 0.75),
                            at: Math.max(timers.at, 1.25),
                        });
                    }
                    return base;
                }
                case 'Fluxcage': {
                    if (!target) {
                        return {
                            ...base,
                            lastCastResult: buildAttackResultMessage('FLUXCAGE sans cible.'),
                        };
                    }
                    creatureFluxcageUntil.set(target.id, now + quantizeMsToOriginalTimerTicks(120_000));
                    const timers = creatureTimers.get(target.id);
                    if (timers) {
                        creatureTimers.set(target.id, {
                            mt: Math.max(timers.mt, 1.5),
                            at: Math.max(timers.at, 0.6),
                        });
                    }
                    return base;
                }
                case 'Freeze Life': {
                    return {
                        ...base,
                        freezeLifeRemainingTicks: Math.min(200, state.freezeLifeRemainingTicks + 70),
                    };
                }
                case 'Calm': {
                    frightenFrontCreatures(7);
                    return base;
                }
                case 'Brandish': {
                    frightenFrontCreatures(6);
                    return base;
                }
                case 'Blow Horn': {
                    playHornOfFear();
                    frightenFrontCreatures(6);
                    return base;
                }
                case 'War Cry': {
                    if (rightHand?.typeId === 43) playHornOfFear();
                    else playWarCry();
                    frightenFrontCreatures(3);
                    return base;
                }
                case 'Fuse': {
                    if (!target) {
                        return {
                            ...base,
                            lastCastResult: buildAttackResultMessage('FUSE sans cible.'),
                        };
                    }
                    const firestaffName = rightHand ? getWeaponName(rightHand).toLowerCase() : '';
                    const completeFirestaff =
                        Boolean(rightHand) &&
                        (
                            (rightHand?.typeId === 45) ||
                            (/firestaff/.test(firestaffName) && /complete|final/i.test((rightHand?.rawName ?? '').toLowerCase()))
                        );
                    if (!completeFirestaff) {
                        return {
                            ...base,
                            lastCastResult: buildAttackResultMessage('FUSE requiert le Firestaff complet.'),
                        };
                    }
                    const trapped = (creatureFluxcageUntil.get(target.id) ?? 0) > now;
                    if (target.typeId === 23 && !trapped) {
                        return {
                            ...base,
                            lastCastResult: buildAttackResultMessage('Lord Chaos doit etre fluxcage avant FUSE.'),
                        };
                    }
                    if (target.typeId === 23) {
                        creatureFluxcageUntil.clear();
                        creatureConfusedUntil.clear();
                        creatureFrightenedUntil.clear();
                        return {
                            ...base,
                            projectiles: [],
                            activePoisonClouds: [],
                            spellVisualEvents: [
                                ...state.spellVisualEvents,
                                buildEndgameSpellEvent('fireball', state.level, target.x, target.y, now, 1.08),
                            ],
                            creatures: state.creatures.map((creature) =>
                                creature.id === target.id
                                    ? {
                                        ...creature,
                                        currentHP: 10000,
                                        alive: true,
                                        side: 'left',
                                        typeId: 23,
                                    }
                                    : creature,
                            ),
                            gamePhase: 'endgame' as const,
                            endgameSequence: {
                                startedAt: now,
                                level: state.level,
                                x: target.x,
                                y: target.y,
                                lordChaosId: target.id,
                                lastBurstIndex: 0,
                                stage: 0,
                            },
                            activeMirrorChampionId: null,
                            activePartyMemberId: null,
                            sleeping: false,
                        };
                    }
                    const fuseDamage = target.typeId === 23 ? Math.max(999, target.currentHP) : 90;
                    const newHP = Math.max(0, target.currentHP - fuseDamage);
                    const killed = newHP <= 0;
                    let newCreatures = state.creatures.map(c =>
                        c.id === target.id ? { ...c, currentHP: newHP, alive: !killed } : c
                    );
                    let newFloorItems = state.floorItems;
                    if (killed) {
                        const dropped = dropCreatureCarriedItems(newCreatures, newFloorItems, target.id);
                        newCreatures = dropped.creatures;
                        newFloorItems = dropped.floorItems;
                    }
                    const dmgEvt = buildCreatureDamageEvent(state.level, target.x, target.y, fuseDamage);
                    return {
                        ...base,
                        creatures: newCreatures,
                        ...(newFloorItems !== state.floorItems ? { floorItems: newFloorItems } : {}),
                        damageEvents: [...state.damageEvents, dmgEvt],
                        ...(killed ? { spellVisualEvents: [...state.spellVisualEvents, buildDeathDustEvent(state.level, target.x, target.y)] } : {}),
                        ...(target.typeId === 23 && killed ? {
                            gamePhase: 'victory' as const,
                            activeMirrorChampionId: null,
                            activePartyMemberId: null,
                        } : {}),
                    };
                }
                case 'Invoke': {
                    const invokeEffects: ProjectileEffect[] = [
                        'poison_bolt',
                        'poison_cloud',
                        'disrupt_nonmaterial',
                        'fireball',
                    ];
                    const effect = invokeEffects[Math.floor(Math.random() * invokeEffects.length)] ?? 'fireball';
                    const { x, y } = getFrontPosition(state.position, state.direction);
                    const newProj: Projectile = {
                        id: `weapon_invoke_${now}_${Math.random().toString(36).slice(2)}`,
                        level: state.level,
                        x,
                        y,
                        direction: state.direction,
                        effect,
                        damage: [20, 50],
                        nextMoveAt: now,
                    };
                    return {
                        ...base,
                        projectiles: [...state.projectiles, newProj],
                    };
                }
                case 'Window': {
                    return {
                        ...base,
                        seeThroughWallsUntil: Math.max(state.seeThroughWallsUntil, now + quantizeMsToOriginalTimerTicks(120_000)),
                    };
                }
                default:
                    return null;
            }
        };

        if (selectedAttack && !isPhysicalAttack(selectedAttack)) {
            const handled = performSupportedUtilityAction();
            if (handled) return handled;
            return {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
                lastCastResult: buildAttackResultMessage(`Action originale non encore integree: ${selectedAttack.displayName}.`),
            };
        }

        // Determine champion's column: party[0/2] = left, party[1/3] = right
        const champIdx = state.party.findIndex(c => c.id === championId);
        const isLeftCol = champIdx === 0 || champIdx === 2;
        const preferredSide: CreatureSide = isLeftCol ? 'left' : 'right';

        const front = creaturesInFront(state.level, state.position, state.direction, state.creatures);
        // Prefer same-column side, fall back to any
        const target = front.find(c => c.side === preferredSide) ?? front[0] ?? null;

        playPartyAttack();

        if (!target) {
            const brokenDoor = tryBreakFrontDoor(
                state,
                champion,
                equip,
                state.activePotionBoosts,
                selectedAttack,
            );
        return {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
                ...(brokenDoor ? { openDoors: brokenDoor.openDoors, lastCastResult: brokenDoor.message } : {}),
            };
        }

        const totalDmg = determineMeleeDamageApprox(
            state,
            championId,
            champion,
            equip,
            selectedAttack,
            vitalsUpdate?.nextVitals.stamina,
            target,
        );

        if (totalDmg <= 0) {
            return {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
            };
        }

        const newHP = target.currentHP - totalDmg;
        const killed = newHP <= 0;
        let newCreatures = state.creatures.map(c =>
            c.id === target.id ? { ...c, currentHP: Math.max(0, newHP), alive: !killed } : c
        );
        let newFloorItems = state.floorItems;
        if (killed) {
            const dropped = dropCreatureCarriedItems(newCreatures, newFloorItems, target.id);
            newCreatures = dropped.creatures;
            newFloorItems = dropped.floorItems;
        }

        // XP: attacker gains fighter/wizard XP = damage dealt
        const attackSkill = selectedAttack
            ? mapOriginalSkillNumberToSkillKey(selectedAttack.attack.skillNumber)
            : stats.skill;
        let xpCarrier: Pick<GameState, 'level' | 'party' | 'championVitals' | 'championXP' | 'championTemporaryXP' | 'elapsedGameTimeTicks' | 'lastCreatureAttackGameTick'> = state;
        let newChampXP = state.championXP;
        let newChampionTemporaryXP = state.championTemporaryXP;
        let xpParty = state.party;

        const attackerXpPatch = applyChampionSkillExperienceOriginalApprox(xpCarrier, championId, attackSkill, totalDmg);
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

        // Kill XP: shared equally among living party members
        if (killed) {
            const def = CREATURE_TYPES[target.typeId];
            const killXP = def?.exp ?? 0;
            const living = xpParty.filter(c => (state.championVitals[c.id]?.hp ?? 0) > 0);
            const share = living.length > 0 ? Math.floor(killXP / living.length) : 0;
            if (share > 0) {
                for (const c of living) {
                    const killXpPatch = applyChampionSkillExperienceOriginalApprox(xpCarrier, c.id, 'fighter', share);
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

        const newDmgEvent = buildCreatureDamageEvent(state.level, target.x, target.y, totalDmg);

        return {
            creatures: newCreatures,
            ...(newFloorItems !== state.floorItems ? { floorItems: newFloorItems } : {}),
            championVitals,
            championXP: newChampXP,
            championTemporaryXP: newChampionTemporaryXP,
            ...(xpParty !== state.party ? { party: xpParty } : {}),
            championCombat: { ...state.championCombat, [championId]: newCombat },
            damageEvents: [...state.damageEvents, newDmgEvent],
            ...(killed ? { spellVisualEvents: [...state.spellVisualEvents, buildDeathDustEvent(state.level, target.x, target.y)] } : {}),
        };
    }),

    // ─── Door crush tick ─────────────────────────────────────────────────────
    tickDoors: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        const keys = Object.keys(state.crushingDoors);
        if (keys.length === 0) return state;

        let crush   = state.crushingDoors;
        let doors   = state.openDoors;
        let crtrs   = state.creatures as CreatureInstance[];
        let dmgEvts = state.damageEvents;
        let changed = false;

        for (const key of keys) {
            const c = crush[key];
            // Parse key `level,y,x`
            const [, sY, sX] = key.split(',');
            const tx = parseInt(sX), ty = parseInt(sY);

            const blocker = crtrs.find(cr => cr.alive && cr.x === tx && cr.y === ty);

            if (!blocker) {
                // Creature gone — door stays closed, remove crush entry
                if (crush === state.crushingDoors) crush = { ...crush };
                delete crush[key];
                if (doors.has(key)) { doors = new Set(doors); doors.delete(key); }
                changed = true;
                continue;
            }

            const newTimer = c.timer - delta;

            if (c.phase === 'closing') {
                if (newTimer > 0) {
                    if (crush === state.crushingDoors) crush = { ...crush };
                    crush[key] = { ...c, timer: newTimer };
                    changed = true;
                } else {
                    // Hit! Deal damage
                    const dmg = 25 + Math.floor(Math.random() * 16); // 25–40
                    const newHP = Math.max(0, blocker.currentHP - dmg);
                    const killed = newHP <= 0;

                    if (crtrs === state.creatures) crtrs = [...crtrs];
                    const idx = crtrs.findIndex(cr => cr.id === blocker.id);
                    if (idx >= 0) crtrs[idx] = { ...crtrs[idx], currentHP: newHP, alive: !killed };

                    dmgEvts = [...dmgEvts, buildCreatureDamageEvent(state.level, tx, ty, dmg)];

                    if (crush === state.crushingDoors) crush = { ...crush };
                    if (killed) {
                        delete crush[key]; // door stays closed, creature dead
                    } else {
                        // Bounce door open, then try again
                        crush[key] = { phase: 'bouncing', timer: DOOR_REBOUND_DURATION_SECONDS };
                        doors = new Set(doors); doors.add(key);
                    }
                    changed = true;
                }
            } else {
                // 'bouncing' — door is open briefly
                if (newTimer > 0) {
                    if (crush === state.crushingDoors) crush = { ...crush };
                    crush[key] = { ...c, timer: newTimer };
                    changed = true;
                } else {
                    // Close again and start next crush countdown
                    doors = new Set(doors); doors.delete(key);
                    if (crush === state.crushingDoors) crush = { ...crush };
                    crush[key] = { phase: 'closing', timer: DOOR_RECLOSE_DURATION_SECONDS };
                    changed = true;
                }
            }
        }

        if (!changed) return state;
        return {
            crushingDoors: crush,
            openDoors: doors,
            creatures: crtrs,
            damageEvents: dmgEvts,
        };
    }),

    // ─── Monster AI tick ─────────────────────────────────────────────────────
    tickMonsters: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        if (state.party.length === 0) return state;
        const [py, px] = state.position;
        const map = getMap(state.level);

        const monsterWalkable = (level: number, y: number, x: number): boolean => {
            const levelMap = getMap(level);
            if (y < 0 || y >= levelMap.height || x < 0 || x >= levelMap.width) return false;
            const t = levelMap.tiles[y]?.[x];
            if (!t || t.type === 'Wall' || t.type === 'TrickWall') return false;
            if (t.type === 'Door') return state.openDoors.has(`${level},${y},${x}`);
            if (t.type === 'Pit') return !state.openPits.has(`${level},${y},${x}`);
            return true;
        };

        let creatures  = state.creatures as CreatureInstance[];
        let vitals     = state.championVitals;
        let dmgEvts    = state.damageEvents;
        let championInventories = state.championInventories;
        let projectiles = state.projectiles;
        let lastCreatureAttackGameTick = state.lastCreatureAttackGameTick;
        let anyChange  = false;
        // Champions that reach 0 HP this tick — processed after the loop
        const newlyDead: number[] = [];

        // Pick an attack target based on creature side:
        //   left creature → prefers left column (party[0,2]), falls back to right (party[1,3])
        //   right creature → prefers right column (party[1,3]), falls back to left (party[0,2])
        // Uses `vitals` (not state.championVitals) so kills earlier this tick are respected.
        const getTarget = (side: CreatureSide, attackAnyChampion = false, attackFromAllSides = false) => {
            if (attackAnyChampion || attackFromAllSides) {
                const alive = state.party.filter((c) => (vitals[c.id]?.hp ?? 0) > 0);
                return alive.length > 0 ? alive[Math.floor(Math.random() * alive.length)] : null;
            }
            const preferIdx = side === 'left' ? [0, 2] : [1, 3];
            const fallbackIdx = side === 'left' ? [1, 3] : [0, 2];
            for (const indices of [preferIdx, fallbackIdx]) {
                // Front row first within the column set
                const frontAlive = indices.filter(i => i <= 1)
                    .map(i => state.party[i])
                    .filter((c): c is import('../data/champions').Champion =>
                        !!c && (vitals[c.id]?.hp ?? 0) > 0);
                if (frontAlive.length > 0)
                    return frontAlive[Math.floor(Math.random() * frontAlive.length)];
                const backAlive = indices.filter(i => i > 1)
                    .map(i => state.party[i])
                    .filter((c): c is import('../data/champions').Champion =>
                        !!c && (vitals[c.id]?.hp ?? 0) > 0);
                if (backAlive.length > 0)
                    return backAlive[Math.floor(Math.random() * backAlive.length)];
            }
            return null;
        };

        for (let i = 0; i < creatures.length; i++) {
            const c = creatures[i];
            if (!c.alive || c.mapIndex !== state.level) continue;
            const def = CREATURE_TYPES[c.typeId];
            if (!def) continue;
            if (state.freezeLifeRemainingTicks > 0 && !def.archenemy) continue;

            // Read timers from external mutable Map (avoids per-frame Zustand updates)
            const timers = creatureTimers.get(c.id) ?? {
                mt: Math.random() * nextMonsterMoveDelaySecondsApprox(def.moveSpd),
                at: Math.random() * nextMonsterAttackDelaySecondsApprox(def.atkSpd),
            };
            let moveTimer = Math.max(0, timers.mt - delta);
            let atkTimer  = Math.max(0, timers.at  - delta);

            const dx   = px - c.x;
            const dy   = py - c.y;
            const dist = Math.abs(dx) + Math.abs(dy);
            const adjacent = dist === 1;
            const nowMs = Date.now();
            const partyInvisible = nowMs < state.invisibleUntil;
            const hasVisualLineOfSight =
                dist <= Math.max(1, def.sightRange ?? 8) &&
                hasLineOfSight(map, state.level, state.openDoors, c.x, c.y, px, py);
            const canDetectParty = hasVisualLineOfSight && (!partyInvisible || def.seeInvisible);
            const confused = (creatureConfusedUntil.get(c.id) ?? 0) > nowMs;
            const fluxcaged = (creatureFluxcageUntil.get(c.id) ?? 0) > nowMs;
            const frightened = (creatureFrightenedUntil.get(c.id) ?? 0) > nowMs;
            const attackReach = Math.max(1, def.attackRange ?? 1);
            const prefersRangedSpacing =
                def.preferBackRow ||
                (attackReach > 1 && (def.nonMaterial || def.attackTypes.includes('Magic') || def.levitates));
            const lastSeen = creatureLastSeenPartyPos.get(c.id);
            const rememberedTarget = lastSeen && lastSeen.expiresAt > nowMs ? lastSeen : null;

            if (canDetectParty) {
                creatureLastSeenPartyPos.set(c.id, {
                    x: px,
                    y: py,
                    expiresAt: nowMs + 6000,
                });
            } else if (lastSeen && lastSeen.expiresAt <= nowMs) {
                creatureLastSeenPartyPos.delete(c.id);
            }

            let nx = c.x, ny = c.y;
            let movedThisTick = false;

            // ── Movement ──────────────────────────────────────────────────────
            if (moveTimer === 0 && (!adjacent || frightened)) {
                moveTimer = nextMonsterMoveDelaySecondsApprox(def.moveSpd);
                if (fluxcaged) {
                    creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });
                    continue;
                }
                if (confused && randomInt(2) === 0) {
                    creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });
                    continue;
                }

                // Count alive creatures per tile (max 2 per tile with different sides)
                const tileCounts: Record<string, number> = {};
                for (const o of creatures) {
                    if (!o.alive || o.id === c.id || o.mapIndex !== state.level) continue;
                    const k = `${o.x},${o.y}`;
                    tileCounts[k] = (tileCounts[k] ?? 0) + 1;
                }
                const tileAvailable = (tx: number, ty: number) =>
                    (tileCounts[`${tx},${ty}`] ?? 0) < 2;

                if (canDetectParty || rememberedTarget) {
                    const targetX = canDetectParty ? px : rememberedTarget!.x;
                    const targetY = canDetectParty ? py : rememberedTarget!.y;
                    const targetDx = targetX - c.x;
                    const targetDy = targetY - c.y;
                    if (frightened) {
                        const fleeOptions = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                            .map(([ddx, ddy]) => [c.x + ddx, c.y + ddy] as [number, number])
                            .filter(([cx, cy]) => monsterWalkable(state.level, cy, cx) && tileAvailable(cx, cy))
                            .map(([cx, cy]) => ({
                                x: cx,
                                y: cy,
                                distance: Math.abs(targetX - cx) + Math.abs(targetY - cy),
                            }))
                            .filter((candidate) => candidate.distance > dist)
                            .sort((a, b) => b.distance - a.distance);
                        if (fleeOptions.length > 0) {
                            nx = fleeOptions[0]!.x;
                            ny = fleeOptions[0]!.y;
                            movedThisTick = true;
                            if (canDetectParty) playCreatureMove(c.typeId);
                            notifyCreatureAction(c.id, 'move');
                        }
                    }
                    if (movedThisTick) {
                        // frightened flee already resolved for this tick
                    } else if (prefersRangedSpacing && canDetectParty && dist <= attackReach && dist > 1) {
                        creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });
                        continue;
                    }
                    const candidates: [number, number][] = [];
                    if (targetDx !== 0) candidates.push([c.x + Math.sign(targetDx), c.y]);
                    if (targetDy !== 0) candidates.push([c.x, c.y + Math.sign(targetDy)]);
                    const valid = candidates.filter(
                        ([cx, cy]) => monsterWalkable(state.level, cy, cx) && tileAvailable(cx, cy)
                    );
                    if (valid.length > 0) {
                        [nx, ny] = valid[Math.floor(Math.random() * valid.length)];
                        if (nx !== c.x || ny !== c.y) {
                            movedThisTick = true;
                            if (canDetectParty) playCreatureMove(c.typeId);
                            notifyCreatureAction(c.id, 'move');
                        }
                    } else if (canDetectParty) {
                        // Lightweight "waiting" motion when a visible target is blocked by a closed door/grille.
                        // This keeps nearby monsters lively without pathfinding beyond the four adjacent tiles.
                        const roamCandidates = [[1,0],[-1,0],[0,1],[0,-1]]
                            .map(([ddx, ddy]) => [c.x + ddx, c.y + ddy] as [number, number])
                            .filter(([cx, cy]) =>
                                monsterWalkable(state.level, cy, cx) &&
                                tileAvailable(cx, cy) &&
                                !(cx === px && cy === py),
                            );
                        const patrol = roamCandidates.filter(([cx, cy]) => {
                            const nextDist = Math.abs(targetX - cx) + Math.abs(targetY - cy);
                            return nextDist >= Math.max(2, attackReach) && nextDist <= dist + 2;
                        });
                        const fallbackPatrol = patrol.length > 0 ? patrol : roamCandidates;
                        if (fallbackPatrol.length > 0) {
                            [nx, ny] = fallbackPatrol[Math.floor(Math.random() * fallbackPatrol.length)];
                            if (nx !== c.x || ny !== c.y) {
                                movedThisTick = true;
                                playCreatureMove(c.typeId);
                                notifyCreatureAction(c.id, 'move');
                            }
                        }
                    }
                } else {
                    const dirs: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];
                    const valid = dirs
                        .map(([ddx, ddy]) => [c.x + ddx, c.y + ddy] as [number, number])
                        .filter(([cx, cy]) => monsterWalkable(state.level, cy, cx) && tileAvailable(cx, cy));
                    if (valid.length > 0) {
                        [nx, ny] = valid[Math.floor(Math.random() * valid.length)];
                        if (nx !== c.x || ny !== c.y) {
                            movedThisTick = true;
                            if (canDetectParty) playCreatureMove(c.typeId);
                            notifyCreatureAction(c.id, 'move');
                        }
                    } else {
                        moveTimer = nextMonsterMoveDelaySecondsApprox(def.moveSpd);
                    }
                }
            }

            // ── Attack ────────────────────────────────────────────────────────
            const distanceAfterMove = Math.abs(px - nx) + Math.abs(py - ny);
            const adjacentAfterMove = distanceAfterMove === 1;
            const creatureProjectileEffect = chooseOriginalCreatureProjectileEffectApprox(c.typeId);
            const canUseRangedAttackAfterMove =
                attackReach > 1 &&
                distanceAfterMove > 1 &&
                distanceAfterMove <= attackReach &&
                canDetectParty &&
                Boolean(creatureProjectileEffect);

            if (movedThisTick && canDetectParty) {
                atkTimer = Math.max(atkTimer, CREATURE_ATTACK_WINDOW_MS / 1000);
            }

            if (!frightened && !movedThisTick && atkTimer === 0 && (adjacentAfterMove || canUseRangedAttackAfterMove) && canDetectParty) {
                atkTimer = nextMonsterAttackDelaySecondsApprox(def.atkSpd);
                if (confused && randomInt(2) === 0) {
                    creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });
                    continue;
                }
                playCreatureAttack(c.typeId);
                notifyCreatureAction(c.id, 'attack');
                creatureAttackWindows.set(c.id, nowMs + CREATURE_ATTACK_WINDOW_MS);
                lastCreatureAttackGameTick = state.elapsedGameTimeTicks;

                const target = getTarget(c.side, def.attackAnyChampion, def.attackFromAllSides);
                if (target) {
                    const shouldLaunchProjectile =
                        Boolean(creatureProjectileEffect) &&
                        attackReach > 1 &&
                        distanceAfterMove <= attackReach &&
                        canDetectParty &&
                        (distanceAfterMove > 1 || randomInt(2) !== 0);
                    if (shouldLaunchProjectile) {
                        const projectile = buildCreatureProjectileApprox(
                            state,
                            { ...c, x: nx, y: ny, mapIndex: c.mapIndex },
                            def,
                            creatureProjectileEffect!,
                            target.id,
                            nowMs,
                        );
                        if (projectiles === state.projectiles) projectiles = [...state.projectiles];
                        projectiles.push(projectile);
                        anyChange = true;
                        continue;
                    }
                    const tv = vitals[target.id];
                    if (tv && tv.hp > 0) {
                        const targetChampion = state.party.find((partyChampion) => partyChampion.id === target.id);
                        if (!targetChampion) continue;
                        if (targetChampion && def.attackTypes.includes('Steal')) {
                            const { stolenItem, nextInventory } = tryStealBackpackItemApprox(target.id, targetChampion, {
                                ...state,
                                championVitals: vitals,
                                championInventories,
                            });
                            if (stolenItem) {
                                if (creatures === state.creatures) creatures = [...creatures];
                                creatures[i] = {
                                    ...c,
                                    carriedItems: [...(c.carriedItems ?? []), stolenItem],
                                };
                                championInventories = {
                                    ...championInventories,
                                    [target.id]: nextInventory,
                                };
                                anyChange = true;
                            }
                            continue;
                        }
                        const attackMode = canUseRangedAttackAfterMove && !adjacentAfterMove ? 'ranged' : 'melee';
                        const attackResolution = targetChampion
                            ? determineMonsterAttackDamageApprox(state, targetChampion, tv, c, attackMode, nowMs)
                            : {
                                damage: 0 as number,
                                hitZones: undefined,
                                damageClass: 'physical' as const,
                                nextVitals: tv,
                            };
                        const raw = attackResolution.damage;
                        if (raw <= 0) continue;
                        const equip = state.championEquipment[target.id] ?? {};
                        const dmg = Math.max(1, raw);
                        let nextTargetVitals = attackResolution.nextVitals;
                        if (def.attackTypes.includes('StaminaDrain')) {
                            const staminaDamage = Math.max(1, Math.floor(dmg / 2) + randomInt(4));
                            const effective = getEffectiveChampionStatsRuntime(targetChampion, equip, state.activePotionBoosts, nextTargetVitals);
                            nextTargetVitals = {
                                ...nextTargetVitals,
                                stamina: clampVital(nextTargetVitals.stamina - staminaDamage, effective.stamina),
                            };
                        }
                        if (nextTargetVitals.hp > 0 && def.poisonAttack > 0 && randomInt(2) !== 0) {
                            if (targetChampion) {
                                const effective = getEffectiveChampionStatsRuntime(targetChampion, equip, state.activePotionBoosts, nextTargetVitals);
                                const poisonStrength = adjustByAttributeApprox(def.poisonAttack, effective.vitality);
                                nextTargetVitals = applyPoisonCharacterApprox(nextTargetVitals, poisonStrength);
                            }
                        }
                        const newHP = nextTargetVitals.hp;
                        vitals = { ...vitals, [target.id]: nextTargetVitals };
                        if (newHP === 0 && !newlyDead.includes(target.id))
                            newlyDead.push(target.id);
                        playChampionWounded();
                        dmgEvts = [...dmgEvts, buildChampionDamageEvent(state.level, target.id, dmg)];
                        anyChange = true;
                    }
                }
            }

            // Assign side at destination: pick available side
            let destinationMapIndex = c.mapIndex;
            const destinationTile = getMap(destinationMapIndex).tiles[ny]?.[nx];
            if (destinationTile?.type === 'Teleporter') {
                const tpKey = `${destinationMapIndex},${ny},${nx}`;
                const tp = getTeleporter(destinationTile);
                if (tp && state.openTeleporters.has(tpKey)) {
                    const teleportedLevel = tp.destMap;
                    const teleportedX = tp.destX;
                    const teleportedY = tp.destY;
                    const destinationOccupied = creatures.some((other) =>
                        other.alive &&
                        other.id !== c.id &&
                        other.mapIndex === teleportedLevel &&
                        other.x === teleportedX &&
                        other.y === teleportedY,
                    );
                    if (!destinationOccupied && monsterWalkable(teleportedLevel, teleportedY, teleportedX)) {
                        destinationMapIndex = teleportedLevel;
                        nx = teleportedX;
                        ny = teleportedY;
                    }
                }
            }

            // Assign side at destination: pick available side
            let newSide = c.side;
            if (nx !== c.x || ny !== c.y || destinationMapIndex !== c.mapIndex) {
                const destOther = creatures.find(
                    o => o.alive && o.id !== c.id && o.mapIndex === destinationMapIndex && o.x === nx && o.y === ny
                );
                newSide = destOther ? (destOther.side === 'left' ? 'right' : 'left') : 'left';
            }

            // Always persist updated timers to the external Map (no re-render cost)
            creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });

            // Only update Zustand state when something visible changes (position / side / alive)
            if (nx !== c.x || ny !== c.y || newSide !== c.side || destinationMapIndex !== c.mapIndex) {
                if (creatures === state.creatures) creatures = [...creatures];
                creatures[i] = { ...c, mapIndex: destinationMapIndex, x: nx, y: ny, side: newSide };
                anyChange = true;
            }
        }

        // ── Process champion deaths ───────────────────────────────────────────
        let party                = state.party;
        let floorItems           = state.floorItems;
        let championEquipment    = state.championEquipment;
        let deadChampions        = state.deadChampions;

        for (const championId of newlyDead) {
            const partial = buildDeathDrop(
                { level: state.level, position: state.position, party, championInventories, championEquipment, floorItems, deadChampions },
                championId,
            );
            party               = partial.party;
            floorItems          = partial.floorItems;
            championInventories = partial.championInventories;
            championEquipment   = partial.championEquipment;
            deadChampions       = partial.deadChampions;
            anyChange           = true;
        }

        if (!anyChange && creatures === state.creatures && projectiles === state.projectiles) return state;

        const selectedChampionIndex = party.length > 0
            ? Math.min(state.selectedChampionIndex, party.length - 1)
            : 0;

        return {
            creatures,
            ...(projectiles !== state.projectiles ? { projectiles } : {}),
            ...(vitals !== state.championVitals             ? { championVitals: vitals }                     : {}),
            ...(dmgEvts !== state.damageEvents              ? { damageEvents: dmgEvts }                      : {}),
            ...(championInventories !== state.championInventories ? { championInventories } : {}),
            ...(lastCreatureAttackGameTick !== state.lastCreatureAttackGameTick ? { lastCreatureAttackGameTick } : {}),
            ...(party !== state.party ? {
                party,
                selectedChampionIndex,
                floorItems,
                championEquipment,
                deadChampions,
            } : {}),
        };
    }),

    // ─── Combat tick (cooldowns + damage event cleanup) ───────────────────────
    // ─── Spell tick (lights expiry + projectile movement) ─────────────────────
    tickSpells: (now) => set((state) => {
        if (state.optionsModalOpen) return state;
        // 1. Remove expired lights
        const spellLights = state.spellLights.filter(l => l.expiresAt > now);
        const currentGameTick = state.elapsedGameTimeTicks;

        // 2. Advance projectiles
        const keepProjectiles: Projectile[] = [];
        let creatures = state.creatures as CreatureInstance[];
        let dmgEvts = state.damageEvents;
        let spellVisualEvents = state.spellVisualEvents;
        let floorItems = state.floorItems;
        let openDoors = state.openDoors;
        let party = state.party;
        let championVitals = state.championVitals;
        let championInventories = state.championInventories;
        let championEquipment = state.championEquipment;
        let deadChampions = state.deadChampions;
        let selectedChampionIndex = state.selectedChampionIndex;
        let activePoisonClouds = state.activePoisonClouds;
        let lastCreatureAttackGameTick = state.lastCreatureAttackGameTick;
        const partyX = state.position[1];
        const partyY = state.position[0];

        for (const proj of state.projectiles) {
            // Not yet time to move
            if (proj.nextMoveAt > now) {
                keepProjectiles.push(proj);
                continue;
            }

            // Compute next tile
            let ny = proj.y, nx = proj.x;
            if      (proj.direction === 'NORTH') ny--;
            else if (proj.direction === 'SOUTH') ny++;
            else if (proj.direction === 'EAST')  nx++;
            else                                  nx--; // WEST

            // Wall / out-of-bounds / closed door → despawn
            const map = getMap(proj.level);
            const tile = map.tiles[ny]?.[nx];
            const doorKey = `${proj.level},${ny},${nx}`;
            const wallKey = `${proj.level},${ny},${nx}`;
            const closedDoor = tile?.type === 'Door' && !state.openDoors.has(doorKey)
                ? tile.objects.find((o): o is import('../types/game').DoorObject => o.category === 'Door')
                : undefined;
            const closedDoorBlocksProjectile = (() => {
                if (!closedDoor) return false;
                return doorBlocksThrownItems(closedDoor.doorType);
            })();
            if (proj.effect === 'open' && closedDoor) {
                if (closedDoor.hasButton) {
                    if (openDoors === state.openDoors) openDoors = new Set(state.openDoors);
                    openDoors.add(doorKey);
                    playDoorMotion(
                        DOOR_TOGGLE_SOUND_DURATION_MS,
                        getDoorSoundVolume(proj.level, nx, ny),
                    );
                }
                spellVisualEvents = [
                    ...spellVisualEvents,
                    {
                        id: `spellimpact_door_${now}_${Math.random().toString(36).slice(2)}`,
                        level: proj.level,
                        x: nx,
                        y: ny,
                        height: GRID_SIZE * 0.08,
                        effect: 'open',
                        visualScale: proj.visualScale,
                        ts: now,
                        kind: 'wall',
                    },
                ];
                continue;
            }
            if (!tile || tile.type === 'Wall' || (tile.type === 'TrickWall' && !state.openWalls.has(wallKey)) || closedDoorBlocksProjectile) {
                const wallImpactEffect = proj.effect === 'physical' ? proj.explosionOnImpact : proj.effect;
                if (wallImpactEffect) {
                    spellVisualEvents = [
                        ...spellVisualEvents,
                        {
                            id: `spellimpact_wall_${now}_${Math.random().toString(36).slice(2)}`,
                            level: proj.level,
                            x: proj.x,
                            y: proj.y,
                            height: GRID_SIZE * 0.08,
                            effect: wallImpactEffect,
                            visualScale: proj.effect === 'physical'
                                ? getThrownExplosionVisualScale(proj.explosionAttack) * 1.05
                                : (proj.visualScale ?? 1) * 1.2,
                            ts: now,
                            kind: 'wall',
                        },
                    ];
                }
                if (wallImpactEffect === 'poison_cloud') {
                    const cloudAttack = proj.effect === 'physical'
                        ? Math.max(1, proj.explosionAttack ?? 0)
                        : Math.max(1, proj.remainingAttack ?? ORIGINAL_SPELL_PROJECTILE_ATTACK);
                    const cloudVisualScale = proj.effect === 'physical'
                        ? getThrownExplosionVisualScale(proj.explosionAttack)
                        : (proj.visualScale ?? 1) * 1.08;
                    if (activePoisonClouds === state.activePoisonClouds) activePoisonClouds = [...activePoisonClouds];
                    activePoisonClouds.push(
                        buildActivePoisonCloud(
                            proj.level,
                            proj.x,
                            proj.y,
                            cloudAttack,
                            currentGameTick,
                            cloudVisualScale,
                        ),
                    );
                }
                if (proj.effect === 'physical' && proj.physicalItem && !proj.explosionOnImpact) {
                    if (floorItems === state.floorItems) floorItems = [...floorItems];
                    floorItems.push(buildDroppedItem(proj.physicalItem, proj.level, proj.x, proj.y));
                }
                continue; // projectile absorbed by wall
            }

            const hitsPartySquare =
                proj.launchedBy === 'creature' &&
                proj.level === state.level &&
                nx === partyX &&
                ny === partyY;
            if (hitsPartySquare) {
                lastCreatureAttackGameTick = state.elapsedGameTimeTicks;
                const impact = proj.effect === 'physical'
                    ? { damage: Math.max(1, Math.round(proj.remainingAttack ?? proj.damage[1])), attackType: 'Blunt' as IncomingAttackTypeApprox, poisonAttack: 0 }
                    : rollOriginalProjectileImpactAttackApprox(
                        proj.effect,
                        Math.max(0, Math.round(proj.remainingRange ?? 0)),
                        Math.max(0, Math.round(proj.remainingAttack ?? 0)),
                    );
                const targetChampion = party.find((champion) => champion.id === proj.targetChampionId)
                    ?? party.find((champion) => (championVitals[champion.id]?.hp ?? 0) > 0);
                if (targetChampion) {
                    const currentVitals = championVitals[targetChampion.id];
                    if (currentVitals && currentVitals.hp > 0 && impact.damage > 0) {
                        const resolved = resolveChampionIncomingAttackApprox(
                            state,
                            targetChampion,
                            currentVitals,
                            impact.damage,
                            impact.attackType,
                            ['head', 'torso'],
                            now,
                        );
                        if (resolved.damage > 0) {
                            championVitals = {
                                ...championVitals,
                                [targetChampion.id]: resolved.nextVitals,
                            };
                            dmgEvts = [...dmgEvts, buildChampionDamageEvent(proj.level, targetChampion.id, resolved.damage)];
                            if (impact.poisonAttack > 0 && resolved.nextVitals.hp > 0 && randomInt(2) !== 0) {
                                championVitals[targetChampion.id] = applyPoisonCharacterApprox(
                                    championVitals[targetChampion.id]!,
                                    impact.poisonAttack,
                                );
                                if ((championVitals[targetChampion.id]?.hp ?? 0) === 0) {
                                    const partial = buildDeathDrop(
                                        {
                                            level: state.level,
                                            position: state.position,
                                            party,
                                            championInventories,
                                            championEquipment,
                                            floorItems,
                                            deadChampions,
                                        },
                                        targetChampion.id,
                                    );
                                    party = partial.party;
                                    floorItems = partial.floorItems;
                                    championInventories = partial.championInventories;
                                    championEquipment = partial.championEquipment;
                                    deadChampions = partial.deadChampions;
                                    selectedChampionIndex = party.length > 0
                                        ? Math.min(selectedChampionIndex, party.length - 1)
                                        : 0;
                                }
                            }
                            if (championVitals[targetChampion.id]?.hp === 0) {
                                const partial = buildDeathDrop(
                                    {
                                        level: state.level,
                                        position: state.position,
                                        party,
                                        championInventories,
                                        championEquipment,
                                        floorItems,
                                        deadChampions,
                                    },
                                    targetChampion.id,
                                );
                                party = partial.party;
                                floorItems = partial.floorItems;
                                championInventories = partial.championInventories;
                                championEquipment = partial.championEquipment;
                                deadChampions = partial.deadChampions;
                                selectedChampionIndex = party.length > 0
                                    ? Math.min(selectedChampionIndex, party.length - 1)
                                    : 0;
                            }
                        }
                    }
                }

                if (proj.effect === 'fireball' || proj.effect === 'lightning') {
                    const splash = applyPartySpellBacklashDamage(
                        {
                            level: state.level,
                            position: state.position,
                            party,
                            championInventories,
                            championEquipment,
                            floorItems,
                            deadChampions,
                            selectedChampionIndex,
                            damageEvents: dmgEvts,
                            activeShields: state.activeShields,
                            activePotionBoosts: state.activePotionBoosts,
                        },
                        championVitals,
                        proj.effect,
                        rollOriginalExplosionBurstAttack(
                            proj.effect,
                            Math.max(1, Math.round(proj.remainingRange ?? 0)),
                        ),
                        now,
                    );
                    if (splash) {
                        party = splash.party ?? party;
                        championVitals = splash.championVitals ?? championVitals;
                        championInventories = splash.championInventories ?? championInventories;
                        championEquipment = splash.championEquipment ?? championEquipment;
                        floorItems = splash.floorItems ?? floorItems;
                        deadChampions = splash.deadChampions ?? deadChampions;
                        selectedChampionIndex = splash.selectedChampionIndex ?? selectedChampionIndex;
                        dmgEvts = splash.damageEvents ?? dmgEvts;
                    }
                } else if (proj.effect === 'poison_cloud') {
                    const splash = applyPartyWideIncomingAttackApprox(
                        {
                            level: state.level,
                            position: state.position,
                            party,
                            championInventories,
                            championEquipment,
                            floorItems,
                            deadChampions,
                            selectedChampionIndex,
                            damageEvents: dmgEvts,
                            activeShields: state.activeShields,
                            activePotionBoosts: state.activePotionBoosts,
                            championCombat: state.championCombat,
                        },
                        championVitals,
                        rollOriginalExplosionBurstAttack(
                            'poison_cloud',
                            Math.max(1, Math.round(proj.remainingRange ?? 0)),
                        ),
                        'Normal',
                        [],
                        now,
                    );
                    if (splash) {
                        party = splash.party ?? party;
                        championVitals = splash.championVitals ?? championVitals;
                        championInventories = splash.championInventories ?? championInventories;
                        championEquipment = splash.championEquipment ?? championEquipment;
                        floorItems = splash.floorItems ?? floorItems;
                        deadChampions = splash.deadChampions ?? deadChampions;
                        selectedChampionIndex = splash.selectedChampionIndex ?? selectedChampionIndex;
                        dmgEvts = splash.damageEvents ?? dmgEvts;
                    }
                    if (activePoisonClouds === state.activePoisonClouds) activePoisonClouds = [...activePoisonClouds];
                    activePoisonClouds.push(
                        buildActivePoisonCloud(
                            proj.level,
                            nx,
                            ny,
                            Math.max(1, proj.remainingRange ?? ORIGINAL_SPELL_PROJECTILE_ATTACK),
                            currentGameTick,
                            (proj.visualScale ?? 1) * 1.08,
                        ),
                    );
                }

                const partyImpactEffect = proj.effect === 'physical' ? proj.explosionOnImpact : proj.effect;
                if (partyImpactEffect) {
                    spellVisualEvents = [
                        ...spellVisualEvents,
                        {
                            id: `spellimpact_party_${now}_${Math.random().toString(36).slice(2)}`,
                            level: proj.level,
                            x: nx,
                            y: ny,
                            height: GRID_SIZE * 0.08,
                            effect: partyImpactEffect,
                            visualScale: proj.effect === 'physical'
                                ? getThrownExplosionVisualScale(proj.explosionAttack)
                                : proj.visualScale,
                            ts: now,
                            kind: 'creature',
                        },
                    ];
                }
                continue;
            }

            // Creature hit → deal damage and despawn
            const hitCreatures = creatures.filter(c => c.alive && c.mapIndex === proj.level && c.x === nx && c.y === ny);
            const hit = hitCreatures[0];
            if (hit) {
                if (proj.effect === 'open') {
                    const nextRemainingRange = proj.remainingRange === undefined
                        ? undefined
                        : Math.max(0, proj.remainingRange - (proj.stepDecay ?? 1));
                    if (nextRemainingRange !== undefined && nextRemainingRange <= 0) {
                        continue;
                    }
                    keepProjectiles.push({
                        ...proj,
                        x: nx,
                        y: ny,
                        nextMoveAt: now + PROJECTILE_STEP_MS,
                        remainingRange: nextRemainingRange,
                    });
                    continue;
                }
                const hitDef = CREATURE_TYPES[hit.typeId];
                const sourceSpell = proj.spellRunes ? findSpell(proj.spellRunes) : null;
                const passesThroughNonMaterial =
                    proj.effect !== 'physical' &&
                    Boolean(hitDef?.nonMaterial) &&
                    proj.effect !== 'disrupt_nonmaterial';
                if (!passesThroughNonMaterial) {
                    if (proj.effect === 'physical' && hitDef?.absorbMissiles) {
                        continue;
                    }
                    const sourceBackedImpact =
                        sourceSpell && (proj.effect === 'fireball' || proj.effect === 'lightning')
                            ? rollOriginalSpellProjectileImpact(
                                sourceSpell,
                                Math.max(0, Math.round(proj.remainingRange ?? 0)),
                                Math.max(0, Math.round(proj.remainingAttack ?? 0)),
                                randomInt,
                            )
                            : null;
                    const poisonDamage = sourceBackedImpact?.poisonStrength
                        ? getOriginalCreaturePoisonAdjustedAttack(hit.typeId, sourceBackedImpact.poisonStrength)
                        : 0;
                    const rolledDamage = proj.effect === 'physical'
                        ? Math.max(1, Math.round(proj.remainingAttack ?? proj.damage[1]))
                        : sourceBackedImpact
                            ? sourceBackedImpact.damage + poisonDamage
                            : proj.damage[0] + Math.floor(Math.random() * (proj.damage[1] - proj.damage[0] + 1));
                    let totalDmg = 0;
                    if (proj.effect === 'disrupt_nonmaterial') {
                        const disruptExplosionAttack = rollOriginalExplosionBurstAttack(
                            'disrupt_nonmaterial',
                            Math.max(0, Math.round(proj.remainingAttack ?? 0)),
                        );
                        const disruptTargets = hitCreatures.filter((candidate) => isLikelyNonMaterial(candidate));
                        if (disruptTargets.length > 0) {
                            if (creatures === state.creatures) creatures = [...creatures];
                            for (const disruptTarget of disruptTargets) {
                                const disruptDamage = rollOriginalDisruptNonMaterialAttack(
                                    now,
                                    disruptTarget,
                                    disruptExplosionAttack,
                                );
                                if (disruptDamage <= 0) continue;
                                const idx = creatures.findIndex((candidate) => candidate.id === disruptTarget.id);
                                if (idx < 0) continue;
                                const currentTarget = creatures[idx]!;
                                const newHP = Math.max(0, currentTarget.currentHP - disruptDamage);
                                const killed = newHP <= 0;
                                creatures[idx] = { ...currentTarget, currentHP: newHP, alive: !killed };
                                totalDmg += Math.max(0, currentTarget.currentHP - newHP);
                                if (killed) {
                                    const dropped = dropCreatureCarriedItems(creatures, floorItems, currentTarget.id);
                                    creatures = dropped.creatures;
                                    floorItems = dropped.floorItems;
                                    spellVisualEvents = [...spellVisualEvents, buildDeathDustEvent(proj.level, nx, ny)];
                                }
                            }
                        }
                    } else {
                        let newHP = Math.max(0, hit.currentHP - rolledDamage);
                        totalDmg = Math.max(0, hit.currentHP - newHP);
                        if (proj.effect === 'physical' && proj.explosionOnImpact && proj.explosionAttack) {
                            const rawExplosionDamage = rollOriginalExplosionBurstAttack(
                                proj.explosionOnImpact,
                                proj.explosionAttack,
                            );
                            const adjustedExplosionDamage = proj.explosionOnImpact === 'poison_cloud'
                                ? getOriginalCreaturePoisonAdjustedAttack(hit.typeId, rawExplosionDamage)
                                : rawExplosionDamage;
                            const appliedExplosionDamage = Math.max(0, Math.min(newHP, adjustedExplosionDamage));
                            newHP = Math.max(0, newHP - appliedExplosionDamage);
                            totalDmg += appliedExplosionDamage;
                            if (proj.explosionOnImpact === 'poison_cloud') {
                                const lingeringCloud = buildLingeringPoisonCloudAfterImmediatePulse(
                                    proj.level,
                                    nx,
                                    ny,
                                    proj.explosionAttack,
                                    currentGameTick + 1,
                                    getThrownExplosionVisualScale(proj.explosionAttack),
                                );
                                if (lingeringCloud) {
                                    if (activePoisonClouds === state.activePoisonClouds) activePoisonClouds = [...activePoisonClouds];
                                    activePoisonClouds.push(lingeringCloud);
                                }
                            }
                        }
                        const killed = newHP <= 0;
                        if (creatures === state.creatures) creatures = [...creatures];
                        const idx = creatures.findIndex(c => c.id === hit.id);
                        if (idx >= 0) creatures[idx] = { ...creatures[idx], currentHP: newHP, alive: !killed };
                        if (killed) {
                            const dropped = dropCreatureCarriedItems(creatures, floorItems, hit.id);
                            creatures = dropped.creatures;
                            floorItems = dropped.floorItems;
                            spellVisualEvents = [...spellVisualEvents, buildDeathDustEvent(proj.level, nx, ny)];
                        }
                    }
                    if (totalDmg > 0) {
                        dmgEvts = [...dmgEvts, buildCreatureDamageEvent(proj.level, nx, ny, totalDmg)];
                    }
                    const creatureImpactEffect = proj.effect === 'physical' ? proj.explosionOnImpact : proj.effect;
                    if (creatureImpactEffect) {
                        spellVisualEvents = [
                            ...spellVisualEvents,
                            {
                                id: `spellimpact_creature_${now}_${Math.random().toString(36).slice(2)}`,
                                level: proj.level,
                                x: nx,
                                y: ny,
                                height: GRID_SIZE * 0.08,
                                effect: creatureImpactEffect,
                                visualScale: proj.effect === 'physical'
                                    ? getThrownExplosionVisualScale(proj.explosionAttack)
                                    : proj.visualScale,
                                ts: now,
                                kind: 'creature',
                            },
                        ];
                    }
                    if (proj.effect === 'poison_cloud') {
                        if (activePoisonClouds === state.activePoisonClouds) activePoisonClouds = [...activePoisonClouds];
                        activePoisonClouds.push(
                            buildActivePoisonCloud(
                                proj.level,
                                nx,
                                ny,
                                Math.max(1, proj.remainingAttack ?? ORIGINAL_SPELL_PROJECTILE_ATTACK),
                                currentGameTick,
                                (proj.visualScale ?? 1) * 1.08,
                            ),
                        );
                    }
                    if (proj.effect === 'physical' && proj.physicalItem && !proj.explosionOnImpact) {
                        if (floorItems === state.floorItems) floorItems = [...floorItems];
                        floorItems.push(buildDroppedItem(proj.physicalItem, proj.level, nx, ny));
                    }
                    continue; // projectile consumed
                }
            }

            if (proj.effect === 'physical') {
                const remainingRange = (proj.remainingRange ?? 1) - 1;
                const remainingAttack = Math.max(0, (proj.remainingAttack ?? proj.damage[1]) - (proj.stepDecay ?? 1));
                if (remainingRange <= 0 || remainingAttack <= 0) {
                    if (proj.physicalItem) {
                        if (floorItems === state.floorItems) floorItems = [...floorItems];
                        floorItems.push(buildDroppedItem(proj.physicalItem, proj.level, nx, ny));
                    }
                    continue;
                }
                keepProjectiles.push({
                    ...proj,
                    x: nx,
                    y: ny,
                    nextMoveAt: now + PHYSICAL_PROJECTILE_STEP_MS,
                    remainingRange,
                    remainingAttack,
                });
                continue;
            }

            const nextRemainingAttack = proj.remainingAttack === undefined
                ? undefined
                : Math.max(0, proj.remainingAttack - (proj.stepDecay ?? 1));
            const nextMagicRange = proj.remainingRange === undefined
                ? undefined
                : Math.max(0, proj.remainingRange - (proj.stepDecay ?? 1));
            if ((nextMagicRange !== undefined && nextMagicRange <= 0) ||
                (nextRemainingAttack !== undefined && nextRemainingAttack <= 0)) {
                continue;
            }

            // Move forward, schedule next step
            keepProjectiles.push({
                ...proj,
                x: nx,
                y: ny,
                nextMoveAt: now + PROJECTILE_STEP_MS,
                remainingRange: nextMagicRange,
                remainingAttack: nextRemainingAttack,
            });
        }

        if (activePoisonClouds.length > 0) {
            const nextPoisonClouds: ActivePoisonCloud[] = [];
            for (const cloud of activePoisonClouds) {
                let workingCloud: ActivePoisonCloud | null = cloud;
                while (workingCloud && workingCloud.nextPulseGameTick <= currentGameTick) {
                    const pulseAttack = rollOriginalExplosionBurstAttack('poison_cloud', workingCloud.remainingAttack);
                    const onPartySquare =
                        workingCloud.level === state.level &&
                        state.position[1] === workingCloud.x &&
                        state.position[0] === workingCloud.y;

                    if (onPartySquare && pulseAttack > 0) {
                        const backlash = applyPartyWideIncomingAttackApprox(
                            {
                                level: state.level,
                                position: state.position,
                                party,
                                championInventories,
                                championEquipment,
                                floorItems,
                                deadChampions,
                                selectedChampionIndex,
                                damageEvents: dmgEvts,
                                activeShields: state.activeShields,
                                activePotionBoosts: state.activePotionBoosts,
                                championCombat: state.championCombat,
                            },
                            championVitals,
                            pulseAttack,
                            'Normal',
                            [],
                            now,
                        );
                        if (backlash) {
                            party = backlash.party ?? party;
                            championVitals = backlash.championVitals ?? championVitals;
                            championInventories = backlash.championInventories ?? championInventories;
                            championEquipment = backlash.championEquipment ?? championEquipment;
                            floorItems = backlash.floorItems ?? floorItems;
                            deadChampions = backlash.deadChampions ?? deadChampions;
                            selectedChampionIndex = backlash.selectedChampionIndex ?? selectedChampionIndex;
                            dmgEvts = backlash.damageEvents ?? dmgEvts;
                        }
                    } else {
                        const currentCloud = workingCloud;
                        const hit = creatures.find(
                            (creature) =>
                                creature.alive &&
                                creature.mapIndex === currentCloud.level &&
                                creature.x === currentCloud.x &&
                                creature.y === currentCloud.y,
                        );
                        if (hit) {
                            const adjustedDamage = getOriginalCreaturePoisonAdjustedAttack(hit.typeId, pulseAttack);
                            if (adjustedDamage > 0) {
                                const nextHP = Math.max(0, hit.currentHP - adjustedDamage);
                                const killed = nextHP <= 0;
                                if (creatures === state.creatures) creatures = [...creatures];
                                const idx = creatures.findIndex((creature) => creature.id === hit.id);
                                if (idx >= 0) creatures[idx] = { ...creatures[idx], currentHP: nextHP, alive: !killed };
                                dmgEvts = [...dmgEvts, buildCreatureDamageEvent(currentCloud.level, currentCloud.x, currentCloud.y, adjustedDamage)];
                                if (killed) {
                                    const dropped = dropCreatureCarriedItems(creatures, floorItems, hit.id);
                                    creatures = dropped.creatures;
                                    floorItems = dropped.floorItems;
                                    spellVisualEvents = [...spellVisualEvents, buildDeathDustEvent(currentCloud.level, currentCloud.x, currentCloud.y)];
                                }
                            }
                        }
                    }

                    if (workingCloud.remainingAttack >= 6) {
                        workingCloud = {
                            ...workingCloud,
                            remainingAttack: workingCloud.remainingAttack - 3,
                            nextPulseGameTick: workingCloud.nextPulseGameTick + 1,
                        };
                    } else {
                        workingCloud = null;
                    }
                }

                if (workingCloud) nextPoisonClouds.push(workingCloud);
            }
            activePoisonClouds = nextPoisonClouds;
        }

        // 3. Clean expired shields and potion boosts
        const activeShields = state.activeShields.filter(s => s.expiresAt > now);
        const activePotionBoosts = state.activePotionBoosts.filter(boost => boost.expiresAt > now);
        // 4. Clean footprints older than 60 s
        const footprintHistory = state.footprintHistory.filter(e => now - e.ts < FOOTPRINT_LIFETIME_MS);
        const nextSpellVisualEvents = spellVisualEvents.filter((event) => now - event.ts < DAMAGE_EVENT_LIFETIME_MS);

        const lightsChanged       = spellLights.length !== state.spellLights.length;
        const projectilesChanged  = keepProjectiles.length !== state.projectiles.length ||
            keepProjectiles.some((p, i) => p !== state.projectiles[i]);
        const creaturesChanged    = creatures !== state.creatures;
        const dmgChanged          = dmgEvts !== state.damageEvents;
        const spellVisualsChanged = nextSpellVisualEvents !== state.spellVisualEvents;
        const floorItemsChanged   = floorItems !== state.floorItems;
        const openDoorsChanged    = openDoors !== state.openDoors;
        const partyChanged        = party !== state.party;
        const championVitalsChanged = championVitals !== state.championVitals;
        const championInventoriesChanged = championInventories !== state.championInventories;
        const championEquipmentChanged = championEquipment !== state.championEquipment;
        const deadChampionsChanged = deadChampions !== state.deadChampions;
        const selectedChampionIndexChanged = selectedChampionIndex !== state.selectedChampionIndex;
        const poisonCloudsChanged = activePoisonClouds.length !== state.activePoisonClouds.length ||
            activePoisonClouds.some((cloud, index) => cloud !== state.activePoisonClouds[index]);
        const shieldsChanged      = activeShields.length !== state.activeShields.length;
        const potionBoostsChanged = activePotionBoosts.length !== state.activePotionBoosts.length;
        const footprintsChanged   = footprintHistory.length !== state.footprintHistory.length;

        if (!lightsChanged && !projectilesChanged && !creaturesChanged &&
            !dmgChanged && !spellVisualsChanged && !floorItemsChanged && !openDoorsChanged &&
            !partyChanged && !championVitalsChanged && !championInventoriesChanged &&
            !championEquipmentChanged && !deadChampionsChanged && !selectedChampionIndexChanged &&
            !poisonCloudsChanged && !shieldsChanged && !potionBoostsChanged && !footprintsChanged) return state;

        return {
            ...(lightsChanged      ? { spellLights }                   : {}),
            ...(projectilesChanged ? { projectiles: keepProjectiles }   : {}),
            ...(partyChanged       ? { party }                         : {}),
            ...(championVitalsChanged ? { championVitals }             : {}),
            ...(championInventoriesChanged ? { championInventories }   : {}),
            ...(championEquipmentChanged ? { championEquipment }       : {}),
            ...(creaturesChanged   ? { creatures }                      : {}),
            ...(dmgChanged         ? { damageEvents: dmgEvts }          : {}),
            ...(spellVisualsChanged ? { spellVisualEvents: nextSpellVisualEvents } : {}),
            ...(floorItemsChanged  ? { floorItems }                     : {}),
            ...(openDoorsChanged   ? { openDoors }                     : {}),
            ...(deadChampionsChanged ? { deadChampions }               : {}),
            ...(selectedChampionIndexChanged ? { selectedChampionIndex } : {}),
            ...(poisonCloudsChanged ? { activePoisonClouds }           : {}),
            ...(shieldsChanged     ? { activeShields }                  : {}),
            ...(potionBoostsChanged ? { activePotionBoosts }            : {}),
            ...(footprintsChanged  ? { footprintHistory }               : {}),
            ...(lastCreatureAttackGameTick !== state.lastCreatureAttackGameTick ? { lastCreatureAttackGameTick } : {}),
        };
    }),

    tickCombat: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        const updates: Record<number, ChampionCombat> = {};
        let combatChanged = false;
        for (const c of state.party) {
            const cb = state.championCombat[c.id];
            if (!cb) continue;
            if (cb.cooldown > 0) {
                const nextCooldown = Math.max(0, cb.cooldown - delta);
                updates[c.id] = {
                    ...cb,
                    cooldown: nextCooldown,
                    defenseModifier: nextCooldown > 0 ? cb.defenseModifier : 0,
                };
                combatChanged = true;
            } else if (cb.defenseModifier !== 0) {
                updates[c.id] = { ...cb, defenseModifier: 0 };
                combatChanged = true;
            }
        }
        const now = Date.now();
        const newEvents = state.damageEvents.filter(e => now - e.ts < DAMAGE_EVENT_LIFETIME_MS);
        const eventsChanged = newEvents.length !== state.damageEvents.length;
        if (!combatChanged && !eventsChanged) return state;
        return {
            ...(combatChanged ? { championCombat: { ...state.championCombat, ...updates } } : {}),
            ...(eventsChanged ? { damageEvents: newEvents } : {}),
        };
    }),
});

export const useStore = create<GameState>()(storeCreator);
