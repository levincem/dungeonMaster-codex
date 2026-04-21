import { findSpell, type SpellDef } from '../../data/runes';
import { rollOriginalSpellProjectileImpact } from '../../data/spellRuntime';
import { resolveItemName } from '../../data/items';
import type { SkillKey } from '../../data/skillProgression';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
} from '../runtimeTypes';
import { GRID_SIZE } from '../constants';
import { PROJECTILE_STEP_MS, DAMAGE_EVENT_LIFETIME_MS, FOOTPRINT_LIFETIME_MS } from '../time';
import { buildCastSpellCommandRuntimeResult } from './castSpellCommandRuntime';
import { prepareSpellCast } from './spellCastPreparation';
import { buildHandledNonProjectileSpellPatch } from './spellNonProjectileEffects';
import { buildProjectileSpellStatePatch } from './spellProjectileState';
import { buildTickSpellsRuntimePatch, type TickSpellsRuntimeState, type TickSpellsProjectileDeps } from './tickSpellsRuntime';
import { createTickSpellsProjectileDeps } from './tickSpellsProjectileDeps';

type CastSpellStoreRuntimeState = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championEquipment: Record<number, ChampionEquipment>;
    championCombat: Record<number, ChampionCombat>;
    activePotionBoosts: ActivePotionBoost[];
    activeShields: import('../runtimeTypes').PartyShield[];
    floorItems: FloorItem[];
    spellLights: import('../runtimeTypes').SpellLight[];
    spellVisualEvents: import('../runtimeTypes').SpellVisualEvent[];
    activePoisonClouds: ActivePoisonCloud[];
    openDoors: Set<string>;
    openWalls: Set<string>;
    invisibleUntil: number;
    seeThroughWallsUntil: number;
    magicVisionUntil: number;
    footprintsUntil: number;
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    elapsedGameTimeTicks: number;
    projectiles: import('../runtimeTypes').Projectile[];
};

type SpellVisualSoundName = 'exploding_fireball' | 'exploding_spell';

type CastSpellStorePatch = Partial<CastSpellStoreRuntimeState> & Record<string, unknown>;
type CastCheck = {
    success: boolean;
    requiredSkillLevel: number;
    missingSkillLevels: number;
    successChance: number;
};
type ProjectileSpellPatchDeps = Parameters<typeof buildProjectileSpellStatePatch>[1];
type ProjectileSpellEffect = Parameters<ProjectileSpellPatchDeps['applyBacklash']>[0];

type CastSpellPreparationDeps = {
    buildUnknownCombinationPatch: (now: number) => CastSpellStorePatch;
    getChampionMasteryLevel: (championId: number, champion: Champion, skill: SkillKey) => number;
    rollCastCheck: (
        champion: Champion,
        equip: ChampionEquipment,
        activePotionBoosts: ActivePotionBoost[],
        vitals: ChampionVitals,
        spell: SpellDef,
        skillLevel: number,
    ) => CastCheck;
    buildChampionSkillExperiencePatch: (championId: number, skill: SkillKey, amount: number) => CastSpellStorePatch | null;
    originalTimerTicksToSeconds: (ticks: number) => number;
    createChampionCombatState: (cooldownMax: number) => ChampionCombat;
    randomInt: (maxExclusive: number) => number;
};

type ProjectileSpellRuntimeDeps = {
    quantizeDurationMs: (milliseconds: number) => number;
    buildDroppedItem: (
        item: FloorItem,
        level: number,
        y: number,
        x: number,
    ) => FloorItem;
    getEffectiveChampionStats: (
        champion: Champion,
        equip: ChampionEquipment,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals: ChampionVitals,
    ) => { mana: number };
    getImmediateDoor: (
        state: CastSpellStoreRuntimeState,
        level: number,
        x: number,
        y: number,
    ) => ReturnType<ProjectileSpellPatchDeps['getImmediateDoor']>;
    isImmediatelyBlocked: (
        state: CastSpellStoreRuntimeState,
        level: number,
        x: number,
        y: number,
    ) => boolean;
    buildBlockedPoisonCloud: ProjectileSpellPatchDeps['buildBlockedPoisonCloud'];
    applyPartySpellBacklashDamage: (
        state: CastSpellStoreRuntimeState,
        championId: number,
        nextVitals: ChampionVitals,
        effect: ProjectileSpellEffect,
        rolledDamage: number,
        now: number,
    ) => ReturnType<ProjectileSpellPatchDeps['applyBacklash']>;
};

