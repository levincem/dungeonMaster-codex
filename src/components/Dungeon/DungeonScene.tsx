import { useRef, useMemo, memo, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
    useStore,
    MIRROR_WALL_MAP,
    MIRROR_FACE_MAP,
    STAIR_CONNECTIONS,
    VI_ALTAR_RESURRECTION_MESSAGE,
    isSelfRevealingWallTile,
} from '../../engine/store';
import { CREATURE_TYPES } from '../../data/creatures';
import { getMapMechanisms, getMechanismsAt } from '../../data/mechanisms';
import {
    getOriginalWallOverlaysForMap,
    hasEffectiveOriginalWallOverlayAt,
    hasOriginalWallOverlayAt,
    type OriginalWallOverlayRender,
} from '../../data/originalWallOverlays';
import type { Direction } from '../../engine/runtimeTypes';
import { computeLightLevel } from '../../engine/store';
import { getGameMap, toGlobalCoords } from '../../data/mapLoader';
import type { GameMap, GameTile, TeleporterObject, CardinalDir, DoorObject } from '../../types/game';
import type { Champion } from '../../data/champions';
import type { EquipSlotKey } from '../../types/items';
import { canFillWaterContainer } from '../../data/waterContainers';
import { Cell, PressurePlate } from './Cell';
import type { CellRenderType } from './Cell';
import { InstancedTiles } from './InstancedTiles';
import { WallSensor } from './WallSensor';
import { WallDecal } from './WallDecal';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import { getFloorItemImage } from '../../data/itemImages';
import { texturesPath } from '../../data/assetPaths';
import { doorBlocksVision } from '../../data/doors';
import { getDragPayload, hasActiveDragPayload } from '../UI/dragPayload';
import { useI18n } from '../../i18n';
import { useLoadedTexture } from './useLoadedTexture';
import {
    buildDungeonSceneWallButtons,
    buildDungeonSceneWallDecals,
    collectDungeonScenePressurePlates,
    collectDungeonScenePits,
    collectDungeonSceneTeleporters,
    collectDungeonSceneTrickWalls,
    resolveAltarDropTargets,
    resolveFrontWallInteractionKind,
} from './dungeonSceneDerivedState';
import {
    DUNGEON_DRAG_DROP_BANDS,
    isPointerInsideDungeonViewport,
    performDungeonDragDropAction,
    resolveDungeonDragDropDestination,
    resolveDungeonWallDropTarget,
    shouldRenderDungeonSceneDragOverlay,
} from './dungeonDragDrop';
import {
    WallTextPlanes as SceneWallTextPlanes,
} from './WallTextLayer';
import { isDoorTileVisible as isSceneDoorTileVisible } from './wallTextHelpers';
import {
    FluxcageLayer,
    PoisonCloudLayer,
    ProjectileRenderer,
    ShieldAuraLayer,
    TeleporterLayer,
} from './DungeonProjectileLayers';
import { MagicVisionLayer } from './DungeonMagicVisionLayer';
import {
    CreaturesLayer,
    DamageLayer,
    FloorItemsLayer,
    FootprintLayer,
} from './DungeonSceneRuntimeLayers';
import { SpellImpactLayer } from './DungeonSpellImpactLayer';
import { useTemporalFlag, useWallClock } from './useWallClock';
import { creaturesInFront, isCreatureContactCell } from '../../engine/systems/frontCreatureState';

const HALF = GRID_SIZE / 2;
const BASE_FOG_NEAR = GRID_SIZE * 2;
const BASE_FOG_FAR = GRID_SIZE * 7;
type RenderDebugState = {
    wallTexts: boolean;
    wallDecals: boolean;
    wallButtons: boolean;
};

function isDungeonRenderDebugEnabled(): boolean {
    if (!import.meta.env.DEV) return false;
    if (typeof window === 'undefined') return false;

    const params = new URLSearchParams(window.location.search);
    if (params.get('dungeonDebug') === '1') return true;

    return window.localStorage.getItem('dm_dungeon_debug') === '1';
}

const RENDER_DEBUG_ENABLED = isDungeonRenderDebugEnabled();
const CREATURE_DEBUG_OVERLAY_ENABLED = import.meta.env.DEV;

const DEFAULT_RENDER_DEBUG_STATE: RenderDebugState = {
    wallTexts: true,
    wallDecals: true,
    wallButtons: true,
};

function getDebugPanelStyle(position: { top: number; left?: number; right?: number }) {
    return {
        position: 'fixed',
        top: position.top,
        ...(typeof position.left === 'number' ? { left: position.left } : {}),
        ...(typeof position.right === 'number' ? { right: position.right } : {}),
        zIndex: 340,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(10, 10, 10, 0.72)',
        border: '1px solid rgba(197, 164, 106, 0.28)',
        color: '#d8c48f',
        fontFamily: '"Courier New", monospace',
        fontSize: 11,
        lineHeight: 1.35,
        pointerEvents: 'auto',
        userSelect: 'text',
        cursor: 'text',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        maxWidth: 460,
        maxHeight: '42vh',
        overflowY: 'auto',
    } as const;
}

function getCopyableDebugPanelStyle(position: { bottom: number; left?: number; right?: number }) {
    return {
        position: 'fixed',
        bottom: position.bottom,
        ...(typeof position.left === 'number' ? { left: position.left } : {}),
        ...(typeof position.right === 'number' ? { right: position.right } : {}),
        zIndex: 430,
        width: 520,
        maxWidth: 'calc(100vw - 28px)',
        height: 230,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(8, 10, 14, 0.9)',
        border: '1px solid rgba(197, 164, 106, 0.42)',
        color: '#d8c48f',
        fontFamily: '"Courier New", monospace',
        fontSize: 11,
        lineHeight: 1.35,
        pointerEvents: 'auto',
        userSelect: 'text',
        cursor: 'text',
        whiteSpace: 'pre',
        resize: 'both',
        overflow: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.38)',
    } as const;
}

const DUNGEON_AMBIENT_COLOR = new THREE.Color('#f4e2ba');
const DUNGEON_DARK_AMBIENT_COLOR = new THREE.Color('#8ea0c0');
const CAMERA_HEIGHT_OFFSET = 0;
const CAMERA_FORWARD_OFFSET = 0;
const CAMERA_LATERAL_OFFSET = 0;
const CAMERA_FOV = 80;
const CAMERA_ROTATION_MAP = { NORTH: 0, EAST: -Math.PI / 2, SOUTH: Math.PI, WEST: Math.PI / 2 };
const CAMERA_FORWARD_VECTOR_MAP = {
    NORTH: new THREE.Vector3(0, 0, -1),
    EAST: new THREE.Vector3(1, 0, 0),
    SOUTH: new THREE.Vector3(0, 0, 1),
    WEST: new THREE.Vector3(-1, 0, 0),
};
const CAMERA_RIGHT_VECTOR_MAP = {
    NORTH: new THREE.Vector3(1, 0, 0),
    EAST: new THREE.Vector3(0, 0, 1),
    SOUTH: new THREE.Vector3(-1, 0, 0),
    WEST: new THREE.Vector3(0, 0, -1),
};
const loadPhotonEffects = () => import('./PhotonsFireball');

