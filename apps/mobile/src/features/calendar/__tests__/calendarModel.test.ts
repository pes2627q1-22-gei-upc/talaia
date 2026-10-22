import type { Esdeveniment, TipusFenomen } from '@talaia/shared';

import {
  calendarWindowBounds,
  eventDate,
  filterEvents,
  monthBounds,
  nextDay,
  orderEventsAroundToday,
  weekBounds,
} from '../calendarModel';

const event = (id: string, tipus: TipusFenomen, maxim: string | null): Esdeveniment => ({
  id,
  tipus,
  maxim,
  inici: maxim ?? '2026-10-21T20:00:00Z',
  fi: maxim ?? '2026-10-22T20:00:00Z',
  nom: id,
  descripcio: '',
  ubicacio: { nom: 'Àger', latitud: 42.02, longitud: 0.73 },
  font: 'test',
});

describe('calendarModel', () => {
  it('consulta el mes complet, inclosos els anys de traspàs', () => {
    expect(monthBounds({ year: 2028, month: 1 })).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('inclou les setmanes que travessen el límit del mes', () => {
    expect(weekBounds('2026-10-01')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(calendarWindowBounds({ year: 2026, month: 9 })).toEqual({
      from: '2026-09-28',
      to: '2026-11-01',
    });
  });

  it('calcula demà encara que canviï el mes o l’any', () => {
    expect(nextDay('2026-10-31')).toBe('2026-11-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });

  it('agrupa els tipus acordats i ordena cronològicament els resultats', () => {
    const events = [
      event('late', 'superlluna', '2026-10-26T20:00:00Z'),
      event('meteor', 'pluja_estels', '2026-10-21T20:00:00Z'),
      event('early', 'fase_llunar', '2026-10-03T20:00:00Z'),
      event('solar', 'eclipsi_solar', '2026-10-15T20:00:00Z'),
      event('conjunction', 'conjuncio', '2026-10-17T20:00:00Z'),
    ];
    expect(filterEvents(events, 'moon').map(({ id }) => id)).toEqual(['early', 'late']);
    expect(filterEvents(events, 'sun').map(({ id }) => id)).toEqual(['solar']);
    expect(filterEvents(events, 'other').map(({ id }) => id)).toEqual(['conjunction']);
    expect(filterEvents(events, 'all').map(({ id }) => id)).toEqual([
      'early',
      'solar',
      'conjunction',
      'meteor',
      'late',
    ]);
  });

  it('situa el dia en hora de Catalunya, inclosa la franja després de mitjanit', () => {
    const instant = '2026-10-21T23:30:00Z';
    expect(eventDate(event('night', 'pluja_estels', instant))).toBe('2026-10-22');
    expect(eventDate(event('no-peak', 'conjuncio', null))).toBe('2026-10-21');
  });

  it('posa els dies passats al final, començant pel més recent', () => {
    const events = [
      event('past-old', 'fase_llunar', '2026-10-03T20:00:00Z'),
      event('future', 'superlluna', '2026-10-26T20:00:00Z'),
      event('past-recent', 'conjuncio', '2026-10-17T20:00:00Z'),
      event('today', 'pluja_estels', '2026-10-21T20:00:00Z'),
    ];

    expect(orderEventsAroundToday(events, '2026-10-21').map(({ id }) => id)).toEqual([
      'today',
      'future',
      'past-recent',
      'past-old',
    ]);
  });
});
