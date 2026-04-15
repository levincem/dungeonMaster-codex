import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Billboard, Plane } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { GRID_SIZE } from '../../engine/constants';
import type { FloorItem } from '../../types/game';
import { getFloorItemImage } from '../../data/itemImages';

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

const ItemSprite = ({
    imagePath,
    onClick,
    onStartDrag,
    onUpdateDrag,
    onEndDrag,
}: {
    imagePath: string;
    onClick: () => void;
    onStartDrag: (pointerX: number, pointerY: number) => void;
    onUpdateDrag: (pointerX: number, pointerY: number) => void;
    onEndDrag: (pointerX: number, pointerY: number) => void;
}) => {
    const baseTex = useTexture(imagePath);
    const timerRef = useRef<number | null>(null);
    const draggingRef = useRef(false);
    const tex = useMemo(() => {
        const next = baseTex.clone();
        next.colorSpace = THREE.SRGBColorSpace;
        next.needsUpdate = true;
        return next;
    }, [baseTex]);
    useEffect(() => () => tex.dispose(), [tex]);

    const image = tex.image as { width: number; height: number } | undefined;
    const aspect = image ? (image.width / image.height) : 1;
    const w = ITEM_SIZE;
    const h = ITEM_SIZE / aspect;

    useEffect(() => () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    }, []);

    const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        const startX = event.nativeEvent.clientX;
        const startY = event.nativeEvent.clientY;
        let currentX = startX;
        let currentY = startY;
        draggingRef.current = false;
        timerRef.current = window.setTimeout(() => {
            draggingRef.current = true;
            onStartDrag(startX, startY);
        }, 170);

        const handleMove = (moveEvent: PointerEvent) => {
            currentX = moveEvent.clientX;
            currentY = moveEvent.clientY;
            if (!draggingRef.current) return;
            onUpdateDrag(moveEvent.clientX, moveEvent.clientY);
        };

        const handleUp = () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            if (draggingRef.current) {
                draggingRef.current = false;
                window.requestAnimationFrame(() => onEndDrag(currentX, currentY));
            } else {
                onClick();
            }
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
    };

    return (
        <Plane
            args={[w, h]}
            onPointerDown={handlePointerDown}
        >
            <meshBasicMaterial
                map={tex}
                transparent
                alphaTest={0.05}
                side={THREE.DoubleSide}
                depthWrite
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
    onStartDrag: (item: FloorItem, imagePath: string, pointerX: number, pointerY: number) => void;
    onUpdateDrag: (pointerX: number, pointerY: number) => void;
    onEndDrag: (pointerX: number, pointerY: number) => void;
}

export const FloorItemMesh = ({ item, onPickup, onStartDrag, onUpdateDrag, onEndDrag }: Props) => {
    const offset = TILEPOS_OFFSET[item.tilePos] ?? [0, 0];
    const worldPos: [number, number, number] = [
        item.x * GRID_SIZE + offset[0],
        ITEM_Y,
        item.y * GRID_SIZE + offset[1],
    ];

    const imagePath = getFloorItemImage(item);

    return (
        <Billboard
            position={worldPos}
            follow={true}
            lockX={true}
            lockY={false}
            lockZ={true}
        >
            <Suspense fallback={<ItemFallback category={item.category} />}>
                <ItemSprite
                    imagePath={imagePath}
                    onClick={onPickup}
                    onStartDrag={(pointerX, pointerY) => onStartDrag(item, imagePath, pointerX, pointerY)}
                    onUpdateDrag={onUpdateDrag}
                    onEndDrag={onEndDrag}
                />
            </Suspense>
        </Billboard>
    );
};
