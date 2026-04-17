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

type PendingSensorEventLike = {
    level: number;
    sensorIndex: number;
    remaining: number;
};

type PendingSensorDepsLike<TSensorState> = {
    findSensorByIndex: (level: number, sensorIndex: number) => SensorObject | null;
    computeSensorEffect: (sensor: SensorObject, level: number, ss: TSensorState) => Partial<TSensorState>;
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => DoorSoundTarget;
    playDoorMotion: (target: DoorSoundTarget) => void;
    playPlate: () => void;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
};

type MovementSensorDepsLike<TSensorState, TPendingSensorEvent extends PendingSensorEventLike> = {
    getTile: (level: number, x: number, y: number) => { objects: unknown[] } | undefined;
    asSensor: (obj: unknown) => SensorObject | null;
    isCreatureOnlyFloorSensor: (sensor: SensorObject) => boolean;
    isGeneratorSensor: (sensor: SensorObject) => boolean;
    isPartyPossessionSensor: (sensor: SensorObject) => boolean;
    isSpecificObjectFloorSensor: (sensor: SensorObject) => boolean;
    getRequiredSensorItemName: (sensor: SensorObject) => string | undefined;
    partyHasRequiredItem: (
        requiredName: string | undefined,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
    ) => boolean;
    tileHasRequiredFloorItem: (
        level: number,
        x: number,
        y: number,
        requiredName: string | undefined,
        floorItems: FloorItem[],
    ) => boolean;
    computeSensorEffect: (sensor: SensorObject, level: number, ss: TSensorState) => Partial<TSensorState>;
    triggerGeneratorSensor: (level: number, sensor: SensorObject, ss: TSensorState) => TSensorState;
    queueOrComputeSensorEffect: (
        sensor: SensorObject,
        level: number,
        ss: TSensorState,
        pendingSensorEvents: TPendingSensorEvent[],
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => DoorSoundTarget;
    playDoorMotion: (target: DoorSoundTarget) => void;
    playPlate: () => void;
    notifyPlateActivated: (level: number, x: number, y: number) => void;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
};

type WallSensorActivationStateLike<TPendingSensorEvent> = {
    pendingSensorEvents: TPendingSensorEvent[];
    floorItems: FloorItem[];
};

type WallSensorActivationDepsLike<
    TState extends WallSensorActivationStateLike<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent,
    TAppliedPatch,
> = {
    getTile: (mapIndex: number, x: number, y: number) => GameTile | undefined;
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    getWallFaceSensorsInRuntimeOrder: (
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => SensorObject[];
    wallLauncherSensorTypes: Set<number>;
    applyToSet: (set: Set<string>, key: string, action: SensorAction) => Set<string>;
    getSelfRevealingWallSensor: (tile: GameTile | undefined) => SensorObject | null;
    queueOrComputeSensorEffect: (
        sensor: SensorObject,
        mapIndex: number,
        ss: TSensorState,
        pendingSensorEvents: TPendingSensorEvent[],
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => DoorSoundTarget;
    playDoorMotion: (target: DoorSoundTarget) => void;
    playPlate: () => void;
    shouldRotateWallFaceAfterActivation: (
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => boolean;
    rotateWallFaceSensors: (
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => Record<string, number>;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
    revealSelfWallMountedItems: (
        floorItems: FloorItem[],
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
    ) => FloorItem[];
    applyImmediateTransportSquareEffects: (state: TState, patch: Partial<TState>) => TAppliedPatch;
};

type WallPushDepsLike<TSensorState, TPendingSensorEvent extends PendingSensorEventLike> = {
    getTile: (level: number, x: number, y: number) => { type: string; objects: unknown[] } | undefined;
    asSensor: (obj: unknown) => SensorObject | null;
    resolvePushFace: (direction: string) => SensorObject['tilePos'];
    isWallLockSensor: (sensor: SensorObject) => boolean;
    queueOrComputeSensorEffect: (
        sensor: SensorObject,
        level: number,
        ss: TSensorState,
        pendingSensorEvents: TPendingSensorEvent[],
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => DoorSoundTarget;
    playDoorMotion: (target: DoorSoundTarget) => void;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
};

type WallItemSensorStateLike = {
    activeSensors: Set<string>;
    firedSensors: Set<string>;
    openDoors: Set<string>;
    sensorRotationOffsets: Record<string, number>;
};

type WallItemSensorDepsLike<TSensorState extends WallItemSensorStateLike, TState> = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    getWallFaceSensorsInRuntimeOrder: (
        level: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => SensorObject[];
    isWallLockSensor: (sensor: SensorObject) => boolean;
    isWallAlcoveSensor: (sensor: SensorObject) => boolean;
    isWallObjectExchangerSensor: (sensor: SensorObject) => boolean;
    isWallSensorConsumedAtRuntime: (level: number, sensor: SensorObject, ss: TSensorState) => boolean;
    getRequiredSensorItemName: (sensor: SensorObject) => string | undefined;
    itemMatchesMechanismRequirement: (item: FloorItem, requiredName: string | undefined) => boolean;
    itemToLockData: (category: FloorItem['category'], typeId: number) => number;
    isConsumableLockSensor: (sensor: SensorObject) => boolean;
    computeSensorEffect: (sensor: SensorObject, level: number, ss: TSensorState) => Partial<TSensorState>;
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

type SelectedItem = {
    championId: number;
    itemId: string;
    fromSlot: EquipSlotKey | 'inventory';
};

type FrontWallInteractionDepsLike<TState, TSensorState, TAppliedPatch extends Record<string, unknown>> = {
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    isAltarWallFace: (level: number, x: number, y: number, face: CardinalDir) => boolean;
    buildViAltarResurrectionPatch: (
        state: TState,
        deadChampionId: number,
        consumedItemId: string,
        carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
    ) => TAppliedPatch | null;
    triggerLockSensors: (
        level: number,
        wallX: number,
        wallY: number,
        face: CardinalDir,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        deps: WallItemSensorDepsLike<TSensorState & WallItemSensorStateLike, TState>,
        selectedItem: SelectedItem,
    ) => {
        sensorChanges: Record<string, unknown>;
        newInventories: Record<number, FloorItem[]> | null;
        newEquipment: Record<number, ChampionEquipment> | null;
        matched: boolean;
    };
    triggerAnyObjectWallSensor: (
        level: number,
        wallX: number,
        wallY: number,
        face: CardinalDir,
        ss: TSensorState,
        deps: WallItemSensorDepsLike<TSensorState & WallItemSensorStateLike, TState>,
    ) => {
        sensorChanges: Record<string, unknown>;
        matched: boolean;
    };
    triggerAlcoveDepositSensor: (
        level: number,
        wallX: number,
        wallY: number,
        face: CardinalDir,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        selectedItem: SelectedItem,
        deps: WallItemSensorDepsLike<TSensorState & WallItemSensorStateLike, TState>,
    ) => {
        sensorChanges: Record<string, unknown>;
        newInventories: Record<number, FloorItem[]> | null;
        newEquipment: Record<number, ChampionEquipment> | null;
        depositedItem: FloorItem | null;
        matched: boolean;
    };
    triggerObjectExchangerSensor: (
        level: number,
        wallX: number,
        wallY: number,
        face: CardinalDir,
        ss: TSensorState,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
        selectedItem: SelectedItem,
        deps: WallItemSensorDepsLike<TSensorState & WallItemSensorStateLike, TState>,
    ) => {
        sensorChanges: Record<string, unknown>;
        newInventories: Record<number, FloorItem[]> | null;
        newEquipment: Record<number, ChampionEquipment> | null;
        matched: boolean;
    };
    applyFirestaffExchangerReward: (
        state: TState,
        wallX: number,
        wallY: number,
        face: CardinalDir,
        candidate: FloorItem | undefined,
        receiver: { championId: number; fromSlot: EquipSlotKey | 'inventory' },
        nextInventories: Record<number, FloorItem[]> | null,
        nextEquipment: Record<number, ChampionEquipment> | null,
        nextFloorItems: FloorItem[],
    ) => {
        nextInventories: Record<number, FloorItem[]> | null;
        nextEquipment: Record<number, ChampionEquipment> | null;
        nextFloorItems: FloorItem[];
        transformed: boolean;
    };
    applyImmediateTransportSquareEffects: (state: TState, patch: Record<string, unknown>) => TAppliedPatch;
    buildAttackResultMessage: (message: string) => unknown;
};

type StoreSensorRuntimeDepsBundleParams<
    TState extends WallSensorActivationStateLike<TPendingSensorEvent>,
    TSensorState extends WallItemSensorStateLike,
    TPendingSensorEvent extends PendingSensorEventLike,
    TAppliedPatch extends Record<string, unknown>,
> = {
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    asSensor: (obj: unknown) => SensorObject | null;
    isCreatureOnlyFloorSensor: (sensor: SensorObject) => boolean;
    isGeneratorSensor: (sensor: SensorObject) => boolean;
    isPartyPossessionSensor: (sensor: SensorObject) => boolean;
    isSpecificObjectFloorSensor: (sensor: SensorObject) => boolean;
    getRequiredSensorItemName: (sensor: SensorObject) => string | undefined;
    partyHasRequiredItem: (
        requiredName: string | undefined,
        inventories: Record<number, FloorItem[]>,
        equipment: Record<number, ChampionEquipment>,
    ) => boolean;
    tileHasRequiredFloorItem: (
        level: number,
        x: number,
        y: number,
        requiredName: string | undefined,
        floorItems: FloorItem[],
    ) => boolean;
    computeSensorEffect: (sensor: SensorObject, level: number, ss: TSensorState) => Partial<TSensorState>;
    triggerGeneratorSensor: (level: number, sensor: SensorObject, ss: TSensorState) => TSensorState;
    queueOrComputeSensorEffect: (
        sensor: SensorObject,
        level: number,
        ss: TSensorState,
        pendingSensorEvents: TPendingSensorEvent[],
    ) => {
        sensorChanges: Partial<TSensorState>;
        pendingSensorEvents: TPendingSensorEvent[];
    };
    resolveDoorSoundTarget: (sensor: SensorObject, level: number) => DoorSoundTarget;
    playDoorMotion: (target: DoorSoundTarget) => void;
    playPlate: () => void;
    notifyPlateActivated: (level: number, x: number, y: number) => void;
    diffSensorState: (before: TSensorState, after: TSensorState) => Partial<TSensorState>;
    findSensorByIndex: (level: number, sensorIndex: number) => SensorObject | null;
    getWallFaceSensorsInRuntimeOrder: (
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => SensorObject[];
    wallLauncherSensorTypes: Set<number>;
    applyToSet: (set: Set<string>, key: string, action: SensorAction) => Set<string>;
    getSelfRevealingWallSensor: (tile: GameTile | undefined) => SensorObject | null;
    shouldRotateWallFaceAfterActivation: (
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => boolean;
    rotateWallFaceSensors: (
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
        rotationOffsets: Record<string, number>,
    ) => Record<string, number>;
    revealSelfWallMountedItems: (
        floorItems: FloorItem[],
        mapIndex: number,
        x: number,
        y: number,
        face: CardinalDir,
    ) => FloorItem[];
    applyImmediateTransportSquareEffects: (state: TState, patch: Partial<TState>) => TAppliedPatch;
    resolvePushFace: (direction: string) => SensorObject['tilePos'];
    isWallLockSensor: (sensor: SensorObject) => boolean;
    isWallAlcoveSensor: (sensor: SensorObject) => boolean;
    isWallObjectExchangerSensor: (sensor: SensorObject) => boolean;
    isWallSensorConsumedAtRuntime: (level: number, sensor: SensorObject, ss: TSensorState) => boolean;
    itemMatchesMechanismRequirement: (item: FloorItem, requiredName: string | undefined) => boolean;
    itemToLockData: (category: FloorItem['category'], typeId: number) => number;
    isConsumableLockSensor: (sensor: SensorObject) => boolean;
    buildSensorStateSnapshot: (state: TState) => TSensorState;
    isAltarWallFace: (level: number, x: number, y: number, face: CardinalDir) => boolean;
    buildViAltarResurrectionPatch: (
        state: TState,
        deadChampionId: number,
        consumedItemId: string,
        carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
    ) => TAppliedPatch | null;
    triggerLockSensors: FrontWallInteractionDepsLike<TState, TSensorState, TAppliedPatch>['triggerLockSensors'];
    triggerAnyObjectWallSensor: FrontWallInteractionDepsLike<TState, TSensorState, TAppliedPatch>['triggerAnyObjectWallSensor'];
    triggerAlcoveDepositSensor: FrontWallInteractionDepsLike<TState, TSensorState, TAppliedPatch>['triggerAlcoveDepositSensor'];
    triggerObjectExchangerSensor: FrontWallInteractionDepsLike<TState, TSensorState, TAppliedPatch>['triggerObjectExchangerSensor'];
    applyFirestaffExchangerReward: FrontWallInteractionDepsLike<TState, TSensorState, TAppliedPatch>['applyFirestaffExchangerReward'];
    buildAttackResultMessage: (message: string) => unknown;
};

export function buildAsSensor(obj: unknown): SensorObject | null {
    return (obj && typeof obj === 'object' && 'category' in obj && (obj as { category?: string }).category === 'Sensor')
        ? obj as SensorObject
        : null;
}

export function createPendingWorldEventDeps<TSensorState>(
    params: PendingSensorDepsLike<TSensorState>,
) {
    return {
        findSensorByIndex: params.findSensorByIndex,
        computeSensorEffect: params.computeSensorEffect,
        resolveDoorSoundTarget: params.resolveDoorSoundTarget,
        playDoorMotion: params.playDoorMotion,
        playPlate: params.playPlate,
        diffSensorState: params.diffSensorState,
    };
}

export function createMovementSensorDeps<TSensorState, TPendingSensorEvent extends PendingSensorEventLike>(
    params: MovementSensorDepsLike<TSensorState, TPendingSensorEvent>,
) {
    return {
        getTile: params.getTile,
        asSensor: params.asSensor,
        isCreatureOnlyFloorSensor: params.isCreatureOnlyFloorSensor,
        isGeneratorSensor: params.isGeneratorSensor,
        isPartyPossessionSensor: params.isPartyPossessionSensor,
        isSpecificObjectFloorSensor: params.isSpecificObjectFloorSensor,
        getRequiredSensorItemName: params.getRequiredSensorItemName,
        partyHasRequiredItem: params.partyHasRequiredItem,
        tileHasRequiredFloorItem: params.tileHasRequiredFloorItem,
        computeSensorEffect: params.computeSensorEffect,
        triggerGeneratorSensor: params.triggerGeneratorSensor,
        queueOrComputeSensorEffect: params.queueOrComputeSensorEffect,
        resolveDoorSoundTarget: params.resolveDoorSoundTarget,
        playDoorMotion: params.playDoorMotion,
        playPlate: params.playPlate,
        notifyPlateActivated: params.notifyPlateActivated,
        diffSensorState: params.diffSensorState,
    };
}

export function createWallSensorActivationDeps<
    TState extends WallSensorActivationStateLike<TPendingSensorEvent>,
    TSensorState,
    TPendingSensorEvent,
    TAppliedPatch,
>(
    params: WallSensorActivationDepsLike<TState, TSensorState, TPendingSensorEvent, TAppliedPatch>,
) {
    return {
        getTile: params.getTile,
        buildSensorStateSnapshot: params.buildSensorStateSnapshot,
        getWallFaceSensorsInRuntimeOrder: params.getWallFaceSensorsInRuntimeOrder,
        wallLauncherSensorTypes: params.wallLauncherSensorTypes,
        applyToSet: params.applyToSet,
        getSelfRevealingWallSensor: params.getSelfRevealingWallSensor,
        queueOrComputeSensorEffect: params.queueOrComputeSensorEffect,
        resolveDoorSoundTarget: params.resolveDoorSoundTarget,
        playDoorMotion: params.playDoorMotion,
        playPlate: params.playPlate,
        shouldRotateWallFaceAfterActivation: params.shouldRotateWallFaceAfterActivation,
        rotateWallFaceSensors: params.rotateWallFaceSensors,
        diffSensorState: params.diffSensorState,
        revealSelfWallMountedItems: params.revealSelfWallMountedItems,
        applyImmediateTransportSquareEffects: params.applyImmediateTransportSquareEffects,
    };
}

export function createWallPushSensorDeps<TSensorState, TPendingSensorEvent extends PendingSensorEventLike>(
    params: WallPushDepsLike<TSensorState, TPendingSensorEvent>,
) {
    return {
        getTile: params.getTile,
        asSensor: params.asSensor,
        resolvePushFace: params.resolvePushFace,
        isWallLockSensor: params.isWallLockSensor,
        queueOrComputeSensorEffect: params.queueOrComputeSensorEffect,
        resolveDoorSoundTarget: params.resolveDoorSoundTarget,
        playDoorMotion: params.playDoorMotion,
        diffSensorState: params.diffSensorState,
    };
}

export function createWallItemSensorDeps<TSensorState extends WallItemSensorStateLike, TState>(
    params: WallItemSensorDepsLike<TSensorState, TState>,
) {
    return {
        getTile: params.getTile,
        getWallFaceSensorsInRuntimeOrder: params.getWallFaceSensorsInRuntimeOrder,
        isWallLockSensor: params.isWallLockSensor,
        isWallAlcoveSensor: params.isWallAlcoveSensor,
        isWallObjectExchangerSensor: params.isWallObjectExchangerSensor,
        isWallSensorConsumedAtRuntime: params.isWallSensorConsumedAtRuntime,
        getRequiredSensorItemName: params.getRequiredSensorItemName,
        itemMatchesMechanismRequirement: params.itemMatchesMechanismRequirement,
        itemToLockData: params.itemToLockData,
        isConsumableLockSensor: params.isConsumableLockSensor,
        computeSensorEffect: params.computeSensorEffect,
        resolveDoorSoundTarget: params.resolveDoorSoundTarget,
        playDoorMotion: params.playDoorMotion,
        shouldRotateWallFaceAfterActivation: params.shouldRotateWallFaceAfterActivation,
        rotateWallFaceSensors: params.rotateWallFaceSensors,
        diffSensorState: params.diffSensorState,
        applyToSet: params.applyToSet,
        buildSensorStateSnapshot: params.buildSensorStateSnapshot,
    };
}

export function createFrontWallInteractionDeps<
    TState,
    TSensorState extends WallItemSensorStateLike,
    TAppliedPatch extends Record<string, unknown>,
>(
    params: FrontWallInteractionDepsLike<TState, TSensorState, TAppliedPatch>,
    wallItemSensorDeps: WallItemSensorDepsLike<TSensorState, TState>,
) {
    return {
        buildSensorStateSnapshot: params.buildSensorStateSnapshot,
        isAltarWallFace: params.isAltarWallFace,
        buildViAltarResurrectionPatch: params.buildViAltarResurrectionPatch,
        triggerLockSensors: (
            level: number,
            wallX: number,
            wallY: number,
            face: CardinalDir,
            ss: TSensorState,
            inventories: Record<number, FloorItem[]>,
            equipment: Record<number, ChampionEquipment>,
            selectedItem: SelectedItem,
        ) => params.triggerLockSensors(level, wallX, wallY, face, ss, inventories, equipment, wallItemSensorDeps, selectedItem),
        triggerAnyObjectWallSensor: (
            level: number,
            wallX: number,
            wallY: number,
            face: CardinalDir,
            ss: TSensorState,
        ) => params.triggerAnyObjectWallSensor(level, wallX, wallY, face, ss, wallItemSensorDeps),
        triggerAlcoveDepositSensor: (
            level: number,
            wallX: number,
            wallY: number,
            face: CardinalDir,
            ss: TSensorState,
            inventories: Record<number, FloorItem[]>,
            equipment: Record<number, ChampionEquipment>,
            selectedItem: SelectedItem,
        ) => params.triggerAlcoveDepositSensor(level, wallX, wallY, face, ss, inventories, equipment, selectedItem, wallItemSensorDeps),
        triggerObjectExchangerSensor: (
            level: number,
            wallX: number,
            wallY: number,
            face: CardinalDir,
            ss: TSensorState,
            inventories: Record<number, FloorItem[]>,
            equipment: Record<number, ChampionEquipment>,
            selectedItem: SelectedItem,
        ) => params.triggerObjectExchangerSensor(level, wallX, wallY, face, ss, inventories, equipment, selectedItem, wallItemSensorDeps),
        applyFirestaffExchangerReward: params.applyFirestaffExchangerReward,
        applyImmediateTransportSquareEffects: params.applyImmediateTransportSquareEffects,
        buildAttackResultMessage: params.buildAttackResultMessage,
    };
}

export function createStoreSensorRuntimeDepsBundle<
    TState extends WallSensorActivationStateLike<TPendingSensorEvent>,
    TSensorState extends WallItemSensorStateLike,
    TPendingSensorEvent extends PendingSensorEventLike,
    TAppliedPatch extends Record<string, unknown>,
>(
    params: StoreSensorRuntimeDepsBundleParams<TState, TSensorState, TPendingSensorEvent, TAppliedPatch>,
) {
    const buildMovementSensorDeps = () => createMovementSensorDeps<TSensorState, TPendingSensorEvent>({
        getTile: params.getTile,
        asSensor: params.asSensor,
        isCreatureOnlyFloorSensor: params.isCreatureOnlyFloorSensor,
        isGeneratorSensor: params.isGeneratorSensor,
        isPartyPossessionSensor: params.isPartyPossessionSensor,
        isSpecificObjectFloorSensor: params.isSpecificObjectFloorSensor,
        getRequiredSensorItemName: params.getRequiredSensorItemName,
        partyHasRequiredItem: params.partyHasRequiredItem,
        tileHasRequiredFloorItem: params.tileHasRequiredFloorItem,
        computeSensorEffect: params.computeSensorEffect,
        triggerGeneratorSensor: params.triggerGeneratorSensor,
        queueOrComputeSensorEffect: params.queueOrComputeSensorEffect,
        resolveDoorSoundTarget: params.resolveDoorSoundTarget,
        playDoorMotion: params.playDoorMotion,
        playPlate: params.playPlate,
        notifyPlateActivated: params.notifyPlateActivated,
        diffSensorState: params.diffSensorState,
    });

    const buildPendingWorldEventDeps = () => createPendingWorldEventDeps<TSensorState>({
        findSensorByIndex: params.findSensorByIndex,
        computeSensorEffect: params.computeSensorEffect,
        resolveDoorSoundTarget: params.resolveDoorSoundTarget,
        playDoorMotion: params.playDoorMotion,
        playPlate: params.playPlate,
        diffSensorState: params.diffSensorState,
    });

    const buildWallSensorActivationDeps = () => createWallSensorActivationDeps<
        TState,
        TSensorState,
        TPendingSensorEvent,
        TAppliedPatch
    >({
        getTile: params.getTile,
        buildSensorStateSnapshot: params.buildSensorStateSnapshot,
        getWallFaceSensorsInRuntimeOrder: params.getWallFaceSensorsInRuntimeOrder,
        wallLauncherSensorTypes: params.wallLauncherSensorTypes,
        applyToSet: params.applyToSet,
        getSelfRevealingWallSensor: params.getSelfRevealingWallSensor,
        queueOrComputeSensorEffect: params.queueOrComputeSensorEffect,
        resolveDoorSoundTarget: params.resolveDoorSoundTarget,
        playDoorMotion: params.playDoorMotion,
        playPlate: params.playPlate,
        shouldRotateWallFaceAfterActivation: params.shouldRotateWallFaceAfterActivation,
        rotateWallFaceSensors: params.rotateWallFaceSensors,
        diffSensorState: params.diffSensorState,
        revealSelfWallMountedItems: params.revealSelfWallMountedItems,
        applyImmediateTransportSquareEffects: params.applyImmediateTransportSquareEffects,
    });

    const buildWallPushSensorDeps = () => createWallPushSensorDeps<TSensorState, TPendingSensorEvent>({
        getTile: params.getTile,
        asSensor: params.asSensor,
        resolvePushFace: params.resolvePushFace,
        isWallLockSensor: params.isWallLockSensor,
        queueOrComputeSensorEffect: params.queueOrComputeSensorEffect,
        resolveDoorSoundTarget: params.resolveDoorSoundTarget,
        playDoorMotion: params.playDoorMotion,
        diffSensorState: params.diffSensorState,
    });

    const buildWallItemSensorDeps = () => createWallItemSensorDeps<TSensorState, TState>({
        getTile: params.getTile,
        getWallFaceSensorsInRuntimeOrder: params.getWallFaceSensorsInRuntimeOrder,
        isWallLockSensor: params.isWallLockSensor,
        isWallAlcoveSensor: params.isWallAlcoveSensor,
        isWallObjectExchangerSensor: params.isWallObjectExchangerSensor,
        isWallSensorConsumedAtRuntime: params.isWallSensorConsumedAtRuntime,
        getRequiredSensorItemName: params.getRequiredSensorItemName,
        itemMatchesMechanismRequirement: params.itemMatchesMechanismRequirement,
        itemToLockData: params.itemToLockData,
        isConsumableLockSensor: params.isConsumableLockSensor,
        computeSensorEffect: params.computeSensorEffect,
        resolveDoorSoundTarget: params.resolveDoorSoundTarget,
        playDoorMotion: params.playDoorMotion,
        shouldRotateWallFaceAfterActivation: params.shouldRotateWallFaceAfterActivation,
        rotateWallFaceSensors: params.rotateWallFaceSensors,
        diffSensorState: params.diffSensorState,
        applyToSet: params.applyToSet,
        buildSensorStateSnapshot: params.buildSensorStateSnapshot,
    });

    const buildFrontWallInteractionDeps = () => createFrontWallInteractionDeps<TState, TSensorState, TAppliedPatch>(
        {
            buildSensorStateSnapshot: params.buildSensorStateSnapshot,
            isAltarWallFace: params.isAltarWallFace,
            buildViAltarResurrectionPatch: params.buildViAltarResurrectionPatch,
            triggerLockSensors: params.triggerLockSensors,
            triggerAnyObjectWallSensor: params.triggerAnyObjectWallSensor,
            triggerAlcoveDepositSensor: params.triggerAlcoveDepositSensor,
            triggerObjectExchangerSensor: params.triggerObjectExchangerSensor,
            applyFirestaffExchangerReward: params.applyFirestaffExchangerReward,
            applyImmediateTransportSquareEffects: (
                state: TState,
                patch: Record<string, unknown>,
            ): TAppliedPatch =>
                params.applyImmediateTransportSquareEffects(state, patch as Partial<TState>),
            buildAttackResultMessage: params.buildAttackResultMessage,
        },
        {
            getTile: params.getTile,
            getWallFaceSensorsInRuntimeOrder: params.getWallFaceSensorsInRuntimeOrder,
            isWallLockSensor: params.isWallLockSensor,
            isWallAlcoveSensor: params.isWallAlcoveSensor,
            isWallObjectExchangerSensor: params.isWallObjectExchangerSensor,
            isWallSensorConsumedAtRuntime: params.isWallSensorConsumedAtRuntime,
            getRequiredSensorItemName: params.getRequiredSensorItemName,
            itemMatchesMechanismRequirement: params.itemMatchesMechanismRequirement,
            itemToLockData: params.itemToLockData,
            isConsumableLockSensor: params.isConsumableLockSensor,
            computeSensorEffect: params.computeSensorEffect,
            resolveDoorSoundTarget: params.resolveDoorSoundTarget,
            playDoorMotion: params.playDoorMotion,
            shouldRotateWallFaceAfterActivation: params.shouldRotateWallFaceAfterActivation,
            rotateWallFaceSensors: params.rotateWallFaceSensors,
            diffSensorState: params.diffSensorState,
            applyToSet: params.applyToSet,
            buildSensorStateSnapshot: params.buildSensorStateSnapshot,
        },
    );

    return {
        buildMovementSensorDeps,
        buildPendingWorldEventDeps,
        buildWallSensorActivationDeps,
        buildWallPushSensorDeps,
        buildWallItemSensorDeps,
        buildFrontWallInteractionDeps,
    };
}
