import type { CreatureDef, OriginalAttackType } from '../../data/creatures';
import type { ChampionWoundSlot, EquipmentStatBonuses } from '../../data/equipment';
import type { ChampionTemporaryXP, ChampionXP } from '../../data/skillProgression';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ActivePotionBoost, ChampionVitals, MonsterAttackDebugEntry } from '../runtimeTypes';
import { applyOriginalLuckCheck } from './originalLuck';
import type { IncomingAttackDebug } from './incomingAttackState';

export type MonsterDamageClass = 'physical' | 'fire' | 'magic' | 'mental';
export type ArmorCoverageZone = 'head' | 'torso' | 'legs' | 'feet' | 'hands';

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

type RuntimeBonuses = Partial<EquipmentStatBonuses>;

type EffectiveStats = {
    luck: number;
    stamina: number;
    vitality: number;
};

type ResolveMonsterAttackAgainstChampionArgs = {
    targetChampion: Champion;
    targetVitals: ChampionVitals;
    targetEquipment: ChampionEquipment | undefined;
    targetInventory: FloorItem[];
    targetChampionXP?: ChampionXP;
    targetChampionTemporaryXP?: ChampionTemporaryXP;
    activePotionBoosts: ActivePotionBoost[];
    attackerDef: CreatureDef;
    attackMode: 'melee' | 'ranged';
    levelDifficulty: number;
    nowMs: number;
    partySleeping?: boolean;
};

type ResolveMonsterAttackAgainstChampionDeps = {
    randomInt: (maxExclusive: number) => number;
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
        vitals: ChampionVitals | undefined,
        activePotionBoosts: ActivePotionBoost[],
        now: number,
    ) => RuntimeBonuses;
    getEffectiveChampionStats: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals?: ChampionVitals,
        now?: number,
    ) => EffectiveStats;
    chooseChampionWoundSlots: (
        hitZones: readonly ArmorCoverageZone[] | undefined,
    ) => ChampionWoundSlot[];
    resolveIncomingAttack: (
        champion: Champion,
        currentVitals: ChampionVitals,
        rawAttack: number,
        attackType: OriginalAttackType,
        allowedSlots: readonly ChampionWoundSlot[],
        nowMs: number,
    ) => { damage: number; nextVitals: ChampionVitals; debug?: IncomingAttackDebug };
    clampVital: (value: number, max: number) => number;
    adjustByAttribute: (value: number, currentAttribute: number) => number;
    applyPoison: (vitals: ChampionVitals, poisonStrength: number) => ChampionVitals;
    getParryMastery: (
        champion: Champion,
        championXP: ChampionXP | undefined,
        championTemporaryXP: ChampionTemporaryXP | undefined,
        equipment: ChampionEquipment | undefined,
    ) => number;
};

export type MonsterAttackResolution = {
    damage: number;
    hitZones?: readonly ArmorCoverageZone[];
    damageClass: MonsterDamageClass;
    nextVitals: ChampionVitals;
    debug?: MonsterAttackDebugEntry;
};

