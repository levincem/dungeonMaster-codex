import * as THREE from 'three';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import type { CardinalDir } from '../../types/game';
import { useWallTransparencyState } from './wallTransparency';

interface Props {
    tileX: number;
    tileY: number;
    face: CardinalDir;
    onClick: () => void;
}

const HALF = GRID_SIZE / 2;
const FACE_OFFSET = HALF + 0.03;

const FACE_POS: Record<CardinalDir, [number, number, number]> = {
    North: [0, 0, -FACE_OFFSET],
    South: [0, 0, FACE_OFFSET],
    East: [FACE_OFFSET, 0, 0],
    West: [-FACE_OFFSET, 0, 0],
};
const FACE_ROT: Record<CardinalDir, [number, number, number]> = {
    North: [0, 0, 0],
    South: [0, Math.PI, 0],
    East: [0, -Math.PI / 2, 0],
    West: [0, Math.PI / 2, 0],
};

export const WallSensor = ({ tileX, tileY, face, onClick }: Props) => {
    const { wallTransparent, wallOpacity } = useWallTransparencyState();
    const worldX = tileX * GRID_SIZE;
    const worldZ = tileY * GRID_SIZE;
    const [ox, , oz] = FACE_POS[face];
    const [rx, ry, rz] = FACE_ROT[face];

    const btnSize = GRID_SIZE * 0.16;
    const depth = GRID_SIZE * 0.045;
    const hitWidth = btnSize * 1.9;
    const hitHeight = btnSize * 1.5;

    return (
        <group
            position={[worldX + ox, 0, worldZ + oz]}
            rotation={[rx, ry, rz]}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
        >
            <mesh position={[0, -WALL_HEIGHT * 0.05, depth / 2 + 0.002]}>
                <planeGeometry args={[hitWidth, hitHeight]} />
                <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, -WALL_HEIGHT * 0.05, depth / 2]}>
                <boxGeometry args={[btnSize, btnSize * 0.6, depth]} />
                <meshStandardMaterial
                    color="#6a5a3a"
                    roughness={0.6}
                    metalness={0.4}
                    transparent={wallTransparent}
                    opacity={wallOpacity}
                    depthWrite={!wallTransparent}
                />
            </mesh>
            <mesh position={[0, -WALL_HEIGHT * 0.05, depth / 2 + 0.001]}>
                <planeGeometry args={[btnSize * 0.82, btnSize * 0.5]} />
                <meshBasicMaterial
                    color="#c8a96e"
                    transparent
                    opacity={0.35 * wallOpacity}
                    side={THREE.FrontSide}
                    depthWrite={!wallTransparent}
                />
            </mesh>
        </group>
    );
};
