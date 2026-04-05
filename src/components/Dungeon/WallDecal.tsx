import { Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import type { CardinalDir } from '../../types/game';

// ─── Face positioning (same convention as WallSensor / Cell FACE_CONFIGS) ─────

const HALF = GRID_SIZE / 2;
// Slightly in front of the wall so the decal stays visible up close and at angle.
const FACE_OFFSET = HALF + 0.028;
const PLATE_DEPTH = GRID_SIZE * 0.022;
const PLATE_INSET_X = GRID_SIZE * 0.06;
const PLATE_INSET_Y = WALL_HEIGHT * 0.08;

const FACE_POS: Record<CardinalDir, [number, number, number]> = {
    North: [0, 0, -FACE_OFFSET],
    South: [0, 0,  FACE_OFFSET],
    East:  [ FACE_OFFSET, 0, 0],
    West:  [-FACE_OFFSET, 0, 0],
};
const FACE_ROT: Record<CardinalDir, [number, number, number]> = {
    North: [0, 0,            0],
    South: [0, Math.PI,      0],
    East:  [0, -Math.PI / 2, 0],
    West:  [0,  Math.PI / 2, 0],
};

type DecalPreset = {
    width: number;
    height: number;
    y: number;
    hasBacking: boolean;
    hasGlow: boolean;
};

const DEFAULT_PRESET: DecalPreset = {
    width: GRID_SIZE,
    height: WALL_HEIGHT,
    y: 0,
    hasBacking: false,
    hasGlow: false,
};

const DECAL_PRESETS: Record<string, DecalPreset> = {
    '/misc/serrure.png': {
        width: GRID_SIZE * 0.38,
        height: WALL_HEIGHT * 0.38,
        y: -WALL_HEIGHT * 0.02,
        hasBacking: false,
        hasGlow: true,
    },
    '/misc/levier_haut.png': {
        width: GRID_SIZE * 0.28,
        height: WALL_HEIGHT * 0.46,
        y: 0,
        hasBacking: true,
        hasGlow: true,
    },
    '/misc/autel.png': {
        width: GRID_SIZE * 0.56,
        height: WALL_HEIGHT * 0.42,
        y: -WALL_HEIGHT * 0.03,
        hasBacking: true,
        hasGlow: true,
    },
};

// ─── Inner sprite (loads texture) ─────────────────────────────────────────────

const DecalSprite = ({ image, width, height }: { image: string; width: number; height: number }) => {
    const tex = useTexture(image);
    tex.colorSpace = THREE.SRGBColorSpace;
    return (
        <mesh frustumCulled={false} renderOrder={4}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
                map={tex}
                transparent
                alphaTest={0.05}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
                polygonOffset={true}
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
            />
        </mesh>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    tileX: number;
    tileY: number;
    face: CardinalDir;
    image: string;
    /** Width of the decal plane — defaults to full GRID_SIZE */
    width?: number;
    /** Height of the decal plane — defaults to full WALL_HEIGHT */
    height?: number;
}

export const WallDecal = ({
    tileX, tileY, face, image,
    width,
    height,
}: Props) => {
    const [ox, , oz] = FACE_POS[face];
    const [rx, ry, rz] = FACE_ROT[face];
    const preset = DECAL_PRESETS[image] ?? DEFAULT_PRESET;
    const decalWidth = width ?? preset.width;
    const decalHeight = height ?? preset.height;
    const plateWidth = Math.max(decalWidth - PLATE_INSET_X, decalWidth * 0.86);
    const plateHeight = Math.max(decalHeight - PLATE_INSET_Y, decalHeight * 0.84);

    return (
        <group
            position={[tileX * GRID_SIZE + ox, preset.y, tileY * GRID_SIZE + oz]}
            rotation={[rx, ry, rz]}
            frustumCulled={false}
        >
            {preset.hasBacking && (
                <>
                    <mesh position={[0, 0, -PLATE_DEPTH * 0.55]} frustumCulled={false} renderOrder={1}>
                        <boxGeometry args={[plateWidth, plateHeight, PLATE_DEPTH]} />
                        <meshBasicMaterial color="#3a2b1d" />
                    </mesh>
                </>
            )}
            {preset.hasGlow && (
                <mesh position={[0, 0, -PLATE_DEPTH * 0.04]} frustumCulled={false} renderOrder={2}>
                    <planeGeometry args={[decalWidth * 1.1, decalHeight * 1.1]} />
                    <meshBasicMaterial
                        color="#c5a46a"
                        transparent
                        opacity={0.12}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
            )}
            <group position={[0, 0, PLATE_DEPTH * 0.16]}>
                <Suspense fallback={null}>
                    <DecalSprite image={image} width={decalWidth} height={decalHeight} />
                </Suspense>
            </group>
        </group>
    );
};
