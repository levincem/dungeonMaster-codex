import type { CreatureInstance, FloorItem } from '../../types/game';
import type { ActivePoisonCloud, DamageEvent, Projectile, SpellVisualEvent } from '../runtimeTypes';
import { buildProjectileDroppedItem } from './projectileDroppedItem';

type RolledSpellImpact = {
    damage: number;
    poisonStrength?: number;
};

type DroppedCreatureState = {
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
};

type TickProjectileCreatureHitState = {
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    activePoisonClouds: ActivePoisonCloud[];
};

type TickProjectileCreatureHitDeps = {
    rollSourceBackedImpact: (projectile: Projectile) => RolledSpellImpact | null;
    getCreaturePoisonAdjustedAttack: (creatureTypeId: number, poisonAttack: number) => number;
    rollRandomProjectileDamage: (projectile: Projectile) => number;
    rollExplosionBurstAttack: (effect: 'disrupt_nonmaterial' | 'poison_cloud' | 'fireball' | 'lightning', attack: number) => number;
    isLikelyNonMaterial: (creature: CreatureInstance) => boolean;
    rollDisruptNonMaterialAttack: (now: number, creature: CreatureInstance, attack: number) => number;
    dropCreatureCarriedItems: (
        creatures: CreatureInstance[],
        floorItems: FloorItem[],
        creatureId: string,
    ) => DroppedCreatureState;
    buildDeathDustEvent: (level: number, x: number, y: number) => SpellVisualEvent;
    buildCreatureDamageEvent: (
        level: number,
        x: number,
        y: number,
        amount: number,
        creatureId?: string,
    ) => DamageEvent;
    buildLingeringPoisonCloud: (
        level: number,
        x: number,
        y: number,
        initialAttack: number,
        nextPulseGameTick: number,
        visualScale: number,
    ) => ActivePoisonCloud | null;
    buildActivePoisonCloud: (
        level: number,
        x: number,
        y: number,
        attack: number,
        currentGameTick: number,
        visualScale: number,
    ) => ActivePoisonCloud;
    getThrownExplosionVisualScale: (attack?: number) => number;
    buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => FloorItem;
    gridSize: number;
};

export type TickProjectileCreatureHitResult = {
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    activePoisonClouds: ActivePoisonCloud[];
};

