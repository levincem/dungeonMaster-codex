import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { getDungeonBootstrapSync, type RawDungeonBootstrap } from '../data/dungeonData';
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
    CreatureInstance, FloorItem,
    SensorObject, SensorAction, CardinalDir,
    ChampionEquipment,
} from '../types/game';
import type { GeneratedCreatureGroupPlanEntry } from './systems/generatedCreatureGroups';
import type { EquipSlotKey } from '../types/items';
import type { Champion } from '../data/champions';
import { CHAMPION_BY_ID } from '../data/champions';
import { buildChampionStarterLoadout } from '../data/championStarterItems';
import { CREATURE_TYPES } from '../data/creatures';
import {
    createEmptyChampionTemporaryXP,
    createEmptyChampionXP,
    normalizeChampionTemporaryXP,
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
    getChampionMaxLoad,
    getEffectiveChampionStatsWithBonuses,
    getTotalWeight,
} from '../data/equipment';
import type { ChampionWoundSlot, ChampionWounds, EquipmentStatBonuses } from '../data/equipment';
import { hasEffectiveOriginalWallOverlayAt } from '../data/originalWallOverlays';
import { isOriginalConsumableItem } from '../data/originalItemRules';
import {
    getOriginalPaletteNormalizedBrightnessForLuminance,
    getOriginalTorchNormalizedLuminance,
    getOriginalTorchStateIndex,
    ORIGINAL_TORCH_LIFETIME_MS,
} from '../data/originalUiSupport';
import {
    getAttackCooldownSeconds,
    getAttackOptionUnusableReason,
    getRequiredAmmoRawClass,
    getWeaponAttackOptions,
    isAttackOptionUsableAtMastery,
    isPhysicalAttack,
    isShootAttack,
    isThrowAttack,
} from '../data/weaponAttacks';
import {
    canFillWaterContainer,
    fillWaterContainer,
    consumeWaterContainer,
    isWaterContainer,
    normaliseWaterContainer,
} from '../data/waterContainers';
import { getTranslations } from '../i18n';
import { doorBlocksThrownItems, doorBlocksVision } from '../data/doors';
import {
    playPartyAttack,
    playCreatureMove,
    playCreatureAttack,
    playExplodingFireball,
    playExplodingSpell,
    playFallingAndDying,
    playFallingItem,
    playPlate,
    playDoorMotion,
    playSwallowing,
    playTeleport,
    playWallBump,
    playChampionWounded,
    playHornOfFear,
    playWarCry,
} from './sounds';
import { readBestPersistedSave, writePersistedSave } from './saveGame';
import type { GameOptions, MonsterAttackDebugEntry } from './runtimeTypes';
import {
    tryParsePersistedSaveData as tryParsePersistedSaveDataSystem,
} from './systems/persistence';
import {
    buildInitialChampionXP,
    normalizeChampionCurrentStats,
    normalizeChampionVitalsForChampion,
} from './systems/championState';
import {
    dropChampionContainerItem,
    equipChampionContainerItem,
    dropChampionCarriedItem,
    equipChampionInventoryItem,
    giveChampionContainerItem,
    giveChampionEquippedItem,
    giveChampionInventoryItem,
    locateChampionItem,
    moveChampionItemToContainer,
    moveContainerItemToChampionInventory,
    seedTorchBurnStartFromEquipment,
    throwChampionCarriedItem,
    unequipChampionItem,
} from './systems/inventoryState';
import {
    buildFloorItemPickupPatch,
    canPartyReachFloorItem,
    isFloorItemPickupBlockedByFullInventory,
} from './systems/floorItemState';
import {
    buildDropInventoryItemRuntimePatch,
    buildMoveFloorItemToTileRuntimePatch,
    buildPickupItemToChampionRuntimePatch,
    buildThrowFloorItemRuntimePatch,
    removeChampionCarriedItemToTile,
} from './systems/floorItemCommandRuntime';
import { applyFloorItemTeleporterEffects as applyFloorItemTeleporterEffectsSystem } from './systems/floorItemTeleporterEffects';
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
import { buildUseItemPatch } from './systems/useItemPatch';
import { buildThrowCarriedItemRuntimePatch } from './systems/itemCarryCommandRuntime';
import {
    buildDropCarriedItemRuntimePatch,
    buildEquipItemRuntimePatch,
    buildGiveEquippedItemRuntimePatch,
    buildGiveItemRuntimePatch,
    buildUnequipItemRuntimePatch,
} from './systems/itemTransferCommandRuntime';
import {
    buildStoreReturnToTitlePatch,
    loadStoreGamePatch,
    saveStoreGame,
} from './systems/storePersistenceRuntime';
import {
    buildKillCreaturePatch,
    buildSetGameOptionsPatch,
    buildStoreKillChampionPatch,
    buildTogglePausePatch,
    buildToggleSleepPatch,
    buildWakeUpPatch,
} from './systems/storeStateRuntime';
import { runStoreOptionalPatchAction } from './systems/storePatchRuntime';
import {
    buildAddToPartyPatch,
    buildRemoveFromPartyPatch,
} from './systems/storePartyRosterRuntime';
import {
    buildStoreDrinkFromFountainPatch,
    buildStoreFillWaterPatch,
    buildStoreResurrectChampionPatch,
    buildStoreUseItemPatch as buildStoreUseItemActionPatch,
    createStoreDrinkFromFountainRuntimeDeps,
    createStoreFillWaterRuntimeDeps,
    createStoreResurrectChampionRuntimeDeps,
    createStoreUseItemRuntimeDeps,
} from './systems/storeItemRuntime';
import {
    buildBeginFloorDragPatch,
    buildCloseMirrorPatch,
    buildCloseOptionsModalPatch,
    buildClosePartyMemberPatch,
    buildEndFloorDragPatch,
    buildGoToLevelPatch,
    buildOpenMirrorPatch,
    buildOpenOptionsModalPatch,
    buildOpenPartyMemberPatch,
    buildReorderPartyPatch,
    buildSelectChampionPatch,
    buildSetTutorialOverlayActivePatch,
    buildTurnLeftPatch,
    buildTurnRightPatch,
    buildTryOpenGatePatch,
    buildUpdateFloorDragPatch,
} from './systems/storeUiRuntime';
import { ageTimedEffectsState } from './systems/timedEffectsState';
import { isOriginalLuckSuccessful } from './systems/originalLuck';
import { computeOriginalQuickness } from './systems/originalQuickness';
import {
    adjustOriginalAttackByAttribute,
    getOriginalAttackAdjustedByResistance,
} from './systems/originalAttackMath';
import {
    type OriginalProjectileIncomingAttackType,
} from './systems/originalProjectileImpact';
import {
    getOriginalMonsterAttackDelaySeconds,
    getOriginalMonsterMoveDelaySeconds,
} from './systems/originalMonsterTiming';
import { getOriginalActiveShieldDefense, getOriginalPartyShieldKind } from './systems/originalShieldDefense';
import { computeOriginalChampionWoundDefense, computeOriginalChampionWoundDefenseWithDebug } from './systems/originalWoundDefense';
import { runStoreMovementAction } from './systems/storePartyMoveRuntime';
import {
    buildStoreExplorationRegenPatch as buildStoreExplorationRegenPatchSystem,
    buildStoreMovementTickPatch,
    buildStoreTickFramePatch as buildStoreTickFramePatchSystem,
} from './systems/storeFrameRuntime';
import {
    clearCreatureControlStatuses,
    creatureAttackWindows,
    creatureConfusedUntil,
    creatureFrightenedUntil,
    creatureFluxcageUntil,
    creatureLastSeenPartyPos,
    creatureTimers,
    getCreatureFluxcageExpiry,
    notifyCreatureAction,
    notifyPlateActivated,
    onCreatureAction as onCreatureActionRuntime,
    resetExternalCreatureRuntimeState,
    subscribePlateActivated as subscribePlateActivatedRuntime,
} from './systems/storeCreatureRuntime';
import {
    createStoreSensorRuntime,
    type StoreSensorState,
} from './systems/storeSensorRuntime';
import { createStorePartyRuntime } from './systems/storePartyRuntime';
import { createStoreMovementRuntime } from './systems/storeMovementRuntime';
import { createStoreClimbDownRuntimeDeps } from './systems/climbDownRuntimeDeps';
import {
    buildAsSensor,
    createStoreSensorRuntimeDepsBundle,
} from './systems/sensorRuntimeDeps';
import { createStoreTransportRuntimeDepsBundle } from './systems/transportRuntimeDeps';
import { resolveAttackFrontContext } from './systems/attackFrontContext';
import { applyChampionAttackVitals as applyChampionAttackVitalsSystem } from './systems/attackVitals';
import {
    buildStoreEndgameFramePatch,
    buildStoreSleepFramePatch,
} from './systems/storeTimeRuntime';
import {
    createStoreCastSpellRuntimeDeps,
    buildStoreTickSpellsRuntimePatch,
    createStoreTickSpellsRuntimePartyDamageDeps,
    resolveSpellVisualSoundNames,
    createStoreTickSpellsStatefulDeps,
    createStoreTickSpellsRuntimeDeps,
} from './systems/storeSpellRuntime';
import {
    createStoreMonsterTickRuntimeDeps,
    createStoreMonsterTickStatefulDeps,
} from './systems/storeMonsterRuntime';
import {
    createStoreAttackFrontAction,
    createStoreCastSpellAction,
    createStoreMonsterTickAction,
} from './systems/storeGameplayRuntime';
import { resolveMonsterAttackAgainstChampion } from './systems/monsterAttackResolution';
import { buildDeathDrop as buildDeathDropSystem } from './systems/deathDrops';
import { applyChampionDeathDropsToPartyState } from './systems/partyDeathState';
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
import { sanitizeOpenTeleporterKeys } from './systems/disabledTeleporters';
import { applyOpenedPitEffects as applyOpenedPitEffectsSystem } from './systems/openedPitSquares';
import { applyOpenedTeleporterEffects as applyOpenedTeleporterEffectsSystem } from './systems/openedTransportSquares';
import { isGeneratorSpawnBlocked as isGeneratorSpawnBlockedSystem } from './systems/sensorGeneratorRuntime';
import {
    buildStoreChampionItemOnViAltarPatch,
    buildStoreFloorItemOnViAltarPatch,
    createStoreViAltarInteractionPatchDeps,
    runStoreChampionItemOnFrontWallAction,
    runStoreFloorItemOnFrontWallAction,
    runStoreWallSensorActivationAction,
} from './systems/storeWallInteractionRuntime';
import {
    applyConsumedChampionEquipmentPatch as applyConsumedChampionEquipmentPatchRuntime,
    buildChampionDamageEvent as buildChampionDamageEventRuntime,
    buildCreatureDamageEvent as buildCreatureDamageEventRuntime,
    buildDeathDustEvent as buildDeathDustEventRuntime,
    buildViAltarCelebrationEvents as buildViAltarCelebrationEventsRuntime,
    decorateViAltarResurrectionPatch as decorateViAltarResurrectionPatchRuntime,
    showStoreLastCastResultMessage,
} from './systems/storeFeedbackRuntime';
import {
    adjustOriginalStatisticCurrentValue,
    buildEmptyFlaskReplacement as buildEmptyFlaskReplacementRuntime,
    clampFoodWater,
    clampVital,
    createChampionVitals,
    getChampionSkillLevelFromXP,
    getChampionStatRelaxTargets,
    getEquipmentSkillLevelModifier,
    MAX_FOOD,
    MAX_WATER,
    relaxChampionCurrentStatsTowardMaximum,
} from './systems/storeChampionRuntime';
import {
    buildAttackResultMessage,
    buildDragThrowProjectile,
    buildDroppedItem,
    createChampionCombatState,
    dropCreatureCarriedItems as dropCreatureCarriedItemsRuntime,
    findQuiverAmmo,
    getActionCharges,
    getChampionMasteryLevel,
    getClosedDoorAt,
    getFrontPosition,
    getProjectileDamageClass,
    getRightHandStats,
    getThrownPotionExplosionEffect,
    getWeaponName,
    isBlockedForProjectile,
    isLikelyNonMaterial,
    originalThrowingDistance,
    parseItemCharges,
    rollOriginalPartyWideAttack,
    rollOriginalSpellCastSuccess,
    updateEquippedItemCharges,
} from './systems/storeCombatRuntime';
import type { MonsterDamageClass } from './systems/storeCombatRuntime';
import {
    applyChampionStaminaDeltaOriginal,
    chooseChampionWoundSlotsFromZones,
    computeOriginalTimeCriteria,
    createStoreChampionStateRuntime,
} from './systems/storeChampionStateRuntime';
import { createStoreBootstrapRuntime } from './systems/storeBootstrapRuntime';
import { createStoreCreatureSpatialRuntime } from './systems/storeCreatureSpatialRuntime';
import { createStoreEndgameRuntime } from './systems/storeEndgameRuntime';
import { createStoreWorldRuntime } from './systems/storeWorldRuntime';
import {
    buildStoreCombatTickPatch,
    buildStoreTickDoorsPatch,
    buildStoreToggleDoorPatch,
} from './systems/storeDoorRuntime';
import {
    buildStoreSelectedChampionPickupPatch,
    createStoreFloorItemCommandDeps,
} from './systems/storeFloorItemRuntime';
import {
    type PendingGeneratorDeps,
    processPendingGeneratorSpawns as processPendingGeneratorSpawnsSystem,
    processPendingSensorEvents as processPendingSensorEventsSystem,
    queuePendingGeneratorSpawnEvent,
} from './systems/pendingWorldEvents';
import {
    canMaterializeReservedGeneratorSpawnOnLevel,
    canReserveApproximateGeneratorGroupOnLevel,
} from './systems/generatorCapacity';
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
export const TORCH_STATE_MS     = quantizeMsToOriginalTimerTicks(minutesToMs(5));   // legacy export kept for compatibility

