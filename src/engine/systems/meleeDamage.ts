import type { EquipmentStatBonuses } from '../../data/equipment';
import type { WeaponAttackOption, WeaponProjectileDescriptor } from '../../data/weaponAttacks';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type { ChampionVitals } from '../runtimeTypes';

type EffectiveStats = {
    strength: number;
    luck: number;
};

type TargetDefense = {
    hitProb?: number;
    armor?: number;
} | undefined;

type RuntimeBonuses = Partial<EquipmentStatBonuses>;

type DetermineMeleeDamageArgs = {
    champion: Champion;
    equip: ChampionEquipment | undefined;
    inventory: FloorItem[];
    currentVitals: ChampionVitals | undefined;
    currentStamina: number | undefined;
    attackOption: WeaponAttackOption | null;
    target: CreatureInstance;
    levelDifficulty: number;
};

type DetermineMeleeDamageDeps = {
    getEffectiveChampionStats: (
        champion: Champion,
        equip: ChampionEquipment,
        currentVitals: ChampionVitals | undefined,
    ) => EffectiveStats;
    getWeaponDescriptor: (item: FloorItem | undefined) => WeaponProjectileDescriptor | null;
    getWeaponName: (item: FloorItem | undefined) => string;
    isLikelyNonMaterial: (target: CreatureInstance) => boolean;
    computeQuickness: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        inventory: FloorItem[],
        currentStamina: number | undefined,
        wounds: ChampionVitals['wounds'] | undefined,
        runtimeBonuses: RuntimeBonuses,
        isPartySleeping: boolean,
    ) => number;
    getRuntimeBonuses: (
        champion: Champion,
        currentVitals: ChampionVitals | undefined,
    ) => RuntimeBonuses;
    randomInt: (maxExclusive: number) => number;
    isCharacterLucky: (luck: number, luckNeeded: number) => boolean;
    originalThrowingDistance: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        currentStamina: number | undefined,
        item: FloorItem,
        descriptor: WeaponProjectileDescriptor | null,
        fighterMastery: number,
        ninjaMastery: number,
        runtimeBonuses: RuntimeBonuses,
    ) => number;
    getFighterMastery: () => number;
    getNinjaMastery: () => number;
    getAttackMastery: (attackOption: WeaponAttackOption | null) => number;
    getTargetDefense: (typeId: number) => TargetDefense;
};

export function determineMeleeDamage(
    args: DetermineMeleeDamageArgs,
    deps: DetermineMeleeDamageDeps,
): number {
    const effective = deps.getEffectiveChampionStats(
        args.champion,
        args.equip ?? {},
        args.currentVitals,
    );
    const descriptor = deps.getWeaponDescriptor(args.equip?.rightHand);
    const attackBaseDamage = args.attackOption?.attack.baseDamage ?? 32;
    const strengthRequired = args.attackOption?.attack.strengthRequired ?? 0;
    const targetDef = deps.getTargetDefense(args.target.typeId);
    const weaponName = deps.getWeaponName(args.equip?.rightHand);
    const nonMaterial = deps.isLikelyNonMaterial(args.target);
    const isDisrupt = args.attackOption?.enumName === 'Disrupt';
    const vorpalOrDisrupt = /vorpal blade/i.test(weaponName) || isDisrupt;

    if (nonMaterial && !vorpalOrDisrupt) {
        return 0;
    }

    const runtimeBonuses = deps.getRuntimeBonuses(args.champion, args.currentVitals);
    const quickness = deps.computeQuickness(
        args.champion,
        args.equip,
        args.inventory,
        args.currentStamina,
        args.currentVitals?.wounds,
        runtimeBonuses,
        false,
    );
    const requiredQuickness = deps.randomInt(32) + (targetDef?.hitProb ?? 40) + args.levelDifficulty - 16;
    const luckyHit = deps.randomInt(4) === 0;
    if (
        quickness <= requiredQuickness &&
        !luckyHit &&
        !deps.isCharacterLucky(effective.luck, 75 - strengthRequired)
    ) {
        return 0;
    }

    const throwingDistance = args.equip?.rightHand
        ? deps.originalThrowingDistance(
            args.champion,
            args.equip,
            args.currentStamina,
            args.equip.rightHand,
            descriptor,
            deps.getFighterMastery(),
            deps.getNinjaMastery(),
            runtimeBonuses,
        )
        : Math.max(0, Math.floor((effective.strength + deps.randomInt(16)) / 2));

    let attackValue = 0;
    if (throwingDistance !== 0) {
        attackValue = throwingDistance + deps.randomInt(Math.floor(throwingDistance / 2) + 1);
        attackValue = Math.floor((attackValue * attackBaseDamage) / 32);

        let defenseValue = deps.randomInt(32) + (targetDef?.armor ?? 20) + args.levelDifficulty;
        if (/diamond edge/i.test(weaponName)) defenseValue -= Math.floor(defenseValue / 4);
        else if (/executioner/i.test(weaponName)) defenseValue -= Math.floor(defenseValue / 8);

        attackValue = attackValue + deps.randomInt(32) - defenseValue;
    }

    if (throwingDistance === 0 || attackValue <= 1) {
        let salvageRoll = deps.randomInt(4);
        if (salvageRoll === 0) return 0;
        attackValue += deps.randomInt(16);
        if (attackValue > 0 || deps.randomInt(2) !== 0) {
            salvageRoll += deps.randomInt(4);
            if (deps.randomInt(4) === 0) {
                salvageRoll += Math.max(0, deps.randomInt(16) + attackValue);
            }
        }
        attackValue = salvageRoll;
    }

    attackValue = Math.floor(attackValue / 2);
    const firstSpread = attackValue > 0 ? deps.randomInt(attackValue) : 0;
    attackValue += deps.randomInt(4) + firstSpread;
    if (attackValue > 0) {
        attackValue += deps.randomInt(attackValue);
    }
    attackValue = Math.floor(attackValue / 4);
    attackValue += deps.randomInt(4) + 1;

    if (/vorpal blade/i.test(weaponName) && !nonMaterial) {
        attackValue = Math.floor(attackValue / 2);
        if (attackValue === 0) return 0;
    }

    const mastery = deps.getAttackMastery(args.attackOption);
    if (deps.randomInt(64) < mastery) {
        attackValue += 10;
    }

    return Math.max(0, attackValue);
}
