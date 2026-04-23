import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    isPointerInsideDungeonViewport,
    performDungeonDragDropAction,
    resolveDungeonDragDropDestination,
} from '../src/components/Dungeon/dungeonDragDrop.js';

test('resolveDungeonDragDropDestination splits the viewport into throw, front and current bands', () => {
    assert.equal(resolveDungeonDragDropDestination(120, 1000), 'throw');
    assert.equal(resolveDungeonDragDropDestination(520, 1000), 'front');
    assert.equal(resolveDungeonDragDropDestination(860, 1000), 'current');
});

test('isPointerInsideDungeonViewport keeps the dungeon interaction on the left gameplay pane', () => {
    assert.equal(isPointerInsideDungeonViewport(600, 1600), true);
    assert.equal(isPointerInsideDungeonViewport(1200, 1600), false);
});

test('performDungeonDragDropAction falls back from front to current and delegates throw directly', () => {
    const calls: string[] = [];

    assert.equal(
        performDungeonDragDropAction('front', {
            dropFront: () => {
                calls.push('front');
                return false;
            },
            dropCurrent: () => {
                calls.push('current');
                return true;
            },
            throwItem: () => {
                calls.push('throw');
                return true;
            },
        }),
        true,
    );
    assert.deepEqual(calls, ['front', 'current']);

    calls.length = 0;
    performDungeonDragDropAction('throw', {
        dropFront: () => {
            calls.push('front');
            return true;
        },
        dropCurrent: () => {
            calls.push('current');
            return true;
        },
        throwItem: () => {
            calls.push('throw');
            return true;
        },
    });
    assert.deepEqual(calls, ['throw']);
});
