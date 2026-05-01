import { useEffect, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';

const sharedTextureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();
const texturePromiseCache = new Map<string, Promise<void>>();

function prepareTexture(texture: THREE.Texture): THREE.Texture {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

export function getCachedTexture(url: string): THREE.Texture | null {
    return textureCache.get(url) ?? null;
}

export function preloadTexture(url: string): Promise<void> {
    if (textureCache.has(url)) return Promise.resolve();

    const cachedPromise = texturePromiseCache.get(url);
    if (cachedPromise) return cachedPromise;

    const promise = new Promise<void>((resolve) => {
        sharedTextureLoader.load(
            url,
            (texture) => {
                textureCache.set(url, prepareTexture(texture));
                resolve();
            },
            undefined,
            () => resolve(),
        );
    });

    texturePromiseCache.set(url, promise);
    return promise;
}

export function useLoadedTexture(url: string): THREE.Texture {
    return useLoader(THREE.TextureLoader, url);
}

export function useSafeTexture(url: string, fallbackUrl?: string): THREE.Texture | null {
    const initialTexture = getCachedTexture(url);
    const [textureEntry, setTextureEntry] = useState<{ source: string; texture: THREE.Texture | null }>({
        source: initialTexture ? url : '',
        texture: initialTexture,
    });

    useEffect(() => {
        let disposed = false;
        const directCachedTexture = getCachedTexture(url);
        if (directCachedTexture) {
            setTextureEntry({ source: url, texture: directCachedTexture });
            return () => {
                disposed = true;
            };
        }

        const finalizeTexture = (next: THREE.Texture) => {
            const prepared = prepareTexture(next);
            if (disposed) {
                prepared.dispose();
                return;
            }
            textureCache.set(url, prepared);
            setTextureEntry({ source: url, texture: prepared });
        };

        const load = (source: string, fallback?: string) => {
            sharedTextureLoader.load(
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
        };
    }, [fallbackUrl, url]);

    return textureEntry.source === url ? textureEntry.texture : null;
}
