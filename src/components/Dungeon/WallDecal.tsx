import { useEffect, useMemo, useState } from 'react';
import type {} from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import type { CardinalDir } from '../../types/game';
import { miscPath } from '../../data/assetPaths';
import {
    getWallDecalPresetForImage,
    resolveWallDecalScatterOffset,
    type WallDecalPreset,
} from '../../data/wallDecalPresets';
import { useWallTransparencyState } from './wallTransparency';
const NO_RAYCAST: THREE.Mesh['raycast'] = () => {};

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

const DEFAULT_PRESET: WallDecalPreset = {
    width: GRID_SIZE,
    height: WALL_HEIGHT,
    y: 0,
    hasBacking: false,
    hasGlow: false,
    plateColor: '#3a2b1d',
    faceInset: 0,
};

const LEVER_UP_IMAGE = miscPath('levier_haut.png');
const LEVER_DOWN_IMAGE = miscPath('levier_bas.png');

// ─── Inner sprite (loads texture) ─────────────────────────────────────────────

function useSafeTexture(url: string, fallbackUrl?: string): THREE.Texture | null {
    const [textureEntry, setTextureEntry] = useState<{ source: string; texture: THREE.Texture | null }>({
        source: '',
        texture: null,
    });

    useEffect(() => {
        let disposed = false;
        let activeTexture: THREE.Texture | null = null;
        const loader = new THREE.TextureLoader();

        const finalizeTexture = (next: THREE.Texture) => {
            next.colorSpace = THREE.SRGBColorSpace;
            next.needsUpdate = true;
            if (disposed) {
                next.dispose();
                return;
            }
            activeTexture?.dispose();
            activeTexture = next;
            setTextureEntry({ source: url, texture: next });
        };

        const load = (source: string, fallback?: string) => {
            loader.load(
                source,
                (loaded) => finalizeTexture(loaded),
                undefined,
                () => {
                    if (fallback && fallback !== source) {
                        load(fallback);
                    } else if (!disposed) {
                        setTextureEntry({ source: url, texture: null });
                    }
                },
            );
        };

        load(url, fallbackUrl);

        return () => {
            disposed = true;
            activeTexture?.dispose();
        };
    }, [url, fallbackUrl]);

    return textureEntry.source === url ? textureEntry.texture : null;
}

const DecalSprite = ({
    image,
    fallbackImage,
    width,
    height,
    opacity,
}: {
    image: string;
    fallbackImage?: string;
    width: number;
    height: number;
    opacity: number;
}) => {
    const tex = useSafeTexture(image, fallbackImage);
    if (!tex) return null;

    return (
        <mesh frustumCulled={false} renderOrder={10} raycast={NO_RAYCAST}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
                map={tex}
                transparent
                opacity={opacity}
                alphaTest={0.05}
                side={THREE.DoubleSide}
                depthWrite={false}
                depthTest={true}
                polygonOffset
                polygonOffsetFactor={-4}
                polygonOffsetUnits={-4}
                toneMapped={false}
            />
        </mesh>
    );
};

const makeLabelTexture = (label: string, accent: string): THREE.CanvasTexture => {
    const width = 512;
    const height = 320;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create label texture for wall decal.');

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(20, 17, 15, 0.92)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, width - 36, height - 36);

    ctx.strokeStyle = 'rgba(255, 242, 220, 0.18)';
    ctx.lineWidth = 3;
    ctx.strokeRect(34, 34, width - 68, height - 68);

    const words = label.toUpperCase().split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > 14 && current) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    }
    if (current) lines.push(current);

    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 42px Georgia, serif';
    const lineHeight = 52;
    const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, startY + index * lineHeight);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
};

