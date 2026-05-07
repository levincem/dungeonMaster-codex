import type { Champion } from '../../types/champion';
import type {
    ChampionCombat,
    ChampionVitals,
    ActivePoisonCloud,
    PartyShield,
    ActivePotionBoost,
    DamageEvent,
    SpellVisualEvent,
} from '../runtimeTypes';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';

type TickPoisonCloudsState = {
    activePoisonClouds: ActivePoisonCloud[];
    creatures: CreatureInstance[];
    level: number;
    position: [number, number];
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat: Record<number, ChampionCombat>;
};

type PartyBacklashPatch = {
    party?: Champion[];
    championVitals?: Record<number, ChampionVitals>;
    championInventories?: Record<number, FloorItem[]>;
    championEquipment?: Record<number, ChampionEquipment>;
    floorItems?: FloorItem[];
    deadChampions?: Record<number, Champion>;
    selectedChampionIndex?: number;
    damageEvents?: DamageEvent[];
};

type DroppedCreatureState = {
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
};

type TickPoisonCloudDeps = {
    rollPoisonCloudPulseAttack: (remainingAttack: number) => number;
    applyPartyWideIncomingAttack: (
        state: {
            level: number;
            position: [number, number];
            party: Champion[];
            championInventories: Record<number, FloorItem[]>;
            championEquipment: Record<number, ChampionEquipment>;
            floorItems: FloorItem[];
            deadChampions: Record<number, Champion>;
            selectedChampionIndex: number;
            damageEvents: DamageEvent[];
            activeShields: PartyShield[];
            activePotionBoosts: ActivePotionBoost[];
            championCombat: Record<number, ChampionCombat>;
        },
        championVitals: Record<number, ChampionVitals>,
        attack: number,
        now: number,
    ) => PartyBacklashPatch | null;
    getCreaturePoisonAdjustedAttack: (typeId: number, attack: number) => number;
    buildCreatureDamageEvent: (
        level: number,
        x: number,
        y: number,
        amount: number,
        creatureId?: string,
    ) => DamageEvent;
    dropCreatureCarriedItems: (
        creatures: CreatureInstance[],
        floorItems: FloorItem[],
        creatureId: string,
    ) => DroppedCreatureState;
    normalizeCreatureCellsOnTile: (
        creatures: CreatureInstance[],
        level: number,
        x: number,
        y: number,
    ) => CreatureInstance[];
    buildDeathDustEvent: (level: number, x: number, y: number) => SpellVisualEvent;
};

export type TickPoisonCloudsResult = {
    activePoisonClouds: ActivePoisonCloud[];
    creatures: CreatureInstance[];
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
};

export function tickPoisonClouds(
    state: TickPoisonCloudsState,
    currentGameTick: number,
    now: number,
    deps: TickPoisonCloudDeps,
): TickPoisonCloudsResult {
    let creatures = state.creatures;
    let party = state.party;
    let championVitals = state.championVitals;
    let championInventories = state.championInventories;
    let championEquipment = state.championEquipment;
    let floorItems = state.floorItems;
    let deadChampions = state.deadChampions;
    let selectedChampionIndex = state.selectedChampionIndex;
    let damageEvents = state.damageEvents;
    let spellVisualEvents = state.spellVisualEvents;
    let activePoisonClouds = state.activePoisonClouds;

    if (activePoisonClouds.length === 0) {
        return {
            activePoisonClouds,
            creatures,
            party,
            championVitals,
            championInventories,
            championEquipment,
            floorItems,
            deadChampions,
            selectedChampionIndex,
            damageEvents,
            spellVisualEvents,
        };
    }

    const nextPoisonClouds: ActivePoisonCloud[] = [];

    for (const cloud of activePoisonClouds) {
        let workingCloud: ActivePoisonCloud | null = cloud;
        while (workingCloud && workingCloud.nextPulseGameTick <= currentGameTick) {
            const pulseAttack = deps.rollPoisonCloudPulseAttack(workingCloud.remainingAttack);
            const onPartySquare =
                workingCloud.level === state.level &&
                state.position[1] === workingCloud.x &&
                state.position[0] === workingCloud.y;

            if (onPartySquare && pulseAttack > 0) {
                const backlash = deps.applyPartyWideIncomingAttack(
                    {
                        level: state.level,
                        position: state.position,
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
                    pulseAttack,
                    now,
                );
                if (backlash) {
                    party = backlash.party ?? party;
                    championVitals = backlash.championVitals ?? championVitals;
                    championInventories = backlash.championInventories ?? championInventories;
                    championEquipment = backlash.championEquipment ?? championEquipment;
                    floorItems = backlash.floorItems ?? floorItems;
                    deadChampions = backlash.deadChampions ?? deadChampions;
                    selectedChampionIndex = backlash.selectedChampionIndex ?? selectedChampionIndex;
                    damageEvents = backlash.damageEvents ?? damageEvents;
                }
            } else {
                const currentCloud = workingCloud;
                const hit = creatures.find(
                    (creature) =>
                        creature.alive &&
                        creature.mapIndex === currentCloud.level &&
                        creature.x === currentCloud.x &&
                        creature.y === currentCloud.y,
                );
                if (hit) {
                    const adjustedDamage = deps.getCreaturePoisonAdjustedAttack(hit.typeId, pulseAttack);
                    if (adjustedDamage > 0) {
                        const nextHP = Math.max(0, hit.currentHP - adjustedDamage);
                        const killed = nextHP <= 0;
                        if (creatures === state.creatures) creatures = [...creatures];
                        const idx = creatures.findIndex((creature) => creature.id === hit.id);
                        if (idx >= 0) creatures[idx] = { ...creatures[idx], currentHP: nextHP, alive: !killed };
                        damageEvents = [
                            ...damageEvents,
                            deps.buildCreatureDamageEvent(currentCloud.level, currentCloud.x, currentCloud.y, adjustedDamage, hit.id),
                        ];
                        if (killed) {
                            const dropped = deps.dropCreatureCarriedItems(creatures, floorItems, hit.id);
                            creatures = deps.normalizeCreatureCellsOnTile(
                                dropped.creatures,
                                currentCloud.level,
                                currentCloud.x,
                                currentCloud.y,
                            );
                            floorItems = dropped.floorItems;
                            spellVisualEvents = [
                                ...spellVisualEvents,
                                deps.buildDeathDustEvent(currentCloud.level, currentCloud.x, currentCloud.y),
                            ];
                        }
                    }
                }
            }

            if (workingCloud.remainingAttack >= 6) {
                workingCloud = {
                    ...workingCloud,
                    remainingAttack: workingCloud.remainingAttack - 3,
                    nextPulseGameTick: workingCloud.nextPulseGameTick + 1,
                };
            } else {
                workingCloud = null;
            }
        }

        if (workingCloud) nextPoisonClouds.push(workingCloud);
    }

    activePoisonClouds = nextPoisonClouds;

    return {
        activePoisonClouds,
        creatures,
        party,
        championVitals,
        championInventories,
        championEquipment,
        floorItems,
        deadChampions,
        selectedChampionIndex,
        damageEvents,
        spellVisualEvents,
    };
}
