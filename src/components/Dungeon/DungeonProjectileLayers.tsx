import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, getCreatureFluxcageExpiry } from '../../engine/store';
import { GRID_SIZE } from '../../engine/constants';
import type { Direction, ProjectileEffect } from '../../engine/runtimeTypes';
import { getFloorItemImage } from '../../data/itemImages';
import { BillboardGroup } from './renderHelpers';
import { useLoadedTexture } from './useLoadedTexture';
import type { CreatureInstance, FloorItem } from '../../types/game';

type MagicProjectileEffect = Exclude<ProjectileEffect, 'physical'>;

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
    const activeProjectiles = useMemo(
        () => projectiles.filter((projectile) => projectile.level === level),
        [projectiles, level],
    );

    return (
        <>
            {activeProjectiles.map((projectile) => (
                projectile.effect === 'physical' && projectile.physicalItem ? (
                    <PhysicalProjectileSprite
                        key={projectile.id}
                        projectile={{
                            ...projectile,
                            physicalItem: projectile.physicalItem,
                            direction: projectile.direction,
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
}> = ({ teleporters }) => (
    <>
        {teleporters.map(({ tileX, tileY }) => (
            <group
                key={`teleporter_${tileX}_${tileY}`}
                position={[tileX * GRID_SIZE, GRID_SIZE * 0.02, tileY * GRID_SIZE]}
            >
                <Suspense fallback={null}>
                    <LazyPhotonsTeleporterCloud scale={0.9} />
                </Suspense>
            </group>
        ))}
    </>
);

const ProjectileOrb: React.FC<{
    projectile: { x: number; y: number; effect: MagicProjectileEffect; direction?: Direction; visualScale?: number };
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
            {projectile.effect === 'fireball' ? (
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

const PhysicalProjectileSprite: React.FC<{
    projectile: { x: number; y: number; physicalItem: FloorItem; direction?: Direction };
}> = ({ projectile }) => {
    const imagePath = getFloorItemImage(projectile.physicalItem);
    const baseTex = useLoadedTexture(imagePath);
    const tex = useMemo(() => {
        const next = baseTex.clone();
        next.colorSpace = THREE.SRGBColorSpace;
        next.needsUpdate = true;
        return next;
    }, [baseTex]);

    useEffect(() => () => tex.dispose(), [tex]);

    const image = tex.image as { width: number; height: number } | undefined;
    const aspect = image ? image.width / image.height : 1;
    const width = GRID_SIZE * 0.4;
    const height = width / aspect;
    const forwardOffset = GRID_SIZE * 0.22;
    const offsetX =
        projectile.direction === 'EAST' ? forwardOffset :
            projectile.direction === 'WEST' ? -forwardOffset :
                0;
    const offsetZ =
        projectile.direction === 'SOUTH' ? forwardOffset :
            projectile.direction === 'NORTH' ? -forwardOffset :
                0;

    return (
        <BillboardGroup
            position={[
                projectile.x * GRID_SIZE + offsetX,
                GRID_SIZE * 0.14,
                projectile.y * GRID_SIZE + offsetZ,
            ]}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
        >
            <mesh>
                <planeGeometry args={[width, height]} />
                <meshBasicMaterial
                    map={tex}
                    transparent
                    alphaTest={0.05}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>
        </BillboardGroup>
    );
};

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
    const level = useStore((state) => state.level);
    const gamePhase = useStore((state) => state.gamePhase);
    const endgameSequence = useStore((state) => state.endgameSequence);
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
