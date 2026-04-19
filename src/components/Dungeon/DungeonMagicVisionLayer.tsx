import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../engine/store';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import type { CardinalDir } from '../../types/game';
import { useTemporalFlag } from './useWallClock';

function createPulseMaterial(color: string, opacity: number) {
    return new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
    });
}

export const MagicVisionLayer: React.FC<{
    wallButtons: { tileX: number; tileY: number; face: CardinalDir }[];
    pressurePlates: { tileX: number; tileY: number }[];
    trickWalls: { tileX: number; tileY: number }[];
    pits: { tileX: number; tileY: number }[];
}> = ({ wallButtons, pressurePlates, trickWalls, pits }) => {
    const magicVisionUntil = useStore((s) => s.magicVisionUntil);
    const visible = useTemporalFlag(magicVisionUntil, 120);
    const half = GRID_SIZE / 2;
    const buttonGeometry = useMemo(() => new THREE.SphereGeometry(0.22, 10, 10), []);
    const plateGeometry = useMemo(() => new THREE.RingGeometry(GRID_SIZE * 0.18, GRID_SIZE * 0.38, 24), []);
    const buttonMaterial = useMemo(() => createPulseMaterial('#ff3f2f', 0.55), []);
    const plateMaterial = useMemo(() => createPulseMaterial('#ff5544', 0.34), []);
    const trickWallMaterial = useMemo(() => createPulseMaterial('#ffd166', 0.28), []);
    const pitMaterial = useMemo(() => createPulseMaterial('#62e0ff', 0.3), []);

    useEffect(() => () => {
        buttonGeometry.dispose();
        plateGeometry.dispose();
        buttonMaterial.dispose();
        plateMaterial.dispose();
        trickWallMaterial.dispose();
        pitMaterial.dispose();
    }, [buttonGeometry, plateGeometry, buttonMaterial, plateMaterial, trickWallMaterial, pitMaterial]);

    const faceOffset: Record<CardinalDir, [number, number]> = {
        North: [0, -half],
        South: [0, half],
        East: [half, 0],
        West: [-half, 0],
    };

    return (
        <group visible={visible}>
            {wallButtons.map(({ tileX, tileY, face }) => {
                const [ox, oz] = faceOffset[face];
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
                <MagicVisionPlate
                    key={`mv_plate_${tileX}_${tileY}`}
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

    return <mesh ref={meshRef} position={position} geometry={geometry} material={material} frustumCulled={false} />;
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
