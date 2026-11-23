/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Nginx la serveix a /admin/ (TG-176): els recursos compilats hi han d'apuntar. També en local.
  base: '/admin/',
  plugins: [react()],
  server: { proxy: { '/api/v1': 'http://127.0.0.1:3000' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    // Valors de prova: el client de Supabase està simulat i no surt cap petició real.
    env: {
      VITE_SUPABASE_URL: 'https://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'clau-publica-de-prova',
    },
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/**/*.d.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
