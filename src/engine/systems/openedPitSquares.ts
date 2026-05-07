import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type {
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    SpellVisualEvent,
} from '../runtimeTypes';

type OpenedPitLoopState = {
    level: number;
    position: [number, number];
    hydratedLevels: Set<number>;
    party: Champion[];
    selectedChampionIndex: number;
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
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
};

type OpenedPitLoopDeps = {
    resolvePitLanding: (
        level: number,
        y: number,
        x: number,
        openDoors: Set<string>,
        openWalls: Set<string>,
        openPits: Set<string>,
    ) => { level: number; x: number; y: number } | null;
    applyPartyTelefragAtSquare: (
        state: Pick<OpenedPitLoopState, 'creatures' | 'floorItems' | 'spellVisualEvents'>,
        level: number,
        x: number,
        y: number,
    ) => Pick<OpenedPitLoopState, 'creatures' | 'floorItems' | 'spellVisualEvents'> | null;
    applyPartyFallImpactDamage: (
        state: Pick<
            OpenedPitLoopState,
            | 'level'
            | 'position'
            | 'party'
            | 'championInventories'
            | 'championEquipment'
            | 'floorItems'
            | 'deadChampions'
            | 'selectedChampionIndex'
            | 'damageEvents'
            | 'activeShields'
            | 'activePotionBoosts'
            | 'championCombat'
        >,
        championVitals: Record<number, ChampionVitals>,
        landingLevel: number,
        landingPosition: [number, number],
    ) => Partial<
        Pick<
            OpenedPitLoopState,
            | 'championVitals'
            | 'damageEvents'
            | 'party'
            | 'floorItems'
            | 'championInventories'
            | 'championEquipment'
            | 'deadChampions'
            | 'selectedChampionIndex'
        >
    > | null;
    buildLevelHydrationPatch: (
        state: Pick<OpenedPitLoopState, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'>,
        level: number,
    ) => Partial<Pick<OpenedPitLoopState, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'>> | null;
    applyCreaturesStandingOnOpenPit: (
        state: Pick<
            OpenedPitLoopState,
            | 'level'
            | 'position'
            | 'hydratedLevels'
            | 'creatures'
            | 'floorItems'
            | 'damageEvents'
            | 'spellVisualEvents'
            | 'openDoors'
            | 'openWalls'
            | 'openPits'
        >,
        level: number,
        x: number,
        y: number,
    ) => Partial<Pick<OpenedPitLoopState, 'hydratedLevels' | 'creatures' | 'floorItems' | 'damageEvents' | 'spellVisualEvents' | 'openDoors'>> | null;
    applyFloorItemsStandingOnOpenPit: (
        state: Pick<
            OpenedPitLoopState,
            | 'hydratedLevels'
            | 'creatures'
            | 'floorItems'
            | 'openDoors'
            | 'openWalls'
            | 'openPits'
        >,
        level: number,
        x: number,
        y: number,
    ) => Partial<Pick<OpenedPitLoopState, 'hydratedLevels' | 'creatures' | 'floorItems' | 'openDoors'>> | null;
};

type OpenedPitLoopResult = Pick<
    OpenedPitLoopState,
    | 'level'
    | 'position'
    | 'hydratedLevels'
    | 'creatures'
    | 'floorItems'
    | 'openDoors'
    | 'championVitals'
    | 'party'
    | 'championInventories'
    | 'championEquipment'
    | 'deadChampions'
    | 'selectedChampionIndex'
    | 'damageEvents'
    | 'spellVisualEvents'
> & { changed: boolean };

