import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../engine/store';
import { GRID_SIZE } from '../../engine/constants';
import type { Direction } from '../../engine/runtimeTypes';
import {
    findLatestPartySpellImpactEvent,
    PARTY_FIREBALL_FLASH_MS,
    type PartySpellImpactEffect,
} from './partyFireballFlashState';
import { useWallClock } from './useWallClock';

const LazyPhotonsFireball = lazy(() =>
    import('./PhotonsFireball').then((module) => ({ default: module.PhotonsFireball })),
);

const LazyPhotonsPoisonProjectile = lazy(() =>
    import('./PhotonsFireball').then((module) => ({ default: module.PhotonsPoisonProjectile })),
);

const PARTY_FORWARD_VECTOR_MAP: Record<Direction, THREE.Vector3> = {
    NORTH: new THREE.Vector3(0, 0, -1),
    EAST: new THREE.Vector3(1, 0, 0),
    SOUTH: new THREE.Vector3(0, 0, 1),
    WEST: new THREE.Vector3(-1, 0, 0),
};

const PARTY_RIGHT_VECTOR_MAP: Record<Direction, THREE.Vector3> = {
    NORTH: new THREE.Vector3(1, 0, 0),
    EAST: new THREE.Vector3(0, 0, 1),
    SOUTH: new THREE.Vector3(-1, 0, 0),
    WEST: new THREE.Vector3(0, 0, -1),
};

function createBlastCloudTexture(): THREE.CanvasTexture {
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        const fallback = new THREE.CanvasTexture(canvas);
        fallback.colorSpace = THREE.SRGBColorSpace;
        fallback.needsUpdate = true;
        return fallback;
    }

    ctx.clearRect(0, 0, size, size);

    const base = ctx.createRadialGradient(
        size * 0.5,
        size * 0.54,
        size * 0.08,
        size * 0.5,
        size * 0.5,
        size * 0.44,
    );
    base.addColorStop(0, 'rgba(255,252,236,1)');
    base.addColorStop(0.1, 'rgba(255,224,148,1)');
    base.addColorStop(0.24, 'rgba(255,154,52,0.98)');
    base.addColorStop(0.46, 'rgba(224,74,12,0.82)');
    base.addColorStop(0.72, 'rgba(112,18,0,0.34)');
    base.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    const puffs = [
        { x: 0.24, y: 0.64, r: 0.2, color: 'rgba(255,148,42,0.56)' },
        { x: 0.42, y: 0.36, r: 0.16, color: 'rgba(255,214,132,0.44)' },
        { x: 0.6, y: 0.56, r: 0.22, color: 'rgba(255,126,28,0.58)' },
        { x: 0.74, y: 0.34, r: 0.14, color: 'rgba(255,232,168,0.34)' },
        { x: 0.5, y: 0.68, r: 0.18, color: 'rgba(255,96,18,0.48)' },
    ];

    for (const puff of puffs) {
        const gradient = ctx.createRadialGradient(
            size * puff.x,
            size * puff.y,
            size * puff.r * 0.12,
            size * puff.x,
            size * puff.y,
            size * puff.r * size,
        );
        gradient.addColorStop(0, puff.color);
        gradient.addColorStop(0.58, puff.color.replace(/0\.\d+\)/, '0.18)'));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    }

    const tongues = [
        { x: 0.31, y: 0.76, w: 0.16, h: 0.28, rotation: -0.14, color: 'rgba(255,178,84,0.34)' },
        { x: 0.48, y: 0.8, w: 0.18, h: 0.34, rotation: 0.02, color: 'rgba(255,136,36,0.42)' },
        { x: 0.67, y: 0.75, w: 0.15, h: 0.26, rotation: 0.16, color: 'rgba(255,188,96,0.3)' },
    ];

    for (const tongue of tongues) {
        ctx.save();
        ctx.translate(size * tongue.x, size * tongue.y);
        ctx.rotate(tongue.rotation);
        const gradient = ctx.createRadialGradient(
            0,
            -size * tongue.h * 0.18,
            0,
            0,
            0,
            size * Math.max(tongue.w, tongue.h) * 0.72,
        );
        gradient.addColorStop(0, tongue.color);
        gradient.addColorStop(0.52, tongue.color.replace(/0\.\d+\)/, '0.14)'));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(
            0,
            0,
            size * tongue.w * 0.5,
            size * tongue.h * 0.5,
            0,
            0,
            Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

function createPoisonMistTexture(): THREE.CanvasTexture {
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        const fallback = new THREE.CanvasTexture(canvas);
        fallback.colorSpace = THREE.SRGBColorSpace;
        fallback.needsUpdate = true;
        return fallback;
    }

    ctx.clearRect(0, 0, size, size);

    const haze = ctx.createRadialGradient(
        size * 0.5,
        size * 0.56,
        size * 0.08,
        size * 0.5,
        size * 0.52,
        size * 0.46,
    );
    haze.addColorStop(0, 'rgba(235,255,210,0.88)');
    haze.addColorStop(0.2, 'rgba(168,244,112,0.74)');
    haze.addColorStop(0.48, 'rgba(82,176,78,0.5)');
    haze.addColorStop(0.78, 'rgba(22,62,20,0.18)');
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, size, size);

    const puffs = [
        { x: 0.3, y: 0.62, r: 0.22, color: 'rgba(156,232,118,0.42)' },
        { x: 0.46, y: 0.42, r: 0.18, color: 'rgba(214,255,184,0.28)' },
        { x: 0.63, y: 0.56, r: 0.24, color: 'rgba(110,210,98,0.44)' },
        { x: 0.74, y: 0.36, r: 0.15, color: 'rgba(196,255,168,0.2)' },
        { x: 0.46, y: 0.74, r: 0.2, color: 'rgba(94,188,90,0.34)' },
    ];

    for (const puff of puffs) {
        const gradient = ctx.createRadialGradient(
            size * puff.x,
            size * puff.y,
            size * puff.r * 0.08,
            size * puff.x,
            size * puff.y,
            size * puff.r * size,
        );
        gradient.addColorStop(0, puff.color);
        gradient.addColorStop(0.6, puff.color.replace(/0\.\d+\)/, '0.12)'));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

