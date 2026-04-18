export function runStoreOptionalPatchAction<TPatch>(
    buildPatch: () => TPatch | null,
    applyPatch: (patch: TPatch) => void,
): boolean {
    const patch = buildPatch();
    if (!patch) return false;
    applyPatch(patch);
    return true;
}
