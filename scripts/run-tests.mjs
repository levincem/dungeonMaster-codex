import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const outDir = path.join(repoRoot, '.test-dist', runId);
const rootPackageJsonPath = path.join(repoRoot, 'package.json');
const testPackageJsonPath = path.join(outDir, 'package.json');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const tscEntrypoint = path.join(repoRoot, 'node_modules', 'typescript', 'lib', 'tsc.js');

mkdirSync(outDir, { recursive: true });

run(process.execPath, [tscEntrypoint, '-p', 'tsconfig.tests.json', '--outDir', outDir]);

mkdirSync(outDir, { recursive: true });

const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf8'));
writeFileSync(
  testPackageJsonPath,
  `${JSON.stringify({
    name: rootPackageJson.name,
        version: rootPackageJson.version,
        private: true,
        type: 'commonjs',
      }, null, 2)}\n`,
  'utf8',
);

const testFiles = readdirSync(path.join(outDir, 'tests'), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
  .map((entry) => path.join(entry.parentPath, entry.name));

run(process.execPath, ['--test', '--test-concurrency=1', '--test-isolation=none', ...testFiles]);
