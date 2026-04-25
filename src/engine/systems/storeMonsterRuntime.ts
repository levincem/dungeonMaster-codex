import type { CreatureDef } from '../../data/creatures';
import type { ChampionTemporaryXP, ChampionXP, SkillKey } from '../../data/skillProgression';
import type { CreatureInstance, GameMap } from '../../types/game';
import { runMonsterTickRuntime } from './monsterTickRuntime';

type MonsterTickRuntimeState = Parameters<typeof runMonsterTickRuntime>[0];
type MonsterTickRuntimeDeps = Parameters<typeof runMonsterTickRuntime>[2];

type RuntimeTimer = { mt: number; at: number };
type RuntimeRememberedPartyPosition = { x: number; y: number; expiresAt: number };

type MonsterTickRuntimeInputState = MonsterTickRuntimeState;
type MonsterTickRuntimeStatefulDeps = Pick<
    MonsterTickRuntimeDeps,
    'resolveMonsterAttackAgainstChampion' | 'resolveCreatureTeleporterTransport'
>;

type CreateStoreMonsterTickRuntimeDepsParams = {
    getMap: (level: number) => GameMap;
    getCreatureDef: (typeId: number) => CreatureDef | undefined;
    randomFraction: () => number;
    randomInt: (maxExclusive: number) => number;
    creatureTimers: Map<string, RuntimeTimer>;
    creatureLastSeenPartyPos: Map<string, RuntimeRememberedPartyPosition>;
    creatureConfusedUntil: Map<string, number>;
    creatureFluxcageUntil: Map<string, number>;
    creatureFrightenedUntil: Map<string, number>;
    creatureAttackWindows: Map<string, number>;
    hasLineOfSight: MonsterTickRuntimeDeps['hasLineOfSight'];
    nextMonsterMoveDelaySeconds: MonsterTickRuntimeDeps['nextMonsterMoveDelaySeconds'];
    nextMonsterAttackDelaySeconds: MonsterTickRuntimeDeps['nextMonsterAttackDelaySeconds'];
    nextMonsterBehaviorUpdateAfterAttackDelaySeconds?: MonsterTickRuntimeDeps['nextMonsterBehaviorUpdateAfterAttackDelaySeconds'];
    canCreatureShareTile: MonsterTickRuntimeDeps['canCreatureShareTile'];
    canArchenemyDoubleMove: MonsterTickRuntimeDeps['canArchenemyDoubleMove'];
    chooseCreatureProjectileEffect: MonsterTickRuntimeDeps['chooseCreatureProjectileEffect'];
    getCreatureSizeOnTile: MonsterTickRuntimeDeps['getCreatureSizeOnTile'];
    isCreatureCellOccupiedOnTile: MonsterTickRuntimeDeps['isCreatureCellOccupiedOnTile'];
    buildProjectile: MonsterTickRuntimeDeps['buildProjectile'];
    getEffectiveChampionStats: MonsterTickRuntimeDeps['getEffectiveChampionStats'];
    tryStealChampionItem: MonsterTickRuntimeDeps['tryStealChampionItem'];
    resolveMonsterAttackAgainstChampion: MonsterTickRuntimeDeps['resolveMonsterAttackAgainstChampion'];
    buildChampionSkillExperiencePatch: (
        state: {
            level: number;
            party: import('../../types/champion').Champion[];
            championVitals: Record<number, import('../runtimeTypes').ChampionVitals>;
            championXP: Record<number, ChampionXP>;
            championTemporaryXP: Record<number, ChampionTemporaryXP>;
            elapsedGameTimeTicks: number;
            lastCreatureAttackGameTick: number;
        },
        championId: number,
        skill: SkillKey,
        amount: number,
    ) => {
        championVitals?: Record<number, import('../runtimeTypes').ChampionVitals>;
        championXP: Record<number, ChampionXP>;
        championTemporaryXP: Record<number, ChampionTemporaryXP>;
        party?: import('../../types/champion').Champion[];
    } | null;
    buildChampionDamageEvent: MonsterTickRuntimeDeps['buildChampionDamageEvent'];
    attackWindowMs: number;
    getTeleporter: MonsterTickRuntimeDeps['getTeleporter'];
    resolveCreatureTeleporterTransport: MonsterTickRuntimeDeps['resolveCreatureTeleporterTransport'];
    normalizeCreatureCellsOnTile: MonsterTickRuntimeDeps['normalizeCreatureCellsOnTile'];
    buildFrightenedUntilMs: (nowMs: number) => number;
    buildDeathDrop: MonsterTickRuntimeDeps['buildDeathDrop'];
    nowMs: () => number;
    playTeleport: () => void;
    playCreatureMove: (creatureTypeId: number) => void;
    playCreatureAttack: (creatureTypeId: number) => void;
    canHearCreature: (creature: CreatureInstance) => boolean;
    notifyCreatureAction: (creatureId: string, action: 'move' | 'attack') => void;
    playChampionWounded: () => void;
};

