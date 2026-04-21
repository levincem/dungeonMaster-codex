import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
    ORIGINAL_DOOR_DEFS,
    doorBlocksThrownItems,
    doorBlocksVision,
    getDoorDefinition,
    getDoorTexturePath,
} from '../src/data/doors.js';

type OriginalDoorsPayload = {
    doors: Array<{
        id: number;
        name: string;
        animated: boolean;
        thrownItemsCanPassThrough: boolean;
        creaturesCanSeeThrough: boolean;
        resistance: number;
    }>;
};

function toWorkspaceAssetPath(imagePath: string): string {
    return `${process.cwd()}\\public${imagePath.replace(/\//g, '\\')}`;
}

test('door runtime definitions stay aligned with the extracted original door reference', () => {
    const originalDoors = JSON.parse(
        readFileSync(`${process.cwd()}\\public\\original_doors_runtime.json`, 'utf8'),
    ) as OriginalDoorsPayload;

    for (const original of originalDoors.doors) {
        const runtime = getDoorDefinition(original.id);
        assert.deepEqual(runtime, original, `door ${original.id} drifted from the original runtime definition`);
        assert.equal(ORIGINAL_DOOR_DEFS[original.id]?.name, original.name, `door ${original.id} missing from door lookup table`);
        assert.equal(doorBlocksVision(original.id), !original.creaturesCanSeeThrough, `door ${original.id} vision rule drifted`);
        assert.equal(doorBlocksThrownItems(original.id), !original.thrownItemsCanPassThrough, `door ${original.id} thrown-item rule drifted`);
    }
});

test('door runtime uses family-specific source-backed art assets for each original door type', () => {
    const expectedTexturePathByDoorType = {
        0: '/game/images/misc/grille_metal.png',
        1: '/game/images/textures/doorWood.png',
        2: '/game/images/textures/doorIron.png',
        3: '/game/images/textures/doorRaOriginal.bmp',
    } as const;

    for (const [doorTypeText, expectedPath] of Object.entries(expectedTexturePathByDoorType)) {
        const doorType = Number(doorTypeText);
        const actualPath = getDoorTexturePath(doorType);
        assert.equal(actualPath, expectedPath, `door ${doorType} texture path drifted`);
        assert.ok(existsSync(toWorkspaceAssetPath(actualPath)), `door ${doorType} texture asset is missing on disk`);
    }
});
