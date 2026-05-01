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
    groupRef: externalGroupRef,
}: {
    children: ReactNode;
    follow?: boolean;
    lockX?: boolean;
    lockY?: boolean;
    lockZ?: boolean;
    position?: [number, number, number];
    groupRef?: React.RefObject<THREE.Group | null>;
}) {
    const internalGroupRef = useRef<THREE.Group>(null);
    const groupRef = externalGroupRef ?? internalGroupRef;
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

export function CameraAnchoredGroup({
    children,
    forward,
    vertical = 0,
    lateral = 0,
    follow = true,
    groupRef: externalGroupRef,
}: {
    children: ReactNode;
    forward: number;
    vertical?: number;
    lateral?: number;
    follow?: boolean;
    groupRef?: React.RefObject<THREE.Group | null>;
}) {
    const internalGroupRef = useRef<THREE.Group>(null);
    const groupRef = externalGroupRef ?? internalGroupRef;
    const { camera } = useThree();
    const forwardVectorRef = useRef(new THREE.Vector3());
    const rightVectorRef = useRef(new THREE.Vector3());
    const upVectorRef = useRef(new THREE.Vector3());
    const worldPositionRef = useRef(new THREE.Vector3());

    useFrame(() => {
        if (!groupRef.current) return;

        camera.getWorldDirection(forwardVectorRef.current);
        rightVectorRef.current.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
        upVectorRef.current.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

        worldPositionRef.current.copy(camera.position)
            .addScaledVector(forwardVectorRef.current, forward)
            .addScaledVector(rightVectorRef.current, lateral)
            .addScaledVector(upVectorRef.current, vertical);

        groupRef.current.position.copy(worldPositionRef.current);

        if (follow) {
            groupRef.current.quaternion.copy(camera.quaternion);
        }
    });

    return (
        <group ref={groupRef}>
            {children}
        </group>
    );
}
