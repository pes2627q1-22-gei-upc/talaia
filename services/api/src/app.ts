import express from 'express';
import { z } from 'zod';

import { loadEnv } from './config/env';
import { ApiError, errorHandler, notFound } from './middleware/errors';
import { createApiRouter, type ApiDeps } from './routes';
import type { ProfileStore } from './services/profileService';

// Els missatges de validació de zod, en català com la resta de l'API.
z.config(z.locales.ca());

export type AppOptions = ApiDeps & {
  profileStore?: ProfileStore;
};

/** L'app sense servidor: els tests la fan servir amb supertest sense obrir cap port. */
export function createApp({ profileStore, ...apiDeps }: AppOptions = {}) {
  const env = loadEnv();
  const resolvedSupabaseUrl = apiDeps.supabaseUrl ?? env.SUPABASE_URL;
  const unavailable = async (): Promise<never> => {
    throw new ApiError(
      503,
      'database_unavailable',
      "L'API no té DATABASE_URL: el perfil d'usuari no està disponible",
    );
  };
  const resolvedProfileStore =
    profileStore ??
    ({
      ensureProfile: unavailable,
      getProfile: unavailable,
      updateProfile: unavailable,
    } satisfies ProfileStore);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(
    '/api/v1',
    createApiRouter({
      ...apiDeps,
      supabaseUrl: resolvedSupabaseUrl,
      apropApiKey: apiDeps.apropApiKey ?? env.APROP_API_KEY,
      profileStore: resolvedProfileStore,
    }),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
