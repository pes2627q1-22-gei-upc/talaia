/**
 * Contorn oficial de Catalunya per a `GET /visibilitat` (TG-130, ADR-0031): la unió de les quatre
 * províncies de les Divisions administratives de l'ICGC, simplificada i desada com a mòdul de
 * TypeScript versionat a l'API.
 *
 * La font és la capa `divisions_administratives_provincies_50000` del WFS de l'ICGC (escala
 * 1:50.000, CC BY 4.0), que es demana en GeoJSON i WGS84. Les províncies comparteixen exactament els
 * vèrtexs de les fronteres internes: la unió és el conjunt de segments que només surten en una
 * província, encadenats en anells. En surt el contorn de Catalunya (amb la costa), l'enclavament
 * de Llívia, els illots i, com a forats, dues dàrsenes de port. Andorra no hi és: és fora.
 *
 * Després se simplifica amb Douglas-Peucker (200 m per defecte) en metres locals. L'API hi afegeix
 * el marge (`MARGE_M`): un lloc és dins si és dins del polígon o a menys del marge del contorn, i
 * el marge ha de ser més gran que la tolerància perquè cap lloc de Catalunya no quedi fora.
 *
 * Node 22 executa aquest fitxer directament (type stripping); no té dependències.
 */

export const FONT_CONTORN = {
  nom: 'Divisions administratives de Catalunya (ICGC), províncies a escala 1:50.000',
  wfs: 'https://geoserveis.icgc.cat/servei/catalunya/divisions-administratives/wfs',
  capa: 'divisions_administratives_wfs:divisions_administratives_provincies_50000',
  llicencia: 'CC BY 4.0',
  /** Codis de les quatre províncies: Barcelona, Girona, Lleida i Tarragona. */
  provincies: ['08', '17', '25', '43'],
} as const;

/** `[lon, lat]` en graus WGS84. */
export type Punt = [lon: number, lat: number];
/** Anell tancat: el primer i l'últim punt són el mateix. */
export type Anell = Punt[];
/** Coordenades d'un MultiPolygon GeoJSON: polígons → anells (el primer, l'exterior) → punts. */
export type MultiPoligon = Anell[][];

/** Latitud de referència per passar els graus a metres locals: el centre de Catalunya. */
export const LAT_REFERENCIA = 41.7;
/** Metres per grau de longitud i de latitud a `LAT_REFERENCIA` (equirectangular; ±2 % a tot Catalunya). */
export const METRES_PER_GRAU = {
  lon: 111_320 * Math.cos((LAT_REFERENCIA * Math.PI) / 180),
  lat: 110_574,
} as const;

export const OPCIONS_PER_DEFECTE = {
  /** Distància màxima entre el contorn simplificat i l'original, en metres. */
  toleranciaM: 200,
  /** Illots més petits que això (km²) no es desen: el marge de l'API ja els cobreix gairebé tots. */
  areaMinimaIllaKm2: 0.02,
  /** Forats més petits que això (km²) no es desen: són dàrsenes de port, dins del marge. */
  areaMinimaForatKm2: 1,
  /** Decimals de les coordenades desades (~1 m). */
  decimals: 5,
} as const;

export type OpcionsContorn = Partial<Record<keyof typeof OPCIONS_PER_DEFECTE, number>>;

// --- Descàrrega --------------------------------------------------------------------------------

export function urlProvincies(): URL {
  const url = new URL(FONT_CONTORN.wfs);
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '2.0.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typeNames', FONT_CONTORN.capa);
  url.searchParams.set('outputFormat', 'GEOJSON');
  url.searchParams.set('srsName', 'urn:ogc:def:crs:EPSG::4326');
  return url;
}

/** Descarrega les províncies del WFS de l'ICGC (uns 3 MB de GeoJSON). */
export async function descarregaProvincies({
  fetch: fetchFn = fetch,
}: { fetch?: typeof fetch } = {}): Promise<unknown> {
  const resposta = await fetchFn(urlProvincies(), { signal: AbortSignal.timeout(120_000) });
  if (!resposta.ok) {
    throw new Error(`El WFS de l'ICGC ha respost ${resposta.status} ${resposta.statusText}`);
  }
  return resposta.json();
}

// --- De la font als anells ----------------------------------------------------------------------

const esPunt = (p: unknown): p is Punt =>
  Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

/**
 * Els anells de cada província, en l'ordre de la font. Comprova que hi ha les quatre províncies i
 * que les coordenades són de Catalunya en WGS84 (`[lon, lat]`, no a l'inrevés).
 */
