import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FloorItem, GameTile } from '../src/types/game.js';
import {
    applyStoreFrontWallInteractionResult,
    buildStoreChampionItemOnViAltarPatch,
    buildStoreFloorItemOnViAltarPatch,
    createStoreViAltarInteractionPatchDeps,
    runStoreChampionItemOnFrontWallAction,
    runStoreFloorItemOnFrontWallAction,
    runStoreWallSensorActivationAction,
} from '../src/engine/systems/storeWallInteractionRuntime.js';

function createBonesItem(id: string, championId: number): FloorItem {
    return {
        id,
        category: 'Misc',
        typeId: 5,
        championId,
        mapIndex: 0,
        x: 4,
        y: 17,
        tilePos: 'North',
    };
}

test('applyStoreFrontWallInteractionResult only applies matched patches and plays the plate once', () => {
    const applied: Array<Record<string, unknown>> = [];
    let plates = 0;

    assert.equal(applyStoreFrontWallInteractionResult(
        { matched: false, patch: null, shouldPlayPlate: true },
        {
            applyPatch: (patch) => applied.push(patch),
            playPlate: () => {
                plates += 1;
            },
        },
    ), false);

    assert.equal(applyStoreFrontWallInteractionResult(
        { matched: true, patch: { openDoors: ['0,17,4'] }, shouldPlayPlate: true },
        {
            applyPatch: (patch) => applied.push(patch),
            playPlate: () => {
                plates += 1;
            },
        },
    ), true);

    assert.deepEqual(applied, [{ openDoors: ['0,17,4'] }]);
    assert.equal(plates, 1);
});

test('runStoreChampionItemOnFrontWallAction applies a matched champion interaction and plays the plate', () => {
    const applied: Array<Record<string, unknown>> = [];
    let plates = 0;

    const didApply = runStoreChampionItemOnFrontWallAction(
        {
            level: 0,
            position: [5, 6],
            direction: 'NORTH',
            championInventories: { 1: [] },
            championEquipment: { 1: {} },
            floorItems: [],
            activeFloorDrag: null,
        },
        1,
        'key',
        'inventory',
        () => ({
            buildSensorStateSnapshot: () => ({}),
            isAltarWallFace: () => false,
            buildViAltarResurrectionPatch: () => null,
            triggerLockSensors: () => ({
                sensorChanges: { openDoors: ['0,4,6'] },
                newInventories: { 1: [] },
                newEquipment: null,
                matched: true,
            }),
            triggerAnyObjectWallSensor: () => ({ sensorChanges: {}, matched: false }),
            triggerAlcoveDepositSensor: () => ({
                sensorChanges: {},
                newInventories: null,
                newEquipment: null,
                depositedItem: null,
                matched: false,
            }),
            triggerObjectExchangerSensor: () => ({
                sensorChanges: {},
                newInventories: null,
                newEquipment: null,
                matched: false,
            }),
            applyFirestaffExchangerReward: (_state, _wallX, _wallY, _face, _candidate, _receiver, nextInventories, nextEquipment, nextFloorItems) => ({
                nextInventories,
                nextEquipment,
                nextFloorItems,
                transformed: false,
            }),
            applyImmediateTransportSquareEffects: (_state, patch) => patch,
            buildAttackResultMessage: (message) => ({ message }),
        }),
        {
            applyPatch: (patch) => applied.push(patch),
            playPlate: () => {
                plates += 1;
            },
        },
    );

    assert.equal(didApply, true);
    assert.deepEqual(applied, [{ openDoors: ['0,4,6'], championInventories: { 1: [] } }]);
    assert.equal(plates, 1);
});

