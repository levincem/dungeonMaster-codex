import type { SpellDef } from '../../data/runes';
import type { ChampionVitals, Direction, ActivePoisonCloud, Projectile, ProjectileEffect, SpellVisualEvent } from '../runtimeTypes';
import { buildBlockedSpellProjectilePatch, resolveBlockedSpellProjectileConsequences, type SpellBacklashPatch } from './blockedSpellProjectile';
import { buildSpellProjectileCast } from './spellProjectileCasting';
import {
    buildBlockedSpellImpactEvent,
    buildOpenBlockedSpellImpactEvent,
    buildOpenBlockedSpellPatch,
    buildOpenSpellDoorPatch,
    buildSpellDoorImpactResult,
} from './spellProjectileImpacts';

type ImmediateDoorMatch = {
    key: string;
    door: {
        hasButton: boolean;
    };
};

type ProjectileDamageRange = {
    min: number;
    max: number;
};

type BuildProjectileSpellStatePatchArgs = {
    spell: SpellDef;
    championId: number;
    level: number;
    position: [number, number];
    direction: Direction;
    now: number;
    skillLevel: number;
    maxMana: number;
    elapsedGameTimeTicks: number;
    nextVitals: ChampionVitals;
    currentChampionVitals: Record<number, ChampionVitals>;
    currentSpellVisualEvents: SpellVisualEvent[];
    currentOpenDoors: Set<string>;
    currentProjectiles: Projectile[];
    currentActivePoisonClouds: ActivePoisonCloud[];
};

type BuildProjectileSpellStatePatchDeps = {
    projectileAttack: number;
    projectileStepMs: number;
    gridSize: number;
    getImmediateDoor: (level: number, x: number, y: number) => ImmediateDoorMatch | null;
    isImmediatelyBlocked: (level: number, x: number, y: number) => boolean;
    buildBlockedPoisonCloud: (
        level: number,
        x: number,
        y: number,
        attack: number,
        elapsedGameTimeTicks: number,
        visualScale: number,
    ) => ActivePoisonCloud;
    rollSourceBackedImpactDamage: (initialRange: number) => number | null;
    rollRandomDamage: (min: number, max: number) => number;
    applyBacklash: (
        effect: Exclude<ProjectileEffect, 'physical'>,
        rolledDamage: number,
    ) => SpellBacklashPatch | null;
};

export type ProjectileSpellStatePatchResult = {
    patch: {
        championVitals: Record<number, ChampionVitals>;
        openDoors?: Set<string>;
        spellVisualEvents?: SpellVisualEvent[];
        damageEvents?: ReturnType<typeof buildBlockedSpellProjectilePatch>['damageEvents'];
        party?: ReturnType<typeof buildBlockedSpellProjectilePatch>['party'];
        floorItems?: ReturnType<typeof buildBlockedSpellProjectilePatch>['floorItems'];
        championInventories?: ReturnType<typeof buildBlockedSpellProjectilePatch>['championInventories'];
        championEquipment?: ReturnType<typeof buildBlockedSpellProjectilePatch>['championEquipment'];
        deadChampions?: ReturnType<typeof buildBlockedSpellProjectilePatch>['deadChampions'];
        selectedChampionIndex?: ReturnType<typeof buildBlockedSpellProjectilePatch>['selectedChampionIndex'];
        activePoisonClouds?: ActivePoisonCloud[];
        projectiles?: Projectile[];
    };
    shouldPlayDoorMotion?: boolean;
    doorMotionSquare?: {
        level: number;
        x: number;
        y: number;
    };
};

