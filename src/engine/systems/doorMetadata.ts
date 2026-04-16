import type { DoorObject, GameTile } from '../../types/game';

const FALLBACK_DOOR_TYPE = 1;

function resolveFallbackDoorOpenDirection(
    orientation: GameTile['orientation'],
): DoorObject['openDirection'] {
    return orientation === 'WestEast' || orientation === 'EastWest' ? 'Horizontal' : 'Vertical';
}

export function getDoorObject(tile: GameTile | undefined): DoorObject | undefined {
    if (!tile || tile.type !== 'Door') return undefined;

    const door = tile.objects.find((object): object is DoorObject => object.category === 'Door');
    if (door) return door;

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
