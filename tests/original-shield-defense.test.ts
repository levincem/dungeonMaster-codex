import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOriginalActiveShieldDefense, getOriginalPartyShieldKind } from '../src/engine/systems/originalShieldDefense.js';

test('getOriginalPartyShieldKind keeps explicit kind and legacy fallbacks aligned', () => {
    assert.equal(getOriginalPartyShieldKind({ id: 'a', expiresAt: 1, defense: 10, kind: 'physical' }), 'physical');
    assert.equal(getOriginalPartyShieldKind({ id: 'b', expiresAt: 1, defense: 10, fireOnly: true }), 'fire');
    assert.equal(getOriginalPartyShieldKind({ id: 'c', expiresAt: 1, defense: 10, championId: 1 }), 'magic');
    assert.equal(getOriginalPartyShieldKind({ id: 'd', expiresAt: 1, defense: 10 }), 'physical');
});

test('getOriginalActiveShieldDefense sums matching active shields only', () => {
    const result = getOriginalActiveShieldDefense(
        [
            { id: 'party', expiresAt: 2000, defense: 32, kind: 'physical' },
            { id: 'magic-self', expiresAt: 2000, defense: 24, championId: 1 },
            { id: 'magic-legacy', expiresAt: 2000, protection: 0.5, championId: 1 } as never,
            { id: 'expired', expiresAt: 500, defense: 99, kind: 'physical' },
            { id: 'other-target', expiresAt: 2000, defense: 77, championId: 2 },
        ],
        1000,
        'magic',
        1,
    );

    assert.equal(result, 56);
});
