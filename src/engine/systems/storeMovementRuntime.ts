import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type {
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    Direction,
    PartyShield,
    SpellVisualEvent,
} from '../runtimeTypes';
import { applyImmediateTransportSquareEffects as applyImmediateTransportSquareEffectsSystem } from './partyImmediateTransportEffects';
import { resolvePartyStepTransport as resolvePartyStepTransportSystem } from './partyStepTransport';
import { createStorePartyMoveRuntimeDeps } from './storePartyMoveRuntime';

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type MovementRuntimeState = {
    gamePhase: string;
    movementCooldown: number;
    level: number;
    position: [number, number];
    direction: Direction;
    party: Champion[];
    selectedChampionIndex: number;
    hydratedLevels: Set<number>;
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    deadChampions: Record<number, Champion>;
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat: Record<number, ChampionCombat>;
    pendingSensorEvents: PendingSensorEventLike[];
};

type OpenedPitEffectsState = Pick<
    MovementRuntimeState,
    | 'level'
    | 'position'
    | 'party'
    | 'selectedChampionIndex'
    | 'hydratedLevels'
    | 'openDoors'
    | 'openPits'
    | 'openWalls'
    | 'creatures'
    | 'floorItems'
    | 'championInventories'
    | 'championEquipment'
    | 'championVitals'
    | 'damageEvents'
    | 'spellVisualEvents'
    | 'deadChampions'
    | 'activeShields'
    | 'activePotionBoosts'
    | 'championCombat'
>;

type OpenedPitEffectsResult = Pick<
    MovementRuntimeState,
    | 'level'
    | 'position'
    | 'creatures'
    | 'floorItems'
    | 'championVitals'
    | 'party'
    | 'championInventories'
    | 'championEquipment'
    | 'deadChampions'
    | 'selectedChampionIndex'
    | 'damageEvents'
    | 'spellVisualEvents'
> & { changed: boolean };

type OpenedTeleporterEffectsState = Pick<
    MovementRuntimeState,
    | 'level'
    | 'position'
    | 'direction'
    | 'hydratedLevels'
    | 'championInventories'
    | 'championEquipment'
    | 'openDoors'
    | 'openPits'
    | 'openTeleporters'
    | 'openWalls'
    | 'creatures'
    | 'floorItems'
    | 'spellVisualEvents'
    | 'pendingSensorEvents'
>;

type OpenedTeleporterEffectsResult = Pick<
    MovementRuntimeState,
    | 'level'
    | 'position'
    | 'direction'
    | 'creatures'
    | 'floorItems'
    | 'spellVisualEvents'
    | 'openDoors'
    | 'openPits'
    | 'openTeleporters'
    | 'openWalls'
    | 'pendingSensorEvents'
> & { changed: boolean };

type StoreMovementRuntimeParams<
    TState extends MovementRuntimeState,
    TSensorState,
    TWallPushDeps,
    TStairLink,
> = {
    applyPartyMoveFatigue: (state: TState) => Record<number, ChampionVitals> | null;
    isPartyStepBlockedByCreature: (state: TState, level: number, x: number, y: number) => boolean;
    getTile: (level: number, x: number, y: number) => { type: string } | undefined;
    isWalkable: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => boolean;
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    buildWallPushSensorDeps: () => TWallPushDeps;
    triggerWallPushSensorsSystem: (
        level: number,
        x: number,
        y: number,
        direction: string,
        sensorState: TSensorState,
        pendingSensorEvents: PendingSensorEventLike[],
        deps: TWallPushDeps,
    ) => {
        sensorChanges: Record<string, unknown>;
        pendingSensorEvents: PendingSensorEventLike[];
    };
    buildPartyDamageDeps: () => {
        applyFrontRowWallBumpDamage: (
            state: TState,
            championVitals: Record<number, ChampionVitals>,
            now: number,
        ) => Record<string, unknown> | null;
    };
    applyOpenedPitEffects: (state: OpenedPitEffectsState, openedPitKeys: string[]) => OpenedPitEffectsResult;
    applyOpenedTeleporterEffects: (
        state: OpenedTeleporterEffectsState,
        openedTeleporterKeys: string[],
    ) => OpenedTeleporterEffectsResult;
    resolveOpenPitEntryTransport: (
        state: TState,
        x: number,
        y: number,
        ny: number,
        nx: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ) => { patch: Partial<TState>; fellThroughPit: true } | null;
    findStairLink: (level: number, y: number, x: number) => TStairLink | undefined;
    resolveStairStepTransport: (
        state: TState,
        link: TStairLink | undefined,
        movedChampionVitalsPatch: Partial<Partial<TState>> | null,
    ) => { patch: Partial<TState> } | null;
    resolveTeleporterStepTransport: (
        state: TState,
        ny: number,
        nx: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ) => { patch: Partial<TState>; blockedMessage?: string } | null;
    resolveStandardStepTransport: (
        state: TState,
        x: number,
        y: number,
        nx: number,
        ny: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ) => { patch: Partial<TState>; blockedMessage?: string };
};

