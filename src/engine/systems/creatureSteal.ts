import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type { ChampionVitals } from '../runtimeTypes';

type GigglerStealAttempt =
    | { kind: 'equipment'; slot: EquipSlotKey }
    | { kind: 'inventory' };

const GIGGLER_STEAL_ATTEMPTS: readonly GigglerStealAttempt[] = [
    { kind: 'equipment', slot: 'neck' },
    { kind: 'equipment', slot: 'pocket1' },
    { kind: 'inventory' },
    { kind: 'equipment', slot: 'quiver1' },
    { kind: 'equipment', slot: 'neck' },
    { kind: 'inventory' },
    { kind: 'equipment', slot: 'pocket2' },
    { kind: 'inventory' },
];

export type CreatureStealResult = {
    stolenItem: FloorItem | null;
    nextInventory: FloorItem[];
    nextEquipment: ChampionEquipment;
    nextVitals: ChampionVitals;
    shouldFlee: boolean;
};

type CreatureStealDeps = {
    randomInt: (max: number) => number;
    applyLuckCheck: (
        currentVitals: ChampionVitals,
        luckNeeded: number,
    ) => { success: boolean; nextVitals: ChampionVitals };
};

export function tryStealChampionItem(
    inventory: FloorItem[],
    equipment: ChampionEquipment,
    currentVitals: ChampionVitals,
    dexterity: number,
    deps: CreatureStealDeps,
): CreatureStealResult {
    let percentage = 100 - dexterity;
    let slotCursor = deps.randomInt(GIGGLER_STEAL_ATTEMPTS.length);
    let nextInventory = inventory;
    let nextEquipment = equipment;
    let nextVitals = currentVitals;
    let stoleObject = false;

    while (percentage > 0) {
        const luckCheck = deps.applyLuckCheck(nextVitals, percentage);
        nextVitals = luckCheck.nextVitals;
        if (luckCheck.success) {
            break;
        }

        const attempt = GIGGLER_STEAL_ATTEMPTS[slotCursor]!;
        let stolenItem: FloorItem | null = null;

        if (attempt.kind === 'inventory') {
            if (nextInventory.length > 0) {
                const index = deps.randomInt(nextInventory.length);
                stolenItem = nextInventory[index] ?? null;
                if (stolenItem) {
                    nextInventory = nextInventory.filter((_, itemIndex) => itemIndex !== index);
                }
            }
        } else {
            const equipped = nextEquipment[attempt.slot] ?? null;
            if (equipped) {
                stolenItem = equipped;
                nextEquipment = { ...nextEquipment, [attempt.slot]: undefined };
            }
        }

        if (stolenItem) {
            stoleObject = true;
            return {
                stolenItem,
                nextInventory,
                nextEquipment,
                nextVitals,
                shouldFlee: deps.randomInt(8) === 0 || deps.randomInt(2) === 0,
            };
        }

        slotCursor = (slotCursor + 1) & 0x7;
        percentage -= 20;
    }

    return {
        stolenItem: null,
        nextInventory,
        nextEquipment,
        nextVitals,
        shouldFlee: deps.randomInt(8) === 0 || (stoleObject && deps.randomInt(2) === 0),
    };
}
