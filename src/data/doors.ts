import rawDoorsText from '../assets/data/original_doors_runtime.json?raw';

export interface OriginalDoorDefinition {
    id: number;
    name: string;
    animated: boolean;
    thrownItemsCanPassThrough: boolean;
    creaturesCanSeeThrough: boolean;
    resistance: number;
}

interface OriginalDoorsPayload {
    doors: OriginalDoorDefinition[];
}

const payload = JSON.parse(rawDoorsText) as OriginalDoorsPayload;

export const ORIGINAL_DOOR_DEFS = payload.doors.reduce<Record<number, OriginalDoorDefinition>>((acc, door) => {
    acc[door.id] = door;
    return acc;
}, {});

export function getDoorDefinition(doorType: number | undefined): OriginalDoorDefinition | undefined {
    if (doorType === undefined) return undefined;
    return ORIGINAL_DOOR_DEFS[doorType];
}

export function doorBlocksVision(doorType: number | undefined): boolean {
    return !getDoorDefinition(doorType)?.creaturesCanSeeThrough;
}

export function doorBlocksThrownItems(doorType: number | undefined): boolean {
    return !getDoorDefinition(doorType)?.thrownItemsCanPassThrough;
}

export function getDoorTexturePath(doorType: number | undefined): string {
    switch (doorType) {
        case 0:
            return '/misc/grille_metal.png';
        default:
            return '/textures/door.png';
    }
}
