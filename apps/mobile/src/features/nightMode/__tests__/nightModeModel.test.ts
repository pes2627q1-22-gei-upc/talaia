import type { PuntMapaFeature } from '@talaia/shared';

import { plan } from '@/features/plans/__fixtures__/plans';

import { nextNightEnd, nightTheme, planNearby, plansInWindow, planWindow } from '../nightModeModel';

/** Hora local del mòbil (els tests corren amb la zona de l'entorn). */
const local = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min);

const MONTSEC = { lat: 42.0254, lon: 0.7375 };
const point = (id: string, { lat, lon } = MONTSEC) =>
  ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { id, nom: id, municipi: id },
  }) as unknown as PuntMapaFeature;

describe('nextNightEnd', () => {
  it.each([
    ['a la 01:00, les 06:00 del mateix dia', local(2026, 11, 24, 1), local(2026, 11, 24, 6)],
    ['a les 22:00, les 06:00 de l’endemà', local(2026, 11, 24, 22), local(2026, 11, 25, 6)],
    ['a les 06:00 en punt, les de l’endemà', local(2026, 11, 24, 6), local(2026, 11, 25, 6)],
  ])('%s', (_cas, now, expected) => {
    expect(nextNightEnd(now)).toEqual(expected);
  });
});

describe('planWindow i plansInWindow', () => {
  const ambFi = plan({
    dataHoraInici: local(2026, 11, 24, 21).toISOString(),
    dataHoraFi: local(2026, 11, 24, 23).toISOString(),
  });
  const senseFi = plan({
    id: 'sense-fi',
    dataHoraInici: local(2026, 11, 24, 21).toISOString(),
    dataHoraFi: null,
  });

  it('sense final, la franja dura fins a les 06:00 de la seva nit', () => {
    expect(planWindow(senseFi).to).toBe(local(2026, 11, 25, 6).getTime());
  });

  it('compta l’inici i no el final', () => {
    const plans = [ambFi, senseFi];
    expect(plansInWindow(plans, local(2026, 11, 24, 20, 59).getTime())).toEqual([]);
    expect(plansInWindow(plans, local(2026, 11, 24, 21).getTime())).toEqual(plans);
    expect(plansInWindow(plans, local(2026, 11, 24, 23).getTime())).toEqual([senseFi]);
    expect(plansInWindow(plans, local(2026, 11, 25, 6).getTime())).toEqual([]);
  });
});

describe('planNearby', () => {
  const ara = local(2026, 11, 24, 22).getTime();
  const enFranja = plan({
    id: 'p1',
    punt: { id: 'montsec', nom: 'Montsec', municipi: 'Àger', publicat: true },
    dataHoraInici: local(2026, 11, 24, 21).toISOString(),
    dataHoraFi: local(2026, 11, 24, 23).toISOString(),
  });

  it('a menys de 500 m del punt d’un pla en franja, el troba', () => {
    // ~450 m al nord.
    const position = { lat: MONTSEC.lat + 0.004, lon: MONTSEC.lon };
    expect(planNearby([enFranja], [point('montsec')], position, ara)).toBe(enFranja);
  });

  it('a més de 500 m, fora de la franja o amb el punt fora del catàleg, no', () => {
    const lluny = { lat: MONTSEC.lat + 0.006, lon: MONTSEC.lon }; // ~670 m
    expect(planNearby([enFranja], [point('montsec')], lluny, ara)).toBeUndefined();
    const demà = local(2026, 11, 25, 22).getTime();
    expect(planNearby([enFranja], [point('montsec')], MONTSEC, demà)).toBeUndefined();
    expect(planNearby([enFranja], [point('prades')], MONTSEC, ara)).toBeUndefined();
  });
});

describe('nightTheme', () => {
  const ara = 1_000;
  it('una tria a mà vigent mana sobre l’automàtic', () => {
    expect(nightTheme({ on: false, until: ara + 1 }, true, ara)).toBe('normal');
    expect(nightTheme({ on: true, until: ara + 1 }, false, ara)).toBe('vermell');
  });

  it('sense tria, o amb una de caducada, mana l’automàtic', () => {
    expect(nightTheme(null, true, ara)).toBe('vermell');
    expect(nightTheme(null, false, ara)).toBe('normal');
    expect(nightTheme({ on: true, until: ara }, false, ara)).toBe('normal');
  });
});
