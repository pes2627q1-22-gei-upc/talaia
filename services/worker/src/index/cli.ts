/**
 * Prova manual de l'índex v1 (ADR-0018): demana la previsió d'Open-Meteo d'un lloc, hi creua les
 * efemèrides i mostra l'índex i els factors de les properes hores. Sense base de dades.
 *
 *   npm run index -w services/worker -- 42.0294,0.7112          # foscor estimada (sense TG-97)
 *   npm run index -w services/worker -- 42.0294,0.7112 21.6     # amb l'SQM del lloc
 */
import { efemeridesHores } from '../astronomia/astronomia';
import { loadEnv } from '../config/env';
import { createOpenMeteoClient } from '../meteo/openMeteo';
import { calculaIndexHores } from './formula';

const HORES_MOSTRADES = 36;

async function main(): Promise<void> {
  const [llocArg, sqmArg] = process.argv.slice(2);
  const [lat, lon] = (llocArg ?? '').split(',').map(Number);
  if (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.error('Ús: npm run index -w services/worker -- <lat,lon> [sqm]');
    process.exitCode = 1;
    return;
  }
  const sqm = sqmArg === undefined ? null : Number(sqmArg);
  if (sqm !== null && !Number.isFinite(sqm)) throw new Error(`SQM invàlid: "${sqmArg}"`);

  const client = createOpenMeteoClient({ baseUrl: loadEnv().OPEN_METEO_BASE_URL });
  const [meteo = []] = await client.previsio([{ lat, lon }]);
  const ara = Date.now() - 3_600_000;
  const hores = meteo.filter((h) => Date.parse(h.hora) >= ara).slice(0, HORES_MOSTRADES);
  const efemerides = efemeridesHores(
    { lat, lon, altitud: null },
    hores.map((h) => h.hora),
  );
  const indexs = calculaIndexHores(hores, efemerides, sqm);

  console.log(
    `\nÍndex v1 a (${lat}, ${lon})${sqm === null ? ' · foscor estimada' : ` · SQM ${sqm}`}`,
  );
  console.table(
    indexs.map((i) => ({
      hora: i.hora,
      index: i.valor,
      franja: i.franja,
      nuvols: i.factors.nuvols,
      sol: i.factors.sol,
      foscor: i.factors.foscor,
      lluna: i.factors.lluna,
    })),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
