/**
 * Perfil d'horitzó de cada punt a partir del model d'elevacions de l'ICGC (TG-116, ADR-0022).
 *
 * Font: el Model d'Elevacions del Terreny de Catalunya de 5 × 5 m de l'ICGC (CC BY 4.0). El WCS de
 * l'ICGC el serveix en ETRS89 / UTM 31N (EPSG:25831) només com a ArcGrid (text), remostrejat pel
 * veí més proper a la resolució que es demana. Per a cada punt se'n baixen tres finestres centrades
 * al punt (`NIVELLS`): 5 m fins a 1,5 km, 30 m fins a 12 km i 200 m fins a 50 km. Les muntanyes
 * properes demanen detall i les llunyanes, abast.
 *
 * Per a cada grau d'azimut es recorre un raig des de 50 m del punt: l'alçada de l'horitzó és l'angle
 * més alt fins al terreny, vist des d'uns ulls a 2 m del terra, amb la curvatura de la Terra i la
 * refracció terrestre estàndard (k = 0,13). És l'alçada **aparent**: per saber si un astre hi és
 * per sobre, compara-la amb l'alçada aparent de l'astre (la geomètrica més la refracció, uns 0,5°
 * a l'horitzó).
 *
 * El model només cobreix Catalunya. Fora (el mar obert, l'Aragó, França, Andorra) no hi ha dades i
 * hi compta el nivell del mar: sobre el mar és exacte i sobre terra és un mínim. Els azimuts on el
 * raig surt de Catalunya per terra es marquen com a `incomplets`. L'aigua de dins (el mar a tocar de
 * la costa, els embassaments) el model la marca sense cota (`AIGUA`) i també hi compta el nivell
 * del mar: sobre un embassament és massa baix, però l'aigua no fa mai d'horitzó.
 */
import { SENSE_DADA, utm31, type MallaSqm } from './mapa-foscor.ts';

export const FONT_MET = {
  nom: "Model d'elevacions del terreny de Catalunya 5 × 5 m (ICGC, CC BY 4.0)",
  wcs: 'https://geoserveis.icgc.cat/icc_mdt/wcs/service',
  /** El servei tria el model de 5 m o el de 15 m segons la resolució que es demana. */
  cobertura: 'icc:met',
  epsg: 25831,
  /**
   * Extensió comuna dels dos models (DescribeCoverage de `icc:met5` i `icc:met15`, 19/10/2026). Una
   * petició que en surt torna una malla retallada i d'una altra mida: les finestres s'hi retallen.
   */
  extensio: { minX: 251_752.5, minY: 4_483_947.5, maxX: 536_332.5, maxY: 4_754_347.5 },
} as const;

/** Valor del model a l'aigua (el mar a tocar de la costa, els embassaments), diferent de `SENSE_DADA`. */
export const AIGUA = -8888;

/** Malla regular en EPSG:25831, fila a fila des del nord: la mateixa que la del mapa de foscor. */
export type Malla = MallaSqm;

export type Nivell = { semicostat: number; cela: number };

/** Finestres quadrades centrades al punt, de la més fina a la més grossa (metres). */
export const NIVELLS: readonly Nivell[] = [
  { semicostat: 1_500, cela: 5 },
  { semicostat: 12_000, cela: 30 },
  { semicostat: 50_000, cela: 200 },
];

export const PERFIL = {
  /** Ulls de l'observador sobre el terreny, en metres. */
  alcadaObservador: 2,
  /**
   * El relleu més proper no compta (metres): les coordenades del geocodificador tenen uns metres
   * d'error i l'observador es mou. Sense aquest marge, un cim de 4 m a 10 m del punt tapava 11° del
   * cel de Bellmunt, que és dalt d'un turó.
   */
  distanciaMinima: 50,
  radiTerra: 6_371_000,
  /** Coeficient de refracció terrestre: la llum es corba i el relleu llunyà es veu més alt. */
  refraccio: 0.13,
  /** Si l'última cota abans d'un forat és més alta, el raig surt de Catalunya per terra. */
  cotaCosta: 10,
};

const rad = (graus: number): number => (graus * Math.PI) / 180;
const graus = (radiants: number): number => (radiants * 180) / Math.PI;

// --- Font ---------------------------------------------------------------------------------------

