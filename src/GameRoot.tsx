import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  endTrackedGameSession,
  maybeTrackGameplayHeartbeat,
  startTrackedGameSession,
  trackGameVictory,
  type GameAnalyticsSnapshot,
} from './analytics';
import { TitleScreen } from './components/UI/TitleScreen';
import { GameOverScreen } from './components/UI/GameOverScreen';
import { GameplayTutorialOverlay } from './components/UI/GameplayTutorialOverlay';
import { useStore } from './engine/store';
import { preloadAllSounds } from './engine/sounds';
import { clampFrameDeltaSeconds } from './engine/time';
import {
  getDungeonMapIndicesSync,
  preloadDungeonBootstrapData,
  preloadDungeonMapData,
  preloadDungeonMapSetData,
  preloadDungeonMapNeighborhoodData,
} from './data/dungeonData';
import { preloadGameDbData } from './data/gameDbData';
import {
  preloadOriginalWallOverlayMapData,
  preloadOriginalWallOverlayMapNeighborhoodData,
} from './data/originalWallOverlayData';
import { readBestPersistedSave } from './engine/saveGame';
import { inspectPersistedSaveData } from './engine/systems/persistence';
import { collectPersistedGameplayPreloadLevels } from './preload/persistedSavePreload';
import {
  preloadGameplayRenderCoreModules,
  preloadGameplayRenderModules,
} from './preload/gameplayModulePreload';
import {
  preloadGameplayCoreVisualAssets,
  preloadGameplaySecondaryVisualAssets,
} from './preload/gameplayVisualPreload';
import { useI18n } from './i18n';
import './App.css';

const IS_DEV = import.meta.env.DEV;

const DungeonScene = lazy(() =>
  import('./components/Dungeon/DungeonScene').then((module) => ({ default: module.DungeonScene })),
);

const HUD = lazy(() =>
  import('./components/UI/HUD').then((module) => ({ default: module.HUD })),
);

const MirrorPopup = lazy(() =>
  import('./components/UI/MirrorPopup').then((module) => ({ default: module.MirrorPopup })),
);

const ChampionSheet = lazy(() =>
  import('./components/UI/ChampionSheet').then((module) => ({ default: module.ChampionSheet })),
);

const VictoryScreen = lazy(() =>
  import('./components/UI/VictoryScreen').then((module) => ({ default: module.VictoryScreen })),
);

function getAnalyticsSnapshot(): GameAnalyticsSnapshot {
  const state = useStore.getState();
  return {
    level: state.level,
    partySize: state.party.length,
    phase: state.gamePhase,
    sleeping: state.sleeping,
  };
}

function isGameplayPhase(phase: GameAnalyticsSnapshot['phase']): boolean {
  return phase === 'exploration' || phase === 'mirror_open' || phase === 'endgame';
}

function getSortedDungeonPreloadQueue(currentLevel: number): number[] {
  return getDungeonMapIndicesSync()
    .sort((a, b) => {
      const distanceDelta = Math.abs(a - currentLevel) - Math.abs(b - currentLevel);
      if (distanceDelta !== 0) return distanceDelta;
      return a - b;
    });
}

const BACKGROUND_GAMEPLAY_PRELOAD_LIMIT = IS_DEV ? 2 : 4;

function getBackgroundGameplayPreloadQueue(currentLevel: number): number[] {
  return getSortedDungeonPreloadQueue(currentLevel)
    .filter((mapIndex) => Math.abs(mapIndex - currentLevel) > 1)
    .slice(0, BACKGROUND_GAMEPLAY_PRELOAD_LIMIT);
}

