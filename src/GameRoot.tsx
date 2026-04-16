import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import {
  endTrackedGameSession,
  maybeTrackGameplayHeartbeat,
  startTrackedGameSession,
  trackGameVictory,
  type GameAnalyticsSnapshot,
} from './analytics';
import { TitleScreen } from './components/UI/TitleScreen';
import { GameOverScreen } from './components/UI/GameOverScreen';
import { useStore } from './engine/store';
import { preloadAllSounds } from './engine/sounds';
import { clampFrameDeltaSeconds } from './engine/time';
import './App.css';

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

function GameRoot() {
  const gamePhase = useStore((state) => state.gamePhase);
  const activePartyMemberId = useStore((state) => state.activePartyMemberId);
  const enterDungeon = useStore((state) => state.enterDungeon);
  const loadGame = useStore((state) => state.loadGame);
  const closeMirror = useStore((state) => state.closeMirror);
  const closePartyMember = useStore((state) => state.closePartyMember);
  const wakeUp = useStore((state) => state.wakeUp);

  const lastTimeRef = useRef<number | null>(null);
  const tickInFlightRef = useRef(false);
  const previousPhaseRef = useRef(gamePhase);

  const handleEnterDungeon = useCallback(() => {
    enterDungeon();
    startTrackedGameSession('new_game', getAnalyticsSnapshot());
  }, [enterDungeon]);

  const handleLoadGame = useCallback(() => {
    const loaded = loadGame();
    if (!loaded) return;
    startTrackedGameSession('resume', getAnalyticsSnapshot());
  }, [loadGame]);

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
        const state = useStore.getState();
        if (lastTimeRef.current !== null && state.gamePhase !== 'title' && state.gamePhase !== 'victory' && state.gamePhase !== 'game_over') {
          const delta = clampFrameDeltaSeconds((now - lastTimeRef.current) / 1000);
          const wallClockNow = Date.now();
          state.tickFrame(delta, wallClockNow);
          if ((state.gamePhase === 'exploration' || state.gamePhase === 'mirror_open') && !state.sleeping) {
            state.tickMonsters(delta);
            state.tickDoors(delta);
            state.tickSpells(wallClockNow);
          }
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
  }, []);

  useEffect(() => { preloadAllSounds(); }, []);

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
      wakeUp();
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMirror();
        closePartyMember();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-sleep-toggle="true"]')) {
        return;
      }
      wakeUp();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [closeMirror, closePartyMember, wakeUp]);

  return (
    <div className="app">
      {gamePhase === 'title' ? (
        <TitleScreen onEnter={handleEnterDungeon} onResume={handleLoadGame} />
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
            {gamePhase === 'mirror_open' && <MirrorPopup />}
            {activePartyMemberId !== null && (
              <Suspense fallback={null}>
                <ChampionSheet />
              </Suspense>
            )}
          </>
        </Suspense>
      )}
    </div>
  );
}

export default GameRoot;
