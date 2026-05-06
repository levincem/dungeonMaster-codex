import { getGameMap } from '../../data/mapLoader';

export function buildDefaultOpenDoorsForLevel(level: number): Set<string> {
    const map = getGameMap(level);
    const openDoors = new Set<string>();

    for (const row of map.tiles) {
        for (const tile of row) {
            if (tile.type === 'Door' && tile.state === 'Open') {
                openDoors.add(`${map.index},${tile.y},${tile.x}`);
            }
        }
    }

    return openDoors;
}

export function buildDefaultOpenDoorsForLevels(levels: Iterable<number>): Set<string> {
    const openDoors = new Set<string>();

    for (const level of new Set(levels)) {
        for (const key of buildDefaultOpenDoorsForLevel(level)) {
            openDoors.add(key);
        }
    }

    return openDoors;
}
