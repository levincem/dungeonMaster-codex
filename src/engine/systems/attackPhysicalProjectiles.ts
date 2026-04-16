import type { EquipmentStatBonuses } from '../../data/equipment';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { Direction, Projectile, ProjectileEffect } from '../runtimeTypes';

type ThrowDescriptor = {
    rawClass?: number;
    kineticEnergy?: number;
};

type ShootDescriptor = {
    shootDamage?: number;
    kineticEnergy?: number;
};

type BuildThrownAttackProjectileArgs<TDescriptor> = {
    champion: Champion;
    equip: ChampionEquipment | undefined;
    currentStamina: number | undefined;
    item: FloorItem;
    descriptor: TDescriptor;
    fighterMastery: number;
    ninjaMastery: number;
    runtimeBonuses: Partial<EquipmentStatBonuses>;
    level: number;
    position: [number, number];
    direction: Direction;
    now: number;
};

type BuildThrownAttackProjectileDeps<TDescriptor> = {
    originalThrowingDistance: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        currentStamina: number | undefined,
        item: FloorItem,
        descriptor: TDescriptor,
        fighterMastery: number,
        ninjaMastery: number,
        runtimeBonuses: Partial<EquipmentStatBonuses>,
    ) => number;
    getThrownPotionExplosionEffect: (item: FloorItem) => Exclude<ProjectileEffect, 'physical'> | undefined;
    buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => FloorItem;
    randomInt: (maxExclusive: number) => number;
    buildIdSuffix?: () => string;
};

type BuildShotAttackProjectileArgs = {
    launcher: ShootDescriptor | null;
    ammoDescriptor: ShootDescriptor | null;
    ammoItem: FloorItem;
    mastery: number;
    level: number;
    position: [number, number];
    direction: Direction;
    now: number;
};

type BuildShotAttackProjectileDeps = {
    buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => FloorItem;
    buildIdSuffix?: () => string;
};

function buildProjectileId(prefix: string, now: number, buildIdSuffix?: () => string): string {
    return `${prefix}_${now}_${buildIdSuffix?.() ?? Math.random().toString(36).slice(2)}`;
}

export function buildThrownAttackProjectile<TDescriptor extends ThrowDescriptor | null>(
    {
        champion,
        equip,
        currentStamina,
        item,
        descriptor,
        fighterMastery,
        ninjaMastery,
        runtimeBonuses,
        level,
        position,
        direction,
        now,
    }: BuildThrownAttackProjectileArgs<TDescriptor>,
    deps: BuildThrownAttackProjectileDeps<TDescriptor>,
): Projectile {
    const throwRange = deps.originalThrowingDistance(
        champion,
        equip,
        currentStamina,
        item,
        descriptor,
        fighterMastery,
        ninjaMastery,
        runtimeBonuses,
    );
    const launchBonus = descriptor && (descriptor.rawClass ?? Number.MAX_SAFE_INTEGER) <= 12
        ? (descriptor.kineticEnergy ?? 1)
        : 1;
    const rawRange = throwRange + launchBonus;
    const finalRange = rawRange + deps.randomInt(16) + Math.floor(rawRange / 2) + ninjaMastery;
    const rawDamage = Math.max(40, Math.min(200, 8 * ninjaMastery + deps.randomInt(32)));
    const decay = Math.max(5, 11 - ninjaMastery);
    const explosionOnImpact = deps.getThrownPotionExplosionEffect(item);
    const explosionAttack = explosionOnImpact ? Math.max(1, item.potionPower ?? 40) : undefined;
    const [y, x] = position;

    return {
        id: buildProjectileId('throw', now, deps.buildIdSuffix),
        level,
        x,
        y,
        direction,
        effect: 'physical',
        damage: [rawDamage, rawDamage],
        nextMoveAt: now,
        remainingRange: Math.max(1, finalRange),
        remainingAttack: rawDamage,
        stepDecay: decay,
        physicalItem: deps.buildDroppedItem(item, level, x, y),
        explosionOnImpact,
        explosionAttack,
    };
}

export function buildShotAttackProjectile(
    {
        launcher,
        ammoDescriptor,
        ammoItem,
        mastery,
        level,
        position,
        direction,
        now,
    }: BuildShotAttackProjectileArgs,
    deps: BuildShotAttackProjectileDeps,
): Projectile {
    const maxDamage = Math.max(6, 2 * ((launcher?.shootDamage ?? 4) + mastery));
    const minDamage = Math.max(2, Math.floor(maxDamage * 0.55));
    const range = Math.max(1, (launcher?.kineticEnergy ?? 1) + (ammoDescriptor?.kineticEnergy ?? 1));
    const decay = Math.max(1, maxDamage & 0x0f);
    const [y, x] = position;

    return {
        id: buildProjectileId('shoot', now, deps.buildIdSuffix),
        level,
        x,
        y,
        direction,
        effect: 'physical',
        damage: [minDamage, maxDamage],
        nextMoveAt: now,
        remainingRange: range,
        remainingAttack: maxDamage,
        stepDecay: decay,
        physicalItem: deps.buildDroppedItem(ammoItem, level, x, y),
    };
}
