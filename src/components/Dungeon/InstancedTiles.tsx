import { useRef, useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import { MIRROR_WALL_MAP } from '../../engine/store';
import type { GameMap } from '../../types/game';

const HALF = GRID_SIZE / 2;

interface Props {
    map: GameMap;
}

export const InstancedTiles = ({ map }: Props) => {
    const { floor, ceiling, wall } = useTexture({
        floor:   '/textures/floor.png?v=2',
        ceiling: '/textures/ceiling.png?v=2',
        wall:    '/textures/wall.png?v=2',
    });
    [floor, ceiling, wall].forEach(t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(1, 1);
    });

    // Classify tiles once per map
    const { floorPositions, ceilPositions, wallPositions } = useMemo(() => {
        const floorPositions: [number, number][] = [];  // non-Wall → floor plane
        const ceilPositions:  [number, number][] = [];  // every tile → ceiling plane
        const wallPositions:  [number, number][] = [];  // Wall (non-Mirror) → box

        for (const row of map.tiles) {
            for (const tile of row) {
                const wx = tile.x * GRID_SIZE;
                const wz = tile.y * GRID_SIZE;
                ceilPositions.push([wx, wz]);
                if (tile.type !== 'Wall') {
                    floorPositions.push([wx, wz]);
                } else if (!MIRROR_WALL_MAP.has(`${map.index},${tile.x},${tile.y}`)) {
                    wallPositions.push([wx, wz]);
                }
            }
        }
        return { floorPositions, ceilPositions, wallPositions };
    }, [map]);

    const floorRef = useRef<THREE.InstancedMesh>(null);
    const ceilRef  = useRef<THREE.InstancedMesh>(null);
    const wallRef  = useRef<THREE.InstancedMesh>(null);

    useEffect(() => {
        const dummy = new THREE.Object3D();

        // Floor planes (horizontal, facing up)
        if (floorRef.current) {
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            floorPositions.forEach(([wx, wz], i) => {
                dummy.position.set(wx, -HALF, wz);
                dummy.updateMatrix();
                floorRef.current!.setMatrixAt(i, dummy.matrix);
            });
            floorRef.current.instanceMatrix.needsUpdate = true;
        }

        // Ceiling planes (horizontal, facing down)
        if (ceilRef.current) {
            dummy.rotation.set(Math.PI / 2, 0, 0);
            ceilPositions.forEach(([wx, wz], i) => {
                dummy.position.set(wx, HALF, wz);
                dummy.updateMatrix();
                ceilRef.current!.setMatrixAt(i, dummy.matrix);
            });
            ceilRef.current.instanceMatrix.needsUpdate = true;
        }

        // Wall boxes (axis-aligned, no rotation needed)
        if (wallRef.current) {
            dummy.rotation.set(0, 0, 0);
            wallPositions.forEach(([wx, wz], i) => {
                dummy.position.set(wx, 0, wz);
                dummy.updateMatrix();
                wallRef.current!.setMatrixAt(i, dummy.matrix);
            });
            wallRef.current.instanceMatrix.needsUpdate = true;
        }
    }, [floorPositions, ceilPositions, wallPositions]);

    return (
        <>
            <instancedMesh
                ref={floorRef}
                args={[undefined, undefined, floorPositions.length]}
                frustumCulled={false}
            >
                <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
                <meshBasicMaterial map={floor} />
            </instancedMesh>

            <instancedMesh
                ref={ceilRef}
                args={[undefined, undefined, ceilPositions.length]}
                frustumCulled={false}
            >
                <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
                <meshBasicMaterial map={ceiling} />
            </instancedMesh>

            <instancedMesh
                ref={wallRef}
                args={[undefined, undefined, wallPositions.length]}
                frustumCulled={false}
            >
                <boxGeometry args={[GRID_SIZE, WALL_HEIGHT, GRID_SIZE]} />
                <meshBasicMaterial map={wall} />
            </instancedMesh>
        </>
    );
};
