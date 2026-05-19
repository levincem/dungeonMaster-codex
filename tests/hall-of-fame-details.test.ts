import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildHallOfFameEntryHoverText,
    formatHallOfFameCompactNumber,
} from '../src/components/UI/hallOfFameDetails.js';
import { buildHallOfFameEntry } from '../src/engine/hallOfFame.js';
import { createInitialGameStats } from '../src/engine/systems/gameStats.js';

test('formatHallOfFameCompactNumber shortens large values for leaderboard displays', () => {
    assert.equal(formatHallOfFameCompactNumber(589_256, 'en'), '589k');
    assert.equal(formatHallOfFameCompactNumber(5_000_000, 'en'), '5m');
    assert.equal(formatHallOfFameCompactNumber(5_200_000, 'fr'), '5m');
});

test('buildHallOfFameEntryHoverText uses compact counters in the hover summary', () => {
    const stats = createInitialGameStats(1_000);
    stats.combat.damageTaken.total = 589_256;
    stats.combat.damageTakenByCreature.Mummy = 12_500;
    stats.magic.manaSpent = 5_000_000;
    stats.movement.stepsForward = 123_456;
    stats.items.pickedUp = 12_300;
    stats.items.dropped = 4_500;
    stats.items.equipped = 999;
    stats.exploration.timeByLevelMs['0'] = 3_600_000;
    stats.exploration.timeByLevelMs['2'] = 540_000;
    stats.magic.bySpell.Fireball = {
        attempted: 12_500,
        succeeded: 12_000,
        failed: 500,
    };

    const entry = buildHallOfFameEntry('Test', stats, 2_000);
    const hover = buildHallOfFameEntryHoverText(entry, {
        hallOfFameBuild: 'Build',
        hallOfFameCompleted: 'Completed',
        playTime: 'Play Time',
        damageTaken: 'Damage Taken',
        mostDangerousCreaturesTitle: 'Dangerous Creatures',
        noCreatureDamageTaken: 'None',
        timeByLevelTitle: 'Time By Level',
        manaSpent: 'Mana Spent',
        steps: 'Steps',
        turns: 'Turns',
        pickedUp: 'Picked Up',
        dropped: 'Dropped',
        equipped: 'Equipped',
        topSpellsTitle: 'Top Spells',
        noSpellsCast: 'None',
    }, 'en');

    assert.match(hover, /Damage Taken: 589k/);
    assert.match(hover, /Mana Spent: 5m/);
    assert.match(hover, /Steps: 123k/);
    assert.match(hover, /Picked Up: 12k \| Dropped: 5k \| Equipped: 999/);
    assert.match(hover, /Dangerous Creatures: Mummy 13k/);
    assert.match(hover, /Time By Level: L1 1h 00m 00s \| L3 9m 00s/);
    assert.match(hover, /Top Spells: Fireball x13k/);
});
