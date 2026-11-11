/**
 * Si una ubicació és dins de Catalunya (HU05, ADR-0031). Codi pur, sense base de dades.
 *
 * El contorn és un polígon simplificat, traçat a mà a partir de pobles, cims i caps de la
 * frontera, amb un marge cap enfora d'1 a 3 km per terra i de 5 a 25 km mar endins. Andorra en
 * queda fora. És una aproximació: un poble a menys de 2 km de la ratlla pot caure al costat que no
 * és. Per a l'índex n'hi ha prou (la previsió té malles d'1 a 11 km); el que es vol és no calcular
 * res a Saragossa, a Perpinyà o al mig del mar. Si calgués el límit oficial (ICGC), només canvia
 * aquesta llista.
 */

/** `[lon, lat]` en graus WGS84, en ordre: la costa de sud a nord i la frontera terrestre de tornada. */
export const CATALONIA_BORDER: readonly (readonly [lon: number, lat: number])[] = [
  // Costa, de la desembocadura de la Sénia a Portbou, mar endins.
  [0.53, 40.5],
  [0.72, 40.52], // Punta de la Banya
  [0.95, 40.7], // Cap de Tortosa
  [1.0, 40.95],
  [1.22, 41.05], // Cap de Salou
  [1.42, 41.1],
  [1.7, 41.17],
  [1.9, 41.2], // Garraf
  [2.18, 41.28], // Delta del Llobregat
  [2.3, 41.4],
  [2.52, 41.52],
  [2.86, 41.64], // Blanes
  [3.06, 41.74],
  [3.2, 41.84],
  [3.28, 41.95], // Cap de Begur
  [3.27, 42.06], // Illes Medes
  [3.22, 42.17], // Golf de Roses
  [3.37, 42.3],
  [3.36, 42.36], // Cap de Creus
  [3.19, 42.44], // Portbou
  // França: l'Albera, el Vallespir i la Cerdanya.
  [3.03, 42.49],
  [2.93, 42.5],
  [2.85, 42.48], // el Pertús
  [2.76, 42.42],
  [2.68, 42.37],
  [2.6, 42.37],
  [2.47, 42.385], // Coll d'Ares
  [2.34, 42.42], // Costabona
  [2.25, 42.45], // Bastiments, sobre Vallter
  [2.12, 42.4], // Puigmal
  [1.99, 42.475], // Llívia
  [1.89, 42.46], // Puigcerdà
  [1.74, 42.51],
  // Andorra, pel sud i per l'oest: queda fora del polígon.
  [1.63, 42.47],
  [1.54, 42.445],
  [1.48, 42.435],
  [1.43, 42.48],
  [1.415, 42.54],
  [1.445, 42.61],
  // França: el Pallars i la Val d'Aran.
  [1.4, 42.69], // Pica d'Estats
  [1.24, 42.75],
  [1.12, 42.79],
  [0.98, 42.81], // Montgarri
  [0.9, 42.83],
  [0.76, 42.88], // Pont del Rei
  [0.67, 42.86],
  [0.64, 42.8],
  [0.63, 42.72],
  // Aragó: la Ribagorça, la Llitera, el Baix Cinca i el Matarranya.
  [0.66, 42.66], // Aneto, a l'altra banda
  [0.68, 42.48], // Vilaller
  [0.73, 42.32],
  [0.7, 42.1],
  [0.64, 41.98],
  [0.58, 41.87],
  [0.42, 41.78], // Almacelles
  [0.4, 41.6],
  [0.38, 41.5], // Fraga, a l'altra banda
  [0.345, 41.45], // Massalcoreig
  [0.34, 41.38],
  [0.41, 41.27], // Mequinensa, a l'altra banda
  [0.32, 41.21],
  [0.2, 41.12],
  [0.215, 41.0],
  [0.22, 40.9], // Arnes
  [0.19, 40.8],
  [0.2, 40.72], // Tossal del Rei
  // País Valencià: la Sénia.
  [0.26, 40.63],
  [0.4, 40.56],
];

/**
 * Cert si `[lon, lat]` és dins del polígon (regla parell-senar: un raig cap a l'est talla un
 * nombre senar de costats). Un punt exactament sobre un costat pot donar qualsevol dels dos.
 */
export function isInPolygon(
  lon: number,
  lat: number,
  polygon: readonly (readonly [number, number])[],
): boolean {
  let dins = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i] as readonly [number, number];
    const [xj, yj] = polygon[j] as readonly [number, number];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dins = !dins;
  }
  return dins;
}

/** Cert si la ubicació (graus WGS84) és dins de Catalunya, amb el marge de `CATALONIA_BORDER`. */
export const isInCatalonia = (lat: number, lon: number): boolean =>
  isInPolygon(lon, lat, CATALONIA_BORDER);
