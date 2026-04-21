const DISABLED_TELEPORTER_KEYS = new Set<string>([
    // This Level 1 hidden teleporter creates a hard softlock: entering the room
    // without a gold key leaves only four reachable squares and no escape route.
    '1,21,18',
]);

export function isDisabledTeleporterKey(key: string): boolean {
    return DISABLED_TELEPORTER_KEYS.has(key);
}

export function sanitizeOpenTeleporterKeys(keys: Iterable<string>): Set<string> {
    const sanitized = new Set<string>();
    for (const key of keys) {
        if (isDisabledTeleporterKey(key)) continue;
        sanitized.add(key);
    }
    return sanitized;
}
