type PreparedCastResult<TPatch, TVitals> =
    | { kind: 'blocked'; patch: TPatch }
    | {
        kind: 'ready';
        basePatch: TPatch;
        castSucceeded: boolean;
        nextVitals: TVitals;
        skillLevel: number;
    };

type ProjectilePatchResult<TPatch> = {
    patch: TPatch;
    shouldPlayDoorMotion?: boolean;
    doorMotionSquare?: {
        level: number;
        x: number;
        y: number;
    };
};

type SpellCastStateDeps<TSpell, TPatch, TVitals> = {
    findSpell: (runeIds: string[]) => TSpell | null | undefined;
    buildUnknownCombinationPatch: () => TPatch;
    prepareCast: (spell: TSpell) => PreparedCastResult<TPatch, TVitals>;
    buildFailedCastPatch: (basePatch: TPatch, nextVitals: TVitals) => TPatch;
    buildNonProjectilePatch: (spell: TSpell, nextVitals: TVitals) => TPatch | null;
    buildProjectilePatch: (
        spell: TSpell,
        nextVitals: TVitals,
        skillLevel: number,
    ) => ProjectilePatchResult<TPatch> | null;
    mergeBasePatch: (basePatch: TPatch, nextPatch: TPatch) => TPatch;
};

export function buildCastSpellStatePatch<TSpell, TPatch, TVitals>(
    runeIds: string[],
    deps: SpellCastStateDeps<TSpell, TPatch, TVitals>,
): ProjectilePatchResult<TPatch> | null {
    const spell = deps.findSpell(runeIds);
    if (!spell) {
        return {
            patch: deps.buildUnknownCombinationPatch(),
            shouldPlayDoorMotion: false,
        };
    }

    const preparedCast = deps.prepareCast(spell);
    if (preparedCast.kind === 'blocked') {
        return {
            patch: preparedCast.patch,
            shouldPlayDoorMotion: false,
        };
    }

    const { basePatch, castSucceeded, nextVitals, skillLevel } = preparedCast;
    if (!castSucceeded) {
        return {
            patch: deps.buildFailedCastPatch(basePatch, nextVitals),
            shouldPlayDoorMotion: false,
        };
    }

    const nonProjectilePatch = deps.buildNonProjectilePatch(spell, nextVitals);
    if (nonProjectilePatch) {
        return {
            patch: deps.mergeBasePatch(basePatch, nonProjectilePatch),
            shouldPlayDoorMotion: false,
        };
    }

    const projectilePatch = deps.buildProjectilePatch(spell, nextVitals, skillLevel);
    if (projectilePatch) {
        return {
            ...projectilePatch,
            patch: deps.mergeBasePatch(basePatch, projectilePatch.patch),
        };
    }

    return {
        patch: deps.buildFailedCastPatch(basePatch, nextVitals),
        shouldPlayDoorMotion: false,
    };
}
