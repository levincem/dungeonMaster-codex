import { getGameMap } from '../../data/mapLoader';
import type { CardinalDir, GameMap, SensorObject } from '../../types/game';

type MapResolver = (level: number) => GameMap;

export function getWallSensorRotationKey(level: number, x: number, y: number, face: CardinalDir): string {
    return `${level}_${x}_${y}_${face}`;
}

export function getWallFaceSensorsInRuntimeOrder(
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
    rotationOffsets: Record<string, number>,
    mapResolver: MapResolver = getGameMap,
): SensorObject[] {
    const tile = mapResolver(level).tiles[y]?.[x];
    if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return [];
    const sensors = tile.objects.filter(
        (obj): obj is SensorObject => obj.category === 'Sensor' && obj.tilePos === face,
    );
    if (sensors.length <= 1) return sensors;

    const offsetRaw = rotationOffsets[getWallSensorRotationKey(level, x, y, face)] ?? 0;
    const offset = ((offsetRaw % sensors.length) + sensors.length) % sensors.length;
    if (offset === 0) return sensors;
    return [...sensors.slice(offset), ...sensors.slice(0, offset)];
}

export function rotateWallFaceSensors(
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
    rotationOffsets: Record<string, number>,
    mapResolver: MapResolver = getGameMap,
): Record<string, number> {
    const sensors = getWallFaceSensorsInRuntimeOrder(level, x, y, face, {}, mapResolver);
    if (sensors.length <= 1) return rotationOffsets;

    const key = getWallSensorRotationKey(level, x, y, face);
    const nextOffset = ((rotationOffsets[key] ?? 0) + 1) % sensors.length;
    if (nextOffset === 0) {
        if (!(key in rotationOffsets)) return rotationOffsets;
        const next = { ...rotationOffsets };
        delete next[key];
        return next;
    }
    return {
        ...rotationOffsets,
        [key]: nextOffset,
    };
}

export function hasWallFaceLocalRotationEffect(sensor: SensorObject): boolean {
    return sensor.isLocal && (sensor.multipleValue === 1 || sensor.multipleValue === 2);
}

export function shouldRotateWallFaceAfterActivation(
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
    rotationOffsets: Record<string, number>,
    mapResolver: MapResolver = getGameMap,
): boolean {
    return getWallFaceSensorsInRuntimeOrder(level, x, y, face, rotationOffsets, mapResolver)
        .some(hasWallFaceLocalRotationEffect);
}
