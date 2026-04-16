import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldEnterGameOver } from '../src/engine/gameOver.js';

test('game over does not trigger for an empty Hall of Champions party', () => {
    assert.equal(
        shouldEnterGameOver({
            phase: 'exploration',
            partySize: 0,
            deadChampionCount: 0,
        }),
        false,
    );
});

test('game over triggers when the party is wiped and deaths are recorded', () => {
    assert.equal(
        shouldEnterGameOver({
            phase: 'exploration',
            partySize: 0,
            deadChampionCount: 4,
        }),
        true,
    );
});

test('game over does not retrigger from title, victory or game_over phases', () => {
    assert.equal(
        shouldEnterGameOver({
            phase: 'title',
            partySize: 0,
            deadChampionCount: 4,
        }),
        false,
    );
    assert.equal(
        shouldEnterGameOver({
            phase: 'victory',
            partySize: 0,
            deadChampionCount: 4,
        }),
        false,
    );
    assert.equal(
        shouldEnterGameOver({
            phase: 'game_over',
            partySize: 0,
            deadChampionCount: 4,
        }),
        false,
    );
});
