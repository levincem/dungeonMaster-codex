import React, { useMemo, useRef, useEffect, Suspense, useState } from 'react';
import { Box, Plane, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PhotonsRaDoorCurtain } from './PhotonsFireball';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import { subscribePlateActivated } from '../../engine/store';
import type { ThreeEvent } from '@react-three/fiber';
import type { Champion } from '../../data/champions';
import type { CardinalDir } from '../../types/game';
import { getDoorTexturePath } from '../../data/doors';
import { miscPath, texturesPath } from '../../data/assetPaths';

// ─── Tile render type ─────────────────────────────────────────────────────────

export type CellRenderType =
    | 'Wall'
    | 'Floor'
    | 'Mirror'
    | 'Door'
    | 'StairsDown'
    | 'StairsUp';

// ─── Portrait UV helper ───────────────────────────────────────────────────────

const CLASS_COLORS: Record<string, string> = {
    Fighter: '#c0392b',
    Ninja:   '#27ae60',
    Wizard:  '#8e44ad',
    Priest:  '#2980b9',
};


// ─── Portrait components ──────────────────────────────────────────────────────

// Face configs: position + rotation so the portrait faces INTO the room
const HALF_LOCAL = GRID_SIZE / 2;
const FACE_OFFSET = HALF_LOCAL + 0.025;
type FaceConfig = { pos: [number,number,number]; rot: [number,number,number] };
const FACE_CONFIGS: Record<CardinalDir, FaceConfig> = {
    North: { pos: [0, 0, -FACE_OFFSET], rot: [0, 0,            0] }, // player looks south (+Z)
    South: { pos: [0, 0,  FACE_OFFSET], rot: [0, Math.PI,      0] }, // player looks north (-Z)
    East:  { pos: [ FACE_OFFSET, 0, 0], rot: [0, -Math.PI / 2, 0] }, // player looks west (-X)
    West:  { pos: [-FACE_OFFSET, 0, 0], rot: [0,  Math.PI / 2, 0] }, // player looks east (+X)
};

// Portrait + frame dimensions
const PORTRAIT_W = GRID_SIZE  * 0.62;
const PORTRAIT_H = WALL_HEIGHT * 0.62;
const FRAME_W    = PORTRAIT_W + GRID_SIZE  * 0.10;
const FRAME_H    = PORTRAIT_H + WALL_HEIGHT * 0.10;
const FRAME_BORDER = GRID_SIZE * 0.05; // thickness of visible border

function makeFrameTex(): THREE.CanvasTexture {
    const S = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    // Outer fill — dark stone backing
    ctx.fillStyle = '#1a1510';
    ctx.fillRect(0, 0, S, S);

    const b = Math.round(S * (FRAME_BORDER / FRAME_W)); // border px

    // Frame body — warm wood gradient
    const grad = ctx.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0,   '#6b3c1a');
    grad.addColorStop(0.3, '#8b4f22');
    grad.addColorStop(0.6, '#7a4219');
    grad.addColorStop(1,   '#5a3010');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);

    // Inner cutout (transparent → canvas alpha)
    ctx.clearRect(b, b, S - 2 * b, S - 2 * b);

    // Highlight top/left edge
    ctx.strokeStyle = 'rgba(220,160,80,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(1, S - 1); ctx.lineTo(1, 1); ctx.lineTo(S - 1, 1); ctx.stroke();

    // Shadow bottom/right edge
    ctx.strokeStyle = 'rgba(0,0,0,0.70)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(1, S - 1); ctx.lineTo(S - 1, S - 1); ctx.lineTo(S - 1, 1); ctx.stroke();

    // Inner bevel highlight
    ctx.strokeStyle = 'rgba(180,110,50,0.40)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b - 1, b - 1, S - 2 * (b - 1), S - 2 * (b - 1));

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

const FRAME_TEX = makeFrameTex();

function cloneTexture<T extends THREE.Texture>(
    texture: T,
    configure?: (next: T) => void,
): T {
    const next = texture.clone() as T;
    configure?.(next);
    next.needsUpdate = true;
    return next;
}

