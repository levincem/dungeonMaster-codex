import type { CreatureDef } from '../../data/creatures';
import {
    mapOriginalSkillNumberToSkillKey,
    type ChampionTemporaryXP,
    type ChampionXP,
    type SkillKey,
} from '../../data/skillProgression';
import { WEAPON_TYPES } from '../../data/items';
import { getEffectiveChampionStatsWithBonuses, getPreferredCombatItem, type EquipmentStatBonuses } from '../../data/equipment';
import {
    getOriginalWeaponReference,
    type WeaponProjectileDescriptor,
} from '../../data/weaponAttacks';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem, GameTile } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type { WeaponAttackOption } from '../../data/weaponAttacks';
import type {
    ActiveFluxcage,
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    Projectile,
    SpellLight,
    SpellVisualEvent,
} from '../runtimeTypes';
import { ORIGINAL_TIMER_TICK_MS, quantizeMsToOriginalTimerTicks } from '../time';
import { runAttackFrontRuntime } from './attackFrontRuntime';
import { buildAttackMeleeStatePatch as buildAttackMeleeStatePatchSystem } from './attackMeleeState';
import { buildPhysicalProjectileAttackPatch } from './attackPhysicalState';
import { buildMeleeAttackResolutionPatch } from './meleeAttackResolution';
import { determineMeleeDamage } from './meleeDamage';
import { getOriginalThrownObjectExperience } from './originalThrownObjectExperience';
import { tryBreakFrontDoor as tryBreakFrontDoorSystem } from './frontDoorBreak';
import { buildSupportedUtilityAttackPatch } from './utilityAttackOrchestration';
import type { FearUtilityActionResult } from './fearUtilityActions';
import type { UtilityControlUpdate } from './utilityAttackControlState';

type StoreAttackFrontRuntimeState = {
    championCombat: Record<number, ChampionCombat>;
    party: Champion[];
    championEquipment: Record<number, ChampionEquipment>;
    activePotionBoosts: ActivePotionBoost[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    projectiles: Projectile[];
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    creatures: CreatureInstance[];
    openDoors: Set<string>;
    openPits?: Set<string>;
    openWalls?: Set<string>;
    activeFluxcages?: ActiveFluxcage[];
    brokenDoors: Set<string>;
    floorItems: FloorItem[];
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    elapsedGameTimeTicks: number;
    lastCreatureAttackGameTick: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    freezeLifeRemainingTicks: number;
    seeThroughWallsUntil: number;
    spellLights: SpellLight[];
    activeShields: PartyShield[];
};

type AttackResultMessage = {
    success: boolean;
    message: string;
    ts: number;
};

type AttackXpPatch = {
    championVitals?: Record<number, ChampionVitals>;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    party?: Champion[];
};

type AttackOptionRuntimeDeps = {
    getWeaponAttackOptions: (item: FloorItem | null | undefined) => WeaponAttackOption[];
    getRequiredAmmoRawClass: (item: FloorItem | undefined) => number | null;
    getAttackCooldownSeconds: (option: WeaponAttackOption | null) => number;
    isAttackOptionUsableAtMastery: (option: WeaponAttackOption, masteryLevel: number) => boolean;
    getAttackUnusableReason: (option: WeaponAttackOption, masteryLevel: number) => string | null;
    isPhysicalAttack: (option: WeaponAttackOption | null) => boolean;
    isShootAttack: (option: WeaponAttackOption | null) => boolean;
    isThrowAttack: (option: WeaponAttackOption | null) => boolean;
};

type ChampionAttackRuntimeDeps<TState extends StoreAttackFrontRuntimeState> = {
    getChampionMasteryLevel: (state: TState, championId: number, champion: Champion, skill: SkillKey) => number;
    findCompatibleAmmo: (
        equip: ChampionEquipment | undefined,
        requiredRawClass: number | null,
    ) => { slot: EquipSlotKey; item: FloorItem } | null;
    getRightHandStats: (
        equip: ChampionEquipment | undefined,
    ) => { name: string; dmgMin: number; dmgMax: number; cooldownSec: number; skill: SkillKey };
    createChampionCombatState: (cooldownSec: number, defenseModifier?: number) => ChampionCombat;
    applyChampionAttackVitals: (
        champion: Champion,
        equip: ChampionEquipment,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals: ChampionVitals | undefined,
        selectedAttack: WeaponAttackOption | null,
    ) => { nextVitals: ChampionVitals } | null;
    getActionCharges: (item: FloorItem | undefined) => number | null;
    updateEquippedItemCharges: (
        equip: ChampionEquipment,
        slot: 'rightHand' | 'leftHand',
        remainingCharges: number | null,
    ) => ChampionEquipment;
    buildAttackResultMessage: (message: string, success?: boolean) => AttackResultMessage;
    originalThrowingDistance: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        currentStamina: number | undefined,
        item: FloorItem,
        descriptor: WeaponProjectileDescriptor | null,
        fighterMastery: number,
        ninjaMastery: number,
        runtimeBonuses?: Partial<EquipmentStatBonuses>,
    ) => number;
    getThrownPotionExplosionEffect: (item: FloorItem) => Exclude<import('../runtimeTypes').ProjectileEffect, 'physical'> | undefined;
    buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => FloorItem;
    getWeaponName: (item: FloorItem | undefined) => string;
    buildChampionSkillExperiencePatch: (
        state: TState,
        championId: number,
        skill: SkillKey,
        amount: number,
    ) => AttackXpPatch | null;
    getChampionRuntimeBonuses: (
        champion: Champion,
        currentVitals: ChampionVitals | undefined,
        activePotionBoosts: ActivePotionBoost[],
    ) => EquipmentStatBonuses;
};

