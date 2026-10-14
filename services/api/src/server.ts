import { createDb } from '@talaia/db';

import { createApp } from './app';
import { loadEnv } from './config/env';
import { createPuntsRepository } from './punts/puntsRepository';
import { createDefaultPuntsService } from './punts/puntsService';

const env = loadEnv();

let punts;
if (env.DATABASE_URL) {
  const db = createDb(env.DATABASE_URL, { max: 5 });
  punts = createDefaultPuntsService(createPuntsRepository(db));
} else {
  console.warn('Avís: sense DATABASE_URL. /api/v1/health funciona, però /api/v1/punts respon 503.');
}

createApp({ punts }).listen(env.API_PORT, (error) => {
  if (error) throw error;
  console.log(`Talaia API a http://localhost:${env.API_PORT}/api/v1 (docs: /api/v1/docs)`);
});
