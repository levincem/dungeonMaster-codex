import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';

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
    shouldFlee: boolean;
};

type CreatureStealDeps = {
    randomInt: (max: number) => number;
    isLucky: (luck: number, luckNeeded: number) => boolean;
};

export function tryStealChampionItem(
    inventory: FloorItem[],
    equipment: ChampionEquipment,
    dexterity: number,
    luck: number,
    deps: CreatureStealDeps,
): CreatureStealResult {
    let percentage = 100 - dexterity;
    let slotCursor = deps.randomInt(GIGGLER_STEAL_ATTEMPTS.length);
    let nextInventory = inventory;
    let nextEquipment = equipment;
    let stoleObject = false;

    while (percentage > 0 && !deps.isLucky(luck, percentage)) {
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
        shouldFlee: deps.randomInt(8) === 0 || (stoleObject && deps.randomInt(2) === 0),
    };
}
