import { useFrame, useLoader, useThree } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export function useLoadedTexture(url: string): THREE.Texture {
    return useLoader(THREE.TextureLoader, url);
}

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
    const rotation = useMemo(() => new THREE.Euler(), []);

    useFrame(() => {
        if (!follow || !groupRef.current) return;

        groupRef.current.quaternion.copy(camera.quaternion);
        rotation.setFromQuaternion(groupRef.current.quaternion, 'YXZ');
        if (lockX) rotation.x = 0;
        if (lockY) rotation.y = 0;
        if (lockZ) rotation.z = 0;
        groupRef.current.rotation.copy(rotation);
    });

    return (
        <group ref={groupRef} position={position}>
            {children}
        </group>
    );
}
