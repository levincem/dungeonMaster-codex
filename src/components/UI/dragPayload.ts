import type React from 'react';
import type { EquipSlotKey } from '../../types/items';

export interface DragPayload {
    itemId: string;
    fromChampionId: number;
    fromSlot: EquipSlotKey | 'inventory';
}

let activeDragPayload: DragPayload | null = null;
let cleanupRegistered = false;

function ensureCleanupHandlers(): void {
    if (cleanupRegistered || typeof window === 'undefined') return;
    const clear = () => {
        activeDragPayload = null;
    };
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    cleanupRegistered = true;
}

export function setDragPayload(event: React.DragEvent, payload: DragPayload): void {
    const encoded = JSON.stringify(payload);
    activeDragPayload = payload;
    ensureCleanupHandlers();
    event.dataTransfer.setData('application/x-dungeonmaster-item', encoded);
    event.dataTransfer.setData('application/json', encoded);
    event.dataTransfer.setData('text/plain', encoded);
    event.dataTransfer.setData('text', encoded);
    event.dataTransfer.effectAllowed = 'move';
}

export function getDragPayload(event: React.DragEvent): DragPayload | null {
    try {
        const raw =
            event.dataTransfer.getData('application/x-dungeonmaster-item') ||
            event.dataTransfer.getData('application/json') ||
            event.dataTransfer.getData('text/plain') ||
            event.dataTransfer.getData('text');
        if (!raw) return activeDragPayload;
        return JSON.parse(raw) as DragPayload;
    } catch {
        return activeDragPayload;
    }
}
