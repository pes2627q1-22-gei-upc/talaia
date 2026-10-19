import {
  addDays,
  dayParts,
  formatHour,
  greetingFor,
  HOURS,
  nightOf,
  rangeHours,
  roundCoord,
  stepHour,
  travelParts,
} from '../exploreModel';

const at = (hour: number, minute = 0) => new Date(2026, 9, 14, hour, minute);

describe('exploreModel', () => {
  it('«aquesta nit» és la del dia, o la d’ahir si encara és de matinada', () => {
    expect(nightOf(at(21))).toBe('2026-10-14');
    expect(nightOf(at(6))).toBe('2026-10-14');
    expect(nightOf(at(5, 59))).toBe('2026-10-13');
    expect(nightOf(new Date(2027, 0, 1, 2))).toBe('2026-12-31');
  });

  it('suma dies passant de mes, d’any i pel canvi d’hora', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('dona el dia de la setmana i del mes', () => {
    expect(dayParts('2026-10-16')).toEqual({ weekday: 5, day: 16 });
    expect(dayParts('2026-10-18')).toEqual({ weekday: 0, day: 18 });
  });

  it('saluda segons l’hora', () => {
    expect(greetingFor(at(6))).toBe('morning');
    expect(greetingFor(at(13, 59))).toBe('morning');
    expect(greetingFor(at(14))).toBe('afternoon');
    expect(greetingFor(at(20, 59))).toBe('afternoon');
    expect(greetingFor(at(21))).toBe('night');
    expect(greetingFor(at(5, 59))).toBe('night');
  });

  it('mou les hores donant la volta a mitjanit i en compta la durada', () => {
    expect(stepHour(23, 1)).toBe(0);
    expect(stepHour(0, -1)).toBe(23);
    expect(rangeHours(22, 6)).toBe(8);
    expect(rangeHours(6, 22)).toBe(16);
    expect(formatHour(6)).toBe('06:00');
  });

  it('separa el temps en hores i minuts', () => {
    expect(travelParts(150)).toEqual({ hours: 2, minutes: 30 });
    expect(travelParts(45)).toEqual({ hours: 0, minutes: 45 });
    expect(travelParts(240)).toEqual({ hours: 4, minutes: 0 });
  });

  it('arrodoneix les coordenades a 3 decimals (~100 m) i dona les 24 hores', () => {
    expect(roundCoord(41.387412)).toBe(41.387);
    expect(roundCoord(2.168569)).toBe(2.169);
    expect(HOURS).toHaveLength(24);
    expect(HOURS[23]).toBe(23);
  });
});
