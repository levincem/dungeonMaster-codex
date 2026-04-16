import type { Champion } from '../../types/champion';
import type { FloorItem, SensorObject, GameTile } from '../../types/game';

type FloorPickupState = {
    floorItems: FloorItem[];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    activeFloorDrag: { itemId: string; pointerX: number; pointerY: number } | null;
};

export function hasHiddenFirestaffPickupRestriction(item: FloorItem, tile: GameTile | undefined): boolean {
    if (item.category !== 'Weapon' || item.typeId !== 45) return false;
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return false;

    return tile.objects.some((object) =>
        object.category === 'Sensor' &&
        (
            (object as SensorObject).requiredObjectName === 'THE FIRESTAFF' ||
            (object as SensorObject).requiredObjectName === 'ZOKATHRA SPELL'
        ),
    );
}

export function buildFloorItemPickupPatch<TSensorPatch extends object>(
    state: FloorPickupState,
    item: FloorItem,
    championId: number,
    sensorPatch: TSensorPatch,
): {
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    activeFloorDrag: FloorPickupState['activeFloorDrag'];
} & TSensorPatch {
    const championInventory = state.championInventories[championId] ?? [];
    return {
        floorItems: state.floorItems.filter((entry) => entry.id !== item.id),
        championInventories: { ...state.championInventories, [championId]: [...championInventory, item] },
        activeFloorDrag: state.activeFloorDrag?.itemId === item.id ? null : state.activeFloorDrag,
        ...sensorPatch,
    };
}
