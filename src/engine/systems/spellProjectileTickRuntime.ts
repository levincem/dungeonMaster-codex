import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem, GameMap } from '../../types/game';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    Projectile,
    SpellVisualEvent,
} from '../runtimeTypes';
import { applyProjectileCreatureHit } from './tickProjectileCreatureHit';
import { applyProjectilePartyHit } from './tickProjectilePartyHit';
import { resolveProjectileContinuation } from './projectileContinuation';
import { resolveProjectileTraversalStep } from './projectileTraversal';
import { tickPoisonClouds } from './tickPoisonClouds';

type SpellProjectileTickState = {
    projectiles: Projectile[];
    creatures: CreatureInstance[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    floorItems: FloorItem[];
    openDoors: Set<string>;
    party: Champion[];
    level: number;
    position: [number, number];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    activePoisonClouds: ActivePoisonCloud[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat: Record<number, ChampionCombat>;
    openWalls: Set<string>;
    lastCreatureAttackGameTick: number;
};

type SpellProjectileTickDeps = {
    getMap: (level: number) => GameMap;
    currentGameTick: number;
    now: number;
    randomInt: (maxExclusive: number) => number;
    doorBlocksProjectile: Parameters<typeof resolveProjectileTraversalStep>[1]['doorBlocksProjectile'];
    buildActivePoisonCloud: Parameters<typeof resolveProjectileTraversalStep>[1]['buildActivePoisonCloud'];
    getThrownExplosionVisualScale: Parameters<typeof resolveProjectileTraversalStep>[1]['getThrownExplosionVisualScale'];
    buildDroppedItem: Parameters<typeof resolveProjectileTraversalStep>[1]['buildDroppedItem'];
    resolveProjectileTeleporterTransport: Parameters<typeof resolveProjectileTraversalStep>[1]['resolveProjectileTeleporterTransport'];
    originalSpellProjectileAttack: Parameters<typeof resolveProjectileTraversalStep>[1]['originalSpellProjectileAttack'];
    resolveProjectileImpact: Parameters<typeof applyProjectilePartyHit>[7]['resolveProjectileImpact'];
    resolveChampionIncomingAttack: Parameters<typeof applyProjectilePartyHit>[7]['resolveChampionIncomingAttack'];
    buildChampionDamageEvent: Parameters<typeof applyProjectilePartyHit>[7]['buildChampionDamageEvent'];
    applyPoisonCharacter: Parameters<typeof applyProjectilePartyHit>[7]['applyPoisonCharacter'];
    buildDeathDrop: Parameters<typeof applyProjectilePartyHit>[7]['buildDeathDrop'];
    applyPartySpellBacklashDamage: Parameters<typeof applyProjectilePartyHit>[7]['applyPartySpellBacklashDamage'];
    applyPartyWideIncomingAttack: Parameters<typeof applyProjectilePartyHit>[7]['applyPartyWideIncomingAttack'];
    rollExplosionBurstAttack: Parameters<typeof applyProjectileCreatureHit>[10]['rollExplosionBurstAttack'];
    gridSize: number;
    rollSourceBackedImpact: Parameters<typeof applyProjectileCreatureHit>[10]['rollSourceBackedImpact'];
    getCreaturePoisonAdjustedAttack: Parameters<typeof applyProjectileCreatureHit>[10]['getCreaturePoisonAdjustedAttack'];
    hitCreatureAbsorbsMissiles: (creature: CreatureInstance) => boolean;
    rollRandomProjectileDamage: Parameters<typeof applyProjectileCreatureHit>[10]['rollRandomProjectileDamage'];
    isLikelyNonMaterial: Parameters<typeof applyProjectileCreatureHit>[10]['isLikelyNonMaterial'];
    rollDisruptNonMaterialAttack: Parameters<typeof applyProjectileCreatureHit>[10]['rollDisruptNonMaterialAttack'];
    dropCreatureCarriedItems: Parameters<typeof applyProjectileCreatureHit>[10]['dropCreatureCarriedItems'];
    buildDeathDustEvent: Parameters<typeof applyProjectileCreatureHit>[10]['buildDeathDustEvent'];
    buildCreatureDamageEvent: Parameters<typeof applyProjectileCreatureHit>[10]['buildCreatureDamageEvent'];
    buildLingeringPoisonCloud: Parameters<typeof applyProjectileCreatureHit>[10]['buildLingeringPoisonCloud'];
    rollPoisonCloudPulseAttack: Parameters<typeof tickPoisonClouds>[3]['rollPoisonCloudPulseAttack'];
    onDoorMotion: (durationMs: number, volume: number) => void;
    doorToggleSoundDurationMs: number;
    getDoorSoundVolume: (level: number, x: number, y: number) => number;
    projectileStepMs: number;
    physicalProjectileStepMs: number;
};

type SpellProjectileTickResult = {
    keepProjectiles: Projectile[];
    creatures: CreatureInstance[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    floorItems: FloorItem[];
    openDoors: Set<string>;
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    activePoisonClouds: ActivePoisonCloud[];
    lastCreatureAttackGameTick: number;
};

type ProjectileImpactMutableState = {
    creatures: CreatureInstance[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    floorItems: FloorItem[];
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    activePoisonClouds: ActivePoisonCloud[];
    lastCreatureAttackGameTick: number;
};

function resolveProjectileImpactOnSquare(
    projectile: Projectile,
    projectileLevel: number,
    x: number,
    y: number,
    state: SpellProjectileTickState,
    runtime: ProjectileImpactMutableState,
    deps: SpellProjectileTickDeps,
): { consumed: boolean; nextState: ProjectileImpactMutableState } {
    const hitsPartySquare =
        projectile.launchedBy === 'creature' &&
        projectileLevel === state.level &&
        x === state.position[1] &&
        y === state.position[0];
    if (hitsPartySquare) {
        const nextLastCreatureAttackGameTick = deps.currentGameTick;
        const partyHit = applyProjectilePartyHit(
            projectile,
            projectileLevel,
            x,
            y,
            deps.currentGameTick,
            deps.now,
            {
                level: state.level,
                position: state.position,
                party: runtime.party,
                championVitals: runtime.championVitals,
                championInventories: runtime.championInventories,
                championEquipment: runtime.championEquipment,
                floorItems: runtime.floorItems,
                deadChampions: runtime.deadChampions,
                selectedChampionIndex: runtime.selectedChampionIndex,
                damageEvents: runtime.damageEvents,
                spellVisualEvents: runtime.spellVisualEvents,
                activePoisonClouds: runtime.activePoisonClouds,
                activeShields: state.activeShields,
                activePotionBoosts: state.activePotionBoosts,
                championCombat: state.championCombat,
                lastCreatureAttackGameTick: nextLastCreatureAttackGameTick,
            },
            {
                resolveProjectileImpact: deps.resolveProjectileImpact,
                resolveChampionIncomingAttack: deps.resolveChampionIncomingAttack,
                buildChampionDamageEvent: deps.buildChampionDamageEvent,
                applyPoisonCharacter: deps.applyPoisonCharacter,
                randomInt: deps.randomInt,
                buildDeathDrop: deps.buildDeathDrop,
                applyPartySpellBacklashDamage: deps.applyPartySpellBacklashDamage,
                applyPartyWideIncomingAttack: deps.applyPartyWideIncomingAttack,
                rollExplosionBurstAttack: deps.rollExplosionBurstAttack,
                buildActivePoisonCloud: deps.buildActivePoisonCloud,
                getThrownExplosionVisualScale: deps.getThrownExplosionVisualScale,
                gridSize: deps.gridSize,
            },
        );
        return {
            consumed: true,
            nextState: {
                ...runtime,
                party: partyHit.party,
                championVitals: partyHit.championVitals,
                championInventories: partyHit.championInventories,
                championEquipment: partyHit.championEquipment,
                floorItems: partyHit.floorItems,
                deadChampions: partyHit.deadChampions,
                selectedChampionIndex: partyHit.selectedChampionIndex,
                damageEvents: partyHit.damageEvents,
                spellVisualEvents: partyHit.spellVisualEvents,
                activePoisonClouds: partyHit.activePoisonClouds,
                lastCreatureAttackGameTick: nextLastCreatureAttackGameTick,
            },
        };
    }

    const hitCreatures = runtime.creatures.filter(
        (creature) => creature.alive && creature.mapIndex === projectileLevel && creature.x === x && creature.y === y,
    );
    const hit = hitCreatures[0];
    if (!hit) {
        return { consumed: false, nextState: runtime };
    }

    if (projectile.effect === 'open') {
        return { consumed: false, nextState: runtime };
    }

    const creatureHit = applyProjectileCreatureHit(
        projectile,
        hit,
        hitCreatures,
        deps.hitCreatureAbsorbsMissiles(hit),
        projectileLevel,
        x,
        y,
        deps.currentGameTick,
        deps.now,
        {
            creatures: runtime.creatures,
            floorItems: runtime.floorItems,
            damageEvents: runtime.damageEvents,
            spellVisualEvents: runtime.spellVisualEvents,
            activePoisonClouds: runtime.activePoisonClouds,
        },
        {
            rollSourceBackedImpact: deps.rollSourceBackedImpact,
            getCreaturePoisonAdjustedAttack: deps.getCreaturePoisonAdjustedAttack,
            rollRandomProjectileDamage: deps.rollRandomProjectileDamage,
            rollExplosionBurstAttack: deps.rollExplosionBurstAttack,
            isLikelyNonMaterial: deps.isLikelyNonMaterial,
            rollDisruptNonMaterialAttack: deps.rollDisruptNonMaterialAttack,
            dropCreatureCarriedItems: deps.dropCreatureCarriedItems,
            buildDeathDustEvent: deps.buildDeathDustEvent,
            buildCreatureDamageEvent: deps.buildCreatureDamageEvent,
            buildLingeringPoisonCloud: deps.buildLingeringPoisonCloud,
            buildActivePoisonCloud: deps.buildActivePoisonCloud,
            getThrownExplosionVisualScale: deps.getThrownExplosionVisualScale,
            buildDroppedItem: deps.buildDroppedItem,
            gridSize: deps.gridSize,
        },
    );
    return {
        consumed: true,
        nextState: {
            ...runtime,
            creatures: creatureHit.creatures,
            floorItems: creatureHit.floorItems,
            damageEvents: creatureHit.damageEvents,
            spellVisualEvents: creatureHit.spellVisualEvents,
            activePoisonClouds: creatureHit.activePoisonClouds,
        },
    };
}

export function runSpellProjectileTickRuntime(
    state: SpellProjectileTickState,
    deps: SpellProjectileTickDeps,
): SpellProjectileTickResult {
    const keepProjectiles: Projectile[] = [];
    let creatures = state.creatures;
    let damageEvents = state.damageEvents;
    let spellVisualEvents = state.spellVisualEvents;
    let floorItems = state.floorItems;
    let openDoors = state.openDoors;
    let party = state.party;
    let championVitals = state.championVitals;
    let championInventories = state.championInventories;
    let championEquipment = state.championEquipment;
    let deadChampions = state.deadChampions;
    let selectedChampionIndex = state.selectedChampionIndex;
    let activePoisonClouds = state.activePoisonClouds;
    let lastCreatureAttackGameTick = state.lastCreatureAttackGameTick;

    for (const projectile of state.projectiles) {
        if (projectile.effect !== 'open' && projectile.nextMoveAt <= deps.now) {
            const immediateImpact = resolveProjectileImpactOnSquare(
                projectile,
                projectile.level,
                projectile.x,
                projectile.y,
                state,
                {
                    creatures,
                    damageEvents,
                    spellVisualEvents,
                    floorItems,
                    party,
                    championVitals,
                    championInventories,
                    championEquipment,
                    deadChampions,
                    selectedChampionIndex,
                    activePoisonClouds,
                    lastCreatureAttackGameTick,
                },
                deps,
            );
            if (immediateImpact.consumed) {
                ({
                    creatures,
                    damageEvents,
                    spellVisualEvents,
                    floorItems,
                    party,
                    championVitals,
                    championInventories,
                    championEquipment,
                    deadChampions,
                    selectedChampionIndex,
                    activePoisonClouds,
                    lastCreatureAttackGameTick,
                } = immediateImpact.nextState);
                continue;
            }
        }

        const traversal = resolveProjectileTraversalStep(
            {
                projectile,
                now: deps.now,
                currentGameTick: deps.currentGameTick,
                openDoors,
                openWalls: state.openWalls,
                floorItems,
                spellVisualEvents,
                activePoisonClouds,
            },
            {
                getTile: (level, x, y) => deps.getMap(level).tiles[y]?.[x],
                doorBlocksProjectile: deps.doorBlocksProjectile,
                buildActivePoisonCloud: deps.buildActivePoisonCloud,
                getThrownExplosionVisualScale: deps.getThrownExplosionVisualScale,
                buildDroppedItem: deps.buildDroppedItem,
                resolveProjectileTeleporterTransport: deps.resolveProjectileTeleporterTransport,
                gridSize: deps.gridSize,
                originalSpellProjectileAttack: deps.originalSpellProjectileAttack,
            },
        );
        if (traversal.kind === 'waiting') {
            keepProjectiles.push(traversal.keepProjectile);
            continue;
        }

        openDoors = traversal.openDoors;
        floorItems = traversal.floorItems;
        spellVisualEvents = traversal.spellVisualEvents;
        activePoisonClouds = traversal.activePoisonClouds;

        if (traversal.kind === 'consumed') {
            if (traversal.shouldPlayDoorMotion && traversal.doorMotionSquare) {
                deps.onDoorMotion(
                    deps.doorToggleSoundDurationMs,
                    deps.getDoorSoundVolume(
                        traversal.doorMotionSquare.level,
                        traversal.doorMotionSquare.x,
                        traversal.doorMotionSquare.y,
                    ),
                );
            }
            continue;
        }

        const projectileLevel = traversal.level;
        const x = traversal.x;
        const y = traversal.y;
        const direction = traversal.direction;
        const impact = resolveProjectileImpactOnSquare(
            projectile,
            projectileLevel,
            x,
            y,
            state,
            {
                creatures,
                damageEvents,
                spellVisualEvents,
                floorItems,
                party,
                championVitals,
                championInventories,
                championEquipment,
                deadChampions,
                selectedChampionIndex,
                activePoisonClouds,
                lastCreatureAttackGameTick,
            },
            deps,
        );
        if (impact.consumed) {
            ({
                creatures,
                damageEvents,
                spellVisualEvents,
                floorItems,
                party,
                championVitals,
                championInventories,
                championEquipment,
                deadChampions,
                selectedChampionIndex,
                activePoisonClouds,
                lastCreatureAttackGameTick,
            } = impact.nextState);
            continue;
        }

        const continuation = resolveProjectileContinuation(
            projectile,
            {
                level: projectileLevel,
                x,
                y,
                direction,
            },
            deps.now,
            floorItems,
            {
                projectileStepMs: deps.projectileStepMs,
                physicalProjectileStepMs: deps.physicalProjectileStepMs,
                buildDroppedItem: deps.buildDroppedItem,
            },
        );
        floorItems = continuation.floorItems;
        if (continuation.keepProjectile) keepProjectiles.push(continuation.keepProjectile);
    }

    if (activePoisonClouds.length > 0) {
        const poisonCloudTick = tickPoisonClouds(
            {
                activePoisonClouds,
                creatures,
                level: state.level,
                position: state.position,
                party,
                championVitals,
                championInventories,
                championEquipment,
                floorItems,
                deadChampions,
                selectedChampionIndex,
                damageEvents,
                spellVisualEvents,
                activeShields: state.activeShields,
                activePotionBoosts: state.activePotionBoosts,
                championCombat: state.championCombat,
            },
            deps.currentGameTick,
            deps.now,
            {
                rollPoisonCloudPulseAttack: deps.rollPoisonCloudPulseAttack,
                applyPartyWideIncomingAttack: deps.applyPartyWideIncomingAttack,
                getCreaturePoisonAdjustedAttack: deps.getCreaturePoisonAdjustedAttack,
                buildCreatureDamageEvent: deps.buildCreatureDamageEvent,
                dropCreatureCarriedItems: deps.dropCreatureCarriedItems,
                buildDeathDustEvent: deps.buildDeathDustEvent,
            },
        );
        activePoisonClouds = poisonCloudTick.activePoisonClouds;
        creatures = poisonCloudTick.creatures;
        party = poisonCloudTick.party;
        championVitals = poisonCloudTick.championVitals;
        championInventories = poisonCloudTick.championInventories;
        championEquipment = poisonCloudTick.championEquipment;
        floorItems = poisonCloudTick.floorItems;
        deadChampions = poisonCloudTick.deadChampions;
        selectedChampionIndex = poisonCloudTick.selectedChampionIndex;
        damageEvents = poisonCloudTick.damageEvents;
        spellVisualEvents = poisonCloudTick.spellVisualEvents;
    }

    return {
        keepProjectiles,
        creatures,
        damageEvents,
        spellVisualEvents,
        floorItems,
        openDoors,
        party,
        championVitals,
        championInventories,
        championEquipment,
        deadChampions,
        selectedChampionIndex,
        activePoisonClouds,
        lastCreatureAttackGameTick,
    };
}
