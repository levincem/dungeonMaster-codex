import React, { memo, useMemo } from 'react';
import type {} from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, isSelfRevealingWallTile } from '../../engine/store';
import { doorBlocksVision } from '../../data/doors';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import type { CardinalDir, DoorObject, GameMap, GameTile, WallTextObject } from '../../types/game';

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

const WALL_TEXT_FACE_VECTORS: Record<CardinalDir, { dx: number; dy: number }> = {
    North: { dx: 0, dy: -1 },
    South: { dx: 0, dy: 1 },
    East: { dx: 1, dy: 0 },
    West: { dx: -1, dy: 0 },
};

const LEFT_FACE_BY_FACE: Record<CardinalDir, CardinalDir> = {
    North: 'West',
    South: 'East',
    East: 'North',
    West: 'South',
};

const RIGHT_FACE_BY_FACE: Record<CardinalDir, CardinalDir> = {
    North: 'East',
    South: 'West',
    East: 'South',
    West: 'North',
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
    return texture;
}

const WallTextEntry: React.FC<{ tileX: number; tileY: number; face: CardinalDir; text: string }> = ({ tileX, tileY, face, text }) => {
    const tex = useMemo(() => makeEngravedTexture(text), [text]);
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

function isWallTextAnchorTile(tile: GameTile | undefined): boolean {
    return tile?.type === 'Wall' || tile?.type === 'TrickWall' || tile?.type === 'Door';
}

function blocksWallFaceSight(
    tile: GameTile | undefined,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
): boolean {
    if (!tile) return true;
    if (tile.type === 'Wall') {
        const selfRevealingOpen = isSelfRevealingWallTile(level, tile.x, tile.y) &&
            openWalls.has(`${level},${tile.y},${tile.x}`);
        return !selfRevealingOpen;
    }
    if (tile.type === 'TrickWall') {
        return !openWalls.has(`${level},${tile.y},${tile.x}`);
    }
    if (tile.type === 'Door') {
        if (openDoors.has(`${level},${tile.y},${tile.x}`)) return false;
        const door = tile.objects.find((obj): obj is DoorObject => obj.category === 'Door');
        return doorBlocksVision(door?.doorType);
    }
    return false;
}

export function isDoorTileVisible(
    map: GameMap,
    level: number,
    openDoors: Set<string>,
    openWalls: Set<string>,
    partyX: number,
    partyY: number,
    tileX: number,
    tileY: number,
): boolean {
    const dx = tileX - partyX;
    const dy = tileY - partyY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return true;
    for (let i = 1; i < steps; i++) {
        const x = Math.round(partyX + (dx * i) / steps);
        const y = Math.round(partyY + (dy * i) / steps);
        if (blocksWallFaceSight(map.tiles[y]?.[x], level, openDoors, openWalls)) {
            return false;
        }
    }
    const target = map.tiles[tileY]?.[tileX];
    if (!target) return false;
    if (target.type === 'Wall') return false;
    if (target.type === 'TrickWall') return openWalls.has(`${level},${tileY},${tileX}`);
    return true;
}

export function resolveWallTextFace(map: GameMap, tile: GameTile, face: CardinalDir, text: string): CardinalDir {
    if (text === 'WELCOME\nBRAVE\nADVENTURERS.') {
        return 'West';
    }

    if (isWallTextAnchorTile(tile)) {
        return face;
    }

    const forward = WALL_TEXT_FACE_VECTORS[face];
    const forwardTile = map.tiles[tile.y + forward.dy]?.[tile.x + forward.dx];
    if (isWallTextAnchorTile(forwardTile)) {
        return face;
    }

    const leftFace = LEFT_FACE_BY_FACE[face];
    const leftStep = WALL_TEXT_FACE_VECTORS[leftFace];
    const leftTile = map.tiles[tile.y + leftStep.dy]?.[tile.x + leftStep.dx];
    if (isWallTextAnchorTile(leftTile)) {
        return leftFace;
    }

    const rightFace = RIGHT_FACE_BY_FACE[face];
    const rightStep = WALL_TEXT_FACE_VECTORS[rightFace];
    const rightTile = map.tiles[tile.y + rightStep.dy]?.[tile.x + rightStep.dx];
    if (isWallTextAnchorTile(rightTile)) {
        return rightFace;
    }

    return face;
}

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
