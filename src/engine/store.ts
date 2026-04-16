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
    GameMap, GameTile,
    CreatureInstance, CreatureObject, FloorItem,
    SensorObject, SensorAction, WallTextObject, CardinalDir, DoorObject,
    ChampionEquipment, CreatureCell,
} from '../types/game';
import type { EquipSlotKey } from '../types/items';
import type { Champion } from '../data/champions';
import { CHAMPION_BY_ID } from '../data/champions';
import { buildChampionStarterLoadout } from '../data/championStarterItems';
import { CREATURE_TYPES } from '../data/creatures';
import type { OriginalAttackType } from '../data/creatures';
import { findSpell } from '../data/runes';
import {
    getOriginalSpellRequiredSkillLevel,
} from '../data/originalSpells';
import {
    awardChampionXP,
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
import { getOriginalGeneratorConfig } from '../data/originalGenerators';
import { getOriginalTeleporterRuntime } from '../data/originalTeleporters';
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
} from '../data/weaponAttacks';
import {
    canFillWaterContainer,
    fillWaterContainer,
    consumeWaterContainer,
    isWaterContainer,
    normaliseWaterContainer,
} from '../data/waterContainers';
import { doorBlocksThrownItems, doorBlocksThrownPhysicalItem, doorBlocksVision } from '../data/doors';
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
import { readBestPersistedSave, writePersistedSave } from './saveGame';
import type { GameOptions } from './runtimeTypes';
import {
    buildPersistedSaveData as buildPersistedSaveDataSystem,
    hydratePersistedGameState as hydratePersistedGameStateSystem,
    restoreExternalCreatureRuntimeFromSave as restoreExternalCreatureRuntimeFromSaveSystem,
    tryParsePersistedSaveData as tryParsePersistedSaveDataSystem,
} from './systems/persistence';
import {
    buildInitialChampionXP,
    createChampionCurrentStats,
    normalizeChampionCurrentStats,
    normalizeChampionVitalsForChampion,
} from './systems/championState';
import {
    dropChampionCarriedItem,
    equipChampionInventoryItem,
    giveChampionEquippedItem,
    giveChampionInventoryItem,
    locateChampionItem,
    seedTorchBurnStartFromEquipment,
    throwChampionCarriedItem,
    unequipChampionItem,
} from './systems/inventoryState';
import {
    buildFloorItemPickupPatch,
    transferFloorItemToChampionState as transferFloorItemToChampionStateSystem,
} from './systems/floorItemState';
import {
    getChampionPotionBonuses,
    getChampionRuntimeBonuses,
} from './systems/championRuntimeBonuses';
import {
    buildCreatureProjectile,
    chooseOriginalCreatureProjectileEffect,
} from './systems/creatureProjectiles';
import { tryStealChampionItem } from './systems/creatureSteal';
import { buildProjectileSpellStatePatch } from './systems/spellProjectileState';
import { getDoorObject } from './systems/doorMetadata';
import { resolvePotionConsumption } from './systems/potionConsumption';
import { resolveFillWaterAction } from './systems/fillWaterAction';
import { resolveUseItemConsumption } from './systems/useItemConsumption';
import { buildUseItemPatch } from './systems/useItemPatch';
import { buildUseItemStatePatch } from './systems/useItemState';
import { buildLoadedGameUiResetPatch, buildReturnToTitlePatch } from './systems/uiStateTransitions';
import { buildHandledNonProjectileSpellPatch } from './systems/spellNonProjectileEffects';
import { prepareSpellCast } from './systems/spellCastPreparation';
import { buildCastSpellStatePatch } from './systems/spellCastState';
import { resolveChampionIncomingAttack } from './systems/incomingAttackState';
import { advanceSurvivalTimeState, isPartyRestedState } from './systems/survivalState';
import { buildSleepFramePatch } from './systems/sleepFrameState';
import { ageTimedEffectsState } from './systems/timedEffectsState';
import { applyPartyLoadBasedFatigueState } from './systems/partyFatigueState';
import { tickCombatState } from './systems/combatTick';
import { tickMovementCooldown, tickRegenState } from './systems/timeStateTicks';
import { computePartyMovementCooldownSeconds } from './systems/partyMovementCooldownState';
import { buildPhysicalProjectileAttackPatch } from './systems/attackPhysicalState';
import { resolveAttackFrontContext } from './systems/attackFrontContext';
import { resolveAttackSelection } from './systems/attackSelection';
import { applyChampionAttackVitals as applyChampionAttackVitalsSystem } from './systems/attackVitals';
import { tryBreakFrontDoor as tryBreakFrontDoorSystem } from './systems/frontDoorBreak';
import { determineMeleeDamage } from './systems/meleeDamage';
import { buildMeleeAttackResolutionPatch } from './systems/meleeAttackResolution';
import { buildAttackMeleeStatePatch } from './systems/attackMeleeState';
import { processTickFrame } from './systems/tickFrameState';
import { applyEndgameFrameState } from './systems/endgameFrame';
import { tickPoisonClouds } from './systems/tickPoisonClouds';
import { applyProjectilePartyHit } from './systems/tickProjectilePartyHit';
import { applyProjectileCreatureHit } from './systems/tickProjectileCreatureHit';
import { resolveProjectileTraversalStep } from './systems/projectileTraversal';
import { resolveProjectileContinuation } from './systems/projectileContinuation';
import { buildTickSpellsPatch } from './systems/tickSpellsFinalize';
import { buildTickMonstersPatch } from './systems/tickMonstersFinalize';
import { tickCrushingDoors as tickCrushingDoorsSystem } from './systems/tickCrushingDoors';
import { resolveCreatureAttackOpportunity } from './systems/creatureAttackOpportunity';
import { resolveCreatureAttackStartState } from './systems/creatureAttackStartState';
import { resolveCreatureAttackOutcomeState } from './systems/creatureAttackOutcomeState';
import { resolveCreatureAttackState } from './systems/creatureAttackState';
import { resolveCreatureDestinationState } from './systems/creatureDestinationState';
import { resolveCreatureMovementState } from './systems/creatureMovementState';
import { resolveCreaturePerceptionState } from './systems/creaturePerceptionState';
import { buildCreatureRuntimeStateArgs, resolveCreatureRuntimeState } from './systems/creatureRuntimeState';
import { resolveCreatureAttackTargetState } from './systems/creatureAttackTargetState';
import { resolveMonsterAttackAgainstChampion } from './systems/monsterAttackResolution';
import { processMonsterTickChampionDeaths } from './systems/monsterDeathProcessing';
import {
    applyFrontRowWallBumpDamageState,
    applyPartySpellBacklashDamageState,
    applyPartyWideIncomingAttackState,
} from './systems/partyIncomingDamageState';
import { buildSupportedUtilityAttackPatch } from './systems/utilityAttackOrchestration';
import {
    tryUseChampionItemOnFrontWall,
    tryUseFloorItemOnFrontWall,
} from './systems/frontWallInteractions';
import { buildDeathDrop as buildDeathDropSystem } from './systems/deathDrops';
import {
    getDirectionStep,
} from './systems/directionState';
import {
    compareCreatureCells,
    isCreatureContactCell,
    resolveCreatureContactAdvance,
    selectCreatureAttackTarget,
} from './systems/frontCreatureState';
import { isFacingFountain as isFacingFountainSystem } from './systems/frontWallState';
import {
    buildViAltarResurrectionPatch as buildViAltarResurrectionPatchSystem,
    createReincarnatedChampion as createReincarnatedChampionSystem,
    isAltarTile as isAltarTileSystem,
} from './systems/resurrection';
import {
    getTeleporter as getTeleporterSystem,
    resolveCreatureTeleporterTransport as resolveCreatureTeleporterTransportSystem,
    resolvePitLanding as resolvePitLandingSystem,
    resolveProjectileTeleporterTransport as resolveProjectileTeleporterTransportSystem,
} from './systems/terrainTransport';
import {
    applyCreaturesStandingOnOpenPit as applyCreaturesStandingOnOpenPitSystem,
    applyCreaturesStandingOnOpenTeleporter as applyCreaturesStandingOnOpenTeleporterSystem,
    applyPartyTelefragAtSquare as applyPartyTelefragAtSquareSystem,
} from './systems/terrainEffects';
import { resolveOpenPitEntryTransport as resolveOpenPitEntryTransportSystem } from './systems/pitEntryTransport';
import { resolveClimbDownAction as resolveClimbDownActionSystem } from './systems/climbDownAction';
import { resolveStairStepTransport as resolveStairStepTransportSystem } from './systems/stairStepTransport';
import { resolveStandardStepTransport as resolveStandardStepTransportSystem } from './systems/standardStepTransport';
import { resolveTeleporterStepTransport as resolveTeleporterStepTransportSystem } from './systems/teleporterStepTransport';
import { applyOpenedPitEffects as applyOpenedPitEffectsSystem } from './systems/openedPitSquares';
import { applyOpenedTeleporterEffects as applyOpenedTeleporterEffectsSystem } from './systems/openedTransportSquares';
import {
    getWallFaceSensorsInRuntimeOrder,
    hasWallFaceLocalRotationEffect,
    rotateWallFaceSensors,
    shouldRotateWallFaceAfterActivation,
} from './systems/sensorRuntime';
import { activateWallSensor as activateWallSensorSystem } from './systems/wallSensorActivation';
import {
    processPendingGeneratorSpawns as processPendingGeneratorSpawnsSystem,
    processPendingSensorEvents as processPendingSensorEventsSystem,
} from './systems/pendingWorldEvents';
import {
    triggerFloorSensors as triggerFloorSensorsSystem,
    transitionFloorSensors as transitionFloorSensorsSystem,
} from './systems/movementSensors';
import { triggerWallPushSensors as triggerWallPushSensorsSystem } from './systems/wallPushSensors';
import {
    applyFirestaffExchangerReward as applyFirestaffExchangerRewardSystem,
    clearAlcoveStateOnPickup as clearAlcoveStateOnPickupSystem,
    triggerAlcoveDepositSensor as triggerAlcoveDepositSensorSystem,
    triggerAnyObjectWallSensor as triggerAnyObjectWallSensorSystem,
    triggerLockSensors as triggerLockSensorsSystem,
    triggerObjectExchangerSensor as triggerObjectExchangerSensorSystem,
} from './systems/wallItemSensors';
import { shouldEnterGameOver } from './gameOver';
import { DEFAULT_GAME_OPTIONS } from './options';
import { GRID_SIZE } from './constants';
import {
    ORIGINAL_TIMER_TICK_MS,
    ORIGINAL_TIMER_TICK_SECONDS,
    originalTimerTicksToSeconds,
    quantizeMsToOriginalVbls,
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
export type GamePhase = 'title' | 'exploration' | 'mirror_open' | 'endgame' | 'victory' | 'game_over';

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
    creatureId?: string;
    x?: number;
    y?: number;
    amount: number;
    ts: number;    // Date.now() — auto-cleared after ~500 ms
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
    processedStepCount: number;
    hideFluxcages: boolean;
    shownMessageCount: number;
    messages: string[];
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
const AWAKE_SURVIVAL_INTERVAL_TICKS = 64;
const SLEEP_SURVIVAL_INTERVAL_TICKS = 16;
const AWAKE_STAT_RELAX_INTERVAL_MASK = 0xff;
const SLEEP_STAT_RELAX_INTERVAL_MASK = 0x3f;
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

function getChampionStatRelaxTargets(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    now = Date.now(),
): ChampionVitals['currentStats'] {
    const timedBonuses = getChampionPotionBonuses(activePotionBoosts, champion.id, now);
    const effective = getEffectiveChampionStatsWithBonuses(champion, equip, timedBonuses);
    return {
        luck: effective.luck,
        strength: effective.strength,
        dexterity: effective.dexterity,
        wisdom: effective.wisdom,
        vitality: effective.vitality,
        antiMagic: effective.antiMagic,
        antiFire: effective.antiFire,
    };
}

function relaxChampionCurrentStatsTowardMaximum(
    currentStats: ChampionVitals['currentStats'],
    targetStats: ChampionVitals['currentStats'],
): ChampionVitals['currentStats'] {
    const next = { ...currentStats };
    for (const key of Object.keys(targetStats) as Array<keyof ChampionVitals['currentStats']>) {
        const maxValue = Math.max(1, targetStats[key]);
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

function resolveChampionIncomingAttackApprox(
    state: GameState,
    champion: Champion,
    currentVitals: ChampionVitals,
    rawAttack: number,
    attackType: IncomingAttackTypeApprox,
    allowedSlots: readonly ChampionWoundSlot[],
    nowMs: number,
): { damage: number; nextVitals: ChampionVitals } {
    return resolveChampionIncomingAttack(
        state,
        champion,
        currentVitals,
        rawAttack,
        attackType,
        allowedSlots,
        nowMs,
        {
            randomInt,
            applyChampionWound,
            adjustByAttribute: adjustByAttributeApprox,
            getEffectiveChampionStatsWithBonuses,
            computeChampionWoundDefense: (
                _attackState,
                championId,
                incomingChampion,
                vitals,
                woundSlot,
                useSharpDefense,
            ) => computeChampionWoundDefenseApprox(
                state,
                championId,
                incomingChampion,
                vitals,
                woundSlot,
                useSharpDefense,
            ),
            getPsychicAdjustedAttack: getPsychicAdjustedAttackApprox,
            getChampionAdjustedAttackFromResistance: getChampionAdjustedAttackFromResistanceApprox,
            getActiveShieldDefense: getActiveShieldDefenseApprox,
            scaleOriginalAttack: scaleOriginalAttackApprox,
            getChampionRuntimeBonuses,
        },
    );
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
    const door = getDoorObject(tile);
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
    const door = getDoorObject(tile);
    return door ? { key, door } : null;
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

function buildDroppedItems(items: FloorItem[], level: number, x: number, y: number): FloorItem[] {
    return items.map((item) => buildDroppedItem(item, level, x, y));
}

const CARDINAL_DIRS: CardinalDir[] = ['North', 'East', 'South', 'West'];

function buildOriginalCreatureFixedDropItems(creature: CreatureInstance): FloorItem[] {
    const def = CREATURE_TYPES[creature.typeId];
    if (!def || creature.fixedDropsDropped || def.fixedDrops.length === 0) return [];

    return def.fixedDrops.flatMap((drop, index) => {
        if (drop.random && randomInt(2) !== 0) return [];
        return [{
            id: `creature_fixed_drop_${creature.id}_${drop.category}_${drop.typeId}_${index}`,
            category: drop.category,
            typeId: drop.typeId,
            rawName: drop.rawName,
            cursed: drop.cursed || undefined,
            mapIndex: creature.mapIndex,
            x: creature.x,
            y: creature.y,
            tilePos: CARDINAL_DIRS[randomInt(CARDINAL_DIRS.length)],
        } satisfies FloorItem];
    });
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

function dropCreatureCarriedItems(
    creatures: CreatureInstance[],
    floorItems: FloorItem[],
    creatureId: string,
): { creatures: CreatureInstance[]; floorItems: FloorItem[] } {
    const index = creatures.findIndex((creature) => creature.id === creatureId);
    if (index < 0) return { creatures, floorItems };

    const creature = creatures[index];
    if (!creature) return { creatures, floorItems };
    const def = CREATURE_TYPES[creature.typeId];
    const carriedItems = creature.carriedItems ?? [];
    const shouldConsumeFixedDrops = Boolean(def?.fixedDrops.length) && !creature.fixedDropsDropped;
    const fixedDropItems = buildOriginalCreatureFixedDropItems(creature);
    if (carriedItems.length === 0 && !shouldConsumeFixedDrops) return { creatures, floorItems };

    const nextCreatures = [...creatures];
    nextCreatures[index] = {
        ...creature,
        carriedItems: [],
        fixedDropsDropped: creature.fixedDropsDropped || shouldConsumeFixedDrops,
    };

    return {
        creatures: nextCreatures,
        floorItems: [
            ...floorItems,
            ...buildDroppedItems(carriedItems, creature.mapIndex, creature.x, creature.y),
            ...fixedDropItems,
        ],
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

function getWeaponName(item: FloorItem | undefined): string {
    if (!item) return '';
    if (item.category === 'Weapon') return WEAPON_TYPES[item.typeId]?.name ?? item.rawName ?? '';
    return resolveItemName(item.category, item.typeId, item.rawName);
}

function getCreatureSizeOnTile(typeId: number): number {
    return CREATURE_TYPES[typeId]?.sizeOnTile ?? 0;
}

function getCreatureTileCapacity(typeId: number): number {
    const sizeOnTile = getCreatureSizeOnTile(typeId);
    if (sizeOnTile >= 2) return 1;
    if (sizeOnTile === 1) return 2;
    return 4;
}

function buildRuntimeCreatureGroupId(
    origin: 'init' | 'generator',
    level: number,
    x: number,
    y: number,
    typeId: number,
): string {
    if (origin === 'init') return `${origin}_${level}_${x}_${y}_${typeId}`;
    return `${origin}_${level}_${x}_${y}_${typeId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getTileCapacityForCreatures(creatures: CreatureInstance[]): number {
    if (creatures.length <= 0) return 4;
    return creatures.reduce((capacity, creature) => Math.min(capacity, getCreatureTileCapacity(creature.typeId)), 4);
}

function getCreatureCellsForOccupancy(count: number, capacity: number): CreatureCell[] {
    if (count <= 0) return [];
    if (capacity <= 1 || count <= 1) return ['center'];
    const halfTileCells: CreatureCell[] = ['frontLeft', 'frontRight'];
    const quarterTileCells: CreatureCell[] = ['frontLeft', 'frontRight', 'backLeft', 'backRight'];
    if (capacity === 2) return halfTileCells.slice(0, count);
    return quarterTileCells.slice(0, Math.min(count, 4));
}

function getGeneratedCreatureCellsForOccupancy(
    count: number,
    capacity: number,
    rotationSeed: number,
): CreatureCell[] {
    if (count <= 0) return [];
    if (capacity <= 1 || count <= 1) return ['center'];

    if (capacity === 2) {
        const halfTileCells: CreatureCell[] =
            (rotationSeed & 0x1) === 0
                ? ['frontLeft', 'frontRight']
                : ['frontRight', 'frontLeft'];
        return halfTileCells.slice(0, Math.min(count, 2));
    }

    const clockwiseQuarterCells: CreatureCell[] = ['frontLeft', 'frontRight', 'backRight', 'backLeft'];
    const startIndex = ((rotationSeed % clockwiseQuarterCells.length) + clockwiseQuarterCells.length) % clockwiseQuarterCells.length;
    const rotated = clockwiseQuarterCells
        .slice(startIndex)
        .concat(clockwiseQuarterCells.slice(0, startIndex));
    return rotated.slice(0, Math.min(count, 4));
}

function normalizeCreatureCellsOnTile(
    creatures: CreatureInstance[],
    level: number,
    x: number,
    y: number,
): CreatureInstance[] {
    const tileEntries = creatures
        .map((creature, index) => ({ creature, index }))
        .filter(({ creature }) => creature.alive && creature.mapIndex === level && creature.x === x && creature.y === y);
    if (tileEntries.length <= 0) return creatures;

    const ordered = [...tileEntries].sort((a, b) => {
        const cellDelta = compareCreatureCells(a.creature.cell, b.creature.cell);
        if (cellDelta !== 0) return cellDelta;
        return a.creature.id.localeCompare(b.creature.id);
    });
    const nextCells = getCreatureCellsForOccupancy(ordered.length, getTileCapacityForCreatures(ordered.map(({ creature }) => creature)));

    let nextCreatures = creatures;
    ordered.forEach(({ creature, index }, orderIndex) => {
        const nextCell = nextCells[orderIndex] ?? 'center';
        if (creature.cell === nextCell) return;
        if (nextCreatures === creatures) nextCreatures = [...creatures];
        nextCreatures[index] = { ...creature, cell: nextCell };
    });
    return nextCreatures;
}

function normalizeCreatureCells(creatures: CreatureInstance[]): CreatureInstance[] {
    let nextCreatures = creatures;
    const seenTiles = new Set<string>();
    for (const creature of creatures) {
        if (!creature.alive) continue;
        const tileKey = `${creature.mapIndex},${creature.x},${creature.y}`;
        if (seenTiles.has(tileKey)) continue;
        seenTiles.add(tileKey);
        nextCreatures = normalizeCreatureCellsOnTile(nextCreatures, creature.mapIndex, creature.x, creature.y);
    }
    return nextCreatures;
}

function canCreatureShareTile(
    mover: CreatureInstance,
    level: number,
    x: number,
    y: number,
    creatures: CreatureInstance[],
): boolean {
    const occupants = creatures.filter((other) =>
        other.alive &&
        other.id !== mover.id &&
        other.mapIndex === level &&
        other.x === x &&
        other.y === y,
    );
    if (occupants.some((other) => other.typeId !== mover.typeId)) return false;
    return occupants.length < getTileCapacityForCreatures([mover, ...occupants]);
}

function isCreatureCellOccupiedOnTile(
    creatures: CreatureInstance[],
    mover: CreatureInstance,
    targetCell: CreatureCell,
): boolean {
    return creatures.some((other) =>
        other.alive &&
        other.id !== mover.id &&
        other.mapIndex === mover.mapIndex &&
        other.x === mover.x &&
        other.y === mover.y &&
        other.cell === targetCell,
    );
}

function canArchenemyDoubleMoveApprox(
    mover: CreatureInstance,
    level: number,
    x: number,
    y: number,
    direction: Direction,
    creatures: CreatureInstance[],
    monsterWalkable: (level: number, y: number, x: number) => boolean,
): { x: number; y: number } | null {
    const [stepX, stepY] = getDirectionStep(direction);
    const intermediateX = x + stepX;
    const intermediateY = y + stepY;
    const destinationX = intermediateX + stepX;
    const destinationY = intermediateY + stepY;
    const teleportedMover: CreatureInstance = {
        ...mover,
        mapIndex: level,
        x: destinationX,
        y: destinationY,
    };

    if (!monsterWalkable(level, destinationY, destinationX)) return null;
    if (!canCreatureShareTile(teleportedMover, level, destinationX, destinationY, creatures)) return null;

    return { x: destinationX, y: destinationY };
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
            const door = getDoorObject(tile);
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

interface PendingGeneratorSpawnEvent {
    sensorLevel: number;
    sensorIndex: number;
    spawnLevel: number;
    spawnX: number;
    spawnY: number;
    typeId: number;
    hpMultiplier: number;
    creatureCount: number;
    groupId: string;
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
                    const id = `${map.index}_${tile.x}_${tile.y}_${co.index}`;
                    const groupId = buildRuntimeCreatureGroupId('init', map.index, tile.x, tile.y, co.type);
                    creatureTimers.set(id, {
                        mt: Math.random() * moveSec,
                        at: Math.random() * atkSec,
                    });
                    instances.push({
                        id,
                        groupId,
                        typeId: co.type,
                        mapIndex: map.index,
                        x: tile.x,
                        y: tile.y,
                        currentHP: co.hp > 0 ? co.hp : def.baseHP,
                        alive: true,
                        cell: 'center',
                        carriedItems: [],
                    });
                }
            }
        }
    }
    return normalizeCreatureCells(instances);
}

function getOriginalGeneratorEffectiveHealthMultiplier(level: number, hpMultiplier: number): number {
    if (hpMultiplier > 0) return hpMultiplier;
    return Math.max(1, getMap(level).difficulty);
}

function getOriginalGeneratorDisableTicks(rawTicks: number): number {
    if (rawTicks <= 0) return 0;
    return rawTicks > 127 ? ((rawTicks - 126) << 6) : rawTicks;
}

const ORIGINAL_ACTIVE_GROUP_CAP = 60;
const ORIGINAL_GENERATOR_RESERVED_ACTIVE_GROUP_SLOTS = 5;
const ORIGINAL_MOVE_GROUP_RETRY_SECONDS = originalTimerTicksToSeconds(5);

function getApproximateActiveGroupCountOnLevel(level: number, creatures: CreatureInstance[]): number {
    const activeGroups = new Set<string>();
    for (const creature of creatures) {
        if (!creature.alive || creature.mapIndex !== level) continue;
        activeGroups.add(creature.groupId ?? `tile_${creature.x},${creature.y}`);
    }
    return activeGroups.size;
}

function hasApproximateOriginalGeneratorCapacity(ss: SensorState, level: number): boolean {
    if (level !== ss.currentLevel) return true;
    return getApproximateActiveGroupCountOnLevel(level, ss.creatures)
        < (ORIGINAL_ACTIVE_GROUP_CAP - ORIGINAL_GENERATOR_RESERVED_ACTIVE_GROUP_SLOTS);
}

function isGeneratorSpawnBlocked(ss: SensorState, level: number, x: number, y: number): boolean {
    if (
        level === ss.currentLevel &&
        ss.currentPosition[1] === x &&
        ss.currentPosition[0] === y
    ) {
        return true;
    }
    return ss.creatures.some((creature) =>
        creature.alive &&
        creature.mapIndex === level &&
        creature.x === x &&
        creature.y === y,
    );
}

function queuePendingGeneratorSpawn(
    pendingGeneratorSpawns: PendingGeneratorSpawnEvent[],
    event: Omit<PendingGeneratorSpawnEvent, 'remaining'>,
): PendingGeneratorSpawnEvent[] {
    const alreadyQueued = pendingGeneratorSpawns.some((pending) =>
        pending.sensorLevel === event.sensorLevel &&
        pending.sensorIndex === event.sensorIndex &&
        pending.spawnLevel === event.spawnLevel &&
        pending.spawnX === event.spawnX &&
        pending.spawnY === event.spawnY &&
        pending.typeId === event.typeId,
    );
    if (alreadyQueued) return pendingGeneratorSpawns;
    return [
        ...pendingGeneratorSpawns,
        { ...event, remaining: ORIGINAL_MOVE_GROUP_RETRY_SECONDS },
    ];
}

function triggerGeneratorSensor(
    level: number,
    sensor: SensorObject,
    ss: SensorState,
): SensorState {
    const generatorConfig = getOriginalGeneratorConfig(level, sensor.index);
    if (!generatorConfig) return ss;

    const sensorKey = getSensorStateKey(level, sensor.index);
    const nextAllowedTick = ss.sensorRuntimeData[sensorKey] ?? 0;
    if (ss.elapsedGameTimeTicks < nextAllowedTick) return ss;

    const spawnTile = getMap(level).tiles[generatorConfig.spawnY]?.[generatorConfig.spawnX];
    if (!spawnTile || spawnTile.type === 'Wall' || spawnTile.type === 'TrickWall') return ss;

    const desiredCount = generatorConfig.randomized
        ? 1 + randomInt(Math.max(1, generatorConfig.countRaw))
        : generatorConfig.countRaw;
    if (!hasApproximateOriginalGeneratorCapacity(ss, level)) return ss;

    const disableTicks = getOriginalGeneratorDisableTicks(generatorConfig.ticks);
    const groupId = buildPendingGeneratedCreatureGroupId(
        level,
        sensor.index,
        level,
        generatorConfig.spawnX,
        generatorConfig.spawnY,
        generatorConfig.typeId,
        ss.elapsedGameTimeTicks,
    );

    const spawnBlocked = isGeneratorSpawnBlocked(
        ss,
        level,
        generatorConfig.spawnX,
        generatorConfig.spawnY,
    );
    if (spawnBlocked) {
        const nextPendingGeneratorSpawns = queuePendingGeneratorSpawn(
            ss.pendingGeneratorSpawns,
            {
                sensorLevel: level,
                sensorIndex: sensor.index,
                spawnLevel: level,
                spawnX: generatorConfig.spawnX,
                spawnY: generatorConfig.spawnY,
                typeId: generatorConfig.typeId,
                hpMultiplier: generatorConfig.hpMultiplier,
                creatureCount: desiredCount,
                groupId,
            },
        );
        if (nextPendingGeneratorSpawns === ss.pendingGeneratorSpawns) return ss;

        return {
            ...ss,
            pendingGeneratorSpawns: nextPendingGeneratorSpawns,
            sensorRuntimeData: {
                ...ss.sensorRuntimeData,
                [sensorKey]: ss.elapsedGameTimeTicks + disableTicks,
            },
        };
    }

    const generatedCreatures = createGeneratedCreatureGroupInstances(
        level,
        generatorConfig.spawnX,
        generatorConfig.spawnY,
        generatorConfig.typeId,
        generatorConfig.hpMultiplier,
        desiredCount,
        groupId,
    );
    if (generatedCreatures.length <= 0) return ss;

    return {
        ...ss,
        creatures: [
            ...ss.creatures,
            ...generatedCreatures,
        ],
        sensorRuntimeData: {
            ...ss.sensorRuntimeData,
            [sensorKey]: ss.elapsedGameTimeTicks + disableTicks,
        },
    };
}

function buildPendingGeneratedCreatureGroupId(
    sensorLevel: number,
    sensorIndex: number,
    spawnLevel: number,
    spawnX: number,
    spawnY: number,
    typeId: number,
    elapsedGameTimeTicks: number,
): string {
    return [
        'generator',
        sensorLevel,
        sensorIndex,
        spawnLevel,
        spawnX,
        spawnY,
        typeId,
        elapsedGameTimeTicks,
        Math.random().toString(36).slice(2),
    ].join('_');
}

function createGeneratedCreatureGroupInstances(
    level: number,
    x: number,
    y: number,
    typeId: number,
    hpMultiplier: number,
    creatureCount: number,
    groupId: string,
): CreatureInstance[] {
    const def = CREATURE_TYPES[typeId];
    if (!def || creatureCount <= 0) return [];

    const effectiveMultiplier = getOriginalGeneratorEffectiveHealthMultiplier(level, hpMultiplier);
    const capacity = getCreatureTileCapacity(typeId);
    const actualCount = Math.max(1, Math.min(creatureCount, capacity));
    const cells = getGeneratedCreatureCellsForOccupancy(actualCount, capacity, randomInt(4));
    const instances: CreatureInstance[] = [];

    for (let ordinal = 0; ordinal < actualCount; ordinal += 1) {
        const currentHP = Math.max(
            1,
            (def.baseHP * effectiveMultiplier) + randomInt((def.baseHP >> 2) + 1),
        );
        const id = `gen_${level}_${x}_${y}_${typeId}_${Date.now()}_${ordinal}_${Math.random().toString(36).slice(2)}`;
        creatureTimers.set(id, {
            mt: Math.random() * (def.moveSpd / 6),
            at: Math.random() * (def.atkSpd / 6),
        });
        instances.push({
            id,
            groupId,
            typeId,
            mapIndex: level,
            x,
            y,
            currentHP,
            alive: true,
            cell: cells[ordinal] ?? 'center',
            carriedItems: [],
        });
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
    return getDoorObject(tile)?.hasButton ?? false;
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

// ─── Champion death helper ────────────────────────────────────────────────────
// Drops all inventory + equipment + a bones item at the party position.
// Returns the partial state update (does NOT update party — caller handles that).
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
    creatures: CreatureInstance[];
    pendingGeneratorSpawns: PendingGeneratorSpawnEvent[];
    currentLevel: number;
    currentPosition: [number, number];
    elapsedGameTimeTicks: number;
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
    source: Partial<Pick<
        GameState,
        | 'level'
        | 'position'
        | 'openDoors'
        | 'openPits'
        | 'openTeleporters'
        | 'openWalls'
        | 'activeSensors'
        | 'firedSensors'
        | 'sensorRuntimeData'
        | 'sensorRotationOffsets'
        | 'visibleTexts'
        | 'creatures'
        | 'pendingGeneratorSpawns'
        | 'elapsedGameTimeTicks'
    >> & { projectiles?: Projectile[] },
): SensorState {
    return {
        openDoors: source.openDoors ?? new Set<string>(),
        openPits: source.openPits ?? new Set<string>(),
        openTeleporters: source.openTeleporters ?? new Set<string>(),
        openWalls: source.openWalls ?? new Set<string>(),
        activeSensors: source.activeSensors ?? new Set<string>(),
        firedSensors: source.firedSensors ?? new Set<string>(),
        sensorRuntimeData: source.sensorRuntimeData ?? {},
        sensorRotationOffsets: source.sensorRotationOffsets ?? {},
        visibleTexts: source.visibleTexts ?? new Set<string>(),
        projectiles: source.projectiles ?? [],
        creatures: source.creatures ?? [],
        pendingGeneratorSpawns: source.pendingGeneratorSpawns ?? [],
        currentLevel: source.level ?? 0,
        currentPosition: source.position ?? [0, 0],
        elapsedGameTimeTicks: source.elapsedGameTimeTicks ?? 0,
    };
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

function isWallSensorConsumedAtRuntime(
    level: number,
    sensor: SensorObject,
    ss: SensorState,
): boolean {
    const sensorKey = getSensorStateKey(level, sensor.index);
    return ss.firedSensors.has(sensorKey) && (sensor.onceOnly || sensor.type === 17);
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

function processFloorSquareEvent(
    sourceSensor: SensorObject,
    level: number,
    ss: SensorState,
    sourceAction: SensorAction,
): Partial<SensorState> {
    const targetTile = getMap(level).tiles[sourceSensor.targetY]?.[sourceSensor.targetX];
    if (!targetTile || targetTile.type !== 'Floor') return {};

    let cur = ss;
    let changed = false;

    for (const obj of targetTile.objects) {
        if (obj.category !== 'Sensor') continue;
        const targetSensor = obj as SensorObject;
        if (!isGeneratorSensor(targetSensor)) continue;
        if (sourceAction === 'Clear') continue;
        const nextCur = triggerGeneratorSensor(level, targetSensor, cur);
        if (nextCur === cur) continue;
        cur = nextCur;
        changed = true;
    }

    return changed ? diffSensorState(ss, cur) : {};
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
    // The extracted DM dungeon also contains local wall launchers that live on their
    // own wall square and must still create a projectile when activated directly.
    if (sensor.isLocal) {
        if (WALL_LAUNCHER_SENSOR_TYPES.has(sensor.type)) {
            const placement = findSensorPlacement(level, sensor.index);
            if (placement && (placement.tile.type === 'Wall' || placement.tile.type === 'TrickWall')) {
                const launchedProjectiles = buildWallLauncherProjectiles(
                    level,
                    placement.x,
                    placement.y,
                    sensor,
                    Date.now(),
                );
                if (launchedProjectiles.length > 0) {
                    cur = {
                        ...cur,
                        projectiles: [...cur.projectiles, ...launchedProjectiles],
                    };
                }
            }
        }
        return diffSensorState(ss, cur);
    }

    const targetTile = getMap(level).tiles[sensor.targetY]?.[sensor.targetX];
    if (!targetTile) return diffSensorState(ss, cur);

    let targetPatch: Partial<SensorState>;
    if (targetTile.type === 'Wall' || targetTile.type === 'TrickWall') {
        targetPatch = processWallSquareEvent(sensor, level, cur, action);
    } else if (targetTile.type === 'Floor') {
        targetPatch = processFloorSquareEvent(sensor, level, cur, action);
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
    let pendingLocalRotationFace: CardinalDir | null = null;

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
              if (hasWallFaceLocalRotationEffect(targetSensor)) {
                  pendingLocalRotationFace = targetSensor.tilePos;
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
              if (hasWallFaceLocalRotationEffect(targetSensor)) {
                  pendingLocalRotationFace = targetSensor.tilePos;
              }
          }
      }

      if (pendingLocalRotationFace) {
          const nextRotationOffsets = rotateWallFaceSensors(
              level,
              sourceSensor.targetX,
              sourceSensor.targetY,
              pendingLocalRotationFace,
              cur.sensorRotationOffsets,
          );
          if (nextRotationOffsets !== cur.sensorRotationOffsets) {
              cur = { ...cur, sensorRotationOffsets: nextRotationOffsets };
              changed = true;
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

function buildMovementSensorDeps() {
    return {
        getTile: (level: number, tileX: number, tileY: number) => getMap(level).tiles[tileY]?.[tileX],
        asSensor: (obj: unknown) => (obj && typeof obj === 'object' && 'category' in obj && (obj as { category?: string }).category === 'Sensor')
            ? obj as SensorObject
            : null,
        isCreatureOnlyFloorSensor,
        isGeneratorSensor,
        isPartyPossessionSensor,
        isSpecificObjectFloorSensor,
        getRequiredSensorItemName,
        partyHasRequiredItem,
        tileHasRequiredFloorItem,
        computeSensorEffect,
        triggerGeneratorSensor,
        queueOrComputeSensorEffect,
        resolveDoorSoundTarget,
        playDoorMotion: playDoorMotionForTarget,
        playPlate,
        notifyPlateActivated,
        diffSensorState,
    };
}

function playDoorMotionForTarget(target: { level: number; x: number; y: number } | null) {
    playDoorMotion(
        DOOR_TOGGLE_SOUND_DURATION_MS,
        target ? getDoorSoundVolume(target.level, target.x, target.y) : DOOR_SOUND_MIN_VOLUME,
    );
}

function buildPendingWorldEventDeps() {
    return {
        findSensorByIndex,
        computeSensorEffect,
        resolveDoorSoundTarget,
        playDoorMotion: playDoorMotionForTarget,
        playPlate,
        diffSensorState,
    };
}

function buildWallSensorActivationDeps() {
    return {
        getTile: (level: number, tileX: number, tileY: number) => getMap(level).tiles[tileY]?.[tileX],
        buildSensorStateSnapshot,
        getWallFaceSensorsInRuntimeOrder,
        wallLauncherSensorTypes: WALL_LAUNCHER_SENSOR_TYPES,
        applyToSet,
        getSelfRevealingWallSensor,
        queueOrComputeSensorEffect,
        resolveDoorSoundTarget,
        playDoorMotion: playDoorMotionForTarget,
        playPlate,
        shouldRotateWallFaceAfterActivation,
        rotateWallFaceSensors,
        diffSensorState,
        revealSelfWallMountedItems,
        applyImmediateTransportSquareEffects,
    };
}

function buildWallPushSensorDeps() {
    return {
        getTile: (level: number, tileX: number, tileY: number) => getMap(level).tiles[tileY]?.[tileX],
        asSensor: (obj: unknown) => (obj && typeof obj === 'object' && 'category' in obj && (obj as { category?: string }).category === 'Sensor')
            ? obj as SensorObject
            : null,
        resolvePushFace: (direction: string): CardinalDir => PUSH_FACE[direction] as CardinalDir,
        isWallLockSensor,
        queueOrComputeSensorEffect,
        resolveDoorSoundTarget,
        playDoorMotion: playDoorMotionForTarget,
        diffSensorState,
    };
}

function buildWallItemSensorDeps() {
    return {
        getTile: (level: number, tileX: number, tileY: number) => getMap(level).tiles[tileY]?.[tileX],
        getWallFaceSensorsInRuntimeOrder,
        isWallLockSensor,
        isWallAlcoveSensor,
        isWallObjectExchangerSensor,
        isWallSensorConsumedAtRuntime,
        getRequiredSensorItemName,
        itemMatchesMechanismRequirement,
        itemToLockData,
        isConsumableLockSensor,
        computeSensorEffect,
        resolveDoorSoundTarget,
        playDoorMotion: playDoorMotionForTarget,
        shouldRotateWallFaceAfterActivation,
        rotateWallFaceSensors,
        diffSensorState,
        applyToSet,
        buildSensorStateSnapshot,
    };
}

function buildFrontWallInteractionDeps() {
    const wallItemSensorDeps = buildWallItemSensorDeps();
    return {
        buildSensorStateSnapshot,
        triggerLockSensors: (
            level: number,
            wallX: number,
            wallY: number,
            face: CardinalDir,
            ss: SensorState,
            inventories: Record<number, FloorItem[]>,
            equipment: Record<number, ChampionEquipment>,
            selectedItem: { championId: number; itemId: string; fromSlot: EquipSlotKey | 'inventory' },
        ) => triggerLockSensorsSystem(level, wallX, wallY, face, ss, inventories, equipment, wallItemSensorDeps, selectedItem),
        triggerAnyObjectWallSensor: (
            level: number,
            wallX: number,
            wallY: number,
            face: CardinalDir,
            ss: SensorState,
        ) => triggerAnyObjectWallSensorSystem(level, wallX, wallY, face, ss, wallItemSensorDeps),
        triggerAlcoveDepositSensor: (
            level: number,
            wallX: number,
            wallY: number,
            face: CardinalDir,
            ss: SensorState,
            inventories: Record<number, FloorItem[]>,
            equipment: Record<number, ChampionEquipment>,
            selectedItem: { championId: number; itemId: string; fromSlot: EquipSlotKey | 'inventory' },
        ) => triggerAlcoveDepositSensorSystem(level, wallX, wallY, face, ss, inventories, equipment, selectedItem, wallItemSensorDeps),
        triggerObjectExchangerSensor: (
            level: number,
            wallX: number,
            wallY: number,
            face: CardinalDir,
            ss: SensorState,
            inventories: Record<number, FloorItem[]>,
            equipment: Record<number, ChampionEquipment>,
            selectedItem: { championId: number; itemId: string; fromSlot: EquipSlotKey | 'inventory' },
        ) => triggerObjectExchangerSensorSystem(level, wallX, wallY, face, ss, inventories, equipment, selectedItem, wallItemSensorDeps),
        applyFirestaffExchangerReward: applyFirestaffExchangerRewardSystem,
        applyImmediateTransportSquareEffects,
        buildAttackResultMessage,
    };
}

function buildTerrainTransportDeps() {
    return {
        getTile: (level: number, x: number, y: number) => getMap(level).tiles[y]?.[x],
        getOriginalTeleporterRuntime,
    };
}

function buildTerrainEffectsDeps() {
    return {
        dropCreatureCarriedItems,
        buildDeathDustEvent,
        buildCreatureDamageEvent,
        normalizeCreatureCellsOnTile,
        resolvePitLanding: (
            level: number,
            y: number,
            x: number,
            openDoors: Set<string>,
            openWalls: Set<string>,
            openPits: Set<string>,
        ) => resolvePitLandingSystem(
            level,
            y,
            x,
            openDoors,
            openWalls,
            openPits,
            { getTile: (mapIndex, tileX, tileY) => getMap(mapIndex).tiles[tileY]?.[tileX], isWalkable },
        ),
        isWalkable,
        canCreatureShareTile,
        getTile: (level: number, x: number, y: number) => getMap(level).tiles[y]?.[x],
        getTeleporter: getTeleporterSystem,
        resolveCreatureTeleporterTransport: (
            state: Pick<GameState, 'openTeleporters'>,
            level: number,
            x: number,
            y: number,
            direction: Direction,
            cell: CreatureCell,
        ) => resolveCreatureTeleporterTransportSystem(
            state,
            level,
            x,
            y,
            direction,
            cell,
            buildTerrainTransportDeps(),
        ),
    };
}

function buildOpenedTeleporterEffectsDeps() {
    const terrainTransportDeps = buildTerrainTransportDeps();
    const terrainEffectsDeps = buildTerrainEffectsDeps();
    return {
        getTile: (level: number, x: number, y: number) => getMap(level).tiles[y]?.[x],
        getTeleporter: getTeleporterSystem,
        resolveProjectileTeleporterTransport: (
            state: Pick<GameState, 'openTeleporters'>,
            level: number,
            x: number,
            y: number,
            direction: Direction,
        ) => resolveProjectileTeleporterTransportSystem(
            state,
            level,
            x,
            y,
            direction,
            terrainTransportDeps,
        ),
        applyPartyTelefragAtSquare: (
            state: Pick<GameState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
            level: number,
            x: number,
            y: number,
        ) => applyPartyTelefragAtSquareSystem(state, level, x, y, terrainEffectsDeps),
        applyCreaturesStandingOnOpenTeleporter: (
            state: Pick<GameState, 'level' | 'position' | 'creatures' | 'openDoors' | 'openWalls' | 'openPits' | 'openTeleporters'>,
            level: number,
            x: number,
            y: number,
        ) => applyCreaturesStandingOnOpenTeleporterSystem(state, level, x, y, terrainEffectsDeps),
    };
}

function buildOpenedPitEffectsDeps() {
    const terrainEffectsDeps = buildTerrainEffectsDeps();
    return {
        resolvePitLanding: (
            level: number,
            y: number,
            x: number,
            openDoors: Set<string>,
            openWalls: Set<string>,
            openPits: Set<string>,
        ) => resolvePitLandingSystem(
            level,
            y,
            x,
            openDoors,
            openWalls,
            openPits,
            { getTile: (mapIndex, tileX, tileY) => getMap(mapIndex).tiles[tileY]?.[tileX], isWalkable },
        ),
        applyPartyTelefragAtSquare: (
            state: Pick<GameState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
            level: number,
            x: number,
            y: number,
        ) => applyPartyTelefragAtSquareSystem(state, level, x, y, terrainEffectsDeps),
        applyPartyFallImpactDamage,
        applyCreaturesStandingOnOpenPit: (
            state: Pick<GameState, 'level' | 'position' | 'creatures' | 'floorItems' | 'damageEvents' | 'spellVisualEvents' | 'openDoors' | 'openWalls' | 'openPits'>,
            level: number,
            x: number,
            y: number,
        ) => applyCreaturesStandingOnOpenPitSystem(state, level, x, y, terrainEffectsDeps),
    };
}

function buildPitEntryTransportDeps() {
    const movementSensorDeps = buildMovementSensorDeps();
    const terrainEffectsDeps = buildTerrainEffectsDeps();
    return {
        resolvePitLanding: (
            level: number,
            y: number,
            x: number,
            openDoors: Set<string>,
            openWalls: Set<string>,
            openPits: Set<string>,
        ) => resolvePitLandingSystem(
            level,
            y,
            x,
            openDoors,
            openWalls,
            openPits,
            { getTile: (mapIndex, tileX, tileY) => getMap(mapIndex).tiles[tileY]?.[tileX], isWalkable },
        ),
        buildSensorStateSnapshot,
        triggerFloorSensors: (
            level: number,
            x: number,
            y: number,
            ss: SensorState,
            inventories: Record<number, FloorItem[]>,
            equipment: Record<number, ChampionEquipment>,
            floorItems: FloorItem[],
            pendingSensorEvents: PendingSensorEvent[],
            mode: 'enter' | 'leave',
        ) => triggerFloorSensorsSystem(
            level,
            x,
            y,
            ss,
            inventories,
            equipment,
            floorItems,
            pendingSensorEvents,
            movementSensorDeps,
            mode,
        ),
        applyPartyTelefragAtSquare: (
            state: Pick<GameState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
            level: number,
            x: number,
            y: number,
        ) => applyPartyTelefragAtSquareSystem(state, level, x, y, terrainEffectsDeps),
        applyPartyFallImpactDamage,
        applyImmediateTransportSquareEffects,
        computeMovementCooldown: computePartyMovementCooldownSecondsApprox,
    };
}

function buildTeleporterStepTransportDeps() {
    const movementSensorDeps = buildMovementSensorDeps();
    const terrainTransportDeps = buildTerrainTransportDeps();
    const terrainEffectsDeps = buildTerrainEffectsDeps();
    return {
        resolveProjectileTeleporterTransport: (
            state: Pick<GameState, 'openTeleporters'>,
            level: number,
            x: number,
            y: number,
            direction: Direction,
        ) => resolveProjectileTeleporterTransportSystem(
            state,
            level,
            x,
            y,
            direction,
            terrainTransportDeps,
        ),
        buildSensorStateSnapshot,
        transitionFloorSensors: (
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
        ) => transitionFloorSensorsSystem(
            level,
            fromX,
            fromY,
            toX,
            toY,
            partySize,
            ss,
            inventories,
            equipment,
            floorItems,
            pendingSensorEvents,
            movementSensorDeps,
        ),
        applyPartyTelefragAtSquare: (
            state: Pick<GameState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
            level: number,
            x: number,
            y: number,
        ) => applyPartyTelefragAtSquareSystem(state, level, x, y, terrainEffectsDeps),
        applyImmediateTransportSquareEffects,
        computeMovementCooldown: computePartyMovementCooldownSecondsApprox,
        playTeleport,
    };
}

function buildStairStepTransportDeps() {
    return {
        computeMovementCooldown: computePartyMovementCooldownSecondsApprox,
    };
}

function buildStandardStepTransportDeps() {
    const movementSensorDeps = buildMovementSensorDeps();
    return {
        buildSensorStateSnapshot,
        transitionFloorSensors: (
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
        ) => transitionFloorSensorsSystem(
            level,
            fromX,
            fromY,
            toX,
            toY,
            partySize,
            ss,
            inventories,
            equipment,
            floorItems,
            pendingSensorEvents,
            movementSensorDeps,
        ),
        applyImmediateTransportSquareEffects,
        computeMovementCooldown: computePartyMovementCooldownSecondsApprox,
        now: Date.now,
    };
}

function buildClimbDownActionDeps() {
    const movementSensorDeps = buildMovementSensorDeps();
    return {
        getFrontPosition,
        getTile: (level: number, x: number, y: number) => getMap(level).tiles[y]?.[x],
        resolvePitLanding: (
            level: number,
            y: number,
            x: number,
            openDoors: Set<string>,
            openWalls: Set<string>,
            openPits: Set<string>,
        ) => resolvePitLandingSystem(
            level,
            y,
            x,
            openDoors,
            openWalls,
            openPits,
            { getTile: (mapIndex, tileX, tileY) => getMap(mapIndex).tiles[tileY]?.[tileX], isWalkable },
        ),
        applyPartyLoadBasedFatigue,
        buildSensorStateSnapshot,
        triggerFloorSensors: (
            level: number,
            x: number,
            y: number,
            ss: SensorState,
            inventories: Record<number, FloorItem[]>,
            equipment: Record<number, ChampionEquipment>,
            floorItems: FloorItem[],
            pendingSensorEvents: PendingSensorEvent[],
            mode: 'enter' | 'leave',
        ) => triggerFloorSensorsSystem(
            level,
            x,
            y,
            ss,
            inventories,
            equipment,
            floorItems,
            pendingSensorEvents,
            movementSensorDeps,
            mode,
        ),
        computeMovementCooldown: computePartyMovementCooldownSecondsApprox,
    };
}

function findSensorPlacement(
    level: number,
    sensorIndex: number,
): { x: number; y: number; tile: GameTile; sensor: SensorObject } | null {
    const map = getMap(level);
    for (const row of map.tiles) {
        for (const tile of row) {
            for (const obj of tile.objects) {
                if (obj.category === 'Sensor' && (obj as SensorObject).index === sensorIndex) {
                    return {
                        x: tile.x,
                        y: tile.y,
                        tile,
                        sensor: obj as SensorObject,
                    };
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
    if (after.creatures !== before.creatures) patch.creatures = after.creatures;
    if (after.pendingGeneratorSpawns !== before.pendingGeneratorSpawns) patch.pendingGeneratorSpawns = after.pendingGeneratorSpawns;
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

function buildCreatureDamageEvent(level: number, x: number, y: number, amount: number, creatureId?: string): DamageEvent {
    return {
        id: `dmg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level,
        target: 'creature',
        creatureId,
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

const ENDGAME_FUSE_UPDATE_MS = quantizeMsToOriginalVbls(96);
const ENDGAME_MESSAGE_INTERVAL_MS = quantizeMsToOriginalVbls(780);
const ENDGAME_FINAL_DELAY_MS = quantizeMsToOriginalVbls(600);

type EndgameFuseAction = {
    step: number;
    effects?: Array<{ effect: Exclude<ProjectileEffect, 'physical'>; scale: number }>;
    switchTypeId?: number;
    buzz?: boolean;
    hideFluxcages?: boolean;
    purgeOtherCreatures?: boolean;
};

const ENDGAME_FUSE_ACTIONS: EndgameFuseAction[] = [
    { step: 1, effects: [{ effect: 'fireball', scale: 1.02 }] },
    { step: 2, effects: [{ effect: 'fireball', scale: 1.08 }] },
    { step: 3, effects: [{ effect: 'fireball', scale: 1.14 }] },
    { step: 4, effects: [{ effect: 'fireball', scale: 1.2 }] },
    { step: 5, effects: [{ effect: 'fireball', scale: 1.26 }] },
    { step: 6, effects: [{ effect: 'fireball', scale: 1.34 }] },
    { step: 7, switchTypeId: 25, buzz: true },
    { step: 8, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.04 }] },
    { step: 9, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.1 }] },
    { step: 10, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.16 }] },
    { step: 11, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.22 }] },
    { step: 12, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.28 }] },
    { step: 13, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.36 }] },
    { step: 14, switchTypeId: 23, buzz: true },
    { step: 17, switchTypeId: 25, buzz: true },
    { step: 20, switchTypeId: 23, buzz: true },
    { step: 23, switchTypeId: 25, buzz: true },
    { step: 26, switchTypeId: 23, buzz: true },
    { step: 28, switchTypeId: 25, buzz: true },
    { step: 30, switchTypeId: 23, buzz: true },
    { step: 32, switchTypeId: 25, buzz: true },
    { step: 34, switchTypeId: 23, buzz: true },
    { step: 35, switchTypeId: 25, buzz: true },
    { step: 36, switchTypeId: 23, buzz: true },
    { step: 37, switchTypeId: 25, buzz: true },
    {
        step: 38,
        effects: [
            { effect: 'fireball', scale: 1.44 },
            { effect: 'disrupt_nonmaterial', scale: 1.44 },
        ],
    },
    { step: 39, switchTypeId: 26 },
    { step: 40, hideFluxcages: true },
    { step: 41, purgeOtherCreatures: true },
];

