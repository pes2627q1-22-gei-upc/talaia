/**
 * Mapa de contaminació lumínica de la Generalitat: la foscor del cel per punt (TG-97, ADR-0020).
 *
 * Font: «Mapa de brillantor del cel nocturn de Catalunya 2024», elaborat per l'IEEC per al
 * Departament de Territori, Habitatge i Transició Ecològica. Dona la brillantor del fons del cel
 * al zenit en magnituds per segon d'arc al quadrat (mag/arcsec², la unitat d'un Sky Quality Meter,
 * SQM) en una malla d'1 km. Com més alt el valor, més fosc el cel: 17,5 és cel de ciutat i 21,6 o
 * més, cel fosc natural (la fórmula de l'índex ho converteix en el factor foscor, ADR-0018).
 *
 * La Generalitat no publica el ràster com a fitxer: serveix la malla com a capa vectorial
 * (`ATMOSFERA_MAPA_SQM_2024`, un polígon d'1 km × 1 km per cel·la amb l'atribut `MAG`) al seu
 * servidor OGC. Aquest mòdul la descarrega pel WFS, la rasteritza en una malla regular en
 * ETRS89 / UTM 31N (EPSG:25831, la projecció de la font) i la desa com a GeoTIFF amb geotiff.js;
 * després el GeoTIFF es consulta per obtenir l'SQM d'una latitud i longitud.
 *
 * Node 22 executa aquest fitxer directament (type stripping); l'única dependència és `geotiff`.
 */
import { readFile } from 'node:fs/promises';
import { fromArrayBuffer, writeArrayBuffer } from 'geotiff';

export const FONT_SQM = {
  nom: 'Mapa de brillantor del cel nocturn de Catalunya 2024 (Generalitat de Catalunya / IEEC)',
  /** Servidor OGC del Departament; la mateixa capa es veu al WMS i al visor. */
  wfs: 'https://sig.gencat.cat/ows/ATMOSFERA/wfs',
  capa: 'ATMOSFERA:ATMOSFERA_MAPA_SQM_2024',
  visor:
    'https://sig.gencat.cat/visors/hipermapa.html?background=icgc_mapa_estandard&bg_transp=1&BBOX=-51568,4430393,831927,4819055&layers=ATMOSFERA_MAPA_SQM_2024&styles=0&transparency=1',
  /** ETRS89 / UTM 31N, la projecció de la malla. */
  epsg: 25831,
  /** Costat de la cel·la, en metres. */
  costat: 1000,
} as const;

/** Valor de les cel·les sense dada al GeoTIFF (etiqueta `GDAL_NODATA`). */
export const SENSE_DADA = -9999;

/** Rang físic plausible d'un SQM; un valor de la font fora d'aquí és un error, no una dada. */
export const SQM_MIN = 10;
export const SQM_MAX = 23;

/** Una cel·la de la font: el centre en metres EPSG:25831 i la brillantor del cel. */
export type CelaSqm = { x: number; y: number; sqm: number };

/** Malla regular, fila a fila des del nord (com un GeoTIFF). */
export type MallaSqm = {
  /** Vora oest i vora nord de la malla (cantonada superior esquerra), en metres EPSG:25831. */
  x0: number;
  y0: number;
  costat: number;
  columnes: number;
  files: number;
  /** `files × columnes` valors; `SENSE_DADA` on la font no té cel·la. */
  valors: Float32Array;
};

// --- Projecció -------------------------------------------------------------------------------

/** El·lipsoide GRS80 (ETRS89); el de WGS84 difereix en menys d'un mil·límetre. */
const GRS80 = { a: 6_378_137, f: 1 / 298.257_222_101 };
/** Fus 31: meridià central 3° E, factor d'escala 0,9996, 500 km de fals est, hemisferi nord. */
const UTM31 = { lambda0: 3, k0: 0.9996, falsEst: 500_000 };

const rad = (graus: number): number => (graus * Math.PI) / 180;

