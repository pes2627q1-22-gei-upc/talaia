import { defineConfig } from 'tsup';

// Com l'API: els paquets @talaia/* no tenen build, i tsup n'inclou el codi dins de dist/
// (ADR-0013). La resta de dependències es queden fora i es llegeixen de node_modules.
export default defineConfig({
  entry: ['src/main.ts'],
  format: 'cjs',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@talaia\//],
  skipNodeModulesBundle: true,
});
