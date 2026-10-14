/**
 * Càlcul astronòmic amb Astronomy Engine (TG-96; ADR-0004): posició del Sol i de la Lluna, fase
 * lunar, franja de crepuscle i esdeveniments d'una nit (posta i sortida del Sol, crepuscles,
 * sortida i posta de la Lluna). Tot és codi pur: sense xarxa ni base de dades, determinista per a
 * un lloc i un instant. La fórmula de l'índex (TG-98) el consumeix hora a hora, alineat amb la
 * previsió meteorològica.
 * Referència: https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md
 */
import type {
  EfemeridesHora,
  EstatLluna,
  FaseLunar,
  FranjaCrepuscle,
  NitAstronomica,
  PosicioAstre,
} from '@talaia/shared';
import {
  type AstroTime,
  Body,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchAltitude,
  SearchRiseSet,
} from 'astronomy-engine';

/** Lloc d'observació: coordenades WGS84 i, si es coneix, altitud en metres sobre el nivell del mar. */
export type LlocObservacio = {
  lat: number;
  lon: number;
  /** Afina lleugerament les hores de sortida i posta; `null` o absent compta com a 0. */
  altitud?: number | null;
};

/**
 * Alçada geomètrica del centre del Sol a la posta i a la sortida: −50′ (34′ de refracció més
 * 16′ de semidiàmetre). És la convenció de les efemèrides i la que fa servir Astronomy Engine.
 */
export const ALCADA_SOL_HORITZO = -0.8333;

/** Llindars estàndard dels crepuscles, en graus d'alçada geomètrica del Sol. */
export const ALCADA_CREPUSCLE = { civil: -6, nautic: -12, astronomic: -18 } as const;

const MS_PER_DIA = 86_400_000;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Franja de llum del cel a partir de l'alçada geomètrica del Sol, amb els llindars estàndard
 * (`ALCADA_SOL_HORITZO` i `ALCADA_CREPUSCLE`).
 */
export function franjaCrepuscle(alcadaSol: number): FranjaCrepuscle {
  if (alcadaSol > ALCADA_SOL_HORITZO) return 'dia';
  if (alcadaSol > ALCADA_CREPUSCLE.civil) return 'civil';
  if (alcadaSol > ALCADA_CREPUSCLE.nautic) return 'nautic';
  if (alcadaSol > ALCADA_CREPUSCLE.astronomic) return 'astronomic';
  return 'nit';
}

const FASES: readonly FaseLunar[] = [
  'nova',
  'creixent',
  'quart_creixent',
  'gibosa_creixent',
  'plena',
  'gibosa_minvant',
  'quart_minvant',
  'minvant',
];

/**
 * Nom de la fase a partir de l'angle de fase (0–360°): vuit trams de 45° centrats a 0° (nova),
 * 90° (quart creixent), 180° (plena) i 270° (quart minvant). Així `nova` és de 337,5° a 22,5°.
 */
export function nomFaseLunar(angleFase: number): FaseLunar {
  if (!Number.isFinite(angleFase)) {
    throw new RangeError(`angleFase ha de ser un nombre (rebut: ${angleFase})`);
  }
  const angle = ((angleFase % 360) + 360) % 360;
  const index = Math.floor(((angle + 22.5) % 360) / 45);
  // `index` és sempre de 0 a 7 (l'angle normalitzat és de 0 a 360); el `?? 'nova'` només tipa l'accés.
  return FASES[index] ?? 'nova';
}

function observerDe(lloc: LlocObservacio): Observer {
  const { lat, lon, altitud } = lloc;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new RangeError(`lat ha de ser un nombre entre −90 i 90 (rebut: ${lat})`);
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new RangeError(`lon ha de ser un nombre entre −180 i 180 (rebut: ${lon})`);
  }
  if (altitud != null && !Number.isFinite(altitud)) {
    throw new RangeError(`altitud ha de ser un nombre de metres o null (rebut: ${altitud})`);
  }
  return new Observer(lat, lon, altitud ?? 0);
}

function dataDe(hora: string): Date {
  const data = new Date(hora);
  if (Number.isNaN(data.getTime())) {
    throw new RangeError(`hora ha de ser un instant ISO 8601 (rebut: "${hora}")`);
  }
  return data;
}

const arrodoneix = (valor: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(valor * factor) / factor;
};

/** ISO 8601 en UTC al segon: la cerca d'Astronomy Engine no té més precisió. */
function isoAlSegon(data: Date): string {
  return new Date(Math.round(data.getTime() / 1000) * 1000).toISOString();
}

/**
 * Alçada i azimut geomètrics (sense refracció) d'un astre des d'un lloc en un instant, amb dos
 * decimals. Coordenades equatorials de la data, amb aberració, com recomana la llibreria per a
 * coordenades horitzontals.
 */
function posicioDe(body: Body, observer: Observer, data: Date): PosicioAstre {
  const equatorial = Equator(body, data, observer, true, true);
  const horitzontal = Horizon(data, observer, equatorial.ra, equatorial.dec);
  return {
    alcada: arrodoneix(horitzontal.altitude, 2),
    azimut: arrodoneix(horitzontal.azimuth, 2),
  };
}

/** Posició geomètrica del Sol des d'un lloc en un instant (ISO 8601). */
export function posicioSol(lloc: LlocObservacio, hora: string): PosicioAstre {
  return posicioDe(Body.Sun, observerDe(lloc), dataDe(hora));
}

/** Fase de la Lluna en un instant: fracció il·luminada, angle de fase i nom. Igual a tota la Terra. */
export function faseLunar(
  hora: string,
): Pick<EstatLluna, 'fraccioIlluminada' | 'angleFase' | 'fase'> {
  const data = dataDe(hora);
  const angleFase = MoonPhase(data);
  return {
    fraccioIlluminada: arrodoneix(Illumination(Body.Moon, data).phase_fraction, 3),
    angleFase: arrodoneix(angleFase, 1),
    fase: nomFaseLunar(angleFase),
  };
}

