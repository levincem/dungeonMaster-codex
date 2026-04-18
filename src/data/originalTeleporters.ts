import rawTeleporters from '../assets/runtime/reference/original_teleporters_runtime.json';
import type { CardinalDir } from '../types/game';

type RawTeleporterRuntime = {
    mapIndex: number;
    x: number;
    y: number;
    index: number;
    rotationType: number;
    rotation: CardinalDir;
    destMap: number;
    destX: number;
    destY: number;
};

export type OriginalTeleporterRuntime = RawTeleporterRuntime;

const TELEPORTERS = rawTeleporters as OriginalTeleporterRuntime[];
const TELEPORTER_BY_KEY = new Map<string, OriginalTeleporterRuntime>(
    TELEPORTERS.map((teleporter) => [
        `${teleporter.mapIndex}:${teleporter.x}:${teleporter.y}:${teleporter.index}`,
        teleporter,
    ]),
);

export function getOriginalTeleporterRuntime(
    mapIndex: number,
    x: number,
    y: number,
    index: number,
): OriginalTeleporterRuntime | null {
    return TELEPORTER_BY_KEY.get(`${mapIndex}:${x}:${y}:${index}`) ?? null;
}