const LabelSprite = ({
    label,
    accent,
    width,
    height,
    opacity,
}: {
    label: string;
    accent: string;
    width: number;
    height: number;
    opacity: number;
}) => {
    const texture = useMemo(() => makeLabelTexture(label, accent), [label, accent]);
    useEffect(() => () => texture.dispose(), [texture]);

    return (
        <mesh frustumCulled={false} renderOrder={10} raycast={NO_RAYCAST}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
                map={texture}
                transparent
                opacity={opacity}
                alphaTest={0.05}
                side={THREE.DoubleSide}
                depthWrite={false}
                depthTest={true}
                polygonOffset
                polygonOffsetFactor={-4}
                polygonOffsetUnits={-4}
                toneMapped={false}
            />
        </mesh>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    tileX: number;
    tileY: number;
    face: CardinalDir;
    image?: string;
    label?: string;
    accent?: string;
    /** Width of the decal plane — defaults to full GRID_SIZE */
    width?: number;
    /** Height of the decal plane — defaults to full WALL_HEIGHT */
    height?: number;
    onClick?: () => void;
}

export const WallDecal = ({
    tileX, tileY, face, image,
    label,
    accent = '#c5a46a',
    width,
    height,
    onClick,
}: Props) => {
    const { wallTransparent, wallOpacity } = useWallTransparencyState();
    if (!image && !label) return null;

    const [ox, , oz] = FACE_POS[face];
    const [rx, ry, rz] = FACE_ROT[face];
    const preset = image
        ? (getWallDecalPresetForImage(image) ?? DEFAULT_PRESET)
        : {
            ...DEFAULT_PRESET,
            hasBacking: true,
            hasGlow: true,
            width: GRID_SIZE * 0.54,
            height: WALL_HEIGHT * 0.28,
            y: -WALL_HEIGHT * 0.04,
            plateColor: '#1f1a15',
        };
    const faceInset = preset.faceInset ?? 0;
    const faceX = ox !== 0 ? ox - Math.sign(ox) * faceInset : ox;
    const faceZ = oz !== 0 ? oz - Math.sign(oz) * faceInset : oz;
    const decalWidth = width ?? preset.width;
    const decalHeight = height ?? preset.height;
    const plateWidth = Math.max(decalWidth - PLATE_INSET_X, decalWidth * 0.86);
    const plateHeight = Math.max(decalHeight - PLATE_INSET_Y, decalHeight * 0.84);
    const contentDepth = preset.contentDepth ?? (
        image === LEVER_UP_IMAGE || image === LEVER_DOWN_IMAGE
            ? PLATE_DEPTH * 0.34
            : image === miscPath('wall_torch_holder_empty.png')
                ? PLATE_DEPTH * 0.02
                : PLATE_DEPTH * 0.16
    );
    const scatterOffset = resolveWallDecalScatterOffset(image, tileX, tileY, face);
    const fallbackImage =
        image === LEVER_UP_IMAGE
            ? LEVER_DOWN_IMAGE
            : image === LEVER_DOWN_IMAGE
                ? LEVER_UP_IMAGE
                : undefined;

    return (
        <group
            position={[tileX * GRID_SIZE + faceX, preset.y + scatterOffset.y, tileY * GRID_SIZE + faceZ]}
            rotation={[rx, ry, rz]}
            frustumCulled={false}
            onClick={onClick ? (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onClick();
            } : undefined}
        >
            <group position={[scatterOffset.x, 0, 0]}>
                {onClick && (
                    <mesh position={[0, 0, contentDepth + 0.002]} frustumCulled={false}>
                        <planeGeometry args={[Math.max(decalWidth, GRID_SIZE * 0.42), Math.max(decalHeight, WALL_HEIGHT * 0.32)]} />
                        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
                    </mesh>
                )}
                {preset.hasBacking && (
                    <>
                        <mesh position={[0, 0, -PLATE_DEPTH * 0.55]} frustumCulled={false} renderOrder={1} raycast={NO_RAYCAST}>
                            <boxGeometry args={[plateWidth, plateHeight, PLATE_DEPTH]} />
                            <meshBasicMaterial
                                color={preset.plateColor}
                                transparent={wallTransparent}
                                opacity={wallOpacity}
                                depthWrite={!wallTransparent}
                            />
                        </mesh>
                    </>
                )}
                {preset.hasGlow && (
                    <mesh position={[0, 0, -PLATE_DEPTH * 0.04]} frustumCulled={false} renderOrder={2} raycast={NO_RAYCAST}>
                        <planeGeometry args={[decalWidth * 1.1, decalHeight * 1.1]} />
                        <meshBasicMaterial
                            color={accent}
                            transparent
                            opacity={0.12 * wallOpacity}
                            side={THREE.DoubleSide}
                            depthWrite={!wallTransparent}
                            depthTest={true}
                            polygonOffset
                            polygonOffsetFactor={-2}
                            polygonOffsetUnits={-2}
                            toneMapped={false}
                        />
                    </mesh>
                )}
                <group position={[0, 0, contentDepth]}>
                    {image ? (
                        <DecalSprite
                            image={image}
                            fallbackImage={fallbackImage}
                            width={decalWidth}
                            height={decalHeight}
                            opacity={wallOpacity}
                        />
                    ) : label ? (
                        <LabelSprite
                            label={label}
                            accent={accent}
                            width={decalWidth}
                            height={decalHeight}
                            opacity={wallOpacity}
                        />
                    ) : null}
                </group>
            </group>
        </group>
    );
};