export function createStoreMonsterTickRuntimeState<TState extends MonsterTickRuntimeInputState>(
    state: TState,
): MonsterTickRuntimeState {
    return {
        level: state.level,
        position: state.position,
        direction: state.direction,
        party: state.party,
        championXP: state.championXP ?? {},
        championTemporaryXP: state.championTemporaryXP ?? {},
        creatures: state.creatures,
        championVitals: state.championVitals,
        damageEvents: state.damageEvents,
        championInventories: state.championInventories,
        championEquipment: state.championEquipment,
        projectiles: state.projectiles,
        activePotionBoosts: state.activePotionBoosts,
        invisibleUntil: state.invisibleUntil,
        openDoors: state.openDoors,
        openPits: state.openPits,
        openTeleporters: state.openTeleporters,
        openWalls: state.openWalls,
        sleeping: state.sleeping,
        freezeLifeRemainingTicks: state.freezeLifeRemainingTicks,
        lastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
        elapsedGameTimeTicks: state.elapsedGameTimeTicks,
        floorItems: state.floorItems,
        deadChampions: state.deadChampions,
        selectedChampionIndex: state.selectedChampionIndex,
        lastMonsterAttackDebug: state.lastMonsterAttackDebug,
    };
}

export function createStoreMonsterTickStatefulDeps<
    TState,
    TIncomingAttackDeps,
    TTerrainDeps,
>(
    state: TState,
    params: {
        resolveMonsterAttackAgainstChampionSystem: (
            attackArgs: Parameters<MonsterTickRuntimeDeps['resolveMonsterAttackAgainstChampion']>[0],
            deps: TIncomingAttackDeps,
        ) => ReturnType<MonsterTickRuntimeDeps['resolveMonsterAttackAgainstChampion']>;
        createIncomingAttackDeps: (state: TState) => TIncomingAttackDeps;
        resolveCreatureTeleporterTransportSystem: (
            teleporterState: Parameters<MonsterTickRuntimeDeps['resolveCreatureTeleporterTransport']>[0],
            level: Parameters<MonsterTickRuntimeDeps['resolveCreatureTeleporterTransport']>[1],
            x: Parameters<MonsterTickRuntimeDeps['resolveCreatureTeleporterTransport']>[2],
            y: Parameters<MonsterTickRuntimeDeps['resolveCreatureTeleporterTransport']>[3],
            direction: Parameters<MonsterTickRuntimeDeps['resolveCreatureTeleporterTransport']>[4],
            cell: Parameters<MonsterTickRuntimeDeps['resolveCreatureTeleporterTransport']>[5],
            creatureTypeId: Parameters<MonsterTickRuntimeDeps['resolveCreatureTeleporterTransport']>[6],
            terrainDeps: TTerrainDeps,
        ) => ReturnType<MonsterTickRuntimeDeps['resolveCreatureTeleporterTransport']>;
        buildTerrainTransportDeps: () => TTerrainDeps;
    },
): MonsterTickRuntimeStatefulDeps {
    return {
        resolveMonsterAttackAgainstChampion: (attackArgs) =>
            params.resolveMonsterAttackAgainstChampionSystem(
                attackArgs,
                params.createIncomingAttackDeps(state),
            ),
        resolveCreatureTeleporterTransport: (teleporterState, level, x, y, direction, cell, creatureTypeId) =>
            params.resolveCreatureTeleporterTransportSystem(
                teleporterState,
                level,
                x,
                y,
                direction,
                cell,
                creatureTypeId,
                params.buildTerrainTransportDeps(),
            ),
    };
}

