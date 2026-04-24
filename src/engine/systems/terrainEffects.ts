import type { CreatureInstance, FloorItem, GameTile } from '../../types/game';
import type { DamageEvent, SpellVisualEvent } from '../runtimeTypes';

type TerrainCreatureState = {
    level: number;
    position: [number, number];
    hydratedLevels: Set<number>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
};

type TerrainEffectsDeps = {
    dropCreatureCarriedItems: (
        creatures: CreatureInstance[],
        floorItems: FloorItem[],
        creatureId: string,
    ) => { creatures: CreatureInstance[]; floorItems: FloorItem[] };
    buildDeathDustEvent: (level: number, x: number, y: number) => SpellVisualEvent;
    buildCreatureDamageEvent: (level: number, x: number, y: number, amount: number, creatureId: string) => DamageEvent;
    normalizeCreatureCellsOnTile: (
        creatures: CreatureInstance[],
        level: number,
        x: number,
        y: number,
    ) => CreatureInstance[];
    resolvePitLanding: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => { level: number; y: number; x: number } | null;
    isWalkable: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => boolean;
    canCreatureShareTile: (
        creature: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ) => boolean;
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    getTeleporter: (tile: GameTile) => { destMap: number; destX: number; destY: number } | undefined;
    resolveCreatureTeleporterTransport: (
        state: Pick<TerrainCreatureState, 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST',
        cell: CreatureInstance['cell'],
        creatureTypeId: number,
    ) => { level: number; x: number; y: number; direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST'; cell: CreatureInstance['cell'] };
    buildLevelHydrationPatch: (
        state: Pick<TerrainCreatureState, 'hydratedLevels' | 'creatures' | 'floorItems'>,
        level: number,
    ) => Partial<Pick<TerrainCreatureState, 'creatures' | 'floorItems'>> | null;
};

export function applyPartyTelefragAtSquare(
    state: Pick<TerrainCreatureState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
    level: number,
    x: number,
    y: number,
    deps: Pick<TerrainEffectsDeps, 'dropCreatureCarriedItems' | 'buildDeathDustEvent' | 'normalizeCreatureCellsOnTile'>,
): Pick<TerrainCreatureState, 'creatures' | 'floorItems' | 'spellVisualEvents'> | null {
    const targets = state.creatures.filter((creature) =>
        creature.alive &&
        creature.mapIndex === level &&
        creature.x === x &&
        creature.y === y,
    );
    if (targets.length === 0) return null;

    let creatures = state.creatures;
    let floorItems = state.floorItems;
    let spellVisualEvents = state.spellVisualEvents;

    for (const target of targets) {
        const currentIndex = creatures.findIndex((creature) => creature.id === target.id);
        if (currentIndex < 0 || !creatures[currentIndex]?.alive) continue;
        if (creatures === state.creatures) creatures = [...creatures];
        creatures[currentIndex] = {
            ...creatures[currentIndex],
            currentHP: 0,
            alive: false,
        };
        const dropped = deps.dropCreatureCarriedItems(creatures, floorItems, target.id);
        creatures = dropped.creatures;
        floorItems = dropped.floorItems;
        spellVisualEvents = [...spellVisualEvents, deps.buildDeathDustEvent(level, x, y)];
    }

    creatures = deps.normalizeCreatureCellsOnTile(creatures, level, x, y);

    return {
        creatures,
        floorItems,
        spellVisualEvents,
    };
}

export function applyCreaturesStandingOnOpenPit(
    state: Pick<TerrainCreatureState, 'level' | 'position' | 'hydratedLevels' | 'creatures' | 'floorItems' | 'damageEvents' | 'spellVisualEvents' | 'openDoors' | 'openWalls' | 'openPits'>,
    level: number,
    x: number,
    y: number,
    deps: Pick<
        TerrainEffectsDeps,
        | 'resolvePitLanding'
        | 'isWalkable'
        | 'canCreatureShareTile'
        | 'dropCreatureCarriedItems'
        | 'buildDeathDustEvent'
        | 'buildCreatureDamageEvent'
        | 'normalizeCreatureCellsOnTile'
        | 'buildLevelHydrationPatch'
    >,
): Pick<TerrainCreatureState, 'creatures' | 'floorItems' | 'damageEvents' | 'spellVisualEvents'> | null {
    const fallers = state.creatures.filter((creature) =>
        creature.alive &&
        creature.mapIndex === level &&
        creature.x === x &&
        creature.y === y,
    );
    if (fallers.length === 0) return null;

    let creatures = state.creatures;
    let floorItems = state.floorItems;
    let damageEvents = state.damageEvents;
    let spellVisualEvents = state.spellVisualEvents;
    let changed = false;

    for (const original of fallers) {
        const currentIndex = creatures.findIndex((creature) => creature.id === original.id);
        const creature = currentIndex >= 0 ? creatures[currentIndex] : null;
        if (!creature || !creature.alive) continue;

        const landing = deps.resolvePitLanding(
            level + 1,
            y,
            x,
            state.openDoors,
            state.openWalls,
            state.openPits,
        );
        if (!landing) continue;

        const hydrationPatch = deps.buildLevelHydrationPatch(
            {
                hydratedLevels: state.hydratedLevels,
                creatures,
                floorItems,
            },
            landing.level,
        );
        if (hydrationPatch) {
            creatures = hydrationPatch.creatures ?? creatures;
            floorItems = hydrationPatch.floorItems ?? floorItems;
        }

        const fallDamage = 20;
        const nextHP = Math.max(0, creature.currentHP - fallDamage);
        const landingBlockedByParty =
            state.level === landing.level &&
            state.position[0] === landing.y &&
            state.position[1] === landing.x;
        const movedCreature: CreatureInstance = {
            ...creature,
            mapIndex: landing.level,
            x: landing.x,
            y: landing.y,
            currentHP: nextHP,
            alive: nextHP > 0,
        };
        const canLandAlive =
            nextHP > 0 &&
            !landingBlockedByParty &&
            deps.isWalkable(landing.level, landing.y, landing.x, state.openDoors, state.openWalls, state.openPits) &&
            deps.canCreatureShareTile(movedCreature, landing.level, landing.x, landing.y, creatures);

        if (creatures === state.creatures) creatures = [...creatures];
        creatures[currentIndex] = {
            ...movedCreature,
            alive: canLandAlive,
            currentHP: canLandAlive ? nextHP : 0,
        };
        damageEvents = [...damageEvents, deps.buildCreatureDamageEvent(landing.level, landing.x, landing.y, fallDamage, creature.id)];

        if (!canLandAlive) {
            const dropped = deps.dropCreatureCarriedItems(creatures, floorItems, creature.id);
            creatures = dropped.creatures;
            floorItems = dropped.floorItems;
            spellVisualEvents = [...spellVisualEvents, deps.buildDeathDustEvent(landing.level, landing.x, landing.y)];
        }

        creatures = deps.normalizeCreatureCellsOnTile(creatures, level, x, y);
        creatures = deps.normalizeCreatureCellsOnTile(creatures, landing.level, landing.x, landing.y);
        changed = true;
    }

    if (!changed) return null;

    return {
        creatures,
        floorItems,
        damageEvents,
        spellVisualEvents,
    };
}

export function applyFloorItemsStandingOnOpenPit(
    state: Pick<TerrainCreatureState, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors' | 'openWalls' | 'openPits'>,
    level: number,
    x: number,
    y: number,
    deps: Pick<TerrainEffectsDeps, 'resolvePitLanding' | 'buildLevelHydrationPatch'>,
): Pick<TerrainCreatureState, 'creatures' | 'floorItems'> | null {
    const fallers = state.floorItems.filter((item) =>
        item.mapIndex === level &&
        item.x === x &&
        item.y === y,
    );
    if (fallers.length === 0) return null;

    const landing = deps.resolvePitLanding(
        level + 1,
        y,
        x,
        state.openDoors,
        state.openWalls,
        state.openPits,
    );
    if (!landing) return null;

    let creatures = state.creatures;
    let floorItems = state.floorItems;

    const hydrationPatch = deps.buildLevelHydrationPatch(
        {
            hydratedLevels: state.hydratedLevels,
            creatures,
            floorItems,
        },
        landing.level,
    );
    if (hydrationPatch) {
        creatures = hydrationPatch.creatures ?? creatures;
        floorItems = hydrationPatch.floorItems ?? floorItems;
    }

    const fallingIds = new Set(fallers.map((item) => item.id));
    const nextFloorItems = floorItems.map((item) =>
        fallingIds.has(item.id)
            ? {
                ...item,
                mapIndex: landing.level,
                x: landing.x,
                y: landing.y,
            }
            : item,
    );

    return {
        creatures,
        floorItems: nextFloorItems,
    };
}

export function applyCreaturesStandingOnOpenTeleporter(
    state: Pick<TerrainCreatureState, 'level' | 'position' | 'hydratedLevels' | 'creatures' | 'openDoors' | 'openWalls' | 'openPits' | 'openTeleporters'>,
    level: number,
    x: number,
    y: number,
    deps: Pick<
        TerrainEffectsDeps,
        | 'getTile'
        | 'getTeleporter'
        | 'resolveCreatureTeleporterTransport'
        | 'isWalkable'
        | 'canCreatureShareTile'
        | 'normalizeCreatureCellsOnTile'
        | 'buildLevelHydrationPatch'
    >,
): Pick<TerrainCreatureState, 'creatures'> | null {
    const tile = deps.getTile(level, x, y);
    if (tile?.type !== 'Teleporter') return null;
    const teleporter = deps.getTeleporter(tile);
    if (!teleporter) return null;

    const movers = state.creatures.filter((creature) =>
        creature.alive &&
        creature.mapIndex === level &&
        creature.x === x &&
        creature.y === y,
    );
    if (movers.length === 0) return null;

    let creatures = state.creatures;
    let changed = false;

    for (const original of movers) {
        const currentIndex = creatures.findIndex((creature) => creature.id === original.id);
        const creature = currentIndex >= 0 ? creatures[currentIndex] : null;
        if (!creature || !creature.alive) continue;

        const destinationBlockedByParty =
            state.level === teleporter.destMap &&
            state.position[0] === teleporter.destY &&
            state.position[1] === teleporter.destX;
        const resolvedTransport = deps.resolveCreatureTeleporterTransport(
            state,
            level,
            x,
            y,
            'NORTH',
            creature.cell,
            creature.typeId,
        );
        if (
            resolvedTransport.level === creature.mapIndex
            && resolvedTransport.x === creature.x
            && resolvedTransport.y === creature.y
            && resolvedTransport.cell === creature.cell
        ) {
            continue;
        }
        const hydrationPatch = deps.buildLevelHydrationPatch(
            {
                hydratedLevels: state.hydratedLevels,
                creatures,
                floorItems: [],
            },
            resolvedTransport.level,
        );
        if (hydrationPatch?.creatures) {
            creatures = hydrationPatch.creatures;
        }
        const destinationBlockedByPartyAtFinalSquare =
            state.level === resolvedTransport.level &&
            state.position[0] === resolvedTransport.y &&
            state.position[1] === resolvedTransport.x;
        const movedCreature: CreatureInstance = {
            ...creature,
            mapIndex: resolvedTransport.level,
            x: resolvedTransport.x,
            y: resolvedTransport.y,
            cell: resolvedTransport.cell,
        };
        const canTeleport =
            !destinationBlockedByParty &&
            !destinationBlockedByPartyAtFinalSquare &&
            deps.isWalkable(resolvedTransport.level, resolvedTransport.y, resolvedTransport.x, state.openDoors, state.openWalls, state.openPits) &&
            deps.canCreatureShareTile(movedCreature, resolvedTransport.level, resolvedTransport.x, resolvedTransport.y, creatures);
        if (!canTeleport) continue;

        if (creatures === state.creatures) creatures = [...creatures];
        creatures[currentIndex] = movedCreature;
        creatures = deps.normalizeCreatureCellsOnTile(creatures, level, x, y);
        creatures = deps.normalizeCreatureCellsOnTile(creatures, resolvedTransport.level, resolvedTransport.x, resolvedTransport.y);
        changed = true;
    }

    return changed ? { creatures } : null;
}