function makeWhiteTransparentTexture(texture: THREE.Texture): THREE.Texture {
    const image = texture.image as CanvasImageSource | undefined;
    if (!image) return texture;

    const canvas = document.createElement('canvas');
    const width = (image as { width?: number }).width ?? 0;
    const height = (image as { height?: number }).height ?? 0;
    if (!width || !height) return texture;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return texture;
    ctx.drawImage(image, 0, 0, width, height);

    const img = ctx.getImageData(0, 0, width, height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 242 && g > 242 && b > 242) data[i + 3] = 0;
    }
    ctx.putImageData(img, 0, 0);

    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.needsUpdate = true;
    return next;
}

function useSafeTexture(url: string, fallbackUrl: string): THREE.Texture | null {
    const [textureEntry, setTextureEntry] = useState<{ source: string; texture: THREE.Texture | null }>({
        source: '',
        texture: null,
    });

    useEffect(() => {
        let disposed = false;
        let activeTexture: THREE.Texture | null = null;
        const loader = new THREE.TextureLoader();

        const finalizeTexture = (next: THREE.Texture) => {
            if (disposed) {
                next.dispose();
                return;
            }
            activeTexture?.dispose();
            activeTexture = next;
            setTextureEntry({ source: url, texture: next });
        };

        const loadWithFallback = (source: string, fallback?: string) => {
            loader.load(
                source,
                loaded => finalizeTexture(loaded),
                undefined,
                () => {
                    if (fallback) {
                        loadWithFallback(fallback);
                        return;
                    }
                    setTextureEntry({ source: url, texture: null });
                },
            );
        };

        loadWithFallback(url, fallbackUrl);

        return () => {
            disposed = true;
            activeTexture?.dispose();
        };
    }, [fallbackUrl, url]);

    return textureEntry.source === url ? textureEntry.texture : null;
}

/** Decorative frame always visible on mirror wall, regardless of champion state. */
const PortraitFrame: React.FC<{ wallFace: CardinalDir }> = ({ wallFace }) => {
    const { pos, rot } = FACE_CONFIGS[wallFace];
    const zOff = 0.008; // tiny Z-offset in front of wall
    const fwdVec: [number,number,number] = [
        pos[0] !== 0 ? Math.sign(pos[0]) * zOff : 0,
        0,
        pos[2] !== 0 ? Math.sign(pos[2]) * zOff : 0,
    ];
    const framePos: [number,number,number] = [pos[0] + fwdVec[0], pos[1] + fwdVec[1], pos[2] + fwdVec[2]];
    return (
        <Plane args={[FRAME_W, FRAME_H]} position={framePos} rotation={rot}>
            <meshBasicMaterial map={FRAME_TEX} transparent alphaTest={0.01} side={THREE.DoubleSide} />
        </Plane>
    );
};

/** Empty dark canvas inside the frame (shown when champion has been recruited). */
const FrameEmpty: React.FC<{ wallFace: CardinalDir }> = ({ wallFace }) => {
    const { pos, rot } = FACE_CONFIGS[wallFace];
    const zOff = 0.004;
    const fwdVec: [number,number,number] = [
        pos[0] !== 0 ? Math.sign(pos[0]) * zOff : 0,
        0,
        pos[2] !== 0 ? Math.sign(pos[2]) * zOff : 0,
    ];
    const innerPos: [number,number,number] = [pos[0] + fwdVec[0], pos[1] + fwdVec[1], pos[2] + fwdVec[2]];
    return (
        <Plane args={[PORTRAIT_W, PORTRAIT_H]} position={innerPos} rotation={rot}>
            <meshBasicMaterial color="#e8e4dc" side={THREE.DoubleSide} />
        </Plane>
    );
};

