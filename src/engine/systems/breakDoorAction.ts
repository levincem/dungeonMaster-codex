export interface BreakDoorAttemptParams {
    openDoors: Set<string>;
    brokenDoors: Set<string>;
    doorKey: string;
    doorBreakable: boolean;
    breakPower: number;
    threshold?: number;
}

export interface BreakDoorAttemptResult {
    nextOpenDoors: Set<string>;
    nextBrokenDoors: Set<string>;
    outcome: 'resisted' | 'broken';
}

const DEFAULT_BREAK_THRESHOLD = 34;

export function resolveBreakDoorAttempt({
    openDoors,
    brokenDoors,
    doorKey,
    doorBreakable,
    breakPower,
    threshold = DEFAULT_BREAK_THRESHOLD,
}: BreakDoorAttemptParams): BreakDoorAttemptResult | null {
    if (!doorBreakable || openDoors.has(doorKey)) return null;

    if (breakPower < threshold) {
        return {
            nextOpenDoors: openDoors,
            nextBrokenDoors: brokenDoors,
            outcome: 'resisted',
        };
    }

    const nextOpenDoors = new Set(openDoors);
    nextOpenDoors.add(doorKey);

    const nextBrokenDoors = brokenDoors.has(doorKey)
        ? brokenDoors
        : new Set(brokenDoors);
    if (nextBrokenDoors !== brokenDoors) {
        nextBrokenDoors.add(doorKey);
    }

    return {
        nextOpenDoors,
        nextBrokenDoors,
        outcome: 'broken',
    };
}
