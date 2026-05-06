import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MIRROR_WALL_MAP, isSelfRevealingWallTile, useStore } from '../../engine/store';
import { DAMAGE_EVENT_LIFETIME_MS, FOOTPRINT_LIFETIME_MS } from '../../engine/time';
import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import { canEquipItemInSlot } from '../../data/equipment';
import { getGameMap } from '../../data/mapLoader';
import type { FootprintEntry } from '../../engine/runtimeTypes';
import type { FloorItem } from '../../types/game';
import { getCreatureCellOffsetXZ } from './creatureCellOffsets';
import { BillboardGroup } from './renderHelpers';
import { CreatureSprite } from './CreatureSprite';
import { FloorItemMesh } from './FloorItemMesh';
import { isFloorItemWallMountedTile } from './floorItemPresentation';
import { WallMountedItemMesh } from './WallMountedItemMesh';
import { useWallClock } from './useWallClock';
import {
    isPointerInsideDungeonViewport,
    performDungeonDragDropAction,
    resolveDungeonDragDropDestination,
    resolveHudFloorDragDropTarget,
    resolveDungeonWallDropTarget,
} from './dungeonDragDrop';

function makeDamageBubbleTexture(amount: number): { texture: THREE.CanvasTexture; aspect: number } {
    const text = `-${amount}`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        const fallback = new THREE.CanvasTexture(canvas);
        return { texture: fallback, aspect: 1.6 };
    }

    ctx.font = 'bold 76px "Courier New", monospace';
    const metrics = ctx.measureText(text);
    const severity = Math.min(1, amount / 48);
    const width = Math.max(220, Math.ceil(metrics.width + 82 + severity * 28));
    const height = Math.max(132, Math.ceil(142 + severity * 18));
    canvas.width = width;
    canvas.height = height;

    const draw = canvas.getContext('2d');
    if (!draw) {
        const fallback = new THREE.CanvasTexture(canvas);
        return { texture: fallback, aspect: width / height };
    }

    draw.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const outerRadiusX = width * (0.46 + severity * 0.03);
    const outerRadiusY = height * (0.42 + severity * 0.04);
    const innerRadiusX = outerRadiusX * 0.78;
    const innerRadiusY = outerRadiusY * 0.73;
    const spikes = 10;

    draw.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const angle = (-Math.PI / 2) + (i * Math.PI) / spikes;
        const radiusX = i % 2 === 0 ? outerRadiusX : innerRadiusX;
        const radiusY = i % 2 === 0 ? outerRadiusY : innerRadiusY;
        const px = cx + Math.cos(angle) * radiusX;
        const py = cy + Math.sin(angle) * radiusY;
        if (i === 0) draw.moveTo(px, py); else draw.lineTo(px, py);
    }
    draw.closePath();

    const fill = draw.createRadialGradient(cx, cy, 8, cx, cy, Math.max(outerRadiusX, outerRadiusY));
    fill.addColorStop(0, 'rgba(255, 246, 212, 0.98)');
    fill.addColorStop(0.24, 'rgba(255, 194, 110, 0.96)');
    fill.addColorStop(0.62, 'rgba(176, 40, 14, 0.96)');
    fill.addColorStop(1, 'rgba(86, 6, 2, 0.98)');
    draw.fillStyle = fill;
    draw.strokeStyle = 'rgba(255, 236, 170, 0.98)';
    draw.lineWidth = 7;
    draw.lineJoin = 'round';
    draw.fill();
    draw.stroke();

    draw.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const angle = (-Math.PI / 2) + (i * Math.PI) / spikes;
        const radiusX = (i % 2 === 0 ? outerRadiusX : innerRadiusX) * 0.79;
        const radiusY = (i % 2 === 0 ? outerRadiusY : innerRadiusY) * 0.74;
        const px = cx + Math.cos(angle) * radiusX;
        const py = cy + Math.sin(angle) * radiusY;
        if (i === 0) draw.moveTo(px, py); else draw.lineTo(px, py);
    }
    draw.closePath();
    draw.strokeStyle = 'rgba(93, 8, 0, 0.92)';
    draw.lineWidth = 3.5;
    draw.stroke();

    draw.font = `900 ${Math.round(64 + severity * 10)}px "Arial Black", "Trebuchet MS", sans-serif`;
    draw.textAlign = 'center';
    draw.textBaseline = 'middle';
    draw.lineJoin = 'round';
    draw.miterLimit = 2;
    draw.lineWidth = 12;
    draw.strokeStyle = 'rgba(45, 3, 0, 0.94)';
    draw.fillStyle = '#fff7d2';
    draw.shadowColor = 'rgba(255, 250, 215, 0.35)';
    draw.shadowBlur = 10;
    draw.strokeText(text, cx, cy + 5);
    draw.fillText(text, cx, cy + 5);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return { texture, aspect: width / height };
}