type CastSpellStoreRuntimeDeps = CastSpellPreparationDeps & ProjectileSpellRuntimeDeps & {
    mergeBasePatch: (basePatch: CastSpellStorePatch, nextPatch: CastSpellStorePatch) => CastSpellStorePatch;
};

type CastSpellStoreRuntimePartyDamageDeps = {
    applyPartySpellBacklashDamage: (
        state: CastSpellStoreRuntimeState,
        championVitals: Record<number, ChampionVitals>,
        effect: ProjectileSpellEffect,
        rolledDamage: number,
        now: number,
    ) => ReturnType<ProjectileSpellPatchDeps['applyBacklash']>;
};

export type StoreCastSpellRuntimeStableDeps = Omit<
    CastSpellStoreRuntimeDeps,
    | 'getChampionMasteryLevel'
    | 'buildChampionSkillExperiencePatch'
    | 'applyPartySpellBacklashDamage'
>;

export function createStoreCastSpellRuntimeDeps(
    state: CastSpellStoreRuntimeState,
    runtimePartyDamageDeps: CastSpellStoreRuntimePartyDamageDeps,
    deps: StoreCastSpellRuntimeStableDeps & {
        getChampionMasteryLevel: (state: CastSpellStoreRuntimeState, championId: number, champion: Champion, skill: SkillKey) => number;
        buildChampionSkillExperiencePatch: (
            state: CastSpellStoreRuntimeState,
            championId: number,
            skill: SkillKey,
            amount: number,
        ) => CastSpellStorePatch | null;
    },
): CastSpellStoreRuntimeDeps {
    return {
        ...deps,
        getChampionMasteryLevel: (championId, champion, skill) =>
            deps.getChampionMasteryLevel(state, championId, champion, skill),
        buildChampionSkillExperiencePatch: (championId, skill, amount) =>
            deps.buildChampionSkillExperiencePatch(state, championId, skill, amount),
        applyPartySpellBacklashDamage: (currentState, championId, nextVitals, effect, rolledDamage, now) =>
            runtimePartyDamageDeps.applyPartySpellBacklashDamage(
                currentState,
                { ...currentState.championVitals, [championId]: nextVitals },
                effect,
                rolledDamage,
                now,
            ),
    };
}

export function playCastSpellDoorMotionResult(
    result: ReturnType<typeof buildStoreCastSpellRuntimeResult> | null,
    deps: {
        playDoorMotion: (durationMs: number, volume: number) => void;
        getDoorSoundVolume: (level: number, x: number, y: number) => number;
        doorToggleSoundDurationMs?: number;
    },
) {
    if (!result?.shouldPlayDoorMotion || !result.doorMotionSquare) return;
    deps.playDoorMotion(
        deps.doorToggleSoundDurationMs ?? 1000,
        deps.getDoorSoundVolume(
            result.doorMotionSquare.level,
            result.doorMotionSquare.x,
            result.doorMotionSquare.y,
        ),
    );
}

