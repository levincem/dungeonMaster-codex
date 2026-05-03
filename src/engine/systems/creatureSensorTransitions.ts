type CreatureLike = {
    id: string;
    mapIndex: number;
    x: number;
    y: number;
    alive?: boolean;
};

export type CreatureFloorSensorTransition = {
    creatureId: string;
    type: 'leave' | 'enter';
    level: number;
    x: number;
    y: number;
};

export function collectCreatureFloorSensorTransitions<
    TPrevious extends CreatureLike,
    TNext extends CreatureLike,
>(
    previousCreatures: readonly TPrevious[],
    nextCreatures: readonly TNext[],
): CreatureFloorSensorTransition[] {
    const previousById = new Map(previousCreatures.map((creature) => [creature.id, creature]));
    const transitions: CreatureFloorSensorTransition[] = [];

    for (const creature of nextCreatures) {
        const previous = previousById.get(creature.id);
        if (!previous || previous.alive === false) continue;

        const moved =
            previous.mapIndex !== creature.mapIndex ||
            previous.x !== creature.x ||
            previous.y !== creature.y;
        const died = creature.alive === false;

        if (!moved && !died) continue;

        transitions.push({
            creatureId: creature.id,
            type: 'leave',
            level: previous.mapIndex,
            x: previous.x,
            y: previous.y,
        });

        if (moved && creature.alive !== false) {
            transitions.push({
                creatureId: creature.id,
                type: 'enter',
                level: creature.mapIndex,
                x: creature.x,
                y: creature.y,
            });
        }
    }

    return transitions;
}
