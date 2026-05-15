import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, getCreatureFluxcageExpiry } from '../../engine/store';
import { GRID_SIZE } from '../../engine/constants';
import { PHYSICAL_PROJECTILE_STEP_MS } from '../../engine/time';
import type { Direction, ProjectileEffect } from '../../engine/runtimeTypes';
import { getFloorItemImage } from '../../data/itemImages';
import { BillboardGroup } from './renderHelpers';
import { useSafeTexture } from './useLoadedTexture';
import type { FloorItem } from '../../types/game';
import {
    resolvePhysicalProjectileLaunchPosition,
    resolvePhysicalProjectilePosition,
} from './physicalProjectilePresentation';

type MagicProjectileEffect = Exclude<ProjectileEffect, 'physical'>;
type ActivePhysicalProjectile = ReturnType<typeof useStore.getState>['projectiles'][number] & {
    effect: 'physical';
    physicalItem: FloorItem;
};
type PhysicalLaunchPreview = {
    id: string;
    level: number;
    x: number;
    y: number;
    direction: Direction;
    physicalItem: FloorItem;
    startedAt: number;
    expiresAt: number;
};

const loadPhotonEffects = () => import('./PhotonsFireball');

const LazyPhotonsFireball = lazy(() =>
    loadPhotonEffects().then((module) => ({ default: module.PhotonsFireball })),
);

const LazyPhotonsLightningProjectile = lazy(() =>
    loadPhotonEffects().then((module) => ({ default: module.PhotonsLightningProjectile })),
);

const LazyPhotonsOpenDoorProjectile = lazy(() =>
    loadPhotonEffects().then((module) => ({ default: module.PhotonsOpenDoorProjectile })),
);

const LazyPhotonsTeleporterCloud = lazy(() =>
    loadPhotonEffects().then((module) => ({ default: module.PhotonsTeleporterCloud })),
);

const LazyPhotonsPoisonProjectile = lazy(() =>
    loadPhotonEffects().then((module) => ({ default: module.PhotonsPoisonProjectile })),
);

const LazyPhotonsDisruptProjectile = lazy(() =>
    loadPhotonEffects().then((module) => ({ default: module.PhotonsDisruptProjectile })),
);

function createPulseMaterial(color: string, opacity: number) {
    return new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
    });
}

const FLUXCAGE_RENDER_ORDER = 18;

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

