import { ApiError } from '@/core/api/httpClient';

import {
  buildNewPlan,
  cleanNotes,
  eventFitsDay,
  eventWindow,
  initialDeparture,
  initialDuration,
  isFuture,
  localToIso,
  planErrorKey,
} from '../planModel';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Un instant local de Catalunya (la zona dels tests, `jest.timezone.js`). */
const local = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min);

it('els tests corren amb la zona de Catalunya (jest.timezone.js)', () => {
  // Sense això, el test d'estiu i hivern dependria de la màquina: la CI és UTC.
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Madrid');
});

describe('localToIso', () => {
  it("a l'hivern, l'hora de Catalunya és UTC+1", () => {
    expect(localToIso('2026-01-15', 23, 15)).toBe('2026-01-15T22:15:00.000Z');
  });

  it("a l'estiu, UTC+2", () => {
    expect(localToIso('2026-07-15', 23, 15)).toBe('2026-07-15T21:15:00.000Z');
  });

  it('una sortida de matinada cau el mateix dia local, i en UTC pot ser el dia abans', () => {
    expect(localToIso('2026-10-22', 0, 30)).toBe('2026-10-21T22:30:00.000Z');
  });

  it('sense minuts, en punt', () => {
    expect(localToIso('2026-10-21', 22)).toBe('2026-10-21T20:00:00.000Z');
  });
});

describe('initialDeparture', () => {
  const now = local(2026, 10, 21, 18, 7);

  it("proposa l'inici de la millor franja de la fitxa", () => {
    expect(initialDeparture('2026-10-21T23:00:00Z', now)).toEqual({
      date: '2026-10-22',
      hour: 1,
      minute: 0,
    });
  });

  it('arrodoneix als 5 minuts de la roda', () => {
    expect(initialDeparture('2026-10-21T21:12:00Z', now)).toEqual({
      date: '2026-10-21',
      hour: 23,
      minute: 15,
    });
  });

  it('sense franja, o amb una franja que ja ha passat o mal formada, avui a les 22:00', () => {
    const tonight = { date: '2026-10-21', hour: 22, minute: 0 };
    expect(initialDeparture(undefined, now)).toEqual(tonight);
    expect(initialDeparture('2026-10-21T10:00:00Z', now)).toEqual(tonight);
    expect(initialDeparture('ahir', now)).toEqual(tonight);
  });

  it('passades les 22:00, la propera hora en punt (també després de mitjanit)', () => {
    expect(initialDeparture(undefined, local(2026, 10, 21, 22, 40))).toEqual({
      date: '2026-10-21',
      hour: 23,
      minute: 0,
    });
    expect(initialDeparture(undefined, local(2026, 10, 21, 23, 40))).toEqual({
      date: '2026-10-22',
      hour: 0,
      minute: 0,
    });
  });
});

it("l'inici ha de ser futur", () => {
  const now = Date.parse('2026-10-21T20:00:00Z');
  expect(isFuture('2026-10-21T20:00:01Z', now)).toBe(true);
  expect(isFuture('2026-10-21T20:00:00Z', now)).toBe(false);
  expect(isFuture('2026-10-21T19:00:00Z', now)).toBe(false);
});

describe('fenòmens del dia', () => {
  const orionides = { inici: '2026-10-02T00:00:00Z', fi: '2026-11-07T00:00:00Z' };
  const llunaPlena = { inici: '2026-10-26T04:12:00Z', fi: '2026-10-26T04:12:00Z' };

  it('la finestra és el dia triat ± 1', () => {
    expect(eventWindow('2026-10-21')).toEqual({ from: '2026-10-20', to: '2026-10-22' });
  });

  it('un fenomen val si el seu interval toca la finestra', () => {
    expect(eventFitsDay(orionides, '2026-10-21')).toBe(true);
    expect(eventFitsDay(llunaPlena, '2026-10-25')).toBe(true);
    expect(eventFitsDay(llunaPlena, '2026-10-27')).toBe(true);
  });

  it('fora de la finestra, no', () => {
    expect(eventFitsDay(llunaPlena, '2026-10-21')).toBe(false);
    expect(eventFitsDay(orionides, '2027-01-10')).toBe(false);
  });
});

