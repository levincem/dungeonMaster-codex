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
import { findSpell } from '../data/runes';
import {
    getOriginalSpellRequiredSkillLevel,
} from '../data/originalSpells';
import {
    createEmptyChampionTemporaryXP,
    createEmptyChampionXP,
    getChampionSkillLevel,
    mapOriginalSkillNumberToSkillKey,
    normalizeChampionTemporaryXP,
    normalizeChampionXP,
    skillExperienceToLevel,
    type ChampionTemporaryXP,
    type ChampionXP,
    type SkillKey,
} from '../data/skillProgression';
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
    getAttackCooldownSeconds,
    getAttackOptionUnusableReason,
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
} from './systems/floorItemState';
import {
    buildDropInventoryItemRuntimePatch,
    buildPickupItemToChampionRuntimePatch,
} from './systems/floorItemCommandRuntime';
import {
    getChampionPotionBonuses,
    getChampionRuntimeBonuses,
} from './systems/championRuntimeBonuses';
import {
    buildCreatureProjectile,
    chooseOriginalCreatureProjectileEffect,
} from './systems/creatureProjectiles';
import { tryStealChampionItem } from './systems/creatureSteal';
import { getDoorObject } from './systems/doorMetadata';
import { resolvePotionConsumption } from './systems/potionConsumption';
import { resolveUseItemConsumption } from './systems/useItemConsumption';
import { buildUseItemPatch } from './systems/useItemPatch';
import {
    buildFillWaterRuntimePatch,
    buildUseItemRuntimePatch,
} from './systems/itemCommandRuntime';
import {
    buildResurrectChampionRuntimePatch,
    buildThrowCarriedItemRuntimePatch,
} from './systems/itemCarryCommandRuntime';
import {
    buildDropCarriedItemRuntimePatch,
    buildEquipItemRuntimePatch,
    buildGiveEquippedItemRuntimePatch,
    buildGiveItemRuntimePatch,
    buildUnequipItemRuntimePatch,
} from './systems/itemTransferCommandRuntime';
import { buildLoadedGameUiResetPatch, buildReturnToTitlePatch } from './systems/uiStateTransitions';
import { resolveChampionIncomingAttack } from './systems/incomingAttackState';
import { advanceSurvivalTimeState, isPartyRestedState } from './systems/survivalState';
import { ageTimedEffectsState } from './systems/timedEffectsState';
import { applyPartyLoadBasedFatigueState } from './systems/partyFatigueState';
import { isOriginalLuckSuccessful } from './systems/originalLuck';
import { computeOriginalQuickness } from './systems/originalQuickness';
import {
    adjustOriginalAttackByAttribute,
    getOriginalAttackAdjustedByResistance,
    getOriginalPsychicAdjustedAttack,
    scaleOriginalAttackValue,
} from './systems/originalAttackMath';
import {
    type OriginalProjectileIncomingAttackType,
} from './systems/originalProjectileImpact';
import {
    applyOriginalPoisonCharacter,
    healOriginalChampionWounds,
} from './systems/originalChampionConditionEffects';
import {
    applyOriginalChampionSkillExperience,
} from './systems/originalChampionLeveling';
import {
    getOriginalMonsterAttackDelaySeconds,
    getOriginalMonsterMoveDelaySeconds,
} from './systems/originalMonsterTiming';
import { resolveOriginalArchenemyDoubleMoveDestination } from './systems/originalArchenemyMovement';
import { getOriginalActiveShieldDefense, getOriginalPartyShieldKind } from './systems/originalShieldDefense';
import { computeOriginalChampionWoundDefense } from './systems/originalWoundDefense';
import { tickMovementCooldown } from './systems/timeStateTicks';
import { computePartyMovementCooldownSeconds } from './systems/partyMovementCooldownState';
import { applyImmediateTransportSquareEffects as applyImmediateTransportSquareEffectsSystem } from './systems/partyImmediateTransportEffects';
import { resolvePartyStepTransport as resolvePartyStepTransportSystem } from './systems/partyStepTransport';
import {
    applyStorePartyMoveSideEffects,
    createStorePartyMoveRuntimeDeps,
    runStorePartyMoveCommand,
} from './systems/storePartyMoveRuntime';
import { createStoreClimbDownRuntimeDeps } from './systems/climbDownRuntimeDeps';
import {
    buildAsSensor,
    createStoreSensorRuntimeDepsBundle,
} from './systems/sensorRuntimeDeps';
import { createStoreTransportRuntimeDepsBundle } from './systems/transportRuntimeDeps';
import { resolveAttackFrontContext } from './systems/attackFrontContext';
import { applyChampionAttackVitals as applyChampionAttackVitalsSystem } from './systems/attackVitals';
import { processTickFrame } from './systems/tickFrameState';
import { createStoreTickFrameRuntimeDeps } from './systems/tickFrameRuntimeDeps';
import {
    buildStoreEndgameFramePatch,
    buildStoreRegenTickPatch,
    buildStoreSleepFramePatch,
} from './systems/storeTimeRuntime';
import {
    buildStoreCastSpellRuntimeResult,
    createStoreCastSpellRuntimeDeps,
    createStoreTickSpellsRuntimePartyDamageDeps,
    createStoreTickSpellsStatefulDeps,
    createStoreTickSpellsRuntimeDeps,
    playCastSpellDoorMotionResult,
    buildStoreTickSpellsRuntimePatch,
} from './systems/storeSpellRuntime';
import {
    createStoreMonsterTickRuntimeDeps,
    createStoreMonsterTickRuntimeState,
    createStoreMonsterTickStatefulDeps,
} from './systems/storeMonsterRuntime';
import { runMonsterTickRuntime } from './systems/monsterTickRuntime';
import { resolveMonsterAttackAgainstChampion } from './systems/monsterAttackResolution';
import { buildDeathDrop as buildDeathDropSystem } from './systems/deathDrops';
import { isFacingFountain as isFacingFountainSystem } from './systems/frontWallState';
import {
    buildViAltarResurrectionPatch as buildViAltarResurrectionPatchSystem,
    createReincarnatedChampion as createReincarnatedChampionSystem,
    isAltarWallFace as isAltarWallFaceSystem,
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
import {
    buildSensorStateSnapshot as buildSensorStateSnapshotSystem,
    buildWallLauncherProjectiles as buildWallLauncherProjectilesSystem,
    computeSensorEffect as computeSensorEffectSystem,
    findSensorByIndex as findSensorByIndexSystem,
    findSensorPlacement as findSensorPlacementSystem,
    getSelfRevealingWallSensor as getSelfRevealingWallSensorSystem,
    getSensorStateKey as getSensorStateKeySystem,
    queueOrComputeSensorEffect as queueOrComputeSensorEffectSystem,
    readWallSensorRuntimeData as readWallSensorRuntimeDataSystem,
    resolveDoorSoundTarget as resolveDoorSoundTargetSystem,
    revealSelfWallMountedItems as revealSelfWallMountedItemsSystem,
    WALL_LAUNCHER_SENSOR_TYPES,
    writeWallSensorRuntimeData as writeWallSensorRuntimeDataSystem,
} from './systems/sensorRuntimeCore';
import {
    createGeneratedCreatureGroupInstances as createGeneratedCreatureGroupInstancesSystem,
    getCreatureTileCapacity as getCreatureTileCapacitySystem,
} from './systems/generatedCreatureGroups';
import {
    getTileCapacityForCreatures as getTileCapacityForCreaturesSystem,
    isCreatureCellOccupiedOnTile as isCreatureCellOccupiedOnTileSystem,
    normalizeCreatureCells as normalizeCreatureCellsSystem,
    normalizeCreatureCellsOnTile as normalizeCreatureCellsOnTileSystem,
} from './systems/creatureTileState';
import { dispatchTriggeredSensorEffect as dispatchTriggeredSensorEffectSystem } from './systems/sensorTriggeredEffects';
import {
    isGeneratorSpawnBlocked as isGeneratorSpawnBlockedSystem,
    triggerGeneratorSensor as triggerGeneratorSensorSystem,
} from './systems/sensorGeneratorRuntime';
import {
    applyStoreFrontWallInteractionResult,
    buildStoreChampionItemOnViAltarPatch,
    buildStoreFloorItemOnViAltarPatch,
    runStoreChampionItemOnFrontWall,
    runStoreFloorItemOnFrontWall,
    runStoreWallSensorActivation,
} from './systems/storeWallInteractionRuntime';
import { buildStoreAttackFrontRuntimePatch } from './systems/storeAttackFrontRuntime';
import {
    applyConsumedChampionEquipmentPatch as applyConsumedChampionEquipmentPatchRuntime,
    buildChampionDamageEvent as buildChampionDamageEventRuntime,
    buildCreatureDamageEvent as buildCreatureDamageEventRuntime,
    buildDeathDustEvent as buildDeathDustEventRuntime,
    buildRuntimeCastResult,
    buildViAltarCelebrationEvents as buildViAltarCelebrationEventsRuntime,
    decorateViAltarResurrectionPatch as decorateViAltarResurrectionPatchRuntime,
    scheduleStoreTransientMessage,
} from './systems/storeFeedbackRuntime';
import {
    buildStoreCombatTickPatch,
    buildStoreTickDoorsPatch,
    buildStoreToggleDoorPatch,
} from './systems/storeDoorRuntime';
import { createStoreFloorItemCommandDeps } from './systems/storeFloorItemRuntime';
import { createStorePartyDamageRuntimeDeps } from './systems/storePartyDamageRuntime';
import {
    processPendingGeneratorSpawns as processPendingGeneratorSpawnsSystem,
    processPendingSensorEvents as processPendingSensorEventsSystem,
    queuePendingGeneratorSpawnEvent,
} from './systems/pendingWorldEvents';
import {
    canMaterializeReservedGeneratorSpawnOnLevel,
    canReserveApproximateGeneratorGroupOnLevel,
} from './systems/generatorCapacity';
import { canCreatureShareRuntimeTile } from './systems/runtimeGroupOccupancy';
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
    return resolveDoorSoundTargetSystem(sensor, level, getMap);
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

export const VI_ALTAR_RESURRECTION_MESSAGE = 'VI accomplit un miracle de renaissance.';

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

function healChampionWoundsOriginal(vitals: ChampionVitals, iterations = 1): ChampionVitals {
    return healOriginalChampionWounds(vitals, iterations, randomInt);
}

function adjustAttackByAttributeOriginal(value: number, currentAttribute: number): number {
    return adjustOriginalAttackByAttribute(value, currentAttribute);
}

function scaleAttackValueOriginal(value: number, shift: number, factor: number): number {
    return scaleOriginalAttackValue(value, shift, factor);
}

function applyPoisonCharacterOriginal(
    vitals: ChampionVitals,
    poisonStrength: number,
): ChampionVitals {
    return applyOriginalPoisonCharacter(vitals, poisonStrength, POISON_TICK_INTERVAL_SEC);
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

function buildChampionSkillExperiencePatchOriginal(
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
    const result = applyOriginalChampionSkillExperience(
        champion,
        state.championXP[championId],
        state.championTemporaryXP[championId],
        skill,
        amount,
        {
            mapDifficulty: getMap(state.level).difficulty,
            elapsedGameTimeTicks: state.elapsedGameTimeTicks,
            lastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
        },
        randomInt,
    );
    if (!result) return null;

    let nextParty: Champion[] | undefined;
    if (result.leveledChampion) {
        nextParty = [...state.party];
        nextParty[championIndex] = result.leveledChampion;
    }

    return {
        championXP: {
            ...state.championXP,
            [championId]: result.championXP,
        },
        championTemporaryXP: {
            ...state.championTemporaryXP,
            [championId]: result.championTemporaryXP,
        },
        ...(nextParty ? { party: nextParty } : {}),
    };
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
    return buildRuntimeCastResult(message, success);
}

function getThrownPotionExplosionEffect(item: FloorItem): Exclude<ProjectileEffect, 'physical'> | undefined {
    if (item.category !== 'Potion') return undefined;
    const def = getPotionDef(item.typeId, item.rawName);
    if (def?.effect === 'firebomb') return 'fireball';
    if (def?.effect === 'poisonCloud') return 'poison_cloud';
    return undefined;
}

function rollOriginalPartyWideAttack(rawAttack: number): number {
    if (rawAttack <= 0) return 0;
    const randomAttack = (rawAttack >> 3) + 1;
    const centeredAttack = rawAttack - randomAttack;
    return Math.max(1, centeredAttack + randomInt(Math.max(1, randomAttack << 1)));
}

function getProjectileDamageClass(effect: Exclude<ProjectileEffect, 'physical'>): MonsterDamageClass {
    if (effect === 'fireball') return 'fire';
    return 'magic';
}

type IncomingAttackType = OriginalProjectileIncomingAttackType;

function getPsychicAdjustedAttackOriginal(attack: number, wisdom: number): number {
    return getOriginalPsychicAdjustedAttack(attack, wisdom);
}

function resolveChampionIncomingAttackRuntime(
    state: GameState,
    champion: Champion,
    currentVitals: ChampionVitals,
    rawAttack: number,
    attackType: IncomingAttackType,
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
            adjustByAttribute: adjustAttackByAttributeOriginal,
            getEffectiveChampionStatsWithBonuses,
            computeChampionWoundDefense: (
                _attackState,
                championId,
                incomingChampion,
                vitals,
                woundSlot,
                useSharpDefense,
            ) => computeChampionWoundDefenseOriginal(
                state,
                championId,
                incomingChampion,
                vitals,
                woundSlot,
                useSharpDefense,
            ),
            getPsychicAdjustedAttack: getPsychicAdjustedAttackOriginal,
            getChampionAdjustedAttackFromResistance: getChampionAdjustedAttackFromResistanceOriginal,
            getActiveShieldDefense: getActiveShieldDefenseOriginal,
            scaleOriginalAttack: scaleAttackValueOriginal,
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
    const maxLoadThreshold = getChampionMaxLoad(champion, equip, currentStamina, undefined, extraBonuses) / 16;

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

function isCharacterLuckyOriginal(luck: number, luckNeeded: number): boolean {
    return isOriginalLuckSuccessful(luck, luckNeeded, randomInt);
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

function computeOriginalQuicknessRuntime(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    inventory: FloorItem[] | undefined,
    currentStamina: number | undefined,
    wounds: ChampionWounds | undefined,
    extraBonuses: Partial<EquipmentStatBonuses> | undefined,
    isPartySleeping: boolean,
): number {
    return computeOriginalQuickness(
        champion,
        equip,
        inventory,
        currentStamina,
        wounds,
        extraBonuses,
        isPartySleeping,
        randomInt,
        {
            getEffectiveChampionStatsWithBonuses,
            getTotalWeight,
            getChampionMaxLoad,
        },
    );
}

function isLikelyNonMaterial(target: CreatureInstance): boolean {
    const def = CREATURE_TYPES[target.typeId];
    if (def) return def.nonMaterial;
    const name = CREATURE_TYPES[target.typeId]?.name ?? '';
    return /ghost|materializer|wizard eye|black flame|lord chaos/i.test(name);
}

function getMonsterMoveDelaySecondsOriginal(moveTicks: number): number {
    return getOriginalMonsterMoveDelaySeconds(moveTicks, randomInt);
}

function getMonsterAttackDelaySecondsOriginal(attackTicks: number): number {
    return getOriginalMonsterAttackDelaySeconds(attackTicks, randomInt);
}

type MonsterDamageClass = 'physical' | 'fire' | 'magic' | 'mental';
type ArmorCoverageZone = 'head' | 'torso' | 'legs' | 'feet' | 'hands';

function computeChampionWoundDefenseOriginal(
    state: GameState,
    championId: number,
    champion: Champion,
    currentVitals: ChampionVitals | undefined,
    woundSlot: ChampionWoundSlot,
    useSharpDefense: boolean,
): number {
    const equip = state.championEquipment[championId] ?? {};
    return computeOriginalChampionWoundDefense(
        {
            champion,
            equip,
            currentVitals,
            woundSlot,
            useSharpDefense,
            defenseModifier: state.championCombat[championId]?.defenseModifier ?? 0,
            runtimeBonuses: getChampionRuntimeBonuses(champion, currentVitals, state.activePotionBoosts),
            woundDefenseFactors: I562_WOUND_DEFENSE_FACTORS,
        },
        randomInt,
        {
            getArmorDef,
            getEffectiveChampionStatsWithBonuses,
            getChampionMaxLoad,
        },
    );
}

function getChampionAdjustedAttackFromResistanceOriginal(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    attack: number,
    damageClass: MonsterDamageClass,
    extraBonuses?: Partial<EquipmentStatBonuses>,
): number {
    const effective = getEffectiveChampionStatsWithBonuses(champion, equip ?? {}, extraBonuses);
    return getOriginalAttackAdjustedByResistance(attack, damageClass, {
        antiFire: effective.antiFire,
        antiMagic: effective.antiMagic,
        wisdom: effective.wisdom,
    });
}

function getActiveShieldDefenseOriginal(
    shields: PartyShield[],
    nowMs: number,
    shieldKind: 'physical' | 'magic' | 'fire',
    championId?: number,
): number {
    return getOriginalActiveShieldDefense(shields, nowMs, shieldKind, championId);
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
    return getCreatureTileCapacitySystem(getCreatureSizeOnTile(typeId));
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
    return getTileCapacityForCreaturesSystem(creatures, getCreatureTileCapacity);
}

function normalizeCreatureCellsOnTile(
    creatures: CreatureInstance[],
    level: number,
    x: number,
    y: number,
): CreatureInstance[] {
    return normalizeCreatureCellsOnTileSystem(creatures, level, x, y, getCreatureTileCapacity);
}

function normalizeCreatureCells(creatures: CreatureInstance[]): CreatureInstance[] {
    return normalizeCreatureCellsSystem(creatures, getCreatureTileCapacity);
}

function canCreatureShareTile(
    mover: CreatureInstance,
    level: number,
    x: number,
    y: number,
    creatures: CreatureInstance[],
): boolean {
    return canCreatureShareRuntimeTile(
        mover,
        level,
        x,
        y,
        creatures,
        (occupants) => getTileCapacityForCreatures([...occupants]),
    );
}

function isCreatureCellOccupiedOnTile(
    creatures: CreatureInstance[],
    mover: CreatureInstance,
    targetCell: CreatureCell,
): boolean {
    return isCreatureCellOccupiedOnTileSystem(creatures, mover, targetCell);
}

function resolveArchenemyDoubleMoveDestinationOriginal(
    mover: CreatureInstance,
    level: number,
    x: number,
    y: number,
    direction: Direction,
    creatures: CreatureInstance[],
    monsterWalkable: (level: number, y: number, x: number) => boolean,
): { x: number; y: number } | null {
    return resolveOriginalArchenemyDoubleMoveDestination(
        mover,
        level,
        x,
        y,
        direction,
        creatures,
        monsterWalkable,
        canCreatureShareTile,
    );
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

const ORIGINAL_MOVE_GROUP_RETRY_SECONDS = originalTimerTicksToSeconds(5);

function canApproximateOriginalReservedGeneratorSpawn(ss: SensorState, level: number): boolean {
    return canMaterializeReservedGeneratorSpawnOnLevel(
        level,
        ss.creatures,
        ss.pendingGeneratorSpawns,
    );
}

function isGeneratorSpawnBlocked(ss: SensorState, level: number, x: number, y: number): boolean {
    return isGeneratorSpawnBlockedSystem(ss, level, x, y);
}

function triggerGeneratorSensor(
    level: number,
    sensor: SensorObject,
    ss: SensorState,
): SensorState {
    return triggerGeneratorSensorSystem(level, sensor, ss, {
        getGeneratorConfig: getOriginalGeneratorConfig,
        getSpawnTile: (spawnLevel, spawnX, spawnY) => getMap(spawnLevel).tiles[spawnY]?.[spawnX],
        getSensorStateKey,
        randomInt,
        canReserveGeneratorGroup: (state, spawnLevel) => canReserveApproximateGeneratorGroupOnLevel(
            spawnLevel,
            state.creatures,
            state.pendingGeneratorSpawns,
        ),
        queuePendingGeneratorSpawnEvent,
        retrySeconds: ORIGINAL_MOVE_GROUP_RETRY_SECONDS,
        createGeneratedCreatureGroupInstances,
    });
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
    return createGeneratedCreatureGroupInstancesSystem(
        level,
        x,
        y,
        typeId,
        hpMultiplier,
        creatureCount,
        groupId,
        {
            getCreatureDefinition: (spawnTypeId) => CREATURE_TYPES[spawnTypeId],
            getEffectiveHealthMultiplier: getOriginalGeneratorEffectiveHealthMultiplier,
            randomInt,
            createCreatureId: (spawnLevel, spawnX, spawnY, spawnTypeId, ordinal) =>
                `gen_${spawnLevel}_${spawnX}_${spawnY}_${spawnTypeId}_${Date.now()}_${ordinal}_${Math.random().toString(36).slice(2)}`,
            registerCreatureTimers: (id, timers) => {
                creatureTimers.set(id, timers);
            },
            createCreature: ({ id, groupId: nextGroupId, typeId: nextTypeId, mapIndex, currentHP, cell }) => ({
                id,
                groupId: nextGroupId,
                typeId: nextTypeId,
                mapIndex,
                x,
                y,
                currentHP,
                alive: true,
                cell,
                carriedItems: [],
            }),
        },
    );
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
    return getSelfRevealingWallSensorSystem(tile, isWallRevealableObject);
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

function dispatchTriggeredSensorEffect(
    sensor: SensorObject,
    level: number,
    ss: SensorState,
    options?: { actionOverride?: SensorAction; updateSourceActive?: boolean },
): Partial<SensorState> {
    return dispatchTriggeredSensorEffectSystem(sensor, level, ss, {
        getTile: (mapIndex, x, y) => getMap(mapIndex).tiles[y]?.[x],
        applyToSet,
        diffSensorState,
        getSensorStateKey,
        wallLauncherSensorTypes: WALL_LAUNCHER_SENSOR_TYPES,
        findSensorPlacement,
        buildWallLauncherProjectiles,
        now: Date.now,
        triggerGeneratorSensor,
        isGeneratorSensor,
        readWallSensorRuntimeData,
        writeWallSensorRuntimeData,
        hasWallFaceLocalRotationEffect,
        rotateWallFaceSensors,
        wallSensorFaceMask: WALL_SENSOR_FACE_MASK,
    }, options);
}

function computeSensorEffect(sensor: SensorObject, level: number, ss: SensorState): Partial<SensorState> {
    return computeSensorEffectSystem(sensor, level, ss, {
        getTile: (mapIndex, x, y) => getMap(mapIndex).tiles[y]?.[x],
        dispatchTriggeredSensorEffect,
    });
}

function findSensorByIndex(level: number, sensorIndex: number): SensorObject | null {
    return findSensorByIndexSystem(level, sensorIndex, getMap);
}

function getSensorStateKey(level: number, sensorIndex: number): string {
    return getSensorStateKeySystem(level, sensorIndex);
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
    return buildSensorStateSnapshotSystem(source) as SensorState;
}

function readWallSensorRuntimeData(level: number, sensor: SensorObject, ss: SensorState): number {
    return readWallSensorRuntimeDataSystem(level, sensor, ss.sensorRuntimeData);
}

function writeWallSensorRuntimeData(
    level: number,
    sensor: SensorObject,
    ss: SensorState,
    nextValue: number,
): Record<string, number> {
    return writeWallSensorRuntimeDataSystem(level, sensor, ss.sensorRuntimeData, nextValue);
}

function playDoorMotionForTarget(target: { level: number; x: number; y: number } | null) {
    playDoorMotion(
        DOOR_TOGGLE_SOUND_DURATION_MS,
        target ? getDoorSoundVolume(target.level, target.x, target.y) : DOOR_SOUND_MIN_VOLUME,
    );
}

function buildWallLauncherProjectiles(
    level: number,
    wallX: number,
    wallY: number,
    sensor: SensorObject,
    now: number,
): Projectile[] {
    return buildWallLauncherProjectilesSystem(
        level,
        wallX,
        wallY,
        sensor,
        now,
        getMap,
        (weaponTypeId) => ({
            rawName: resolveItemName('Weapon', weaponTypeId),
            baseDamage: Math.max(1, WEAPON_TYPES[weaponTypeId]?.damage?.[1] ?? 1),
        }),
    ) as Projectile[];
}

function findSensorPlacement(
    level: number,
    sensorIndex: number,
): { x: number; y: number; tile: GameTile; sensor: SensorObject } | null {
    return findSensorPlacementSystem(level, sensorIndex, getMap);
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
    return queueOrComputeSensorEffectSystem(sensor, level, ss, pendingSensorEvents, {
        computeSensorEffect,
        originalTimerTicksToSeconds,
        getFiredSensors: (state) => state.firedSensors,
        setFiredSensors: (_state, firedSensors) => ({ firedSensors }),
        getSensorStateKey,
    });
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
    return revealSelfWallMountedItemsSystem(floorItems, level, x, y, face);
}

function buildCreatureDamageEvent(level: number, x: number, y: number, amount: number, creatureId?: string): DamageEvent {
    return buildCreatureDamageEventRuntime(level, x, y, amount, creatureId);
}

function buildChampionDamageEvent(level: number, championId: number, amount: number): DamageEvent {
    return buildChampionDamageEventRuntime(level, championId, amount);
}

function buildDeathDustEvent(level: number, x: number, y: number): SpellVisualEvent {
    return buildDeathDustEventRuntime(level, x, y);
}

function buildViAltarCelebrationEvents(
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
): SpellVisualEvent[] {
    return buildViAltarCelebrationEventsRuntime(level, x, y, face, GRID_SIZE);
}

function decorateViAltarResurrectionPatch(
    state: Pick<GameState, 'level' | 'spellVisualEvents' | 'championEquipment'>,
    basePatch: Partial<GameState> | null,
    wallX: number,
    wallY: number,
    wallFace: CardinalDir,
    carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
): Partial<GameState> | null {
    return decorateViAltarResurrectionPatchRuntime<
        SpellVisualEvent,
        ChampionEquipment,
        CastResult,
        Pick<GameState, 'level' | 'spellVisualEvents' | 'championEquipment'>,
        Partial<GameState>
    >(
        state,
        basePatch,
        wallX,
        wallY,
        wallFace,
        carriedBy,
        {
            applyConsumedChampionEquipmentPatch: applyConsumedChampionEquipmentPatchRuntime,
            buildCelebrationEvents: buildViAltarCelebrationEvents,
            buildMessageResult: buildAttackResultMessage,
            miracleMessage: VI_ALTAR_RESURRECTION_MESSAGE,
        },
    );
}

const {
    buildMovementSensorDeps,
    buildPendingWorldEventDeps,
    buildWallSensorActivationDeps,
    buildWallPushSensorDeps,
    buildWallItemSensorDeps,
    buildFrontWallInteractionDeps,
} = createStoreSensorRuntimeDepsBundle<GameState, SensorState, PendingSensorEvent, Partial<GameState>>({
    getTile: (level: number, x: number, y: number) => getMap(level).tiles[y]?.[x],
    asSensor: buildAsSensor,
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
    findSensorByIndex,
    getWallFaceSensorsInRuntimeOrder,
    wallLauncherSensorTypes: WALL_LAUNCHER_SENSOR_TYPES,
    applyToSet,
    getSelfRevealingWallSensor,
    shouldRotateWallFaceAfterActivation,
    rotateWallFaceSensors,
    revealSelfWallMountedItems,
    applyImmediateTransportSquareEffects,
    resolvePushFace: (direction: string): CardinalDir => PUSH_FACE[direction] as CardinalDir,
    isWallLockSensor,
    isWallAlcoveSensor,
    isWallObjectExchangerSensor,
    isWallSensorConsumedAtRuntime,
    itemMatchesMechanismRequirement,
    itemToLockData,
    isConsumableLockSensor,
    buildSensorStateSnapshot,
    isAltarWallFace: (level: number, x: number, y: number, face: CardinalDir) =>
        isAltarWallFaceSystem(level, x, y, face, (mapLevel, tileX, tileY) => getMap(mapLevel).tiles[tileY]?.[tileX]),
    buildViAltarResurrectionPatch: (state, deadChampionId, itemId, carriedBy) =>
        applyConsumedChampionEquipmentPatchRuntime<ChampionEquipment, GameState, Partial<GameState>>(
            state,
            buildViAltarResurrectionPatchSystem(
                state,
                deadChampionId,
                itemId,
                carriedBy?.championId ?? null,
                {
                    createChampionVitals,
                    maxFood: MAX_FOOD,
                    maxWater: MAX_WATER,
                },
            ),
            carriedBy,
        ),
    triggerLockSensors: triggerLockSensorsSystem,
    triggerAnyObjectWallSensor: triggerAnyObjectWallSensorSystem,
    triggerAlcoveDepositSensor: triggerAlcoveDepositSensorSystem,
    triggerObjectExchangerSensor: triggerObjectExchangerSensorSystem,
    applyFirestaffExchangerReward: applyFirestaffExchangerRewardSystem,
    buildAttackResultMessage,
});

const {
    buildTerrainTransportDeps,
    buildOpenedTeleporterEffectsDeps,
    buildOpenedPitEffectsDeps,
    buildPitEntryTransportDeps,
    buildTeleporterStepTransportDeps,
    buildStairStepTransportDeps,
    buildStandardStepTransportDeps,
} = createStoreTransportRuntimeDepsBundle<GameState, SensorState, PendingSensorEvent>({
    getTile: (level: number, x: number, y: number) => getMap(level).tiles[y]?.[x],
    isWalkable,
    getOriginalTeleporterRuntime,
    getTeleporter: getTeleporterSystem,
    resolvePitLanding: resolvePitLandingSystem,
    resolveProjectileTeleporterTransport: resolveProjectileTeleporterTransportSystem,
    resolveCreatureTeleporterTransport: resolveCreatureTeleporterTransportSystem,
    applyPartyTelefragAtSquare: applyPartyTelefragAtSquareSystem,
    applyCreaturesStandingOnOpenPit: applyCreaturesStandingOnOpenPitSystem,
    applyCreaturesStandingOnOpenTeleporter: applyCreaturesStandingOnOpenTeleporterSystem,
    dropCreatureCarriedItems,
    buildDeathDustEvent,
    buildCreatureDamageEvent,
    normalizeCreatureCellsOnTile,
    canCreatureShareTile,
    buildSensorStateSnapshot,
    triggerFloorSensors: triggerFloorSensorsSystem,
    transitionFloorSensors: transitionFloorSensorsSystem,
    buildMovementSensorDeps,
    applyPartyFallImpactDamage: buildRuntimePartyDamageDeps().applyPartyFallImpactDamage,
    applyImmediateTransportSquareEffects,
    computeMovementCooldown: computePartyMovementCooldownSecondsRuntime,
    playTeleport,
});

const buildClimbDownActionDeps = () => createStoreClimbDownRuntimeDeps<GameState, SensorState, PendingSensorEvent>({
    getFrontPosition,
    getTile: (level: number, x: number, y: number) => getMap(level).tiles[y]?.[x],
    resolvePitLanding: resolvePitLandingSystem,
    isWalkable,
    applyPartyLoadBasedFatigue,
    buildSensorStateSnapshot,
    triggerFloorSensors: triggerFloorSensorsSystem,
    buildMovementSensorDeps,
    computeMovementCooldown: computePartyMovementCooldownSecondsRuntime,
});

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
    useItemOnViAltar: (
        championId: number,
        itemId: string,
        fromSlot: EquipSlotKey | 'inventory',
        altarX: number,
        altarY: number,
        altarFace: CardinalDir,
    ) => boolean;
    useFloorItemOnViAltar: (
        itemId: string,
        championId: number,
        altarX: number,
        altarY: number,
        altarFace: CardinalDir,
    ) => boolean;
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

function advanceSurvivalTimeRuntime(
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

function isPartyRestedRuntime(state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'activePotionBoosts'>): boolean {
    return isPartyRestedState(state, { getEffectiveChampionStatsRuntime });
}

function buildCombatTickPatch(state: GameState, delta: number, now: number): Partial<GameState> | null {
    return buildStoreCombatTickPatch(state, delta, now, DAMAGE_EVENT_LIFETIME_MS);
}

function computePartyMovementCooldownSecondsRuntime(
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

function buildRuntimePartyDamageDeps() {
    return createStorePartyDamageRuntimeDeps({
        buildChampionDamageEvent,
        buildDeathDrop: buildDeathDropSystem,
        randomInt,
        rollOriginalPartyWideAttack,
        resolveChampionIncomingAttack: (
            attackState,
            champion,
            currentVitals,
            attack,
            attackType,
            allowedSlots,
            attackNowMs,
        ) => resolveChampionIncomingAttackRuntime(
            attackState as GameState,
            champion,
            currentVitals,
            attack,
            attackType as IncomingAttackType,
            allowedSlots as readonly ChampionWoundSlot[],
            attackNowMs,
        ),
        getProjectileDamageClass,
        getChampionAdjustedAttackFromResistance: getChampionAdjustedAttackFromResistanceOriginal,
        getChampionRuntimeBonuses,
        getActiveShieldDefense: getActiveShieldDefenseOriginal,
    });
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

function buildStorePartyMoveDeps(enableFrontWallBumpDamage: boolean) {
    return createStorePartyMoveRuntimeDeps({
        applyPartyMoveFatigue,
        getTile: (level: number, x: number, y: number) => getMap(level).tiles[y]?.[x],
        isWalkable,
        buildSensorStateSnapshot,
        buildWallPushSensorDeps,
        triggerWallPushSensorsSystem: (level, x, y, direction, sensorState, pendingSensorEvents, deps) =>
            triggerWallPushSensorsSystem(
                level,
                x,
                y,
                direction,
                sensorState as SensorState,
                pendingSensorEvents as PendingSensorEvent[],
                deps,
            ),
        buildPartyDamageState: (damageState: GameState) => damageState,
        applyFrontRowWallBumpDamageState: enableFrontWallBumpDamage
            ? (damageState, championVitals, currentNow) =>
                buildRuntimePartyDamageDeps().applyFrontRowWallBumpDamage(
                    damageState,
                    championVitals,
                    currentNow,
                )
            : () => null,
        enableFrontWallBumpDamage,
        applyImmediateTransportSquareEffects,
        resolvePartyStepTransport,
    });
}

function applyStorePartyMoveResultSideEffects(
    result: ReturnType<typeof runStorePartyMoveCommand<GameState>> | null,
    showTransientMessage: (message: string) => void,
) {
    if (!result) return;
    applyStorePartyMoveSideEffects(result, {
        playWallBump,
        showTransientMessage,
    });
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
    return applyImmediateTransportSquareEffectsSystem(
        state,
        basePatch,
        {
            applyOpenedPitEffects: (transportState, openedPitKeys) =>
                applyOpenedPitEffectsSystem(
                    transportState,
                    openedPitKeys,
                    buildOpenedPitEffectsDeps(),
                ),
            applyOpenedTeleporterEffects: (transportState, openedTeleporterKeys) =>
                applyOpenedTeleporterEffectsSystem(
                    transportState,
                    openedTeleporterKeys,
                    buildOpenedTeleporterEffectsDeps(),
                ),
        },
    );
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
    return resolvePartyStepTransportSystem(
        state,
        ny,
        nx,
        movedVitals,
        {
            getTile: (level, x, y) => getMap(level).tiles[y]?.[x],
            isWalkable,
            resolveOpenPitEntryTransport: (stepState, x, y, stepY, stepX, stepVitals) =>
                resolveOpenPitEntryTransportSystem(
                    stepState,
                    x,
                    y,
                    stepY,
                    stepX,
                    stepVitals,
                    buildPitEntryTransportDeps(),
                ),
            findStairLink: (level, y, x) =>
                STAIR_CONNECTIONS.find(
                    (stair) => stair.fromLevel === level && stair.fromY === y && stair.fromX === x,
                ),
            resolveStairStepTransport: (stepState, link, movedChampionVitalsPatch) =>
                resolveStairStepTransportSystem(
                    stepState,
                    link,
                    movedChampionVitalsPatch,
                    buildStairStepTransportDeps(),
                ),
            resolveTeleporterStepTransport: (stepState, stepY, stepX, stepVitals) =>
                resolveTeleporterStepTransportSystem(
                    stepState,
                    stepY,
                    stepX,
                    stepVitals,
                    buildTeleporterStepTransportDeps(),
                ),
            resolveStandardStepTransport: (stepState, x, y, stepX, stepY, stepVitals) =>
                resolveStandardStepTransportSystem(
                    stepState,
                    x,
                    y,
                    stepX,
                    stepY,
                    stepVitals,
                    buildStandardStepTransportDeps(),
                ),
        },
    );
}

function buildAttackFrontRuntimePatch(
    state: GameState,
    championId: number,
    attackType: number | undefined,
): Partial<GameState> | null {
    return buildStoreAttackFrontRuntimePatch(
        state,
        championId,
        attackType,
        {
            getWeaponAttackOptions: (item) => getWeaponAttackOptions(item ?? undefined),
            getRequiredAmmoRawClass,
            getAttackCooldownSeconds,
            isAttackOptionUsableAtMastery,
            getAttackUnusableReason: getAttackOptionUnusableReason,
            isPhysicalAttack,
            isShootAttack,
            isThrowAttack,
            getChampionMasteryLevel,
            findCompatibleAmmo: findQuiverAmmo,
            getRightHandStats,
            createChampionCombatState,
            applyChampionAttackVitals: (champion, equip, activePotionBoosts, currentVitals, selectedAttack) =>
                applyChampionAttackVitalsSystem(
                    champion,
                    equip,
                    activePotionBoosts,
                    currentVitals,
                    selectedAttack,
                    {
                        getEffectiveChampionStatsRuntime,
                        randomInt,
                        clampVital,
                    },
                ),
            getActionCharges,
            updateEquippedItemCharges,
            buildAttackResultMessage,
            originalThrowingDistance,
            getThrownPotionExplosionEffect,
            buildDroppedItem,
            getWeaponName,
            buildChampionSkillExperiencePatch: buildChampionSkillExperiencePatchOriginal,
            getChampionRuntimeBonuses,
            resolveAttackFrontContext,
            resolveClimbDown: (climbDownState, climbDownBase) => resolveClimbDownActionSystem(
                climbDownState,
                climbDownBase,
                buildClimbDownActionDeps(),
            ),
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
            getFluxcageExpiresAt: (creatureId) => creatureFluxcageUntil.get(creatureId) ?? 0,
            getTargetTimers: (creatureId) => creatureTimers.get(creatureId),
            getMapDifficulty: (level) => getMap(level).difficulty,
            getMapTile: (level, x, y) => getMap(level).tiles[y]?.[x],
            getFrontPosition,
            getEffectiveChampionStatsRuntime,
            randomInt,
            isCharacterLuckyOriginal,
            computeOriginalQuicknessRuntime,
            isLikelyNonMaterial,
            getCreatureDef: (typeId) => CREATURE_TYPES[typeId],
            onPartyAttack: playPartyAttack,
        },
    );
}

const floorItemCommandDeps = createStoreFloorItemCommandDeps<
    CastResult,
    Partial<GameState>,
    GameState,
    SensorState,
    PendingSensorEvent
>({
    getTile: (mapIndex, y, x) => getMap(mapIndex).tiles[y]?.[x],
    buildPickupPatch: buildFloorItemPickupPatch,
    clearAlcoveStateOnPickup: (item, pickupState) =>
        clearAlcoveStateOnPickupSystem(item, pickupState, buildWallItemSensorDeps()),
    buildHiddenFirestaffMessage: () =>
        buildAttackResultMessage("Le Firestaff complet ne peut etre obtenu que via l'Amalgam."),
    isAltarTile: (level, x, y) =>
        isAltarTileSystem(level, x, y, (mapLevel, tileX, tileY) => getMap(mapLevel).tiles[tileY]?.[tileX]),
    buildViAltarResurrectionPatch: (state, deadChampionId, itemId, championId) =>
        buildViAltarResurrectionPatchSystem(state, deadChampionId, itemId, championId, {
            createChampionVitals,
            maxFood: MAX_FOOD,
            maxWater: MAX_WATER,
        }),
    buildSensorStateSnapshot,
    triggerFloorSensors: (
        level,
        x,
        y,
        sensorState,
        inventories,
        equipment,
        floorItems,
        pendingSensorEvents,
    ) => triggerFloorSensorsSystem(
        level,
        x,
        y,
        sensorState,
        inventories,
        equipment,
        floorItems,
        pendingSensorEvents,
        buildMovementSensorDeps(),
        'enter',
    ),
    applyImmediateTransportSquareEffects: (state, patch) =>
        applyImmediateTransportSquareEffects(state, patch),
});

// ─── Store ────────────────────────────────────────────────────────────────────

const storeCreator: StateCreator<GameState> = (set, get) => ({
    ...buildFreshDungeonState(DEFAULT_GAME_OPTIONS, 'title'),

    moveForward: () => {
        const now = Date.now();
        let moveResult: ReturnType<typeof runStorePartyMoveCommand<GameState>> | null = null;
        set((state) => {
            moveResult = runStorePartyMoveCommand(
                state,
                'forward',
                now,
                buildStorePartyMoveDeps(true),
            );
            return moveResult.patch;
        });
        applyStorePartyMoveResultSideEffects(moveResult, (message) => get().showTransientMessage(message));
    },

    moveBackward: () => {
        const now = Date.now();
        let moveResult: ReturnType<typeof runStorePartyMoveCommand<GameState>> | null = null;
        set((state) => {
            moveResult = runStorePartyMoveCommand(
                state,
                'backward',
                now,
                buildStorePartyMoveDeps(false),
            );
            return moveResult.patch;
        });
        applyStorePartyMoveResultSideEffects(moveResult, (message) => get().showTransientMessage(message));
    },

    strafeLeft: () => {
        const now = Date.now();
        let moveResult: ReturnType<typeof runStorePartyMoveCommand<GameState>> | null = null;
        set((state) => {
            moveResult = runStorePartyMoveCommand(
                state,
                'strafeLeft',
                now,
                buildStorePartyMoveDeps(false),
            );
            return moveResult.patch;
        });
        applyStorePartyMoveResultSideEffects(moveResult, (message) => get().showTransientMessage(message));
    },

    strafeRight: () => {
        const now = Date.now();
        let moveResult: ReturnType<typeof runStorePartyMoveCommand<GameState>> | null = null;
        set((state) => {
            moveResult = runStorePartyMoveCommand(
                state,
                'strafeRight',
                now,
                buildStorePartyMoveDeps(false),
            );
            return moveResult.patch;
        });
        applyStorePartyMoveResultSideEffects(moveResult, (message) => get().showTransientMessage(message));
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
        scheduleStoreTransientMessage<GameState>(message, success, durationMs, {
            buildResult: (nextMessage, nextSuccess) => buildAttackResultMessage(nextMessage, nextSuccess),
            applyPatch: (patch) => set(patch),
            getCurrentResult: () => useStore.getState().lastCastResult,
            clearMessage: () => useStore.setState({ lastCastResult: null }),
            readTimestamp: (value) => (value && typeof value === 'object' && 'ts' in value && typeof value.ts === 'number')
                ? value.ts
                : null,
        });
    },

      goToLevel: (level, pos, dir) => set({ level, position: pos, direction: dir }),

    toggleDoor: (x, y) => set((state) =>
        buildStoreToggleDoorPatch(state, x, y, {
            hasDoorButton,
            isDoorControlledByMechanism,
            isDoorLockedByWallSensor,
            playDoorMotion,
            getDoorSoundVolume,
            doorToggleSoundDurationMs: DOOR_TOGGLE_SOUND_DURATION_MS,
            doorCloseDurationSeconds: DOOR_CLOSE_DURATION_SECONDS,
        })
    ),

    activateWallSensor: (mapIndex, x, y, sensorIndex) => set((state) =>
        runStoreWallSensorActivation<GameState, SensorState, PendingSensorEvent, Partial<GameState>>(
            state,
            mapIndex,
            x,
            y,
            sensorIndex,
            buildWallSensorActivationDeps,
        )
    ),

    useItemOnFrontWall: (championId, itemId, fromSlot) => {
        const state = get();
        return applyStoreFrontWallInteractionResult(
            runStoreChampionItemOnFrontWall<GameState, SensorState, Partial<GameState>>(
                state,
                championId,
                itemId,
                fromSlot,
                buildFrontWallInteractionDeps,
            ),
            {
                applyPatch: (patch) => set(patch),
                playPlate,
            },
        );
    },

    useFloorItemOnFrontWall: (itemId, championId) => {
        const state = get();
        return applyStoreFrontWallInteractionResult(
            runStoreFloorItemOnFrontWall<GameState, SensorState, Partial<GameState>>(
                state,
                itemId,
                championId,
                buildFrontWallInteractionDeps,
            ),
            {
                applyPatch: (patch) => set(patch),
                playPlate,
            },
        );
    },

    useItemOnViAltar: (championId, itemId, fromSlot, altarX, altarY, altarFace) => {
        const state = get();
        const patch = buildStoreChampionItemOnViAltarPatch(
            state,
            championId,
            itemId,
            fromSlot,
            altarX,
            altarY,
            altarFace,
            {
                getTile: (level, x, y) => getMap(level).tiles[y]?.[x],
                isAltarWallFaceSystem,
                buildBaseResurrectionPatch: (currentState, deadChampionId, consumedItemId, carriedChampionId) =>
                    buildViAltarResurrectionPatchSystem(currentState, deadChampionId, consumedItemId, carriedChampionId, {
                        createChampionVitals,
                        maxFood: MAX_FOOD,
                        maxWater: MAX_WATER,
                    }),
                decorateResurrectionPatch: decorateViAltarResurrectionPatch,
            },
        );
        if (!patch) return false;
        set(patch);
        return true;
    },

    useFloorItemOnViAltar: (itemId, _championId, altarX, altarY, altarFace) => {
        const state = get();
        const patch = buildStoreFloorItemOnViAltarPatch(
            state,
            itemId,
            altarX,
            altarY,
            altarFace,
            {
                getTile: (level, x, y) => getMap(level).tiles[y]?.[x],
                isAltarWallFaceSystem,
                buildBaseResurrectionPatch: (currentState, deadChampionId, consumedItemId, carriedChampionId) =>
                    buildViAltarResurrectionPatchSystem(currentState, deadChampionId, consumedItemId, carriedChampionId, {
                        createChampionVitals,
                        maxFood: MAX_FOOD,
                        maxWater: MAX_WATER,
                    }),
                decorateResurrectionPatch: decorateViAltarResurrectionPatch,
            },
        );
        if (!patch) return false;
        set(patch);
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
        const patch = buildPickupItemToChampionRuntimePatch(
            state,
            id,
            activeChampion.id,
            floorItemCommandDeps,
        );
        return patch ? { ...state, ...patch } : state;
    }),

    pickupItemToChampion: (id, championId) => {
        const state = get();
        const patch = buildPickupItemToChampionRuntimePatch(state, id, championId, floorItemCommandDeps);
        if (!patch) return false;
        set(patch);
        return true;
    },

    dropItem: (itemId, championId) => set((state) => {
        return buildDropInventoryItemRuntimePatch(state, championId, itemId, floorItemCommandDeps) ?? state;
    }),

    dropCarriedItem: (championId, itemId, fromSlot) => {
        const state = get();
        const patch = buildDropCarriedItemRuntimePatch(state, championId, itemId, fromSlot, {
            dropChampionCarriedItem,
        });
        if (!patch) return false;
        set(patch);
        return true;
    },

    throwCarriedItem: (championId, itemId, fromSlot) => {
        const state = get();
        const patch = buildThrowCarriedItemRuntimePatch(
            state,
            championId,
            itemId,
            fromSlot,
            {
                buildProjectile: buildDragThrowProjectile,
                buildThrowXpPatch: (currentState, targetChampionId) =>
                    buildChampionSkillExperiencePatchOriginal(currentState, targetChampionId, 'throw', 5),
                throwChampionCarriedItem,
            },
        );
        if (!patch) return false;
        set(patch);
        return true;
    },

    equipItem: (championId, slotKey, itemId) => set((state) =>
        buildEquipItemRuntimePatch(state, championId, slotKey, itemId, {
            canEquipItemInSlot,
            equipChampionInventoryItem,
        }) ?? state,
    ),

    unequipItem: (championId, slotKey) => set((state) =>
        buildUnequipItemRuntimePatch(state, championId, slotKey, {
            unequipChampionItem,
        }) ?? state,
    ),

    giveItem: (fromChampionId, toChampionId, itemId) => set((state) =>
        buildGiveItemRuntimePatch(state, fromChampionId, toChampionId, itemId, {
            giveChampionInventoryItem,
        }) ?? state,
    ),

    giveEquippedItem: (fromChampionId, slotKey, toChampionId) => set((state) =>
        buildGiveEquippedItemRuntimePatch(state, fromChampionId, slotKey, toChampionId, {
            giveChampionEquippedItem,
        }) ?? state,
    ),

    resurrectChampion: (bonesItemId) => set((state) => {
        return buildResurrectChampionRuntimePatch(
            state,
            bonesItemId,
            {
                maxPartySize: MAX_PARTY,
                isAltarTile: (level, x, y) =>
                    isAltarTileSystem(level, x, y, (mapLevel, tileX, tileY) => getMap(mapLevel).tiles[tileY]?.[tileX]),
                buildViAltarResurrectionPatch: (currentState, deadChampionId, targetBonesItemId, carriedBy) =>
                    buildViAltarResurrectionPatchSystem(currentState, deadChampionId, targetBonesItemId, carriedBy, {
                        createChampionVitals,
                        maxFood: MAX_FOOD,
                        maxWater: MAX_WATER,
                    }),
            },
        ) ?? state;
    }),

    useItem: (championId, itemId, fromSlot = 'inventory') => set((state) => {
        return buildUseItemRuntimePatch(
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
                            getPartyShieldKind: getOriginalPartyShieldKind,
                            quantizeDurationMs: quantizeMsToOriginalTimerTicks,
                            healChampionWounds: healChampionWoundsOriginal,
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
        return buildFillWaterRuntimePatch(
            state,
            championId,
            itemId,
            {
                isFacingFountain: (currentState) => isFacingFountainSystem(
                    currentState.level,
                    currentState.position,
                    currentState.direction,
                    {
                        getTile: (level, x, y) => getMap(level).tiles[y]?.[x],
                        hasOriginalWallOverlayAt,
                    },
                ),
                canFillWaterContainer,
                fillWaterContainer,
            },
        ) ?? state;
    }),

    sleep: () => set((state) => {
        if (state.gamePhase !== 'exploration' || state.party.length === 0) return state;
        if (isPartyRestedRuntime(state)) {
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
        const now = Date.now();
        const castRuntimePartyDamageDeps = buildRuntimePartyDamageDeps();
        const castResult = buildStoreCastSpellRuntimeResult(
            state,
            championId,
            runeIds,
            now,
            createStoreCastSpellRuntimeDeps(state, {
                applyPartySpellBacklashDamage: (currentState, championVitals, effect, rolledDamage, currentNow) =>
                    castRuntimePartyDamageDeps.applyPartySpellBacklashDamage(
                        currentState as GameState,
                        championVitals,
                        effect,
                        rolledDamage,
                        currentNow,
                    ),
            }, {
                buildUnknownCombinationPatch: (currentNow) => ({
                    lastCastResult: { success: false, message: 'Combinaison de runes inconnue.', ts: currentNow },
                }),
                getChampionMasteryLevel: (currentState, targetChampionId, champion, skill) =>
                    getChampionMasteryLevel(currentState as GameState, targetChampionId, champion, skill),
                rollCastCheck: (champion, equip, activePotionBoosts, vitals, spell, skillLevel) =>
                    rollOriginalSpellCastSuccess(
                        champion,
                        equip,
                        activePotionBoosts,
                        vitals,
                        spell,
                        skillLevel,
                    ),
                buildChampionSkillExperiencePatch: (currentState, targetChampionId, skill, amount) =>
                    buildChampionSkillExperiencePatchOriginal(currentState as GameState, targetChampionId, skill, amount),
                originalTimerTicksToSeconds,
                createChampionCombatState,
                randomInt,
                quantizeDurationMs: quantizeMsToOriginalTimerTicks,
                buildDroppedItem,
                getEffectiveChampionStats: getEffectiveChampionStatsRuntime,
                getImmediateDoor: getClosedDoorAt,
                isImmediatelyBlocked: isBlockedForProjectile,
                buildBlockedPoisonCloud: buildActivePoisonCloud,
                mergeBasePatch: (basePatch, nextPatch) => ({
                    ...basePatch,
                    ...nextPatch,
                }),
            }),
        );
        if (!castResult) {
            return state;
        }
        playCastSpellDoorMotionResult(castResult, {
            playDoorMotion,
            getDoorSoundVolume,
            doorToggleSoundDurationMs: DOOR_TOGGLE_SOUND_DURATION_MS,
        });
        return castResult.patch as Partial<GameState>;
    }),

    tickFrame: (delta, now) => set((state) => {
        return processTickFrame(state, delta, now, createStoreTickFrameRuntimeDeps({
            shouldEnterGameOver,
            applyEndgameFrame: (endgameState, currentNow) => buildStoreEndgameFramePatch(
                endgameState,
                currentNow,
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
            ),
            applySleepFrame: (sleepState, currentNow) => buildStoreSleepFramePatch(
                sleepState,
                currentNow,
                {
                    advanceSurvivalTime: (currentSleepState, stepCount) =>
                        advanceSurvivalTimeRuntime(currentSleepState, stepCount, { sleeping: true }),
                    ageTimedEffectsByMs: (currentSleepState, advanceMs, sleepNow) =>
                        ageTimedEffectsState(currentSleepState, advanceMs, sleepNow),
                    processPendingSensorEvents: (deltaSeconds, currentSleepState) =>
                        processPendingSensorEventsSystem(
                            deltaSeconds,
                            currentSleepState.pendingSensorEvents,
                            buildSensorStateSnapshot(currentSleepState),
                            buildPendingWorldEventDeps(),
                        ),
                    processPendingGeneratorSpawns: (deltaSeconds, currentSleepState) =>
                        processPendingGeneratorSpawnsSystem(
                            deltaSeconds,
                            currentSleepState.pendingGeneratorSpawns,
                            buildSensorStateSnapshot(currentSleepState),
                            {
                                canMaterializeReservedGeneratorSpawn: canApproximateOriginalReservedGeneratorSpawn,
                                isGeneratorSpawnBlocked,
                                createGeneratedCreatureGroupInstances,
                                retrySeconds: ORIGINAL_MOVE_GROUP_RETRY_SECONDS,
                                diffSensorState,
                            },
                        ),
                    applyCombatTick: buildCombatTickPatch,
                    isPartyRested: isPartyRestedRuntime,
                },
            ),
            applyRegenTick: (regenState, movementDelta) => buildStoreRegenTickPatch(
                regenState,
                movementDelta,
                {
                    originalTimerTickSeconds: ORIGINAL_TIMER_TICK_SECONDS,
                    advanceSurvivalTime: (currentRegenState, stepCount) =>
                        advanceSurvivalTimeRuntime(currentRegenState, stepCount),
                },
            ),
            applyMovementTick: (movementState, movementDelta) => tickMovementCooldown({
                movementCooldown: movementState.movementCooldown,
                delta: movementDelta,
            }),
            applyCombatTick: buildCombatTickPatch,
            buildSensorStateSnapshot,
            buildPendingWorldEventDeps,
            processPendingSensorEvents: (pendingDelta, pendingSensorEvents, sensorState, deps) => processPendingSensorEventsSystem(
                pendingDelta,
                pendingSensorEvents,
                sensorState,
                deps,
            ),
            processPendingGeneratorSpawns: (pendingDelta, pendingGeneratorSpawns, sensorState, deps) => processPendingGeneratorSpawnsSystem(
                pendingDelta,
                pendingGeneratorSpawns,
                sensorState,
                deps,
            ),
            generatorRuntimeDeps: {
                canMaterializeReservedGeneratorSpawn: canApproximateOriginalReservedGeneratorSpawn,
                isGeneratorSpawnBlocked,
                createGeneratedCreatureGroupInstances,
                retrySeconds: ORIGINAL_MOVE_GROUP_RETRY_SECONDS,
                diffSensorState,
            },
            applyImmediateTransportSquareEffects,
        }));
    }),

    regenTick: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        return buildStoreRegenTickPatch(
            state,
            delta,
            {
                originalTimerTickSeconds: ORIGINAL_TIMER_TICK_SECONDS,
                advanceSurvivalTime: (currentState, stepCount) =>
                    advanceSurvivalTimeRuntime(currentState, stepCount),
            },
        ) ?? state;
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
        return buildChampionSkillExperiencePatchOriginal(state, championId, skill, amount) ?? state;
    }),

    // ─── Weapon action / physical attack ─────────────────────────────────────
    attackFront: (championId, attackType) => set((state) => {
        return buildAttackFrontRuntimePatch(state, championId, attackType) ?? state;
    }),

    // ─── Door crush tick ─────────────────────────────────────────────────────
    tickDoors: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        return buildStoreTickDoorsPatch(
            state,
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
        return runMonsterTickRuntime(
            createStoreMonsterTickRuntimeState(state),
            delta,
            createStoreMonsterTickRuntimeDeps({
                getMap,
                getCreatureDef: (typeId) => CREATURE_TYPES[typeId],
                randomFraction: Math.random,
                randomInt,
                creatureTimers,
                creatureLastSeenPartyPos,
                creatureConfusedUntil,
                creatureFluxcageUntil,
                creatureFrightenedUntil,
                creatureAttackWindows,
                hasLineOfSight,
                nextMonsterMoveDelaySeconds: getMonsterMoveDelaySecondsOriginal,
                nextMonsterAttackDelaySeconds: getMonsterAttackDelaySecondsOriginal,
                canCreatureShareTile,
                canArchenemyDoubleMove: (
                    creatureState,
                    level,
                    x,
                    y,
                    direction,
                    creatures,
                    monsterWalkable,
                ) => resolveArchenemyDoubleMoveDestinationOriginal(
                    creatureState,
                    level,
                    x,
                    y,
                    direction,
                    creatures,
                    monsterWalkable,
                ),
                chooseCreatureProjectileEffect: chooseOriginalCreatureProjectileEffect,
                getCreatureSizeOnTile,
                isCreatureCellOccupiedOnTile,
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
                ...createStoreMonsterTickStatefulDeps(state, {
                    resolveMonsterAttackAgainstChampionSystem: resolveMonsterAttackAgainstChampion,
                    createIncomingAttackDeps: (currentState) => ({
                        randomInt,
                        computeQuickness: computeOriginalQuicknessRuntime,
                        getRuntimeBonuses: getChampionRuntimeBonuses,
                        getEffectiveChampionStats: getEffectiveChampionStatsRuntime,
                        chooseChampionWoundSlots: chooseChampionWoundSlotsFromZones,
                        resolveIncomingAttack: (
                            champion,
                            currentVitals,
                            rawAttack,
                            attackType,
                            allowedSlots,
                            attackNowMs,
                        ) => resolveChampionIncomingAttackRuntime(
                            currentState,
                            champion,
                            currentVitals,
                            rawAttack,
                            attackType,
                            allowedSlots,
                            attackNowMs,
                        ),
                        clampVital,
                        adjustByAttribute: adjustAttackByAttributeOriginal,
                        applyPoison: applyPoisonCharacterOriginal,
                    }),
                    resolveCreatureTeleporterTransportSystem,
                    buildTerrainTransportDeps,
                }),
                buildChampionDamageEvent,
                attackWindowMs: CREATURE_ATTACK_WINDOW_MS,
                getTeleporter: getTeleporterSystem,
                normalizeCreatureCellsOnTile,
                buildFrightenedUntilMs: (baseNowMs) =>
                    baseNowMs + quantizeMsToOriginalTimerTicks((20 + randomInt(64)) * ORIGINAL_TIMER_TICK_MS),
                buildDeathDrop: (deathInput, championId, nowMs) =>
                    buildDeathDropSystem(deathInput, championId, nowMs),
                nowMs: () => Date.now(),
                playTeleport,
                playCreatureMove,
                playCreatureAttack,
                notifyCreatureAction,
                playChampionWounded,
            }),
        ) ?? state;
    }),

    // ─── Combat tick (cooldowns + damage event cleanup) ───────────────────────
    // ─── Spell tick (lights expiry + projectile movement) ─────────────────────
    tickSpells: (now) => set((state) => {
        const tickSpellsPartyDamageDeps = createStoreTickSpellsRuntimePartyDamageDeps(
            buildRuntimePartyDamageDeps(),
            { attackType: 'Normal', allowedSlots: [] },
        );
        return buildStoreTickSpellsRuntimePatch(
            state,
            now,
            createStoreTickSpellsRuntimeDeps(
                tickSpellsPartyDamageDeps,
                createStoreTickSpellsStatefulDeps({
                    buildTerrainTransportDeps,
                    resolveProjectileTeleporterTransportSystem,
                    buildIncomingAttackState: (currentState, incomingState) => ({
                        ...(currentState as GameState),
                        championEquipment: incomingState.championEquipment,
                        activePotionBoosts: incomingState.activePotionBoosts,
                        activeShields: incomingState.activeShields,
                    }),
                    resolveChampionIncomingAttackRuntime: (
                        incomingAttackState,
                        targetChampion,
                        currentVitals,
                        rawAttack,
                        attackType,
                        attackNow,
                    ) => resolveChampionIncomingAttackRuntime(
                        incomingAttackState,
                        targetChampion,
                        currentVitals,
                        rawAttack,
                        attackType as IncomingAttackType,
                        ['head', 'torso'],
                        attackNow,
                    ),
                }),
                {
                getMap,
                randomInt,
                buildActivePoisonCloud,
                buildDroppedItem,
                buildChampionDamageEvent,
                applyPoisonCharacter: applyPoisonCharacterOriginal,
                buildDeathDrop: buildDeathDropSystem,
                isLikelyNonMaterial,
                dropCreatureCarriedItems,
                buildDeathDustEvent,
                buildCreatureDamageEvent,
                creatureAttackWindows,
                onDoorMotion: playDoorMotion,
                getDoorSoundVolume,
                footprintLifetimeMs: FOOTPRINT_LIFETIME_MS,
                damageEventLifetimeMs: DAMAGE_EVENT_LIFETIME_MS,
            }),
        );
    }),

    tickCombat: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        return buildStoreCombatTickPatch(state, delta, Date.now(), DAMAGE_EVENT_LIFETIME_MS) ?? state;
    }),
});

export const useStore = create<GameState>()(storeCreator);