/** Return 0=unlit, 1=used_2, 2=used_1, 3=lit based on ms elapsed since lit */
export function torchStateIndex(elapsedMs: number): number {
    if (elapsedMs >= ORIGINAL_TORCH_LIFETIME_MS) return 0;
    return getOriginalTorchStateIndex(elapsedMs);
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
                torchContrib = Math.max(torchContrib, getOriginalTorchNormalizedLuminance(now - litAt));
                if (torchContrib >= 1) {
                    break outer;
                }
            }
        }
    }

    // Active spell contributions (positive = light, negative = darkness)
    const spellContrib = spellLights
        .filter(l => l.expiresAt > now)
        .reduce((sum, l) => sum + l.lightContrib, 0);

    return getOriginalPaletteNormalizedBrightnessForLuminance(
        Math.max(0, Math.min(1, torchContrib + spellContrib)),
    );
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

// ─── Per-champion combat state ────────────────────────────────────────────────
export interface ChampionCombat {
    cooldown:    number; // seconds remaining
    cooldownMax: number; // full duration (for overlay ratio)
    defenseModifier: number; // temporary defensive posture during attack recovery
}

const MAX_PARTY = 4;
type MirrorRecruitMode = 'resurrect' | 'reincarnate';

export {
    MAX_FOOD,
    MAX_WATER,
    LOW_FOOD_THRESHOLD,
    CRITICAL_FOOD_THRESHOLD,
    LOW_WATER_THRESHOLD,
    CRITICAL_WATER_THRESHOLD,
} from './systems/storeChampionRuntime';

const POISON_TICK_INTERVAL_SEC = originalTimerTicksToSeconds(36);
const FOOD_DRAIN_SCALE = 1;
const WATER_DRAIN_SCALE = 1;
const AWAKE_SURVIVAL_INTERVAL_TICKS = 64;
const SLEEP_SURVIVAL_INTERVAL_TICKS = 16;
const AWAKE_STAT_RELAX_INTERVAL_MASK = 0xff;
const SLEEP_STAT_RELAX_INTERVAL_MASK = 0x3f;

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

const dropCreatureCarriedItems = (
    creatures: CreatureInstance[],
    floorItems: FloorItem[],
    creatureId: string,
) => dropCreatureCarriedItemsRuntime(creatures, floorItems, creatureId, randomInt);

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

function getMonsterMoveDelaySecondsOriginal(moveTicks: number): number {
    return getOriginalMonsterMoveDelaySeconds(moveTicks, randomInt);
}

function getMonsterAttackDelaySecondsOriginal(attackTicks: number): number {
    return getOriginalMonsterAttackDelaySeconds(attackTicks, randomInt);
}

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

