import type { GameOptions, KeyBindings } from './runtimeTypes';

export const DEFAULT_KEYBINDINGS: KeyBindings = {
    moveForward: ['ArrowUp', 'w'],
    moveBackward: ['ArrowDown', 's'],
    turnLeft: ['ArrowLeft', 'a'],
    turnRight: ['ArrowRight', 'd'],
    strafeLeft: ['q'],
    strafeRight: ['e'],
};

export const DEFAULT_GAME_OPTIONS: GameOptions = {
    keybindings: DEFAULT_KEYBINDINGS,
    showMinimap: false,
};

export function normalizeGameOptions(
    input: Partial<GameOptions> | undefined,
): GameOptions {
    return {
        ...DEFAULT_GAME_OPTIONS,
        ...input,
        keybindings: {
            ...DEFAULT_KEYBINDINGS,
            ...(input?.keybindings ?? {}),
        },
        showMinimap: input?.showMinimap ?? DEFAULT_GAME_OPTIONS.showMinimap,
    };
}

export function normalizeBindingKey(key: string): string {
    return key.length === 1 ? key.toLowerCase() : key;
}

export function matchesKeybinding(binding: string[], key: string): boolean {
    const normalized = normalizeBindingKey(key);
    return binding.some((candidate) => normalizeBindingKey(candidate) === normalized);
}

export function formatKeybinding(binding: string[]): string {
    return binding
        .map((key) => {
            switch (normalizeBindingKey(key)) {
                case 'ArrowUp': return '↑';
                case 'ArrowDown': return '↓';
                case 'ArrowLeft': return '←';
                case 'ArrowRight': return '→';
                default: return key.toUpperCase();
            }
        })
        .join(' / ');
}
