import type { PuntsMapaGeoJson } from '@talaia/shared';

import { createContentHashCache } from '../documentCache';

const doc = (n: number): PuntsMapaGeoJson => ({
  type: 'FeatureCollection',
  features: Array.from({ length: n }, (_, i) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [1, 41 + i] },
    properties: { id: String(i), nom: 'n', municipi: 'm', index: null },
  })),
});

describe('createContentHashCache', () => {
  afterEach(() => jest.restoreAllMocks());

  it('no torna a carregar abans de ttlMs, i després sí', async () => {
    let t = 0;
    const load = jest.fn().mockResolvedValueOnce(doc(1)).mockResolvedValueOnce(doc(2));
    const cache = createContentHashCache(load, { ttlMs: 1000, now: () => t });
    const first = await cache.get();
    t = 999;
    expect(await cache.get()).toBe(first);
    t = 1000;
    const second = await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
    expect(second.etag).not.toBe(first.etag);
  });

  it("l'ETag només canvia si canvia el contingut", async () => {
    let t = 0;
    const cache = createContentHashCache(async () => doc(1), { ttlMs: 10, now: () => t });
    const { etag } = await cache.get();
    t = 100;
    expect((await cache.get()).etag).toBe(etag);
  });

  it('les peticions simultànies comparteixen una sola càrrega', async () => {
    const load = jest.fn(async () => doc(1));
    const cache = createContentHashCache(load);
    const [a, b, c] = await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('si la càrrega falla, serveix el document anterior i no hi torna fins al cap de ttlMs', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let t = 0;
    const load = jest
      .fn()
      .mockResolvedValueOnce(doc(1))
      .mockRejectedValueOnce(new Error('caiguda'))
      .mockResolvedValueOnce(doc(2));
    const cache = createContentHashCache(load, { ttlMs: 10, now: () => t });
    const first = await cache.get();
    t = 10;
    expect(await cache.get()).toBe(first);
    t = 15;
    expect(await cache.get()).toBe(first);
    expect(load).toHaveBeenCalledTimes(2);
    t = 20;
    expect((await cache.get()).geojson.features).toHaveLength(2);
  });

  it("sense document anterior, l'error arriba a qui crida", async () => {
    const cache = createContentHashCache(() => Promise.reject(new Error('caiguda')));
    await expect(cache.get()).rejects.toThrow('caiguda');
  });
});

describe('createContentHashCache amb version', () => {
  afterEach(() => jest.restoreAllMocks());

  it('es regenera quan canvia la versió, i la mira com a molt cada checkMs', async () => {
    let t = 0;
    let v = 'v1';
    const load = jest.fn().mockResolvedValueOnce(doc(1)).mockResolvedValueOnce(doc(2));
    const version = jest.fn(async () => v);
    const cache = createContentHashCache(load, {
      ttlMs: 10_000,
      checkMs: 1000,
      version,
      now: () => t,
    });
    const first = await cache.get();

    v = 'v2';
    t = 500;
    expect(await cache.get()).toBe(first);
    expect(version).toHaveBeenCalledTimes(1);

    t = 1000;
    const second = await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
    expect(second.etag).not.toBe(first.etag);
  });

  it('si la versió no canvia, no torna a carregar abans de ttlMs', async () => {
    let t = 0;
    const load = jest.fn().mockResolvedValue(doc(1));
    const cache = createContentHashCache(load, {
      ttlMs: 10_000,
      checkMs: 1000,
      version: async () => 'v1',
      now: () => t,
    });
    await cache.get();
    t = 5000;
    await cache.get();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('si no es pot llegir la versió, serveix el document que té fins a ttlMs', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let t = 0;
    let falla = false;
    const load = jest.fn().mockResolvedValue(doc(1));
    const cache = createContentHashCache(load, {
      ttlMs: 10_000,
      checkMs: 1000,
      version: async () => {
        if (falla) throw new Error('bd');
        return 'v1';
      },
      now: () => t,
    });
    const first = await cache.get();
    falla = true;
    t = 2000;
    expect(await cache.get()).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('createContentHashCache amb period', () => {
  it('es regenera al moment quan canvia el període i load el rep', async () => {
    let t = 59_990;
    const load = jest.fn(async (period: number | undefined) => doc(period === 0 ? 1 : 2));
    const cache = createContentHashCache(load, {
      ttlMs: 10 * 60_000,
      checkMs: 60_000,
      period: (now) => Math.floor(now / 60_000),
      version: async () => 'v1',
      now: () => t,
    });

    const first = await cache.get();
    t = 60_010;
    const second = await cache.get();

    expect(load.mock.calls).toEqual([[0], [1]]);
    expect(second.etag).not.toBe(first.etag);
  });
});

describe('createContentHashCache: una regeneració que travessa el canvi de període', () => {
  it('qui hi estava enganxat rep el document del període nou', async () => {
    let t = 59_990;
    let acaba: (doc: PuntsMapaGeoJson) => void = () => {};
    const load = jest.fn(
      (period: number | undefined) =>
        new Promise<PuntsMapaGeoJson>((resolve) => {
          if (period === 0) acaba = resolve;
          else resolve(doc(2));
        }),
    );
    const cache = createContentHashCache(load, {
      ttlMs: 10 * 60_000,
      period: (now) => Math.floor(now / 60_000),
      now: () => t,
    });

    const primera = cache.get();
    t = 60_010;
    const segona = cache.get();
    await new Promise((resolve) => setImmediate(resolve)); // que `load(0)` hagi començat
    acaba(doc(1));

    // Totes dues s'havien enganxat a la regeneració del període 0: reben la del període 1.
    expect((await primera).geojson.features).toHaveLength(2);
    expect((await segona).geojson.features).toHaveLength(2);
    expect(load.mock.calls).toEqual([[0], [1]]);
  });
});