function resolvePartyImpactAnchor(
    worldPosition: THREE.Vector3,
    forwardOffset: THREE.Vector3,
    lateralOffset: THREE.Vector3,
    position: [number, number],
    direction: Direction,
    t: number,
    options: {
        forwardBase: number;
        forwardBurst: number;
        heightBase: number;
        heightBurst: number;
        lateralSwing: number;
    },
) {
    const burst = Math.sin(Math.PI * t);
    const forward = PARTY_FORWARD_VECTOR_MAP[direction];
    const right = PARTY_RIGHT_VECTOR_MAP[direction];

    worldPosition.set(
        position[1] * GRID_SIZE,
        GRID_SIZE * (options.heightBase + burst * options.heightBurst),
        position[0] * GRID_SIZE,
    );
    forwardOffset.copy(forward).multiplyScalar(GRID_SIZE * (options.forwardBase + burst * options.forwardBurst));
    lateralOffset.copy(right).multiplyScalar(GRID_SIZE * Math.sin(t * Math.PI * 1.5) * options.lateralSwing);
    worldPosition.add(forwardOffset);
    worldPosition.add(lateralOffset);
}

function resolvePartyImpactVariant(effect: PartySpellImpactEffect): 'fire' | 'lightning' | 'poison' {
    if (effect === 'lightning') return 'lightning';
    if (effect === 'poison_bolt' || effect === 'poison_cloud' || effect === 'slime') return 'poison';
    return 'fire';
}

type ActiveBurst = {
    id: string;
    ts: number;
    effect: PartySpellImpactEffect;
};

export const PartyFireballBlastLayer: React.FC = () => {
    const spellVisualEvents = useStore((state) => state.spellVisualEvents);
    const level = useStore((state) => state.level);
    const position = useStore((state) => state.position);
    const direction = useStore((state) => state.direction);
    const latestPartySpellImpact = useMemo(
        () => findLatestPartySpellImpactEvent(spellVisualEvents, level, position),
        [spellVisualEvents, level, position],
    );
    const [activeBurst, setActiveBurst] = useState<ActiveBurst | null>(null);
    const lastImpactIdRef = useRef<string | null>(null);
    const wallClockNow = useWallClock(16);
    const now = wallClockNow === 0 ? Date.now() : wallClockNow;

    useEffect(() => {
        if (!latestPartySpellImpact) return;
        if (latestPartySpellImpact.id === lastImpactIdRef.current) return;

        lastImpactIdRef.current = latestPartySpellImpact.id;
        setActiveBurst({
            id: latestPartySpellImpact.id,
            ts: latestPartySpellImpact.ts,
            effect: latestPartySpellImpact.effect,
        });
    }, [latestPartySpellImpact]);

    if (!activeBurst) return null;

    const age = now - activeBurst.ts;
    if (age < 0 || age > PARTY_FIREBALL_FLASH_MS) {
        return null;
    }

    const variant = resolvePartyImpactVariant(activeBurst.effect);
    if (variant === 'lightning') {
        return (
            <PartyLightningBlast
                burstStartedAt={activeBurst.ts}
                position={position}
                direction={direction}
            />
        );
    }
    if (variant === 'poison') {
        return (
            <PartyPoisonBlast
                burstStartedAt={activeBurst.ts}
                position={position}
                direction={direction}
            />
        );
    }

    return (
        <PartyFireballBlast
            burstStartedAt={activeBurst.ts}
            position={position}
            direction={direction}
        />
    );
};