function computeChampionWoundDefenseOriginalWithDebug(
    state: GameState,
    championId: number,
    champion: Champion,
    currentVitals: ChampionVitals | undefined,
    woundSlot: ChampionWoundSlot,
    useSharpDefense: boolean,
) {
    const equip = state.championEquipment[championId] ?? {};
    return computeOriginalChampionWoundDefenseWithDebug(
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

const {
    buildRuntimeCreatureGroupId,
    canCreatureShareTile,
    getCreatureSizeOnTile,
    hasLineOfSight,
    isCreatureCellOccupiedOnTile,
    normalizeCreatureCells,
    normalizeCreatureCellsOnTile,
    resolveArchenemyDoubleMoveDestinationOriginal,
} = createStoreCreatureSpatialRuntime({
    creatureTypes: CREATURE_TYPES,
    getDoorObject: (tile) => getDoorObject(tile) ?? null,
    doorBlocksVision,
});
// ─── Pressure plate activation pub/sub (no Zustand — only drives animation) ──
export const subscribePlateActivated = subscribePlateActivatedRuntime;

interface PendingSensorEvent {
    level: number;
    sensorIndex: number;
    remaining: number;
    actionOverride?: SensorAction;
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
    generatedCreatures?: GeneratedCreatureGroupPlanEntry[];
    remaining: number;
}

// ─── Creature action pub/sub (drives sprite frame changes) ───────────────────
export const onCreatureAction = onCreatureActionRuntime;

// ─── Creature timers (mutable, kept outside Zustand to avoid per-frame re-renders) ──
export { getCreatureFluxcageExpiry };

const ORIGINAL_MOVE_GROUP_RETRY_SECONDS = originalTimerTicksToSeconds(5);
const {
    buildCreatureInstancesForLevel,
    buildFloorItemsForLevel,
    buildPendingGeneratedCreatureGroup,
    canApproximateOriginalReservedGeneratorSpawn,
    createGeneratedCreatureGroupInstances,
    getChampionStarterLoadout,
    isGeneratorSpawnBlocked,
    materializePendingGeneratedCreatureGroup,
} = createStoreWorldRuntime<SensorState>({
    getGameMaps,
    getGameMap,
    getMapDifficulty: (level) => getGameMap(level).difficulty,
    creatureTypes: CREATURE_TYPES,
    buildRuntimeCreatureGroupId,
    registerCreatureTimers: (id, timers) => {
        creatureTimers.set(id, timers);
    },
    normalizeCreatureCells,
    resolveItemName,
    normalizeScrollText,
    parseItemCharges,
    normaliseWaterContainer,
    buildChampionStarterLoadout,
    canMaterializeReservedGeneratorSpawnOnLevel,
    isGeneratorSpawnBlocked: isGeneratorSpawnBlockedSystem,
    randomInt,
});
const getDungeonBootstrap = (): RawDungeonBootstrap => getDungeonBootstrapSync<RawDungeonBootstrap>();
const { buildFreshDungeonState } = createStoreBootstrapRuntime({
    hallStart: [3, 1],
    hallStartDirection: 'SOUTH',
    buildDefaultOpenPits: () => new Set<string>(getDungeonBootstrap().defaultOpenPits ?? []),
    buildDefaultOpenTeleporters: () => sanitizeOpenTeleporterKeys(getDungeonBootstrap().defaultOpenTeleporters ?? []),
    buildDefaultVisibleTexts: () => new Set<string>(getDungeonBootstrap().defaultVisibleTexts ?? []),
    buildCreatureInstancesForLevel,
    buildFloorItemsForLevel,
});

// ─── Map helpers ──────────────────────────────────────────────────────────────

const getMap = (level: number): GameMap => getGameMap(level);
function buildStoreLevelHydrationPatch(
    state: Pick<GameState, 'hydratedLevels' | 'creatures' | 'floorItems'>,
    level: number,
): Partial<GameState> | null {
    if (state.hydratedLevels.has(level)) return null;
    return {
        hydratedLevels: new Set<number>([...state.hydratedLevels, level]),
        creatures: [...state.creatures, ...buildCreatureInstancesForLevel(level)],
        floorItems: [...state.floorItems, ...buildFloorItemsForLevel(level)],
    };
}

const {
    buildActivePoisonCloud,
    buildEndgameSpellEvent,
    endgameFinalDelayMs: ENDGAME_FINAL_DELAY_MS,
    endgameFuseActions: ENDGAME_FUSE_ACTIONS,
    endgameFuseUpdateMs: ENDGAME_FUSE_UPDATE_MS,
    endgameMessageIntervalMs: ENDGAME_MESSAGE_INTERVAL_MS,
    getEndgameMessagesForMap,
} = createStoreEndgameRuntime({
    quantizeMsToOriginalVbls,
    getMap,
});

function isWallRevealableObject(obj: GameTile['objects'][number]): boolean {
    return obj.category !== 'Sensor' && obj.category !== 'Text' && obj.category !== 'Door';
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

type SensorState = StoreSensorState<
    Projectile,
    CreatureInstance,
    PendingGeneratorSpawnEvent
>;

type PendingGeneratorRuntimeDeps = PendingGeneratorDeps<
    SensorState,
    PendingGeneratorSpawnEvent,
    CreatureInstance
>;

function playDoorMotionForTarget(target: { level: number; x: number; y: number } | null) {
    playDoorMotion(
        DOOR_TOGGLE_SOUND_DURATION_MS,
        target ? getDoorSoundVolume(target.level, target.x, target.y) : DOOR_SOUND_MIN_VOLUME,
    );
}

function buildPendingGeneratorRuntimeDeps(): PendingGeneratorRuntimeDeps {
    return {
        canMaterializeReservedGeneratorSpawn: canApproximateOriginalReservedGeneratorSpawn,
        isGeneratorSpawnBlocked,
        materializePendingGeneratorSpawnEvent: (event: PendingGeneratorSpawnEvent) =>
            event.generatedCreatures
                ? materializePendingGeneratedCreatureGroup(event.generatedCreatures)
                : createGeneratedCreatureGroupInstances(
                    event.spawnLevel,
                    event.spawnX,
                    event.spawnY,
                    event.typeId,
                    event.hpMultiplier,
                    event.creatureCount,
                    event.groupId,
                ),
        retrySeconds: ORIGINAL_MOVE_GROUP_RETRY_SECONDS,
        diffSensorState,
    };
}

function isPartyStepBlockedByCreature(
    level: number,
    x: number,
    y: number,
    creatures: CreatureInstance[],
): boolean {
    return creatures.some((creature) =>
        creature.alive &&
        creature.mapIndex === level &&
        creature.x === x &&
        creature.y === y,
    );
}

const {
    WALL_LAUNCHER_SENSOR_TYPES,
    PUSH_FACE_BY_DIRECTION,
    applyToSet,
    buildSensorStateSnapshot,
    computeSensorEffect,
    dispatchTriggeredSensorEffect,
    diffSensorState,
    findSensorByIndex,
    getSelfRevealingWallSensor,
    getWallFaceSensorsInRuntimeOrder,
    isWallSensorConsumedAtRuntime,
    partyHasRequiredItem,
    queueOrComputeSensorEffect,
    resolveDoorSoundTarget,
    revealSelfWallMountedItems,
    rotateWallFaceSensors,
    shouldRotateWallFaceAfterActivation,
    tileHasRequiredFloorItem,
    triggerGeneratorSensor,
} = createStoreSensorRuntime<
    SensorState,
    Projectile,
    CreatureInstance,
    PendingGeneratorSpawnEvent,
    PendingSensorEvent
>({
    mapResolver: getMap,
    originalTimerTicksToSeconds,
    getGeneratorConfig: getOriginalGeneratorConfig,
    randomInt,
    canReserveGeneratorGroup: (state, spawnLevel) =>
        canReserveApproximateGeneratorGroupOnLevel(
            state.currentLevel,
            spawnLevel,
            state.creatures,
            state.pendingGeneratorSpawns,
        ),
    buildPendingGeneratorSpawnEvent: (level, sensorIndex, generatorConfig, creatureCount, groupId) => ({
        sensorLevel: level,
        sensorIndex,
        spawnLevel: level,
        spawnX: generatorConfig.spawnX,
        spawnY: generatorConfig.spawnY,
        typeId: generatorConfig.typeId,
        hpMultiplier: generatorConfig.hpMultiplier,
        creatureCount,
        groupId,
        generatedCreatures: buildPendingGeneratedCreatureGroup(
            level,
            generatorConfig.spawnX,
            generatorConfig.spawnY,
            generatorConfig.typeId,
            generatorConfig.hpMultiplier,
            creatureCount,
            groupId,
        ),
    }),
    queuePendingGeneratorSpawnEvent,
    retrySeconds: ORIGINAL_MOVE_GROUP_RETRY_SECONDS,
    createGeneratedCreatureGroupInstances,
    resolveWeaponProjectile: (weaponTypeId) => ({
        rawName: resolveItemName('Weapon', weaponTypeId),
        baseDamage: Math.max(1, WEAPON_TYPES[weaponTypeId]?.damage?.[1] ?? 1),
    }),
    isGeneratorSensor,
    itemMatchesMechanismRequirement,
    isWallRevealableObject,
});

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
    applyPoisonCharacterOriginal,
    buildChampionSkillExperiencePatchOriginal,
    healChampionWoundsOriginal,
    resolveChampionIncomingAttackRuntime,
} = createStoreChampionStateRuntime<GameState, GameState>({
    poisonTickIntervalSec: POISON_TICK_INTERVAL_SEC,
    randomInt,
    getMapDifficulty: (level) => getMap(level).difficulty,
    getEffectiveChampionStatsWithBonuses,
    computeChampionWoundDefense: (
        state,
        championId,
        champion,
        vitals,
        woundSlot,
        useSharpDefense,
    ) => computeChampionWoundDefenseOriginal(
        state,
        championId,
        champion,
        vitals,
        woundSlot,
        useSharpDefense,
    ),
    computeChampionWoundDefenseWithDebug: (
        state,
        championId,
        champion,
        vitals,
        woundSlot,
        useSharpDefense,
    ) => computeChampionWoundDefenseOriginalWithDebug(
        state,
        championId,
        champion,
        vitals,
        woundSlot,
        useSharpDefense,
    ),
    getChampionAdjustedAttackFromResistance: getChampionAdjustedAttackFromResistanceOriginal,
    getActiveShieldDefense: getActiveShieldDefenseOriginal,
    getChampionRuntimeBonuses,
});

const {
    advanceSurvivalTime: advanceSurvivalTimeRuntime,
    applyPartyLoadBasedFatigue,
    applyPartyMoveFatigue,
    buildCombatTickPatch,
    buildPartyDamageDeps: buildRuntimePartyDamageDeps,
    computeMovementCooldown: computePartyMovementCooldownSecondsRuntime,
    getEffectiveChampionStats: getEffectiveChampionStatsRuntime,
    isPartyRested: isPartyRestedRuntime,
} = createStorePartyRuntime<GameState>({
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
    getChampionRuntimeBonuses,
    getEffectiveChampionStatsWithBonuses,
    getChampionSkillLevelFromXP,
    getEquipmentSkillLevelModifier,
    normalizeChampionTemporaryXP,
    computeOriginalTimeCriteria,
    applyChampionStaminaDeltaOriginal,
    applyLimits,
    clampFoodWater,
    getChampionStatRelaxTargets: (champion: Champion, equip: ChampionEquipment | undefined, activePotionBoosts: ActivePotionBoost[]) =>
        getChampionStatRelaxTargets(
            champion,
            equip,
            activePotionBoosts,
            {
                getChampionPotionBonuses,
                getEffectiveChampionStatsWithBonuses,
            },
        ),
    relaxChampionCurrentStatsTowardMaximum,
    buildCombatTickPatch: buildStoreCombatTickPatch,
    damageEventLifetimeMs: DAMAGE_EVENT_LIFETIME_MS,
    getTotalWeight,
    getChampionMaxLoad,
    buildChampionDamageEvent,
    buildDeathDrop: buildDeathDropSystem,
    randomInt,
    rollOriginalPartyWideAttack: (rawAttack) => rollOriginalPartyWideAttack(rawAttack, randomInt),
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
        attackType as OriginalProjectileIncomingAttackType,
        allowedSlots,
        attackNowMs,
    ),
    getProjectileDamageClass,
    getChampionAdjustedAttackFromResistance: getChampionAdjustedAttackFromResistanceOriginal,
    getActiveShieldDefense: getActiveShieldDefenseOriginal,
});

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
    return storeMovementRuntime.applyImmediateTransportSquareEffects(state as GameState, basePatch);
}

