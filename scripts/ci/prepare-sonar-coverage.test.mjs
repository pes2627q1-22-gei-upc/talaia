import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { prepareCoverage } from './prepare-sonar-coverage.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'sonar-coverage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const workspace of [
    'apps/mobile',
    'apps/admin',
    'services/api',
    'services/worker',
    'packages/db',
    'packages/index',
  ]) {
    mkdirSync(resolve(root, workspace, 'src'), { recursive: true });
    mkdirSync(resolve(root, workspace, 'coverage'));
    writeFileSync(resolve(root, workspace, 'src/index.ts'), 'export {};');
    writeFileSync(
      resolve(root, workspace, 'coverage/lcov.info'),
      'TN:\nSF:src/index.ts\nDA:1,1\nend_of_record\n',
    );
  }
  return root;
}

test('distingeix fitxers amb el mateix nom en workspaces diferents i conserva els originals', (t) => {
  const root = fixture(t);
  prepareCoverage(root);
  for (const workspace of [
    'apps/mobile',
    'apps/admin',
    'services/api',
    'services/worker',
    'packages/db',
    'packages/index',
  ]) {
    const coverage = resolve(root, workspace, 'coverage');
    assert.equal(
      readFileSync(resolve(coverage, 'lcov-sonar.info'), 'utf8'),
      `TN:\nSF:${workspace}/src/index.ts\nDA:1,1\nend_of_record\n`,
    );
    assert.match(readFileSync(resolve(coverage, 'lcov.info'), 'utf8'), /^SF:src\/index.ts$/m);
  }
});

test('resol rutes absolutes i imports relatius a un altre workspace', (t) => {
  const root = fixture(t);
  const report = resolve(root, 'services/api/coverage/lcov.info');
  writeFileSync(
    report,
    `SF:${root}/services/api/src/index.ts\r\nSF:../../packages/index/src/index.ts\r\n`,
  );
  prepareCoverage(root);
  assert.equal(
    readFileSync(resolve(root, 'services/api/coverage/lcov-sonar.info'), 'utf8'),
    'SF:services/api/src/index.ts\nSF:packages/index/src/index.ts\n',
  );
});

test('rebutja informes absents o sense fitxers en comptes de perdre cobertura silenciosament', (t) => {
  const root = fixture(t);
  const report = resolve(root, 'services/worker/coverage/lcov.info');
  writeFileSync(report, 'TN:\n');
  assert.throws(() => prepareCoverage(root), /Informe LCOV sense fitxers: services\/worker/);
  rmSync(report);
  assert.throws(() => prepareCoverage(root), /ENOENT/);
});

test('rebutja rutes inexistents o externes al repositori', (t) => {
  const root = fixture(t);
  const report = resolve(root, 'apps/mobile/coverage/lcov.info');
  writeFileSync(report, 'SF:src/missing.ts\n');
  assert.throws(() => prepareCoverage(root), /ENOENT/);
  writeFileSync(report, 'SF:../../../outside.ts\n');
  assert.throws(() => prepareCoverage(root), /Fitxer LCOV fora del repositori/);
});