/** Llegeix un ArcGrid ASCII (capçalera `NCOLS`, `NROWS`, `XLLCORNER`, `YLLCORNER`, `CELLSIZE`). */
export function parsejaArcGrid(text: string): Malla {
  if (text.trimStart().startsWith('<')) {
    throw new Error(`El WCS ha respost amb un error: ${text.replace(/\s+/g, ' ').slice(0, 300)}`);
  }
  const linies = text.split('\n');
  const capcalera: Record<string, number> = {};
  let i = 0;
  for (; i < linies.length; i++) {
    const [clau, valor] = (linies[i] ?? '').trim().split(/\s+/);
    if (!clau || !/^[a-z_]+$/i.test(clau)) break;
    capcalera[clau.toLowerCase()] = Number(valor);
  }
  const { ncols, nrows, xllcorner, yllcorner, cellsize } = capcalera;
  const senseDada = capcalera.nodata_value;
  if (
    ncols === undefined ||
    nrows === undefined ||
    xllcorner === undefined ||
    yllcorner === undefined ||
    cellsize === undefined ||
    ![ncols, nrows, xllcorner, yllcorner, cellsize].every(Number.isFinite)
  ) {
    throw new TypeError(`Capçalera d'ArcGrid incompleta: ${JSON.stringify(capcalera)}`);
  }
  const valors = new Float32Array(ncols * nrows);
  let k = 0;
  for (; i < linies.length; i++) {
    for (const v of (linies[i] ?? '').trim().split(/\s+/)) {
      if (!v) continue;
      const n = Number(v);
      valors[k++] = n === senseDada ? SENSE_DADA : n;
    }
  }
  if (k !== valors.length) {
    throw new RangeError(`L'ArcGrid té ${k} valors i n'havia de tenir ${ncols} × ${nrows}`);
  }
  return {
    x0: xllcorner,
    y0: yllcorner + nrows * cellsize,
    costat: cellsize,
    columnes: ncols,
    files: nrows,
    valors,
  };
}

export type Finestra = Pick<Malla, 'x0' | 'y0' | 'costat' | 'columnes' | 'files'>;

/**
 * Finestra d'un nivell centrada al punt (en metres EPSG:25831), alineada a la seva cel·la i
 * retallada a l'extensió del model. Fora de l'extensió no hi ha terra de Catalunya.
 */
export function finestra(x: number, y: number, { semicostat, cela }: Nivell): Finestra {
  const { minX, minY, maxX, maxY } = FONT_MET.extensio;
  const oest = Math.max(Math.round(x / cela) * cela - semicostat, Math.ceil(minX / cela) * cela);
  const est = Math.min(Math.round(x / cela) * cela + semicostat, Math.floor(maxX / cela) * cela);
  const nord = Math.min(Math.round(y / cela) * cela + semicostat, Math.floor(maxY / cela) * cela);
  const sud = Math.max(Math.round(y / cela) * cela - semicostat, Math.ceil(minY / cela) * cela);
  return {
    x0: oest,
    y0: nord,
    costat: cela,
    columnes: Math.round((est - oest) / cela),
    files: Math.round((nord - sud) / cela),
  };
}

/** Comprova que una malla és la finestra esperada (la del WCS o una de la memòria cau). */
export function esFinestra(malla: Malla, f: Finestra): boolean {
  return (
    Math.abs(malla.x0 - f.x0) < 0.01 &&
    Math.abs(malla.y0 - f.y0) < 0.01 &&
    Math.abs(malla.costat - f.costat) < 1e-6 &&
    malla.columnes === f.columnes &&
    malla.files === f.files
  );
}

/** Baixa una finestra del model pel WCS de l'ICGC. */
export async function descarregaFinestra(
  f: Finestra,
  fetchFn: typeof fetch = fetch,
): Promise<Malla> {
  const url = new URL(FONT_MET.wcs);
  url.search = new URLSearchParams({
    SERVICE: 'WCS',
    VERSION: '1.0.0',
    REQUEST: 'GetCoverage',
    COVERAGE: FONT_MET.cobertura,
    CRS: `EPSG:${FONT_MET.epsg}`,
    BBOX: [f.x0, f.y0 - f.files * f.costat, f.x0 + f.columnes * f.costat, f.y0].join(','),
    WIDTH: String(f.columnes),
    HEIGHT: String(f.files),
    FORMAT: 'ArcGrid',
  }).toString();
  const resposta = await fetchFn(url, {
    headers: {
      'User-Agent': 'Talaia (PES FIB-UPC; +https://github.com/pes2627q1-22-gei-upc/talaia)',
    },
  });
  if (!resposta.ok) throw new Error(`El WCS de l'ICGC ha respost ${resposta.status}`);
  const malla = parsejaArcGrid(await resposta.text());
  if (!esFinestra(malla, f)) {
    throw new RangeError(
      `El WCS ha tornat ${malla.columnes} × ${malla.files} cel·les de ${malla.costat} m a (${malla.x0}, ${malla.y0}) ` +
        `i s'esperaven ${f.columnes} × ${f.files} de ${f.costat} m a (${f.x0}, ${f.y0})`,
    );
  }
  return malla;
}

// --- Càlcul -------------------------------------------------------------------------------------

/**
 * Cota interpolada (bilineal entre centres de cel·la), amb l'aigua a 0 m, o `null` fora de la malla
 * o al costat d'una cel·la sense dada.
 */
