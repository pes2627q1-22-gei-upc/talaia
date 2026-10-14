import { createHash } from 'node:crypto';

import type { PuntsMapaGeoJson } from '@talaia/shared';

/** El document del mapa amb la seva versió, que és l'`ETag` (entre cometes). */
export type VersionedMapDocument = { geojson: PuntsMapaGeoJson; etag: string };

/**
 * D'on surt el document i quan es regenera. Ara: `createContentHashCache`.
 * TG-99 la pot substituir per una que faci servir la marca de versió del worker.
 */
export type MapDocumentCache = {
  get(): Promise<VersionedMapDocument>;
};

export type ContentHashCacheOptions = {
  /** Edat màxima del document abans de tornar-lo a construir. */
  ttlMs?: number;
  now?: () => number;
};

export function etagFor(geojson: PuntsMapaGeoJson): string {
  return `"${createHash('sha256').update(JSON.stringify(geojson)).digest('base64url')}"`;
}

/**
 * Document en memòria amb un `ETag` calculat del contingut, regenerat cada `ttlMs`.
 * - Les peticions simultànies comparteixen una sola regeneració.
 * - Si la regeneració falla i ja hi havia un document, se serveix l'antic i es torna a provar
 *   al cap de `ttlMs`. Si no n'hi havia cap, l'error arriba a qui ha fet la petició.
 */
export function createContentHashCache(
  load: () => Promise<PuntsMapaGeoJson>,
  { ttlMs = 5 * 60_000, now = Date.now }: ContentHashCacheOptions = {},
): MapDocumentCache {
  let current: { doc: VersionedMapDocument; loadedAt: number } | undefined;
  let refreshing: Promise<VersionedMapDocument> | undefined;

  const refresh = async () => {
    const geojson = await load();
    const doc = { geojson, etag: etagFor(geojson) };
    current = { doc, loadedAt: now() };
    return doc;
  };

  return {
    async get() {
      if (current && now() - current.loadedAt < ttlMs) return current.doc;
      refreshing ??= refresh().finally(() => {
        refreshing = undefined;
      });
      try {
        return await refreshing;
      } catch (err) {
        if (!current) throw err;
        console.error("[punts] no s'ha pogut regenerar el document; se serveix l'anterior", err);
        current.loadedAt = now();
        return current.doc;
      }
    },
  };
}
