// Mechanisms loader — parses Old_data/mechanisms.json into typed structures.
// Each mechanism describes a dungeon interaction: locks, levers, pressure plates, etc.

// @ts-ignore — JSON import resolved by Vite
import rawMechanisms from '../../Old_data/mechanisms.json';
import type { CardinalDir } from '../types/game';

export type MechAction = 'Set' | 'Hold' | 'Clear' | 'Toggle';

export interface Mechanism {
    x: number;
    y: number;
    face: CardinalDir;
    kind: string;
    support: string;
    action: MechAction;
    onceOnly: boolean;
    target: { x: number; y: number } | null;
    requires?: string;
    storedObject?: string;
}

// ─── Lookup by level ──────────────────────────────────────────────────────────

const RAW = rawMechanisms as { maps: Array<{ name: string; index: number; mechanisms: unknown[] }> };

export function getMapMechanisms(level: number): Mechanism[] {
    return (RAW.maps[level]?.mechanisms ?? []) as Mechanism[];
}

export function getMechanismsAt(level: number, x: number, y: number, face: CardinalDir): Mechanism[] {
    return getMapMechanisms(level).filter(m => m.x === x && m.y === y && m.face === face);
}

// ─── Item → lock-data encoding ────────────────────────────────────────────────
// In DM, type-4 sensor `data` field = 128 + item typeId (for Misc and Weapon items).
// This allows checking if a picked-up item matches a lock's requirement.

export function itemToLockData(category: string, typeId: number): number {
    if (category === 'Misc' || category === 'Weapon') return 128 + typeId;
    return 0;
}

// ─── Sensor data → canonical item name (for display / debug) ─────────────────
export const LOCK_DATA_TO_NAME: Record<number, string> = {
    125: 'COPPER COIN',
    126: 'SILVER COIN',
    127: 'GOLD COIN',
    129: 'BLUE GEM',
    176: 'IRON KEY',
    177: 'KEY OF B',
    178: 'SOLID KEY',
    179: 'SQUARE KEY',
    180: 'TOURQUOISE KEY',
    181: 'CROSS KEY',
    183: 'SKELETON KEY',
    184: 'GOLD KEY',
    185: 'WINGED KEY',
    186: 'TOPAZ KEY',
    188: 'EMERALD KEY',
    189: 'RUBY KEY',
    190: 'RA KEY',
    191: 'MASTER KEY',
};
