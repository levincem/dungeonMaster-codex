import { CREATURE_TYPES } from '../../data/creatures';
import {
    getPotionDef,
    resolveItemName,
    WEAPON_TYPES,
} from '../../data/items';
import {
    getChampionMaxLoad,
    getEffectiveChampionStatsWithBonuses,
    type EquipmentStatBonuses,
} from '../../data/equipment';
import { getOriginalSpellRequiredSkillLevel } from '../../data/originalSpells';
import {
    mapOriginalSkillNumberToSkillKey,
    type ChampionTemporaryXP,
    type ChampionXP,
    type SkillKey,
} from '../../data/skillProgression';
import {
    getAttackCooldownSeconds,
    getDefaultAttackOption,
    getOriginalWeaponReference,
    matchesRequiredAmmoRawClass,
} from '../../data/weaponAttacks';
import type { Champion } from '../../types/champion';
import type {
    CardinalDir,
    ChampionEquipment,
    CreatureCell,
    CreatureInstance,
    DoorObject,
    FloorItem,
    GameMap,
} from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type { SpellDef } from '../../data/runes';
import type {
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    Direction,
    Projectile,
    ProjectileEffect,
} from '../runtimeTypes';
import { buildRuntimeCastResult } from './storeFeedbackRuntime';
import { isTrickWallBlocking } from './trickWallState';
import {
    getChampionSkillLevelFromXP,
    getEquipmentSkillLevelModifier,
} from './storeChampionRuntime';

type FrontDoorStateLike = {
    openDoors: Set<string>;
};

type ProjectileBlockStateLike = FrontDoorStateLike & {
    openWalls: Set<string>;
};

type ChampionMasteryStateLike = {
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    championEquipment: Record<number, ChampionEquipment>;
};

type ThrowStateLike = ChampionMasteryStateLike & {
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    activePotionBoosts: ActivePotionBoost[];
    level: number;
    position: [number, number];
    direction: Direction;
};

export type MonsterDamageClass = 'physical' | 'fire' | 'magic' | 'mental';

const QUIVER_SLOTS: EquipSlotKey[] = ['quiver1', 'quiver2', 'quiver3', 'quiver4'];
const CARDINAL_DIRS: CardinalDir[] = ['North', 'East', 'South', 'West'];