/** Posició geomètrica i fase de la Lluna des d'un lloc en un instant (ISO 8601). */
export function estatLluna(lloc: LlocObservacio, hora: string): EstatLluna {
  return { ...posicioDe(Body.Moon, observerDe(lloc), dataDe(hora)), ...faseLunar(hora) };
}

/** Efemèrides d'un instant en un lloc: Sol, franja de crepuscle i Lluna. */
export function efemeridesHora(lloc: LlocObservacio, hora: string): EfemeridesHora {
  const observer = observerDe(lloc);
  const data = dataDe(hora);
  const sol = posicioDe(Body.Sun, observer, data);
  return {
    hora: data.toISOString(),
    sol,
    crepuscle: franjaCrepuscle(sol.alcada),
    lluna: { ...posicioDe(Body.Moon, observer, data), ...faseLunar(hora) },
  };
}

/**
 * Efemèrides de cada hora, en el mateix ordre. Pensat per alinear-les amb les hores de la
 * previsió meteorològica (`PrevisioMeteoHora.hora`) abans de calcular l'índex.
 */
export function efemeridesHores(lloc: LlocObservacio, hores: string[]): EfemeridesHora[] {
  observerDe(lloc); // Valida el lloc encara que la llista sigui buida.
  return hores.map((hora) => efemeridesHora(lloc, hora));
}

/**
 * Esdeveniments del Sol i de la Lluna de la nit que comença el vespre del dia `data`
 * (`YYYY-MM-DD`) en un lloc. La posta de sol es busca a partir del migdia solar mitjà del lloc
 * (12:00 UTC corregit per la longitud), de manera que la nit queda ben delimitada a qualsevol
 * longitud sense dependre de la zona horària. La sortida i la posta de la Lluna només es donen
 * si cauen entre la posta i la sortida del Sol.
 */
export function nitAstronomica(lloc: LlocObservacio, data: string): NitAstronomica {
  const observer = observerDe(lloc);
  if (!DATA_ISO.test(data)) {
    throw new RangeError(`data ha de tenir el format YYYY-MM-DD (rebut: "${data}")`);
  }
  const migdiaUtc = Date.parse(`${data}T12:00:00Z`);
  if (Number.isNaN(migdiaUtc)) throw new RangeError(`data no és un dia vàlid (rebut: "${data}")`);
  // Migdia solar mitjà: 12:00 UTC menys 4 minuts per cada grau de longitud est.
  const migdiaSolar = new Date(migdiaUtc - (lloc.lon / 15) * 3_600_000);

  const postaSol = SearchRiseSet(Body.Sun, observer, -1, migdiaSolar, 1);
  if (!postaSol) throw new RangeError(`El Sol no es pon el ${data} a (${lloc.lat}, ${lloc.lon})`);
  const sortidaSol = SearchRiseSet(Body.Sun, observer, +1, postaSol, 1);
  if (!sortidaSol)
    throw new RangeError(`El Sol no surt després del ${data} a (${lloc.lat}, ${lloc.lon})`);

  // Vespre: el Sol baixa per cada llindar a partir de l'esdeveniment anterior (així cap cerca
  // no agafa el crepuscle d'una altra nit). Matinada: torna a pujar pel mateix llindar; la
  // primera pujada després de la baixada del vespre és, per força, la d'aquesta nit.
  const baixaFinsA = (alcada: number, desDe: AstroTime | null) =>
    desDe && SearchAltitude(Body.Sun, observer, -1, desDe, 1, alcada);
  const pujaFinsA = (alcada: number, desDe: AstroTime | null) =>
    desDe && SearchAltitude(Body.Sun, observer, +1, desDe, 1, alcada);

  const fiCivil = baixaFinsA(ALCADA_CREPUSCLE.civil, postaSol);
  const fiNautic = baixaFinsA(ALCADA_CREPUSCLE.nautic, fiCivil);
  const fiAstronomic = baixaFinsA(ALCADA_CREPUSCLE.astronomic, fiNautic);
  const iniciAstronomic = pujaFinsA(ALCADA_CREPUSCLE.astronomic, fiAstronomic);
  const iniciNautic = pujaFinsA(ALCADA_CREPUSCLE.nautic, fiNautic);
  const iniciCivil = pujaFinsA(ALCADA_CREPUSCLE.civil, fiCivil);

  const duradaNit = (sortidaSol.date.getTime() - postaSol.date.getTime()) / MS_PER_DIA;
  const sortidaLluna = SearchRiseSet(Body.Moon, observer, +1, postaSol, duradaNit);
  const postaLluna = SearchRiseSet(Body.Moon, observer, -1, postaSol, duradaNit);

  const mitjaNit = new Date((postaSol.date.getTime() + sortidaSol.date.getTime()) / 2);
  const iso = (time: AstroTime | null) => (time ? isoAlSegon(time.date) : null);

  return {
    data,
    postaSol: isoAlSegon(postaSol.date),
    fiCrepuscleCivil: iso(fiCivil),
    fiCrepuscleNautic: iso(fiNautic),
    fiCrepuscleAstronomic: iso(fiAstronomic),
    iniciCrepuscleAstronomic: iso(iniciAstronomic),
    iniciCrepuscleNautic: iso(iniciNautic),
    iniciCrepuscleCivil: iso(iniciCivil),
    sortidaSol: isoAlSegon(sortidaSol.date),
    sortidaLluna: iso(sortidaLluna),
    postaLluna: iso(postaLluna),
    lluna: faseLunar(mitjaNit.toISOString()),
  };
}
