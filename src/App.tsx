import { useCallback, useState } from 'react';
import type { ComponentType } from 'react';
import { LoadingScreen } from './components/UI/LoadingScreen';

function App() {
  const [GameRootComponent, setGameRootComponent] = useState<ComponentType | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

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

  if (!GameRootComponent) {
    return <LoadingScreen onDone={handleReady} />;
  }

  return <GameRootComponent />;
}

export default App;
