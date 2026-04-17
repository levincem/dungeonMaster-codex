import type { SpellDef } from '../../data/runes';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    PartyShield,
    SpellLight,
    SpellVisualEvent,
} from '../runtimeTypes';
import { runCastSpellRuntime } from './castSpellRuntime';

type CastSpellCommandRuntimeState = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championEquipment: Record<number, ChampionEquipment>;
    championCombat: Record<number, ChampionCombat>;
    activePotionBoosts: ActivePotionBoost[];
    activeShields: PartyShield[];
    floorItems: FloorItem[];
    spellLights: SpellLight[];
    spellVisualEvents: SpellVisualEvent[];
    activePoisonClouds: ActivePoisonCloud[];
    openDoors: Set<string>;
    openWalls: Set<string>;
    invisibleUntil: number;
    seeThroughWallsUntil: number;
    magicVisionUntil: number;
    footprintsUntil: number;
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    elapsedGameTimeTicks: number;
    projectiles: import('../runtimeTypes').Projectile[];
};

type CastSpellCommandRuntimeResult<TPatch> = {
    patch: TPatch;
    shouldPlayDoorMotion?: boolean;
    doorMotionSquare?: {
        level: number;
        x: number;
        y: number;
    };
};

type PreparedCastResult<TPatch> =
    | { kind: 'blocked'; patch: TPatch }
    | {
        kind: 'ready';
        basePatch: TPatch;
        castSucceeded: boolean;
        nextVitals: ChampionVitals;
        skillLevel: number;
    };

type CastSpellCommandRuntimeDeps<TPatch> = {
    findSpell: (runeIds: string[]) => SpellDef | null | undefined;
    buildUnknownCombinationPatch: (now: number) => TPatch;
    prepareCast: (
        state: CastSpellCommandRuntimeState,
        championId: number,
        spell: SpellDef,
        champion: Champion,
        vitals: ChampionVitals,
        now: number,
    ) => PreparedCastResult<TPatch>;
    buildFailedCastPatch: (
        state: CastSpellCommandRuntimeState,
        championId: number,
        basePatch: TPatch,
        nextVitals: ChampionVitals,
    ) => TPatch;
    buildNonProjectilePatch: (
        state: CastSpellCommandRuntimeState,
        championId: number,
        spell: SpellDef,
        nextVitals: ChampionVitals,
        champion: Champion,
        now: number,
    ) => TPatch | null;
    buildProjectilePatch: (
        state: CastSpellCommandRuntimeState,
        championId: number,
        spell: SpellDef,
        nextVitals: ChampionVitals,
        skillLevel: number,
        champion: Champion,
        now: number,
    ) => CastSpellCommandRuntimeResult<TPatch> | null;
    mergeBasePatch: (basePatch: TPatch, nextPatch: TPatch) => TPatch;
};

export function buildCastSpellCommandRuntimeResult<TPatch>(
    state: CastSpellCommandRuntimeState,
    championId: number,
    runeIds: string[],
    now: number,
    deps: CastSpellCommandRuntimeDeps<TPatch>,
): CastSpellCommandRuntimeResult<TPatch> | null {
    return runCastSpellRuntime<SpellDef, TPatch>(
        state,
        championId,
        runeIds,
        {
            findSpell: deps.findSpell,
            buildUnknownCombinationPatch: () => deps.buildUnknownCombinationPatch(now),
            prepareCast: (spell, champion, vitals) =>
                deps.prepareCast(state, championId, spell, champion, vitals, now),
            buildFailedCastPatch: (basePatch, nextVitals) =>
                deps.buildFailedCastPatch(state, championId, basePatch, nextVitals),
            buildNonProjectilePatch: (spell, nextVitals, champion) =>
                deps.buildNonProjectilePatch(state, championId, spell, nextVitals, champion, now),
            buildProjectilePatch: (spell, nextVitals, skillLevel, champion) =>
                deps.buildProjectilePatch(state, championId, spell, nextVitals, skillLevel, champion, now),
            mergeBasePatch: deps.mergeBasePatch,
        },
    );
}
