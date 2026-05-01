import type {
    ChampionCombat,
    DamageEvent,
    Direction,
} from '../../engine/runtimeTypes';
import type { GameMap } from '../../types/game';
import type { ChampionEquipment } from '../../types/game';
import type { WeaponAttackOption } from '../../data/weaponAttacks';

export type HudChampionLike = {
    id: number;
    name?: string;
    class?: string;
    mana?: number;
};

export type HudFrontStateSummary = {
    frontLocalX: number;
    frontLocalY: number;
    frontGlobalX: number;
    frontGlobalY: number;
    frontState: string;
};

export type CombatGridSlotState = {
    champion: HudChampionLike | undefined;
    cooldownRatio: number;
    ready: boolean;
    weaponImage: string;
    weaponName: string;
    allAttacks: WeaponAttackOption[];
    usableAttacks: WeaponAttackOption[];
};

export type HudCastState<TSpell> = {
    currentFamilyIdx: number;
    canCast: boolean;
    casterChampion: HudChampionLike | undefined;
    casterChampionMana: number | undefined;
    casterChampionCooldown: number | undefined;
    spell: TSpell | undefined;
};

export type HudRecentDamageEntry = {
    amount: number;
    kind: 'normal' | 'poison';
};

export function buildHudFrontStateSummary(args: {
    currentMap: GameMap;
    level: number;
    position: [number, number];
    direction: Direction;
    openDoors: Set<string>;
    openWalls: Set<string>;
    openPits: Set<string>;
    openTeleporters: Set<string>;
}): HudFrontStateSummary {
    const { currentMap, direction, level, openDoors, openPits, openTeleporters, openWalls, position } = args;
    const frontLocalX = direction === 'EAST' ? position[1] + 1 : direction === 'WEST' ? position[1] - 1 : position[1];
    const frontLocalY = direction === 'NORTH' ? position[0] - 1 : direction === 'SOUTH' ? position[0] + 1 : position[0];
    const frontGlobalX = (currentMap.mapOffset?.x ?? 0) + frontLocalX;
    const frontGlobalY = (currentMap.mapOffset?.y ?? 0) + frontLocalY;
    const frontTile = currentMap.tiles[frontLocalY]?.[frontLocalX];
    const tileKey = `${level},${frontLocalY},${frontLocalX}`;
    const frontState =
        !frontTile
            ? 'void blocked'
            : frontTile.type === 'Wall'
                ? 'Wall blocked'
                : frontTile.type === 'TrickWall'
                    ? `TrickWall ${openWalls.has(tileKey) ? 'open walk' : 'closed blocked'}`
                    : frontTile.type === 'Door'
                        ? `Door ${openDoors.has(tileKey) ? 'open walk' : 'closed blocked'}`
                        : frontTile.type === 'Pit'
                            ? `Pit ${openPits.has(tileKey) ? 'open blocked' : 'closed walk'}`
                            : frontTile.type === 'Teleporter'
                                ? `Teleporter ${openTeleporters.has(tileKey) ? 'active walk' : 'inactive walk'}`
                            : `${frontTile.type} walk`;

    return {
        frontLocalX,
        frontLocalY,
        frontGlobalX,
        frontGlobalY,
        frontState,
    };
}

export function buildChampionRecentDamageMap(args: {
    party: HudChampionLike[];
    damageEvents: DamageEvent[];
    maxEntries?: number;
}): Record<number, HudRecentDamageEntry[]> {
    const { damageEvents, party } = args;
    const maxEntries = args.maxEntries ?? 2;
    const championIds = new Set(party.map((champion) => champion.id));
    const byChampionId: Record<number, HudRecentDamageEntry[]> = {};

    for (const event of damageEvents) {
        if (event.target !== 'champion' || event.championId === undefined) continue;
        if (!championIds.has(event.championId)) continue;
        const current = byChampionId[event.championId] ?? [];
        current.push({ amount: event.amount, kind: event.kind ?? 'normal' });
        if (current.length > maxEntries) {
            current.splice(0, current.length - maxEntries);
        }
        byChampionId[event.championId] = current;
    }

    return byChampionId;
}

export function buildCombatGridSlotState<C extends HudChampionLike>(args: {
    champion: C | undefined;
    championCombat: Record<number, ChampionCombat>;
    championEquipment: Record<number, ChampionEquipment>;
    emptyWeaponImage: string;
    fistLabel: string;
    resolveWeaponImage: (championId: number, equipment: ChampionEquipment) => string;
    resolveWeaponName: (championId: number, equipment: ChampionEquipment, direction: Direction) => string;
    getAllAttacks: (championId: number, equipment: ChampionEquipment) => WeaponAttackOption[];
    getAttackMasteryLevel: (championId: number, attack: WeaponAttackOption) => number;
    direction: Direction;
}): CombatGridSlotState {
    const {
        champion,
        championCombat,
        championEquipment,
        direction,
        emptyWeaponImage,
        fistLabel,
        getAllAttacks,
        getAttackMasteryLevel,
        resolveWeaponImage,
        resolveWeaponName,
    } = args;

    if (!champion) {
        return {
            champion,
            cooldownRatio: 0,
            ready: false,
            weaponImage: emptyWeaponImage,
            weaponName: fistLabel,
            allAttacks: [],
            usableAttacks: [],
        };
    }

    const combatState = championCombat[champion.id] ?? { cooldown: 0, cooldownMax: 1, defenseModifier: 0 };
    const cooldownRatio = combatState.cooldownMax > 0 ? Math.min(1, combatState.cooldown / combatState.cooldownMax) : 0;
    const ready = combatState.cooldown <= 0;
    const equipment = championEquipment[champion.id] ?? {};
    const allAttacks = getAllAttacks(champion.id, equipment).filter((attack) =>
        attack.masteryThreshold <= getAttackMasteryLevel(champion.id, attack),
    );
    const usableAttacks = allAttacks;

    return {
        champion,
        cooldownRatio,
        ready,
        weaponImage: resolveWeaponImage(champion.id, equipment),
        weaponName: resolveWeaponName(champion.id, equipment, direction),
        allAttacks,
        usableAttacks,
    };
}

