import type { Esdeveniment } from '@talaia/shared';

import { cataloniaDate, nextDay } from '@/features/calendar/calendarModel';
import { twoDigitHours } from '@/features/point/pointModel';

const HOUR = 3_600_000;
/** Abans d'aquesta hora, un esdeveniment curt encara és de la nit anterior. */
const DAWN_HOUR = 6;

/** Una nit d'observació: del vespre d'un dia civil al matí del següent, a Catalunya. */
export type Night = { from: string; to: string };

/**
 * Com es pot dir quan passa un esdeveniment amb el que dona l'API, que no en publica la precisió.
 * - `season`: les pluges d'estels. Duren setmanes, es publiquen per dies (límits de dia UTC,
 *   ADR-0026) i el màxim de vegades només té el dia: no se'n donen hores.
 * - `day`: les fases de la Lluna. Ocupen el dia civil sencer i el màxim és l'instant exacte.
 * - `window`: eclipsis i conjuncions. Duren unes hores, amb inici, màxim i fi.
 */
export type EventSchedule =
  | { kind: 'season'; from: string; to: string; peakNight: Night | null }
  | { kind: 'day'; date: string; exact: string | null }
  | {
      kind: 'window';
      date: string;
      start: string;
      end: string;
      peak: string | null;
      /** Si travessa la mitjanit, la nit en què passa. */
      night: Night | null;
    };

/** Hora local de Catalunya d'un instant, `HH:MM`. */
export function cataloniaTime(instant: string) {
  return twoDigitHours(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(instant)),
  );
}

function previousDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** El màxim d'una pluja es mira la nit que el conté: si és abans del migdia, la nit anterior. */
export function nightOf(instant: string): Night {
  const date = cataloniaDate(instant);
  return Number(cataloniaTime(instant).slice(0, 2)) < 12
    ? { from: previousDay(date), to: date }
    : { from: date, to: nextDay(date) };
}

export function eventSchedule(event: Esdeveniment): EventSchedule {
  const span = Date.parse(event.fi) - Date.parse(event.inici);
  if (span > 25 * HOUR) {
    return {
      kind: 'season',
      from: event.inici.slice(0, 10),
      to: event.fi.slice(0, 10),
      peakNight: event.maxim ? nightOf(event.maxim) : null,
    };
  }
  // Un dia civil sencer fa 23, 24 o 25 hores, segons el canvi d'hora.
  if (span >= 23 * HOUR) {
    return {
      kind: 'day',
      date: cataloniaDate(event.maxim ?? event.inici),
      exact: event.maxim ? cataloniaTime(event.maxim) : null,
    };
  }
  const from = cataloniaDate(event.inici);
  const to = cataloniaDate(event.fi);
  const start = cataloniaTime(event.inici);
  return {
    kind: 'window',
    date: from,
    start,
    end: cataloniaTime(event.fi),
    peak: event.maxim ? cataloniaTime(event.maxim) : null,
    // De matinada, qui hi vol anar ho pensa com la nit anterior: «la nit de diumenge a dilluns».
    night:
      from !== to
        ? { from, to }
        : Number(start.slice(0, 2)) < DAWN_HOUR
          ? { from: previousDay(from), to: from }
          : null,
  };
}
