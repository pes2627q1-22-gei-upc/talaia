import { ApiError } from '@/core/api/httpClient';

import { plan } from '../__fixtures__/plan';
import { isPlanEvent } from '../planCalendarModel';
import {
  isPlanFinished,
  planChanges,
  planForm,
  planUpdateErrorKey,
  sameDeparture,
  searchPoints,
} from '../planModel';

/**
 * Model de l'edició d'un pla (HU14, TG-161). Hora de Catalunya (`jest.timezone.js`): el pla de
 * prova surt a les 23:15 del 21/10 (21:15Z) i acaba a les 02:00 del 22/10 (00:00Z).
 */
describe('planForm', () => {
  it('omple el formulari amb el pla desat, en hora del mòbil, i en treu la durada', () => {
    expect(planForm(plan)).toEqual({
      puntId: 'montsec',
      esdevenimentId: null,
      departure: { date: '2026-10-21', hour: 23, minute: 15 },
      durationMs: 2 * 60 * 60 * 1000 + 45 * 60 * 1000,
      notes: 'Portar el trípode',
    });
    expect(planForm({ ...plan, dataHoraFi: null, notes: null })).toMatchObject({
      durationMs: null,
      notes: '',
    });
  });
});

describe('planChanges', () => {
  const form = planForm(plan);

  it('sense canvis, null', () => {
    expect(planChanges(plan, form)).toBeNull();
    // Els segons del pla desat no són un canvi: les rodes van de minut en minut.
    expect(planChanges({ ...plan, dataHoraInici: '2026-10-21T21:15:30.000Z' }, form)).toBeNull();
  });

  it('només els camps que han canviat', () => {
    expect(planChanges(plan, { ...form, notes: '  Termo  ' })).toEqual({ notes: 'Termo' });
    expect(planChanges(plan, { ...form, notes: '' })).toEqual({ notes: null });
    expect(planChanges(plan, { ...form, puntId: 'prades' })).toEqual({ puntId: 'prades' });
    expect(planChanges(plan, { ...form, esdevenimentId: 'orionides-2026' })).toEqual({
      esdevenimentId: 'orionides-2026',
    });
    expect(
      planChanges({ ...plan, esdevenimentId: 'orionides-2026' }, { ...form, esdevenimentId: null }),
    ).toEqual({ esdevenimentId: null });
  });

  it('moure la sortida mou el final i en conserva la durada', () => {
    expect(
      planChanges(plan, { ...form, departure: { date: '2026-10-22', hour: 0, minute: 15 } }),
    ).toEqual({
      dataHoraInici: '2026-10-21T22:15:00.000Z',
      dataHoraFi: '2026-10-22T01:00:00.000Z',
    });
  });

  it('un pla sense final continua sense final', () => {
    const senseFi = { ...plan, dataHoraFi: null };
    expect(
      planChanges(senseFi, {
        ...planForm(senseFi),
        departure: { date: '2026-10-21', hour: 22, minute: 0 },
      }),
    ).toEqual({ dataHoraInici: '2026-10-21T20:00:00.000Z' });
  });
});

it('sameDeparture compara la sortida del formulari amb la del pla, al minut', () => {
  expect(sameDeparture(plan, { date: '2026-10-21', hour: 23, minute: 15 })).toBe(true);
  expect(sameDeparture(plan, { date: '2026-10-21', hour: 23, minute: 20 })).toBe(false);
});

describe('isPlanFinished', () => {
  it('amb final, s’acaba al final', () => {
    expect(isPlanFinished(plan, new Date('2026-10-21T23:59:00Z'))).toBe(false);
    expect(isPlanFinished(plan, new Date('2026-10-22T00:01:00Z'))).toBe(true);
  });

  it('sense final, s’acaba a les 12:00 de l’endemà de la seva nit, com l’API', () => {
    const senseFi = { ...plan, dataHoraFi: null };
    expect(isPlanFinished(senseFi, new Date(2026, 9, 22, 11, 59))).toBe(false);
    expect(isPlanFinished(senseFi, new Date(2026, 9, 22, 12, 1))).toBe(true);
    // Una sortida a la 01:00 és de la nit anterior: s'acaba el mateix migdia.
    const matinada = { ...senseFi, dataHoraInici: '2026-10-21T23:00:00.000Z' };
    expect(isPlanFinished(matinada, new Date(2026, 9, 22, 12, 1))).toBe(true);
  });
});

it.each([
  ['plan_already_exists', 409, 'alreadyExists'],
  ['plan_finished', 409, 'finished'],
  ['punt_not_found', 422, 'pointGone'],
  ['event_not_found', 422, 'eventGone'],
  ['plan_not_found', 404, 'notFound'],
  ['validation_error', 400, 'past'],
  ['internal_error', 500, 'generic'],
  ['account_blocked', 403, null],
] as const)('planUpdateErrorKey: %s → %s', (code, status, key) => {
  expect(planUpdateErrorKey(new ApiError(status, code, 'x'))).toBe(key);
});

it('planUpdateErrorKey: un error de xarxa és genèric', () => {
  expect(planUpdateErrorKey(new TypeError('Network request failed'))).toBe('generic');
});

describe('searchPoints', () => {
  const points = [
    { id: 'prades', nom: 'Coll de Prades', municipi: 'Prades' },
    { id: 'montsec', nom: 'Serra del Montsec', municipi: 'Àger' },
    { id: 'aiguestortes', nom: 'Aigüestortes', municipi: 'Espot' },
  ];

  it('sense cerca, tots per ordre alfabètic', () => {
    expect(searchPoints(points, '').map((p) => p.id)).toEqual([
      'aiguestortes',
      'prades',
      'montsec',
    ]);
  });

  it('per nom o municipi, sense accents ni majúscules', () => {
    expect(searchPoints(points, 'ager').map((p) => p.id)).toEqual(['montsec']);
    expect(searchPoints(points, ' AIGUES ').map((p) => p.id)).toEqual(['aiguestortes']);
    expect(searchPoints(points, 'prades').map((p) => p.id)).toEqual(['prades']);
    expect(searchPoints(points, 'cap')).toEqual([]);
  });
});

describe('isPlanEvent', () => {
  it('reconeix l’esdeveniment pel seu inici, final i municipi', () => {
    const event = {
      startDate: '2026-10-21T21:15:00.000Z',
      endDate: new Date('2026-10-22T00:00:00.000Z'),
      location: 'Serra del Montsec, Àger',
    };
    expect(isPlanEvent(event, plan)).toBe(true);
    expect(isPlanEvent({ ...event, startDate: '2026-10-21T22:00:00.000Z' }, plan)).toBe(false);
    expect(isPlanEvent({ ...event, location: 'Casa' }, plan)).toBe(false);
  });
});