/**
 * Projecció directa ETRS89 → UTM 31N (EPSG:25831) amb les sèries de Krüger (precisió mil·limètrica
 * dins del fus). Catalunya és tota dins del fus 31; a l'oest de 0° (la Franja) encara hi és.
 */
export function utm31(lat: number, lon: number): { x: number; y: number } {
  if (!(Math.abs(lat) <= 84) || !(Math.abs(lon - UTM31.lambda0) <= 6)) {
    throw new RangeError(`(${lat}, ${lon}) és fora del fus UTM 31 (longituds de −3° a 9°)`);
  }
  const { a, f } = GRS80;
  const n = f / (2 - f);
  const A = (a / (1 + n)) * (1 + (n * n) / 4 + n ** 4 / 64);
  const alfa = [
    n / 2 - (2 * n * n) / 3 + (5 * n ** 3) / 16,
    (13 * n * n) / 48 - (3 * n ** 3) / 5,
    (61 * n ** 3) / 240,
  ];
  const phi = rad(lat);
  const lambda = rad(lon - UTM31.lambda0);
  const s = (2 * Math.sqrt(n)) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - s * Math.atanh(s * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(lambda));
  const eta = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t));
  let est = eta;
  let nord = xi;
  alfa.forEach((aj, i) => {
    const j = 2 * (i + 1);
    est += aj * Math.cos(j * xi) * Math.sinh(j * eta);
    nord += aj * Math.sin(j * xi) * Math.cosh(j * eta);
  });
  return { x: UTM31.falsEst + UTM31.k0 * A * est, y: UTM31.k0 * A * nord };
}

// --- De la font a la malla ---------------------------------------------------------------------

type Anell = [number, number][];

function anells(geometria: unknown): Anell[] {
  const g = geometria as { type?: string; coordinates?: unknown } | null;
  if (g?.type === 'Polygon') return g.coordinates as Anell[];
  if (g?.type === 'MultiPolygon') return (g.coordinates as Anell[][]).flat();
  throw new TypeError(`Geometria inesperada: ${g?.type ?? 'cap'} (s'esperava un polígon)`);
}

/**
 * Converteix la resposta GeoJSON del WFS (en EPSG:25831) en cel·les. Comprova que cada polígon fa
 * una cel·la del costat esperat i que `MAG` és un SQM plausible; les cel·les sense valor s'ometen.
 */
export function parsejaCeles(geojson: unknown, costat: number = FONT_SQM.costat): CelaSqm[] {
  const fc = geojson as { type?: string; features?: unknown[] } | null;
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new TypeError('La resposta del WFS no és un FeatureCollection');
  }
  const celes: CelaSqm[] = [];
  for (const [i, feature] of fc.features.entries()) {
    const f = feature as { geometry?: unknown; properties?: { ID?: unknown; MAG?: unknown } };
    const id = f.properties?.ID ?? `#${i}`;
    const mag = f.properties?.MAG;
    if (mag === null || mag === undefined) continue;
    if (typeof mag !== 'number' || !(mag >= SQM_MIN && mag <= SQM_MAX)) {
      throw new RangeError(
        `Cel·la ${id}: MAG ${String(mag)} no és un SQM entre ${SQM_MIN} i ${SQM_MAX}`,
      );
    }
    const punts = anells(f.geometry).flat();
    const xs = punts.map((p) => p[0]);
    const ys = punts.map((p) => p[1]);
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    if (Math.abs(maxX - minX - costat) > 1 || Math.abs(maxY - minY - costat) > 1) {
      throw new RangeError(
        `Cel·la ${id}: fa ${Math.round(maxX - minX)} × ${Math.round(maxY - minY)} m i no ${costat}`,
      );
    }
    celes.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, sqm: mag });
  }
  return celes;
}

/**
 * Col·loca les cel·les en una malla regular alineada a la font (l'origen és la cantonada de la
 * cel·la més a l'oest i més al nord, arrodonida al metre). Dues cel·les a la mateixa posició són
 * un error: la font ha de ser una malla.
 */
