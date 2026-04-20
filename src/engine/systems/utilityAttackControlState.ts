import type { CreatureDef } from '../../data/creatures';
import { getTranslations } from '../../i18n';
import type { CreatureInstance } from '../../types/game';
import { resolveCreatureControlAction, type CreatureTimers } from './creatureControlActions';
import {
    resolveFearUtilityAction,
    type FearUtilityAction,
    type FearUtilityActionResult,
} from './fearUtilityActions';

const runtimeText = getTranslations().runtime;

export type UtilityControlAction =
    | 'Confuse'
    | 'Fluxcage'
    | FearUtilityAction;

type UtilityControlActionState = {
    now: number;
    frontCreatures: CreatureInstance[];
    target: CreatureInstance | null;
    rightHandTypeId: number | undefined;
    targetTimers: CreatureTimers | undefined;
};

type UtilityControlActionDeps<TMessage> = {
    buildAttackResultMessage: (message: string) => TMessage;
    getCreatureDef: (typeId: number) => CreatureDef | undefined;
    quantizeDurationMs: (durationMs: number) => number;
    randomInt: (max: number) => number;
    timerTickMs: number;
};

export type UtilityControlUpdate = {
    targetId: string;
    expiresAt: number;
    nextTimers: CreatureTimers | undefined;
    kind: 'confused' | 'fluxcaged';
};

export type UtilityRuntimeActionResult<TPatch> = {
    patch: TPatch;
    controlUpdate?: UtilityControlUpdate;
    fearResult?: FearUtilityActionResult;
};

export function buildUtilityRuntimeActionPatch<TPatch extends object, TMessage>(
    action: UtilityControlAction,
    state: UtilityControlActionState,
    basePatch: TPatch,
    deps: UtilityControlActionDeps<TMessage>,
): UtilityRuntimeActionResult<TPatch> {
    switch (action) {
        case 'Confuse':
        case 'Fluxcage': {
            if (!state.target) {
                return {
                    patch: {
                        ...basePatch,
                        lastCastResult: deps.buildAttackResultMessage(runtimeText.utilityNoTarget(action)),
                    } as TPatch,
                };
            }
            const control = resolveCreatureControlAction(
                action,
                state.now,
                state.targetTimers,
                { quantizeDurationMs: deps.quantizeDurationMs },
            );
            return {
                patch: basePatch,
                controlUpdate: {
                    targetId: state.target.id,
                    expiresAt: control.expiresAt,
                    nextTimers: control.nextTimers,
                    kind: action === 'Confuse' ? 'confused' : 'fluxcaged',
                },
            };
        }
        case 'Calm':
        case 'Brandish':
        case 'Blow Horn':
        case 'War Cry':
            return {
                patch: basePatch,
                fearResult: resolveFearUtilityAction(
                    action,
                    state.frontCreatures,
                    state.now,
                    state.rightHandTypeId,
                    {
                        getCreatureDef: deps.getCreatureDef,
                        randomInt: deps.randomInt,
                        quantizeDurationMs: deps.quantizeDurationMs,
                        timerTickMs: deps.timerTickMs,
                    },
                ),
            };
    }
}
