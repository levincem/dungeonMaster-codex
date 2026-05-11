import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    findLatestPartySpellImpactEvent,
    PARTY_FIREBALL_FLASH_MS,
} from '../src/components/Dungeon/partyFireballFlashState.js';

test('findLatestPartySpellImpactEvent returns the latest supported spell impact on the party tile', () => {
    const event = findLatestPartySpellImpactEvent(
        [
            {
                id: 'wrong-effect',
                level: 0,
                x: 1,
                y: 3,
                effect: 'lightning',
                ts: 100,
                kind: 'creature',
            },
            {
                id: 'wrong-tile',
                level: 0,
                x: 1,
                y: 2,
                effect: 'fireball',
                ts: 101,
                kind: 'creature',
            },
            {
                id: 'first-hit',
                level: 0,
                x: 1,
                y: 3,
                effect: 'fireball',
                ts: 102,
                kind: 'creature',
            },
            {
                id: 'poison-hit',
                level: 0,
                x: 1,
                y: 3,
                effect: 'poison_cloud',
                ts: 103,
                kind: 'creature',
            },
            {
                id: 'latest-hit',
                level: 0,
                x: 1,
                y: 3,
                effect: 'lightning',
                ts: 104,
                kind: 'creature',
            },
        ],
        0,
        [3, 1],
    );

    assert.equal(event?.id, 'latest-hit');
    assert.equal(event?.effect, 'lightning');
});

test('findLatestPartySpellImpactEvent ignores impacts on other levels and unsupported effects', () => {
    const event = findLatestPartySpellImpactEvent(
        [
            {
                id: 'other-level',
                level: 1,
                x: 1,
                y: 3,
                effect: 'fireball',
                ts: 200,
                kind: 'creature',
            },
            {
                id: 'unsupported-effect',
                level: 0,
                x: 1,
                y: 3,
                effect: 'open',
                ts: 201,
                kind: 'creature',
            },
        ],
        0,
        [3, 1],
    );

    assert.equal(event, null);
    assert.equal(PARTY_FIREBALL_FLASH_MS, 400);
});
