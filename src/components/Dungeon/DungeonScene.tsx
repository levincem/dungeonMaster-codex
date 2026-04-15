import { useRef, useMemo, memo, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { PerspectiveCamera, Plane, Html, useTexture, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, MIRROR_WALL_MAP, MIRROR_FACE_MAP, STAIR_CONNECTIONS, getCreatureFluxcageExpiry, isSelfRevealingWallTile } from '../../engine/store';
import { DAMAGE_EVENT_LIFETIME_MS, FOOTPRINT_LIFETIME_MS } from '../../engine/time';
import { getMapMechanisms, getMechanismsAt } from '../../data/mechanisms';
import { getOriginalWallOverlaysForMap, type OriginalWallOverlayRender } from '../../data/originalWallOverlays';
import type { Direction, ProjectileEffect, FootprintEntry, SpellVisualEvent } from '../../engine/runtimeTypes';
import { computeLightLevel } from '../../engine/store';
import { getGameMap } from '../../data/mapLoader';
import type { GameMap, GameTile, TeleporterObject, SensorObject, WallTextObject, CardinalDir, DoorObject } from '../../types/game';
import type { Champion } from '../../data/champions';
import type { EquipSlotKey } from '../../types/items';
import { Cell, PressurePlate } from './Cell';
import type { CellRenderType } from './Cell';
import { InstancedTiles } from './InstancedTiles';
import { CreatureSprite, getCreatureCellOffsetXZ } from './CreatureSprite';
import { FloorItemMesh } from './FloorItemMesh';
import { WallMountedItemMesh } from './WallMountedItemMesh';
import { WallSensor } from './WallSensor';
import { WallDecal } from './WallDecal';
import { PhotonsDisruptProjectile, PhotonsFireball, PhotonsLightningProjectile, PhotonsOpenDoorProjectile, PhotonsPoisonProjectile } from './PhotonsFireball';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import { getFloorItemImage } from '../../data/itemImages';
import type { FloorItem } from '../../types/game';
import type { CreatureInstance } from '../../types/game';
import { miscPath, texturesPath } from '../../data/assetPaths';
import { doorBlocksVision } from '../../data/doors';
import { getDragPayload } from '../UI/dragPayload';
import { useI18n } from '../../i18n';

const HALF = GRID_SIZE / 2;
const BASE_FOG_NEAR = GRID_SIZE * 2;
const BASE_FOG_FAR = GRID_SIZE * 7;
const FLOOR_DROP_SCREEN_RATIO = 0.7;
const DUNGEON_AMBIENT_COLOR = new THREE.Color('#f4e2ba');
const DUNGEON_DARK_AMBIENT_COLOR = new THREE.Color('#8ea0c0');
const CAMERA_HEIGHT_OFFSET = 0;
const CAMERA_FORWARD_OFFSET = 0;
const CAMERA_LATERAL_OFFSET = 0;
type MagicProjectileEffect = Exclude<ProjectileEffect, 'physical'>;
function cloneTexture<T extends THREE.Texture>(
    texture: T,
    configure?: (next: T) => void,
): T {
    const next = texture.clone() as T;
    configure?.(next);
    next.needsUpdate = true;
    return next;
}

function createPulseMaterial(color: string, opacity: number) {
    return new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
    });
}

function useWallClock(intervalMs = 200): number {
    const [nowMs, setNowMs] = useState(0);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setNowMs(Date.now());
        }, intervalMs);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [intervalMs]);

    return nowMs;
}

// ─── Camera smooth follow ─────────────────────────────────────────────────────
const CameraController = () => {
    const level = useStore(s => s.level);
    const position  = useStore(s => s.position);
    const direction = useStore(s => s.direction);
    const cameraRef = useRef<THREE.PerspectiveCamera>(null);
    const initializedRef = useRef(false);
    const prevLevelRef = useRef(level);
    const prevPositionRef = useRef<[number, number]>(position);
    const rotationMap = { NORTH: 0, EAST: -Math.PI / 2, SOUTH: Math.PI, WEST: Math.PI / 2 };
    const forwardVectorMap = {
        NORTH: new THREE.Vector3(0, 0, -1),
        EAST: new THREE.Vector3(1, 0, 0),
        SOUTH: new THREE.Vector3(0, 0, 1),
        WEST: new THREE.Vector3(-1, 0, 0),
    };
    const rightVectorMap = {
        NORTH: new THREE.Vector3(1, 0, 0),
        EAST: new THREE.Vector3(0, 0, 1),
        SOUTH: new THREE.Vector3(-1, 0, 0),
        WEST: new THREE.Vector3(0, 0, -1),
    };
    const targetPos = useMemo(() => {
        const base = new THREE.Vector3(position[1] * GRID_SIZE, CAMERA_HEIGHT_OFFSET, position[0] * GRID_SIZE);
        const forward = forwardVectorMap[direction as keyof typeof forwardVectorMap].clone().multiplyScalar(CAMERA_FORWARD_OFFSET);
        const lateral = rightVectorMap[direction as keyof typeof rightVectorMap].clone().multiplyScalar(CAMERA_LATERAL_OFFSET);
        return base.add(forward).add(lateral);
    }, [direction, position]);
    const targetRot = rotationMap[direction as keyof typeof rotationMap];
    const [initialCameraPosition] = useState<[number, number, number]>(() => [targetPos.x, targetPos.y, targetPos.z]);
    const [initialCameraRotation] = useState<[number, number, number]>(() => [0, targetRot, 0]);

    useEffect(() => {
        const camera = cameraRef.current;
        if (!camera) return;

        if (!initializedRef.current) {
            camera.position.copy(targetPos);
            camera.rotation.set(0, targetRot, 0);
            initializedRef.current = true;
            prevLevelRef.current = level;
            prevPositionRef.current = position;
            return;
        }

        const [prevY, prevX] = prevPositionRef.current;
        const jumpedDistance = Math.abs(prevX - position[1]) + Math.abs(prevY - position[0]);
        const changedLevel = prevLevelRef.current !== level;

        if (changedLevel || jumpedDistance > 1) {
            camera.position.copy(targetPos);
            camera.rotation.set(0, targetRot, 0);
        }

        prevLevelRef.current = level;
        prevPositionRef.current = position;
    }, [level, position, targetPos, targetRot]);

    useFrame(() => {
        if (!cameraRef.current) return;
        cameraRef.current.position.lerp(targetPos, 0.12);
        let diff = targetRot - cameraRef.current.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        cameraRef.current.rotation.y += diff * 0.1;
    });

    return (
        <PerspectiveCamera
            ref={cameraRef}
            makeDefault
            position={initialCameraPosition}
            rotation={initialCameraRotation}
            fov={75}
        />
    );
};

// ─── Boundary wall planes ─────────────────────────────────────────────────────
const BoundaryWalls = memo(({ map }: { map: GameMap }) => {
    const seeThroughWallsUntil = useStore(s => s.seeThroughWallsUntil);
    const [wallTransparent, setWallTransparent] = useState(false);
    const { wall: baseWall } = useTexture({ wall: `${texturesPath('wall.png')}?v=2` });
    const wall = useMemo(
        () => cloneTexture(baseWall, next => {
            next.wrapS = THREE.RepeatWrapping;
            next.wrapT = THREE.RepeatWrapping;
        }),
        [baseWall],
    );
    useEffect(() => () => wall.dispose(), [wall]);
    useFrame(() => {
        const active = Date.now() < seeThroughWallsUntil;
        setWallTransparent(prev => (prev === active ? prev : active));
    });

    const planes: React.ReactElement[] = [];
    for (const row of map.tiles) {
        for (const tile of row) {
            if (tile.type === 'Wall') continue;
            const wx = tile.x * GRID_SIZE;
            const wz = tile.y * GRID_SIZE;
            const mat = <meshBasicMaterial map={wall} side={THREE.DoubleSide} transparent={wallTransparent} opacity={wallTransparent ? 0.34 : 1} depthWrite={!wallTransparent} />;
            if (tile.y === 0)
                planes.push(<Plane key={`N-${tile.x}-${tile.y}`} args={[GRID_SIZE, WALL_HEIGHT]} position={[wx, 0, wz - HALF]} rotation={[0, Math.PI, 0]}>{mat}</Plane>);
            if (tile.y === map.height - 1)
                planes.push(<Plane key={`S-${tile.x}-${tile.y}`} args={[GRID_SIZE, WALL_HEIGHT]} position={[wx, 0, wz + HALF]}>{mat}</Plane>);
            if (tile.x === 0)
                planes.push(<Plane key={`W-${tile.x}-${tile.y}`} args={[GRID_SIZE, WALL_HEIGHT]} position={[wx - HALF, 0, wz]} rotation={[0, -Math.PI / 2, 0]}>{mat}</Plane>);
            if (tile.x === map.width - 1)
                planes.push(<Plane key={`E-${tile.x}-${tile.y}`} args={[GRID_SIZE, WALL_HEIGHT]} position={[wx + HALF, 0, wz]} rotation={[0, Math.PI / 2, 0]}>{mat}</Plane>);
        }
    }
    return <>{planes}</>;
});

// ─── Tile render-type derivation ──────────────────────────────────────────────
function getRenderType(tile: GameTile, level: number): CellRenderType {
    switch (tile.type) {
        case 'Wall':
            return MIRROR_WALL_MAP.has(`${level},${tile.x},${tile.y}`) ? 'Mirror' : 'Wall';
        case 'Door':
            return 'Door';
        case 'Stairs': {
            const link = STAIR_CONNECTIONS.find(
                s => s.fromLevel === level && s.fromY === tile.y && s.fromX === tile.x
            );
            if (link) return link.toLevel > level ? 'StairsDown' : 'StairsUp';
            return 'Floor';
        }
        case 'Teleporter': {
            const tp = tile.objects.find((o): o is TeleporterObject => o.category === 'Teleporter');
            if (tp && tp.destMap !== level) return tp.destMap > level ? 'StairsDown' : 'StairsUp';
            return 'Floor';
        }
        default:
            return 'Floor';
    }
}

// ─── Level name overlay ───────────────────────────────────────────────────────
const LevelName = ({ level }: { level: number }) => {
    const map = getGameMap(level);
    return (
        <div style={{
            position: 'absolute', zIndex: 10, top: '12%', width: '100%', textAlign: 'center',
            color: '#c8a96e', fontSize: '1.4rem', fontFamily: 'serif', letterSpacing: '0.25em',
            textTransform: 'uppercase', textShadow: '0 0 24px rgba(200,169,110,0.7)',
            pointerEvents: 'none', userSelect: 'none', animation: 'dmLevelName 4s ease-in forwards',
        }}>
            {map.name}
        </div>
    );
};

// ─── Wall text — carved 3D inscriptions ──────────────────────────────────────
const CHAMPION_DATA_RE = /\n{2,}[MF]\n[A-Z]/;

const FACE_POS_TEXT: Record<CardinalDir, [number, number, number]> = {
    North: [0, 0, -(GRID_SIZE / 2 + 0.035)],
    South: [0, 0,  (GRID_SIZE / 2 + 0.035)],
    East:  [ (GRID_SIZE / 2 + 0.035), 0, 0],
    West:  [-(GRID_SIZE / 2 + 0.035), 0, 0],
};
const FACE_ROT_TEXT: Record<CardinalDir, [number, number, number]> = {
    North: [0, Math.PI,      0],   // player approaches from -Z looking +Z (south)
    South: [0, 0,            0],   // player approaches from +Z looking -Z (north)
    // East/West are stored on wall tiles — label is from the wall tile's perspective,
    // opposite to floor-tile convention, so rotations are swapped vs WallDecal.
    East:  [0,  Math.PI / 2, 0],
    West:  [0, -Math.PI / 2, 0],
};

