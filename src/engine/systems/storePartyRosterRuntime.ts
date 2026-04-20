import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';

type MirrorRecruitMode = 'resurrect' | 'reincarnate';

type AddToPartyStateLike<TVitals, TXp, TTemporaryXp, TCombat> = {
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    championVitals: Record<number, TVitals>;
    championXP: Record<number, TXp>;
    championTemporaryXP: Record<number, TTemporaryXp>;
    championCombat: Record<number, TCombat>;
    torchBurnStart: Record<string, number>;
};

type AddToPartyDeps<TVitals, TXp, TTemporaryXp, TCombat> = {
    maxPartySize: number;
    createReincarnatedChampion: (champion: Champion) => Champion;
    getChampionStarterLoadout: (championId: number) => {
        equipment: ChampionEquipment;
        inventory: FloorItem[];
    };
    seedTorchBurnStartFromEquipment: (
        equipment: ChampionEquipment,
        currentTorchBurnStart: Record<string, number>,
    ) => Record<string, number>;
    createChampionVitals: (
        champion: Champion,
        hp: number,
        stamina: number,
        mana: number,
    ) => TVitals;
    createEmptyChampionXP: () => TXp;
    buildInitialChampionXP: (champion: Champion) => TXp;
    createEmptyChampionTemporaryXP: () => TTemporaryXp;
    createChampionCombatState: (cooldownSec: number) => TCombat;
};

type RemoveFromPartyStateLike = {
    level: number;
    position: [number, number];
    party: Champion[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
};

export function buildAddToPartyPatch<
    TVitals,
    TXp,
    TTemporaryXp,
    TCombat,
    TState extends AddToPartyStateLike<TVitals, TXp, TTemporaryXp, TCombat>,
>(
    state: TState,
    champion: Champion,
    mode: MirrorRecruitMode,
    deps: AddToPartyDeps<TVitals, TXp, TTemporaryXp, TCombat>,
) {
    if (state.party.some((entry) => entry.id === champion.id)) return null;
    if (state.party.length >= deps.maxPartySize) return null;

    const recruitedChampion = mode === 'reincarnate'
        ? deps.createReincarnatedChampion(champion)
        : champion;
    const newParty = [...state.party, recruitedChampion];
    const starterLoadout = deps.getChampionStarterLoadout(champion.id);
    const hasExistingEquipment = champion.id in state.championEquipment;

    return {
        party: newParty,
        gateOpen: newParty.length >= deps.maxPartySize,
        championInventories: champion.id in state.championInventories
            ? state.championInventories
            : { ...state.championInventories, [champion.id]: starterLoadout.inventory },
        championEquipment: hasExistingEquipment
            ? state.championEquipment
            : { ...state.championEquipment, [champion.id]: starterLoadout.equipment },
        championVitals: champion.id in state.championVitals
            ? state.championVitals
            : {
                ...state.championVitals,
                [champion.id]: deps.createChampionVitals(
                    recruitedChampion,
                    recruitedChampion.health,
                    recruitedChampion.stamina,
                    recruitedChampion.mana,
                ),
            },
        championXP: champion.id in state.championXP
            ? state.championXP
            : {
                ...state.championXP,
                [champion.id]: mode === 'reincarnate'
                    ? deps.createEmptyChampionXP()
                    : deps.buildInitialChampionXP(recruitedChampion),
            },
        championTemporaryXP: champion.id in state.championTemporaryXP
            ? state.championTemporaryXP
            : {
                ...state.championTemporaryXP,
                [champion.id]: deps.createEmptyChampionTemporaryXP(),
            },
        championCombat: champion.id in state.championCombat
            ? state.championCombat
            : {
                ...state.championCombat,
                [champion.id]: deps.createChampionCombatState(0),
            },
        torchBurnStart: hasExistingEquipment
            ? state.torchBurnStart
            : deps.seedTorchBurnStartFromEquipment(
                starterLoadout.equipment,
                state.torchBurnStart,
            ),
    };
}

export function buildRemoveFromPartyPatch<TState extends RemoveFromPartyStateLike>(
    state: TState,
    championId: number,
) {
    const newParty = state.party.filter((entry) => entry.id !== championId);
    const [y, x] = state.position;
    const inventory = state.championInventories[championId] ?? [];
    const equipment = state.championEquipment[championId] ?? {};
    const carriedItems = [
        ...inventory,
        ...(Object.values(equipment).filter(Boolean) as FloorItem[]),
    ];
    const inHallOfChampions = state.level === 0;
    const dropped: FloorItem[] = [
        ...carriedItems,
    ].map((item) => ({ ...item, mapIndex: state.level, x, y, tilePos: 'North' }));

    return {
        party: newParty,
        gateOpen: false,
        floorItems: inHallOfChampions
            ? state.floorItems
            : [...state.floorItems, ...dropped],
        championInventories: {
            ...state.championInventories,
            [championId]: inHallOfChampions ? carriedItems : [],
        },
        championEquipment: { ...state.championEquipment, [championId]: {} },
    };
}
