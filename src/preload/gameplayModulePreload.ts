import { preloadGameDbData } from '../data/gameDbData';

type GameRootModule = typeof import('../GameRoot');

let gameRootModulePromise: Promise<GameRootModule> | null = null;
let gameplayRenderCorePromise: Promise<void> | null = null;
let gameplayRenderFullPromise: Promise<void> | null = null;
let gameplayRenderCoreReady = false;
let gameplayRenderFullReady = false;

export function preloadGameRootModule(): Promise<GameRootModule> {
    if (!gameRootModulePromise) {
        gameRootModulePromise = preloadGameDbData().then(() => import('../GameRoot'));
    }
    return gameRootModulePromise;
}

export function preloadGameplayRenderCoreModules(): Promise<void> {
    if (!gameplayRenderCorePromise) {
        gameplayRenderCorePromise = Promise.all([
            import('../components/Dungeon/DungeonScene'),
            import('../components/UI/HUD'),
            import('../components/Dungeon/PhotonsFireball'),
        ]).then(() => {
            gameplayRenderCoreReady = true;
        });
    }

    return gameplayRenderCorePromise;
}

export function preloadGameplayRenderModules(): Promise<void> {
    if (!gameplayRenderFullPromise) {
        gameplayRenderFullPromise = Promise.all([
            preloadGameplayRenderCoreModules(),
            import('../components/UI/MirrorPopup'),
            import('../components/UI/ChampionSheet'),
            import('../components/UI/VictoryScreen'),
        ]).then(() => {
            gameplayRenderFullReady = true;
        });
    }

    return gameplayRenderFullPromise;
}

export function isGameplayRenderCoreModulesPreloaded(): boolean {
    return gameplayRenderCoreReady;
}

export function isGameplayRenderModulesPreloaded(): boolean {
    return gameplayRenderFullReady;
}