function getMonsterBaseDamageClass(originalAttackType: OriginalAttackType): MonsterDamageClass {
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

function resolveMonsterAttackType(
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

function chooseMonsterHitZones(
    damageClass: MonsterDamageClass,
    attackType: OriginalAttackType | undefined,
    randomInt: (maxExclusive: number) => number,
): readonly ArmorCoverageZone[] | undefined {
    if (damageClass === 'magic' || damageClass === 'mental') return undefined;
    if (attackType === 'Unconditional') return undefined;
    return MONSTER_HIT_ZONE_PATTERNS[randomInt(MONSTER_HIT_ZONE_PATTERNS.length)] ?? ['torso'];
}

export function resolveMonsterAttackAgainstChampion(
    args: ResolveMonsterAttackAgainstChampionArgs,
    deps: ResolveMonsterAttackAgainstChampionDeps,
): MonsterAttackResolution {
    const runtimeBonuses = deps.getRuntimeBonuses(
        args.targetChampion,
        args.targetVitals,
        args.activePotionBoosts,
        args.nowMs,
    );
    const resolvedAttackType = resolveMonsterAttackType(args.attackerDef, args.attackMode);
    const damageClass = getMonsterBaseDamageClass(resolvedAttackType);
    const hitZones = chooseMonsterHitZones(damageClass, resolvedAttackType, deps.randomInt);
    const quickness = deps.computeQuickness(
        args.targetChampion,
        args.targetEquipment,
        args.targetInventory,
        args.targetVitals.stamina,
        args.targetVitals.wounds,
        runtimeBonuses,
        args.partySleeping ?? false,
    );
    const requiredQuickness = deps.randomInt(32) + args.attackerDef.hitProb + args.levelDifficulty - 16;
    const parryMastery = deps.getParryMastery(
        args.targetChampion,
        args.targetChampionXP,
        args.targetChampionTemporaryXP,
        args.targetEquipment,
    );

    const buildDebugEntry = (
        rolledAttack: number,
        damage: number,
        nextVitals: ChampionVitals,
        incomingDebug?: IncomingAttackDebug,
    ): MonsterAttackDebugEntry => ({
        attackerName: args.attackerDef.name,
        targetName: args.targetChampion.name,
        attackMode: args.attackMode,
        attackType: resolvedAttackType,
        quickness,
        requiredQuickness,
        parryMastery,
        rolledAttack,
        finalDamage: damage,
        hpBefore: args.targetVitals.hp,
        hpAfter: nextVitals.hp,
        hitZones: hitZones ? [...hitZones] : undefined,
        woundSlots: incomingDebug?.allowedSlots ? [...incomingDebug.allowedSlots] : undefined,
        defenseApplied: incomingDebug?.defenseApplied,
        activeShieldDefense: incomingDebug?.activeShieldDefense,
        postMitigationAttack: incomingDebug?.postMitigationAttack,
        defenseSlotBreakdown: incomingDebug?.defenseSlotBreakdown?.map((entry) => ({
            slot: entry.slot,
            vitalityRoll: entry.vitalityRoll,
            defenseModifier: entry.defenseModifier,
            slotArmor: entry.slotArmor,
            slotItemName: entry.slotItemName,
            shieldContribution: entry.shieldContribution,
            shieldDetails: entry.shieldDetails ? [...entry.shieldDetails] : undefined,
            woundPenalty: entry.woundPenalty,
            finalDefense: entry.finalDefense,
        })),
        ts: args.nowMs,
    });

    if (quickness >= requiredQuickness && deps.randomInt(4) !== 0) {
        return {
            damage: 0,
            hitZones,
            damageClass,
            nextVitals: args.targetVitals,
            debug: buildDebugEntry(0, 0, args.targetVitals),
        };
    }

    const luckCheck = applyOriginalLuckCheck(args.targetChampion, args.targetVitals, 60, deps.randomInt);
    if (luckCheck.success) {
        return {
            damage: 0,
            hitZones,
            damageClass,
            nextVitals: luckCheck.nextVitals,
            debug: buildDebugEntry(0, 0, luckCheck.nextVitals),
        };
    }

    let attackValue =
        args.levelDifficulty
        + deps.randomInt(16)
        + args.attackerDef.rawAttack
        - (2 * parryMastery);

    if (attackValue <= 1) {
        if (deps.randomInt(2) !== 0) {
            return {
                damage: 0,
                hitZones,
                damageClass,
                nextVitals: luckCheck.nextVitals,
                debug: buildDebugEntry(0, 0, luckCheck.nextVitals),
            };
        }
        attackValue = deps.randomInt(4) + 2;
    }

    attackValue = Math.floor(attackValue / 2);
    attackValue += deps.randomInt(Math.max(1, attackValue)) + deps.randomInt(4);
    attackValue += deps.randomInt(Math.max(1, attackValue));
    attackValue = Math.floor(attackValue / 4);
    attackValue += deps.randomInt(4) + 1;

    if (deps.randomInt(2) !== 0) {
        attackValue -= deps.randomInt(Math.floor(attackValue / 2) + 1) - 1;
    }

    const allowedSlots = deps.chooseChampionWoundSlots(hitZones);
    const resolved = deps.resolveIncomingAttack(
        args.targetChampion,
        luckCheck.nextVitals,
        Math.max(0, attackValue),
        resolvedAttackType,
        allowedSlots,
        args.nowMs,
    );

    if (resolved.damage <= 0) {
        return {
            damage: 0,
            hitZones,
            damageClass,
            nextVitals: resolved.nextVitals,
            debug: buildDebugEntry(Math.max(0, attackValue), 0, resolved.nextVitals, resolved.debug),
        };
    }

    let nextVitals = resolved.nextVitals;

    if (args.attackerDef.attackTypes.includes('StaminaDrain')) {
        const staminaDamage = Math.max(1, Math.floor(resolved.damage / 2) + deps.randomInt(4));
        const nextEffective = deps.getEffectiveChampionStats(
            args.targetChampion,
            args.targetEquipment,
            args.activePotionBoosts,
            nextVitals,
            args.nowMs,
        );
        nextVitals = {
            ...nextVitals,
            stamina: deps.clampVital(nextVitals.stamina - staminaDamage, nextEffective.stamina),
        };
    }

    if (nextVitals.hp > 0 && args.attackerDef.poisonAttack > 0 && deps.randomInt(2) !== 0) {
        const nextEffective = deps.getEffectiveChampionStats(
            args.targetChampion,
            args.targetEquipment,
            args.activePotionBoosts,
            nextVitals,
            args.nowMs,
        );
        const poisonStrength = deps.adjustByAttribute(args.attackerDef.poisonAttack, nextEffective.vitality);
        nextVitals = deps.applyPoison(nextVitals, poisonStrength);
    }

    return {
        damage: resolved.damage,
        hitZones,
        damageClass,
        nextVitals,
        debug: buildDebugEntry(Math.max(0, attackValue), resolved.damage, nextVitals, resolved.debug),
    };
}
