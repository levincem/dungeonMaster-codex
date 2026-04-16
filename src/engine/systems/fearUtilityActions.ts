import type { CreatureDef } from '../../data/creatures';
import type { CreatureInstance } from '../../types/game';

export type FearUtilityAction = 'Calm' | 'Brandish' | 'Blow Horn' | 'War Cry';

type FearUtilitySound = 'horn' | 'war-cry' | null;

type FearUtilityActionDeps = {
    getCreatureDef: (typeId: number) => CreatureDef | undefined;
    randomInt: (max: number) => number;
    quantizeDurationMs: (durationMs: number) => number;
    timerTickMs: number;
};

type FrightenedCreatureUpdate = {
    id: string;
    expiresAt: number;
};

export type FearUtilityActionResult = {
    clearLastSeenIds: string[];
    frightenedCreatures: FrightenedCreatureUpdate[];
    sound: FearUtilitySound;
};

function getFearActionProfile(
    action: FearUtilityAction,
    rightHandTypeId: number | undefined,
): { frightAmount: number; sound: FearUtilitySound } {
    switch (action) {
        case 'Calm':
            return { frightAmount: 7, sound: null };
        case 'Brandish':
            return { frightAmount: 6, sound: null };
        case 'Blow Horn':
            return { frightAmount: 6, sound: 'horn' };
        case 'War Cry':
            return { frightAmount: 3, sound: rightHandTypeId === 43 ? 'horn' : 'war-cry' };
    }
}

export function resolveFearUtilityAction(
    action: FearUtilityAction,
    frontCreatures: CreatureInstance[],
    now: number,
    rightHandTypeId: number | undefined,
    deps: FearUtilityActionDeps,
): FearUtilityActionResult {
    const { frightAmount, sound } = getFearActionProfile(action, rightHandTypeId);
    const frightenedCreatures: FrightenedCreatureUpdate[] = [];
    const clearLastSeenIds: string[] = [];

    for (const creature of frontCreatures) {
        const creatureDef = deps.getCreatureDef(creature.typeId);
        if (!creatureDef) continue;

        const fearResistance = creatureDef.fearResistance;
        if (fearResistance >= 15) continue;
        if (fearResistance > deps.randomInt(Math.max(1, frightAmount))) continue;

        const frightTicks = Math.max(8, (16 - fearResistance) << 2);
        frightenedCreatures.push({
            id: creature.id,
            expiresAt: now + deps.quantizeDurationMs(frightTicks * deps.timerTickMs),
        });
        clearLastSeenIds.push(creature.id);
    }

    return {
        clearLastSeenIds,
        frightenedCreatures,
        sound,
    };
}
