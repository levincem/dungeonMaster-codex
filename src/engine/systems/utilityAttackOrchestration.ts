import type { CreatureDef } from '../../data/creatures';
import type { WeaponAttackOption } from '../../data/weaponAttacks';
import { getTranslations } from '../../i18n';
import type { Champion } from '../../types/champion';
import type { CreatureInstance, FloorItem } from '../../types/game';
import type {
    ActiveFluxcage,
    ChampionVitals,
    Direction,
    PartyShield,
    Projectile,
    SpellLight,
} from '../runtimeTypes';
import { resolveAttackFrontContext } from './attackFrontContext';
import type { CreatureTimers } from './creatureControlActions';
import { buildFuseActionPatch } from './fuseAction';
import {
    FLUXCAGE_DURATION_MS,
    getFrontFluxcageTile,
    hasActiveFluxcageAt,
    isFluxcagePlaceableTile,
    upsertActiveFluxcage,
} from './fluxcageTileState';
import { resolveLordChaosFluxcageEscape } from './lordChaosFluxcageEscape';
import {
    buildUtilityRuntimeActionPatch,
    type UtilityControlUpdate,
} from './utilityAttackControlState';
import type { UtilityRuntimeActionResult } from './utilityAttackControlState';
import { buildSimpleUtilityAttackPatch } from './utilityAttackState';
import type { FearUtilityActionResult } from './fearUtilityActions';
import {
    MAGIC_BOX_BLUE_TYPE_ID,
    MAGIC_BOX_GREEN_TYPE_ID,
} from '../../data/itemChargeState';

const runtimeText = getTranslations().runtime;

type UtilityRightHand = {
    category: FloorItem['category'];
    typeId: number;
    rawName?: string;
} | null | undefined;

type UtilityAttackState<TDamageEvent, TSpellVisualEvent> = {
    now: number;
    level: number;
    position: [number, number];
    direction: Direction;
    creatures: CreatureInstance[];
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championId: number;
    championHealth: number;
    freezeLifeRemainingTicks: number;
    seeThroughWallsUntil: number;
    spellLights: SpellLight[];
    activeShields: PartyShield[];
    projectiles: Projectile[];
    openDoors: Set<string>;
    openPits: Set<string>;
    openWalls: Set<string>;
    activeFluxcages?: ActiveFluxcage[];
    rightHandTypeId: number | undefined;
    rightHand: UtilityRightHand;
    rightHandWeaponName: string;
    floorItems: FloorItem[];
    damageEvents: TDamageEvent[];
    spellVisualEvents: TSpellVisualEvent[];
};

type UtilityAttackDeps<
    TPatch extends object,
    TMessage,
    TDamageEvent,
    TSpellVisualEvent,
    TClimbDownState extends object,
> = {
    randomInt: (max: number) => number;
    quantizeDurationMs: (durationMs: number) => number;
    buildAttackResultMessage: (message: string, success?: boolean) => TMessage;
    getCreatureDef: (typeId: number) => CreatureDef | undefined;
    getMapTile: (level: number, x: number, y: number) => import('../../types/game').GameTile | undefined;
    buildFluxcageCastEvents: (
        level: number,
        x: number,
        y: number,
    ) => TSpellVisualEvent[];
    canCreatureShareTile: (
        mover: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ) => boolean;
    timerTickMs: number;
    getFluxcageExpiresAt: (creatureId: string) => number;
    getTargetTimers: (creatureId: string) => CreatureTimers | undefined;
    resolveClimbDown: (
        state: TClimbDownState,
        basePatch: TPatch,
    ) => { patch?: TPatch; errorMessage?: string };
    climbDownState: TClimbDownState;
    applyControlUpdate: (update: UtilityControlUpdate) => void;
    applyFearResult: (fearResult: FearUtilityActionResult) => void;
    clearCreatureControlStatuses: () => void;
    clearTargetFluxcageStatus: (creatureId: string) => void;
    getEndgameMessagesForMap: (level: number) => string[];
    buildFuseIgnitionEvents: (
        level: number,
        x: number,
        y: number,
    ) => TSpellVisualEvent[];
    dropCreatureCarriedItems: (
        creatures: CreatureInstance[],
        floorItems: FloorItem[],
        creatureId: string,
    ) => { creatures: CreatureInstance[]; floorItems: FloorItem[] };
    normalizeCreatureCellsOnTile: (
        creatures: CreatureInstance[],
        level: number,
        x: number,
        y: number,
    ) => CreatureInstance[];
    buildCreatureDamageEvent: (
        level: number,
        x: number,
        y: number,
        amount: number,
        creatureId?: string,
    ) => TDamageEvent;
    buildDeathDustEvent: (level: number, x: number, y: number) => TSpellVisualEvent;
};

