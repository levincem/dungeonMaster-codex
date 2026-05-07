import type {
    CardinalDir,
    ChampionEquipment,
    FloorItem,
    GameTile,
    SensorAction,
    SensorObject,
} from '../../types/game';
import type { EquipSlotKey } from '../../types/items';

type DoorSoundTarget = { level: number; x: number; y: number } | null;

type SelectedItem = {
    championId: number;
    itemId: string;
    fromSlot: EquipSlotKey | 'inventory';
};

type SensorStateLike = {
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    openDoors: Set<string>;
    sensorRotationOffsets: Record<string, number>;
};

type WallItemSensorDeps<TSensorState extends SensorStateLike, TState> = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    getWallFaceSensorsInRuntimeOrder: (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => SensorObject[];
    isOriginalAlcoveWallFace: (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
    ) => boolean;
    isWallLockSensor: (sensor: SensorObject) => boolean;
    isWallAlcoveSensor: (sensor: SensorObject) => boolean;
    isWallObjectExchangerSensor: (sensor: SensorObject) => boolean;
    isWallSensorConsumedAtRuntime: (level: number, sensor: SensorObject, ss: TSensorState) => boolean;
    getRequiredSensorItemName: (sensor: SensorObject) => string | undefined;
    getWallSensorRequiredItemOverride?: (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        sensor: SensorObject,
    ) => string | undefined;
    itemMatchesMechanismRequirement: (item: FloorItem, requiredName: string | undefined) => boolean;
    itemToLockData: (category: FloorItem['category'], typeId: number) => number;
    isConsumableLockSensor: (sensor: SensorObject) => boolean;
    computeSensorEffect: (
        sensor: SensorObject,
        level: number,
        ss: TSensorState,
    ) => Partial<TSensorState>;
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => DoorSoundTarget;
    playDoorMotion: (target: DoorSoundTarget) => void;
    shouldRotateWallFaceAfterActivation: (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => boolean;
    rotateWallFaceSensors: (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => Record<string, number>;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
    applyToSet: (set: Set<string>, key: string, action: SensorAction) => Set<string>;
    buildSensorStateSnapshot: (state: TState) => TSensorState;
};

type LockResult<TSensorState extends SensorStateLike> = {
    sensorChanges: Partial<TSensorState>;
    newInventories: Record<number, FloorItem[]> | null;
    newEquipment: Record<number, ChampionEquipment> | null;
    matched: boolean;
};

type AlcoveResult<TSensorState extends SensorStateLike> = {
    sensorChanges: Partial<TSensorState>;
    newInventories: Record<number, FloorItem[]> | null;
    newEquipment: Record<number, ChampionEquipment> | null;
    depositedItem: FloorItem | null;
    matched: boolean;
};

type ObjectResult<TSensorState extends SensorStateLike> = {
    sensorChanges: Partial<TSensorState>;
    matched: boolean;
};

type FirestaffRewardStateLike = {
    level: number;
    position: [number, number];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
};

type FirestaffRewardResult = {
    nextInventories: Record<number, FloorItem[]> | null;
    nextEquipment: Record<number, ChampionEquipment> | null;
    nextFloorItems: FloorItem[];
    transformed: boolean;
};

function isWallTile(tile: GameTile | undefined): tile is GameTile {
    return Boolean(tile && (tile.type === 'Wall' || tile.type === 'TrickWall'));
}

function isItemCategory(category: unknown): category is FloorItem['category'] {
    return category === 'Weapon'
        || category === 'Armor'
        || category === 'Potion'
        || category === 'Scroll'
        || category === 'Misc'
        || category === 'Container';
}

function hasOriginalWallMountedItemAtFace(tile: GameTile, face: CardinalDir): boolean {
    return tile.objects.some((object) =>
        object.category !== 'Sensor'
        && isItemCategory(object.category)
        && (object as { tilePos?: CardinalDir }).tilePos === face,
    );
}

function isHoldWallNicheSensor(sensor: SensorObject): boolean {
    return (sensor.type === 1 || sensor.type === 2 || sensor.type === 3)
        && sensor.action === 'Hold';
}

function resolveHoldWallNicheAction(sensor: SensorObject): SensorAction {
    return sensor.revert ? 'Clear' : 'Set';
}

function resolveMountedItemPickupAction(sensor: Pick<SensorObject, 'revert'>): SensorAction {
    return sensor.revert ? 'Set' : 'Clear';
}

function resolveWallSensorRequiredItemName<TSensorState extends SensorStateLike, TState>(
    deps: WallItemSensorDeps<TSensorState, TState>,
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
    sensor: SensorObject,
): string | undefined {
    return deps.getWallSensorRequiredItemOverride?.(level, x, y, face, sensor)
        ?? deps.getRequiredSensorItemName(sensor);
}

export function triggerLockSensors<
    TSensorState extends SensorStateLike,
    TState,
>(
    level: number,
    wx: number,
    wy: number,
    face: CardinalDir,
    ss: TSensorState,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
    deps: WallItemSensorDeps<TSensorState, TState>,
    selectedItem?: SelectedItem,
): LockResult<TSensorState> {
    const tile = deps.getTile(level, wx, wy);
    if (!isWallTile(tile)) {
        return { sensorChanges: {}, newInventories: null, newEquipment: null, matched: false };
    }

    let cur = ss;
    let matched = false;
    let matchedCompatibleLock = false;
    let newInventories: Record<number, FloorItem[]> | null = null;
    let newEquipment: Record<number, ChampionEquipment> | null = null;
    let shouldRotateFaceAfterProcessing = false;

    const selectedCandidate = selectedItem
        ? (
            selectedItem.fromSlot !== 'inventory'
                ? equipment[selectedItem.championId]?.[selectedItem.fromSlot as EquipSlotKey]
                : inventories[selectedItem.championId]?.find((item) => item.id === selectedItem.itemId)
        )
        : null;
    let carriedItemConsumed = false;
    let fallbackMatch:
        | {
            championId: number;
            itemId: string;
            slot: EquipSlotKey | null;
            item: FloorItem;
        }
        | null = null;

    const faceSensors = deps.getWallFaceSensorsInRuntimeOrder(level, wx, wy, face, ss.sensorRotationOffsets);
    for (let sensorIndex = 0; sensorIndex < faceSensors.length; sensorIndex += 1) {
        const sensor = faceSensors[sensorIndex];
        if (!deps.isWallLockSensor(sensor)) continue;
        if (deps.isWallSensorConsumedAtRuntime(level, sensor, cur)) continue;
        if ((sensor.type === 11 || sensor.type === 17) && sensorIndex < faceSensors.length - 1) continue;

        const requiredName = resolveWallSensorRequiredItemName(deps, level, wx, wy, face, sensor);
        const requiredData = sensor.data;
        let matchChampId: number | null = null;
        let matchItemId: string | null = null;
        let matchSlot: EquipSlotKey | null = null;
        let matchedItem: FloorItem | null = null;

        if (selectedItem) {
            if (carriedItemConsumed || !selectedCandidate) continue;

            const matchesByName = deps.itemMatchesMechanismRequirement(selectedCandidate, requiredName);
            const matchesByData = requiredName === undefined
                && deps.itemToLockData(selectedCandidate.category, selectedCandidate.typeId) === requiredData;
            const matchesRequirement = matchesByName || matchesByData;
            const shouldTrigger = sensor.revert ? !matchesRequirement : matchesRequirement;
            if (!shouldTrigger) continue;

            matchedCompatibleLock = true;
            matchChampId = selectedItem.championId;
            matchItemId = selectedCandidate.id;
            matchSlot = selectedItem.fromSlot !== 'inventory' ? selectedItem.fromSlot as EquipSlotKey : null;
            matchedItem = selectedCandidate;
        } else {
            if (carriedItemConsumed) continue;
            if (sensor.revert) continue;

            if (fallbackMatch) {
                const matchesByName = deps.itemMatchesMechanismRequirement(fallbackMatch.item, requiredName);
                const matchesByData = requiredName === undefined
                    && deps.itemToLockData(fallbackMatch.item.category, fallbackMatch.item.typeId) === requiredData;
                if (!matchesByName && !matchesByData) {
                    continue;
                }
                matchChampId = fallbackMatch.championId;
                matchItemId = fallbackMatch.itemId;
                matchSlot = fallbackMatch.slot;
                matchedItem = fallbackMatch.item;
            } else {
                for (const [cidStr, inv] of Object.entries(inventories)) {
                    for (const item of inv) {
                        const matchesByName = deps.itemMatchesMechanismRequirement(item, requiredName);
                        const matchesByData = requiredName === undefined
                            && deps.itemToLockData(item.category, item.typeId) === requiredData;
                        if (matchesByName || matchesByData) {
                            matchChampId = parseInt(cidStr, 10);
                            matchItemId = item.id;
                            matchedItem = item;
                            break;
                        }
                    }
                    if (matchChampId !== null) break;
                }
                if (matchChampId === null) {
                    for (const [cidStr, equip] of Object.entries(equipment)) {
                        for (const [slotKey, item] of Object.entries(equip ?? {}) as Array<[EquipSlotKey, FloorItem | undefined]>) {
                            if (!item) continue;
                            const matchesByName = deps.itemMatchesMechanismRequirement(item, requiredName);
                            const matchesByData = requiredName === undefined
                                && deps.itemToLockData(item.category, item.typeId) === requiredData;
                            if (matchesByName || matchesByData) {
                                matchChampId = parseInt(cidStr, 10);
                                matchItemId = item.id;
                                matchSlot = slotKey;
                                matchedItem = item;
                                break;
                            }
                        }
                        if (matchChampId !== null) break;
                    }
                }
                if (matchChampId === null || !matchedItem) continue;
                fallbackMatch = {
                    championId: matchChampId,
                    itemId: matchItemId ?? matchedItem.id,
                    slot: matchSlot,
                    item: matchedItem,
                };
            }
            matchedCompatibleLock = true;
        }

        const effectiveSensor = sensor.type === 17 && !sensor.onceOnly
            ? { ...sensor, onceOnly: true }
            : sensor;
        let nextState = cur;
        const effect = deps.computeSensorEffect(effectiveSensor, level, nextState);
        if (Object.keys(effect).length > 0) {
            if (effect.openDoors && effect.openDoors !== nextState.openDoors) {
                deps.playDoorMotion(deps.resolveDoorSoundTarget(effectiveSensor, level));
            }
            nextState = { ...nextState, ...effect } as TSensorState;
        }
        if (deps.shouldRotateWallFaceAfterActivation(level, wx, wy, face, nextState.sensorRotationOffsets)) {
            nextState = {
                ...nextState,
                sensorRotationOffsets: deps.rotateWallFaceSensors(level, wx, wy, face, nextState.sensorRotationOffsets),
            } as TSensorState;
        }

        const nextSensorPatch = deps.diffSensorState(cur, nextState);
        const stateChangedThisSensor = Object.keys(nextSensorPatch).length > 0;
        if (!stateChangedThisSensor && !deps.isConsumableLockSensor(sensor)) {
            continue;
        }

        if (deps.isConsumableLockSensor(sensor)) {
            if (carriedItemConsumed || matchChampId === null || matchItemId === null) {
                continue;
            }
            if (matchSlot) {
                if (newEquipment === null) newEquipment = { ...equipment };
                const equip = { ...(newEquipment[matchChampId] ?? equipment[matchChampId] ?? {}) };
                delete equip[matchSlot];
                newEquipment[matchChampId] = equip;
            } else {
                if (newInventories === null) newInventories = { ...inventories };
                const inv = newInventories[matchChampId] ?? inventories[matchChampId] ?? [];
                newInventories[matchChampId] = inv.filter((item) => item.id !== matchItemId);
            }
            carriedItemConsumed = true;
        }

        cur = nextState;
        matched = true;
        shouldRotateFaceAfterProcessing = shouldRotateFaceAfterProcessing
            || deps.shouldRotateWallFaceAfterActivation(level, wx, wy, face, cur.sensorRotationOffsets);
    }

    if (matched && shouldRotateFaceAfterProcessing) {
        cur = {
            ...cur,
            sensorRotationOffsets: deps.rotateWallFaceSensors(level, wx, wy, face, cur.sensorRotationOffsets),
        } as TSensorState;
    }

    const sensorChanges = deps.diffSensorState(ss, cur);
    return {
        sensorChanges,
        newInventories,
        newEquipment,
        matched: matched || matchedCompatibleLock,
    };
}

export function triggerAlcoveDepositSensor<
    TSensorState extends SensorStateLike,
    TState,
>(
    level: number,
    wx: number,
    wy: number,
    face: CardinalDir,
    ss: TSensorState,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
    selectedItem: SelectedItem,
    deps: WallItemSensorDeps<TSensorState, TState>,
): AlcoveResult<TSensorState> {
    const tile = deps.getTile(level, wx, wy);
    if (!isWallTile(tile)) {
        return { sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false };
    }

    const fromEquip = selectedItem.fromSlot !== 'inventory';
    const candidate = fromEquip
        ? equipment[selectedItem.championId]?.[selectedItem.fromSlot as EquipSlotKey]
        : inventories[selectedItem.championId]?.find((item) => item.id === selectedItem.itemId);
    if (!candidate) {
        return { sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false };
    }

    const faceSensors = deps.getWallFaceSensorsInRuntimeOrder(level, wx, wy, face, ss.sensorRotationOffsets);
    for (const sensor of faceSensors) {
        if (!deps.isWallAlcoveSensor(sensor)) continue;

        const requiredName = resolveWallSensorRequiredItemName(deps, level, wx, wy, face, sensor);
        if (requiredName && !deps.itemMatchesMechanismRequirement(candidate, requiredName)) continue;

        let newInventories: Record<number, FloorItem[]> | null = null;
        let newEquipment: Record<number, ChampionEquipment> | null = null;
        if (fromEquip) {
            newEquipment = { ...equipment };
            const equip = { ...(newEquipment[selectedItem.championId] ?? equipment[selectedItem.championId] ?? {}) };
            delete equip[selectedItem.fromSlot as EquipSlotKey];
            newEquipment[selectedItem.championId] = equip;
        } else {
            newInventories = { ...inventories };
            const inv = newInventories[selectedItem.championId] ?? inventories[selectedItem.championId] ?? [];
            newInventories[selectedItem.championId] = inv.filter((item) => item.id !== selectedItem.itemId);
        }

        const sensorKey = `${level}_${sensor.index}`;
        const activeSensors = deps.applyToSet(ss.activeSensors, sensorKey, 'Set');
        const nextState = {
            ...ss,
            activeSensors,
            sensorRotationOffsets: deps.rotateWallFaceSensors(
                level,
                wx,
                wy,
                face,
                ({ ...ss, activeSensors } as TSensorState).sensorRotationOffsets,
            ),
        } as TSensorState;
        return {
            sensorChanges: deps.diffSensorState(ss, nextState),
            newInventories,
            newEquipment,
            depositedItem: { ...candidate, mapIndex: level, x: wx, y: wy, tilePos: sensor.tilePos },
            matched: true,
        };
    }

    const supportsMountedWallItem = hasOriginalWallMountedItemAtFace(tile, face);
    const supportsOriginalAlcoveWallFace = deps.isOriginalAlcoveWallFace(level, wx, wy, face);
    if (supportsMountedWallItem || supportsOriginalAlcoveWallFace) {
        for (const sensor of faceSensors) {
            if (sensor.type !== 2 || sensor.action === 'Hold') continue;

            const requiredName = resolveWallSensorRequiredItemName(deps, level, wx, wy, face, sensor);
            if (!requiredName || !deps.itemMatchesMechanismRequirement(candidate, requiredName)) continue;

            let newInventories: Record<number, FloorItem[]> | null = null;
            let newEquipment: Record<number, ChampionEquipment> | null = null;
            if (fromEquip) {
                newEquipment = { ...equipment };
                const equip = { ...(newEquipment[selectedItem.championId] ?? equipment[selectedItem.championId] ?? {}) };
                delete equip[selectedItem.fromSlot as EquipSlotKey];
                newEquipment[selectedItem.championId] = equip;
            } else {
                newInventories = { ...inventories };
                const inv = newInventories[selectedItem.championId] ?? inventories[selectedItem.championId] ?? [];
                newInventories[selectedItem.championId] = inv.filter((item) => item.id !== selectedItem.itemId);
            }

            const effect = deps.computeSensorEffect(sensor, level, ss);
            if (effect.openDoors && effect.openDoors !== ss.openDoors) {
                deps.playDoorMotion(deps.resolveDoorSoundTarget(sensor, level));
            }
            const nextState = { ...ss, ...effect } as TSensorState;

            return {
                sensorChanges: deps.diffSensorState(ss, nextState),
                newInventories,
                newEquipment,
                depositedItem: { ...candidate, mapIndex: level, x: wx, y: wy, tilePos: sensor.tilePos },
                matched: true,
            };
        }

        for (const sensor of faceSensors) {
            if (!isHoldWallNicheSensor(sensor)) continue;
            const requiredName = resolveWallSensorRequiredItemName(deps, level, wx, wy, face, sensor);
            if (requiredName && !deps.itemMatchesMechanismRequirement(candidate, requiredName)) continue;

            let newInventories: Record<number, FloorItem[]> | null = null;
            let newEquipment: Record<number, ChampionEquipment> | null = null;
            if (fromEquip) {
                newEquipment = { ...equipment };
                const equip = { ...(newEquipment[selectedItem.championId] ?? equipment[selectedItem.championId] ?? {}) };
                delete equip[selectedItem.fromSlot as EquipSlotKey];
                newEquipment[selectedItem.championId] = equip;
            } else {
                newInventories = { ...inventories };
                const inv = newInventories[selectedItem.championId] ?? inventories[selectedItem.championId] ?? [];
                newInventories[selectedItem.championId] = inv.filter((item) => item.id !== selectedItem.itemId);
            }

            const effectiveSensor = {
                ...sensor,
                action: resolveHoldWallNicheAction(sensor),
            };
            const effect = deps.computeSensorEffect(effectiveSensor, level, ss);
            if (effect.openDoors && effect.openDoors !== ss.openDoors) {
                deps.playDoorMotion(deps.resolveDoorSoundTarget(effectiveSensor, level));
            }
            const nextState = { ...ss, ...effect } as TSensorState;

            return {
                sensorChanges: deps.diffSensorState(ss, nextState),
                newInventories,
                newEquipment,
                depositedItem: { ...candidate, mapIndex: level, x: wx, y: wy, tilePos: sensor.tilePos },
                matched: true,
            };
        }
    }

    return { sensorChanges: {}, newInventories: null, newEquipment: null, depositedItem: null, matched: false };
}

export function triggerAnyObjectWallSensor<
    TSensorState extends SensorStateLike,
    TState,
>(
    level: number,
    wx: number,
    wy: number,
    face: CardinalDir,
    ss: TSensorState,
    deps: WallItemSensorDeps<TSensorState, TState>,
    selectedItem?: FloorItem,
): ObjectResult<TSensorState> {
    const tile = deps.getTile(level, wx, wy);
    if (!isWallTile(tile)) {
        return { sensorChanges: {}, matched: false };
    }

    const faceSensors = deps.getWallFaceSensorsInRuntimeOrder(level, wx, wy, face, ss.sensorRotationOffsets);
    const isAlcoveLikeFace = hasOriginalWallMountedItemAtFace(tile, face)
        || deps.isOriginalAlcoveWallFace(level, wx, wy, face);
    let cur = ss;
    let matched = false;

    for (const sensor of faceSensors) {
        if (sensor.type !== 2 || sensor.revert) continue;
        const requiredName = resolveWallSensorRequiredItemName(deps, level, wx, wy, face, sensor);
        if (requiredName) {
            if (isAlcoveLikeFace) continue;
            if (!selectedItem || !deps.itemMatchesMechanismRequirement(selectedItem, requiredName)) continue;
        }
        if (deps.isWallSensorConsumedAtRuntime(level, sensor, cur)) continue;
        const effectiveSensor = sensor.action === 'Hold'
            ? { ...sensor, action: 'Set' as SensorAction }
            : sensor;
        const effect = deps.computeSensorEffect(effectiveSensor, level, cur);
        if (Object.keys(effect).length > 0) {
            if (effect.openDoors && effect.openDoors !== cur.openDoors) {
                deps.playDoorMotion(deps.resolveDoorSoundTarget(effectiveSensor, level));
            }
            cur = { ...cur, ...effect } as TSensorState;
        }
        matched = true;
        break;
    }

    return {
        sensorChanges: matched ? deps.diffSensorState(ss, cur) : {},
        matched,
    };
}

export function triggerObjectExchangerSensor<
    TSensorState extends SensorStateLike,
    TState,
>(
    level: number,
    wx: number,
    wy: number,
    face: CardinalDir,
    ss: TSensorState,
    inventories: Record<number, FloorItem[]>,
    equipment: Record<number, ChampionEquipment>,
    selectedItem: SelectedItem,
    deps: WallItemSensorDeps<TSensorState, TState>,
): LockResult<TSensorState> {
    const tile = deps.getTile(level, wx, wy);
    if (!isWallTile(tile)) {
        return { sensorChanges: {}, newInventories: null, newEquipment: null, matched: false };
    }

    const fromEquip = selectedItem.fromSlot !== 'inventory';
    const candidate = fromEquip
        ? equipment[selectedItem.championId]?.[selectedItem.fromSlot as EquipSlotKey]
        : inventories[selectedItem.championId]?.find((item) => item.id === selectedItem.itemId);
    if (!candidate) {
        return { sensorChanges: {}, newInventories: null, newEquipment: null, matched: false };
    }

    const faceSensors = deps.getWallFaceSensorsInRuntimeOrder(level, wx, wy, face, ss.sensorRotationOffsets);
    const pendingAmalgamUnlock = faceSensors.find((sensor) =>
        sensor.type === 17 &&
        resolveWallSensorRequiredItemName(deps, level, wx, wy, face, sensor) === 'ZOKATHRA SPELL' &&
        !ss.firedSensors.has(`${level}_${sensor.index}`),
    );
    for (const sensor of faceSensors) {
        if (!deps.isWallObjectExchangerSensor(sensor)) continue;
        if (
            pendingAmalgamUnlock &&
            sensor.type === 16 &&
            resolveWallSensorRequiredItemName(deps, level, wx, wy, face, sensor) === 'THE FIRESTAFF'
        ) {
            continue;
        }

        const requiredName = resolveWallSensorRequiredItemName(deps, level, wx, wy, face, sensor);
        if (requiredName && !deps.itemMatchesMechanismRequirement(candidate, requiredName)) continue;

        let newInventories: Record<number, FloorItem[]> | null = null;
        let newEquipment: Record<number, ChampionEquipment> | null = null;
        if (fromEquip) {
            newEquipment = { ...equipment };
            const equip = { ...(newEquipment[selectedItem.championId] ?? equipment[selectedItem.championId] ?? {}) };
            delete equip[selectedItem.fromSlot as EquipSlotKey];
            newEquipment[selectedItem.championId] = equip;
        } else {
            newInventories = { ...inventories };
            const inv = newInventories[selectedItem.championId] ?? inventories[selectedItem.championId] ?? [];
            newInventories[selectedItem.championId] = inv.filter((item) => item.id !== selectedItem.itemId);
        }

        const sensorKey = `${level}_${sensor.index}`;
        const activeSensors = deps.applyToSet(ss.activeSensors, sensorKey, 'Set');
        let baseState = { ...ss, activeSensors } as TSensorState;
        const effect = deps.computeSensorEffect(sensor, level, baseState);
        if (effect.openDoors && effect.openDoors !== baseState.openDoors) {
            deps.playDoorMotion(deps.resolveDoorSoundTarget(sensor, level));
        }
        baseState = { ...baseState, ...effect } as TSensorState;
        if (deps.shouldRotateWallFaceAfterActivation(level, wx, wy, face, baseState.sensorRotationOffsets)) {
            baseState = {
                ...baseState,
                sensorRotationOffsets: deps.rotateWallFaceSensors(level, wx, wy, face, baseState.sensorRotationOffsets),
            } as TSensorState;
        }
        return {
            sensorChanges: deps.diffSensorState(ss, baseState),
            newInventories,
            newEquipment,
            matched: true,
        };
    }

    return { sensorChanges: {}, newInventories: null, newEquipment: null, matched: false };
}

export function clearAlcoveStateOnPickup<
    TSensorState extends SensorStateLike,
    TState,
>(
    item: FloorItem,
    state: TState,
    deps: WallItemSensorDeps<TSensorState, TState>,
): Partial<TSensorState> {
    const tile = deps.getTile(item.mapIndex, item.x, item.y);
    if (!isWallTile(tile)) return {};

    const initialSensorState = deps.buildSensorStateSnapshot(state);
    const faceSensors = deps.getWallFaceSensorsInRuntimeOrder(
        item.mapIndex,
        item.x,
        item.y,
        item.tilePos,
        initialSensorState.sensorRotationOffsets,
    );
    for (const sensor of faceSensors) {
        if (!deps.isWallAlcoveSensor(sensor)) continue;
        const requiredName = resolveWallSensorRequiredItemName(deps, item.mapIndex, item.x, item.y, item.tilePos, sensor);
        if (requiredName && !deps.itemMatchesMechanismRequirement(item, requiredName)) continue;
        const sensorKey = `${item.mapIndex}_${sensor.index}`;
        let nextState = {
            ...initialSensorState,
            activeSensors: deps.applyToSet(initialSensorState.activeSensors, sensorKey, 'Clear'),
        } as TSensorState;
        nextState = {
            ...nextState,
            sensorRotationOffsets: deps.rotateWallFaceSensors(item.mapIndex, item.x, item.y, item.tilePos, nextState.sensorRotationOffsets),
        };
        return deps.diffSensorState(initialSensorState, nextState);
    }

    const hasOriginalMountedItem = hasOriginalWallMountedItemAtFace(tile, item.tilePos);
    const hasOriginalAlcoveFace = deps.isOriginalAlcoveWallFace(item.mapIndex, item.x, item.y, item.tilePos);
    if (!hasOriginalMountedItem && !hasOriginalAlcoveFace) return {};

    const remainingMountedItems = ((state as { floorItems?: FloorItem[] }).floorItems ?? []).some((entry) =>
        entry.id !== item.id
        && entry.mapIndex === item.mapIndex
        && entry.x === item.x
        && entry.y === item.y
        && entry.tilePos === item.tilePos,
    );
    if (remainingMountedItems) return {};

    let nextState = initialSensorState;

    if (hasOriginalMountedItem) {
        for (const sensor of faceSensors) {
            if (sensor.type !== 2 || sensor.action === 'Hold') continue;
            if (deps.isWallSensorConsumedAtRuntime(item.mapIndex, sensor, nextState)) continue;
            const requiredName = resolveWallSensorRequiredItemName(deps, item.mapIndex, item.x, item.y, item.tilePos, sensor);
            if (requiredName && !deps.itemMatchesMechanismRequirement(item, requiredName)) continue;

            const effectiveSensor = {
                ...sensor,
                action: resolveMountedItemPickupAction(sensor),
            };
            const effect = deps.computeSensorEffect(effectiveSensor, item.mapIndex, nextState);
            if (effect.openDoors && effect.openDoors !== nextState.openDoors) {
                deps.playDoorMotion(deps.resolveDoorSoundTarget(effectiveSensor, item.mapIndex));
            }
            if (Object.keys(effect).length > 0) {
                nextState = { ...nextState, ...effect } as TSensorState;
            }
        }
    }

    for (const sensor of faceSensors) {
        if (!isHoldWallNicheSensor(sensor)) continue;
        const requiredName = resolveWallSensorRequiredItemName(deps, item.mapIndex, item.x, item.y, item.tilePos, sensor);
        if (requiredName && !deps.itemMatchesMechanismRequirement(item, requiredName)) continue;
        const effectiveSensor = {
            ...sensor,
            action: resolveMountedItemPickupAction(sensor),
        };
        const effect = deps.computeSensorEffect(effectiveSensor, item.mapIndex, nextState);
        if (effect.openDoors && effect.openDoors !== nextState.openDoors) {
            deps.playDoorMotion(deps.resolveDoorSoundTarget(effectiveSensor, item.mapIndex));
        }
        if (Object.keys(effect).length > 0) {
            nextState = { ...nextState, ...effect } as TSensorState;
        }
    }

    return deps.diffSensorState(initialSensorState, nextState);
}

export function applyFirestaffExchangerReward<TState extends FirestaffRewardStateLike>(
    state: TState,
    wallX: number,
    wallY: number,
    face: CardinalDir,
    candidate: FloorItem | undefined,
    receiver: { championId: number; fromSlot: EquipSlotKey | 'inventory' },
    nextInventories: Record<number, FloorItem[]> | null,
    nextEquipment: Record<number, ChampionEquipment> | null,
    nextFloorItems: FloorItem[],
): FirestaffRewardResult {
    const completeFirestaffReward = nextFloorItems.find((item) =>
        item.mapIndex === state.level &&
        item.x === wallX &&
        item.y === wallY &&
        item.tilePos === face &&
        item.category === 'Weapon' &&
        item.typeId === 45,
    );
    const transformsToCompleteFirestaff =
        completeFirestaffReward &&
        candidate?.category === 'Weapon' &&
        candidate.typeId === 7;

    if (!transformsToCompleteFirestaff || !completeFirestaffReward) {
        return { nextInventories, nextEquipment, nextFloorItems, transformed: false };
    }

    const trimmedFloorItems = nextFloorItems.filter((item) => item.id !== completeFirestaffReward.id);
    const upgradedFirestaff: FloorItem = {
        ...completeFirestaffReward,
        mapIndex: state.level,
        x: state.position[1],
        y: state.position[0],
        tilePos: 'North',
    };

    if (receiver.fromSlot !== 'inventory') {
        const resolvedEquipment = { ...(nextEquipment ?? state.championEquipment) };
        resolvedEquipment[receiver.championId] = {
            ...(resolvedEquipment[receiver.championId] ?? state.championEquipment[receiver.championId] ?? {}),
            [receiver.fromSlot]: upgradedFirestaff,
        };
        return {
            nextInventories,
            nextEquipment: resolvedEquipment,
            nextFloorItems: trimmedFloorItems,
            transformed: true,
        };
    }

    const resolvedInventories = { ...(nextInventories ?? state.championInventories) };
    resolvedInventories[receiver.championId] = [
        ...(resolvedInventories[receiver.championId] ?? state.championInventories[receiver.championId] ?? []),
        upgradedFirestaff,
    ];
    return {
        nextInventories: resolvedInventories,
        nextEquipment,
        nextFloorItems: trimmedFloorItems,
        transformed: true,
    };
}
