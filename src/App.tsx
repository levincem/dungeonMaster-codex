import { useCallback, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { LoadingScreen } from './components/UI/LoadingScreen';

const welcomeBackdropStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'radial-gradient(circle at center, rgba(36,24,10,0.35), rgba(5,5,8,0.96) 72%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

const welcomePanelStyle = {
  position: 'relative' as const,
  width: 'min(720px, 100%)',
  maxHeight: 'min(78vh, 760px)',
  overflowY: 'auto' as const,
  background: 'linear-gradient(180deg, rgba(28,20,10,0.96), rgba(12,8,4,0.97))',
  border: '1px solid rgba(173, 135, 73, 0.7)',
  borderRadius: 12,
  boxShadow: '0 28px 64px rgba(0,0,0,0.58), inset 0 0 0 1px rgba(255,225,170,0.06)',
  color: '#dcc48b',
  fontFamily: '"Times New Roman", serif',
  padding: '22px 26px 24px',
};

const closeButtonStyle = {
  position: 'absolute' as const,
  top: 10,
  right: 12,
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 999,
  background: 'rgba(120, 84, 34, 0.28)',
  color: '#f0d8a3',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
};

function App() {
  const [GameRootComponent, setGameRootComponent] = useState<ComponentType | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [isSmartphone, setIsSmartphone] = useState(false);
  const [showWelcomeNotice, setShowWelcomeNotice] = useState(false);
  const [welcomePressedButton, setWelcomePressedButton] = useState<'close' | 'continue' | null>(null);

  useEffect(() => {
    const detectSmartphone = () => {
      const ua = navigator.userAgent || '';
      const hasMobileUa = /Android.+Mobile|iPhone|iPod|Windows Phone|webOS|BlackBerry|Opera Mini/i.test(ua);
      const hasSmallViewport = window.matchMedia('(max-width: 767px)').matches;
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      setIsSmartphone(hasMobileUa && hasSmallViewport && hasCoarsePointer);
    };

    detectSmartphone();
    window.addEventListener('resize', detectSmartphone);
    return () => window.removeEventListener('resize', detectSmartphone);
  }, []);

  const handleReady = useCallback(async () => {
    setShowWelcomeNotice(true);
  }, []);

  const handleWelcomeContinue = useCallback(async () => {
    try {
      const module = await import('./GameRoot');
      setGameRootComponent(() => module.default);
      setBootError(null);
      setShowWelcomeNotice(false);
    } catch (error) {
      console.error('Failed to load GameRoot', error);
      setBootError(error instanceof Error ? error.message : 'Unknown boot error');
    }
  }, []);

  if (bootError) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#050508',
        color: '#d7c288',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: '"Courier New", monospace',
        textAlign: 'center',
      }}>
        Failed to load game: {bootError}
      </div>
    );
  }

  if (isSmartphone) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#050508',
        color: '#d7c288',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: '"Courier New", monospace',
        textAlign: 'center',
      }}>
        This is a desktop-first alpha. Smartphone play is not supported yet.
      </div>
    );
  }

  if (!GameRootComponent) {
    if (showWelcomeNotice) {
      return (
        <div style={welcomeBackdropStyle}>
          <div style={welcomePanelStyle}>
            <button
              type="button"
              onClick={() => void handleWelcomeContinue()}
              onMouseDown={() => setWelcomePressedButton('close')}
              onMouseUp={() => setWelcomePressedButton(null)}
              onMouseLeave={() => setWelcomePressedButton(null)}
              aria-label="Close welcome notice"
              style={{
                ...closeButtonStyle,
                transform: welcomePressedButton === 'close' ? 'translateY(1px) scale(0.97)' : 'translateY(0) scale(1)',
                boxShadow: welcomePressedButton === 'close' ? 'inset 0 2px 6px rgba(0,0,0,0.35)' : '0 4px 10px rgba(0,0,0,0.18)',
                transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease',
                background: welcomePressedButton === 'close' ? 'rgba(98, 66, 27, 0.42)' : closeButtonStyle.background,
              }}
            >
              ×
            </button>
            <div style={{ fontSize: 24, letterSpacing: 0.8, marginBottom: 18, color: '#f1d9a1' }}>
              Dungeon Master Remastered
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.6, color: '#dcc48b' }}>
              <p style={{ margin: '0 0 12px' }}>
                Welcome to Dungeon Master Remastered.
              </p>
              <p style={{ margin: '0 0 12px' }}>
                The game is currently in alpha, and some bugs or behaviors that differ from the original game may still remain.
              </p>
              <p style={{ margin: '0 0 12px' }}>
                Saves are not guaranteed to remain compatible or reliable during alpha, before the beta version.
              </p>
              <p style={{ margin: '0 0 12px' }}>
                For the best experience, play at 1920x1080 or higher with a keyboard and mouse.
              </p>
              <p style={{ margin: '0 0 12px' }}>
                Thank you for reporting any issues on GitHub:{' '}
                <a
                  href="https://github.com/levincem/DungeonMaster-codex"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#f3d27a' }}
                >
                  github.com/levincem/DungeonMaster-codex
                </a>
              </p>
              <p style={{ margin: '0 0 12px' }}>
                You can also reach out on Reddit:{' '}
                <a
                  href="https://www.reddit.com/user/levincem/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#f3d27a' }}
                >
                  reddit.com/user/levincem
                </a>
              </p>
              <p style={{ margin: 0 }}>
                Sounds and visuals have already been reworked, but they still need more polish to fully match the quality this game deserves.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                type="button"
                onClick={() => void handleWelcomeContinue()}
                onMouseDown={() => setWelcomePressedButton('continue')}
                onMouseUp={() => setWelcomePressedButton(null)}
                onMouseLeave={() => setWelcomePressedButton(null)}
                style={{
                  minWidth: 154,
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: '1px solid rgba(193, 150, 74, 0.82)',
                  background: welcomePressedButton === 'continue'
                    ? 'linear-gradient(180deg, #6f4e1c, #533912)'
                    : 'linear-gradient(180deg, #8b6324, #5f4215)',
                  color: '#f6e3b3',
                  fontFamily: '"Times New Roman", serif',
                  fontSize: 17,
                  cursor: 'pointer',
                  boxShadow: welcomePressedButton === 'continue'
                    ? '0 4px 10px rgba(0,0,0,0.22), inset 0 2px 6px rgba(0,0,0,0.22)'
                    : '0 10px 20px rgba(0,0,0,0.28)',
                  transform: welcomePressedButton === 'continue' ? 'translateY(1px) scale(0.99)' : 'translateY(0) scale(1)',
                  transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease',
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <LoadingScreen onDone={handleReady} />;
  }

  return <GameRootComponent />;
}

export default App;