const DamageNumberBillboard: React.FC<{
    x: number;
    y: number;
    amount: number;
    progress: number;
    offsetX?: number;
    offsetZ?: number;
}> = ({ x, y, amount, progress, offsetX = 0, offsetZ = 0 }) => {
    const { texture, aspect } = useMemo(() => makeDamageBubbleTexture(amount), [amount]);
    useEffect(() => () => texture.dispose(), [texture]);
    const baseHeight = GRID_SIZE * (0.28 + Math.min(0.18, amount / 180));
    const width = baseHeight * aspect;
    const height = baseHeight;
    const scale = Math.max(0.94, Math.min(2.15, 0.96 + (amount / 30)) - progress * 0.1);
    const burstY = GRID_SIZE * 0.36 + progress * GRID_SIZE * 0.12;

    return (
        <BillboardGroup position={[x * GRID_SIZE + offsetX, burstY, y * GRID_SIZE + offsetZ]}>
            <mesh scale={[scale, scale, scale]} frustumCulled={false} renderOrder={30}>
                <planeGeometry args={[width, height]} />
                <meshBasicMaterial
                    map={texture}
                    transparent
                    alphaTest={0.05}
                    depthWrite={false}
                    depthTest={false}
                    opacity={1 - progress * 0.3}
                    toneMapped={false}
                />
            </mesh>
        </BillboardGroup>
    );
};

export const FootprintLayer: React.FC = () => {
    const footprintHistory = useStore((state) => state.footprintHistory);
    const level = useStore((state) => state.level);
    const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
    const footprintGeometry = useMemo(() => new THREE.PlaneGeometry(GRID_SIZE * 0.6, GRID_SIZE * 0.6), []);

    useEffect(() => () => {
        footprintGeometry.dispose();
    }, [footprintGeometry]);

    useFrame(() => {
        const now = Date.now();
        for (const [key, mesh] of meshRefs.current) {
            const ts = parseInt(key.split(',')[2] ?? '0', 10);
            const age = now - ts;
            const opacity = Math.max(0, (FOOTPRINT_LIFETIME_MS - age) / FOOTPRINT_LIFETIME_MS);
            (mesh.material as THREE.MeshBasicMaterial).opacity = opacity * 0.45;
            mesh.visible = opacity > 0.01;
        }
    });

    return (
        <>
            {footprintHistory
                .filter((entry) => entry.level === level)
                .map((entry: FootprintEntry) => {
                    const key = `${entry.x},${entry.y},${entry.ts}`;
                    return (
                        <mesh
                            key={key}
                            ref={(mesh) => {
                                if (mesh) meshRefs.current.set(key, mesh);
                                else meshRefs.current.delete(key);
                            }}
                            position={[entry.x * GRID_SIZE, -WALL_HEIGHT / 2 + 0.03, entry.y * GRID_SIZE]}
                            rotation={[-Math.PI / 2, 0, 0]}
                            geometry={footprintGeometry}
                            frustumCulled={false}
                        >
                            <meshBasicMaterial
                                color="#66ccff"
                                transparent
                                opacity={0.45}
                                depthWrite={false}
                                toneMapped={false}
                            />
                        </mesh>
                    );
                })}
        </>
    );
};

export const CreaturesLayer: React.FC = () => {
    const creatures = useStore((state) => state.creatures);
    const level = useStore((state) => state.level);
    const visibleCreatures = useMemo(
        () => creatures.filter((creature) => creature.alive && creature.mapIndex === level),
        [creatures, level],
    );

    return (
        <>
            {visibleCreatures.map((creature) => <CreatureSprite key={creature.id} creature={creature} />)}
        </>
    );
};