test('runStoreFloorItemOnFrontWallAction returns false when the floor interaction misses', () => {
    const didApply = runStoreFloorItemOnFrontWallAction(
        {
            level: 0,
            position: [5, 6],
            direction: 'NORTH',
            championInventories: { 1: [] },
            championEquipment: { 1: {} },
            floorItems: [],
            activeFloorDrag: null,
        },
        'missing-item',
        1,
        () => ({
            buildSensorStateSnapshot: () => ({}),
            isAltarWallFace: () => false,
            buildViAltarResurrectionPatch: () => null,
            triggerLockSensors: () => ({
                sensorChanges: {},
                newInventories: null,
                newEquipment: null,
                matched: false,
            }),
            triggerAnyObjectWallSensor: () => ({ sensorChanges: {}, matched: false }),
            triggerAlcoveDepositSensor: () => ({
                sensorChanges: {},
                newInventories: null,
                newEquipment: null,
                depositedItem: null,
                matched: false,
            }),
            triggerObjectExchangerSensor: () => ({
                sensorChanges: {},
                newInventories: null,
                newEquipment: null,
                matched: false,
            }),
            applyFirestaffExchangerReward: (_state, _wallX, _wallY, _face, _candidate, _receiver, nextInventories, nextEquipment, nextFloorItems) => ({
                nextInventories,
                nextEquipment,
                nextFloorItems,
                transformed: false,
            }),
            applyImmediateTransportSquareEffects: (_state, patch) => patch,
            buildAttackResultMessage: (message) => ({ message }),
        }),
        {
            applyPatch: () => {
                throw new Error('should not apply');
            },
            playPlate: () => {
                throw new Error('should not play');
            },
        },
    );

    assert.equal(didApply, false);
});

test('runStoreWallSensorActivationAction delegates to the wall sensor runtime', () => {
    const tile: GameTile = { x: 4, y: 18, type: 'Wall', objects: [] };

    const patch = runStoreWallSensorActivationAction(
        {
            pendingSensorEvents: [],
            floorItems: [],
            activeSensors: new Set<string>(),
            firedSensors: new Set<string>(),
            openDoors: new Set<string>(),
            openWalls: new Set<string>(),
            sensorRotationOffsets: {},
        },
        0,
        4,
        18,
        3,
        () => ({
            getTile: () => tile,
            buildSensorStateSnapshot: () => ({
                activeSensors: new Set<string>(),
                firedSensors: new Set<string>(),
                openDoors: new Set<string>(),
                openWalls: new Set<string>(),
                sensorRotationOffsets: {},
            }),
            getWallFaceSensorsInRuntimeOrder: () => [{
                category: 'Sensor',
                type: 0,
                tilePos: 'South',
                actions: [{ action: 'Set', target: 'activeSensors', value: '0,18,4' }],
            } as never],
            wallLauncherSensorTypes: new Set<number>(),
            applyToSet: (set, key) => new Set<string>([...set, key]),
            getSelfRevealingWallSensor: () => null,
            queueOrComputeSensorEffect: () => ({
                sensorChanges: { activeSensors: new Set<string>(['0,18,4']) },
                pendingSensorEvents: [],
            }),
            resolveDoorSoundTarget: () => null,
            playDoorMotion: () => {},
            playPlate: () => {},
            shouldRotateWallFaceAfterActivation: () => false,
            rotateWallFaceSensors: () => ({}),
            diffSensorState: (_before, after) => after,
            revealSelfWallMountedItems: (floorItems) => floorItems,
            applyImmediateTransportSquareEffects: (_state, basePatch) => basePatch,
        }),
    );

    assert.deepEqual(patch, {
        activeSensors: new Set<string>(),
        firedSensors: new Set<string>(),
        openDoors: new Set<string>(),
        openWalls: new Set<string>(),
        sensorRotationOffsets: {},
        floorItems: [],
        pendingSensorEvents: [],
    });
});

