import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import type { FloorItem, CardinalDir } from '../../types/game';
import { getFloorItemImage } from '../../data/itemImages';
import { useStore } from '../../engine/store';
import { useLoadedTexture } from './useLoadedTexture';
import { getWallMountedItemPresentation } from './wallMountedItemPresentation';

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

const WallItemSprite = ({
    imagePath,
    onClick,
    scale = 1,
    positionY = 0,
}: {
    imagePath: string;
    onClick: () => void;
    scale?: number;
    positionY?: number;
}) => {
    const baseTex = useLoadedTexture(imagePath);
    const tex = useMemo(() => {
        const next = baseTex.clone();
        next.colorSpace = THREE.SRGBColorSpace;
        next.needsUpdate = true;
        return next;
    }, [baseTex]);
    useEffect(() => () => tex.dispose(), [tex]);

    const image = tex.image as { width: number; height: number } | undefined;
    const aspect = image ? image.width / image.height : 1;
    const width = (aspect >= 1 ? ITEM_MAX_W : ITEM_MAX_H * aspect) * scale;
    const height = (aspect >= 1 ? ITEM_MAX_W / aspect : ITEM_MAX_H) * scale;

    return (
        <mesh
            onClick={(event) => { event.stopPropagation(); onClick(); }}
            frustumCulled={false}
            renderOrder={16}
            position={[0, positionY, 0]}
        >
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
                map={tex}
                transparent
                alphaTest={0.05}
                side={THREE.DoubleSide}
                depthWrite={false}
                depthTest={true}
                polygonOffset
                polygonOffsetFactor={-6}
                polygonOffsetUnits={-6}
                toneMapped={false}
            />
        </mesh>
    );
};

export const WallMountedItemMesh = ({ item, onPickup }: { item: FloorItem; onPickup: () => void }) => {
    const level = useStore(s => s.level);
    const [ox, oy, oz] = FACE_POS[item.tilePos];
    const [rx, ry, rz] = FACE_ROT[item.tilePos];
    const presentation = useMemo(
        () => getWallMountedItemPresentation(level, item),
        [item, level],
    );
    const imagePath = presentation.spriteImagePath ?? getFloorItemImage(item);

    return (
        <group
            position={[item.x * GRID_SIZE + ox, oy, item.y * GRID_SIZE + oz]}
            rotation={[rx, ry, rz]}
        >
            <mesh
                onClick={(event) => { event.stopPropagation(); onPickup(); }}
                frustumCulled={false}
                renderOrder={15}
            >
                <planeGeometry args={[presentation.pickupPlaneWidth, presentation.pickupPlaneHeight]} />
                <meshBasicMaterial
                    transparent
                    opacity={0}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>
            <Suspense fallback={null}>
                {presentation.renderSprite ? (
                    <WallItemSprite
                        imagePath={imagePath}
                        onClick={onPickup}
                        scale={presentation.spriteScale}
                        positionY={presentation.spriteOffsetY}
                    />
                ) : null}
            </Suspense>
        </group>
    );
};
