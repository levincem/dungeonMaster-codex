import type { CardinalDir } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';

type TransientMessageLike = {
    success: boolean;
    message: string;
    ts: number;
};

type SpellVisualEventLike = {
    id: string;
    level: number;
    x: number;
    y: number;
    offsetX?: number;
    offsetZ?: number;
    height?: number;
    effect: 'open' | 'fireball' | 'lightning' | 'slime' | 'poison_cloud' | 'poison_bolt' | 'disrupt_nonmaterial';
    visualScale?: number;
    ts: number;
    kind: 'wall' | 'creature' | 'death';
};

type DamageEventLike = {
    id: string;
    level: number;
    target: 'creature' | 'champion';
    championId?: number;
    creatureId?: string;
    sourceName?: string;
    x?: number;
    y?: number;
    amount: number;
    kind?: 'normal' | 'poison';
    ts: number;
};

type ViAltarStateLike<TSpellVisualEvent, TChampionEquipment> = {
    level: number;
    spellVisualEvents: TSpellVisualEvent[];
    championEquipment: Record<number, TChampionEquipment>;
};

let transientMessageTimeout: ReturnType<typeof setTimeout> | null = null;

export function buildRuntimeCastResult(
    message: string,
    success = false,
): TransientMessageLike {
    return { success, message, ts: Date.now() };
}

export function scheduleStoreTransientMessage<TState>(
    message: string,
    success: boolean,
    durationMs: number,
    deps: {
        buildResult: (message: string, success: boolean) => TState[keyof TState];
        applyPatch: (patch: Partial<TState>) => void;
        getCurrentResult: () => TState[keyof TState] | null | undefined;
        clearMessage: () => void;
        readTimestamp: (value: TState[keyof TState] | null | undefined) => number | null;
    },
) {
    const result = deps.buildResult(message, success);
    deps.applyPatch({ lastCastResult: result } as unknown as Partial<TState>);
    if (transientMessageTimeout) clearTimeout(transientMessageTimeout);
    const resultTs = deps.readTimestamp(result);
    transientMessageTimeout = setTimeout(() => {
        const current = deps.getCurrentResult();
        if (deps.readTimestamp(current) === resultTs) {
            deps.clearMessage();
        }
    }, durationMs);
}

export function showStoreLastCastResultMessage<
    TState,
    TResult,
>(
    message: string,
    success: boolean,
    durationMs: number,
    deps: {
        buildResult: (message: string, success: boolean) => TResult;
        applyPatch: (patch: Partial<TState>) => void;
        getCurrentResult: () => TResult | null | undefined;
        clearLastCastResult: () => void;
        readTimestamp: (value: TResult | null | undefined) => number | null;
    },
) {
    scheduleStoreTransientMessage<TState>(message, success, durationMs, {
        buildResult: deps.buildResult as (message: string, success: boolean) => TState[keyof TState],
        applyPatch: deps.applyPatch,
        getCurrentResult: deps.getCurrentResult as () => TState[keyof TState] | null | undefined,
        clearMessage: deps.clearLastCastResult,
        readTimestamp: deps.readTimestamp as (value: TState[keyof TState] | null | undefined) => number | null,
    });
}

export function buildCreatureDamageEvent(
    level: number,
    x: number,
    y: number,
    amount: number,
    creatureId?: string,
): DamageEventLike {
    return {
        id: `dmg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level,
        target: 'creature',
        creatureId,
        x,
        y,
        amount,
        ts: Date.now(),
    };
}

export function buildChampionDamageEvent(
    level: number,
    championId: number,
    amount: number,
    kind: 'normal' | 'poison' = 'normal',
    sourceName?: string,
): DamageEventLike {
    return {
        id: `champ_dmg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level,
        target: 'champion',
        championId,
        ...(typeof sourceName === 'string' && sourceName.trim().length > 0 ? { sourceName: sourceName.trim() } : {}),
        amount,
        kind,
        ts: Date.now(),
    };
}