export const ProjectileRenderer: React.FC = () => {
    const projectiles = useStore((state) => state.projectiles);
    const level = useStore((state) => state.level);
    const nowMs = useWallClock(80);
    const activeProjectiles = useMemo(
        () => projectiles.filter((projectile) => projectile.level === level),
        [projectiles, level],
    );
    const activePhysicalProjectiles = useMemo(
        () => activeProjectiles.filter((projectile): projectile is ActivePhysicalProjectile =>
            projectile.effect === 'physical' && Boolean(projectile.physicalItem),
        ),
        [activeProjectiles],
    );
    const [launchPreviews, setLaunchPreviews] = useState<PhysicalLaunchPreview[]>([]);
    const previousPhysicalProjectileIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const seenAt = Date.now();
        const physicalProjectiles = projectiles.filter((projectile): projectile is ActivePhysicalProjectile =>
            projectile.effect === 'physical' && Boolean(projectile.physicalItem),
        );
        const activeIds = new Set(physicalProjectiles.map((projectile) => projectile.id));
        const addedPreviews = physicalProjectiles
            .filter((projectile) => !previousPhysicalProjectileIdsRef.current.has(projectile.id))
            .map((projectile) => ({
                id: projectile.id,
                level: projectile.level,
                x: projectile.x,
                y: projectile.y,
                direction: projectile.direction,
                physicalItem: projectile.physicalItem,
                startedAt: projectile.nextMoveAt <= seenAt
                    ? seenAt
                    : projectile.nextMoveAt - PHYSICAL_PROJECTILE_STEP_MS,
                expiresAt: projectile.nextMoveAt <= seenAt
                    ? seenAt + PHYSICAL_PROJECTILE_STEP_MS
                    : projectile.nextMoveAt,
            }));

        previousPhysicalProjectileIdsRef.current = activeIds;

        setLaunchPreviews((current) => {
            const retained = current.filter((preview) => preview.expiresAt > nowMs);
            if (addedPreviews.length === 0) return retained;
            const merged = new Map(retained.map((preview) => [preview.id, preview]));
            for (const preview of addedPreviews) {
                merged.set(preview.id, preview);
            }
            return [...merged.values()];
        });
    }, [nowMs, projectiles]);

    const activePhysicalProjectileIds = useMemo(
        () => new Set(activePhysicalProjectiles.map((projectile) => projectile.id)),
        [activePhysicalProjectiles],
    );
    const visibleLaunchPreviews = useMemo(
        () => launchPreviews.filter((preview) =>
            preview.level === level &&
            preview.expiresAt > nowMs &&
            !activePhysicalProjectileIds.has(preview.id),
        ),
        [activePhysicalProjectileIds, launchPreviews, level, nowMs],
    );

    return (
        <>
            {visibleLaunchPreviews.map((preview) => (
                <PhysicalProjectileSprite
                    key={`launch_${preview.id}`}
                    projectile={{
                        x: preview.x,
                        y: preview.y,
                        physicalItem: preview.physicalItem,
                        direction: preview.direction,
                        startedAt: preview.startedAt,
                    }}
                    mode="launch"
                />
            ))}
            {activeProjectiles.map((projectile) => (
                projectile.effect === 'physical' && projectile.physicalItem ? (
                    <PhysicalProjectileSprite
                        key={projectile.id}
                        projectile={{
                            ...projectile,
                            physicalItem: projectile.physicalItem,
                            direction: projectile.direction,
                            nextMoveAt: projectile.nextMoveAt,
                        }}
                    />
                ) : (
                    <ProjectileOrb
                        key={projectile.id}
                        projectile={projectile as typeof projectile & { effect: MagicProjectileEffect }}
                    />
                )
            ))}
        </>
    );
};

export const TeleporterLayer: React.FC<{
    teleporters: Array<{ tileX: number; tileY: number }>;
}> = ({ teleporters }) => {
    const outerRingGeometry = useMemo(() => new THREE.TorusGeometry(GRID_SIZE * 0.34, 0.042, 18, 56), []);
    const innerRingGeometry = useMemo(() => new THREE.TorusGeometry(GRID_SIZE * 0.22, 0.024, 14, 42), []);
    const discGeometry = useMemo(() => new THREE.CircleGeometry(GRID_SIZE * 0.42, 40), []);
    const columnGeometry = useMemo(() => new THREE.CylinderGeometry(0.026, 0.05, GRID_SIZE * 0.72, 10, 1, true), []);
    const outerRingMaterial = useMemo(() => createPulseMaterial('#6fe8ff', 0.34), []);
    const innerRingMaterial = useMemo(() => createPulseMaterial('#d1fbff', 0.42), []);
    const discMaterial = useMemo(() => createPulseMaterial('#58d9ff', 0.16), []);
    const columnMaterial = useMemo(() => createPulseMaterial('#8feaff', 0.18), []);

    useEffect(() => () => {
        outerRingGeometry.dispose();
        innerRingGeometry.dispose();
        discGeometry.dispose();
        columnGeometry.dispose();
        outerRingMaterial.dispose();
        innerRingMaterial.dispose();
        discMaterial.dispose();
        columnMaterial.dispose();
    }, [outerRingGeometry, innerRingGeometry, discGeometry, columnGeometry, outerRingMaterial, innerRingMaterial, discMaterial, columnMaterial]);

    return (
        <>
            {teleporters.map(({ tileX, tileY }) => (
                <TeleporterVisual
                    key={`teleporter_${tileX}_${tileY}`}
                    tileX={tileX}
                    tileY={tileY}
                    outerRingGeometry={outerRingGeometry}
                    innerRingGeometry={innerRingGeometry}
                    discGeometry={discGeometry}
                    columnGeometry={columnGeometry}
                    outerRingMaterial={outerRingMaterial}
                    innerRingMaterial={innerRingMaterial}
                    discMaterial={discMaterial}
                    columnMaterial={columnMaterial}
                />
            ))}
        </>
    );
};

