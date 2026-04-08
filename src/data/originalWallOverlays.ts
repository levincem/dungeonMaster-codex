import overlayPositions from '../assets/original_wall_overlay_positions.json';
import type { CardinalDir, GameMap } from '../types/game';

type OverlayClassification = 'interactive' | 'stateful' | 'hazard' | 'decorative' | 'unclear';

type FixedVariant = {
    mapIndex: number;
    x: number;
    y: number;
    face: CardinalDir;
    source: 'fixed-sensor' | 'fixed-text';
    objectIndex: number;
    overlayName: string;
    overlayIndex: number | null;
    overlayClassification: OverlayClassification;
    sensorType?: number;
};

type FixedFace = {
    mapIndex: number;
    x: number;
    y: number;
    face: CardinalDir;
    stateful: boolean;
    primaryOverlayName: string;
    primaryOverlayIndex: number | null;
    primaryOverlayClassification: OverlayClassification;
    variants: FixedVariant[];
};

type OverlayPositionsData = {
    fixedFaces: FixedFace[];
};

type OverlayVisual = {
    image?: string;
    label?: string;
    accent: string;
    width?: number;
    height?: number;
};

export type OriginalWallOverlayRender = {
    tileX: number;
    tileY: number;
    face: CardinalDir;
    image?: string;
    label?: string;
    accent?: string;
    width?: number;
    height?: number;
};

const data = overlayPositions as OverlayPositionsData;

const FIXED_FACES_BY_MAP = new Map<number, FixedFace[]>();
const FIXED_FACE_NAME_KEYS = new Set<string>();
for (const face of data.fixedFaces) {
    const list = FIXED_FACES_BY_MAP.get(face.mapIndex) ?? [];
    list.push(face);
    FIXED_FACES_BY_MAP.set(face.mapIndex, list);
    for (const variant of face.variants) {
        FIXED_FACE_NAME_KEYS.add(`${face.mapIndex}:${face.x}:${face.y}:${face.face}:${variant.overlayName}`);
    }
}

const OMITTED_OVERLAYS = new Set([
    'Champion Mirror',
    'Unreadable Wall Inscription',
]);

