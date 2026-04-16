import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { ChampionVitals } from '../runtimeTypes';

type CreatureAttackTargetStateArgs = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    selectedTargetId: number | null;
};

export type CreatureAttackTargetState = {
    targetChampion: Champion | null;
    targetVitals: ChampionVitals | null;
    targetInventory: FloorItem[];
    targetEquipment: ChampionEquipment;
};

export function resolveCreatureAttackTargetState(
    args: CreatureAttackTargetStateArgs,
): CreatureAttackTargetState {
    if (args.selectedTargetId === null) {
        return {
            targetChampion: null,
            targetVitals: null,
            targetInventory: [],
            targetEquipment: {},
        };
    }

    return {
        targetChampion: args.party.find((partyChampion) => partyChampion.id === args.selectedTargetId) ?? null,
        targetVitals: args.championVitals[args.selectedTargetId] ?? null,
        targetInventory: args.championInventories[args.selectedTargetId] ?? [],
        targetEquipment: args.championEquipment[args.selectedTargetId] ?? {},
    };
}