const TeleporterVisual: React.FC<{
    tileX: number;
    tileY: number;
    outerRingGeometry: THREE.TorusGeometry;
    innerRingGeometry: THREE.TorusGeometry;
    discGeometry: THREE.CircleGeometry;
    columnGeometry: THREE.CylinderGeometry;
    outerRingMaterial: THREE.MeshBasicMaterial;
    innerRingMaterial: THREE.MeshBasicMaterial;
    discMaterial: THREE.MeshBasicMaterial;
    columnMaterial: THREE.MeshBasicMaterial;
}> = ({
    tileX,
    tileY,
    outerRingGeometry,
    innerRingGeometry,
    discGeometry,
    columnGeometry,
    outerRingMaterial,
    innerRingMaterial,
    discMaterial,
    columnMaterial,
}) => {
    const outerRingRef = useRef<THREE.Mesh>(null);
    const innerRingRef = useRef<THREE.Mesh>(null);
    const discRef = useRef<THREE.Mesh>(null);
    const columnRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const phaseRef = useRef((tileX * 0.73) + (tileY * 0.41));

    useFrame((_, delta) => {
        phaseRef.current += delta * 2.4;
        const phase = phaseRef.current;
        const widePulse = 1 + Math.sin(phase) * 0.08;
        const tightPulse = 1 + Math.cos(phase * 1.7) * 0.12;

        if (outerRingRef.current) {
            outerRingRef.current.rotation.x = -Math.PI / 2;
            outerRingRef.current.rotation.z += delta * 0.55;
            outerRingRef.current.scale.setScalar(widePulse);
        }
        if (innerRingRef.current) {
            innerRingRef.current.rotation.x = -Math.PI / 2;
            innerRingRef.current.rotation.z -= delta * 0.85;
            innerRingRef.current.scale.setScalar(tightPulse);
        }
        if (discRef.current) {
            discRef.current.scale.set(widePulse * 1.04, widePulse * 1.04, 1);
        }
        if (columnRef.current) {
            columnRef.current.scale.set(1, 0.88 + Math.sin(phase * 1.3) * 0.12, 1);
            columnRef.current.position.y = GRID_SIZE * 0.34 + Math.sin(phase * 1.1) * 0.04;
        }
        if (lightRef.current) {
            lightRef.current.intensity = 0.7 + ((Math.sin(phase * 1.5) + 1) * 0.22);
        }
    });

    return (
        <group position={[tileX * GRID_SIZE, GRID_SIZE * 0.02, tileY * GRID_SIZE]}>
            <mesh
                ref={discRef}
                geometry={discGeometry}
                material={discMaterial}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.006, 0]}
            />
            <mesh
                ref={outerRingRef}
                geometry={outerRingGeometry}
                material={outerRingMaterial}
                position={[0, 0.02, 0]}
            />
            <mesh
                ref={innerRingRef}
                geometry={innerRingGeometry}
                material={innerRingMaterial}
                position={[0, GRID_SIZE * 0.04, 0]}
            />
            <mesh
                ref={columnRef}
                geometry={columnGeometry}
                material={columnMaterial}
                position={[0, GRID_SIZE * 0.34, 0]}
            />
            <Suspense fallback={null}>
                <LazyPhotonsTeleporterCloud scale={1.18} />
            </Suspense>
            <pointLight
                ref={lightRef}
                color="#74e8ff"
                intensity={0.88}
                distance={GRID_SIZE * 2.3}
                decay={2}
                position={[0, GRID_SIZE * 0.42, 0]}
            />
        </group>
    );
};