export function anellsProvincies(geojson: unknown): Anell[][] {
  const fc = geojson as { type?: string; features?: unknown[] } | null;
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new TypeError('La resposta del WFS no és un FeatureCollection');
  }
  const codis: string[] = [];
  const provincies = fc.features.map((feature, i) => {
    const f = feature as {
      geometry?: { type?: string; coordinates?: unknown };
      properties?: { CODIPROV?: unknown };
    };
    codis.push(String(f.properties?.CODIPROV ?? `#${i}`));
    const { type, coordinates } = f.geometry ?? {};
    const poligons =
      type === 'Polygon'
        ? [coordinates]
        : type === 'MultiPolygon'
          ? (coordinates as unknown[])
          : null;
    if (!poligons) throw new TypeError(`Província ${codis[i]}: geometria ${type ?? 'cap'}`);
    return (poligons as unknown[][]).flat().map((anell) => {
      if (!Array.isArray(anell) || anell.length < 4 || !anell.every(esPunt)) {
        throw new TypeError(`Província ${codis[i]}: anell mal format`);
      }
      for (const [lon, lat] of anell as Punt[]) {
        if (!(lon > -1 && lon < 4 && lat > 40 && lat < 43.5)) {
          throw new RangeError(`Província ${codis[i]}: (${lon}, ${lat}) no és a Catalunya`);
        }
      }
      return (anell as Punt[]).map(([lon, lat]) => [lon, lat] as Punt);
    });
  });
  const esperats = [...FONT_CONTORN.provincies].sort().join(',');
  if ([...codis].sort().join(',') !== esperats) {
    throw new RangeError(
      `S'esperaven les províncies ${esperats} i n'han arribat ${codis.join(',')}`,
    );
  }
  return provincies;
}

const clau = ([lon, lat]: Punt) => `${lon},${lat}`;
const clauSegment = (a: Punt, b: Punt) => {
  const [ka, kb] = [clau(a), clau(b)];
  return ka < kb ? `${ka};${kb}` : `${kb};${ka}`;
};

/**
 * La unió de les províncies com a anells: es treuen els segments que surten dues vegades (les
 * fronteres internes, que les dues províncies recorren en sentit contrari) i la resta s'encadenen
 * conservant-ne el sentit. Funciona perquè la font és topològica: les províncies veïnes tenen
 * exactament els mateixos vèrtexs a la frontera.
 */
export function unio(provincies: Anell[][]): Anell[] {
  const vegades = new Map<string, number>();
  const segments: [Punt, Punt][] = [];
  for (const anell of provincies.flat()) {
    for (let i = 0; i + 1 < anell.length; i++) {
      const [a, b] = [anell[i] as Punt, anell[i + 1] as Punt];
      if (clau(a) === clau(b)) continue;
      const k = clauSegment(a, b);
      vegades.set(k, (vegades.get(k) ?? 0) + 1);
      segments.push([a, b]);
    }
  }
  const sortints = new Map<string, [Punt, Punt][]>();
  for (const s of segments) {
    if (vegades.get(clauSegment(s[0], s[1])) !== 1) continue;
    const llista = sortints.get(clau(s[0])) ?? [];
    llista.push(s);
    sortints.set(clau(s[0]), llista);
  }
  const anells: Anell[] = [];
  for (const llista of sortints.values()) {
    while (llista.length > 0) {
      const primer = llista.pop() as [Punt, Punt];
      const anell: Anell = [primer[0], primer[1]];
      while (clau(anell[anell.length - 1] as Punt) !== clau(primer[0])) {
        const seguent = sortints.get(clau(anell[anell.length - 1] as Punt))?.pop();
        if (!seguent) throw new Error(`El contorn no tanca a (${clau(anell.at(-1) as Punt)})`);
        anell.push(seguent[1]);
      }
      anells.push(anell);
    }
  }
  return anells;
}

// --- Geometria en metres locals -----------------------------------------------------------------

const metres = ([lon, lat]: Punt): [number, number] => [
  lon * METRES_PER_GRAU.lon,
  lat * METRES_PER_GRAU.lat,
];

/** Àrea amb signe en km²: positiva si l'anell gira en sentit antihorari (l'exterior, a GeoJSON). */
export function areaKm2(anell: Anell): number {
  let suma = 0;
  for (let i = 0; i + 1 < anell.length; i++) {
    const [x1, y1] = metres(anell[i] as Punt);
    const [x2, y2] = metres(anell[i + 1] as Punt);
    suma += x1 * y2 - x2 * y1;
  }
  return suma / 2 / 1e6;
}

