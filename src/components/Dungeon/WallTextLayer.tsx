import React, { memo, useEffect, useMemo } from 'react';
import type {} from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../engine/store';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import type { CardinalDir, GameMap, WallTextObject } from '../../types/game';
import { resolveWallTextFace } from './wallTextHelpers';
import { useWallTransparencyState } from './wallTransparency';

const CHAMPION_DATA_RE = /\n{2,}[MF]\n[A-Z]/;

const FACE_POS_TEXT: Record<CardinalDir, [number, number, number]> = {
    North: [0, 0, -(GRID_SIZE / 2 + 0.035)],
    South: [0, 0, (GRID_SIZE / 2 + 0.035)],
    East: [(GRID_SIZE / 2 + 0.035), 0, 0],
    West: [-(GRID_SIZE / 2 + 0.035), 0, 0],
};

const FACE_ROT_TEXT: Record<CardinalDir, [number, number, number]> = {
    North: [0, Math.PI, 0],
    South: [0, 0, 0],
    East: [0, Math.PI / 2, 0],
    West: [0, -Math.PI / 2, 0],
};

function makeEngravedTexture(text: string): THREE.CanvasTexture {
    const W = 512;
    const H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    const lines = text.split('\n').filter((line) => line.trim() !== '');
    const fontSize = Math.max(28, Math.min(48, Math.floor(H * 0.12 / Math.max(lines.length, 1) * 1.4)));
    ctx.font = `bold ${fontSize}px "Courier New", Courier, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lineH = fontSize * 1.35;
    const totalH = lines.length * lineH;
    const startY = H / 2 - totalH / 2 + lineH / 2;

    lines.forEach((line, index) => {
        const y = startY + index * lineH;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(line, W / 2 + 2, y + 2);
        ctx.fillStyle = 'rgba(255,220,120,0.25)';
        ctx.fillText(line, W / 2 - 1, y - 1);
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = Math.max(1.25, fontSize * 0.055);
        ctx.strokeStyle = 'rgba(0,0,0,0.42)';
        ctx.strokeText(line, W / 2, y);
        ctx.fillStyle = '#c8a040';
        ctx.fillText(line, W / 2, y);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

const WallTextEntry: React.FC<{ tileX: number; tileY: number; face: CardinalDir; text: string }> = ({ tileX, tileY, face, text }) => {
    const { wallOpacity } = useWallTransparencyState();
    const tex = useMemo(() => makeEngravedTexture(text), [text]);
    useEffect(() => () => tex.dispose(), [tex]);
    const [ox, , oz] = FACE_POS_TEXT[face];
    const [rx, ry, rz] = FACE_ROT_TEXT[face];
    return (
        <mesh
            position={[tileX * GRID_SIZE + ox, 0, tileY * GRID_SIZE + oz]}
            rotation={[rx, ry, rz]}
            frustumCulled={false}
            renderOrder={6}
        >
            <planeGeometry args={[GRID_SIZE * 0.78, WALL_HEIGHT * 0.55]} />
            <meshBasicMaterial
                map={tex}
                transparent
                opacity={wallOpacity}
                alphaTest={0.08}
                depthWrite={false}
                depthTest
                polygonOffset
                polygonOffsetFactor={-4}
                polygonOffsetUnits={-4}
                side={THREE.DoubleSide}
                toneMapped={false}
            />
        </mesh>
    );
};

export const WallTextPlanes: React.FC<{ map: GameMap }> = memo(({ map }) => {
    const level = useStore((state) => state.level);
    const visibleTexts = useStore((state) => state.visibleTexts);
    const entries = useMemo(() => {
        const result: { tileX: number; tileY: number; face: CardinalDir; text: string }[] = [];
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Text') continue;
                    const textObject = obj as WallTextObject;
                    if (!textObject.text || CHAMPION_DATA_RE.test(textObject.text)) continue;
                    const visibilityKey = `${level}_${tile.x}_${tile.y}_${textObject.index}`;
                    if (!visibleTexts.has(visibilityKey)) continue;
                    result.push({
                        tileX: tile.x,
                        tileY: tile.y,
                        face: resolveWallTextFace(map, tile, textObject.tilePos as CardinalDir, textObject.text),
                        text: textObject.text,
                    });
                }
            }
        }
        return result;
    }, [level, map, visibleTexts]);

    return (
        <>
            {entries.map(({ tileX, tileY, face, text }, index) => (
                <WallTextEntry key={index} tileX={tileX} tileY={tileY} face={face} text={text} />
            ))}
        </>
    );
});
