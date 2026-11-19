import { plan } from '../__fixtures__/plan';
import { planCalendarEvent } from '../planCalendarModel';

it('trasllada el punt, les dates absolutes i les notes al calendari, també travessant mitjanit', () => {
  expect(planCalendarEvent(plan, 'Oriònides · Montsec')).toEqual({
    title: 'Oriònides · Montsec',
    location: 'Serra del Montsec, Àger',
    startDate: '2026-10-21T21:15:00.000Z',
    endDate: '2026-10-22T00:00:00.000Z',
    notes: 'Portar el trípode',
    timeZone: 'Europe/Madrid',
  });
});

it.each([
  ['2026-11-20T21:00:00Z', '2026-11-21T11:00:00.000Z'],
  ['2026-07-20T21:00:00Z', '2026-07-21T10:00:00.000Z'],
  ['2026-10-25T00:30:00Z', '2026-10-25T11:00:00.000Z'],
])(
  'sense fi explícit, usa el final de la nit de l’API, també amb canvi d’hora: %s',
  (startDate, endDate) => {
    expect(
      planCalendarEvent(
        { ...plan, dataHoraInici: startDate, dataHoraFi: null, notes: null },
        'Talaia',
      ),
    ).toMatchObject({ startDate, endDate, notes: '' });
  },
);