const PartyFireballBlast: React.FC<{
    burstStartedAt: number;
    position: [number, number];
    direction: Direction;
}> = ({ burstStartedAt, position, direction }) => {
    const { camera } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const floorRingRef = useRef<THREE.Mesh>(null);
    const shockRingRef = useRef<THREE.Mesh>(null);
    const outerCloudRef = useRef<THREE.Mesh>(null);
    const innerCloudRef = useRef<THREE.Mesh>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const worldPosition = useMemo(() => new THREE.Vector3(), []);
    const lateralOffset = useMemo(() => new THREE.Vector3(), []);
    const forwardOffset = useMemo(() => new THREE.Vector3(), []);
    const cloudTexture = useMemo(() => createBlastCloudTexture(), []);
    const flameOffsets = useMemo(
        () =>
            Array.from({ length: 6 }, (_, index) => {
                const angle = (index / 6) * Math.PI * 2;
                return {
                    x: Math.cos(angle) * 0.14,
                    z: Math.sin(angle) * 0.14,
                    lift: 0.18 + (index % 3) * 0.05,
                    rotation: angle,
                };
            }),
        [],
    );
    const sparkOffsets = useMemo(
        () =>
            Array.from({ length: 8 }, (_, index) => {
                const angle = (index / 8) * Math.PI * 2;
                return {
                    x: Math.cos(angle) * (0.18 + (index % 3) * 0.05),
                    z: Math.sin(angle) * (0.18 + (index % 3) * 0.05),
                    rise: 0.06 + (index % 3) * 0.025,
                };
            }),
        [],
    );
    const outerCloudMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#ff7a26',
                map: cloudTexture,
                transparent: true,
                opacity: 0.46,
                alphaTest: 0.08,
                depthWrite: false,
                depthTest: false,
                blending: THREE.NormalBlending,
                side: THREE.DoubleSide,
                toneMapped: false,
            }),
        [cloudTexture],
    );
    const innerCloudMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#ffd67f',
                map: cloudTexture,
                transparent: true,
                opacity: 0.56,
                alphaTest: 0.08,
                depthWrite: false,
                depthTest: false,
                blending: THREE.NormalBlending,
                side: THREE.DoubleSide,
                toneMapped: false,
            }),
        [cloudTexture],
    );
    const coreMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#ffd67f',
                transparent: true,
                opacity: 0.44,
                alphaTest: 0.05,
                depthWrite: false,
                depthTest: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }),
        [],
    );
    const ringMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#ff8a3d',
                transparent: true,
                opacity: 0.58,
                depthWrite: false,
                toneMapped: false,
            }),
        [],
    );
    const shockMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#ffd97a',
                transparent: true,
                opacity: 0.64,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }),
        [],
    );
    const flameMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#ffbe55',
                transparent: true,
                opacity: 0.54,
                depthWrite: false,
                toneMapped: false,
            }),
        [],
    );
    const emberMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#ff7a26',
                transparent: true,
                opacity: 0.5,
                depthWrite: false,
                toneMapped: false,
            }),
        [],
    );

    useEffect(
        () => () => {
            cloudTexture.dispose();
            outerCloudMaterial.dispose();
            innerCloudMaterial.dispose();
            coreMaterial.dispose();
            ringMaterial.dispose();
            shockMaterial.dispose();
            flameMaterial.dispose();
            emberMaterial.dispose();
        },
        [
            cloudTexture,
            coreMaterial,
            emberMaterial,
            flameMaterial,
            innerCloudMaterial,
            outerCloudMaterial,
            ringMaterial,
            shockMaterial,
        ],
    );

    useFrame(() => {
        if (!groupRef.current) return;

        const age = Date.now() - burstStartedAt;
        const t = Math.max(0, Math.min(1, age / PARTY_FIREBALL_FLASH_MS));
        const burst = Math.sin(Math.PI * t);
        const fade = 1 - t;
        const forward = PARTY_FORWARD_VECTOR_MAP[direction];
        const right = PARTY_RIGHT_VECTOR_MAP[direction];

        worldPosition.set(position[1] * GRID_SIZE, GRID_SIZE * (0.08 + burst * 0.05), position[0] * GRID_SIZE);
        forwardOffset.copy(forward).multiplyScalar(GRID_SIZE * (0.56 + burst * 0.16));
        lateralOffset.copy(right).multiplyScalar(GRID_SIZE * Math.sin(t * Math.PI * 1.5) * 0.025);
        worldPosition.add(forwardOffset);
        worldPosition.add(lateralOffset);

        groupRef.current.position.copy(worldPosition);
        groupRef.current.scale.set(
            1.4 + burst * 0.88,
            1 + burst * 0.54,
            1.5 + burst * 1.04,
        );

        if (floorRingRef.current) {
            floorRingRef.current.scale.setScalar(0.72 + t * 1.5);
            floorRingRef.current.rotation.x = -Math.PI / 2;
            floorRingRef.current.rotation.z = t * Math.PI * 0.35;
            (floorRingRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.5;
        }

        if (shockRingRef.current) {
            shockRingRef.current.position.set(0, GRID_SIZE * (0.12 + burst * 0.08), 0);
            shockRingRef.current.scale.setScalar(0.46 + burst * 1.18);
            shockRingRef.current.rotation.x = Math.PI / 2;
            shockRingRef.current.rotation.z = t * Math.PI * 0.7;
            (shockRingRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.56;
        }

        if (outerCloudRef.current) {
            outerCloudRef.current.position.set(0, GRID_SIZE * (0.18 + burst * 0.08), 0);
            outerCloudRef.current.scale.set(
                2.9 + burst * 1.18,
                1.9 + burst * 0.7,
                1,
            );
            outerCloudRef.current.rotation.z = Math.sin(t * Math.PI * 1.2) * 0.08;
            outerCloudRef.current.quaternion.copy(camera.quaternion);
            (outerCloudRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.48;
        }

        if (innerCloudRef.current) {
            innerCloudRef.current.position.set(0.02, GRID_SIZE * (0.24 + burst * 0.12), -0.01);
            innerCloudRef.current.scale.set(
                2.16 + burst * 0.92,
                1.4 + burst * 0.44,
                1,
            );
            innerCloudRef.current.rotation.z = -0.08 + Math.sin(t * Math.PI * 1.7) * 0.1;
            innerCloudRef.current.quaternion.copy(camera.quaternion);
            (innerCloudRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.62;
        }

        if (coreRef.current) {
            coreRef.current.position.set(0, GRID_SIZE * (0.2 + burst * 0.08), 0.01);
            coreRef.current.scale.set(
                1.34 + burst * 0.84,
                0.88 + burst * 0.34,
                1.4 + burst * 0.88,
            );
            coreRef.current.quaternion.copy(camera.quaternion);
            (coreRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.5;
        }

        if (lightRef.current) {
            lightRef.current.intensity = Math.max(0, fade * 2.35);
            lightRef.current.distance = GRID_SIZE * (3.4 + burst * 1.6);
        }
    });

    return (
        <group ref={groupRef}>
            <mesh ref={floorRingRef} material={ringMaterial} frustumCulled={false} renderOrder={214}>
                <torusGeometry args={[GRID_SIZE * 0.24, GRID_SIZE * 0.05, 10, 28]} />
            </mesh>
            <mesh ref={shockRingRef} material={shockMaterial} frustumCulled={false} renderOrder={215}>
                <torusGeometry args={[GRID_SIZE * 0.18, GRID_SIZE * 0.032, 10, 24]} />
            </mesh>
            <mesh ref={outerCloudRef} material={outerCloudMaterial} frustumCulled={false} renderOrder={220}>
                <planeGeometry args={[1, 1]} />
            </mesh>
            <mesh ref={innerCloudRef} material={innerCloudMaterial} frustumCulled={false} renderOrder={221}>
                <planeGeometry args={[1, 1]} />
            </mesh>
            <mesh ref={coreRef} material={coreMaterial} frustumCulled={false} renderOrder={222}>
                <planeGeometry args={[1, 1]} />
            </mesh>
            {flameOffsets.map((offset, index) => (
                <PartyFireballFlame
                    key={`party_fire_flame_${index}`}
                    burstStartedAt={burstStartedAt}
                    material={flameMaterial}
                    offset={offset}
                />
            ))}
            {sparkOffsets.map((offset, index) => (
                <PartyFireballEmber
                    key={`party_fire_ember_${index}`}
                    burstStartedAt={burstStartedAt}
                    material={emberMaterial}
                    offset={offset}
                />
            ))}
            <Suspense fallback={null}>
                <PhotonsFireballCluster />
            </Suspense>
            <pointLight
                ref={lightRef}
                color="#ff9a43"
                intensity={0}
                distance={2.4}
                decay={2}
                position={[0, GRID_SIZE * 0.24, 0]}
            />
        </group>
    );
};

const PartyFireballFlame: React.FC<{
    burstStartedAt: number;
    material: THREE.MeshBasicMaterial;
    offset: { x: number; z: number; lift: number; rotation: number };
}> = ({ burstStartedAt, material, offset }) => {
    const flameRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (!flameRef.current) return;
        const age = Date.now() - burstStartedAt;
        const t = Math.max(0, Math.min(1, age / PARTY_FIREBALL_FLASH_MS));
        const burst = Math.sin(Math.PI * t);
        const fade = 1 - t;
        flameRef.current.position.x = offset.x * (0.82 + burst * 1.6);
        flameRef.current.position.z = offset.z * (0.82 + burst * 1.6);
        flameRef.current.position.y = GRID_SIZE * (0.08 + offset.lift * burst);
        flameRef.current.rotation.y = offset.rotation;
        flameRef.current.rotation.z = 0.12 + Math.sin(offset.rotation * 2 + t * Math.PI * 1.2) * 0.2;
        flameRef.current.scale.set(
            0.26 + fade * 0.12,
            0.72 + burst * 1.1,
            0.26 + fade * 0.12,
        );
        (flameRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.58;
    });

    return (
        <mesh ref={flameRef} material={material} frustumCulled={false} renderOrder={223}>
            <sphereGeometry args={[GRID_SIZE * 0.12, 10, 10]} />
        </mesh>
    );
};

const PartyFireballEmber: React.FC<{
    burstStartedAt: number;
    material: THREE.MeshBasicMaterial;
    offset: { x: number; z: number; rise: number };
}> = ({ burstStartedAt, material, offset }) => {
    const emberRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (!emberRef.current) return;
        const age = Date.now() - burstStartedAt;
        const t = Math.max(0, Math.min(1, age / PARTY_FIREBALL_FLASH_MS));
        const fade = 1 - t;
        emberRef.current.position.x = offset.x * t * 1.2;
        emberRef.current.position.z = offset.z * t * 1.2;
        emberRef.current.position.y = GRID_SIZE * (0.06 + offset.rise * Math.sin(Math.PI * t));
        emberRef.current.scale.setScalar((0.18 + fade * 0.1) * fade);
        (emberRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.46;
    });

    return (
        <mesh ref={emberRef} material={material} frustumCulled={false} renderOrder={219}>
            <sphereGeometry args={[GRID_SIZE * 0.08, 8, 8]} />
        </mesh>
    );
};

const PartyPoisonBlast: React.FC<{
    burstStartedAt: number;
    position: [number, number];
    direction: Direction;
}> = ({ burstStartedAt, position, direction }) => {
    const { camera } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const outerMistRef = useRef<THREE.Mesh>(null);
    const innerMistRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const worldPosition = useMemo(() => new THREE.Vector3(), []);
    const lateralOffset = useMemo(() => new THREE.Vector3(), []);
    const forwardOffset = useMemo(() => new THREE.Vector3(), []);
    const poisonTexture = useMemo(() => createPoisonMistTexture(), []);
    const wispOffsets = useMemo(
        () =>
            Array.from({ length: 7 }, (_, index) => {
                const angle = (index / 7) * Math.PI * 2;
                return {
                    x: Math.cos(angle) * (0.12 + (index % 3) * 0.045),
                    z: Math.sin(angle) * (0.12 + (index % 3) * 0.045),
                    drift: 0.08 + (index % 3) * 0.03,
                    rise: 0.1 + (index % 3) * 0.03,
                    phase: index * 0.7,
                };
            }),
        [],
    );
    const outerMistMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#77d66b',
                map: poisonTexture,
                transparent: true,
                opacity: 0.36,
                alphaTest: 0.05,
                depthWrite: false,
                depthTest: false,
                blending: THREE.NormalBlending,
                side: THREE.DoubleSide,
                toneMapped: false,
            }),
        [poisonTexture],
    );
    const innerMistMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#d9ffb3',
                map: poisonTexture,
                transparent: true,
                opacity: 0.28,
                alphaTest: 0.04,
                depthWrite: false,
                depthTest: false,
                blending: THREE.NormalBlending,
                side: THREE.DoubleSide,
                toneMapped: false,
            }),
        [poisonTexture],
    );
    const ringMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#8cff8b',
                transparent: true,
                opacity: 0.3,
                depthWrite: false,
                toneMapped: false,
            }),
        [],
    );
    const wispMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#baff8c',
                transparent: true,
                opacity: 0.34,
                depthWrite: false,
                toneMapped: false,
            }),
        [],
    );

    useEffect(
        () => () => {
            poisonTexture.dispose();
            outerMistMaterial.dispose();
            innerMistMaterial.dispose();
            ringMaterial.dispose();
            wispMaterial.dispose();
        },
        [poisonTexture, outerMistMaterial, innerMistMaterial, ringMaterial, wispMaterial],
    );

    useFrame(() => {
        if (!groupRef.current) return;

        const age = Date.now() - burstStartedAt;
        const t = Math.max(0, Math.min(1, age / PARTY_FIREBALL_FLASH_MS));
        const burst = Math.sin(Math.PI * t);
        const fade = 1 - t;

        resolvePartyImpactAnchor(
            worldPosition,
            forwardOffset,
            lateralOffset,
            position,
            direction,
            t,
            {
                forwardBase: 0.5,
                forwardBurst: 0.1,
                heightBase: 0.05,
                heightBurst: 0.04,
                lateralSwing: 0.014,
            },
        );

        groupRef.current.position.copy(worldPosition);
        groupRef.current.scale.set(
            1.18 + burst * 0.46,
            0.96 + burst * 0.28,
            1.2 + burst * 0.5,
        );

        if (ringRef.current) {
            ringRef.current.rotation.x = -Math.PI / 2;
            ringRef.current.rotation.z = t * Math.PI * 0.22;
            ringRef.current.scale.setScalar(0.74 + t * 1.16);
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.28;
        }

        if (outerMistRef.current) {
            outerMistRef.current.position.set(0, GRID_SIZE * (0.2 + burst * 0.06), 0);
            outerMistRef.current.scale.set(
                3.1 + burst * 0.72,
                1.74 + burst * 0.5,
                1,
            );
            outerMistRef.current.rotation.z = Math.sin(t * Math.PI) * 0.08;
            outerMistRef.current.quaternion.copy(camera.quaternion);
            (outerMistRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.4;
        }

        if (innerMistRef.current) {
            innerMistRef.current.position.set(0.03, GRID_SIZE * (0.28 + burst * 0.08), -0.01);
            innerMistRef.current.scale.set(
                2.36 + burst * 0.52,
                1.42 + burst * 0.36,
                1,
            );
            innerMistRef.current.rotation.z = -0.06 + Math.sin(t * Math.PI * 1.4) * 0.08;
            innerMistRef.current.quaternion.copy(camera.quaternion);
            (innerMistRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.3;
        }

        if (lightRef.current) {
            lightRef.current.intensity = Math.max(0, fade * 0.95);
            lightRef.current.distance = GRID_SIZE * (2.5 + burst * 0.7);
        }
    });

    return (
        <group ref={groupRef}>
            <mesh ref={ringRef} material={ringMaterial} frustumCulled={false} renderOrder={214}>
                <torusGeometry args={[GRID_SIZE * 0.2, GRID_SIZE * 0.03, 10, 24]} />
            </mesh>
            <mesh ref={outerMistRef} material={outerMistMaterial} frustumCulled={false} renderOrder={220}>
                <planeGeometry args={[1, 1]} />
            </mesh>
            <mesh ref={innerMistRef} material={innerMistMaterial} frustumCulled={false} renderOrder={221}>
                <planeGeometry args={[1, 1]} />
            </mesh>
            {wispOffsets.map((offset, index) => (
                <PartyPoisonWisp
                    key={`party_poison_wisp_${index}`}
                    burstStartedAt={burstStartedAt}
                    material={wispMaterial}
                    offset={offset}
                />
            ))}
            <Suspense fallback={null}>
                <group position={[0, GRID_SIZE * 0.12, 0]}>
                    <LazyPhotonsPoisonProjectile effect="poison_cloud" scale={1.18} />
                </group>
            </Suspense>
            <pointLight
                ref={lightRef}
                color="#95ff7d"
                intensity={0}
                distance={GRID_SIZE * 2.2}
                decay={2}
                position={[0, GRID_SIZE * 0.18, 0]}
            />
        </group>
    );
};

const PartyPoisonWisp: React.FC<{
    burstStartedAt: number;
    material: THREE.MeshBasicMaterial;
    offset: { x: number; z: number; drift: number; rise: number; phase: number };
}> = ({ burstStartedAt, material, offset }) => {
    const wispRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (!wispRef.current) return;
        const age = Date.now() - burstStartedAt;
        const t = Math.max(0, Math.min(1, age / PARTY_FIREBALL_FLASH_MS));
        const fade = 1 - t;
        wispRef.current.position.x = offset.x * (0.64 + t * 1.7);
        wispRef.current.position.z = offset.z * (0.64 + t * 1.7);
        wispRef.current.position.y =
            GRID_SIZE * (0.05 + offset.rise * Math.sin(Math.PI * t)) +
            Math.sin(offset.phase + t * Math.PI * 2) * 0.03;
        wispRef.current.scale.set(
            0.2 + fade * 0.08,
            0.18 + Math.sin(Math.PI * t) * offset.drift,
            0.2 + fade * 0.08,
        );
        (wispRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.42;
    });

    return (
        <mesh ref={wispRef} material={material} frustumCulled={false} renderOrder={222}>
            <sphereGeometry args={[GRID_SIZE * 0.1, 8, 8]} />
        </mesh>
    );
};

