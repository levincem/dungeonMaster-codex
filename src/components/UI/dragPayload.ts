import type React from 'react';
import type { EquipSlotKey } from '../../types/items';

export interface DragPayload {
    itemId: string;
    fromChampionId: number;
    fromSlot: EquipSlotKey | 'inventory';
}

export function setDragPayload(event: React.DragEvent, payload: DragPayload): void {
    const encoded = JSON.stringify(payload);
    event.dataTransfer.setData('application/json', encoded);
    event.dataTransfer.setData('text/plain', encoded);
    event.dataTransfer.effectAllowed = 'move';
}

export function getDragPayload(event: React.DragEvent): DragPayload | null {
    try {
        const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
        if (!raw) return null;
        return JSON.parse(raw) as DragPayload;
    } catch {
        return null;
    }
}
