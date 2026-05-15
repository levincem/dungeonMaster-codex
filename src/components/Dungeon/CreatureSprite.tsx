import { Suspense, useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import { useStore, onCreatureAction } from '../../engine/store';
import type { CreatureInstance } from '../../types/game';
import { spritesPath } from '../../data/assetPaths';
import { getCreatureCellOffsetXZ } from './creatureCellOffsets';
import { BillboardGroup } from './renderHelpers';
import { useLoadedTexture } from './useLoadedTexture';

// Default sprite size
const DEFAULT_W = GRID_SIZE   * 0.56;
const DEFAULT_H = WALL_HEIGHT * 0.54;

// Per-typeId world size overrides  (w, h)
const SPRITE_SIZES: Record<number, [number, number]> = {
    23: [DEFAULT_W * 1.1, DEFAULT_H * 1.06],
    25: [DEFAULT_W * 1.18, DEFAULT_H * 1.08],
    26: [DEFAULT_W * 1.18, DEFAULT_H * 1.08],
};

// Creatures with only 1 frame (LordOrder, GreyLord)
const SINGLE_FRAME_IDS = new Set([25, 26]);

// How long (seconds) to show the move/attack frame before returning to frame 0
const MOVE_FRAME_SEC   = 0.35;
const ATTACK_FRAME_SEC = 0.55;

function getSpriteSize(typeId: number): [number, number] {
    return SPRITE_SIZES[typeId] ?? [DEFAULT_W, DEFAULT_H];
}

// ─── Inner component (inside Suspense, owns the texture) ─────────────────────

interface SpriteInnerProps {
    typeId: number;
    frameRef: React.MutableRefObject<number>;
    frameTimerRef: React.MutableRefObject<number>;
}

const SpriteInner = ({ typeId, frameRef, frameTimerRef }: SpriteInnerProps) => {
    const baseTex = useLoadedTexture(spritesPath(`creatures/creature_${typeId}.png`));

    const single = SINGLE_FRAME_IDS.has(typeId);
    const nFrames = single ? 1 : 3;
    const frameW  = 1 / nFrames;

    // Clone so we don't mutate the shared cached texture
    const animTex = useMemo(() => {
        const next = baseTex.clone();
        next.colorSpace = THREE.SRGBColorSpace;
        next.repeat.set(frameW, 1);
        next.offset.setX(0);
        next.needsUpdate = true;
        return next;
    }, [baseTex, frameW]);

    useEffect(() => () => animTex.dispose(), [animTex]);

    useFrame((_, delta) => {
        if (single) return;
        if (frameTimerRef.current > 0) {
            frameTimerRef.current = Math.max(0, frameTimerRef.current - delta);
            if (frameTimerRef.current === 0) frameRef.current = 0;
        }
        animTex.offset.setX(frameRef.current * frameW);
    });

    const [w, h] = getSpriteSize(typeId);
    const floorY  = -GRID_SIZE / 2;
    const spriteY = floorY + h / 2;
    const offsetY = spriteY - (floorY + DEFAULT_H / 2);

    return (
        <mesh position={[0, offsetY, 0]}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial
                map={animTex}
                transparent
                alphaTest={0.05}
                side={THREE.DoubleSide}
                depthWrite
                depthTest
            />
        </mesh>
    );
};

// ─── Public component ──────────────────────────────────────────────────────────

export const CreatureSprite = ({ creature }: { creature: CreatureInstance }) => {
    const { x, y, typeId, cell, id } = creature;
    const direction = useStore(s => s.direction);

    // Frame 0 = idle, 1 = move, 2 = attack
    const frameRef      = useRef(0);
    const frameTimerRef = useRef(0);

    useEffect(() => {
        const unsub = onCreatureAction((cid, action) => {
            if (cid !== id) return;
            frameRef.current      = action === 'move' ? 1 : 2;
            frameTimerRef.current = action === 'move' ? MOVE_FRAME_SEC : ATTACK_FRAME_SEC;
        });
        return () => { unsub(); };
    }, [id]);

    const billboardY = -GRID_SIZE / 2 + DEFAULT_H / 2 - 0.11;
    const [offX, offZ] = getCreatureCellOffsetXZ(direction, cell);

    return (
        <BillboardGroup
            position={[x * GRID_SIZE + offX, billboardY, y * GRID_SIZE + offZ]}
            follow={true}
            lockX={true}
            lockY={false}
            lockZ={true}
        >
            <Suspense fallback={null}>
                <SpriteInner
                    typeId={typeId}
                    frameRef={frameRef}
                    frameTimerRef={frameTimerRef}
                />
            </Suspense>
        </BillboardGroup>
    );
};
