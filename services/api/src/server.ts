import { createDb } from '@talaia/db';

import { createApp } from './app';
import { loadEnv } from './config/env';
import { createBreakdownService } from './index/breakdownService';
import { createPuntsRepository } from './punts/puntsRepository';
import { createDefaultPuntsService } from './punts/puntsService';
import { createEsdevenimentsRepository } from './esdeveniments/esdevenimentsRepository';
import { createEsdevenimentsService } from './esdeveniments/esdevenimentsService';
import { createDatabaseProfileStore } from './services/profileService';

const env = loadEnv();

let punts;
let breakdown;
let profileStore;
let esdeveniments;
if (env.DATABASE_URL) {
  // Un sol pool per a tota l'API.
  const db = createDb(env.DATABASE_URL, { max: 5 });
  const puntsRepository = createPuntsRepository(db);
  punts = createDefaultPuntsService(puntsRepository);
  breakdown = createBreakdownService(puntsRepository);
  profileStore = createDatabaseProfileStore(db);
  esdeveniments = createEsdevenimentsService(createEsdevenimentsRepository(db));
} else {
  console.warn(
    'Avís: sense DATABASE_URL. /api/v1/health funciona, però /api/v1/punts, /api/v1/punts/{id}/index, /api/v1/perfil i /api/v1/esdeveniments responen 503.',
  );
}

createApp({ punts, breakdown, profileStore, esdeveniments }).listen(env.API_PORT, (error) => {
  if (error) throw error;
  console.log(`Talaia API a http://localhost:${env.API_PORT}/api/v1 (docs: /api/v1/docs)`);
});
