import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DoorObject, GameTile } from '../src/types/game.js';
import { getDoorObject } from '../src/engine/systems/doorMetadata.js';

function createDoorTile(globalX: number, globalY: number, doorType: number): GameTile {
    const door: DoorObject = {
        category: 'Door',
        index: 0,
        tilePos: 'North',
        destructChop: false,
        destructFire: false,
        hasButton: false,
        openDirection: 'Horizontal',
        ornate: 0,
        doorType,
    };

    return {
        x: globalX,
        y: globalY,
        globalX,
        globalY,
        type: 'Door',
        orientation: 'NorthSouth',
        objects: [door],
    };
}

test('door metadata keeps the Hall of Champions late gate opaque', () => {
    const correctedDoor = getDoorObject(createDoorTile(1, 2, 0));
    assert.equal(correctedDoor?.doorType, 2);
});

test('door metadata leaves unrelated portcullises unchanged', () => {
    const regularPortcullis = getDoorObject(createDoorTile(5, 9, 0));
    assert.equal(regularPortcullis?.doorType, 0);
});
