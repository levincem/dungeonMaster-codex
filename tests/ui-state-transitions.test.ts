import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildLoadedGameUiResetPatch,
    buildReturnToTitlePatch,
} from '../src/engine/systems/uiStateTransitions.js';

test('buildLoadedGameUiResetPatch reapplies the common exploration UI reset state', () => {
    const patch = buildLoadedGameUiResetPatch({
        level: 3,
        pendingSensorEvents: [],
    });

    assert.deepEqual(patch, {
        level: 3,
        pendingSensorEvents: [],
        selectedChampionIndex: 0,
        gamePhase: 'exploration',
        optionsModalOpen: false,
        activeMirrorChampionId: null,
        activePartyMemberId: null,
        sleeping: false,
        paused: false,
        lastMonsterAttackDebug: null,
        endgameSequence: null,
        lastCastResult: null,
        damageEvents: [],
        spellVisualEvents: [],
        activeFloorDrag: null,
        inventoryFullFeedback: null,
    });
});

test('buildReturnToTitlePatch resets title-facing transient UI state', () => {
    assert.deepEqual(buildReturnToTitlePatch(), {
        gamePhase: 'title',
        activeMirrorChampionId: null,
        activePartyMemberId: null,
        sleeping: false,
        paused: false,
        lastMonsterAttackDebug: null,
        endgameSequence: null,
        lastCastResult: null,
        damageEvents: [],
        spellVisualEvents: [],
        inventoryFullFeedback: null,
    });
});
