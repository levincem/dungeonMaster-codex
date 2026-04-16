type CrushingDoorPhase = 'closing' | 'bouncing';

type CrushingDoorEntry = {
    phase: CrushingDoorPhase;
    timer: number;
};

type CreatureLike = {
    id: string;
    alive: boolean;
    mapIndex: number;
    x: number;
    y: number;
    currentHP: number;
};

type CrushingDoorState<TCreature extends CreatureLike, TDamageEvent> = {
    crushingDoors: Record<string, CrushingDoorEntry>;
    openDoors: Set<string>;
    creatures: TCreature[];
    damageEvents: TDamageEvent[];
};

type TickCrushingDoorsDeps<TDamageEvent> = {
    doorReboundDurationSeconds: number;
    doorRecloseDurationSeconds: number;
    buildCreatureDamageEvent: (
        level: number,
        x: number,
        y: number,
        amount: number,
        creatureId?: string,
    ) => TDamageEvent;
    playWallBump: () => void;
    damageAmount?: number;
};

function parseDoorKey(key: string): { level: number; y: number; x: number } | null {
    const [sLevel, sY, sX] = key.split(',');
    const level = Number.parseInt(sLevel ?? '', 10);
    const y = Number.parseInt(sY ?? '', 10);
    const x = Number.parseInt(sX ?? '', 10);
    if (!Number.isFinite(level) || !Number.isFinite(y) || !Number.isFinite(x)) return null;
    return { level, y, x };
}

export function tickCrushingDoors<TCreature extends CreatureLike, TDamageEvent>(
    state: CrushingDoorState<TCreature, TDamageEvent>,
    delta: number,
    deps: TickCrushingDoorsDeps<TDamageEvent>,
): Partial<CrushingDoorState<TCreature, TDamageEvent>> | null {
    const keys = Object.keys(state.crushingDoors);
    if (keys.length === 0) return null;

    let crushingDoors = state.crushingDoors;
    let openDoors = state.openDoors;
    let creatures = state.creatures;
    let damageEvents = state.damageEvents;
    let changed = false;
    const damageAmount = deps.damageAmount ?? 5;

    for (const key of keys) {
        const entry = crushingDoors[key];
        const coords = parseDoorKey(key);
        if (!entry || !coords) continue;

        const blocker = creatures.find((creature) =>
            creature.alive &&
            creature.mapIndex === coords.level &&
            creature.x === coords.x &&
            creature.y === coords.y,
        );

        if (!blocker) {
            if (crushingDoors === state.crushingDoors) crushingDoors = { ...crushingDoors };
            delete crushingDoors[key];
            if (openDoors.has(key)) {
                openDoors = new Set(openDoors);
                openDoors.delete(key);
            }
            changed = true;
            continue;
        }

        const newTimer = entry.timer - delta;

        if (entry.phase === 'closing') {
            if (newTimer > 0) {
                if (crushingDoors === state.crushingDoors) crushingDoors = { ...crushingDoors };
                crushingDoors[key] = { ...entry, timer: newTimer };
                changed = true;
                continue;
            }

            const newHP = Math.max(0, blocker.currentHP - damageAmount);
            const killed = newHP <= 0;

            if (creatures === state.creatures) creatures = [...creatures];
            const blockerIndex = creatures.findIndex((creature) => creature.id === blocker.id);
            if (blockerIndex >= 0) {
                creatures[blockerIndex] = {
                    ...creatures[blockerIndex],
                    currentHP: newHP,
                    alive: !killed,
                };
            }

            damageEvents = [
                ...damageEvents,
                deps.buildCreatureDamageEvent(coords.level, coords.x, coords.y, damageAmount, blocker.id),
            ];
            deps.playWallBump();

            if (crushingDoors === state.crushingDoors) crushingDoors = { ...crushingDoors };
            if (killed) {
                delete crushingDoors[key];
            } else {
                crushingDoors[key] = { phase: 'bouncing', timer: deps.doorReboundDurationSeconds };
                if (!openDoors.has(key)) {
                    openDoors = new Set(openDoors);
                    openDoors.add(key);
                }
            }
            changed = true;
            continue;
        }

        if (newTimer > 0) {
            if (crushingDoors === state.crushingDoors) crushingDoors = { ...crushingDoors };
            crushingDoors[key] = { ...entry, timer: newTimer };
            changed = true;
            continue;
        }

        if (openDoors.has(key)) {
            openDoors = new Set(openDoors);
            openDoors.delete(key);
        }
        if (crushingDoors === state.crushingDoors) crushingDoors = { ...crushingDoors };
        crushingDoors[key] = { phase: 'closing', timer: deps.doorRecloseDurationSeconds };
        changed = true;
    }

    if (!changed) return null;

    return {
        crushingDoors,
        openDoors,
        creatures,
        damageEvents,
    };
}
