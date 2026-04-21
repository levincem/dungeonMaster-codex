function resolveBaseUrl(): string {
    if (typeof document === 'undefined') {
        return '/';
    }

    const explicitBase = document.querySelector('base')?.getAttribute('href');
    const resolved = explicitBase
        ? new URL(explicitBase, document.baseURI).pathname
        : new URL('.', document.baseURI).pathname;

    return resolved.endsWith('/') ? resolved : `${resolved}/`;
}

const GAME_ASSETS_ROOT = `${resolveBaseUrl()}game`;

function joinAssetPath(folder: string, file: string): string {
    return `${GAME_ASSETS_ROOT}/${folder}/${file}`;
}

export function miscPath(file: string): string {
    return joinAssetPath('images/misc', file);
}

export function originalMiscPath(file: string): string {
    return joinAssetPath('images/misc/original', file);
}

export function itemsPath(file: string): string {
    return joinAssetPath('images/items', file);
}

export function portraitsPath(file: string): string {
    return joinAssetPath('images/portraits', file);
}

export function texturesPath(file: string): string {
    return joinAssetPath('images/textures', file);
}

export function soundsPath(file: string): string {
    return joinAssetPath('sounds', file);
}

export function runesPath(file: string): string {
    return joinAssetPath('images/runes', file);
}

export function spritesPath(file: string): string {
    return joinAssetPath('images/sprites', file);
}
