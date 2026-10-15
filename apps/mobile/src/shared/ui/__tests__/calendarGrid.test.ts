import { isoDate, monthIndex, monthOf, monthWeeks, shiftMonth } from '../calendarGrid';

const RANGE = { min: '2026-10-15', max: '2027-10-15' };

describe('calendarGrid', () => {
  it("l'octubre de 2026 comença en dijous: 3 forats si la setmana és de dilluns, 4 si és de diumenge", () => {
    const monday = monthWeeks({ year: 2026, month: 9 }, { firstDay: 1, ...RANGE });
    expect(monday[0]?.slice(0, 4).map((cell) => cell?.day ?? null)).toEqual([null, null, null, 1]);
    const sunday = monthWeeks({ year: 2026, month: 9 }, { firstDay: 0, ...RANGE });
    expect(sunday[0]?.slice(0, 5).map((cell) => cell?.day ?? null)).toEqual([
      null,
      null,
      null,
      null,
      1,
    ]);
  });

  it('té tots els dies del mes, en setmanes senceres', () => {
    const weeks = monthWeeks({ year: 2027, month: 1 }, { firstDay: 1, ...RANGE });
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(28);
  });

  it('desactiva els dies fora del rang', () => {
    const days = monthWeeks({ year: 2026, month: 9 }, { firstDay: 1, ...RANGE }).flat();
    expect(days.find((cell) => cell?.day === 14)?.disabled).toBe(true);
    expect(days.find((cell) => cell?.day === 15)?.disabled).toBe(false);
  });

  it('mou els mesos passant d’any', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2027, month: 0 }, -1)).toEqual({ year: 2026, month: 11 });
    expect(monthOf('2027-08-02')).toEqual({ year: 2027, month: 7 });
    expect(monthIndex({ year: 2027, month: 0 })).toBeGreaterThan(
      monthIndex({ year: 2026, month: 11 }),
    );
    expect(isoDate(2026, 9, 5)).toBe('2026-10-05');
  });
});
