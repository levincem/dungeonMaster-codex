import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type { ChampionVitals } from '../runtimeTypes';
import type { LocatedChampionItem } from './inventoryState';

type UseItemState<TActivePotionBoost, TActiveShield> = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    activePotionBoosts: TActivePotionBoost[];
    activeShields: TActiveShield[];
};

type UseItemDeps<TActivePotionBoost, TActiveShield> = {
    locateChampionItem: (
        state: UseItemState<TActivePotionBoost, TActiveShield>,
        championId: number,
        itemId: string,
        fromSlot: EquipSlotKey | 'inventory',
    ) => LocatedChampionItem | null;
    getEffectiveChampionStatsRuntime: (
        champion: Champion,
        equipment: ChampionEquipment,
        activePotionBoosts: TActivePotionBoost[],
        vitals: ChampionVitals,
    ) => { stamina: number; mana: number; health: number };
    normalizeChampionCurrentStats: (
        champion: Champion,
        currentStats: ChampionVitals['currentStats'],
    ) => ChampionVitals['currentStats'];
    resolveUseItemConsumption: (args: {
        item: FloorItem;
        championId: number;
        vitals: ChampionVitals;
        effective: { stamina: number; mana: number; health: number };
        normalizedStats: ChampionVitals['currentStats'];
        activeShields: TActiveShield[];
        now: number;
    }) => (
        | { kind: 'blocked' }
        | {
            kind: 'handled';
            nextVitals: ChampionVitals;
            replacementItem: FloorItem | null;
            shouldConsumeOriginal: boolean;
            activeShields?: TActiveShield[];
        }
        | { kind: 'unhandled' }
    );
    buildUseItemPatch: (args: {
        championId: number;
        itemId: string;
        slotKey?: EquipSlotKey;
        inventoryIndex: number;
        item: FloorItem;
        inventory: FloorItem[];
        equipment: ChampionEquipment;
        currentChampionVitals: Record<number, ChampionVitals>;
        currentChampionInventories: Record<number, FloorItem[]>;
        currentChampionEquipment: Record<number, ChampionEquipment>;
        nextVitals: ChampionVitals;
        replacementItem: FloorItem | null;
        shouldConsumeOriginal: boolean;
        currentActiveShields: TActiveShield[];
        nextActiveShields: TActiveShield[];
    }) => Record<string, unknown>;
};

export function buildUseItemStatePatch<TActivePotionBoost, TActiveShield>(
    state: UseItemState<TActivePotionBoost, TActiveShield>,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    now: number,
    deps: UseItemDeps<TActivePotionBoost, TActiveShield>,
): Record<string, unknown> | null {
    const located = deps.locateChampionItem(state, championId, itemId, fromSlot);
    if (!located) return null;

    const vitals = state.championVitals[championId];
    if (!vitals) return null;

    const champion = state.party.find((entry) => entry.id === championId);
    if (!champion) return null;

    const { inventory, equipment, inventoryIndex, slotKey, item } = located;
    const effective = deps.getEffectiveChampionStatsRuntime(
        champion,
        equipment,
        state.activePotionBoosts,
        vitals,
    );

    const newVitals = { ...vitals };
    let replacementItem: FloorItem | null = null;
    let shouldConsumeOriginal = true;
    let nextActiveShields = state.activeShields;

    const consumableUse = deps.resolveUseItemConsumption({
        item,
        championId,
        vitals,
        effective,
        normalizedStats: deps.normalizeChampionCurrentStats(champion, newVitals.currentStats),
        activeShields: state.activeShields,
        now,
    });
    if (consumableUse.kind === 'blocked') return null;
    if (consumableUse.kind === 'handled') {
        Object.assign(newVitals, consumableUse.nextVitals);
        replacementItem = consumableUse.replacementItem;
        shouldConsumeOriginal = consumableUse.shouldConsumeOriginal;
        nextActiveShields = consumableUse.activeShields ?? state.activeShields;
    }

    return deps.buildUseItemPatch({
        championId,
        itemId,
        slotKey,
        inventoryIndex,
        item,
        inventory,
        equipment,
        currentChampionVitals: state.championVitals,
        currentChampionInventories: state.championInventories,
        currentChampionEquipment: state.championEquipment,
        nextVitals: newVitals,
        replacementItem,
        shouldConsumeOriginal,
        currentActiveShields: state.activeShields,
        nextActiveShields,
    });
}
