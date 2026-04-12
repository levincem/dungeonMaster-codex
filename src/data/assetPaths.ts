const BASE_URL = import.meta.env.BASE_URL;
const GAME_ASSETS_ROOT = `${BASE_URL}game`;

function joinAssetPath(folder: string, file: string): string {
    return `${GAME_ASSETS_ROOT}/${folder}/${file}`;
}

export function miscPath(file: string): string {
    return joinAssetPath('images/misc', file);
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
