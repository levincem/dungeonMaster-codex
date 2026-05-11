export const ALTERNATE_ENDING_ENTRANCE_DOOR_KEY = '0,2,1';
export const ALTERNATE_ENDING_WELCOME_TEXT_KEY = '0_1_4_31';
export const ALTERNATE_ENDING_HALL_TRIGGER_POSITION: [number, number] = [3, 1];
export const ALTERNATE_ENDING_WELCOME_MESSAGE = 'WELCOME BACK\nBRAVE\nADVENTURERS.';
export const ALTERNATE_ENDING_REJECTION_MESSAGE =
    'IT IS TOO BAD YOU\nDID NOT DISCOVER\nTHE TRUE SECRET\nOF THE FIRESTAFF.\nNOW THAT I HAVE\nIT I HAVE NO\nFURTHER NEED FOR\nYOU!';
export const ALTERNATE_ENDING_WELCOME_DURATION_MS = 5_000;
export const ALTERNATE_ENDING_MESSAGE_DURATION_MS = ALTERNATE_ENDING_WELCOME_DURATION_MS;
export const ALTERNATE_ENDING_REJECTION_DURATION_MS = 8_000;
export const ALTERNATE_ENDING_BARRAGE_DELAY_MS = 650;
export const ALTERNATE_ENDING_FIREBALL_INTERVAL_MS = 550;
export const ALTERNATE_ENDING_HALL_OVERLAY = {
    level: 0,
    tileX: 1,
    tileY: 1,
    face: 'South' as const,
};
export const ALTERNATE_ENDING_HALL_FIREBALL_ORIGIN = {
    level: 0,
    tileY: 1,
    tileX: 1,
};

export type AlternateEndingStage = 'hall_message' | 'order_warning' | 'barrage';

export interface AlternateEndingSequence {
    stage: AlternateEndingStage;
    startedAt: number;
    nextFireballAt: number;
    volleyCount: number;
}

type AlternateEndingPhase =
    | 'title'
    | 'exploration'
    | 'mirror_open'
    | 'endgame'
    | 'alternate_ending'
    | 'victory'
    | 'game_over';

type AlternateEndingStartState<TMessage> = {
    gamePhase: AlternateEndingPhase;
    openDoors: Set<string>;
    visibleTexts: Set<string>;
    optionsModalOpen: boolean;
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    sleeping: boolean;
    paused: boolean;
    lastCastResult: TMessage | null;
    alternateEndingSequence: AlternateEndingSequence | null;
};

type AlternateEndingFrameState<TMessage, TSpellVisualEvent, TProjectile, TPartyMember extends { id: number }> = {
    level: number;
    position: [number, number];
    direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
    party: TPartyMember[];
    spellVisualEvents: TSpellVisualEvent[];
    projectiles: TProjectile[];
    lastCastResult: TMessage | null;
    alternateEndingSequence: AlternateEndingSequence | null;
};

type AlternateEndingFrameDeps<TMessage, TSpellVisualEvent, TProjectile> = {
    buildMessageResult: (message: string) => TMessage;
    buildWallFireballVisual: (level: number, x: number, y: number, now: number) => TSpellVisualEvent;
    buildFireballProjectile: (params: {
        now: number;
        targetChampionId: number | null;
        targetTileX: number;
        targetTileY: number;
        volleyCount: number;
    }) => TProjectile;
};

type AlternateEndingStartCheck = {
    phase: AlternateEndingPhase;
    partySize: number;
    level: number;
    position: [number, number];
    hasIncompleteFirestaff: boolean;
    hasCompleteFirestaff: boolean;
    hallTeleporterOpen: boolean;
};

export function shouldStartAlternateEndingHallSequence(args: AlternateEndingStartCheck): boolean {
    return (
        (args.phase === 'exploration' || args.phase === 'mirror_open') &&
        args.partySize > 0 &&
        args.level === 0 &&
        args.position[0] === ALTERNATE_ENDING_HALL_TRIGGER_POSITION[0] &&
        args.position[1] === ALTERNATE_ENDING_HALL_TRIGGER_POSITION[1] &&
        args.hasIncompleteFirestaff &&
        !args.hasCompleteFirestaff
    );
}