function buildStorePartyMoveDeps(enableFrontWallBumpDamage: boolean) {
    return storeMovementRuntime.buildPartyMoveDeps(enableFrontWallBumpDamage);
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
    dispatchTriggeredSensorEffect,
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
    resolvePushFace: (direction: string): CardinalDir => PUSH_FACE_BY_DIRECTION[direction] as CardinalDir,
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
    applyCreaturesStandingOnOpenPit: (state, level, x, y, deps) =>
        applyCreaturesStandingOnOpenPitSystem(
            state,
            level,
            x,
            y,
            {
                ...deps,
                buildLevelHydrationPatch: (hydrationState, hydrationLevel) =>
                    buildStoreLevelHydrationPatch(hydrationState as Pick<GameState, 'hydratedLevels' | 'creatures' | 'floorItems'>, hydrationLevel),
            },
        ),
    applyCreaturesStandingOnOpenTeleporter: (state, level, x, y, deps) =>
        applyCreaturesStandingOnOpenTeleporterSystem(
            state,
            level,
            x,
            y,
            {
                ...deps,
                buildLevelHydrationPatch: (hydrationState, hydrationLevel) =>
                    buildStoreLevelHydrationPatch(hydrationState as Pick<GameState, 'hydratedLevels' | 'creatures' | 'floorItems'>, hydrationLevel),
            },
        ),
    dropCreatureCarriedItems,
    buildDeathDustEvent,
    buildCreatureDamageEvent,
    normalizeCreatureCellsOnTile,
    canCreatureShareTile,
    buildLevelHydrationPatch: (state, level) => buildStoreLevelHydrationPatch(state, level),
    buildSensorStateSnapshot,
    triggerFloorSensors: triggerFloorSensorsSystem,
    transitionFloorSensors: transitionFloorSensorsSystem,
    buildMovementSensorDeps,
    applyPartyFallImpactDamage: (state, championVitals, landingLevel, landingPosition) =>
        buildRuntimePartyDamageDeps().applyPartyFallImpactDamage(
            state,
            championVitals,
            landingLevel,
            landingPosition,
        ),
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
    buildLevelHydrationPatch: (state, level) => buildStoreLevelHydrationPatch(state, level),
    computeMovementCooldown: computePartyMovementCooldownSecondsRuntime,
});

const storeMovementRuntime = createStoreMovementRuntime<
    GameState,
    SensorState,
    ReturnType<typeof buildWallPushSensorDeps>,
    typeof STAIR_CONNECTIONS[number]
  >({
      applyPartyMoveFatigue,
      isPartyStepBlockedByCreature: (state, level, x, y) =>
          isPartyStepBlockedByCreature(level, x, y, state.creatures),
      getTile: (level, x, y) => getMap(level).tiles[y]?.[x],
      isWalkable,
      buildSensorStateSnapshot,
    buildWallPushSensorDeps,
    triggerWallPushSensorsSystem: (level, x, y, direction, sensorState, pendingSensorEvents, deps) =>
        triggerWallPushSensorsSystem(
            level,
            x,
            y,
            direction as CardinalDir | 'NORTH' | 'EAST' | 'SOUTH' | 'WEST',
            sensorState,
            pendingSensorEvents,
            deps,
        ),
    buildPartyDamageDeps: buildRuntimePartyDamageDeps,
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
});

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
    paused: boolean;
    lastMonsterAttackDebug: MonsterAttackDebugEntry | null;
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
    inventoryFullFeedback: { championId: number; ts: number } | null;
    lastCreatureAttackGameTick: number;
    tutorialOverlayActive: boolean;

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
    setTutorialOverlayActive: (active: boolean) => void;
    reorderParty: (fromIndex: number, toIndex: number) => void;
    castSpell: (championId: number, runeIds: string[]) => void;
    tickGameplayFrame: (delta: number, now: number) => void;
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
    dropCarriedItemInFront: (championId: number, itemId: string, fromSlot: EquipSlotKey | 'inventory') => boolean;
    throwCarriedItem: (championId: number, itemId: string, fromSlot: EquipSlotKey | 'inventory') => boolean;
    moveFloorItemToCurrentTile: (itemId: string, championId: number) => boolean;
    moveFloorItemToFrontTile: (itemId: string, championId: number) => boolean;
    throwFloorItem: (itemId: string, championId: number) => boolean;
    equipItem: (championId: number, slotKey: EquipSlotKey, itemId: string) => void;
    unequipItem: (championId: number, slotKey: EquipSlotKey) => void;
    giveItem: (fromChampionId: number, toChampionId: number, itemId: string) => void;
    giveEquippedItem: (fromChampionId: number, slotKey: EquipSlotKey, toChampionId: number) => void;
    storeItemInContainer: (championId: number, itemId: string, fromSlot: EquipSlotKey | 'inventory', containerItemId: string) => void;
    takeContainerItem: (championId: number, containerItemId: string, itemId: string) => void;
    giveContainerItem: (fromChampionId: number, toChampionId: number, containerItemId: string, itemId: string) => void;
    equipContainerItem: (championId: number, containerItemId: string, itemId: string, slotKey: EquipSlotKey) => void;
    dropContainerItem: (championId: number, containerItemId: string, itemId: string) => void;
    killChampion: (championId: number) => void;
    resurrectChampion: (bonesItemId: string) => void;
    useItem: (championId: number, itemId: string, fromSlot?: EquipSlotKey | 'inventory') => void;
    drinkFromFountain: (championId: number) => void;
    fillWaterContainer: (championId: number, itemId: string) => void;
    sleep: () => void;
    wakeUp: () => void;
    togglePause: () => void;
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

function buildStoreTickFramePatch(
    state: GameState,
    delta: number,
    now: number,
): GameState | Partial<GameState> {
    return buildStoreTickFramePatchSystem(
        state,
        delta,
        now,
        {
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
                            buildPendingGeneratorRuntimeDeps(),
                        ),
                    applyCombatTick: buildCombatTickPatch,
                    isPartyRested: isPartyRestedRuntime,
                },
            ),
            originalTimerTickSeconds: ORIGINAL_TIMER_TICK_SECONDS,
            advanceSurvivalTime: (currentRegenState, stepCount) =>
                advanceSurvivalTimeRuntime(currentRegenState, stepCount),
            applyCombatTick: buildCombatTickPatch,
            buildSensorStateSnapshot,
            buildPendingWorldEventDeps,
            processPendingSensorEvents: (pendingDelta, pendingSensorEvents, sensorState, deps) =>
                processPendingSensorEventsSystem(
                    pendingDelta,
                    pendingSensorEvents,
                    sensorState,
                    deps,
                ),
            processPendingGeneratorSpawns: (pendingDelta, pendingGeneratorSpawns, sensorState, deps) =>
                processPendingGeneratorSpawnsSystem(
                    pendingDelta,
                    pendingGeneratorSpawns,
                    sensorState,
                    deps,
                ),
            generatorRuntimeDeps: buildPendingGeneratorRuntimeDeps(),
            applyImmediateTransportSquareEffects,
        },
    );
}

