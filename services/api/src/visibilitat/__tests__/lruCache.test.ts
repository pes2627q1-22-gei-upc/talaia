import { createLruCache, type Loaded } from '../lruCache';

/** Rellotge fals: els tests el mouen a mà. */
function rellotge(inici = 1_000_000) {
  let t = inici;
  return { now: () => t, avanca: (ms: number) => (t += ms) };
}

/** Una `load` que compta les crides i torna el valor que se li diu, vàlid fins a `expiresAt`. */
function carrega<V>(value: V, expiresAt: number) {
  const load = jest.fn(async (): Promise<Loaded<V>> => ({ value, expiresAt }));
  return load;
}

describe('createLruCache', () => {
  it('la primera vegada carrega (MISS) i la segona surt de la memòria (HIT)', async () => {
    const { now } = rellotge();
    const cache = createLruCache<string>({ maxEntries: 10, now });
    const load = carrega('a', now() + 1_000);

    await expect(cache.get('k', load)).resolves.toEqual({ value: 'a', hit: false });
    await expect(cache.get('k', load)).resolves.toEqual({ value: 'a', hit: true });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('una entrada caducada es torna a carregar', async () => {
    const { now, avanca } = rellotge();
    const cache = createLruCache<string>({ maxEntries: 10, now });
    const load = carrega('a', now() + 1_000);

    await cache.get('k', load);
    avanca(999);
    await expect(cache.get('k', load)).resolves.toMatchObject({ hit: true });
    avanca(1);
    await expect(cache.get('k', load)).resolves.toMatchObject({ hit: false });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('si `usable` descarta el valor desat, el torna a carregar', async () => {
    const { now } = rellotge();
    const cache = createLruCache<number[]>({ maxEntries: 10, now });
    await cache.get('k', carrega([1, 2], now() + 1_000));

    const load = carrega([1, 2, 3], now() + 1_000);
    const result = await cache.get('k', load, (hores) => hores.includes(3));

    expect(result).toEqual({ value: [1, 2, 3], hit: false });
    expect(load).toHaveBeenCalledTimes(1);
    // El valor nou substitueix l'antic.
    await expect(cache.get('k', load, (hores) => hores.includes(3))).resolves.toMatchObject({
      hit: true,
    });
  });

  it('amb massa entrades, treu la que fa més temps que no es fa servir', async () => {
    const { now } = rellotge();
    const cache = createLruCache<string>({ maxEntries: 2, now });
    const fins = now() + 1_000;
    await cache.get('a', carrega('a', fins));
    await cache.get('b', carrega('b', fins));
    await cache.get('a', carrega('a', fins)); // `a` passa a ser la més recent.
    await cache.get('c', carrega('c', fins)); // Surt `b`.

    expect(cache.size).toBe(2);
    await expect(cache.get('a', carrega('a2', fins))).resolves.toEqual({ value: 'a', hit: true });
    await expect(cache.get('c', carrega('c2', fins))).resolves.toEqual({ value: 'c', hit: true });
    await expect(cache.get('b', carrega('b2', fins))).resolves.toEqual({ value: 'b2', hit: false });
  });

  it('les peticions simultànies de la mateixa clau comparteixen una sola càrrega', async () => {
    const { now } = rellotge();
    const cache = createLruCache<string>({ maxEntries: 10, now });
    let resol: (loaded: Loaded<string>) => void = () => {};
    const load = jest.fn(() => new Promise<Loaded<string>>((r) => (resol = r)));

    const peticions = Promise.all([cache.get('k', load), cache.get('k', load)]);
    resol({ value: 'a', expiresAt: now() + 1_000 });

    await expect(peticions).resolves.toEqual([
      { value: 'a', hit: false },
      { value: 'a', hit: false },
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('claus diferents es carreguen per separat', async () => {
    const { now } = rellotge();
    const cache = createLruCache<string>({ maxEntries: 10, now });
    const load = carrega('a', now() + 1_000);

    await Promise.all([cache.get('a', load), cache.get('b', load)]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('els errors no es desen: arriben a tothom qui esperava i la següent ho torna a provar', async () => {
    const { now } = rellotge();
    const cache = createLruCache<string>({ maxEntries: 10, now });
    const falla = jest.fn(async (): Promise<Loaded<string>> => {
      throw new Error('Open-Meteo caigut');
    });

    const resultats = await Promise.allSettled([cache.get('k', falla), cache.get('k', falla)]);
    expect(resultats).toEqual([
      { status: 'rejected', reason: new Error('Open-Meteo caigut') },
      { status: 'rejected', reason: new Error('Open-Meteo caigut') },
    ]);
    expect(falla).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);

    await expect(cache.get('k', carrega('a', now() + 1_000))).resolves.toEqual({
      value: 'a',
      hit: false,
    });
  });

  it('rebutja una mida que no és un enter positiu', () => {
    expect(() => createLruCache({ maxEntries: 0 })).toThrow(RangeError);
    expect(() => createLruCache({ maxEntries: 1.5 })).toThrow(RangeError);
  });
});