export function resolveSpellVisualSoundNames(
    previousSpellVisualEvents: Array<Pick<CastSpellStoreRuntimeState['spellVisualEvents'][number], 'id'>>,
    nextSpellVisualEvents: Array<Pick<CastSpellStoreRuntimeState['spellVisualEvents'][number], 'id' | 'effect' | 'kind'>>,
): SpellVisualSoundName[] {
    const previousIds = new Set(previousSpellVisualEvents.map((event) => event.id));
    let hasFireballExplosion = false;
    let hasGenericSpellExplosion = false;

    for (const event of nextSpellVisualEvents) {
        if (previousIds.has(event.id) || event.kind === 'death') continue;
        if (event.effect === 'fireball') {
            hasFireballExplosion = true;
            continue;
        }
        if (event.effect === 'slime') continue;
        hasGenericSpellExplosion = true;
    }

    const sounds: SpellVisualSoundName[] = [];
    if (hasFireballExplosion) sounds.push('exploding_fireball');
    if (hasGenericSpellExplosion) sounds.push('exploding_spell');
    return sounds;
}

export function buildStoreCastSpellRuntimeResult(
    state: CastSpellStoreRuntimeState,
    championId: number,
    runeIds: string[],
    now: number,
    deps: CastSpellStoreRuntimeDeps,
) {
    const prepareCast = (
        currentState: CastSpellStoreRuntimeState,
        targetChampionId: number,
        spell: SpellDef,
        champion: Champion,
        vitals: ChampionVitals,
        currentNow: number,
    ) => {
        const castEquip = currentState.championEquipment[targetChampionId] ?? {};
        return prepareSpellCast(
            {
                championId: targetChampionId,
                spell,
                vitals,
                currentChampionCombat: currentState.championCombat,
                now: currentNow,
            },
            {
                getSkillLevel: (skill) =>
                    deps.getChampionMasteryLevel(targetChampionId, champion, skill),
                rollCastCheck: (skillLevel) =>
                    deps.rollCastCheck(
                        champion,
                        castEquip,
                        currentState.activePotionBoosts,
                        vitals,
                        spell,
                        skillLevel,
                    ),
                applySkillXp: (skill, amount) =>
                    deps.buildChampionSkillExperiencePatch(targetChampionId, skill, amount),
                originalTimerTicksToSeconds: deps.originalTimerTicksToSeconds,
                createChampionCombatState: deps.createChampionCombatState,
                randomInt: deps.randomInt,
            },
        );
    };

    const buildProjectilePatch = (
        currentState: CastSpellStoreRuntimeState,
        targetChampionId: number,
        spell: SpellDef,
        nextVitals: ChampionVitals,
        skillLevel: number,
        champion: Champion,
        currentNow: number,
    ) => {
        switch (spell.effect) {
            case 'fireball':
            case 'lightning':
            case 'poison_cloud':
            case 'poison_bolt':
            case 'open':
            case 'disrupt_nonmaterial': {
                const equip = currentState.championEquipment[targetChampionId] ?? {};
                const effective = deps.getEffectiveChampionStats(
                    champion,
                    equip,
                    currentState.activePotionBoosts,
                    nextVitals,
                );
                return buildProjectileSpellStatePatch(
                    {
                        spell,
                        championId: targetChampionId,
                        level: currentState.level,
                        position: currentState.position,
                        direction: currentState.direction,
                        now: currentNow,
                        skillLevel,
                        maxMana: effective.mana,
                        elapsedGameTimeTicks: currentState.elapsedGameTimeTicks,
                        nextVitals,
                        currentChampionVitals: currentState.championVitals,
                        currentSpellVisualEvents: currentState.spellVisualEvents,
                        currentOpenDoors: currentState.openDoors,
                        currentProjectiles: currentState.projectiles,
                        currentActivePoisonClouds: currentState.activePoisonClouds,
                    },
                    {
                        projectileAttack: 90,
                        projectileStepMs: PROJECTILE_STEP_MS,
                        gridSize: GRID_SIZE,
                        getImmediateDoor: (level, x, y) => deps.getImmediateDoor(currentState, level, x, y),
                        isImmediatelyBlocked: (level, x, y) =>
                            deps.isImmediatelyBlocked(currentState, level, x, y),
                        buildBlockedPoisonCloud: deps.buildBlockedPoisonCloud,
                        rollSourceBackedImpactDamage: (initialRange) => {
                            const impact = rollOriginalSpellProjectileImpact(
                                spell,
                                initialRange,
                                0,
                                deps.randomInt,
                            );
                            return impact?.damage ?? null;
                        },
                        rollRandomDamage: (min, max) =>
                            min + Math.floor(Math.random() * (max - min + 1)),
                        applyBacklash: (effect, rolledDamage) =>
                            deps.applyPartySpellBacklashDamage(
                                currentState,
                                targetChampionId,
                                nextVitals,
                                effect,
                                rolledDamage,
                                currentNow,
                            ),
                    },
                );
            }
            default:
                return null;
        }
    };

    return buildCastSpellCommandRuntimeResult<CastSpellStorePatch>(
        state,
        championId,
        runeIds,
        now,
        {
            findSpell,
            buildUnknownCombinationPatch: deps.buildUnknownCombinationPatch,
            prepareCast,
            buildFailedCastPatch: (currentState, targetChampionId, basePatch, nextVitals) => ({
                ...basePatch,
                championVitals: { ...currentState.championVitals, [targetChampionId]: nextVitals },
            }),
            buildNonProjectilePatch: (currentState, targetChampionId, spell, nextVitals, champion, currentNow) =>
                buildHandledNonProjectileSpellPatch({
                    championId: targetChampionId,
                    championHealth: champion.health,
                    now: currentNow,
                    spell,
                    level: currentState.level,
                    position: currentState.position,
                    nextVitals,
                    currentChampionVitals: currentState.championVitals,
                    currentChampionEquipment: currentState.championEquipment,
                    currentEquipment: currentState.championEquipment[targetChampionId] ?? {},
                    currentFloorItems: currentState.floorItems,
                    currentSpellLights: currentState.spellLights,
                    currentActiveShields: currentState.activeShields,
                    invisibleUntil: currentState.invisibleUntil,
                    seeThroughWallsUntil: currentState.seeThroughWallsUntil,
                    magicVisionUntil: currentState.magicVisionUntil,
                    footprintsUntil: currentState.footprintsUntil,
                    quantizeDurationMs: deps.quantizeDurationMs,
                    randomInt: deps.randomInt,
                    resolvePotionName: (typeId) => resolveItemName('Potion', typeId),
                    plasmaName: resolveItemName('Misc', 51),
                    buildDroppedItem: (item) => deps.buildDroppedItem(
                        item,
                        currentState.level,
                        currentState.position[1],
                        currentState.position[0],
                    ),
                }),
            buildProjectilePatch,
            mergeBasePatch: deps.mergeBasePatch,
        },
    );
}