const VISUALS_BY_NAME: Record<string, OverlayVisual> = {
    'Fountain': { image: '/misc/wall_foutain_overlay.png', accent: '#78a8d8', width: 0.8, height: 1.06 },
    'Vi Altar': { image: '/misc/autel.png', accent: '#d5b175', width: 0.74, height: 0.74 },
    'Lever Up': { image: '/misc/levier_haut.png', accent: '#cda467', width: 0.32, height: 0.84 },
    'Lever Down': { image: '/misc/levier_bas.png', accent: '#cda467', width: 0.32, height: 0.84 },
    'Iron Lock': { image: '/misc/serrure.png', accent: '#b0a38b', width: 0.42, height: 0.42 },
    'Double Iron Lock': { image: '/misc/serrure.png', accent: '#b0a38b', width: 0.42, height: 0.42 },
    'Square Lock': { image: '/misc/serrure.png', accent: '#b0a38b', width: 0.42, height: 0.42 },
    'Winged Lock': { image: '/misc/serrure.png', accent: '#d3b669', width: 0.42, height: 0.42 },
    'Onyx Lock': { image: '/misc/serrure.png', accent: '#8e8c99', width: 0.42, height: 0.42 },
    'Stone Lock': { image: '/misc/serrure.png', accent: '#a79a87', width: 0.42, height: 0.42 },
    'Cross Lock': { image: '/misc/serrure.png', accent: '#c2b08d', width: 0.42, height: 0.42 },
    'Topaz Lock': { image: '/misc/serrure.png', accent: '#d7a84d', width: 0.42, height: 0.42 },
    'Skeleton Lock': { image: '/misc/serrure.png', accent: '#d8d0b2', width: 0.42, height: 0.42 },
    'Gold Lock': { image: '/misc/serrure.png', accent: '#d9b43f', width: 0.42, height: 0.42 },
    'Tourquoise Lock': { image: '/misc/serrure.png', accent: '#56b7be', width: 0.42, height: 0.42 },
    'Emerald Lock': { image: '/misc/serrure.png', accent: '#48a664', width: 0.42, height: 0.42 },
    'Ruby Lock': { image: '/misc/serrure.png', accent: '#c45454', width: 0.42, height: 0.42 },
    'Ra Lock': { image: '/misc/serrure.png', accent: '#e1b862', width: 0.42, height: 0.42 },
    'Master Lock': { image: '/misc/serrure.png', accent: '#f1d18a', width: 0.42, height: 0.42 },
    'Coin Slot': { image: '/misc/serrure.png', accent: '#ccb173', width: 0.34, height: 0.34 },
    'Gem Hole': { image: '/misc/serrure.png', accent: '#5bbad6', width: 0.34, height: 0.34 },
    'Full Torch Holder': { image: '/items/torch_unlit.png', accent: '#d59a54', width: 0.24, height: 0.92 },
    'Empty Torch Holder': { image: '/misc/wall_torch_holder_empty.png', accent: '#7e6c5c', width: 0.42, height: 0.48 },
    'Square Alcove': { image: '/misc/wall_alcove_square.png', accent: '#8c7a66', width: 0.72, height: 0.74 },
    'Arched Alcove': { image: '/misc/wall_alcove_arched.png', accent: '#92785f', width: 0.74, height: 0.86 },
    'Small Switch': { image: '/misc/wall_switch_small.png', accent: '#bea06e', width: 0.42, height: 0.42 },
    'Tiny Switch': { image: '/misc/wall_switch_tiny.png', accent: '#bea06e', width: 0.32, height: 0.32 },
    'Big Switch In': { image: '/misc/wall_switch_big_in.png', accent: '#c18a5c', width: 0.5, height: 0.5 },
    'Big Switch Out': { image: '/misc/wall_switch_big_out.png', accent: '#c18a5c', width: 0.5, height: 0.5 },
    'Blue Switch In': { image: '/misc/wall_switch_blue_in.png', accent: '#64a9d9', width: 0.5, height: 0.5 },
    'Blue Switch Out': { image: '/misc/wall_switch_blue_out.png', accent: '#64a9d9', width: 0.5, height: 0.5 },
    'Green Switch In': { image: '/misc/wall_switch_green_in.png', accent: '#63b06d', width: 0.5, height: 0.5 },
    'Green Switch Out': { image: '/misc/wall_switch_green_out.png', accent: '#63b06d', width: 0.5, height: 0.5 },
    'Red Switch In': { image: '/misc/wall_switch_red_in.png', accent: '#c86161', width: 0.5, height: 0.5 },
    'Red Switch Out': { image: '/misc/wall_switch_red_out.png', accent: '#c86161', width: 0.5, height: 0.5 },
    'Crack Switch In': { image: '/misc/wall_switch_crack_in.png', accent: '#9d7d68', width: 0.5, height: 0.5 },
    'Crack Switch Out': { image: '/misc/wall_switch_crack_out.png', accent: '#9d7d68', width: 0.5, height: 0.5 },
    'Eye Switch': { image: '/misc/wall_switch_eye.png', accent: '#b87e58', width: 0.48, height: 0.48 },
    'Fireball Holes': { image: '/misc/wall_hazard_fireball_holes.png', accent: '#bf5b4e', width: 0.68, height: 0.52 },
    'Dagger Holes': { image: '/misc/wall_hazard_dagger_holes.png', accent: '#9c9aa4', width: 0.68, height: 0.52 },
    'Poison Holes': { image: '/misc/wall_hazard_poison_holes.png', accent: '#65a96c', width: 0.68, height: 0.52 },
    'Slime Outlet': { image: '/misc/wall_hazard_slime_outlet.png', accent: '#6ea16a', width: 0.68, height: 0.52 },
    'Amalgam (Encased Gem)': { image: '/misc/wall_amalgam_encased_gem.png', accent: '#d1bf81', width: 0.78, height: 0.9 },
    'Amalgam (Free Gem)': { image: '/misc/wall_amalgam_free_gem.png', accent: '#d1bf81', width: 0.78, height: 0.9 },
    'Amalgam (Without Gem)': { image: '/misc/wall_amalgam_without_gem.png', accent: '#d1bf81', width: 0.78, height: 0.9 },
    'Crack': { image: '/misc/wall_crack.png', accent: '#8e8f9b', width: 0.56, height: 0.8 },
    'Iron Ring': { image: '/misc/wall_iron_ring.png', accent: '#a0a0a6', width: 0.42, height: 0.58 },
    'Manacles': { image: '/misc/wall_manacles.png', accent: '#9c9aa4', width: 0.56, height: 0.66 },
    'Lord Order (Outside)': { image: '/misc/wall_lord_order_outside.png', accent: '#bf8b54', width: 0.78, height: 1.0 },
};