type UtilityAttackRuntimeDeps<TState extends StoreAttackFrontRuntimeState> = {
    resolveAttackFrontContext: (
        level: number,
        position: [number, number],
        direction: TState['direction'],
        creatures: CreatureInstance[],
        party: Champion[],
        championId: number,
    ) => { target: CreatureInstance | null };
    resolveClimbDown: (
        climbDownState: TState,
        basePatch: Partial<TState>,
    ) => { patch?: Partial<TState>; errorMessage?: string };
    applyControlUpdate: (update: UtilityControlUpdate) => void;
    applyFearResult: (fearResult: FearUtilityActionResult) => void;
    clearCreatureControlStatuses: () => void;
    clearTargetFluxcageStatus: (creatureId: string) => void;
    getEndgameMessagesForMap: (level: number) => string[];
    buildFluxcageCastEvents: (level: number, x: number, y: number) => SpellVisualEvent[];
    buildFuseIgnitionEvents: (level: number, x: number, y: number) => SpellVisualEvent[];
};

type CreatureCombatRuntimeDeps<TState extends StoreAttackFrontRuntimeState> = {
    dropCreatureCarriedItems: (creatures: CreatureInstance[], floorItems: FloorItem[], deadId: string) => {
        creatures: CreatureInstance[];
        floorItems: FloorItem[];
    };
    normalizeCreatureCellsOnTile: (
        creatures: CreatureInstance[],
        level: number,
        x: number,
        y: number,
    ) => CreatureInstance[];
    buildCreatureDamageEvent: (level: number, x: number, y: number, amount: number, creatureId?: string) => DamageEvent;
    buildDeathDustEvent: (level: number, x: number, y: number) => SpellVisualEvent;
    getFluxcageExpiresAt: (creatureId: string) => number;
    getTargetTimers: (creatureId: string) => { mt: number; at: number } | undefined;
    getMapDifficulty: (level: number) => number;
    getMapTile: (level: number, x: number, y: number) => GameTile | undefined;
    canCreatureShareTile: (
        mover: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ) => boolean;
    getFrontPosition: (position: [number, number], direction: TState['direction']) => { x: number; y: number };
    getEffectiveChampionStatsRuntime: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals?: ChampionVitals,
        now?: number,
    ) => ReturnType<typeof getEffectiveChampionStatsWithBonuses>;
    randomInt: (maxExclusive: number) => number;
    isCharacterLuckyOriginal: (luck: number, luckNeeded: number) => boolean;
    computeOriginalQuicknessRuntime: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        inventory: FloorItem[] | undefined,
        currentStamina: number | undefined,
        wounds: ChampionVitals['wounds'] | undefined,
        runtimeBonuses: Partial<EquipmentStatBonuses> | undefined,
        isPartySleeping: boolean,
    ) => number;
    isLikelyNonMaterial: (target: CreatureInstance) => boolean;
    getCreatureDef: (typeId: number) => CreatureDef | undefined;
    onPartyAttack: () => void;
};

