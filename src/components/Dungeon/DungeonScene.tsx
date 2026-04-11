import { useRef, useMemo, memo, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { PerspectiveCamera, Plane, Html, useTexture, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, MIRROR_WALL_MAP, MIRROR_FACE_MAP, STAIR_CONNECTIONS, getCreatureFluxcageExpiry } from '../../engine/store';
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
import { CreatureSprite } from './CreatureSprite';
import { FloorItemMesh } from './FloorItemMesh';
import { WallMountedItemMesh } from './WallMountedItemMesh';
import { WallSensor } from './WallSensor';
import { WallDecal } from './WallDecal';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import { getFloorItemImage } from '../../data/itemImages';
import type { FloorItem } from '../../types/game';
import type { CreatureInstance } from '../../types/game';
import { miscPath, texturesPath } from '../../data/assetPaths';
import { getDragPayload } from '../UI/dragPayload';

const HALF = GRID_SIZE / 2;
const BASE_FOG_NEAR = GRID_SIZE * 2;
const BASE_FOG_FAR = GRID_SIZE * 7;
const DUNGEON_AMBIENT_COLOR = new THREE.Color('#f4e2ba');
const DUNGEON_DARK_AMBIENT_COLOR = new THREE.Color('#8ea0c0');
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

// ─── Camera smooth follow ─────────────────────────────────────────────────────
const CameraController = () => {
    const level = useStore(s => s.level);
    const position  = useStore(s => s.position);
    const direction = useStore(s => s.direction);
    const cameraRef = useRef<THREE.PerspectiveCamera>(null);
    const prevLevelRef = useRef(level);
    const prevPositionRef = useRef<[number, number]>(position);
    const targetPos = useMemo(
        () => new THREE.Vector3(position[1] * GRID_SIZE, 0, position[0] * GRID_SIZE),
        [position],
    );
    const rotationMap = { NORTH: 0, EAST: -Math.PI / 2, SOUTH: Math.PI, WEST: Math.PI / 2 };
    const targetRot = rotationMap[direction as keyof typeof rotationMap];

    useEffect(() => {
        const camera = cameraRef.current;
        if (!camera) return;

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

    return <PerspectiveCamera ref={cameraRef} makeDefault position={[1, 0, 1]} fov={75} />;
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

const WallTextPlanes: React.FC<{ map: GameMap }> = memo(({ map }) => {
    const entries = useMemo(() => {
        const result: { tileX: number; tileY: number; face: CardinalDir; text: string }[] = [];
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Text') continue;
                    const t = obj as WallTextObject;
                    if (!t.text || CHAMPION_DATA_RE.test(t.text)) continue;
                    result.push({ tileX: tile.x, tileY: tile.y, face: t.tilePos as CardinalDir, text: t.text });
                }
            }
        }
        return result;
    }, [map]);

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
    poison_cloud: '#7cff88',
    poison_bolt: '#44ff66',
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

const FrontWallLockDropTarget = ({
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
                title={requirement ? `Deposer ${requirement} sur ${label.toLowerCase()}` : `Deposer l objet requis sur ${label.toLowerCase()}`}
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
            poison_cloud: new THREE.MeshBasicMaterial({ color: '#dcffd7', toneMapped: false }),
            poison_bolt: new THREE.MeshBasicMaterial({ color: '#e7ffe7', toneMapped: false }),
            disrupt_nonmaterial: new THREE.MeshBasicMaterial({ color: DISRUPT_CORE_COLOR, toneMapped: false }),
        }),
        [],
    );
    const glowMaterials = useMemo<Record<MagicProjectileEffect, THREE.MeshBasicMaterial>>(
        () => ({
            fireball: createPulseMaterial(FIREBALL_OUTER_COLOR, 0.28),
            lightning: createPulseMaterial(PROJ_COLORS.lightning, 0.22),
            poison_cloud: createPulseMaterial(PROJ_COLORS.poison_cloud, 0.22),
            poison_bolt: createPulseMaterial(PROJ_COLORS.poison_bolt, 0.2),
            disrupt_nonmaterial: createPulseMaterial(PROJ_COLORS.disrupt_nonmaterial, 0.2),
        }),
        [],
    );
    const accentMaterials = useMemo<Record<MagicProjectileEffect, THREE.MeshBasicMaterial>>(
        () => ({
            fireball: createPulseMaterial(FIREBALL_INNER_COLOR, 0.36),
            lightning: createPulseMaterial('#dff2ff', 0.32),
            poison_cloud: createPulseMaterial('#c8ffb8', 0.24),
            poison_bolt: createPulseMaterial('#8cff6f', 0.3),
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
                        fireballFlareGeometry={fireballFlareGeometry}
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
    projectile: { x: number; y: number; effect: MagicProjectileEffect; direction?: Direction };
    index: number;
    sphereShellGeometry: THREE.SphereGeometry;
    sphereGlowGeometry: THREE.SphereGeometry;
    sphereCoreGeometry: THREE.SphereGeometry;
    fireballFlareGeometry: THREE.IcosahedronGeometry;
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
    fireballFlareGeometry,
    poisonCloudGeometry,
    lightningBoltGeometry,
    disruptRingGeometry,
    coreMaterial,
    glowMaterial,
    accentMaterial,
}) => {
    const shellRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    const accentRef = useRef<THREE.Mesh>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const phaseRef = useRef(index * 0.7);

    useFrame((_, delta) => {
        phaseRef.current += delta * (1000 / 180);
        const phase = phaseRef.current;
        const shellScale = 1 + Math.sin(phase) * 0.08;
        const glowScale = 1.35 + Math.sin(phase * 1.2) * 0.12;
        if (shellRef.current) shellRef.current.scale.setScalar(shellScale);
        if (glowRef.current) glowRef.current.scale.setScalar(glowScale);
        if (projectile.effect === 'fireball') {
            const ember = 0.92 + Math.sin(phase * 1.8) * 0.14;
            const flare = 1.08 + Math.cos(phase * 1.35) * 0.1;
            if (accentRef.current) {
                accentRef.current.scale.setScalar(flare);
                accentRef.current.rotation.y += delta * 1.8;
                accentRef.current.rotation.x += delta * 0.9;
            }
            if (coreRef.current) coreRef.current.scale.setScalar(ember);
        } else if (projectile.effect === 'lightning') {
            if (accentRef.current) {
                accentRef.current.rotation.z = Math.sin(phase * 3.2) * 0.42;
                accentRef.current.scale.set(1, 0.9 + Math.sin(phase * 4) * 0.12, 1);
            }
        } else if (projectile.effect === 'poison_cloud' || projectile.effect === 'poison_bolt') {
            if (accentRef.current) accentRef.current.scale.setScalar(1.02 + Math.sin(phase * 0.9) * 0.16);
            if (coreRef.current) coreRef.current.scale.setScalar(0.92 + Math.cos(phase * 1.1) * 0.08);
        } else if (projectile.effect === 'disrupt_nonmaterial') {
            if (accentRef.current) {
                accentRef.current.rotation.x += delta * 2.2;
                accentRef.current.rotation.y += delta * 1.6;
                accentRef.current.scale.setScalar(1 + Math.sin(phase * 1.7) * 0.1);
            }
        }
    });

    const directionRotation: Record<Direction, number> = {
        NORTH: 0,
        SOUTH: Math.PI,
        EAST: -Math.PI / 2,
        WEST: Math.PI / 2,
    };

    return (
        <group position={[projectile.x * GRID_SIZE, 0, projectile.y * GRID_SIZE]}>
            {projectile.effect === 'fireball' ? (
                <>
                    <mesh ref={glowRef} geometry={sphereShellGeometry} material={glowMaterial} />
                    <mesh ref={accentRef} geometry={fireballFlareGeometry} material={accentMaterial} />
                    <mesh ref={shellRef} geometry={sphereGlowGeometry} material={accentMaterial} />
                    <mesh ref={coreRef} geometry={sphereCoreGeometry} material={coreMaterial} />
                </>
            ) : projectile.effect === 'lightning' ? (
                <>
                    <mesh ref={glowRef} geometry={sphereGlowGeometry} material={glowMaterial} />
                    <mesh
                        ref={accentRef}
                        geometry={lightningBoltGeometry}
                        material={accentMaterial}
                        rotation={[0, 0, directionRotation[projectile.direction ?? 'NORTH']]}
                    />
                    <mesh ref={coreRef} geometry={sphereCoreGeometry} material={coreMaterial} />
                </>
            ) : projectile.effect === 'poison_cloud' || projectile.effect === 'poison_bolt' ? (
                <>
                    <mesh ref={glowRef} geometry={sphereShellGeometry} material={glowMaterial} />
                    <mesh ref={accentRef} geometry={poisonCloudGeometry} material={accentMaterial} position={[0.08, 0.03, -0.05]} />
                    <mesh ref={shellRef} geometry={poisonCloudGeometry} material={glowMaterial} position={[-0.06, -0.02, 0.07]} />
                    <mesh ref={coreRef} geometry={sphereCoreGeometry} material={coreMaterial} />
                </>
            ) : (
                <>
                    <mesh ref={glowRef} geometry={sphereShellGeometry} material={glowMaterial} />
                    <mesh ref={accentRef} geometry={disruptRingGeometry} material={accentMaterial} rotation={[Math.PI / 2, 0, 0]} />
                    <mesh ref={shellRef} geometry={sphereGlowGeometry} material={glowMaterial} />
                    <mesh ref={coreRef} geometry={sphereCoreGeometry} material={coreMaterial} />
                </>
            )}
        </group>
    );
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

    const now = Date.now();
    const magicActive = activeShields.some((shield) => shield.expiresAt > now && !shield.fireOnly);
    const fireActive = activeShields.some((shield) => shield.expiresAt > now && shield.fireOnly);
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
    const activeCreatures = useMemo(
        () => creatures.filter((creature) => creature.alive && creature.mapIndex === level && getCreatureFluxcageExpiry(creature.id) > Date.now()),
        [creatures, level],
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

const SpellImpactLayer: React.FC = () => {
    const spellVisualEvents = useStore(s => s.spellVisualEvents);
    const level = useStore(s => s.level);
    const impacts = useMemo(
        () => spellVisualEvents.filter((event) => event.level === level),
        [spellVisualEvents, level],
    );
    const ringGeometry = useMemo(() => new THREE.RingGeometry(0.1, 0.26, 24), []);
    const fireMaterial = useMemo(() => createPulseMaterial('#ff8a3d', 0.42), []);
    const lightningMaterial = useMemo(() => createPulseMaterial('#d7f7ff', 0.34), []);
    const poisonMaterial = useMemo(() => createPulseMaterial('#8cff8b', 0.32), []);
    const disruptMaterial = useMemo(() => createPulseMaterial('#aeefff', 0.3), []);

    useEffect(() => () => {
        ringGeometry.dispose();
        fireMaterial.dispose();
        lightningMaterial.dispose();
        poisonMaterial.dispose();
        disruptMaterial.dispose();
    }, [ringGeometry, fireMaterial, lightningMaterial, poisonMaterial, disruptMaterial]);

    const materialByEffect: Record<SpellVisualEvent['effect'], THREE.MeshBasicMaterial> = {
        fireball: fireMaterial,
        lightning: lightningMaterial,
        poison_cloud: poisonMaterial,
        poison_bolt: poisonMaterial,
        disrupt_nonmaterial: disruptMaterial,
    };

    return (
        <>
            {impacts.map((event) => (
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
        const scale = event.kind === 'wall' ? 0.58 + t * 1.55 : 0.72 + t * 1.3;
        meshRef.current.scale.setScalar(scale);
        (meshRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.45;
        meshRef.current.visible = t < 1;
        if (lightRef.current) {
            const baseIntensity =
                event.effect === 'fireball' ? 1.8 :
                    event.effect === 'lightning' ? 1.55 :
                        event.effect === 'poison_cloud' || event.effect === 'poison_bolt' ? 0.8 : 1.0;
            lightRef.current.intensity = Math.max(0, (1 - t) * baseIntensity);
            lightRef.current.distance =
                event.effect === 'fireball' ? GRID_SIZE * 1.7 :
                    event.effect === 'lightning' ? GRID_SIZE * 1.45 : GRID_SIZE * 1.1;
        }
    });

    const lightColor =
        event.effect === 'fireball' ? '#ff8a3d'
            : event.effect === 'lightning' ? '#b7e8ff'
                : event.effect === 'poison_cloud' || event.effect === 'poison_bolt' ? '#8cff8b'
                    : '#aeefff';

    return (
        <group position={[event.x * GRID_SIZE, GRID_SIZE * 0.06, event.y * GRID_SIZE]}>
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
    return (
        <>
            {damageEvents.map(evt => (
                <Html
                    key={evt.id}
                    position={[evt.x * GRID_SIZE, WALL_HEIGHT * 0.7, evt.y * GRID_SIZE]}
                    center occlude={false} zIndexRange={[200, 300]}
                    style={{ pointerEvents: 'none' }}
                >
                    <div className="dmg-bubble" style={{
                        background: 'rgba(200,30,10,0.90)', color: '#fff',
                        padding: '4px 11px', borderRadius: 16, fontFamily: 'monospace',
                        fontWeight: 'bold', fontSize: 22, textShadow: '0 1px 8px #000',
                        border: '1px solid rgba(255,100,60,0.8)', boxShadow: '0 2px 14px rgba(0,0,0,0.8)',
                        whiteSpace: 'nowrap',
                    }}>
                        -{evt.amount}
                    </div>
                </Html>
            ))}
        </>
    );
};

// ─── Floor items layer ────────────────────────────────────────────────────────
const FloorItemsLayer: React.FC = () => {
    const floorItems = useStore(s => s.floorItems);
    const level      = useStore(s => s.level);
    const pickupItem = useStore(s => s.pickupItem);
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
                .map(i => (
                    isWallMounted(i)
                        ? <WallMountedItemMesh key={i.id} item={i} onPickup={() => pickupItem(i.id)} />
                        : <FloorItemMesh key={i.id} item={i} onPickup={() => pickupItem(i.id)} />
                ))
            }
        </>
    );
};

// ─── Static tile grid (re-renders only when level or doors change) ────────────
const TileGrid: React.FC<{
    map: GameMap;
    level: number;
    openDoors: Set<string>;
    openWalls: Set<string>;
    recruitedIds: Set<number>;
    wallButtons: { tileX: number; tileY: number; face: CardinalDir; sensorIndex: number }[];
    wallDecals: OriginalWallOverlayRender[];
    pressurePlates: { tileX: number; tileY: number }[];
    onCellClick: (e: ThreeEvent<MouseEvent>, renderType: CellRenderType, x: number, y: number) => void;
    onWallSensor: (level: number, x: number, y: number, sensorIndex: number) => void;
}> = memo(({ map, level, openDoors, openWalls, recruitedIds, wallButtons, wallDecals, pressurePlates, onCellClick, onWallSensor  }) => {
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
            {wallDecals.map(({ tileX, tileY, face, image, label, accent, width, height }, i) => (
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
                />
            ))}
        </group>
    );
});

// ─── Scene ────────────────────────────────────────────────────────────────────
export const DungeonScene = () => {
    // Only subscribe to stable/slow-changing state here
    const level          = useStore(s => s.level);
    const position       = useStore(s => s.position);
    const direction      = useStore(s => s.direction);
    const openDoors      = useStore(s => s.openDoors);
    const openWalls      = useStore(s => s.openWalls);
    const openMirror     = useStore(s => s.openMirror);
    const toggleDoor     = useStore(s => s.toggleDoor);
    const activateWallSensor = useStore(s => s.activateWallSensor);
    const useItemOnFrontWall = useStore(s => s.useItemOnFrontWall);
    const activeSensors  = useStore(s => s.activeSensors);
    const party          = useStore(s => s.party);

    const map = getGameMap(level);
    const recruitedIds = useMemo(() => new Set(party.map(c => c.id)), [party]);

    const wallButtons = useMemo(() => {
        const buttons: { tileX: number; tileY: number; face: CardinalDir; sensorIndex: number }[] = [];
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Sensor') continue;
                    const s = obj as SensorObject;
                    if (s.type !== 2) continue;
                    buttons.push({ tileX: tile.x, tileY: tile.y, face: s.tilePos, sensorIndex: s.index });
                }
            }
        }
        return buttons;
    }, [map]);

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
        const add = (overlay: OriginalWallOverlayRender) => {
            const visualKey = overlay.image ?? overlay.label ?? 'overlay';
            const key = `${overlay.tileX}_${overlay.tileY}_${overlay.face}_${visualKey}`;
            if (seen.has(key)) return;
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

        for (const overlay of getOriginalWallOverlaysForMap(map, activeSensors)) {
            add(overlay);
        }

        return decals;
    }, [map, level, activeSensors]);

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
        if (renderType === 'Mirror') {
            const champion = MIRROR_WALL_MAP.get(`${level},${x},${y}`);
            if (champion) openMirror(champion.id);
        }
        if (renderType === 'Door') toggleDoor(x, y);
    }, [level, openMirror, toggleDoor]);

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
        const mechanism = getMechanismsAt(level, frontTileX, frontTileY, frontFace).find((entry) =>
            entry.trigger === 'wall-lock' || entry.trigger === 'alcove' || entry.trigger === 'object-exchanger',
        );
        if (!mechanism) return null;
        return {
            tileX: frontTileX,
            tileY: frontTileY,
            face: frontFace,
            requirement: mechanism.requires,
            label: mechanism.trigger === 'alcove' ? 'ALCOVE' : mechanism.trigger === 'object-exchanger' ? 'RECEPTACLE' : 'SERRURE',
        };
    }, [direction, level, map, position]);

    const handleCanvasCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
        const canvas = gl.domElement;

        const onContextLost = (event: Event) => {
            event.preventDefault();
            console.warn('WebGL context lost.');
        };

        const onContextRestored = () => {
            console.warn('WebGL context restored.');
        };

        canvas.addEventListener('webglcontextlost', onContextLost, false);
        canvas.addEventListener('webglcontextrestored', onContextRestored, false);
    }, []);

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
            <LevelName key={level} level={level} />
            <DarknessOverlay />

            <Canvas
                dpr={[1, 1.25]}
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
                {frontWallItemMechanism && (
                    <FrontWallLockDropTarget
                        tileX={frontWallItemMechanism.tileX}
                        tileY={frontWallItemMechanism.tileY}
                        face={frontWallItemMechanism.face}
                        label={frontWallItemMechanism.label}
                        requirement={frontWallItemMechanism.requirement}
                        onUseItem={useItemOnFrontWall}
                    />
                )}

                <TileGrid
                    map={map}
                    level={level}
                    openDoors={openDoors}
                    openWalls={openWalls}
                    recruitedIds={recruitedIds}
                    wallButtons={wallButtons}
                    wallDecals={wallDecals}
                    pressurePlates={pressurePlates}
                    onCellClick={handleCellClick}
                    onWallSensor={activateWallSensor}
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
                <DamageLayer />
                <SpellImpactLayer />
                <FloorItemsLayer />
                <ProjectileRenderer />
            </Canvas>
        </div>
    );
};
