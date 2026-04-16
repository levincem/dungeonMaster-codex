import type { EquipmentStatBonuses } from '../../data/equipment';
import type {
    WeaponAttackOption,
    WeaponProjectileDescriptor,
} from '../../data/weaponAttacks';
import type { Champion } from '../../types/champion';
import type { EquipSlotKey } from '../../types/items';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type {
    ChampionCombat,
    ChampionVitals,
    Direction,
    Projectile,
    ProjectileEffect,
} from '../runtimeTypes';
import {
    buildShotAttackProjectile,
    buildThrownAttackProjectile,
} from './attackPhysicalProjectiles';
import {
    buildMissingAmmoAttackPatch,
    buildProjectileAttackSuccessPatch,
} from './attackProjectileState';

type AttackResultMessage = {
    success: boolean;
    message: string;
    ts: number;
};

type ProjectileAttackXpPatch = Partial<{
    championXP: unknown;
    championTemporaryXP: unknown;
    party: unknown;
}>;

type WeaponDescriptor = WeaponProjectileDescriptor | null;

type AmmoMatch = {
    slot: EquipSlotKey;
    item: FloorItem;
} | null;

type PhysicalAttackState = {
    championId: number;
    level: number;
    position: [number, number];
    direction: Direction;
    now: number;
    championCombat: Record<number, ChampionCombat>;
    championVitals: Record<number, ChampionVitals>;
    championEquipment: Record<number, ChampionEquipment>;
    projectiles: Projectile[];
};

type PhysicalAttackDeps = {
    isThrowAttack: (attack: WeaponAttackOption) => boolean;
    isShootAttack: (attack: WeaponAttackOption) => boolean;
    getOriginalWeaponReference: (item: FloorItem | undefined) => WeaponDescriptor;
    getFighterMastery: () => number;
    getNinjaMastery: () => number;
    getRuntimeBonuses: (currentVitals: ChampionVitals | undefined) => Partial<EquipmentStatBonuses>;
    originalThrowingDistance: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        currentStamina: number | undefined,
        item: FloorItem,
        descriptor: WeaponDescriptor,
        fighterMastery: number,
        ninjaMastery: number,
        runtimeBonuses: Partial<EquipmentStatBonuses>,
    ) => number;
    getThrownPotionExplosionEffect: (item: FloorItem) => Exclude<ProjectileEffect, 'physical'> | undefined;
    buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => FloorItem;
    randomInt: (maxExclusive: number) => number;
    findAmmo: (equip: ChampionEquipment, rightHand: FloorItem | null | undefined) => AmmoMatch;
    buildAttackXpPatch: () => ProjectileAttackXpPatch | null;
    buildAttackResultMessage: (message: string, success?: boolean) => AttackResultMessage;
};

export function buildPhysicalProjectileAttackPatch(
    action: WeaponAttackOption,
    state: PhysicalAttackState,
    champion: Champion,
    equip: ChampionEquipment,
    rightHand: FloorItem | null | undefined,
    currentStamina: number | undefined,
    newCombat: ChampionCombat,
    deps: PhysicalAttackDeps,
) {
    if (deps.isThrowAttack(action) && rightHand) {
        const descriptor = deps.getOriginalWeaponReference(rightHand);
        const projectile = buildThrownAttackProjectile(
            {
                champion,
                equip,
                currentStamina,
                item: rightHand,
                descriptor,
                fighterMastery: deps.getFighterMastery(),
                ninjaMastery: deps.getNinjaMastery(),
                runtimeBonuses: deps.getRuntimeBonuses(state.championVitals[state.championId]),
                level: state.level,
                position: state.position,
                direction: state.direction,
                now: state.now,
            },
            {
                originalThrowingDistance: deps.originalThrowingDistance,
                getThrownPotionExplosionEffect: deps.getThrownPotionExplosionEffect,
                buildDroppedItem: deps.buildDroppedItem,
                randomInt: deps.randomInt,
            },
        );
        return buildProjectileAttackSuccessPatch({
            championCombat: state.championCombat,
            championId: state.championId,
            newCombat,
            championVitals: state.championVitals,
            championEquipment: state.championEquipment,
            nextEquip: { ...equip, rightHand: undefined },
            attackXpPatch: deps.buildAttackXpPatch(),
            projectiles: state.projectiles,
            projectile,
            displayName: action.displayName,
            buildAttackResultMessage: deps.buildAttackResultMessage,
        });
    }

    if (!deps.isShootAttack(action)) {
        return null;
    }

    const ammo = deps.findAmmo(equip, rightHand);
    if (!ammo) {
        return buildMissingAmmoAttackPatch(deps.buildAttackResultMessage);
    }

    const projectile = buildShotAttackProjectile(
        {
            launcher: deps.getOriginalWeaponReference(rightHand ?? undefined),
            ammoDescriptor: deps.getOriginalWeaponReference(ammo.item),
            ammoItem: ammo.item,
            mastery: deps.getNinjaMastery(),
            level: state.level,
            position: state.position,
            direction: state.direction,
            now: state.now,
        },
        {
            buildDroppedItem: deps.buildDroppedItem,
        },
    );

    return buildProjectileAttackSuccessPatch({
        championCombat: state.championCombat,
        championId: state.championId,
        newCombat,
        championVitals: state.championVitals,
        championEquipment: state.championEquipment,
        nextEquip: { ...equip, [ammo.slot]: undefined },
        attackXpPatch: deps.buildAttackXpPatch(),
        projectiles: state.projectiles,
        projectile,
        displayName: action.displayName,
        buildAttackResultMessage: deps.buildAttackResultMessage,
    });
}
