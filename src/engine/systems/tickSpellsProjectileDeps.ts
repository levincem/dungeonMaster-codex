import { CREATURE_TYPES } from '../../data/creatures';
import { doorBlocksThrownItems, doorBlocksThrownPhysicalItem } from '../../data/doors';
import { findSpell } from '../../data/runes';
import { rollOriginalSpellProjectileImpact } from '../../data/spellRuntime';
import type { CreatureInstance } from '../../types/game';
import type { ActivePoisonCloud, Projectile, ProjectileEffect } from '../runtimeTypes';
import { GRID_SIZE } from '../constants';
import { PHYSICAL_PROJECTILE_STEP_MS, PROJECTILE_STEP_MS } from '../time';
import { rollOriginalProjectileImpactAttack, type OriginalProjectileIncomingAttackType } from './originalProjectileImpact';
import type { TickSpellsProjectileDeps } from './tickSpellsRuntime';

type IncomingAttackType = OriginalProjectileIncomingAttackType;

type TickSpellsProjectileDepsParams = Pick<
    TickSpellsProjectileDeps,
    | 'getMap'
    | 'randomInt'
    | 'buildActivePoisonCloud'
    | 'buildDroppedItem'
    | 'resolveProjectileTeleporterTransport'
    | 'resolveChampionIncomingAttack'
    | 'buildChampionDamageEvent'
    | 'applyPoisonCharacter'
    | 'buildDeathDrop'
    | 'applyPartySpellBacklashDamage'
    | 'applyPartyWideIncomingAttack'
    | 'dropCreatureCarriedItems'
    | 'buildDeathDustEvent'
    | 'buildCreatureDamageEvent'
    | 'onDoorMotion'
    | 'getDoorSoundVolume'
    | 'isLikelyNonMaterial'
> & {
    originalSpellProjectileAttack: TickSpellsProjectileDeps['originalSpellProjectileAttack'];
    doorToggleSoundDurationMs: TickSpellsProjectileDeps['doorToggleSoundDurationMs'];
    creatureAttackWindows: Map<string, number>;
};

type DisruptNonMaterialDeps = {
    isLikelyNonMaterial: (target: CreatureInstance) => boolean;
    creatureAttackWindows: Map<string, number>;
    randomInt: (maxExclusive: number) => number;
};

function mapProjectileImpactAttackType(
    effect: Exclude<ProjectileEffect, 'physical'>,
): IncomingAttackType {
    if (effect === 'fireball') return 'Fire';
    if (effect === 'lightning') return 'Lightning';
    return 'Magic';
}

export function getThrownExplosionVisualScale(attackPower: number | undefined): number {
    const normalized = Math.max(24, Math.min(255, attackPower ?? 40));
    return 0.78 + ((normalized - 24) / 231) * 0.72;
}

export function getOriginalCreaturePoisonAdjustedAttack(
    creatureTypeId: number,
    poisonAttack: number,
    randomInt: (maxExclusive: number) => number,
): number {
    if (poisonAttack <= 0) return 0;
    const creature = CREATURE_TYPES[creatureTypeId];
    if (!creature) return poisonAttack;
    if (creature.poisonResistance >= 15) return 0;
    return Math.floor(((poisonAttack + randomInt(4)) << 3) / (creature.poisonResistance + 1));
}

export function rollOriginalExplosionBurstAttack(
    effect: Exclude<ProjectileEffect, 'physical'>,
    attackPower: number,
    randomInt: (maxExclusive: number) => number,
): number {
    if (attackPower <= 0) return 0;
    if (effect === 'poison_cloud') {
        return Math.max(1, Math.min(attackPower >> 5, 4) + randomInt(2));
    }
    const burstBase = (attackPower >> 1) + 1;
    return burstBase + randomInt(Math.max(1, burstBase)) + 1;
}

function isMaterializerLike(target: CreatureInstance): boolean {
    const name = CREATURE_TYPES[target.typeId]?.name ?? '';
    return target.typeId === 19 || /materializer|zytaz/i.test(name);
}

function canDisruptNonMaterialTarget(
    nowMs: number,
    target: CreatureInstance,
    deps: Pick<DisruptNonMaterialDeps, 'isLikelyNonMaterial' | 'creatureAttackWindows'>,
): boolean {
    if (!deps.isLikelyNonMaterial(target)) return false;
    if (!isMaterializerLike(target)) return true;
    return (deps.creatureAttackWindows.get(target.id) ?? 0) > nowMs;
}

export function rollOriginalDisruptNonMaterialAttack(
    nowMs: number,
    target: CreatureInstance,
    baseExplosionAttack: number,
    deps: DisruptNonMaterialDeps,
): number {
    if (baseExplosionAttack <= 0 || !deps.isLikelyNonMaterial(target)) return 0;
    if (!isMaterializerLike(target)) return baseExplosionAttack;
    if (!canDisruptNonMaterialTarget(nowMs, target, deps)) return 0;

    const additionalAttack = baseExplosionAttack >> 3;
    const centeredAttack = Math.max(0, baseExplosionAttack - additionalAttack);
    const randomAdditionalAttack = (additionalAttack << 1) + 1;
    return Math.max(
        1,
        centeredAttack + deps.randomInt(Math.max(1, randomAdditionalAttack)) + deps.randomInt(4),
    );
}