type TickSpellsStoreDeps = Omit<
    Parameters<typeof createTickSpellsProjectileDeps>[2],
    'resolveProjectileTeleporterTransport' | 'resolveChampionIncomingAttack' | 'doorToggleSoundDurationMs' | 'originalSpellProjectileAttack'
> & {
    resolveProjectileTeleporterTransport: (
        state: TickSpellsRuntimeState,
        level: number,
        x: number,
        y: number,
        direction: Parameters<TickSpellsProjectileDeps['resolveProjectileTeleporterTransport']>[3],
    ) => ReturnType<TickSpellsProjectileDeps['resolveProjectileTeleporterTransport']>;
    resolveChampionIncomingAttack: (
        state: TickSpellsRuntimeState,
        incomingState: Parameters<TickSpellsProjectileDeps['resolveChampionIncomingAttack']>[0],
        targetChampion: Parameters<TickSpellsProjectileDeps['resolveChampionIncomingAttack']>[1],
        currentVitals: Parameters<TickSpellsProjectileDeps['resolveChampionIncomingAttack']>[2],
        rawAttack: Parameters<TickSpellsProjectileDeps['resolveChampionIncomingAttack']>[3],
        attackType: Parameters<TickSpellsProjectileDeps['resolveChampionIncomingAttack']>[4],
        attackNow: Parameters<TickSpellsProjectileDeps['resolveChampionIncomingAttack']>[5],
    ) => ReturnType<TickSpellsProjectileDeps['resolveChampionIncomingAttack']>;
    footprintLifetimeMs?: number;
    damageEventLifetimeMs?: number;
};

