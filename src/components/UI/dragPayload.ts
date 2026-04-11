import type React from 'react';
import type { EquipSlotKey } from '../../types/items';

export interface DragPayload {
    itemId: string;
    fromChampionId: number;
    fromSlot: EquipSlotKey | 'inventory';
}

export function setDragPayload(event: React.DragEvent, payload: DragPayload): void {
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
}

export function getDragPayload(event: React.DragEvent): DragPayload | null {
    try {
        return JSON.parse(event.dataTransfer.getData('application/json')) as DragPayload;
    } catch {
        return null;
    }
}