const ProjectileOrb: React.FC<{
    projectile: {
        x: number;
        y: number;
        effect: MagicProjectileEffect;
        direction?: Direction;
        visualScale?: number;
        visualVariant?: 'invoke';
    };
}> = ({ projectile }) => {
    const directionRotation: Record<Direction, number> = {
        NORTH: 0,
        SOUTH: Math.PI,
        EAST: -Math.PI / 2,
        WEST: Math.PI / 2,
    };
    const visualScale = projectile.visualScale ?? 1;

    return (
        <group position={[projectile.x * GRID_SIZE, 0, projectile.y * GRID_SIZE]}>
            {projectile.visualVariant === 'invoke' ? (
                <InvokeProjectileVisual
                    scale={visualScale}
                    directionRotation={directionRotation[projectile.direction ?? 'NORTH']}
                />
            ) : projectile.effect === 'fireball' ? (
                <Suspense fallback={null}>
                    <LazyPhotonsFireball scale={visualScale} />
                </Suspense>
            ) : projectile.effect === 'lightning' ? (
                <Suspense fallback={null}>
                    <LazyPhotonsLightningProjectile
                        scale={visualScale}
                        directionRotation={directionRotation[projectile.direction ?? 'NORTH']}
                    />
                </Suspense>
            ) : projectile.effect === 'open' ? (
                <Suspense fallback={null}>
                    <LazyPhotonsOpenDoorProjectile scale={visualScale} />
                </Suspense>
            ) : projectile.effect === 'poison_cloud' || projectile.effect === 'poison_bolt' || projectile.effect === 'slime' ? (
                <Suspense fallback={null}>
                    <LazyPhotonsPoisonProjectile effect={projectile.effect} scale={visualScale} />
                </Suspense>
            ) : (
                <Suspense fallback={null}>
                    <LazyPhotonsDisruptProjectile scale={visualScale} />
                </Suspense>
            )}
        </group>
    );
};

const InvokeProjectileVisual: React.FC<{
    scale: number;
    directionRotation: number;
}> = ({ scale, directionRotation }) => {
    const groupRef = useRef<THREE.Group>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const ringARef = useRef<THREE.Mesh>(null);
    const ringBRef = useRef<THREE.Mesh>(null);
    const trailRef = useRef<THREE.Mesh>(null);
    const phaseRef = useRef(0);
    const coreGeometry = useMemo(() => new THREE.OctahedronGeometry(GRID_SIZE * 0.085, 0), []);
    const ringGeometry = useMemo(() => new THREE.TorusGeometry(GRID_SIZE * 0.13, GRID_SIZE * 0.012, 10, 28), []);
    const trailGeometry = useMemo(() => new THREE.CylinderGeometry(GRID_SIZE * 0.02, GRID_SIZE * 0.055, GRID_SIZE * 0.34, 10, 1, true), []);
    const coreMaterial = useMemo(() => createPulseMaterial('#ff5f3a', 0.8), []);
    const haloMaterial = useMemo(() => createPulseMaterial('#ffd35a', 0.42), []);
    const trailMaterial = useMemo(() => createPulseMaterial('#ffb347', 0.28), []);

    useEffect(() => () => {
        coreGeometry.dispose();
        ringGeometry.dispose();
        trailGeometry.dispose();
        coreMaterial.dispose();
        haloMaterial.dispose();
        trailMaterial.dispose();
    }, [coreGeometry, ringGeometry, trailGeometry, coreMaterial, haloMaterial, trailMaterial]);

    useFrame((_, delta) => {
        phaseRef.current += delta * 5.2;
        const phase = phaseRef.current;
        if (groupRef.current) {
            groupRef.current.rotation.y = directionRotation;
            groupRef.current.position.y = GRID_SIZE * 0.08 + Math.sin(phase * 1.25) * GRID_SIZE * 0.015;
        }
        if (coreRef.current) {
            coreRef.current.rotation.y += delta * 4.5;
            coreRef.current.rotation.x += delta * 2.8;
            const corePulse = 1 + Math.sin(phase * 2.1) * 0.09;
            coreRef.current.scale.set(0.86 * corePulse, 1.28 * corePulse, 0.86 * corePulse);
        }
        if (ringARef.current) {
            ringARef.current.rotation.x = Math.PI / 2 + Math.sin(phase * 1.4) * 0.24;
            ringARef.current.rotation.z += delta * 3.2;
        }
        if (ringBRef.current) {
            ringBRef.current.rotation.z = Math.PI / 2 + Math.cos(phase * 1.5) * 0.2;
            ringBRef.current.rotation.x -= delta * 2.6;
        }
        if (trailRef.current) {
            trailRef.current.scale.set(
                1,
                0.92 + Math.sin(phase * 1.8) * 0.08,
                1.02 + Math.cos(phase * 1.2) * 0.1,
            );
        }
    });

    return (
        <group ref={groupRef} scale={scale}>
            <mesh
                ref={trailRef}
                geometry={trailGeometry}
                material={trailMaterial}
                position={[0, 0, -GRID_SIZE * 0.14]}
                rotation={[Math.PI / 2, 0, 0]}
            />
            <mesh ref={ringARef} geometry={ringGeometry} material={haloMaterial} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <mesh ref={ringBRef} geometry={ringGeometry} material={haloMaterial} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={0.82} />
            <mesh ref={coreRef} geometry={coreGeometry} material={coreMaterial} position={[0, 0, 0]} />
            <pointLight
                color="#ffb347"
                intensity={1.05}
                distance={GRID_SIZE * 1.75}
                decay={2}
                position={[0, 0, 0]}
            />
        </group>
    );
};