function buildStoreExplorationRegenPatch(
    state: GameState,
    delta: number,
): Partial<GameState> | null {
    return buildStoreExplorationRegenPatchSystem(
        state,
        delta,
        {
            originalTimerTickSeconds: ORIGINAL_TIMER_TICK_SECONDS,
            advanceSurvivalTime: (currentState, stepCount) =>
                advanceSurvivalTimeRuntime(currentState, stepCount),
        },
    );
}

function buildStorePersistenceRuntimeMaps() {
    return {
        creatureTimers,
        creatureAttackWindows,
        creatureConfusedUntil,
        creatureFluxcageUntil,
        creatureFrightenedUntil,
        creatureLastSeenPartyPos,
    };
}

const storeViAltarInteractionDeps = createStoreViAltarInteractionPatchDeps<GameState, Partial<GameState>>({
    getTile: (level: number, x: number, y: number) => getMap(level).tiles[y]?.[x],
    isAltarWallFaceSystem,
    buildBaseResurrectionPatch: (
        currentState: GameState,
        deadChampionId: number,
        consumedItemId: string,
        carriedChampionId: number | null,
    ) =>
        buildViAltarResurrectionPatchSystem(currentState, deadChampionId, consumedItemId, carriedChampionId, {
            createChampionVitals,
            maxFood: MAX_FOOD,
            maxWater: MAX_WATER,
        }),
    decorateResurrectionPatch: decorateViAltarResurrectionPatch,
});

const storeResurrectChampionRuntimeDeps = createStoreResurrectChampionRuntimeDeps<GameState, Partial<GameState>>({
    maxPartySize: MAX_PARTY,
    isAltarTile: (level, x, y) =>
        isAltarTileSystem(level, x, y, (mapLevel, tileX, tileY) => getMap(mapLevel).tiles[tileY]?.[tileX]),
    buildViAltarResurrectionPatch: (currentState, deadChampionId, targetBonesItemId, carriedBy) =>
        buildViAltarResurrectionPatchSystem(currentState, deadChampionId, targetBonesItemId, carriedBy, {
            createChampionVitals,
            maxFood: MAX_FOOD,
            maxWater: MAX_WATER,
        }),
});

const storeUseItemRuntimeDeps = createStoreUseItemRuntimeDeps({
    locateChampionItem,
    getEffectiveChampionStatsRuntime,
    normalizeChampionCurrentStats,
    consumptionDeps: {
        isOriginalConsumableItem,
        isWaterContainer,
        consumeWaterContainer,
        clampFoodWater,
        getPotionDef,
        getMiscNutrition: (typeId) => {
            const def = MISC_TYPES[typeId];
            return def?.food && def.nutrition ? def.nutrition : null;
        },
        resolvePotionConsumption: (args) => resolvePotionConsumption(args, {
            adjustStatisticCurrentValue: adjustOriginalStatisticCurrentValue,
            buildEmptyFlaskReplacement: (item) => buildEmptyFlaskReplacementRuntime(item, resolveItemName),
            getPartyShieldKind: getOriginalPartyShieldKind,
            quantizeDurationMs: quantizeMsToOriginalTimerTicks,
            healChampionWounds: healChampionWoundsOriginal,
            timerTickMs: ORIGINAL_TIMER_TICK_MS,
        }),
        maxFood: MAX_FOOD,
        maxWater: MAX_WATER,
    },
    buildUseItemPatch,
});

const storeFillWaterRuntimeDeps = createStoreFillWaterRuntimeDeps({
    isFacingFountain: (currentState) => isFacingFountainSystem(
        currentState.level,
        currentState.position,
        currentState.direction,
        {
            getTile: (level, x, y) => getMap(level).tiles[y]?.[x],
            hasEffectiveOriginalWallOverlayAt,
        },
    ),
    canFillWaterContainer,
    fillWaterContainer,
});

const storeDrinkFromFountainRuntimeDeps = createStoreDrinkFromFountainRuntimeDeps({
    isFacingFountain: (currentState) => isFacingFountainSystem(
        currentState.level,
        currentState.position,
        currentState.direction,
        {
            getTile: (level, x, y) => getMap(level).tiles[y]?.[x],
            hasEffectiveOriginalWallOverlayAt,
        },
    ),
    clampWater: (value) => clampFoodWater(value, MAX_WATER),
    waterGain: 800,
});

const runStoreAttackFrontAction = createStoreAttackFrontAction<GameState>({
    getWeaponAttackOptions: (item) => getWeaponAttackOptions(item ?? undefined),
    getRequiredAmmoRawClass,
    getAttackCooldownSeconds,
    isAttackOptionUsableAtMastery,
    getAttackUnusableReason: getAttackOptionUnusableReason,
    isPhysicalAttack,
    isShootAttack,
    isThrowAttack,
    getChampionMasteryLevel: (currentState, championId, _champion, skill) =>
        getChampionMasteryLevel(currentState as GameState, championId, skill),
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
    originalThrowingDistance: (
        champion,
        equip,
        currentStamina,
        item,
        descriptor,
        fighterMastery,
        ninjaMastery,
        extraBonuses,
    ) => originalThrowingDistance(
        champion,
        equip,
        currentStamina,
        item,
        descriptor,
        fighterMastery,
        ninjaMastery,
        extraBonuses,
        Math.random,
    ),
    getThrownPotionExplosionEffect,
    buildDroppedItem,
    getWeaponName,
    buildChampionSkillExperiencePatch: (currentState, championId, skill, amount) =>
        buildChampionSkillExperiencePatchOriginal(currentState as GameState, championId, skill, amount),
    getChampionRuntimeBonuses,
    resolveAttackFrontContext,
    resolveClimbDown: (climbDownState, climbDownBase) => resolveClimbDownActionSystem(
        climbDownState as GameState,
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
    clearCreatureControlStatuses,
    getEndgameMessagesForMap,
    dropCreatureCarriedItems: (creatures, floorItems, creatureId) =>
        dropCreatureCarriedItemsRuntime(creatures, floorItems, creatureId, randomInt),
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
});

const runStoreCastSpellAction = createStoreCastSpellAction<GameState>({
    createRuntimeDeps: (state) => {
        const castRuntimePartyDamageDeps = buildRuntimePartyDamageDeps();
        return createStoreCastSpellRuntimeDeps(state, {
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
                lastCastResult: { success: false, message: getTranslations().runtime.unknownRuneCombination, ts: currentNow },
              }),
            getChampionMasteryLevel: (currentState, targetChampionId, _champion, skill) =>
                getChampionMasteryLevel(currentState as GameState, targetChampionId, skill),
            rollCastCheck: (champion, equip, activePotionBoosts, vitals, spell, skillLevel) =>
                rollOriginalSpellCastSuccess(
                    champion,
                    equip,
                    activePotionBoosts,
                    vitals,
                    spell,
                    skillLevel,
                    {
                        randomInt,
                        getEffectiveChampionStatsRuntime,
                    },
                ),
            buildChampionSkillExperiencePatch: (currentState, targetChampionId, skill, amount) =>
                buildChampionSkillExperiencePatchOriginal(currentState as GameState, targetChampionId, skill, amount),
            originalTimerTicksToSeconds,
            createChampionCombatState,
            randomInt,
            quantizeDurationMs: quantizeMsToOriginalTimerTicks,
            buildDroppedItem,
            getEffectiveChampionStats: getEffectiveChampionStatsRuntime,
            getImmediateDoor: (currentState, level, x, y) => getClosedDoorAt(currentState, level, x, y, {
                getMap,
                getDoorObject: (tile) => getDoorObject(tile) ?? null,
            }),
            isImmediatelyBlocked: (currentState, level, x, y) => isBlockedForProjectile(currentState, level, x, y, {
                getMap,
                getDoorObject: (tile) => getDoorObject(tile) ?? null,
                doorBlocksThrownItems,
            }),
            buildBlockedPoisonCloud: buildActivePoisonCloud,
            mergeBasePatch: (basePatch, nextPatch) => ({
                ...basePatch,
                ...nextPatch,
            }),
        });
    },
    doorMotionDeps: {
        playDoorMotion,
        getDoorSoundVolume,
        doorToggleSoundDurationMs: DOOR_TOGGLE_SOUND_DURATION_MS,
    },
});

function playSpellVisualImpactSounds(
    previousSpellVisualEvents: GameState['spellVisualEvents'],
    nextSpellVisualEvents: GameState['spellVisualEvents'] | undefined,
): void {
    if (!nextSpellVisualEvents || nextSpellVisualEvents === previousSpellVisualEvents) return;
    const sounds = resolveSpellVisualSoundNames(previousSpellVisualEvents, nextSpellVisualEvents);
    for (const sound of sounds) {
        if (sound === 'exploding_fireball') {
            playExplodingFireball();
            continue;
        }
        playExplodingSpell();
    }
}

