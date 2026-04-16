import type { DeathDropState } from './deathDrops';

type MonsterDeathProcessingState = DeathDropState;
type MonsterDeathProcessingPatch = Pick<
    DeathDropState,
    'party' | 'championInventories' | 'championEquipment' | 'floorItems' | 'deadChampions'
>;

type MonsterDeathProcessingDeps = {
    buildDeathDrop: (
        state: MonsterDeathProcessingState,
        championId: number,
        nowMs: number,
    ) => MonsterDeathProcessingPatch;
};

export function processMonsterTickChampionDeaths(
    state: MonsterDeathProcessingState,
    championIds: readonly number[],
    nowMs: number,
    deps: MonsterDeathProcessingDeps,
): MonsterDeathProcessingState {
    let nextState = state;
    for (const championId of championIds) {
        nextState = {
            ...nextState,
            ...deps.buildDeathDrop(nextState, championId, nowMs),
        };
    }
    return nextState;
}