const MirrorPortrait: React.FC<{ champion: Champion; wallFace: CardinalDir }> = ({ champion, wallFace }) => {
    const baseTex = useTexture(champion.portrait);
    const tex = useMemo(
        () => cloneTexture(baseTex, next => { next.colorSpace = THREE.SRGBColorSpace; }),
        [baseTex],
    );
    useEffect(() => () => tex.dispose(), [tex]);

    const { pos, rot } = FACE_CONFIGS[wallFace];
    const zOff = 0.004;
    const fwdVec: [number,number,number] = [
        pos[0] !== 0 ? Math.sign(pos[0]) * zOff : 0,
        0,
        pos[2] !== 0 ? Math.sign(pos[2]) * zOff : 0,
    ];
    const imgPos: [number,number,number] = [pos[0] + fwdVec[0], pos[1] + fwdVec[1], pos[2] + fwdVec[2]];

    return (
        <Plane args={[PORTRAIT_W, PORTRAIT_H]} position={imgPos} rotation={rot}>
            <meshBasicMaterial map={tex} transparent alphaTest={0.05} side={THREE.DoubleSide} />
        </Plane>
    );
};

const ProceduralPortrait: React.FC<{ champion: Champion; wallFace: CardinalDir }> = ({ champion, wallFace }) => {
    const { pos, rot } = FACE_CONFIGS[wallFace];
    const zOff = 0.004;
    const fwdVec: [number,number,number] = [
        pos[0] !== 0 ? Math.sign(pos[0]) * zOff : 0,
        0,
        pos[2] !== 0 ? Math.sign(pos[2]) * zOff : 0,
    ];
    const imgPos: [number,number,number] = [pos[0] + fwdVec[0], pos[1] + fwdVec[1], pos[2] + fwdVec[2]];
    const color = new THREE.Color(CLASS_COLORS[champion.class] ?? '#555');
    return (
        <Plane args={[PORTRAIT_W, PORTRAIT_H]} position={imgPos} rotation={rot}>
            <meshBasicMaterial color={color} side={THREE.DoubleSide} />
        </Plane>
    );
};

// ─── Animated door ─────────────────────────────────────────────────────────────

const HALF = GRID_SIZE / 2;
const DEFAULT_DOOR_PEEK = 0.18;
const GRATE_DOOR_PEEK = 0.08;

function getDoorLift(doorType?: number): number {
    const peek = doorType === 0 ? GRATE_DOOR_PEEK : DEFAULT_DOOR_PEEK;
    return HALF + WALL_HEIGHT / 2 - peek;
}

// Door-panel proportion when a wall-button is present
const BTN_RATIO  = 0.22;                     // generic side strip width
const DOOR_W_BTN = GRID_SIZE * (1 - BTN_RATIO);
const BTN_W      = GRID_SIZE * BTN_RATIO;
const DOOR_OFF_X = -(BTN_W / 2);
const BTN_CX     = GRID_SIZE / 2 - BTN_W / 2;
const BTN_OVERLAY_Z = 0.003;
const RA_DOOR_CURTAIN_Z = 0.012;

