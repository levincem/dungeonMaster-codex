export type SystemRequirementSeverity = 'error' | 'warning';

export interface SystemRequirementIssue {
    id: string;
    severity: SystemRequirementSeverity;
    detail?: string;
}

export interface SystemRequirementReport {
    canRun: boolean;
    webglVersion: 0 | 1 | 2;
    maxTextureSize?: number;
    deviceMemoryGb?: number;
    hardwareConcurrency?: number;
    viewportWidth?: number;
    viewportHeight?: number;
    issues: SystemRequirementIssue[];
}

interface SystemRequirementEnvironment {
    document?: Pick<Document, 'createElement'>;
    navigator?: Navigator & {
        deviceMemory?: number;
        hardwareConcurrency?: number;
    };
    window?: Window & {
        localStorage?: Storage;
        requestAnimationFrame?: typeof window.requestAnimationFrame;
    };
}

const STORAGE_TEST_KEY = 'dm_system_requirements_test';

function pushIssue(
    issues: SystemRequirementIssue[],
    id: string,
    severity: SystemRequirementSeverity,
    detail?: string,
): void {
    issues.push(detail ? { id, severity, detail } : { id, severity });
}

function checkStorage(storage: Storage | undefined): boolean {
    if (!storage) return false;

    try {
        storage.setItem(STORAGE_TEST_KEY, '1');
        storage.removeItem(STORAGE_TEST_KEY);
        return true;
    } catch {
        return false;
    }
}

function readWebglReport(documentObject: Pick<Document, 'createElement'> | undefined) {
    if (!documentObject) {
        return { version: 0 as const };
    }

    const canvas = documentObject.createElement('canvas');
    const webgl2 = canvas.getContext('webgl2');
    if (webgl2) {
        return {
            version: 2 as const,
            maxTextureSize: webgl2.getParameter(webgl2.MAX_TEXTURE_SIZE) as number,
        };
    }

    const webgl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!webgl) {
        return { version: 0 as const };
    }

    return {
        version: 1 as const,
        maxTextureSize: webgl.getParameter(webgl.MAX_TEXTURE_SIZE) as number,
    };
}

export function inspectSystemRequirements(
    environment: SystemRequirementEnvironment = {
        document: typeof document !== 'undefined' ? document : undefined,
        navigator: typeof navigator !== 'undefined' ? navigator : undefined,
        window: typeof window !== 'undefined' ? window : undefined,
    },
): SystemRequirementReport {
    const issues: SystemRequirementIssue[] = [];
    const webgl = readWebglReport(environment.document);
    const deviceMemoryGb = environment.navigator?.deviceMemory;
    const hardwareConcurrency = environment.navigator?.hardwareConcurrency;
    const viewportWidth = environment.window?.innerWidth;
    const viewportHeight = environment.window?.innerHeight;

    if (!environment.window?.requestAnimationFrame) {
        pushIssue(issues, 'requestAnimationFrame', 'error');
    }

    if (webgl.version === 0) {
        pushIssue(issues, 'webgl', 'error');
    } else if (webgl.version < 2) {
        pushIssue(issues, 'webgl2', 'warning');
    }

    if (webgl.maxTextureSize !== undefined && webgl.maxTextureSize < 2048) {
        pushIssue(issues, 'textureSize', 'error', String(webgl.maxTextureSize));
    } else if (webgl.maxTextureSize !== undefined && webgl.maxTextureSize < 4096) {
        pushIssue(issues, 'textureSize', 'warning', String(webgl.maxTextureSize));
    }

    if (!checkStorage(environment.window?.localStorage)) {
        pushIssue(issues, 'localStorage', 'error');
    }

    if (typeof deviceMemoryGb === 'number' && deviceMemoryGb < 4) {
        pushIssue(issues, 'deviceMemory', 'warning', String(deviceMemoryGb));
    }

    if (typeof hardwareConcurrency === 'number' && hardwareConcurrency < 4) {
        pushIssue(issues, 'cpuCores', 'warning', String(hardwareConcurrency));
    }

    if (
        typeof viewportWidth === 'number' &&
        typeof viewportHeight === 'number' &&
        (viewportWidth < 1024 || viewportHeight < 720)
    ) {
        pushIssue(issues, 'viewport', 'warning', `${viewportWidth}x${viewportHeight}`);
    }

    return {
        canRun: !issues.some((issue) => issue.severity === 'error'),
        webglVersion: webgl.version,
        maxTextureSize: webgl.maxTextureSize,
        deviceMemoryGb,
        hardwareConcurrency,
        viewportWidth,
        viewportHeight,
        issues,
    };
}