export function createStoreMovementRuntime<
    TState extends MovementRuntimeState,
    TSensorState,
    TWallPushDeps,
    TStairLink,
>(
    params: StoreMovementRuntimeParams<TState, TSensorState, TWallPushDeps, TStairLink>,
) {
    const applyImmediateTransportSquareEffects = (
        state: TState,
        basePatch: Partial<TState>,
    ): Partial<TState> => applyImmediateTransportSquareEffectsSystem(
        state,
        basePatch,
        {
            applyOpenedPitEffects: (transportState, openedPitKeys) =>
                params.applyOpenedPitEffects(
                    {
                        ...transportState,
                        hydratedLevels: state.hydratedLevels,
                    },
                    openedPitKeys,
                ),
            applyOpenedTeleporterEffects: (transportState, openedTeleporterKeys) =>
                params.applyOpenedTeleporterEffects(
                    {
                        ...transportState,
                        hydratedLevels: state.hydratedLevels,
                    },
                    openedTeleporterKeys,
                ),
        },
    ) as unknown as Partial<TState>;

    const resolvePartyStepTransport = (
        state: TState,
        ny: number,
        nx: number,
        movedVitals: Record<number, ChampionVitals> | null,
    ): {
        patch: Partial<TState> | TState;
        blockedMessage?: string;
        fellThroughPit?: boolean;
    } => resolvePartyStepTransportSystem(
        state,
        ny,
        nx,
        movedVitals,
        {
            getTile: params.getTile,
            isWalkable: params.isWalkable,
            resolveOpenPitEntryTransport: params.resolveOpenPitEntryTransport,
            findStairLink: params.findStairLink,
            resolveStairStepTransport: params.resolveStairStepTransport,
            resolveTeleporterStepTransport: params.resolveTeleporterStepTransport,
            resolveStandardStepTransport: params.resolveStandardStepTransport,
        },
    );

    const buildPartyMoveDeps = (enableFrontWallBumpDamage: boolean) =>
        createStorePartyMoveRuntimeDeps<TState, TWallPushDeps, TState>({
            applyPartyMoveFatigue: params.applyPartyMoveFatigue,
            isPartyStepBlockedByCreature: params.isPartyStepBlockedByCreature,
            getTile: params.getTile,
            isWalkable: params.isWalkable,
            buildSensorStateSnapshot: params.buildSensorStateSnapshot,
            buildWallPushSensorDeps: params.buildWallPushSensorDeps,
            triggerWallPushSensorsSystem: (
                level,
                x,
                y,
                direction,
                sensorState,
                pendingSensorEvents,
                deps,
            ) =>
                params.triggerWallPushSensorsSystem(
                    level,
                    x,
                    y,
                    direction,
                    sensorState as TSensorState,
                    pendingSensorEvents as PendingSensorEventLike[],
                    deps,
                ),
            buildPartyDamageState: (state) => state,
            applyFrontRowWallBumpDamageState: enableFrontWallBumpDamage
                ? (state, championVitals, now) =>
                    params.buildPartyDamageDeps().applyFrontRowWallBumpDamage(
                        state,
                        championVitals,
                        now,
                    )
                : () => null,
            enableFrontWallBumpDamage,
            applyImmediateTransportSquareEffects: (state, patch) =>
                applyImmediateTransportSquareEffects(state, patch as Partial<TState>) as Record<string, unknown>,
            resolvePartyStepTransport,
        });

    return {
        applyImmediateTransportSquareEffects,
        buildPartyMoveDeps,
        resolvePartyStepTransport,
    };
}
