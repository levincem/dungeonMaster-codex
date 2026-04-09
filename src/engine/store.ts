import { create } from 'zustand';
import { getGameMap, GAME_MAPS, CHAMPION_START_POSITIONS } from '../data/mapLoader';
import { itemToLockData } from '../data/mechanisms';
import type {
    GameMap, GameTile, TeleporterObject,
    CreatureInstance, CreatureObject, FloorItem,
    SensorObject, WallTextObject, CardinalDir,
    ChampionEquipment, CreatureSide,
} from '../types/game';
import type { EquipSlotKey } from '../types/items';
import type { Champion } from '../data/champions';
import { CHAMPION_BY_ID } from '../data/champions';
import { buildChampionStarterLoadout } from '../data/championStarterItems';
import { CREATURE_TYPES } from '../data/creatures';
import type { CreatureDef } from '../data/creatures';
import { findSpell, getSkillLevel } from '../data/runes';
import type { CastSkill } from '../data/runes';
import { ARMOR_TYPES, WEAPON_TYPES, POTION_TYPES, MISC_TYPES, normalizeScrollText, resolveItemName } from '../data/items';
import {
    canEquipItemInSlot,
    EMPTY_CHAMPION_WOUNDS,
    getChampionMaxLoad,
    getEffectiveChampionStats,
    getTotalWeight,
} from '../data/equipment';
import type { ChampionWoundSlot, ChampionWounds } from '../data/equipment';
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
    mapOriginalSkillNumberToBasicSkill,
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
import { playPartyAttack, playCreatureMove, playCreatureAttack, playPlate } from './sounds';
import { readPersistedSave, writePersistedSave } from './saveGame';
import {
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
export type GamePhase = 'title' | 'exploration' | 'mirror_open';

// ─── Champion vitals (live HP / Stamina / Mana) ───────────────────────────────
export interface ChampionVitals {
    hp:      number;  // current hit points (0 … champion.health)
    stamina: number;  // current stamina    (0 … champion.stamina)
    mana:    number;  // current mana       (0 … champion.mana)
    food:    number;  // hunger reserve     (-1024 … 2048)
    water:   number;  // thirst reserve     (-1024 … 2048)
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
    x: number;     // creature tile x
    y: number;     // creature tile y
    amount: number;
    ts: number;    // Date.now() — auto-cleared after ~600 ms
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
            if (!item || item.category !== 'Weapon' || item.typeId !== 16) continue;
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

// ─── Active projectiles (fireball, lightning, poison bolt, plasma) ────────────
export type ProjectileEffect =
    | 'fireball'
    | 'lightning'
    | 'poison_bolt'
    | 'disrupt_nonmaterial'
    | 'plasma'
    | 'physical';

export interface Projectile {
    id: string;
    level: number;
    x: number;           // tile x
    y: number;           // tile y
    direction: Direction;
    effect: ProjectileEffect;
    damage: [number, number]; // [min, max]
    nextMoveAt: number;  // Date.now() ms — when to advance to next tile
    remainingRange?: number;
    remainingAttack?: number;
    stepDecay?: number;
    physicalItem?: FloorItem;
}

// ─── Party shields (magic shield / fire shield spells) ────────────────────────
export interface PartyShield {
    id: string;
    expiresAt: number;
    protection: number; // fraction of damage blocked (0.0–1.0)
    fireOnly: boolean;  // true = fire_shield only, false = all physical
}

// ─── Footprint trail (footprints spell) ──────────────────────────────────────
export interface FootprintEntry {
    x: number;
    y: number;
    level: number;
    ts: number; // Date.now() when placed
}

// ─── Champion XP (one counter per skill discipline) ───────────────────────────
export type ChampionXP = Record<CastSkill, number>;

/** Total accumulated XP → skill level. Formula: floor(sqrt(xp / 500)) */
export function xpToLevel(xp: number): number {
    return Math.max(0, Math.floor(Math.sqrt(xp / 500)));
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
        wounds: { ...EMPTY_CHAMPION_WOUNDS },
        poisonEntries: [],
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

function applyChampionHitWoundsApprox(
    vitals: ChampionVitals,
    champion: Champion,
    equip: ChampionEquipment | undefined,
    damage: number,
    hitZones: readonly ArmorCoverageZone[] | undefined,
): ChampionVitals {
    const allowedSlots = chooseChampionWoundSlotsFromZones(hitZones);
    if (allowedSlots.length === 0 || damage <= 0 || randomInt(3) !== 0) return vitals;

    const effective = getEffectiveChampionStats(champion, equip);
    const armorDefense = getAverageArmorForZones(equip, hitZones);
    let woundDefense = randomInt(Math.max(1, Math.floor(effective.vitality / 8) + 1));
    woundDefense += Math.floor(armorDefense / 2);

    let adjustedAttack = (damage * 3) + randomInt(24) + 6;
    if (adjustedAttack <= woundDefense) return vitals;

    let nextVitals = vitals;
    let woundThreshold = Math.max(1, woundDefense);
    do {
        const unwounded = allowedSlots.filter((slot) => !nextVitals.wounds[slot]);
        const pool = unwounded.length > 0 ? unwounded : allowedSlots;
        const slot = pool[randomInt(pool.length)];
        if (slot) nextVitals = applyChampionWound(nextVitals, slot);
        adjustedAttack >>= 1;
        woundThreshold <<= 1;
    } while (adjustedAttack > woundThreshold && adjustedAttack > 0);

    return nextVitals;
}

function adjustByAttributeApprox(value: number, currentAttribute: number): number {
    const factor = 170 - currentAttribute;
    if (factor < 16) return Math.floor(value / 8);
    return Math.floor((value * factor) / 128);
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
    maxHp: number,
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
    const lvlXP = (s: [number, number, number, number]) =>
        Math.pow(Math.max(s[0], s[2]), 2) * 500;
    return {
        fighter: lvlXP(champion.skills.fighter),
        ninja:   lvlXP(champion.skills.ninja),
        priest:  lvlXP(champion.skills.priest),
        wizard:  lvlXP(champion.skills.wizard),
    };
}

/** Weapon stats for the item in a champion's right hand (or unarmed). */
function getRightHandStats(equip: import('../types/game').ChampionEquipment | undefined): {
    name: string; dmgMin: number; dmgMax: number; cooldownSec: number; skill: CastSkill;
} {
    const item = equip?.rightHand;
    const selectedAttack = getDefaultAttackOption(item);
    if (item?.category === 'Weapon') {
        const wt = WEAPON_TYPES[item.typeId];
        if (wt && wt.atkSpd > 0) {
            const skill = selectedAttack
                ? mapOriginalSkillNumberToBasicSkill(selectedAttack.attack.skillNumber)
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

function getFrontPosition(position: [number, number], direction: Direction): { x: number; y: number } {
    const [y, x] = position;
    if (direction === 'NORTH') return { x, y: y - 1 };
    if (direction === 'SOUTH') return { x, y: y + 1 };
    if (direction === 'EAST') return { x: x + 1, y };
    return { x: x - 1, y };
}

function applyChampionAttackVitals(
    state: GameState,
    championId: number,
    champion: Champion,
    option: WeaponAttackOption | null,
) {
    const current = state.championVitals[championId];
    if (!current) return null;
    const effective = getEffectiveChampionStats(champion, state.championEquipment[championId] ?? {});
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
    skill: CastSkill,
): number {
    const xp = state.championXP[championId]?.[skill];
    if (xp !== undefined) return xpToLevel(xp);
    return getSkillLevel(champion.skills, skill);
}

function originalThrowingDistance(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    currentStamina: number | undefined,
    item: FloorItem,
    descriptor: ReturnType<typeof getOriginalWeaponReference>,
    fighterMastery: number,
    ninjaMastery: number,
): number {
    const effective = getEffectiveChampionStats(champion, equip ?? {});
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
    const effective = getEffectiveChampionStats(champion, equip);
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
): number {
    const effective = getEffectiveChampionStats(champion, equip ?? {});
    let quickness = effective.dexterity + randomInt(8);
    const load = getTotalWeight(equip ?? {}, inventory ?? []);
    const maxLoad = Math.max(1, getChampionMaxLoad(champion, equip, currentStamina, wounds));
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

type MonsterDamageClassApprox = 'physical' | 'fire' | 'magic';
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

function getEquippedArmorValue(equip: ChampionEquipment | undefined): number {
    if (!equip) return 0;
    let armor = 0;
    for (const item of Object.values(equip)) {
        if (!item || item.category !== 'Armor') continue;
        armor += ARMOR_TYPES[item.typeId]?.armor ?? 0;
    }
    return armor;
}

function getArmorValueForZone(equip: ChampionEquipment | undefined, zone: ArmorCoverageZone): number {
    if (!equip) return 0;

    const armorAt = (slot: keyof ChampionEquipment): number => {
        const item = equip[slot];
        return item?.category === 'Armor' ? (ARMOR_TYPES[item.typeId]?.armor ?? 0) : 0;
    };

    switch (zone) {
        case 'head':
            return armorAt('head') + Math.floor(armorAt('neck') / 2);
        case 'torso':
            return armorAt('torso') + Math.floor((armorAt('neck') + armorAt('belt')) / 2);
        case 'legs':
            return armorAt('legs') + Math.floor(armorAt('belt') / 2);
        case 'feet':
            return armorAt('feet');
        case 'hands':
            return armorAt('hands');
    }
}

function getAverageArmorForZones(
    equip: ChampionEquipment | undefined,
    zones: readonly ArmorCoverageZone[] | undefined,
): number {
    if (!zones || zones.length === 0) return getEquippedArmorValue(equip);
    const total = zones.reduce((sum, zone) => sum + getArmorValueForZone(equip, zone), 0);
    return Math.floor(total / zones.length);
}

function chooseMonsterDamageClassApprox(def: CreatureDef): MonsterDamageClassApprox {
    const weighted: MonsterDamageClassApprox[] = [];
    if (def.attackTypes.includes('Physical')) weighted.push('physical', 'physical');
    if (def.attackTypes.includes('Fire')) weighted.push('fire');
    if (def.attackTypes.includes('Magic') || def.attackTypes.includes('StaminaDrain')) weighted.push('magic');
    if (weighted.length === 0) return 'physical';
    return weighted[randomInt(weighted.length)] ?? 'physical';
}

function chooseMonsterHitZonesApprox(damageClass: MonsterDamageClassApprox): readonly ArmorCoverageZone[] | undefined {
    if (damageClass !== 'physical') return undefined;
    return MONSTER_HIT_ZONE_PATTERNS[randomInt(MONSTER_HIT_ZONE_PATTERNS.length)] ?? ['torso'];
}

function computeChampionResistanceApprox(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    damageClass: MonsterDamageClassApprox,
): number {
    const effective = getEffectiveChampionStats(champion, equip ?? {});
    if (damageClass === 'fire') {
        return Math.min(0.45, Math.max(0, effective.antiFire) / 220);
    }
    if (damageClass === 'magic') {
        return Math.min(0.45, Math.max(0, effective.antiMagic) / 220);
    }
    return 0;
}

function getActiveShieldProtectionApprox(
    shields: PartyShield[],
    nowMs: number,
    damageClass: MonsterDamageClassApprox,
): number {
    if (damageClass === 'fire') {
        return shields
            .filter((shield) => shield.expiresAt > nowMs)
            .reduce((max, shield) => Math.max(max, shield.protection), 0);
    }

    if (damageClass === 'magic') {
        return shields
            .filter((shield) => shield.expiresAt > nowMs && !shield.fireOnly)
            .reduce((max, shield) => Math.max(max, shield.protection), 0);
    }

    return shields
        .filter((shield) => shield.expiresAt > nowMs && !shield.fireOnly)
        .reduce((max, shield) => Math.max(max, shield.protection), 0);
}

function computeChampionProtectionApprox(
    state: GameState,
    championId: number,
    champion: Champion,
    currentVitals: ChampionVitals | undefined,
    damageClass: MonsterDamageClassApprox = 'physical',
    hitZones?: readonly ArmorCoverageZone[],
): number {
    const equip = state.championEquipment[championId] ?? {};
    const effective = getEffectiveChampionStats(champion, equip);
    const armorValue = getAverageArmorForZones(equip, hitZones);
    const vitalityRoll = randomInt(Math.max(1, Math.floor(effective.vitality / 16) + 1));
    const staminaGuard = currentVitals
        ? Math.floor((clampVital(currentVitals.stamina, effective.stamina) * 6) / Math.max(1, effective.stamina))
        : 6;
    const defenseModifier = state.championCombat[championId]?.defenseModifier ?? 0;
    const armorContribution =
        damageClass === 'physical'
            ? Math.floor(armorValue / 2)
            : damageClass === 'fire'
                ? Math.floor(armorValue / 4)
                : Math.floor(armorValue / 6);
    const elementalResistance =
        damageClass === 'fire'
            ? Math.floor(Math.max(0, effective.antiFire) / 8)
            : damageClass === 'magic'
                ? Math.floor(Math.max(0, effective.antiMagic) / 8)
                : 0;
    const rawProtection = vitalityRoll + defenseModifier + armorContribution + staminaGuard + elementalResistance;
    return applyLimits(0, rawProtection, 100);
}

function determineMonsterAttackDamageApprox(
    state: GameState,
    targetChampion: Champion,
    targetVitals: ChampionVitals,
    attacker: CreatureInstance,
    damageClass?: MonsterDamageClassApprox,
): { damage: number; hitZones?: readonly ArmorCoverageZone[] } {
    const def = CREATURE_TYPES[attacker.typeId];
    if (!def) return { damage: 0 };

    const equip = state.championEquipment[targetChampion.id] ?? {};
    const inventory = state.championInventories[targetChampion.id] ?? [];
    const effective = getEffectiveChampionStats(targetChampion, equip);
    const resolvedDamageClass = damageClass ?? chooseMonsterDamageClassApprox(def);
    const hitZones = chooseMonsterHitZonesApprox(resolvedDamageClass);
    const quickness = computeOriginalQuicknessApprox(targetChampion, equip, inventory, targetVitals.stamina, targetVitals.wounds);
    const levelDifficulty = getMap(state.level).difficulty * 2;
    const requiredQuickness = randomInt(32) + def.hitProb + levelDifficulty - 16;

    if (quickness >= requiredQuickness && randomInt(4) !== 0) {
        return { damage: 0, hitZones };
    }

    if (isCharacterLuckyApprox(effective.luck, 60)) {
        return { damage: 0, hitZones };
    }

    let attackValue = levelDifficulty + randomInt(16) + Math.max(1, Math.floor(def.rawAttack / 16));

    if (attackValue <= 1) {
        if (randomInt(2) !== 0) return { damage: 0, hitZones };
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

    attackValue -= Math.floor(
        computeChampionProtectionApprox(
            state,
            targetChampion.id,
            targetChampion,
            targetVitals,
            resolvedDamageClass,
            hitZones,
        ) / 2,
    );

    return { damage: Math.max(0, attackValue), hitZones };
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
    const effective = getEffectiveChampionStats(champion, equip ?? {});
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

    const quickness = computeOriginalQuicknessApprox(champion, equip, inventory, currentStamina, state.championVitals[championId]?.wounds);
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
        attackOption ? mapOriginalSkillNumberToBasicSkill(attackOption.attack.skillNumber) : 'fighter',
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

function isHallEntryPressurePlate(level: number, x: number, y: number): boolean {
    return level === 0 && x === 6 && y === 9;
}

function queueTransientMessage(message: string, success = false, durationMs = TRANSIENT_MESSAGE_LIFETIME_MS) {
    const ts = Date.now();
    useStore.setState({ lastCastResult: { success, message, ts } });
    if (castResultTimeout) clearTimeout(castResultTimeout);
    castResultTimeout = setTimeout(() => {
        const current = useStore.getState().lastCastResult;
        if (current?.ts === ts) {
            useStore.setState({ lastCastResult: null });
        }
    }, durationMs);
}

function getHallEntryPlateChanges(level: number, x: number, y: number, partySize: number): Partial<GameState> {
    if (!isHallEntryPressurePlate(level, x, y)) return {};

    playPlate();
    notifyPlateActivated(level, x, y);

    if (partySize >= MAX_PARTY) {
        return { gateOpen: true };
    }

    queueTransientMessage("Selectionnez vos 4 aventuriers avant d'entrer dans le donjon");
    return { gateOpen: false };
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

// ─── Creature initialisation ──────────────────────────────────────────────────

function buildCreatureInstances(): CreatureInstance[] {
    const instances: CreatureInstance[] = [];
    // Track how many creatures already placed per tile key
    const tileSides = new Map<string, CreatureSide>();

    for (const map of GAME_MAPS) {
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
    for (const map of GAME_MAPS) {
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
                    const rawObj = obj as unknown as { type: number; name?: string; text?: string };
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
    const skillTotal =
        [...champion.skills.fighter, ...champion.skills.ninja, ...champion.skills.priest, ...champion.skills.wizard]
            .reduce((sum, value) => sum + value, 0);
    const bonus = Math.max(4, Math.min(18, skillTotal));

    return {
        ...champion,
        strength: Math.min(99, champion.strength + bonus),
        dexterity: Math.min(99, champion.dexterity + Math.round(bonus * 0.7)),
        wisdom: Math.min(99, champion.wisdom + Math.round(bonus * 0.4)),
        vitality: Math.min(99, champion.vitality + Math.round(bonus * 0.8)),
        health: Math.min(999, champion.health + bonus * 2),
        stamina: Math.min(999, champion.stamina + bonus * 2),
        mana: Math.max(0, Math.round(champion.mana * 0.6)),
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
    };
}

// ─── Teleporter initialisation ────────────────────────────────────────────────

function buildOpenTeleporters(): Set<string> {
    const open = new Set<string>();
    for (const map of GAME_MAPS) {
        for (const row of map.tiles) {
            for (const tile of row) {
                if (tile.type === 'Teleporter' && tile.open) {
                    open.add(`${map.index},${tile.y},${tile.x}`);
                }
            }
        }
    }
    const fired = new Set<string>();
    for (const map of GAME_MAPS) {
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Sensor') continue;
                    const s = obj as SensorObject;
                    if (s.type !== 8) continue;
                    const sKey = `${map.index}_${s.index}`;
                    if (s.onceOnly && fired.has(sKey)) continue;
                    if (s.onceOnly) fired.add(sKey);
                    const targetTile = map.tiles[s.targetY]?.[s.targetX];
                    if (!targetTile || targetTile.type !== 'Teleporter') continue;
                    const tKey = `${map.index},${s.targetY},${s.targetX}`;
                    if (s.action === 'Set') open.add(tKey);
                    else if (s.action === 'Clear') open.delete(tKey);
                    else if (s.action === 'Toggle') {
                        if (open.has(tKey)) open.delete(tKey);
                        else open.add(tKey);
                    }
                }
            }
        }
    }
    return open;
}

// ─── Wall-text initialisation ─────────────────────────────────────────────────

function buildVisibleTexts(): Set<string> {
    const visible = new Set<string>();
    for (const map of GAME_MAPS) {
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

export const MIRROR_WALL_MAP: Map<string, Champion> = new Map(
    CHAMPION_START_POSITIONS.map(pos => [`${pos.mapIndex},${pos.x},${pos.y}`, CHAMPION_BY_ID[pos.portraitId]])
);
export const MIRROR_FACE_MAP: Map<string, CardinalDir> = new Map(
    CHAMPION_START_POSITIONS.map(pos => [`${pos.mapIndex},${pos.x},${pos.y}`, pos.wallFace])
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
        typeId: 28,
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

const isWalkable = (level: number, y: number, x: number, openDoors: Set<string>, openWalls: Set<string>): boolean => {
    const map = getMap(level);
    if (y < 0 || y >= map.height || x < 0 || x >= map.width) return false;
    const tile = map.tiles[y]?.[x];
    if (!tile) return false;
    if (tile.type === 'Wall') return false;
    if (tile.type === 'TrickWall') return openWalls.has(`${level},${y},${x}`);
    if (tile.type === 'Door') return openDoors.has(`${level},${y},${x}`);
    return true;
};

const getTeleporter = (tile: GameTile): TeleporterObject | undefined =>
    tile.objects.find((o): o is TeleporterObject => o.category === 'Teleporter');

// ─── Sensor effect helper ─────────────────────────────────────────────────────

type SensorState = {
    openDoors: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    visibleTexts: Set<string>;
};

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

/** Evaluate a type-5 logic gate on `gateTile` and apply its output.
 *  data byte: low nibble = threshold (0 = AND = all inputs must be active).
 *  For "Hold" action: Set target when condition met, Clear when not. */
function evaluateLogicGates(level: number, gateTile: GameTile, ss: SensorState): Partial<SensorState> {
    const gates = gateTile.objects.filter(
        o => o.category === 'Sensor' && (o as SensorObject).type === 5
    ) as SensorObject[];
    if (gates.length === 0) return {};

    // Collect all sensor inputs targeting this gate tile
    const map = getMap(level);
    const inputs: SensorObject[] = [];
    for (const row of map.tiles) {
        for (const tile of row) {
            for (const obj of tile.objects) {
                if (obj.category === 'Sensor') {
                    const s = obj as SensorObject;
                    if (s.targetX === gateTile.x && s.targetY === gateTile.y) inputs.push(s);
                }
            }
        }
    }

    let cur: SensorState = ss;
    let changed = false;
    for (const gate of gates) {
        const threshold = gate.data & 0x0f; // low nibble
        const required = threshold === 0 ? inputs.length : threshold;
        const activeCount = inputs.filter(s => ss.activeSensors.has(`${level}_${s.index}`)).length;
        const conditionMet = activeCount >= required;

        const targetTile = map.tiles[gate.targetY]?.[gate.targetX];
        if (!targetTile) continue;
        const tKey = `${level},${gate.targetY},${gate.targetX}`;

        // "Hold" = maintain state: Set when met, Clear when not
        // Other actions fire only when condition transitions to met
        const effectiveAction = gate.action === 'Hold'
            ? (conditionMet ? 'Set' : 'Clear')
            : (conditionMet ? gate.action : 'Clear');

        if (targetTile.type === 'Door') {
            cur = { ...cur, openDoors: applyToSet(cur.openDoors, tKey, effectiveAction) };
            changed = true;
        } else if (targetTile.type === 'TrickWall') {
            cur = { ...cur, openWalls: applyToSet(cur.openWalls, tKey, effectiveAction) };
            changed = true;
        } else if (targetTile.type === 'Teleporter') {
            cur = { ...cur, openTeleporters: applyToSet(cur.openTeleporters, tKey, effectiveAction) };
            changed = true;
        }
    }
    return changed ? cur : {};
}

function computeSensorEffect(sensor: SensorObject, level: number, ss: SensorState): Partial<SensorState> {
    // type-5 = logic gate, evaluated separately via evaluateLogicGates
    if (sensor.type === 5) return {};
    // Hold sensors are maintained via evaluateLogicGates only
    if (sensor.action === 'Hold') return {};
    const sKey = `${level}_${sensor.index}`;
    if (sensor.onceOnly && ss.firedSensors.has(sKey)) return {};
    const newFired = sensor.onceOnly ? new Set([...ss.firedSensors, sKey]) : ss.firedSensors;
    const targetTile = getMap(level).tiles[sensor.targetY]?.[sensor.targetX];
    if (!targetTile) return { firedSensors: newFired };
    const tKey = `${level},${sensor.targetY},${sensor.targetX}`;

    // Update activeSensors for this sensor (levers / buttons targeting Wall or TrickWall gate tiles)
    const targetHasGate = targetTile.objects.some(
        o => o.category === 'Sensor' && (o as SensorObject).type === 5
    );
    let newActive = ss.activeSensors;
    if (targetHasGate) {
        newActive = applyToSet(ss.activeSensors, sKey, sensor.action);
        const gateEffect = evaluateLogicGates(level, targetTile, { ...ss, activeSensors: newActive, firedSensors: newFired });
        return { activeSensors: newActive, firedSensors: newFired, ...gateEffect };
    }

    if (targetTile.type === 'Door') {
        return { openDoors: applyToSet(ss.openDoors, tKey, sensor.action), firedSensors: newFired };
    }
    if (targetTile.type === 'TrickWall') {
        return { openWalls: applyToSet(ss.openWalls, tKey, sensor.action), firedSensors: newFired };
    }
    if (targetTile.type === 'Teleporter') {
        return { openTeleporters: applyToSet(ss.openTeleporters, tKey, sensor.action), firedSensors: newFired };
    }
    const textObj = targetTile.objects.find(
        o => o.category === 'Text' && (o as WallTextObject).tilePos === sensor.targetDir
    ) as WallTextObject | undefined;
    if (textObj) {
        const vKey = `${level}_${sensor.targetX}_${sensor.targetY}_${textObj.index}`;
        return { visibleTexts: applyToSet(ss.visibleTexts, vKey, sensor.action), firedSensors: newFired };
    }
    return { firedSensors: newFired };
}

/** Map movement direction → wall face toward the player (for wall-push sensors). */
const PUSH_FACE: Record<string, string> = {
    NORTH: 'South', SOUTH: 'North', EAST: 'West', WEST: 'East',
};

/** Trigger sensors on a wall tile when the player pushes against it. */
function triggerWallPushSensors(level: number, wx: number, wy: number, dir: string, ss: SensorState): Partial<SensorState> {
    const tile = getMap(level).tiles[wy]?.[wx];
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return {};
    const face = PUSH_FACE[dir];
    let cur: SensorState = ss;
    let changed = false;
    for (const obj of tile.objects) {
        if (obj.category !== 'Sensor') continue;
        const sensor = obj as SensorObject;
        if (sensor.tilePos !== face) continue;
        // Skip: lever (1), wall-button (2), lock (4 — needs item), special (127)
        if (sensor.type === 1 || sensor.type === 2 || sensor.type === 4 || sensor.type === 127) continue;
        const effect = computeSensorEffect(sensor, level, cur);
        if (Object.keys(effect).length > 0) {
            cur = { ...cur, ...effect } as SensorState;
            changed = true;
        }
    }
    return changed ? cur : {};
}

/** Try to use an item from party inventory on a type-4 lock sensor.
 *  Returns updated sensor state + consumed inventory if a matching key was found. */
function triggerLockSensors(
    level: number, wx: number, wy: number, face: string, ss: SensorState,
    inventories: Record<number, FloorItem[]>,
): { sensorChanges: Partial<SensorState>; newInventories: Record<number, FloorItem[]> | null } {
    const tile = getMap(level).tiles[wy]?.[wx];
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return { sensorChanges: {}, newInventories: null };
    let cur: SensorState = ss;
    let sensorChanged = false;
    let newInventories: Record<number, FloorItem[]> | null = null;

    for (const obj of tile.objects) {
        if (obj.category !== 'Sensor') continue;
        const sensor = obj as SensorObject;
        if (sensor.type !== 4 || sensor.tilePos !== face) continue;

        const required = sensor.data;
        // Find first champion that has the matching item
        let matchChampId: number | null = null;
        let matchItemId: string | null = null;
        for (const [cidStr, inv] of Object.entries(inventories)) {
            for (const item of inv) {
                if (itemToLockData(item.category, item.typeId) === required) {
                    matchChampId = parseInt(cidStr);
                    matchItemId = item.id;
                    break;
                }
            }
            if (matchChampId !== null) break;
        }
        if (matchChampId === null) continue;

        // Consume the item
        if (newInventories === null) newInventories = { ...inventories };
        const inv = newInventories[matchChampId] ?? [];
        newInventories[matchChampId] = inv.filter(i => i.id !== matchItemId);

        // Fire the sensor
        const effect = computeSensorEffect(sensor, level, cur);
        if (Object.keys(effect).length > 0) {
            cur = { ...cur, ...effect } as SensorState;
            sensorChanged = true;
        }
    }
    return { sensorChanges: sensorChanged ? cur : {}, newInventories };
}

function triggerFloorSensors(level: number, x: number, y: number, ss: SensorState): Partial<SensorState> {
    const tile = getMap(level).tiles[y]?.[x];
    if (!tile) return {};
    let cur: SensorState = ss;
    let changed = false;
    let playedSound = false;
    for (const obj of tile.objects) {
        if (obj.category !== 'Sensor') continue;
        const sensor = obj as SensorObject;
        if (sensor.type === 2 || sensor.type === 127) continue;
        const effect = computeSensorEffect(sensor, level, cur);
        if (Object.keys(effect).length > 0) {
            cur = { ...cur, ...effect } as SensorState;
            changed = true;
            if (sensor.sound && !playedSound) {
                playPlate();
                playedSound = true;
            }
        }
    }
    // Notify pressure-plate animation subscribers
    if (changed) notifyPlateActivated(level, x, y);
    return changed ? cur : {};
}

// ─── Staircase connections (auto-generated from dungeon.json destMap/destX/destY) ─
// requireGate: true = only passable once the party is assembled (Hall of Champions gate).

export const STAIR_CONNECTIONS: Array<{
    fromLevel: number; fromY: number; fromX: number;
    toLevel: number; toY: number; toX: number; dir: Direction;
    requireGate: boolean;
}> = [
    { fromLevel: 0,  fromY: 15, fromX: 3,  toLevel: 1,  toY: 1,  toX: 3,  dir: 'NORTH', requireGate: true  },
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
    /** Index (0-3) of the currently selected party slot — picks up items. */
    selectedChampionIndex: number;
    gamePhase: GamePhase;
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    gateOpen: boolean;
    openDoors: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    visibleTexts: Set<string>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    /** Per-champion inventories, keyed by champion.id */
    championInventories: Record<number, FloorItem[]>;
    /** Per-champion equipment, keyed by champion.id */
    championEquipment: Record<number, ChampionEquipment>;
    /** Live HP / Stamina / Mana, keyed by champion.id */
    championVitals: Record<number, ChampionVitals>;
    elapsedGameTimeTicks: number;
    regenTickRemainder: number;
    lastPartyMoveGameTick: number;
    movementCooldown: number;
    /** Result of the most recent spell cast attempt */
    lastCastResult: CastResult | null;
    /** Per-champion accumulated XP, keyed by champion.id */
    championXP: Record<number, ChampionXP>;
    /** Per-champion combat state (cooldown), keyed by champion.id */
    championCombat: Record<number, ChampionCombat>;
    /** Floating damage numbers, cleared after ~600 ms */
    damageEvents: DamageEvent[];
    /** Doors currently crushing a creature: key → { phase, timer } */
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    /** Timestamp (ms) when each torch item (Weapon typeId 16) was first equipped */
    torchBurnStart: Record<string, number>;
    /** Active torch / light spells — extend fog visibility until expiry */
    spellLights: SpellLight[];
    /** Flying projectiles (fireball, lightning, …) */
    projectiles: Projectile[];
    /** Active magic / fire shields — reduce incoming damage */
    activeShields: PartyShield[];
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
    reorderParty: (fromIndex: number, toIndex: number) => void;
    castSpell: (championId: number, runeIds: string[]) => void;
    regenTick: (delta: number) => void;
    gainXP: (championId: number, skill: CastSkill, amount: number) => void;
    attackFront: (championId: number, attackType?: number) => void;
    tickCombat: (delta: number) => void;
    tickMovement: (delta: number) => void;
    tickMonsters: (delta: number) => void;
    tickDoors: (delta: number) => void;
    tickSpells: (now: number) => void;
    pickupItem: (id: string) => void;
    dropItem: (itemId: string, championId: number) => void;
    equipItem: (championId: number, slotKey: EquipSlotKey, itemId: string) => void;
    unequipItem: (championId: number, slotKey: EquipSlotKey) => void;
    giveItem: (fromChampionId: number, toChampionId: number, itemId: string) => void;
    giveEquippedItem: (fromChampionId: number, slotKey: EquipSlotKey, toChampionId: number) => void;
    killChampion: (championId: number) => void;
    resurrectChampion: (bonesItemId: string) => void;
    useItem: (championId: number, itemId: string) => void;
    fillWaterContainer: (championId: number, itemId: string) => void;
    sleep: () => void;
    enterDungeon: () => void;
    saveGame: () => boolean;
    loadGame: () => boolean;
    returnToTitle: () => void;
}

const DIRECTIONS: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

function advanceSurvivalTimeApprox(
    state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'championXP' | 'elapsedGameTimeTicks' | 'lastPartyMoveGameTick'>,
    stepCount: number,
): { championVitals: Record<number, ChampionVitals>; elapsedGameTimeTicks: number; advancedMs: number } {
    let elapsedGameTimeTicks = state.elapsedGameTimeTicks;
    const championVitals: Record<number, ChampionVitals> = { ...state.championVitals };

    for (let step = 0; step < stepCount; step += 1) {
        elapsedGameTimeTicks += 1;
        const timeCriteria = computeOriginalTimeCriteria(elapsedGameTimeTicks);
        const timeSinceLastPartyMove = elapsedGameTimeTicks - state.lastPartyMoveGameTick;

        for (const champ of state.party) {
            const current = championVitals[champ.id];
            if (!current || current.hp <= 0) continue;

            const effective = getEffectiveChampionStats(champ, state.championEquipment[champ.id] ?? {});
            const maxHP = effective.health;
            const maxStamina = effective.stamina;
            const maxMana = effective.mana;
            const wizardSkill = xpToLevel(state.championXP[champ.id]?.wizard ?? 0) + xpToLevel(state.championXP[champ.id]?.priest ?? 0);

            let next = current;

            if (maxMana > 0 && next.mana < maxMana && timeCriteria < (effective.wisdom + wizardSkill)) {
                const manaGain = Math.floor(maxMana / 40) + 1;
                const staminaCost = manaGain * Math.max(7, 16 - wizardSkill);
                next = applyChampionStaminaDeltaOriginal(next, maxHP, maxStamina, -staminaCost);
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
                        food -= 2;
                    }
                } else {
                    if (food >= 0) {
                        staminaDelta += staminaAmount;
                    }
                    food -= staminaAboveHalf ? 2 : staminaGainCycleCount >> 1;
                }

                if (water < -512) {
                    if (staminaAboveHalf) {
                        staminaDelta -= staminaAmount;
                        water -= 1;
                    }
                } else {
                    if (water >= 0) {
                        staminaDelta += staminaAmount;
                    }
                    water -= staminaAboveHalf ? 1 : staminaGainCycleCount >> 2;
                }
                staminaGainCycleCount -= 1;
            } while (staminaGainCycleCount > 0 && ((next.stamina + staminaDelta) < maxStamina));

            next = applyChampionStaminaDeltaOriginal(next, maxHP, maxStamina, staminaDelta);
            next = {
                ...next,
                food: clampFoodWater(food, MAX_FOOD),
                water: clampFoodWater(water, MAX_WATER),
            };

            if (next.hp < maxHP && next.stamina >= (maxStamina >> 2) && timeCriteria < (effective.vitality + 12)) {
                let healthGain = (maxHP >> 7) + 1;
                if (state.championEquipment[champ.id]?.neck?.category === 'Misc' && state.championEquipment[champ.id]?.neck?.typeId === 44) {
                    healthGain += (healthGain >> 1) + 1;
                }
                next = {
                    ...next,
                    hp: Math.min(maxHP, next.hp + healthGain),
                };
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
        elapsedGameTimeTicks,
        advancedMs: stepCount * (ORIGINAL_TIMER_TICK_SECONDS * 1000),
    };
}

function applyPartyMoveFatigue(state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'championInventories'>): Record<number, ChampionVitals> | null {
    let changed = false;
    const nextVitals: Record<number, ChampionVitals> = { ...state.championVitals };

    for (const champ of state.party) {
        const current = state.championVitals[champ.id];
        if (!current || current.hp <= 0) continue;

        const equip = state.championEquipment[champ.id] ?? {};
        const inventory = state.championInventories[champ.id] ?? [];
        const effective = getEffectiveChampionStats(champ, equip);
        const load = getTotalWeight(equip, inventory);
        const maxLoad = Math.max(1, getChampionMaxLoad(champ, equip, current.stamina, current.wounds));
        const staminaCost = Math.floor((load * 3) / maxLoad) + 1;
        const next = applyChampionStaminaDeltaOriginal(current, effective.health, effective.stamina, -staminaCost);

        if (next !== current && (next.hp !== current.hp || next.stamina !== current.stamina)) {
            nextVitals[champ.id] = next;
            changed = true;
        }
    }

    return changed ? nextVitals : null;
}

function computeChampionMovementTicksApprox(
    champion: Champion,
    vitals: ChampionVitals | undefined,
    equip: ChampionEquipment | undefined,
    inventory: FloorItem[] | undefined,
): number {
    if (!vitals || vitals.hp <= 0) return 1;
    const load = getTotalWeight(equip ?? {}, inventory ?? []);
    const maxLoad = Math.max(1, getChampionMaxLoad(champion, equip, vitals.stamina, vitals.wounds));

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
    state: Pick<GameState, 'party' | 'championVitals' | 'championEquipment' | 'championInventories'>,
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
            ),
        );
    }
    return ticks / 6;
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

    return {
        torchBurnStart,
        spellLights,
        activeShields,
        invisibleUntil: Math.max(0, state.invisibleUntil - advanceMs),
        magicVisionUntil: Math.max(0, state.magicVisionUntil - advanceMs),
        seeThroughWallsUntil: Math.max(0, state.seeThroughWallsUntil - advanceMs),
        footprintsUntil: Math.max(0, state.footprintsUntil - advanceMs),
    };
}

interface PersistedCreatureTimers {
    moveRemaining: number;
    attackRemaining: number;
    attackWindowRemainingMs: number;
    confusedRemainingMs: number;
    fluxcageRemainingMs: number;
}

interface PersistedSaveData {
    version: 1;
    savedAt: number;
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
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    torchBurnElapsed: Record<string, number>;
    spellLights: Array<Omit<SpellLight, 'expiresAt'> & { remainingMs: number }>;
    projectiles: Array<Omit<Projectile, 'nextMoveAt'> & { nextMoveInMs: number }>;
    activeShields: Array<Omit<PartyShield, 'expiresAt'> & { remainingMs: number }>;
    invisibleRemainingMs: number;
    magicVisionRemainingMs: number;
    seeThroughWallsRemainingMs: number;
    footprintsRemainingMs: number;
    footprintHistory: FootprintEntry[];
    deadChampions: Record<number, Champion>;
    creatureTimers: Record<string, PersistedCreatureTimers>;
}

function buildPersistedSaveData(state: GameState): PersistedSaveData {
    const now = Date.now();
    const timerIds = new Set<string>([
        ...state.creatures.map((creature) => creature.id),
        ...creatureTimers.keys(),
        ...creatureAttackWindows.keys(),
        ...creatureConfusedUntil.keys(),
        ...creatureFluxcageUntil.keys(),
    ]);
    const serializedCreatureTimers: Record<string, PersistedCreatureTimers> = {};
    for (const id of timerIds) {
        const timers = creatureTimers.get(id);
        serializedCreatureTimers[id] = {
            moveRemaining: Math.max(0, timers?.mt ?? 0),
            attackRemaining: Math.max(0, timers?.at ?? 0),
            attackWindowRemainingMs: Math.max(0, (creatureAttackWindows.get(id) ?? 0) - now),
            confusedRemainingMs: Math.max(0, (creatureConfusedUntil.get(id) ?? 0) - now),
            fluxcageRemainingMs: Math.max(0, (creatureFluxcageUntil.get(id) ?? 0) - now),
        };
    }

    return {
        version: 1,
        savedAt: now,
        level: state.level,
        position: state.position,
        direction: state.direction,
        party: state.party,
        gateOpen: state.gateOpen,
        openDoors: [...state.openDoors],
        openTeleporters: [...state.openTeleporters],
        openWalls: [...state.openWalls],
        activeSensors: [...state.activeSensors],
        firedSensors: [...state.firedSensors],
        visibleTexts: [...state.visibleTexts],
        creatures: state.creatures,
        floorItems: state.floorItems,
        championInventories: state.championInventories,
        championEquipment: state.championEquipment,
        championVitals: state.championVitals,
        elapsedGameTimeTicks: state.elapsedGameTimeTicks,
        regenTickRemainder: state.regenTickRemainder,
        lastPartyMoveGameTick: state.lastPartyMoveGameTick,
        movementCooldown: state.movementCooldown,
        championXP: state.championXP,
        championCombat: state.championCombat,
        crushingDoors: state.crushingDoors,
        torchBurnElapsed: Object.fromEntries(
            Object.entries(state.torchBurnStart).map(([itemId, litAt]) => [itemId, Math.max(0, now - litAt)]),
        ),
        spellLights: state.spellLights.map((light) => ({
            id: light.id,
            lightContrib: light.lightContrib,
            remainingMs: Math.max(0, light.expiresAt - now),
        })),
        projectiles: state.projectiles.map((projectile) => ({
            ...projectile,
            nextMoveInMs: Math.max(0, projectile.nextMoveAt - now),
        })),
        activeShields: state.activeShields.map((shield) => ({
            ...shield,
            remainingMs: Math.max(0, shield.expiresAt - now),
        })),
        invisibleRemainingMs: Math.max(0, state.invisibleUntil - now),
        magicVisionRemainingMs: Math.max(0, state.magicVisionUntil - now),
        seeThroughWallsRemainingMs: Math.max(0, state.seeThroughWallsUntil - now),
        footprintsRemainingMs: Math.max(0, state.footprintsUntil - now),
        footprintHistory: state.footprintHistory,
        deadChampions: state.deadChampions,
        creatureTimers: serializedCreatureTimers,
    };
}

function tryParsePersistedSaveData(raw: string | null): PersistedSaveData | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PersistedSaveData;
        if (parsed?.version !== 1) return null;
        if (!Array.isArray(parsed.position) || parsed.position.length !== 2) return null;
        if (!Array.isArray(parsed.party) || !Array.isArray(parsed.creatures) || !Array.isArray(parsed.floorItems)) return null;
        return parsed;
    } catch {
        return null;
    }
}

function restoreExternalCreatureRuntimeFromSave(data: PersistedSaveData): void {
    const now = Date.now();
    creatureTimers.clear();
    creatureAttackWindows.clear();
    creatureConfusedUntil.clear();
    creatureFluxcageUntil.clear();

    for (const [id, timers] of Object.entries(data.creatureTimers)) {
        creatureTimers.set(id, {
            mt: Math.max(0, timers.moveRemaining),
            at: Math.max(0, timers.attackRemaining),
        });
        if (timers.attackWindowRemainingMs > 0) {
            creatureAttackWindows.set(id, now + timers.attackWindowRemainingMs);
        }
        if (timers.confusedRemainingMs > 0) {
            creatureConfusedUntil.set(id, now + timers.confusedRemainingMs);
        }
        if (timers.fluxcageRemainingMs > 0) {
            creatureFluxcageUntil.set(id, now + timers.fluxcageRemainingMs);
        }
    }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<GameState>((set) => ({
    level: 0,
    position: HALL_START,
    direction: HALL_START_DIR,
    party: [],
    selectedChampionIndex: 0,
    gamePhase: 'title',
    activeMirrorChampionId: null,
    activePartyMemberId: null,
    gateOpen: false,
    openDoors: new Set<string>(),
    openTeleporters: buildOpenTeleporters(),
    openWalls: new Set<string>(),
    activeSensors: new Set<string>(),
    firedSensors: new Set<string>(),
    visibleTexts: buildVisibleTexts(),
    creatures: buildCreatureInstances(),
    floorItems: buildFloorItems(),
    championInventories: {},
    championEquipment: {},
    championVitals: {},
    elapsedGameTimeTicks: 0,
    regenTickRemainder: 0,
    lastPartyMoveGameTick: 0,
    movementCooldown: 0,
    lastCastResult: null,
    championXP: {},
    championCombat: {},
    damageEvents: [],
    crushingDoors: {},
    torchBurnStart: {},
    spellLights: [],
    projectiles: [],
    activeShields: [],
    invisibleUntil: 0,
    magicVisionUntil: 0,
    seeThroughWallsUntil: 0,
    footprintsUntil: 0,
    footprintHistory: [],
    deadChampions: {},

    moveForward: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        if (state.movementCooldown > 0) return state;
        const movedVitals = applyPartyMoveFatigue(state);
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') ny = y - 1;
        if (state.direction === 'SOUTH') ny = y + 1;
        if (state.direction === 'EAST')  nx = x + 1;
        if (state.direction === 'WEST')  nx = x - 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors, state.openWalls)) {
            const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, openWalls: state.openWalls, activeSensors: state.activeSensors, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
            const face = { NORTH: 'South', SOUTH: 'North', EAST: 'West', WEST: 'East' }[state.direction]!;
            const pushChanges = triggerWallPushSensors(state.level, nx, ny, state.direction, ss);
            const pushState = Object.keys(pushChanges).length > 0 ? { ...ss, ...pushChanges } as SensorState : ss;
            const { sensorChanges, newInventories } = triggerLockSensors(state.level, nx, ny, face, pushState, state.championInventories);
            const anyChange = Object.keys(pushChanges).length > 0 || Object.keys(sensorChanges).length > 0;
            if (!anyChange) return movedVitals ? { championVitals: movedVitals } : state;
            return {
                ...(movedVitals ? { championVitals: movedVitals } : {}),
                ...sensorChanges,
                ...(newInventories ? { championInventories: newInventories } : {}),
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
                    const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, openWalls: state.openWalls, activeSensors: state.activeSensors, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
                    const sensorChanges = triggerFloorSensors(state.level, tp.destX, tp.destY, ss);
                    return {
                        position: [tp.destY, tp.destX] as [number, number],
                        lastPartyMoveGameTick: state.elapsedGameTimeTicks,
                        movementCooldown: computePartyMovementCooldownSecondsApprox(state),
                        ...(movedVitals ? { championVitals: movedVitals } : {}),
                        ...sensorChanges,
                    };
                }
            }
        }
        const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, openWalls: state.openWalls, activeSensors: state.activeSensors, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
        const suppressHallPlateSensors = isHallEntryPressurePlate(state.level, nx, ny) && state.party.length < MAX_PARTY;
        const sensorChanges = suppressHallPlateSensors ? {} : triggerFloorSensors(state.level, nx, ny, ss);
        const hallGateChanges = getHallEntryPlateChanges(state.level, nx, ny, state.party.length);
        const footprintChanges = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        return {
            position: [ny, nx] as [number, number],
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: computePartyMovementCooldownSecondsApprox(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...sensorChanges,
            ...hallGateChanges,
            ...footprintChanges,
        };
    }),

    moveBackward: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        if (state.movementCooldown > 0) return state;
        const movedVitals = applyPartyMoveFatigue(state);
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') ny = y + 1;
        if (state.direction === 'SOUTH') ny = y - 1;
        if (state.direction === 'EAST')  nx = x - 1;
        if (state.direction === 'WEST')  nx = x + 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors, state.openWalls)) return movedVitals ? { championVitals: movedVitals } : state;
        const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, openWalls: state.openWalls, activeSensors: state.activeSensors, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
        const suppressHallPlateSensors = isHallEntryPressurePlate(state.level, nx, ny) && state.party.length < MAX_PARTY;
        const sensorChanges = suppressHallPlateSensors ? {} : triggerFloorSensors(state.level, nx, ny, ss);
        const hallGateChanges = getHallEntryPlateChanges(state.level, nx, ny, state.party.length);
        const footprintChanges = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        return {
            position: [ny, nx] as [number, number],
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: computePartyMovementCooldownSecondsApprox(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...sensorChanges,
            ...hallGateChanges,
            ...footprintChanges,
        };
    }),

    strafeLeft: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        if (state.movementCooldown > 0) return state;
        const movedVitals = applyPartyMoveFatigue(state);
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') nx = x - 1;
        if (state.direction === 'SOUTH') nx = x + 1;
        if (state.direction === 'EAST')  ny = y - 1;
        if (state.direction === 'WEST')  ny = y + 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors, state.openWalls)) return movedVitals ? { championVitals: movedVitals } : state;
        const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, openWalls: state.openWalls, activeSensors: state.activeSensors, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
        const fpL = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        return {
            position: [ny, nx] as [number, number],
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: computePartyMovementCooldownSecondsApprox(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...(isHallEntryPressurePlate(state.level, nx, ny) && state.party.length < MAX_PARTY
                ? {}
                : triggerFloorSensors(state.level, nx, ny, ss)),
            ...getHallEntryPlateChanges(state.level, nx, ny, state.party.length),
            ...fpL,
        };
    }),

    strafeRight: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        if (state.movementCooldown > 0) return state;
        const movedVitals = applyPartyMoveFatigue(state);
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') nx = x + 1;
        if (state.direction === 'SOUTH') nx = x - 1;
        if (state.direction === 'EAST')  ny = y + 1;
        if (state.direction === 'WEST')  ny = y - 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors, state.openWalls)) return movedVitals ? { championVitals: movedVitals } : state;
        const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, openWalls: state.openWalls, activeSensors: state.activeSensors, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
        const fpR = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        return {
            position: [ny, nx] as [number, number],
            lastPartyMoveGameTick: state.elapsedGameTimeTicks,
            movementCooldown: computePartyMovementCooldownSecondsApprox(state),
            ...(movedVitals ? { championVitals: movedVitals } : {}),
            ...(isHallEntryPressurePlate(state.level, nx, ny) && state.party.length < MAX_PARTY
                ? {}
                : triggerFloorSensors(state.level, nx, ny, ss)),
            ...getHallEntryPlateChanges(state.level, nx, ny, state.party.length),
            ...fpR,
        };
    }),

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
        return {
            party: newParty,
            gateOpen: false,
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
                        ? { fighter: 0, ninja: 0, priest: 0, wizard: 0 }
                        : buildInitialXP(recruitedChampion),
                },
            championCombat: champion.id in state.championCombat
                ? state.championCombat
                : { ...state.championCombat, [champion.id]: createChampionCombatState(0) },
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

        if (!next.has(key)) {
            // Door is closed → open it, cancel any crush
            next.add(key);
            const remaining = { ...state.crushingDoors };
            delete remaining[key];
            return { openDoors: next, crushingDoors: remaining };
        }

        // Door is open → try to close it
        next.delete(key);
        const blocker = state.creatures.find(
            c => c.alive && c.mapIndex === state.level && c.x === x && c.y === y
        );
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
        const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, openWalls: state.openWalls, activeSensors: state.activeSensors, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
        return computeSensorEffect(sensor, mapIndex, ss);
    }),

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
        const item = state.floorItems.find(i => i.id === id);
        if (!item) return state;
        const activeChampion = state.party[state.selectedChampionIndex];
        if (!activeChampion) return state;
        const champInv = state.championInventories[activeChampion.id] ?? [];
        return {
            floorItems: state.floorItems.filter(i => i.id !== id),
            championInventories: { ...state.championInventories, [activeChampion.id]: [...champInv, item] },
        };
    }),

    dropItem: (itemId, championId) => set((state) => {
        const inv = state.championInventories[championId] ?? [];
        const item = inv.find(i => i.id === itemId);
        if (!item) return state;
        const [y, x] = state.position;

        // ── Altar resurrection: dropping bones on a Vi Altar tile ──────────────
        if (item.category === 'Misc' && item.typeId === 28 && item.championId !== undefined) {
            const deadChampId = item.championId;
            const deadChamp   = state.deadChampions[deadChampId];
            if (deadChamp && isAltarTile(state.level, x, y) && state.party.length < MAX_PARTY) {
                const newInv = inv.filter(i => i.id !== itemId);
                const newDead = { ...state.deadChampions };
                delete newDead[deadChampId];
                return {
                    party: [...state.party, deadChamp],
                    championVitals: {
                        ...state.championVitals,
                        [deadChampId]: createChampionVitals(1, 0, 0, Math.round(MAX_FOOD * 0.35), Math.round(MAX_WATER * 0.35)),
                    },
                    championInventories: { ...state.championInventories, [championId]: newInv, [deadChampId]: [] },
                    championEquipment: { ...state.championEquipment, [deadChampId]: {} },
                    deadChampions: newDead,
                };
            }
        }

        const dropped: FloorItem = { ...item, mapIndex: state.level, x, y, tilePos: 'North' };
        return {
            championInventories: { ...state.championInventories, [championId]: inv.filter(i => i.id !== itemId) },
            floorItems: [...state.floorItems, dropped],
        };
    }),

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
        const isTorch = item.category === 'Weapon' && item.typeId === 16;
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

        const [y, x] = state.position;
        if (!isAltarTile(state.level, x, y)) return state;

        const newDead = { ...state.deadChampions };
        delete newDead[deadChampId];

        const newFloorItems = state.floorItems.filter(i => i.id !== bonesItemId);
        const newInv = carriedBy !== null
            ? (state.championInventories[carriedBy] ?? []).filter(i => i.id !== bonesItemId)
            : state.championInventories[carriedBy!] ?? [];

        return {
            party: [...state.party, deadChamp],
            championVitals: {
                ...state.championVitals,
                [deadChampId]: createChampionVitals(1, 0, 0, Math.round(MAX_FOOD * 0.35), Math.round(MAX_WATER * 0.35)),
            },
            championInventories: carriedBy !== null
                ? { ...state.championInventories, [carriedBy]: newInv, [deadChampId]: [] }
                : { ...state.championInventories, [deadChampId]: [] },
            championEquipment: { ...state.championEquipment, [deadChampId]: {} },
            floorItems: newFloorItems,
            deadChampions: newDead,
        };
    }),

    useItem: (championId, itemId) => set((state) => {
        const inv = state.championInventories[championId];
        if (!inv) return state;
        const itemIndex = inv.findIndex(i => i.id === itemId);
        const item = itemIndex >= 0 ? inv[itemIndex] : undefined;
        if (!item) return state;
        const vitals = state.championVitals[championId];
        if (!vitals) return state;
        const champ = state.party.find(c => c.id === championId);
        if (!champ) return state;
        const effective = getEffectiveChampionStats(champ, state.championEquipment[championId] ?? {});

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
            const def = POTION_TYPES[item.typeId];
            if (def?.restore !== undefined) {
                if (def.effect === 'health') {
                    newVitals.hp = Math.min(effective.health, vitals.hp + def.restore);
                    Object.assign(newVitals, healChampionWoundsApprox(newVitals, Math.max(1, Math.floor(def.restore / 42))));
                }
                if (def.effect === 'stamina') newVitals.stamina = Math.min(effective.stamina, vitals.stamina + def.restore);
                if (def.effect === 'mana')    newVitals.mana    = Math.min(effective.mana,    vitals.mana    + def.restore);
                if (def.effect === 'poison')  newVitals.poisonEntries = [];
            }
        } else if (item.category === 'Misc') {
            const def = MISC_TYPES[item.typeId];
            if (def?.food && def.nutrition) {
                newVitals.food = clampFoodWater(vitals.food + def.nutrition, MAX_FOOD);
                newVitals.stamina = Math.min(effective.stamina, vitals.stamina + def.nutrition / 20);
            }
        }

        const nextInventory = shouldConsumeOriginal
            ? inv.filter(i => i.id !== itemId)
            : inv.map((entry, index) => index === itemIndex ? (replacementItem ?? entry) : entry);

        return {
            championVitals: { ...state.championVitals, [championId]: newVitals },
            championInventories: { ...state.championInventories, [championId]: nextInventory },
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
        let workingState: GameState = state;
        let totalAdvancedTicks = 0;
        const MAX_SLEEP_TICKS = 1200;
        const SLEEP_CHUNK_TICKS = 20;

        const isRested = (candidate: GameState) =>
            candidate.party.every((champ) => {
                const vitals = candidate.championVitals[champ.id];
                if (!vitals || vitals.hp <= 0) return true;
                const effective = getEffectiveChampionStats(champ, candidate.championEquipment[champ.id] ?? {});
                return vitals.hp >= effective.health && vitals.stamina >= effective.stamina && vitals.mana >= effective.mana;
            });

        while (totalAdvancedTicks < MAX_SLEEP_TICKS && !isRested(workingState)) {
            const chunk = Math.min(SLEEP_CHUNK_TICKS, MAX_SLEEP_TICKS - totalAdvancedTicks);
            const advanced = advanceSurvivalTimeApprox(workingState, chunk);
            workingState = {
                ...workingState,
                championVitals: advanced.championVitals,
                elapsedGameTimeTicks: advanced.elapsedGameTimeTicks,
            };
            totalAdvancedTicks += chunk;
        }

        const advanceMs = totalAdvancedTicks * (ORIGINAL_TIMER_TICK_SECONDS * 1000);
        return {
            championVitals: workingState.championVitals,
            elapsedGameTimeTicks: workingState.elapsedGameTimeTicks,
            regenTickRemainder: 0,
            ...ageTimedEffectsByMs(state, advanceMs),
        };
    }),

    // ─── Potion rune → typeId mapping (spell runes without power rune) ──────────
    // Source: Old_data/game_db.json potionTypes
    // vi,bro,ra → Health (8) | vi,bro → Antidote (11) | ya → Stamina (9)
    // ya,bro → Anti-Magic/Shield (17) | zo,bro,ra → Mana (10)

    // ─── Spell casting ────────────────────────────────────────────────────────
    enterDungeon: () => set({
        gamePhase: 'exploration',
        activeMirrorChampionId: null,
        activePartyMemberId: null,
        lastCastResult: null,
    }),

    saveGame: () => {
        const state = useStore.getState();
        const payload = JSON.stringify(buildPersistedSaveData(state));
        return writePersistedSave(payload);
    },

    loadGame: () => {
        const data = tryParsePersistedSaveData(readPersistedSave());
        if (!data) return false;
        const now = Date.now();
        restoreExternalCreatureRuntimeFromSave(data);
        set({
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
            openTeleporters: new Set<string>(data.openTeleporters),
            openWalls: new Set<string>(data.openWalls),
            activeSensors: new Set<string>(data.activeSensors),
            firedSensors: new Set<string>(data.firedSensors),
            visibleTexts: new Set<string>(data.visibleTexts),
            creatures: data.creatures,
            floorItems: data.floorItems,
            championInventories: data.championInventories,
            championEquipment: data.championEquipment,
            championVitals: data.championVitals,
            elapsedGameTimeTicks: data.elapsedGameTimeTicks,
            regenTickRemainder: data.regenTickRemainder,
            lastPartyMoveGameTick: data.lastPartyMoveGameTick,
            movementCooldown: data.movementCooldown,
            lastCastResult: null,
            championXP: data.championXP,
            championCombat: data.championCombat,
            damageEvents: [],
            crushingDoors: data.crushingDoors,
            torchBurnStart: Object.fromEntries(
                Object.entries(data.torchBurnElapsed).map(([itemId, elapsed]) => [itemId, now - elapsed]),
            ),
            spellLights: data.spellLights
                .map((light) => ({ id: light.id, lightContrib: light.lightContrib, expiresAt: now + light.remainingMs }))
                .filter((light) => light.expiresAt > now),
            projectiles: data.projectiles.map((projectile) => {
                const { nextMoveInMs, ...rest } = projectile;
                return { ...rest, nextMoveAt: now + nextMoveInMs };
            }),
            activeShields: data.activeShields
                .map((shield) => {
                    const { remainingMs, ...rest } = shield;
                    return { ...rest, expiresAt: now + remainingMs };
                })
                .filter((shield) => shield.expiresAt > now),
            invisibleUntil: data.invisibleRemainingMs > 0 ? now + data.invisibleRemainingMs : 0,
            magicVisionUntil: data.magicVisionRemainingMs > 0 ? now + data.magicVisionRemainingMs : 0,
            seeThroughWallsUntil: data.seeThroughWallsRemainingMs > 0 ? now + data.seeThroughWallsRemainingMs : 0,
            footprintsUntil: data.footprintsRemainingMs > 0 ? now + data.footprintsRemainingMs : 0,
            footprintHistory: data.footprintHistory,
            deadChampions: data.deadChampions,
        });
        return true;
    },

    returnToTitle: () => set({
        gamePhase: 'title',
        activeMirrorChampionId: null,
        activePartyMemberId: null,
        lastCastResult: null,
        damageEvents: [],
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

        // Check casting skill (champion needs at least manaBase level to cast efficiently;
        // lower skill still casts but costs full mana — DM1 behaviour)
        const skillLevel = getSkillLevel(champion.skills, spell.castSkill);
        const lowSkill   = skillLevel < spell.manaBase;

        const newMana = vitals.mana - spell.manaCost;

        // Spell XP: manaBase × 15 in castSkill
        const spellXPGain = spell.manaBase * 15;
        const curXP = state.championXP[championId] ?? { fighter: 0, ninja: 0, priest: 0, wizard: 0 };
        const newXP = { ...curXP, [spell.castSkill]: curXP[spell.castSkill] + spellXPGain };

        const message = lowSkill
            ? `${spell.name} lancé avec difficulté. (${spell.castSkill} niv. ${skillLevel})`
            : `${spell.name} — ${spell.description}`;

        const now = Date.now();
        let newVitals = { ...vitals, mana: Math.max(0, newMana) };

        const base = {
            championXP: { ...state.championXP, [championId]: newXP },
            lastCastResult: { success: true, message, ts: now } as CastResult,
        };

        // ── Apply spell effect ────────────────────────────────────────────────
        switch (spell.effect) {

            case 'heal': {
                const healAmount = Math.round(spell.manaCost * 10);
                newVitals = { ...newVitals, hp: Math.min(champion.health, vitals.hp + healAmount) };
                return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
            }

            case 'light': {
                // FUL = +0.25 / 10 min ; OH IR RA = +0.50 / 15 min
                const isFul = spell.runes.slice(1).join(',') === 'ful';
                const lightContrib = isFul ? 0.25 : 0.50;
                const durationMs   = isFul
                    ? quantizeMsToOriginalTimerTicks(minutesToMs(10))
                    : quantizeMsToOriginalTimerTicks(minutesToMs(15));
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

            case 'open': {
                const [py, px] = state.position;
                let fy = py, fx = px;
                if (state.direction === 'NORTH') fy--;
                else if (state.direction === 'SOUTH') fy++;
                else if (state.direction === 'EAST') fx++;
                else fx--; // WEST
                const doorKey = `${state.level},${fy},${fx}`;
                const frontTile = getMap(state.level).tiles[fy]?.[fx];
                if (frontTile?.type === 'Door' && !state.openDoors.has(doorKey)) {
                    const newOpenDoors = new Set(state.openDoors);
                    newOpenDoors.add(doorKey);
                    return {
                        ...base,
                        championVitals: { ...state.championVitals, [championId]: newVitals },
                        openDoors: newOpenDoors,
                    };
                }
                return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
            }

            case 'fireball':
            case 'lightning':
            case 'poison_bolt':
            case 'disrupt_nonmaterial':
            case 'plasma': {
                const [py, px] = state.position;
                // Start one tile ahead of the player so it's visible from cast
                let startX = px, startY = py;
                if      (state.direction === 'NORTH') startY--;
                else if (state.direction === 'SOUTH') startY++;
                else if (state.direction === 'EAST')  startX++;
                else                                   startX--;
                const newProj: Projectile = {
                    id: `proj_${now}_${Math.random().toString(36).slice(2)}`,
                    level: state.level,
                    x: startX,
                    y: startY,
                    direction: state.direction,
                    effect: spell.effect as ProjectileEffect,
                    damage: [Math.round(spell.manaCost * 3), Math.round(spell.manaCost * 5)],
                    nextMoveAt: now + PROJECTILE_STEP_MS,
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    projectiles: [...state.projectiles, newProj],
                };
            }

            case 'poison_cloud': {
                const { x: fx, y: fy } = getFrontPosition(state.position, state.direction);
                const frontTargets = state.creatures.filter(
                    (creature) =>
                        creature.alive &&
                        creature.mapIndex === state.level &&
                        creature.x === fx &&
                        creature.y === fy,
                );

                if (frontTargets.length === 0) {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }

                let creatures = state.creatures as CreatureInstance[];
                let floorItems = state.floorItems;
                const damageEvents = [...state.damageEvents];
                const baseDamage = Math.max(2, Math.round(spell.manaCost * 1.5));
                const maxDamage = Math.max(baseDamage + 2, Math.round(spell.manaCost * 2.5));

                for (const target of frontTargets) {
                    const damage =
                        baseDamage + Math.floor(Math.random() * (maxDamage - baseDamage + 1));
                    const newHP = Math.max(0, target.currentHP - damage);
                    const killed = newHP <= 0;
                    if (creatures === state.creatures) creatures = [...creatures];
                    const index = creatures.findIndex((creature) => creature.id === target.id);
                    if (index >= 0) {
                        creatures[index] = { ...creatures[index], currentHP: newHP, alive: !killed };
                    }
                    if (killed) {
                        const dropped = dropCreatureCarriedItems(creatures, floorItems, target.id);
                        creatures = dropped.creatures;
                        floorItems = dropped.floorItems;
                    }
                    damageEvents.push({
                        id: `spell_poison_cloud_${now}_${target.id}`,
                        x: fx,
                        y: fy,
                        amount: damage,
                        ts: now,
                    });
                }

                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    creatures,
                    floorItems,
                    damageEvents,
                };
            }

            case 'darkness': {
                // Negative light contribution — inverse of light
                const durationMs = quantizeMsToOriginalTimerTicks(minutesToMs(10));
                const darkEntry: SpellLight = {
                    id: `dark_${now}_${Math.random().toString(36).slice(2)}`,
                    lightContrib: -0.5,
                    expiresAt: now + durationMs,
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    spellLights: [...state.spellLights, darkEntry],
                };
            }

            case 'shield':
            case 'fire_shield': {
                // protection: scales from ~25% (Lo) to ~75% (Mon), capped at 0.75
                const protection = Math.min(0.75, spell.manaCost * 0.022);
                const durationMs = quantizeMsToOriginalTimerTicks(spell.manaCost * 8_000);
                const shield: PartyShield = {
                    id: `shield_${now}_${Math.random().toString(36).slice(2)}`,
                    expiresAt: now + durationMs,
                    protection,
                    fireOnly: spell.effect === 'fire_shield',
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    activeShields: [...state.activeShields, shield],
                };
            }

            case 'invisibility': {
                // mana costs (17,25,35,43,53,61) → duration 2m16s … 8m8s
                const durationMs = quantizeMsToOriginalTimerTicks(spell.manaCost * 8_000);
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    invisibleUntil: Math.max(state.invisibleUntil, now + durationMs),
                };
            }

            case 'see_through_walls': {
                const durationMs = quantizeMsToOriginalTimerTicks(spell.manaCost * 10_000);
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
                const durationMs = quantizeMsToOriginalTimerTicks(spell.manaCost * 20_000);
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    footprintsUntil: Math.max(state.footprintsUntil, now + durationMs),
                };
            }

            case 'potion': {
                // Requires an empty flask (Misc typeId 40) in caster's hand.
                // Rune combo (sans power rune) determines which potion is created.
                const POTION_RUNE_MAP: Record<string, number> = {
                    'ya': 9,            // Stamina Potion
                    'vi,bro': 11,       // Antidote
                    'vi,bro,ra': 8,     // Health Potion
                    'ya,bro': 17,       // Anti-Magic / Shield Potion
                    'zo,bro,ra': 10,    // Mana Potion
                };
                const spellRunes = spell.runes.slice(1).join(',');
                const potionTypeId = POTION_RUNE_MAP[spellRunes];
                if (potionTypeId === undefined) {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }
                const equip = state.championEquipment[championId] ?? {};
                const flaskSlot = (['rightHand', 'leftHand'] as const).find(
                    slot => equip[slot]?.category === 'Misc' && equip[slot]?.typeId === 40
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
                const potion = { ...flask, category: 'Potion' as const, typeId: potionTypeId };
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

    regenTick: (delta) => set((state) => {
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
            elapsedGameTimeTicks: advanced.elapsedGameTimeTicks,
            regenTickRemainder,
        };
    }),

    tickMovement: (delta) => set((state) => {
        if (state.movementCooldown <= 0) return state;
        return { movementCooldown: Math.max(0, state.movementCooldown - delta) };
    }),

    // ─── XP ───────────────────────────────────────────────────────────────────
    gainXP: (championId, skill, amount) => set((state) => {
        const xp = state.championXP[championId];
        if (!xp || amount <= 0) return state;
        return {
            championXP: {
                ...state.championXP,
                [championId]: { ...xp, [skill]: xp[skill] + amount },
            },
        };
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
            const skill = mapOriginalSkillNumberToBasicSkill(option.attack.skillNumber);
            const masteryLevel = getChampionMasteryLevel(state, championId, champion, skill);
            return isAttackOptionUsableAtMastery(option, masteryLevel);
        });
        const selectedAttack = attackType !== undefined
            ? requestedAttack
            : (usableAttacks[0] ?? availableAttacks[0] ?? null);
        const selectedSkill = selectedAttack
            ? mapOriginalSkillNumberToBasicSkill(selectedAttack.attack.skillNumber)
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
            );
            const launchBonus = descriptor && descriptor.rawClass <= 12 ? descriptor.kineticEnergy : 1;
            const rawRange = throwRange + launchBonus;
            const finalRange = rawRange + Math.floor(Math.random() * 16) + Math.floor(rawRange / 2) + ninjaMastery;
            const rawDamage = Math.max(40, Math.min(200, 8 * ninjaMastery + Math.floor(Math.random() * 32)));
            const minDamage = Math.max(8, Math.floor(rawDamage * 0.65));
            const decay = Math.max(5, 11 - ninjaMastery);
            const projectile: Projectile = {
                id: `throw_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                level: state.level,
                x: state.position[1],
                y: state.position[0],
                direction: state.direction,
                effect: 'physical',
                damage: [minDamage, rawDamage],
                nextMoveAt: Date.now(),
                remainingRange: Math.max(1, finalRange),
                remainingAttack: rawDamage,
                stepDecay: decay,
                physicalItem: buildDroppedItem(rightHand, state.level, state.position[1], state.position[0]),
            };
            const attackerXP = state.championXP[championId] ?? { fighter: 0, ninja: 0, priest: 0, wizard: 0 };
            return {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
                championEquipment: { ...state.championEquipment, [championId]: { ...equip, rightHand: undefined } },
                championXP: {
                    ...state.championXP,
                    [championId]: {
                        ...attackerXP,
                        [selectedSkill]: attackerXP[selectedSkill] + selectedAttack.attack.experienceForAttacking,
                    },
                },
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
            const attackerXP = state.championXP[championId] ?? { fighter: 0, ninja: 0, priest: 0, wizard: 0 };
            return {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
                championEquipment: { ...state.championEquipment, [championId]: nextEquip },
                championXP: {
                    ...state.championXP,
                    [championId]: {
                        ...attackerXP,
                        [selectedSkill]: attackerXP[selectedSkill] + selectedAttack.attack.experienceForAttacking,
                    },
                },
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
            const base = {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
                championXP: state.championXP,
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
                        protection: 0.35,
                        fireOnly: false,
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
                        protection: 0.35,
                        fireOnly: true,
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
                    const dmgEvt: DamageEvent = {
                        id: `fuse_${Date.now()}_${target.id}`,
                        x: target.x,
                        y: target.y,
                        amount: fuseDamage,
                        ts: Date.now(),
                    };
                    return {
                        ...base,
                        creatures: newCreatures,
                        ...(newFloorItems !== state.floorItems ? { floorItems: newFloorItems } : {}),
                        damageEvents: [...state.damageEvents, dmgEvt],
                    };
                }
                case 'Invoke': {
                    const { x, y } = getFrontPosition(state.position, state.direction);
                    const newProj: Projectile = {
                        id: `weapon_invoke_${now}_${Math.random().toString(36).slice(2)}`,
                        level: state.level,
                        x,
                        y,
                        direction: state.direction,
                        effect: 'plasma',
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
            return {
                championCombat: { ...state.championCombat, [championId]: newCombat },
                championVitals,
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
        const attackerXP = state.championXP[championId] ?? { fighter: 0, ninja: 0, priest: 0, wizard: 0 };
        const attackSkill = selectedAttack
            ? mapOriginalSkillNumberToBasicSkill(selectedAttack.attack.skillNumber)
            : stats.skill;
        const newChampXP: Record<number, ChampionXP> = {
            ...state.championXP,
            [championId]: { ...attackerXP, [attackSkill]: attackerXP[attackSkill] + totalDmg },
        };

        // Kill XP: shared equally among living party members
        if (killed) {
            const def = CREATURE_TYPES[target.typeId];
            const killXP = def?.exp ?? 0;
            const living = state.party.filter(c => (state.championVitals[c.id]?.hp ?? 0) > 0);
            const share = living.length > 0 ? Math.floor(killXP / living.length) : 0;
            if (share > 0) {
                for (const c of living) {
                    const cx = newChampXP[c.id] ?? { fighter: 0, ninja: 0, priest: 0, wizard: 0 };
                    newChampXP[c.id] = { ...cx, fighter: cx.fighter + share };
                }
            }
        }

        const newDmgEvent: DamageEvent = {
            id: `dmg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            x: target.x,
            y: target.y,
            amount: totalDmg,
            ts: Date.now(),
        };

        return {
            creatures: newCreatures,
            ...(newFloorItems !== state.floorItems ? { floorItems: newFloorItems } : {}),
            championVitals,
            championXP: newChampXP,
            championCombat: { ...state.championCombat, [championId]: newCombat },
            damageEvents: [...state.damageEvents, newDmgEvent],
        };
    }),

    // ─── Door crush tick ─────────────────────────────────────────────────────
    tickDoors: (delta) => set((state) => {
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

                    dmgEvts = [...dmgEvts, {
                        id: `door_${Date.now()}_${key}`,
                        x: tx, y: ty, amount: dmg, ts: Date.now(),
                    }];

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
        if (state.party.length === 0) return state;
        const [py, px] = state.position;
        const map = getMap(state.level);

        // Walkability for monsters: no Wall, no Door (monsters can't open doors)
        const monsterWalkable = (y: number, x: number): boolean => {
            if (y < 0 || y >= map.height || x < 0 || x >= map.width) return false;
            const t = map.tiles[y]?.[x];
            return !!t && t.type !== 'Wall' && t.type !== 'TrickWall' && t.type !== 'Door';
        };

        let creatures  = state.creatures as CreatureInstance[];
        let vitals     = state.championVitals;
        let dmgEvts    = state.damageEvents;
        let championInventories = state.championInventories;
        let anyChange  = false;
        // Champions that reach 0 HP this tick — processed after the loop
        const newlyDead: number[] = [];

        // Pick an attack target based on creature side:
        //   left creature → prefers left column (party[0,2]), falls back to right (party[1,3])
        //   right creature → prefers right column (party[1,3]), falls back to left (party[0,2])
        // Uses `vitals` (not state.championVitals) so kills earlier this tick are respected.
        const getTarget = (side: CreatureSide, attackAnyChampion = false) => {
            if (attackAnyChampion) {
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
            const canSee   = dist <= 8 && hasLineOfSight(map, state.level, state.openDoors, c.x, c.y, px, py);
            const nowMs = Date.now();
            const confused = (creatureConfusedUntil.get(c.id) ?? 0) > nowMs;
            const fluxcaged = (creatureFluxcageUntil.get(c.id) ?? 0) > nowMs;

            let nx = c.x, ny = c.y;

            // ── Movement ──────────────────────────────────────────────────────
            if (moveTimer === 0 && !adjacent) {
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

                if (canSee) {
                    const candidates: [number, number][] = [];
                    if (dx !== 0) candidates.push([c.x + Math.sign(dx), c.y]);
                    if (dy !== 0) candidates.push([c.x, c.y + Math.sign(dy)]);
                    const valid = candidates.filter(
                        ([cx, cy]) => monsterWalkable(cy, cx) && tileAvailable(cx, cy)
                    );
                    if (valid.length > 0) {
                        [nx, ny] = valid[Math.floor(Math.random() * valid.length)];
                        if (nx !== c.x || ny !== c.y) {
                            if (canSee) playCreatureMove(c.typeId);
                            notifyCreatureAction(c.id, 'move');
                        }
                    }
                } else {
                    const dirs: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];
                    const valid = dirs
                        .map(([ddx, ddy]) => [c.x + ddx, c.y + ddy] as [number, number])
                        .filter(([cx, cy]) => monsterWalkable(cy, cx) && tileAvailable(cx, cy));
                    if (valid.length > 0) {
                        [nx, ny] = valid[Math.floor(Math.random() * valid.length)];
                        if (nx !== c.x || ny !== c.y) {
                            if (canSee) playCreatureMove(c.typeId);
                            notifyCreatureAction(c.id, 'move');
                        }
                    } else {
                        moveTimer = nextMonsterMoveDelaySecondsApprox(def.moveSpd);
                    }
                }
            }

            // ── Attack ────────────────────────────────────────────────────────
            const partyInvisible = nowMs < state.invisibleUntil;
            if (atkTimer === 0 && adjacent && !partyInvisible) {
                atkTimer = nextMonsterAttackDelaySecondsApprox(def.atkSpd);
                if (confused && randomInt(2) === 0) {
                    creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });
                    continue;
                }
                playCreatureAttack(c.typeId);
                notifyCreatureAction(c.id, 'attack');
                creatureAttackWindows.set(c.id, nowMs + CREATURE_ATTACK_WINDOW_MS);

                const target = getTarget(c.side, def.attackAnyChampion);
                if (target) {
                    const tv = vitals[target.id];
                    if (tv && tv.hp > 0) {
                        const targetChampion = state.party.find((partyChampion) => partyChampion.id === target.id);
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
                        const damageClass = chooseMonsterDamageClassApprox(def);
                        const attackResolution = targetChampion
                            ? determineMonsterAttackDamageApprox(state, targetChampion, tv, c, damageClass)
                            : { damage: 0 as number, hitZones: undefined };
                        const raw = attackResolution.damage;
                        if (raw <= 0) continue;
                        const equip = state.championEquipment[target.id] ?? {};
                        const shieldProt = getActiveShieldProtectionApprox(state.activeShields, nowMs, damageClass);
                        const resistProt = computeChampionResistanceApprox(targetChampion, equip, damageClass);
                        const totalMitigation = 1 - Math.min(0.9, shieldProt + resistProt - shieldProt * resistProt);
                        const dmg = Math.max(1, Math.round(raw * totalMitigation));
                        let nextTargetVitals = { ...tv, hp: Math.max(0, tv.hp - dmg) };
                        if (def.attackTypes.includes('StaminaDrain')) {
                            const staminaDamage = Math.max(1, Math.floor(dmg / 2) + randomInt(4));
                            const effective = getEffectiveChampionStats(targetChampion, equip);
                            nextTargetVitals = {
                                ...nextTargetVitals,
                                stamina: clampVital(nextTargetVitals.stamina - staminaDamage, effective.stamina),
                            };
                        }
                        if (nextTargetVitals.hp > 0 && def.poisonAttack > 0 && randomInt(2) !== 0) {
                            if (targetChampion) {
                                const effective = getEffectiveChampionStats(targetChampion, equip);
                                const poisonStrength = adjustByAttributeApprox(def.poisonAttack, effective.vitality);
                                nextTargetVitals = applyPoisonCharacterApprox(nextTargetVitals, poisonStrength);
                            }
                        }
                        if (nextTargetVitals.hp > 0 && damageClass === 'physical' && targetChampion) {
                            nextTargetVitals = applyChampionHitWoundsApprox(
                                nextTargetVitals,
                                targetChampion,
                                equip,
                                dmg,
                                attackResolution.hitZones,
                            );
                        }
                        const newHP = nextTargetVitals.hp;
                        vitals = { ...vitals, [target.id]: nextTargetVitals };
                        if (newHP === 0 && !newlyDead.includes(target.id))
                            newlyDead.push(target.id);
                        dmgEvts = [...dmgEvts, {
                            id: `mdmg_${Date.now()}_${c.id}`,
                            x: c.x, y: c.y, amount: dmg, ts: Date.now(),
                        }];
                        anyChange = true;
                    }
                }
            }

            // Assign side at destination: pick available side
            let newSide = c.side;
            if (nx !== c.x || ny !== c.y) {
                const destOther = creatures.find(
                    o => o.alive && o.id !== c.id && o.mapIndex === state.level && o.x === nx && o.y === ny
                );
                newSide = destOther ? (destOther.side === 'left' ? 'right' : 'left') : 'left';
            }

            // Always persist updated timers to the external Map (no re-render cost)
            creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });

            // Only update Zustand state when something visible changes (position / side / alive)
            if (nx !== c.x || ny !== c.y || newSide !== c.side) {
                if (creatures === state.creatures) creatures = [...creatures];
                creatures[i] = { ...c, x: nx, y: ny, side: newSide };
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

        if (!anyChange && creatures === state.creatures) return state;

        const selectedChampionIndex = party.length > 0
            ? Math.min(state.selectedChampionIndex, party.length - 1)
            : 0;

        return {
            creatures,
            ...(vitals !== state.championVitals             ? { championVitals: vitals }                     : {}),
            ...(dmgEvts !== state.damageEvents              ? { damageEvents: dmgEvts }                      : {}),
            ...(championInventories !== state.championInventories ? { championInventories } : {}),
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
        // 1. Remove expired lights
        const spellLights = state.spellLights.filter(l => l.expiresAt > now);

        // 2. Advance projectiles
        const keepProjectiles: Projectile[] = [];
        let creatures = state.creatures as CreatureInstance[];
        let dmgEvts = state.damageEvents;
        let floorItems = state.floorItems;

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
            const closedDoorBlocksProjectile = (() => {
                if (!tile || tile.type !== 'Door' || state.openDoors.has(doorKey)) return false;
                const door = tile.objects.find((o): o is import('../types/game').DoorObject => o.category === 'Door');
                return doorBlocksThrownItems(door?.doorType);
            })();
            if (!tile || tile.type === 'Wall' || (tile.type === 'TrickWall' && !state.openWalls.has(wallKey)) || closedDoorBlocksProjectile) {
                if (proj.effect === 'physical' && proj.physicalItem) {
                    if (floorItems === state.floorItems) floorItems = [...floorItems];
                    floorItems.push(buildDroppedItem(proj.physicalItem, proj.level, proj.x, proj.y));
                }
                continue; // projectile absorbed by wall
            }

            // Creature hit → deal damage and despawn
            const hit = creatures.find(c => c.alive && c.mapIndex === proj.level && c.x === nx && c.y === ny);
            if (hit) {
                const disruptCanDamage = canDisruptNonMaterialTarget(now, hit);
                const rolledDamage = proj.effect === 'physical'
                    ? Math.max(1, Math.round(proj.remainingAttack ?? proj.damage[1]))
                    : proj.damage[0] + Math.floor(Math.random() * (proj.damage[1] - proj.damage[0] + 1));
                const dmg = proj.effect === 'disrupt_nonmaterial'
                    ? disruptCanDamage ? rolledDamage : 0
                    : rolledDamage;
                const newHP = Math.max(0, hit.currentHP - dmg);
                const killed = newHP <= 0;
                if (creatures === state.creatures) creatures = [...creatures];
                const idx = creatures.findIndex(c => c.id === hit.id);
                if (idx >= 0) creatures[idx] = { ...creatures[idx], currentHP: newHP, alive: !killed };
                if (killed) {
                    const dropped = dropCreatureCarriedItems(creatures, floorItems, hit.id);
                    creatures = dropped.creatures;
                    floorItems = dropped.floorItems;
                }
                if (dmg > 0) {
                    dmgEvts = [...dmgEvts, {
                        id: `pdmg_${now}_${Math.random().toString(36).slice(2)}`,
                        x: nx, y: ny, amount: dmg, ts: now,
                    }];
                }
                if (proj.effect === 'physical' && proj.physicalItem) {
                    if (floorItems === state.floorItems) floorItems = [...floorItems];
                    floorItems.push(buildDroppedItem(proj.physicalItem, proj.level, nx, ny));
                }
                continue; // projectile consumed
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

            // Move forward, schedule next step in 300 ms
            keepProjectiles.push({ ...proj, x: nx, y: ny, nextMoveAt: now + PROJECTILE_STEP_MS });
        }

        // 3. Clean expired shields
        const activeShields = state.activeShields.filter(s => s.expiresAt > now);
        // 4. Clean footprints older than 60 s
        const footprintHistory = state.footprintHistory.filter(e => now - e.ts < FOOTPRINT_LIFETIME_MS);

        const lightsChanged       = spellLights.length !== state.spellLights.length;
        const projectilesChanged  = keepProjectiles.length !== state.projectiles.length ||
            keepProjectiles.some((p, i) => p !== state.projectiles[i]);
        const creaturesChanged    = creatures !== state.creatures;
        const dmgChanged          = dmgEvts !== state.damageEvents;
        const floorItemsChanged   = floorItems !== state.floorItems;
        const shieldsChanged      = activeShields.length !== state.activeShields.length;
        const footprintsChanged   = footprintHistory.length !== state.footprintHistory.length;

        if (!lightsChanged && !projectilesChanged && !creaturesChanged &&
            !dmgChanged && !floorItemsChanged && !shieldsChanged && !footprintsChanged) return state;

        return {
            ...(lightsChanged      ? { spellLights }                   : {}),
            ...(projectilesChanged ? { projectiles: keepProjectiles }   : {}),
            ...(creaturesChanged   ? { creatures }                      : {}),
            ...(dmgChanged         ? { damageEvents: dmgEvts }          : {}),
            ...(floorItemsChanged  ? { floorItems }                     : {}),
            ...(shieldsChanged     ? { activeShields }                  : {}),
            ...(footprintsChanged  ? { footprintHistory }               : {}),
        };
    }),

    tickCombat: (delta) => set((state) => {
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
}));
