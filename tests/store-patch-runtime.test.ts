import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runStoreOptionalPatchAction } from '../src/engine/systems/storePatchRuntime.js';

test('runStoreOptionalPatchAction returns false when no patch is produced', () => {
    let applied = false;

    const appliedResult = runStoreOptionalPatchAction(
        () => null,
        () => {
            applied = true;
        },
    );

    assert.equal(appliedResult, false);
    assert.equal(applied, false);
});

test('runStoreOptionalPatchAction applies the patch and returns true', () => {
    let appliedPatch: { ok: boolean } | null = null;

    const appliedResult = runStoreOptionalPatchAction(
        () => ({ ok: true }),
        (patch) => {
            appliedPatch = patch;
        },
    );

    assert.equal(appliedResult, true);
    assert.deepEqual(appliedPatch, { ok: true });
});
