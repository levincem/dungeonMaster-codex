import type { WallTextObject } from '../../types/game';
import type {
    ActivePoisonCloud,
    ProjectileEffect,
    SpellVisualEvent,
} from '../runtimeTypes';

export type EndgameFuseAction = {
    step: number;
    effects?: Array<{ effect: Exclude<ProjectileEffect, 'physical'>; scale: number }>;
    switchTypeId?: number;
    buzz?: boolean;
    hideFluxcages?: boolean;
    purgeOtherCreatures?: boolean;
};

export const ENDGAME_FUSE_ACTIONS: EndgameFuseAction[] = [
    { step: 1, effects: [{ effect: 'fireball', scale: 1.02 }] },
    { step: 2, effects: [{ effect: 'fireball', scale: 1.08 }] },
    { step: 3, effects: [{ effect: 'fireball', scale: 1.14 }] },
    { step: 4, effects: [{ effect: 'fireball', scale: 1.2 }] },
    { step: 5, effects: [{ effect: 'fireball', scale: 1.26 }] },
    { step: 6, effects: [{ effect: 'fireball', scale: 1.34 }] },
    { step: 7, switchTypeId: 25, buzz: true },
    { step: 8, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.04 }] },
    { step: 9, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.1 }] },
    { step: 10, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.16 }] },
    { step: 11, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.22 }] },
    { step: 12, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.28 }] },
    { step: 13, effects: [{ effect: 'disrupt_nonmaterial', scale: 1.36 }] },
    { step: 14, switchTypeId: 23, buzz: true },
    { step: 17, switchTypeId: 25, buzz: true },
    { step: 20, switchTypeId: 23, buzz: true },
    { step: 23, switchTypeId: 25, buzz: true },
    { step: 26, switchTypeId: 23, buzz: true },
    { step: 28, switchTypeId: 25, buzz: true },
    { step: 30, switchTypeId: 23, buzz: true },
    { step: 32, switchTypeId: 25, buzz: true },
    { step: 34, switchTypeId: 23, buzz: true },
    { step: 35, switchTypeId: 25, buzz: true },
    { step: 36, switchTypeId: 23, buzz: true },
    { step: 37, switchTypeId: 25, buzz: true },
    {
        step: 38,
        effects: [
            { effect: 'fireball', scale: 1.44 },
            { effect: 'disrupt_nonmaterial', scale: 1.44 },
        ],
    },
    { step: 39, switchTypeId: 26 },
    { step: 40, hideFluxcages: true },
    { step: 41, purgeOtherCreatures: true },
];

type EndgameMapTileLike = {
    objects: Array<{ category: string; text?: string }>;
};

type EndgameMapLike = {
    tiles: EndgameMapTileLike[][];
};

type StoreEndgameRuntimeParams = {
    quantizeMsToOriginalVbls: (ms: number) => number;
    getMap: (level: number) => EndgameMapLike;
    nowMs?: () => number;
    buildRandomToken?: () => string;
};

export function createStoreEndgameRuntime(
    params: StoreEndgameRuntimeParams,
) {
    const nowMs = params.nowMs ?? Date.now;
    const buildRandomToken = params.buildRandomToken ?? (() => Math.random().toString(36).slice(2));

    const buildEndgameSpellEvent = (
        effect: Exclude<ProjectileEffect, 'physical'>,
        level: number,
        x: number,
        y: number,
        ts: number,
        visualScale = 1.2,
    ): SpellVisualEvent => ({
        id: `endgame_${effect}_${ts}_${buildRandomToken()}`,
        level,
        x,
        y,
        effect,
        visualScale,
        ts,
        kind: 'creature',
        height: 0.02,
    });

    const buildActivePoisonCloud = (
        level: number,
        x: number,
        y: number,
        remainingAttack: number,
        nextPulseGameTick: number,
        visualScale = 1,
    ): ActivePoisonCloud => ({
        id: `poisoncloud_${nowMs()}_${buildRandomToken()}`,
        level,
        x,
        y,
        remainingAttack,
        nextPulseGameTick,
        visualScale,
    });

    const getEndgameMessagesForMap = (level: number): string[] => {
        const startTile = params.getMap(level).tiles[0]?.[0];
        if (!startTile) return [];

        return startTile.objects
            .filter((obj): obj is WallTextObject =>
                obj.category === 'Text' &&
                typeof obj.text === 'string' &&
                obj.text.length > 0,
            )
            .map((obj) => ({
                order: obj.text![0] ?? '',
                message: obj.text!.slice(1).trimStart(),
            }))
            .filter((entry) => /^[A-Z]$/.test(entry.order) && entry.message.length > 0)
            .sort((a, b) => a.order.localeCompare(b.order))
            .map((entry) => entry.message);
    };

    return {
        buildActivePoisonCloud,
        buildEndgameSpellEvent,
        endgameFinalDelayMs: params.quantizeMsToOriginalVbls(600),
        endgameFuseActions: ENDGAME_FUSE_ACTIONS,
        endgameFuseUpdateMs: params.quantizeMsToOriginalVbls(96),
        endgameMessageIntervalMs: params.quantizeMsToOriginalVbls(780),
        getEndgameMessagesForMap,
    };
}