function cloneTexture<T extends THREE.Texture>(
    texture: T,
    configure?: (next: T) => void,
): T {
    const next = texture.clone() as T;
    configure?.(next);
    next.needsUpdate = true;
    return next;
}

const VI_ALTAR_MIRACLE_OVERLAY_LIFETIME_MS = 1700;
const VI_ALTAR_MIRACLE_SPARKLES = [
    { left: '16%', top: '22%', size: 16, driftX: -18, driftY: -20, delay: 0.02 },
    { left: '27%', top: '36%', size: 10, driftX: -10, driftY: -28, delay: 0.14 },
    { left: '39%', top: '18%', size: 13, driftX: 0, driftY: -24, delay: 0.08 },
    { left: '51%', top: '32%', size: 18, driftX: 8, driftY: -34, delay: 0.18 },
    { left: '62%', top: '20%', size: 12, driftX: 12, driftY: -22, delay: 0.04 },
    { left: '72%', top: '38%', size: 11, driftX: 16, driftY: -26, delay: 0.2 },
    { left: '82%', top: '24%', size: 15, driftX: 20, driftY: -18, delay: 0.1 },
];

const ViAltarMiracleOverlay: React.FC = () => {
    const lastCastResult = useStore(s => s.lastCastResult);
    const wallClockNow = useWallClock(33);
    const now = wallClockNow === 0 ? (lastCastResult?.ts ?? 0) : wallClockNow;

    if (!lastCastResult?.success || lastCastResult.message !== VI_ALTAR_RESURRECTION_MESSAGE) {
        return null;
    }

    const age = now - lastCastResult.ts;
    if (age < 0 || age > VI_ALTAR_MIRACLE_OVERLAY_LIFETIME_MS) {
        return null;
    }

    const progress = age / VI_ALTAR_MIRACLE_OVERLAY_LIFETIME_MS;
    const warmOpacity = Math.max(0, 0.85 - progress * 0.82);
    const glowScale = 0.94 + progress * 0.22;

    return (
        <div
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                zIndex: 130,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: '-12%',
                    opacity: warmOpacity,
                    background: `radial-gradient(circle at 50% 48%, rgba(255,244,190,${0.54 * warmOpacity}) 0%, rgba(255,205,104,${0.42 * warmOpacity}) 22%, rgba(255,138,64,${0.18 * warmOpacity}) 44%, rgba(255,138,64,0) 72%)`,
                    transform: `scale(${glowScale})`,
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '46%',
                    width: '46%',
                    aspectRatio: '1 / 1',
                    transform: `translate(-50%, -50%) scale(${1 + progress * 0.16})`,
                    borderRadius: '50%',
                    opacity: Math.max(0, 0.5 - progress * 0.42),
                    background: `radial-gradient(circle, rgba(255,251,226,${0.52 * warmOpacity}) 0%, rgba(255,216,128,${0.32 * warmOpacity}) 36%, rgba(255,216,128,0) 70%)`,
                    filter: 'blur(10px)',
                }}
            />
            {VI_ALTAR_MIRACLE_SPARKLES.map((sparkle, index) => {
                const localProgress = Math.max(0, Math.min(1, (progress - sparkle.delay) / (1 - sparkle.delay)));
                const sparkleOpacity = Math.max(0, (1 - localProgress) * 0.95);
                const sparkleScale = 0.7 + localProgress * 0.85;
                return (
                    <div
                        key={`vi_miracle_sparkle_${index}`}
                        style={{
                            position: 'absolute',
                            left: sparkle.left,
                            top: sparkle.top,
                            width: sparkle.size,
                            height: sparkle.size,
                            opacity: sparkleOpacity,
                            transform: `translate(${sparkle.driftX * localProgress}px, ${sparkle.driftY * localProgress}px) scale(${sparkleScale}) rotate(${localProgress * 22}deg)`,
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(255,255,246,0.95) 0%, rgba(255,230,150,0.92) 38%, rgba(255,230,150,0) 72%)',
                                filter: 'blur(0.5px)',
                            }}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                width: 2,
                                height: '160%',
                                transform: 'translate(-50%, -50%)',
                                borderRadius: 999,
                                background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,244,210,0.96) 50%, rgba(255,255,255,0) 100%)',
                                boxShadow: '0 0 12px rgba(255,223,140,0.6)',
                            }}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                width: '160%',
                                height: 2,
                                transform: 'translate(-50%, -50%)',
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,244,210,0.96) 50%, rgba(255,255,255,0) 100%)',
                                boxShadow: '0 0 12px rgba(255,223,140,0.6)',
                            }}
                        />
                    </div>
                );
            })}
        </div>
    );
};

// Camera smooth follow
const CameraController = () => {
    const level = useStore(s => s.level);
    const position  = useStore(s => s.position);
    const direction = useStore(s => s.direction);
    const cameraRef = useRef<THREE.PerspectiveCamera>(null);
    const previousCamera = useThree(s => s.camera);
    const setThreeState = useThree(s => s.set);
    const size = useThree(s => s.size);
    const initializedRef = useRef(false);
    const prevLevelRef = useRef(level);
    const prevPositionRef = useRef<[number, number]>(position);
    const targetPos = useMemo(() => {
        const base = new THREE.Vector3(position[1] * GRID_SIZE, CAMERA_HEIGHT_OFFSET, position[0] * GRID_SIZE);
        const forward = CAMERA_FORWARD_VECTOR_MAP[direction as keyof typeof CAMERA_FORWARD_VECTOR_MAP]
            .clone()
            .multiplyScalar(CAMERA_FORWARD_OFFSET);
        const lateral = CAMERA_RIGHT_VECTOR_MAP[direction as keyof typeof CAMERA_RIGHT_VECTOR_MAP]
            .clone()
            .multiplyScalar(CAMERA_LATERAL_OFFSET);
        return base.add(forward).add(lateral);
    }, [direction, position]);
    const targetRot = CAMERA_ROTATION_MAP[direction as keyof typeof CAMERA_ROTATION_MAP];
    const [initialCameraPosition] = useState<[number, number, number]>(() => [targetPos.x, targetPos.y, targetPos.z]);
    const [initialCameraRotation] = useState<[number, number, number]>(() => [0, targetRot, 0]);

    useEffect(() => {
        if (!cameraRef.current) return;
        const nextCamera = cameraRef.current;
        setThreeState({ camera: nextCamera });
        return () => {
            setThreeState({ camera: previousCamera });
        };
    }, [previousCamera, setThreeState]);

    useEffect(() => {
        const camera = cameraRef.current;
        if (!camera) return;

        camera.fov = CAMERA_FOV;
        camera.aspect = Math.max(1, size.width) / Math.max(1, size.height);
        camera.updateProjectionMatrix();
    }, [size.height, size.width]);

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
        <perspectiveCamera
            ref={cameraRef}
            position={initialCameraPosition}
            rotation={initialCameraRotation}
            fov={CAMERA_FOV}
        />
    );
};

