import { Suspense, useEffect, useMemo } from 'react';
import { Plane, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import type { FloorItem, CardinalDir } from '../../types/game';
import { getFloorItemImage } from '../../data/itemImages';

const FACE_OFFSET = GRID_SIZE / 2 + 0.04;
const FACE_POS: Record<CardinalDir, [number, number, number]> = {
    North: [0, -WALL_HEIGHT * 0.02, -FACE_OFFSET],
    South: [0, -WALL_HEIGHT * 0.02, FACE_OFFSET],
    East: [FACE_OFFSET, -WALL_HEIGHT * 0.02, 0],
    West: [-FACE_OFFSET, -WALL_HEIGHT * 0.02, 0],
};

const FACE_ROT: Record<CardinalDir, [number, number, number]> = {
    North: [0, 0, 0],
    South: [0, Math.PI, 0],
    East: [0, -Math.PI / 2, 0],
    West: [0, Math.PI / 2, 0],
};

const ITEM_MAX_W = GRID_SIZE * 0.42;
const ITEM_MAX_H = WALL_HEIGHT * 0.42;

const WallItemSprite = ({ imagePath, onClick }: { imagePath: string; onClick: () => void }) => {
    const baseTex = useTexture(imagePath);
    const tex = useMemo(() => {
        const next = baseTex.clone();
        next.colorSpace = THREE.SRGBColorSpace;
        next.needsUpdate = true;
        return next;
    }, [baseTex]);
    useEffect(() => () => tex.dispose(), [tex]);

    const image = tex.image as { width: number; height: number } | undefined;
    const aspect = image ? image.width / image.height : 1;
    const width = aspect >= 1 ? ITEM_MAX_W : ITEM_MAX_H * aspect;
    const height = aspect >= 1 ? ITEM_MAX_W / aspect : ITEM_MAX_H;

    return (
        <Plane args={[width, height]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
            <meshBasicMaterial
                map={tex}
                transparent
                alphaTest={0.05}
                side={THREE.DoubleSide}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-4}
                polygonOffsetUnits={-4}
            />
        </Plane>
    );
};

export const WallMountedItemMesh = ({ item, onPickup }: { item: FloorItem; onPickup: () => void }) => {
    const [ox, oy, oz] = FACE_POS[item.tilePos];
    const [rx, ry, rz] = FACE_ROT[item.tilePos];
    const imagePath = getFloorItemImage(item);

    return (
        <group
            position={[item.x * GRID_SIZE + ox, oy, item.y * GRID_SIZE + oz]}
            rotation={[rx, ry, rz]}
        >
            <Suspense fallback={null}>
                <WallItemSprite imagePath={imagePath} onClick={onPickup} />
            </Suspense>
        </group>
    );
};
