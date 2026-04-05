import { useCallback, useState } from 'react';
import type { ComponentType } from 'react';
import { LoadingScreen } from './components/UI/LoadingScreen';

function App() {
  const [GameRootComponent, setGameRootComponent] = useState<ComponentType | null>(null);

  const handleReady = useCallback(async () => {
    const module = await import('./GameRoot');
    setGameRootComponent(() => module.default);
  }, []);

  if (!GameRootComponent) {
    return <LoadingScreen onDone={handleReady} />;
  }

  return <GameRootComponent />;
}

export default App;
