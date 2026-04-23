import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Direction } from '../../engine/runtimeTypes';
import type { FloorItem } from '../../types/game';
import { getFloorItemImage } from '../../data/itemImages';
import { BillboardGroup } from './renderHelpers';
import { useLoadedTexture } from './useLoadedTexture';
import { FLOOR_ITEM_SIZE, resolveFloorItemPresentation } from './floorItemPresentation';

// ─── Layout ───────────────────────────────────────────────────────────────────


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
    const baseTex = useLoadedTexture(imagePath);
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
    const w = FLOOR_ITEM_SIZE;
    const h = FLOOR_ITEM_SIZE / aspect;

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
        <mesh onPointerDown={handlePointerDown} renderOrder={5}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial
                map={tex}
                transparent
                alphaTest={0.05}
                side={THREE.DoubleSide}
                depthWrite
            />
        </mesh>
    );
};

// ─── Fallback while texture loads ─────────────────────────────────────────────

const ItemFallback = ({ category }: { category: string }) => {
    const colors: Record<string, string> = {
        Weapon: '#b0b8c8', Armor: '#8B6914', Potion: '#e74c3c',
        Scroll: '#f0e8c8', Container: '#5C3A1E', Misc: '#d4af37',
    };
    return (
        <mesh>
            <planeGeometry args={[FLOOR_ITEM_SIZE * 0.7, FLOOR_ITEM_SIZE * 0.7]} />
            <meshBasicMaterial color={colors[category] ?? '#d4af37'} side={THREE.DoubleSide} />
        </mesh>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    item: FloorItem;
    onPickup: () => void;
    onStartDrag: (item: FloorItem, imagePath: string, pointerX: number, pointerY: number) => void;
    onUpdateDrag: (pointerX: number, pointerY: number) => void;
    onEndDrag: (pointerX: number, pointerY: number) => void;
    direction: Direction;
    occupiedByCreature: boolean;
}

export const FloorItemMesh = ({ item, onPickup, onStartDrag, onUpdateDrag, onEndDrag, direction, occupiedByCreature }: Props) => {
    const imagePath = getFloorItemImage(item);
    const presentation = resolveFloorItemPresentation(item, direction, occupiedByCreature);

    return (
        <BillboardGroup
            position={presentation.position}
            follow={true}
            lockX={true}
            lockY={false}
            lockZ={true}
        >
            <group scale={[presentation.scale, presentation.scale, 1]}>
                <Suspense fallback={<ItemFallback category={item.category} />}>
                    <ItemSprite
                        imagePath={imagePath}
                        onClick={onPickup}
                        onStartDrag={(pointerX, pointerY) => onStartDrag(item, imagePath, pointerX, pointerY)}
                        onUpdateDrag={onUpdateDrag}
                        onEndDrag={onEndDrag}
                    />
                </Suspense>
            </group>
        </BillboardGroup>
    );
};