export function resolveRuntimeProjectileImpact(
    projectile: Projectile,
    randomInt: (maxExclusive: number) => number,
): { damage: number; attackType: IncomingAttackType; poisonAttack: number } {
    const sourceSpell = projectile.spellRunes ? findSpell(projectile.spellRunes) : null;
    if (projectile.effect === 'physical') {
        return {
            damage: Math.max(1, Math.round(projectile.remainingAttack ?? projectile.damage[1])),
            attackType: 'Blunt',
            poisonAttack: 0,
        };
    }
    if (!sourceSpell) {
        return rollOriginalProjectileImpactAttack(
            projectile.effect,
            Math.max(0, Math.round(projectile.remainingRange ?? 0)),
            Math.max(0, Math.round(projectile.remainingAttack ?? 0)),
            randomInt,
        );
    }

    const impact = rollOriginalSpellProjectileImpact(
        sourceSpell,
        Math.max(0, Math.round(projectile.remainingRange ?? 0)),
        Math.max(0, Math.round(projectile.remainingAttack ?? 0)),
        randomInt,
    );
    if (!impact) {
        return rollOriginalProjectileImpactAttack(
            projectile.effect,
            Math.max(0, Math.round(projectile.remainingRange ?? 0)),
            Math.max(0, Math.round(projectile.remainingAttack ?? 0)),
            randomInt,
        );
    }
    return {
        damage: impact.damage,
        attackType: mapProjectileImpactAttackType(projectile.effect),
        poisonAttack: impact.poisonStrength,
    };
}

export function rollRuntimeSourceBackedProjectileImpact(
    projectile: Projectile,
    randomInt: (maxExclusive: number) => number,
) {
    const sourceSpell = projectile.spellRunes ? findSpell(projectile.spellRunes) : null;
    return sourceSpell
        ? rollOriginalSpellProjectileImpact(
            sourceSpell,
            Math.max(0, Math.round(projectile.remainingRange ?? 0)),
            Math.max(0, Math.round(projectile.remainingAttack ?? 0)),
            randomInt,
        )
        : null;
}

export function buildLingeringPoisonCloudAfterImmediatePulse(
    buildActivePoisonCloud: TickSpellsProjectileDeps['buildActivePoisonCloud'],
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

function rollRandomProjectileDamage(projectile: Projectile): number {
    return projectile.damage[0]
        + Math.floor(Math.random() * (projectile.damage[1] - projectile.damage[0] + 1));
}

export function createTickSpellsProjectileDeps(
    currentGameTick: number,
    now: number,
    deps: TickSpellsProjectileDepsParams,
): TickSpellsProjectileDeps {
    return {
        getMap: deps.getMap,
        currentGameTick,
        now,
        randomInt: deps.randomInt,
        doorBlocksProjectile: (door, projectile) => projectile.effect === 'physical'
            ? doorBlocksThrownPhysicalItem(door.doorType, projectile.physicalItem)
            : doorBlocksThrownItems(door.doorType),
        buildActivePoisonCloud: deps.buildActivePoisonCloud,
        getThrownExplosionVisualScale,
        buildDroppedItem: deps.buildDroppedItem,
        resolveProjectileTeleporterTransport: deps.resolveProjectileTeleporterTransport,
        originalSpellProjectileAttack: deps.originalSpellProjectileAttack,
        resolveProjectileImpact: (projectile) => resolveRuntimeProjectileImpact(projectile, deps.randomInt),
        resolveChampionIncomingAttack: deps.resolveChampionIncomingAttack,
        buildChampionDamageEvent: deps.buildChampionDamageEvent,
        applyPoisonCharacter: deps.applyPoisonCharacter,
        buildDeathDrop: deps.buildDeathDrop,
        applyPartySpellBacklashDamage: deps.applyPartySpellBacklashDamage,
        applyPartyWideIncomingAttack: deps.applyPartyWideIncomingAttack,
        rollExplosionBurstAttack: (effect, attackPower) =>
            rollOriginalExplosionBurstAttack(effect, attackPower, deps.randomInt),
        gridSize: GRID_SIZE,
        rollSourceBackedImpact: (projectile) =>
            rollRuntimeSourceBackedProjectileImpact(projectile, deps.randomInt),
        getCreaturePoisonAdjustedAttack: (creatureTypeId, poisonAttack) =>
            getOriginalCreaturePoisonAdjustedAttack(creatureTypeId, poisonAttack, deps.randomInt),
        hitCreatureAbsorbsMissiles: (creature) => Boolean(CREATURE_TYPES[creature.typeId]?.absorbMissiles),
        rollRandomProjectileDamage,
        isLikelyNonMaterial: deps.isLikelyNonMaterial,
        rollDisruptNonMaterialAttack: (nowMs, target, baseExplosionAttack) =>
            rollOriginalDisruptNonMaterialAttack(nowMs, target, baseExplosionAttack, {
                isLikelyNonMaterial: deps.isLikelyNonMaterial,
                creatureAttackWindows: deps.creatureAttackWindows,
                randomInt: deps.randomInt,
            }),
        dropCreatureCarriedItems: deps.dropCreatureCarriedItems,
        buildDeathDustEvent: deps.buildDeathDustEvent,
        buildCreatureDamageEvent: deps.buildCreatureDamageEvent,
        buildLingeringPoisonCloud: (level, x, y, initialAttack, nextPulseGameTick, visualScale) =>
            buildLingeringPoisonCloudAfterImmediatePulse(
                deps.buildActivePoisonCloud,
                level,
                x,
                y,
                initialAttack,
                nextPulseGameTick,
                visualScale,
            ),
        rollPoisonCloudPulseAttack: (remainingAttack) =>
            rollOriginalExplosionBurstAttack('poison_cloud', remainingAttack, deps.randomInt),
        onDoorMotion: deps.onDoorMotion,
        doorToggleSoundDurationMs: deps.doorToggleSoundDurationMs,
        getDoorSoundVolume: deps.getDoorSoundVolume,
        projectileStepMs: PROJECTILE_STEP_MS,
        physicalProjectileStepMs: PHYSICAL_PROJECTILE_STEP_MS,
    };
}