const DoorMeshInner: React.FC<{
    open: boolean;
    hasButton: boolean;
    showButton: boolean;
    buttonSideSign?: 1 | -1;
    buttonFaceSign?: 1 | -1;
    doorType?: number;
    onButtonClick?: (e: ThreeEvent<MouseEvent>) => void;
}> = ({ open, hasButton, showButton, buttonSideSign = 1, buttonFaceSign = 1, doorType, onButtonClick }) => {
    const baseDoorTex = useTexture(getDoorTexturePath(doorType));
    const baseWallTex = useTexture(`${texturesPath('wall.png')}?v=2`);
    const doorLift = useMemo(() => getDoorLift(doorType), [doorType]);
    const buttonTexturePath = open
        ? miscPath('wall_switch_small_in.png')
        : miscPath('wall_switch_small_out.png');
    const baseButtonTex = useSafeTexture(buttonTexturePath, miscPath('wall_switch_small.png'));
    const groupRef = useRef<THREE.Group>(null);
    const matRef1  = useRef<THREE.MeshBasicMaterial>(null);
    const progress = useRef(open ? 1 : 0);
    const didInitPosition = useRef(false);

    const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), HALF), []);
    useEffect(() => {
        if (matRef1.current) matRef1.current.clippingPlanes = [clipPlane];
    }, [clipPlane]);
    useEffect(() => {
        if (!groupRef.current || didInitPosition.current) return;
        progress.current = open ? 1 : 0;
        groupRef.current.position.y = doorLift * progress.current;
        didInitPosition.current = true;
    }, [doorLift, open]);

    useFrame((_, delta) => {
        if (!groupRef.current) return;
        const target = open ? 1 : 0;
        if (progress.current === target) return;
        progress.current = target > progress.current
            ? Math.min(target, progress.current + delta)
            : Math.max(target, progress.current - delta);
        groupRef.current.position.y = doorLift * progress.current;
    });

    const renderButtonStrip = hasButton;
    const renderButtons = hasButton && showButton;
    const doorW   = renderButtonStrip ? DOOR_W_BTN : GRID_SIZE;
    const doorOff = renderButtonStrip ? DOOR_OFF_X * buttonSideSign : 0;
    const buttonStripWidth = BTN_W;
    const buttonSize = BTN_W * 0.39;
    const tex = useMemo(
        () => cloneTexture(baseDoorTex, next => {
            next.colorSpace = THREE.SRGBColorSpace;
            if (doorType !== 0) {
                next.wrapS = THREE.RepeatWrapping;
                next.wrapT = THREE.RepeatWrapping;
                next.repeat.set(1, WALL_HEIGHT / doorW);
            }
        }),
        [baseDoorTex, doorType, doorW],
    );
    const wallTex = useMemo(
        () => cloneTexture(baseWallTex, next => {
            next.colorSpace = THREE.SRGBColorSpace;
            if (renderButtonStrip) {
                const visibleRatio = BTN_W / GRID_SIZE;
                next.wrapS = THREE.ClampToEdgeWrapping;
                next.wrapT = THREE.ClampToEdgeWrapping;
                next.repeat.set(visibleRatio, 1);
                next.offset.set((1 - visibleRatio) / 2, 0);
            }
        }),
        [baseWallTex, renderButtonStrip],
    );
    const buttonTex = useMemo(() => {
        if (!baseButtonTex) return null;
        return makeWhiteTransparentTexture(
            cloneTexture(baseButtonTex, next => {
                next.colorSpace = THREE.SRGBColorSpace;
            }),
        );
    }, [baseButtonTex]);
    useEffect(() => () => tex.dispose(), [tex]);
    useEffect(() => () => wallTex.dispose(), [wallTex]);
    useEffect(() => () => buttonTex?.dispose(), [buttonTex]);

    const handleBtnClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onButtonClick?.(e);
    };

    return (
        <>
            {/* ── Animated door panel ── */}
            <group ref={groupRef}>
                {doorType === 3 && (
                    <group position={[doorOff, 0, RA_DOOR_CURTAIN_Z * buttonFaceSign]}>
                        <PhotonsRaDoorCurtain scaleX={doorW * 0.96} scaleY={WALL_HEIGHT * 0.58} />
                    </group>
                )}
                <Plane args={[doorW, WALL_HEIGHT]} position={[doorOff, 0, 0]}>
                    <meshBasicMaterial ref={matRef1} map={tex} transparent alphaTest={0.05} side={THREE.DoubleSide} />
                </Plane>
            </group>

            {/* ── Static button strip on the door jamb ── */}
            {renderButtonStrip && (
                <>
                    <Plane args={[buttonStripWidth, WALL_HEIGHT]} position={[BTN_CX * buttonSideSign, 0, 0]}>
                        <meshBasicMaterial map={wallTex} side={THREE.DoubleSide} />
                    </Plane>
                    {renderButtons && (
                        buttonTex && (
                            <group position={[BTN_CX * buttonSideSign, -WALL_HEIGHT * 0.05, BTN_OVERLAY_Z * buttonFaceSign]}>
                                <Plane
                                    args={[buttonSize, buttonSize]}
                                    onClick={handleBtnClick}
                                >
                                    <meshBasicMaterial
                                        map={buttonTex}
                                        side={THREE.DoubleSide}
                                        transparent
                                        alphaTest={0.05}
                                        depthTest={true}
                                        depthWrite={false}
                                        polygonOffset
                                        polygonOffsetFactor={-4}
                                        polygonOffsetUnits={-4}
                                    />
                                </Plane>
                            </group>
                        )
                    )}
                </>
            )}
        </>
    );
};