export function buildStoreTickSpellsRuntimePatch(
    state: TickSpellsRuntimeState,
    now: number,
    deps: TickSpellsStoreDeps,
) {
    return buildTickSpellsRuntimePatch(state, now, {
        buildProjectileTickDeps: (currentState, currentGameTick, currentNow) =>
            createTickSpellsProjectileDeps(currentGameTick, currentNow, {
                ...deps,
                resolveProjectileTeleporterTransport: (level, x, y, direction) =>
                    deps.resolveProjectileTeleporterTransport(currentState, level, x, y, direction),
                originalSpellProjectileAttack: 90,
                resolveChampionIncomingAttack: (
                    incomingState,
                    targetChampion,
                    currentVitals,
                    rawAttack,
                    attackType,
                    attackNow,
                ) =>
                    deps.resolveChampionIncomingAttack(
                        currentState,
                        incomingState,
                        targetChampion,
                        currentVitals,
                        rawAttack,
                        attackType,
                        attackNow,
                    ),
                doorToggleSoundDurationMs: 1000,
            }),
        footprintLifetimeMs: deps.footprintLifetimeMs ?? FOOTPRINT_LIFETIME_MS,
        damageEventLifetimeMs: deps.damageEventLifetimeMs ?? DAMAGE_EVENT_LIFETIME_MS,
    });
}

type TickSpellsStoreRuntimePartyDamageDeps = {
    applyPartySpellBacklashDamage: TickSpellsStoreDeps['applyPartySpellBacklashDamage'];
    applyPartyWideIncomingAttack: TickSpellsStoreDeps['applyPartyWideIncomingAttack'];
};

type TickSpellsStoreRuntimeStatefulDeps = Pick<
    TickSpellsStoreDeps,
    'resolveProjectileTeleporterTransport' | 'resolveChampionIncomingAttack'
>;

export type StoreTickSpellsRuntimeStableDeps = Omit<
    TickSpellsStoreDeps,
    | 'applyPartySpellBacklashDamage'
    | 'applyPartyWideIncomingAttack'
    | 'resolveProjectileTeleporterTransport'
    | 'resolveChampionIncomingAttack'
>;

type StoreTickSpellsRuntimePartyDamageSourceDeps<
    TAttackType,
    TAllowedSlots,
> = {
    applyPartySpellBacklashDamage: TickSpellsStoreRuntimePartyDamageDeps['applyPartySpellBacklashDamage'];
    applyPartyWideIncomingAttack: (
        state: Parameters<TickSpellsStoreRuntimePartyDamageDeps['applyPartyWideIncomingAttack']>[0],
        championVitals: Parameters<TickSpellsStoreRuntimePartyDamageDeps['applyPartyWideIncomingAttack']>[1],
        attack: Parameters<TickSpellsStoreRuntimePartyDamageDeps['applyPartyWideIncomingAttack']>[2],
        attackType: TAttackType,
        allowedSlots: TAllowedSlots,
        now: Parameters<TickSpellsStoreRuntimePartyDamageDeps['applyPartyWideIncomingAttack']>[3],
    ) => ReturnType<TickSpellsStoreRuntimePartyDamageDeps['applyPartyWideIncomingAttack']>;
};

export function createStoreTickSpellsRuntimePartyDamageDeps<
    TAttackType,
    TAllowedSlots,
>(
    runtimePartyDamageDeps: StoreTickSpellsRuntimePartyDamageSourceDeps<TAttackType, TAllowedSlots>,
    defaults: {
        attackType: TAttackType;
        allowedSlots: TAllowedSlots;
    },
): TickSpellsStoreRuntimePartyDamageDeps {
    return {
        applyPartySpellBacklashDamage: runtimePartyDamageDeps.applyPartySpellBacklashDamage,
        applyPartyWideIncomingAttack: (state, championVitals, attack, now) =>
            runtimePartyDamageDeps.applyPartyWideIncomingAttack(
                state,
                championVitals,
                attack,
                defaults.attackType,
                defaults.allowedSlots,
                now,
            ),
    };
}

