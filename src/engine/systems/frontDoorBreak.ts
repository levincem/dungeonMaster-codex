import type { Champion } from '../../types/champion';
import type { ChampionEquipment, DoorObject, GameTile } from '../../types/game';
import { getTranslations } from '../../i18n';
import type { ActivePotionBoost, ChampionVitals, Direction } from '../runtimeTypes';
import type { WeaponAttackOption } from '../../data/weaponAttacks';
import { resolveBreakDoorAttempt } from './breakDoorAction';

const runtimeText = getTranslations().runtime;

type FrontDoorBreakState = {
    level: number;
    position: [number, number];
    direction: Direction;
    openDoors: Set<string>;
    brokenDoors: Set<string>;
    championVitals: Record<number, ChampionVitals>;
};

type EffectiveStats = {
    strength: number;
};

type FrontDoorBreakDeps = {
    getFrontPosition: (position: [number, number], direction: Direction) => { x: number; y: number };
    getTile: (level: number, x: number, y: number) => GameTile | undefined;
    getEffectiveChampionStatsRuntime: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals?: ChampionVitals,
    ) => EffectiveStats;
    getWeaponMaxDamage: (equip: ChampionEquipment | undefined) => number;
    randomInt: (max: number) => number;
    buildAttackResultMessage: (
        message: string,
        success?: boolean,
    ) => { success: boolean; message: string; ts: number };
};

export function tryBreakFrontDoor(
    state: FrontDoorBreakState,
    champion: Champion,
    equip: ChampionEquipment | undefined,
    activePotionBoosts: ActivePotionBoost[],
    selectedAttack: WeaponAttackOption | null,
    deps: FrontDoorBreakDeps,
): {
    openDoors: Set<string>;
    brokenDoors: Set<string>;
    message: { success: boolean; message: string; ts: number };
} | null {
    const { x, y } = deps.getFrontPosition(state.position, state.direction);
    const tile = deps.getTile(state.level, x, y);
    if (!tile || tile.type !== 'Door') return null;

    const key = `${state.level},${y},${x}`;
    const door = tile.objects.find((obj): obj is DoorObject => obj.category === 'Door');
    const effective = deps.getEffectiveChampionStatsRuntime(
        champion,
        equip,
        activePotionBoosts,
        state.championVitals[champion.id],
    );
    const weaponMax = deps.getWeaponMaxDamage(equip);
    const attackBonus = selectedAttack ? Math.max(0, selectedAttack.attack.strengthRequired) : 0;
    const breakPower = effective.strength + weaponMax + attackBonus + deps.randomInt(16);
    const result = resolveBreakDoorAttempt({
        openDoors: state.openDoors,
        brokenDoors: state.brokenDoors,
        doorKey: key,
        doorBreakable: Boolean(door?.destructChop),
        breakPower,
    });
    if (!result) return null;

    return {
        openDoors: result.nextOpenDoors,
        brokenDoors: result.nextBrokenDoors,
        message: result.outcome === 'broken'
            ? deps.buildAttackResultMessage(runtimeText.doorYields, true)
            : deps.buildAttackResultMessage(runtimeText.doorResists),
    };
}