type SupportedUtilityAttackResult<TPatch> = Pick<
    UtilityRuntimeActionResult<TPatch>,
    'influenceExperience'
> & {
    patch: TPatch | null;
};

export function buildSupportedUtilityAttackPatch<
    TPatch extends object,
    TMessage,
    TDamageEvent,
    TSpellVisualEvent,
    TClimbDownState extends object,
>(
    action: WeaponAttackOption,
    state: UtilityAttackState<TDamageEvent, TSpellVisualEvent>,
    basePatch: TPatch,
    deps: UtilityAttackDeps<
        TPatch,
        TMessage,
        TDamageEvent,
        TSpellVisualEvent,
        TClimbDownState
    >,
): SupportedUtilityAttackResult<TPatch> {
    const { front, target } = resolveAttackFrontContext(
        state.level,
        state.position,
        state.direction,
        state.creatures,
        state.party,
        state.championId,
    );
    const activeFluxcages = state.activeFluxcages ?? [];
    const canCreatureShareTileWithFluxcages = (
        mover: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ) => !hasActiveFluxcageAt(activeFluxcages, level, x, y, state.now)
        && deps.canCreatureShareTile(mover, level, x, y, creatures);
    const freezeLifeDurationTicks = state.rightHand?.category === 'Misc'
        ? state.rightHand.typeId === MAGIC_BOX_BLUE_TYPE_ID
            ? 30
            : state.rightHand.typeId === MAGIC_BOX_GREEN_TYPE_ID
                ? 125
                : 70
        : 70;

    switch (action.enumName) {
        case 'Heal':
        case 'Light':
        case 'Spellshield':
        case 'Fireshield':
        case 'Lightning':
        case 'Fireball':
        case 'Dispell':
        case 'Disrupt':
        case 'Block':
        case 'Flip':
        case 'Invoke':
        case 'Window':
            return {
                patch: buildSimpleUtilityAttackPatch(
                    action.enumName,
                    {
                        now: state.now,
                        level: state.level,
                        position: state.position,
                        direction: state.direction,
                        freezeLifeRemainingTicks: state.freezeLifeRemainingTicks,
                        seeThroughWallsUntil: state.seeThroughWallsUntil,
                        spellLights: state.spellLights,
                        activeShields: state.activeShields,
                        projectiles: state.projectiles,
                    },
                    basePatch,
                    state.championVitals,
                    state.championId,
                    state.championHealth,
                    {
                        randomInt: deps.randomInt,
                        quantizeDurationMs: deps.quantizeDurationMs,
                        championMaxMana: state.party.find((champion) => champion.id === state.championId)?.mana ?? 0,
                    },
                ),
            };
        case 'Freeze Life':
            return {
                patch: {
                    ...basePatch,
                    freezeLifeRemainingTicks: Math.min(
                        200,
                        state.freezeLifeRemainingTicks + freezeLifeDurationTicks,
                    ),
                },
            };
        case 'Confuse':
        case 'Calm':
        case 'Brandish':
        case 'Blow Horn':
        case 'War Cry': {
            const result = buildUtilityRuntimeActionPatch(
                action.enumName,
                {
                    now: state.now,
                    frontCreatures: front,
                    target,
                    rightHandTypeId: state.rightHandTypeId,
                    targetTimers: target ? deps.getTargetTimers(target.id) : undefined,
                },
                basePatch,
                {
                    buildAttackResultMessage: deps.buildAttackResultMessage,
                    getCreatureDef: deps.getCreatureDef,
                    quantizeDurationMs: deps.quantizeDurationMs,
                    randomInt: deps.randomInt,
                    timerTickMs: deps.timerTickMs,
                },
            );
            if (result.controlUpdate) {
                deps.applyControlUpdate(result.controlUpdate);
            }
            if (result.fearResult) {
                deps.applyFearResult(result.fearResult);
            }
            return result;
        }
        case 'Fluxcage': {
            if (target?.typeId === 23) {
                const escape = resolveLordChaosFluxcageEscape(
                    target,
                    state.creatures,
                    state.position,
                    state.openDoors,
                    state.openPits,
                    state.openWalls,
                    {
                        getMapTile: deps.getMapTile,
                        canCreatureShareTile: canCreatureShareTileWithFluxcages,
                    },
                );
                if (escape) {
                    let creatures = state.creatures.map((creature) =>
                        creature.id === target.id
                            ? { ...creature, x: escape.x, y: escape.y, cell: 'center' as const }
                            : creature,
                    );
                    creatures = deps.normalizeCreatureCellsOnTile(
                        creatures,
                        target.mapIndex,
                        target.x,
                        target.y,
                    );
                    creatures = deps.normalizeCreatureCellsOnTile(
                        creatures,
                        target.mapIndex,
                        escape.x,
                        escape.y,
                    );
                    return {
                        patch: {
                            ...basePatch,
                            creatures,
                            spellVisualEvents: [
                                ...state.spellVisualEvents,
                                ...deps.buildFluxcageCastEvents(state.level, target.x, target.y),
                            ],
                        } as TPatch,
                    };
                }
            }

            if (!target) {
                const { x, y } = getFrontFluxcageTile(state.position, state.direction);
                if (!isFluxcagePlaceableTile(
                    state.level,
                    x,
                    y,
                    state.openDoors,
                    state.openPits,
                    state.openWalls,
                    { getMapTile: deps.getMapTile },
                )) {
                    return {
                        patch: {
                            ...basePatch,
                            lastCastResult: deps.buildAttackResultMessage(runtimeText.utilityNoTarget(action.enumName)),
                        } as TPatch,
                    };
                }

                return {
                    patch: {
                        ...basePatch,
                        activeFluxcages: upsertActiveFluxcage(
                            activeFluxcages,
                            state.level,
                            x,
                            y,
                            state.now + deps.quantizeDurationMs(FLUXCAGE_DURATION_MS),
                        ),
                        spellVisualEvents: [
                            ...state.spellVisualEvents,
                            ...deps.buildFluxcageCastEvents(state.level, x, y),
                        ],
                    } as TPatch,
                };
            }

            const result = buildUtilityRuntimeActionPatch(
                action.enumName,
                {
                    now: state.now,
                    frontCreatures: front,
                    target,
                    rightHandTypeId: state.rightHandTypeId,
                    targetTimers: target ? deps.getTargetTimers(target.id) : undefined,
                },
                basePatch,
                {
                    buildAttackResultMessage: deps.buildAttackResultMessage,
                    getCreatureDef: deps.getCreatureDef,
                    quantizeDurationMs: deps.quantizeDurationMs,
                    randomInt: deps.randomInt,
                    timerTickMs: deps.timerTickMs,
                },
            );
            if (result.controlUpdate) {
                deps.applyControlUpdate(result.controlUpdate);
            }
            return {
                ...result,
                patch: result.controlUpdate && target
                    ? {
                        ...result.patch,
                        spellVisualEvents: [
                            ...state.spellVisualEvents,
                            ...deps.buildFluxcageCastEvents(state.level, target.x, target.y),
                        ],
                    } as TPatch
                    : result.patch,
            };
        }
        case 'Climb Down': {
            const climbDown = deps.resolveClimbDown(deps.climbDownState, basePatch);
            if (climbDown.errorMessage) {
                return {
                    patch: {
                        ...basePatch,
                        lastCastResult: deps.buildAttackResultMessage(climbDown.errorMessage),
                    } as TPatch,
                };
            }
            return { patch: climbDown.patch ?? basePatch };
        }
        case 'Fuse': {
            const hasCreatureFluxcage = target ? deps.getFluxcageExpiresAt(target.id) > state.now : false;
            if (target?.typeId === 23 && deps.getFluxcageExpiresAt(target.id) > state.now) {
                const escape = resolveLordChaosFluxcageEscape(
                    target,
                    state.creatures,
                    state.position,
                    state.openDoors,
                    state.openPits,
                    state.openWalls,
                    {
                        getMapTile: deps.getMapTile,
                        canCreatureShareTile: canCreatureShareTileWithFluxcages,
                    },
                );
                if (escape) {
                    deps.clearTargetFluxcageStatus(target.id);
                    let creatures = state.creatures.map((creature) =>
                        creature.id === target.id
                            ? { ...creature, x: escape.x, y: escape.y, cell: 'center' as const }
                            : creature,
                    );
                    creatures = deps.normalizeCreatureCellsOnTile(
                        creatures,
                        target.mapIndex,
                        target.x,
                        target.y,
                    );
                    creatures = deps.normalizeCreatureCellsOnTile(
                        creatures,
                        target.mapIndex,
                        escape.x,
                        escape.y,
                    );
                    return {
                        patch: {
                            ...basePatch,
                            creatures,
                            lastCastResult: deps.buildAttackResultMessage(runtimeText.lordChaosEscapesFuse),
                        } as TPatch,
                    };
                }
            }

            const trappedByFluxcageTiles = target?.typeId === 23
                && !hasCreatureFluxcage
                && Boolean(resolveLordChaosFluxcageEscape(
                    target,
                    state.creatures,
                    state.position,
                    state.openDoors,
                    state.openPits,
                    state.openWalls,
                    {
                        getMapTile: deps.getMapTile,
                        canCreatureShareTile: deps.canCreatureShareTile,
                    },
                ))
                && !resolveLordChaosFluxcageEscape(
                    target,
                    state.creatures,
                    state.position,
                    state.openDoors,
                    state.openPits,
                    state.openWalls,
                    {
                        getMapTile: deps.getMapTile,
                        canCreatureShareTile: canCreatureShareTileWithFluxcages,
                    },
                );

            const result = buildFuseActionPatch(
                {
                    now: state.now,
                    level: state.level,
                    target,
                    rightHand: state.rightHand,
                    rightHandWeaponName: state.rightHandWeaponName,
                    fluxcageExpiresAt: target ? deps.getFluxcageExpiresAt(target.id) : 0,
                    lordChaosTrapped: Boolean(hasCreatureFluxcage || trappedByFluxcageTiles),
                    creatures: state.creatures,
                    floorItems: state.floorItems,
                    damageEvents: state.damageEvents,
                    spellVisualEvents: state.spellVisualEvents,
                },
                basePatch,
                {
                    buildAttackResultMessage: deps.buildAttackResultMessage,
                    getEndgameMessagesForMap: deps.getEndgameMessagesForMap,
                    buildFuseIgnitionEvents: deps.buildFuseIgnitionEvents,
                    dropCreatureCarriedItems: deps.dropCreatureCarriedItems,
                    normalizeCreatureCellsOnTile: deps.normalizeCreatureCellsOnTile,
                    buildCreatureDamageEvent: deps.buildCreatureDamageEvent,
                    buildDeathDustEvent: deps.buildDeathDustEvent,
                },
            );
            if (result.clearCreatureControlStatuses) {
                deps.clearCreatureControlStatuses();
            }
            return { patch: result.patch };
        }
        default:
            return { patch: null };
    }
}
