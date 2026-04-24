import type { CreatureDef } from '../../data/creatures';
import type { WeaponAttackOption } from '../../data/weaponAttacks';
import type { Champion } from '../../types/champion';
import type { CreatureInstance, FloorItem } from '../../types/game';
import type {
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
    buildUtilityRuntimeActionPatch,
    type UtilityControlUpdate,
} from './utilityAttackControlState';
import type { UtilityRuntimeActionResult } from './utilityAttackControlState';
import { buildSimpleUtilityAttackPatch } from './utilityAttackState';
import type { FearUtilityActionResult } from './fearUtilityActions';

type UtilityRightHand = {
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
    getEndgameMessagesForMap: (level: number) => string[];
    dropCreatureCarriedItems: (
        creatures: CreatureInstance[],
        floorItems: FloorItem[],
        creatureId: string,
    ) => { creatures: CreatureInstance[]; floorItems: FloorItem[] };
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

    switch (action.enumName) {
        case 'Heal':
        case 'Light':
        case 'Spellshield':
        case 'Fireshield':
        case 'Lightning':
        case 'Fireball':
        case 'Dispell':
        case 'Freeze Life':
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
                    },
                ),
            };
        case 'Confuse':
        case 'Fluxcage':
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
            const result = buildFuseActionPatch(
                {
                    now: state.now,
                    level: state.level,
                    target,
                    rightHand: state.rightHand,
                    rightHandWeaponName: state.rightHandWeaponName,
                    fluxcageExpiresAt: target ? deps.getFluxcageExpiresAt(target.id) : 0,
                    creatures: state.creatures,
                    floorItems: state.floorItems,
                    damageEvents: state.damageEvents,
                    spellVisualEvents: state.spellVisualEvents,
                },
                basePatch,
                {
                    buildAttackResultMessage: deps.buildAttackResultMessage,
                    getEndgameMessagesForMap: deps.getEndgameMessagesForMap,
                    dropCreatureCarriedItems: deps.dropCreatureCarriedItems,
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
