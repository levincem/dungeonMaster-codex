import { useEffect, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';

export function useLoadedTexture(url: string): THREE.Texture {
    return useLoader(THREE.TextureLoader, url);
}

export function useSafeTexture(url: string, fallbackUrl?: string): THREE.Texture | null {
    const [textureEntry, setTextureEntry] = useState<{ source: string; texture: THREE.Texture | null }>({
        source: '',
        texture: null,
    });

    useEffect(() => {
        let disposed = false;
        let activeTexture: THREE.Texture | null = null;
        const loader = new THREE.TextureLoader();

        const finalizeTexture = (next: THREE.Texture) => {
            next.colorSpace = THREE.SRGBColorSpace;
            next.needsUpdate = true;
            if (disposed) {
                next.dispose();
                return;
            }
            activeTexture?.dispose();
            activeTexture = next;
            setTextureEntry({ source: url, texture: next });
        };

        const load = (source: string, fallback?: string) => {
            loader.load(
                source,
                loaded => finalizeTexture(loaded),
                undefined,
                () => {
                    if (fallback && fallback !== source) {
                        load(fallback);
                    } else if (!disposed) {
                        setTextureEntry({ source: url, texture: null });
                    }
                },
            );
        };

        load(url, fallbackUrl);

        return () => {
            disposed = true;
            activeTexture?.dispose();
        };
    }, [fallbackUrl, url]);

    return textureEntry.source === url ? textureEntry.texture : null;
}
