import { test } from 'node:test';
import assert from 'node:assert/strict';

function clearCompiledModule(relativePath: string): void {
    delete require.cache[require.resolve(relativePath)];
}

test('store module import stays safe before dungeon bootstrap preload', () => {
    clearCompiledModule('../src/engine/store.js');
    clearCompiledModule('../src/data/champions.js');
    clearCompiledModule('../src/data/mapLoader.js');
    clearCompiledModule('../src/data/dungeonData.js');

    assert.doesNotThrow(
        () => require('../src/engine/store.js'),
        'store import should not touch dungeon bootstrap data at module load time',
    );
});
