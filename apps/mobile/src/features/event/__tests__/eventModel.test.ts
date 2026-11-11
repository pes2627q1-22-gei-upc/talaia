import type { Esdeveniment } from '@talaia/shared';

import { cataloniaTime, eventSchedule, nightOf } from '../eventModel';

const base: Esdeveniment = {
  id: 'orionids-2026',
  tipus: 'pluja_estels',
  nom: 'Oriònids',
  inici: '2026-10-02T00:00:00Z',
  fi: '2026-11-07T23:59:59Z',
  maxim: '2026-10-21T12:00:00Z',
  descripcio: 'Pluja anual de meteors ràpids associada al cometa Halley.',
  ubicacio: { nom: "Centre d'Observació de l'Univers", latitud: 41.95, longitud: 1.3 },
  font: 'IMO',
};

it('dona l’hora de Catalunya, amb el canvi d’hora del 25/10', () => {
  expect(cataloniaTime('2026-10-24T22:30:00Z')).toBe('00:30');
  expect(cataloniaTime('2026-10-25T22:30:00Z')).toBe('23:30');
  expect(cataloniaTime('2027-02-21T00:13:00Z')).toBe('01:13');
});

it('situa el màxim d’una pluja a la nit que el conté', () => {
  // Màxim publicat només amb el dia (12:00 UTC): la nit d'aquell dia al següent.
  expect(nightOf('2026-10-21T12:00:00Z')).toEqual({ from: '2026-10-21', to: '2026-10-22' });
  // Abans del migdia, encara és la nit anterior; també a final de mes i d'any.
  expect(nightOf('2026-11-17T23:45:00Z')).toEqual({ from: '2026-11-17', to: '2026-11-18' });
  expect(nightOf('2027-01-04T03:25:00Z')).toEqual({ from: '2027-01-03', to: '2027-01-04' });
  expect(nightOf('2026-11-01T02:00:00Z')).toEqual({ from: '2026-10-31', to: '2026-11-01' });
});

it('una pluja d’estels: els dies publicats i la nit del màxim, sense hores', () => {
  expect(eventSchedule(base)).toEqual({
    kind: 'season',
    // Els límits de dia UTC de l'IMO: el 07/11 a les 23:59 UTC ja és el 08/11 a Catalunya.
    from: '2026-10-02',
    to: '2026-11-07',
    peakNight: { from: '2026-10-21', to: '2026-10-22' },
  });
  expect(eventSchedule({ ...base, maxim: null })).toMatchObject({ peakNight: null });
});

it('una fase lunar ocupa el dia civil i en dona l’instant exacte', () => {
  const nova = {
    ...base,
    tipus: 'fase_llunar' as const,
    inici: '2026-11-08T23:00:00Z',
    fi: '2026-11-09T22:59:59Z',
    maxim: '2026-11-09T07:02:12Z',
  };
  expect(eventSchedule(nova)).toEqual({ kind: 'day', date: '2026-11-09', exact: '08:02' });
  // El dia del canvi d'hora en fa 25.
  expect(
    eventSchedule({ ...nova, inici: '2026-10-24T22:00:00Z', fi: '2026-10-25T22:59:59Z' }),
  ).toMatchObject({ kind: 'day' });
});

it('un eclipsi que travessa la mitjanit: les hores i la nit en què passa', () => {
  expect(
    eventSchedule({
      ...base,
      tipus: 'eclipsi_llunar',
      inici: '2027-02-20T21:12:00Z',
      fi: '2027-02-21T01:13:00Z',
      maxim: '2027-02-20T23:13:00Z',
    }),
  ).toEqual({
    kind: 'window',
    date: '2027-02-20',
    start: '22:12',
    end: '02:13',
    peak: '00:13',
    night: { from: '2027-02-20', to: '2027-02-21' },
  });
});

it('de matinada és la nit anterior; un eclipsi solar de matí és el seu dia', () => {
  const conjuncio = {
    ...base,
    tipus: 'conjuncio' as const,
    inici: '2026-11-16T01:30:00Z',
    fi: '2026-11-16T02:30:00Z',
    maxim: '2026-11-16T02:00:00Z',
  };
  expect(eventSchedule(conjuncio)).toMatchObject({
    start: '02:30',
    night: { from: '2026-11-15', to: '2026-11-16' },
  });
  const solar = {
    ...base,
    tipus: 'eclipsi_solar' as const,
    inici: '2027-08-02T07:30:00Z',
    fi: '2027-08-02T12:43:00Z',
    maxim: '2027-08-02T10:07:00Z',
  };
  expect(eventSchedule(solar)).toMatchObject({ date: '2027-08-02', start: '09:30', night: null });
});

it('una conjunció d’una hora el mateix dia no té nit', () => {
  expect(
    eventSchedule({
      ...base,
      tipus: 'conjuncio',
      inici: '2026-10-05T04:30:00Z',
      fi: '2026-10-05T05:30:00Z',
      maxim: '2026-10-05T05:00:00Z',
    }),
  ).toEqual({
    kind: 'window',
    date: '2026-10-05',
    start: '06:30',
    end: '07:30',
    peak: '07:00',
    night: null,
  });
});