// Boundary wall planes
const BoundaryWalls = memo(({ map }: { map: GameMap }) => {
    const seeThroughWallsUntil = useStore(s => s.seeThroughWallsUntil);
    const wallTransparent = useTemporalFlag(seeThroughWallsUntil, 120);
    const baseWall = useLoadedTexture(`${texturesPath('wall.png')}?v=2`);
    const wall = useMemo(
        () => cloneTexture(baseWall, next => {
            next.wrapS = THREE.RepeatWrapping;
            next.wrapT = THREE.RepeatWrapping;
        }),
        [baseWall],
    );
    useEffect(() => () => wall.dispose(), [wall]);

    const planes: React.ReactElement[] = [];
    for (const row of map.tiles) {
        for (const tile of row) {
            if (tile.type === 'Wall') continue;
            const wx = tile.x * GRID_SIZE;
            const wz = tile.y * GRID_SIZE;
            const mat = <meshBasicMaterial map={wall} side={THREE.DoubleSide} transparent={wallTransparent} opacity={wallTransparent ? 0.34 : 1} depthWrite={!wallTransparent} />;
            if (tile.y === 0)
                planes.push(<mesh key={`N-${tile.x}-${tile.y}`} position={[wx, 0, wz - HALF]} rotation={[0, Math.PI, 0]}><planeGeometry args={[GRID_SIZE, WALL_HEIGHT]} />{mat}</mesh>);
            if (tile.y === map.height - 1)
                planes.push(<mesh key={`S-${tile.x}-${tile.y}`} position={[wx, 0, wz + HALF]}><planeGeometry args={[GRID_SIZE, WALL_HEIGHT]} />{mat}</mesh>);
            if (tile.x === 0)
                planes.push(<mesh key={`W-${tile.x}-${tile.y}`} position={[wx - HALF, 0, wz]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[GRID_SIZE, WALL_HEIGHT]} />{mat}</mesh>);
            if (tile.x === map.width - 1)
                planes.push(<mesh key={`E-${tile.x}-${tile.y}`} position={[wx + HALF, 0, wz]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[GRID_SIZE, WALL_HEIGHT]} />{mat}</mesh>);
        }
    }
    return <>{planes}</>;
});

// Tile render-type derivation
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

function resolveStairsEntryFace(map: GameMap, x: number, y: number): CardinalDir {
    const neighbours: Array<{ dx: number; dy: number; dir: CardinalDir }> = [
        { dx: 0, dy: -1, dir: 'North' },
        { dx: 0, dy: 1, dir: 'South' },
        { dx: 1, dy: 0, dir: 'East' },
        { dx: -1, dy: 0, dir: 'West' },
    ];
    for (const { dx, dy, dir } of neighbours) {
        const row = map.tiles[y + dy];
        const neighbour = row?.[x + dx];
        if (neighbour && neighbour.type !== 'Wall') return dir;
    }
    return 'South';
}

// Level name overlay
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

