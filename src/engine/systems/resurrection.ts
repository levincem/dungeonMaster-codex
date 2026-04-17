import type { Champion } from '../../types/champion';
import type { CardinalDir, ChampionEquipment, FloorItem, GameTile, WallTextObject } from '../../types/game';

function hasAltarText(entry: unknown): entry is WallTextObject {
    return Boolean(
        entry &&
        typeof entry === 'object' &&
        'category' in entry &&
        (entry as WallTextObject).category === 'Text' &&
        typeof (entry as WallTextObject).text === 'string' &&
        (entry as WallTextObject).text!.includes('ALTAR'),
    );
}

export function createReincarnatedChampion(
    champion: Champion,
    randomInt: (max: number) => number,
): Champion {
    const reduceReincarnatedStat = (value: number): number => {
        const reduced = value - (value >> 3);
        return Math.max(30, reduced);
    };

    const reincarnated: Champion = {
        ...champion,
        strength: reduceReincarnatedStat(champion.strength),
        dexterity: reduceReincarnatedStat(champion.dexterity),
        wisdom: reduceReincarnatedStat(champion.wisdom),
        vitality: reduceReincarnatedStat(champion.vitality),
        antiMagic: reduceReincarnatedStat(champion.antiMagic),
        antiFire: reduceReincarnatedStat(champion.antiFire),
        health: Math.max(1, champion.health >> 1),
        stamina: Math.max(1, champion.stamina >> 1),
        mana: Math.max(0, champion.mana >> 1),
        skills: {
            fighter: [0, 0, 0, 0],
            ninja: [0, 0, 0, 0],
            priest: [0, 0, 0, 0],
            wizard: [0, 0, 0, 0],
        },
    };

    const statisticKeys: Array<keyof Pick<Champion, 'luck' | 'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire'>> = [
        'luck',
        'strength',
        'dexterity',
        'wisdom',
        'vitality',
        'antiMagic',
        'antiFire',
    ];

    for (let i = 0; i < 12; i += 1) {
        const statKey = statisticKeys[randomInt(statisticKeys.length)];
        if (!statKey) continue;
        reincarnated[statKey] += 1;
    }

    return reincarnated;
}

export function createViAltarRevivedChampion(champion: Champion): Champion {
    const revivedMaximumHealth = Math.max(25, champion.health - (champion.health >> 6) - 1);
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
    return Boolean(tile?.objects.some(hasAltarText));
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
    return tile.objects.some(
        (entry) => hasAltarText(entry) && entry.tilePos === face,
    );
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
                Math.max(1, revivedChampion.health >> 1),
                0,
                0,
                Math.round(deps.maxFood * 0.35),
                Math.round(deps.maxWater * 0.35),
            ),
        },
        championInventories: nextInventories,
        championEquipment: { ...state.championEquipment, [deadChampionId]: {} },
        floorItems: state.floorItems.filter((item) => item.id !== consumedItemId),
        deadChampions: nextDeadChampions,
    };
}