export function applyOpenedPitEffects(
    state: OpenedPitLoopState,
    openedPitKeys: string[],
    deps: OpenedPitLoopDeps,
): OpenedPitLoopResult {
    let level = state.level;
    let position = state.position;
    let hydratedLevels = state.hydratedLevels;
    let creatures = state.creatures;
    let floorItems = state.floorItems;
    let openDoors = state.openDoors;
    let championVitals = state.championVitals;
    let party = state.party;
    let championInventories = state.championInventories;
    let championEquipment = state.championEquipment;
    let deadChampions = state.deadChampions;
    let selectedChampionIndex = state.selectedChampionIndex;
    let damageEvents = state.damageEvents;
    let spellVisualEvents = state.spellVisualEvents;
    let changed = false;

    for (const key of openedPitKeys) {
        const [pitLevelRaw, pitYRaw, pitXRaw] = key.split(',');
        const pitLevel = Number(pitLevelRaw);
        const pitY = Number(pitYRaw);
        const pitX = Number(pitXRaw);
        if (!Number.isFinite(pitLevel) || !Number.isFinite(pitY) || !Number.isFinite(pitX)) continue;

        if (level === pitLevel && position[0] === pitY && position[1] === pitX) {
            const landing = deps.resolvePitLanding(
                pitLevel,
                pitY,
                pitX,
                state.openDoors,
                state.openWalls,
                state.openPits,
            );
            if (landing) {
                const hydrationPatch = deps.buildLevelHydrationPatch(
                    {
                        hydratedLevels,
                        creatures,
                        floorItems,
                        openDoors,
                    },
                    landing.level,
                );
                if (hydrationPatch) {
                    hydratedLevels = hydrationPatch.hydratedLevels ?? hydratedLevels;
                    creatures = hydrationPatch.creatures ?? creatures;
                    floorItems = hydrationPatch.floorItems ?? floorItems;
                    openDoors = hydrationPatch.openDoors ?? openDoors;
                }
                const telefrag = deps.applyPartyTelefragAtSquare(
                    { creatures, floorItems, spellVisualEvents },
                    landing.level,
                    landing.x,
                    landing.y,
                );
                if (telefrag) {
                    creatures = telefrag.creatures ?? creatures;
                    floorItems = telefrag.floorItems ?? floorItems;
                    spellVisualEvents = telefrag.spellVisualEvents ?? spellVisualEvents;
                }

                const fallDamage = deps.applyPartyFallImpactDamage(
                    {
                        level,
                        position,
                        party,
                        championInventories,
                        championEquipment,
                        floorItems,
                        deadChampions,
                        selectedChampionIndex,
                        damageEvents,
                        activeShields: state.activeShields,
                        activePotionBoosts: state.activePotionBoosts,
                        championCombat: state.championCombat,
                    },
                    championVitals,
                    landing.level,
                    [landing.y, landing.x],
                );
                if (fallDamage) {
                    championVitals = fallDamage.championVitals ?? championVitals;
                    damageEvents = fallDamage.damageEvents ?? damageEvents;
                    party = fallDamage.party ?? party;
                    floorItems = fallDamage.floorItems ?? floorItems;
                    championInventories = fallDamage.championInventories ?? championInventories;
                    championEquipment = fallDamage.championEquipment ?? championEquipment;
                    deadChampions = fallDamage.deadChampions ?? deadChampions;
                    selectedChampionIndex = fallDamage.selectedChampionIndex ?? selectedChampionIndex;
                }

                level = landing.level;
                position = [landing.y, landing.x];
                changed = true;
            }
        }

        const floorItemFallPatch = deps.applyFloorItemsStandingOnOpenPit(
            {
                hydratedLevels,
                creatures,
                floorItems,
                openDoors,
                openWalls: state.openWalls,
                openPits: state.openPits,
            },
            pitLevel,
            pitX,
            pitY,
        );
        if (floorItemFallPatch) {
            hydratedLevels = floorItemFallPatch.hydratedLevels ?? hydratedLevels;
            creatures = floorItemFallPatch.creatures ?? creatures;
            floorItems = floorItemFallPatch.floorItems ?? floorItems;
            openDoors = floorItemFallPatch.openDoors ?? openDoors;
            changed = true;
        }

        const creatureFallPatch = deps.applyCreaturesStandingOnOpenPit(
            {
                level,
                position,
                hydratedLevels,
                creatures,
                floorItems,
                damageEvents,
                spellVisualEvents,
                openDoors,
                openWalls: state.openWalls,
                openPits: state.openPits,
            },
            pitLevel,
            pitX,
            pitY,
        );
        if (creatureFallPatch) {
            hydratedLevels = creatureFallPatch.hydratedLevels ?? hydratedLevels;
            creatures = creatureFallPatch.creatures ?? creatures;
            floorItems = creatureFallPatch.floorItems ?? floorItems;
            openDoors = creatureFallPatch.openDoors ?? openDoors;
            damageEvents = creatureFallPatch.damageEvents ?? damageEvents;
            spellVisualEvents = creatureFallPatch.spellVisualEvents ?? spellVisualEvents;
            changed = true;
        }
    }

    return {
        level,
        position,
        hydratedLevels,
        creatures,
        floorItems,
        openDoors,
        championVitals,
        party,
        championInventories,
        championEquipment,
        deadChampions,
        selectedChampionIndex,
        damageEvents,
        spellVisualEvents,
        changed,
    };
}
