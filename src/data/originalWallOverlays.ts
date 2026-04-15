import type { CardinalDir, GameMap } from '../types/game';
import { miscPath } from './assetPaths';
import { getOriginalWallOverlayDataSync } from './originalWallOverlayData';

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
    isLocal?: boolean;
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
    interactiveSensorIndices?: number[];
};

type OverlayRuntimeState = {
    activeSensors: Set<string>;
    firedSensors?: Set<string>;
};

let fixedFacesByMap: Map<number, FixedFace[]> | null = null;
let fixedFaceNameKeys: Set<string> | null = null;

function ensureOverlayIndexes(): {
    fixedFacesByMap: Map<number, FixedFace[]>;
    fixedFaceNameKeys: Set<string>;
} {
    if (fixedFacesByMap && fixedFaceNameKeys) {
        return { fixedFacesByMap, fixedFaceNameKeys };
    }

    const data = getOriginalWallOverlayDataSync<OverlayPositionsData>();
    const nextFixedFacesByMap = new Map<number, FixedFace[]>();
    const nextFixedFaceNameKeys = new Set<string>();

    for (const face of data.fixedFaces) {
        const list = nextFixedFacesByMap.get(face.mapIndex) ?? [];
        list.push(face);
        nextFixedFacesByMap.set(face.mapIndex, list);
        for (const variant of face.variants) {
            nextFixedFaceNameKeys.add(`${face.mapIndex}:${face.x}:${face.y}:${face.face}:${variant.overlayName}`);
        }
    }

    fixedFacesByMap = nextFixedFacesByMap;
    fixedFaceNameKeys = nextFixedFaceNameKeys;

    return { fixedFacesByMap, fixedFaceNameKeys };
}

const OMITTED_OVERLAYS = new Set([
    'Champion Mirror',
    'Unreadable Wall Inscription',
]);

function originalOverlayPath(file: string): string {
    return miscPath(`original/${file}`);
}