export function applyProjectileCreatureHit(
    projectile: Projectile,
    hit: CreatureInstance,
    hitCreatures: CreatureInstance[],
    hitAbsorbsMissiles: boolean,
    projectileLevel: number,
    x: number,
    y: number,
    currentGameTick: number,
    now: number,
    state: TickProjectileCreatureHitState,
    deps: TickProjectileCreatureHitDeps,
): TickProjectileCreatureHitResult {
    let creatures = state.creatures;
    let floorItems = state.floorItems;
    let damageEvents = state.damageEvents;
    let spellVisualEvents = state.spellVisualEvents;
    let activePoisonClouds = state.activePoisonClouds;

    const hitDefNonMaterial = deps.isLikelyNonMaterial(hit);
    const passesThroughNonMaterial =
        projectile.effect !== 'physical' &&
        hitDefNonMaterial &&
        projectile.effect !== 'disrupt_nonmaterial';

    if (passesThroughNonMaterial) {
        return {
            creatures,
            floorItems,
            damageEvents,
            spellVisualEvents,
            activePoisonClouds,
        };
    }

    if (projectile.effect === 'physical' && hitAbsorbsMissiles) {
        if (projectile.physicalItem) {
            if (creatures === state.creatures) creatures = [...creatures];
            const idx = creatures.findIndex((creature) => creature.id === hit.id);
            if (idx >= 0) {
                const currentTarget = creatures[idx]!;
                creatures[idx] = {
                    ...currentTarget,
                    carriedItems: [
                        ...(currentTarget.carriedItems ?? []),
                        deps.buildDroppedItem(projectile.physicalItem, projectileLevel, x, y),
                    ],
                };
            }
        }
        return {
            creatures,
            floorItems,
            damageEvents,
            spellVisualEvents,
            activePoisonClouds,
        };
    }

    const sourceBackedImpact = deps.rollSourceBackedImpact(projectile);
    const poisonDamage = sourceBackedImpact?.poisonStrength
        ? deps.getCreaturePoisonAdjustedAttack(hit.typeId, sourceBackedImpact.poisonStrength)
        : 0;
    const rolledDamage = projectile.effect === 'physical'
        ? Math.max(1, Math.round(projectile.remainingAttack ?? projectile.damage[1]))
        : sourceBackedImpact
            ? sourceBackedImpact.damage + poisonDamage
            : deps.rollRandomProjectileDamage(projectile);

    let totalDamage = 0;

    if (projectile.effect === 'disrupt_nonmaterial') {
        const disruptExplosionAttack = deps.rollExplosionBurstAttack(
            'disrupt_nonmaterial',
            Math.max(0, Math.round(projectile.remainingAttack ?? 0)),
        );
        const disruptTargets = hitCreatures.filter((candidate) => deps.isLikelyNonMaterial(candidate));
        if (disruptTargets.length > 0) {
            if (creatures === state.creatures) creatures = [...creatures];
            for (const disruptTarget of disruptTargets) {
                const disruptDamage = deps.rollDisruptNonMaterialAttack(now, disruptTarget, disruptExplosionAttack);
                if (disruptDamage <= 0) continue;
                const idx = creatures.findIndex((candidate) => candidate.id === disruptTarget.id);
                if (idx < 0) continue;
                const currentTarget = creatures[idx]!;
                const newHP = Math.max(0, currentTarget.currentHP - disruptDamage);
                const killed = newHP <= 0;
                creatures[idx] = { ...currentTarget, currentHP: newHP, alive: !killed };
                totalDamage += Math.max(0, currentTarget.currentHP - newHP);
                if (killed) {
                    const dropped = deps.dropCreatureCarriedItems(creatures, floorItems, currentTarget.id);
                    creatures = dropped.creatures;
                    floorItems = dropped.floorItems;
                    spellVisualEvents = [...spellVisualEvents, deps.buildDeathDustEvent(projectileLevel, x, y)];
                }
            }
        }
    } else {
        let newHP = Math.max(0, hit.currentHP - rolledDamage);
        totalDamage = Math.max(0, hit.currentHP - newHP);
        if (projectile.effect === 'physical' && projectile.explosionOnImpact && projectile.explosionAttack) {
            const explosionEffect = projectile.explosionOnImpact;
            if (
                explosionEffect === 'fireball' ||
                explosionEffect === 'lightning' ||
                explosionEffect === 'poison_cloud' ||
                explosionEffect === 'disrupt_nonmaterial'
            ) {
                const rawExplosionDamage = deps.rollExplosionBurstAttack(
                    explosionEffect,
                    projectile.explosionAttack,
                );
                const adjustedExplosionDamage = explosionEffect === 'poison_cloud'
                    ? deps.getCreaturePoisonAdjustedAttack(hit.typeId, rawExplosionDamage)
                    : rawExplosionDamage;
                const appliedExplosionDamage = Math.max(0, Math.min(newHP, adjustedExplosionDamage));
                newHP = Math.max(0, newHP - appliedExplosionDamage);
                totalDamage += appliedExplosionDamage;
                if (explosionEffect === 'poison_cloud') {
                    const lingeringCloud = deps.buildLingeringPoisonCloud(
                        projectileLevel,
                        x,
                        y,
                        projectile.explosionAttack,
                        currentGameTick + 1,
                        deps.getThrownExplosionVisualScale(projectile.explosionAttack),
                    );
                    if (lingeringCloud) {
                        if (activePoisonClouds === state.activePoisonClouds) activePoisonClouds = [...activePoisonClouds];
                        activePoisonClouds.push(lingeringCloud);
                    }
                }
            }
        }
        const killed = newHP <= 0;
        if (creatures === state.creatures) creatures = [...creatures];
        const idx = creatures.findIndex((creature) => creature.id === hit.id);
        if (idx >= 0) creatures[idx] = { ...creatures[idx], currentHP: newHP, alive: !killed };
        if (killed) {
            const dropped = deps.dropCreatureCarriedItems(creatures, floorItems, hit.id);
            creatures = dropped.creatures;
            floorItems = dropped.floorItems;
            spellVisualEvents = [...spellVisualEvents, deps.buildDeathDustEvent(projectileLevel, x, y)];
        }
    }

    if (totalDamage > 0) {
        damageEvents = [...damageEvents, deps.buildCreatureDamageEvent(projectileLevel, x, y, totalDamage, hit.id)];
    }

    const creatureImpactEffect = projectile.effect === 'physical' ? projectile.explosionOnImpact : projectile.effect;
    if (creatureImpactEffect) {
        spellVisualEvents = [
            ...spellVisualEvents,
            {
                id: `spellimpact_creature_${now}_${Math.random().toString(36).slice(2)}`,
                level: projectileLevel,
                x,
                y,
                height: deps.gridSize * 0.08,
                effect: creatureImpactEffect,
                visualScale: projectile.effect === 'physical'
                    ? deps.getThrownExplosionVisualScale(projectile.explosionAttack)
                    : projectile.visualScale,
                ts: now,
                kind: 'creature',
            },
        ];
    }

    if (projectile.effect === 'poison_cloud') {
        if (activePoisonClouds === state.activePoisonClouds) activePoisonClouds = [...activePoisonClouds];
        activePoisonClouds.push(
            deps.buildActivePoisonCloud(
                projectileLevel,
                x,
                y,
                Math.max(1, projectile.remainingAttack ?? 0),
                currentGameTick,
                (projectile.visualScale ?? 1) * 1.08,
            ),
        );
    }

    if (projectile.effect === 'physical' && projectile.physicalItem && !projectile.explosionOnImpact) {
        if (floorItems === state.floorItems) floorItems = [...floorItems];
        floorItems.push(
            buildProjectileDroppedItem(
                projectile.physicalItem,
                projectileLevel,
                x,
                y,
                projectile.direction,
                deps.buildDroppedItem,
            ),
        );
    }

    return {
        creatures,
        floorItems,
        damageEvents,
        spellVisualEvents,
        activePoisonClouds,
    };
}
