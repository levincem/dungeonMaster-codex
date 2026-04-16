import type { ChampionEquipment, FloorItem } from '../../types/game';
import { updateChampionItem } from './inventoryState';

type FillWaterCollectionsState = {
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
};

type ResolveFillWaterActionArgs = {
    state: FillWaterCollectionsState;
    championId: number;
    itemId: string;
};

type FillWaterActionDeps = {
    canFillWaterContainer: (item: FloorItem) => boolean;
    fillWaterContainer: (item: FloorItem) => FloorItem | null;
};

export function resolveFillWaterAction(
    {
        state,
        championId,
        itemId,
    }: ResolveFillWaterActionArgs,
    deps: FillWaterActionDeps,
) {
    return updateChampionItem(state, championId, itemId, (item) => {
        if (!deps.canFillWaterContainer(item)) return null;
        return deps.fillWaterContainer(item);
    });
}