export function getRightHandStats(
    equip: ChampionEquipment | undefined,
): { name: string; dmgMin: number; dmgMax: number; cooldownSec: number; skill: SkillKey } {
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

export function buildAttackResultMessage(message: string, success = false) {
    return buildRuntimeCastResult(message, success);
}

export function getThrownPotionExplosionEffect(
    item: FloorItem,
): Exclude<ProjectileEffect, 'physical'> | undefined {
    if (item.category !== 'Potion') return undefined;
    const def = getPotionDef(item.typeId, item.rawName);
    if (def?.effect === 'firebomb') return 'fireball';
    if (def?.effect === 'poisonCloud') return 'poison_cloud';
    return undefined;
}

export function rollOriginalPartyWideAttack(
    rawAttack: number,
    randomInt: (maxExclusive: number) => number,
): number {
    if (rawAttack <= 0) return 0;
    const randomAttack = (rawAttack >> 3) + 1;
    const centeredAttack = rawAttack - randomAttack;
    return Math.max(1, centeredAttack + randomInt(Math.max(1, randomAttack << 1)));
}

export function getProjectileDamageClass(
    effect: Exclude<ProjectileEffect, 'physical'>,
): MonsterDamageClass {
    if (effect === 'fireball') return 'fire';
    return 'magic';
}

export function getOriginalSpellSuccessChance(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    currentVitals: ChampionVitals | undefined,
    spell: SpellDef | null | undefined,
    skillLevel: number,
    getEffectiveChampionStatsRuntime: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals: ChampionVitals | undefined,
    ) => { wisdom: number },
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

export function rollOriginalSpellCastSuccess(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    currentVitals: ChampionVitals | undefined,
    spell: SpellDef | null | undefined,
    skillLevel: number,
    deps: {
        randomInt: (maxExclusive: number) => number;
        getEffectiveChampionStatsRuntime: (
            champion: Champion,
            equip: ChampionEquipment | undefined,
            activePotionBoosts: ActivePotionBoost[],
            currentVitals: ChampionVitals | undefined,
        ) => { wisdom: number };
    },
): { success: boolean; requiredSkillLevel: number; missingSkillLevels: number; successChance: number } {
    if (!spell) {
        return {
            success: false,
            requiredSkillLevel: 0,
            missingSkillLevels: 0,
            successChance: 0,
        };
    }
    const effective = deps.getEffectiveChampionStatsRuntime(
        champion,
        equip,
        activePotionBoosts,
        currentVitals,
    );
    const requiredSkillLevel = getOriginalSpellRequiredSkillLevel(spell.runes) ?? spell.manaBase;
    const missingSkillLevels = Math.max(0, requiredSkillLevel - skillLevel);
    const successChance = getOriginalSpellSuccessChance(
        champion,
        equip,
        activePotionBoosts,
        currentVitals,
        spell,
        skillLevel,
        deps.getEffectiveChampionStatsRuntime,
    );
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
        if (deps.randomInt(128) > wisdomThreshold) {
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

export function getFrontPosition(
    position: [number, number],
    direction: Direction,
): { x: number; y: number } {
    const [y, x] = position;
    if (direction === 'NORTH') return { x, y: y - 1 };
    if (direction === 'SOUTH') return { x, y: y + 1 };
    if (direction === 'EAST') return { x: x + 1, y };
    return { x: x - 1, y };
}

export function isBlockedForProjectile(
    state: ProjectileBlockStateLike,
    level: number,
    x: number,
    y: number,
    deps: {
        getMap: (level: number) => GameMap;
        getDoorObject: (tile: GameMap['tiles'][number][number]) => DoorObject | null;
        doorBlocksThrownItems: (doorType: DoorObject['doorType'] | undefined) => boolean;
    },
): boolean {
    const map = deps.getMap(level);
    const tile = map.tiles[y]?.[x];
    if (!tile) return true;
    if (tile.type === 'Wall') return true;
    if (isTrickWallBlocking(tile, level, y, x, state.openWalls)) return true;
    if (tile.type !== 'Door' || state.openDoors.has(`${level},${y},${x}`)) return false;
    const door = deps.getDoorObject(tile);
    return deps.doorBlocksThrownItems(door?.doorType);
}

export function getClosedDoorAt(
    state: FrontDoorStateLike,
    level: number,
    x: number,
    y: number,
    deps: {
        getMap: (level: number) => GameMap;
        getDoorObject: (tile: GameMap['tiles'][number][number]) => DoorObject | null;
    },
): { key: string; door: DoorObject } | null {
    const tile = deps.getMap(level).tiles[y]?.[x];
    if (!tile || tile.type !== 'Door') return null;
    const key = `${level},${y},${x}`;
    if (state.openDoors.has(key)) return null;
    const door = deps.getDoorObject(tile);
    return door ? { key, door } : null;
}

export function createChampionCombatState(
    cooldownSec: number,
    defenseModifier = 0,
): ChampionCombat {
    return {
        cooldown: cooldownSec,
        cooldownMax: cooldownSec > 0 ? cooldownSec : 1,
        defenseModifier,
    };
}

export function getChampionMasteryLevel<TState extends ChampionMasteryStateLike>(
    state: TState,
    championId: number,
    skill: SkillKey,
): number {
    const equipment = state.championEquipment[championId];
    return getChampionSkillLevelFromXP(
        state.championXP[championId],
        state.championTemporaryXP[championId],
        skill,
        { bonusLevels: getEquipmentSkillLevelModifier(skill, equipment) },
    );
}

export function originalThrowingDistance(
    champion: Champion,
    equip: ChampionEquipment | undefined,
    currentStamina: number | undefined,
    item: FloorItem,
    descriptor: ReturnType<typeof getOriginalWeaponReference>,
    fighterMastery: number,
    ninjaMastery: number,
    extraBonuses: Partial<EquipmentStatBonuses> | undefined,
    randomFraction: () => number,
): number {
    const effective = getEffectiveChampionStatsWithBonuses(champion, equip ?? {}, extraBonuses);
    let value = Math.floor(randomFraction() * 16) + effective.strength;
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

export function buildDroppedItem(
    item: FloorItem,
    level: number,
    x: number,
    y: number,
): FloorItem {
    return {
        ...item,
        mapIndex: level,
        x,
        y,
        tilePos: 'North',
    };
}

export function buildDroppedItems(
    items: FloorItem[],
    level: number,
    x: number,
    y: number,
): FloorItem[] {
    return items.map((item) => buildDroppedItem(item, level, x, y));
}

export function buildOriginalCreatureFixedDropItems(
    creature: CreatureInstance,
    randomInt: (maxExclusive: number) => number,
): FloorItem[] {
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

export function parseItemCharges(
    rawName: string | undefined,
): { charges?: number; maxCharges?: number } {
    if (!rawName) return {};
    const match = rawName.match(/\(Charges=(\d+)\)/i);
    if (!match) return {};
    const charges = Number(match[1]);
    return Number.isFinite(charges) ? { charges, maxCharges: charges } : {};
}

export function getActionCharges(item: FloorItem | undefined): number | null {
    if (!item) return null;
    if (typeof item.actionCharges === 'number') return item.actionCharges;
    const parsed = parseItemCharges(item.rawName);
    return typeof parsed.charges === 'number' ? parsed.charges : null;
}

export function updateEquippedItemCharges(
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

export function findQuiverAmmo(
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

export function buildDragThrowProjectile<TState extends ThrowStateLike>(
    state: TState,
    championId: number,
    champion: Champion,
    item: FloorItem,
    deps: {
        randomFraction: () => number;
        nowMs: () => number;
        getChampionRuntimeBonuses: (
            champion: Champion,
            vitals: ChampionVitals | undefined,
            activePotionBoosts: ActivePotionBoost[],
        ) => Partial<EquipmentStatBonuses>;
    },
): Projectile {
    const equip = state.championEquipment[championId] ?? {};
    const descriptor = getOriginalWeaponReference(item);
    const fighterMastery = getChampionMasteryLevel(state, championId, 'fighter');
    const ninjaMastery = getChampionMasteryLevel(state, championId, 'ninja');
    const currentStamina = state.championVitals[championId]?.stamina;
    const throwRange = originalThrowingDistance(
        champion,
        equip,
        currentStamina,
        item,
        descriptor,
        fighterMastery,
        ninjaMastery,
        deps.getChampionRuntimeBonuses(
            champion,
            state.championVitals[championId],
            state.activePotionBoosts,
        ),
        deps.randomFraction,
    );
    const launchBonus = descriptor && descriptor.rawClass <= 12 ? descriptor.kineticEnergy : 1;
    const rawRange = throwRange + launchBonus;
    const finalRange = Math.max(
        1,
        rawRange + Math.floor(deps.randomFraction() * 8) + Math.floor(rawRange / 3) + ninjaMastery,
    );
    const baseDamage = Math.max(6, descriptor?.damage ?? Math.round((descriptor?.weightKg ?? 1) * 8));
    const maxDamage = Math.max(
        10,
        baseDamage * 4 + fighterMastery * 3 + ninjaMastery * 4 + Math.floor(deps.randomFraction() * 18),
    );
    const minDamage = Math.max(2, Math.floor(maxDamage * 0.55));
    const decay = Math.max(3, 9 - Math.min(6, ninjaMastery));
    const explosionOnImpact = getThrownPotionExplosionEffect(item);
    const explosionAttack = explosionOnImpact ? Math.max(1, item.potionPower ?? 40) : undefined;
    const now = deps.nowMs();

    return {
        id: `drag_throw_${now}_${deps.randomFraction().toString(36).slice(2)}`,
        level: state.level,
        x: state.position[1],
        y: state.position[0],
        direction: state.direction,
        effect: 'physical',
        damage: [minDamage, maxDamage],
        nextMoveAt: now,
        remainingRange: finalRange,
        remainingAttack: maxDamage,
        stepDecay: decay,
        physicalItem: buildDroppedItem(item, state.level, state.position[1], state.position[0]),
        explosionOnImpact,
        explosionAttack,
    };
}

export function dropCreatureCarriedItems(
    creatures: CreatureInstance[],
    floorItems: FloorItem[],
    creatureId: string,
    randomInt: (maxExclusive: number) => number,
): { creatures: CreatureInstance[]; floorItems: FloorItem[] } {
    const index = creatures.findIndex((creature) => creature.id === creatureId);
    if (index < 0) return { creatures, floorItems };

    const creature = creatures[index];
    if (!creature) return { creatures, floorItems };
    const def = CREATURE_TYPES[creature.typeId];
    const carriedItems = creature.carriedItems ?? [];
    const shouldConsumeFixedDrops = Boolean(def?.fixedDrops.length) && !creature.fixedDropsDropped;
    const fixedDropItems = buildOriginalCreatureFixedDropItems(creature, randomInt);
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

export function getWeaponName(item: FloorItem | undefined): string {
    if (!item) return '';
    if (item.category === 'Weapon') return WEAPON_TYPES[item.typeId]?.name ?? item.rawName ?? '';
    return resolveItemName(item.category, item.typeId, item.rawName);
}

export function isLikelyNonMaterial(target: CreatureInstance): boolean {
    const def = CREATURE_TYPES[target.typeId];
    if (def) return def.nonMaterial;
    const name = CREATURE_TYPES[target.typeId]?.name ?? '';
    return /ghost|materializer|wizard eye|black flame|lord chaos/i.test(name);
}

export function isCreatureCellOccupiedOnTile(
    creatures: CreatureInstance[],
    mover: CreatureInstance,
    targetCell: CreatureCell,
    deps: {
        isCreatureCellOccupiedOnTile: (
            creatures: CreatureInstance[],
            mover: CreatureInstance,
            targetCell: CreatureCell,
        ) => boolean;
    },
): boolean {
    return deps.isCreatureCellOccupiedOnTile(creatures, mover, targetCell);
}