function isFaceActive(level: number, face: FixedFace, activeSensors: Set<string>): boolean {
    return face.variants.some(variant =>
        variant.source === 'fixed-sensor' &&
        variant.sensorType !== undefined &&
        activeSensors.has(`${level}_${variant.objectIndex}`),
    );
}

function chooseOverlayName(level: number, face: FixedFace, activeSensors: Set<string>): string {
    const names = new Set(face.variants.map(variant => variant.overlayName));
    const active = isFaceActive(level, face, activeSensors);

    if (names.has('Lever Up') && names.has('Lever Down')) {
        return active ? 'Lever Down' : 'Lever Up';
    }
    if (names.has('Big Switch In') && names.has('Big Switch Out')) {
        return active ? 'Big Switch In' : 'Big Switch Out';
    }
    if (names.has('Blue Switch In') && names.has('Blue Switch Out')) {
        return active ? 'Blue Switch In' : 'Blue Switch Out';
    }
    if (names.has('Green Switch In') && names.has('Green Switch Out')) {
        return active ? 'Green Switch In' : 'Green Switch Out';
    }
    if (names.has('Red Switch In') && names.has('Red Switch Out')) {
        return active ? 'Red Switch In' : 'Red Switch Out';
    }
    if (names.has('Crack Switch In') && names.has('Crack Switch Out')) {
        return active ? 'Crack Switch In' : 'Crack Switch Out';
    }
    if (names.has('Empty Torch Holder') && names.has('Full Torch Holder')) {
        return active ? 'Full Torch Holder' : 'Empty Torch Holder';
    }
    return face.primaryOverlayName;
}

function buildLabel(name: string): string {
    return name
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\bWall\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getVisual(name: string, classification: OverlayClassification): OverlayVisual {
    const mapped = VISUALS_BY_NAME[name];
    if (mapped) return mapped;
    const accentByClassification: Record<OverlayClassification, string> = {
        interactive: '#c5a46a',
        stateful: '#d09058',
        hazard: '#bf5b4e',
        decorative: '#8e8f9b',
        unclear: '#7d8791',
    };
    return {
        label: buildLabel(name),
        accent: accentByClassification[classification],
        width: 0.54,
        height: 0.44,
    };
}

export function getOriginalWallOverlaysForMap(
    map: GameMap,
    activeSensors: Set<string>,
): OriginalWallOverlayRender[] {
    const faces = FIXED_FACES_BY_MAP.get(map.index) ?? [];
    const renders: OriginalWallOverlayRender[] = [];

    for (const face of faces) {
        const overlayName = chooseOverlayName(map.index, face, activeSensors);
        if (OMITTED_OVERLAYS.has(overlayName)) continue;

        const variant = face.variants.find(entry => entry.overlayName === overlayName) ?? face.variants[0];
        if (!variant) continue;

        const visual = getVisual(overlayName, variant.overlayClassification);
        renders.push({
            tileX: face.x,
            tileY: face.y,
            face: face.face,
            image: visual.image,
            label: visual.label,
            accent: visual.accent,
            width: visual.width,
            height: visual.height,
        });
    }

    return renders;
}

export function hasOriginalWallOverlayAt(
    mapIndex: number,
    x: number,
    y: number,
    face: CardinalDir,
    overlayName: string,
): boolean {
    return FIXED_FACE_NAME_KEYS.has(`${mapIndex}:${x}:${y}:${face}:${overlayName}`);
}