const VISUALS_BY_NAME: Record<string, OverlayVisual> = {
    'Fountain': { image: miscPath('wall_foutain_overlay.png'), accent: '#78a8d8', width: 0.8, height: 1.06 },
    'Vi Altar': { image: miscPath('autel.png'), accent: '#d5b175', width: 1.0, height: 0.94 },
    'Lever Up': { image: miscPath('levier_haut.png'), accent: '#cda467', width: 0.32, height: 0.84 },
    'Lever Down': { image: miscPath('levier_bas.png'), accent: '#cda467', width: 0.32, height: 0.84 },
    'Iron Lock': { image: miscPath('serrure.png'), accent: '#b0a38b', width: 0.42, height: 0.42 },
    'Double Iron Lock': { image: miscPath('serrure.png'), accent: '#b0a38b', width: 0.42, height: 0.42 },
    'Square Lock': { image: miscPath('serrure.png'), accent: '#b0a38b', width: 0.42, height: 0.42 },
    'Winged Lock': { image: miscPath('serrure.png'), accent: '#d3b669', width: 0.42, height: 0.42 },
    'Onyx Lock': { image: miscPath('serrure.png'), accent: '#8e8c99', width: 0.42, height: 0.42 },
    'Stone Lock': { image: miscPath('serrure.png'), accent: '#a79a87', width: 0.42, height: 0.42 },
    'Cross Lock': { image: miscPath('serrure.png'), accent: '#c2b08d', width: 0.42, height: 0.42 },
    'Topaz Lock': { image: miscPath('serrure.png'), accent: '#d7a84d', width: 0.42, height: 0.42 },
    'Skeleton Lock': { image: miscPath('serrure.png'), accent: '#d8d0b2', width: 0.42, height: 0.42 },
    'Gold Lock': { image: miscPath('serrure.png'), accent: '#d9b43f', width: 0.42, height: 0.42 },
    'Tourquoise Lock': { image: miscPath('serrure.png'), accent: '#56b7be', width: 0.42, height: 0.42 },
    'Emerald Lock': { image: miscPath('serrure.png'), accent: '#48a664', width: 0.42, height: 0.42 },
    'Ruby Lock': { image: miscPath('serrure.png'), accent: '#c45454', width: 0.42, height: 0.42 },
    'Ra Lock': { image: miscPath('serrure.png'), accent: '#e1b862', width: 0.42, height: 0.42 },
    'Master Lock': { image: miscPath('serrure.png'), accent: '#f1d18a', width: 0.42, height: 0.42 },
    'Coin Slot': { image: miscPath('serrure.png'), accent: '#ccb173', width: 0.34, height: 0.34 },
    'Gem Hole': { image: miscPath('serrure.png'), accent: '#5bbad6', width: 0.34, height: 0.34 },
    'Full Torch Holder': { image: originalOverlayPath('full_torch_holder.bmp'), accent: '#d59a54', width: 0.24, height: 0.92 },
    'Empty Torch Holder': { image: miscPath('wall_torch_holder_empty.png'), accent: '#7e6c5c', width: 0.42, height: 0.48 },
    'Square Alcove': { image: miscPath('wall_alcove_square.png'), accent: '#8c7a66', width: 0.72, height: 0.74 },
    'Arched Alcove': { image: miscPath('wall_alcove_arched.png'), accent: '#92785f', width: 0.74, height: 0.86 },
    'Small Switch': { image: miscPath('wall_switch_small.png'), accent: '#bea06e', width: 0.42, height: 0.42 },
    'Tiny Switch': { image: miscPath('wall_switch_tiny.png'), accent: '#bea06e', width: 0.32, height: 0.32 },
    'Big Switch In': { image: miscPath('wall_switch_big_in.png'), accent: '#c18a5c', width: 0.5, height: 0.5 },
    'Big Switch Out': { image: miscPath('wall_switch_big_out.png'), accent: '#c18a5c', width: 0.5, height: 0.5 },
    'Blue Switch In': { image: miscPath('wall_switch_blue_in.png'), accent: '#64a9d9', width: 0.5, height: 0.5 },
    'Blue Switch Out': { image: miscPath('wall_switch_blue_out.png'), accent: '#64a9d9', width: 0.5, height: 0.5 },
    'Green Switch In': { image: miscPath('wall_switch_green_in.png'), accent: '#63b06d', width: 0.5, height: 0.5 },
    'Green Switch Out': { image: miscPath('wall_switch_green_out.png'), accent: '#63b06d', width: 0.5, height: 0.5 },
    'Red Switch In': { image: miscPath('wall_switch_red_in.png'), accent: '#c86161', width: 0.5, height: 0.5 },
    'Red Switch Out': { image: miscPath('wall_switch_red_out.png'), accent: '#c86161', width: 0.5, height: 0.5 },
    'Crack Switch In': { image: miscPath('wall_switch_crack_in.png'), accent: '#9d7d68', width: 0.5, height: 0.5 },
    'Crack Switch Out': { image: miscPath('wall_switch_crack_out.png'), accent: '#9d7d68', width: 0.5, height: 0.5 },
    'Eye Switch': { image: miscPath('wall_switch_eye.png'), accent: '#b87e58', width: 0.48, height: 0.48 },
    'Fireball Holes': { image: miscPath('wall_hazard_fireball_holes.png'), accent: '#bf5b4e', width: 0.68, height: 0.52 },
    'Dagger Holes': { image: miscPath('wall_hazard_dagger_holes.png'), accent: '#9c9aa4', width: 0.68, height: 0.52 },
    'Poison Holes': { image: miscPath('wall_hazard_poison_holes.png'), accent: '#65a96c', width: 0.68, height: 0.52 },
    'Slime Outlet': { image: miscPath('wall_hazard_slime_outlet.png'), accent: '#6ea16a', width: 0.68, height: 0.52 },
    'Amalgam (Encased Gem)': { image: miscPath('wall_amalgam_encased_gem.png'), accent: '#d1bf81', width: 0.78, height: 0.9 },
    'Amalgam (Free Gem)': { image: miscPath('wall_amalgam_free_gem.png'), accent: '#d1bf81', width: 0.78, height: 0.9 },
    'Amalgam (Without Gem)': { image: miscPath('wall_amalgam_without_gem.png'), accent: '#d1bf81', width: 0.78, height: 0.9 },
    'Crack': { image: miscPath('wall_crack.png'), accent: '#8e8f9b', width: 0.56, height: 0.8 },
    'Iron Ring': { image: miscPath('wall_iron_ring.png'), accent: '#a0a0a6', width: 0.42, height: 0.58 },
    'Manacles': { image: miscPath('wall_manacles.png'), accent: '#9c9aa4', width: 0.56, height: 0.66 },
    'Lord Order (Outside)': { image: miscPath('wall_lord_order_outside.png'), accent: '#bf8b54', width: 0.78, height: 1.0 },
};

