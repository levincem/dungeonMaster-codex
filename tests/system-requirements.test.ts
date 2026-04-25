import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSystemRequirements } from '../src/systemRequirements';

class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();

    get length() {
        return this.values.size;
    }

    clear(): void {
        this.values.clear();
    }

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    key(index: number): string | null {
        return Array.from(this.values.keys())[index] ?? null;
    }

    removeItem(key: string): void {
        this.values.delete(key);
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}

function createWebglContext(maxTextureSize: number) {
    return {
        MAX_TEXTURE_SIZE: 3379,
        getParameter(parameter: number) {
            return parameter === 3379 ? maxTextureSize : 0;
        },
    };
}

function createEnvironment(options: {
    webglVersion?: 0 | 1 | 2;
    maxTextureSize?: number;
    storage?: Storage;
    requestAnimationFrame?: boolean;
    deviceMemoryGb?: number;
    hardwareConcurrency?: number;
    viewportWidth?: number;
    viewportHeight?: number;
} = {}) {
    const {
        webglVersion = 2,
        maxTextureSize = 8192,
        storage = new MemoryStorage(),
        requestAnimationFrame = true,
        deviceMemoryGb = 8,
        hardwareConcurrency = 8,
        viewportWidth = 1920,
        viewportHeight = 1080,
    } = options;
    const context = webglVersion === 0 ? null : createWebglContext(maxTextureSize);

    return {
        document: {
            createElement: () => ({
                getContext: (kind: string) => {
                    if (kind === 'webgl2') return webglVersion === 2 ? context : null;
                    if (kind === 'webgl' || kind === 'experimental-webgl') return webglVersion === 1 ? context : null;
                    return null;
                },
            }),
        } as unknown as Document,
        navigator: {
            deviceMemory: deviceMemoryGb,
            hardwareConcurrency,
        } as Navigator & { deviceMemory: number; hardwareConcurrency: number },
        window: {
            localStorage: storage,
            requestAnimationFrame: requestAnimationFrame ? (() => 1) : undefined,
            innerWidth: viewportWidth,
            innerHeight: viewportHeight,
        } as unknown as Window,
    };
}

test('inspectSystemRequirements accepts a modern desktop browser profile', () => {
    const report = inspectSystemRequirements(createEnvironment());

    assert.equal(report.canRun, true);
    assert.equal(report.webglVersion, 2);
    assert.deepEqual(report.issues, []);
});

test('inspectSystemRequirements blocks missing WebGL and storage support', () => {
    const brokenStorage = {
        setItem() {
            throw new Error('blocked');
        },
        removeItem() {},
    } as unknown as Storage;
    const report = inspectSystemRequirements(createEnvironment({
        webglVersion: 0,
        storage: brokenStorage,
    }));

    assert.equal(report.canRun, false);
    assert.deepEqual(
        report.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.id).sort(),
        ['localStorage', 'webgl'],
    );
});

test('inspectSystemRequirements warns for modest but runnable systems', () => {
    const report = inspectSystemRequirements(createEnvironment({
        webglVersion: 1,
        maxTextureSize: 2048,
        deviceMemoryGb: 2,
        hardwareConcurrency: 2,
        viewportWidth: 960,
        viewportHeight: 640,
    }));

    assert.equal(report.canRun, true);
    assert.deepEqual(
        report.issues.map((issue) => issue.id).sort(),
        ['cpuCores', 'deviceMemory', 'textureSize', 'viewport', 'webgl2'],
    );
});
