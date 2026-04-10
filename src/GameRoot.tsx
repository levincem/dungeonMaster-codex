import { useEffect, useRef } from 'react';
import { DungeonScene } from './components/Dungeon/DungeonScene';
import { HUD } from './components/UI/HUD';
import { MirrorPopup } from './components/UI/MirrorPopup';
import { ChampionSheet } from './components/UI/ChampionSheet';
import { TitleScreen } from './components/UI/TitleScreen';
import { useStore } from './engine/store';
import { preloadAllSounds } from './engine/sounds';
import { clampFrameDeltaSeconds } from './engine/time';
import './App.css';

function GameRoot() {
  const gamePhase = useStore((state) => state.gamePhase);
  const activePartyMemberId = useStore((state) => state.activePartyMemberId);
  const enterDungeon = useStore((state) => state.enterDungeon);
  const loadGame = useStore((state) => state.loadGame);
  const closeMirror = useStore((state) => state.closeMirror);
  const closePartyMember = useStore((state) => state.closePartyMember);

  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId: number;

    const tick = (now: number) => {
      if (lastTimeRef.current !== null && useStore.getState().gamePhase !== 'title') {
        const delta = clampFrameDeltaSeconds((now - lastTimeRef.current) / 1000);
        const wallClockNow = Date.now();
        const state = useStore.getState();
        state.regenTick(delta);
        state.tickMovement(delta);
        state.tickCombat(delta);
        state.tickMonsters(delta);
        state.tickDoors(delta);
        state.tickSpells(wallClockNow);
      }

      lastTimeRef.current = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [gamePhase]);

  useEffect(() => { preloadAllSounds(); }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMirror();
        closePartyMember();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeMirror, closePartyMember]);

  return (
    <div className="app">
      {gamePhase === 'title' ? (
        <TitleScreen onEnter={enterDungeon} onResume={loadGame} />
      ) : (
        <>
          <DungeonScene />
          <HUD />
          {gamePhase === 'mirror_open' && <MirrorPopup />}
          {activePartyMemberId !== null && <ChampionSheet />}
        </>
      )}
    </div>
  );
}

export default GameRoot;
