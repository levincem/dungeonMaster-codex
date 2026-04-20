import type { Champion } from '../../types/champion';
import type { CreatureInstance } from '../../types/game';
import type { Direction } from '../runtimeTypes';
import {
    creaturesInFront,
    selectFrontCreatureTarget,
    type CreatureColumn,
} from './frontCreatureState';

export function getChampionPreferredColumn(
    party: Champion[],
    championId: number,
): CreatureColumn {
    const championIndex = party.findIndex((champion) => champion.id === championId);
    const isLeftColumn = championIndex === 0 || championIndex === 2;
    return isLeftColumn ? 'left' : 'right';
}

export function isChampionInRearRank(
    party: Champion[],
    championId: number,
): boolean {
    const championIndex = party.findIndex((champion) => champion.id === championId);
    return championIndex >= 2;
}

export function resolveAttackFrontContext(
    level: number,
    position: [number, number],
    direction: Direction,
    creatures: CreatureInstance[],
    party: Champion[],
    championId: number,
) {
    const preferredColumn = getChampionPreferredColumn(party, championId);
    const front = creaturesInFront(level, position, direction, creatures);
    const target = selectFrontCreatureTarget(front, preferredColumn);

    return {
        preferredColumn,
        front,
        target,
    };
}