function waitForTimeout(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function scheduleIdleWarmup(task: () => void, timeoutMs = 1_500): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(task, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = window.setTimeout(task, 180);
  return () => window.clearTimeout(timeoutId);
}

async function preloadGameplayLevelNeighborhood(level: number): Promise<void> {
  await Promise.all([
    preloadDungeonMapNeighborhoodData(level, 1),
    preloadOriginalWallOverlayMapNeighborhoodData(level, 1),
  ]);
}

async function preloadBackgroundGameplayLevels(
  level: number,
  shouldContinue?: () => boolean,
): Promise<void> {
  for (const mapIndex of getBackgroundGameplayPreloadQueue(level)) {
    if (shouldContinue && !shouldContinue()) {
      return;
    }
    await Promise.all([
      preloadDungeonMapData(mapIndex),
      preloadOriginalWallOverlayMapData(mapIndex),
    ]);
    await waitForNextPaint();
  }
}

function GameRoot() {
  const text = useI18n().gameRoot;
  const gamePhase = useStore((state) => state.gamePhase);
  const level = useStore((state) => state.level);
  const paused = useStore((state) => state.paused);
  const activePartyMemberId = useStore((state) => state.activePartyMemberId);
  const tutorialOverlayActive = useStore((state) => state.tutorialOverlayActive);
  const enterDungeon = useStore((state) => state.enterDungeon);
  const loadGame = useStore((state) => state.loadGame);
  const closeMirror = useStore((state) => state.closeMirror);
  const closePartyMember = useStore((state) => state.closePartyMember);
  const wakeUp = useStore((state) => state.wakeUp);
  const togglePause = useStore((state) => state.togglePause);
  const tickGameplayFrame = useStore((state) => state.tickGameplayFrame);
  const [titleTransitionMessage, setTitleTransitionMessage] = useState<string | null>(null);

  const lastTimeRef = useRef<number | null>(null);
  const tickInFlightRef = useRef(false);
  const previousPhaseRef = useRef(gamePhase);

  const handleEnterDungeon = useCallback(() => {
    if (titleTransitionMessage !== null) return;

    setTitleTransitionMessage(text.preparingDungeon);
    void preloadGameplayCoreVisualAssets().catch(() => {});
    void Promise.all([
      preloadGameplayLevelNeighborhood(0),
      preloadGameDbData(),
      preloadGameplayRenderCoreModules(),
    ]).then(() => {
      enterDungeon();
      startTrackedGameSession('new_game', getAnalyticsSnapshot());
    }).finally(() => {
      setTitleTransitionMessage(null);
    });
  }, [enterDungeon, text.preparingDungeon, titleTransitionMessage]);

  const handleLoadGame = useCallback(() => {
    if (titleTransitionMessage !== null) return;

    const inspection = inspectPersistedSaveData(readBestPersistedSave());
    setTitleTransitionMessage(text.preparingSavedGame);
    void preloadGameplayCoreVisualAssets().catch(() => {});
    const preload = Promise.all([
      inspection.status === 'compatible'
        ? Promise.all([
            preloadDungeonMapSetData(collectPersistedGameplayPreloadLevels(inspection.data)),
            preloadOriginalWallOverlayMapNeighborhoodData(inspection.data.level, 1),
          ]).then(() => {})
        : preloadDungeonBootstrapData(),
      preloadGameDbData(),
      preloadGameplayRenderCoreModules(),
    ]);

    void preload.then(() => {
      const loaded = loadGame();
      if (!loaded) return;
      startTrackedGameSession('resume', getAnalyticsSnapshot());
    }).finally(() => {
      setTitleTransitionMessage(null);
    });
  }, [loadGame, text.preparingSavedGame, titleTransitionMessage]);

  useEffect(() => {
    let rafId: number;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) {
        return;
      }

      // In dev, React/Zustand can interleave updates aggressively. Keep the
      // main loop strictly non-reentrant so one frame never recursively starts
      // another update cascade.
      if (tickInFlightRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      tickInFlightRef.current = true;
      try {
        if (lastTimeRef.current !== null) {
          const delta = clampFrameDeltaSeconds((now - lastTimeRef.current) / 1000);
          const wallClockNow = Date.now();
          tickGameplayFrame(delta, wallClockNow);
        }

        lastTimeRef.current = now;
      } finally {
        tickInFlightRef.current = false;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      tickInFlightRef.current = false;
      lastTimeRef.current = null;
    };
  }, [tickGameplayFrame]);

  useEffect(() => {
    if (gamePhase !== 'title') return;

    let cancelled = false;

    void preloadDungeonBootstrapData()
      .catch(() => {});

    const cancelVisualWarmup = scheduleIdleWarmup(() => {
      if (cancelled) return;
      void preloadGameplayCoreVisualAssets().catch(() => {});
    }, IS_DEV ? 1_400 : 600);

    const cancelDataWarmup = scheduleIdleWarmup(() => {
      if (cancelled) return;
      const dataWarmup = IS_DEV
        ? preloadGameDbData()
        : Promise.all([
            preloadGameDbData(),
            preloadOriginalWallOverlayMapNeighborhoodData(0, 1),
          ]).then(() => {});
      void dataWarmup.catch(() => {});
    }, IS_DEV ? 2_400 : 1_200);

    const cancelRenderWarmup = scheduleIdleWarmup(() => {
      if (cancelled) return;
      void preloadGameplayRenderCoreModules().catch(() => {});
    }, IS_DEV ? 3_000 : 2_000);

    const cancelSecondaryVisualWarmup = scheduleIdleWarmup(() => {
      if (cancelled) return;
      void preloadGameplaySecondaryVisualAssets().catch(() => {});
    }, IS_DEV ? 4_200 : 2_600);

    const delayedFullWarmup = IS_DEV ? null : window.setTimeout(() => {
      if (cancelled) return;
      void Promise.all([
        preloadGameplaySecondaryVisualAssets(),
        preloadGameDbData(),
        preloadOriginalWallOverlayMapNeighborhoodData(0, 1),
        preloadGameplayRenderCoreModules(),
      ]).catch(() => {});
    }, 3_200);

    return () => {
      cancelled = true;
      cancelVisualWarmup();
      cancelDataWarmup();
      cancelRenderWarmup();
      cancelSecondaryVisualWarmup();
      if (delayedFullWarmup !== null) {
        window.clearTimeout(delayedFullWarmup);
      }
    };
  }, [gamePhase]);

  useEffect(() => {
    if (!isGameplayPhase(gamePhase)) return;

    let cancelled = false;
    const cancelSoundWarmup = scheduleIdleWarmup(() => {
      if (cancelled) return;
      preloadAllSounds();
    }, 1_000);

    const cancelSecondaryVisualWarmup = scheduleIdleWarmup(() => {
      if (cancelled) return;
      void preloadGameplaySecondaryVisualAssets().catch(() => {});
    }, 1_400);

    const cancelSecondaryModuleWarmup = scheduleIdleWarmup(() => {
      if (cancelled) return;
      void preloadGameplayRenderModules().catch(() => {});
    }, 1_800);

    void preloadGameplayLevelNeighborhood(level).catch(() => {});
    void (async () => {
      try {
        await waitForTimeout(60);
        await preloadDungeonBootstrapData();
        await preloadBackgroundGameplayLevels(level, () => !cancelled);
      } catch {
        // Keep gameplay responsive even if a background warm-up fails.
      }
    })();

    return () => {
      cancelled = true;
      cancelSoundWarmup();
      cancelSecondaryVisualWarmup();
      cancelSecondaryModuleWarmup();
    };
  }, [gamePhase, level]);

  useEffect(() => {
    const heartbeatTimer = window.setInterval(() => {
      const snapshot = getAnalyticsSnapshot();
      if (!isGameplayPhase(snapshot.phase)) return;
      maybeTrackGameplayHeartbeat(snapshot);
    }, 10_000);

    return () => window.clearInterval(heartbeatTimer);
  }, []);

  useEffect(() => {
    const handlePageHide = () => {
      endTrackedGameSession('page_hide', getAnalyticsSnapshot());
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, []);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    if (previousPhase === gamePhase) return;

    const snapshot = getAnalyticsSnapshot();

    if (gamePhase === 'victory') {
      trackGameVictory(snapshot);
      endTrackedGameSession('victory', snapshot);
    } else if (gamePhase === 'game_over') {
      endTrackedGameSession('game_over', snapshot);
    } else if (previousPhase !== 'title' && gamePhase === 'title') {
      endTrackedGameSession('return_to_title', snapshot);
    }

    previousPhaseRef.current = gamePhase;
  }, [gamePhase]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useStore.getState();
      if (state.tutorialOverlayActive) {
        return;
      }
      if (e.key === 'Escape') {
        if (state.optionsModalOpen) return;
        e.preventDefault();
        if (state.paused) {
          togglePause();
          return;
        }
        if (state.activeMirrorChampionId !== null || state.activePartyMemberId !== null) {
          closeMirror();
          closePartyMember();
          return;
        }
        togglePause();
        return;
      }
      if (state.paused) return;
      wakeUp();
    };

    const handlePointerDown = (event: PointerEvent) => {
      const state = useStore.getState();
      if (state.tutorialOverlayActive) return;
      const target = event.target;
      if (target instanceof Element && target.closest('[data-sleep-toggle="true"]')) {
        return;
      }
      if (state.paused) return;
      wakeUp();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [closeMirror, closePartyMember, togglePause, wakeUp, tutorialOverlayActive]);

  return (
    <div className="app">
      {gamePhase === 'title' ? (
        <>
          <TitleScreen onEnter={handleEnterDungeon} onResume={handleLoadGame} />
          {titleTransitionMessage && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(5, 5, 8, 0.84)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 240,
                pointerEvents: 'all',
              }}
            >
              <div
                style={{
                  minWidth: 320,
                  maxWidth: 'min(88vw, 420px)',
                  padding: '18px 22px',
                  borderRadius: 10,
                  background: 'linear-gradient(180deg, rgba(24,18,8,0.96), rgba(10,8,5,0.98))',
                  border: '1px solid rgba(212,184,112,0.46)',
                  color: '#ecd9a8',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.42)',
                  textAlign: 'center',
                  fontFamily: '"Courier New", monospace',
                  letterSpacing: 1,
                }}
              >
                <div style={{ fontSize: 11, color: 'rgba(212,184,112,0.72)', marginBottom: 8 }}>
                  {text.preloadLabel}
                </div>
                <div style={{ fontSize: 15, color: '#f0d060' }}>
                  {titleTransitionMessage}
                </div>
              </div>
            </div>
          )}
        </>
      ) : gamePhase === 'game_over' ? (
        <GameOverScreen />
      ) : gamePhase === 'victory' ? (
        <Suspense fallback={null}>
          <VictoryScreen />
        </Suspense>
      ) : gamePhase === 'endgame' ? (
        <Suspense fallback={null}>
          <DungeonScene />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <>
            <DungeonScene />
            <HUD />
            <GameplayTutorialOverlay />
            {gamePhase === 'mirror_open' && <MirrorPopup />}
            {activePartyMemberId !== null && (
              <Suspense fallback={null}>
                <ChampionSheet />
              </Suspense>
            )}
            {paused && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.74)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 180,
                  pointerEvents: 'all',
                }}
              >
                <div
                  style={{
                    color: '#f0d060',
                    fontFamily: '"Courier New", monospace',
                    fontSize: 40,
                    letterSpacing: 6,
                    textTransform: 'uppercase',
                    textShadow: '0 0 18px rgba(0,0,0,0.7)',
                  }}
                >
                  Pause
                </div>
              </div>
            )}
          </>
        </Suspense>
      )}
    </div>
  );
}

export default GameRoot;