export function rasteritza(celes: CelaSqm[], costat: number = FONT_SQM.costat): MallaSqm {
  if (celes.length === 0) throw new RangeError('No hi ha cap cel·la per rasteritzar');
  const mig = costat / 2;
  const x0 = Math.floor(Math.min(...celes.map((c) => c.x - mig)));
  const y0 = Math.ceil(Math.max(...celes.map((c) => c.y + mig)));
  // Arrodonit, no ceil: les cantonades de la font ballen uns decímetres i afegirien una fila buida.
  const columnes = Math.round((Math.max(...celes.map((c) => c.x + mig)) - x0) / costat);
  const files = Math.round((y0 - Math.min(...celes.map((c) => c.y - mig))) / costat);
  const valors = new Float32Array(columnes * files).fill(SENSE_DADA);
  for (const c of celes) {
    const columna = Math.floor((c.x - x0) / costat);
    const fila = Math.floor((y0 - c.y) / costat);
    const i = fila * columnes + columna;
    if (valors[i] !== SENSE_DADA) {
      throw new RangeError(`Dues cel·les a la mateixa posició (fila ${fila}, columna ${columna})`);
    }
    valors[i] = c.sqm;
  }
  return { x0, y0, costat, columnes, files, valors };
}

// --- Consulta ----------------------------------------------------------------------------------

function valorA(malla: MallaSqm, fila: number, columna: number): number | null {
  if (fila < 0 || columna < 0 || fila >= malla.files || columna >= malla.columnes) return null;
  const v = malla.valors[fila * malla.columnes + columna];
  return v === undefined || v === SENSE_DADA ? null : v;
}

/** SQM de la cel·la que conté el punt, o `null` si és fora de la malla o la font no hi té cel·la. */
export function sqmA(malla: MallaSqm, lat: number, lon: number): number | null {
  const { x, y } = utm31(lat, lon);
  return valorA(
    malla,
    Math.floor((malla.y0 - y) / malla.costat),
    Math.floor((x - malla.x0) / malla.costat),
  );
}

export type SqmProper = {
  sqm: number;
  /** Del punt al centre de la cel·la, en metres; 0 si el punt és dins de la cel·la. */
  distancia: number;
};

/**
 * Com `sqmA`, però si el punt cau en un forat de la malla (la costa, un far, una barra de sorra)
 * torna la cel·la més propera fins a `radiCeles` cel·les al voltant, amb la distància al seu centre.
 */
export function sqmProper(
  malla: MallaSqm,
  lat: number,
  lon: number,
  radiCeles = 2,
): SqmProper | null {
  const exacte = sqmA(malla, lat, lon);
  if (exacte !== null) return { sqm: exacte, distancia: 0 };
  const { x, y } = utm31(lat, lon);
  const fila0 = Math.floor((malla.y0 - y) / malla.costat);
  const columna0 = Math.floor((x - malla.x0) / malla.costat);
  let millor: SqmProper | null = null;
  for (let df = -radiCeles; df <= radiCeles; df++) {
    for (let dc = -radiCeles; dc <= radiCeles; dc++) {
      const sqm = valorA(malla, fila0 + df, columna0 + dc);
      if (sqm === null) continue;
      const cx = malla.x0 + (columna0 + dc + 0.5) * malla.costat;
      const cy = malla.y0 - (fila0 + df + 0.5) * malla.costat;
      const distancia = Math.hypot(cx - x, cy - y);
      if (!millor || distancia < millor.distancia) millor = { sqm, distancia };
    }
  }
  return millor;
}

// --- GeoTIFF -----------------------------------------------------------------------------------

/** Serialitza la malla com a GeoTIFF d'una banda Float32 en EPSG:25831 (píxel = àrea). */
export function aGeoTiff(malla: MallaSqm): ArrayBuffer {
  return writeArrayBuffer(malla.valors, {
    height: malla.files,
    width: malla.columnes,
    ModelPixelScale: [malla.costat, malla.costat, 0],
    ModelTiepoint: [0, 0, 0, malla.x0, malla.y0, 0],
    GTModelTypeGeoKey: 1,
    GTRasterTypeGeoKey: 1,
    ProjectedCSTypeGeoKey: FONT_SQM.epsg,
    GTCitationGeoKey: 'ETRS89 / UTM zone 31N',
    GDAL_NODATA: String(SENSE_DADA),
  });
}