export const DamageLayer: React.FC = () => {
    const damageEvents = useStore((state) => state.damageEvents);
    const level = useStore((state) => state.level);
    const creatures = useStore((state) => state.creatures);
    const direction = useStore((state) => state.direction);
    const now = useWallClock(33);
    const currentLevelCreatureById = useMemo(() => {
        const byId = new Map<string, typeof creatures[number]>();
        for (const creature of creatures) {
            if (creature.alive && creature.mapIndex === level) {
                byId.set(creature.id, creature);
            }
        }
        return byId;
    }, [creatures, level]);

    return (
        <>
            {damageEvents
                .filter((event) => event.target === 'creature' && event.level === level && event.x !== undefined && event.y !== undefined)
                .map((event) => {
                    const eventX = event.x;
                    const eventY = event.y;
                    if (eventX === undefined || eventY === undefined) {
                        return null;
                    }
                    const progress = Math.min(1, Math.max(0, now - event.ts) / DAMAGE_EVENT_LIFETIME_MS);
                    const creature = event.creatureId
                        ? currentLevelCreatureById.get(event.creatureId)
                        : undefined;
                    const [offsetX, offsetZ]: [number, number] = creature
                        ? getCreatureCellOffsetXZ(direction, creature.cell)
                        : [0, 0];
                    return (
                        <DamageNumberBillboard
                            key={event.id}
                            x={eventX}
                            y={eventY}
                            amount={event.amount}
                            progress={progress}
                            offsetX={offsetX}
                            offsetZ={offsetZ}
                        />
                    );
                })}
        </>
    );
};