function makeEngravedTexture(text: string): THREE.CanvasTexture {
    const W = 512, H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    const lines = text.split('\n').filter(l => l.trim() !== '');
    const fontSize = Math.max(28, Math.min(48, Math.floor(H * 0.12 / Math.max(lines.length, 1) * 1.4)));
    ctx.font = `bold ${fontSize}px "Courier New", Courier, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lineH = fontSize * 1.35;
    const totalH = lines.length * lineH;
    const startY = H / 2 - totalH / 2 + lineH / 2;

    lines.forEach((line, i) => {
        const y = startY + i * lineH;
        // Dark shadow (depth)
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(line, W / 2 + 2, y + 2);
        // Inner light (highlight of carved ridge)
        ctx.fillStyle = 'rgba(255,220,120,0.25)';
        ctx.fillText(line, W / 2 - 1, y - 1);
        // Main engraved text
        ctx.fillStyle = '#c8a040';
        ctx.fillText(line, W / 2, y);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function makeDamageBubbleTexture(amount: number): { texture: THREE.CanvasTexture; aspect: number } {
    const text = `-${amount}`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        const fallback = new THREE.CanvasTexture(canvas);
        return { texture: fallback, aspect: 1.6 };
    }

    ctx.font = 'bold 76px "Courier New", monospace';
    const metrics = ctx.measureText(text);
    const severity = Math.min(1, amount / 48);
    const width = Math.max(220, Math.ceil(metrics.width + 82 + severity * 28));
    const height = Math.max(132, Math.ceil(142 + severity * 18));
    canvas.width = width;
    canvas.height = height;

    const draw = canvas.getContext('2d');
    if (!draw) {
        const fallback = new THREE.CanvasTexture(canvas);
        return { texture: fallback, aspect: width / height };
    }

    draw.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const outerRadiusX = width * (0.46 + severity * 0.03);
    const outerRadiusY = height * (0.42 + severity * 0.04);
    const innerRadiusX = outerRadiusX * 0.78;
    const innerRadiusY = outerRadiusY * 0.73;
    const spikes = 10;

    draw.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const angle = (-Math.PI / 2) + (i * Math.PI) / spikes;
        const radiusX = i % 2 === 0 ? outerRadiusX : innerRadiusX;
        const radiusY = i % 2 === 0 ? outerRadiusY : innerRadiusY;
        const px = cx + Math.cos(angle) * radiusX;
        const py = cy + Math.sin(angle) * radiusY;
        if (i === 0) draw.moveTo(px, py); else draw.lineTo(px, py);
    }
    draw.closePath();

    const fill = draw.createRadialGradient(cx, cy, 8, cx, cy, Math.max(outerRadiusX, outerRadiusY));
    fill.addColorStop(0, 'rgba(255, 246, 212, 0.98)');
    fill.addColorStop(0.24, 'rgba(255, 194, 110, 0.96)');
    fill.addColorStop(0.62, 'rgba(176, 40, 14, 0.96)');
    fill.addColorStop(1, 'rgba(86, 6, 2, 0.98)');
    draw.fillStyle = fill;
    draw.strokeStyle = 'rgba(255, 236, 170, 0.98)';
    draw.lineWidth = 7;
    draw.lineJoin = 'round';
    draw.fill();
    draw.stroke();

    draw.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const angle = (-Math.PI / 2) + (i * Math.PI) / spikes;
        const radiusX = (i % 2 === 0 ? outerRadiusX : innerRadiusX) * 0.79;
        const radiusY = (i % 2 === 0 ? outerRadiusY : innerRadiusY) * 0.74;
        const px = cx + Math.cos(angle) * radiusX;
        const py = cy + Math.sin(angle) * radiusY;
        if (i === 0) draw.moveTo(px, py); else draw.lineTo(px, py);
    }
    draw.closePath();
    draw.strokeStyle = 'rgba(82, 10, 4, 0.9)';
    draw.lineWidth = 3.5;
    draw.stroke();

    draw.fillStyle = '#fff7d2';
    draw.textAlign = 'center';
    draw.textBaseline = 'middle';
    draw.font = 'bold 76px "Courier New", monospace';
    draw.shadowColor = 'rgba(24, 0, 0, 0.95)';
    draw.shadowBlur = 12;
    draw.lineWidth = 5;
    draw.strokeStyle = 'rgba(64, 8, 0, 0.95)';
    draw.strokeText(text, cx, cy + 5);
    draw.fillText(text, cx, cy + 5);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return { texture, aspect: width / height };
}

const WallTextEntry: React.FC<{ tileX: number; tileY: number; face: CardinalDir; text: string }> = ({ tileX, tileY, face, text }) => {
    const tex = useMemo(() => makeEngravedTexture(text), [text]);
    const [ox, , oz] = FACE_POS_TEXT[face];
    const [rx, ry, rz] = FACE_ROT_TEXT[face];
    return (
        <mesh
            position={[tileX * GRID_SIZE + ox, 0, tileY * GRID_SIZE + oz]}
            rotation={[rx, ry, rz]}
            frustumCulled={false}
            renderOrder={6}
        >
            <planeGeometry args={[GRID_SIZE * 0.78, WALL_HEIGHT * 0.55]} />
            <meshBasicMaterial
                map={tex}
                transparent
                depthWrite={false}
                depthTest={true}
                polygonOffset
                polygonOffsetFactor={-4}
                polygonOffsetUnits={-4}
                side={THREE.DoubleSide}
                toneMapped={false}
            />
        </mesh>
    );
};

const WALL_TEXT_FACE_VECTORS: Record<CardinalDir, { dx: number; dy: number }> = {
    North: { dx: 0, dy: -1 },
    South: { dx: 0, dy: 1 },
    East: { dx: 1, dy: 0 },
    West: { dx: -1, dy: 0 },
};

function wallFaceAnchor(tileX: number, tileY: number, face: CardinalDir): { x: number; y: number } {
    const step = WALL_TEXT_FACE_VECTORS[face];
    return { x: tileX + step.dx, y: tileY + step.dy };
}

function blocksWallFaceSight(
    tile: GameTile | undefined,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
): boolean {
    if (!tile) return true;
    if (tile.type === 'Wall') {
        const selfRevealingOpen = isSelfRevealingWallTile(level, tile.x, tile.y) &&
            openWalls.has(`${level},${tile.y},${tile.x}`);
        return !selfRevealingOpen;
    }
    if (tile.type === 'TrickWall') {
        return !openWalls.has(`${level},${tile.y},${tile.x}`);
    }
    if (tile.type === 'Door') {
        if (openDoors.has(`${level},${tile.y},${tile.x}`)) return false;
        const door = tile.objects.find((obj): obj is DoorObject => obj.category === 'Door');
        return doorBlocksVision(door?.doorType);
    }
    return false;
}

function hasWallFaceLineOfSight(
    map: GameMap,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
): boolean {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return true;
    for (let i = 1; i < steps; i++) {
        const x = Math.round(fromX + (dx * i) / steps);
        const y = Math.round(fromY + (dy * i) / steps);
        if (blocksWallFaceSight(map.tiles[y]?.[x], level, openDoors, openWalls)) {
            return false;
        }
    }
    return !blocksWallFaceSight(map.tiles[toY]?.[toX], level, openDoors, openWalls);
}

function isWallFaceVisible(
    map: GameMap,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    partyX: number,
    partyY: number,
    tileX: number,
    tileY: number,
    face: CardinalDir,
): boolean {
    const anchor = wallFaceAnchor(tileX, tileY, face);
    return hasWallFaceLineOfSight(map, level, openDoors, openWalls, partyX, partyY, anchor.x, anchor.y);
}

function isDoorTileVisible(
    map: GameMap,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    partyX: number,
    partyY: number,
    tileX: number,
    tileY: number,
): boolean {
    const dx = tileX - partyX;
    const dy = tileY - partyY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return true;
    for (let i = 1; i < steps; i++) {
        const x = Math.round(partyX + (dx * i) / steps);
        const y = Math.round(partyY + (dy * i) / steps);
        if (blocksWallFaceSight(map.tiles[y]?.[x], level, openDoors, openWalls)) {
            return false;
        }
    }
    const target = map.tiles[tileY]?.[tileX];
    if (!target) return false;
    if (target.type === 'Wall') return false;
    if (target.type === 'TrickWall') return openWalls.has(`${level},${tileY},${tileX}`);
    return true;
}

function getDoorButtonFaceSignForView(
    partyPosition: [number, number],
    tileX: number,
    tileY: number,
    doorOrientation: GameTile['orientation'],
): 1 | -1 {
    const normalPositive = doorOrientation === 'WestEast' || doorOrientation === 'EastWest'
        ? { dx: 1, dy: 0 }
        : { dx: 0, dy: 1 };
    const toParty = {
        dx: partyPosition[1] - tileX,
        dy: partyPosition[0] - tileY,
    };
    const dot = normalPositive.dx * toParty.dx + normalPositive.dy * toParty.dy;
    return dot >= 0 ? 1 : -1;
}

const LEFT_FACE_BY_FACE: Record<CardinalDir, CardinalDir> = {
    North: 'West',
    South: 'East',
    East: 'North',
    West: 'South',
};

const RIGHT_FACE_BY_FACE: Record<CardinalDir, CardinalDir> = {
    North: 'East',
    South: 'West',
    East: 'South',
    West: 'North',
};

function isWallTextAnchorTile(tile: GameTile | undefined): boolean {
    return tile?.type === 'Wall' || tile?.type === 'TrickWall' || tile?.type === 'Door';
}

function resolveWallTextFace(map: GameMap, tile: GameTile, face: CardinalDir, text: string): CardinalDir {
    if (text === 'WELCOME\nBRAVE\nADVENTURERS.') {
        return 'West';
    }

    if (isWallTextAnchorTile(tile)) {
        return face;
    }

    const forward = WALL_TEXT_FACE_VECTORS[face];
    const forwardTile = map.tiles[tile.y + forward.dy]?.[tile.x + forward.dx];
    if (isWallTextAnchorTile(forwardTile)) {
        return face;
    }

    const leftFace = LEFT_FACE_BY_FACE[face];
    const leftStep = WALL_TEXT_FACE_VECTORS[leftFace];
    const leftTile = map.tiles[tile.y + leftStep.dy]?.[tile.x + leftStep.dx];
    if (isWallTextAnchorTile(leftTile)) {
        return leftFace;
    }

    const rightFace = RIGHT_FACE_BY_FACE[face];
    const rightStep = WALL_TEXT_FACE_VECTORS[rightFace];
    const rightTile = map.tiles[tile.y + rightStep.dy]?.[tile.x + rightStep.dx];
    if (isWallTextAnchorTile(rightTile)) {
        return rightFace;
    }

    return face;
}

const WallTextPlanes: React.FC<{ map: GameMap }> = memo(({ map }) => {
    const level = useStore(s => s.level);
    const visibleTexts = useStore(s => s.visibleTexts);
    const entries = useMemo(() => {
        const result: { tileX: number; tileY: number; face: CardinalDir; text: string }[] = [];
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Text') continue;
                    const t = obj as WallTextObject;
                    if (!t.text || CHAMPION_DATA_RE.test(t.text)) continue;
                    const visibilityKey = `${level}_${tile.x}_${tile.y}_${t.index}`;
                    if (!visibleTexts.has(visibilityKey)) continue;
                    result.push({
                        tileX: tile.x,
                        tileY: tile.y,
                        face: resolveWallTextFace(map, tile, t.tilePos as CardinalDir, t.text),
                        text: t.text,
                    });
                }
            }
        }
        return result;
    }, [level, map, visibleTexts]);

    return (
        <>
            {entries.map(({ tileX, tileY, face, text }, i) => (
                <WallTextEntry key={i} tileX={tileX} tileY={tileY} face={face} text={text} />
            ))}
        </>
    );
});

const LightController: React.FC = () => {
    const levelIndex = useStore(s => s.level);
    const spellLights      = useStore(s => s.spellLights);
    const torchBurnStart   = useStore(s => s.torchBurnStart);
    const championEquipment = useStore(s => s.championEquipment);
    const lightRef = useRef<THREE.AmbientLight>(null);

    useFrame(() => {
        if (!lightRef.current) return;
        if (levelIndex === 0) {
            lightRef.current.intensity += (1.15 - lightRef.current.intensity) * 0.04;
            lightRef.current.color.lerp(DUNGEON_AMBIENT_COLOR, 0.04);
            return;
        }

        const level  = computeLightLevel(spellLights, torchBurnStart, championEquipment);
        const target = 0.07 + Math.max(0, level) * 1.05;
        lightRef.current.intensity += (target - lightRef.current.intensity) * 0.04;

        const colorTarget = level > 0.35 ? DUNGEON_AMBIENT_COLOR : DUNGEON_DARK_AMBIENT_COLOR;
        lightRef.current.color.lerp(colorTarget, 0.025);
    });

    return <ambientLight ref={lightRef} intensity={0.1} color="#9aa6bd" />;
};

const DarknessOverlay: React.FC = () => {
    const levelIndex = useStore(s => s.level);
    const spellLights = useStore(s => s.spellLights);
    const torchBurnStart = useStore(s => s.torchBurnStart);
    const championEquipment = useStore(s => s.championEquipment);
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        const update = () => {
            if (levelIndex === 0) {
                setOpacity(0);
                return;
            }
            const level = computeLightLevel(spellLights, torchBurnStart, championEquipment);
            setOpacity(Math.max(0, 0.84 - level * 0.84));
        };

        update();
        const intervalId = window.setInterval(update, 250);
        return () => window.clearInterval(intervalId);
    }, [levelIndex, spellLights, torchBurnStart, championEquipment]);

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                background: `rgba(0, 0, 0, ${opacity})`,
                pointerEvents: 'none',
                zIndex: 2,
            }}
        />
    );
};

// ─── Projectile renderer ──────────────────────────────────────────────────────
const PROJ_COLORS: Record<MagicProjectileEffect, string> = {
    fireball: '#ff6200',
    lightning: '#aaddff',
    slime: '#a4d96a',
    poison_cloud: '#7cff88',
    poison_bolt: '#44ff66',
    open: '#8cf1ff',
    disrupt_nonmaterial: '#c8f6ff',
};

const FIREBALL_OUTER_COLOR = '#ff6f1a';
const FIREBALL_INNER_COLOR = '#ffcf5a';
const FIREBALL_CORE_COLOR = '#fff4d6';
const LIGHTNING_CORE_COLOR = '#f2fbff';
const DISRUPT_CORE_COLOR = '#effaff';

const WALL_DROP_OFFSET = GRID_SIZE / 2 + 0.06;
const WALL_DROP_POS: Record<CardinalDir, [number, number, number]> = {
    North: [0, -WALL_HEIGHT * 0.04, -WALL_DROP_OFFSET],
    South: [0, -WALL_HEIGHT * 0.04, WALL_DROP_OFFSET],
    East: [WALL_DROP_OFFSET, -WALL_HEIGHT * 0.04, 0],
    West: [-WALL_DROP_OFFSET, -WALL_HEIGHT * 0.04, 0],
};

export const FrontWallLockDropTarget = ({
    tileX,
    tileY,
    face,
    label,
    requirement,
    onUseItem,
}: {
    tileX: number;
    tileY: number;
    face: CardinalDir;
    label: string;
    requirement?: string;
    onUseItem: (championId: number, itemId: string, fromSlot: EquipSlotKey | 'inventory') => boolean;
}) => {
    const text = useI18n().dungeonScene;
    const [over, setOver] = useState(false);
    const [ox, oy, oz] = WALL_DROP_POS[face];

    return (
        <Html
            position={[tileX * GRID_SIZE + ox, oy, tileY * GRID_SIZE + oz]}
            center
            transform
            distanceFactor={6}
            style={{ pointerEvents: 'auto' }}
        >
            <div
                title={requirement ? text.dropSpecificItemOn(requirement, label) : text.dropRequiredItemOn(label)}
                onDragOver={(event) => {
                    event.preventDefault();
                    setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setOver(false);
                    const payload = getDragPayload(event);
                    if (!payload) return;
                    onUseItem(payload.fromChampionId, payload.itemId, payload.fromSlot);
                }}
                style={{
                    minWidth: 112,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `2px solid ${over ? '#f0cf7a' : '#8a6a2a'}`,
                    background: over ? 'rgba(35, 24, 5, 0.95)' : 'rgba(12, 10, 8, 0.9)',
                    color: '#f0dfb0',
                    fontFamily: '"Courier New", monospace',
                    fontSize: 12,
                    lineHeight: 1.2,
                    textAlign: 'center',
                    boxShadow: over ? '0 0 18px rgba(240, 207, 122, 0.45)' : '0 0 10px rgba(0, 0, 0, 0.4)',
                    userSelect: 'none',
                }}
            >
                <div style={{ fontSize: 18, marginBottom: 3 }}>{label === 'ALCOVE' ? '🕳' : label === 'RECEPTACLE' ? '🔥' : '🗝'}</div>
                <div>{label}</div>
                {requirement && <div style={{ marginTop: 4, color: '#d8bf84', fontSize: 10 }}>{requirement}</div>}
            </div>
        </Html>
    );
};

const FrontWallMechanismDropTarget = ({ kind, onUseItem, activeFloorDragItemId, selectedChampionId, onUseFloorItem }: {
    kind: 'wall-lock' | 'alcove' | 'object-exchanger';
    onUseItem: (championId: number, itemId: string, fromSlot: EquipSlotKey | 'inventory') => boolean;
    activeFloorDragItemId?: string | null;
    selectedChampionId?: number | null;
    onUseFloorItem?: (itemId: string, championId: number) => boolean;
}) => {
    const text = useI18n().dungeonScene;
    const [over, setOver] = useState(false);
    const isLock = kind === 'wall-lock';
    const isAlcove = kind === 'alcove';
    const apertureStyle: React.CSSProperties = isLock
        ? {
            width: 28,
            height: 42,
            borderRadius: '50% 50% 44% 44% / 42% 42% 58% 58%',
            border: `2px solid ${over ? '#f2d27f' : '#b28a38'}`,
            background: 'radial-gradient(circle at 50% 28%, rgba(255,226,157,0.18), rgba(0,0,0,0.92) 56%)',
            boxShadow: over ? '0 0 14px rgba(242, 210, 127, 0.34)' : 'inset 0 0 12px rgba(0,0,0,0.75)',
        }
        : isAlcove
            ? {
                width: 76,
                height: 42,
                borderRadius: 6,
                border: `2px solid ${over ? '#f2d27f' : '#9f7730'}`,
                background: 'linear-gradient(180deg, rgba(18,18,18,0.38), rgba(0,0,0,0.94))',
                boxShadow: over ? '0 0 16px rgba(242, 210, 127, 0.32)' : 'inset 0 0 14px rgba(0,0,0,0.82)',
            }
            : {
                width: 68,
                height: 16,
                borderRadius: 999,
                border: `2px solid ${over ? '#f2d27f' : '#9f7730'}`,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.92), rgba(18,18,18,0.55))',
                boxShadow: over ? '0 0 14px rgba(242, 210, 127, 0.3)' : 'inset 0 0 12px rgba(0,0,0,0.72)',
            };

    return (
        <div
            data-dm-front-wall-drop="true"
            onDragEnter={(event) => {
                event.preventDefault();
                setOver(true);
            }}
            onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = 'move';
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOver(false);
                const payload = getDragPayload(event);
                if (!payload) return;
                onUseItem(payload.fromChampionId, payload.itemId, payload.fromSlot);
            }}
            onMouseEnter={() => {
                if (activeFloorDragItemId) setOver(true);
            }}
            onMouseLeave={() => setOver(false)}
            onMouseUp={(event) => {
                if (!activeFloorDragItemId || selectedChampionId == null || !onUseFloorItem) return;
                event.preventDefault();
                event.stopPropagation();
                setOver(false);
                onUseFloorItem(activeFloorDragItemId, selectedChampionId);
            }}
            style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: isLock ? 96 : isAlcove ? 132 : 124,
                minHeight: 78,
                padding: '8px 10px',
                borderRadius: 12,
                border: `2px solid ${over ? 'rgba(240,207,122,0.88)' : 'rgba(138,106,42,0.28)'}`,
                background: over ? 'rgba(28,20,8,0.18)' : 'rgba(0,0,0,0.01)',
                userSelect: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                pointerEvents: 'auto',
                boxShadow: over ? '0 0 18px rgba(240, 207, 122, 0.22)' : 'none',
                zIndex: 130,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    minHeight: 42,
                }}
            >
                <div style={apertureStyle} />
            </div>
            <div style={{ color: over ? '#f4dda1' : '#b8995d', fontSize: 10, fontFamily: '"Courier New", monospace', textAlign: 'center' }}>
                {isLock ? text.dropKeyHere : isAlcove ? text.placeItemHere : text.offerItemHere}
            </div>
        </div>
    );
};

const ProjectileRenderer: React.FC = () => {
    const projectiles = useStore(s => s.projectiles);
    const level = useStore(s => s.level);
    const activeProjectiles = useMemo(
        () => projectiles.filter(p => p.level === level),
        [projectiles, level],
    );
    const sphereShellGeometry = useMemo(() => new THREE.SphereGeometry(0.28, 14, 14), []);
    const sphereGlowGeometry = useMemo(() => new THREE.SphereGeometry(0.2, 12, 12), []);
    const sphereCoreGeometry = useMemo(() => new THREE.SphereGeometry(0.14, 10, 10), []);
    const fireballFlareGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.36, 0), []);
    const poisonCloudGeometry = useMemo(() => new THREE.SphereGeometry(0.24, 10, 10), []);
    const lightningBoltGeometry = useMemo(() => new THREE.CylinderGeometry(0.035, 0.08, 0.7, 6, 1), []);
    const disruptRingGeometry = useMemo(() => new THREE.TorusGeometry(0.19, 0.035, 10, 24), []);
    const coreMaterials = useMemo<Record<MagicProjectileEffect, THREE.MeshBasicMaterial>>(
        () => ({
            fireball: new THREE.MeshBasicMaterial({ color: FIREBALL_CORE_COLOR, toneMapped: false }),
            lightning: new THREE.MeshBasicMaterial({ color: LIGHTNING_CORE_COLOR, toneMapped: false }),
            slime: new THREE.MeshBasicMaterial({ color: '#f2ffd4', toneMapped: false }),
            poison_cloud: new THREE.MeshBasicMaterial({ color: '#dcffd7', toneMapped: false }),
            poison_bolt: new THREE.MeshBasicMaterial({ color: '#e7ffe7', toneMapped: false }),
            open: new THREE.MeshBasicMaterial({ color: '#fff5d0', toneMapped: false }),
            disrupt_nonmaterial: new THREE.MeshBasicMaterial({ color: DISRUPT_CORE_COLOR, toneMapped: false }),
        }),
        [],
    );
    const glowMaterials = useMemo<Record<MagicProjectileEffect, THREE.MeshBasicMaterial>>(
        () => ({
            fireball: createPulseMaterial(FIREBALL_OUTER_COLOR, 0.28),
            lightning: createPulseMaterial(PROJ_COLORS.lightning, 0.22),
            slime: createPulseMaterial(PROJ_COLORS.slime, 0.22),
            poison_cloud: createPulseMaterial(PROJ_COLORS.poison_cloud, 0.22),
            poison_bolt: createPulseMaterial(PROJ_COLORS.poison_bolt, 0.2),
            open: createPulseMaterial(PROJ_COLORS.open, 0.18),
            disrupt_nonmaterial: createPulseMaterial(PROJ_COLORS.disrupt_nonmaterial, 0.2),
        }),
        [],
    );
    const accentMaterials = useMemo<Record<MagicProjectileEffect, THREE.MeshBasicMaterial>>(
        () => ({
            fireball: createPulseMaterial(FIREBALL_INNER_COLOR, 0.36),
            lightning: createPulseMaterial('#dff2ff', 0.32),
            slime: createPulseMaterial('#d8f59a', 0.3),
            poison_cloud: createPulseMaterial('#c8ffb8', 0.24),
            poison_bolt: createPulseMaterial('#8cff6f', 0.3),
            open: createPulseMaterial('#baf7ff', 0.26),
            disrupt_nonmaterial: createPulseMaterial('#9be8ff', 0.26),
        }),
        [],
    );

    useEffect(() => () => {
        sphereShellGeometry.dispose();
        sphereGlowGeometry.dispose();
        sphereCoreGeometry.dispose();
        fireballFlareGeometry.dispose();
        poisonCloudGeometry.dispose();
        lightningBoltGeometry.dispose();
        disruptRingGeometry.dispose();
        Object.values(coreMaterials).forEach(mat => mat.dispose());
        Object.values(glowMaterials).forEach(mat => mat.dispose());
        Object.values(accentMaterials).forEach(mat => mat.dispose());
    }, [
        sphereShellGeometry,
        sphereGlowGeometry,
        sphereCoreGeometry,
        fireballFlareGeometry,
        poisonCloudGeometry,
        lightningBoltGeometry,
        disruptRingGeometry,
        coreMaterials,
        glowMaterials,
        accentMaterials,
    ]);

    return (
        <>
            {activeProjectiles.map((p, index) => (
                p.effect === 'physical' && p.physicalItem ? (
                    <PhysicalProjectileSprite key={p.id} projectile={{ ...p, physicalItem: p.physicalItem }} />
                ) : (
                    <ProjectileOrb
                        key={p.id}
                        projectile={p as typeof p & { effect: MagicProjectileEffect }}
                        index={index}
                        sphereShellGeometry={sphereShellGeometry}
                        sphereGlowGeometry={sphereGlowGeometry}
                        sphereCoreGeometry={sphereCoreGeometry}
                        poisonCloudGeometry={poisonCloudGeometry}
                        lightningBoltGeometry={lightningBoltGeometry}
                        disruptRingGeometry={disruptRingGeometry}
                        coreMaterial={coreMaterials[p.effect as MagicProjectileEffect]}
                        glowMaterial={glowMaterials[p.effect as MagicProjectileEffect]}
                        accentMaterial={accentMaterials[p.effect as MagicProjectileEffect]}
                    />
                )
            ))}
        </>
    );
};

const ProjectileOrb: React.FC<{
    projectile: { x: number; y: number; effect: MagicProjectileEffect; direction?: Direction; visualScale?: number };
    index: number;
    sphereShellGeometry: THREE.SphereGeometry;
    sphereGlowGeometry: THREE.SphereGeometry;
    sphereCoreGeometry: THREE.SphereGeometry;
    poisonCloudGeometry: THREE.SphereGeometry;
    lightningBoltGeometry: THREE.CylinderGeometry;
    disruptRingGeometry: THREE.TorusGeometry;
    coreMaterial: THREE.MeshBasicMaterial;
    glowMaterial: THREE.MeshBasicMaterial;
    accentMaterial: THREE.MeshBasicMaterial;
}> = ({
    projectile,
    index,
    sphereShellGeometry,
    sphereGlowGeometry,
    sphereCoreGeometry,
    poisonCloudGeometry,
    lightningBoltGeometry,
    disruptRingGeometry,
    coreMaterial,
    glowMaterial,
    accentMaterial,
}) => {
    const directionRotation: Record<Direction, number> = {
        NORTH: 0,
        SOUTH: Math.PI,
        EAST: -Math.PI / 2,
        WEST: Math.PI / 2,
    };
    const visualScale = projectile.visualScale ?? 1;

    return (
        <group position={[projectile.x * GRID_SIZE, 0, projectile.y * GRID_SIZE]}>
            {projectile.effect === 'fireball' ? (
                <PhotonsFireball scale={visualScale} />
            ) : projectile.effect === 'lightning' ? (
                <LightningProjectileVisual
                    seed={index}
                    visualScale={visualScale}
                    directionRotation={directionRotation[projectile.direction ?? 'NORTH']}
                    sphereGlowGeometry={sphereGlowGeometry}
                    sphereCoreGeometry={sphereCoreGeometry}
                    lightningBoltGeometry={lightningBoltGeometry}
                    coreMaterial={coreMaterial}
                    glowMaterial={glowMaterial}
                    accentMaterial={accentMaterial}
                />
            ) : projectile.effect === 'open' ? (
                <OpenDoorProjectileVisual visualScale={visualScale} />
            ) : projectile.effect === 'poison_cloud' || projectile.effect === 'poison_bolt' || projectile.effect === 'slime' ? (
                <PoisonProjectileVisual
                    seed={index}
                    effect={projectile.effect}
                    visualScale={visualScale}
                    sphereShellGeometry={sphereShellGeometry}
                    sphereCoreGeometry={sphereCoreGeometry}
                    poisonCloudGeometry={poisonCloudGeometry}
                    coreMaterial={coreMaterial}
                    glowMaterial={glowMaterial}
                    accentMaterial={accentMaterial}
                />
            ) : (
                <DisruptProjectileVisual
                    seed={index}
                    visualScale={visualScale}
                    sphereShellGeometry={sphereShellGeometry}
                    sphereGlowGeometry={sphereGlowGeometry}
                    sphereCoreGeometry={sphereCoreGeometry}
                    disruptRingGeometry={disruptRingGeometry}
                    coreMaterial={coreMaterial}
                    glowMaterial={glowMaterial}
                    accentMaterial={accentMaterial}
                />
            )}
        </group>
    );
};

const OpenDoorProjectileVisual: React.FC<{ visualScale: number }> = ({ visualScale }) => {
    return <PhotonsOpenDoorProjectile scale={visualScale} />;
};

const LightningProjectileVisual: React.FC<{
    seed: number;
    visualScale: number;
    directionRotation: number;
    sphereGlowGeometry: THREE.SphereGeometry;
    sphereCoreGeometry: THREE.SphereGeometry;
    lightningBoltGeometry: THREE.CylinderGeometry;
    coreMaterial: THREE.MeshBasicMaterial;
    glowMaterial: THREE.MeshBasicMaterial;
    accentMaterial: THREE.MeshBasicMaterial;
}> = ({ visualScale, directionRotation }) => {
    return <PhotonsLightningProjectile scale={visualScale} directionRotation={directionRotation} />;
};

const PoisonProjectileVisual: React.FC<{
    seed: number;
    effect: 'poison_cloud' | 'poison_bolt' | 'slime';
    visualScale: number;
    sphereShellGeometry: THREE.SphereGeometry;
    sphereCoreGeometry: THREE.SphereGeometry;
    poisonCloudGeometry: THREE.SphereGeometry;
    coreMaterial: THREE.MeshBasicMaterial;
    glowMaterial: THREE.MeshBasicMaterial;
    accentMaterial: THREE.MeshBasicMaterial;
}> = ({ effect, visualScale }) => {
    return <PhotonsPoisonProjectile effect={effect} scale={visualScale} />;
};

const DisruptProjectileVisual: React.FC<{
    seed: number;
    visualScale: number;
    sphereShellGeometry: THREE.SphereGeometry;
    sphereGlowGeometry: THREE.SphereGeometry;
    sphereCoreGeometry: THREE.SphereGeometry;
    disruptRingGeometry: THREE.TorusGeometry;
    coreMaterial: THREE.MeshBasicMaterial;
    glowMaterial: THREE.MeshBasicMaterial;
    accentMaterial: THREE.MeshBasicMaterial;
}> = ({ visualScale }) => {
    return <PhotonsDisruptProjectile scale={visualScale} />;
};

const PhysicalProjectileSprite: React.FC<{
    projectile: { x: number; y: number; physicalItem: FloorItem };
}> = ({ projectile }) => {
    const imagePath = getFloorItemImage(projectile.physicalItem);
    const baseTex = useTexture(imagePath);
    const tex = useMemo(() => {
        const next = baseTex.clone();
        next.colorSpace = THREE.SRGBColorSpace;
        next.needsUpdate = true;
        return next;
    }, [baseTex]);

    useEffect(() => () => tex.dispose(), [tex]);

    const image = tex.image as { width: number; height: number } | undefined;
    const aspect = image ? image.width / image.height : 1;
    const width = GRID_SIZE * 0.34;
    const height = width / aspect;

    return (
        <Billboard
            position={[projectile.x * GRID_SIZE, GRID_SIZE * 0.05, projectile.y * GRID_SIZE]}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
        >
            <Plane args={[width, height]}>
                <meshBasicMaterial
                    map={tex}
                    transparent
                    alphaTest={0.05}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </Plane>
        </Billboard>
    );
};

const ShieldAuraLayer: React.FC = () => {
    const activeShields = useStore(s => s.activeShields);
    const position = useStore(s => s.position);
    const ringRef = useRef<THREE.Mesh>(null);
    const fireRef = useRef<THREE.Mesh>(null);
    const shellRef = useRef<THREE.Mesh>(null);
    const ringGeometry = useMemo(() => new THREE.TorusGeometry(GRID_SIZE * 0.42, 0.04, 12, 48), []);
    const shellGeometry = useMemo(() => new THREE.SphereGeometry(GRID_SIZE * 0.42, 18, 18), []);
    const magicMaterial = useMemo(() => createPulseMaterial('#7dc8ff', 0.24), []);
    const fireMaterial = useMemo(() => createPulseMaterial('#ff8a3d', 0.22), []);
    const shellMaterial = useMemo(() => createPulseMaterial('#f5f1da', 0.08), []);

    useEffect(() => () => {
        ringGeometry.dispose();
        shellGeometry.dispose();
        magicMaterial.dispose();
        fireMaterial.dispose();
        shellMaterial.dispose();
    }, [ringGeometry, shellGeometry, magicMaterial, fireMaterial, shellMaterial]);

    const magicActive = activeShields.some((shield) => (shield.kind ?? (shield.fireOnly ? 'fire' : 'physical')) === 'magic');
    const fireActive = activeShields.some((shield) => (shield.kind ?? (shield.fireOnly ? 'fire' : 'physical')) === 'fire');
    if (!magicActive && !fireActive) return null;

    return (
        <ShieldAuraVisual
            position={[position[1] * GRID_SIZE, 0, position[0] * GRID_SIZE]}
            magicActive={magicActive}
            fireActive={fireActive}
            ringGeometry={ringGeometry}
            shellGeometry={shellGeometry}
            magicMaterial={magicMaterial}
            fireMaterial={fireMaterial}
            shellMaterial={shellMaterial}
            ringRef={ringRef}
            fireRef={fireRef}
            shellRef={shellRef}
        />
    );
};

const ShieldAuraVisual: React.FC<{
    position: [number, number, number];
    magicActive: boolean;
    fireActive: boolean;
    ringGeometry: THREE.TorusGeometry;
    shellGeometry: THREE.SphereGeometry;
    magicMaterial: THREE.MeshBasicMaterial;
    fireMaterial: THREE.MeshBasicMaterial;
    shellMaterial: THREE.MeshBasicMaterial;
    ringRef: React.RefObject<THREE.Mesh | null>;
    fireRef: React.RefObject<THREE.Mesh | null>;
    shellRef: React.RefObject<THREE.Mesh | null>;
}> = ({ position, magicActive, fireActive, ringGeometry, shellGeometry, magicMaterial, fireMaterial, shellMaterial, ringRef, fireRef, shellRef }) => {
    const phaseRef = useRef(0);
    useFrame((_, delta) => {
        phaseRef.current += delta * 2.2;
        const phase = phaseRef.current;
        if (ringRef.current) {
            ringRef.current.rotation.x = Math.PI / 2 + Math.sin(phase) * 0.08;
            ringRef.current.rotation.z += delta * 0.9;
            ringRef.current.scale.setScalar(1 + Math.sin(phase * 1.5) * 0.04);
        }
        if (fireRef.current) {
            fireRef.current.rotation.x = Math.PI / 2 - Math.sin(phase * 1.2) * 0.12;
            fireRef.current.rotation.z -= delta * 1.2;
            fireRef.current.scale.setScalar(1 + Math.cos(phase * 1.7) * 0.05);
        }
        if (shellRef.current) {
            shellRef.current.scale.setScalar(1 + Math.sin(phase * 0.9) * 0.03);
        }
    });

    return (
        <group position={position}>
            <mesh ref={shellRef} geometry={shellGeometry} material={shellMaterial} />
            {magicActive && <mesh ref={ringRef} geometry={ringGeometry} material={magicMaterial} rotation={[Math.PI / 2, 0, 0]} />}
            {fireActive && <mesh ref={fireRef} geometry={ringGeometry} material={fireMaterial} rotation={[Math.PI / 2, 0, 0]} scale={1.12} />}
        </group>
    );
};

const FluxcageLayer: React.FC = () => {
    const creatures = useStore(s => s.creatures);
    const level = useStore(s => s.level);
    const gamePhase = useStore(s => s.gamePhase);
    const endgameSequence = useStore(s => s.endgameSequence);
    const nowMs = useWallClock();
    const hideFluxcages = gamePhase === 'endgame' && Boolean(endgameSequence?.hideFluxcages);
    const activeCreatures = useMemo(
        () => hideFluxcages
            ? []
            : creatures.filter((creature) => creature.alive && creature.mapIndex === level && getCreatureFluxcageExpiry(creature.id) > nowMs),
        [creatures, level, nowMs, hideFluxcages],
    );
    const ringGeometry = useMemo(() => new THREE.TorusGeometry(0.28, 0.02, 8, 24), []);
    const barGeometry = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 0.8, 6), []);
    const ringMaterial = useMemo(() => createPulseMaterial('#62e7ff', 0.32), []);
    const barMaterial = useMemo(() => createPulseMaterial('#c8fbff', 0.24), []);

    useEffect(() => () => {
        ringGeometry.dispose();
        barGeometry.dispose();
        ringMaterial.dispose();
        barMaterial.dispose();
    }, [ringGeometry, barGeometry, ringMaterial, barMaterial]);

    return (
        <>
            {activeCreatures.map((creature) => (
                <FluxcageVisual
                    key={`flux_${creature.id}`}
                    creature={creature}
                    ringGeometry={ringGeometry}
                    barGeometry={barGeometry}
                    ringMaterial={ringMaterial}
                    barMaterial={barMaterial}
                />
            ))}
        </>
    );
};

const FluxcageVisual: React.FC<{
    creature: CreatureInstance;
    ringGeometry: THREE.TorusGeometry;
    barGeometry: THREE.CylinderGeometry;
    ringMaterial: THREE.MeshBasicMaterial;
    barMaterial: THREE.MeshBasicMaterial;
}> = ({ creature, ringGeometry, barGeometry, ringMaterial, barMaterial }) => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((_, delta) => {
        if (!groupRef.current) return;
        groupRef.current.rotation.y += delta * 1.35;
        const pulse = 1 + Math.sin(Date.now() / 140) * 0.04;
        groupRef.current.scale.setScalar(pulse);
    });

    return (
        <group ref={groupRef} position={[creature.x * GRID_SIZE, 0, creature.y * GRID_SIZE]}>
            <mesh geometry={ringGeometry} material={ringMaterial} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} />
            <mesh geometry={ringGeometry} material={ringMaterial} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} scale={0.82} />
            <mesh geometry={barGeometry} material={barMaterial} position={[0.22, 0, 0.22]} />
            <mesh geometry={barGeometry} material={barMaterial} position={[-0.22, 0, 0.22]} />
            <mesh geometry={barGeometry} material={barMaterial} position={[0.22, 0, -0.22]} />
            <mesh geometry={barGeometry} material={barMaterial} position={[-0.22, 0, -0.22]} />
        </group>
    );
};

const PoisonCloudLayer: React.FC = () => {
    const activePoisonClouds = useStore((state) => state.activePoisonClouds);
    const level = useStore((state) => state.level);
    const clouds = useMemo(
        () => activePoisonClouds.filter((cloud) => cloud.level === level),
        [activePoisonClouds, level],
    );

    return (
        <>
            {clouds.map((cloud) => (
                <PersistentPoisonCloudVisual key={cloud.id} cloud={cloud} />
            ))}
        </>
    );
};

const PersistentPoisonCloudVisual: React.FC<{
    cloud: { x: number; y: number; visualScale?: number };
}> = ({ cloud }) => {
    const groupRef = useRef<THREE.Group>(null);
    const lightRef = useRef<THREE.PointLight>(null);

    useFrame((_, delta) => {
        if (!groupRef.current) return;
        groupRef.current.rotation.y += delta * 0.18;
        const pulse = 1 + Math.sin(Date.now() / 180) * 0.05;
        groupRef.current.scale.setScalar(pulse);
        if (lightRef.current) {
            lightRef.current.intensity = 0.32 + ((Math.sin(Date.now() / 220) + 1) * 0.08);
        }
    });

    return (
        <group position={[cloud.x * GRID_SIZE, GRID_SIZE * 0.02, cloud.y * GRID_SIZE]}>
            <group ref={groupRef}>
                <PhotonsPoisonProjectile effect="poison_cloud" scale={(cloud.visualScale ?? 1) * 1.16} />
            </group>
            <pointLight
                ref={lightRef}
                color="#8cff8b"
                intensity={0.36}
                distance={GRID_SIZE * 1.4}
                decay={2}
                position={[0, GRID_SIZE * 0.16, 0]}
            />
        </group>
    );
};

const SpellImpactLayer: React.FC = () => {
    const spellVisualEvents = useStore(s => s.spellVisualEvents);
    const level = useStore(s => s.level);
    const impacts = useMemo(
        () => spellVisualEvents.filter((event) => event.level === level),
        [spellVisualEvents, level],
    );
    const ringGeometry = useMemo(() => new THREE.RingGeometry(0.1, 0.26, 24), []);
    const fireMaterial = useMemo(() => createPulseMaterial('#ff8a3d', 0.42), []);
    const fireCoreMaterial = useMemo(() => createPulseMaterial('#ffd97a', 0.7), []);
    const fireFlameMaterial = useMemo(() => createPulseMaterial('#ffbe55', 0.58), []);
    const lightningMaterial = useMemo(() => createPulseMaterial('#d7f7ff', 0.34), []);
    const lightningCoreMaterial = useMemo(() => createPulseMaterial('#ffffff', 0.8), []);
    const lightningArcMaterial = useMemo(() => createPulseMaterial('#8fdfff', 0.48), []);
    const poisonMaterial = useMemo(() => createPulseMaterial('#8cff8b', 0.32), []);
    const poisonCoreMaterial = useMemo(() => createPulseMaterial('#d6ff9f', 0.56), []);
    const poisonMistMaterial = useMemo(() => createPulseMaterial('#6fdb75', 0.28), []);
    const openMaterial = useMemo(() => createPulseMaterial('#8cf1ff', 0.28), []);
    const openCoreMaterial = useMemo(() => createPulseMaterial('#fff6c8', 0.5), []);
    const openSparkMaterial = useMemo(() => createPulseMaterial('#b9ffff', 0.34), []);
    const disruptMaterial = useMemo(() => createPulseMaterial('#aeefff', 0.3), []);
    const disruptCoreMaterial = useMemo(() => createPulseMaterial('#f3ffff', 0.52), []);
    const disruptShardMaterial = useMemo(() => createPulseMaterial('#8dd8ff', 0.34), []);
    const dustMaterial = useMemo(() => createPulseMaterial('#c9a56c', 0.38), []);

    useEffect(() => () => {
        ringGeometry.dispose();
        fireMaterial.dispose();
        fireCoreMaterial.dispose();
        fireFlameMaterial.dispose();
        lightningMaterial.dispose();
        lightningCoreMaterial.dispose();
        lightningArcMaterial.dispose();
        poisonMaterial.dispose();
        poisonCoreMaterial.dispose();
        poisonMistMaterial.dispose();
        openMaterial.dispose();
        openCoreMaterial.dispose();
        openSparkMaterial.dispose();
        disruptMaterial.dispose();
        disruptCoreMaterial.dispose();
        disruptShardMaterial.dispose();
        dustMaterial.dispose();
    }, [
        ringGeometry,
        fireMaterial,
        fireCoreMaterial,
        fireFlameMaterial,
        lightningMaterial,
        lightningCoreMaterial,
        lightningArcMaterial,
        poisonMaterial,
        poisonCoreMaterial,
        poisonMistMaterial,
        openMaterial,
        openCoreMaterial,
        openSparkMaterial,
        disruptMaterial,
        disruptCoreMaterial,
        disruptShardMaterial,
        dustMaterial,
    ]);

    const materialByEffect: Record<SpellVisualEvent['effect'], THREE.MeshBasicMaterial> = {
        fireball: fireMaterial,
        lightning: lightningMaterial,
        slime: poisonMaterial,
        poison_cloud: poisonMaterial,
        poison_bolt: poisonMaterial,
        open: openMaterial,
        disrupt_nonmaterial: disruptMaterial,
    };

    return (
        <>
            {impacts.map((event) => event.kind === 'death' ? (
                <DeathDustBurst key={`impact_${event.id}`} event={event} material={dustMaterial} />
            ) : event.effect === 'fireball' ? (
                <FireballImpactBurst
                    key={`impact_${event.id}`}
                    event={event}
                    ringGeometry={ringGeometry}
                    material={fireMaterial}
                    coreMaterial={fireCoreMaterial}
                    flameMaterial={fireFlameMaterial}
                />
            ) : event.effect === 'lightning' ? (
                <LightningImpactBurst
                    key={`impact_${event.id}`}
                    event={event}
                    ringGeometry={ringGeometry}
                    material={lightningMaterial}
                    coreMaterial={lightningCoreMaterial}
                    arcMaterial={lightningArcMaterial}
                />
            ) : event.effect === 'poison_bolt' || event.effect === 'poison_cloud' || event.effect === 'slime' ? (
                <PoisonImpactBurst
                    key={`impact_${event.id}`}
                    event={event}
                    ringGeometry={ringGeometry}
                    material={poisonMaterial}
                    coreMaterial={poisonCoreMaterial}
                    mistMaterial={poisonMistMaterial}
                />
            ) : event.effect === 'open' ? (
                <OpenDoorImpactBurst
                    key={`impact_${event.id}`}
                    event={event}
                    ringGeometry={ringGeometry}
                    material={openMaterial}
                    coreMaterial={openCoreMaterial}
                    sparkMaterial={openSparkMaterial}
                />
            ) : event.effect === 'disrupt_nonmaterial' ? (
                <DisruptImpactBurst
                    key={`impact_${event.id}`}
                    event={event}
                    ringGeometry={ringGeometry}
                    material={disruptMaterial}
                    coreMaterial={disruptCoreMaterial}
                    shardMaterial={disruptShardMaterial}
                />
            ) : (
                <SpellImpactPulse
                    key={`impact_${event.id}`}
                    event={event}
                    geometry={ringGeometry}
                    material={materialByEffect[event.effect]}
                />
            ))}
        </>
    );
};

const PoisonImpactBurst: React.FC<{
    event: SpellVisualEvent;
    ringGeometry: THREE.RingGeometry;
    material: THREE.MeshBasicMaterial;
    coreMaterial: THREE.MeshBasicMaterial;
    mistMaterial: THREE.MeshBasicMaterial;
}> = ({ event, ringGeometry, material, coreMaterial, mistMaterial }) => {
    const ringRef = useRef<THREE.Mesh>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const mistNodes = useMemo(
        () => Array.from({ length: event.effect === 'poison_cloud' ? 9 : event.effect === 'slime' ? 7 : 6 }, (_, index) => {
            const count = event.effect === 'poison_cloud' ? 9 : event.effect === 'slime' ? 7 : 6;
            const angle = (index / count) * Math.PI * 2;
            const spread = 0.08 + (index % 3) * 0.04;
            const drift = 0.09 + (index % 4) * 0.035;
            const rise = 0.08 + (index % 3) * 0.03;
            return { x: Math.cos(angle) * spread, z: Math.sin(angle) * spread, drift, rise, phase: index * 0.65 };
        }),
        [event.effect],
    );

    useFrame(() => {
        const duration = event.effect === 'poison_cloud' ? 760 : event.effect === 'slime' ? 620 : 580;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
        const spellScale = (event.visualScale ?? 1) * (event.effect === 'poison_cloud' ? 1.22 : event.effect === 'slime' ? 1.02 : 0.95);

        if (ringRef.current) {
            ringRef.current.scale.setScalar((0.64 + t * 1.65) * spellScale);
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.34;
            ringRef.current.visible = t < 1;
        }

        if (coreRef.current) {
            coreRef.current.scale.setScalar((0.28 + Math.sin(Math.PI * t) * 0.54) * spellScale);
            (coreRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.44;
            coreRef.current.visible = t < 1;
        }

        if (lightRef.current) {
            lightRef.current.intensity = Math.max(0, (1 - t) * (event.effect === 'poison_cloud' ? 1.1 : event.effect === 'slime' ? 0.9 : 0.8) * Math.max(1, spellScale * 0.85));
            lightRef.current.distance = GRID_SIZE * (event.effect === 'poison_cloud' ? 1.65 : event.effect === 'slime' ? 1.42 : 1.3) * Math.max(1, spellScale * 0.85);
        }
    });

    return (
        <group
            position={[
                event.x * GRID_SIZE + (event.offsetX ?? 0),
                event.height ?? GRID_SIZE * 0.06,
                event.y * GRID_SIZE + (event.offsetZ ?? 0),
            ]}
        >
            <mesh
                ref={ringRef}
                rotation={[-Math.PI / 2, 0, 0]}
                geometry={ringGeometry}
                material={material}
                frustumCulled={false}
            />
            <mesh ref={coreRef} material={coreMaterial} frustumCulled={false}>
                <sphereGeometry args={[0.16, 10, 10]} />
            </mesh>
            {mistNodes.map((mist, index) => (
                <PoisonImpactWisp
                    key={`poison_wisp_${index}`}
                    event={event}
                    material={mistMaterial}
                    offset={mist}
                />
            ))}
            <pointLight
                ref={lightRef}
                color="#95ff7d"
                intensity={0}
                distance={GRID_SIZE * 1.35}
                decay={2}
                position={[0, GRID_SIZE * 0.16, 0]}
            />
        </group>
    );
};

const PoisonImpactWisp: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    offset: { x: number; z: number; drift: number; rise: number; phase: number };
}> = ({ event, material, offset }) => {
    const wispRef = useRef<THREE.Mesh>(null);
    useFrame(() => {
        if (!wispRef.current) return;
        const duration = event.effect === 'poison_cloud' ? 760 : 580;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
        const spellScale = (event.visualScale ?? 1) * (event.effect === 'poison_cloud' ? 1.18 : 0.92);
        wispRef.current.position.x = offset.x * (0.55 + t * 1.9) * spellScale;
        wispRef.current.position.z = offset.z * (0.55 + t * 1.9) * spellScale;
        wispRef.current.position.y = (offset.rise * Math.sin(Math.PI * t) + Math.sin(offset.phase + t * Math.PI * 2) * 0.03) * spellScale;
        wispRef.current.scale.set(
            (0.22 + (1 - t) * 0.08) * spellScale,
            (0.18 + Math.sin(Math.PI * t) * offset.drift) * spellScale,
            (0.22 + (1 - t) * 0.08) * spellScale,
        );
        (wispRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * (event.effect === 'poison_cloud' ? 0.3 : 0.38);
        wispRef.current.visible = t < 1;
    });

    return (
        <mesh ref={wispRef} material={material} frustumCulled={false}>
            <sphereGeometry args={[0.1, 8, 8]} />
        </mesh>
    );
};

const LightningImpactBurst: React.FC<{
    event: SpellVisualEvent;
    ringGeometry: THREE.RingGeometry;
    material: THREE.MeshBasicMaterial;
    coreMaterial: THREE.MeshBasicMaterial;
    arcMaterial: THREE.MeshBasicMaterial;
}> = ({ event, ringGeometry, material, coreMaterial, arcMaterial }) => {
    const ringRef = useRef<THREE.Mesh>(null);
    const flashRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const arcs = useMemo(
        () => Array.from({ length: 6 }, (_, index) => ({
            angle: (index / 6) * Math.PI * 2,
            tilt: index % 2 === 0 ? 0.32 : -0.32,
            reach: 0.34 + (index % 3) * 0.05,
            rise: 0.03 + (index % 2) * 0.035,
        })),
        [],
    );

    useFrame(() => {
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / 300));
        const visualScale = event.visualScale ?? 1;

        if (ringRef.current) {
            ringRef.current.scale.setScalar((0.58 + t * 1.25) * visualScale);
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.42;
            ringRef.current.visible = t < 1;
        }

        if (flashRef.current) {
            flashRef.current.scale.setScalar((0.26 + Math.sin(Math.PI * t) * 0.72) * visualScale);
            (flashRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.68;
            flashRef.current.visible = t < 1;
        }

        if (lightRef.current) {
            lightRef.current.intensity = Math.max(0, (1 - t) * 2.35 * Math.max(1, visualScale));
            lightRef.current.distance = GRID_SIZE * (1.85 + visualScale * 0.55);
        }
    });

    return (
        <group
            position={[
                event.x * GRID_SIZE + (event.offsetX ?? 0),
                event.height ?? GRID_SIZE * 0.05,
                event.y * GRID_SIZE + (event.offsetZ ?? 0),
            ]}
        >
            <mesh
                ref={ringRef}
                rotation={[-Math.PI / 2, 0, 0]}
                geometry={ringGeometry}
                material={material}
                frustumCulled={false}
            />
            <mesh ref={flashRef} material={coreMaterial} frustumCulled={false}>
                <sphereGeometry args={[0.12, 10, 10]} />
            </mesh>
            {arcs.map((arc, index) => (
                <LightningImpactArc
                    key={`lightning_arc_${index}`}
                    event={event}
                    material={arcMaterial}
                    arc={arc}
                />
            ))}
            <pointLight
                ref={lightRef}
                color="#c7f1ff"
                intensity={0}
                distance={GRID_SIZE * 1.7}
                decay={2}
                position={[0, GRID_SIZE * 0.16, 0]}
            />
        </group>
    );
};

const LightningImpactArc: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    arc: { angle: number; tilt: number; reach: number; rise: number };
}> = ({ event, material, arc }) => {
    const arcRef = useRef<THREE.Mesh>(null);
    useFrame(() => {
        if (!arcRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / 300));
        const visualScale = event.visualScale ?? 1;
        arcRef.current.position.x = Math.cos(arc.angle) * arc.reach * (0.3 + t * 0.95) * visualScale;
        arcRef.current.position.z = Math.sin(arc.angle) * arc.reach * (0.3 + t * 0.95) * visualScale;
        arcRef.current.position.y = arc.rise * Math.sin(Math.PI * t) * visualScale;
        arcRef.current.rotation.y = arc.angle;
        arcRef.current.rotation.z = arc.tilt + Math.sin((arc.angle * 2) + t * Math.PI * 3) * 0.18;
        arcRef.current.scale.set(
            (0.06 + (1 - t) * 0.03) * visualScale,
            (0.45 + Math.sin(Math.PI * t) * 0.28) * visualScale,
            (0.06 + (1 - t) * 0.03) * visualScale,
        );
        (arcRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.6;
        arcRef.current.visible = t < 1;
    });

    return (
        <mesh ref={arcRef} material={material} frustumCulled={false}>
            <boxGeometry args={[0.08, 0.5, 0.08]} />
        </mesh>
    );
};

const OpenDoorImpactBurst: React.FC<{
    event: SpellVisualEvent;
    ringGeometry: THREE.RingGeometry;
    material: THREE.MeshBasicMaterial;
    coreMaterial: THREE.MeshBasicMaterial;
    sparkMaterial: THREE.MeshBasicMaterial;
}> = ({ event, ringGeometry, material, coreMaterial, sparkMaterial }) => {
    const ringRef = useRef<THREE.Mesh>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const sparks = useMemo(
        () => Array.from({ length: 6 }, (_, index) => ({
            angle: (index / 6) * Math.PI * 2,
            radius: 0.18 + (index % 2) * 0.05,
            rise: 0.06 + (index % 3) * 0.025,
        })),
        [],
    );

    useFrame(() => {
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / 520));
        const visualScale = event.visualScale ?? 1;

        if (ringRef.current) {
            ringRef.current.scale.setScalar((0.55 + t * 1.25) * visualScale);
            ringRef.current.rotation.z = t * Math.PI * 0.9;
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.34;
            ringRef.current.visible = t < 1;
        }

        if (coreRef.current) {
            coreRef.current.scale.setScalar((0.18 + Math.sin(Math.PI * t) * 0.5) * visualScale);
            coreRef.current.rotation.y = t * Math.PI * 1.4;
            (coreRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.46;
            coreRef.current.visible = t < 1;
        }

        if (lightRef.current) {
            lightRef.current.intensity = Math.max(0, (1 - t) * 1.1 * Math.max(1, visualScale * 0.85));
            lightRef.current.distance = GRID_SIZE * (1.25 + visualScale * 0.4);
        }
    });

    return (
        <group
            position={[
                event.x * GRID_SIZE + (event.offsetX ?? 0),
                event.height ?? GRID_SIZE * 0.07,
                event.y * GRID_SIZE + (event.offsetZ ?? 0),
            ]}
        >
            <mesh
                ref={ringRef}
                rotation={[-Math.PI / 2, 0, 0]}
                geometry={ringGeometry}
                material={material}
                frustumCulled={false}
            />
            <mesh ref={coreRef} material={coreMaterial} frustumCulled={false}>
                <torusGeometry args={[0.18, 0.03, 8, 24]} />
            </mesh>
            {sparks.map((spark, index) => (
                <OpenDoorImpactSpark
                    key={`open_spark_${index}`}
                    event={event}
                    material={sparkMaterial}
                    spark={spark}
                />
            ))}
            <pointLight
                ref={lightRef}
                color="#a8f8ff"
                intensity={0}
                distance={GRID_SIZE * 1.25}
                decay={2}
                position={[0, GRID_SIZE * 0.12, 0]}
            />
        </group>
    );
};

const OpenDoorImpactSpark: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    spark: { angle: number; radius: number; rise: number };
}> = ({ event, material, spark }) => {
    const sparkRef = useRef<THREE.Mesh>(null);
    useFrame(() => {
        if (!sparkRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / 520));
        const visualScale = event.visualScale ?? 1;
        sparkRef.current.position.x = Math.cos(spark.angle) * spark.radius * (0.45 + t * 0.95) * visualScale;
        sparkRef.current.position.z = Math.sin(spark.angle) * spark.radius * (0.45 + t * 0.95) * visualScale;
        sparkRef.current.position.y = spark.rise * Math.sin(Math.PI * t) * visualScale;
        sparkRef.current.rotation.y = spark.angle;
        sparkRef.current.rotation.z = Math.PI / 4 + t * Math.PI * 0.5;
        sparkRef.current.scale.set(
            (0.06 + (1 - t) * 0.02) * visualScale,
            (0.22 + Math.sin(Math.PI * t) * 0.12) * visualScale,
            (0.06 + (1 - t) * 0.02) * visualScale,
        );
        (sparkRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.42;
        sparkRef.current.visible = t < 1;
    });

    return (
        <mesh ref={sparkRef} material={material} frustumCulled={false}>
            <boxGeometry args={[0.08, 0.24, 0.08]} />
        </mesh>
    );
};

const DisruptImpactBurst: React.FC<{
    event: SpellVisualEvent;
    ringGeometry: THREE.RingGeometry;
    material: THREE.MeshBasicMaterial;
    coreMaterial: THREE.MeshBasicMaterial;
    shardMaterial: THREE.MeshBasicMaterial;
}> = ({ event, ringGeometry, material, coreMaterial, shardMaterial }) => {
    const ringRef = useRef<THREE.Mesh>(null);
    const shellRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const shards = useMemo(
        () => Array.from({ length: 8 }, (_, index) => {
            const angle = (index / 8) * Math.PI * 2;
            const radius = 0.12 + (index % 2) * 0.05;
            const rise = 0.04 + (index % 3) * 0.025;
            return { angle, radius, rise, spin: index % 2 === 0 ? 1 : -1 };
        }),
        [],
    );

    useFrame(() => {
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / 520));
        const visualScale = event.visualScale ?? 1;

        if (ringRef.current) {
            ringRef.current.scale.setScalar((0.7 + t * 1.55) * visualScale);
            ringRef.current.rotation.z = t * Math.PI * 0.85;
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.38;
            ringRef.current.visible = t < 1;
        }

        if (shellRef.current) {
            shellRef.current.scale.setScalar((0.2 + Math.sin(Math.PI * t) * 0.62) * visualScale);
            (shellRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.34;
            shellRef.current.visible = t < 1;
        }

        if (lightRef.current) {
            lightRef.current.intensity = Math.max(0, (1 - t) * 1.4 * Math.max(1, visualScale * 0.85));
            lightRef.current.distance = GRID_SIZE * (1.45 + visualScale * 0.45);
        }
    });

    return (
        <group
            position={[
                event.x * GRID_SIZE + (event.offsetX ?? 0),
                event.height ?? GRID_SIZE * 0.06,
                event.y * GRID_SIZE + (event.offsetZ ?? 0),
            ]}
        >
            <mesh
                ref={ringRef}
                rotation={[-Math.PI / 2, 0, 0]}
                geometry={ringGeometry}
                material={material}
                frustumCulled={false}
            />
            <mesh ref={shellRef} material={coreMaterial} frustumCulled={false}>
                <sphereGeometry args={[0.13, 10, 10]} />
            </mesh>
            {shards.map((shard, index) => (
                <DisruptImpactShard
                    key={`disrupt_shard_${index}`}
                    event={event}
                    material={shardMaterial}
                    shard={shard}
                />
            ))}
            <pointLight
                ref={lightRef}
                color="#b7ecff"
                intensity={0}
                distance={GRID_SIZE * 1.45}
                decay={2}
                position={[0, GRID_SIZE * 0.14, 0]}
            />
        </group>
    );
};

const DisruptImpactShard: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    shard: { angle: number; radius: number; rise: number; spin: number };
}> = ({ event, material, shard }) => {
    const shardRef = useRef<THREE.Mesh>(null);
    useFrame(() => {
        if (!shardRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / 520));
        const visualScale = event.visualScale ?? 1;
        const orbit = shard.angle + (t * Math.PI * 1.4 * shard.spin);
        shardRef.current.position.x = Math.cos(orbit) * shard.radius * (0.55 + t * 0.95) * visualScale;
        shardRef.current.position.z = Math.sin(orbit) * shard.radius * (0.55 + t * 0.95) * visualScale;
        shardRef.current.position.y = shard.rise * Math.sin(Math.PI * t) * visualScale;
        shardRef.current.rotation.y = orbit;
        shardRef.current.rotation.z = t * Math.PI * shard.spin;
        shardRef.current.scale.set(
            (0.08 + (1 - t) * 0.03) * visualScale,
            (0.28 + Math.sin(Math.PI * t) * 0.16) * visualScale,
            (0.08 + (1 - t) * 0.03) * visualScale,
        );
        (shardRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.46;
        shardRef.current.visible = t < 1;
    });

    return (
        <mesh ref={shardRef} material={material} frustumCulled={false}>
            <octahedronGeometry args={[0.12, 0]} />
        </mesh>
    );
};

const SpellImpactPulse: React.FC<{
    event: SpellVisualEvent;
    geometry: THREE.RingGeometry;
    material: THREE.MeshBasicMaterial;
}> = ({ event, geometry, material }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    useFrame(() => {
        if (!meshRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / DAMAGE_EVENT_LIFETIME_MS));
        const visualScale = event.visualScale ?? 1;
        const scale = event.kind === 'death'
            ? (0.85 + t * 1.85) * visualScale
            : event.kind === 'wall'
                ? (0.58 + t * 1.55) * visualScale
                : (0.72 + t * 1.3) * visualScale;
        meshRef.current.scale.setScalar(scale);
        (meshRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.45;
        meshRef.current.visible = t < 1;
        if (lightRef.current) {
            const baseIntensity =
                event.kind === 'death' ? 0.65 :
                    event.effect === 'fireball' ? 1.8 :
                        event.effect === 'lightning' ? 1.55 :
                            event.effect === 'poison_cloud' || event.effect === 'poison_bolt' ? 0.8 : 1.0;
            lightRef.current.intensity = Math.max(0, (1 - t) * baseIntensity * Math.max(1, visualScale * 0.85));
            lightRef.current.distance =
                (event.effect === 'fireball' ? GRID_SIZE * 1.7 :
                    event.effect === 'lightning' ? GRID_SIZE * 1.45 : GRID_SIZE * 1.1) * Math.max(1, visualScale * 0.9);
        }
    });

    const lightColor =
        event.kind === 'death' ? '#c9a56c'
            : event.effect === 'fireball' ? '#ff8a3d'
                : event.effect === 'lightning' ? '#b7e8ff'
                    : event.effect === 'poison_cloud' || event.effect === 'poison_bolt' ? '#8cff8b'
                        : '#aeefff';

    return (
        <group
            position={[
                event.x * GRID_SIZE + (event.offsetX ?? 0),
                event.height ?? (event.kind === 'death' ? GRID_SIZE * 0.14 : GRID_SIZE * 0.06),
                event.y * GRID_SIZE + (event.offsetZ ?? 0),
            ]}
        >
            <mesh
                ref={meshRef}
                rotation={[-Math.PI / 2, 0, 0]}
                geometry={geometry}
                material={material}
                frustumCulled={false}
            />
            <pointLight
                ref={lightRef}
                color={lightColor}
                intensity={0}
                distance={GRID_SIZE * 1.4}
                decay={2}
                position={[0, GRID_SIZE * 0.18, 0]}
            />
        </group>
    );
};

const FireballImpactBurst: React.FC<{
    event: SpellVisualEvent;
    ringGeometry: THREE.RingGeometry;
    material: THREE.MeshBasicMaterial;
    coreMaterial: THREE.MeshBasicMaterial;
    flameMaterial: THREE.MeshBasicMaterial;
}> = ({ event, ringGeometry, material, coreMaterial, flameMaterial }) => {
    const ringRef = useRef<THREE.Mesh>(null);
    const flashRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const shards = useMemo(
        () => Array.from({ length: 10 }, (_, index) => {
            const angle = (index / 10) * Math.PI * 2;
            const spread = 0.16 + (index % 3) * 0.05;
            const rise = 0.04 + (index % 4) * 0.02;
            return { x: Math.cos(angle) * spread, z: Math.sin(angle) * spread, rise };
        }),
        [],
    );
    const flames = useMemo(
        () => Array.from({ length: 6 }, (_, index) => {
            const angle = (index / 6) * Math.PI * 2;
            const spread = 0.07 + (index % 2) * 0.035;
            const lift = 0.18 + (index % 3) * 0.04;
            return { x: Math.cos(angle) * spread, z: Math.sin(angle) * spread, lift, rotation: angle };
        }),
        [],
    );

    useFrame(() => {
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / 520));
        const visualScale = event.visualScale ?? 1;

        if (ringRef.current) {
            ringRef.current.scale.setScalar((0.9 + t * 2.1) * visualScale);
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.62;
            ringRef.current.visible = t < 1;
        }

        if (flashRef.current) {
            flashRef.current.scale.setScalar((0.42 + Math.sin(Math.PI * t) * 1.05) * visualScale);
            (flashRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.55;
            flashRef.current.visible = t < 1;
        }

        if (lightRef.current) {
            lightRef.current.intensity = Math.max(0, (1 - t) * 2.9 * Math.max(1, visualScale));
            lightRef.current.distance = GRID_SIZE * (2 + visualScale * 0.75);
        }
    });

    return (
        <group
            position={[
                event.x * GRID_SIZE + (event.offsetX ?? 0),
                event.height ?? GRID_SIZE * 0.08,
                event.y * GRID_SIZE + (event.offsetZ ?? 0),
            ]}
        >
            <mesh
                ref={ringRef}
                rotation={[-Math.PI / 2, 0, 0]}
                geometry={ringGeometry}
                material={material}
                frustumCulled={false}
            />
            <mesh ref={flashRef} material={coreMaterial} frustumCulled={false}>
                <sphereGeometry args={[0.18, 12, 12]} />
            </mesh>
            {flames.map((flame, index) => (
                <FireballImpactFlame
                    key={`flame_${index}`}
                    event={event}
                    material={flameMaterial}
                    offset={flame}
                />
            ))}
            {shards.map((shard, index) => (
                <FireballImpactShard
                    key={index}
                    event={event}
                    material={material}
                    offset={shard}
                />
            ))}
            <pointLight
                ref={lightRef}
                color="#ff9a43"
                intensity={0}
                distance={GRID_SIZE * 1.8}
                decay={2}
                position={[0, GRID_SIZE * 0.2, 0]}
            />
        </group>
    );
};

const FireballImpactFlame: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    offset: { x: number; z: number; lift: number; rotation: number };
}> = ({ event, material, offset }) => {
    const flameRef = useRef<THREE.Mesh>(null);
    useFrame(() => {
        if (!flameRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / 520));
        const visualScale = event.visualScale ?? 1;
        flameRef.current.position.x = offset.x * (0.6 + t * 1.8) * visualScale;
        flameRef.current.position.z = offset.z * (0.6 + t * 1.8) * visualScale;
        flameRef.current.position.y = offset.lift * Math.sin(Math.PI * t) * visualScale;
        flameRef.current.rotation.y = offset.rotation;
        flameRef.current.rotation.z = 0.18 + Math.sin((offset.rotation * 2) + (t * Math.PI)) * 0.22;
        flameRef.current.scale.set(
            (0.22 + (1 - t) * 0.1) * visualScale,
            (0.55 + Math.sin(Math.PI * t) * 0.9) * visualScale,
            (0.22 + (1 - t) * 0.1) * visualScale,
        );
        (flameRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.5;
        flameRef.current.visible = t < 1;
    });

    return (
        <mesh ref={flameRef} material={material} frustumCulled={false}>
            <sphereGeometry args={[0.12, 8, 8]} />
        </mesh>
    );
};

const FireballImpactShard: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    offset: { x: number; z: number; rise: number };
}> = ({ event, material, offset }) => {
    const shardRef = useRef<THREE.Mesh>(null);
    useFrame(() => {
        if (!shardRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / 520));
        const visualScale = event.visualScale ?? 1;
        shardRef.current.position.x = offset.x * t * visualScale;
        shardRef.current.position.z = offset.z * t * visualScale;
        shardRef.current.position.y = offset.rise * Math.sin(Math.PI * t) * visualScale;
        shardRef.current.scale.setScalar((1 - t) * (0.22 + visualScale * 0.08));
        (shardRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.46;
        shardRef.current.visible = t < 1;
    });

    return (
        <mesh ref={shardRef} material={material} frustumCulled={false}>
            <sphereGeometry args={[0.09, 6, 6]} />
        </mesh>
    );
};

const DeathDustBurst: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
}> = ({ event, material }) => {
    const groupRef = useRef<THREE.Group>(null);
    const seed = useMemo(
        () => Array.from({ length: 12 }, (_, index) => {
            const angle = (index / 12) * Math.PI * 2;
            const radius = 0.08 + (index % 4) * 0.045;
            const rise = 0.08 + (index % 3) * 0.04;
            return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, rise };
        }),
        [],
    );

    useFrame(() => {
        if (!groupRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / 850));
        groupRef.current.children.forEach((child, index) => {
            const particle = child as THREE.Mesh;
            const cfg = seed[index];
            particle.position.x = cfg.x * (0.35 + t * 1.25);
            particle.position.z = cfg.z * (0.35 + t * 1.25);
            particle.position.y = cfg.rise * Math.sin(Math.PI * t) - t * 0.08;
            particle.scale.setScalar((1 - t) * (0.55 + (index % 3) * 0.18));
            (particle.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.42;
            particle.visible = t < 1;
        });
    });

    return (
        <group ref={groupRef} position={[event.x * GRID_SIZE, GRID_SIZE * 0.05, event.y * GRID_SIZE]}>
            {seed.map((_, index) => (
                <mesh key={index} material={material} frustumCulled={false}>
                    <sphereGeometry args={[0.08, 6, 6]} />
                </mesh>
            ))}
        </group>
    );
};

// ─── Magic vision — red halos around hidden sensors + pressure plates ─────────
const MagicVisionLayer: React.FC<{
    wallButtons: { tileX: number; tileY: number; face: CardinalDir }[];
    pressurePlates: { tileX: number; tileY: number }[];
    trickWalls: { tileX: number; tileY: number }[];
    pits: { tileX: number; tileY: number }[];
}> = ({ wallButtons, pressurePlates, trickWalls, pits }) => {
    const magicVisionUntil = useStore(s => s.magicVisionUntil);
    const groupRef = useRef<THREE.Group>(null);
    const buttonGeometry = useMemo(() => new THREE.SphereGeometry(0.22, 10, 10), []);
    const plateGeometry = useMemo(() => new THREE.RingGeometry(GRID_SIZE * 0.18, GRID_SIZE * 0.38, 24), []);
    const buttonMaterial = useMemo(() => createPulseMaterial('#ff3f2f', 0.55), []);
    const plateMaterial = useMemo(() => createPulseMaterial('#ff5544', 0.34), []);
    const trickWallMaterial = useMemo(() => createPulseMaterial('#ffd166', 0.28), []);
    const pitMaterial = useMemo(() => createPulseMaterial('#62e0ff', 0.3), []);

    useFrame(() => {
        if (groupRef.current) groupRef.current.visible = Date.now() < magicVisionUntil;
    });

    useEffect(() => () => {
        buttonGeometry.dispose();
        plateGeometry.dispose();
        buttonMaterial.dispose();
        plateMaterial.dispose();
        trickWallMaterial.dispose();
        pitMaterial.dispose();
    }, [buttonGeometry, plateGeometry, buttonMaterial, plateMaterial, trickWallMaterial, pitMaterial]);

    const FACE_OFFSET: Record<CardinalDir, [number, number]> = {
        North: [0, -HALF], South: [0, HALF], East: [HALF, 0], West: [-HALF, 0],
    };

    return (
        <group ref={groupRef} visible={false}>
            {wallButtons.map(({ tileX, tileY, face }) => {
                const [ox, oz] = FACE_OFFSET[face];
                return (
                    <MagicVisionButton
                        key={`mv_btn_${tileX}_${tileY}_${face}`}
                        position={[tileX * GRID_SIZE + ox, 0, tileY * GRID_SIZE + oz]}
                        geometry={buttonGeometry}
                        material={buttonMaterial}
                        seed={tileX * 0.8 + tileY * 0.35}
                    />
                );
            })}
            {pressurePlates.map(({ tileX, tileY }) => (
                <MagicVisionPlate key={`mv_plate_${tileX}_${tileY}`}
                    position={[tileX * GRID_SIZE, -WALL_HEIGHT / 2 + 0.02, tileY * GRID_SIZE]}
                    geometry={plateGeometry}
                    material={plateMaterial}
                    seed={tileX * 0.5 + tileY * 0.4}
                />
            ))}
            {trickWalls.map(({ tileX, tileY }) => (
                <MagicVisionButton
                    key={`mv_trickwall_${tileX}_${tileY}`}
                    position={[tileX * GRID_SIZE, 0, tileY * GRID_SIZE]}
                    geometry={buttonGeometry}
                    material={trickWallMaterial}
                    seed={tileX * 0.33 + tileY * 0.67}
                />
            ))}
            {pits.map(({ tileX, tileY }) => (
                <MagicVisionPlate
                    key={`mv_pit_${tileX}_${tileY}`}
                    position={[tileX * GRID_SIZE, -WALL_HEIGHT / 2 + 0.03, tileY * GRID_SIZE]}
                    geometry={plateGeometry}
                    material={pitMaterial}
                    seed={tileX * 0.71 + tileY * 0.19}
                />
            ))}
        </group>
    );
};

const MagicVisionButton: React.FC<{
    position: [number, number, number];
    geometry: THREE.SphereGeometry;
    material: THREE.MeshBasicMaterial;
    seed: number;
}> = ({ position, geometry, material, seed }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const pulseRef = useRef(seed);

    useFrame(() => {
        pulseRef.current += 0.04;
        const pulse = 0.92 + ((Math.sin(pulseRef.current) + 1) * 0.08);
        if (meshRef.current) meshRef.current.scale.setScalar(pulse);
    });

    return (
        <mesh
            ref={meshRef}
            position={position}
            geometry={geometry}
            material={material}
            frustumCulled={false}
        />
    );
};

const MagicVisionPlate: React.FC<{
    position: [number, number, number];
    geometry: THREE.RingGeometry;
    material: THREE.MeshBasicMaterial;
    seed: number;
}> = ({ position, geometry, material, seed }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const pulseRef = useRef(seed);

    useFrame(() => {
        pulseRef.current += 0.04;
        const scale = 1 + Math.sin(pulseRef.current * 0.8) * 0.06;
        if (meshRef.current) meshRef.current.scale.setScalar(scale);
    });

    return (
        <mesh
            ref={meshRef}
            position={position}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={geometry}
            material={material}
            frustumCulled={false}
        />
    );
};

// ─── Footprint trail — fading floor planes ────────────────────────────────────
const FootprintLayer: React.FC = () => {
    const footprintHistory = useStore(s => s.footprintHistory);
    const level = useStore(s => s.level);
    const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
    const footprintGeometry = useMemo(() => new THREE.PlaneGeometry(GRID_SIZE * 0.6, GRID_SIZE * 0.6), []);

    useEffect(() => () => {
        footprintGeometry.dispose();
    }, [footprintGeometry]);

    useFrame(() => {
        const now = Date.now();
        for (const [key, mesh] of meshRefs.current) {
            if (!mesh) continue;
            const parts = key.split(',');
            const ts = parseInt(parts[2]);
            const age = now - ts;
            const opacity = Math.max(0, (FOOTPRINT_LIFETIME_MS - age) / FOOTPRINT_LIFETIME_MS);
            (mesh.material as THREE.MeshBasicMaterial).opacity = opacity * 0.45;
            mesh.visible = opacity > 0.01;
        }
    });

    const currentFootprints = footprintHistory.filter(e => e.level === level);

    return (
        <>
            {currentFootprints.map((e: FootprintEntry) => {
                const key = `${e.x},${e.y},${e.ts}`;
                return (
                    <mesh
                        key={key}
                        ref={(m) => {
                            if (m) meshRefs.current.set(key, m);
                            else meshRefs.current.delete(key);
                        }}
                        position={[e.x * GRID_SIZE, -WALL_HEIGHT / 2 + 0.03, e.y * GRID_SIZE]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        geometry={footprintGeometry}
                        frustumCulled={false}
                    >
                        <meshBasicMaterial
                            color="#66ccff"
                            transparent
                            opacity={0.45}
                            depthWrite={false}
                            toneMapped={false}
                        />
                    </mesh>
                );
            })}
        </>
    );
};

// ─── Creatures layer (isolated — re-renders only when creatures change) ───────
const CreaturesLayer: React.FC = () => {
    const creatures = useStore(s => s.creatures);
    const level     = useStore(s => s.level);
    return (
        <>
            {creatures
                .filter(c => c.alive && c.mapIndex === level)
                .map(c => <CreatureSprite key={c.id} creature={c} />)
            }
        </>
    );
};

// ─── Damage events layer ──────────────────────────────────────────────────────
const DamageLayer: React.FC = () => {
    const damageEvents = useStore(s => s.damageEvents);
    const level = useStore(s => s.level);
    const creatures = useStore(s => s.creatures);
    const direction = useStore(s => s.direction);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 33);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <>
            {damageEvents
                .filter((evt) => evt.target === 'creature' && evt.level === level && evt.x !== undefined && evt.y !== undefined)
                .map(evt => {
                    const age = Math.max(0, now - evt.ts);
                    const progress = Math.min(1, age / DAMAGE_EVENT_LIFETIME_MS);
                    const creature = evt.creatureId
                        ? creatures.find((entry) => entry.alive && entry.mapIndex === level && entry.id === evt.creatureId)
                        : undefined;
                    const [offsetX, offsetZ] = creature
                        ? getCreatureCellOffsetXZ(direction, creature.cell)
                        : [0, 0];
                    return (
                        <DamageNumberBillboard
                            key={evt.id}
                            x={evt.x!}
                            y={evt.y!}
                            amount={evt.amount}
                            progress={progress}
                            offsetX={offsetX}
                            offsetZ={offsetZ}
                        />
                    );
                })}
        </>
    );
};

const DamageNumberBillboard: React.FC<{
    x: number;
    y: number;
    amount: number;
    progress: number;
    offsetX?: number;
    offsetZ?: number;
}> = ({ x, y, amount, progress, offsetX = 0, offsetZ = 0 }) => {
    const { texture, aspect } = useMemo(() => makeDamageBubbleTexture(amount), [amount]);
    useEffect(() => () => texture.dispose(), [texture]);
    const baseHeight = GRID_SIZE * (0.28 + Math.min(0.18, amount / 180));
    const width = baseHeight * aspect;
    const height = baseHeight;
    const scale = Math.max(0.94, Math.min(2.15, 0.96 + (amount / 30)) - progress * 0.1);
    const verticalRise = GRID_SIZE * 0.12;
    const burstY = GRID_SIZE * 0.36 + progress * verticalRise;

    return (
        <Billboard
            position={[x * GRID_SIZE + offsetX, burstY, y * GRID_SIZE + offsetZ]}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
        >
            <mesh scale={[scale, scale, scale]} frustumCulled={false} renderOrder={30}>
                <planeGeometry args={[width, height]} />
                <meshBasicMaterial
                    map={texture}
                    transparent
                    alphaTest={0.05}
                    depthWrite={false}
                    depthTest={false}
                    opacity={1 - progress * 0.3}
                    toneMapped={false}
                />
            </mesh>
        </Billboard>
    );
};

// ─── Floor items layer ────────────────────────────────────────────────────────
const FloorItemsLayer: React.FC = () => {
    const floorItems = useStore(s => s.floorItems);
    const level      = useStore(s => s.level);
    const openWalls  = useStore(s => s.openWalls);
    const pickupItem = useStore(s => s.pickupItem);
    const beginFloorDrag = useStore(s => s.beginFloorDrag);
    const updateFloorDrag = useStore(s => s.updateFloorDrag);
    const endFloorDrag = useStore(s => s.endFloorDrag);
    const applyFloorItemOnFrontWall = useStore(s => s.useFloorItemOnFrontWall);
    const selectedChampionIndex = useStore(s => s.selectedChampionIndex);
    const party = useStore(s => s.party);
    const selectedChampionId = party[selectedChampionIndex]?.id ?? party[0]?.id ?? null;
    const map = getGameMap(level);
    const isMirrorTile = (item: FloorItem) => MIRROR_WALL_MAP.has(`${level},${item.x},${item.y}`);
    const isWallMounted = (item: FloorItem) => {
        const tile = map.tiles[item.y]?.[item.x];
        return tile && (tile.type === 'Wall' || tile.type === 'TrickWall');
    };
    return (
        <>
            {floorItems
                .filter(i => i.mapIndex === level)
                .filter(i => !isMirrorTile(i))
                .filter((item) => {
                    if (!isWallMounted(item)) return true;
                    if (!isSelfRevealingWallTile(level, item.x, item.y)) return true;
                    return openWalls.has(`${level},${item.y},${item.x}`);
                })
                .map(i => (
                    isWallMounted(i)
                        ? <WallMountedItemMesh key={i.id} item={i} onPickup={() => pickupItem(i.id)} />
                        : (
                            <FloorItemMesh
                                key={i.id}
                                item={i}
                                onPickup={() => pickupItem(i.id)}
                                onStartDrag={(item, _imagePath, pointerX, pointerY) => beginFloorDrag(item.id, pointerX, pointerY)}
                                onUpdateDrag={updateFloorDrag}
                                onEndDrag={(pointerX, pointerY) => {
                                    const hovered = document.elementFromPoint(pointerX, pointerY) as HTMLElement | null;
                                    const wallDrop = hovered?.closest('[data-dm-front-wall-drop="true"]');
                                    if (wallDrop && selectedChampionId != null) {
                                        applyFloorItemOnFrontWall(i.id, selectedChampionId);
                                    }
                                    endFloorDrag();
                                }}
                            />
                        )
                ))
            }
        </>
    );
};

// ─── Static tile grid (re-renders only when level or doors change) ────────────
const TileGrid: React.FC<{
    map: GameMap;
    level: number;
    partyPosition: [number, number];
    partyDirection: Direction;
    openDoors: Set<string>;
    openWalls: Set<string>;
    recruitedIds: Set<number>;
    wallButtons: { tileX: number; tileY: number; face: CardinalDir; sensorIndex: number }[];
    wallDecals: OriginalWallOverlayRender[];
    pressurePlates: { tileX: number; tileY: number }[];
    onCellClick: (e: ThreeEvent<MouseEvent>, renderType: CellRenderType, x: number, y: number) => void;
    onWallSensor: (level: number, x: number, y: number, sensorIndex: number) => void;
}> = memo(({ map, level, partyPosition, partyDirection, openDoors, openWalls, recruitedIds, wallButtons, wallDecals, pressurePlates, onCellClick, onWallSensor }) => {
    const frontTileY = partyDirection === 'NORTH' ? partyPosition[0] - 1 : partyDirection === 'SOUTH' ? partyPosition[0] + 1 : partyPosition[0];
    const frontTileX = partyDirection === 'EAST' ? partyPosition[1] + 1 : partyDirection === 'WEST' ? partyPosition[1] - 1 : partyPosition[1];
    return (
        <group>
            {/* One draw call each for floor, ceiling, and walls */}
            <InstancedTiles key={level} map={map} openWalls={openWalls} />

            {/* Pressure plates — floor-level objects */}
            {pressurePlates.map(({ tileX, tileY }) => (
                <group key={`plate_${tileX}_${tileY}`} position={[tileX * GRID_SIZE, 0, tileY * GRID_SIZE]}>
                    <PressurePlate tileX={tileX} tileY={tileY} level={level} />
                </group>
            ))}

            {/* Only Door and Mirror tiles need a Cell — everything else is instanced */}
            {map.tiles.map((row, y) =>
                row.map((tile, x) => {
                    const renderType = getRenderType(tile, level);
                    if (renderType !== 'Door' && renderType !== 'Mirror') return null;

                    const mirrorChampion: Champion | null =
                        renderType === 'Mirror' ? (MIRROR_WALL_MAP.get(`${level},${x},${y}`) ?? null) : null;
                    const champion = mirrorChampion && !recruitedIds.has(mirrorChampion.id)
                        ? mirrorChampion : null;
                    const wallFace = renderType === 'Mirror' ? MIRROR_FACE_MAP.get(`${level},${x},${y}`) : undefined;
                    const doorOpen = renderType === 'Door' ? openDoors.has(`${level},${y},${x}`) : undefined;
                    const doorOrientation = renderType === 'Door' ? tile.orientation : undefined;
                    const doorHasButton = renderType === 'Door'
                        ? (tile.objects.find(o => o.category === 'Door') as DoorObject | undefined)?.hasButton ?? false
                        : undefined;
                    const doorType = renderType === 'Door'
                        ? (tile.objects.find(o => o.category === 'Door') as DoorObject | undefined)?.doorType
                        : undefined;
                    const isFrontDoor = x === frontTileX && y === frontTileY;
                    const doorButtonVisible = renderType === 'Door'
                        ? ((doorHasButton ?? false) &&
                            (isFrontDoor || isDoorTileVisible(map, level, openDoors, openWalls, partyPosition[1], partyPosition[0], x, y)))
                        : undefined;
                    const doorButtonSideSign = renderType === 'Door' && doorHasButton
                        ? 1
                        : undefined;
                    const doorButtonFaceSign = renderType === 'Door' && doorHasButton
                        ? getDoorButtonFaceSignForView(partyPosition, x, y, tile.orientation)
                        : undefined;

                    return (
                        <Cell
                            key={`${y}-${x}`}
                            type={renderType}
                            position={[x * GRID_SIZE, 0, y * GRID_SIZE]}
                            champion={champion}
                            frameChampion={mirrorChampion}
                            wallFace={wallFace}
                            doorOpen={doorOpen}
                            doorOrientation={doorOrientation}
                            doorHasButton={doorHasButton}
                            doorButtonVisible={doorButtonVisible}
                            doorButtonSideSign={doorButtonSideSign}
                            doorButtonFaceSign={doorButtonFaceSign}
                            doorType={doorType}
                            onClick={(e) => onCellClick(e, renderType, x, y)}
                        />
                    );
                })
            )}

            {wallButtons.map(({ tileX, tileY, face, sensorIndex }) => (
                <WallSensor
                    key={`wsensor_${tileX}_${tileY}_${sensorIndex}`}
                    tileX={tileX} tileY={tileY} face={face}
                    onClick={() => onWallSensor(level, tileX, tileY, sensorIndex)}
                />
            ))}
            {wallDecals.map(({ tileX, tileY, face, image, label, accent, width, height, interactiveSensorIndices }, i) => (
                <WallDecal
                    key={`wdecal_${tileX}_${tileY}_${face}_${i}`}
                    tileX={tileX}
                    tileY={tileY}
                    face={face}
                    image={image}
                    label={label}
                    accent={accent}
                    width={width}
                    height={height}
                    onClick={interactiveSensorIndices && interactiveSensorIndices.length > 0
                        ? () => onWallSensor(level, tileX, tileY, interactiveSensorIndices[0])
                        : undefined}
                />
            ))}
        </group>
    );
});

// ─── Scene ────────────────────────────────────────────────────────────────────
export const DungeonScene = () => {
    const dungeonText = useI18n().dungeonScene;
    const canvasHostRef = useRef<HTMLDivElement>(null);
    const [isItemDragActive, setIsItemDragActive] = useState(false);
    // Only subscribe to stable/slow-changing state here
    const level          = useStore(s => s.level);
    const position       = useStore(s => s.position);
    const direction      = useStore(s => s.direction);
    const selectedChampionIndex = useStore(s => s.selectedChampionIndex);
    const openDoors      = useStore(s => s.openDoors);
    const openWalls      = useStore(s => s.openWalls);
    const openMirror     = useStore(s => s.openMirror);
    const toggleDoor     = useStore(s => s.toggleDoor);
    const activateWallSensor = useStore(s => s.activateWallSensor);
    const applyItemOnFrontWall = useStore(s => s.useItemOnFrontWall);
    const applyFloorItemOnFrontWall = useStore(s => s.useFloorItemOnFrontWall);
    const dropCarriedItem = useStore(s => s.dropCarriedItem);
    const throwCarriedItem = useStore(s => s.throwCarriedItem);
    const activeSensors  = useStore(s => s.activeSensors);
    const firedSensors   = useStore(s => s.firedSensors);
    const activeFloorDrag = useStore(s => s.activeFloorDrag);
    const floorItems      = useStore(s => s.floorItems);
    const party          = useStore(s => s.party);

    const map = getGameMap(level);
    const recruitedIds = useMemo(() => new Set(party.map(c => c.id)), [party]);
    const selectedChampionId = party[selectedChampionIndex]?.id ?? party[0]?.id ?? null;
    const draggedFloorItem = useMemo(
        () => activeFloorDrag ? floorItems.find((item) => item.id === activeFloorDrag.itemId) ?? null : null,
        [activeFloorDrag, floorItems],
    );

    useEffect(() => {
        const handleDragStart = () => setIsItemDragActive(true);
        const handleDragEnd = () => setIsItemDragActive(false);

        window.addEventListener('dragstart', handleDragStart);
        window.addEventListener('dragend', handleDragEnd);
        window.addEventListener('drop', handleDragEnd);

        return () => {
            window.removeEventListener('dragstart', handleDragStart);
            window.removeEventListener('dragend', handleDragEnd);
            window.removeEventListener('drop', handleDragEnd);
        };
    }, []);

    const wallButtons = useMemo(() => {
        const buttonsByFace = new Map<string, { tileX: number; tileY: number; face: CardinalDir; sensorIndex: number; isLocal: boolean }>();
        const overlayKeys = new Set(
            getOriginalWallOverlaysForMap(map, activeSensors, firedSensors).map((overlay) => `${overlay.tileX}:${overlay.tileY}:${overlay.face}`),
        );
        const partyX = position[1];
        const partyY = position[0];
        for (const row of map.tiles) {
            for (const tile of row) {
                const hiddenWallOpen = tile.type === 'Wall' && isSelfRevealingWallTile(level, tile.x, tile.y) && openWalls.has(`${level},${tile.y},${tile.x}`);
                for (const obj of tile.objects) {
                    if (obj.category !== 'Sensor') continue;
                    const s = obj as SensorObject;
                    if (s.type !== 1 && s.type !== 2) continue;
                    if (hiddenWallOpen) continue;
                    const hasExplicitOverlay = overlayKeys.has(`${tile.x}:${tile.y}:${s.tilePos}`);
                    if (hasExplicitOverlay) continue;
                    if (!isWallFaceVisible(map, level, openDoors, openWalls, partyX, partyY, tile.x, tile.y, s.tilePos)) continue;
                    const key = `${tile.x}:${tile.y}:${s.tilePos}`;
                    const current = buttonsByFace.get(key);
                    if (!current || (current.isLocal && !s.isLocal)) {
                        buttonsByFace.set(key, {
                            tileX: tile.x,
                            tileY: tile.y,
                            face: s.tilePos,
                            sensorIndex: s.index,
                            isLocal: s.isLocal,
                        });
                    }
                }
            }
        }
        return [...buttonsByFace.values()].map((button) => ({
            tileX: button.tileX,
            tileY: button.tileY,
            face: button.face,
            sensorIndex: button.sensorIndex,
        }));
    }, [activeSensors, firedSensors, level, map, openDoors, openWalls, position]);

    const wallDecals = useMemo(() => {
        const stairsEntryFace = (x: number, y: number): CardinalDir => {
            const neighbours: Array<{ dx: number; dy: number; dir: CardinalDir }> = [
                { dx:  0, dy: -1, dir: 'North' },
                { dx:  0, dy:  1, dir: 'South' },
                { dx:  1, dy:  0, dir: 'East'  },
                { dx: -1, dy:  0, dir: 'West'  },
            ];
            for (const { dx, dy, dir } of neighbours) {
                const row = map.tiles[y + dy];
                const neighbour = row?.[x + dx];
                if (neighbour && neighbour.type !== 'Wall') return dir;
            }
            return 'South';
        };

        const decals: OriginalWallOverlayRender[] = [];
        const seen = new Set<string>();
        const partyX = position[1];
        const partyY = position[0];
        const add = (overlay: OriginalWallOverlayRender) => {
            const visualKey = overlay.image ?? overlay.label ?? 'overlay';
            const key = `${overlay.tileX}_${overlay.tileY}_${overlay.face}_${visualKey}`;
            if (seen.has(key)) return;
            if (!isWallFaceVisible(map, level, openDoors, openWalls, partyX, partyY, overlay.tileX, overlay.tileY, overlay.face)) return;
            seen.add(key);
            decals.push(overlay);
        };

        for (const row of map.tiles) {
            for (const tile of row) {
                if (tile.type !== 'Stairs') continue;
                const link = STAIR_CONNECTIONS.find(
                    stair => stair.fromLevel === level && stair.fromY === tile.y && stair.fromX === tile.x,
                );
                if (!link) continue;
                add({
                    tileX: tile.x,
                    tileY: tile.y,
                    face: stairsEntryFace(tile.x, tile.y),
                    image: link.toLevel > level ? miscPath('stairs_down.png') : miscPath('stairs_up.png'),
                });
            }
        }

        for (const overlay of getOriginalWallOverlaysForMap(map, activeSensors, firedSensors)) {
            if (
                isSelfRevealingWallTile(level, overlay.tileX, overlay.tileY) &&
                openWalls.has(`${level},${overlay.tileY},${overlay.tileX}`)
            ) {
                continue;
            }
            add(overlay);
        }

        return decals;
    }, [activeSensors, firedSensors, level, map, openDoors, openWalls, position]);

    const pressurePlates = useMemo(() => {
        const seen = new Set<string>();
        const plates: { tileX: number; tileY: number }[] = [];
        for (const mech of getMapMechanisms(level)) {
            if (mech.support !== 'Floor' || !mech.kind.startsWith('Dalle de pression')) continue;
            const tile = map.tiles[mech.y]?.[mech.x];
            if (!tile || tile.type === 'Wall' || tile.type === 'Door' || tile.type === 'Teleporter') continue;
            const key = `${mech.x},${mech.y}`;
            if (seen.has(key)) continue;
            seen.add(key);
            plates.push({ tileX: mech.x, tileY: mech.y });
        }
        return plates;
    }, [map, level]);

    const trickWalls = useMemo(() => {
        const walls: { tileX: number; tileY: number }[] = [];
        for (const row of map.tiles) {
            for (const tile of row) {
                if (tile.type !== 'TrickWall') continue;
                if (openWalls.has(`${level},${tile.y},${tile.x}`)) continue;
                walls.push({ tileX: tile.x, tileY: tile.y });
            }
        }
        return walls;
    }, [map, level, openWalls]);

    const pits = useMemo(() => {
        const out: { tileX: number; tileY: number }[] = [];
        for (const row of map.tiles) {
            for (const tile of row) {
                if (tile.type !== 'Pit') continue;
                out.push({ tileX: tile.x, tileY: tile.y });
            }
        }
        return out;
    }, [map]);

    const handleCellClick = useCallback((
        e: ThreeEvent<MouseEvent>, renderType: CellRenderType, x: number, y: number,
    ) => {
        e.stopPropagation();
        const frontTileY = direction === 'NORTH' ? position[0] - 1 : direction === 'SOUTH' ? position[0] + 1 : position[0];
        const frontTileX = direction === 'EAST' ? position[1] + 1 : direction === 'WEST' ? position[1] - 1 : position[1];
        if (renderType === 'Mirror') {
            if (x !== frontTileX || y !== frontTileY) return;
            const champion = MIRROR_WALL_MAP.get(`${level},${x},${y}`);
            if (champion) openMirror(champion.id);
        }
        if (renderType === 'Door') {
            if (x !== frontTileX || y !== frontTileY) return;
            toggleDoor(x, y);
        }
    }, [direction, level, openMirror, position, toggleDoor]);

    const frontWallItemMechanism = useMemo(() => {
        const frontTileY = direction === 'NORTH' ? position[0] - 1 : direction === 'SOUTH' ? position[0] + 1 : position[0];
        const frontTileX = direction === 'EAST' ? position[1] + 1 : direction === 'WEST' ? position[1] - 1 : position[1];
        const frontFace: CardinalDir =
            direction === 'NORTH' ? 'South'
                : direction === 'SOUTH' ? 'North'
                    : direction === 'EAST' ? 'West'
                        : 'East';
        const tile = map.tiles[frontTileY]?.[frontTileX];
        if (!tile || (tile.type !== 'Wall' && tile.type !== 'TrickWall')) return null;
        if (isSelfRevealingWallTile(level, frontTileX, frontTileY) && openWalls.has(`${level},${frontTileY},${frontTileX}`)) {
            return null;
        }
        const mechanism = getMechanismsAt(level, frontTileX, frontTileY, frontFace).find((entry) =>
            entry.trigger === 'wall-lock' || entry.trigger === 'alcove' || entry.trigger === 'object-exchanger',
        );
        if (!mechanism) return null;
        const kind: 'wall-lock' | 'alcove' | 'object-exchanger' = mechanism.trigger === 'alcove'
            ? 'alcove'
            : mechanism.trigger === 'object-exchanger'
                ? 'object-exchanger'
                : 'wall-lock';
        return {
            tileX: frontTileX,
            tileY: frontTileY,
            face: frontFace,
            kind,
            requirement: mechanism.requires,
            label: mechanism.trigger === 'alcove' ? dungeonText.alcove : mechanism.trigger === 'object-exchanger' ? dungeonText.receptacle : dungeonText.lock,
        };
    }, [direction, dungeonText.alcove, dungeonText.lock, dungeonText.receptacle, level, map, openWalls, position]);

    const handleCanvasCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
        const canvas = gl.domElement;
        const host = canvasHostRef.current;

        const syncCanvasSize = () => {
            if (!host) return;

            const width = Math.max(1, Math.floor(host.clientWidth));
            const height = Math.max(1, Math.floor(host.clientHeight));
            gl.setPixelRatio(1);
            gl.setSize(width, height, false);
        };

        const onContextLost = (event: Event) => {
            event.preventDefault();
            console.warn('WebGL context lost.');
        };

        const onContextRestored = () => {
            console.warn('WebGL context restored.');
            syncCanvasSize();
        };

        syncCanvasSize();
        canvas.addEventListener('webglcontextlost', onContextLost, false);
        canvas.addEventListener('webglcontextrestored', onContextRestored, false);

        const resizeObserver = host
            ? new ResizeObserver(() => {
                syncCanvasSize();
            })
            : null;

        if (host) {
            resizeObserver?.observe(host);
        }
    }, []);

    return (
        <div
            ref={canvasHostRef}
            onDragOver={(event) => {
                if (!isItemDragActive) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
                const payload = getDragPayload(event);
                if (!payload) return;
                event.preventDefault();
                event.stopPropagation();
                setIsItemDragActive(false);
                const floorDropThreshold = window.innerHeight * FLOOR_DROP_SCREEN_RATIO;
                const shouldDropToFloor = event.clientY >= floorDropThreshold;
                if (shouldDropToFloor) {
                    dropCarriedItem(payload.fromChampionId, payload.itemId, payload.fromSlot);
                } else {
                    throwCarriedItem(payload.fromChampionId, payload.itemId, payload.fromSlot);
                }
            }}
            style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}
        >
            <LevelName key={level} level={level} />
            <DarknessOverlay />
            {activeFloorDrag && draggedFloorItem && (
                <div
                    style={{
                        position: 'fixed',
                        left: activeFloorDrag.pointerX,
                        top: activeFloorDrag.pointerY,
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        zIndex: 180,
                        filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.48))',
                    }}
                >
                    <img
                        src={getFloorItemImage(draggedFloorItem)}
                        alt=""
                        style={{
                            width: 54,
                            height: 54,
                            objectFit: 'contain',
                            imageRendering: 'crisp-edges',
                            opacity: 0.94,
                        }}
                    />
                </div>
            )}

            <Canvas
                dpr={1}
                style={{ display: 'block', width: '100%', height: '100%' }}
                gl={{
                    localClippingEnabled: true,
                    antialias: false,
                    powerPreference: 'high-performance',
                }}
                onCreated={handleCanvasCreated}
            >
                <fog attach="fog" args={['#030405', BASE_FOG_NEAR, BASE_FOG_FAR]} />
                <LightController />
                <CameraController />
                <ShieldAuraLayer />
                <BoundaryWalls map={map} />
                <WallTextPlanes map={map} />
                <TileGrid
                    map={map}
                    level={level}
                    partyPosition={position}
                    openDoors={openDoors}
                    openWalls={openWalls}
                    recruitedIds={recruitedIds}
                    wallButtons={wallButtons}
                    wallDecals={wallDecals}
                    pressurePlates={pressurePlates}
                    onCellClick={handleCellClick}
                    onWallSensor={activateWallSensor}
                    partyDirection={direction}
                />

                <FootprintLayer />
                <MagicVisionLayer
            wallButtons={wallButtons}
            pressurePlates={pressurePlates}
            trickWalls={trickWalls}
            pits={pits}
        />
                <CreaturesLayer />
                <FluxcageLayer />
                <PoisonCloudLayer />
                <DamageLayer />
                <SpellImpactLayer />
                <FloorItemsLayer />
                <ProjectileRenderer />
            </Canvas>
            {frontWallItemMechanism && (isItemDragActive || activeFloorDrag) && (
                <FrontWallMechanismDropTarget
                    kind={frontWallItemMechanism.kind}
                    onUseItem={applyItemOnFrontWall}
                    activeFloorDragItemId={activeFloorDrag?.itemId ?? null}
                    selectedChampionId={selectedChampionId}
                    onUseFloorItem={applyFloorItemOnFrontWall}
                />
            )}
        </div>
    );
};
