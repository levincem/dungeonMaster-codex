import type { CreatureDef } from '../../data/creatures';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem, GameMap } from '../../types/game';
import type { ActivePotionBoost, ChampionVitals, DamageEvent, Projectile } from '../runtimeTypes';
import type { CreatureMovementStateResult } from './creatureMovementState';
import { processMonsterTickChampionDeaths } from './monsterDeathProcessing';
import { resolveMonsterSingleTurn } from './monsterSingleTurn';
import { buildTickMonstersPatch } from './tickMonstersFinalize';

type RuntimeTimer = { mt: number; at: number };
type RuntimeRememberedPartyPosition = { x: number; y: number; expiresAt: number };

type MonsterTickRuntimeState = {
    level: number;
    position: [number, number];
    party: Champion[];
    creatures: CreatureInstance[];
    championVitals: Record<number, ChampionVitals>;
    damageEvents: DamageEvent[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    projectiles: Projectile[];
    activePotionBoosts: ActivePotionBoost[];
    invisibleUntil: number;
    openDoors: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
    sleeping: boolean;
    freezeLifeRemainingTicks: number;
    lastCreatureAttackGameTick: number;
    elapsedGameTimeTicks: number;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
};

type MonsterTickRuntimeDeps = {
    getMap: (level: number) => GameMap;
    getCreatureDef: (typeId: number) => CreatureDef | undefined;
    randomFraction: () => number;
    randomInt: (maxExclusive: number) => number;
    getCreatureTimers: (creatureId: string) => RuntimeTimer | undefined;
    setCreatureTimers: (creatureId: string, timers: RuntimeTimer) => void;
    getCreatureLastSeenPartyPos: (creatureId: string) => RuntimeRememberedPartyPosition | undefined;
    setCreatureLastSeenPartyPos: (creatureId: string, value: RuntimeRememberedPartyPosition) => void;
    clearCreatureLastSeenPartyPos: (creatureId: string) => void;
    getCreatureConfusedUntil: (creatureId: string) => number | undefined;
    getCreatureFluxcageUntil: (creatureId: string) => number | undefined;
    getCreatureFrightenedUntil: (creatureId: string) => number | undefined;
    setCreatureFrightenedUntil: (creatureId: string, untilMs: number) => void;
    hasLineOfSight: (
        map: GameMap,
        level: number,
        openDoors: Set<string>,
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
    ) => boolean;
    nextMonsterMoveDelaySeconds: (moveTicks: number) => number;
    nextMonsterAttackDelaySeconds: (attackTicks: number) => number;
    canCreatureShareTile: (
        creature: CreatureInstance,
        level: number,
        x: number,
        y: number,
        creatures: CreatureInstance[],
    ) => boolean;
    canArchenemyDoubleMove: (
        creature: CreatureInstance,
        level: number,
        x: number,
        y: number,
        direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST',
        creatures: CreatureInstance[],
        monsterWalkable: (level: number, y: number, x: number) => boolean,
    ) => { x: number; y: number } | null;
    chooseCreatureProjectileEffect: Parameters<typeof resolveMonsterSingleTurn>[1]['chooseCreatureProjectileEffect'];
    getCreatureSizeOnTile: Parameters<typeof resolveMonsterSingleTurn>[1]['getCreatureSizeOnTile'];
    isCreatureCellOccupiedOnTile: Parameters<typeof resolveMonsterSingleTurn>[1]['isCreatureCellOccupiedOnTile'];
    buildProjectile: Parameters<typeof resolveMonsterSingleTurn>[1]['buildProjectile'];
    getEffectiveChampionStats: Parameters<typeof resolveMonsterSingleTurn>[1]['getEffectiveChampionStats'];
    tryStealChampionItem: Parameters<typeof resolveMonsterSingleTurn>[1]['tryStealChampionItem'];
    resolveMonsterAttackAgainstChampion: Parameters<typeof resolveMonsterSingleTurn>[1]['resolveMonsterAttackAgainstChampion'];
    buildChampionDamageEvent: Parameters<typeof resolveMonsterSingleTurn>[1]['buildChampionDamageEvent'];
    attackWindowMs: number;
    getTeleporter: Parameters<typeof resolveMonsterSingleTurn>[1]['getTeleporter'];
    resolveCreatureTeleporterTransport: Parameters<typeof resolveMonsterSingleTurn>[1]['resolveCreatureTeleporterTransport'];
    normalizeCreatureCellsOnTile: Parameters<typeof resolveMonsterSingleTurn>[1]['normalizeCreatureCellsOnTile'];
    buildFrightenedUntilMs: (nowMs: number) => number;
    buildDeathDrop: (
        state: {
            level: number;
            position: [number, number];
            party: Champion[];
            championInventories: Record<number, FloorItem[]>;
            championEquipment: Record<number, ChampionEquipment>;
            floorItems: FloorItem[];
            deadChampions: Record<number, Champion>;
        },
        championId: number,
        nowMs: number,
    ) => {
        party: Champion[];
        championInventories: Record<number, FloorItem[]>;
        championEquipment: Record<number, ChampionEquipment>;
        floorItems: FloorItem[];
        deadChampions: Record<number, Champion>;
    };
    nowMs: () => number;
    onCreatureMove: (creatureId: string, creatureTypeId: number, sound: 'teleport' | 'creature' | null) => void;
    onCreatureAttack: (creatureId: string, creatureTypeId: number, expiresAt: number) => void;
    onChampionWounded: () => void;
};

export function runMonsterTickRuntime(
    state: MonsterTickRuntimeState,
    deltaSeconds: number,
    deps: MonsterTickRuntimeDeps,
): Record<string, unknown> | null {
    const [py, px] = state.position;
    const map = deps.getMap(state.level);

    const monsterWalkable = (level: number, y: number, x: number): boolean => {
        const levelMap = deps.getMap(level);
        if (y < 0 || y >= levelMap.height || x < 0 || x >= levelMap.width) return false;
        const tile = levelMap.tiles[y]?.[x];
        if (!tile || tile.type === 'Wall' || tile.type === 'TrickWall') return false;
        if (tile.type === 'Door') return state.openDoors.has(`${level},${y},${x}`);
        if (tile.type === 'Pit') return !state.openPits.has(`${level},${y},${x}`);
        return true;
    };

    let creatures = state.creatures as CreatureInstance[];
    let championVitals = state.championVitals;
    let damageEvents = state.damageEvents;
    let championInventories = state.championInventories;
    let championEquipment = state.championEquipment;
    let projectiles = state.projectiles;
    let lastCreatureAttackGameTick = state.lastCreatureAttackGameTick;
    const newlyDead: number[] = [];
    const groupMovementPlans = new Map<string, CreatureMovementStateResult>();

    for (let i = 0; i < creatures.length; i++) {
        const creature = creatures[i];
        if (!creature.alive || creature.mapIndex !== state.level) continue;
        const creatureDef = deps.getCreatureDef(creature.typeId);
        if (!creatureDef) continue;
        if (state.freezeLifeRemainingTicks > 0 && !creatureDef.archenemy) continue;

        const nowMs = deps.nowMs();
        const turn = resolveMonsterSingleTurn(
            {
                creature,
                creatureIndex: i,
                creatureDef,
                deltaSeconds,
                nowMs,
                level: state.level,
                levelDifficulty: deps.getMap(state.level).difficulty * 2,
                partyPosition: state.position,
                party: state.party,
                activePotionBoosts: state.activePotionBoosts,
                invisibleUntil: state.invisibleUntil,
                openTeleporters: state.openTeleporters,
                currentTimers: deps.getCreatureTimers(creature.id),
                lastSeen: deps.getCreatureLastSeenPartyPos(creature.id),
                confusedUntilMs: deps.getCreatureConfusedUntil(creature.id) ?? 0,
                fluxcageUntilMs: deps.getCreatureFluxcageUntil(creature.id) ?? 0,
                frightenedUntilMs: deps.getCreatureFrightenedUntil(creature.id) ?? 0,
                creatures,
                stateCreatures: state.creatures,
                projectiles,
                stateProjectiles: state.projectiles,
                championInventories,
                championEquipment,
                baseChampionEquipment: state.championEquipment,
                championVitals,
                damageEvents,
                partySleeping: state.sleeping,
                groupMovementPlans,
            },
            {
                randomFraction: deps.randomFraction,
                randomInt: deps.randomInt,
                hasLineOfSight: () =>
                    deps.hasLineOfSight(map, state.level, state.openDoors, creature.x, creature.y, px, py),
                nextMonsterMoveDelaySeconds: deps.nextMonsterMoveDelaySeconds,
                nextMonsterAttackDelaySeconds: deps.nextMonsterAttackDelaySeconds,
                monsterWalkable,
                canCreatureShareTile: deps.canCreatureShareTile,
                canArchenemyDoubleMove: (creatureState, level, x, y, direction) =>
                    deps.canArchenemyDoubleMove(
                        creatureState,
                        level,
                        x,
                        y,
                        direction,
                        creatures,
                        monsterWalkable,
                    ),
                chooseCreatureProjectileEffect: deps.chooseCreatureProjectileEffect,
                getCreatureSizeOnTile: deps.getCreatureSizeOnTile,
                isCreatureCellOccupiedOnTile: deps.isCreatureCellOccupiedOnTile,
                buildProjectile: deps.buildProjectile,
                getEffectiveChampionStats: deps.getEffectiveChampionStats,
                tryStealChampionItem: deps.tryStealChampionItem,
                resolveMonsterAttackAgainstChampion: deps.resolveMonsterAttackAgainstChampion,
                buildChampionDamageEvent: deps.buildChampionDamageEvent,
                attackWindowMs: deps.attackWindowMs,
                getTile: (level, x, y) => deps.getMap(level).tiles[y]?.[x],
                getTeleporter: deps.getTeleporter,
                resolveCreatureTeleporterTransport: deps.resolveCreatureTeleporterTransport,
                normalizeCreatureCellsOnTile: deps.normalizeCreatureCellsOnTile,
                buildFrightenedUntilMs: deps.buildFrightenedUntilMs,
            },
        );

        creatures = turn.creatures;
        projectiles = turn.projectiles;
        championInventories = turn.championInventories;
        championEquipment = turn.championEquipment;
        championVitals = turn.championVitals;
        damageEvents = turn.damageEvents;

        deps.setCreatureTimers(creature.id, { mt: turn.moveTimer, at: turn.attackTimer });

        if (turn.memoryUpdate.kind === 'set') {
            deps.setCreatureLastSeenPartyPos(creature.id, turn.memoryUpdate.value);
        } else if (turn.memoryUpdate.kind === 'clear') {
            deps.clearCreatureLastSeenPartyPos(creature.id);
        }

        if (turn.frightenedUntilMs !== undefined) {
            deps.setCreatureFrightenedUntil(creature.id, turn.frightenedUntilMs);
        }

        if (turn.notifyMove) {
            deps.onCreatureMove(creature.id, creature.typeId, turn.movementSound);
        }

        if (turn.attackWindowExpiresAt) {
            deps.onCreatureAttack(creature.id, creature.typeId, turn.attackWindowExpiresAt);
            lastCreatureAttackGameTick = state.elapsedGameTimeTicks;
        }

        if (
            turn.defeatedChampionId !== null &&
            turn.defeatedChampionId !== undefined &&
            !newlyDead.includes(turn.defeatedChampionId)
        ) {
            newlyDead.push(turn.defeatedChampionId);
        }

        if (turn.shouldPlayChampionWounded) {
            deps.onChampionWounded();
        }
    }

    let party = state.party;
    let floorItems = state.floorItems;
    let deadChampions = state.deadChampions;

    if (newlyDead.length > 0) {
        const deathState = processMonsterTickChampionDeaths(
            {
                level: state.level,
                position: state.position,
                party,
                championInventories,
                championEquipment,
                floorItems,
                deadChampions,
            },
            newlyDead,
            deps.nowMs(),
            {
                buildDeathDrop: deps.buildDeathDrop,
            },
        );
        party = deathState.party;
        floorItems = deathState.floorItems;
        championInventories = deathState.championInventories;
        championEquipment = deathState.championEquipment;
        deadChampions = deathState.deadChampions;
    }

    return buildTickMonstersPatch({
        creatures,
        baseCreatures: state.creatures,
        projectiles,
        baseProjectiles: state.projectiles,
        championVitals,
        baseChampionVitals: state.championVitals,
        damageEvents,
        baseDamageEvents: state.damageEvents,
        championInventories,
        baseChampionInventories: state.championInventories,
        championEquipment,
        baseChampionEquipment: state.championEquipment,
        lastCreatureAttackGameTick,
        baseLastCreatureAttackGameTick: state.lastCreatureAttackGameTick,
        party,
        baseParty: state.party,
        selectedChampionIndex: state.selectedChampionIndex,
        floorItems,
        deadChampions,
    });
}