function distanciaASegment(p: Punt, a: Punt, b: Punt): number {
  const [px, py] = metres(p);
  const [ax, ay] = metres(a);
  const [bx, by] = metres(b);
  const [dx, dy] = [bx - ax, by - ay];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas-Peucker iteratiu (sense recursió: el contorn té desenes de milers de vèrtexs). */
function douglasPeucker(punts: Punt[], toleranciaM: number): Punt[] {
  const queda = new Uint8Array(punts.length);
  queda[0] = 1;
  queda[punts.length - 1] = 1;
  const pila: [number, number][] = [[0, punts.length - 1]];
  while (pila.length > 0) {
    const [inici, fi] = pila.pop() as [number, number];
    let maxima = -1;
    let index = -1;
    for (let i = inici + 1; i < fi; i++) {
      const d = distanciaASegment(punts[i] as Punt, punts[inici] as Punt, punts[fi] as Punt);
      if (d > maxima) [maxima, index] = [d, i];
    }
    if (index !== -1 && maxima > toleranciaM) {
      queda[index] = 1;
      pila.push([inici, index], [index, fi]);
    }
  }
  return punts.filter((_, i) => queda[i] === 1);
}

/**
 * Simplifica un anell tancat: talla pel vèrtex més llunyà del primer i aplica Douglas-Peucker a
 * cada meitat. Cap punt de l'original no queda a més de `toleranciaM` del resultat.
 */
export function simplifica(anell: Anell, toleranciaM: number): Anell {
  const [x0, y0] = metres(anell[0] as Punt);
  let lluny = 0;
  let maxima = -1;
  anell.forEach((p, i) => {
    const [x, y] = metres(p);
    const d = Math.hypot(x - x0, y - y0);
    if (d > maxima) [maxima, lluny] = [d, i];
  });
  const primera = douglasPeucker(anell.slice(0, lluny + 1), toleranciaM);
  const segona = douglasPeucker(anell.slice(lluny), toleranciaM);
  return [...primera.slice(0, -1), ...segona];
}

/** Cert si el punt és dins de l'anell (regla parell-senar). */
export function dinsAnell([lon, lat]: Punt, anell: Anell): boolean {
  let dins = false;
  for (let i = 0, j = anell.length - 1; i < anell.length; j = i++) {
    const [xi, yi] = anell[i] as Punt;
    const [xj, yj] = anell[j] as Punt;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dins = !dins;
  }
  return dins;
}

const arrodoneix =
  (decimals: number) =>
  (p: Punt): Punt => {
    const f = 10 ** decimals;
    return [Math.round(p[0] * f) / f, Math.round(p[1] * f) / f];
  };

/**
 * De la resposta del WFS al MultiPolygon de Catalunya: unió, illots i forats petits fora,
 * simplificació i coordenades arrodonides. Els forats s'assignen a l'exterior que els conté.
 */
export function contornCatalunya(geojson: unknown, opcions: OpcionsContorn = {}): MultiPoligon {
  const { toleranciaM, areaMinimaIllaKm2, areaMinimaForatKm2, decimals } = {
    ...OPCIONS_PER_DEFECTE,
    ...opcions,
  };
  const anells = unio(anellsProvincies(geojson)).map((anell) => ({ anell, area: areaKm2(anell) }));
  const simplificat = (anell: Anell) => {
    // Un illot més estret que la tolerància quedaria en un segment: es simplifica menys.
    const s = simplifica(anell, toleranciaM);
    return (s.length >= 4 ? s : simplifica(anell, toleranciaM / 10)).map(arrodoneix(decimals));
  };
  const exteriors = anells
    .filter(({ area }) => area >= areaMinimaIllaKm2)
    .sort((a, b) => b.area - a.area)
    .map(({ anell }) => ({ original: anell, poligon: [simplificat(anell)] }));
  for (const { anell } of anells.filter(({ area }) => area <= -areaMinimaForatKm2)) {
    const pare = exteriors.find(({ original }) => dinsAnell(anell[0] as Punt, original));
    if (!pare) throw new Error(`Un forat a (${clau(anell[0] as Punt)}) no és dins de cap exterior`);
    pare.poligon.push(simplificat(anell));
  }
  return exteriors.map(({ poligon }) => poligon);
}

// --- Mòdul de l'API -----------------------------------------------------------------------------

export type MetadadesContorn = { consulta: string; toleranciaM: number };

/**
 * El mòdul de TypeScript que llegeix l'API. Sis punts per línia, perquè el diff d'una
 * actualització de la font es pugui llegir; el fitxer és a `.prettierignore`.
 */
export function aModul(contorn: MultiPoligon, { consulta, toleranciaM }: MetadadesContorn): string {
  const vertexs = contorn.flat(2).length;
  const anell = (a: Anell) => {
    const linies: string[] = [];
    for (let i = 0; i < a.length; i += 6) {
      linies.push(
        '      ' +
          a
            .slice(i, i + 6)
            .map(([lon, lat]) => `[${lon}, ${lat}],`)
            .join(' '),
      );
    }
    return `    [\n${linies.join('\n')}\n    ],`;
  };
  const poligons = contorn.map((p) => `  [\n${p.map(anell).join('\n')}\n  ],`).join('\n');
  return `/**
 * Contorn de Catalunya: MultiPolygon GeoJSON ([lon, lat], WGS84). GENERAT per
 * data/scripts/build-contorn-catalunya.ts: no s'edita a mà (ADR-0031).
 *
 * Font: ${FONT_CONTORN.nom}, ${FONT_CONTORN.llicencia}.
 * WFS ${FONT_CONTORN.wfs}, capa ${FONT_CONTORN.capa}, consultat el ${consulta}.
 * Unió de les quatre províncies simplificada a ${toleranciaM} m: ${contorn.length} polígons i ${vertexs} vèrtexs.
 */
export const TOLERANCIA_CONTORN_M = ${toleranciaM};

export const CONTORN_CATALUNYA: [lon: number, lat: number][][][] = [
${poligons}
];
`;
}
