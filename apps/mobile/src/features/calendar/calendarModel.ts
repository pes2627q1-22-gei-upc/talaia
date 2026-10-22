import type { Esdeveniment } from '@talaia/shared';

import { isoDate, type CalendarMonth } from '@/shared/ui/calendarGrid';

export type CalendarFilter = 'all' | 'meteor' | 'moon' | 'sun' | 'other';

export const CALENDAR_FILTERS: CalendarFilter[] = ['all', 'meteor', 'moon', 'sun', 'other'];

export function monthBounds(month: CalendarMonth) {
  return {
    from: isoDate(month.year, month.month, 1),
    to: isoDate(
      month.year,
      month.month,
      new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate(),
    ),
  };
}

/** Setmana de dilluns a diumenge que conté una data local `YYYY-MM-DD`. */
export function weekBounds(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const format = (value: Date) =>
    isoDate(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  return { from: format(monday), to: format(sunday) };
}

/** Inclou les setmanes que travessen el primer i l'últim dia del mes visible. */
export function calendarWindowBounds(month: CalendarMonth) {
  const { from, to } = monthBounds(month);
  return { from: weekBounds(from).from, to: weekBounds(to).to };
}

export function nextDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return isoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** El contracte de l'API defineix els dies civils en hora de Catalunya. */
export function cataloniaDate(instant: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const value = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** Mil·lisegons fins al següent dia civil a Catalunya, inclosos els canvis d'hora. */
export function millisecondsUntilNextCataloniaDay(now: Date) {
  const next = nextDay(cataloniaDate(now.toISOString()));
  let before = now.getTime();
  let after = before + 27 * 60 * 60 * 1000;
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (cataloniaDate(new Date(middle).toISOString()) >= next) after = middle;
    else before = middle;
  }
  return after - now.getTime();
}

export function eventDate(event: Esdeveniment) {
  return cataloniaDate(event.maxim ?? event.inici);
}

export function eventFilter(type: string): Exclude<CalendarFilter, 'all'> {
  if (type === 'pluja_estels') return 'meteor';
  if (type === 'fase_llunar' || type === 'eclipsi_llunar' || type === 'superlluna') return 'moon';
  if (type === 'eclipsi_solar') return 'sun';
  return 'other';
}

export function filterEvents(events: Esdeveniment[], filter: CalendarFilter) {
  return events
    .filter((event) => filter === 'all' || eventFilter(event.tipus) === filter)
    .sort((a, b) => (a.maxim ?? a.inici).localeCompare(b.maxim ?? b.inici));
}

/** Dies actuals i futurs primer; dies passats al final, del més recent al més antic. */
export function orderEventsAroundToday(events: Esdeveniment[], today: string) {
  return [...events].sort((a, b) => {
    const dayA = eventDate(a);
    const dayB = eventDate(b);
    const pastA = dayA < today;
    const pastB = dayB < today;
    if (pastA !== pastB) return pastA ? 1 : -1;
    return pastA ? dayB.localeCompare(dayA) : dayA.localeCompare(dayB);
  });
}
