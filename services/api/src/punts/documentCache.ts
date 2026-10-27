import { createHash } from 'node:crypto';

import type { PuntsMapaGeoJson } from '@talaia/shared';

/** El document del mapa amb la seva versió, que és l'`ETag` (entre cometes). */
export type VersionedMapDocument = { geojson: PuntsMapaGeoJson; etag: string };

/** D'on surt el document i quan es regenera: `createContentHashCache`. */
export type MapDocumentCache = {
  get(): Promise<VersionedMapDocument>;
};

export type ContentHashCacheOptions = {
  /** Edat màxima del document abans de tornar-lo a construir. */
  ttlMs?: number;
  /**
   * Període de les dades, calculat del rellotge a cada petició sense anar a la BD (l'hora en curs:
   * l'índex del mapa és el d'aquesta hora). Si canvia, el document es regenera al moment, i `load`
   * el rep perquè les dades i el període surtin del mateix rellotge.
   */
  period?: (now: number) => number;
  /**
   * Versió de les dades (ADR-0012): l'última execució del worker. Si canvia, el document es
   * regenera encara que no hagi passat `ttlMs`. Es consulta com a molt cada `checkMs`.
   */
  version?: () => Promise<string>;
  checkMs?: number;
  now?: () => number;
};

export function etagFor(geojson: PuntsMapaGeoJson): string {
  return `"${createHash('sha256').update(JSON.stringify(geojson)).digest('base64url')}"`;
}

/**
 * Document en memòria amb un `ETag` calculat del contingut, regenerat cada `ttlMs` o quan canvia
 * el `period` o la `version`.
 * - Les peticions simultànies comparteixen una sola regeneració.
 * - Si no es pot llegir la versió, se serveix el document que hi ha fins a `ttlMs`.
 * - Si la regeneració falla i ja hi havia un document, se serveix l'antic i es torna a provar
 *   al cap de `ttlMs`. Si no n'hi havia cap, l'error arriba a qui ha fet la petició.
 */
export function createContentHashCache(
  load: (period: number | undefined) => Promise<PuntsMapaGeoJson>,
  {
    ttlMs = 5 * 60_000,
    period,
    version,
    checkMs = 60_000,
    now = Date.now,
  }: ContentHashCacheOptions = {},
): MapDocumentCache {
  let current:
    | {
        doc: VersionedMapDocument;
        loadedAt: number;
        checkedAt: number;
        period?: number;
        version?: string;
      }
    | undefined;
  let refreshing: Promise<VersionedMapDocument> | undefined;

  const readVersion = async () => {
    try {
      return await version?.();
    } catch (err) {
      console.error("[punts] no s'ha pogut llegir la versió de l'índex", err);
      return undefined;
    }
  };

  const refresh = async () => {
    const loadedPeriod = period?.(now());
    const loadedVersion = await readVersion();
    const geojson = await load(loadedPeriod);
    const doc = { geojson, etag: etagFor(geojson) };
    current = {
      doc,
      loadedAt: now(),
      checkedAt: now(),
      period: loadedPeriod,
      version: loadedVersion,
    };
    return doc;
  };

  /** Si toca, mira si la versió ha canviat des de l'última regeneració. */
  const versionChanged = async () => {
    if (!version || !current || now() - current.checkedAt < checkMs) return false;
    current.checkedAt = now();
    const latest = await readVersion();
    return latest !== undefined && latest !== current.version;
  };

  return {
    async get() {
      if (
        current &&
        now() - current.loadedAt < ttlMs &&
        !(await versionChanged()) &&
        // Després de l'`await`: si l'hora ha canviat mentre es llegia la versió, també es regenera.
        period?.(now()) === current.period
      ) {
        return current.doc;
      }
      const regenera = () =>
        (refreshing ??= refresh().finally(() => {
          refreshing = undefined;
        }));
      try {
        const doc = await regenera();
        // Una regeneració començada abans de canviar el període porta les dades de l'anterior: qui
        // s'hi ha enganxat després en demana una de nova.
        if (period && period(now()) !== current?.period) return await regenera();
        return doc;
      } catch (err) {
        if (!current) throw err;
        console.error("[punts] no s'ha pogut regenerar el document; se serveix l'anterior", err);
        current.loadedAt = now();
        return current.doc;
      }
    },
  };
}
