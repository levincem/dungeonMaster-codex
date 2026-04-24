import type { Champion } from '../../types/champion';
import type { CardinalDir, ChampionEquipment, FloorItem, GameTile } from '../../types/game';
import { hasOriginalWallOverlayAt } from '../../data/originalWallOverlays';
import {
    ORIGINAL_MIRROR_RECRUITMENT_RULES,
    ORIGINAL_VI_ALTAR_RESURRECTION_RULES,
} from '../../data/originalMirrorRecruitment';

const VI_ALTAR_OVERLAY_NAME = 'Vi Altar';

const ALTAR_TILE_NEIGHBORS: ReadonlyArray<{
    dx: number;
    dy: number;
    face: CardinalDir;
}> = [
    { dx: 1, dy: 0, face: 'West' },
    { dx: -1, dy: 0, face: 'East' },
    { dx: 0, dy: -1, face: 'South' },
    { dx: 0, dy: 1, face: 'North' },
];

function hasViAltarOverlay(
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
): boolean {
    return hasOriginalWallOverlayAt(level, x, y, face, VI_ALTAR_OVERLAY_NAME);
}

export function createReincarnatedChampion(
    champion: Champion,
    randomInt: (max: number) => number,
): Champion {
    const rules = ORIGINAL_MIRROR_RECRUITMENT_RULES.reincarnate;
    const reduceReincarnatedStat = (value: number): number => {
        const reduced = value - (value >> 3);
        return Math.max(rules.reducedStatFloor, reduced);
    };

    const reincarnated: Champion = {
        ...champion,
        strength: reduceReincarnatedStat(champion.strength),
        dexterity: reduceReincarnatedStat(champion.dexterity),
        wisdom: reduceReincarnatedStat(champion.wisdom),
        vitality: reduceReincarnatedStat(champion.vitality),
        antiMagic: reduceReincarnatedStat(champion.antiMagic),
        antiFire: reduceReincarnatedStat(champion.antiFire),
        health: Math.max(rules.poolHalving.healthMin, champion.health >> 1),
        stamina: Math.max(rules.poolHalving.staminaMin, champion.stamina >> 1),
        mana: Math.max(rules.poolHalving.manaMin, champion.mana >> 1),
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
    };

    const statisticKeys = [...rules.bonusStats];

    for (let i = 0; i < rules.bonusRolls; i += 1) {
        const statKey = statisticKeys[randomInt(statisticKeys.length)];
        if (!statKey) continue;
        reincarnated[statKey] += 1;
    }

    return reincarnated;
}

export function createViAltarRevivedChampion(champion: Champion): Champion {
    const rules = ORIGINAL_VI_ALTAR_RESURRECTION_RULES;
    const revivedMaximumHealth = Math.max(
        rules.maximumHealthRule.floor,
        champion.health - (champion.health >> 6) - 1,
    );
    return {
        ...champion,
        health: revivedMaximumHealth,
    };
}

export function isAltarTile(
    level: number,
    x: number,
    y: number,
    getTile: (level: number, x: number, y: number) => GameTile | undefined,
): boolean {
    const tile = getTile(level, x, y);
    if (tile?.type === 'Wall' || tile?.type === 'TrickWall') {
        return false;
    }

    return ALTAR_TILE_NEIGHBORS.some(({ dx, dy, face }) =>
        hasViAltarOverlay(level, x + dx, y + dy, face),
    );
}

export function isAltarWallFace(
    level: number,
    x: number,
    y: number,
    face: CardinalDir,
    getTile: (level: number, x: number, y: number) => GameTile | undefined,
): boolean {
    const tile = getTile(level, x, y);
    if (!tile) return false;
    return hasViAltarOverlay(level, x, y, face);
}

type ResurrectionState<TChampionVitals> = {
    party: Champion[];
    championVitals: Record<number, TChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
};

type ResurrectionDeps<TChampionVitals> = {
    createChampionVitals: (
        champion: Champion,
        hp: number,
        stamina: number,
        mana: number,
        food: number,
        water: number,
    ) => TChampionVitals;
    maxFood: number;
    maxWater: number;
};

export function buildViAltarResurrectionPatch<TChampionVitals>(
    state: ResurrectionState<TChampionVitals>,
    deadChampionId: number,
    consumedItemId: string,
    carriedBy: number | null,
    deps: ResurrectionDeps<TChampionVitals>,
): Partial<ResurrectionState<TChampionVitals>> | null {
    const deadChampion = state.deadChampions[deadChampionId];
    if (!deadChampion) return null;

    const revivedChampion = createViAltarRevivedChampion(deadChampion);
    const nextDeadChampions = { ...state.deadChampions };
    delete nextDeadChampions[deadChampionId];

    const nextInventories = carriedBy !== null
        ? {
            ...state.championInventories,
            [carriedBy]: (state.championInventories[carriedBy] ?? []).filter((item) => item.id !== consumedItemId),
            [deadChampionId]: [],
        }
        : {
            ...state.championInventories,
            [deadChampionId]: [],
        };

    return {
        party: [...state.party, revivedChampion],
        championVitals: {
            ...state.championVitals,
            [deadChampionId]: deps.createChampionVitals(
                revivedChampion,
                Math.max(ORIGINAL_VI_ALTAR_RESURRECTION_RULES.revivedVitals.healthMin, revivedChampion.health >> 1),
                ORIGINAL_VI_ALTAR_RESURRECTION_RULES.revivedVitals.stamina,
                ORIGINAL_VI_ALTAR_RESURRECTION_RULES.revivedVitals.mana,
                Math.round(deps.maxFood * ORIGINAL_VI_ALTAR_RESURRECTION_RULES.revivedVitals.foodRatio),
                Math.round(deps.maxWater * ORIGINAL_VI_ALTAR_RESURRECTION_RULES.revivedVitals.waterRatio),
            ),
        },
        championInventories: nextInventories,
        championEquipment: { ...state.championEquipment, [deadChampionId]: {} },
        floorItems: state.floorItems.filter((item) => item.id !== consumedItemId),
        deadChampions: nextDeadChampions,
    };
}