function applyDroppedFloorItemRuntimeEffects(
    state: GameState,
    patch: Partial<GameState> | GameState | null,
): Partial<GameState> | GameState | null {
    if (!patch || patch === state) return patch;

    const nextFloorItems = patch.floorItems;
    if (!nextFloorItems || nextFloorItems === state.floorItems) return patch;

    const existingIds = new Set(state.floorItems.map((item) => item.id));
    const addedItems = nextFloorItems.filter((item) => !existingIds.has(item.id));
    if (addedItems.length === 0) return patch;

    let currentPatch: Partial<GameState> = {
        ...(patch as Partial<GameState>),
        floorItems: nextFloorItems,
    };
    let currentPendingSensorEvents = currentPatch.pendingSensorEvents ?? state.pendingSensorEvents;

    for (const item of addedItems) {
        const sensorState = buildSensorStateSnapshot({
            ...state,
            ...currentPatch,
        });
        const sensorResult = triggerFloorSensorsSystem(
            item.mapIndex,
            item.x,
            item.y,
            sensorState,
            state.championInventories,
            state.championEquipment,
            currentPatch.floorItems ?? nextFloorItems,
            currentPendingSensorEvents,
            buildMovementSensorDeps(),
            'enter',
            'item',
        );
        currentPendingSensorEvents = sensorResult.pendingSensorEvents;
        currentPatch = {
            ...currentPatch,
            ...sensorResult.sensorChanges,
            floorItems: currentPatch.floorItems ?? nextFloorItems,
            pendingSensorEvents: currentPendingSensorEvents,
        };
    }

    return applyFloorItemTeleporterEffects(
        state,
        applyImmediateTransportSquareEffects(state, currentPatch) as Partial<GameState>,
    );
}

function applyFloorItemTeleporterEffects(
    state: GameState,
    patch: Partial<GameState> | GameState | null,
): Partial<GameState> | GameState | null {
    if (!patch || patch === state) return patch;
    return applyFloorItemTeleporterEffectsSystem(state, patch as Partial<GameState>, {
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
            source,
            mode,
        ) => triggerFloorSensorsSystem(
            level,
            x,
            y,
            sensorState as SensorState,
            inventories,
            equipment,
            floorItems,
            pendingSensorEvents as PendingSensorEvent[],
            buildMovementSensorDeps(),
            mode,
            source,
        ),
        resolveProjectileTeleporterTransport: (transportState, level, x, y, direction, transportKind) =>
            resolveProjectileTeleporterTransportSystem(
                transportState,
                level,
                x,
                y,
                direction,
                buildTerrainTransportDeps(),
                transportKind,
            ),
    });
}

const runStoreTickSpellsAction = (state: GameState, now: number) => {
    const tickSpellsPartyDamageDeps = createStoreTickSpellsRuntimePartyDamageDeps(
        buildRuntimePartyDamageDeps(),
        { attackType: 'Normal', allowedSlots: [] },
    );
    const runtimeDeps = createStoreTickSpellsRuntimeDeps(
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
                attackType as OriginalProjectileIncomingAttackType,
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
            dropCreatureCarriedItems: (creatures, floorItems, creatureId) =>
                dropCreatureCarriedItemsRuntime(creatures, floorItems, creatureId, randomInt),
            buildDeathDustEvent,
            buildCreatureDamageEvent,
            creatureAttackWindows,
            onDoorMotion: playDoorMotion,
            getDoorSoundVolume,
            footprintLifetimeMs: FOOTPRINT_LIFETIME_MS,
            damageEventLifetimeMs: DAMAGE_EVENT_LIFETIME_MS,
        },
    );

    const patch = buildStoreTickSpellsRuntimePatch(state, now, runtimeDeps);
    const nextPatch = applyDroppedFloorItemRuntimeEffects(state, patch) as Partial<GameState> | null;
    playSpellVisualImpactSounds(state.spellVisualEvents, nextPatch?.spellVisualEvents);
    return nextPatch;
};

const runStoreMonsterTickActionBase = createStoreMonsterTickAction<GameState>((state) =>
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
                adjustByAttribute: adjustOriginalAttackByAttribute,
                applyPoison: applyPoisonCharacterOriginal,
                getParryMastery: (champion) => getChampionMasteryLevel(currentState as GameState, champion.id, 'parry'),
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
);

function applyCreatureFloorSensorRuntimeEffects(
    state: GameState,
    patch: Partial<GameState> | null,
): Partial<GameState> | null {
    if (!patch) return patch;

    const nextCreatures = patch.creatures ?? state.creatures;
    if (nextCreatures === state.creatures) return patch;

    const previousById = new Map(state.creatures.map((creature) => [creature.id, creature]));
    const movedCreatures = nextCreatures.filter((creature) => {
        const previous = previousById.get(creature.id);
        return (
            previous &&
            previous.alive &&
            creature.alive &&
            (
                previous.mapIndex !== creature.mapIndex ||
                previous.x !== creature.x ||
                previous.y !== creature.y
            )
        );
    });
    if (movedCreatures.length === 0) return patch;

    let currentPatch: Partial<GameState> = {
        ...patch,
        creatures: nextCreatures,
    };
    let currentPendingSensorEvents = currentPatch.pendingSensorEvents ?? state.pendingSensorEvents;

    for (const creature of movedCreatures) {
        const previous = previousById.get(creature.id);
        if (!previous) continue;

        const applySensorPhase = (
            level: number,
            x: number,
            y: number,
            mode: 'enter' | 'leave',
        ) => {
            const sensorState = buildSensorStateSnapshot({
                ...state,
                ...currentPatch,
            });
            const sensorResult = triggerFloorSensorsSystem(
                level,
                x,
                y,
                sensorState,
                currentPatch.championInventories ?? state.championInventories,
                currentPatch.championEquipment ?? state.championEquipment,
                currentPatch.floorItems ?? state.floorItems,
                currentPendingSensorEvents,
                buildMovementSensorDeps(),
                mode,
                'creature',
                currentPatch.creatures ?? nextCreatures,
            );
            currentPendingSensorEvents = sensorResult.pendingSensorEvents;
            currentPatch = {
                ...currentPatch,
                ...sensorResult.sensorChanges,
                pendingSensorEvents: currentPendingSensorEvents,
            };
        };

        applySensorPhase(previous.mapIndex, previous.x, previous.y, 'leave');
        applySensorPhase(creature.mapIndex, creature.x, creature.y, 'enter');
    }

    return currentPatch;
}

const runStoreMonsterTickAction = (state: GameState, delta: number) =>
    applyCreatureFloorSensorRuntimeEffects(
        state,
        runStoreMonsterTickActionBase(state, delta) as Partial<GameState> | null,
    );

const PICKUP_FULL_FEEDBACK_LIFETIME_MS = 520;

function buildInventoryFullFeedbackPatch(
    state: GameState,
    itemId: string,
    championId: number,
) {
    if (!isFloorItemPickupBlockedByFullInventory(state, itemId, championId)) return null;
    return {
        inventoryFullFeedback: {
            championId,
            ts: Date.now() + PICKUP_FULL_FEEDBACK_LIFETIME_MS,
        },
    };
}

function buildStorePickupItemPatch(
    state: GameState,
    itemId: string,
    championId: number,
) {
    return buildPickupItemToChampionRuntimePatch(state, itemId, championId, floorItemCommandDeps);
}

function buildStoreDropInventoryItemPatch(
    state: GameState,
    championId: number,
    itemId: string,
) {
    return buildDropInventoryItemRuntimePatch(state, championId, itemId, floorItemCommandDeps);
}

function resolveFrontTilePosition(
    position: [number, number],
    direction: Direction,
): { x: number; y: number } {
    const [y, x] = position;
    if (direction === 'NORTH') return { x, y: y - 1 };
    if (direction === 'SOUTH') return { x, y: y + 1 };
    if (direction === 'EAST') return { x: x + 1, y };
    return { x: x - 1, y };
}

function canPlaceDungeonDraggedItemOnTile(
    state: GameState,
    x: number,
    y: number,
): boolean {
    const tile = getMap(state.level).tiles[y]?.[x];
    if (!tile) return false;
    if (tile.type === 'Wall') return false;
    if (tile.type === 'TrickWall') {
        return state.openWalls.has(`${state.level},${y},${x}`);
    }
    if (tile.type === 'Door') {
        return state.openDoors.has(`${state.level},${y},${x}`);
    }
    return true;
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
        buildAttackResultMessage(getTranslations().runtime.completeFirestaffOnlyViaAmalgam),
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
        source,
        mode,
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
        mode,
        source,
    ),
    applyImmediateTransportSquareEffects: (state, patch) =>
        applyImmediateTransportSquareEffects(state, patch),
});

// ─── Store ────────────────────────────────────────────────────────────────────

