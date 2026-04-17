import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type { Projectile } from '../runtimeTypes';

type ThrowCarriedItemRuntimeState = {
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    projectiles: Projectile[];
};

type ThrowCarriedItemRuntimeDeps<
    TState extends ThrowCarriedItemRuntimeState,
    TThrowPatch,
    TXpPatch,
> = {
    buildProjectile: (state: TState, championId: number, champion: Champion, carriedItem: FloorItem) => Projectile;
    buildThrowXpPatch: (state: TState, championId: number) => TXpPatch | null;
    throwChampionCarriedItem: (
        state: TState,
        championId: number,
        itemId: string,
        fromSlot: EquipSlotKey | 'inventory',
        projectile: Projectile,
    ) => TThrowPatch | null;
};

type ResurrectChampionRuntimeState = {
    level: number;
    position: [number, number];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
};

type ResurrectChampionRuntimeDeps<TState extends ResurrectChampionRuntimeState, TPatch> = {
    maxPartySize: number;
    isAltarTile: (level: number, x: number, y: number) => boolean;
    buildViAltarResurrectionPatch: (
        state: TState,
        deadChampionId: number,
        bonesItemId: string,
        carriedBy: number | null,
    ) => TPatch | null;
};

function findChampionCarriedItem(
    state: ThrowCarriedItemRuntimeState,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
): FloorItem | null {
    if (fromSlot === 'inventory') {
        return (state.championInventories[championId] ?? []).find((item) => item.id === itemId) ?? null;
    }
    const equipped = state.championEquipment[championId]?.[fromSlot];
    return equipped?.id === itemId ? equipped : null;
}

export function buildThrowCarriedItemRuntimePatch<
    TState extends ThrowCarriedItemRuntimeState,
    TThrowPatch extends Record<string, unknown>,
    TXpPatch extends Record<string, unknown>,
>(
    state: TState,
    championId: number,
    itemId: string,
    fromSlot: EquipSlotKey | 'inventory',
    deps: ThrowCarriedItemRuntimeDeps<TState, TThrowPatch, TXpPatch>,
): (TThrowPatch & TXpPatch) | null {
    const champion = state.party.find((entry) => entry.id === championId);
    if (!champion) return null;

    const carriedItem = findChampionCarriedItem(state, championId, itemId, fromSlot);
    if (!carriedItem) return null;

    const projectile = deps.buildProjectile(state, championId, champion, carriedItem);
    const throwPatch = deps.throwChampionCarriedItem(state, championId, itemId, fromSlot, projectile);
    if (!throwPatch) return null;

    return {
        ...throwPatch,
        ...(deps.buildThrowXpPatch(state, championId) ?? {}),
    } as TThrowPatch & TXpPatch;
}

export function buildResurrectChampionRuntimePatch<
    TState extends ResurrectChampionRuntimeState,
    TPatch,
>(
    state: TState,
    bonesItemId: string,
    deps: ResurrectChampionRuntimeDeps<TState, TPatch>,
): TPatch | null {
    let carriedBy: number | null = null;
    let bonesItem: FloorItem | undefined;

    for (const [championId, inventory] of Object.entries(state.championInventories)) {
        const found = inventory.find((item) => item.id === bonesItemId);
        if (found) {
            bonesItem = found;
            carriedBy = Number(championId);
            break;
        }
    }

    if (!bonesItem) {
        bonesItem = state.floorItems.find((item) => item.id === bonesItemId);
    }
    if (!bonesItem || bonesItem.championId === undefined) return null;

    const deadChampionId = bonesItem.championId;
    if (!state.deadChampions[deadChampionId]) return null;
    if (state.party.length >= deps.maxPartySize) return null;

    const [y, x] = state.position;
    if (!deps.isAltarTile(state.level, x, y)) return null;

    return deps.buildViAltarResurrectionPatch(state, deadChampionId, bonesItemId, carriedBy);
}
