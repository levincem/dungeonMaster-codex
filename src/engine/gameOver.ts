export type GameOverPhase = 'title' | 'exploration' | 'mirror_open' | 'endgame' | 'victory' | 'game_over';

export function shouldEnterGameOver(params: {
    phase: GameOverPhase;
    partySize: number;
    deadChampionCount: number;
}): boolean {
    return (
        params.phase !== 'title' &&
        params.phase !== 'victory' &&
        params.phase !== 'game_over' &&
        params.partySize === 0 &&
        params.deadChampionCount > 0
    );
}
