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
   * Versió de les dades (ADR-0012): l'última execució del worker i l'hora en curs. Si canvia, el
   * document es regenera encara que no hagi passat `ttlMs`. Es consulta com a molt cada `checkMs`.
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
 * la `version`.
 * - Les peticions simultànies comparteixen una sola regeneració.
 * - Si no es pot llegir la versió, se serveix el document que hi ha fins a `ttlMs`.
 * - Si la regeneració falla i ja hi havia un document, se serveix l'antic i es torna a provar
 *   al cap de `ttlMs`. Si no n'hi havia cap, l'error arriba a qui ha fet la petició.
 */
export function createContentHashCache(
  load: () => Promise<PuntsMapaGeoJson>,
  { ttlMs = 5 * 60_000, version, checkMs = 60_000, now = Date.now }: ContentHashCacheOptions = {},
): MapDocumentCache {
  let current:
    | { doc: VersionedMapDocument; loadedAt: number; checkedAt: number; version?: string }
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
    const loadedVersion = await readVersion();
    const geojson = await load();
    const doc = { geojson, etag: etagFor(geojson) };
    current = { doc, loadedAt: now(), checkedAt: now(), version: loadedVersion };
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
      if (current && now() - current.loadedAt < ttlMs && !(await versionChanged())) {
        return current.doc;
      }
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
