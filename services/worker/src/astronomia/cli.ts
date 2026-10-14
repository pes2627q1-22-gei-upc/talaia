/**
 * Prova manual del càlcul astronòmic: mostra la nit d'un lloc (posta i sortida del Sol,
 * crepuscles, Lluna) i les efemèrides hora a hora. Sense xarxa ni base de dades.
 *
 *   npm run astro -w services/worker -- 42.0294,0.7112            # la nit d'avui (UTC)
 *   npm run astro -w services/worker -- 42.0294,0.7112 2026-12-21 # una nit concreta
 */
import { efemeridesHores, nitAstronomica, type LlocObservacio } from './astronomia';

const MS_PER_HORA = 3_600_000;

function parseLloc(arg: string): LlocObservacio {
  const [lat, lon, altitud] = arg.split(',').map(Number);
  if (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`Coordenades invàlides: "${arg}" (format: lat,lon[,altitud] en graus WGS84)`);
  }
  return { lat, lon, altitud: Number.isFinite(altitud) ? altitud : null };
}

/** Inicis d'hora en punt des de l'hora anterior a la posta fins a la posterior a la sortida del Sol. */
function horesDeLaNit(postaSol: string, sortidaSol: string): string[] {
  const inici = Math.floor(Date.parse(postaSol) / MS_PER_HORA) * MS_PER_HORA;
  const fi = Math.ceil(Date.parse(sortidaSol) / MS_PER_HORA) * MS_PER_HORA;
  const hores: string[] = [];
  for (let t = inici; t <= fi; t += MS_PER_HORA) hores.push(new Date(t).toISOString());
  return hores;
}

function main(): void {
  const [llocArg, dataArg] = process.argv.slice(2);
  if (!llocArg) {
    console.error('Ús: npm run astro -w services/worker -- <lat,lon[,altitud]> [YYYY-MM-DD]');
    process.exitCode = 1;
    return;
  }

  const lloc = parseLloc(llocArg);
  const data = dataArg ?? new Date().toISOString().slice(0, 10);
  const nit = nitAstronomica(lloc, data);

  console.log(`\nNit del ${nit.data} a (${lloc.lat}, ${lloc.lon}, ${lloc.altitud ?? 0} m)`);
  console.table({
    postaSol: nit.postaSol,
    fiCrepuscleCivil: nit.fiCrepuscleCivil,
    fiCrepuscleNautic: nit.fiCrepuscleNautic,
    fiCrepuscleAstronomic: nit.fiCrepuscleAstronomic,
    iniciCrepuscleAstronomic: nit.iniciCrepuscleAstronomic,
    iniciCrepuscleNautic: nit.iniciCrepuscleNautic,
    iniciCrepuscleCivil: nit.iniciCrepuscleCivil,
    sortidaSol: nit.sortidaSol,
    llunaSobreHoritzoALaPosta: nit.llunaSobreHoritzoALaPosta,
    sortidaLluna: nit.sortidaLluna,
    postaLluna: nit.postaLluna,
  });
  console.log(
    `Lluna a mitja nit: ${nit.lluna.fase} (${Math.round(nit.lluna.fraccioIlluminada * 100)} % il·luminada, angle de fase ${nit.lluna.angleFase}°)`,
  );

  console.log('\nEfemèrides hora a hora (UTC):');
  console.table(
    efemeridesHores(lloc, horesDeLaNit(nit.postaSol, nit.sortidaSol)).map((e) => ({
      hora: e.hora,
      crepuscle: e.crepuscle,
      solAlcada: e.sol.alcada,
      solAzimut: e.sol.azimut,
      llunaAlcada: e.lluna.alcada,
      llunaAzimut: e.lluna.azimut,
      llunaIlluminada: e.lluna.fraccioIlluminada,
      llunaFase: e.lluna.fase,
    })),
  );
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