it('les notes buides o amb només espais són null', () => {
  expect(cleanNotes('')).toBeNull();
  expect(cleanNotes('   \n ')).toBeNull();
  expect(cleanNotes('  Roba d’abric  ')).toBe('Roba d’abric');
});

const base = {
  puntId: 'montsec',
  esdevenimentId: 'orionides-2026',
  departure: { date: '2026-10-21', hour: 23, minute: 15 },
  notes: ' Frontal vermell ',
};

describe('buildNewPlan', () => {
  it('el cos del POST porta la sortida en UTC i el calendari a null (TG-158)', () => {
    expect(buildNewPlan({ ...base, durationMs: null })).toEqual({
      puntId: 'montsec',
      esdevenimentId: 'orionides-2026',
      dataHoraInici: '2026-10-21T21:15:00.000Z',
      dataHoraFi: null,
      calendariEventId: null,
      notes: 'Frontal vermell',
    });
  });

  it('amb la durada de la franja, envia el final', () => {
    expect(buildNewPlan({ ...base, durationMs: 3 * HOUR }).dataHoraFi).toBe(
      '2026-10-22T00:15:00.000Z',
    );
  });

  it('una durada nul·la o negativa no envia cap final', () => {
    expect(buildNewPlan({ ...base, durationMs: 0 }).dataHoraFi).toBeNull();
    expect(buildNewPlan({ ...base, durationMs: -HOUR }).dataHoraFi).toBeNull();
  });
});

describe('initialDuration', () => {
  // La franja de la fitxa: de 23:15 a 02:00 (hora de Catalunya).
  const inici = '2026-10-21T21:15:00Z';
  const fi = '2026-10-22T00:00:00Z';
  const departure = { date: '2026-10-21', hour: 23, minute: 15 };

  it('és del començament de la franja a `fi`', () => {
    expect(initialDuration(departure, inici, fi)).toBe(2 * HOUR + 45 * MINUTE);
  });

  it('sense fi (o sense inici), null: el pla dura fins al final de la nit', () => {
    expect(initialDuration(departure, inici, undefined)).toBeNull();
    expect(initialDuration(departure, undefined, fi)).toBeNull();
  });

  it("amb l'inici arrodonit als 5 minuts, el final continua sent `fi`", () => {
    // Franja de 23:12: la roda proposa 23:15.
    const duration = initialDuration(departure, '2026-10-21T21:12:00Z', fi);
    expect(buildNewPlan({ ...base, departure, durationMs: duration }).dataHoraFi).toBe(
      '2026-10-22T00:00:00.000Z',
    );
  });

  it('si la sortida es mou, el final es mou igual i la durada es manté', () => {
    const duration = initialDuration(departure, inici, fi);
    const later = buildNewPlan({
      puntId: 'montsec',
      esdevenimentId: null,
      departure: { date: '2026-10-22', hour: 0, minute: 30 },
      durationMs: duration,
      notes: '',
    });
    expect(later.dataHoraInici).toBe('2026-10-21T22:30:00.000Z');
    expect(later.dataHoraFi).toBe('2026-10-22T01:15:00.000Z');
  });

  it("si la sortida no surt de la franja (l'inici ja havia passat), null", () => {
    expect(initialDuration({ date: '2026-10-21', hour: 22, minute: 0 }, inici, fi)).toBeNull();
  });

  it('un final que no queda després de la sortida, o mal format, null', () => {
    expect(initialDuration(departure, inici, inici)).toBeNull();
    expect(initialDuration(departure, inici, 'demà')).toBeNull();
  });
});

describe('planErrorKey', () => {
  it.each([
    [new ApiError(409, 'plan_already_exists', ''), 'alreadyExists'],
    [new ApiError(409, 'plan_limit_reached', ''), 'limitReached'],
    [new ApiError(422, 'punt_not_found', ''), 'pointGone'],
    [new ApiError(422, 'event_not_found', ''), 'generic'],
    [new ApiError(400, 'validation_error', ''), 'generic'],
    [new ApiError(404, 'profile_not_found', ''), 'generic'],
    [new TypeError('Network request failed'), 'generic'],
  ])('%s → %s', (error, key) => {
    expect(planErrorKey(error)).toBe(key);
  });

  it('el compte bloquejat ja el mostra AccountBlockedScreen', () => {
    expect(planErrorKey(new ApiError(403, 'account_blocked', ''))).toBeNull();
  });
});
