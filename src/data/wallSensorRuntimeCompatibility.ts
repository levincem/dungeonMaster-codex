import type { CardinalDir, SensorObject } from '../types/game';

type WallSensorRequirementOverride = {
    mapIndex: number;
    x: number;
    y: number;
    face: CardinalDir;
    sensorIndex: number;
    requiredObjectName: string;
};

const WALL_SENSOR_REQUIREMENT_OVERRIDES: readonly WallSensorRequirementOverride[] = [
    {
        mapIndex: 10,
        x: 21,
        y: 24,
        face: 'West',
        sensorIndex: 144,
        requiredObjectName: 'Magnifier',
    },
] as const;

export function getWallSensorRequiredItemOverride(
    mapIndex: number,
    tileX: number,
    tileY: number,
    face: CardinalDir,
    sensor: SensorObject,
): string | undefined {
    const requirementOverride = WALL_SENSOR_REQUIREMENT_OVERRIDES.find((entry) =>
        entry.mapIndex === mapIndex
        && entry.x === tileX
        && entry.y === tileY
        && entry.face === face
        && entry.sensorIndex === sensor.index,
    );
    if (!requirementOverride || sensor.requiredObjectName) {
        return undefined;
    }

    return requirementOverride.requiredObjectName;
}
