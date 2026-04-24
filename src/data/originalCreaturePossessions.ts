import type { FloorItem } from '../types/game';

type OriginalCreaturePossessionItem = {
    category: FloorItem['category'];
    typeId: number;
    rawName: string;
    potionPower?: number;
};

// Source-backed map-specific monster possessions from the original dungeon data.
// Keys are original possession object words (root of the carried-object chain).
export const ORIGINAL_CREATURE_POSSESSIONS_BY_WORD: Record<number, readonly OriginalCreaturePossessionItem[]> = {
    5143: [
        { category: 'Weapon', typeId: 2, rawName: 'Torch' },
        { category: 'Potion', typeId: 20, rawName: 'Empty Flask', potionPower: 0 },
    ],
    5207: [
        { category: 'Weapon', typeId: 32, rawName: 'Throwing Star' },
    ],
    5218: [
        { category: 'Weapon', typeId: 32, rawName: 'Throwing Star' },
    ],
    8237: [
        { category: 'Potion', typeId: 3, rawName: 'Ven Potion', potionPower: 130 },
    ],
    10276: [
        { category: 'Misc', typeId: 8, rawName: 'Gold Coin' },
    ],
    10277: [
        { category: 'Misc', typeId: 8, rawName: 'Gold Coin' },
    ],
    10279: [
        { category: 'Misc', typeId: 8, rawName: 'Gold Coin' },
    ],
    10315: [
        { category: 'Misc', typeId: 16, rawName: 'Skeleton Key' },
    ],
    10323: [
        { category: 'Misc', typeId: 10, rawName: 'Key Of B' },
    ],
    10373: [
        { category: 'Misc', typeId: 8, rawName: 'Gold Coin' },
    ],
    10385: [
        { category: 'Misc', typeId: 10, rawName: 'Key Of B' },
    ],
    10392: [
        { category: 'Misc', typeId: 21, rawName: 'Emerald Key' },
    ],
    10405: [
        { category: 'Misc', typeId: 16, rawName: 'Skeleton Key' },
    ],
    10433: [
        { category: 'Misc', typeId: 32, rawName: 'Cheese' },
        { category: 'Misc', typeId: 30, rawName: 'Corn' },
    ],
    10438: [
        { category: 'Misc', typeId: 33, rawName: 'Screamer Slice' },
        { category: 'Misc', typeId: 31, rawName: 'Bread' },
        { category: 'Misc', typeId: 29, rawName: 'Apple' },
        { category: 'Misc', typeId: 30, rawName: 'Corn' },
        { category: 'Misc', typeId: 32, rawName: 'Cheese' },
    ],
    10452: [
        { category: 'Misc', typeId: 33, rawName: 'Screamer Slice' },
        { category: 'Misc', typeId: 32, rawName: 'Cheese' },
    ],
    10473: [
        { category: 'Misc', typeId: 32, rawName: 'Cheese' },
    ],
    10491: [
        { category: 'Misc', typeId: 43, rawName: 'Magical Box (Green)' },
    ],
};