export const FloorItemsLayer: React.FC = () => {
    const floorItems = useStore((state) => state.floorItems);
    const level = useStore((state) => state.level);
    const creatures = useStore((state) => state.creatures);
    const direction = useStore((state) => state.direction);
    const openWalls = useStore((state) => state.openWalls);
    const pickupItem = useStore((state) => state.pickupItem);
    const beginFloorDrag = useStore((state) => state.beginFloorDrag);
    const updateFloorDrag = useStore((state) => state.updateFloorDrag);
    const endFloorDrag = useStore((state) => state.endFloorDrag);
    const applyFloorItemOnFrontWall = useStore((state) => state.useFloorItemOnFrontWall);
    const applyFloorItemOnViAltar = useStore((state) => state.useFloorItemOnViAltar);
    const moveFloorItemToCurrentTile = useStore((state) => state.moveFloorItemToCurrentTile);
    const moveFloorItemToFrontTile = useStore((state) => state.moveFloorItemToFrontTile);
    const throwFloorItem = useStore((state) => state.throwFloorItem);
    const pickupItemToChampion = useStore((state) => state.pickupItemToChampion);
    const pickupItemToChampionSlot = useStore((state) => state.pickupItemToChampionSlot);
    const equipItem = useStore((state) => state.equipItem);
    const selectedChampionIndex = useStore((state) => state.selectedChampionIndex);
    const party = useStore((state) => state.party);
    const position = useStore((state) => state.position);
    const selectedChampionId = party[selectedChampionIndex]?.id ?? party[0]?.id ?? null;
    const map = getGameMap(level);
    const currentLevelCreatureKeys = useMemo(
        () => creatures.filter((creature) => creature.alive && creature.mapIndex === level),
        [creatures, level],
    );
    const occupiedFloorKeys = useMemo(
        () => new Set(
            currentLevelCreatureKeys
                .map((creature) => `${creature.x},${creature.y}`),
        ),
        [currentLevelCreatureKeys],
    );

    const isMirrorTile = (item: FloorItem) => MIRROR_WALL_MAP.has(`${level},${item.x},${item.y}`);
    const isWallMounted = (item: FloorItem) => {
        const tile = map.tiles[item.y]?.[item.x];
        return isFloorItemWallMountedTile(level, tile, openWalls);
    };
    const visibleFloorItems = floorItems
        .filter((item) => item.mapIndex === level)
        .filter((item) => !isMirrorTile(item))
        .filter((item) => {
            if (!isWallMounted(item)) return true;
            if (!isSelfRevealingWallTile(level, item.x, item.y)) return true;
            return openWalls.has(`${level},${item.y},${item.x}`);
        });
    const currentTileItemOrder = new Map(
        visibleFloorItems
            .filter((item) => !isWallMounted(item))
            .filter((item) => item.x === position[1] && item.y === position[0])
            .map((item, index) => [item.id, index]),
    );
    const currentTileItemCount = currentTileItemOrder.size;

    return (
        <>
            {visibleFloorItems
                .map((item) =>
                    isWallMounted(item)
                        ? <WallMountedItemMesh key={item.id} item={item} onPickup={() => pickupItem(item.id)} />
                        : (
                            <FloorItemMesh
                                key={item.id}
                                item={item}
                                direction={direction}
                                occupiedByCreature={occupiedFloorKeys.has(`${item.x},${item.y}`)}
                                occupiedByParty={item.x === position[1] && item.y === position[0]}
                                partyTileStackIndex={currentTileItemOrder.get(item.id) ?? 0}
                                partyTileStackCount={currentTileItemCount || 1}
                                onPickup={() => pickupItem(item.id)}
                                onStartDrag={(draggedItem, _imagePath, pointerX, pointerY) =>
                                    beginFloorDrag(draggedItem.id, pointerX, pointerY)}
                                onUpdateDrag={updateFloorDrag}
                                onEndDrag={(pointerX, pointerY) => {
                                    const currentState = useStore.getState();
                                    if (currentState.activeFloorDrag?.itemId !== item.id) {
                                        return;
                                    }
                                    const hovered = document.elementFromPoint(pointerX, pointerY) as HTMLElement | null;
                                    const hudDropTarget = resolveHudFloorDragDropTarget(hovered);
                                    if (hudDropTarget) {
                                        if (hudDropTarget.kind === 'champion') {
                                            pickupItemToChampion(item.id, hudDropTarget.championId);
                                            return;
                                        }

                                        const floorItem = currentState.floorItems.find((entry) => entry.id === item.id);
                                        if (!floorItem || !canEquipItemInSlot(floorItem, hudDropTarget.slotKey)) {
                                            return;
                                        }

                                        const equipped = pickupItemToChampionSlot(
                                            item.id,
                                            hudDropTarget.championId,
                                            hudDropTarget.slotKey,
                                        );
                                        if (!equipped) {
                                            const pickedUp = pickupItemToChampion(item.id, hudDropTarget.championId);
                                            if (!pickedUp) return;
                                            equipItem(hudDropTarget.championId, hudDropTarget.slotKey, item.id);
                                        }
                                        return;
                                    }

                                    if (!isPointerInsideDungeonViewport(pointerX, window.innerWidth)) {
                                        endFloorDrag();
                                        return;
                                    }

                                    const wallDropTarget = resolveDungeonWallDropTarget(hovered);
                                    if (wallDropTarget && selectedChampionId != null) {
                                        if (
                                            wallDropTarget.kind === 'altar'
                                                ? applyFloorItemOnViAltar(
                                                    item.id,
                                                    selectedChampionId,
                                                    wallDropTarget.wallX,
                                                    wallDropTarget.wallY,
                                                    wallDropTarget.wallFace,
                                                )
                                                : applyFloorItemOnFrontWall(item.id, selectedChampionId)
                                        ) {
                                            return;
                                        }
                                    }
                                    if (selectedChampionId != null) {
                                        const destination = resolveDungeonDragDropDestination(pointerY, window.innerHeight);
                                        if (performDungeonDragDropAction(destination, {
                                            throwItem: () => throwFloorItem(item.id, selectedChampionId),
                                            dropFront: () => moveFloorItemToFrontTile(item.id, selectedChampionId),
                                            dropCurrent: () => moveFloorItemToCurrentTile(item.id, selectedChampionId),
                                        })) {
                                            return;
                                        }
                                    }
                                    endFloorDrag();
                                }}
                            />
                        ),
                )}
        </>
    );
};
