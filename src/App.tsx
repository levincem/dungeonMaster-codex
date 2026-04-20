import { useCallback, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { LoadingScreen } from './components/UI/LoadingScreen';
import { useI18n } from './i18n';
import { preloadGameRootModule } from './preload/gameplayModulePreload';

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
  const text = useI18n().app;
  const [GameRootComponent, setGameRootComponent] = useState<ComponentType | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [isSmartphone, setIsSmartphone] = useState(false);
  const [showWelcomeNotice, setShowWelcomeNotice] = useState(false);
  const [isPreparingTitle, setIsPreparingTitle] = useState(false);
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
    void preloadGameRootModule().catch(() => {});
  }, []);

  const handleWelcomeContinue = useCallback(async () => {
    setShowWelcomeNotice(false);
    setIsPreparingTitle(true);
    try {
      const module = await preloadGameRootModule();
      setGameRootComponent(() => module.default);
      setBootError(null);
    } catch (error) {
      console.error('Failed to load GameRoot', error);
      setBootError(error instanceof Error ? error.message : 'Unknown boot error');
    } finally {
      setIsPreparingTitle(false);
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
        {text.bootError(bootError)}
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
        {text.smartphoneUnsupported}
      </div>
    );
  }

  if (!GameRootComponent) {
    if (isPreparingTitle) {
      return (
        <div style={welcomeBackdropStyle}>
          <div style={{
            ...welcomePanelStyle,
            width: 'min(520px, 100%)',
            maxHeight: 'none',
            overflowY: 'visible',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, letterSpacing: 0.8, marginBottom: 18, color: '#f1d9a1' }}>
              {text.preparingTitleScreen}
            </div>
            <div style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: '#dcc48b',
              marginBottom: 18,
            }}>
              {text.runtimeWarmupNotice}
            </div>
            <div style={{
              width: '100%',
              height: 4,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 999,
              overflow: 'hidden',
            }}>
              <div style={{
                width: '38%',
                height: '100%',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #7a4a10, #d4a030)',
                boxShadow: '0 0 10px rgba(200,140,30,0.55)',
                animation: 'dmTitlePreloadPulse 1.15s ease-in-out infinite',
                transformOrigin: 'left center',
              }} />
            </div>
            <style>{`
              @keyframes dmTitlePreloadPulse {
                0% { transform: translateX(-12%) scaleX(0.82); opacity: 0.72; }
                50% { transform: translateX(96%) scaleX(1.08); opacity: 1; }
                100% { transform: translateX(220%) scaleX(0.82); opacity: 0.72; }
              }
            `}</style>
          </div>
        </div>
      );
    }

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
              aria-label={text.welcome.closeNotice}
              style={{
                ...closeButtonStyle,
                transform: welcomePressedButton === 'close' ? 'translateY(1px) scale(0.97)' : 'translateY(0) scale(1)',
                boxShadow: welcomePressedButton === 'close' ? 'inset 0 2px 6px rgba(0,0,0,0.35)' : '0 4px 10px rgba(0,0,0,0.18)',
                transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease',
                background: welcomePressedButton === 'close' ? 'rgba(98, 66, 27, 0.42)' : closeButtonStyle.background,
              }}
            >
              X
            </button>
            <div style={{ fontSize: 24, letterSpacing: 0.8, marginBottom: 18, color: '#f1d9a1' }}>
              {text.welcome.title}
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.6, color: '#dcc48b' }}>
              <p style={{ margin: '0 0 12px' }}>
                {text.welcome.intro}
              </p>
              <p style={{ margin: '0 0 12px' }}>
                {text.welcome.alphaNotice}
              </p>
              <p style={{ margin: '0 0 12px' }}>
                {text.welcome.saveNotice}
              </p>
              <p style={{ margin: '0 0 12px' }}>
                {text.welcome.desktopNotice}
              </p>
              <p style={{ margin: '0 0 12px' }}>
                {text.welcome.githubIntro}{' '}
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
                {text.welcome.redditIntro}{' '}
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
                {text.welcome.polishNotice}
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
                {text.welcome.continue}
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
