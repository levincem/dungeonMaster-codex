import { GRID_SIZE } from '../../engine/constants';
import type { GameMap } from '../../types/game';

export type CavityFace = 'North' | 'South' | 'East' | 'West';

const PIT_INNER_SIZE = GRID_SIZE * 0.82;
const PIT_WALL_THICKNESS = GRID_SIZE * 0.08;

export function buildInstancedTileLayout(
    map: GameMap,
    openPits: Set<string>,
    deps: {
        isMirrorWall: (level: number, x: number, y: number) => boolean;
        getSelfRevealingWallFace: (level: number, x: number, y: number) => CavityFace | null;
        isSelfRevealingWallTile: (level: number, x: number, y: number) => boolean;
    },
) {
    const floorPositions: [number, number][] = [];
    const ceilPositions: [number, number][] = [];
    const wallEntries: [number, number, string][] = [];
    const cavityEntries: [number, number, string, CavityFace][] = [];
    const pitPositions: [number, number][] = [];
    const pitWallEntries: [number, number, number, number][] = [];

    for (const row of map.tiles) {
        for (const tile of row) {
            const wx = tile.x * GRID_SIZE;
            const wz = tile.y * GRID_SIZE;
            ceilPositions.push([wx, wz]);
            if (tile.type === 'Wall') {
                if (!deps.isMirrorWall(map.index, tile.x, tile.y)) {
                    const selfRevealFace = deps.getSelfRevealingWallFace(map.index, tile.x, tile.y);
                    if (selfRevealFace) {
                        floorPositions.push([wx, wz]);
                        cavityEntries.push([wx, wz, `${map.index},${tile.y},${tile.x}`, selfRevealFace]);
                    }
                    wallEntries.push([
                        wx,
                        wz,
                        deps.isSelfRevealingWallTile(map.index, tile.x, tile.y) ? `${map.index},${tile.y},${tile.x}` : '',
                    ]);
                }
            } else if (tile.type === 'TrickWall') {
                // Opened trick walls become normal walkable cells, so keep a floor plane under them.
                floorPositions.push([wx, wz]);
                wallEntries.push([wx, wz, `${map.index},${tile.y},${tile.x}`]);
            } else if (tile.type === 'Pit' && openPits.has(`${map.index},${tile.y},${tile.x}`)) {
                pitPositions.push([wx, wz]);
                pitWallEntries.push(
                    [wx, wz - (PIT_INNER_SIZE / 2), GRID_SIZE * 0.78, PIT_WALL_THICKNESS],
                    [wx, wz + (PIT_INNER_SIZE / 2), GRID_SIZE * 0.78, PIT_WALL_THICKNESS],
                    [wx - (PIT_INNER_SIZE / 2), wz, PIT_WALL_THICKNESS, GRID_SIZE * 0.78],
                    [wx + (PIT_INNER_SIZE / 2), wz, PIT_WALL_THICKNESS, GRID_SIZE * 0.78],
                );
            } else {
                floorPositions.push([wx, wz]);
            }
        }
    }

    return { floorPositions, ceilPositions, wallEntries, cavityEntries, pitPositions, pitWallEntries };
}