export function createStoreTickSpellsStatefulDeps<
    TTerrainDeps,
    TIncomingAttackState,
>(
    params: {
        buildTerrainTransportDeps: () => TTerrainDeps;
        resolveProjectileTeleporterTransportSystem: (
            state: TickSpellsRuntimeState,
            level: Parameters<TickSpellsStoreRuntimeStatefulDeps['resolveProjectileTeleporterTransport']>[1],
            x: Parameters<TickSpellsStoreRuntimeStatefulDeps['resolveProjectileTeleporterTransport']>[2],
            y: Parameters<TickSpellsStoreRuntimeStatefulDeps['resolveProjectileTeleporterTransport']>[3],
            direction: Parameters<TickSpellsStoreRuntimeStatefulDeps['resolveProjectileTeleporterTransport']>[4],
            terrainDeps: TTerrainDeps,
        ) => ReturnType<TickSpellsStoreRuntimeStatefulDeps['resolveProjectileTeleporterTransport']>;
        buildIncomingAttackState: (
            currentState: TickSpellsRuntimeState,
            incomingState: Parameters<TickSpellsStoreRuntimeStatefulDeps['resolveChampionIncomingAttack']>[1],
        ) => TIncomingAttackState;
        resolveChampionIncomingAttackRuntime: (
            state: TIncomingAttackState,
            targetChampion: Parameters<TickSpellsStoreRuntimeStatefulDeps['resolveChampionIncomingAttack']>[2],
            currentVitals: Parameters<TickSpellsStoreRuntimeStatefulDeps['resolveChampionIncomingAttack']>[3],
            rawAttack: Parameters<TickSpellsStoreRuntimeStatefulDeps['resolveChampionIncomingAttack']>[4],
            attackType: Parameters<TickSpellsStoreRuntimeStatefulDeps['resolveChampionIncomingAttack']>[5],
            attackNow: Parameters<TickSpellsStoreRuntimeStatefulDeps['resolveChampionIncomingAttack']>[6],
        ) => ReturnType<TickSpellsStoreRuntimeStatefulDeps['resolveChampionIncomingAttack']>;
    },
): TickSpellsStoreRuntimeStatefulDeps {
    return {
        resolveProjectileTeleporterTransport: (currentState, level, x, y, direction) =>
            params.resolveProjectileTeleporterTransportSystem(
                currentState,
                level,
                x,
                y,
                direction,
                params.buildTerrainTransportDeps(),
            ),
        resolveChampionIncomingAttack: (
            currentState,
            incomingState,
            targetChampion,
            currentVitals,
            rawAttack,
            attackType,
            attackNow,
        ) => params.resolveChampionIncomingAttackRuntime(
            params.buildIncomingAttackState(currentState, incomingState),
            targetChampion,
            currentVitals,
            rawAttack,
            attackType,
            attackNow,
        ),
    };
}

export function createStoreTickSpellsRuntimeDeps(
    runtimePartyDamageDeps: TickSpellsStoreRuntimePartyDamageDeps,
    statefulDeps: TickSpellsStoreRuntimeStatefulDeps,
    deps: StoreTickSpellsRuntimeStableDeps,
): TickSpellsStoreDeps {
    return {
        ...deps,
        applyPartySpellBacklashDamage: runtimePartyDamageDeps.applyPartySpellBacklashDamage,
        applyPartyWideIncomingAttack: runtimePartyDamageDeps.applyPartyWideIncomingAttack,
        resolveProjectileTeleporterTransport: statefulDeps.resolveProjectileTeleporterTransport,
        resolveChampionIncomingAttack: statefulDeps.resolveChampionIncomingAttack,
    };
}
