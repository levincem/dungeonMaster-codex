import type { CreatureDef } from '../../data/creatures';
import type { CreatureInstance } from '../../types/game';
import type { Projectile, ProjectileEffect } from '../runtimeTypes';
import { PROJECTILE_STEP_MS } from '../time';
import { getPrimaryDirectionTowardTarget } from './directionState';

type ProjectileTargetState = {
    position: [number, number];
};

type CreatureProjectileDeps = {
    randomInt: (max: number) => number;
    buildIdSuffix?: () => string;
};

export function chooseOriginalCreatureProjectileEffect(
    creatureTypeId: number,
    randomInt: (max: number) => number,
): Exclude<ProjectileEffect, 'physical'> | null {
    switch (creatureTypeId) {
        case 1:
            return 'slime';
        case 14:
        case 23:
            if (randomInt(2) !== 0) return 'fireball';
            switch (randomInt(4)) {
                case 0: return 'disrupt_nonmaterial';
                case 1: return 'lightning';
                case 2: return 'poison_cloud';
                default: return 'open';
            }
        case 3:
            return randomInt(8) !== 0 ? 'lightning' : 'open';
        case 19:
            return randomInt(2) !== 0 ? 'poison_cloud' : 'fireball';
        case 22:
        case 24:
            return 'fireball';
        default:
            return null;
    }
}

export function buildCreatureProjectile(
    state: ProjectileTargetState,
    creature: CreatureInstance,
    def: CreatureDef,
    effect: Exclude<ProjectileEffect, 'physical'>,
    targetChampionId: number | undefined,
    now: number,
    deps: CreatureProjectileDeps,
): Projectile {
    let kineticEnergy = Math.max(1, Math.floor(def.rawAttack / 4) + 1);
    kineticEnergy += deps.randomInt(Math.max(1, kineticEnergy));
    kineticEnergy += deps.randomInt(Math.max(1, kineticEnergy));
    kineticEnergy = Math.max(20, Math.min(kineticEnergy, 255));

    return {
        id: `creature_proj_${creature.id}_${now}_${deps.buildIdSuffix?.() ?? Math.random().toString(36).slice(2)}`,
        level: creature.mapIndex,
        x: creature.x,
        y: creature.y,
        direction: getPrimaryDirectionTowardTarget(creature.x, creature.y, state.position[1], state.position[0]),
        effect,
        launchedBy: 'creature',
        sourceCreatureId: creature.id,
        targetChampionId,
        damage: [1, Math.max(1, kineticEnergy)],
        nextMoveAt: now + PROJECTILE_STEP_MS,
        remainingRange: kineticEnergy,
        remainingAttack: Math.max(1, def.dexterity),
        stepDecay: 8,
        visualScale: effect === 'lightning' ? 1.05 : effect === 'poison_cloud' ? 1.1 : effect === 'slime' ? 0.96 : 1,
    };
}
