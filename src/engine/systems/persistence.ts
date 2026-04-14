import type { Champion } from '../../data/champions';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionCombat,
    ChampionTemporaryXP,
    ChampionVitals,
    ChampionXP,
    Direction,
    FootprintEntry,
    PartyShield,
    PersistedCreatureTimers,
    PersistedSaveData,
    Projectile,
    SpellLight,
} from '../runtimeTypes';

export interface PersistableGameState {
    gameOptions: import('../runtimeTypes').GameOptions;
    level: number;
    position: [number, number];
    direction: Direction;
    party: Champion[];
    gateOpen: boolean;
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    pendingSensorEvents: unknown[];
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, ChampionVitals>;
    championManaRegenBlockedUntilTick: Record<number, number>;
    elapsedGameTimeTicks: number;
    regenTickRemainder: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
    lastPartyMoveGameTick: number;
    movementCooldown: number;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    championCombat: Record<number, ChampionCombat>;
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    torchBurnStart: Record<string, number>;
    spellLights: SpellLight[];
    projectiles: Projectile[];
    activePoisonClouds: ActivePoisonCloud[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    invisibleUntil: number;
    magicVisionUntil: number;
    seeThroughWallsUntil: number;
    footprintsUntil: number;
    footprintHistory: FootprintEntry[];
    deadChampions: Record<number, Champion>;
    lastCreatureAttackGameTick: number;
}

export interface CreatureRuntimeMaps {
    creatureTimers: Map<string, { mt: number; at: number }>;
    creatureAttackWindows: Map<string, number>;
    creatureConfusedUntil: Map<string, number>;
    creatureFluxcageUntil: Map<string, number>;
    creatureFrightenedUntil: Map<string, number>;
    creatureLastSeenPartyPos: Map<string, { x: number; y: number; expiresAt: number }>;
}

export function buildPersistedSaveData(
    state: PersistableGameState,
    runtime: CreatureRuntimeMaps,
): PersistedSaveData {
    const now = Date.now();
    const timerIds = new Set<string>([
        ...state.creatures.map((creature) => creature.id),
        ...runtime.creatureTimers.keys(),
        ...runtime.creatureAttackWindows.keys(),
        ...runtime.creatureConfusedUntil.keys(),
        ...runtime.creatureFluxcageUntil.keys(),
        ...runtime.creatureFrightenedUntil.keys(),
    ]);
    const serializedCreatureTimers: Record<string, PersistedCreatureTimers> = {};
    for (const id of timerIds) {
        const timers = runtime.creatureTimers.get(id);
        serializedCreatureTimers[id] = {
            moveRemaining: Math.max(0, timers?.mt ?? 0),
            attackRemaining: Math.max(0, timers?.at ?? 0),
            attackWindowRemainingMs: Math.max(0, (runtime.creatureAttackWindows.get(id) ?? 0) - now),
            confusedRemainingMs: Math.max(0, (runtime.creatureConfusedUntil.get(id) ?? 0) - now),
            fluxcageRemainingMs: Math.max(0, (runtime.creatureFluxcageUntil.get(id) ?? 0) - now),
            frightenedRemainingMs: Math.max(0, (runtime.creatureFrightenedUntil.get(id) ?? 0) - now),
            lastSeenPartyX: runtime.creatureLastSeenPartyPos.get(id)?.x,
            lastSeenPartyY: runtime.creatureLastSeenPartyPos.get(id)?.y,
            lastSeenPartyRemainingMs: Math.max(0, (runtime.creatureLastSeenPartyPos.get(id)?.expiresAt ?? 0) - now),
        };
    }

    return {
        version: 1,
        savedAt: now,
        gameOptions: state.gameOptions,
        level: state.level,
        position: state.position,
        direction: state.direction,
        party: state.party,
        gateOpen: state.gateOpen,
        openDoors: [...state.openDoors],
        openPits: [...state.openPits],
        openTeleporters: [...state.openTeleporters],
        openWalls: [...state.openWalls],
        activeSensors: [...state.activeSensors],
        firedSensors: [...state.firedSensors],
        sensorRuntimeData: state.sensorRuntimeData,
        sensorRotationOffsets: state.sensorRotationOffsets,
        visibleTexts: [...state.visibleTexts],
        pendingSensorEvents: state.pendingSensorEvents,
        creatures: state.creatures,
        floorItems: state.floorItems,
        championInventories: state.championInventories,
        championEquipment: state.championEquipment,
        championVitals: state.championVitals,
        championManaRegenBlockedUntilTick: state.championManaRegenBlockedUntilTick,
        elapsedGameTimeTicks: state.elapsedGameTimeTicks,
        regenTickRemainder: state.regenTickRemainder,
        lastSurvivalEffectGameTick: state.lastSurvivalEffectGameTick,
        freezeLifeRemainingTicks: state.freezeLifeRemainingTicks,
        lastPartyMoveGameTick: state.lastPartyMoveGameTick,
        movementCooldown: state.movementCooldown,
        championXP: state.championXP,
        championTemporaryXP: state.championTemporaryXP,
        championCombat: state.championCombat,
        crushingDoors: state.crushingDoors,
        torchBurnElapsed: Object.fromEntries(
            Object.entries(state.torchBurnStart).map(([itemId, litAt]) => [itemId, Math.max(0, now - litAt)]),
        ),
        spellLights: state.spellLights.map((light) => ({
            id: light.id,
            lightContrib: light.lightContrib,
            remainingMs: Math.max(0, light.expiresAt - now),
        })),
        projectiles: state.projectiles.map((projectile) => ({
            ...projectile,
            nextMoveInMs: Math.max(0, projectile.nextMoveAt - now),
        })),
        activePoisonClouds: state.activePoisonClouds,
        activeShields: state.activeShields.map((shield) => ({
            ...shield,
            remainingMs: Math.max(0, shield.expiresAt - now),
        })),
        activePotionBoosts: state.activePotionBoosts.map((boost) => ({
            ...boost,
            remainingMs: Math.max(0, boost.expiresAt - now),
        })),
        invisibleRemainingMs: Math.max(0, state.invisibleUntil - now),
        magicVisionRemainingMs: Math.max(0, state.magicVisionUntil - now),
        seeThroughWallsRemainingMs: Math.max(0, state.seeThroughWallsUntil - now),
        footprintsRemainingMs: Math.max(0, state.footprintsUntil - now),
        footprintHistory: state.footprintHistory,
        deadChampions: state.deadChampions,
        lastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
        creatureTimers: serializedCreatureTimers,
    };
}

export function tryParsePersistedSaveData(raw: string | null): PersistedSaveData | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PersistedSaveData;
        if (parsed?.version !== 1) return null;
        if (!Array.isArray(parsed.position) || parsed.position.length !== 2) return null;
        if (!Array.isArray(parsed.party) || !Array.isArray(parsed.creatures) || !Array.isArray(parsed.floorItems)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function restoreExternalCreatureRuntimeFromSave(
    data: PersistedSaveData,
    runtime: CreatureRuntimeMaps,
): void {
    const now = Date.now();
    runtime.creatureTimers.clear();
    runtime.creatureAttackWindows.clear();
    runtime.creatureConfusedUntil.clear();
    runtime.creatureFluxcageUntil.clear();
    runtime.creatureFrightenedUntil.clear();
    runtime.creatureLastSeenPartyPos.clear();

    for (const [id, timers] of Object.entries(data.creatureTimers)) {
        runtime.creatureTimers.set(id, {
            mt: Math.max(0, timers.moveRemaining),
            at: Math.max(0, timers.attackRemaining),
        });
        if (timers.attackWindowRemainingMs > 0) {
            runtime.creatureAttackWindows.set(id, now + timers.attackWindowRemainingMs);
        }
        if (timers.confusedRemainingMs > 0) {
            runtime.creatureConfusedUntil.set(id, now + timers.confusedRemainingMs);
        }
        if (timers.fluxcageRemainingMs > 0) {
            runtime.creatureFluxcageUntil.set(id, now + timers.fluxcageRemainingMs);
        }
        if ((timers.frightenedRemainingMs ?? 0) > 0) {
            runtime.creatureFrightenedUntil.set(id, now + (timers.frightenedRemainingMs ?? 0));
        }
        if (
            timers.lastSeenPartyRemainingMs &&
            timers.lastSeenPartyRemainingMs > 0 &&
            Number.isFinite(timers.lastSeenPartyX) &&
            Number.isFinite(timers.lastSeenPartyY)
        ) {
            runtime.creatureLastSeenPartyPos.set(id, {
                x: timers.lastSeenPartyX!,
                y: timers.lastSeenPartyY!,
                expiresAt: now + timers.lastSeenPartyRemainingMs,
            });
        }
    }
}
