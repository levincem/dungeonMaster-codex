import type { CreatureInstance, FloorItem } from '../../types/game';

type FuseRightHand = {
    typeId: number;
    rawName?: string;
} | null | undefined;

type FuseState<TDamageEvent, TSpellVisualEvent> = {
    now: number;
    level: number;
    target: CreatureInstance | null;
    rightHand: FuseRightHand;
    rightHandWeaponName: string;
    fluxcageExpiresAt: number;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    damageEvents: TDamageEvent[];
    spellVisualEvents: TSpellVisualEvent[];
};

type FuseDeps<TMessage, TDamageEvent, TSpellVisualEvent> = {
    buildAttackResultMessage: (message: string) => TMessage;
    getEndgameMessagesForMap: (level: number) => string[];
    dropCreatureCarriedItems: (
        creatures: CreatureInstance[],
        floorItems: FloorItem[],
        creatureId: string,
    ) => { creatures: CreatureInstance[]; floorItems: FloorItem[] };
    buildCreatureDamageEvent: (
        level: number,
        x: number,
        y: number,
        amount: number,
        creatureId?: string,
    ) => TDamageEvent;
    buildDeathDustEvent: (level: number, x: number, y: number) => TSpellVisualEvent;
};

export type FuseActionResult<TPatch> = {
    patch: TPatch;
    clearCreatureControlStatuses?: boolean;
};

function hasCompleteFirestaff(
    rightHand: FuseRightHand,
    rightHandWeaponName: string,
): boolean {
    if (!rightHand) return false;
    if (rightHand.typeId === 45) return true;
    return /firestaff/.test(rightHandWeaponName.toLowerCase())
        && /complete|final/i.test((rightHand.rawName ?? '').toLowerCase());
}

export function buildFuseActionPatch<
    TPatch extends object,
    TMessage,
    TDamageEvent,
    TSpellVisualEvent,
>(
    state: FuseState<TDamageEvent, TSpellVisualEvent>,
    basePatch: TPatch,
    deps: FuseDeps<TMessage, TDamageEvent, TSpellVisualEvent>,
): FuseActionResult<TPatch> {
    if (!state.target) {
        return {
            patch: {
                ...basePatch,
                lastCastResult: deps.buildAttackResultMessage('FUSE sans cible.'),
            } as TPatch,
        };
    }

    if (!hasCompleteFirestaff(state.rightHand, state.rightHandWeaponName)) {
        return {
            patch: {
                ...basePatch,
                lastCastResult: deps.buildAttackResultMessage('FUSE requiert le Firestaff complet.'),
            } as TPatch,
        };
    }

    const trapped = state.fluxcageExpiresAt > state.now;
    if (state.target.typeId === 23 && !trapped) {
        return {
            patch: {
                ...basePatch,
                lastCastResult: deps.buildAttackResultMessage('Lord Chaos doit etre fluxcage avant FUSE.'),
            } as TPatch,
        };
    }

    if (state.target.typeId === 23) {
        return {
            clearCreatureControlStatuses: true,
            patch: {
                ...basePatch,
                projectiles: [],
                activePoisonClouds: [],
                creatures: state.creatures.map((creature) =>
                    creature.id === state.target?.id
                        ? {
                            ...creature,
                            currentHP: 10000,
                            alive: true,
                            cell: 'center',
                            typeId: 23,
                        }
                        : creature,
                ),
                gamePhase: 'endgame' as const,
                endgameSequence: {
                    startedAt: state.now,
                    level: state.level,
                    x: state.target.x,
                    y: state.target.y,
                    lordChaosId: state.target.id,
                    processedStepCount: 0,
                    hideFluxcages: false,
                    shownMessageCount: 0,
                    messages: deps.getEndgameMessagesForMap(state.level),
                },
                activeMirrorChampionId: null,
                activePartyMemberId: null,
                sleeping: false,
            } as TPatch,
        };
    }

    const fuseDamage = 90;
    const newHP = Math.max(0, state.target.currentHP - fuseDamage);
    const killed = newHP <= 0;
    let newCreatures = state.creatures.map((creature) =>
        creature.id === state.target?.id
            ? { ...creature, currentHP: newHP, alive: !killed }
            : creature,
    );
    let newFloorItems = state.floorItems;
    if (killed) {
        const dropped = deps.dropCreatureCarriedItems(newCreatures, newFloorItems, state.target.id);
        newCreatures = dropped.creatures;
        newFloorItems = dropped.floorItems;
    }
    const damageEvent = deps.buildCreatureDamageEvent(
        state.level,
        state.target.x,
        state.target.y,
        fuseDamage,
        state.target.id,
    );

    return {
        patch: {
            ...basePatch,
            creatures: newCreatures,
            ...(newFloorItems !== state.floorItems ? { floorItems: newFloorItems } : {}),
            damageEvents: [...state.damageEvents, damageEvent],
            ...(killed
                ? {
                    spellVisualEvents: [
                        ...state.spellVisualEvents,
                        deps.buildDeathDustEvent(state.level, state.target.x, state.target.y),
                    ],
                }
                : {}),
        } as TPatch,
    };
}