export function selectHudRunes(currentRunes: string[], runeId: string): string[] {
    const existingIndex = currentRunes.indexOf(runeId);
    if (existingIndex !== -1) {
        return currentRunes.slice(0, existingIndex);
    }
    if (currentRunes.length >= 4) {
        return currentRunes;
    }
    return [...currentRunes, runeId];
}

function areHudRuneSelectionsEqual(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((runeId, index) => runeId === right[index]);
}

export function getPreparedHudRunes(
    preparedRunesByChampionId: Record<number, string[]>,
    championId: number | null,
): string[] {
    if (championId === null) return [];
    return preparedRunesByChampionId[championId] ?? [];
}

export function setPreparedHudRunes(
    preparedRunesByChampionId: Record<number, string[]>,
    championId: number | null,
    nextRunes: string[],
): Record<number, string[]> {
    if (championId === null) return preparedRunesByChampionId;

    const currentRunes = preparedRunesByChampionId[championId] ?? [];
    if (nextRunes.length === 0) {
        if (!(championId in preparedRunesByChampionId)) return preparedRunesByChampionId;
        const { [championId]: _removed, ...rest } = preparedRunesByChampionId;
        return rest;
    }

    if (areHudRuneSelectionsEqual(currentRunes, nextRunes)) {
        return preparedRunesByChampionId;
    }

    return {
        ...preparedRunesByChampionId,
        [championId]: nextRunes,
    };
}

export function prunePreparedHudRunes<C extends HudChampionLike>(
    preparedRunesByChampionId: Record<number, string[]>,
    party: C[],
): Record<number, string[]> {
    const activeChampionIds = new Set(party.map((champion) => champion.id));
    let changed = false;
    const nextPreparedRunes: Record<number, string[]> = {};

    for (const [championIdKey, runes] of Object.entries(preparedRunesByChampionId)) {
        const championId = Number(championIdKey);
        if (!activeChampionIds.has(championId)) {
            changed = true;
            continue;
        }
        nextPreparedRunes[championId] = runes;
    }

    return changed ? nextPreparedRunes : preparedRunesByChampionId;
}

export function didPartyTakeSingleStep(args: {
    previousLevel: number | null;
    nextLevel: number;
    previousPosition: [number, number] | null;
    nextPosition: [number, number];
}): boolean {
    const { previousLevel, nextLevel, previousPosition, nextPosition } = args;
    if (previousLevel === null || previousLevel !== nextLevel || !previousPosition) return false;

    const dy = Math.abs(nextPosition[0] - previousPosition[0]);
    const dx = Math.abs(nextPosition[1] - previousPosition[1]);
    return dx + dy === 1;
}

export function buildHudCastState<
    C extends HudChampionLike,
    TSpell extends { manaCost: number; name?: string },
>(args: {
    selectedRunes: string[];
    activeCasterChampionId: number | null;
    party: C[];
    championVitals: Record<number, { mana: number } | undefined>;
    championCombat: Record<number, { cooldown: number } | undefined>;
    findSpell: (runes: string[]) => TSpell | null | undefined;
    runeFamilyCount: number;
}): HudCastState<TSpell> {
    const {
        championCombat,
        championVitals,
        findSpell,
        party,
        runeFamilyCount,
        activeCasterChampionId,
        selectedRunes,
    } = args;
    const casterChampion = party.find((champion) => champion.id === activeCasterChampionId);
    const casterChampionMana = casterChampion ? championVitals[casterChampion.id]?.mana : undefined;
    const casterChampionCooldown = casterChampion ? championCombat[casterChampion.id]?.cooldown : undefined;
    const spell = findSpell(selectedRunes) ?? undefined;
    const canCast = selectedRunes.length >= 2 &&
        !!casterChampion &&
        (casterChampionCooldown ?? 0) <= 0 &&
        (spell ? (casterChampionMana ?? 0) >= spell.manaCost : true);

    return {
        currentFamilyIdx: Math.min(selectedRunes.length, Math.max(0, runeFamilyCount - 1)),
        canCast,
        casterChampion,
        casterChampionMana,
        casterChampionCooldown,
        spell,
    };
}