const PhysicalProjectileSprite: React.FC<{
    projectile: {
        x: number;
        y: number;
        physicalItem: FloorItem;
        direction?: Direction;
        nextMoveAt?: number;
        startedAt?: number;
    };
    mode?: 'active' | 'launch';
}> = ({ projectile, mode = 'active' }) => {
    const imagePath = getFloorItemImage(projectile.physicalItem);
    const tex = useSafeTexture(imagePath);
    const groupRef = useRef<THREE.Group>(null);

    const image = tex?.image as { width: number; height: number } | undefined;
    const aspect = image ? image.width / image.height : 1;
    const width = GRID_SIZE * 0.4;
    const height = width / aspect;

    const resolvePosition = (now: number): [number, number, number] => {
        if (mode === 'launch') {
            return resolvePhysicalProjectileLaunchPosition({
                x: projectile.x,
                y: projectile.y,
                direction: projectile.direction ?? 'NORTH',
                now,
                startedAt: projectile.startedAt ?? now,
            });
        }

        return resolvePhysicalProjectilePosition({
            x: projectile.x,
            y: projectile.y,
            direction: projectile.direction ?? 'NORTH',
            now,
            nextMoveAt: projectile.nextMoveAt ?? now,
        });
    };

    useFrame(() => {
        const nextPosition = resolvePosition(Date.now());
        if (groupRef.current) {
            groupRef.current.position.set(nextPosition[0], nextPosition[1], nextPosition[2]);
        }
    });

    return (
        <BillboardGroup
            groupRef={groupRef}
            position={resolvePosition(Date.now())}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
        >
            <mesh>
                <planeGeometry args={[width, height]} />
                {tex ? (
                    <meshBasicMaterial
                        map={tex}
                        transparent
                        alphaTest={0.05}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                ) : (
                    <meshBasicMaterial
                        color={resolvePhysicalProjectileFallbackColor(projectile.physicalItem)}
                        transparent
                        opacity={0.92}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                )}
            </mesh>
        </BillboardGroup>
    );
};

