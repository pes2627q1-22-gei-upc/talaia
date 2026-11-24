import { plan } from '../__fixtures__/plan';
import { isPlanEvent, planCalendarEvent } from '../planCalendarModel';

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
  ['2026-11-20T21:00:00Z', '2026-11-20T23:00:00.000Z'],
  ['2026-07-20T21:00:00Z', '2026-07-20T23:00:00.000Z'],
  ['2026-10-25T00:30:00Z', '2026-10-25T02:30:00.000Z'],
])(
  'sense fi explícit, crea una sessió de dues hores també amb canvi d’hora: %s',
  (startDate, endDate) => {
    expect(
      planCalendarEvent(
        { ...plan, dataHoraInici: startDate, dataHoraFi: null, notes: null },
        'Talaia',
      ),
    ).toMatchObject({ startDate, endDate, notes: '' });
  },
);

describe('isPlanEvent (TG-162)', () => {
  const event = {
    startDate: '2026-10-21T21:15:00.000Z',
    endDate: new Date('2026-10-22T00:00:00.000Z'),
    location: 'Serra del Montsec, Àger',
  };

  it("reconeix l'esdeveniment del pla per l'inici, el final i el municipi, sense mirar el títol", () => {
    expect(isPlanEvent(event, plan)).toBe(true);
    // Creat amb l'app en castellà: el nom del punt canvia, el municipi no.
    expect(isPlanEvent({ ...event, location: 'Sierra del Montsec, Àger' }, plan)).toBe(true);
  });

  it.each([
    ['mogut a una altra hora', { startDate: '2026-10-21T22:15:00.000Z' }],
    ['allargat', { endDate: '2026-10-22T01:00:00.000Z' }],
    ["d'un altre lloc", { location: 'Prades' }],
    ['sense ubicació', { location: null }],
  ])('no el reconeix si és %s: podria ser un esdeveniment de l’usuari', (_cas, canvi) => {
    expect(isPlanEvent({ ...event, ...canvi }, plan)).toBe(false);
  });

  it('sense final al pla, espera la sessió de dues hores que es va crear', () => {
    const senseFi = { ...plan, dataHoraFi: null };
    expect(isPlanEvent({ ...event, endDate: '2026-10-21T23:15:00.000Z' }, senseFi)).toBe(true);
    expect(isPlanEvent(event, senseFi)).toBe(false);
  });
});
