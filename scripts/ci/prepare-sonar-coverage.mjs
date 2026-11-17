import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspaces = [
  'apps/mobile',
  'services/api',
  'services/worker',
  'packages/db',
  'packages/index',
];

// Jest escriu SF relatiu al workspace (o absolut). Sonar parteix de l'arrel del repo.
export function prepareCoverage(repoRoot = resolve(import.meta.dirname, '../..')) {
  for (const workspace of workspaces) {
    const workspaceRoot = resolve(repoRoot, workspace);
    const report = readFileSync(resolve(workspaceRoot, 'coverage/lcov.info'), 'utf8');
    let sourceCount = 0;
    const normalized = report.replace(/^SF:(.+)\r?$/gm, (_, source) => {
      const sourcePath = resolve(workspaceRoot, source.trim());
      const repoPath = relative(repoRoot, sourcePath);
      if (isAbsolute(repoPath) || repoPath.startsWith('../') || !statSync(sourcePath).isFile()) {
        throw new Error(`Fitxer LCOV fora del repositori o invàlid: ${workspace}: ${source}`);
      }
      sourceCount++;
      return `SF:${repoPath.split('\\').join('/')}`;
    });
    if (sourceCount === 0) {
      throw new Error(`Informe LCOV sense fitxers: ${workspace}/coverage/lcov.info`);
    }
    writeFileSync(resolve(workspaceRoot, 'coverage/lcov-sonar.info'), normalized);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  prepareCoverage();
}
