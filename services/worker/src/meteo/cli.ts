/**
 * Prova manual de la ingesta: demana la previsió d'un o més llocs i la mostra per pantalla.
 *
 *   npm run meteo -w services/worker -- 42.0294,0.7112 41.3851,2.1734
 */
import { loadEnv } from '../config/env';
import { ingestaPrevisioMeteo, type PuntPerIngesta } from './ingesta';
import { createOpenMeteoClient } from './openMeteo';
import { createInMemoryPrevisioMeteoRepository } from './repository';

const HORES_MOSTRADES = 24;

function parsePunts(args: string[]): PuntPerIngesta[] {
  return args.map((arg, i) => {
    const [lat, lon] = arg.split(',').map(Number);
    if (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`Coordenades invàlides: "${arg}" (format: lat,lon en graus WGS84)`);
    }
    return { id: `cli-${i + 1}`, lat, lon };
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Ús: npm run meteo -w services/worker -- <lat,lon> [<lat,lon> …]');
    process.exitCode = 1;
    return;
  }

  const punts = parsePunts(args);
  const env = loadEnv();
  const client = createOpenMeteoClient({ baseUrl: env.OPEN_METEO_BASE_URL });
  const repository = createInMemoryPrevisioMeteoRepository();

  const resum = await ingestaPrevisioMeteo(punts, { client, repository });

  for (const [i, previsio] of repository.totes().entries()) {
    const punt = punts[i];
    console.log(`\n${previsio.puntId} (${punt?.lat}, ${punt?.lon}) · font ${previsio.font}`);
    console.log(`Primeres ${HORES_MOSTRADES} de ${previsio.hores.length} hores:`);
    console.table(previsio.hores.slice(0, HORES_MOSTRADES));
  }
  console.log(
    `\nIngesta: ${resum.punts} punts, ${resum.hores} hores, obtinguda el ${resum.obtingudaEl}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
