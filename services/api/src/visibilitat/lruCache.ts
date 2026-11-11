/**
 * Memòria cau en memòria amb caducitat per entrada i mida màxima (ADR-0031). Genèrica i sense
 * rellotge propi: els tests li passen `now`.
 *
 * - **LRU:** quan hi ha més de `maxEntries`, surt la que fa més temps que no es fa servir.
 * - **Una sola càrrega per clau:** les peticions simultànies d'una clau que no hi és comparteixen
 *   la mateixa `load`.
 * - **Els errors no es desen:** si `load` falla, l'error arriba a tothom qui l'esperava i la
 *   petició següent ho torna a provar.
 */

/** El que torna `load`: el valor i fins quan és vàlid (mil·lisegons des de l'època). */
export type Loaded<V> = { value: V; expiresAt: number };

/** `hit`: el valor ja hi era i no s'ha hagut d'esperar cap càrrega. */
export type CacheResult<V> = { value: V; hit: boolean };

export type LruCache<V> = {
  /**
   * El valor de `key`. Si no hi és, ha caducat o `usable` el descarta (per exemple, la previsió
   * desada no arriba a l'hora demanada), el carrega amb `load` i el desa.
   */
  get(
    key: string,
    load: () => Promise<Loaded<V>>,
    usable?: (value: V) => boolean,
  ): Promise<CacheResult<V>>;
  /** Entrades desades, també les caducades que encara no s'han tret. */
  readonly size: number;
};

export type LruCacheOptions = {
  maxEntries: number;
  now?: () => number;
};

export function createLruCache<V>({ maxEntries, now = Date.now }: LruCacheOptions): LruCache<V> {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError(`maxEntries ha de ser un enter positiu (rebut: ${maxEntries})`);
  }
  // Un `Map` recorda l'ordre d'inserció: la primera clau és la que fa més temps que no es fa servir.
  const entries = new Map<string, Loaded<V>>();
  const loading = new Map<string, Promise<Loaded<V>>>();

  const store = (key: string, loaded: Loaded<V>) => {
    entries.delete(key);
    entries.set(key, loaded);
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  };

  return {
    async get(key, load, usable = () => true) {
      const entry = entries.get(key);
      if (entry && entry.expiresAt > now() && usable(entry.value)) {
        store(key, entry); // Passa al final: és la més recent.
        return { value: entry.value, hit: true };
      }
      let pending = loading.get(key);
      if (!pending) {
        pending = load()
          .then((loaded) => {
            store(key, loaded);
            return loaded;
          })
          .finally(() => loading.delete(key));
        loading.set(key, pending);
      }
      return { value: (await pending).value, hit: false };
    },
    get size() {
      return entries.size;
    },
  };
}