const storeCreator: StateCreator<GameState> = (set, get) => ({
    ...buildFreshDungeonState(DEFAULT_GAME_OPTIONS, 'title'),

    moveForward: () => {
        runStoreMovementAction<GameState>({
            command: 'forward',
            now: Date.now(),
            applyState: set,
            buildDeps: () => buildStorePartyMoveDeps(true),
            playWallBump,
            playFallingAndDying,
            showTransientMessage: (message) => get().showTransientMessage(message),
        });
    },

    moveBackward: () => {
        runStoreMovementAction<GameState>({
            command: 'backward',
            now: Date.now(),
            applyState: set,
            buildDeps: () => buildStorePartyMoveDeps(false),
            playWallBump,
            playFallingAndDying,
            showTransientMessage: (message) => get().showTransientMessage(message),
        });
    },

    strafeLeft: () => {
        runStoreMovementAction<GameState>({
            command: 'strafeLeft',
            now: Date.now(),
            applyState: set,
            buildDeps: () => buildStorePartyMoveDeps(false),
            playWallBump,
            playFallingAndDying,
            showTransientMessage: (message) => get().showTransientMessage(message),
        });
    },

    strafeRight: () => {
        runStoreMovementAction<GameState>({
            command: 'strafeRight',
            now: Date.now(),
            applyState: set,
            buildDeps: () => buildStorePartyMoveDeps(false),
            playWallBump,
            playFallingAndDying,
            showTransientMessage: (message) => get().showTransientMessage(message),
        });
    },

    turnLeft: () => set((state) => buildTurnLeftPatch(state) ?? state),

    turnRight: () => set((state) => buildTurnRightPatch(state) ?? state),

    addToParty: (champion, mode = 'resurrect') => set((state) =>
        buildAddToPartyPatch(state, champion, mode, {
            maxPartySize: MAX_PARTY,
            createReincarnatedChampion: (candidate) =>
                createReincarnatedChampionSystem(candidate, randomInt),
            getChampionStarterLoadout,
            seedTorchBurnStartFromEquipment,
            createChampionVitals,
            createEmptyChampionXP,
            buildInitialChampionXP,
            createEmptyChampionTemporaryXP,
            createChampionCombatState,
        }) ?? state
    ),

    removeFromParty: (championId) => set((state) => buildRemoveFromPartyPatch(state, championId)),

      openMirror:       (championId) => set(buildOpenMirrorPatch(championId)),
      closeMirror:      () => set(buildCloseMirrorPatch()),
      openPartyMember:  (championId) => set(buildOpenPartyMemberPatch(championId)),
      closePartyMember: () => set(buildClosePartyMemberPatch()),

      tryOpenGate: () => set((state) => buildTryOpenGatePatch(state.party.length, MAX_PARTY)),

    showTransientMessage: (message, success = false, durationMs = TRANSIENT_MESSAGE_LIFETIME_MS) => {
        showStoreLastCastResultMessage<GameState, CastResult>(message, success, durationMs, {
            buildResult: (nextMessage, nextSuccess) => buildAttackResultMessage(nextMessage, nextSuccess),
            applyPatch: (patch) => set(patch),
            getCurrentResult: () => get().lastCastResult,
            clearLastCastResult: () => set({ lastCastResult: null }),
            readTimestamp: (value) => (value && typeof value === 'object' && 'ts' in value && typeof value.ts === 'number')
                ? value.ts
                : null,
        });
    },

      goToLevel: (level, pos, dir) => set((state) => ({
        ...(buildStoreLevelHydrationPatch(state, level) ?? {}),
        ...buildGoToLevelPatch(level, pos, dir),
      })),

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
        runStoreWallSensorActivationAction<GameState, SensorState, PendingSensorEvent, Partial<GameState>>(
            state,
            mapIndex,
            x,
            y,
            sensorIndex,
            buildWallSensorActivationDeps,
        )
    ),

    useItemOnFrontWall: (championId, itemId, fromSlot) =>
        runStoreChampionItemOnFrontWallAction<GameState, SensorState, Partial<GameState>>(
            get(),
            championId,
            itemId,
            fromSlot,
            buildFrontWallInteractionDeps,
            {
                applyPatch: (patch) => set(patch),
                playPlate,
            },
        ),

    useFloorItemOnFrontWall: (itemId, championId) =>
        runStoreFloorItemOnFrontWallAction<GameState, SensorState, Partial<GameState>>(
            get(),
            itemId,
            championId,
            buildFrontWallInteractionDeps,
            {
                applyPatch: (patch) => set(patch),
                playPlate,
            },
        ),

    useItemOnViAltar: (championId, itemId, fromSlot, altarX, altarY, altarFace) =>
        runStoreOptionalPatchAction(
            () => buildStoreChampionItemOnViAltarPatch(
                get(),
                championId,
                itemId,
                fromSlot,
                altarX,
                altarY,
                altarFace,
                storeViAltarInteractionDeps,
            ),
            (patch) => set(patch),
        ),

    useFloorItemOnViAltar: (itemId, _championId, altarX, altarY, altarFace) =>
        runStoreOptionalPatchAction(
            () => buildStoreFloorItemOnViAltarPatch(
                get(),
                itemId,
                altarX,
                altarY,
                altarFace,
                storeViAltarInteractionDeps,
            ),
            (patch) => set(patch),
        ),

    beginFloorDrag: (itemId, pointerX, pointerY) => set((state) => {
        const item = state.floorItems.find((entry) => entry.id === itemId);
        if (!item || !canPartyReachFloorItem(state, item)) return state;
        return buildBeginFloorDragPatch(itemId, pointerX, pointerY);
    }),
    updateFloorDrag: (pointerX, pointerY) => set((state) =>
        buildUpdateFloorDragPatch(state, pointerX, pointerY) ?? state
    ),
    endFloorDrag: () => set(buildEndFloorDragPatch()),

    killCreature: (id) => set((state) =>
        buildKillCreaturePatch(state, id, {
            dropCreatureCarriedItems: (creatures, floorItems, creatureId) =>
                dropCreatureCarriedItemsRuntime(creatures, floorItems, creatureId, randomInt),
        })
    ),

    killChampion: (championId) => set((state) =>
        buildStoreKillChampionPatch(state, championId, Date.now(), {
            applyChampionDeathDropsToPartyState: (deathState, championIds, now) =>
                applyChampionDeathDropsToPartyState(
                    deathState,
                    championIds,
                    now,
                    {
                        buildDeathDrop: buildDeathDropSystem,
                    },
                ),
        }) ?? state
    ),

    selectChampion: (index) => set(buildSelectChampionPatch(index)),

    setGameOptions: (updater) => set((state) => buildSetGameOptionsPatch(state, updater)),

    openOptionsModal: () => set(buildOpenOptionsModalPatch()),
    closeOptionsModal: () => set(buildCloseOptionsModalPatch()),
    setTutorialOverlayActive: (active) => set(buildSetTutorialOverlayActivePatch(active)),

    reorderParty: (fromIndex, toIndex) => set((state) =>
        buildReorderPartyPatch(state, fromIndex, toIndex) ?? state
    ),

    pickupItem: (id) => set((state) => {
        const pickupPatch = buildStoreSelectedChampionPickupPatch(state, id, {
            buildPickupPatch: buildStorePickupItemPatch,
        });
        if (pickupPatch) return pickupPatch;

        const activeChampion = state.party[state.selectedChampionIndex];
        return activeChampion
            ? (buildInventoryFullFeedbackPatch(state, id, activeChampion.id) ?? state)
            : state;
    }),

    pickupItemToChampion: (id, championId) => {
        const applied = runStoreOptionalPatchAction(
            () => buildStorePickupItemPatch(get(), id, championId),
            (patch) => set(patch),
        );
        if (!applied) {
            const feedbackPatch = buildInventoryFullFeedbackPatch(get(), id, championId);
            if (feedbackPatch) set(feedbackPatch);
        }
        return applied;
    },

    dropItem: (itemId, championId) => {
        const state = get();
        const patch = applyFloorItemTeleporterEffects(
            state,
            buildStoreDropInventoryItemPatch(state, championId, itemId),
        );
        if (!patch) return;
        set(patch);
        playFallingItem();
    },

    dropCarriedItem: (championId, itemId, fromSlot) =>
        runStoreOptionalPatchAction(
            () => {
                const state = get();
                return applyFloorItemTeleporterEffects(
                    state,
                    buildDropCarriedItemRuntimePatch(state, championId, itemId, fromSlot, {
                        dropChampionCarriedItem,
                    }),
                );
            },
            (patch) => {
                set(patch);
                playFallingItem();
            },
        ),

    dropCarriedItemInFront: (championId, itemId, fromSlot) =>
        runStoreOptionalPatchAction(
            () => {
                const state = get();
                const { x, y } = resolveFrontTilePosition(state.position, state.direction);
                if (!canPlaceDungeonDraggedItemOnTile(state, x, y)) return null;
                const basePatch = removeChampionCarriedItemToTile(state, championId, itemId, fromSlot, x, y);
                if (!basePatch) return null;
                const nextFloorItems = (basePatch.floorItems as FloorItem[] | undefined) ?? state.floorItems;
                const sensorChanges = triggerFloorSensorsSystem(
                    state.level,
                    x,
                    y,
                    buildSensorStateSnapshot(state),
                    state.championInventories,
                    state.championEquipment,
                    nextFloorItems,
                    state.pendingSensorEvents,
                    buildMovementSensorDeps(),
                    'enter',
                    'item',
                );
                return applyFloorItemTeleporterEffects(
                    state,
                    {
                    ...basePatch,
                    ...sensorChanges.sensorChanges,
                    pendingSensorEvents: sensorChanges.pendingSensorEvents,
                    },
                );
            },
            (patch) => {
                set(patch);
                playFallingItem();
            },
        ),

    throwCarriedItem: (championId, itemId, fromSlot) =>
        runStoreOptionalPatchAction(
            () => buildThrowCarriedItemRuntimePatch(
                get(),
                championId,
                itemId,
                fromSlot,
                {
                    buildThrowXpPatch: (currentState, targetChampionId) =>
                        buildChampionSkillExperiencePatchOriginal(currentState, targetChampionId, 'throw', 5),
                    throwChampionCarriedItem,
                    buildProjectile: (currentState, championId, champion, item) =>
                        buildDragThrowProjectile(currentState, championId, champion, item, {
                            randomFraction: Math.random,
                            nowMs: () => Date.now(),
                            getChampionRuntimeBonuses,
                        }),
                },
            ),
            (patch) => {
                set(patch);
                playFallingItem();
            },
        ),

    moveFloorItemToCurrentTile: (itemId, championId) =>
        runStoreOptionalPatchAction(
            () => {
                const state = get();
                const [y, x] = state.position;
                return applyFloorItemTeleporterEffects(
                    state,
                    buildMoveFloorItemToTileRuntimePatch(state, itemId, championId, x, y, floorItemCommandDeps),
                );
            },
            (patch) => {
                set(patch);
                playFallingItem();
            },
        ),

    moveFloorItemToFrontTile: (itemId, championId) =>
        runStoreOptionalPatchAction(
            () => {
                const state = get();
                const { x, y } = resolveFrontTilePosition(state.position, state.direction);
                if (!canPlaceDungeonDraggedItemOnTile(state, x, y)) return null;
                return applyFloorItemTeleporterEffects(
                    state,
                    buildMoveFloorItemToTileRuntimePatch(state, itemId, championId, x, y, floorItemCommandDeps),
                );
            },
            (patch) => set(patch),
        ),

    throwFloorItem: (itemId, championId) =>
        runStoreOptionalPatchAction(
            () =>
                buildThrowFloorItemRuntimePatch(get(), itemId, championId, {
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
                        source,
                        mode,
                    ) => triggerFloorSensorsSystem(
                        level,
                        x,
                        y,
                        sensorState as SensorState,
                        inventories,
                        equipment,
                        floorItems,
                        pendingSensorEvents as PendingSensorEvent[],
                        buildMovementSensorDeps(),
                        mode,
                        source,
                    ),
                    buildProjectile: (currentState, targetChampionId, champion, item) =>
                        buildDragThrowProjectile(currentState, targetChampionId, champion, item, {
                            randomFraction: Math.random,
                            nowMs: () => Date.now(),
                            getChampionRuntimeBonuses,
                        }),
                    buildThrowXpPatch: (currentState, targetChampionId) =>
                        buildChampionSkillExperiencePatchOriginal(currentState, targetChampionId, 'throw', 5),
                }),
            (patch) => set(patch),
        ),

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

    storeItemInContainer: (championId, itemId, fromSlot, containerItemId) => set((state) =>
        moveChampionItemToContainer(state, championId, itemId, fromSlot, containerItemId) ?? state,
    ),

    takeContainerItem: (championId, containerItemId, itemId) => set((state) =>
        moveContainerItemToChampionInventory(state, championId, containerItemId, itemId) ?? state,
    ),

    giveContainerItem: (fromChampionId, toChampionId, containerItemId, itemId) => set((state) =>
        giveChampionContainerItem(state, fromChampionId, toChampionId, containerItemId, itemId) ?? state,
    ),

    equipContainerItem: (championId, containerItemId, itemId, slotKey) => set((state) => {
        const containerItem = locateChampionItem(state, championId, containerItemId)?.item;
        const nestedItem = containerItem?.containerContents?.find((entry) => entry.id === itemId);
        if (!nestedItem || !canEquipItemInSlot(nestedItem, slotKey)) return state;
        return equipChampionContainerItem(state, championId, containerItemId, itemId, slotKey) ?? state;
    }),

    dropContainerItem: (championId, containerItemId, itemId) => set((state) =>
        dropChampionContainerItem(state, championId, containerItemId, itemId) ?? state,
    ),

    resurrectChampion: (bonesItemId) => set((state) =>
        buildStoreResurrectChampionPatch(state, bonesItemId, storeResurrectChampionRuntimeDeps) ?? state
    ),

    useItem: (championId, itemId, fromSlot = 'inventory') => {
        const state = get();
        const located = storeUseItemRuntimeDeps.locateChampionItem(state, championId, itemId, fromSlot);
        if (!located) return;
        const patch = buildStoreUseItemActionPatch(
            state,
            championId,
            itemId,
            fromSlot,
            Date.now(),
            storeUseItemRuntimeDeps,
        );
        if (!patch) return;
        set(patch);
        if (storeUseItemRuntimeDeps.resolveUseItemSound(located.item) === 'swallowing') {
            playSwallowing();
        }
    },

    drinkFromFountain: (championId) => {
        const state = get();
        const patch = buildStoreDrinkFromFountainPatch(state, championId, storeDrinkFromFountainRuntimeDeps);
        if (!patch) return;
        set(patch);
        playSwallowing();
    },

    fillWaterContainer: (championId, itemId) => set((state) =>
        buildStoreFillWaterPatch(state, championId, itemId, storeFillWaterRuntimeDeps) ?? state
    ),

    sleep: () => set((state) =>
        buildToggleSleepPatch(state, {
            isPartyRested: isPartyRestedRuntime,
        }) ?? state
    ),

    wakeUp: () => set((state) => buildWakeUpPatch(state) ?? state),

    togglePause: () => set((state) => buildTogglePausePatch(state) ?? state),

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
        return saveStoreGame(state, buildStorePersistenceRuntimeMaps(), writePersistedSave);
    },

    loadGame: (): boolean =>
        runStoreOptionalPatchAction(
            () => loadStoreGamePatch<PendingSensorEvent, PendingGeneratorSpawnEvent>(
                readBestPersistedSave(),
                Date.now(),
                buildStorePersistenceRuntimeMaps(),
                tryParsePersistedSaveDataSystem,
            ),
            (patch) => set(patch),
        ),

    returnToTitle: () => set(buildStoreReturnToTitlePatch()),

    castSpell: (championId, runeIds) => {
        const state = get();
        const patch = runStoreCastSpellAction(state, championId, runeIds, Date.now());
        if (!patch) return;
        set(patch);
        playSpellVisualImpactSounds(state.spellVisualEvents, patch.spellVisualEvents);
    },

    tickGameplayFrame: (delta, now) => set((state) => {
        const shouldRunRealtimeTicks =
            !state.optionsModalOpen &&
            !state.paused &&
            state.gamePhase !== 'title' &&
            state.gamePhase !== 'victory' &&
            state.gamePhase !== 'game_over';

        if (!shouldRunRealtimeTicks) {
            return state;
        }

        const applyPatch = (
            baseState: GameState,
            patch: GameState | Partial<GameState> | null | undefined,
        ): GameState => {
            if (!patch) return baseState;
            return { ...baseState, ...patch } as GameState;
        };

        let nextState = applyPatch(state, buildStoreTickFramePatch(state, delta, now));
        const shouldRunExplorationTicks =
            (state.gamePhase === 'exploration' || state.gamePhase === 'mirror_open') &&
            !state.sleeping;

        if (shouldRunExplorationTicks) {
            nextState = applyPatch(nextState, runStoreMonsterTickAction(nextState, delta));
            nextState = applyPatch(
                nextState,
                buildStoreTickDoorsPatch(
                    nextState,
                    delta,
                    {
                        doorReboundDurationSeconds: DOOR_REBOUND_DURATION_SECONDS,
                        doorRecloseDurationSeconds: DOOR_RECLOSE_DURATION_SECONDS,
                        buildCreatureDamageEvent,
                        playWallBump,
                    },
                ) as Partial<GameState> | null | undefined,
            );
            nextState = applyPatch(nextState, runStoreTickSpellsAction(nextState, now));
        }

        return nextState;
    }),

    tickFrame: (delta, now) => set((state) => buildStoreTickFramePatch(state, delta, now) ?? state),

    regenTick: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        return buildStoreExplorationRegenPatch(state, delta) ?? state;
    }),

    tickMovement: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        return buildStoreMovementTickPatch(state, delta) ?? state;
    }),

    // ─── XP ───────────────────────────────────────────────────────────────────
    gainXP: (championId, skill, amount) => set((state) => {
        if (amount <= 0) return state;
        return buildChampionSkillExperiencePatchOriginal(state, championId, skill, amount) ?? state;
    }),

    // ─── Weapon action / physical attack ─────────────────────────────────────
    attackFront: (championId, attackType) => set((state) => {
        return runStoreAttackFrontAction(state, championId, attackType) ?? state;
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
    tickMonsters: (delta) => set((state) => runStoreMonsterTickAction(state, delta) ?? state),


    // ─── Combat tick (cooldowns + damage event cleanup) ───────────────────────
    // ─── Spell tick (lights expiry + projectile movement) ─────────────────────
    tickSpells: (now) => set((state) => runStoreTickSpellsAction(state, now) ?? state),

    tickCombat: (delta) => set((state) => {
        if (state.optionsModalOpen) return state;
        return buildStoreCombatTickPatch(state, delta, Date.now(), DAMAGE_EVENT_LIFETIME_MS) ?? state;
    }),
});

export const useStore = create<GameState>()(storeCreator);
