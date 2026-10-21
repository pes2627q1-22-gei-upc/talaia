import express from 'express';

import { loadEnv } from './config/env';
import { ApiError, errorHandler, notFound } from './middleware/errors';
import { createApiRouter, type ApiDeps } from './routes';
import type { ProfileStore } from './services/profileService';

export type AppOptions = ApiDeps & {
  profileStore?: ProfileStore;
};

/** L'app sense servidor: els tests la fan servir amb supertest sense obrir cap port. */
export function createApp({ profileStore, ...apiDeps }: AppOptions = {}) {
  const env = loadEnv();
  const resolvedSupabaseUrl = apiDeps.supabaseUrl ?? env.SUPABASE_URL;
  const resolvedProfileStore =
    profileStore ??
    ({
      async ensureProfile() {
        throw new ApiError(
          503,
          'database_unavailable',
          "L'API no té DATABASE_URL: el perfil d'usuari no està disponible",
        );
      },
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
