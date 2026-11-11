import type { Esdeveniment, EsdevenimentDetall, PrecisioTemporal } from '@talaia/shared';

import { cataloniaDate } from '@/features/calendar/calendarModel';
import { twoDigitHours } from '@/features/point/pointModel';

const HOUR = 3_600_000;
/** Abans d'aquesta hora, un esdeveniment curt encara és de la nit anterior. */
const DAWN_HOUR = 6;

/** Una nit d'observació: del vespre d'un dia civil al matí del següent, a Catalunya. */
export type Night = { from: string; to: string };

export type Precision = EsdevenimentDetall['horari']['precisio'];

/**
 * Com es pot dir quan passa un esdeveniment. La forma ve de la durada; les hores, de la
 * precisió que publica l'API (`horari.precisio`): un instant amb precisió `dia` no en té.
 * - `season`: les pluges d'estels. Duren setmanes, es publiquen per dies (límits de dia UTC,
 *   ADR-0026) i el màxim, segons la font, té el dia, l'hora o el minut.
 * - `day`: les fases de la Lluna. Ocupen el dia civil sencer i el màxim és l'instant exacte.
 * - `window`: eclipsis i conjuncions. Duren unes hores, amb inici, màxim i fi.
 */
export type EventSchedule =
  | { kind: 'season'; from: string; to: string; peak: { date: string; time: string | null } | null }
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

const span = (event: Esdeveniment) => Date.parse(event.fi) - Date.parse(event.inici);
const hasTime = (precision: PrecisioTemporal | null) => precision !== null && precision !== 'dia';

/**
 * Les dades del calendari no porten la precisió: mentre arriba el detall, o si falla, es pren
 * la que tenen avui les dades de cada forma. El migdia UTC d'una pluja és el marcador del dia
 * del màxim (README de l'API); qualsevol altra hora és publicada.
 */
export function provisionalPrecision(event: Esdeveniment): Precision {
  const days = span(event) >= 23 * HOUR;
  const dayMarker = days && /T12:00:00(\.000)?Z$/.test(event.maxim ?? '');
  return {
    inici: days ? 'dia' : 'minut',
    fi: days ? 'dia' : 'minut',
    maxim: event.maxim ? (dayMarker ? 'dia' : 'minut') : null,
  };
}

export function eventSchedule(
  event: Esdeveniment,
  precision: Precision = provisionalPrecision(event),
): EventSchedule {
  const peak = event.maxim && hasTime(precision.maxim) ? event.maxim : null;
  if (span(event) > 25 * HOUR) {
    return {
      kind: 'season',
      from: event.inici.slice(0, 10),
      to: event.fi.slice(0, 10),
      peak: event.maxim
        ? { date: cataloniaDate(event.maxim), time: peak && cataloniaTime(peak) }
        : null,
    };
  }
  if (precision.inici === 'dia' && precision.fi === 'dia') {
    return {
      kind: 'day',
      date: cataloniaDate(event.maxim ?? event.inici),
      exact: peak && cataloniaTime(peak),
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
    peak: peak && cataloniaTime(peak),
    // De matinada, qui hi vol anar ho pensa com la nit anterior: «la nit de diumenge a dilluns».
    night:
      from !== to
        ? { from, to }
        : Number(start.slice(0, 2)) < DAWN_HOUR
          ? { from: previousDay(from), to: from }
          : null,
  };
}