const LightController: React.FC = () => {
    const levelIndex = useStore(s => s.level);
    const paused = useStore(s => s.paused);
    const spellLights      = useStore(s => s.spellLights);
    const torchBurnStart   = useStore(s => s.torchBurnStart);
    const championEquipment = useStore(s => s.championEquipment);
    const lightRef = useRef<THREE.AmbientLight>(null);

    useFrame(() => {
        if (!lightRef.current) return;
        if (paused) return;
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

const DarknessOverlay: React.FC = () => {
    const levelIndex = useStore(s => s.level);
    const paused = useStore(s => s.paused);
    const pausedAt = useStore(s => s.pausedAt ?? null);
    const spellLights = useStore(s => s.spellLights);
    const torchBurnStart = useStore(s => s.torchBurnStart);
    const championEquipment = useStore(s => s.championEquipment);
    const wallClockNow = useWallClock(250);
    const effectiveNow = paused && typeof pausedAt === 'number' ? pausedAt : wallClockNow;
    const opacity = useMemo(() => {
        if (levelIndex === 0) {
            return 0;
        }
        const level = computeLightLevel(spellLights, torchBurnStart, championEquipment, effectiveNow);
        return Math.max(0, 0.84 - level * 0.84);
    }, [championEquipment, effectiveNow, levelIndex, spellLights, torchBurnStart]);

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

// Projectile renderer

type WallDropPlacement = 'front' | 'left' | 'right';

const WallMechanismDropTarget = ({ kind, placement = 'front', wallX, wallY, wallFace, onUseItem, onActivate, activeFloorDragItemId, selectedChampionId, onUseFloorItem }: {
    kind: 'wall-lock' | 'wall-button' | 'alcove' | 'object-exchanger' | 'altar' | 'fountain';
    placement?: WallDropPlacement;
    wallX?: number;
    wallY?: number;
    wallFace?: CardinalDir;
    onUseItem: (championId: number, itemId: string, fromSlot: EquipSlotKey | 'inventory') => boolean;
    onActivate?: (championId: number) => void;
    activeFloorDragItemId?: string | null;
    selectedChampionId?: number | null;
    onUseFloorItem?: (itemId: string, championId: number) => boolean;
}) => {
    const text = useI18n().dungeonScene;
    const [over, setOver] = useState(false);
    const isLock = kind === 'wall-lock';
    const isAlcove = kind === 'alcove';
    const isAltar = kind === 'altar';
    const isFountain = kind === 'fountain';
    const wallDropDataset = {
        'data-dm-wall-drop': 'true',
        'data-dm-wall-drop-kind': kind,
        ...(typeof wallX === 'number' ? { 'data-dm-wall-drop-x': wallX } : {}),
        ...(typeof wallY === 'number' ? { 'data-dm-wall-drop-y': wallY } : {}),
        ...(wallFace ? { 'data-dm-wall-drop-face': wallFace } : {}),
    };
    const placementStyle: React.CSSProperties = placement === 'front'
        ? {
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
        }
        : placement === 'left'
            ? {
                left: '26%',
                top: '52%',
                transform: 'translate(-50%, -50%)',
            }
            : {
                left: '74%',
                top: '52%',
                transform: 'translate(-50%, -50%)',
            };
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
            : isAltar
                ? {
                    width: 104,
                    height: 30,
                    borderRadius: 999,
                    border: `2px solid ${over ? '#f2d27f' : '#9f7730'}`,
                    background: 'linear-gradient(180deg, rgba(72,46,18,0.9), rgba(22,14,6,0.98))',
                    boxShadow: over ? '0 0 16px rgba(242, 210, 127, 0.32)' : 'inset 0 0 14px rgba(0,0,0,0.78)',
                }
            : isFountain
                ? {
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: `2px solid ${over ? '#a8e6ff' : '#4b90bf'}`,
                    background: 'radial-gradient(circle at 45% 30%, rgba(210,245,255,0.92), rgba(70,150,210,0.78) 42%, rgba(6,24,42,0.96) 78%)',
                    boxShadow: over ? '0 0 18px rgba(122, 211, 255, 0.38)' : 'inset 0 0 14px rgba(0,0,0,0.62)',
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
            {...wallDropDataset}
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
                if (payload.fromSlot === 'container') return;
                onUseItem(payload.fromChampionId, payload.itemId, payload.fromSlot);
            }}
            onClick={() => {
                if (!isFountain || selectedChampionId == null) return;
                onActivate?.(selectedChampionId);
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
                width: isLock ? 96 : isAlcove ? 132 : isAltar ? 172 : isFountain ? 148 : 124,
                minHeight: isAltar ? 92 : isFountain ? 88 : 78,
                padding: isAltar ? '10px 12px' : '8px 10px',
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
                ...placementStyle,
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
                {isLock
                    ? text.dropKeyHere
                    : isAlcove
                        ? text.placeItemHere
                        : isAltar
                            ? text.dropBonesHere
                            : isFountain
                                ? text.drinkOrFillHere
                                : text.offerItemHere}
            </div>
        </div>
    );
};

let lastShownLevelNameOverlay: number | null = null;

const LevelNameOverlay = ({ level }: { level: number }) => {
    const shouldShow = level !== lastShownLevelNameOverlay;

    useEffect(() => {
        if (!shouldShow) return;
        lastShownLevelNameOverlay = level;
    }, [level, shouldShow]);

    if (!shouldShow) return null;
    return <LevelName level={level} />;
};

const DungeonSceneDebugOverlay: React.FC<{
    renderDebug: RenderDebugState;
    level: number;
    position: [number, number];
    direction: Direction;
    map: GameMap;
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
}> = ({ renderDebug, level, position, direction, map, openDoors, openPits, openTeleporters, openWalls }) => {
    const text = useI18n().dungeonScene;
    const gamePhase = useStore((s) => s.gamePhase);
    const paused = useStore((s) => s.paused);
    const movementCooldown = useStore((s) => s.movementCooldown);
    const creatures = useStore((s) => s.creatures);
    const lastMonsterAttackDebug = useStore((s) => s.lastMonsterAttackDebug);

    const frontCreatureDebugLines = useMemo(() => {
        const frontCreatures = creaturesInFront(level, position, direction, creatures);
        if (frontCreatures.length === 0) {
            return ['Front creatures: none'];
        }

        return [
            `Front creatures (${frontCreatures.length})`,
            ...frontCreatures.map((creature, index) => {
                const def = CREATURE_TYPES[creature.typeId];
                const label = def?.name ?? `Creature ${creature.typeId}`;
                return `${index + 1}. ${label} [${creature.cell}] HP ${creature.currentHP}/${def?.baseHP ?? '?'} | ATK ${def?.rawAttack ?? '?'} | ARM ${def?.armor ?? '?'} | HIT ${def?.hitProb ?? '?'} | ASPD ${def?.atkSpd ?? '?'} | MSPD ${def?.moveSpd ?? '?'}${def?.absorbMissiles ? ' | ABSORB' : ''}`;
            }),
        ];
    }, [creatures, direction, level, position]);

    const forwardMoveDebugLines = useMemo(() => {
        const [currentY, currentX] = position;
        const targetX = direction === 'EAST' ? currentX + 1 : direction === 'WEST' ? currentX - 1 : currentX;
        const targetY = direction === 'NORTH' ? currentY - 1 : direction === 'SOUTH' ? currentY + 1 : currentY;
        const currentTile = map.tiles[currentY]?.[currentX];
        const targetTile = map.tiles[targetY]?.[targetX];
        const targetKey = `${level},${targetY},${targetX}`;
        const forwardBlockedByTerrain =
            !targetTile ||
            targetTile.type === 'Wall' ||
            (targetTile.type === 'TrickWall' && !openWalls.has(targetKey)) ||
            (targetTile.type === 'Door' && !openDoors.has(targetKey)) ||
            (targetTile.type === 'Pit' && openPits.has(targetKey));
        const targetCreatures = creatures.filter((creature) =>
            creature.alive &&
            creature.mapIndex === level &&
            creature.x === targetX &&
            creature.y === targetY,
        );
        const currentKey = `${level},${currentY},${currentX}`;
        const phaseAllowsMovement = gamePhase === 'exploration' && !paused;
        const shouldMoveForward =
            phaseAllowsMovement &&
            (!Number.isFinite(movementCooldown) || movementCooldown <= 0) &&
            !forwardBlockedByTerrain &&
            targetCreatures.length === 0;

        return [
            'Forward move debug',
            `from [${currentX},${currentY}] ${currentTile?.type ?? 'void'}${currentTile?.type === 'TrickWall' ? ` (${openWalls.has(currentKey) ? 'open' : 'closed'})` : ''} -> [${targetX},${targetY}] ${targetTile?.type ?? 'void'}${targetTile?.type === 'TrickWall' ? ` (${openWalls.has(targetKey) ? 'open' : 'closed'})` : ''}${targetTile?.type === 'Door' ? ` (${openDoors.has(targetKey) ? 'open' : 'closed'})` : ''}${targetTile?.type === 'Pit' ? ` (${openPits.has(targetKey) ? 'open' : 'closed'})` : ''}`,
            `phase ${gamePhase}${paused ? ' (paused)' : ''}`,
            `cooldown ${Number.isFinite(movementCooldown) ? movementCooldown.toFixed(3) : String(movementCooldown)} | teleporter ${openTeleporters.has(targetKey) ? 'target-open' : 'target-off'} | should move ${shouldMoveForward ? 'YES' : 'NO'}`,
            targetCreatures.length > 0
                ? `target creatures: ${targetCreatures.map((creature) => {
                    const def = CREATURE_TYPES[creature.typeId];
                    return `${def?.name ?? `Creature ${creature.typeId}`} [${creature.cell}] HP ${creature.currentHP}`;
                }).join(' | ')}`
                : 'target creatures: none',
        ];
    }, [creatures, direction, gamePhase, level, map, movementCooldown, openDoors, openPits, openTeleporters, openWalls, paused, position]);

    const lastMonsterAttackDebugLines = useMemo(() => {
        if (!lastMonsterAttackDebug) {
            return ['Last monster hit: none'];
        }
        return [
            'Last monster hit',
            `${lastMonsterAttackDebug.attackerName} -> ${lastMonsterAttackDebug.targetName} | ${lastMonsterAttackDebug.attackMode} ${lastMonsterAttackDebug.attackType}`,
            `QCK ${lastMonsterAttackDebug.quickness}/${lastMonsterAttackDebug.requiredQuickness} | PARRY ${lastMonsterAttackDebug.parryMastery} | ROLL ${lastMonsterAttackDebug.rolledAttack}`,
            `DEF ${lastMonsterAttackDebug.defenseApplied ?? '-'} | SHIELD ${lastMonsterAttackDebug.activeShieldDefense ?? 0} | POST ${lastMonsterAttackDebug.postMitigationAttack ?? '-'} | DMG ${lastMonsterAttackDebug.finalDamage} | HP ${lastMonsterAttackDebug.hpBefore}->${lastMonsterAttackDebug.hpAfter}`,
            `HIT ${lastMonsterAttackDebug.hitZones?.join(', ') ?? '-'} | WOUND ${lastMonsterAttackDebug.woundSlots?.join(', ') ?? '-'}`,
            ...(lastMonsterAttackDebug.defenseSlotBreakdown ?? []).map((entry) =>
                `${entry.slot}: vit ${entry.vitalityRoll} + pose ${entry.defenseModifier} + arm ${entry.slotArmor}${entry.slotItemName ? ` (${entry.slotItemName})` : ''} + shield ${entry.shieldContribution} - wound ${entry.woundPenalty} => ${entry.finalDefense}`),
            ...(lastMonsterAttackDebug.defenseSlotBreakdown ?? []).flatMap((entry) =>
                (entry.shieldDetails ?? []).map((detail) => `  ${entry.slot} shield: ${detail}`)),
        ];
    }, [lastMonsterAttackDebug]);

    return (
        <>
            <div
                style={getDebugPanelStyle({ top: 14, left: 14 })}
                data-debug-overlay="true"
            >
                {text.debugRenderState(renderDebug)}
            </div>
            <div
                style={getDebugPanelStyle({ top: 102, left: 14 })}
                data-debug-overlay="true"
            >
                {frontCreatureDebugLines.join('\n')}
            </div>
            <div
                style={getDebugPanelStyle({ top: 206, left: 14 })}
                data-debug-overlay="true"
            >
                {lastMonsterAttackDebugLines.join('\n')}
            </div>
            <div
                style={getDebugPanelStyle({ top: 382, left: 14 })}
                data-debug-overlay="true"
            >
                {forwardMoveDebugLines.join('\n')}
            </div>
        </>
    );
};

const DungeonSceneCreatureDebugOverlay: React.FC<{
    level: number;
    position: [number, number];
    direction: Direction;
}> = ({ level, position, direction }) => {
    const creatures = useStore((s) => s.creatures);
    const map = getGameMap(level);

    const lines = useMemo(() => {
        const [currentY, currentX] = position;
        const frontX = direction === 'EAST' ? currentX + 1 : direction === 'WEST' ? currentX - 1 : currentX;
        const frontY = direction === 'NORTH' ? currentY - 1 : direction === 'SOUTH' ? currentY + 1 : currentY;
        const currentGlobal = toGlobalCoords(level, currentX, currentY);
        const frontGlobal = toGlobalCoords(level, frontX, frontY);
        const frontCreatures = creaturesInFront(level, position, direction, creatures);
        const contactCreatures = frontCreatures.filter((creature) => isCreatureContactCell(creature.cell));
        const nearbyCreatures = creatures
            .filter((creature) => creature.alive && creature.mapIndex === level)
            .map((creature) => ({
                creature,
                distance: Math.abs(creature.x - currentX) + Math.abs(creature.y - currentY),
                dx: creature.x - currentX,
                dy: creature.y - currentY,
            }))
            .filter((entry) => entry.distance <= 10)
            .sort((a, b) => a.distance - b.distance || a.creature.y - b.creature.y || a.creature.x - b.creature.x)
            .slice(0, 16);

        const getPlacementHPLabel = (creature: typeof frontCreatures[number]): string => {
            const match = /^init_(\d+)_(\d+)_(\d+)_(\d+)$/.exec(creature.groupId ?? '');
            if (!match) return '';
            const [, sourceLevelRaw, sourceXRaw, sourceYRaw, sourceTypeRaw] = match;
            const sourceLevel = Number(sourceLevelRaw);
            const sourceX = Number(sourceXRaw);
            const sourceY = Number(sourceYRaw);
            const sourceType = Number(sourceTypeRaw);
            if (sourceLevel !== level || ![sourceX, sourceY, sourceType].every(Number.isFinite)) return '';

            const source = map.tiles[sourceY]?.[sourceX]?.objects.find((object) =>
                object.category === 'Creature' && object.type === sourceType);
            if (!source || source.category !== 'Creature') return '';

            const hpValues = Array.isArray(source.hp)
                ? source.hp
                : Array.from({ length: Math.max(1, source.count ?? 1) }, () =>
                    typeof source.hp === 'number' ? source.hp : 0);
            const totalHP = hpValues.reduce((sum, hp) => sum + (typeof hp === 'number' ? hp : 0), 0);
            return totalHP > 0 ? ` | sourceHP ${hpValues.join('+')}=${totalHP}` : '';
        };

        const describeCreature = (creature: typeof frontCreatures[number], index: number) => {
            const def = CREATURE_TYPES[creature.typeId];
            const label = def?.name ?? `Creature ${creature.typeId}`;
            const global = toGlobalCoords(level, creature.x, creature.y);
            return `${index + 1}. ${label} [l:${creature.x},${creature.y} / g:${global.x},${global.y}] [${creature.cell}] HP ${creature.currentHP}/${def?.baseHP ?? '?'}${getPlacementHPLabel(creature)} | id ${creature.id}${creature.groupId ? ` | group ${creature.groupId}` : ''}`;
        };

        return [
            'Creature debug',
            `party [l:${currentX},${currentY} / g:${currentGlobal.x},${currentGlobal.y}] ${direction} -> front [l:${frontX},${frontY} / g:${frontGlobal.x},${frontGlobal.y}]`,
            `front tile occupants: ${frontCreatures.length}`,
            ...(frontCreatures.length > 0
                ? frontCreatures.map(describeCreature)
                : ['none']),
            `contact occupants: ${contactCreatures.length}`,
            ...(contactCreatures.length > 0
                ? contactCreatures.map((creature, index) => describeCreature(creature, index))
                : ['none']),
            `nearby alive occupants (<=10): ${nearbyCreatures.length}`,
            ...(nearbyCreatures.length > 0
                ? nearbyCreatures.map(({ creature, distance, dx, dy }, index) =>
                    `${describeCreature(creature, index)} | dist ${distance} | delta ${dx},${dy}`)
                : ['none']),
        ];
    }, [creatures, direction, level, map, position]);

    return (
        <textarea
            readOnly
            spellCheck={false}
            value={lines.join('\n')}
            onFocus={(event) => event.currentTarget.select()}
            style={getCopyableDebugPanelStyle({ bottom: 14, left: 14 })}
            data-debug-overlay="true"
            aria-label="Creature debug"
        />
    );
};

const DungeonSceneDragOverlay: React.FC<{
    level: number;
    map: GameMap;
    position: [number, number];
    direction: Direction;
    openDoors: Set<string>;
    openWalls: Set<string>;
    isItemDragActive: boolean;
    activePartyMemberId: number | null;
}> = ({ level, map, position, direction, openDoors, openWalls, isItemDragActive, activePartyMemberId }) => {
    const activeFloorDrag = useStore(s => s.activeFloorDrag);
    const floorItems = useStore(s => s.floorItems);
    const selectedChampionIndex = useStore(s => s.selectedChampionIndex);
    const party = useStore(s => s.party);
    const applyItemOnFrontWall = useStore(s => s.useItemOnFrontWall);
    const applyFloorItemOnFrontWall = useStore(s => s.useFloorItemOnFrontWall);
    const applyItemOnViAltar = useStore(s => s.useItemOnViAltar);
    const applyFloorItemOnViAltar = useStore(s => s.useFloorItemOnViAltar);
    const drinkFromFountain = useStore(s => s.drinkFromFountain);
    const fillWaterContainer = useStore(s => s.fillWaterContainer);

    const selectedChampionId = party[selectedChampionIndex]?.id ?? party[0]?.id ?? null;
    const draggedFloorItem = useMemo(
        () => activeFloorDrag ? floorItems.find((item) => item.id === activeFloorDrag.itemId) ?? null : null,
        [activeFloorDrag, floorItems],
    );
    const hasFloorItemDrag = Boolean(activeFloorDrag && draggedFloorItem);
    const hasInventoryItemDrag = isItemDragActive && hasActiveDragPayload();
    const shouldShowWallDropTargets = hasInventoryItemDrag || hasFloorItemDrag;
    const altarDropTargets = useMemo(
        () => resolveAltarDropTargets({ level, map, position, direction, openDoors, openWalls, isSelfRevealingWallTile, doorBlocksVision }),
        [direction, level, map, openDoors, openWalls, position],
    );
    const frontWallInteractionKind = useMemo(
        () => resolveFrontWallInteractionKind({
            level,
            map,
            position,
            direction,
            openWalls,
            hasEffectiveOriginalWallOverlayAt: (targetLevel, tileX, tileY, face, overlayName) =>
                overlayName === 'Square Alcove' || overlayName === 'Arched Alcove'
                    ? hasOriginalWallOverlayAt(targetLevel, tileX, tileY, face, overlayName)
                    : hasEffectiveOriginalWallOverlayAt(targetLevel, tileX, tileY, face, overlayName),
            isSelfRevealingWallTile,
            getMechanismsAtFace: (targetLevel, tileX, tileY, face) => getMechanismsAt(targetLevel, tileX, tileY, face),
        }),
        [direction, level, map, openWalls, position],
    );

    if (!shouldRenderDungeonSceneDragOverlay(activePartyMemberId, hasInventoryItemDrag, hasFloorItemDrag)) {
        return null;
    }

    return (
        <>
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
            {altarDropTargets.length > 0 && shouldShowWallDropTargets && altarDropTargets.map((target) => (
                <WallMechanismDropTarget
                    key={`altar_drop_${target.placement}_${target.wallX}_${target.wallY}_${target.face}`}
                    kind="altar"
                    placement={target.placement}
                    wallX={target.wallX}
                    wallY={target.wallY}
                    wallFace={target.face}
                    onUseItem={(championId, itemId, fromSlot) =>
                        applyItemOnViAltar(championId, itemId, fromSlot, target.wallX, target.wallY, target.face)
                    }
                    activeFloorDragItemId={activeFloorDrag?.itemId ?? null}
                    selectedChampionId={selectedChampionId}
                    onUseFloorItem={(itemId, championId) =>
                        applyFloorItemOnViAltar(itemId, championId, target.wallX, target.wallY, target.face)
                    }
                />
            ))}
            {frontWallInteractionKind && altarDropTargets.every((target) => target.placement !== 'front') && (shouldShowWallDropTargets || frontWallInteractionKind === 'fountain') && (
                <WallMechanismDropTarget
                    kind={frontWallInteractionKind}
                    onUseItem={(championId, itemId, fromSlot) => {
                        if (frontWallInteractionKind === 'fountain') {
                            if (fromSlot !== 'inventory' && fromSlot !== 'leftHand' && fromSlot !== 'rightHand') return false;
                            const state = useStore.getState();
                            const inventoryItem = fromSlot === 'inventory'
                                ? state.championInventories[championId]?.find((item) => item.id === itemId)
                                : state.championEquipment[championId]?.[fromSlot];
                            if (!inventoryItem || !canFillWaterContainer(inventoryItem)) return false;
                            fillWaterContainer(championId, itemId);
                            return true;
                        }
                        return applyItemOnFrontWall(championId, itemId, fromSlot);
                    }}
                    onActivate={frontWallInteractionKind === 'fountain'
                        ? (championId) => drinkFromFountain(championId)
                        : undefined}
                    activeFloorDragItemId={activeFloorDrag?.itemId ?? null}
                    selectedChampionId={selectedChampionId}
                    onUseFloorItem={frontWallInteractionKind === 'fountain' ? undefined : applyFloorItemOnFrontWall}
                />
            )}
        </>
    );
};


// Static tile grid (re-renders only when level or doors change)
const TileGrid: React.FC<{
    map: GameMap;
    level: number;
    partyPosition: [number, number];
    partyDirection: Direction;
    openDoors: Set<string>;
    brokenDoors: Set<string>;
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    openWalls: Set<string>;
    recruitedIds: Set<number>;
    wallButtons: { tileX: number; tileY: number; face: CardinalDir; sensorIndex: number }[];
    wallDecals: OriginalWallOverlayRender[];
    pressurePlates: { tileX: number; tileY: number; face?: CardinalDir }[];
    showWallButtons: boolean;
    showWallDecals: boolean;
    onCellClick: (e: ThreeEvent<MouseEvent>, renderType: CellRenderType, x: number, y: number) => void;
    onWallSensor: (level: number, x: number, y: number, sensorIndex: number) => void;
}> = memo(({ map, level, partyPosition, partyDirection, openDoors, brokenDoors, crushingDoors, openWalls, recruitedIds, wallButtons, wallDecals, pressurePlates, showWallButtons, showWallDecals, onCellClick, onWallSensor }) => {
    const frontTileY = partyDirection === 'NORTH' ? partyPosition[0] - 1 : partyDirection === 'SOUTH' ? partyPosition[0] + 1 : partyPosition[0];
    const frontTileX = partyDirection === 'EAST' ? partyPosition[1] + 1 : partyDirection === 'WEST' ? partyPosition[1] - 1 : partyPosition[1];
    return (
        <group>
            {/* One draw call each for floor, ceiling, and walls */}
            <InstancedTiles key={level} map={map} openWalls={openWalls} />
            {/* Pressure plates - floor-level objects */}
            {pressurePlates.map(({ tileX, tileY, face }) => (
                <group key={`plate_${tileX}_${tileY}`} position={[tileX * GRID_SIZE, 0, tileY * GRID_SIZE]}>
                    <PressurePlate tileX={tileX} tileY={tileY} level={level} face={face} />
                </group>
            ))}
            {/* Only Door and Mirror tiles need a Cell - everything else is instanced */}
            {map.tiles.map((row, y) =>
                row.map((tile, x) => {
                    const renderType = getRenderType(tile, level);
                    const isRenderedStair = tile.type === 'Stairs' && (renderType === 'StairsDown' || renderType === 'StairsUp');
                    if (renderType !== 'Door' && renderType !== 'Mirror' && !isRenderedStair) return null;

                    const mirrorChampion: Champion | null =
                        renderType === 'Mirror' ? (MIRROR_WALL_MAP.get(`${level},${x},${y}`) ?? null) : null;
                    const champion = mirrorChampion && !recruitedIds.has(mirrorChampion.id)
                        ? mirrorChampion : null;
                    const wallFace =
                        renderType === 'Mirror'
                            ? MIRROR_FACE_MAP.get(`${level},${x},${y}`)
                            : isRenderedStair
                                ? resolveStairsEntryFace(map, x, y)
                                : undefined;
                    const doorOpen = renderType === 'Door' ? openDoors.has(`${level},${y},${x}`) : undefined;
                    const doorBroken = renderType === 'Door' ? brokenDoors.has(`${level},${y},${x}`) : undefined;
                    const doorCrushPhase = renderType === 'Door' ? crushingDoors[`${level},${y},${x}`]?.phase : undefined;
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
                            (isFrontDoor || isSceneDoorTileVisible(map, level, openDoors, openWalls, partyPosition[1], partyPosition[0], x, y)))
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
                            doorBroken={doorBroken}
                            doorCrushPhase={doorCrushPhase}
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

            {showWallButtons && wallButtons.map(({ tileX, tileY, face, sensorIndex }) => (
                <WallSensor
                    key={`wsensor_${tileX}_${tileY}_${sensorIndex}`}
                    tileX={tileX} tileY={tileY} face={face}
                    onClick={() => onWallSensor(level, tileX, tileY, sensorIndex)}
                />
            ))}
            {showWallDecals && wallDecals.map(({ tileX, tileY, face, image, label, accent, width, height, interactiveSensorIndices }, i) => (
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

// Scene
export const DungeonScene = () => {
    const canvasHostRef = useRef<HTMLDivElement>(null);
    const [isItemDragActive, setIsItemDragActive] = useState(false);
    const [nativeDungeonDragPointer, setNativeDungeonDragPointer] = useState<{ x: number; y: number } | null>(null);
    const [renderDebug, setRenderDebug] = useState<RenderDebugState>(() => DEFAULT_RENDER_DEBUG_STATE);
    const text = useI18n().dungeonScene;
    // Only subscribe to stable/slow-changing state here
    const level          = useStore(s => s.level);
    const position       = useStore(s => s.position);
    const direction      = useStore(s => s.direction);
    const openDoors      = useStore(s => s.openDoors);
    const brokenDoors    = useStore(s => s.brokenDoors);
    const crushingDoors  = useStore(s => s.crushingDoors);
    const openWalls      = useStore(s => s.openWalls);
    const openPits       = useStore(s => s.openPits);
    const openTeleporters = useStore(s => s.openTeleporters);
    const openMirror     = useStore(s => s.openMirror);
    const toggleDoor     = useStore(s => s.toggleDoor);
    const activateWallSensor = useStore(s => s.activateWallSensor);
    const dropCarriedItemInFront = useStore(s => s.dropCarriedItemInFront);
    const activeFloorDrag = useStore(s => s.activeFloorDrag);
    const activeSensors  = useStore(s => s.activeSensors);
    const firedSensors   = useStore(s => s.firedSensors);
    const party          = useStore(s => s.party);
    const activePartyMemberId = useStore(s => s.activePartyMemberId);

    const map = getGameMap(level);
    const recruitedIds = useMemo(() => new Set(party.map(c => c.id)), [party]);

    useEffect(() => {
        void loadPhotonEffects();
    }, []);

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

    useEffect(() => {
        if (!RENDER_DEBUG_ENABLED) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!(event.altKey && event.shiftKey)) return;
            const key = event.key.toLowerCase();

            if (key === 't') {
                event.preventDefault();
                setRenderDebug((current) => ({ ...current, wallTexts: !current.wallTexts }));
                return;
            }
            if (key === 'd') {
                event.preventDefault();
                setRenderDebug((current) => ({ ...current, wallDecals: !current.wallDecals }));
                return;
            }
            if (key === 'b') {
                event.preventDefault();
                setRenderDebug((current) => ({ ...current, wallButtons: !current.wallButtons }));
                return;
            }
            if (key === 'r') {
                event.preventDefault();
                setRenderDebug(DEFAULT_RENDER_DEBUG_STATE);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const originalWallOverlays = useMemo(
        () => getOriginalWallOverlaysForMap(map, activeSensors, firedSensors),
        [activeSensors, firedSensors, map],
    );

    const wallButtons = useMemo(
        () => buildDungeonSceneWallButtons({
            level,
            map,
            openDoors,
            openWalls,
            partyPosition: position,
            originalWallOverlays,
            isSelfRevealingWallTile,
            doorBlocksVision,
        }),
        [level, map, openDoors, openWalls, originalWallOverlays, position],
    );

    const wallDecals = useMemo(
        () => buildDungeonSceneWallDecals({
            level,
            map,
            openDoors,
            openWalls,
            partyPosition: position,
            originalWallOverlays,
            isSelfRevealingWallTile,
            doorBlocksVision,
        }),
        [level, map, openDoors, openWalls, originalWallOverlays, position],
    );

    const pressurePlates = useMemo(
        () => collectDungeonScenePressurePlates({ level, map, mechanisms: getMapMechanisms(level) }),
        [level, map],
    );

    const trickWalls = useMemo(
        () => collectDungeonSceneTrickWalls({ level, map, openWalls }),
        [level, map, openWalls],
    );

    const pits = useMemo(
        () => collectDungeonScenePits({ map }),
        [map],
    );

    const teleporters = useMemo(
        () => collectDungeonSceneTeleporters({ level, map, openTeleporters }),
        [level, map, openTeleporters],
    );

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

    const handleRootDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        const payload = getDragPayload(event);
        if (!payload) return;
        event.preventDefault();
        event.stopPropagation();
        setIsItemDragActive(false);
        setNativeDungeonDragPointer(null);

        const state = useStore.getState();
        const wallDropTarget = resolveDungeonWallDropTarget(event.target as Element | null);
        const destination = resolveDungeonDragDropDestination(event.clientY, window.innerHeight);
        const shouldUseWallTarget = destination !== 'throw';

        if (shouldUseWallTarget && wallDropTarget?.kind === 'altar' && payload.fromSlot !== 'container') {
            if (state.useItemOnViAltar(
                payload.fromChampionId,
                payload.itemId,
                payload.fromSlot,
                wallDropTarget.wallX,
                wallDropTarget.wallY,
                wallDropTarget.wallFace,
            )) {
                return;
            }
        }

        if (shouldUseWallTarget && wallDropTarget?.kind === 'front-wall' && payload.fromSlot !== 'container') {
            if (state.useItemOnFrontWall(
                payload.fromChampionId,
                payload.itemId,
                payload.fromSlot,
            )) {
                return;
            }
        }

        if (payload.fromSlot === 'container') return;
        const carriedFromSlot = payload.fromSlot;
        performDungeonDragDropAction(destination, {
            throwItem: () => state.throwCarriedItem(payload.fromChampionId, payload.itemId, carriedFromSlot),
            dropFront: () => dropCarriedItemInFront(payload.fromChampionId, payload.itemId, carriedFromSlot),
            dropCurrent: () => state.dropCarriedItem(payload.fromChampionId, payload.itemId, carriedFromSlot),
        });
    }, [dropCarriedItemInFront]);

    const dungeonDragPreview = useMemo(() => {
        const pointer = activeFloorDrag
            ? { x: activeFloorDrag.pointerX, y: activeFloorDrag.pointerY }
            : nativeDungeonDragPointer;
        if (!pointer) return null;
        if (!isPointerInsideDungeonViewport(pointer.x, window.innerWidth)) return null;
        const hovered = document.elementFromPoint(pointer.x, pointer.y) as HTMLElement | null;
        if (hovered?.closest('[data-dm-wall-drop="true"]')) return null;
        const destination = resolveDungeonDragDropDestination(pointer.y, window.innerHeight);
        return { pointer, destination };
    }, [activeFloorDrag, nativeDungeonDragPointer]);

    useEffect(() => {
        if (!isItemDragActive && !activeFloorDrag) {
            setNativeDungeonDragPointer(null);
        }
    }, [activeFloorDrag, isItemDragActive]);

    return (
        <div
            ref={canvasHostRef}
            onDragOver={(event) => {
                if (!isItemDragActive || !hasActiveDragPayload()) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setNativeDungeonDragPointer({ x: event.clientX, y: event.clientY });
            }}
            onDragLeave={() => {
                if (!activeFloorDrag) {
                    setNativeDungeonDragPointer(null);
                }
            }}
            onDrop={(event) => {
                handleRootDrop(event);
            }}
            style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}
            data-tutorial-zone="dungeon-canvas-host"
        >
            {dungeonDragPreview && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '67%',
                        pointerEvents: 'none',
                        zIndex: 145,
                    }}
                >
                    {DUNGEON_DRAG_DROP_BANDS.map((band) => {
                        const active = band.destination === dungeonDragPreview.destination;
                        const top = `${band.startRatio * 100}%`;
                        const height = `${(band.endRatio - band.startRatio) * 100}%`;
                        return (
                            <div
                                key={band.destination}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    top,
                                    height,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: band.destination === 'throw'
                                        ? 'center'
                                        : band.destination === 'front'
                                            ? 'center'
                                            : 'center',
                                    background: active
                                        ? band.destination === 'throw'
                                            ? 'linear-gradient(180deg, rgba(114,34,18,0.18), rgba(168,74,28,0.28))'
                                            : band.destination === 'front'
                                                ? 'linear-gradient(180deg, rgba(132,104,32,0.12), rgba(192,160,72,0.22))'
                                                : 'linear-gradient(180deg, rgba(116,112,54,0.08), rgba(208,198,118,0.24))'
                                        : 'transparent',
                                    borderTop: band.startRatio === 0 ? 'none' : '1px solid rgba(232, 210, 146, 0.08)',
                                    borderBottom: band.endRatio === 1 ? 'none' : '1px solid rgba(232, 210, 146, 0.08)',
                                    transition: 'background 0.08s ease-out, border-color 0.08s ease-out',
                                }}
                            >
                                <div
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: 999,
                                        border: active
                                            ? '1px solid rgba(250, 230, 180, 0.52)'
                                            : '1px solid rgba(250, 230, 180, 0.18)',
                                        background: active
                                            ? 'rgba(10, 8, 6, 0.68)'
                                            : 'rgba(10, 8, 6, 0.34)',
                                        color: active ? '#f3de9b' : 'rgba(243, 222, 155, 0.52)',
                                        fontFamily: '"Courier New", monospace',
                                        fontSize: 12,
                                        letterSpacing: 1.4,
                                        textTransform: 'uppercase',
                                        boxShadow: active ? '0 0 18px rgba(240, 208, 96, 0.14)' : 'none',
                                    }}
                                >
                                    {text.dropBands[band.destination]}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <LevelNameOverlay level={level} />
            {CREATURE_DEBUG_OVERLAY_ENABLED && (
                <DungeonSceneCreatureDebugOverlay
                    level={level}
                    position={position}
                    direction={direction}
                />
            )}
            {RENDER_DEBUG_ENABLED && (
                <DungeonSceneDebugOverlay
                    renderDebug={renderDebug}
                    level={level}
                    position={position}
                    direction={direction}
                    map={map}
                    openDoors={openDoors}
                    openPits={openPits}
                    openTeleporters={openTeleporters}
                    openWalls={openWalls}
                />
            )}
            <DarknessOverlay />

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
                {(!RENDER_DEBUG_ENABLED || renderDebug.wallTexts) && <SceneWallTextPlanes map={map} />}
                <TileGrid
                    map={map}
                    level={level}
                    partyPosition={position}
                    openDoors={openDoors}
                    brokenDoors={brokenDoors}
                    crushingDoors={crushingDoors}
                    openWalls={openWalls}
                    recruitedIds={recruitedIds}
                    wallButtons={wallButtons}
                    wallDecals={wallDecals}
                    pressurePlates={pressurePlates}
                    showWallButtons={!RENDER_DEBUG_ENABLED || renderDebug.wallButtons}
                    showWallDecals={!RENDER_DEBUG_ENABLED || renderDebug.wallDecals}
                    onCellClick={handleCellClick}
                    onWallSensor={activateWallSensor}
                    partyDirection={direction}
                />

                <group key={`level-visuals-${level}`}>
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
                    <TeleporterLayer teleporters={teleporters} />
                    <DamageLayer />
                    <SpellImpactLayer />
                    <FloorItemsLayer />
                    <ProjectileRenderer />
                </group>
            </Canvas>
            <ViAltarMiracleOverlay />
            <DungeonSceneDragOverlay
                level={level}
                map={map}
                position={position}
                direction={direction}
                openDoors={openDoors}
                openWalls={openWalls}
                isItemDragActive={isItemDragActive}
                activePartyMemberId={activePartyMemberId}
            />
        </div>
    );
};