export function elevacioA(malla: Malla, x: number, y: number): number | null {
  const c = (x - malla.x0) / malla.costat - 0.5;
  const f = (malla.y0 - y) / malla.costat - 0.5;
  const c0 = Math.floor(c);
  const f0 = Math.floor(f);
  if (c0 < 0 || f0 < 0 || c0 + 1 >= malla.columnes || f0 + 1 >= malla.files) return null;
  const i = f0 * malla.columnes + c0;
  const [a, b, d, e] = [i, i + 1, i + malla.columnes, i + malla.columnes + 1].map((j) =>
    malla.valors[j] === AIGUA ? 0 : malla.valors[j],
  );
  if (
    a === undefined ||
    b === undefined ||
    d === undefined ||
    e === undefined ||
    [a, b, d, e].includes(SENSE_DADA)
  ) {
    return null;
  }
  const tc = c - c0;
  const tf = f - f0;
  return (a * (1 - tc) + b * tc) * (1 - tf) + (d * (1 - tc) + e * tc) * tf;
}

/**
 * Rumb del nord geogràfic sobre la quadrícula UTM, en graus (la convergència de meridians): a
 * l'oest del meridià 3° E els meridians s'inclinen cap a l'est, uns +1,5° al Montsec. Sense
 * corregir-lo, tot el perfil quedaria girat.
 */
export function nordGeografic(lat: number, lon: number): number {
  const p = utm31(lat, lon);
  const q = utm31(lat + 0.01, lon);
  return graus(Math.atan2(q.x - p.x, q.y - p.y));
}

export type PerfilHoritzo = {
  /**
   * 360 alçades aparents de l'horitzó en graus amb 1 decimal; la posició és l'azimut geogràfic
   * (0 = N, 90 = E). Negatives quan el terreny baixa (un cim, un cingle sobre el mar).
   */
  alcades: number[];
  /** Azimuts on el raig surt de Catalunya per terra abans dels 50 km: l'alçada hi és un mínim. */
  incomplets: number[];
  /** Cota del terreny al punt segons el model, en metres. */
  cota: number;
};

/** Perfil d'horitzó d'un punt amb les malles de `NIVELLS` (en el mateix ordre). */
export function perfilHoritzo(
  lat: number,
  lon: number,
  malles: readonly Malla[],
  nivells: readonly Nivell[] = NIVELLS,
  p = PERFIL,
): PerfilHoritzo {
  if (malles.length !== nivells.length) {
    throw new RangeError(`Calen ${nivells.length} malles i n'hi ha ${malles.length}`);
  }
  const { x, y } = utm31(lat, lon);
  const cota = malles[0] && elevacioA(malles[0], x, y);
  if (cota === null || cota === undefined) {
    throw new RangeError(`(${lat}, ${lon}): el model d'elevacions no té cota al punt`);
  }
  const ulls = cota + p.alcadaObservador;
  const gir = nordGeografic(lat, lon);
  const caiguda = (1 - p.refraccio) / (2 * p.radiTerra);
  const alcades: number[] = [];
  const incomplets: number[] = [];
  for (let azimut = 0; azimut < 360; azimut++) {
    const dx = Math.sin(rad(azimut + gir));
    const dy = Math.cos(rad(azimut + gir));
    let maxim = -Math.PI / 2;
    let ultimaCota = cota;
    let incomplet = false;
    let d = p.distanciaMinima;
    for (const [i, nivell] of nivells.entries()) {
      const malla = malles[i] as Malla;
      for (; d <= nivell.semicostat - nivell.cela; d += nivell.cela) {
        let h = elevacioA(malla, x + d * dx, y + d * dy);
        if (h === null) {
          if (ultimaCota > p.cotaCosta) incomplet = true;
          h = 0;
        } else {
          ultimaCota = h;
        }
        const angle = Math.atan2(h - caiguda * d * d - ulls, d);
        if (angle > maxim) maxim = angle;
      }
    }
    alcades.push(Math.round(graus(maxim) * 10) / 10 || 0);
    if (incomplet) incomplets.push(azimut);
  }
  return { alcades, incomplets, cota };
}

/** `[10, 11, 12, 40]` → `"10–12°, 40°"`, tenint en compte que 359 i 0 són contigus. */
export function rangsAzimut(azimuts: readonly number[]): string {
  const dins = new Set(azimuts);
  if (dins.size === 360) return '0–359°';
  const rangs: string[] = [];
  for (const a of [...dins].sort((m, n) => m - n)) {
    if (dins.has((a + 359) % 360)) continue;
    let fi = a;
    while (dins.has((fi + 1) % 360)) fi = (fi + 1) % 360;
    rangs.push(fi === a ? `${a}°` : `${a}–${fi}°`);
  }
  return rangs.join(', ');
}