export function createStoreMonsterTickRuntimeDeps(
    params: CreateStoreMonsterTickRuntimeDepsParams,
): MonsterTickRuntimeDeps {
    return {
        getMap: params.getMap,
        getCreatureDef: params.getCreatureDef,
        randomFraction: params.randomFraction,
        randomInt: params.randomInt,
        getCreatureTimers: (creatureId) => params.creatureTimers.get(creatureId),
        setCreatureTimers: (creatureId, timers) => {
            params.creatureTimers.set(creatureId, timers);
        },
        getCreatureLastSeenPartyPos: (creatureId) => params.creatureLastSeenPartyPos.get(creatureId),
        setCreatureLastSeenPartyPos: (creatureId, value) => {
            params.creatureLastSeenPartyPos.set(creatureId, value);
        },
        clearCreatureLastSeenPartyPos: (creatureId) => {
            params.creatureLastSeenPartyPos.delete(creatureId);
        },
        getCreatureConfusedUntil: (creatureId) => params.creatureConfusedUntil.get(creatureId),
        getCreatureFluxcageUntil: (creatureId) => params.creatureFluxcageUntil.get(creatureId),
        getCreatureFrightenedUntil: (creatureId) => params.creatureFrightenedUntil.get(creatureId),
        setCreatureFrightenedUntil: (creatureId, untilMs) => {
            params.creatureFrightenedUntil.set(creatureId, untilMs);
        },
        hasLineOfSight: params.hasLineOfSight,
        nextMonsterMoveDelaySeconds: params.nextMonsterMoveDelaySeconds,
        nextMonsterAttackDelaySeconds: params.nextMonsterAttackDelaySeconds,
        nextMonsterBehaviorUpdateAfterAttackDelaySeconds: params.nextMonsterBehaviorUpdateAfterAttackDelaySeconds,
        canCreatureShareTile: params.canCreatureShareTile,
        canArchenemyDoubleMove: params.canArchenemyDoubleMove,
        chooseCreatureProjectileEffect: params.chooseCreatureProjectileEffect,
        getCreatureSizeOnTile: params.getCreatureSizeOnTile,
        isCreatureCellOccupiedOnTile: params.isCreatureCellOccupiedOnTile,
        buildProjectile: params.buildProjectile,
        getEffectiveChampionStats: params.getEffectiveChampionStats,
        tryStealChampionItem: params.tryStealChampionItem,
        resolveMonsterAttackAgainstChampion: params.resolveMonsterAttackAgainstChampion,
        buildChampionSkillExperiencePatch: params.buildChampionSkillExperiencePatch,
        buildChampionDamageEvent: params.buildChampionDamageEvent,
        attackWindowMs: params.attackWindowMs,
        getTeleporter: params.getTeleporter,
        resolveCreatureTeleporterTransport: params.resolveCreatureTeleporterTransport,
        normalizeCreatureCellsOnTile: params.normalizeCreatureCellsOnTile,
        buildFrightenedUntilMs: params.buildFrightenedUntilMs,
        buildDeathDrop: params.buildDeathDrop,
        nowMs: params.nowMs,
        onCreatureMove: (creature, sound) => {
            if (sound === 'teleport') {
                if (params.canHearCreature(creature)) params.playTeleport();
            } else if (sound === 'creature' && params.canHearCreature(creature)) {
                params.playCreatureMove(creature.typeId);
            }
            params.notifyCreatureAction(creature.id, 'move');
        },
        onCreatureAttack: (creature, expiresAt) => {
            if (params.canHearCreature(creature)) params.playCreatureAttack(creature.typeId);
            params.notifyCreatureAction(creature.id, 'attack');
            params.creatureAttackWindows.set(creature.id, expiresAt);
        },
        onChampionWounded: () => {
            params.playChampionWounded();
        },
    };
}
