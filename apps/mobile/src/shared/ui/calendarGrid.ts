/** Un mes del calendari: `month` va de 0 (gener) a 11. */
export type CalendarMonth = { year: number; month: number };

export type CalendarDay = {
  /** `YYYY-MM-DD`. */
  date: string;
  day: number;
  /** Fora de `min`–`max`: es veu, però no es pot triar. */
  disabled: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');

export const isoDate = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

export function monthOf(date: string): CalendarMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 };
}

export function shiftMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

/** Ordre dels mesos, per comparar-los. */
export const monthIndex = ({ year, month }: CalendarMonth) => year * 12 + month;

/**
 * Les setmanes d'un mes, de dilluns (`firstDay = 1`) o de diumenge (`firstDay = 0`). Els forats
 * abans de l'u i després de l'últim dia són `null`.
 */
export function monthWeeks(
  { year, month }: CalendarMonth,
  { firstDay, min, max }: { firstDay: 0 | 1; min: string; max: string },
): (CalendarDay | null)[][] {
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() - firstDay + 7) % 7;
  const cells: (CalendarDay | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) {
    const date = isoDate(year, month, day);
    cells.push({ date, day, disabled: date < min || date > max });
  }
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}
