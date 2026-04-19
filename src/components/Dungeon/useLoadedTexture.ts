import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';

export function useLoadedTexture(url: string): THREE.Texture {
    return useLoader(THREE.TextureLoader, url);
}