export function buildAlternateEndingHallStartPatch<
    TState extends AlternateEndingStartState<TMessage>,
    TMessage,
>(
    state: TState,
    now: number,
    deps: {
        buildMessageResult: (message: string) => TMessage;
    },
): Partial<TState> {
    const openDoors = new Set(state.openDoors);
    openDoors.add(ALTERNATE_ENDING_ENTRANCE_DOOR_KEY);
    const visibleTexts = new Set(state.visibleTexts);
    visibleTexts.add(ALTERNATE_ENDING_WELCOME_TEXT_KEY);

    return {
        gamePhase: 'alternate_ending',
        openDoors,
        visibleTexts,
        optionsModalOpen: false,
        activeMirrorChampionId: null,
        activePartyMemberId: null,
        sleeping: false,
        paused: false,
        lastCastResult: deps.buildMessageResult(ALTERNATE_ENDING_WELCOME_MESSAGE),
        alternateEndingSequence: {
            stage: 'hall_message',
            startedAt: now,
            nextFireballAt: 0,
            volleyCount: 0,
        },
    } as Partial<TState>;
}

export function buildAlternateEndingFramePatch<
    TState extends AlternateEndingFrameState<TMessage, TSpellVisualEvent, TProjectile, TPartyMember>,
    TMessage,
    TSpellVisualEvent,
    TProjectile,
    TPartyMember extends { id: number },
>(
    state: TState,
    now: number,
    deps: AlternateEndingFrameDeps<TMessage, TSpellVisualEvent, TProjectile>,
): Partial<TState> | null {
    const sequence = state.alternateEndingSequence;
    if (!sequence) return null;

    if (sequence.stage === 'hall_message') {
        if (now - sequence.startedAt < ALTERNATE_ENDING_WELCOME_DURATION_MS) {
            return null;
        }

        return {
            lastCastResult: deps.buildMessageResult(ALTERNATE_ENDING_REJECTION_MESSAGE),
            alternateEndingSequence: {
                stage: 'order_warning',
                startedAt: now,
                nextFireballAt: now + ALTERNATE_ENDING_BARRAGE_DELAY_MS,
                volleyCount: 0,
            },
        } as Partial<TState>;
    }

    if (sequence.stage === 'order_warning') {
        if (now - sequence.startedAt < ALTERNATE_ENDING_REJECTION_DURATION_MS) {
            return null;
        }

        return {
            lastCastResult: null,
            alternateEndingSequence: {
                stage: 'barrage',
                startedAt: now,
                nextFireballAt: now + ALTERNATE_ENDING_BARRAGE_DELAY_MS,
                volleyCount: 0,
            },
        } as Partial<TState>;
    }

    if (now < sequence.nextFireballAt) {
        return null;
    }

    const targetChampionId = state.party.length > 0
        ? state.party[sequence.volleyCount % state.party.length]?.id ?? null
        : null;

    return {
        spellVisualEvents: [
            ...state.spellVisualEvents,
            deps.buildWallFireballVisual(
                ALTERNATE_ENDING_HALL_FIREBALL_ORIGIN.level,
                ALTERNATE_ENDING_HALL_FIREBALL_ORIGIN.tileX,
                ALTERNATE_ENDING_HALL_FIREBALL_ORIGIN.tileY,
                now,
            ),
        ],
        projectiles: [
            ...state.projectiles,
            deps.buildFireballProjectile({
                now,
                targetChampionId,
                targetTileX: state.position[1],
                targetTileY: state.position[0],
                volleyCount: sequence.volleyCount,
            }),
        ],
        alternateEndingSequence: {
            stage: 'barrage',
            startedAt: sequence.startedAt,
            nextFireballAt: now + ALTERNATE_ENDING_FIREBALL_INTERVAL_MS,
            volleyCount: sequence.volleyCount + 1,
        },
    } as Partial<TState>;
}
