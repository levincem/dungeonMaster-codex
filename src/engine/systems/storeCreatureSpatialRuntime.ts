import type { CreatureInstance, GameMap, GameTile } from '../../types/game';
import type { Direction } from '../runtimeTypes';
import {
    isCreatureCellOccupiedOnTile as isCreatureCellOccupiedOnTileSystem,
    normalizeCreatureCells as normalizeCreatureCellsSystem,
    normalizeCreatureCellsOnTile as normalizeCreatureCellsOnTileSystem,
    getTileCapacityForCreatures as getTileCapacityForCreaturesSystem,
} from './creatureTileState';
import { getCreatureTileCapacity as getCreatureTileCapacitySystem } from './generatedCreatureGroups';
import { resolveOriginalArchenemyDoubleMoveDestination } from './originalArchenemyMovement';
import { canCreatureShareRuntimeTile } from './runtimeGroupOccupancy';

type CreatureDefinitionLike = {
    sizeOnTile?: number;
};

type DoorMetadataLike = {
    doorType?: number;
} | null | undefined;

type StoreCreatureSpatialRuntimeParams = {
    creatureTypes: Record<number, CreatureDefinitionLike | undefined>;
    now?: () => number;
    buildRandomToken?: () => string;
    getDoorObject?: (tile: GameTile) => DoorMetadataLike;
    doorBlocksVision?: (doorType: number | undefined) => boolean;
};

export function createStoreCreatureSpatialRuntime(
    params: StoreCreatureSpatialRuntimeParams,
) {
    const now = params.now ?? Date.now;
    const buildRandomToken = params.buildRandomToken ?? (() => Math.random().toString(36).slice(2));
    const getDoorObject = params.getDoorObject ?? ((tile: GameTile) =>
        tile.objects.find((object) => object.category === 'Door') as DoorMetadataLike);
    const doorBlocksVision = params.doorBlocksVision ?? (() => false);

    const getCreatureSizeOnTile = (typeId: number): number =>
        params.creatureTypes[typeId]?.sizeOnTile ?? 0;

    const getCreatureTileCapacity = (typeId: number): number =>
        getCreatureTileCapacitySystem(getCreatureSizeOnTile(typeId));

    const buildRuntimeCreatureGroupId = (
        origin: 'init' | 'generator',
        level: number,
        x: number,
        y: number,
        typeId: number,
    ): string => {
        if (origin === 'init') return `${origin}_${level}_${x}_${y}_${typeId}`;
        return `${origin}_${level}_${x}_${y}_${typeId}_${now()}_${buildRandomToken()}`;
    };

    const getTileCapacityForCreatures = (creatures: CreatureInstance[]): number =>
        getTileCapacityForCreaturesSystem(creatures, getCreatureTileCapacity);

    const normalizeCreatureCellsOnTile = (
        creatures: CreatureInstance[],
        level: number,
        x: number,
        y: number,
    ): CreatureInstance[] =>
        normalizeCreatureCellsOnTileSystem(creatures, level, x, y, getCreatureTileCapacity);

    const normalizeCreatureCells = (creatures: CreatureInstance[]): CreatureInstance[] =>
        normalizeCreatureCellsSystem(creatures, getCreatureTileCapacity);

    const canCreatureShareTile = (
        mover: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ): boolean =>
        canCreatureShareRuntimeTile(
            mover,
            level,
            x,
            y,
            creatures,
            (occupants) => getTileCapacityForCreatures([...occupants]),
        );

    const isCreatureCellOccupiedOnTile = (
        creatures: CreatureInstance[],
        mover: CreatureInstance,
        targetCell: CreatureInstance['cell'],
    ): boolean => isCreatureCellOccupiedOnTileSystem(creatures, mover, targetCell);

    const resolveArchenemyDoubleMoveDestinationOriginal = (
        mover: CreatureInstance,
        level: number,
        x: number,
        y: number,
        direction: Direction,
        creatures: CreatureInstance[],
        monsterWalkable: (level: number, y: number, x: number) => boolean,
    ): { x: number; y: number } | null =>
        resolveOriginalArchenemyDoubleMoveDestination(
            mover,
            level,
            x,
            y,
            direction,
            creatures,
            monsterWalkable,
            canCreatureShareTile,
        );

    const hasLineOfSight = (
        map: GameMap,
        level: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        ax: number,
        ay: number,
        bx: number,
        by: number,
    ): boolean => {
        const dx = bx - ax;
        const dy = by - ay;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        if (steps === 0) return true;

        for (let i = 1; i < steps; i += 1) {
            const cx = Math.round(ax + ((dx * i) / steps));
            const cy = Math.round(ay + ((dy * i) / steps));
            const tile = map.tiles[cy]?.[cx];
            if (!tile || tile.type === 'Wall') return false;
            if (tile.type === 'TrickWall' && !openWalls.has(`${level},${cy},${cx}`)) return false;
            if (tile.type !== 'Door') continue;
            if (openDoors.has(`${level},${cy},${cx}`)) continue;
            if (doorBlocksVision(getDoorObject(tile)?.doorType)) return false;
        }

        return true;
    };

    return {
        buildRuntimeCreatureGroupId,
        canCreatureShareTile,
        getCreatureSizeOnTile,
        hasLineOfSight,
        isCreatureCellOccupiedOnTile,
        normalizeCreatureCells,
        normalizeCreatureCellsOnTile,
        resolveArchenemyDoubleMoveDestinationOriginal,
    };
}
