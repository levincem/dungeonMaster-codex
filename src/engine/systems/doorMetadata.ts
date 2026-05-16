import type { DoorObject, GameTile } from '../../types/game';

const FALLBACK_DOOR_TYPE = 1;
const CORRECTED_IRON_DOOR_KEYS = new Set([
    // Hall return / Firestaff path: the raw snapshot still exposes the door
    // just north of [g:1,3] as a portcullis, but the expected presentation
    // for this specific gate is the same fully opaque iron door family used
    // by the late-game pass.
    '1,2',
    '42,30',
    '44,32',
    '47,37',
    '49,40',
]);

function resolveFallbackDoorOpenDirection(
    orientation: GameTile['orientation'],
): DoorObject['openDirection'] {
    return orientation === 'WestEast' || orientation === 'EastWest' ? 'Horizontal' : 'Vertical';
}

function resolveDoorType(tile: GameTile, door: DoorObject): number {
    if (
        door.doorType === 0 &&
        tile.globalX !== undefined &&
        tile.globalY !== undefined &&
        CORRECTED_IRON_DOOR_KEYS.has(`${tile.globalX},${tile.globalY}`)
    ) {
        return 2;
    }
    return door.doorType;
}

export function getDoorObject(tile: GameTile | undefined): DoorObject | undefined {
    if (!tile || tile.type !== 'Door') return undefined;

    const door = tile.objects.find((object): object is DoorObject => object.category === 'Door');
    if (door) {
        const resolvedDoorType = resolveDoorType(tile, door);
        return resolvedDoorType === door.doorType
            ? door
            : {
                ...door,
                doorType: resolvedDoorType,
            };
    }

    // One level-1 entrance door is still missing explicit door metadata in the
    // extracted dungeon snapshot. Treat it as a regular wooden door instead of
    // letting runtime systems behave as if no door existed.
    return {
        category: 'Door',
        index: -1,
        tilePos: 'North',
        destructChop: false,
        destructFire: false,
        hasButton: false,
        openDirection: resolveFallbackDoorOpenDirection(tile.orientation),
        ornate: 0,
        doorType: FALLBACK_DOOR_TYPE,
    };
}
