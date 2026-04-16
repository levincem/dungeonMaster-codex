import type { CreatureInstance, FloorItem, GameTile } from '../../types/game';
import type { Direction, SpellVisualEvent } from '../runtimeTypes';

type TeleporterLoopState = {
    level: number;
    position: [number, number];
    direction: Direction;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    spellVisualEvents: SpellVisualEvent[];
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
};

type TeleporterLoopDeps = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    getTeleporter: (tile: GameTile) => { destMap: number; destX: number; destY: number } | undefined;
    resolveProjectileTeleporterTransport: (
        state: Pick<TeleporterLoopState, 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
        direction: Direction,
    ) => { level: number; x: number; y: number; direction: Direction };
    applyPartyTelefragAtSquare: (
        state: Pick<TeleporterLoopState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
        level: number,
        x: number,
        y: number,
    ) => Pick<TeleporterLoopState, 'creatures' | 'floorItems' | 'spellVisualEvents'> | null;
    applyCreaturesStandingOnOpenTeleporter: (
        state: Pick<TeleporterLoopState, 'level' | 'position' | 'creatures' | 'openDoors' | 'openWalls' | 'openPits' | 'openTeleporters'>,
        level: number,
        x: number,
        y: number,
    ) => Pick<TeleporterLoopState, 'creatures'> | null;
};

type TeleporterLoopResult = Pick<
    TeleporterLoopState,
    'level' | 'position' | 'direction' | 'creatures' | 'floorItems' | 'spellVisualEvents'
> & { changed: boolean };

export function applyOpenedTeleporterEffects(
    state: TeleporterLoopState,
    openedTeleporterKeys: string[],
    deps: TeleporterLoopDeps,
): TeleporterLoopResult {
    let level = state.level;
    let position = state.position;
    let direction = state.direction;
    let creatures = state.creatures;
    let floorItems = state.floorItems;
    let spellVisualEvents = state.spellVisualEvents;
    let changed = false;

    for (const key of openedTeleporterKeys) {
        const [tpLevelRaw, tpYRaw, tpXRaw] = key.split(',');
        const tpLevel = Number(tpLevelRaw);
        const tpY = Number(tpYRaw);
        const tpX = Number(tpXRaw);
        if (!Number.isFinite(tpLevel) || !Number.isFinite(tpY) || !Number.isFinite(tpX)) continue;

        const tile = deps.getTile(tpLevel, tpX, tpY);
        const teleporter = tile?.type === 'Teleporter' ? deps.getTeleporter(tile) : null;
        if (!teleporter) continue;

        if (level === tpLevel && position[0] === tpY && position[1] === tpX) {
            const resolvedTransport = deps.resolveProjectileTeleporterTransport(
                { openTeleporters: state.openTeleporters },
                tpLevel,
                tpX,
                tpY,
                direction,
            );
            direction = resolvedTransport.direction;
            const telefrag = deps.applyPartyTelefragAtSquare(
                { creatures, floorItems, spellVisualEvents },
                resolvedTransport.level,
                resolvedTransport.x,
                resolvedTransport.y,
            );
            if (telefrag) {
                creatures = telefrag.creatures ?? creatures;
                floorItems = telefrag.floorItems ?? floorItems;
                spellVisualEvents = telefrag.spellVisualEvents ?? spellVisualEvents;
            }
            level = resolvedTransport.level;
            position = [resolvedTransport.y, resolvedTransport.x];
            changed = true;
        }

        const creatureTeleportPatch = deps.applyCreaturesStandingOnOpenTeleporter(
            {
                level,
                position,
                creatures,
                openDoors: state.openDoors,
                openWalls: state.openWalls,
                openPits: state.openPits,
                openTeleporters: state.openTeleporters,
            },
            tpLevel,
            tpX,
            tpY,
        );
        if (creatureTeleportPatch) {
            creatures = creatureTeleportPatch.creatures ?? creatures;
            changed = true;
        }
    }

    return {
        level,
        position,
        direction,
        creatures,
        floorItems,
        spellVisualEvents,
        changed,
    };
}
