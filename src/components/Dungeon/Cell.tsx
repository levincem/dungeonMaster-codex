import React, { useMemo, useRef, useEffect, Suspense } from 'react';
import { Box, Plane, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import { subscribePlateActivated } from '../../engine/store';
import type { ThreeEvent } from '@react-three/fiber';
import type { Champion } from '../../data/champions';
import type { CardinalDir } from '../../types/game';

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
// How many world-units of door bottom peek below the ceiling when fully open
const DOOR_PEEK = 0.22;
// Lift needed so the door bottom sits DOOR_PEEK below the ceiling:
//   world_bottom = lift - WALL_HEIGHT/2  =  HALF - DOOR_PEEK
//   → lift = HALF + WALL_HEIGHT/2 - DOOR_PEEK
const DOOR_LIFT = HALF + WALL_HEIGHT / 2 - DOOR_PEEK; // ≈ 2.03

// Door-panel proportion when a wall-button is present
const BTN_RATIO  = 0.22;                     // fraction of GRID_SIZE reserved for button strip
const DOOR_W_BTN = GRID_SIZE * (1 - BTN_RATIO); // 1.56 — narrower door
const BTN_W      = GRID_SIZE * BTN_RATIO;        // 0.44 — button strip
// x-offset of door panel centre (shifted left to leave room for button on the right)
const DOOR_OFF_X = -(BTN_W / 2);            // -0.22
// x-centre of the button strip
const BTN_CX     = GRID_SIZE / 2 - BTN_W / 2;   //  0.78

/** Procedural button-boss texture (64×64). */
function makeButtonTex(open: boolean): THREE.Texture {
    const S = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    // Stone background
    ctx.fillStyle = '#6a5f58';
    ctx.fillRect(0, 0, S, S);

    // Subtle grain
    for (let i = 0; i < 120; i++) {
        const x = Math.random() * S, y = Math.random() * S;
        const v = Math.floor(Math.random() * 22 - 11);
        ctx.fillStyle = `rgba(${100+v},${95+v},${88+v},0.28)`;
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }

    // Boss square (centred)
    const m = 10, bx = m, by = m, bw = S - 2*m, bh = S - 2*m;

    if (open) {
        // Recessed + green glow
        ctx.fillStyle = '#28221e';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#1e4210';
        ctx.fillRect(bx+2, by+2, bw-4, bh-4);
        ctx.fillStyle = '#44cc22';
        ctx.fillRect(bx+7, by+7, bw-14, bh-14);
        ctx.fillStyle = '#88ff66';
        ctx.fillRect(bx+14, by+14, bw-28, bh-28);
    } else {
        // Raised — bright edges top/left, dark edges bottom/right
        ctx.fillStyle = '#8a7e76';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#b4a89e'; // highlight top
        ctx.fillRect(bx, by, bw, 3);
        ctx.fillRect(bx, by, 3, bh); // highlight left
        ctx.fillStyle = '#34302c'; // shadow bottom
        ctx.fillRect(bx, by+bh-3, bw, 3);
        ctx.fillRect(bx+bw-3, by, 3, bh); // shadow right
        ctx.fillStyle = '#7a6e66'; // inner face
        ctx.fillRect(bx+4, by+4, bw-7, bh-7);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

const DoorMeshInner: React.FC<{
    open: boolean;
    hasButton: boolean;
    onButtonClick?: (e: ThreeEvent<MouseEvent>) => void;
}> = ({ open, hasButton, onButtonClick }) => {
    const baseDoorTex = useTexture('/textures/door.png');
    const baseWallTex = useTexture('/textures/wall.png?v=2');
    const tex = useMemo(
        () => cloneTexture(baseDoorTex, next => { next.colorSpace = THREE.SRGBColorSpace; }),
        [baseDoorTex],
    );
    const wallTex = useMemo(
        () => cloneTexture(baseWallTex, next => { next.colorSpace = THREE.SRGBColorSpace; }),
        [baseWallTex],
    );
    useEffect(() => () => tex.dispose(), [tex]);
    useEffect(() => () => wallTex.dispose(), [wallTex]);

    const groupRef = useRef<THREE.Group>(null);
    const matRef1  = useRef<THREE.MeshBasicMaterial>(null);
    const progress = useRef(open ? 1 : 0);

    const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), HALF), []);
    useEffect(() => {
        if (matRef1.current) matRef1.current.clippingPlanes = [clipPlane];
    }, [clipPlane]);

    useFrame((_, delta) => {
        if (!groupRef.current) return;
        const target = open ? 1 : 0;
        if (progress.current === target) return;
        progress.current = target > progress.current
            ? Math.min(target, progress.current + delta)
            : Math.max(target, progress.current - delta);
        groupRef.current.position.y = DOOR_LIFT * progress.current;
    });

    // Button texture — recreated when door state changes
    const btnTex = useMemo(() => makeButtonTex(open), [open]);
    useEffect(() => () => btnTex.dispose(), [btnTex]);

    const doorW   = hasButton ? DOOR_W_BTN : GRID_SIZE;
    const doorOff = hasButton ? DOOR_OFF_X : 0;

    const handleBtnClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onButtonClick?.(e);
    };

    return (
        <>
            {/* ── Animated door panel ── */}
            <group ref={groupRef}>
                <Plane args={[doorW, WALL_HEIGHT]} position={[doorOff, 0, 0]}>
                    <meshBasicMaterial ref={matRef1} map={tex} transparent alphaTest={0.05} side={THREE.DoubleSide} />
                </Plane>
            </group>

            {/* ── Static button strip (only when hasButton) ── */}
            {hasButton && (
                <>
                    {/* Wall background of the strip */}
                    <Plane args={[BTN_W, WALL_HEIGHT]} position={[BTN_CX, 0, 0]}>
                        <meshBasicMaterial map={wallTex} side={THREE.DoubleSide} />
                    </Plane>
                    {/* Clickable button boss */}
                    <Plane
                        args={[BTN_W * 0.72, BTN_W * 0.72]}
                        position={[BTN_CX, 0, 0.006]}
                        onClick={handleBtnClick}
                    >
                        <meshBasicMaterial map={btnTex} side={THREE.DoubleSide} transparent={false} />
                    </Plane>
                </>
            )}
        </>
    );
};