/** Llegeix un GeoTIFF escrit per `aGeoTiff` (o equivalent: una banda, EPSG:25831, cel·les quadrades). */
export async function llegirMalla(geotiff: ArrayBuffer): Promise<MallaSqm> {
  const tiff = await fromArrayBuffer(geotiff);
  const imatge = await tiff.getImage();
  const epsg = imatge.getGeoKeys()?.ProjectedCSTypeGeoKey as number | undefined;
  if (epsg !== FONT_SQM.epsg) {
    throw new RangeError(`El GeoTIFF és en EPSG:${epsg ?? '?'} i s'esperava EPSG:${FONT_SQM.epsg}`);
  }
  const [resX, resY] = imatge.getResolution();
  const [x0, y0] = imatge.getOrigin();
  if (resX === undefined || resY === undefined || x0 === undefined || y0 === undefined) {
    throw new RangeError('El GeoTIFF no té georeferència');
  }
  if (Math.abs(resX + resY) > 1e-6 || resX <= 0) {
    throw new RangeError(
      `Cel·les de ${resX} × ${resY} m: han de ser quadrades, del nord cap al sud`,
    );
  }
  const bandes = await imatge.readRasters();
  const banda = bandes[0];
  if (bandes.length !== 1 || banda === undefined || typeof banda === 'number') {
    throw new RangeError(`El GeoTIFF té ${bandes.length} bandes i se n'esperava una`);
  }
  const senseDada = imatge.getGDALNoData() ?? SENSE_DADA;
  const valors = Float32Array.from(banda, (v) => (v === senseDada ? SENSE_DADA : v));
  return { x0, y0, costat: resX, columnes: imatge.getWidth(), files: imatge.getHeight(), valors };
}

export async function llegirMallaFitxer(ruta: string): Promise<MallaSqm> {
  const buffer = await readFile(ruta);
  return llegirMalla(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

// --- Descàrrega --------------------------------------------------------------------------------

export type OpcionsDescarrega = {
  fetch?: typeof fetch;
  /** Cel·les per petició (GeoServer pagina amb `startIndex`; cal `sortBy` perquè l'ordre sigui estable). */
  perPagina?: number;
};

/** Descarrega totes les cel·les de la capa pel WFS, pàgina a pàgina, en EPSG:25831. */
export async function descarregaCeles({
  fetch: fetchFn = fetch,
  perPagina = 10_000,
}: OpcionsDescarrega = {}): Promise<CelaSqm[]> {
  const celes: CelaSqm[] = [];
  let esperades: number | undefined;
  let rebudes = 0;
  for (let inici = 0; ; inici += perPagina) {
    const url = new URL(FONT_SQM.wfs);
    url.search = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: FONT_SQM.capa,
      outputFormat: 'application/json',
      srsName: `EPSG:${FONT_SQM.epsg}`,
      sortBy: 'ID',
      count: String(perPagina),
      startIndex: String(inici),
    }).toString();
    const resposta = await fetchFn(url, {
      headers: {
        'User-Agent': 'Talaia (PES FIB-UPC; +https://github.com/pes2627q1-22-gei-upc/talaia)',
      },
    });
    if (!resposta.ok) throw new Error(`El WFS de la Generalitat ha respost ${resposta.status}`);
    const cos = (await resposta.json()) as { numberMatched?: number; features?: unknown[] };
    esperades ??= cos.numberMatched;
    celes.push(...parsejaCeles(cos));
    rebudes += cos.features?.length ?? 0;
    if ((cos.features?.length ?? 0) < perPagina) break;
  }
  if (esperades !== undefined && esperades !== rebudes) {
    throw new Error(`El WFS anunciava ${esperades} cel·les i n'ha donat ${rebudes}`);
  }
  return celes;
}
