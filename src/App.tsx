import { useCallback, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { LoadingScreen } from './components/UI/LoadingScreen';

function App() {
  const [GameRootComponent, setGameRootComponent] = useState<ComponentType | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [isSmartphone, setIsSmartphone] = useState(false);

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
    try {
      const module = await import('./GameRoot');
      setGameRootComponent(() => module.default);
      setBootError(null);
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
        This is a desktop-first beta. Smartphone play is not supported yet.
      </div>
    );
  }

  if (!GameRootComponent) {
    return <LoadingScreen onDone={handleReady} />;
  }

  return <GameRootComponent />;
}

export default App;