const DoorMesh: React.FC<{
    open: boolean;
    hasButton: boolean;
    showButton: boolean;
    buttonSideSign?: 1 | -1;
    buttonFaceSign?: 1 | -1;
    doorType?: number;
    onButtonClick?: (e: ThreeEvent<MouseEvent>) => void;
}> = ({ open, hasButton, showButton, buttonSideSign, buttonFaceSign, doorType, onButtonClick }) => (
    <Suspense fallback={null}>
        <DoorMeshInner open={open} hasButton={hasButton} showButton={showButton} buttonSideSign={buttonSideSign} buttonFaceSign={buttonFaceSign} doorType={doorType} onButtonClick={onButtonClick} />
    </Suspense>
);

// ─── Pressure plate ───────────────────────────────────────────────────────────

const PLATE_W  = GRID_SIZE * 0.52;
const PLATE_D  = GRID_SIZE * 0.52;
const PLATE_H  = 0.045;           // raised height above floor
const PLATE_SINK = 0.040;         // how far it sinks when pressed
const PLATE_ANIM = 0.18;          // press-down duration in seconds
const FLOOR_Y  = -GRID_SIZE / 2;  // world Y of floor surface

function makePlateTex(): THREE.CanvasTexture {
    const S = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    // Base stone — cool grey slab with subtle variation
    const baseGrad = ctx.createLinearGradient(0, 0, S, S);
    baseGrad.addColorStop(0, '#7f827d');
    baseGrad.addColorStop(0.45, '#666962');
    baseGrad.addColorStop(1, '#4f534d');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, S, S);

    // Fine stone grain
    for (let i = 0; i < 48; i++) {
        const tone = 92 + (Math.random() * 42 | 0);
        ctx.fillStyle = `rgba(${tone},${tone + 4},${tone - 2},0.18)`;
        const rx = Math.random() * S;
        const ry = Math.random() * S;
        const rw = 4 + Math.random() * 18;
        const rh = 2 + Math.random() * 7;
        ctx.fillRect(rx, ry, rw, rh);
    }

    // Hairline cracks and seams to sell a carved stone tile
    ctx.strokeStyle = 'rgba(36, 40, 38, 0.38)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(S * 0.18, S * 0.28);
    ctx.lineTo(S * 0.36, S * 0.34);
    ctx.lineTo(S * 0.52, S * 0.3);
    ctx.lineTo(S * 0.7, S * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(S * 0.28, S * 0.7);
    ctx.lineTo(S * 0.44, S * 0.58);
    ctx.lineTo(S * 0.66, S * 0.64);
    ctx.stroke();

    // Recessed inner border instead of a symbol
    ctx.strokeStyle = 'rgba(34, 38, 36, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, S - 32, S - 32);

    // Top-face bevel: pale top-left, darker bottom-right
    const bw = 7;
    ctx.fillStyle = 'rgba(218, 224, 212, 0.24)';
    ctx.fillRect(0, 0, S, bw);       // top
    ctx.fillRect(0, 0, bw, S);       // left
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, S-bw, S, bw);    // bottom
    ctx.fillRect(S-bw, 0, bw, S);    // right

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

const PLATE_TOP_TEX = makePlateTex();