type StoreAttackFrontRuntimeDeps<TState extends StoreAttackFrontRuntimeState> =
    AttackOptionRuntimeDeps
    & ChampionAttackRuntimeDeps<TState>
    & UtilityAttackRuntimeDeps<TState>
    & CreatureCombatRuntimeDeps<TState>;

export function buildStoreAttackFrontRuntimePatch<TState extends StoreAttackFrontRuntimeState>(
    state: TState,
    championId: number,
    attackType: number | undefined,
    deps: StoreAttackFrontRuntimeDeps<TState>,
): Partial<TState> | null {
    const getChampionMasteryLevel = (
        targetChampionId: number,
        champion: Champion,
        skill: SkillKey,
    ) => deps.getChampionMasteryLevel(state, targetChampionId, champion, skill);

    const buildChampionSkillExperiencePatch = (
        targetChampionId: number,
        skill: SkillKey,
        amount: number,
    ) => deps.buildChampionSkillExperiencePatch(state, targetChampionId, skill, amount);

    return runAttackFrontRuntime(
        state,
        championId,
        attackType,
        {
            getWeaponAttackOptions: deps.getWeaponAttackOptions,
            getRequiredAmmoRawClass: deps.getRequiredAmmoRawClass,
            getAttackCooldownSeconds: deps.getAttackCooldownSeconds,
            isAttackOptionUsableAtMastery: deps.isAttackOptionUsableAtMastery,
            getAttackUnusableReason: deps.getAttackUnusableReason,
            isPhysicalAttack: deps.isPhysicalAttack,
            isShootAttack: deps.isShootAttack,
            isThrowAttack: deps.isThrowAttack,
            getChampionMasteryLevel,
            findCompatibleAmmo: deps.findCompatibleAmmo,
            getRightHandStats: deps.getRightHandStats,
            createChampionCombatState: deps.createChampionCombatState,
            applyChampionAttackVitals: deps.applyChampionAttackVitals,
            getActionCharges: deps.getActionCharges,
            updateEquippedItemCharges: deps.updateEquippedItemCharges,
            buildAttackResultMessage: deps.buildAttackResultMessage,
            buildPhysicalProjectileAttackPatch: ({
                selectedAttack,
                state: attackState,
                championId: targetChampionId,
                champion,
                equip,
                attackItem,
                attackItemSlot,
                currentStamina,
                newCombat,
                selectedSkill,
                championVitals,
            }) => buildPhysicalProjectileAttackPatch(
                selectedAttack,
                {
                    championId: targetChampionId,
                    level: attackState.level,
                    position: attackState.position,
                    direction: attackState.direction,
                    now: Date.now(),
                    championCombat: attackState.championCombat,
                    championVitals,
                    championEquipment: attackState.championEquipment,
                    projectiles: attackState.projectiles,
                },
                champion,
                equip,
                attackItem,
                attackItemSlot,
                currentStamina,
                newCombat,
                {
                    isThrowAttack: deps.isThrowAttack,
                    isShootAttack: deps.isShootAttack,
                    getOriginalWeaponReference,
                    getFighterMastery: () => getChampionMasteryLevel(targetChampionId, champion, 'fighter'),
                    getNinjaMastery: () => getChampionMasteryLevel(targetChampionId, champion, 'ninja'),
                    getRuntimeBonuses: (currentVitals) => deps.getChampionRuntimeBonuses(
                        champion,
                        currentVitals ?? attackState.championVitals[targetChampionId],
                        attackState.activePotionBoosts,
                    ),
                    originalThrowingDistance: deps.originalThrowingDistance,
                    getThrownPotionExplosionEffect: deps.getThrownPotionExplosionEffect,
                    buildDroppedItem: deps.buildDroppedItem,
                    randomInt: deps.randomInt,
                    findAmmo: (currentEquip, currentRightHand) => deps.findCompatibleAmmo(
                        currentEquip,
                        deps.getRequiredAmmoRawClass(currentRightHand ?? undefined),
                    ),
                    buildAttackXpPatch: (amount) => buildChampionSkillExperiencePatch(
                        targetChampionId,
                        selectedSkill,
                        amount,
                    ),
                    buildAttackResultMessage: deps.buildAttackResultMessage,
                    getOriginalThrownObjectExperience,
                },
            ),
            buildSupportedUtilityAttackPatch: ({
                selectedAttack,
                state: attackState,
                championId: targetChampionId,
                champion,
                championVitals,
                equip,
                chargedEquip,
                newCombat,
                selectedSkill,
                rightHand,
            }) => {
                const now = Date.now();
                const utilityXP = selectedAttack.attack.experienceForAttacking;
                const base = {
                    championCombat: { ...attackState.championCombat, [targetChampionId]: newCombat },
                    championVitals,
                    ...(chargedEquip !== equip
                        ? { championEquipment: { ...attackState.championEquipment, [targetChampionId]: chargedEquip } }
                        : {}),
                    lastCastResult: deps.buildAttackResultMessage(selectedAttack.displayName, true),
                } as unknown as Partial<TState>;
                const handled = buildSupportedUtilityAttackPatch(
                    selectedAttack,
                    {
                        now,
                        level: attackState.level,
                        position: attackState.position,
                        direction: attackState.direction,
                        creatures: attackState.creatures,
                        party: attackState.party,
                        championVitals,
                        championId: targetChampionId,
                        championHealth: champion.health,
                        freezeLifeRemainingTicks: attackState.freezeLifeRemainingTicks,
                        seeThroughWallsUntil: attackState.seeThroughWallsUntil,
                        spellLights: attackState.spellLights,
                        activeShields: attackState.activeShields,
                        activeFluxcages: attackState.activeFluxcages,
                        projectiles: attackState.projectiles,
                        openDoors: attackState.openDoors,
                        openPits: attackState.openPits ?? new Set<string>(),
                        openWalls: attackState.openWalls ?? new Set<string>(),
                        rightHandTypeId: rightHand?.typeId,
                        rightHand,
                        rightHandWeaponName: rightHand ? deps.getWeaponName(rightHand) : '',
                        floorItems: attackState.floorItems,
                        damageEvents: attackState.damageEvents,
                        spellVisualEvents: attackState.spellVisualEvents,
                    },
                    base,
                    {
                        randomInt: deps.randomInt,
                        quantizeDurationMs: quantizeMsToOriginalTimerTicks,
                        buildAttackResultMessage: deps.buildAttackResultMessage,
                        getCreatureDef: deps.getCreatureDef,
                        getMapTile: deps.getMapTile,
                        buildFluxcageCastEvents: deps.buildFluxcageCastEvents,
                        canCreatureShareTile: deps.canCreatureShareTile,
                        timerTickMs: ORIGINAL_TIMER_TICK_MS,
                        getFluxcageExpiresAt: deps.getFluxcageExpiresAt,
                        getTargetTimers: deps.getTargetTimers,
                        resolveClimbDown: deps.resolveClimbDown,
                        climbDownState: state,
                        applyControlUpdate: deps.applyControlUpdate,
                        applyFearResult: deps.applyFearResult,
                        clearCreatureControlStatuses: deps.clearCreatureControlStatuses,
                        clearTargetFluxcageStatus: deps.clearTargetFluxcageStatus,
                        getEndgameMessagesForMap: deps.getEndgameMessagesForMap,
                        buildFuseIgnitionEvents: deps.buildFuseIgnitionEvents,
                        dropCreatureCarriedItems: deps.dropCreatureCarriedItems,
                        normalizeCreatureCellsOnTile: deps.normalizeCreatureCellsOnTile,
                        buildCreatureDamageEvent: deps.buildCreatureDamageEvent,
                        buildDeathDustEvent: deps.buildDeathDustEvent,
                    },
                );
                if (!handled.patch) return null;

                let xpState = {
                    ...attackState,
                    championVitals,
                } as TState;
                let combinedXpPatch:
                    | {
                        championVitals?: Record<number, ChampionVitals>;
                        championXP: Record<number, ChampionXP>;
                        championTemporaryXP: Record<number, ChampionTemporaryXP>;
                        party?: Champion[];
                    }
                    | null = null;

                const applySequentialXpPatch = (skill: SkillKey, amount: number) => {
                    if (amount <= 0) return;
                    const xpPatch = deps.buildChampionSkillExperiencePatch(
                        xpState,
                        targetChampionId,
                        skill,
                        amount,
                    );
                    if (!xpPatch) return;

                    xpState = {
                        ...xpState,
                        championXP: xpPatch.championXP,
                        championTemporaryXP: xpPatch.championTemporaryXP,
                        championVitals: xpPatch.championVitals ?? xpState.championVitals,
                        party: xpPatch.party ?? xpState.party,
                    } as TState;

                    combinedXpPatch = {
                        championXP: xpState.championXP,
                        championTemporaryXP: xpState.championTemporaryXP,
                        ...(xpPatch.championVitals ? { championVitals: xpState.championVitals } : {}),
                        ...(xpPatch.party ? { party: xpState.party } : {}),
                    };
                };

                applySequentialXpPatch(selectedSkill, utilityXP);

                if (handled.influenceExperience) {
                    const specialInfluenceAmount =
                        handled.influenceExperience.fullAwards * handled.influenceExperience.fullAmount
                        + handled.influenceExperience.halfAwards * handled.influenceExperience.halfAmount;
                    applySequentialXpPatch('influence', specialInfluenceAmount);
                }

                return {
                    ...handled.patch,
                    ...(combinedXpPatch ?? {}),
                };
            },
            resolveCombatItem: (equip) => getPreferredCombatItem(equip, {
                getWeaponAttackOptions: deps.getWeaponAttackOptions,
                isThrowAttack: deps.isThrowAttack,
            }),
            resolveAttackFrontContext: deps.resolveAttackFrontContext,
            buildAttackMeleeStatePatch: ({
                state: attackState,
                championId: targetChampionId,
                champion,
                equip,
                championVitals,
                selectedAttack,
                target,
                newCombat,
                fallbackSkill,
            }) => buildAttackMeleeStatePatchSystem(
                {
                    championId: targetChampionId,
                    championCombat: attackState.championCombat,
                    championVitals,
                    level: attackState.level,
                    position: attackState.position,
                    direction: attackState.direction,
                    openDoors: attackState.openDoors,
                    brokenDoors: attackState.brokenDoors,
                    creatures: attackState.creatures,
                    floorItems: attackState.floorItems,
                    party: attackState.party,
                    championXP: attackState.championXP,
                    championTemporaryXP: attackState.championTemporaryXP,
                    elapsedGameTimeTicks: attackState.elapsedGameTimeTicks,
                    lastCreatureAttackGameTick: attackState.lastCreatureAttackGameTick,
                    damageEvents: attackState.damageEvents,
                    spellVisualEvents: attackState.spellVisualEvents,
                },
                champion,
                equip,
                attackState.activePotionBoosts,
                selectedAttack,
                target,
                newCombat,
                fallbackSkill,
                {
                    tryBreakFrontDoor: (breakState, currentChampion, currentEquip, activePotionBoosts, attackOption) =>
                        tryBreakFrontDoorSystem(
                            breakState,
                            currentChampion,
                            currentEquip,
                            activePotionBoosts,
                            attackOption,
                            {
                                getFrontPosition: deps.getFrontPosition,
                                getTile: deps.getMapTile,
                                getEffectiveChampionStatsRuntime: deps.getEffectiveChampionStatsRuntime,
                                getWeaponMaxDamage: (equipment) => equipment?.rightHand?.category === 'Weapon'
                                    ? (WEAPON_TYPES[equipment.rightHand.typeId]?.damage[1] ?? 0)
                                    : 0,
                                randomInt: deps.randomInt,
                                buildAttackResultMessage: deps.buildAttackResultMessage,
                            },
                        ),
                    determineMeleeDamage: (currentTarget) => determineMeleeDamage(
                        {
                            champion,
                            equip,
                            inventory: attackState.championInventories[targetChampionId] ?? [],
                            currentVitals: attackState.championVitals[targetChampionId],
                            currentStamina: championVitals[targetChampionId]?.stamina,
                            attackOption: selectedAttack,
                            target: currentTarget,
                            levelDifficulty: deps.getMapDifficulty(attackState.level),
                        },
                        {
                            getEffectiveChampionStats: (currentChampion, currentEquip, currentVitals) =>
                                deps.getEffectiveChampionStatsRuntime(
                                    currentChampion,
                                    currentEquip,
                                    attackState.activePotionBoosts,
                                    currentVitals,
                                ),
                            getWeaponDescriptor: getOriginalWeaponReference,
                            getWeaponName: deps.getWeaponName,
                            isLikelyNonMaterial: deps.isLikelyNonMaterial,
                            computeQuickness: deps.computeOriginalQuicknessRuntime,
                            getRuntimeBonuses: (currentChampion, currentVitals) => deps.getChampionRuntimeBonuses(
                                currentChampion,
                                currentVitals,
                                attackState.activePotionBoosts,
                            ),
                            randomInt: deps.randomInt,
                            isCharacterLucky: deps.isCharacterLuckyOriginal,
                            originalThrowingDistance: deps.originalThrowingDistance,
                            getFighterMastery: () => getChampionMasteryLevel(targetChampionId, champion, 'fighter'),
                            getNinjaMastery: () => getChampionMasteryLevel(targetChampionId, champion, 'ninja'),
                            getAttackMastery: (attackOption) => getChampionMasteryLevel(
                                targetChampionId,
                                champion,
                                attackOption ? mapOriginalSkillNumberToSkillKey(attackOption.attack.skillNumber) : 'fighter',
                            ),
                            getTargetDefense: deps.getCreatureDef,
                        },
                    ),
                    getAttackSkill: (attackOption, currentFallbackSkill) => attackOption
                        ? mapOriginalSkillNumberToSkillKey(attackOption.attack.skillNumber)
                        : currentFallbackSkill,
                    applyMeleeActionOutcomeVitals: (currentChampionVitals, currentChampionId, hit) => {
                        const currentVitals = currentChampionVitals[currentChampionId];
                        if (!currentVitals) return currentChampionVitals;

                        const effective = deps.getEffectiveChampionStatsRuntime(
                            champion,
                            equip,
                            attackState.activePotionBoosts,
                            currentVitals,
                        );
                        const staminaCost = hit
                            ? deps.randomInt(4) + 4
                            : deps.randomInt(2) + 2;
                        const nextVitals = {
                            ...currentVitals,
                            stamina: Math.max(
                                0,
                                Math.min(effective.stamina, currentVitals.stamina - staminaCost),
                            ),
                        };
                        return {
                            ...currentChampionVitals,
                            [currentChampionId]: nextVitals,
                        };
                    },
                    buildMeleeActionExperiencePatch: (currentState, currentChampionId, skill, amount) =>
                        deps.buildChampionSkillExperiencePatch(
                            currentState as TState,
                            currentChampionId,
                            skill,
                            amount,
                        ),
                    buildMeleeAttackResolution: (resolutionState, attackSkill, currentTarget, totalDmg) =>
                        buildMeleeAttackResolutionPatch(
                            resolutionState,
                            targetChampionId,
                            currentTarget,
                            totalDmg,
                            attackSkill,
                            newCombat,
                            {
                                applyChampionSkillExperience: (currentState, currentChampionId, skill, amount) =>
                                    deps.buildChampionSkillExperiencePatch(
                                        currentState as TState,
                                        currentChampionId,
                                        skill,
                                        amount,
                                    ),
                                dropCreatureCarriedItems: deps.dropCreatureCarriedItems,
                                normalizeCreatureCellsOnTile: deps.normalizeCreatureCellsOnTile,
                                buildCreatureDamageEvent: deps.buildCreatureDamageEvent,
                                buildDeathDustEvent: deps.buildDeathDustEvent,
                            },
                        ),
                },
            ),
            onPartyAttack: deps.onPartyAttack,
        },
    ) as Partial<TState> | null;
}
