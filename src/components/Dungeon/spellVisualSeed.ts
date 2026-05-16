export function hashSpellVisualSeed(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function sampleSpellVisualSeed(seed: number, salt: number): number {
    const raw = Math.sin((seed * 0.000001) + (salt * 12.9898)) * 43758.5453123;
    return raw - Math.floor(raw);
}

export function sampleSpellVisualRange(
    seed: number,
    salt: number,
    min: number,
    max: number,
): number {
    return min + (sampleSpellVisualSeed(seed, salt) * (max - min));
}

export function sampleSpellVisualInt(
    seed: number,
    salt: number,
    min: number,
    max: number,
): number {
    return Math.floor(sampleSpellVisualRange(seed, salt, min, max + 1));
}
