import type { DoorObject, FloorItem, GameTile } from '../../types/game';
import type { ActivePoisonCloud, Projectile, SpellVisualEvent } from '../runtimeTypes';
import type { Direction } from '../runtimeTypes';
import { getDoorObject } from './doorMetadata';
import { buildProjectileDroppedItem } from './projectileDroppedItem';
import { isTrickWallBlocking } from './trickWallState';

type TraversalState = {
    projectile: Projectile;
    now: number;
    currentGameTick: number;
    openDoors: Set<string>;
    openWalls: Set<string>;
    floorItems: FloorItem[];
    spellVisualEvents: SpellVisualEvent[];
    activePoisonClouds: ActivePoisonCloud[];
};

type TraversalDeps = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    doorBlocksProjectile: (door: DoorObject, projectile: Projectile) => boolean;
    buildActivePoisonCloud: (
        level: number,
        x: number,
        y: number,
        attack: number,
        currentGameTick: number,
        visualScale: number,
        sourceName?: string,
    ) => ActivePoisonCloud;
    getThrownExplosionVisualScale: (attack?: number) => number;
    buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => FloorItem;
    resolveProjectileTeleporterTransport: (
        level: number,
        x: number,
        y: number,
        direction: Direction,
    ) => { level: number; x: number; y: number; direction: Direction };
    gridSize: number;
    originalSpellProjectileAttack: number;
};

export type ProjectileTraversalResult =
    | {
        kind: 'waiting';
        keepProjectile: Projectile;
    }
    | {
        kind: 'consumed';
        openDoors: Set<string>;
        floorItems: FloorItem[];
        spellVisualEvents: SpellVisualEvent[];
        activePoisonClouds: ActivePoisonCloud[];
        shouldPlayDoorMotion?: boolean;
        doorMotionSquare?: { level: number; x: number; y: number };
    }
    | {
        kind: 'advanced';
        level: number;
        x: number;
        y: number;
        direction: Direction;
        openDoors: Set<string>;
        floorItems: FloorItem[];
        spellVisualEvents: SpellVisualEvent[];
        activePoisonClouds: ActivePoisonCloud[];
    };

function stepDirection(direction: Direction, x: number, y: number): { x: number; y: number } {
    if (direction === 'NORTH') return { x, y: y - 1 };
    if (direction === 'SOUTH') return { x, y: y + 1 };
    if (direction === 'EAST') return { x: x + 1, y };
    return { x: x - 1, y };
}

export function resolveProjectileTraversalStep(
    state: TraversalState,
    deps: TraversalDeps,
): ProjectileTraversalResult {
    const { projectile, now, currentGameTick } = state;
    if (projectile.nextMoveAt > now) {
        return {
            kind: 'waiting',
            keepProjectile: projectile,
        };
    }

    const stepped = stepDirection(projectile.direction, projectile.x, projectile.y);
    let x = stepped.x;
    let y = stepped.y;
    let level = projectile.level;
    let direction = projectile.direction;
    let openDoors = state.openDoors;
    let floorItems = state.floorItems;
    let spellVisualEvents = state.spellVisualEvents;
    let activePoisonClouds = state.activePoisonClouds;

    const tile = deps.getTile(level, x, y);
    const doorKey = `${level},${y},${x}`;
    const closedDoor = tile?.type === 'Door' && !state.openDoors.has(doorKey)
        ? getDoorObject(tile)
        : undefined;

    if (projectile.effect === 'open' && closedDoor) {
        if (closedDoor.hasButton) {
            if (openDoors === state.openDoors) openDoors = new Set(state.openDoors);
            openDoors.add(doorKey);
        }
        spellVisualEvents = [
            ...spellVisualEvents,
            {
                id: `spellimpact_door_${now}_${Math.random().toString(36).slice(2)}`,
                level,
                x,
                y,
                height: deps.gridSize * 0.08,
                effect: 'open',
                visualScale: projectile.visualScale,
                ts: now,
                kind: 'wall',
            },
        ];
        return {
            kind: 'consumed',
            openDoors,
            floorItems,
            spellVisualEvents,
            activePoisonClouds,
            shouldPlayDoorMotion: closedDoor.hasButton,
            doorMotionSquare: closedDoor.hasButton ? { level, x, y } : undefined,
        };
    }

    const closedDoorBlocksProjectile = closedDoor ? deps.doorBlocksProjectile(closedDoor, projectile) : false;
    if (!tile || tile.type === 'Wall' || isTrickWallBlocking(tile, level, y, x, state.openWalls) || closedDoorBlocksProjectile) {
        const wallImpactEffect = projectile.effect === 'physical' ? projectile.explosionOnImpact : projectile.effect;
        if (wallImpactEffect) {
            spellVisualEvents = [
                ...spellVisualEvents,
                {
                    id: `spellimpact_wall_${now}_${Math.random().toString(36).slice(2)}`,
                    level,
                    x: projectile.x,
                    y: projectile.y,
                    height: deps.gridSize * 0.08,
                    effect: wallImpactEffect,
                    visualScale: projectile.effect === 'physical'
                        ? deps.getThrownExplosionVisualScale(projectile.explosionAttack) * 1.05
                        : (projectile.visualScale ?? 1) * 1.2,
                    ts: now,
                    kind: 'wall',
                },
            ];
        }
        if (wallImpactEffect === 'poison_cloud') {
            const cloudAttack = projectile.effect === 'physical'
                ? Math.max(1, projectile.explosionAttack ?? 0)
                : Math.max(1, projectile.remainingAttack ?? deps.originalSpellProjectileAttack);
            const cloudVisualScale = projectile.effect === 'physical'
                ? deps.getThrownExplosionVisualScale(projectile.explosionAttack)
                : (projectile.visualScale ?? 1) * 1.08;
            if (activePoisonClouds === state.activePoisonClouds) activePoisonClouds = [...activePoisonClouds];
            activePoisonClouds.push(
                deps.buildActivePoisonCloud(
                    level,
                    projectile.x,
                    projectile.y,
                    cloudAttack,
                    currentGameTick,
                    cloudVisualScale,
                    projectile.sourceName,
                ),
            );
        }
        if (projectile.effect === 'physical' && projectile.physicalItem && !projectile.explosionOnImpact) {
            if (floorItems === state.floorItems) floorItems = [...floorItems];
            floorItems.push(
                buildProjectileDroppedItem(
                    projectile.physicalItem,
                    level,
                    projectile.x,
                    projectile.y,
                    projectile.direction,
                    deps.buildDroppedItem,
                ),
            );
        }
        return {
            kind: 'consumed',
            openDoors,
            floorItems,
            spellVisualEvents,
            activePoisonClouds,
        };
    }

    const teleported = deps.resolveProjectileTeleporterTransport(level, x, y, direction);
    level = teleported.level;
    x = teleported.x;
    y = teleported.y;
    direction = teleported.direction;

    return {
        kind: 'advanced',
        level,
        x,
        y,
        direction,
        openDoors,
        floorItems,
        spellVisualEvents,
        activePoisonClouds,
    };
}
