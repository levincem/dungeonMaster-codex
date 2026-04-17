import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type {
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    SpellVisualEvent,
    Direction,
} from '../runtimeTypes';

type PartyImmediateTransportState = {
    level: number;
    position: [number, number];
    direction: Direction;
    party: Champion[];
    selectedChampionIndex: number;
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
};

type OpenedPitEffectsResult = Pick<
    PartyImmediateTransportState,
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

type OpenedTeleporterEffectsResult = Pick<
    PartyImmediateTransportState,
    'level' | 'position' | 'direction' | 'creatures' | 'floorItems' | 'spellVisualEvents'
> & { changed: boolean };

type PartyImmediateTransportDeps = {
    applyOpenedPitEffects: (
        state: Pick<
            PartyImmediateTransportState,
            | 'level'
            | 'position'
            | 'party'
            | 'selectedChampionIndex'
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
        >,
        openedPitKeys: string[],
    ) => OpenedPitEffectsResult;
    applyOpenedTeleporterEffects: (
        state: Pick<
            PartyImmediateTransportState,
            | 'level'
            | 'position'
            | 'direction'
            | 'openDoors'
            | 'openPits'
            | 'openTeleporters'
            | 'openWalls'
            | 'creatures'
            | 'floorItems'
            | 'spellVisualEvents'
        >,
        openedTeleporterKeys: string[],
    ) => OpenedTeleporterEffectsResult;
};

export function applyImmediateTransportSquareEffects<
    TState extends PartyImmediateTransportState,
    TPatch extends Partial<TState>,
>(
    state: TState,
    basePatch: TPatch,
    deps: PartyImmediateTransportDeps,
): TPatch {
    const nextOpenPits = basePatch.openPits ?? state.openPits;
    const nextOpenTeleporters = basePatch.openTeleporters ?? state.openTeleporters;

    const openedPitKeys = [...nextOpenPits].filter((key) => !state.openPits.has(key));
    const openedTeleporterKeys = [...nextOpenTeleporters].filter((key) => !state.openTeleporters.has(key));
    if (openedPitKeys.length === 0 && openedTeleporterKeys.length === 0) return basePatch;

    let level = basePatch.level ?? state.level;
    let position = basePatch.position ?? state.position;
    let direction = basePatch.direction ?? state.direction;
    let creatures = basePatch.creatures ?? state.creatures;
    let floorItems = basePatch.floorItems ?? state.floorItems;
    let championVitals = basePatch.championVitals ?? state.championVitals;
    let party = basePatch.party ?? state.party;
    let championInventories = basePatch.championInventories ?? state.championInventories;
    let championEquipment = basePatch.championEquipment ?? state.championEquipment;
    let deadChampions = basePatch.deadChampions ?? state.deadChampions;
    let selectedChampionIndex = basePatch.selectedChampionIndex ?? state.selectedChampionIndex;
    let damageEvents = basePatch.damageEvents ?? state.damageEvents;
    let spellVisualEvents = basePatch.spellVisualEvents ?? state.spellVisualEvents;
    let changed = false;

    const pitEffects = deps.applyOpenedPitEffects(
        {
            level,
            position,
            party,
            selectedChampionIndex,
            creatures,
            floorItems,
            championInventories,
            championEquipment,
            championVitals,
            damageEvents,
            spellVisualEvents,
            deadChampions,
            activeShields: state.activeShields,
            activePotionBoosts: state.activePotionBoosts,
            championCombat: state.championCombat,
            openDoors: state.openDoors,
            openWalls: state.openWalls,
            openPits: nextOpenPits,
        },
        openedPitKeys,
    );
    if (pitEffects.changed) {
        level = pitEffects.level;
        position = pitEffects.position;
        creatures = pitEffects.creatures;
        floorItems = pitEffects.floorItems;
        championVitals = pitEffects.championVitals;
        party = pitEffects.party;
        championInventories = pitEffects.championInventories;
        championEquipment = pitEffects.championEquipment;
        deadChampions = pitEffects.deadChampions;
        selectedChampionIndex = pitEffects.selectedChampionIndex;
        damageEvents = pitEffects.damageEvents;
        spellVisualEvents = pitEffects.spellVisualEvents;
        changed = true;
    }

    const teleporterEffects = deps.applyOpenedTeleporterEffects(
        {
            level,
            position,
            direction,
            creatures,
            floorItems,
            spellVisualEvents,
            openDoors: state.openDoors,
            openWalls: state.openWalls,
            openPits: nextOpenPits,
            openTeleporters: nextOpenTeleporters,
        },
        openedTeleporterKeys,
    );
    if (teleporterEffects.changed) {
        level = teleporterEffects.level;
        position = teleporterEffects.position;
        direction = teleporterEffects.direction;
        creatures = teleporterEffects.creatures;
        floorItems = teleporterEffects.floorItems;
        spellVisualEvents = teleporterEffects.spellVisualEvents;
        changed = true;
    }

    if (!changed) return basePatch;

    return {
        ...basePatch,
        level,
        position,
        direction,
        creatures,
        floorItems,
        championVitals,
        party,
        championInventories,
        championEquipment,
        deadChampions,
        selectedChampionIndex,
        damageEvents,
        spellVisualEvents,
    };
}
