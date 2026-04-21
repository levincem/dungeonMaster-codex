import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    ORIGINAL_FRONT_DOOR_LEFT_FRAME_WIDTH,
    ORIGINAL_FRONT_DOOR_REFERENCE_HEIGHT,
    ORIGINAL_FRONT_DOOR_REFERENCE_WIDTH,
    ORIGINAL_FRONT_DOOR_SWITCH_HEIGHT,
    ORIGINAL_FRONT_DOOR_SWITCH_WIDTH,
    getOriginalDoorButtonAspectRatio,
    getOriginalDoorButtonStripWidthRatio,
    getOriginalDoorButtonWidthRatio,
} from '../src/data/originalDoorPanelMetrics.js';

type PanelRecord = {
    targetDescription: string;
    width: number | null;
    height: number | null;
};

type GraphicsPanelsPayload = {
    panels: Array<{
        name: string;
        records4: PanelRecord[];
    }>;
};

function loadPanels(): GraphicsPanelsPayload {
    return JSON.parse(
        readFileSync(`${process.cwd()}\\public\\graphics_panels_0696.json`, 'utf8'),
    ) as GraphicsPanelsPayload;
}

function requirePanelRecord(
    panels: GraphicsPanelsPayload['panels'],
    panelName: string,
    targetDescription: string,
): PanelRecord {
    const panel = panels.find((entry) => entry.name === panelName);
    assert.ok(panel, `panel ${panelName} should exist in graphics_panels_0696.json`);

    const record = panel.records4.find((entry) => entry.targetDescription === targetDescription);
    assert.ok(record, `panel ${panelName} should contain record ${targetDescription}`);
    return record;
}

test('door panel metrics stay aligned with the extracted 0696 front-door panel data', () => {
    const panels = loadPanels().panels;

    const frontDoorRecord = requirePanelRecord(panels, 'front-door-strip', 'Door Graphics 1 (Front 1)');
    assert.equal(frontDoorRecord.width, ORIGINAL_FRONT_DOOR_REFERENCE_WIDTH, 'front door reference width drifted');
    assert.equal(frontDoorRecord.height, ORIGINAL_FRONT_DOOR_REFERENCE_HEIGHT, 'front door reference height drifted');

    const frameRecord = requirePanelRecord(panels, 'door-frame-wall-pit-panel', 'Dungeon Graphics - Door Left Frame (Front 2)');
    assert.equal(frameRecord.width, ORIGINAL_FRONT_DOOR_LEFT_FRAME_WIDTH, 'door frame strip width drifted');

    const switchRecord = requirePanelRecord(panels, 'teleporter-floor-panel', 'Interface - Main Menu Switches States');
    assert.equal(switchRecord.width, ORIGINAL_FRONT_DOOR_SWITCH_WIDTH, 'door switch width drifted');
    assert.equal(switchRecord.height, ORIGINAL_FRONT_DOOR_SWITCH_HEIGHT, 'door switch height drifted');
});

test('derived door button ratios stay tied to the extracted panel dimensions', () => {
    assert.equal(
        getOriginalDoorButtonStripWidthRatio(),
        ORIGINAL_FRONT_DOOR_LEFT_FRAME_WIDTH / ORIGINAL_FRONT_DOOR_REFERENCE_WIDTH,
        'door button strip ratio drifted from extracted panel widths',
    );
    assert.equal(
        getOriginalDoorButtonWidthRatio(),
        ORIGINAL_FRONT_DOOR_SWITCH_WIDTH / ORIGINAL_FRONT_DOOR_REFERENCE_WIDTH,
        'door button width ratio drifted from extracted panel widths',
    );
    assert.equal(
        getOriginalDoorButtonAspectRatio(),
        ORIGINAL_FRONT_DOOR_SWITCH_HEIGHT / ORIGINAL_FRONT_DOOR_SWITCH_WIDTH,
        'door button aspect ratio drifted from extracted switch dimensions',
    );
});
