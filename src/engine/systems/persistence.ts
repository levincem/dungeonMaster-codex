import type { Champion } from '../../types/champion';
import { APP_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from '../../appInfo';
import {
    getDungeonBootstrapSync,
    type RawDungeonBootstrap,
} from '../../data/dungeonData';
import {
    normalizeChampionTemporaryXP,
    normalizeChampionXP,
} from '../../data/skillProgression';
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
import { DEFAULT_GAME_OPTIONS } from '../options';
import {
    buildInitialChampionXP,
    isLegacyChampionXPForChampion,
    normalizeChampionVitalsForChampion,
} from './championState';
import { sanitizeOpenTeleporterKeys } from './disabledTeleporters';

export interface PersistableGameState {
    gameOptions: import('../runtimeTypes').GameOptions;
    level: number;
    position: [number, number];
    direction: Direction;
    party: Champion[];
    gateOpen: boolean;
    hydratedLevels: Set<number>;
    openDoors: Set<string>;
    brokenDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    openWalls: Set<string>;
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    sensorRuntimeData: Record<string, number>;
    sensorRotationOffsets: Record<string, number>;
    visibleTexts: Set<string>;
    pendingSensorEvents: unknown[];
    pendingGeneratorSpawns: unknown[];
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

function normalizeChargedPersistedItem(
    item: FloorItem,
    params: {
        when: (item: FloorItem) => boolean;
        clampTo: number;
        defaultCharges: number;
        resolveCategory: (charges: number) => FloorItem['category'];
        resolveTypeId: (charges: number) => number;
    },
): FloorItem | null {
    if (!params.when(item)) return null;
    const charges = Math.max(0, Math.min(params.clampTo, item.waterCharges ?? params.defaultCharges));
    return {
        ...item,
        category: params.resolveCategory(charges),
        typeId: params.resolveTypeId(charges),
        waterCharges: charges,
        waterMaxCharges: params.clampTo,
    };
}

function normalizePersistedItem(item: FloorItem): FloorItem {
    const waterskin = normalizeChargedPersistedItem(item, {
        when: (currentItem) =>
            (currentItem.category === 'Potion' && currentItem.typeId === 24)
            || (currentItem.category === 'Misc' && currentItem.typeId === 1),
        clampTo: 4,
        defaultCharges: item.category === 'Potion' ? 4 : 0,
        resolveCategory: (charges) => charges > 0 ? 'Potion' : 'Misc',
        resolveTypeId: (charges) => charges > 0 ? 24 : 1,
    });
    if (waterskin) return waterskin;

    const flask = normalizeChargedPersistedItem(item, {
        when: (currentItem) =>
            currentItem.category === 'Potion' && (currentItem.typeId === 15 || currentItem.typeId === 20),
        clampTo: 1,
        defaultCharges: item.typeId === 15 ? 1 : 0,
        resolveCategory: () => 'Potion',
        resolveTypeId: (charges) => charges > 0 ? 15 : 20,
    });
    if (flask) return flask;

    const bomb = normalizeChargedPersistedItem(item, {
        when: (currentItem) =>
            currentItem.category === 'Misc' && (currentItem.typeId === 40 || currentItem.typeId === 41),
        clampTo: 1,
        defaultCharges: item.typeId === 41 ? 1 : 0,
        resolveCategory: () => 'Misc',
        resolveTypeId: (charges) => charges > 0 ? 41 : 40,
    });
    if (bomb) return bomb;

    return item;
}

function normalizePersistedItems(items: FloorItem[] | undefined): FloorItem[] {
    return (items ?? []).map(normalizePersistedItem);
}

function normalizePersistedInventories(
    inventories: Record<number, FloorItem[]> | undefined,
): Record<number, FloorItem[]> {
    return Object.fromEntries(
        Object.entries(inventories ?? {}).map(([championId, items]) => [
            championId,
            normalizePersistedItems(items),
        ]),
    );
}

function normalizePersistedEquipment(
    equipmentByChampion: Record<number, ChampionEquipment> | undefined,
): Record<number, ChampionEquipment> {
    return Object.fromEntries(
        Object.entries(equipmentByChampion ?? {}).map(([championId, equipment]) => [
            championId,
            Object.fromEntries(
                Object.entries(equipment ?? {}).map(([slotKey, item]) => [
                    slotKey,
                    item ? normalizePersistedItem(item) : item,
                ]),
            ) as ChampionEquipment,
        ]),
    );
}

function getDungeonBootstrap(): RawDungeonBootstrap {
    return getDungeonBootstrapSync<RawDungeonBootstrap>();
}

function buildDefaultOpenPits(): Set<string> {
    return new Set<string>(getDungeonBootstrap().defaultOpenPits ?? []);
}

function buildDefaultOpenTeleporters(): Set<string> {
    return sanitizeOpenTeleporterKeys(getDungeonBootstrap().defaultOpenTeleporters ?? []);
}

function buildDefaultVisibleTexts(): Set<string> {
    return new Set<string>(getDungeonBootstrap().defaultVisibleTexts ?? []);
}

function buildDefaultHydratedLevels(): Set<number> {
    return new Set<number>((getDungeonBootstrap().maps ?? []).map((map) => map.index));
}

export type PersistedSaveInspection =
    | { status: 'missing' }
    | { status: 'corrupt' }
    | { status: 'incompatible'; foundVersion?: number; buildVersion?: string }
    | { status: 'compatible'; data: PersistedSaveData };

type PersistedSaveDataWithoutIntegrity = Omit<PersistedSaveData, 'integrity'>;

function stripIntegrity(data: PersistedSaveData): PersistedSaveDataWithoutIntegrity {
    const { integrity, ...rest } = data;
    void integrity;
    return rest;
}

function computeIntegrityHash(input: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function computePersistedSaveIntegrity(data: PersistedSaveDataWithoutIntegrity): string {
    return computeIntegrityHash(JSON.stringify(data));
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

    const baseData: PersistedSaveDataWithoutIntegrity = {
        version: CURRENT_SAVE_SCHEMA_VERSION,
        buildVersion: APP_VERSION,
        savedAt: now,
        gameOptions: state.gameOptions,
        level: state.level,
        position: state.position,
        direction: state.direction,
        party: state.party,
        gateOpen: state.gateOpen,
        hydratedLevels: [...state.hydratedLevels].sort((left, right) => left - right),
        openDoors: [...state.openDoors],
        brokenDoors: [...state.brokenDoors],
        openPits: [...state.openPits],
        openTeleporters: [...sanitizeOpenTeleporterKeys(state.openTeleporters)],
        openWalls: [...state.openWalls],
        activeSensors: [...state.activeSensors],
        firedSensors: [...state.firedSensors],
        sensorRuntimeData: state.sensorRuntimeData,
        sensorRotationOffsets: state.sensorRotationOffsets,
        visibleTexts: [...state.visibleTexts],
        pendingSensorEvents: state.pendingSensorEvents,
        pendingGeneratorSpawns: state.pendingGeneratorSpawns,
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

    return {
        ...baseData,
        integrity: computePersistedSaveIntegrity(baseData),
    };
}

export function inspectPersistedSaveData(raw: string | null): PersistedSaveInspection {
    if (!raw) return { status: 'missing' };
    try {
        const parsed = JSON.parse(raw) as Partial<PersistedSaveData>;
        if (typeof parsed?.version !== 'number') return { status: 'corrupt' };
        if (parsed.version !== CURRENT_SAVE_SCHEMA_VERSION) {
            return {
                status: 'incompatible',
                foundVersion: parsed.version,
                buildVersion: typeof parsed.buildVersion === 'string' ? parsed.buildVersion : undefined,
            };
        }
        if (!Array.isArray(parsed.position) || parsed.position.length !== 2) return { status: 'corrupt' };
        if (!Array.isArray(parsed.party) || !Array.isArray(parsed.creatures) || !Array.isArray(parsed.floorItems)) {
            return { status: 'corrupt' };
        }
        if (parsed.integrity !== undefined) {
            if (typeof parsed.integrity !== 'string') return { status: 'corrupt' };
            const saveData = parsed as PersistedSaveData;
            const expectedIntegrity = computePersistedSaveIntegrity(stripIntegrity(saveData));
            if (parsed.integrity !== expectedIntegrity) return { status: 'corrupt' };
        }
        return { status: 'compatible', data: parsed as PersistedSaveData };
    } catch {
        return { status: 'corrupt' };
    }
}

export function tryParsePersistedSaveData(raw: string | null): PersistedSaveData | null {
    const inspection = inspectPersistedSaveData(raw);
    return inspection.status === 'compatible' ? inspection.data : null;
}

export function hydratePersistedGameState(
    data: PersistedSaveData,
    now = Date.now(),
): PersistableGameState {
    const normalizedFloorItems = normalizePersistedItems(data.floorItems);
    const normalizedChampionInventories = normalizePersistedInventories(data.championInventories);
    const normalizedChampionEquipment = normalizePersistedEquipment(data.championEquipment);
    const championXP = Object.fromEntries(
        data.party.map((champion) => {
            const loaded = normalizeChampionXP(data.championXP?.[champion.id]);
            const migrated = isLegacyChampionXPForChampion(champion, loaded)
                ? buildInitialChampionXP(champion)
                : loaded;
            return [champion.id, migrated];
        }),
    );
    const championTemporaryXP = Object.fromEntries(
        data.party.map((champion) => [
            champion.id,
            normalizeChampionTemporaryXP(data.championTemporaryXP?.[champion.id]),
        ]),
    );

    return {
        gameOptions: data.gameOptions ?? DEFAULT_GAME_OPTIONS,
        level: data.level,
        position: data.position,
        direction: data.direction,
        party: data.party,
        gateOpen: data.gateOpen,
        hydratedLevels: new Set<number>(data.hydratedLevels ?? [...buildDefaultHydratedLevels()]),
        openDoors: new Set<string>(data.openDoors),
        brokenDoors: new Set<string>(data.brokenDoors ?? []),
        openPits: new Set<string>(data.openPits ?? [...buildDefaultOpenPits()]),
        openTeleporters: sanitizeOpenTeleporterKeys(data.openTeleporters ?? [...buildDefaultOpenTeleporters()]),
        openWalls: new Set<string>(data.openWalls),
        activeSensors: new Set<string>(data.activeSensors),
        firedSensors: new Set<string>(data.firedSensors),
        sensorRuntimeData: data.sensorRuntimeData ?? {},
        sensorRotationOffsets: data.sensorRotationOffsets ?? {},
        visibleTexts: new Set<string>(data.visibleTexts ?? [...buildDefaultVisibleTexts()]),
        pendingSensorEvents: data.pendingSensorEvents ?? [],
        pendingGeneratorSpawns: data.pendingGeneratorSpawns ?? [],
        creatures: data.creatures,
        floorItems: normalizedFloorItems,
        championInventories: normalizedChampionInventories,
        championEquipment: normalizedChampionEquipment,
        championVitals: Object.fromEntries(
            data.party
                .map((champion) => {
                    const vitals = data.championVitals[champion.id];
                    return vitals ? [champion.id, normalizeChampionVitalsForChampion(champion, vitals)] : null;
                })
                .filter((entry): entry is [number, ChampionVitals] => entry !== null),
        ),
        championManaRegenBlockedUntilTick: data.championManaRegenBlockedUntilTick ?? {},
        elapsedGameTimeTicks: data.elapsedGameTimeTicks,
        regenTickRemainder: data.regenTickRemainder,
        lastSurvivalEffectGameTick: data.lastSurvivalEffectGameTick ?? data.elapsedGameTimeTicks,
        freezeLifeRemainingTicks: Math.max(0, data.freezeLifeRemainingTicks ?? 0),
        lastPartyMoveGameTick: data.lastPartyMoveGameTick,
        movementCooldown: data.movementCooldown,
        championXP,
        championTemporaryXP,
        championCombat: data.championCombat,
        crushingDoors: data.crushingDoors,
        torchBurnStart: Object.fromEntries(
            Object.entries(data.torchBurnElapsed).map(([itemId, elapsed]) => [itemId, now - elapsed]),
        ),
        spellLights: data.spellLights
            .map((light) => ({ id: light.id, lightContrib: light.lightContrib, expiresAt: now + light.remainingMs }))
            .filter((light) => light.expiresAt > now),
        projectiles: data.projectiles.map((projectile) => {
            const { nextMoveInMs, ...rest } = projectile;
            return {
                ...rest,
                remainingAttack:
                    rest.remainingAttack ?? (rest.effect !== 'physical' ? 90 : rest.remainingAttack),
                nextMoveAt: now + nextMoveInMs,
            };
        }),
        activePoisonClouds: data.activePoisonClouds ?? [],
        activeShields: data.activeShields
            .map((shield) => {
                const { remainingMs, ...rest } = shield;
                return { ...rest, expiresAt: now + remainingMs };
            })
            .filter((shield) => shield.expiresAt > now),
        activePotionBoosts: (data.activePotionBoosts ?? [])
            .map((boost) => {
                const { remainingMs, ...rest } = boost;
                return { ...rest, expiresAt: now + remainingMs };
            })
            .filter((boost) => boost.expiresAt > now),
        invisibleUntil: data.invisibleRemainingMs > 0 ? now + data.invisibleRemainingMs : 0,
        magicVisionUntil: data.magicVisionRemainingMs > 0 ? now + data.magicVisionRemainingMs : 0,
        seeThroughWallsUntil: data.seeThroughWallsRemainingMs > 0 ? now + data.seeThroughWallsRemainingMs : 0,
        footprintsUntil: data.footprintsRemainingMs > 0 ? now + data.footprintsRemainingMs : 0,
        footprintHistory: data.footprintHistory,
        deadChampions: data.deadChampions,
        lastCreatureAttackGameTick: data.lastCreatureAttackGameTick ?? 0,
    };
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
