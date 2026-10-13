import { defineConfig } from 'tsup';

// Els paquets @talaia/* no tenen build: tsup n'inclou el codi dins de dist/ (ADR-0013).
// La resta de dependències es queden fora i es llegeixen de node_modules.
export default defineConfig({
  entry: ['src/server.ts'],
  format: 'cjs',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@talaia\//],
  skipNodeModulesBundle: true,
});