const DoorMesh: React.FC<{
    open: boolean;
    hasButton: boolean;
    onButtonClick?: (e: ThreeEvent<MouseEvent>) => void;
}> = ({ open, hasButton, onButtonClick }) => (
    <Suspense fallback={null}>
        <DoorMeshInner open={open} hasButton={hasButton} onButtonClick={onButtonClick} />
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

    // Base stone — slightly lighter than wall
    ctx.fillStyle = '#4a4236';
    ctx.fillRect(0, 0, S, S);

    // Subtle stone grain
    for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(${60 + Math.random()*20|0},${50+Math.random()*15|0},${40+Math.random()*10|0},0.5)`;
        const rx = Math.random()*S, ry = Math.random()*S, rw = 6+Math.random()*20, rh = 2+Math.random()*6;
        ctx.fillRect(rx, ry, rw, rh);
    }

    // Top-face bevel: light top-left, dark bottom-right
    const bw = 7;
    ctx.fillStyle = 'rgba(200,170,110,0.28)';
    ctx.fillRect(0, 0, S, bw);       // top
    ctx.fillRect(0, 0, bw, S);       // left
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, S-bw, S, bw);    // bottom
    ctx.fillRect(S-bw, 0, bw, S);    // right

    // Carved symbol — simple cross
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(S/2, S*0.28); ctx.lineTo(S/2, S*0.72);
    ctx.moveTo(S*0.28, S/2); ctx.lineTo(S*0.72, S/2);
    ctx.stroke();

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
    const sideColor = '#2e2820';

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
    onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

export const Cell: React.FC<CellProps> = ({ type, position, wallFace, champion, frameChampion, doorOpen, doorOrientation, doorHasButton, onClick }) => {
    const baseWallTex = useTexture('/textures/wall.png?v=2');
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
                        onButtonClick={hasBtn ? onClick : undefined}
                    />
                </group>
            </group>
        );
    }

    // Wall, Floor, Stairs — all handled by InstancedTiles; nothing to render here.
    return null;
};
