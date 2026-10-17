import express from 'express';

import { errorHandler, notFound } from './middleware/errors';
import { createApiRouter, type ApiDeps } from './routes';

/** L'app sense servidor: els tests la fan servir amb supertest sense obrir cap port. */
export function createApp(deps: ApiDeps = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api/v1', createApiRouter(deps));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