function resolvePhysicalProjectileFallbackColor(item: FloorItem): string {
    switch (item.category) {
        case 'Weapon':
            return '#b0b8c8';
        case 'Armor':
            return '#8b6914';
        case 'Potion':
            return '#e74c3c';
        case 'Scroll':
            return '#f0e8c8';
        case 'Container':
            return '#5c3a1e';
        default:
            return '#d4af37';
    }
}

export const ShieldAuraLayer: React.FC = () => {
    const activeShields = useStore((state) => state.activeShields);
    const position = useStore((state) => state.position);
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

export const FluxcageLayer: React.FC = () => {
    const creatures = useStore((state) => state.creatures);
    const activeFluxcages = useStore((state) => state.activeFluxcages);
    const level = useStore((state) => state.level);
    const gamePhase = useStore((state) => state.gamePhase);
    const endgameSequence = useStore((state) => state.endgameSequence);
    const nowMs = useWallClock();
    const hideFluxcages = gamePhase === 'endgame' && Boolean(endgameSequence?.hideFluxcages);
    const activeFluxcageAnchors = useMemo(
        () => hideFluxcages
            ? [] as Array<{ id: string; x: number; y: number }>
            : [
                ...creatures
                    .filter((creature) => creature.alive && creature.mapIndex === level && getCreatureFluxcageExpiry(creature.id) > nowMs)
                    .map((creature) => ({
                        id: `creature_${creature.id}`,
                        x: creature.x,
                        y: creature.y,
                    })),
                ...activeFluxcages
                    .filter((fluxcage) => fluxcage.level === level && fluxcage.expiresAt > nowMs)
                    .map((fluxcage) => ({
                        id: `tile_${fluxcage.id}`,
                        x: fluxcage.x,
                        y: fluxcage.y,
                    })),
            ],
        [activeFluxcages, creatures, level, nowMs, hideFluxcages],
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
            {activeFluxcageAnchors.map((anchor) => (
                <FluxcageVisual
                    key={anchor.id}
                    x={anchor.x}
                    y={anchor.y}
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
    x: number;
    y: number;
    ringGeometry: THREE.TorusGeometry;
    barGeometry: THREE.CylinderGeometry;
    ringMaterial: THREE.MeshBasicMaterial;
    barMaterial: THREE.MeshBasicMaterial;
}> = ({ x, y, ringGeometry, barGeometry, ringMaterial, barMaterial }) => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((_, delta) => {
        if (!groupRef.current) return;
        groupRef.current.rotation.y += delta * 1.35;
        const pulse = 1 + Math.sin(Date.now() / 140) * 0.04;
        groupRef.current.scale.setScalar(pulse);
    });

    return (
        <group ref={groupRef} position={[x * GRID_SIZE, 0, y * GRID_SIZE]}>
            <mesh geometry={ringGeometry} material={ringMaterial} renderOrder={FLUXCAGE_RENDER_ORDER} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} />
            <mesh geometry={ringGeometry} material={ringMaterial} renderOrder={FLUXCAGE_RENDER_ORDER} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} scale={0.82} />
            <mesh geometry={barGeometry} material={barMaterial} renderOrder={FLUXCAGE_RENDER_ORDER} position={[0.22, 0, 0.22]} />
            <mesh geometry={barGeometry} material={barMaterial} renderOrder={FLUXCAGE_RENDER_ORDER} position={[-0.22, 0, 0.22]} />
            <mesh geometry={barGeometry} material={barMaterial} renderOrder={FLUXCAGE_RENDER_ORDER} position={[0.22, 0, -0.22]} />
            <mesh geometry={barGeometry} material={barMaterial} renderOrder={FLUXCAGE_RENDER_ORDER} position={[-0.22, 0, -0.22]} />
        </group>
    );
};

export const PoisonCloudLayer: React.FC = () => {
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
                <Suspense fallback={null}>
                    <LazyPhotonsPoisonProjectile effect="poison_cloud" scale={(cloud.visualScale ?? 1) * 1.16} />
                </Suspense>
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
