import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMapMechanisms } from '../src/data/mechanisms.js';
import { preloadDungeonData } from '../src/data/dungeonData.js';

type SensorObject = {
    category: string;
    index: number;
    tilePos: string;
    type: number;
    data?: number;
    delay?: number;
    action: string;
    onceOnly?: boolean;
    targetX: number;
    targetY: number;
    requiredObjectName?: string;
};

type SourceTile = {
    x: number;
    y: number;
    type: string;
    objects?: SensorObject[];
};

type SourceMap = {
    index: number;
    tiles: SourceTile[];
};

type SourceDungeon = {
    maps: SourceMap[];
};

const WALL_SENSOR_LABELS: Record<number, string> = {
    1: 'Levier / bouton mural',
    2: 'Bouton (objet quelconque requis)',
    3: 'Serrure (objet specifique)',
    4: 'Serrure (objet consomme)',
    5: 'Porte logique AND/OR',
    6: 'Compte a rebours',
    7: 'Lanceur simple (objet)',
    8: 'Lanceur simple (explosion)',
    9: 'Lanceur double (objet)',
    10: 'Lanceur double (explosion)',
    11: 'Serrure (objet consomme + rotation)',
    12: 'Generateur d objet mural',
    13: 'Alcove (depot/retrait objet)',
    14: 'Lanceur simple (objet du carre)',
    15: 'Lanceur double (objet du carre)',
    16: 'Echangeur d objet',
    17: 'Serrure (objet consomme + suppression sensor)',
    18: 'Fin de jeu',
};

const FLOOR_SENSOR_LABELS: Record<number, string> = {
    1: 'Dalle de pression (tout)',
    2: 'Dalle de pression (creature)',
    3: 'Capteur de passage (party / orientation)',
    4: 'Dalle de pression (objet specifique)',
    5: 'Dalle d escalier',
    6: 'Generateur de groupe (sol)',
    7: 'Dalle de pression (creature uniquement)',
    8: 'Dalle de possession (groupe detient objet)',
    9: 'Verificateur de version',
};

function readSourceDungeon(): SourceDungeon {
    return JSON.parse(
        readFileSync(`${process.cwd()}\\assets\\OriginalDataExtraction\\output\\dungeon.json`, 'utf8'),
    ) as SourceDungeon;
}

function describeFloorSensor(sensor: Pick<SensorObject, 'type'> & { data?: number }): string {
    if (sensor.type !== 3) {
        return FLOOR_SENSOR_LABELS[sensor.type] ?? `Type sol ${sensor.type}`;
    }

    return (sensor as { data?: number }).data === 0
        ? 'Capteur de passage (party)'
        : 'Capteur d orientation (party)';
}

function getMechanismTrigger(tileType: string, sensorType: number): string {
    const isWall = tileType === 'Wall' || tileType === 'TrickWall';
    if (isWall) {
        if (sensorType === 7 || sensorType === 8 || sensorType === 9 || sensorType === 10 || sensorType === 14 || sensorType === 15) {
            return 'projectile-launcher';
        }
        if (sensorType === 5) return 'logic-gate';
        if (sensorType === 6) return 'countdown';
        if (sensorType === 13) return 'alcove';
        if (sensorType === 16) return 'object-exchanger';
        if (sensorType === 1 || sensorType === 2) return 'wall-button';
        if (sensorType === 3 || sensorType === 4 || sensorType === 11 || sensorType === 17) return 'wall-lock';
        if (sensorType === 18) return 'special';
        return 'unknown';
    }

    if (sensorType === 6) return 'generator';
    if (sensorType === 8) return 'party-possession';
    if (sensorType === 4) return 'object-pressure';
    if (sensorType === 1 || sensorType === 2 || sensorType === 3 || sensorType === 5 || sensorType === 7) return 'floor-pressure';
    return 'unknown';
}

function normalizeMechanism(mechanism: {
    sensorIndex: number;
    sensorType: number;
    trigger: string;
    x: number;
    y: number;
    face: string;
    kind: string;
    support: string;
    action: string;
    onceOnly: boolean;
    delay: number;
    target: { x: number; y: number } | null;
    requires?: string;
    storedObject?: string;
}) {
    return {
        sensorIndex: mechanism.sensorIndex,
        sensorType: mechanism.sensorType,
        trigger: mechanism.trigger,
        x: mechanism.x,
        y: mechanism.y,
        face: mechanism.face,
        kind: mechanism.kind,
        support: mechanism.support,
        action: mechanism.action,
        onceOnly: mechanism.onceOnly,
        delay: mechanism.delay,
        target: mechanism.target,
        requires: mechanism.requires,
        storedObject: mechanism.storedObject,
    };
}

test('mechanisms derived from runtime dungeon maps preserve every source sensor semantic used at runtime', async () => {
    await preloadDungeonData();

    const dungeon = readSourceDungeon();

    for (const map of dungeon.maps) {
        const expected = map.tiles
            .flatMap((tile) =>
                (tile.objects ?? [])
                    .filter((object) => object.category === 'Sensor' && object.type !== 0 && object.type !== 127)
                    .map((object) => {
                        const isWall = tile.type === 'Wall' || tile.type === 'TrickWall';
                        const isNamedRequirement =
                            (isWall && (object.type === 3 || object.type === 4 || object.type === 11 || object.type === 17))
                            || (!isWall && (object.type === 4 || object.type === 8));
                        const isStoredObjectSensor =
                            isWall && (object.type === 12 || object.type === 13 || object.type === 16);

                        return normalizeMechanism({
                            sensorIndex: object.index,
                            sensorType: object.type,
                            trigger: getMechanismTrigger(tile.type, object.type),
                            x: tile.x,
                            y: tile.y,
                            face: object.tilePos,
                            kind: isWall
                                ? (WALL_SENSOR_LABELS[object.type] ?? `Type mural ${object.type}`)
                                : describeFloorSensor(object),
                            support: tile.type,
                            action: object.action,
                            onceOnly: Boolean(object.onceOnly),
                            delay: object.delay ?? 0,
                            target: object.targetX !== 0 || object.targetY !== 0
                                ? { x: object.targetX, y: object.targetY }
                                : null,
                            requires: isNamedRequirement ? object.requiredObjectName : undefined,
                            storedObject: isStoredObjectSensor ? object.requiredObjectName : undefined,
                        });
                    }),
            )
            .sort((left, right) =>
                left.y - right.y
                || left.x - right.x
                || left.sensorIndex - right.sensorIndex
                || left.face.localeCompare(right.face),
            );

        const actual = getMapMechanisms(map.index)
            .map((mechanism) => normalizeMechanism({
                sensorIndex: mechanism.sensorIndex,
                sensorType: mechanism.sensorType,
                trigger: mechanism.trigger,
                x: mechanism.x,
                y: mechanism.y,
                face: mechanism.face,
                kind: mechanism.kind,
                support: mechanism.support,
                action: mechanism.action,
                onceOnly: mechanism.onceOnly,
                delay: mechanism.delay,
                target: mechanism.target,
                requires: mechanism.requires,
                storedObject: mechanism.storedObject,
            }))
            .sort((left, right) =>
                left.y - right.y
                || left.x - right.x
                || left.sensorIndex - right.sensorIndex
                || left.face.localeCompare(right.face),
            );

        assert.deepEqual(actual, expected, `mechanism semantics drifted on map ${map.index}`);
    }
});
