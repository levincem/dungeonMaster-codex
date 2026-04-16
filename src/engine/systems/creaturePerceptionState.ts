type RememberedPartyPosition = {
    x: number;
    y: number;
    expiresAt: number;
};

type ResolveCreaturePerceptionStateArgs = {
    creaturePosition: [number, number];
    partyPosition: [number, number];
    nowMs: number;
    invisibleUntil: number;
    sightRange: number;
    seeInvisible: boolean;
    lastSeen: RememberedPartyPosition | undefined;
};

type ResolveCreaturePerceptionStateDeps = {
    hasLineOfSight: () => boolean;
};

export type CreaturePerceptionState = {
    distance: number;
    adjacent: boolean;
    canDetectParty: boolean;
    rememberedTarget: RememberedPartyPosition | null;
    nextRememberedTarget: RememberedPartyPosition | null;
    shouldClearExpiredMemory: boolean;
};

export function resolveCreaturePerceptionState(
    args: ResolveCreaturePerceptionStateArgs,
    deps: ResolveCreaturePerceptionStateDeps,
): CreaturePerceptionState {
    const [creatureX, creatureY] = args.creaturePosition;
    const [partyX, partyY] = args.partyPosition;
    const dx = partyX - creatureX;
    const dy = partyY - creatureY;
    const distance = Math.abs(dx) + Math.abs(dy);
    const adjacent = distance === 1;
    const partyInvisible = args.nowMs < args.invisibleUntil;
    const hasVisualLineOfSight =
        distance <= Math.max(1, args.sightRange) &&
        deps.hasLineOfSight();
    const canDetectParty = hasVisualLineOfSight && (!partyInvisible || args.seeInvisible);
    const rememberedTarget = args.lastSeen && args.lastSeen.expiresAt > args.nowMs ? args.lastSeen : null;
    const nextRememberedTarget = canDetectParty
        ? {
            x: partyX,
            y: partyY,
            expiresAt: args.nowMs + 6000,
        }
        : rememberedTarget;

    return {
        distance,
        adjacent,
        canDetectParty,
        rememberedTarget,
        nextRememberedTarget,
        shouldClearExpiredMemory: !canDetectParty && Boolean(args.lastSeen && args.lastSeen.expiresAt <= args.nowMs),
    };
}