export const PressurePlate: React.FC<{ tileX: number; tileY: number; level: number }> = ({ tileX, tileY, level }) => {
    const pressRef = useRef(0);   // 0 = up, 1 = down, animating between
    const groupRef = useRef<THREE.Group>(null);

    useEffect(() => {
        const unsub = subscribePlateActivated((lvl, x, y) => {
            if (lvl === level && x === tileX && y === tileY) {
                pressRef.current = 1;
            }
        });
        return () => { unsub(); };
    }, [level, tileX, tileY]);

    useFrame((_, delta) => {
        if (!groupRef.current) return;
        // Decay press value back to 0
        if (pressRef.current > 0) {
            pressRef.current = Math.max(0, pressRef.current - delta / PLATE_ANIM);
        }
        const sink = pressRef.current * PLATE_SINK;
        groupRef.current.position.y = FLOOR_Y + PLATE_H - sink;
    });

    // Side faces to give volume (4 thin boxes around the plate edges)
    const sideColor = '#3f433d';

    return (
        <group ref={groupRef} position={[0, FLOOR_Y + PLATE_H, 0]}>
            {/* Top face */}
            <Plane args={[PLATE_W, PLATE_D]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                <meshBasicMaterial map={PLATE_TOP_TEX} />
            </Plane>
            {/* Side faces — N/S/E/W thin strips for depth illusion */}
            <Plane args={[PLATE_W, PLATE_H * 2]} position={[0, -PLATE_H, -PLATE_D / 2]} rotation={[0, 0, 0]}>
                <meshBasicMaterial color={sideColor} />
            </Plane>
            <Plane args={[PLATE_W, PLATE_H * 2]} position={[0, -PLATE_H,  PLATE_D / 2]} rotation={[0, Math.PI, 0]}>
                <meshBasicMaterial color={sideColor} />
            </Plane>
            <Plane args={[PLATE_D, PLATE_H * 2]} position={[-PLATE_W / 2, -PLATE_H, 0]} rotation={[0,  Math.PI / 2, 0]}>
                <meshBasicMaterial color={sideColor} />
            </Plane>
            <Plane args={[PLATE_D, PLATE_H * 2]} position={[ PLATE_W / 2, -PLATE_H, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <meshBasicMaterial color={sideColor} />
            </Plane>
        </group>
    );
};

// ─── Cell component ───────────────────────────────────────────────────────────

interface CellProps {
    type: CellRenderType;
    position: [number, number, number];
    champion?: Champion | null;
    frameChampion?: Champion | null;
    wallFace?: CardinalDir;
    doorOpen?: boolean;
    doorOrientation?: string;
    doorHasButton?: boolean;
    doorButtonVisible?: boolean;
    doorButtonSideSign?: 1 | -1;
    doorButtonFaceSign?: 1 | -1;
    doorType?: number;
    onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

export const Cell: React.FC<CellProps> = ({ type, position, wallFace, champion, frameChampion, doorOpen, doorOrientation, doorHasButton, doorButtonVisible, doorButtonSideSign, doorButtonFaceSign, doorType, onClick }) => {
    const baseWallTex = useTexture(`${texturesPath('wall.png')}?v=2`);
    const wallTex = useMemo(
        () => cloneTexture(baseWallTex, next => {
            next.wrapS = THREE.RepeatWrapping;
            next.wrapT = THREE.RepeatWrapping;
            next.repeat.set(1, 1);
        }),
        [baseWallTex],
    );
    useEffect(() => () => wallTex.dispose(), [wallTex]);

    // ── MIRROR ────────────────────────────────────────────────────────────────
    // InstancedTiles renders ceiling for all tiles; Mirror needs its own wall Box.
    if (type === 'Mirror') {
        const face = wallFace ?? 'South';
        return (
            <group position={position} onClick={onClick}>
                <Box args={[GRID_SIZE, WALL_HEIGHT, GRID_SIZE]}><meshBasicMaterial map={wallTex} /></Box>
                {frameChampion && <PortraitFrame wallFace={face} />}
                {frameChampion && <FrameEmpty wallFace={face} />}
                {champion && wallFace && (
                    <Suspense fallback={<ProceduralPortrait champion={champion} wallFace={face} />}>
                        <MirrorPortrait champion={champion} wallFace={face} />
                    </Suspense>
                )}
            </group>
        );
    }

    // ── DOOR ──────────────────────────────────────────────────────────────────
    // InstancedTiles renders floor + ceiling for Door tiles.
    if (type === 'Door') {
        const doorRotY = doorOrientation === 'WestEast' ? Math.PI / 2 : 0;
        const hasBtn   = doorHasButton ?? false;
        return (
            <group position={position} onClick={hasBtn ? undefined : onClick}>
                <group rotation={[0, doorRotY, 0]}>
                    <DoorMesh
                        open={doorOpen ?? false}
                        hasButton={hasBtn}
                        showButton={doorButtonVisible ?? hasBtn}
                        buttonSideSign={doorButtonSideSign}
                        buttonFaceSign={doorButtonFaceSign}
                        doorType={doorType}
                        onButtonClick={hasBtn && (doorButtonVisible ?? hasBtn) ? onClick : undefined}
                    />
                </group>
            </group>
        );
    }

    // Wall, Floor, Stairs — all handled by InstancedTiles; nothing to render here.
    return null;
};