test('createStoreViAltarInteractionPatchDeps preserves the vi altar patch callbacks', () => {
    const deps = createStoreViAltarInteractionPatchDeps({
        getTile: () => ({ x: 4, y: 18, type: 'Wall', objects: [] }),
        isAltarWallFaceSystem: () => true,
        buildBaseResurrectionPatch: () => ({ revived: true }),
        decorateResurrectionPatch: (_state, basePatch) => {
            if (!basePatch) return null;
            return {
                ...basePatch,
                decorated: true,
            };
        },
    });

    assert.equal(typeof deps.getTile, 'function');
    assert.equal(deps.isAltarWallFaceSystem(0, 4, 18, 'South', deps.getTile), true);
    assert.deepEqual(
        deps.decorateResurrectionPatch(
            {
                level: 0,
                championInventories: {},
                championEquipment: {},
                floorItems: [],
            },
            deps.buildBaseResurrectionPatch(
                {
                    level: 0,
                    championInventories: {},
                    championEquipment: {},
                    floorItems: [],
                },
                1,
                'bones',
                null,
            ),
            4,
            18,
            'South',
            null,
        ),
        { revived: true, decorated: true },
    );
});

test('buildStoreChampionItemOnViAltarPatch decorates the original resurrection patch', () => {
    const bones = createBonesItem('bones-1', 7);
    const touchedTiles: Array<[number, number, number]> = [];
    const tile: GameTile = { x: 4, y: 18, type: 'Wall', objects: [] };
    const patch = buildStoreChampionItemOnViAltarPatch(
        {
            level: 0,
            championInventories: { 1: [bones] },
            championEquipment: { 1: {} },
            floorItems: [],
            activeFloorDrag: null,
        },
        1,
        bones.id,
        'inventory',
        4,
        18,
        'South',
        {
            getTile: (level, x, y) => {
                touchedTiles.push([level, x, y]);
                return tile;
            },
            isAltarWallFaceSystem: (level, x, y, face, getTile) => {
                assert.equal(face, 'South');
                assert.equal(getTile(level, x, y), tile);
                return true;
            },
            buildBaseResurrectionPatch: (_state, deadChampionId, consumedItemId, carriedChampionId) => ({
                deadChampionId,
                consumedItemId,
                carriedChampionId,
            }),
            decorateResurrectionPatch: (_state, basePatch, wallX, wallY, wallFace, carriedBy) => {
                assert.ok(basePatch);
                return {
                    ...basePatch,
                    wallX,
                    wallY,
                    wallFace,
                    carriedBy,
                };
            },
        },
    );

    assert.deepEqual(touchedTiles, [[0, 4, 18]]);
    assert.deepEqual(patch, {
        deadChampionId: 7,
        consumedItemId: 'bones-1',
        carriedChampionId: 1,
        wallX: 4,
        wallY: 18,
        wallFace: 'South',
        carriedBy: { championId: 1, fromSlot: 'inventory' },
    });
});

test('buildStoreFloorItemOnViAltarPatch preserves floor-drag cleanup from the base interaction', () => {
    const bones = createBonesItem('bones-2', 9);

    const patch = buildStoreFloorItemOnViAltarPatch(
        {
            level: 0,
            championInventories: { 1: [] },
            championEquipment: { 1: {} },
            floorItems: [bones],
            activeFloorDrag: { itemId: bones.id },
        },
        bones.id,
        4,
        18,
        'South',
        {
            getTile: () => ({ x: 4, y: 18, type: 'Wall', objects: [] }),
            isAltarWallFaceSystem: () => true,
            buildBaseResurrectionPatch: (_state, deadChampionId, consumedItemId, carriedChampionId) => ({
                deadChampionId,
                consumedItemId,
                carriedChampionId,
            }),
            decorateResurrectionPatch: (_state, basePatch, wallX, wallY, wallFace, carriedBy) => {
                assert.ok(basePatch);
                return {
                    ...basePatch,
                    wallX,
                    wallY,
                    wallFace,
                    carriedBy,
                };
            },
        },
    );

    assert.deepEqual(patch, {
        deadChampionId: 9,
        consumedItemId: 'bones-2',
        carriedChampionId: null,
        wallX: 4,
        wallY: 18,
        wallFace: 'South',
        carriedBy: null,
        activeFloorDrag: null,
    });
});
