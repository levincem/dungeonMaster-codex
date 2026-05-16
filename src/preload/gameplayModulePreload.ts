import { preloadGameDbData } from '../data/gameDbData';
import { preloadDungeonBootstrapData } from '../data/dungeonData';

type GameRootModule = typeof import('../GameRoot');

let gameRootModulePromise: Promise<GameRootModule> | null = null;
let gameplayRenderCorePromise: Promise<void> | null = null;
let gameplayRenderFullPromise: Promise<void> | null = null;
let victoryScreenPromise: Promise<void> | null = null;
let gameplayRenderCoreReady = false;
let gameplayRenderFullReady = false;
let victoryScreenReady = false;

export function preloadGameRootModule(): Promise<GameRootModule> {
    if (!gameRootModulePromise) {
        gameRootModulePromise = preloadDungeonBootstrapData()
            .then(() => import('../GameRoot'));
    }
    return gameRootModulePromise!;
}

export function preloadGameplayRenderCoreModules(): Promise<void> {
    if (!gameplayRenderCorePromise) {
        gameplayRenderCorePromise = Promise.all([
            preloadDungeonBootstrapData(),
            preloadGameDbData(),
        ])
            .then(() => Promise.all([
                import('../components/Dungeon/DungeonScene'),
                import('../components/UI/HUD'),
            ]))
            .then(() => {
                gameplayRenderCoreReady = true;
            });
    }

    return gameplayRenderCorePromise!;
}

export function preloadGameplayRenderModules(): Promise<void> {
    if (!gameplayRenderFullPromise) {
        gameplayRenderFullPromise = preloadGameplayRenderCoreModules()
            .then(() => Promise.all([
                import('../components/Dungeon/PhotonsFireball'),
                import('../components/UI/MirrorPopup'),
                import('../components/UI/ChampionSheet'),
            ]))
            .then(() => {
                gameplayRenderFullReady = true;
            });
    }

    return gameplayRenderFullPromise!;
}

export function isGameplayRenderCoreModulesPreloaded(): boolean {
    return gameplayRenderCoreReady;
}

export function isGameplayRenderModulesPreloaded(): boolean {
    return gameplayRenderFullReady;
}

export function preloadVictoryScreenModule(): Promise<void> {
    if (!victoryScreenPromise) {
        victoryScreenPromise = import('../components/UI/VictoryScreen')
            .then(() => {
                victoryScreenReady = true;
            });
    }

    return victoryScreenPromise;
}

export function isVictoryScreenModulePreloaded(): boolean {
    return victoryScreenReady;
}
