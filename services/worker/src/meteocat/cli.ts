/**
 * Prova manual de la XEMA (TG-115): amb METEOCAT_API_KEY al .env, mostra quantes estacions són
 * operatives i les lectures d'una estació en un dia. Sense base de dades. Gasta 7 consultes de la
 * quota mensual (1 de metadades i 1 per variable).
 *
 *   npm run xema -w services/worker -- CC 2026-10-18
 */
import { loadEnv } from '../config/env';
import { ingestaLecturesXema } from './ingesta';
import { createInMemoryXemaRepository } from './repository';
import { createXemaClient } from './xema';

async function main(): Promise<void> {
  const [estacio, dia] = process.argv.slice(2);
  if (!estacio) {
    console.error('Ús: npm run xema -w services/worker -- <codi estació> [YYYY-MM-DD]');
    process.exitCode = 1;
    return;
  }
  const apiKey = loadEnv().METEOCAT_API_KEY;
  if (!apiKey) throw new Error("Falta METEOCAT_API_KEY al .env de l'arrel");

  const client = createXemaClient({ apiKey });
  const repository = createInMemoryXemaRepository([estacio]);
  const estacions = await client.estacionsOperatives(new Date().toISOString().slice(0, 10));
  console.log(`${estacions.length} estacions operatives`);

  const resum = await ingestaLecturesXema({ client, repository }, dia);
  console.log(`\n${estacio} · ${resum.dia} · ${resum.lectures} lectures`);
  for (const error of resum.errors) console.warn(`  ${error}`);
  console.table(repository.lectures());
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
