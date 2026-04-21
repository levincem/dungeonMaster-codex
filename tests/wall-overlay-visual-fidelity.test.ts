import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
    getOriginalWallOverlayAssetStatus,
    getOriginalWallOverlaySourceImage,
    getOriginalWallOverlayVisual,
    WALL_OVERLAY_REMAKE_NOTES,
} from '../src/data/originalWallOverlays.js';

type OverlaySupportData = {
    fixedFaces?: Array<{
        variants?: Array<{
            overlayName: string;
        }>;
    }>;
};

function toWorkspaceAssetPath(imagePath: string): string {
    return `${process.cwd()}\\public${imagePath.replace(/\//g, '\\')}`;
}

test('wall overlay families resolve to packaged modern overlay assets when available', () => {
    const supportData = JSON.parse(
        readFileSync(`${process.cwd()}\\src\\assets\\runtime\\support\\original_wall_overlay_positions.json`, 'utf8'),
    ) as OverlaySupportData;

    const overlayNames = new Set(
        (supportData.fixedFaces ?? [])
            .flatMap((face) => face.variants ?? [])
            .map((variant) => variant.overlayName),
    );

    for (const overlayName of overlayNames) {
        const sourceImage = getOriginalWallOverlaySourceImage(overlayName);
        if (!sourceImage) continue;

        const visual = getOriginalWallOverlayVisual(overlayName);
        const status = getOriginalWallOverlayAssetStatus(overlayName);
        assert.ok(visual, `overlay ${overlayName} should have a visual definition`);
        assert.ok(status, `overlay ${overlayName} should expose an explicit asset status`);
        assert.equal(
            visual.image,
            sourceImage,
            `overlay ${overlayName} should use its explicit preferred asset or original BMP fallback`,
        );
        assert.equal(
            visual.image,
            status.image,
            `overlay ${overlayName} visual should match its recorded asset policy`,
        );

        const imagePath = toWorkspaceAssetPath(sourceImage);
        assert.ok(
            existsSync(imagePath),
            `overlay ${overlayName} points to missing packaged asset ${imagePath}`,
        );
    }
});

test('wall overlay original BMP fallbacks stay explicitly documented when any remain', () => {
    for (const entry of WALL_OVERLAY_REMAKE_NOTES) {
        assert.ok(entry.note.length > 0, `overlay ${entry.name} should have a remake note`);
        assert.ok(
            existsSync(toWorkspaceAssetPath(entry.image)),
            `overlay ${entry.name} fallback image should exist at ${entry.image}`,
        );
    }
});
