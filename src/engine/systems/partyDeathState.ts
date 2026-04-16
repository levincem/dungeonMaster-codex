import type { DeathDropState } from './deathDrops';

type PartyDeathState = DeathDropState & {
    selectedChampionIndex: number;
};

type PartyDeathPatch = Pick<
    PartyDeathState,
    'party' | 'floorItems' | 'championInventories' | 'championEquipment' | 'deadChampions' | 'selectedChampionIndex'
>;

type PartyDeathDeps = {
    buildDeathDrop: (
        state: DeathDropState,
        championId: number,
        nowMs: number,
    ) => Pick<
        DeathDropState,
        'party' | 'floorItems' | 'championInventories' | 'championEquipment' | 'deadChampions'
    >;
};

export function applyChampionDeathDropsToPartyState(
    state: PartyDeathState,
    championIds: readonly number[],
    nowMs: number,
    deps: PartyDeathDeps,
): PartyDeathPatch | null {
    if (championIds.length === 0) return null;

    let nextState: DeathDropState = state;
    for (const championId of championIds) {
        nextState = {
            ...nextState,
            ...deps.buildDeathDrop(nextState, championId, nowMs),
        };
    }

    return {
        party: nextState.party,
        floorItems: nextState.floorItems,
        championInventories: nextState.championInventories,
        championEquipment: nextState.championEquipment,
        deadChampions: nextState.deadChampions,
        selectedChampionIndex: nextState.party.length > 0
            ? Math.min(state.selectedChampionIndex, nextState.party.length - 1)
            : 0,
    };
}
