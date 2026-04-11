import { useRef, useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import { MIRROR_WALL_MAP, useStore } from '../../engine/store';
import type { GameMap } from '../../types/game';
import { texturesPath } from '../../data/assetPaths';

const HALF = GRID_SIZE / 2;

interface Props {
    map: GameMap;
    openWalls: Set<string>;
}

export const InstancedTiles = ({ map, openWalls }: Props) => {
    const seeThroughWallsUntil = useStore(s => s.seeThroughWallsUntil);
    const { floor, ceiling, wall } = useTexture({
        floor: `${texturesPath('floor.png')}?v=2`,
        ceiling: `${texturesPath('ceiling.png')}?v=2`,
        wall: `${texturesPath('wall.png')}?v=2`,
    });
    const wallMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
    [floor, ceiling, wall].forEach(t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(1, 1);
    });

    // Classify tiles once per map — wallEntries includes TrickWalls (closed by default)
    const { floorPositions, ceilPositions, wallEntries } = useMemo(() => {
        const floorPositions: [number, number][] = [];
        const ceilPositions:  [number, number][] = [];
        // [wx, wz, tileKey] — tileKey is "level,y,x" for TrickWall, "" for regular Wall
        const wallEntries: [number, number, string][] = [];

        for (const row of map.tiles) {
            for (const tile of row) {
                const wx = tile.x * GRID_SIZE;
                const wz = tile.y * GRID_SIZE;
                ceilPositions.push([wx, wz]);
                if (tile.type === 'Wall') {
                    if (!MIRROR_WALL_MAP.has(`${map.index},${tile.x},${tile.y}`)) {
                        wallEntries.push([wx, wz, '']);
                    }
                } else if (tile.type === 'TrickWall') {
                    wallEntries.push([wx, wz, `${map.index},${tile.y},${tile.x}`]);
                } else {
                    floorPositions.push([wx, wz]);
                }
            }
        }
        return { floorPositions, ceilPositions, wallEntries };
    }, [map]);

    const floorRef = useRef<THREE.InstancedMesh>(null);
    const ceilRef  = useRef<THREE.InstancedMesh>(null);
    const wallRef  = useRef<THREE.InstancedMesh>(null);

    useEffect(() => {
        const dummy = new THREE.Object3D();

        if (floorRef.current) {
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            floorPositions.forEach(([wx, wz], i) => {
                dummy.position.set(wx, -HALF, wz);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                floorRef.current!.setMatrixAt(i, dummy.matrix);
            });
            floorRef.current.instanceMatrix.needsUpdate = true;
        }

        if (ceilRef.current) {
            dummy.rotation.set(Math.PI / 2, 0, 0);
            ceilPositions.forEach(([wx, wz], i) => {
                dummy.position.set(wx, HALF, wz);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                ceilRef.current!.setMatrixAt(i, dummy.matrix);
            });
            ceilRef.current.instanceMatrix.needsUpdate = true;
        }

        if (wallRef.current) {
            dummy.rotation.set(0, 0, 0);
            wallEntries.forEach(([wx, wz, tKey], i) => {
                const isOpenTrickWall = tKey !== '' && openWalls.has(tKey);
                dummy.position.set(wx, 0, wz);
                dummy.scale.set(isOpenTrickWall ? 0 : 1, isOpenTrickWall ? 0 : 1, isOpenTrickWall ? 0 : 1);
                dummy.updateMatrix();
                wallRef.current!.setMatrixAt(i, dummy.matrix);
            });
            wallRef.current.instanceMatrix.needsUpdate = true;
        }
    }, [floorPositions, ceilPositions, wallEntries, openWalls]);

    useFrame(() => {
        if (!wallMaterialRef.current) return;
        const active = Date.now() < seeThroughWallsUntil;
        wallMaterialRef.current.transparent = active;
        wallMaterialRef.current.opacity = active ? 0.34 : 1;
        wallMaterialRef.current.depthWrite = !active;
    });

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
                args={[undefined, undefined, wallEntries.length]}
                frustumCulled={false}
            >
                <boxGeometry args={[GRID_SIZE, WALL_HEIGHT, GRID_SIZE]} />
                <meshBasicMaterial ref={wallMaterialRef} map={wall} />
            </instancedMesh>
        </>
    );
};
