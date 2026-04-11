const BASE_URL = import.meta.env.BASE_URL;

function joinAssetPath(folder: string, file: string): string {
    return `${BASE_URL}${folder}/${file}`;
}

export function miscPath(file: string): string {
    return joinAssetPath('misc', file);
}

export function itemsPath(file: string): string {
    return joinAssetPath('items', file);
}

export function portraitsPath(file: string): string {
    return joinAssetPath('portraits', file);
}

export function texturesPath(file: string): string {
    return joinAssetPath('textures', file);
}

export function soundsPath(file: string): string {
    return joinAssetPath('sounds', file);
}

export function runesPath(file: string): string {
    return joinAssetPath('runes', file);
}

export function spritesPath(file: string): string {
    return joinAssetPath('sprites', file);
}