function getPreferredStateVariants(face: FixedFace): FixedVariant[] {
    const sensorVariants = face.variants.filter(
        (variant) => variant.source === 'fixed-sensor' && variant.sensorType !== undefined,
    );
    const nonLocalVariants = sensorVariants.filter((variant) => variant.isLocal === false);
    return nonLocalVariants.length > 0 ? nonLocalVariants : sensorVariants;
}

function isFaceActive(level: number, face: FixedFace, activeSensors: Set<string>): boolean {
    return getPreferredStateVariants(face).some((variant) =>
        activeSensors.has(`${level}_${variant.objectIndex}`),
    );
}

function getInteractiveSensorIndices(face: FixedFace): number[] {
    const interactiveVariants = face.variants.filter((variant) =>
        variant.source === 'fixed-sensor' &&
        variant.overlayClassification === 'interactive' &&
        (variant.sensorType === 1 || variant.sensorType === 2),
    );
    const preferred = interactiveVariants.filter((variant) => variant.isLocal === false);
    return (preferred.length > 0 ? preferred : interactiveVariants).map((variant) => variant.objectIndex);
}

function chooseOverlayName(
    level: number,
    face: FixedFace,
    runtimeState: OverlayRuntimeState,
): string {
    const names = new Set(face.variants.map(variant => variant.overlayName));
    const active = isFaceActive(level, face, runtimeState.activeSensors);
    const firedSensors = runtimeState.firedSensors ?? new Set<string>();

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
    if (
        names.has('Amalgam (Encased Gem)') &&
        names.has('Amalgam (Free Gem)') &&
        names.has('Amalgam (Without Gem)')
    ) {
        const freeGemVariant = face.variants.find((variant) => variant.overlayName === 'Amalgam (Free Gem)');
        const withoutGemVariant = face.variants.find((variant) => variant.overlayName === 'Amalgam (Without Gem)');
        if (withoutGemVariant && firedSensors.has(`${level}_${withoutGemVariant.objectIndex}`)) {
            return 'Amalgam (Without Gem)';
        }
        if (freeGemVariant && firedSensors.has(`${level}_${freeGemVariant.objectIndex}`)) {
            return 'Amalgam (Free Gem)';
        }
        return 'Amalgam (Encased Gem)';
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
    firedSensors?: Set<string>,
): OriginalWallOverlayRender[] {
    const { fixedFacesByMap } = ensureOverlayIndexes();
    const faces = fixedFacesByMap.get(map.index) ?? [];
    const renders: OriginalWallOverlayRender[] = [];
    const runtimeState: OverlayRuntimeState = { activeSensors, firedSensors };

    for (const face of faces) {
        const overlayName = chooseOverlayName(map.index, face, runtimeState);
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
            interactiveSensorIndices: getInteractiveSensorIndices(face),
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
    const { fixedFaceNameKeys } = ensureOverlayIndexes();
    return fixedFaceNameKeys.has(`${mapIndex}:${x}:${y}:${face}:${overlayName}`);
}
