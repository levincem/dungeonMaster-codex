import { runMonsterTickRuntime } from './monsterTickRuntime';
import { buildStoreAttackFrontRuntimePatch } from './storeAttackFrontRuntime';
import {
    buildStoreCastSpellRuntimeResult,
    buildStoreTickSpellsRuntimePatch,
    playCastSpellDoorMotionResult,
} from './storeSpellRuntime';
import { createStoreMonsterTickRuntimeState } from './storeMonsterRuntime';

type AttackFrontState = Parameters<typeof buildStoreAttackFrontRuntimePatch>[0];
type AttackFrontDeps = Parameters<typeof buildStoreAttackFrontRuntimePatch>[3];

type CastSpellState = Parameters<typeof buildStoreCastSpellRuntimeResult>[0];
type CastSpellDeps = Parameters<typeof buildStoreCastSpellRuntimeResult>[4];

type TickSpellsState = Parameters<typeof buildStoreTickSpellsRuntimePatch>[0];
type TickSpellsDeps = Parameters<typeof buildStoreTickSpellsRuntimePatch>[2];

type MonsterTickState = Parameters<typeof createStoreMonsterTickRuntimeState>[0] & {
    optionsModalOpen: boolean;
    party: unknown[];
};
type MonsterTickDeps = Parameters<typeof runMonsterTickRuntime>[2];

export function createStoreAttackFrontAction<TState extends AttackFrontState>(
    deps: AttackFrontDeps,
) {
    return (
        state: TState,
        championId: number,
        attackType: number | undefined,
    ): Partial<TState> | null =>
        buildStoreAttackFrontRuntimePatch(state, championId, attackType, deps) as Partial<TState> | null;
}

export function createStoreCastSpellAction<TState extends CastSpellState>(
    params: {
        createRuntimeDeps: (state: TState) => CastSpellDeps;
        doorMotionDeps: Parameters<typeof playCastSpellDoorMotionResult>[1];
    },
) {
    return (
        state: TState,
        championId: number,
        runeIds: string[],
        now: number,
    ): Partial<TState> | null => {
        const result = buildStoreCastSpellRuntimeResult(
            state,
            championId,
            runeIds,
            now,
            params.createRuntimeDeps(state),
        );
        if (!result) return null;
        playCastSpellDoorMotionResult(result, params.doorMotionDeps);
        return result.patch as Partial<TState>;
    };
}

export function createStoreTickSpellsAction<TState extends TickSpellsState>(
    createRuntimeDeps: (state: TState) => TickSpellsDeps,
) {
    return (
        state: TState,
        now: number,
    ): Partial<TState> | null =>
        buildStoreTickSpellsRuntimePatch(state, now, createRuntimeDeps(state)) as Partial<TState> | null;
}

export function createStoreMonsterTickAction<TState extends MonsterTickState>(
    createRuntimeDeps: (state: TState) => MonsterTickDeps,
) {
    return (
        state: TState,
        delta: number,
    ): Partial<TState> | null => {
        if (state.optionsModalOpen) return null;
        if (state.party.length === 0) return null;
        return runMonsterTickRuntime(
            createStoreMonsterTickRuntimeState(state),
            delta,
            createRuntimeDeps(state),
        ) as Partial<TState> | null;
    };
}
