import type { GameOptions, KeyBindings } from './runtimeTypes';

export const DEFAULT_KEYBINDINGS: KeyBindings = {
    moveForward: ['ArrowUp', 'z'],
    moveBackward: ['ArrowDown', 's'],
    turnLeft: ['ArrowLeft', 'q'],
    turnRight: ['ArrowRight', 'd'],
    strafeLeft: ['a'],
    strafeRight: ['e'],
};

export const DEFAULT_GAME_OPTIONS: GameOptions = {
    keybindings: DEFAULT_KEYBINDINGS,
};

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