export function buildDeathDustEvent(
    level: number,
    x: number,
    y: number,
): SpellVisualEventLike {
    return {
        id: `deathdust_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level,
        x,
        y,
        effect: 'poison_cloud',
        ts: Date.now(),
        kind: 'death',
    };
}

function buildSpellVisualEvent(
    idPrefix: string,
    level: number,
    x: number,
    y: number,
    effect: SpellVisualEventLike['effect'],
    ts: number,
    options: Partial<Pick<SpellVisualEventLike, 'offsetX' | 'offsetZ' | 'height' | 'visualScale' | 'kind'>> = {},
): SpellVisualEventLike {
    return {
        id: `${idPrefix}_${ts}_${Math.random().toString(36).slice(2)}`,
        level,
        x,
        y,
        effect,
        ts,
        kind: options.kind ?? 'creature',
        ...(options.offsetX !== undefined ? { offsetX: options.offsetX } : {}),
        ...(options.offsetZ !== undefined ? { offsetZ: options.offsetZ } : {}),
        ...(options.height !== undefined ? { height: options.height } : {}),
        ...(options.visualScale !== undefined ? { visualScale: options.visualScale } : {}),
    };
}

export function buildFluxcageCastEvents(
    level: number,
    x: number,
    y: number,
    gridSize: number,
): SpellVisualEventLike[] {
    const ts = Date.now();
    return [
        buildSpellVisualEvent('fluxcage_shell', level, x, y, 'open', ts, {
            kind: 'creature',
            visualScale: 0.94,
            height: gridSize * 0.12,
        }),
        buildSpellVisualEvent('fluxcage_shards', level, x, y, 'disrupt_nonmaterial', ts, {
            kind: 'creature',
            visualScale: 1.08,
            height: gridSize * 0.24,
        }),
        buildSpellVisualEvent('fluxcage_crown', level, x, y, 'open', ts, {
            kind: 'creature',
            visualScale: 0.82,
            height: gridSize * 0.44,
            offsetX: gridSize * 0.08,
            offsetZ: -gridSize * 0.08,
        }),
    ];
}

export function buildFuseIgnitionEvents(
    level: number,
    x: number,
    y: number,
    gridSize: number,
): SpellVisualEventLike[] {
    const ts = Date.now();
    return [
        buildSpellVisualEvent('fuse_fire_core', level, x, y, 'fireball', ts, {
            kind: 'creature',
            visualScale: 1.18,
            height: gridSize * 0.1,
        }),
        buildSpellVisualEvent('fuse_fire_spark', level, x, y, 'fireball', ts, {
            kind: 'creature',
            visualScale: 0.96,
            height: gridSize * 0.34,
            offsetX: gridSize * 0.12,
            offsetZ: -gridSize * 0.08,
        }),
        buildSpellVisualEvent('fuse_flux', level, x, y, 'disrupt_nonmaterial', ts, {
            kind: 'creature',
            visualScale: 1.12,
            height: gridSize * 0.22,
        }),
        buildSpellVisualEvent('fuse_seal', level, x, y, 'open', ts, {
            kind: 'creature',
            visualScale: 1.28,
            height: gridSize * 0.5,
        }),
    ];
}

export function buildViAltarCelebrationEvents(
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
    gridSize: number,
): SpellVisualEventLike[] {
    const ts = Date.now();
    const faceOffset = face === 'North'
        ? { offsetX: 0, offsetZ: -gridSize * 0.34 }
        : face === 'South'
            ? { offsetX: 0, offsetZ: gridSize * 0.34 }
            : face === 'East'
                ? { offsetX: gridSize * 0.34, offsetZ: 0 }
                : { offsetX: -gridSize * 0.34, offsetZ: 0 };
    const tangentOffset = face === 'North' || face === 'South'
        ? { offsetX: gridSize * 0.18, offsetZ: 0 }
        : { offsetX: 0, offsetZ: gridSize * 0.18 };

    return [
        {
            id: `vi_altar_fire_${ts}_${Math.random().toString(36).slice(2)}`,
            level,
            x,
            y,
            effect: 'fireball',
            visualScale: 1.3,
            ts,
            kind: 'wall',
            height: gridSize * 0.18,
            ...faceOffset,
        },
        {
            id: `vi_altar_open_${ts}_${Math.random().toString(36).slice(2)}`,
            level,
            x,
            y,
            effect: 'open',
            visualScale: 1.15,
            ts,
            kind: 'wall',
            height: gridSize * 0.12,
            ...faceOffset,
        },
        {
            id: `vi_altar_spark_${ts}_${Math.random().toString(36).slice(2)}`,
            level,
            x,
            y,
            effect: 'fireball',
            visualScale: 0.9,
            ts,
            kind: 'wall',
            height: gridSize * 0.34,
            offsetX: faceOffset.offsetX + tangentOffset.offsetX,
            offsetZ: faceOffset.offsetZ + tangentOffset.offsetZ,
        },
        {
            id: `vi_altar_bless_${ts}_${Math.random().toString(36).slice(2)}`,
            level,
            x,
            y,
            effect: 'open',
            visualScale: 1.45,
            ts,
            kind: 'creature',
            height: gridSize * 0.46,
            offsetX: faceOffset.offsetX * 0.4,
            offsetZ: faceOffset.offsetZ * 0.4,
        },
    ];
}

export function applyConsumedChampionEquipmentPatch<
    TChampionEquipment,
    TState extends Pick<ViAltarStateLike<unknown, TChampionEquipment>, 'championEquipment'>,
    TPatch extends { championEquipment?: Record<number, TChampionEquipment> },
>(
    state: TState,
    basePatch: TPatch | null,
    carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
): TPatch | null {
    if (!basePatch || !carriedBy || carriedBy.fromSlot === 'inventory') {
        return basePatch;
    }

    const carrierEquipment = (basePatch.championEquipment ?? state.championEquipment)[carriedBy.championId] ?? {} as TChampionEquipment;
    const remainingEquipment = { ...(carrierEquipment as Record<string, unknown>) };
    delete remainingEquipment[carriedBy.fromSlot];
    return {
        ...basePatch,
        championEquipment: {
            ...(basePatch.championEquipment ?? state.championEquipment),
            [carriedBy.championId]: remainingEquipment as TChampionEquipment,
        },
    };
}

export function decorateViAltarResurrectionPatch<
    TSpellVisualEvent extends SpellVisualEventLike,
    TChampionEquipment,
    TCastResult,
    TState extends ViAltarStateLike<TSpellVisualEvent, TChampionEquipment>,
    TPatch extends {
        spellVisualEvents?: TSpellVisualEvent[];
        championEquipment?: Record<number, TChampionEquipment>;
        lastCastResult?: TCastResult | null;
    },
>(
    state: TState,
    basePatch: TPatch | null,
    wallX: number,
    wallY: number,
    wallFace: CardinalDir,
    carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
    deps: {
        applyConsumedChampionEquipmentPatch: (
            state: TState,
            patch: TPatch | null,
            carriedBy: { championId: number; fromSlot: EquipSlotKey | 'inventory' } | null,
        ) => TPatch | null;
        buildCelebrationEvents: (
            level: number,
            x: number,
            y: number,
            face: CardinalDir,
        ) => TSpellVisualEvent[];
        buildMessageResult: (message: string, success: boolean) => TCastResult;
        miracleMessage: string;
    },
): TPatch | null {
    const consumedPatch = deps.applyConsumedChampionEquipmentPatch(state, basePatch, carriedBy);
    if (!consumedPatch) return null;
    return {
        ...consumedPatch,
        spellVisualEvents: [
            ...(consumedPatch.spellVisualEvents ?? state.spellVisualEvents),
            ...deps.buildCelebrationEvents(state.level, wallX, wallY, wallFace),
        ],
        lastCastResult: deps.buildMessageResult(deps.miracleMessage, true),
    };
}
