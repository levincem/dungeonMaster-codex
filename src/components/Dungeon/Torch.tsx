import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TorchProps {
    position: [number, number, number];
    rotation: [number, number, number];
}

export const Torch: React.FC<TorchProps> = ({ position, rotation }) => {
    const glowRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        if (glowRef.current) {
            glowRef.current.scale.setScalar(1 + Math.sin(time * 20) * 0.05);
            // Flicker the emissive intensity for visual flair without spreading light circles
            const material = glowRef.current.material as THREE.MeshStandardMaterial;
            material.emissiveIntensity = 3 + Math.sin(time * 20) * 1;
        }
    });

    return (
        <group position={position} rotation={rotation}>
            {/* Torch Bracket / Holder */}
            <mesh position={[0, 0, 0.05]}>
                <boxGeometry args={[0.05, 0.3, 0.05]} />
                <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Flame / Glow Effect (Visual only, no pointLight) */}
            <mesh ref={glowRef} position={[0, 0.15, 0.1]}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial
                    emissive="#ff6600"
                    emissiveIntensity={4}
                    color="#ffaa00"
                    transparent
                    opacity={0.8}
                />
            </mesh>
        </group>
    );
};