export function buildProjectileSpellStatePatch(
    args: BuildProjectileSpellStatePatchArgs,
    deps: BuildProjectileSpellStatePatchDeps,
): ProjectileSpellStatePatchResult {
    const nextChampionVitals = {
        ...args.currentChampionVitals,
        [args.championId]: args.nextVitals,
    };
    const projectileCast = buildSpellProjectileCast(
        args.spell,
        args.level,
        args.position,
        args.direction,
        args.now,
        args.skillLevel,
        args.maxMana,
        {
            projectileAttack: deps.projectileAttack,
            projectileStepMs: deps.projectileStepMs,
        },
    );
    if (!projectileCast) {
        return {
            patch: {
                championVitals: nextChampionVitals,
            },
        };
    }

    const [partyY, partyX] = args.position;
    const { startX, startY, visualScale, projectileDamage, launchProfile } = projectileCast;

    if (args.spell.effect === 'open') {
        const immediateDoor = deps.getImmediateDoor(args.level, startX, startY);
        if (immediateDoor) {
            const doorImpact = buildSpellDoorImpactResult(
                {
                    openDoors: args.currentOpenDoors,
                    doorKey: immediateDoor.key,
                    doorHasButton: immediateDoor.door.hasButton,
                    level: args.level,
                    x: startX,
                    y: startY,
                    now: args.now,
                    gridSize: deps.gridSize,
                    visualScale,
                },
                {},
            );
            const patch = buildOpenSpellDoorPatch({
                nextChampionVitals,
                currentSpellVisualEvents: args.currentSpellVisualEvents,
                currentOpenDoors: args.currentOpenDoors,
                doorImpact,
            });
            return {
                patch,
                shouldPlayDoorMotion: patch.shouldPlayDoorMotion,
                doorMotionSquare: patch.shouldPlayDoorMotion
                    ? { level: args.level, x: startX, y: startY }
                    : undefined,
            };
        }
    }

    if (deps.isImmediatelyBlocked(args.level, startX, startY)) {
        if (args.spell.effect === 'open') {
            return {
                patch: buildOpenBlockedSpellPatch({
                    nextChampionVitals,
                    currentSpellVisualEvents: args.currentSpellVisualEvents,
                    impactEvent: buildOpenBlockedSpellImpactEvent(
                        {
                            level: args.level,
                            x: partyX,
                            y: partyY,
                            now: args.now,
                            gridSize: deps.gridSize,
                            visualScale,
                            effect: 'open',
                        },
                        {},
                    ),
                }),
            };
        }

        const blockedOutcome = resolveBlockedSpellProjectileConsequences({
            spellEffect: args.spell.effect as Exclude<ProjectileEffect, 'physical'>,
            level: args.level,
            x: partyX,
            y: partyY,
            visualScale,
            projectileAttack: deps.projectileAttack,
            elapsedGameTimeTicks: args.elapsedGameTimeTicks,
            projectileDamage: projectileDamage as ProjectileDamageRange,
            initialRange: launchProfile?.initialRange ?? 0,
            buildBlockedPoisonCloud: deps.buildBlockedPoisonCloud,
            rollSourceBackedImpactDamage: deps.rollSourceBackedImpactDamage,
            rollRandomDamage: deps.rollRandomDamage,
            applyBacklash: (rolledDamage) => deps.applyBacklash(
                args.spell.effect as Exclude<ProjectileEffect, 'physical'>,
                rolledDamage,
            ),
        });

        return {
            patch: buildBlockedSpellProjectilePatch({
                nextChampionVitals,
                blockedPoisonCloud: blockedOutcome.blockedPoisonCloud,
                backlash: blockedOutcome.backlash,
                currentSpellVisualEvents: args.currentSpellVisualEvents,
                blockedImpactEvent: buildBlockedSpellImpactEvent(
                    {
                        level: args.level,
                        x: partyX,
                        y: partyY,
                        now: args.now,
                        gridSize: deps.gridSize,
                        visualScale,
                        effect: args.spell.effect as Exclude<ProjectileEffect, 'physical'>,
                        direction: args.direction,
                    },
                    {},
                ),
                currentActivePoisonClouds: args.currentActivePoisonClouds,
            }),
        };
    }

    return {
        patch: {
            championVitals: nextChampionVitals,
            projectiles: [...args.currentProjectiles, projectileCast.projectile],
        },
    };
}
