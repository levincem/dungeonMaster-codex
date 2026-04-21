import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

test('runtime package consistency audit stays green, including synced runtime references', () => {
    const auditModulePath = path.join(
        process.cwd(),
        'assets',
        'OriginalDataExtraction',
        'audit_runtime_package_consistency.cjs',
    );
    const { runAudit } = require(auditModulePath) as {
        runAudit: () => {
            summary: {
                topLevelFailures: number;
                runtimeReferenceFailures: number;
                sourceRuntimeDungeonMapFailures: number;
                runtimeDungeonMapFailures: number;
                runtimeWallOverlayMapFailures: number;
            };
        };
    };

    const report = runAudit();

    assert.equal(report.summary.topLevelFailures, 0);
    assert.equal(report.summary.runtimeReferenceFailures, 0);
    assert.equal(report.summary.sourceRuntimeDungeonMapFailures, 0);
    assert.equal(report.summary.runtimeDungeonMapFailures, 0);
    assert.equal(report.summary.runtimeWallOverlayMapFailures, 0);
});