const PartyLightningBlast: React.FC<{
    burstStartedAt: number;
    position: [number, number];
    direction: Direction;
}> = ({ burstStartedAt, position, direction }) => {
    const { camera } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const floorRingRef = useRef<THREE.Mesh>(null);
    const shockRingRef = useRef<THREE.Mesh>(null);
    const flashRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const worldPosition = useMemo(() => new THREE.Vector3(), []);
    const lateralOffset = useMemo(() => new THREE.Vector3(), []);
    const forwardOffset = useMemo(() => new THREE.Vector3(), []);
    const arcOffsets = useMemo(
        () =>
            Array.from({ length: 6 }, (_, index) => ({
                angle: (index / 6) * Math.PI * 2,
                tilt: index % 2 === 0 ? 0.28 : -0.28,
                reach: 0.28 + (index % 3) * 0.05,
                rise: 0.03 + (index % 2) * 0.03,
            })),
        [],
    );
    const ringMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#d7f7ff',
                transparent: true,
                opacity: 0.44,
                depthWrite: false,
                toneMapped: false,
            }),
        [],
    );
    const shockMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#ffffff',
                transparent: true,
                opacity: 0.7,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }),
        [],
    );
    const arcMaterial = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                color: '#8fdfff',
                transparent: true,
                opacity: 0.52,
                depthWrite: false,
                toneMapped: false,
            }),
        [],
    );

    useEffect(
        () => () => {
            ringMaterial.dispose();
            shockMaterial.dispose();
            arcMaterial.dispose();
        },
        [ringMaterial, shockMaterial, arcMaterial],
    );

    useFrame(() => {
        if (!groupRef.current) return;

        const age = Date.now() - burstStartedAt;
        const t = Math.max(0, Math.min(1, age / PARTY_FIREBALL_FLASH_MS));
        const burst = Math.sin(Math.PI * t);
        const fade = 1 - t;

        resolvePartyImpactAnchor(
            worldPosition,
            forwardOffset,
            lateralOffset,
            position,
            direction,
            t,
            {
                forwardBase: 0.54,
                forwardBurst: 0.08,
                heightBase: 0.07,
                heightBurst: 0.05,
                lateralSwing: 0.012,
            },
        );

        groupRef.current.position.copy(worldPosition);
        groupRef.current.scale.set(
            1.08 + burst * 0.26,
            0.94 + burst * 0.22,
            1.08 + burst * 0.26,
        );

        if (floorRingRef.current) {
            floorRingRef.current.rotation.x = -Math.PI / 2;
            floorRingRef.current.rotation.z = t * Math.PI * 0.55;
            floorRingRef.current.scale.setScalar(0.6 + t * 1.24);
            (floorRingRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.42;
        }

        if (shockRingRef.current) {
            shockRingRef.current.position.set(0, GRID_SIZE * (0.14 + burst * 0.06), 0);
            shockRingRef.current.rotation.x = Math.PI / 2;
            shockRingRef.current.rotation.z = t * Math.PI * 0.9;
            shockRingRef.current.scale.setScalar(0.44 + burst * 0.92);
            (shockRingRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.64;
        }

        if (flashRef.current) {
            flashRef.current.position.set(0, GRID_SIZE * (0.22 + burst * 0.06), 0);
            flashRef.current.scale.set(
                0.72 + burst * 0.18,
                1.66 + burst * 0.62,
                1,
            );
            flashRef.current.quaternion.copy(camera.quaternion);
            (flashRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.54;
        }

        if (lightRef.current) {
            lightRef.current.intensity = Math.max(0, fade * 1.75);
            lightRef.current.distance = GRID_SIZE * (2.9 + burst * 0.9);
        }
    });

    return (
        <group ref={groupRef}>
            <mesh ref={floorRingRef} material={ringMaterial} frustumCulled={false} renderOrder={214}>
                <torusGeometry args={[GRID_SIZE * 0.2, GRID_SIZE * 0.028, 10, 24]} />
            </mesh>
            <mesh ref={shockRingRef} material={shockMaterial} frustumCulled={false} renderOrder={215}>
                <torusGeometry args={[GRID_SIZE * 0.16, GRID_SIZE * 0.024, 10, 24]} />
            </mesh>
            <mesh ref={flashRef} material={shockMaterial} frustumCulled={false} renderOrder={220}>
                <planeGeometry args={[1, 1]} />
            </mesh>
            {arcOffsets.map((arc, index) => (
                <PartyLightningArc
                    key={`party_lightning_arc_${index}`}
                    burstStartedAt={burstStartedAt}
                    material={arcMaterial}
                    arc={arc}
                />
            ))}
            <pointLight
                ref={lightRef}
                color="#c7f1ff"
                intensity={0}
                distance={GRID_SIZE * 2.4}
                decay={2}
                position={[0, GRID_SIZE * 0.2, 0]}
            />
        </group>
    );
};

const PartyLightningArc: React.FC<{
    burstStartedAt: number;
    material: THREE.MeshBasicMaterial;
    arc: { angle: number; tilt: number; reach: number; rise: number };
}> = ({ burstStartedAt, material, arc }) => {
    const arcRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (!arcRef.current) return;
        const age = Date.now() - burstStartedAt;
        const t = Math.max(0, Math.min(1, age / PARTY_FIREBALL_FLASH_MS));
        const fade = 1 - t;
        arcRef.current.position.x = Math.cos(arc.angle) * arc.reach * (0.34 + t * 0.86);
        arcRef.current.position.z = Math.sin(arc.angle) * arc.reach * (0.34 + t * 0.86);
        arcRef.current.position.y = GRID_SIZE * (0.05 + arc.rise * Math.sin(Math.PI * t));
        arcRef.current.rotation.y = arc.angle;
        arcRef.current.rotation.z = arc.tilt + Math.sin((arc.angle * 2) + t * Math.PI * 3) * 0.16;
        arcRef.current.scale.set(
            0.08 + fade * 0.03,
            0.5 + Math.sin(Math.PI * t) * 0.26,
            0.08 + fade * 0.03,
        );
        (arcRef.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.56;
    });

    return (
        <mesh ref={arcRef} material={material} frustumCulled={false} renderOrder={221}>
            <boxGeometry args={[GRID_SIZE * 0.08, GRID_SIZE * 0.46, GRID_SIZE * 0.08]} />
        </mesh>
    );
};

const PhotonsFireballCluster: React.FC = () => (
    <group>
        <group position={[0, GRID_SIZE * 0.16, 0.04]} scale={[2.1, 1.52, 2.2]}>
            <LazyPhotonsFireball scale={1.94} />
        </group>
        <group position={[0.18, GRID_SIZE * 0.22, -0.06]} scale={[1.42, 1.02, 1.5]}>
            <LazyPhotonsFireball scale={1.24} />
        </group>
        <group position={[-0.16, GRID_SIZE * 0.1, -0.03]} scale={[1.08, 0.82, 1.14]}>
            <LazyPhotonsFireball scale={0.98} />
        </group>
    </group>
);