function getEndgameMessagesForMap(level: number): string[] {
    const startTile = getMap(level).tiles[0]?.[0];
    if (!startTile) return [];

    return startTile.objects
        .filter((obj): obj is WallTextObject =>
            obj.category === 'Text' &&
            typeof obj.text === 'string' &&
            obj.text.length > 0,
        )
        .map((obj) => ({
            order: obj.text![0] ?? '',
            message: obj.text!.slice(1).trimStart(),
        }))
        .filter((entry) => /^[A-Z]$/.test(entry.order) && entry.message.length > 0)
        .sort((a, b) => a.order.localeCompare(b.order))
        .map((entry) => entry.message);
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
    brokenDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    pendingSensorEvents: PendingSensorEvent[];
    pendingGeneratorSpawns: PendingGeneratorSpawnEvent[];
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
    /** Floating damage numbers, cleared after ~500 ms */
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

function buildFreshDungeonState(
    gameOptions: GameOptions,
    gamePhase: GamePhase,
): Pick<
    GameState,
    | 'level'
    | 'position'
    | 'direction'
    | 'party'
    | 'gameOptions'
    | 'selectedChampionIndex'
    | 'gamePhase'
    | 'optionsModalOpen'
    | 'activeMirrorChampionId'
    | 'activePartyMemberId'
    | 'gateOpen'
    | 'openDoors'
    | 'brokenDoors'
    | 'openPits'
    | 'openTeleporters'
    | 'openWalls'
    | 'activeSensors'
    | 'firedSensors'
    | 'sensorRuntimeData'
    | 'sensorRotationOffsets'
    | 'visibleTexts'
    | 'pendingSensorEvents'
    | 'pendingGeneratorSpawns'
    | 'creatures'
    | 'floorItems'
    | 'championInventories'
    | 'championEquipment'
    | 'championVitals'
    | 'championManaRegenBlockedUntilTick'
    | 'elapsedGameTimeTicks'
    | 'regenTickRemainder'
    | 'lastSurvivalEffectGameTick'
    | 'freezeLifeRemainingTicks'
    | 'lastPartyMoveGameTick'
    | 'movementCooldown'
    | 'sleeping'
    | 'endgameSequence'
    | 'lastCastResult'
    | 'championXP'
    | 'championTemporaryXP'
    | 'championCombat'
    | 'damageEvents'
    | 'spellVisualEvents'
    | 'crushingDoors'
    | 'torchBurnStart'
    | 'spellLights'
    | 'projectiles'
    | 'activePoisonClouds'
    | 'activeShields'
    | 'activePotionBoosts'
    | 'invisibleUntil'
    | 'magicVisionUntil'
    | 'seeThroughWallsUntil'
    | 'footprintsUntil'
    | 'footprintHistory'
    | 'deadChampions'
    | 'activeFloorDrag'
    | 'lastCreatureAttackGameTick'
> {
    return {
        level: 0,
        position: HALL_START,
        direction: HALL_START_DIR,
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
        openPits: buildOpenPits(),
        openTeleporters: buildOpenTeleporters(),
        openWalls: new Set<string>(),
        activeSensors: new Set<string>(),
        firedSensors: new Set<string>(),
        sensorRuntimeData: {},
        sensorRotationOffsets: {},
        visibleTexts: buildVisibleTexts(),
        pendingSensorEvents: [],
        pendingGeneratorSpawns: [],
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
    };
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
    return advanceSurvivalTimeState(
        state,
        stepCount,
        {
            sleepSurvivalIntervalTicks: SLEEP_SURVIVAL_INTERVAL_TICKS,
            awakeSurvivalIntervalTicks: AWAKE_SURVIVAL_INTERVAL_TICKS,
            originalTimerTickSeconds: ORIGINAL_TIMER_TICK_SECONDS,
            poisonTickIntervalSec: POISON_TICK_INTERVAL_SEC,
            foodDrainScale: FOOD_DRAIN_SCALE,
            waterDrainScale: WATER_DRAIN_SCALE,
            maxFood: MAX_FOOD,
            maxWater: MAX_WATER,
            sleepStatRelaxIntervalMask: SLEEP_STAT_RELAX_INTERVAL_MASK,
            awakeStatRelaxIntervalMask: AWAKE_STAT_RELAX_INTERVAL_MASK,
            normalizeChampionVitalsForChampion,
            getEffectiveChampionStatsRuntime,
            getChampionSkillLevelFromXP,
            getEquipmentSkillLevelModifier,
            normalizeChampionTemporaryXP,
            computeOriginalTimeCriteria,
            applyChampionStaminaDeltaOriginal,
            applyLimits,
            clampFoodWater,
            getChampionStatRelaxTargets,
            relaxChampionCurrentStatsTowardMaximum,
        },
        options,
    );
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
    return isPartyRestedState(state, { getEffectiveChampionStatsRuntime });
}

function applyCombatTickApprox(state: GameState, delta: number, now: number): Partial<GameState> | null {
    return tickCombatState({
        party: state.party,
        championCombat: state.championCombat,
        damageEvents: state.damageEvents,
        delta,
        now,
        damageEventLifetimeMs: DAMAGE_EVENT_LIFETIME_MS,
    });
}

function applyEndgameFrameApprox(state: GameState, now: number): Partial<GameState> | null {
    return applyEndgameFrameState(
        state,
        now,
        {
            fuseUpdateMs: ENDGAME_FUSE_UPDATE_MS,
            messageIntervalMs: ENDGAME_MESSAGE_INTERVAL_MS,
            finalDelayMs: ENDGAME_FINAL_DELAY_MS,
            actions: ENDGAME_FUSE_ACTIONS,
            playBuzz: playTeleport,
            buildSpellEvent: (effect, level, x, y, ts, scale) =>
                buildEndgameSpellEvent(effect, level, x, y, ts, scale),
            buildMessageResult: (message) => buildAttackResultMessage(message, true),
        },
    );
}

function computePartyMovementCooldownSecondsApprox(
    state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'championInventories' | 'activePotionBoosts'>,
): number {
    return computePartyMovementCooldownSeconds(state, {
        getChampionRuntimeBonuses,
        getTotalWeight,
        getChampionMaxLoad,
    });
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

function applySleepFrameApprox(state: GameState, now: number): Partial<GameState> | null {
    return buildSleepFramePatch(
        state,
        now,
        {
            advanceSurvivalTime: (sleepState, stepCount) =>
                advanceSurvivalTimeApprox(sleepState, stepCount, { sleeping: true }),
            ageTimedEffectsByMs: (sleepState, advanceMs) => ageTimedEffectsState(sleepState, advanceMs, Date.now()),
            processPendingSensorEvents: (deltaSeconds, sleepState) =>
                processPendingSensorEventsSystem(
                    deltaSeconds,
                    sleepState.pendingSensorEvents,
                    buildSensorStateSnapshot(sleepState),
                    buildPendingWorldEventDeps(),
                ),
            processPendingGeneratorSpawns: (deltaSeconds, sleepState) =>
                processPendingGeneratorSpawnsSystem(
                    deltaSeconds,
                    sleepState.pendingGeneratorSpawns,
                    buildSensorStateSnapshot(sleepState),
                    {
                        hasApproximateOriginalGeneratorCapacity,
                        isGeneratorSpawnBlocked,
                        createGeneratedCreatureGroupInstances,
                        retrySeconds: ORIGINAL_MOVE_GROUP_RETRY_SECONDS,
                        diffSensorState,
                    },
                ),
            applyCombatTick: applyCombatTickApprox,
            isPartyRested: isPartyRestedApprox,
        },
    ) as Partial<GameState> | null;
}

function applyPartyLoadBasedFatigue(
    state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'championInventories' | 'activePotionBoosts'>,
    loadFactor: number,
): Record<number, ChampionVitals> | null {
    return applyPartyLoadBasedFatigueState(
        state,
        loadFactor,
        {
            getEffectiveChampionStatsRuntime,
            getTotalWeight,
            getChampionMaxLoad,
            getChampionRuntimeBonuses,
            applyChampionStaminaDeltaOriginal,
        },
    );
}

function applyPartyMoveFatigue(state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'championInventories' | 'activePotionBoosts'>): Record<number, ChampionVitals> | null {
    // FTL normal movement fatigue: ((Load * 3) / MaximumLoad) + 1
    return applyPartyLoadBasedFatigue(state, 3);
}

function applyFrontRowWallBumpDamage(
    state: Pick<GameState, 'level' | 'position' | 'party' | 'championInventories' | 'championEquipment' | 'floorItems' | 'deadChampions' | 'selectedChampionIndex'>,
    championVitals: Record<number, ChampionVitals>,
): Partial<GameState> | null {
    return applyFrontRowWallBumpDamageState(
        {
            ...state,
            damageEvents: [],
            activeShields: [],
            activePotionBoosts: [],
        },
        championVitals,
        Date.now(),
        {
            randomInt,
            buildChampionDamageEvent,
            buildDeathDrop: buildDeathDropSystem,
        },
    ) as Partial<GameState> | null;
}

function applyPartyFallImpactDamage(
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
    landingLevel: number,
    landingPosition: [number, number],
): Partial<GameState> | null {
    return applyPartyWideIncomingAttackApprox(
        {
            ...state,
            level: landingLevel,
            position: landingPosition,
        },
        championVitals,
        20,
        'Blunt',
        ['legs', 'feet'],
        Date.now(),
        false,
    );
}

function applyImmediateTransportSquareEffects(
    state: Pick<
        GameState,
        | 'level'
        | 'position'
        | 'direction'
        | 'party'
        | 'selectedChampionIndex'
        | 'openDoors'
        | 'openPits'
        | 'openTeleporters'
        | 'openWalls'
        | 'creatures'
        | 'floorItems'
        | 'championInventories'
        | 'championEquipment'
        | 'championVitals'
        | 'damageEvents'
        | 'spellVisualEvents'
        | 'deadChampions'
        | 'activeShields'
        | 'activePotionBoosts'
        | 'championCombat'
    >,
    basePatch: Partial<GameState>,
): Partial<GameState> {
    const openedPitEffectsDeps = buildOpenedPitEffectsDeps();
    const openedTeleporterEffectsDeps = buildOpenedTeleporterEffectsDeps();
    const nextOpenPits = basePatch.openPits ?? state.openPits;
    const nextOpenTeleporters = basePatch.openTeleporters ?? state.openTeleporters;

    const openedPitKeys = [...nextOpenPits].filter((key) => !state.openPits.has(key));
    const openedTeleporterKeys = [...nextOpenTeleporters].filter((key) => !state.openTeleporters.has(key));
    if (openedPitKeys.length === 0 && openedTeleporterKeys.length === 0) return basePatch;

    let level = basePatch.level ?? state.level;
    let position = basePatch.position ?? state.position;
    let direction = basePatch.direction ?? state.direction;
    let creatures = basePatch.creatures ?? state.creatures;
    let floorItems = basePatch.floorItems ?? state.floorItems;
    let championVitals = basePatch.championVitals ?? state.championVitals;
    let party = basePatch.party ?? state.party;
    let championInventories = basePatch.championInventories ?? state.championInventories;
    let championEquipment = basePatch.championEquipment ?? state.championEquipment;
    let deadChampions = basePatch.deadChampions ?? state.deadChampions;
    let selectedChampionIndex = basePatch.selectedChampionIndex ?? state.selectedChampionIndex;
    let damageEvents = basePatch.damageEvents ?? state.damageEvents;
    let spellVisualEvents = basePatch.spellVisualEvents ?? state.spellVisualEvents;
    let changed = false;

    const pitEffects = applyOpenedPitEffectsSystem(
        {
            level,
            position,
            party,
            selectedChampionIndex,
            creatures,
            floorItems,
            championInventories,
            championEquipment,
            championVitals,
            damageEvents,
            spellVisualEvents,
            deadChampions,
            activeShields: state.activeShields,
            activePotionBoosts: state.activePotionBoosts,
            championCombat: state.championCombat,
            openDoors: state.openDoors,
            openWalls: state.openWalls,
            openPits: nextOpenPits,
        },
        openedPitKeys,
        openedPitEffectsDeps,
    );
    if (pitEffects.changed) {
        level = pitEffects.level;
        position = pitEffects.position;
        creatures = pitEffects.creatures;
        floorItems = pitEffects.floorItems;
        championVitals = pitEffects.championVitals;
        party = pitEffects.party;
        championInventories = pitEffects.championInventories;
        championEquipment = pitEffects.championEquipment;
        deadChampions = pitEffects.deadChampions;
        selectedChampionIndex = pitEffects.selectedChampionIndex;
        damageEvents = pitEffects.damageEvents;
        spellVisualEvents = pitEffects.spellVisualEvents;
        changed = true;
    }

    const teleporterEffects = applyOpenedTeleporterEffectsSystem(
        {
            level,
            position,
            direction,
            creatures,
            floorItems,
            spellVisualEvents,
            openDoors: state.openDoors,
            openWalls: state.openWalls,
            openPits: nextOpenPits,
            openTeleporters: nextOpenTeleporters,
        },
        openedTeleporterKeys,
        openedTeleporterEffectsDeps,
    );
    if (teleporterEffects.changed) {
        level = teleporterEffects.level;
        position = teleporterEffects.position;
        direction = teleporterEffects.direction;
        creatures = teleporterEffects.creatures;
        floorItems = teleporterEffects.floorItems;
        spellVisualEvents = teleporterEffects.spellVisualEvents;
        changed = true;
    }

    if (!changed) return basePatch;

    return {
        ...basePatch,
        level,
        position,
        direction,
        creatures,
        floorItems,
        championVitals,
        party,
        championInventories,
        championEquipment,
        deadChampions,
        selectedChampionIndex,
        damageEvents,
        spellVisualEvents,
    };
}

function resolvePartyStepTransport(
    state: GameState,
    ny: number,
    nx: number,
    movedVitals: Record<number, ChampionVitals> | null,
): {
    patch: Partial<GameState> | GameState;
    blockedMessage?: string;
    fellThroughPit?: boolean;
} {
    const [y, x] = state.position;
    const targetTile = getMap(state.level).tiles[ny]?.[nx];
    if (!targetTile) {
        return { patch: movedVitals ? { championVitals: movedVitals } : state };
    }

    if (targetTile.type === 'Pit' && state.openPits.has(`${state.level},${ny},${nx}`)) {
        const openPitEntry = resolveOpenPitEntryTransportSystem(
            state,
            x,
            y,
            ny,
            nx,
            movedVitals,
            buildPitEntryTransportDeps(),
        );
        if (openPitEntry) {
            return openPitEntry;
        }
        return { patch: movedVitals ? { championVitals: movedVitals } : state };
    }

    if (!isWalkable(state.level, ny, nx, state.openDoors, state.openWalls, state.openPits)) {
        return { patch: movedVitals ? { championVitals: movedVitals } : state };
    }

    if (targetTile.type === 'Stairs') {
        const stairStep = resolveStairStepTransportSystem(
            state,
            STAIR_CONNECTIONS.find(
                (stair) => stair.fromLevel === state.level && stair.fromY === ny && stair.fromX === nx,
            ),
            movedVitals ? { championVitals: movedVitals } : null,
            buildStairStepTransportDeps(),
        );
        if (stairStep) {
            return stairStep;
        }
        const link = STAIR_CONNECTIONS.find(
            (stair) => stair.fromLevel === state.level && stair.fromY === ny && stair.fromX === nx,
        );
        if (link) {
            return { patch: movedVitals ? { championVitals: movedVitals } : state };
        }
    }

    if (targetTile.type === 'Teleporter') {
        const teleporterStep = resolveTeleporterStepTransportSystem(
            state,
            ny,
            nx,
            movedVitals,
            buildTeleporterStepTransportDeps(),
        );
        if (teleporterStep) {
            return teleporterStep;
        }
    }

    return resolveStandardStepTransportSystem(
        state,
        x,
        y,
        nx,
        ny,
        movedVitals,
        buildStandardStepTransportDeps(),
    );
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
    return applyPartySpellBacklashDamageState(
        {
            ...state,
            selectedChampionIndex: state.selectedChampionIndex ?? 0,
        },
        championVitals,
        effect,
        rawDamage,
        nowMs,
        {
            buildChampionDamageEvent,
            buildDeathDrop: buildDeathDropSystem,
            rollOriginalPartyWideAttack,
            getProjectileDamageClass,
            getChampionAdjustedAttackFromResistance: getChampionAdjustedAttackFromResistanceApprox,
            getChampionRuntimeBonuses,
            getActiveShieldDefense: getActiveShieldDefenseApprox,
        },
    ) as Partial<GameState> | null;
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
    return applyPartyWideIncomingAttackState(
        state as Pick<GameState, keyof GameState>,
        championVitals,
        rawAttack,
        attackType,
        allowedSlots,
        nowMs,
        spread,
        {
            buildChampionDamageEvent,
            buildDeathDrop: buildDeathDropSystem,
            rollOriginalPartyWideAttack,
            resolveChampionIncomingAttack: (
                attackState,
                champion,
                currentVitals,
                attack,
                incomingAttackType,
                incomingAllowedSlots,
                attackNowMs,
            ) => resolveChampionIncomingAttackApprox(
                attackState as GameState,
                champion,
                currentVitals,
                attack,
                incomingAttackType as IncomingAttackTypeApprox,
                incomingAllowedSlots as readonly ChampionWoundSlot[],
                attackNowMs,
            ),
        },
    ) as Partial<GameState> | null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const storeCreator: StateCreator<GameState> = (set, get) => ({
    ...buildFreshDungeonState(DEFAULT_GAME_OPTIONS, 'title'),

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
        const steppingIntoOpenPit = targetTile?.type === 'Pit' && state.openPits.has(`${state.level},${ny},${nx}`);
        if (!steppingIntoOpenPit && !isWalkable(state.level, ny, nx, state.openDoors, state.openWalls, state.openPits)) {
            const ss = buildSensorStateSnapshot(state);
            const pushChanges = triggerWallPushSensorsSystem(
                state.level,
                nx,
                ny,
                state.direction,
                ss,
                state.pendingSensorEvents,
                buildWallPushSensorDeps(),
            );
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
            return applyImmediateTransportSquareEffects(state, {
                ...(movedVitals ? { championVitals: movedVitals } : {}),
                ...(wallBumpChanges ?? {}),
                ...pushChanges.sensorChanges,
                pendingSensorEvents: pushChanges.pendingSensorEvents,
            });
        }
        const stepResult = resolvePartyStepTransport(state, ny, nx, movedVitals);
        fellThroughPit = Boolean(stepResult.fellThroughPit);
        blockedMessage = stepResult.blockedMessage;
        return stepResult.patch;
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
        const stepResult = resolvePartyStepTransport(state, ny, nx, movedVitals);
        blockedMessage = stepResult.blockedMessage;
        return stepResult.patch;
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
        const stepResult = resolvePartyStepTransport(state, ny, nx, movedVitals);
        blockedMessage = stepResult.blockedMessage;
        return stepResult.patch;
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
        const stepResult = resolvePartyStepTransport(state, ny, nx, movedVitals);
        blockedMessage = stepResult.blockedMessage;
        return stepResult.patch;
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
            ? createReincarnatedChampionSystem(champion, randomInt)
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
                        : buildInitialChampionXP(recruitedChampion),
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
        if (state.brokenDoors.has(key)) return state;
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
        return activateWallSensorSystem(state, mapIndex, x, y, sensorIndex, {
            ...buildWallSensorActivationDeps(),
        });
    }),

    useItemOnFrontWall: (championId, itemId, fromSlot) => {
        const state = get();
        const result = tryUseChampionItemOnFrontWall(state, { championId, itemId, fromSlot }, buildFrontWallInteractionDeps());
        if (!result.matched || !result.patch) return false;
        set(result.patch);
        if (result.shouldPlayPlate) playPlate();
        return true;
    },

    useFloorItemOnFrontWall: (itemId, championId) => {
        const state = get();
        const result = tryUseFloorItemOnFrontWall(state, itemId, championId, buildFrontWallInteractionDeps());
        if (!result.matched || !result.patch) return false;
        set(result.patch);
        if (result.shouldPlayPlate) playPlate();
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
        const partial = buildDeathDropSystem(
            { level: state.level, position: state.position, party: state.party,
              championInventories: state.championInventories, championEquipment: state.championEquipment,
              floorItems: state.floorItems, deadChampions: state.deadChampions },
            championId,
            Date.now(),
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
        const patch = transferFloorItemToChampionStateSystem(state, id, activeChampion.id, {
            getTile: (mapIndex, y, x) => getMap(mapIndex).tiles[y]?.[x],
            buildPickupPatch: buildFloorItemPickupPatch,
            clearAlcoveStateOnPickup: (item, pickupState) =>
                clearAlcoveStateOnPickupSystem(item, pickupState, buildWallItemSensorDeps()),
            buildHiddenFirestaffMessage: () =>
                buildAttackResultMessage("Le Firestaff complet ne peut être obtenu que via l'Amalgam."),
        });
        return patch ? { ...state, ...patch } : state;
    }),

    pickupItemToChampion: (id, championId) => {
        const state = get();
        const patch = transferFloorItemToChampionStateSystem(state, id, championId, {
            getTile: (mapIndex, y, x) => getMap(mapIndex).tiles[y]?.[x],
            buildPickupPatch: buildFloorItemPickupPatch,
            clearAlcoveStateOnPickup: (item, pickupState) =>
                clearAlcoveStateOnPickupSystem(item, pickupState, buildWallItemSensorDeps()),
            buildHiddenFirestaffMessage: () =>
                buildAttackResultMessage("Le Firestaff complet ne peut être obtenu que via l'Amalgam."),
        });
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
            if (
                deadChamp &&
                isAltarTileSystem(state.level, x, y, (level, tileX, tileY) => getMap(level).tiles[tileY]?.[tileX]) &&
                state.party.length < MAX_PARTY
            ) {
                return buildViAltarResurrectionPatchSystem(state, deadChampId, itemId, championId, {
                    createChampionVitals,
                    maxFood: MAX_FOOD,
                    maxWater: MAX_WATER,
                }) ?? state;
            }
        }

        const dropped: FloorItem = { ...item, mapIndex: state.level, x, y, tilePos: 'North' };
        const nextFloorItems = [...state.floorItems, dropped];
        const ss = buildSensorStateSnapshot(state);
        const sensorChanges = triggerFloorSensorsSystem(
            state.level,
            x,
            y,
            ss,
            state.championInventories,
            state.championEquipment,
            nextFloorItems,
            state.pendingSensorEvents,
            buildMovementSensorDeps(),
            'enter',
        );
        return applyImmediateTransportSquareEffects(state, {
            championInventories: { ...state.championInventories, [championId]: inv.filter(i => i.id !== itemId) },
            floorItems: nextFloorItems,
            ...sensorChanges.sensorChanges,
            pendingSensorEvents: sensorChanges.pendingSensorEvents,
        });
    }),

    dropCarriedItem: (championId, itemId, fromSlot) => {
        const state = get();
        const patch = dropChampionCarriedItem(state, championId, itemId, fromSlot);
        if (!patch) return false;
        set(patch);
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
            const patch = throwChampionCarriedItem(current, championId, itemId, fromSlot, projectile);
            if (!patch) return current;
            return {
                ...patch,
                ...(thrownItemXP ?? {}),
            };
        });

        return true;
    },

    equipItem: (championId, slotKey, itemId) => set((state) => {
        const item = (state.championInventories[championId] ?? []).find((entry) => entry.id === itemId);
        if (!item || !canEquipItemInSlot(item, slotKey)) return state;
        return equipChampionInventoryItem(state, championId, slotKey, itemId) ?? state;
    }),

    unequipItem: (championId, slotKey) => set((state) =>
        unequipChampionItem(state, championId, slotKey) ?? state,
    ),

    giveItem: (fromChampionId, toChampionId, itemId) => set((state) =>
        giveChampionInventoryItem(state, fromChampionId, toChampionId, itemId) ?? state,
    ),

    giveEquippedItem: (fromChampionId, slotKey, toChampionId) => set((state) =>
        giveChampionEquippedItem(state, fromChampionId, slotKey, toChampionId) ?? state,
    ),

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

        const [y, x] = state.position;
        if (!isAltarTileSystem(state.level, x, y, (level, tileX, tileY) => getMap(level).tiles[tileY]?.[tileX])) return state;

        return buildViAltarResurrectionPatchSystem(state, deadChampId, bonesItemId, carriedBy, {
            createChampionVitals,
            maxFood: MAX_FOOD,
            maxWater: MAX_WATER,
        }) ?? state;
    }),

    useItem: (championId, itemId, fromSlot = 'inventory') => set((state) => {
        return buildUseItemStatePatch(
            state,
            championId,
            itemId,
            fromSlot,
            Date.now(),
            {
                locateChampionItem,
                getEffectiveChampionStatsRuntime,
                normalizeChampionCurrentStats,
                resolveUseItemConsumption: (args) => resolveUseItemConsumption(
                    args,
                    {
                        isWaterContainer,
                        consumeWaterContainer,
                        clampFoodWater,
                        getPotionDef,
                        getMiscNutrition: (typeId) => {
                            const def = MISC_TYPES[typeId];
                            return def?.food && def.nutrition ? def.nutrition : null;
                        },
                        resolvePotionConsumption: (potionArgs) => resolvePotionConsumption(potionArgs, {
                            adjustStatisticCurrentValue: adjustOriginalStatisticCurrentValue,
                            buildEmptyFlaskReplacement,
                            getPartyShieldKind,
                            quantizeDurationMs: quantizeMsToOriginalTimerTicks,
                            healChampionWounds: healChampionWoundsApprox,
                            timerTickMs: ORIGINAL_TIMER_TICK_MS,
                        }),
                        maxFood: MAX_FOOD,
                        maxWater: MAX_WATER,
                    },
                ),
                buildUseItemPatch,
            },
        ) ?? state;
    }),

    fillWaterContainer: (championId, itemId) => set((state) => {
        if (!isFacingFountainSystem(state.level, state.position, state.direction, {
            getTile: (level, x, y) => getMap(level).tiles[y]?.[x],
            hasOriginalWallOverlayAt,
        })) return state;
        return resolveFillWaterAction(
            {
                state,
                championId,
                itemId,
            },
            {
                canFillWaterContainer,
                fillWaterContainer,
            },
        ) ?? state;
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
        set((state) => buildFreshDungeonState(state.gameOptions, 'exploration'));
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
        const data = tryParsePersistedSaveDataSystem(readBestPersistedSave());
        if (!data) return false;
        const now = Date.now();
        const hydrated = hydratePersistedGameStateSystem(data, now);
        restoreExternalCreatureRuntimeFromSaveSystem(data, {
            creatureTimers,
            creatureAttackWindows,
            creatureConfusedUntil,
            creatureFluxcageUntil,
            creatureFrightenedUntil,
            creatureLastSeenPartyPos,
        });
        set(buildLoadedGameUiResetPatch({
            ...hydrated,
            pendingSensorEvents: hydrated.pendingSensorEvents as PendingSensorEvent[],
            pendingGeneratorSpawns: hydrated.pendingGeneratorSpawns as PendingGeneratorSpawnEvent[],
        }));
        return true;
    },

    returnToTitle: () => set(buildReturnToTitlePatch()),

    castSpell: (championId, runeIds) => set((state) => {
        const champion = state.party.find(c => c.id === championId);
        if (!champion) return state;

        const vitals = state.championVitals[championId];
        if (!vitals) return state;
        const now = Date.now();
        const castEquip = state.championEquipment[championId] ?? {};
        const castResult = buildCastSpellStatePatch<NonNullable<ReturnType<typeof findSpell>>, Partial<GameState>, ChampionVitals>(runeIds, {
            findSpell,
            buildUnknownCombinationPatch: () => ({
                lastCastResult: { success: false, message: 'Combinaison de runes inconnue.', ts: now },
            }),
            prepareCast: (spell) => prepareSpellCast(
                {
                    championId,
                    spell,
                    vitals,
                    currentChampionCombat: state.championCombat,
                    now,
                },
                {
                    getSkillLevel: (skill) => getChampionMasteryLevel(state, championId, champion, skill),
                    rollCastCheck: (skillLevel) => rollOriginalSpellCastSuccess(
                        champion,
                        castEquip,
                        state.activePotionBoosts,
                        vitals,
                        spell,
                        skillLevel,
                    ),
                    applySkillXp: (skill, amount) => applyChampionSkillExperienceOriginalApprox(state, championId, skill, amount),
                    originalTimerTicksToSeconds,
                    createChampionCombatState,
                    randomInt,
                },
            ),
            buildFailedCastPatch: (basePatch, nextVitals) => ({
                ...basePatch,
                championVitals: { ...state.championVitals, [championId]: nextVitals },
            }),
            buildNonProjectilePatch: (spell, nextVitals) => buildHandledNonProjectileSpellPatch({
                championId,
                championHealth: champion.health,
                now,
                spell,
                level: state.level,
                position: state.position,
                nextVitals,
                currentChampionVitals: state.championVitals,
                currentChampionEquipment: state.championEquipment,
                currentEquipment: state.championEquipment[championId] ?? {},
                currentFloorItems: state.floorItems,
                currentSpellLights: state.spellLights,
                currentActiveShields: state.activeShields,
                invisibleUntil: state.invisibleUntil,
                seeThroughWallsUntil: state.seeThroughWallsUntil,
                magicVisionUntil: state.magicVisionUntil,
                footprintsUntil: state.footprintsUntil,
                quantizeDurationMs: quantizeMsToOriginalTimerTicks,
                randomInt,
                resolvePotionName: (typeId) => resolveItemName('Potion', typeId),
                plasmaName: resolveItemName('Misc', 51),
                buildDroppedItem: (item) => buildDroppedItem(
                    item,
                    state.level,
                    state.position[1],
                    state.position[0],
                ),
            }),
            buildProjectilePatch: (spell, nextVitals, skillLevel) => {
                switch (spell.effect) {
                    case 'fireball':
                    case 'lightning':
                    case 'poison_cloud':
                    case 'poison_bolt':
                    case 'open':
                    case 'disrupt_nonmaterial': {
                        const equip = state.championEquipment[championId] ?? {};
                        const effective = getEffectiveChampionStatsRuntime(champion, equip, state.activePotionBoosts, nextVitals);
                        return buildProjectileSpellStatePatch(
                            {
                                spell,
                                championId,
                                level: state.level,
                                position: state.position,
                                direction: state.direction,
                                now,
                                skillLevel,
                                maxMana: effective.mana,
                                elapsedGameTimeTicks: state.elapsedGameTimeTicks,
                                nextVitals,
                                currentChampionVitals: state.championVitals,
                                currentSpellVisualEvents: state.spellVisualEvents,
                                currentOpenDoors: state.openDoors,
                                currentProjectiles: state.projectiles,
                                currentActivePoisonClouds: state.activePoisonClouds,
                            },
                            {
                                projectileAttack: ORIGINAL_SPELL_PROJECTILE_ATTACK,
                                projectileStepMs: PROJECTILE_STEP_MS,
                                gridSize: GRID_SIZE,
                                getImmediateDoor: (level, x, y) => getClosedDoorAt(state, level, x, y),
                                isImmediatelyBlocked: (level, x, y) => isBlockedForProjectile(state, level, x, y),
                                buildBlockedPoisonCloud: buildActivePoisonCloud,
                                rollSourceBackedImpactDamage: (initialRange) => {
                                    const impact = rollOriginalSpellProjectileImpact(
                                        spell,
                                        initialRange,
                                        0,
                                        randomInt,
                                    );
                                    return impact?.damage ?? null;
                                },
                                rollRandomDamage: (min, max) => min + Math.floor(Math.random() * (max - min + 1)),
                                applyBacklash: (effect, rolledDamage) => applyPartySpellBacklashDamage(
                                    state,
                                    { ...state.championVitals, [championId]: nextVitals },
                                    effect,
                                    rolledDamage,
                                    now,
                                ),
                            },
                        );
                    }
                    default:
                        return null;
                }
            },
            mergeBasePatch: (basePatch, nextPatch) => ({
                ...basePatch,
                ...nextPatch,
            }),
        });
        if (!castResult) {
            return state;
        }
        if (castResult.shouldPlayDoorMotion && castResult.doorMotionSquare) {
            playDoorMotion(
                DOOR_TOGGLE_SOUND_DURATION_MS,
                getDoorSoundVolume(
                    castResult.doorMotionSquare.level,
                    castResult.doorMotionSquare.x,
                    castResult.doorMotionSquare.y,
                ),
            );
        }
        return castResult.patch;
    }),

    tickFrame: (delta, now) => set((state) => {
        return processTickFrame(state, delta, now, {
            shouldEnterGameOver,
            applyEndgameFrame: applyEndgameFrameApprox,
            applySleepFrame: applySleepFrameApprox,
            applyRegenTick: applyRegenTickApprox,
            applyMovementTick: (movementState, movementDelta) => tickMovementCooldown({
                movementCooldown: movementState.movementCooldown,
                delta: movementDelta,
            }),
            applyCombatTick: applyCombatTickApprox,
            buildSensorStateSnapshot,
            processPendingSensorEvents: (pendingDelta, pendingSensorEvents, sensorState) => processPendingSensorEventsSystem(
                pendingDelta,
                pendingSensorEvents,
                sensorState,
                buildPendingWorldEventDeps(),
            ),
            processPendingGeneratorSpawns: (pendingDelta, pendingGeneratorSpawns, sensorState) => processPendingGeneratorSpawnsSystem(
                pendingDelta,
                pendingGeneratorSpawns,
                sensorState,
                {
                    hasApproximateOriginalGeneratorCapacity,
                    isGeneratorSpawnBlocked,
                    createGeneratedCreatureGroupInstances,
                    retrySeconds: ORIGINAL_MOVE_GROUP_RETRY_SECONDS,
                    diffSensorState,
                },
            ),
            applyImmediateTransportSquareEffects,
        });
    }),

    regenTick: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        return tickRegenState({
            delta,
            regenTickRemainder: state.regenTickRemainder,
            originalTimerTickSeconds: ORIGINAL_TIMER_TICK_SECONDS,
            advanceSurvivalTime: (stepCount) => advanceSurvivalTimeApprox(state, stepCount),
        }) ?? state;
    }),

    tickMovement: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        return tickMovementCooldown({
            movementCooldown: state.movementCooldown,
            delta,
        }) ?? state;
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
        const attackSelection = resolveAttackSelection(
            { attackType, availableAttacks },
            {
                getMasteryLevel: (skill) => getChampionMasteryLevel(state, championId, champion, skill),
                hasCompatibleAmmo: () => {
                    const requiredAmmoRawClass = getRequiredAmmoRawClass(rightHand);
                    return Boolean(findQuiverAmmo(equip, requiredAmmoRawClass));
                },
                isAttackUsableAtMastery: isAttackOptionUsableAtMastery,
                getAttackUnusableReason: getAttackOptionUnusableReason,
                isShootAttack,
            },
        );
        const selectedAttack = attackSelection.selectedAttack;
        const selectedSkill = attackSelection.selectedSkill;
        if (attackSelection.blockedMessage) {
            return {
                lastCastResult: buildAttackResultMessage(attackSelection.blockedMessage),
            };
        }

        const stats = getRightHandStats(state.championEquipment[championId]);
        const cooldownSec = selectedAttack ? getAttackCooldownSeconds(selectedAttack) : stats.cooldownSec;
        const newCombat = createChampionCombatState(
            cooldownSec,
            selectedAttack?.attack.defenseModifier ?? 0,
        );
        const vitalsUpdate = applyChampionAttackVitalsSystem(
            champion,
            state.championEquipment[championId] ?? {},
            state.activePotionBoosts,
            state.championVitals[championId],
            selectedAttack,
            {
                getEffectiveChampionStatsRuntime,
                randomInt,
                clampVital,
            },
        );
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

        if (selectedAttack && (isThrowAttack(selectedAttack) || isShootAttack(selectedAttack))) {
            const projectileAttackPatch = buildPhysicalProjectileAttackPatch(
                selectedAttack,
                {
                    championId,
                    level: state.level,
                    position: state.position,
                    direction: state.direction,
                    now: Date.now(),
                    championCombat: state.championCombat,
                    championVitals,
                    championEquipment: state.championEquipment,
                    projectiles: state.projectiles,
                },
                champion,
                equip,
                rightHand,
                vitalsUpdate?.nextVitals.stamina,
                newCombat,
                {
                    isThrowAttack,
                    isShootAttack,
                    getOriginalWeaponReference,
                    getFighterMastery: () => getChampionMasteryLevel(state, championId, champion, 'fighter'),
                    getNinjaMastery: () => getChampionMasteryLevel(state, championId, champion, 'ninja'),
                    getRuntimeBonuses: (currentVitals) => getChampionRuntimeBonuses(
                        champion,
                        currentVitals ?? state.championVitals[championId],
                        state.activePotionBoosts,
                    ),
                    originalThrowingDistance,
                    getThrownPotionExplosionEffect,
                    buildDroppedItem,
                    randomInt,
                    findAmmo: (currentEquip, currentRightHand) => findQuiverAmmo(
                        currentEquip,
                        getRequiredAmmoRawClass(currentRightHand ?? undefined),
                    ),
                    buildAttackXpPatch: () => applyChampionSkillExperienceOriginalApprox(
                        state,
                        championId,
                        selectedSkill,
                        selectedAttack.attack.experienceForAttacking,
                    ),
                    buildAttackResultMessage,
                },
            );
            if (projectileAttackPatch) {
                return projectileAttackPatch;
            }
        }

        const performSupportedUtilityAction = (): Partial<GameState> | null => {
            if (!selectedAttack) return null;
            const now = Date.now();
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
            return buildSupportedUtilityAttackPatch(
                selectedAttack,
                {
                    now,
                    level: state.level,
                    position: state.position,
                    direction: state.direction,
                    creatures: state.creatures,
                    party: state.party,
                    championVitals,
                    championId,
                    championHealth: champion.health,
                    freezeLifeRemainingTicks: state.freezeLifeRemainingTicks,
                    seeThroughWallsUntil: state.seeThroughWallsUntil,
                    spellLights: state.spellLights,
                    activeShields: state.activeShields,
                    projectiles: state.projectiles,
                    rightHandTypeId: rightHand?.typeId,
                    rightHand,
                    rightHandWeaponName: rightHand ? getWeaponName(rightHand) : '',
                    floorItems: state.floorItems,
                    damageEvents: state.damageEvents,
                    spellVisualEvents: state.spellVisualEvents,
                },
                base,
                {
                    randomInt,
                    quantizeDurationMs: quantizeMsToOriginalTimerTicks,
                    buildAttackResultMessage,
                    getCreatureDef: (typeId: number) => CREATURE_TYPES[typeId],
                    timerTickMs: ORIGINAL_TIMER_TICK_MS,
                    getFluxcageExpiresAt: (creatureId: string) => creatureFluxcageUntil.get(creatureId) ?? 0,
                    getTargetTimers: (creatureId: string) => creatureTimers.get(creatureId),
                    resolveClimbDown: (climbDownState, climbDownBase) => resolveClimbDownActionSystem(
                        climbDownState,
                        climbDownBase,
                        buildClimbDownActionDeps(),
                    ),
                    climbDownState: state,
                    applyControlUpdate: (update) => {
                        if (update.kind === 'confused') {
                            creatureConfusedUntil.set(update.targetId, update.expiresAt);
                        } else {
                            creatureFluxcageUntil.set(update.targetId, update.expiresAt);
                        }
                        if (update.nextTimers) {
                            creatureTimers.set(update.targetId, update.nextTimers);
                        }
                    },
                    applyFearResult: (fearResult) => {
                        if (fearResult.sound === 'horn') playHornOfFear();
                        if (fearResult.sound === 'war-cry') playWarCry();
                        for (const frightened of fearResult.frightenedCreatures) {
                            creatureFrightenedUntil.set(frightened.id, frightened.expiresAt);
                        }
                        for (const creatureId of fearResult.clearLastSeenIds) {
                            creatureLastSeenPartyPos.delete(creatureId);
                        }
                    },
                    clearCreatureControlStatuses: () => {
                        creatureFluxcageUntil.clear();
                        creatureConfusedUntil.clear();
                        creatureFrightenedUntil.clear();
                    },
                    getEndgameMessagesForMap,
                    dropCreatureCarriedItems,
                    buildCreatureDamageEvent,
                    buildDeathDustEvent,
                },
            );
        };

        if (selectedAttack && !isPhysicalAttack(selectedAttack)) {
            const handled = performSupportedUtilityAction();
            if (handled) return handled;
            return {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
                lastCastResult: buildAttackResultMessage(`Action originale pas encore intégrée: ${selectedAttack.displayName}.`),
            };
        }

        const { target } = resolveAttackFrontContext(
            state.level,
            state.position,
            state.direction,
            state.creatures,
            state.party,
            championId,
        );

        playPartyAttack();
        return buildAttackMeleeStatePatch(
            {
                championId,
                championCombat: state.championCombat,
                championVitals,
                level: state.level,
                position: state.position,
                direction: state.direction,
                openDoors: state.openDoors,
                brokenDoors: state.brokenDoors,
                creatures: state.creatures,
                floorItems: state.floorItems,
                party: state.party,
                championXP: state.championXP,
                championTemporaryXP: state.championTemporaryXP,
                elapsedGameTimeTicks: state.elapsedGameTimeTicks,
                lastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
                damageEvents: state.damageEvents,
                spellVisualEvents: state.spellVisualEvents,
            },
            champion,
            equip,
            state.activePotionBoosts,
            selectedAttack,
            target,
            newCombat,
            stats.skill,
            {
                tryBreakFrontDoor: (breakState, currentChampion, currentEquip, activePotionBoosts, attackOption) => tryBreakFrontDoorSystem(
                    breakState,
                    currentChampion,
                    currentEquip,
                    activePotionBoosts,
                    attackOption,
                    {
                        getFrontPosition,
                        getTile: (level: number, x: number, y: number) => getMap(level).tiles[y]?.[x],
                        getEffectiveChampionStatsRuntime,
                        getWeaponMaxDamage: (equipment) => equipment?.rightHand?.category === 'Weapon'
                            ? (WEAPON_TYPES[equipment.rightHand.typeId]?.damage[1] ?? 0)
                            : 0,
                        randomInt,
                        buildAttackResultMessage,
                    },
                ),
                determineMeleeDamage: (currentTarget) => determineMeleeDamage(
                    {
                        champion,
                        equip,
                        inventory: state.championInventories[championId] ?? [],
                        currentVitals: state.championVitals[championId],
                        currentStamina: vitalsUpdate?.nextVitals.stamina,
                        attackOption: selectedAttack,
                        target: currentTarget,
                        levelDifficulty: getMap(state.level).difficulty,
                    },
                    {
                        getEffectiveChampionStats: (currentChampion, currentEquip, currentVitals) => getEffectiveChampionStatsRuntime(
                            currentChampion,
                            currentEquip,
                            state.activePotionBoosts,
                            currentVitals,
                        ),
                        getWeaponDescriptor: getOriginalWeaponReference,
                        getWeaponName,
                        isLikelyNonMaterial,
                        computeQuickness: computeOriginalQuicknessApprox,
                        getRuntimeBonuses: (currentChampion, currentVitals) => getChampionRuntimeBonuses(
                            currentChampion,
                            currentVitals,
                            state.activePotionBoosts,
                        ),
                        randomInt,
                        isCharacterLucky: isCharacterLuckyApprox,
                        originalThrowingDistance,
                        getFighterMastery: () => getChampionMasteryLevel(state, championId, champion, 'fighter'),
                        getNinjaMastery: () => getChampionMasteryLevel(state, championId, champion, 'ninja'),
                        getAttackMastery: (attackOption) => getChampionMasteryLevel(
                            state,
                            championId,
                            champion,
                            attackOption ? mapOriginalSkillNumberToSkillKey(attackOption.attack.skillNumber) : 'fighter',
                        ),
                        getTargetDefense: (typeId: number) => CREATURE_TYPES[typeId],
                    },
                ),
                getAttackSkill: (attackOption, fallbackSkill) => attackOption
                    ? mapOriginalSkillNumberToSkillKey(attackOption.attack.skillNumber)
                    : fallbackSkill,
                buildMeleeAttackResolution: (attackSkill, currentTarget, totalDmg) => buildMeleeAttackResolutionPatch(
                    state,
                    championId,
                    currentTarget,
                    totalDmg,
                    attackSkill,
                    newCombat,
                    championVitals,
                    {
                        applyChampionSkillExperience: applyChampionSkillExperienceOriginalApprox,
                        getCreatureKillXp: (typeId: number) => CREATURE_TYPES[typeId]?.exp ?? 0,
                        dropCreatureCarriedItems,
                        buildCreatureDamageEvent,
                        buildDeathDustEvent,
                    },
                ),
            },
        );
    }),

    // ─── Door crush tick ─────────────────────────────────────────────────────
    tickDoors: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        return tickCrushingDoorsSystem(
            {
                crushingDoors: state.crushingDoors,
                openDoors: state.openDoors,
                creatures: state.creatures,
                damageEvents: state.damageEvents,
            },
            delta,
            {
                doorReboundDurationSeconds: DOOR_REBOUND_DURATION_SECONDS,
                doorRecloseDurationSeconds: DOOR_RECLOSE_DURATION_SECONDS,
                buildCreatureDamageEvent,
                playWallBump,
            },
        ) ?? state;
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
        let championEquipment = state.championEquipment;
        let projectiles = state.projectiles;
        let lastCreatureAttackGameTick = state.lastCreatureAttackGameTick;
        // Champions that reach 0 HP this tick — processed after the loop
        const newlyDead: number[] = [];

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

            const nowMs = Date.now();
            const lastSeen = creatureLastSeenPartyPos.get(c.id);
            const perception = resolveCreaturePerceptionState(
                {
                    creaturePosition: [c.x, c.y],
                    partyPosition: [px, py],
                    nowMs,
                    invisibleUntil: state.invisibleUntil,
                    sightRange: def.sightRange ?? 8,
                    seeInvisible: def.seeInvisible,
                    lastSeen,
                },
                {
                    hasLineOfSight: () => hasLineOfSight(map, state.level, state.openDoors, c.x, c.y, px, py),
                },
            );
            const dist = perception.distance;
            const adjacent = perception.adjacent;
            const canDetectParty = perception.canDetectParty;
            const runtimeState = resolveCreatureRuntimeState(
                buildCreatureRuntimeStateArgs(def, nowMs, {
                    confusedUntilMs: creatureConfusedUntil.get(c.id) ?? 0,
                    fluxcageUntilMs: creatureFluxcageUntil.get(c.id) ?? 0,
                    frightenedUntilMs: creatureFrightenedUntil.get(c.id) ?? 0,
                }),
            );
            const confused = runtimeState.confused;
            const fluxcaged = runtimeState.fluxcaged;
            const frightened = runtimeState.frightened;
            const attackReach = runtimeState.attackReach;
            const prefersRangedSpacing = runtimeState.prefersRangedSpacing;
            const rememberedTarget = perception.rememberedTarget;

            if (canDetectParty) {
                creatureLastSeenPartyPos.set(c.id, perception.nextRememberedTarget!);
            } else if (perception.shouldClearExpiredMemory) {
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

                const tileAvailable = (tx: number, ty: number) =>
                    canCreatureShareTile(c, state.level, tx, ty, creatures);

                const movementResult = resolveCreatureMovementState(
                    {
                        creature: c,
                        canDetectParty,
                        rememberedTarget,
                        partyPosition: state.position,
                        currentDistance: dist,
                        frightened,
                        prefersRangedSpacing,
                        attackReach,
                        isArchenemy: def.archenemy,
                    },
                    {
                        randomInt,
                        monsterWalkable: (level, y, x) => monsterWalkable(level, y, x),
                        tileAvailable,
                        canArchenemyDoubleMove: (creatureState, level, x, y, direction) =>
                            canArchenemyDoubleMoveApprox(
                                creatureState,
                                level,
                                x,
                                y,
                                direction,
                                creatures,
                                monsterWalkable,
                            ),
                    },
                );
                if (movementResult.kind === 'hold') {
                    creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });
                    continue;
                }
                if (movementResult.kind === 'move') {
                    nx = movementResult.x;
                    ny = movementResult.y;
                    if (nx !== c.x || ny !== c.y) {
                        movedThisTick = true;
                        if (movementResult.usesTeleport) {
                            playTeleport();
                        } else if (canDetectParty) {
                            playCreatureMove(c.typeId);
                        }
                        notifyCreatureAction(c.id, 'move');
                    }
                }
            }

            // ── Attack ────────────────────────────────────────────────────────
            const distanceAfterMove = Math.abs(px - nx) + Math.abs(py - ny);
            const adjacentAfterMove = distanceAfterMove === 1;
            const creatureProjectileEffect = chooseOriginalCreatureProjectileEffect(c.typeId, randomInt);
            const attackOpportunity = resolveCreatureAttackOpportunity(
                {
                    attackReach,
                    distanceAfterMove,
                    canDetectParty,
                    movedThisTick,
                    frightened,
                    atkTimer,
                    projectileEffectAvailable: Boolean(creatureProjectileEffect),
                    adjacentAfterMove,
                    isContactCell: isCreatureContactCell(c.cell),
                    attackWindowSeconds: CREATURE_ATTACK_WINDOW_MS / 1000,
                },
                { randomInt },
            );
            atkTimer = attackOpportunity.nextAttackTimer;

            const contactAdvance = resolveCreatureContactAdvance(
                c,
                creatures,
                {
                    frightened,
                    movedThisTick,
                    adjacentAfterMove,
                    attackReach,
                    creatureSizeOnTile: getCreatureSizeOnTile(c.typeId),
                },
                {
                    isCreatureCellOccupiedOnTile,
                    nextMonsterMoveDelaySeconds: () => nextMonsterMoveDelaySecondsApprox(def.moveSpd),
                },
            );
            if (contactAdvance) {
                if (creatures === state.creatures) creatures = [...creatures];
                creatures[i] = { ...c, cell: contactAdvance.targetCell };
                moveTimer = contactAdvance.nextMoveTimer;
                creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });
                notifyCreatureAction(c.id, 'move');
                continue;
            }

            const attackStart = resolveCreatureAttackStartState({
                shouldAttemptAttack: attackOpportunity.shouldAttemptAttack,
                confused,
                currentAttackTimer: atkTimer,
                nextAttackDelaySeconds: nextMonsterAttackDelaySecondsApprox(def.atkSpd),
                nowMs,
                attackWindowMs: CREATURE_ATTACK_WINDOW_MS,
                confusedSkipRoll: randomInt(2),
            });
            atkTimer = attackStart.nextAttackTimer;
            if (attackStart.kind === 'blocked') {
                creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });
                continue;
            }

            if (attackStart.kind === 'started') {
                playCreatureAttack(c.typeId);
                notifyCreatureAction(c.id, 'attack');
                creatureAttackWindows.set(c.id, attackStart.attackWindowExpiresAt);
                lastCreatureAttackGameTick = state.elapsedGameTimeTicks;

                const target = selectCreatureAttackTarget(
                    state.party,
                    vitals,
                    c.cell,
                    def.attackAnyChampion,
                    def.attackFromAllSides,
                    (maxExclusive) => Math.floor(Math.random() * maxExclusive),
                );
                if (target) {
                    const targetState = resolveCreatureAttackTargetState({
                        party: state.party,
                        championVitals: vitals,
                        championInventories,
                        championEquipment: {
                            ...state.championEquipment,
                            ...championEquipment,
                        },
                        selectedTargetId: target.id,
                    });
                    const attackResult = resolveCreatureAttackState(
                        {
                            state: {
                                position: state.position,
                                activePotionBoosts: state.activePotionBoosts,
                            },
                            creature: { ...c, x: nx, y: ny, mapIndex: c.mapIndex },
                            attackerDef: def,
                            creatureProjectileEffect,
                            shouldLaunchProjectile: attackOpportunity.shouldLaunchProjectile,
                            adjacentAfterMove,
                            targetChampion: targetState.targetChampion,
                            targetVitals: targetState.targetVitals,
                            targetInventory: targetState.targetInventory,
                            targetEquipment: targetState.targetEquipment,
                            levelDifficulty: getMap(state.level).difficulty * 2,
                            nowMs,
                        },
                        {
                            randomInt,
                            buildProjectile: (projectileState, creatureState, creatureDef, effect, targetChampionId, attackNowMs) =>
                                buildCreatureProjectile(
                                    projectileState,
                                    creatureState,
                                    creatureDef,
                                    effect,
                                    targetChampionId,
                                    attackNowMs,
                                    { randomInt },
                                ),
                            getEffectiveChampionStats: getEffectiveChampionStatsRuntime,
                            tryStealChampionItem,
                            isCharacterLucky: isCharacterLuckyApprox,
                            resolveMonsterAttackAgainstChampion: (attackArgs) =>
                                resolveMonsterAttackAgainstChampion(
                                    attackArgs,
                                    {
                                        randomInt,
                                        computeQuickness: computeOriginalQuicknessApprox,
                                        getRuntimeBonuses: getChampionRuntimeBonuses,
                                        getEffectiveChampionStats: getEffectiveChampionStatsRuntime,
                                        isCharacterLucky: isCharacterLuckyApprox,
                                        chooseChampionWoundSlots: chooseChampionWoundSlotsFromZones,
                                        resolveIncomingAttack: (
                                            champion,
                                            currentVitals,
                                            rawAttack,
                                            attackType,
                                            allowedSlots,
                                            attackNowMs,
                                        ) => resolveChampionIncomingAttackApprox(
                                            state,
                                            champion,
                                            currentVitals,
                                            rawAttack,
                                            attackType,
                                            allowedSlots,
                                            attackNowMs,
                                        ),
                                        clampVital,
                                        adjustByAttribute: adjustByAttributeApprox,
                                        applyPoison: applyPoisonCharacterApprox,
                                    },
                            ),
                        },
                    );
                    const attackOutcome = resolveCreatureAttackOutcomeState(
                        {
                            attackResult,
                            creature: c,
                            creatures,
                            stateCreatures: state.creatures,
                            stateProjectiles: state.projectiles,
                            currentProjectiles: projectiles,
                            championInventories,
                            championEquipment,
                            baseChampionEquipment: state.championEquipment,
                            championVitals: vitals,
                            damageEvents: dmgEvts,
                            level: state.level,
                        },
                        {
                            buildChampionDamageEvent,
                        },
                    );
                    if (attackOutcome.kind === 'projectile') {
                        projectiles = attackOutcome.projectiles;
                        continue;
                    }
                    if (attackOutcome.kind === 'steal') {
                        creatures = attackOutcome.creatures;
                        championInventories = attackOutcome.championInventories;
                        championEquipment = attackOutcome.championEquipment;
                        if (attackOutcome.shouldFlee) {
                            creatureFrightenedUntil.set(
                                c.id,
                                nowMs + quantizeMsToOriginalTimerTicks((20 + randomInt(64)) * ORIGINAL_TIMER_TICK_MS),
                            );
                            creatureLastSeenPartyPos.delete(c.id);
                        }
                        continue;
                    }
                    if (attackOutcome.kind === 'damage') {
                        vitals = attackOutcome.championVitals;
                        dmgEvts = attackOutcome.damageEvents;
                        if (
                            attackOutcome.defeatedChampionId !== null &&
                            !newlyDead.includes(attackOutcome.defeatedChampionId)
                        ) {
                            newlyDead.push(attackOutcome.defeatedChampionId);
                        }
                        playChampionWounded();
                    }
                }
            }

            // Assign side at destination: pick available side
            let destinationMapIndex = c.mapIndex;
            const movementDirection: Direction | null =
                nx > c.x ? 'EAST'
                    : nx < c.x ? 'WEST'
                        : ny > c.y ? 'SOUTH'
                            : ny < c.y ? 'NORTH'
                                : null;
            const destinationState = resolveCreatureDestinationState(
                {
                    creature: c,
                    destination: {
                        mapIndex: destinationMapIndex,
                        x: nx,
                        y: ny,
                    },
                    movementDirection,
                    openTeleporters: state.openTeleporters,
                },
                {
                    getTile: (level, x, y) => getMap(level).tiles[y]?.[x],
                    getTeleporter: getTeleporterSystem,
                    resolveCreatureTeleporterTransport: (teleporterState, level, x, y, direction, cell) =>
                        resolveCreatureTeleporterTransportSystem(
                            teleporterState,
                            level,
                            x,
                            y,
                            direction,
                            cell,
                            buildTerrainTransportDeps(),
                        ),
                    monsterWalkable: (level, y, x) => monsterWalkable(level, y, x),
                    canCreatureShareTile: (creatureState, level, x, y) =>
                        canCreatureShareTile(creatureState, level, x, y, creatures),
                },
            );
            destinationMapIndex = destinationState.mapIndex;
            nx = destinationState.x;
            ny = destinationState.y;

            // Always persist updated timers to the external Map (no re-render cost)
            creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });

            // Only update Zustand state when something visible changes (position / cell / alive)
            if (nx !== c.x || ny !== c.y || destinationMapIndex !== c.mapIndex) {
                if (creatures === state.creatures) creatures = [...creatures];
                const previousMapIndex = c.mapIndex;
                const previousX = c.x;
                const previousY = c.y;
                creatures[i] = { ...c, mapIndex: destinationMapIndex, x: nx, y: ny, cell: destinationState.cell };
                creatures = normalizeCreatureCellsOnTile(creatures, previousMapIndex, previousX, previousY);
                creatures = normalizeCreatureCellsOnTile(creatures, destinationMapIndex, nx, ny);
            }
        }

        // ── Process champion deaths ───────────────────────────────────────────
        let party                = state.party;
        let floorItems           = state.floorItems;
        let deadChampions        = state.deadChampions;

        if (newlyDead.length > 0) {
            const deathState = processMonsterTickChampionDeaths(
                {
                    level: state.level,
                    position: state.position,
                    party,
                    championInventories,
                    championEquipment,
                    floorItems,
                    deadChampions,
                },
                newlyDead,
                Date.now(),
                {
                    buildDeathDrop: (deathInput, championId, nowMs) =>
                        buildDeathDropSystem(deathInput, championId, nowMs),
                },
            );
            party = deathState.party;
            floorItems = deathState.floorItems;
            championInventories = deathState.championInventories;
            championEquipment = deathState.championEquipment;
            deadChampions = deathState.deadChampions;
        }

        return buildTickMonstersPatch({
            creatures,
            baseCreatures: state.creatures,
            projectiles,
            baseProjectiles: state.projectiles,
            championVitals: vitals,
            baseChampionVitals: state.championVitals,
            damageEvents: dmgEvts,
            baseDamageEvents: state.damageEvents,
            championInventories,
            baseChampionInventories: state.championInventories,
            championEquipment,
            baseChampionEquipment: state.championEquipment,
            lastCreatureAttackGameTick,
            baseLastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
            party,
            baseParty: state.party,
            selectedChampionIndex: state.selectedChampionIndex,
            floorItems,
            deadChampions,
        }) ?? state;
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
            const traversal = resolveProjectileTraversalStep(
                {
                    projectile: proj,
                    now,
                    currentGameTick,
                    openDoors,
                    openWalls: state.openWalls,
                    floorItems,
                    spellVisualEvents,
                    activePoisonClouds,
                },
                {
                    getTile: (level, x, y) => getMap(level).tiles[y]?.[x],
                    doorBlocksProjectile: (door, projectile) => projectile.effect === 'physical'
                        ? doorBlocksThrownPhysicalItem(door.doorType, projectile.physicalItem)
                        : doorBlocksThrownItems(door.doorType),
                    buildActivePoisonCloud,
                    getThrownExplosionVisualScale,
                    buildDroppedItem,
                    resolveProjectileTeleporterTransport: (level, x, y, direction) =>
                        resolveProjectileTeleporterTransportSystem(
                            state,
                            level,
                            x,
                            y,
                            direction,
                            buildTerrainTransportDeps(),
                        ),
                    gridSize: GRID_SIZE,
                    originalSpellProjectileAttack: ORIGINAL_SPELL_PROJECTILE_ATTACK,
                },
            );
            if (traversal.kind === 'waiting') {
                keepProjectiles.push(traversal.keepProjectile);
                continue;
            }
            openDoors = traversal.openDoors;
            floorItems = traversal.floorItems;
            spellVisualEvents = traversal.spellVisualEvents;
            activePoisonClouds = traversal.activePoisonClouds;
            if (traversal.kind === 'consumed') {
                if (traversal.shouldPlayDoorMotion && traversal.doorMotionSquare) {
                    playDoorMotion(
                        DOOR_TOGGLE_SOUND_DURATION_MS,
                        getDoorSoundVolume(
                            traversal.doorMotionSquare.level,
                            traversal.doorMotionSquare.x,
                            traversal.doorMotionSquare.y,
                        ),
                    );
                }
                continue;
            }
            const projectileLevel = traversal.level;
            const nx = traversal.x;
            const ny = traversal.y;
            const projectileDirection = traversal.direction;

            const hitsPartySquare =
                proj.launchedBy === 'creature' &&
                projectileLevel === state.level &&
                nx === partyX &&
                ny === partyY;
            if (hitsPartySquare) {
                lastCreatureAttackGameTick = state.elapsedGameTimeTicks;
                const partyHit = applyProjectilePartyHit(
                    proj,
                    projectileLevel,
                    nx,
                    ny,
                    currentGameTick,
                    now,
                    {
                        level: state.level,
                        position: state.position,
                        party,
                        championVitals,
                        championInventories,
                        championEquipment,
                        floorItems,
                        deadChampions,
                        selectedChampionIndex,
                        damageEvents: dmgEvts,
                        spellVisualEvents,
                        activePoisonClouds,
                        activeShields: state.activeShields,
                        activePotionBoosts: state.activePotionBoosts,
                        championCombat: state.championCombat,
                        lastCreatureAttackGameTick,
                    },
                    {
                        resolveProjectileImpact: (projectile) => projectile.effect === 'physical'
                            ? {
                                damage: Math.max(1, Math.round(projectile.remainingAttack ?? projectile.damage[1])),
                                attackType: 'Blunt' as IncomingAttackTypeApprox,
                                poisonAttack: 0,
                            }
                            : rollOriginalProjectileImpactAttackApprox(
                                projectile.effect,
                                Math.max(0, Math.round(projectile.remainingRange ?? 0)),
                                Math.max(0, Math.round(projectile.remainingAttack ?? 0)),
                            ),
                        resolveChampionIncomingAttack: (
                            incomingState,
                            targetChampion,
                            currentVitals,
                            rawAttack,
                            attackType,
                            currentNow,
                        ) => resolveChampionIncomingAttackApprox(
                            {
                                ...state,
                                championEquipment: incomingState.championEquipment,
                                activePotionBoosts: incomingState.activePotionBoosts,
                                activeShields: incomingState.activeShields,
                            },
                            targetChampion,
                            currentVitals,
                            rawAttack,
                            attackType as IncomingAttackTypeApprox,
                            ['head', 'torso'],
                            currentNow,
                        ),
                        buildChampionDamageEvent,
                        applyPoisonCharacter: applyPoisonCharacterApprox,
                        randomInt,
                        buildDeathDrop: buildDeathDropSystem,
                        applyPartySpellBacklashDamage,
                        applyPartyWideIncomingAttack: (
                            incomingState,
                            currentChampionVitals,
                            attack,
                            currentNow,
                        ) => applyPartyWideIncomingAttackApprox(
                            incomingState,
                            currentChampionVitals,
                            attack,
                            'Normal',
                            [],
                            currentNow,
                        ),
                        rollExplosionBurstAttack: rollOriginalExplosionBurstAttack,
                        buildActivePoisonCloud,
                        getThrownExplosionVisualScale,
                        gridSize: GRID_SIZE,
                    },
                );
                party = partyHit.party;
                championVitals = partyHit.championVitals;
                championInventories = partyHit.championInventories;
                championEquipment = partyHit.championEquipment;
                floorItems = partyHit.floorItems;
                deadChampions = partyHit.deadChampions;
                selectedChampionIndex = partyHit.selectedChampionIndex;
                dmgEvts = partyHit.damageEvents;
                spellVisualEvents = partyHit.spellVisualEvents;
                activePoisonClouds = partyHit.activePoisonClouds;
                continue;
            }

            // Creature hit → deal damage and despawn
            const hitCreatures = creatures.filter(c => c.alive && c.mapIndex === projectileLevel && c.x === nx && c.y === ny);
            const hit = hitCreatures[0];
            if (hit) {
                if (proj.effect === 'open') {
                    const continuation = resolveProjectileContinuation(
                        proj,
                        {
                            level: projectileLevel,
                            x: nx,
                            y: ny,
                            direction: projectileDirection,
                        },
                        now,
                        floorItems,
                        {
                            projectileStepMs: PROJECTILE_STEP_MS,
                            physicalProjectileStepMs: PHYSICAL_PROJECTILE_STEP_MS,
                            buildDroppedItem,
                        },
                    );
                    floorItems = continuation.floorItems;
                    if (continuation.keepProjectile) keepProjectiles.push(continuation.keepProjectile);
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
                    const creatureHit = applyProjectileCreatureHit(
                        proj,
                        hit,
                        hitCreatures,
                        Boolean(hitDef?.absorbMissiles),
                        projectileLevel,
                        nx,
                        ny,
                        currentGameTick,
                        now,
                        {
                            creatures,
                            floorItems,
                            damageEvents: dmgEvts,
                            spellVisualEvents,
                            activePoisonClouds,
                        },
                        {
                            rollSourceBackedImpact: (projectile) =>
                                sourceSpell && (projectile.effect === 'fireball' || projectile.effect === 'lightning')
                                    ? rollOriginalSpellProjectileImpact(
                                        sourceSpell,
                                        Math.max(0, Math.round(projectile.remainingRange ?? 0)),
                                        Math.max(0, Math.round(projectile.remainingAttack ?? 0)),
                                        randomInt,
                                    )
                                    : null,
                            getCreaturePoisonAdjustedAttack: getOriginalCreaturePoisonAdjustedAttack,
                            rollRandomProjectileDamage: (projectile) =>
                                projectile.damage[0] + Math.floor(Math.random() * (projectile.damage[1] - projectile.damage[0] + 1)),
                            rollExplosionBurstAttack: rollOriginalExplosionBurstAttack,
                            isLikelyNonMaterial,
                            rollDisruptNonMaterialAttack: rollOriginalDisruptNonMaterialAttack,
                            dropCreatureCarriedItems,
                            buildDeathDustEvent,
                            buildCreatureDamageEvent,
                            buildLingeringPoisonCloud: buildLingeringPoisonCloudAfterImmediatePulse,
                            buildActivePoisonCloud,
                            getThrownExplosionVisualScale,
                            buildDroppedItem,
                            gridSize: GRID_SIZE,
                        },
                    );
                    creatures = creatureHit.creatures;
                    floorItems = creatureHit.floorItems;
                    dmgEvts = creatureHit.damageEvents;
                    spellVisualEvents = creatureHit.spellVisualEvents;
                    activePoisonClouds = creatureHit.activePoisonClouds;
                    continue; // projectile consumed
                }
            }

            const continuation = resolveProjectileContinuation(
                proj,
                {
                    level: projectileLevel,
                    x: nx,
                    y: ny,
                    direction: projectileDirection,
                },
                now,
                floorItems,
                {
                    projectileStepMs: PROJECTILE_STEP_MS,
                    physicalProjectileStepMs: PHYSICAL_PROJECTILE_STEP_MS,
                    buildDroppedItem,
                },
            );
            floorItems = continuation.floorItems;
            if (continuation.keepProjectile) keepProjectiles.push(continuation.keepProjectile);
        }

        if (activePoisonClouds.length > 0) {
            const poisonCloudTick = tickPoisonClouds(
                {
                    activePoisonClouds,
                    creatures,
                    level: state.level,
                    position: state.position,
                    party,
                    championVitals,
                    championInventories,
                    championEquipment,
                    floorItems,
                    deadChampions,
                    selectedChampionIndex,
                    damageEvents: dmgEvts,
                    spellVisualEvents,
                    activeShields: state.activeShields,
                    activePotionBoosts: state.activePotionBoosts,
                    championCombat: state.championCombat,
                },
                currentGameTick,
                now,
                {
                    rollPoisonCloudPulseAttack: (remainingAttack) => rollOriginalExplosionBurstAttack('poison_cloud', remainingAttack),
                    applyPartyWideIncomingAttack: (
                        poisonState,
                        currentChampionVitals,
                        attack,
                        currentNow,
                    ) => applyPartyWideIncomingAttackApprox(
                        poisonState,
                        currentChampionVitals,
                        attack,
                        'Normal',
                        [],
                        currentNow,
                    ),
                    getCreaturePoisonAdjustedAttack: getOriginalCreaturePoisonAdjustedAttack,
                    buildCreatureDamageEvent,
                    dropCreatureCarriedItems,
                    buildDeathDustEvent,
                },
            );
            activePoisonClouds = poisonCloudTick.activePoisonClouds;
            creatures = poisonCloudTick.creatures;
            party = poisonCloudTick.party;
            championVitals = poisonCloudTick.championVitals;
            championInventories = poisonCloudTick.championInventories;
            championEquipment = poisonCloudTick.championEquipment;
            floorItems = poisonCloudTick.floorItems;
            deadChampions = poisonCloudTick.deadChampions;
            selectedChampionIndex = poisonCloudTick.selectedChampionIndex;
            dmgEvts = poisonCloudTick.damageEvents;
            spellVisualEvents = poisonCloudTick.spellVisualEvents;
        }

        return buildTickSpellsPatch(
            {
                spellLights,
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
            {
                keepProjectiles,
                creatures,
                damageEvents: dmgEvts,
                spellVisualEvents,
                floorItems,
                openDoors,
                party,
                championVitals,
                championInventories,
                championEquipment,
                deadChampions,
                selectedChampionIndex,
                activePoisonClouds,
                lastCreatureAttackGameTick,
            },
            now,
            {
                footprintLifetimeMs: FOOTPRINT_LIFETIME_MS,
                damageEventLifetimeMs: DAMAGE_EVENT_LIFETIME_MS,
            },
        ) ?? state;
    }),

    tickCombat: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        return tickCombatState({
            party: state.party,
            championCombat: state.championCombat,
            damageEvents: state.damageEvents,
            delta,
            now: Date.now(),
            damageEventLifetimeMs: DAMAGE_EVENT_LIFETIME_MS,
        }) ?? state;
    }),
});

export const useStore = create<GameState>()(storeCreator);
