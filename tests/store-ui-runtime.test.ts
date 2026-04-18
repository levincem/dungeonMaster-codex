import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildBeginFloorDragPatch,
    buildCloseMirrorPatch,
    buildCloseOptionsModalPatch,
    buildClosePartyMemberPatch,
    buildEndFloorDragPatch,
    buildGoToLevelPatch,
    buildOpenMirrorPatch,
    buildOpenOptionsModalPatch,
    buildOpenPartyMemberPatch,
    buildReorderPartyPatch,
    buildSelectChampionPatch,
    buildTurnLeftPatch,
    buildTurnRightPatch,
    buildTryOpenGatePatch,
    buildUpdateFloorDragPatch,
} from '../src/engine/systems/storeUiRuntime.js';

test('store UI panel patches open and close the mirror, party sheet and options modal', () => {
    assert.deepEqual(buildOpenMirrorPatch(7), {
        gamePhase: 'mirror_open',
        activeMirrorChampionId: 7,
    });
    assert.deepEqual(buildCloseMirrorPatch(), {
        gamePhase: 'exploration',
        activeMirrorChampionId: null,
    });
    assert.deepEqual(buildOpenPartyMemberPatch(3), {
        activePartyMemberId: 3,
    });
    assert.deepEqual(buildClosePartyMemberPatch(), {
        activePartyMemberId: null,
    });
    assert.deepEqual(buildOpenOptionsModalPatch(), {
        optionsModalOpen: true,
    });
    assert.deepEqual(buildCloseOptionsModalPatch(), {
        optionsModalOpen: false,
    });
});

test('store floor-drag patches create, update and clear the active floor drag state', () => {
    const startPatch = buildBeginFloorDragPatch('item-1', 12, 34);
    assert.deepEqual(startPatch, {
        activeFloorDrag: {
            itemId: 'item-1',
            pointerX: 12,
            pointerY: 34,
        },
    });

    assert.deepEqual(
        buildUpdateFloorDragPatch(startPatch, 40, 56),
        {
            activeFloorDrag: {
                itemId: 'item-1',
                pointerX: 40,
                pointerY: 56,
            },
        },
    );

    assert.equal(
        buildUpdateFloorDragPatch({ activeFloorDrag: null }, 1, 2),
        null,
    );

    assert.deepEqual(buildEndFloorDragPatch(), {
        activeFloorDrag: null,
    });
});

test('store navigation UI patches handle gate opening and direct level jumps', () => {
    assert.deepEqual(buildTryOpenGatePatch(4, 4), {
        gateOpen: true,
    });
    assert.deepEqual(buildTryOpenGatePatch(3, 4), {
        gateOpen: false,
    });
    assert.deepEqual(buildGoToLevelPatch(2, [8, 9], 'WEST'), {
        level: 2,
        position: [8, 9],
        direction: 'WEST',
    });
});

test('store turn and selection patches rotate only in exploration and preserve selected champion identity on reorder', () => {
    assert.deepEqual(
        buildTurnLeftPatch({ gamePhase: 'exploration', direction: 'NORTH' }),
        { direction: 'WEST' },
    );
    assert.deepEqual(
        buildTurnRightPatch({ gamePhase: 'exploration', direction: 'NORTH' }),
        { direction: 'EAST' },
    );
    assert.equal(
        buildTurnLeftPatch({ gamePhase: 'title', direction: 'NORTH' }),
        null,
    );
    assert.deepEqual(buildSelectChampionPatch(2), {
        selectedChampionIndex: 2,
    });

    const reorderPatch = buildReorderPartyPatch(
        {
            party: [{ id: 1 }, { id: 2 }, { id: 3 }],
            selectedChampionIndex: 1,
        },
        1,
        0,
    );

    assert.deepEqual(reorderPatch, {
        party: [{ id: 2 }, { id: 1 }, { id: 3 }],
        selectedChampionIndex: 0,
    });
    assert.equal(
        buildReorderPartyPatch(
            {
                party: [{ id: 1 }, { id: 2 }],
                selectedChampionIndex: 0,
            },
            0,
            0,
        ),
        null,
    );
});
