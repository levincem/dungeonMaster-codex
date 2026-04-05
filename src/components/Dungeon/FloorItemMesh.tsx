import { Suspense } from 'react';
import { Billboard, Plane } from '@react-three/drei';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { GRID_SIZE } from '../../engine/constants';
import type { FloorItem } from '../../types/game';
import { getItemImage } from '../../data/itemImages';

// ─── Layout ───────────────────────────────────────────────────────────────────

// Item floats just above floor, centered vertically so it's clearly visible
const FLOOR_Y  = -GRID_SIZE / 2;
const ITEM_SIZE = GRID_SIZE * 0.38;   // square billboard
const ITEM_Y    = FLOOR_Y + ITEM_SIZE * 0.22; // resting near floor

const TILEPOS_OFFSET: Record<string, [number, number]> = {
    North: [ 0,    -0.30],
    South: [ 0,     0.30],
    East:  [ 0.30,  0   ],
    West:  [-0.30,  0   ],
};

// ─── Inner sprite (uses texture) ──────────────────────────────────────────────

const ItemSprite = ({ imagePath, onClick }: { imagePath: string; onClick: () => void }) => {
    const tex = useTexture(imagePath);
    tex.colorSpace = THREE.SRGBColorSpace;

    const image = tex.image as { width: number; height: number } | undefined;
    const aspect = image ? (image.width / image.height) : 1;
    const w = ITEM_SIZE;
    const h = ITEM_SIZE / aspect;

    return (
        <Plane
            args={[w, h]}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
            <meshBasicMaterial
                map={tex}
                transparent
                alphaTest={0.05}
                side={THREE.DoubleSide}
                depthWrite={false}
            />
        </Plane>
    );
};

// ─── Fallback while texture loads ─────────────────────────────────────────────

const ItemFallback = ({ category }: { category: string }) => {
    const colors: Record<string, string> = {
        Weapon: '#b0b8c8', Armor: '#8B6914', Potion: '#e74c3c',
        Scroll: '#f0e8c8', Container: '#5C3A1E', Misc: '#d4af37',
    };
    return (
        <Plane args={[ITEM_SIZE * 0.7, ITEM_SIZE * 0.7]}>
            <meshBasicMaterial color={colors[category] ?? '#d4af37'} side={THREE.DoubleSide} />
        </Plane>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    item: FloorItem;
    onPickup: () => void;
}

export const FloorItemMesh = ({ item, onPickup }: Props) => {
    const offset = TILEPOS_OFFSET[item.tilePos] ?? [0, 0];
    const worldPos: [number, number, number] = [
        item.x * GRID_SIZE + offset[0],
        ITEM_Y,
        item.y * GRID_SIZE + offset[1],
    ];

    const imagePath = getItemImage(item.category, item.typeId);

    return (
        <Billboard
            position={worldPos}
            follow={true}
            lockX={true}
            lockY={false}
            lockZ={true}
        >
            <Suspense fallback={<ItemFallback category={item.category} />}>
                <ItemSprite imagePath={imagePath} onClick={onPickup} />
            </Suspense>
        </Billboard>
    );
};
