import embeddedDungeonData from '../assets/data/dungeon.json';

export function preloadDungeonData(): Promise<void> {
    return Promise.resolve();
}

export function getDungeonDataSync<T>(): T {
    return embeddedDungeonData as T;
}
