import { useFrame, useThree } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import * as THREE from 'three';

export function BillboardGroup({
    children,
    follow = true,
    lockX = false,
    lockY = false,
    lockZ = false,
    position,
}: {
    children: ReactNode;
    follow?: boolean;
    lockX?: boolean;
    lockY?: boolean;
    lockZ?: boolean;
    position?: [number, number, number];
}) {
    const groupRef = useRef<THREE.Group>(null);
    const { camera } = useThree();

    useFrame(() => {
        if (!follow || !groupRef.current) return;

        groupRef.current.quaternion.copy(camera.quaternion);
        const rotation = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion, 'YXZ');
        groupRef.current.rotation.set(
            lockX ? 0 : rotation.x,
            lockY ? 0 : rotation.y,
            lockZ ? 0 : rotation.z,
        );
    });

    return (
        <group ref={groupRef} position={position}>
            {children}
        </group>
    );
}
