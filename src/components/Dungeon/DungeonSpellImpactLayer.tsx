import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../engine/store';
import { DAMAGE_EVENT_LIFETIME_MS } from '../../engine/time';
import { GRID_SIZE } from '../../engine/constants';
import type { SpellVisualEvent } from '../../engine/runtimeTypes';
import {
    hashSpellVisualSeed,
    sampleSpellVisualInt,
    sampleSpellVisualRange,
    sampleSpellVisualSeed,
} from './spellVisualSeed';

function createPulseMaterial(color: string, opacity: number) {
    return new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
    });
}

export const SpellImpactLayer: React.FC = () => {
    const spellVisualEvents = useStore((s) => s.spellVisualEvents);
    const level = useStore((s) => s.level);
    const impacts = useMemo(
        () => spellVisualEvents.filter((event) => event.level === level),
        [spellVisualEvents, level],
    );
    const ringGeometry = useMemo(() => new THREE.RingGeometry(0.1, 0.26, 24), []);
    const fireMaterial = useMemo(() => createPulseMaterial('#ff7e26', 0.46), []);
    const fireCoreMaterial = useMemo(() => createPulseMaterial('#ffe39a', 0.74), []);
    const fireFlameMaterial = useMemo(() => createPulseMaterial('#ffb54a', 0.62), []);
    const lightningMaterial = useMemo(() => createPulseMaterial('#c3efff', 0.38), []);
    const lightningCoreMaterial = useMemo(() => createPulseMaterial('#e6f8ff', 0.78), []);
    const lightningArcMaterial = useMemo(() => createPulseMaterial('#64ceff', 0.58), []);
    const poisonMaterial = useMemo(() => createPulseMaterial('#36be7a', 0.46), []);
    const poisonCoreMaterial = useMemo(() => createPulseMaterial('#b8ffe0', 0.62), []);
    const poisonMistMaterial = useMemo(() => createPulseMaterial('#269c64', 0.4), []);
    const openMaterial = useMemo(() => createPulseMaterial('#f3df7e', 0.44), []);
    const openCoreMaterial = useMemo(() => createPulseMaterial('#fff6d0', 0.74), []);
    const openSparkMaterial = useMemo(() => createPulseMaterial('#ffe893', 0.58), []);
    const disruptMaterial = useMemo(() => createPulseMaterial('#f0df93', 0.38), []);
    const disruptCoreMaterial = useMemo(() => createPulseMaterial('#fff9d6', 0.6), []);
    const disruptShardMaterial = useMemo(() => createPulseMaterial('#ffd96c', 0.46), []);
    const dustMaterial = useMemo(() => createPulseMaterial('#d8b781', 0.5), []);

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
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(
        () => event.effect === 'poison_cloud'
            ? sampleSpellVisualRange(seed, 1, 720, 860)
            : event.effect === 'slime'
                ? sampleSpellVisualRange(seed, 2, 560, 700)
                : sampleSpellVisualRange(seed, 3, 520, 640),
        [event.effect, seed],
    );
    const mistNodes = useMemo(
        () => {
            const count = event.effect === 'poison_cloud'
                ? sampleSpellVisualInt(seed, 4, 8, 11)
                : event.effect === 'slime'
                    ? sampleSpellVisualInt(seed, 5, 6, 8)
                    : sampleSpellVisualInt(seed, 6, 5, 7);
            return Array.from({ length: count }, (_, index) => {
            const angle = (index / count) * Math.PI * 2;
                const spread = sampleSpellVisualRange(seed, 10 + index, 0.08, 0.18);
                const drift = sampleSpellVisualRange(seed, 24 + index, 0.08, 0.16);
                const rise = sampleSpellVisualRange(seed, 38 + index, 0.08, 0.16);
                const phase = sampleSpellVisualRange(seed, 52 + index, 0, Math.PI * 2);
                return { x: Math.cos(angle) * spread, z: Math.sin(angle) * spread, drift, rise, phase };
            });
        },
        [event.effect, seed],
    );

    useFrame(() => {
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
        const spellScale = (event.visualScale ?? 1) * (event.effect === 'poison_cloud' ? 1.22 : event.effect === 'slime' ? 1.02 : 0.95);

        if (ringRef.current) {
            ringRef.current.scale.setScalar((0.64 + t * 1.65) * spellScale);
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.42;
            ringRef.current.visible = t < 1;
        }

        if (coreRef.current) {
            coreRef.current.scale.setScalar((0.28 + Math.sin(Math.PI * t) * 0.54) * spellScale);
            (coreRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.56;
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
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeometry} material={material} frustumCulled={false} />
            <mesh ref={coreRef} material={coreMaterial} frustumCulled={false}>
                <sphereGeometry args={[0.16, 10, 10]} />
            </mesh>
            {mistNodes.map((mist, index) => (
                <PoisonImpactWisp key={`poison_wisp_${index}`} event={event} material={mistMaterial} offset={mist} />
            ))}
            <pointLight ref={lightRef} color="#38d48a" intensity={0} distance={GRID_SIZE * 1.35} decay={2} position={[0, GRID_SIZE * 0.16, 0]} />
        </group>
    );
};

const PoisonImpactWisp: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    offset: { x: number; z: number; drift: number; rise: number; phase: number };
}> = ({ event, material, offset }) => {
    const wispRef = useRef<THREE.Mesh>(null);
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(
        () => event.effect === 'poison_cloud'
            ? sampleSpellVisualRange(seed, 61, 720, 860)
            : event.effect === 'slime'
                ? sampleSpellVisualRange(seed, 62, 560, 700)
                : sampleSpellVisualRange(seed, 63, 520, 640),
        [event.effect, seed],
    );
    useFrame(() => {
        if (!wispRef.current) return;
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
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(() => sampleSpellVisualRange(seed, 71, 260, 340), [seed]);
    const arcs = useMemo(
        () => {
            const count = sampleSpellVisualInt(seed, 72, 5, 7);
            return Array.from({ length: count }, (_, index) => ({
                angle: (index / count) * Math.PI * 2,
                tilt: sampleSpellVisualRange(seed, 73 + index, -0.46, 0.46),
                reach: sampleSpellVisualRange(seed, 81 + index, 0.28, 0.48),
                rise: sampleSpellVisualRange(seed, 89 + index, 0.02, 0.08),
            }));
        },
        [seed],
    );

    useFrame(() => {
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
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
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeometry} material={material} frustumCulled={false} />
            <mesh ref={flashRef} material={coreMaterial} frustumCulled={false}>
                <sphereGeometry args={[0.12, 10, 10]} />
            </mesh>
            {arcs.map((arc, index) => (
                <LightningImpactArc key={`lightning_arc_${index}`} event={event} material={arcMaterial} arc={arc} />
            ))}
            <pointLight ref={lightRef} color="#8fe1ff" intensity={0} distance={GRID_SIZE * 1.7} decay={2} position={[0, GRID_SIZE * 0.16, 0]} />
        </group>
    );
};

const LightningImpactArc: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    arc: { angle: number; tilt: number; reach: number; rise: number };
}> = ({ event, material, arc }) => {
    const arcRef = useRef<THREE.Mesh>(null);
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(() => sampleSpellVisualRange(seed, 101, 260, 340), [seed]);
    useFrame(() => {
        if (!arcRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
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
    const haloRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(() => sampleSpellVisualRange(seed, 111, 640, 820), [seed]);
    const sparks = useMemo(
        () => {
            const count = sampleSpellVisualInt(seed, 112, 7, 10);
            return Array.from({ length: count }, (_, index) => ({
                angle: (index / count) * Math.PI * 2,
                radius: sampleSpellVisualRange(seed, 113 + index, 0.18, 0.34),
                rise: sampleSpellVisualRange(seed, 125 + index, 0.08, 0.2),
            }));
        },
        [seed],
    );

    useFrame(() => {
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
        const visualScale = (event.visualScale ?? 1) * 1.28;

        if (ringRef.current) {
            ringRef.current.scale.setScalar((0.78 + t * 1.7) * visualScale);
            ringRef.current.rotation.z = t * Math.PI * 0.9;
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.52;
            ringRef.current.visible = t < 1;
        }

        if (coreRef.current) {
            coreRef.current.scale.setScalar((0.28 + Math.sin(Math.PI * t) * 0.72) * visualScale);
            coreRef.current.rotation.y = t * Math.PI * 1.4;
            (coreRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.64;
            coreRef.current.visible = t < 1;
        }

        if (haloRef.current) {
            haloRef.current.scale.setScalar((0.52 + Math.sin(Math.PI * t) * 0.95) * visualScale);
            haloRef.current.rotation.z = t * Math.PI * 0.65;
            (haloRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.48;
            haloRef.current.visible = t < 1;
        }

        if (lightRef.current) {
            lightRef.current.intensity = Math.max(0, (1 - t) * 1.85 * Math.max(1, visualScale));
            lightRef.current.distance = GRID_SIZE * (1.7 + visualScale * 0.65);
        }
    });

    return (
        <group
            position={[
                event.x * GRID_SIZE + (event.offsetX ?? 0),
                event.height ?? GRID_SIZE * 0.11,
                event.y * GRID_SIZE + (event.offsetZ ?? 0),
            ]}
        >
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeometry} material={material} frustumCulled={false} />
            <mesh ref={coreRef} material={coreMaterial} frustumCulled={false}>
                <torusGeometry args={[0.18, 0.03, 8, 24]} />
            </mesh>
            <mesh ref={haloRef} material={material} frustumCulled={false} position={[0, GRID_SIZE * 0.18, 0]}>
                <torusGeometry args={[0.28, 0.045, 8, 28]} />
            </mesh>
            {sparks.map((spark, index) => (
                <OpenDoorImpactSpark key={`open_spark_${index}`} event={event} material={sparkMaterial} spark={spark} />
            ))}
            <pointLight ref={lightRef} color="#ffe48a" intensity={0} distance={GRID_SIZE * 1.7} decay={2} position={[0, GRID_SIZE * 0.24, 0]} />
        </group>
    );
};

const OpenDoorImpactSpark: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    spark: { angle: number; radius: number; rise: number };
}> = ({ event, material, spark }) => {
    const sparkRef = useRef<THREE.Mesh>(null);
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(() => sampleSpellVisualRange(seed, 141, 640, 820), [seed]);
    useFrame(() => {
        if (!sparkRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
        const visualScale = (event.visualScale ?? 1) * 1.2;
        sparkRef.current.position.x = Math.cos(spark.angle) * spark.radius * (0.45 + t * 1.2) * visualScale;
        sparkRef.current.position.z = Math.sin(spark.angle) * spark.radius * (0.45 + t * 1.2) * visualScale;
        sparkRef.current.position.y = (GRID_SIZE * 0.06) + spark.rise * Math.sin(Math.PI * t) * visualScale;
        sparkRef.current.rotation.y = spark.angle;
        sparkRef.current.rotation.z = Math.PI / 4 + t * Math.PI * 0.5;
        sparkRef.current.scale.set(
            (0.08 + (1 - t) * 0.03) * visualScale,
            (0.32 + Math.sin(Math.PI * t) * 0.18) * visualScale,
            (0.08 + (1 - t) * 0.03) * visualScale,
        );
        (sparkRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.58;
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
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(() => sampleSpellVisualRange(seed, 151, 460, 620), [seed]);
    const shards = useMemo(
        () => {
            const count = sampleSpellVisualInt(seed, 152, 7, 10);
            return Array.from({ length: count }, (_, index) => {
                const angle = (index / count) * Math.PI * 2;
                const radius = sampleSpellVisualRange(seed, 153 + index, 0.1, 0.2);
                const rise = sampleSpellVisualRange(seed, 167 + index, 0.03, 0.09);
                return { angle, radius, rise, spin: sampleSpellVisualSeed(seed, 181 + index) > 0.5 ? 1 : -1 };
            });
        },
        [seed],
    );

    useFrame(() => {
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
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
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeometry} material={material} frustumCulled={false} />
            <mesh ref={shellRef} material={coreMaterial} frustumCulled={false}>
                <sphereGeometry args={[0.13, 10, 10]} />
            </mesh>
            {shards.map((shard, index) => (
                <DisruptImpactShard key={`disrupt_shard_${index}`} event={event} material={shardMaterial} shard={shard} />
            ))}
            <pointLight ref={lightRef} color="#ffe187" intensity={0} distance={GRID_SIZE * 1.45} decay={2} position={[0, GRID_SIZE * 0.14, 0]} />
        </group>
    );
};

const DisruptImpactShard: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    shard: { angle: number; radius: number; rise: number; spin: number };
}> = ({ event, material, shard }) => {
    const shardRef = useRef<THREE.Mesh>(null);
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(() => sampleSpellVisualRange(seed, 195, 460, 620), [seed]);
    useFrame(() => {
        if (!shardRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
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
                event.kind === 'death' ? 0.65
                    : event.effect === 'fireball' ? 1.8
                        : event.effect === 'lightning' ? 1.55
                            : event.effect === 'poison_cloud' || event.effect === 'poison_bolt' ? 0.98 : 1.0;
            lightRef.current.intensity = Math.max(0, (1 - t) * baseIntensity * Math.max(1, visualScale * 0.85));
            lightRef.current.distance =
                (event.effect === 'fireball' ? GRID_SIZE * 1.7
                    : event.effect === 'lightning' ? GRID_SIZE * 1.45 : GRID_SIZE * 1.1) * Math.max(1, visualScale * 0.9);
        }
    });

    const lightColor =
        event.kind === 'death' ? '#c9a56c'
            : event.effect === 'fireball' ? '#ff8a3d'
                : event.effect === 'lightning' ? '#89dcff'
                    : event.effect === 'poison_cloud' || event.effect === 'poison_bolt' ? '#39cf86'
                        : '#aeefff';

    return (
        <group
            position={[
                event.x * GRID_SIZE + (event.offsetX ?? 0),
                event.height ?? (event.kind === 'death' ? GRID_SIZE * 0.14 : GRID_SIZE * 0.06),
                event.y * GRID_SIZE + (event.offsetZ ?? 0),
            ]}
        >
            <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} geometry={geometry} material={material} frustumCulled={false} />
            <pointLight ref={lightRef} color={lightColor} intensity={0} distance={GRID_SIZE * 1.4} decay={2} position={[0, GRID_SIZE * 0.18, 0]} />
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
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(() => sampleSpellVisualRange(seed, 201, 460, 580), [seed]);
    const shards = useMemo(
        () => {
            const count = sampleSpellVisualInt(seed, 202, 10, 14);
            return Array.from({ length: count }, (_, index) => {
                const angle = (index / count) * Math.PI * 2;
                const spread = sampleSpellVisualRange(seed, 203 + index, 0.14, 0.3);
                const rise = sampleSpellVisualRange(seed, 221 + index, 0.03, 0.11);
                return { x: Math.cos(angle) * spread, z: Math.sin(angle) * spread, rise };
            });
        },
        [seed],
    );
    const flames = useMemo(
        () => {
            const count = sampleSpellVisualInt(seed, 239, 6, 8);
            return Array.from({ length: count }, (_, index) => {
                const angle = (index / count) * Math.PI * 2;
                const spread = sampleSpellVisualRange(seed, 240 + index, 0.06, 0.14);
                const lift = sampleSpellVisualRange(seed, 252 + index, 0.14, 0.32);
                return { x: Math.cos(angle) * spread, z: Math.sin(angle) * spread, lift, rotation: angle };
            });
        },
        [seed],
    );

    useFrame(() => {
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
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
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeometry} material={material} frustumCulled={false} />
            <mesh ref={flashRef} material={coreMaterial} frustumCulled={false}>
                <sphereGeometry args={[0.18, 12, 12]} />
            </mesh>
            {flames.map((flame, index) => (
                <FireballImpactFlame key={`flame_${index}`} event={event} material={flameMaterial} offset={flame} />
            ))}
            {shards.map((shard, index) => (
                <FireballImpactShard key={index} event={event} material={material} offset={shard} />
            ))}
            <pointLight ref={lightRef} color="#ff9a43" intensity={0} distance={GRID_SIZE * 1.8} decay={2} position={[0, GRID_SIZE * 0.2, 0]} />
        </group>
    );
};

const FireballImpactFlame: React.FC<{
    event: SpellVisualEvent;
    material: THREE.MeshBasicMaterial;
    offset: { x: number; z: number; lift: number; rotation: number };
}> = ({ event, material, offset }) => {
    const flameRef = useRef<THREE.Mesh>(null);
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(() => sampleSpellVisualRange(seed, 271, 460, 580), [seed]);
    useFrame(() => {
        if (!flameRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
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
    const seed = useMemo(() => hashSpellVisualSeed(event.id), [event.id]);
    const duration = useMemo(() => sampleSpellVisualRange(seed, 281, 460, 580), [seed]);
    useFrame(() => {
        if (!shardRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / duration));
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
        () => Array.from({ length: 14 }, (_, index) => {
            const angle = (index / 14) * Math.PI * 2;
            const radius = 0.1 + (index % 4) * 0.05;
            const rise = 0.11 + (index % 3) * 0.045;
            return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, rise };
        }),
        [],
    );

    useFrame(() => {
        if (!groupRef.current) return;
        const age = Date.now() - event.ts;
        const t = Math.max(0, Math.min(1, age / DAMAGE_EVENT_LIFETIME_MS));
        groupRef.current.children.forEach((child, index) => {
            const particle = child as THREE.Mesh;
            const cfg = seed[index];
            particle.position.x = cfg.x * (0.45 + t * 1.45);
            particle.position.z = cfg.z * (0.45 + t * 1.45);
            particle.position.y = cfg.rise * Math.sin(Math.PI * t) - t * 0.04;
            particle.scale.setScalar((1 - t) * (0.72 + (index % 3) * 0.22));
            (particle.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.55;
            particle.visible = t < 1;
        });
    });

    return (
        <group ref={groupRef} position={[event.x * GRID_SIZE, GRID_SIZE * 0.08, event.y * GRID_SIZE]}>
            {seed.map((_, index) => (
                <mesh key={index} material={material} frustumCulled={false}>
                    <sphereGeometry args={[0.1, 6, 6]} />
                </mesh>
            ))}
        </group>
    );
};
